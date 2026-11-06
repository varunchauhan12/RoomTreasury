import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Worker } from 'node:worker_threads';
import { FinancialEngine, FinancialError, MAX_CENTS, type HumanActor, type Terms } from '../src/domain/financial-engine.js';
import { authenticate, AuthError, roles, type ServiceContext } from '../src/security/service-auth.js';
import { assertFixtureStorageHasNoSecrets, createFixturePrincipal, issueFixtureCredential, revokeFixtureCredential, setFixtureScopeEnabled } from '../src/security/test-fixtures.js';
import { testDatabase } from './helpers.js';
import { openDatabase } from '../src/db/connection.js';
import { applyMigrations, migrations } from '../src/db/migrations.js';
import BetterSqlite3 from 'better-sqlite3';
import { join } from 'node:path';
import { temporaryRoot } from './helpers.js';

const owner:HumanActor=Object.freeze({kind:'human',id:'synthetic-owner',projectId:'p',role:'owner'});
const producer:HumanActor=Object.freeze({kind:'human',id:'synthetic-producer',projectId:'p',role:'requester'});
const operator={kind:'operator' as const,id:'synthetic-operator'};
const input=(amountCents:number,purpose='Editing'):Terms=>({recipientId:'eli',amountCents,purpose,currency:'USD',sourceRefs:['synthetic:producer-message']});
const code=(fn:()=>unknown,expected:string)=>assert.throws(fn,(e:unknown)=>e instanceof FinancialError && e.code===expected);
function fixture(t:TestContext,budget=10000) {
 const data=testDatabase(t); const engine=new FinancialEngine(data.db);
 engine.initializeProject(operator,'p','Synthetic project',budget); engine.addRecipient(producer,'p','eli','Eli');
 const principal=createFixturePrincipal(data.db,'p','treasury_ops');
 const credential=issueFixtureCredential(data.db,principal);
 const treasury=authenticate(data.db,credential);
 return {...data,engine,treasury,credential};
}
const snapshot=(db:BetterSqlite3.Database)=>JSON.stringify(['projects','commitments','payment_requests','request_revisions','payment_approvals','reservations','ledger_entries','settlement_receipts','settlement_idempotency','financial_audit_events'].map(table=>db.prepare(`SELECT * FROM ${table}`).all()));

test('full $100 demo: proposed $40, owner confirmation, $70 rejection, $55 revision, atomic hold and one immutable receipt',t=>{
 const {engine,db,treasury}=fixture(t);
 assert.deepEqual(engine.balance('p'),{budget:10000,committed:0,reserved:0,spent:0,available:10000});
 const promise=engine.proposeCommitment(producer,'p',input(4000,'Captioning'));
 assert.equal(engine.balance('p').available,10000);
 code(()=>engine.confirmCommitment(producer,'p',promise),'FORBIDDEN');
 engine.confirmCommitment(owner,'p',promise); engine.confirmCommitment(owner,'p',promise);
 assert.equal(engine.balance('p').available,6000);
 assert.equal(db.prepare("SELECT count(*) FROM financial_audit_events WHERE action='commitment_confirmed'").pluck().get(),1);
 const request=engine.createRequest(producer,'p',input(7000));
 assert.deepEqual(engine.evaluateRequest(producer,'p',request.requestId,1),{accepted:false,shortfallCents:1000});
 const before=snapshot(db);
 code(()=>engine.approveRequest(owner,'p',request.requestId,1),'INSUFFICIENT_FUNDS'); assert.equal(snapshot(db),before);
 const rev=engine.reviseRequest(producer,'p',request.requestId,1,input(5500,'Shorter edit'));
 assert.equal(rev,2); assert.equal(db.prepare('SELECT amount_cents FROM request_revisions ORDER BY revision').pluck().all().join(','),'7000,5500');
 code(()=>engine.approveRequest(owner,'p',request.requestId,1),'CONFLICT');
 assert.equal(engine.evaluateRequest(producer,'p',request.requestId,2).accepted,true);
 const approval=engine.approveRequest(owner,'p',request.requestId,2);
 assert.equal(engine.approveRequest(owner,'p',request.requestId,2),approval);
 assert.deepEqual(engine.balance('p'),{budget:10000,committed:4000,reserved:5500,spent:0,available:500});
 const receipt=engine.settle(treasury,'p',request.requestId,2,approval,'same');
 assert.equal(receipt.amount_cents,5500); assert.equal(receipt.purpose,'Shorter edit'); assert.equal(receipt.recipient_id,'eli'); assert.equal(Object.isFrozen(receipt),true);
 assert.deepEqual(engine.settle(treasury,'p',request.requestId,2,approval,'same'),receipt);
 assert.deepEqual(engine.settle(treasury,'p',request.requestId,2,approval,'different'),receipt);
 assert.deepEqual(engine.balance('p'),{budget:10000,committed:4000,reserved:0,spent:5500,available:500});
 for(const table of ['settlement_receipts','ledger_entries']) {
  assert.equal(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),1);
  assert.throws(()=>db.exec(`UPDATE ${table} SET amount_cents=1`)); assert.throws(()=>db.exec(`DELETE FROM ${table}`));
 }
 code(()=>engine.settle(treasury,'p',request.requestId,2,'wrong','same'),'CONFLICT');
 code(()=>engine.reviseRequest(producer,'p',request.requestId,2,input(1)),'CONFLICT');
 code(()=>engine.approveRequest(owner,'p',request.requestId,2),'CONFLICT');
 code(()=>engine.evaluateRequest(producer,'p',request.requestId,2),'CONFLICT');
 assert.equal((db.pragma('foreign_key_check') as unknown[]).length,0);
});

