import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { AgencyEngine, type ProposalInput } from '../src/domain/agency-engine.js';
import { FinancialEngine, FinancialError, type HumanActor, type Terms } from '../src/domain/financial-engine.js';
import { authenticate, AuthError, roles } from '../src/security/service-auth.js';
import { createFixturePrincipal, issueFixtureCredential } from '../src/security/test-fixtures.js';
import { migrations, applyMigrations } from '../src/db/migrations.js';
import { testDatabase, temporaryRoot } from './helpers.js';

const owner: HumanActor = Object.freeze({kind:'human',id:'synthetic-owner',projectId:'p',role:'owner'});
const requester: HumanActor = Object.freeze({kind:'human',id:'synthetic-requester',projectId:'p',role:'requester'});
const plan: ProposalInput = {
  budgetCents:70000, explanation:'Manually estimated landing-page delivery costs',
  allocations:[{name:'Research',limitCents:10000},{name:'Design',limitCents:15000},{name:'Development',limitCents:35000},{name:'QA',limitCents:10000}]
};
const terms = (amountCents: number, allocationId?: string): Terms => ({recipientId:'eli',amountCents,purpose:'Synthetic delivery cost',currency:'USD',sourceRefs:['synthetic:estimate'],...(allocationId ? {allocationId} : {})});
function code(operation:()=>unknown, expected:string): void {
  assert.throws(operation,(error:unknown)=>error instanceof FinancialError && error.code===expected);
}
function setup(t:TestContext) {
  const data=testDatabase(t); const agency=new AgencyEngine(data.db); const finance=new FinancialEngine(data.db);
  agency.createClientProject(owner,'p','Synthetic SaaS client','Create a SaaS landing page',100000);
  return {...data,agency,finance};
}
function approved(t:TestContext) {
  const data=setup(t); const proposal=data.agency.createProposal(requester,'p',plan);
  data.agency.approveProposal(owner,'p',proposal.proposalId);
  data.finance.addRecipient(requester,'p','eli','Eli');
  return {...data,...proposal};
}
const snapshot = (db:BetterSqlite3.Database) => JSON.stringify(['projects','client_projects','delivery_proposals','workstream_allocations','financial_audit_events']
  .map(table=>db.prepare(`SELECT * FROM ${table}`).all()));

async function contender(data:object) {
  const worker=new Worker(new URL('./financial-worker.js',import.meta.url),{workerData:data});
  const exited=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));
  await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});
  const result=new Promise<{ok:boolean;code?:string;result?:string}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  return {worker,exited,result};
}

test('client revenue remains separate; pending proposal/allocations do not create spendable funds',t=>{
  const {agency,db}=setup(t);
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
  const {proposalId,allocationIds}=agency.createProposal(requester,'p',plan);
  const economics=agency.economics('p',proposalId);
  assert.equal(economics.client.revenue_cents,100000);
  assert.equal(economics.client.financial_project_id,null);
  assert.equal(economics.proposal.budget_cents,70000);
  assert.equal(economics.proposal.provenance,'manual');
  assert.equal(economics.projectedGrossMarginCents,30000);
  assert.equal(economics.delivery,null);
  assert.equal('finalProfit' in economics,false);
  assert.equal('finalGrossMarginCents' in economics,false);
  assert.equal(new Set(allocationIds).size,4);
  assert.deepEqual(economics.allocations.map(a=>a.available),[10000,15000,35000,10000]);
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});

test('a requested AI label without a verified AI result is recorded as manual',t=>{
  const {agency}=setup(t);
  const proposal=agency.createProposal(owner,'p',{...plan,provenance:'ai'});
  assert.equal(agency.economics('p',proposal.proposalId).proposal.provenance,'manual');
});

