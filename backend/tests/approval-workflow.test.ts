import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {testDatabase} from './helpers.js';
import {provisionOwner,loginOwner} from '../src/security/owner-auth.js';
import {onboardProject} from '../src/jobs/bindings.js';
import {ApprovalWorkflow,type DecisionInput} from '../src/approvals/service.js';
import {gateChecks,type Gate} from '../src/approvals/policy.js';
import {ProcessingJobs} from '../src/jobs/service.js';
import {MockTransport} from '../src/jobs/transport.js';
import {previewProjectImport,confirmProjectImport} from '../src/imports/project-linked.js';
import {buildApp} from '../src/app.js';
import type {ImportBundle} from '../src/imports/service.js';
import {applyMigrations,migrations} from '../src/db/migrations.js';
import Database from 'better-sqlite3';
const password='Disposable isolated approval test passphrase';
async function fixture(t:TestContext){
 const {db}=testDatabase(t);
 await provisionOwner(db,'staged-owner',password,'fixture');
 const login=await loginOwner(db,'staged-owner',password,'fixture');
 const binding=onboardProject(db,login.session,{clientName:'[TEST] Sequential owner approvals',brief:'Synthetic client scope. Responsive landing page.',revenueCents:200000},'stage-onboard');
 const workflow=new ApprovalWorkflow(db),jobs=new ProcessingJobs(db);
 const project=binding.client_project_id;
 const input=(gate:Gate,decision:DecisionInput['decision']='approve'):DecisionInput=>{
  const state=workflow.snapshot(login.session,project),current=state.gates.find(g=>g.id===gate)!;
  return {gate,subjectHash:current.subjectHash,decision,reason:'Owner verified fixture scope, risks and evidence.',
   evidence:['fixture:documented-owner-evidence'],checks:[...gateChecks[gate]],...(decision==='changes'?{sections:['costs' as const]}:{})};
 };
 const decide=(gate:Gate,decision:DecisionInput['decision']='approve',key=gate+'-'+decision)=>workflow.decide(login.session,project,input(gate,decision),key);
 return {db,...login,binding,workflow,jobs,project,input,decide};
}
function bundle(task:string,explanation='Fixture imported cost model'):ImportBundle{
 const p=JSON.parse(readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json','utf8').replaceAll('RT-APEX-001',task));
 p.client.name='[TEST] Sequential owner approvals';p.project.brief='Synthetic client scope. Responsive landing page.';
 p.project.agreedRevenueCents=200000;p.financialSummary.agreedRevenueCents=200000;
 p.financialSummary.projectedGrossMarginCents=200000-p.proposal.budgetCents;
 p.financialSummary.projectedGrossMarginPercent=100*p.financialSummary.projectedGrossMarginCents/200000;
 for(const scenario of p.financialSummary.scenarios)scenario.projectedGrossMarginCents=200000-scenario.totalCostCents;
 p.proposal.explanation=explanation;
 return {proposal:{name:'proposal.json',content:JSON.stringify(p)},
  evidence:{name:'evidence.json',content:readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-specialist-evidence.json','utf8').replaceAll('RT-APEX-001',task)},
  summary:{name:'summary.md',content:'[TEST] Recorded artifact fixture for '+task}};
}
async function imported(f:Awaited<ReturnType<typeof fixture>>){
 f.decide('intake');
 const job=f.jobs.create(f.session,f.binding.id,'first-analysis');
 await f.jobs.runNext(new MockTransport());
 const files=bundle(f.binding.task_id),preview=previewProjectImport(f.db,f.session,f.project,files);
 return {...confirmProjectImport(f.db,f.session,f.project,files,preview),job,files};
}
test('intake authorization checks evidence and scope, gates dispatch, and cannot be skipped through HTTP or jobs',async t=>{
 const f=await fixture(t);
 assert.throws(()=>f.jobs.create(f.session,f.binding.id,'unauthorized'),{code:'INTAKE_AUTHORIZATION_REQUIRED'});
 assert.throws(()=>f.workflow.decide(f.session,f.project,{...f.input('intake'),checks:[]},'no-checklist'),{code:'OWNER_CHECKLIST_REQUIRED'});
 assert.throws(()=>f.workflow.decide(f.session,f.project,{...f.input('intake'),evidence:[]},'no-evidence'),{code:'REASON_AND_EVIDENCE_REQUIRED'});
 assert.throws(()=>f.decide('activation'),{code:'APPROVAL_GATE_BLOCKED'});
 const app=await buildApp(f.db);t.after(()=>app.close());
 const path='/v1/client-projects/'+f.project+'/approval-workflow';
 assert.equal((await app.inject(path)).statusCode,401);
 const headers={origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000',cookie:'rt_demo_owner='+f.token,'idempotency-key':'http-intake'};
 assert.equal((await app.inject({method:'POST',url:path+'/decisions',headers,payload:f.input('intake')})).statusCode,403);
 const accepted=await app.inject({method:'POST',url:path+'/decisions',headers:{...headers,'x-csrf-token':f.session.csrf},payload:f.input('intake')});
 assert.equal(accepted.statusCode,200,accepted.body);
 assert.equal(accepted.json().gates[0].status,'approved');
 assert.ok(f.jobs.create(f.session,f.binding.id,'authorized').id);
 assert.throws(()=>f.workflow.decide(f.session,f.project,{...f.input('proposal'),reason:' '},'empty-reason'),{code:'REASON_AND_EVIDENCE_REQUIRED'});
});
test('rejection and clarification retain history and allow a separately verified intake decision',async t=>{
 const f=await fixture(t);
 const rejected=f.decide('intake','reject');assert.equal(rejected.gates[0]!.status,'rejected');
 assert.throws(()=>f.jobs.create(f.session,f.binding.id,'denied'),{code:'INTAKE_AUTHORIZATION_REQUIRED'});
 const blocked=f.decide('intake','blocked');assert.equal(blocked.gates[0]!.status,'blocked');
 f.decide('intake','approve');
 assert.equal(f.workflow.snapshot(f.session,f.project).decisions.length,3);
 assert.ok(f.jobs.create(f.session,f.binding.id,'allowed').id);
 assert.throws(()=>f.db.exec('DELETE FROM approval_decisions'),/retain/);
});
test('requesting changes preserves old approvals, invalidates dependent gates, creates an analysis revision and regenerates reports',async t=>{
 const f=await fixture(t),original=await imported(f);
 const prior=f.workflow.snapshot(f.session,f.project);
 const stale=f.input('proposal');
 f.decide('proposal');
 const first=f.workflow.snapshot(f.session,f.project).decisions;
 const changed=f.decide('proposal','changes');
 assert.equal(changed.gates[1]!.status,'changes_requested');
 assert.equal(changed.analysis!.revision,1);
 assert.deepEqual(changed.analysis!.specialists,['treasury-ops-agent']);
 assert.ok(changed.analysis!.pending);
 assert.equal(f.db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),1);
 assert.throws(()=>f.workflow.decide(f.session,f.project,stale,'stale-approval'),{code:'STALE_APPROVAL_SUBJECT'});
 assert.throws(()=>f.decide('commercial'),{code:'APPROVAL_GATE_BLOCKED'});
 const job=f.workflow.reanalyze(f.session,f.project,'owner-explicit-reanalysis');
 assert.equal(job.transport,'discord');assert.notEqual(job.id,original.job.id);
 assert.equal(f.workflow.reanalyze(f.session,f.project,'retry-same-analysis').id,job.id);
 const intake=JSON.parse(job.intake_snapshot);assert.equal(intake.analysisRevision,changed.analysis!.id);
 assert.equal(intake.changeInstructions,changed.analysis!.instructions);
 assert.equal(intake.sourceRevisionId,prior.review!.revision.id);
 assert.equal(intake.sourceFingerprint,prior.review!.revision.fingerprint);
 assert.equal(intake.sourceProposal.taskId,f.binding.task_id);
 // Persisted artifact fixtures exercise the existing manual import after a deterministic attention state.
 const claimed=f.jobs.claim('discord')!;
 for(const state of ['dispatched','running','collecting','validating'] as const)f.jobs.apply(job.id,claimed.lease_owner!,state,state);
 f.jobs.apply(job.id,claimed.lease_owner!,'await-artifact','needs_attention','artifact_validation_failed');
 const files=bundle(f.binding.task_id,'Fixture revised explanation after owner change request');
 const preview=previewProjectImport(f.db,f.session,f.project,files);
 const updated=confirmProjectImport(f.db,f.session,f.project,files,preview);
 assert.notEqual(updated.id,original.id);
 const after=f.workflow.snapshot(f.session,f.project);
 assert.equal(after.analysis!.pending,false);
 assert.notEqual(after.review!.revision.fingerprint,prior.review!.revision.fingerprint);
 assert.ok(after.gates.slice(1).every(g=>g.status!=='approved'));
 const old=f.db.prepare('SELECT id FROM approval_decisions WHERE id=?').get(first[1]!.id);assert.ok(old);
 const reports=f.workflow.reports(f.session,f.project) as {snapshot:string;snapshot_hash:string;fingerprint:string}[];
 assert.ok(reports.length>=4);
 assert.equal(reports[0]!.fingerprint,after.review!.revision.fingerprint);
 for(const r of reports)assert.equal(createHash('sha256').update(r.snapshot).digest('hex'),r.snapshot_hash);
 f.workflow.regenerate(f.session,f.project);const count=f.workflow.reports(f.session,f.project).length;
 f.workflow.regenerate(f.session,f.project);assert.equal(f.workflow.reports(f.session,f.project).length,count);
 assert.deepEqual(f.db.pragma('foreign_key_check'),[]);
 for(const table of ['projects','payment_approvals','commitments','settlement_receipts'])assert.equal(f.db.prepare('SELECT count(*) FROM '+table).pluck().get(),0);
});
test('cross-project decisions, stale subjects and duplicate/conflicting decisions cannot alter approvals',async t=>{
 const f=await fixture(t),input=f.input('intake');
 const result=f.workflow.decide(f.session,f.project,input,'one');
 assert.equal(f.workflow.decide(f.session,f.project,input,'one').decisions.length,result.decisions.length);
 assert.throws(()=>f.workflow.decide(f.session,f.project,{...input,reason:'Conflicting key'},'one'),{code:'IDEMPOTENCY_CONFLICT'});
 assert.throws(()=>f.workflow.decide(f.session,f.project,input,'duplicate'),{code:'GATE_ALREADY_DECIDED_FOR_SUBJECT'});
 await provisionOwner(f.db,'different-owner',password,f.binding.task_id);
 const other=await loginOwner(f.db,'different-owner',password,'other');
 assert.throws(()=>f.workflow.snapshot(other.session,f.project),{code:'BOUND_OWNER_SCOPE_REQUIRED'});
 assert.throws(()=>f.workflow.decide(other.session,f.project,f.input('proposal'),'other'),{code:'BOUND_OWNER_SCOPE_REQUIRED'});
});
test('migration 14 preserves populated v13 records and repeats without changing history',async()=>{
 const db=new Database(':memory:');
 try{
  db.pragma('foreign_keys=ON');applyMigrations(db,'test',migrations.slice(0,13));
  await provisionOwner(db,'upgrade-owner',password,'fixture');
  const {session}=await loginOwner(db,'upgrade-owner',password,'fixture');
  const b=onboardProject(db,session,{clientName:'Preserved client',brief:'Preserved brief',revenueCents:10000},'upgrade');
  const before=db.prepare('SELECT * FROM client_projects').all(),old=db.prepare('SELECT * FROM schema_migrations').all();
  applyMigrations(db,'test');applyMigrations(db,'test');
  assert.deepEqual(db.prepare('SELECT * FROM client_projects').all(),before);
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=13').all(),old);
  assert.equal(new ApprovalWorkflow(db).snapshot(session,b.client_project_id).gates[0]!.status,'awaiting_owner');
  assert.equal(db.prepare('SELECT count(*) FROM approval_decisions').pluck().get(),0);
  assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