test('revision releases unused reservation and requires approval for new recipient, purpose and amount',t=>{
 const {engine,db,treasury}=fixture(t);
 const req=engine.createRequest(producer,'p',input(5500)); const old=engine.approveRequest(owner,'p',req.requestId,1);
 engine.addRecipient(producer,'p','other','Other recipient');
 const next={...input(6000,'Changed purpose'),recipientId:'other'};
 code(()=>engine.reviseRequest({...producer,id:'other-human'},'p',req.requestId,1,next),'FORBIDDEN');
 engine.reviseRequest(producer,'p',req.requestId,1,next);
 assert.equal(engine.balance('p').reserved,0);
 code(()=>engine.settle(treasury,'p',req.requestId,1,old,'old'),'CONFLICT');
 code(()=>engine.settle(treasury,'p',req.requestId,2,old,'old'),'CONFLICT');
 const approval=engine.approveRequest(owner,'p',req.requestId,2);
 const receipt=engine.settle(treasury,'p',req.requestId,2,approval,'new');
 assert.equal(receipt.recipient_id,'other'); assert.equal(receipt.amount_cents,6000); assert.equal(receipt.purpose,next.purpose);
 assert.equal(db.prepare("SELECT count(*) FROM reservations WHERE state='released'").pluck().get(),1);
 assert.throws(()=>db.exec('UPDATE request_revisions SET purpose=\'tampered\''));
 assert.throws(()=>db.exec('UPDATE payment_approvals SET revision=2'));
});

test('all five service roles denied owner confirmation/approval; Coordinator denied settlement',t=>{
 const {engine,db}=fixture(t);
 const commitment=engine.proposeCommitment(producer,'p',input(4000)); const request=engine.createRequest(producer,'p',input(5500));
 for(const role of roles) {
  const id=createFixturePrincipal(db,role==='treasury_ops'?'alternate':'p',role);
  const context=authenticate(db,issueFixtureCredential(db,id));
  assert.throws(()=>engine.confirmCommitment(context,'p',commitment),(error:unknown)=>error instanceof AuthError && error.statusCode===403);
  assert.throws(()=>engine.approveRequest(context,'p',request.requestId,1),(error:unknown)=>error instanceof AuthError && error.statusCode===403);
  assert.throws(()=>engine.confirmCommitment({...context,role:'owner'} as ServiceContext,'p',commitment));
  assert.throws(()=>engine.settle(context,'p',request.requestId,1,'none','k'));
 }
 assert.equal(engine.balance('p').committed,0); assert.equal(engine.balance('p').reserved,0);
 code(()=>engine.confirmCommitment({...owner,projectId:'other'},'p',commitment),'FORBIDDEN');
});