test('proposal totals, positive integer cents, required fields and SQL constraints are validated atomically',t=>{
  const {agency,db}=setup(t); const before=snapshot(db);
  for(const budgetCents of [0,-1,1.5,Infinity,NaN,1000000001]) code(()=>agency.createProposal(owner,'p',{...plan,budgetCents}),'INVALID_INPUT');
  for(const limitCents of [0,-1,1.5,70001]) code(()=>agency.createProposal(owner,'p',{...plan,allocations:[{name:'One',limitCents}]}),'INVALID_INPUT');
  code(()=>agency.createProposal(owner,'p',{...plan,allocations:[]}), 'INVALID_INPUT');
  code(()=>agency.createProposal(owner,'p',{...plan,explanation:' '}),'INVALID_INPUT');
  code(()=>agency.createProposal(owner,'p',{...plan,allocations:[{name:' ',limitCents:100}]}),'INVALID_INPUT');
  assert.equal(snapshot(db),before);
  const proposal=agency.createProposal(owner,'p',{...plan,allocations:[{name:'One',limitCents:69999}]});
  db.prepare("INSERT INTO workstream_allocations VALUES ('last',?,'Last',1,NULL)").run(proposal.proposalId);
  assert.throws(()=>db.prepare("INSERT INTO workstream_allocations VALUES ('over',?,'Over',1,NULL)").run(proposal.proposalId));
  assert.throws(()=>db.exec("INSERT INTO client_projects VALUES ('bad','Client','Brief',0,'USD','draft',NULL)"));
  assert.throws(()=>db.exec("INSERT INTO client_projects VALUES ('bad','Client','Brief',1,'EUR','draft',NULL)"));
});

test('owner approval creates one immutable delivery project and binds exact proposal and stable allocations',t=>{
  const {agency,finance,db}=setup(t); const proposal=agency.createProposal(requester,'p',plan);
  const alternative=agency.createProposal(requester,'p',{...plan,budgetCents:80000});
  assert.equal(agency.approveProposal(owner,'p',proposal.proposalId),'p');
  const economics=agency.economics('p',proposal.proposalId);
  assert.equal(economics.proposal.status,'approved'); assert.equal(economics.proposal.approved_by,owner.id);
  assert.ok(economics.proposal.approved_at!>0);
  assert.equal(economics.client.financial_project_id,'p'); assert.equal(economics.client.status,'active');
  assert.deepEqual(finance.balance('p'),{budget:70000,committed:0,reserved:0,spent:0,available:70000});
  assert.deepEqual(economics.allocations.map(a=>a.allocationId),proposal.allocationIds);
  assert.equal(db.prepare("SELECT count(*) FROM workstream_allocations WHERE financial_project_id='p'").pluck().get(),4);
  code(()=>agency.approveProposal(owner,'p',proposal.proposalId),'CONFLICT');
  code(()=>agency.approveProposal(owner,'p',alternative.proposalId),'CONFLICT');
  code(()=>agency.createProposal(owner,'p',plan),'CONFLICT');
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),1);
  assert.equal(db.prepare("SELECT count(*) FROM financial_audit_events WHERE action='delivery_proposal_approved'").pluck().get(),1);
  for(const sql of [
    "UPDATE delivery_proposals SET budget_cents=80000", "UPDATE delivery_proposals SET explanation='Edited'",
    "UPDATE delivery_proposals SET provenance='ai'", "UPDATE delivery_proposals SET status='pending',approved_by=NULL,approved_at=NULL",
    "UPDATE workstream_allocations SET limit_cents=1", "UPDATE workstream_allocations SET name='Edited'",
    "UPDATE workstream_allocations SET financial_project_id=NULL", "DELETE FROM workstream_allocations",
    "DELETE FROM delivery_proposals", "UPDATE projects SET budget_cents=100000", "UPDATE client_projects SET revenue_cents=200000"
  ]) assert.throws(()=>db.exec(sql));
  assert.throws(()=>db.prepare("INSERT INTO workstream_allocations VALUES ('late',?,'Late',1,NULL)").run(proposal.proposalId));
});

test('every service role, requester and wrong-project human is denied proposal approval',t=>{
  const {agency,db}=setup(t); const proposal=agency.createProposal(requester,'p',plan);
  code(()=>agency.approveProposal(requester,'p',proposal.proposalId),'FORBIDDEN');
  code(()=>agency.approveProposal({...owner,projectId:'other'},'p',proposal.proposalId),'FORBIDDEN');
  for(const role of roles) {
    const principal=createFixturePrincipal(db,'p',role);
    const actor=authenticate(db,issueFixtureCredential(db,principal));
    assert.throws(()=>agency.approveProposal(actor,'p',proposal.proposalId),(e:unknown)=>e instanceof AuthError && e.statusCode===403);
  }
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
  code(()=>agency.approveProposal(owner,'p','different-proposal'),'NOT_FOUND');
});