test('Treasury authorization and replay recheck revoked credentials, disabled scopes and project ownership',t=>{
 const {engine,db,treasury}=fixture(t);
 const request=engine.createRequest(producer,'p',input(5500));const approval=engine.approveRequest(owner,'p',request.requestId,1);
 const receipt=engine.settle(treasury,'p',request.requestId,1,approval,'k');
 assert.throws(()=>engine.settle(treasury,'different',request.requestId,1,approval,'k'));
 setFixtureScopeEnabled(db,treasury.principalId,'p',false);
 assert.throws(()=>engine.settle(treasury,'p',request.requestId,1,approval,'k'));
 setFixtureScopeEnabled(db,treasury.principalId,'p',true);
 revokeFixtureCredential(db,treasury.principalId);
 code(()=>engine.settle(treasury,'p',request.requestId,1,approval,'k'),'FORBIDDEN');
 assert.equal(db.prepare('SELECT id FROM settlement_receipts').pluck().get(),receipt.id);
});

test('idempotency key cannot be rebound to a different request; a different key still gives one spend',t=>{
 const {engine,treasury,db}=fixture(t);
 const a=engine.createRequest(producer,'p',input(1000)); const b=engine.createRequest(producer,'p',input(1000));
 const aa=engine.approveRequest(owner,'p',a.requestId,1), ba=engine.approveRequest(owner,'p',b.requestId,1);
 const receipt=engine.settle(treasury,'p',a.requestId,1,aa,'key');
 code(()=>engine.settle(treasury,'p',b.requestId,1,ba,'key'),'CONFLICT');
 assert.equal(engine.settle(treasury,'p',a.requestId,1,aa,'another').id,receipt.id);
 assert.equal(db.prepare('SELECT count(*) FROM ledger_entries').pluck().get(),1);
 assert.equal(engine.balance('p').reserved,1000);
});

test('injected failures roll back confirmation, approval, revision, settlement and idempotency as whole transactions',t=>{
 const {engine,db,treasury}=fixture(t);
 const promise=engine.proposeCommitment(producer,'p',input(1000));
 const request=engine.createRequest(producer,'p',input(5500));
 db.exec("CREATE TRIGGER inject BEFORE INSERT ON financial_audit_events BEGIN SELECT RAISE(ABORT,'injected'); END;");
 let before=snapshot(db);
 code(()=>engine.confirmCommitment(owner,'p',promise),'STORAGE_FAILURE'); assert.equal(snapshot(db),before);
 code(()=>engine.approveRequest(owner,'p',request.requestId,1),'STORAGE_FAILURE'); assert.equal(snapshot(db),before);
 db.exec('DROP TRIGGER inject'); const approval=engine.approveRequest(owner,'p',request.requestId,1);
 db.exec("CREATE TRIGGER inject BEFORE INSERT ON financial_audit_events BEGIN SELECT RAISE(ABORT,'injected'); END;"); before=snapshot(db);
 code(()=>engine.reviseRequest(producer,'p',request.requestId,1,input(5000)),'STORAGE_FAILURE'); assert.equal(snapshot(db),before);
 code(()=>engine.settle(treasury,'p',request.requestId,1,approval,'k'),'STORAGE_FAILURE'); assert.equal(snapshot(db),before);
 db.exec('DROP TRIGGER inject');
 db.exec("CREATE TRIGGER inject BEFORE INSERT ON settlement_idempotency BEGIN SELECT RAISE(ABORT,'injected'); END;");
 code(()=>engine.settle(treasury,'p',request.requestId,1,approval,'k'),'STORAGE_FAILURE'); assert.equal(snapshot(db),before);
 db.exec('DROP TRIGGER inject'); engine.settle(treasury,'p',request.requestId,1,approval,'k');
 assert.equal(engine.balance('p').spent,5500);
});

test('positive bounded integer USD inputs and SQL constraints reject invalid amounts, currencies and relationships',t=>{
 const {engine,db}=fixture(t);
 for(const invalid of [0,-1,1.1,NaN,Infinity,MAX_CENTS+1,Number.MAX_SAFE_INTEGER,'1' as unknown as number]) {
  code(()=>engine.createRequest(producer,'p',input(invalid)),'INVALID_INPUT');
  code(()=>engine.proposeCommitment(producer,'p',input(invalid)),'INVALID_INPUT');
 }
 code(()=>engine.createRequest(producer,'p',{...input(100),currency:'EUR' as 'USD'}),'INVALID_INPUT');
 code(()=>engine.createRequest(producer,'p',{...input(100),purpose:' '}),'INVALID_INPUT');
 const c=engine.proposeCommitment(producer,'p',input(100));
 for(const value of [0,-1,1.5,MAX_CENTS+1]) assert.throws(()=>db.prepare("INSERT INTO commitments VALUES ('bad','p','eli',?,'p','USD','[]','proposed',NULL)").run(value));
 assert.throws(()=>db.exec("INSERT INTO commitments VALUES ('bad','p','eli',1,'p','USD','[]','confirmed','owner')"));
 assert.throws(()=>db.exec("INSERT INTO commitments VALUES ('bad','p','missing',1,'p','USD','[]','proposed',NULL)"));
 assert.throws(()=>db.exec("UPDATE commitments SET amount_cents=200,state='confirmed',confirmed_by='owner'"));
 engine.confirmCommitment(owner,'p',c);
 assert.throws(()=>db.exec("UPDATE commitments SET state='proposed',confirmed_by=NULL"));
 assert.throws(()=>db.exec('DELETE FROM commitments'));
 assert.throws(()=>db.exec("INSERT INTO payment_requests VALUES ('bad','p','producer',2)"));
 assert.throws(()=>db.exec('UPDATE projects SET budget_cents=20000'));
 assert.throws(()=>db.exec('UPDATE financial_audit_events SET action=\'edited\''));
 assert.throws(()=>db.exec('DELETE FROM financial_audit_events'));
});

test('budget checks preserve existing holds and aggregate cap; proposed obligations cannot force overspend',t=>{
 const {engine,db}=fixture(t,MAX_CENTS);
 const req=engine.createRequest(producer,'p',input(MAX_CENTS));engine.approveRequest(owner,'p',req.requestId,1);
 const promise=engine.proposeCommitment(producer,'p',input(1));
 code(()=>engine.confirmCommitment(owner,'p',promise),'INSUFFICIENT_FUNDS');
 assert.throws(()=>db.prepare("UPDATE commitments SET state='confirmed',confirmed_by='owner' WHERE id=?").run(promise));
 assert.equal(engine.balance('p').available,0);
 const other=engine.createRequest(producer,'p',input(1));
 code(()=>engine.approveRequest(owner,'p',other.requestId,1),'INSUFFICIENT_FUNDS');
});

async function contender(data:object) {
 const worker=new Worker(new URL('./financial-worker.js',import.meta.url),{workerData:data});
 const exited=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));
 await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});
 return {worker,exited,result:new Promise<{ok:boolean;code?:string;result?:{id:string}}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);})};
}
test('two actual concurrent connections approving $60 each cannot overspend a $100 budget',async t=>{
 const {engine,config}=fixture(t);
 const a=engine.createRequest(producer,'p',input(6000)),b=engine.createRequest(producer,'p',input(6000));
 const workers=await Promise.all([a,b].map(req=>contender({config,actor:owner,requestId:req.requestId})));
 for(const {worker} of workers) worker.postMessage('go');
 const results=await Promise.all(workers.map(w=>w.result));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok)?.code,'INSUFFICIENT_FUNDS');
 assert.deepEqual(engine.balance('p'),{budget:10000,committed:0,reserved:6000,spent:0,available:4000});
 await Promise.all(workers.map(w=>w.exited));
});

test('concurrent settlements with different keys converge to one receipt across connections and reopen',async t=>{
 const {engine,config,treasury,db}=fixture(t);
 const req=engine.createRequest(producer,'p',input(5500));const approvalId=engine.approveRequest(owner,'p',req.requestId,1);
 const workers=await Promise.all(['a','b'].map(key=>contender({config,actor:treasury,requestId:req.requestId,operation:'settle',approvalId,key})));
 for(const {worker} of workers) worker.postMessage('go');
 const results=await Promise.all(workers.map(w=>w.result));
 assert.ok(results.every(r=>r.ok));assert.equal(results[0]!.result!.id,results[1]!.result!.id);
 await Promise.all(workers.map(w=>w.exited));
 assert.equal(db.prepare('SELECT count(*) FROM ledger_entries').pluck().get(),1);
 const second=openDatabase(config);try {
  assert.equal(new FinancialEngine(second).settle(treasury,'p',req.requestId,1,approvalId,'third').id,results[0]!.result!.id);
 }finally{second.close();}
});