test('late approval failure rolls back financial project, binding, approval and audit; retry can succeed',t=>{
  const {agency,db}=setup(t);const proposal=agency.createProposal(owner,'p',plan); const before=snapshot(db);
  db.exec(`CREATE TRIGGER fail_approval BEFORE INSERT ON financial_audit_events WHEN NEW.action='delivery_proposal_approved'
    BEGIN SELECT RAISE(ABORT,'injected'); END;`);
  code(()=>agency.approveProposal(owner,'p',proposal.proposalId),'STORAGE_FAILURE');
  assert.equal(snapshot(db),before);assert.equal(db.inTransaction,false);
  db.exec('DROP TRIGGER fail_approval');agency.approveProposal(owner,'p',proposal.proposalId);
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),1);
});

test('simultaneous owner approvals across connections create exactly one financial project',async t=>{
  const {agency,db,config}=setup(t);const proposal=agency.createProposal(owner,'p',plan);
  const workers=await Promise.all([1,2].map(()=>contender({config,actor:owner,operation:'proposal',proposalId:proposal.proposalId})));
  for(const w of workers) w.worker.postMessage('go');
  const results=await Promise.all(workers.map(w=>w.result)); await Promise.all(workers.map(w=>w.exited));
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok)?.code,'CONFLICT');
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),1);
  assert.equal(db.prepare("SELECT count(*) FROM delivery_proposals WHERE status='approved'").pluck().get(),1);
});

test('allocation commitment + reservation + spend limits hold while project has spare capacity; retry spends once',t=>{
  const {agency,finance,db,allocationIds}=approved(t);const research=allocationIds[0]!;
  const promise=finance.proposeCommitment(requester,'p',terms(4000,research));
  assert.equal(agency.allocationBalance(research).available,10000);
  finance.confirmCommitment(owner,'p',promise);finance.confirmCommitment(owner,'p',promise);
  const request=finance.createRequest(requester,'p',terms(7000,research));
  assert.deepEqual(finance.evaluateRequest(requester,'p',request.requestId,1),{accepted:false,shortfallCents:1000});
  code(()=>finance.approveRequest(owner,'p',request.requestId,1),'INSUFFICIENT_FUNDS');
  const tooMuch=finance.proposeCommitment(requester,'p',terms(6001,research));
  code(()=>finance.confirmCommitment(owner,'p',tooMuch),'INSUFFICIENT_FUNDS');
  const revision=finance.reviseRequest(requester,'p',request.requestId,1,terms(5500,research));
  const approval=finance.approveRequest(owner,'p',request.requestId,revision);
  assert.deepEqual(agency.allocationBalance(research),{allocationId:research,limitCents:10000,committed:4000,reserved:5500,spent:0,available:500});
  const principal=createFixturePrincipal(db,'p','treasury_ops');const treasury=authenticate(db,issueFixtureCredential(db,principal));
  const receipt=finance.settle(treasury,'p',request.requestId,revision,approval,'a');
  assert.equal(finance.settle(treasury,'p',request.requestId,revision,approval,'b').id,receipt.id);
  assert.deepEqual(agency.allocationBalance(research),{allocationId:research,limitCents:10000,committed:4000,reserved:0,spent:5500,available:500});
  assert.equal(finance.balance('p').available,60500);assert.equal(agency.allocationBalance(allocationIds[1]!).available,15000);
  const blocked=finance.createRequest(requester,'p',terms(501,research));
  code(()=>finance.approveRequest(owner,'p',blocked.requestId,1),'INSUFFICIENT_FUNDS');
  assert.equal(db.prepare('SELECT count(*) FROM ledger_entries').pluck().get(),1);
});

test('revisions preserve immutable allocation history and release old holds before reassignment',t=>{
  const {agency,finance,db,allocationIds}=approved(t);const [research,design]=allocationIds as readonly [string,string,...string[]];
  const request=finance.createRequest(requester,'p',terms(9000,research));const old=finance.approveRequest(owner,'p',request.requestId,1);
  finance.reviseRequest(requester,'p',request.requestId,1,terms(12000,design));
  assert.equal(agency.allocationBalance(research).available,10000);
  assert.equal(agency.allocationBalance(design).available,15000);
  code(()=>finance.approveRequest(owner,'p',request.requestId,1),'CONFLICT');
  const next=finance.approveRequest(owner,'p',request.requestId,2);assert.notEqual(next,old);
  assert.equal(agency.allocationBalance(design).available,3000);
  assert.deepEqual(db.prepare('SELECT allocation_id FROM request_allocations WHERE request_id=? ORDER BY revision').pluck().all(request.requestId),[research,design]);
  assert.throws(()=>db.exec('UPDATE request_allocations SET allocation_id=allocation_id'));
  assert.throws(()=>db.exec('DELETE FROM request_allocations'));
});