test('v2 upgrades through v4 without changing history, repeats once, and real-mode engine fails closed',t=>{
 const root=temporaryRoot(t);const db=new BetterSqlite3(join(root,'upgrade.sqlite'));
 try {
  db.pragma('foreign_keys=ON');applyMigrations(db,'test',migrations.slice(0,2));
  const principal=createFixturePrincipal(db,'legacy-project','request'); const token=issueFixtureCredential(db,principal);
  const identityBefore=db.prepare('SELECT * FROM service_principals').all();
  const old=db.prepare('SELECT * FROM schema_migrations').all();
  applyMigrations(db,'test');applyMigrations(db,'test');assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<3').all(),old);
  assert.equal(db.prepare('SELECT count(*) FROM schema_migrations').pluck().get(),8);
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
  assert.deepEqual(db.prepare('SELECT * FROM service_principals').all(),identityBefore);
  assert.equal(authenticate(db,token).principalId,principal);
 }finally{try{assertFixtureStorageHasNoSecrets(db);}finally{db.close();assertFixtureStorageHasNoSecrets(db);}}
 const real=new BetterSqlite3(join(root,'isolated-real.sqlite'));
 try {real.pragma('foreign_keys=ON');applyMigrations(real,'real');code(()=>new FinancialEngine(real).initializeProject(operator,'p','blocked',10000),'MODE_DISABLED');assert.equal(real.prepare('SELECT count(*) FROM projects').pluck().get(),0);}
 finally{real.close();}
});

test('SQL enforces approval/hold pairing, hold transitions, budget capacity and spend/receipt atomic pairing',t=>{
 const {engine,db}=fixture(t);
 const first=engine.createRequest(producer,'p',input(6000)); const approval=engine.approveRequest(owner,'p',first.requestId,1);
 const second=engine.createRequest(producer,'p',input(6000));
 assert.throws(()=>db.prepare('INSERT INTO payment_approvals VALUES (?,?,?,?)').run('orphan',second.requestId,1,'owner'));
 assert.equal(db.prepare("SELECT count(*) FROM payment_approvals WHERE id='orphan'").pluck().get(),0);
 assert.throws(()=>db.transaction(()=>{
  db.prepare('INSERT INTO payment_approvals VALUES (?,?,?,?)').run('over',second.requestId,1,'owner');
  db.prepare("INSERT INTO reservations VALUES ('over-hold','over',?,1,'active')").run(second.requestId);
 }).immediate());
 const hold=db.prepare('SELECT id FROM reservations WHERE approval_id=?').pluck().get(approval) as string;
 assert.throws(()=>db.prepare("UPDATE reservations SET state='consumed' WHERE id=?").run(hold));
 assert.throws(()=>db.prepare('INSERT INTO ledger_entries VALUES (?,?,?,?,?,?,?,?)').run('bad',first.requestId,1,approval,hold,1,'USD','missing'));
 // Even a correctly sized spend cannot commit without its exact receipt. Its consumption trigger rolls back too.
 const before=snapshot(db);
 assert.throws(()=>db.prepare('INSERT INTO ledger_entries VALUES (?,?,?,?,?,?,?,?)').run('bad',first.requestId,1,approval,hold,6000,'USD','missing'));
 assert.equal(snapshot(db),before);
 assert.throws(()=>db.exec("UPDATE reservations SET state='unknown'"));
 assert.throws(()=>db.exec("UPDATE request_revisions SET currency='EUR'"));
 assert.throws(()=>db.exec('DELETE FROM reservations'));
});

test('expired or rotated-away Treasury contexts cannot settle even when previously authenticated',async t=>{
 const {engine,db,treasury}=fixture(t);
 const req=engine.createRequest(producer,'p',input(1000)); const approval=engine.approveRequest(owner,'p',req.requestId,1);
 const replacement=issueFixtureCredential(db,treasury.principalId,true,200);
 const context=authenticate(db,replacement);
 code(()=>engine.settle(treasury,'p',req.requestId,1,approval,'old'),'FORBIDDEN');
 await new Promise(resolve=>setTimeout(resolve,220));
 code(()=>engine.settle(context,'p',req.requestId,1,approval,'expired'),'FORBIDDEN');
 assert.equal(engine.balance('p').spent,0); assert.equal(engine.balance('p').reserved,1000);
});