test('project and allocation caps both hold when all approved allocation capacity is reserved',t=>{
  const {agency,finance,allocationIds}=approved(t);
  for(let i=0;i<allocationIds.length;i++) {
    const request=finance.createRequest(requester,'p',terms(plan.allocations[i]!.limitCents,allocationIds[i]!));
    finance.approveRequest(owner,'p',request.requestId,1);
  }
  assert.equal(finance.balance('p').budget,70000);assert.equal(finance.balance('p').reserved,70000);assert.equal(finance.balance('p').available,0);
  for(const id of allocationIds) assert.equal(agency.allocationBalance(id).available,0);
  const extra=finance.createRequest(requester,'p',terms(1,allocationIds[0]!));
  code(()=>finance.approveRequest(owner,'p',extra.requestId,1),'INSUFFICIENT_FUNDS');
});

test('concurrent requests cannot overspend their allocation even when the project has ample funds',async t=>{
  const {finance,agency,config,allocationIds}=approved(t);
  const requests=[finance.createRequest(requester,'p',terms(6000,allocationIds[0]!)),finance.createRequest(requester,'p',terms(6000,allocationIds[0]!))];
  const workers=await Promise.all(requests.map(request=>contender({config,actor:owner,requestId:request.requestId})));
  for(const w of workers) w.worker.postMessage('go');
  const results=await Promise.all(workers.map(w=>w.result));await Promise.all(workers.map(w=>w.exited));
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok)?.code,'INSUFFICIENT_FUNDS');
  assert.equal(agency.allocationBalance(allocationIds[0]!).available,4000);assert.equal(finance.balance('p').available,64000);
});

test('managed projects reject missing/foreign allocations without partial writes; SQL cannot bypass capacity checks',t=>{
  const {finance,db,agency,allocationIds}=approved(t);
  code(()=>finance.createRequest(requester,'p',terms(1)),'INVALID_INPUT');
  code(()=>finance.proposeCommitment(requester,'p',terms(1)),'INVALID_INPUT');
  assert.equal(db.prepare('SELECT count(*) FROM payment_requests').pluck().get(),0);
  assert.equal(db.prepare('SELECT count(*) FROM commitments').pluck().get(),0);
  const foreignOwner={...owner,projectId:'other'};
  agency.createClientProject(foreignOwner,'other','Other','Other brief',10000);
  const other=agency.createProposal(foreignOwner,'other',{budgetCents:10000,explanation:'Manual',allocations:[{name:'Other',limitCents:10000}]});
  agency.approveProposal(foreignOwner,'other',other.proposalId);
  code(()=>finance.createRequest(requester,'p',terms(1,other.allocationIds[0]!)),'INVALID_INPUT');
  const promise=finance.proposeCommitment(requester,'p',terms(10001,allocationIds[0]!));
  assert.throws(()=>db.prepare("UPDATE commitments SET state='confirmed',confirmed_by='owner' WHERE id=?").run(promise));
  const request=finance.createRequest(requester,'p',terms(10001,allocationIds[0]!));
  assert.throws(()=>db.transaction(()=>{
    db.prepare('INSERT INTO payment_approvals VALUES (?,?,1,?)').run('bypass',request.requestId,owner.id);
    db.prepare("INSERT INTO reservations VALUES ('bypass-hold','bypass',?,1,'active')").run(request.requestId);
  }).immediate());
  assert.equal(finance.balance('p').reserved,0);
  assert.equal(agency.allocationBalance(allocationIds[0]!).available,10000);
});

test('migration 4 upgrades populated M2A databases without altering budgets or history and repeats safely',t=>{
  const db=new BetterSqlite3(join(temporaryRoot(t),'upgrade.sqlite'));
  try {
    db.pragma('foreign_keys=ON');applyMigrations(db,'test',migrations.slice(0,3));
    new FinancialEngine(db).initializeProject({kind:'operator',id:'synthetic-operator'},'legacy','Legacy',10000);
    const before=db.prepare('SELECT * FROM schema_migrations').all();const project=db.prepare('SELECT * FROM projects').get();
    applyMigrations(db,'test');applyMigrations(db,'test');
    assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=3').all(),before);
    assert.deepEqual(db.prepare('SELECT * FROM projects').get(),project);
    assert.equal(db.prepare('SELECT count(*) FROM client_projects').pluck().get(),0);
    assert.equal(db.prepare('SELECT count(*) FROM schema_migrations').pluck().get(),8);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
  } finally {db.close();}
});
