import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,type TestContext} from 'node:test';
import {Worker} from 'node:worker_threads';
import BetterSqlite3 from 'better-sqlite3';
import {testDatabase} from './helpers.js';
import {buildApp} from '../src/app.js';
import {provisionOwner,loginOwner} from '../src/security/owner-auth.js';
import {onboardProject} from '../src/jobs/bindings.js';
import {ProcessingJobs} from '../src/jobs/service.js';
import {validateBundle,importBundle,type ImportBundle} from '../src/imports/service.js';
import {previewProjectImport,confirmProjectImport} from '../src/imports/project-linked.js';
import {gates} from '../src/reviews/service.js';
import {applyMigrations,migrations} from '../src/db/migrations.js';

const base={origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000'};
const intake={clientName:'Synthetic project-linked client',brief:'Build a synthetic landing page with a verified original brief.',revenueCents:200000};
function bundleFor(taskId:string):ImportBundle {
 const proposal=JSON.parse(readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json','utf8').replaceAll('RT-APEX-001',taskId));
 proposal.client.name=intake.clientName;proposal.project.brief=intake.brief;proposal.project.agreedRevenueCents=intake.revenueCents;
 proposal.financialSummary.agreedRevenueCents=intake.revenueCents;proposal.financialSummary.projectedGrossMarginCents=intake.revenueCents-proposal.proposal.budgetCents;
 proposal.financialSummary.projectedGrossMarginPercent=100*proposal.financialSummary.projectedGrossMarginCents/intake.revenueCents;
 for(const scenario of proposal.financialSummary.scenarios)scenario.projectedGrossMarginCents=intake.revenueCents-scenario.totalCostCents;
 return {proposal:{name:'proposal.json',content:JSON.stringify(proposal)},evidence:{name:'evidence.json',content:readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-specialist-evidence.json','utf8').replaceAll('RT-APEX-001',taskId)},summary:{name:'summary.md',content:'# Synthetic package\nThis fixture tests manual project intake, not live agent execution.\nAgreed revenue: $2,000. Delivery proposal: $1,410. Projected margin: $590.'}};
}
function changed(bundle:ImportBundle,edit:(p:any)=>void):ImportBundle {const proposal=JSON.parse(bundle.proposal.content);edit(proposal);return {...bundle,proposal:{...bundle.proposal,content:JSON.stringify(proposal)}};}
async function fixture(t:TestContext){
 const data=testDatabase(t);const ownerId=await provisionOwner(data.db,'linked-owner','Synthetic linked owner password','PREEXISTING');
 const login=await loginOwner(data.db,'linked-owner','Synthetic linked owner password','fixture');
 const binding=onboardProject(data.db,login.session,intake,'linked-onboarding'),jobs=new ProcessingJobs(data.db),job=jobs.create(login.session,binding.id,'linked-job');await jobs.runNext();
 const app=await buildApp(data.db);t.after(()=>app.close());
 const headers={...base,cookie:'rt_demo_owner='+login.token,'x-csrf-token':login.session.csrf};
 const path='/v1/client-projects/'+binding.client_project_id+'/proposal-imports';const bundle=bundleFor(binding.task_id);
 const post=(action:string,payload:object,override:Record<string,string>={})=>app.inject({method:'POST',url:path+'/'+action,headers:{...headers,...override},payload});
 return {...data,...login,ownerId,binding,jobs,job,app,headers,path,bundle,post};
}
async function imported(data:Awaited<ReturnType<typeof fixture>>,bundle=data.bundle){const preview=await data.post('preview',bundle);assert.equal(preview.statusCode,200);const p=preview.json();const confirm=await data.post('confirm',{...bundle,jobId:p.jobId,intakeHash:p.intakeHash,fingerprint:p.fingerprint});assert.equal(confirm.statusCode,200);return {id:confirm.json().id,preview:p,payload:{...bundle,jobId:p.jobId,intakeHash:p.intakeHash,fingerprint:p.fingerprint}};}
async function ready(data:Awaited<ReturnType<typeof fixture>>,id:string){
 const path='/v1/proposal-imports/'+id+'/review';const initial=(await data.app.inject({url:path,headers:data.headers})).json();const proposal=structuredClone(initial.revision.proposal);
 proposal.status='READY_FOR_OWNER_REVIEW';proposal.blockingReviews=[];proposal.ownerDecisionRecommendation.recommendation='SEEK_OWNER_REVIEW';proposal.proposal.explanation+=' Independently reviewed synthetic revision.';
 const response=await data.app.inject({method:'POST',url:path+'/revisions',headers:data.headers,payload:{revisionId:initial.revision.id,fingerprint:initial.revision.fingerprint,proposal,reason:'Owner independently reviewed synthetic scope and costs'}});assert.equal(response.statusCode,200);
 const revised=response.json(),binding={revisionId:revised.revision.id,fingerprint:revised.revision.fingerprint};
 for(const [gate,origin] of Object.entries(gates)){
  const note=await data.app.inject({method:'POST',url:path+'/notes',headers:data.headers,payload:{...binding,gate,answer:'Synthetic independently verified fact',reference:'synthetic:verified'}});assert.equal(note.statusCode,200);
  const verify=await data.app.inject({method:'POST',url:path+'/verify',headers:data.headers,payload:{...binding,noteId:note.json().notes.at(-1).id,origin,facts:{rateCentsPerHour:2500,capacityHours:60,paymentTerms:'Synthetic client agreed terms; cash not received.',policyLimitCents:200000,acceptLowMargin:false,reason:'Synthetic verified economics'}}});assert.equal(verify.statusCode,200);
 }
 return {path,body:{...binding,confirmation:'APPROVE_EXACT_REVISION'},root:initial.revision};
}

test('project upload binds original bytes and fingerprints to the authoritative job/intake; duplicate confirm has one effect',async t=>{
 const data=await fixture(t),result=await imported(data);
 const stored=data.db.prepare('SELECT * FROM proposal_imports WHERE id=?').get(result.id) as any;assert.equal(stored.proposal_json,data.bundle.proposal.content);assert.equal(stored.evidence_json,data.bundle.evidence!.content);assert.equal(stored.summary_markdown,data.bundle.summary!.content);assert.equal(stored.bundle_fingerprint,validateBundle(data.bundle).fingerprint);
 const link=data.db.prepare('SELECT * FROM project_import_links WHERE import_id=?').get(result.id) as any;assert.equal(link.binding_id,data.binding.id);assert.equal(link.job_id,data.job.id);assert.equal(link.owner_id,data.ownerId);assert.equal(link.intake_revision,1);assert.equal(link.intake_hash,data.job.intake_hash);
 assert.equal((await data.post('confirm',result.payload)).json().id,result.id);assert.equal((await data.post('confirm',result.payload)).json().duplicate,true);
 const job=data.jobs.get(data.session,data.job.id);assert.equal(job.state,'imported');assert.equal(job.result_import_id,result.id);assert.equal(job.transport,'mock');
 const events=data.jobs.events(data.session,job.id).events as any[];assert.equal(events.length,8);assert.equal(events.at(-1).code,'manual_project_upload');assert.equal(events.at(-1).actor_id,data.ownerId);
 for(const table of ['proposal_imports','project_import_links'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),1);
 for(const table of ['projects','payment_approvals','reservations','ledger_entries'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
 assert.throws(()=>data.db.exec('DELETE FROM project_import_links'));assert.throws(()=>data.db.exec('UPDATE project_import_links SET intake_revision=2'));
 const workspace=(await data.app.inject({url:'/v1/client-projects/'+data.binding.client_project_id,headers:data.headers})).json();assert.equal(workspace.workspace.imports[0].id,result.id);assert.equal(workspace.workspace.imports[0].validation,'project_intake_validated');
});
test('missing files, invalid JSON/schema, mismatched task/client/brief/revenue and stale confirmation leave jobs unimported',async t=>{
 const data=await fixture(t);
 for(const missing of ['proposal','evidence','summary']){const body={...data.bundle} as any;delete body[missing];assert.equal((await data.post('preview',body)).statusCode,400);}
 for(const body of [{...data.bundle,proposal:{name:'proposal.json',content:'{'}},{...data.bundle,evidence:{name:'evidence.json',content:'{}'}},changed(data.bundle,p=>p.taskId='UNRELATED'),changed(data.bundle,p=>p.client.name='Other client'),changed(data.bundle,p=>p.project.brief='Other brief'),changed(data.bundle,p=>p.project.agreedRevenueCents++)])assert.notEqual((await data.post('preview',body)).statusCode,200);
 const preview=(await data.post('preview',data.bundle)).json();
 for(const override of [{jobId:'unrelated-job'},{intakeHash:'0'.repeat(64)},{fingerprint:'0'.repeat(64)}])assert.equal((await data.post('confirm',{...data.bundle,jobId:preview.jobId,intakeHash:preview.intakeHash,fingerprint:preview.fingerprint,...override})).statusCode,409);
 assert.equal(data.jobs.get(data.session,data.job.id).state,'needs_attention');assert.equal(data.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});
test('cross-project package and stale job attempt are rejected; cancelled and unfinished jobs cannot receive uploads',async t=>{
 const data=await fixture(t);const other=onboardProject(data.db,data.session,intake,'other-onboard');const job=data.jobs.create(data.session,other.id,'other-job');
 assert.equal((await data.app.inject({method:'POST',url:'/v1/client-projects/'+other.client_project_id+'/proposal-imports/preview',headers:data.headers,payload:data.bundle})).statusCode,409);
 await data.jobs.runNext();
 assert.equal(data.jobs.get(data.session,job.id).state,'needs_attention');
 assert.equal((await data.app.inject({method:'POST',url:'/v1/client-projects/'+other.client_project_id+'/proposal-imports/preview',headers:data.headers,payload:data.bundle})).statusCode,409);
 const cancelled=data.jobs.create(data.session,other.id,'cancelled-attempt');data.jobs.cancel(data.session,cancelled.id);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/client-projects/'+other.client_project_id+'/proposal-imports/preview',headers:data.headers,payload:bundleFor(other.task_id)})).statusCode,409);
 const preview=(await data.post('preview',data.bundle)).json();data.jobs.create(data.session,data.binding.id,'new-attempt');await data.jobs.runNext();
 assert.equal((await data.post('confirm',{...data.bundle,jobId:preview.jobId,intakeHash:preview.intakeHash,fingerprint:preview.fingerprint})).statusCode,409);
 assert.equal(data.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});
test('concurrent confirmation is idempotent; changed packages require a new attempt and preserve old immutable revisions',async t=>{
 const data=await fixture(t),preview=(await data.post('preview',data.bundle)).json(),payload={...data.bundle,jobId:preview.jobId,intakeHash:preview.intakeHash,fingerprint:preview.fingerprint};
 const responses=await Promise.all([data.post('confirm',payload),data.post('confirm',payload)]);assert.ok(responses.every(r=>r.statusCode===200));assert.equal(responses[0]!.json().id,responses[1]!.json().id);
 const revised=changed(data.bundle,p=>p.proposal.explanation+=' Revised coordinator analysis.');
 const changedPreview=(await data.post('preview',revised)).json();assert.equal((await data.post('confirm',{...revised,...changedPreview})).statusCode,400);
 // Send only the documented confirmation fields.
 assert.equal((await data.post('confirm',{...revised,jobId:changedPreview.jobId,intakeHash:changedPreview.intakeHash,fingerprint:changedPreview.fingerprint})).statusCode,409);
 data.jobs.create(data.session,data.binding.id,'second-attempt');await data.jobs.runNext();const second=await imported(data,revised);
 assert.notEqual(second.id,responses[0]!.json().id);assert.deepEqual(data.db.prepare('SELECT revision FROM proposal_imports ORDER BY revision').pluck().all(),[1,2]);assert.equal(data.db.prepare('SELECT count(*) FROM project_import_links').pluck().get(),2);
});
test('linked imports require owner session, complete binding and CSRF; shared task grants cannot read or approve them',async t=>{
 const data=await fixture(t);
 for(const override of [{cookie:''},{'x-csrf-token':''},{origin:'https://evil.example'}])assert.ok([401,403].includes((await data.post('preview',data.bundle,override)).statusCode));
 const result=await imported(data);await provisionOwner(data.db,'linked-other','Synthetic other owner password',data.binding.task_id);const other=await loginOwner(data.db,'linked-other','Synthetic other owner password','other');
 const headers={...base,cookie:'rt_demo_owner='+other.token,'x-csrf-token':other.session.csrf};
 assert.equal((await data.app.inject({method:'POST',url:data.path+'/preview',headers,payload:data.bundle})).statusCode,403);
 for(const suffix of ['', '/review','/artifacts/proposal']){assert.equal((await data.app.inject('/v1/proposal-imports/'+result.id+suffix)).statusCode,401);assert.equal((await data.app.inject({url:'/v1/proposal-imports/'+result.id+suffix,headers})).statusCode,403);}
 assert.equal((await data.app.inject('/v1/proposal-imports/')).json().imports.length,0);
 assert.equal((await data.app.inject({url:'/v1/proposal-imports/',headers:data.headers})).json().imports.length,1);
 data.db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),data.ownerId,data.binding.task_id);
 assert.equal((await data.post('preview',data.bundle)).statusCode,403);
});
test('failed linked import rolls back import/link/job/event updates atomically',async t=>{
 const data=await fixture(t),preview=(await data.post('preview',data.bundle)).json();
 data.db.exec("CREATE TRIGGER fail_linked_event BEFORE INSERT ON processing_job_events WHEN NEW.to_state='imported' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
 assert.equal((await data.post('confirm',{...data.bundle,jobId:preview.jobId,intakeHash:preview.intakeHash,fingerprint:preview.fingerprint})).statusCode,500);
 assert.equal(data.jobs.get(data.session,data.job.id).state,'needs_attention');assert.equal(data.jobs.events(data.session,data.job.id).events.length,7);
 for(const table of ['proposal_imports','project_import_links'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('project-linked review preserves client terms and exact revision; concurrent authenticated approval activates only the original project',async t=>{
 const data=await fixture(t),result=await imported(data),review=await ready(data,result.id);
 const altered=changed(data.bundle,p=>p.project.brief='Unauthorized change to immutable intake');
 assert.equal((await data.app.inject({method:'POST',url:review.path+'/revisions',headers:data.headers,payload:{revisionId:review.body.revisionId,fingerprint:review.body.fingerprint,proposal:JSON.parse(altered.proposal.content),reason:'Changed original intake'}})).statusCode,409);
 assert.equal((await data.app.inject({method:'POST',url:review.path+'/approve',headers:data.headers,payload:{...review.body,revisionId:review.root.id,fingerprint:review.root.fingerprint}})).statusCode,409);
 const workers=await Promise.all([1,2].map(async()=>{const worker=new Worker(new URL('./owner-http-worker.js',import.meta.url),{workerData:{config:data.config,path:review.path,headers:data.headers,body:review.body}});const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});const response=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});return {worker,exit,response};}));for(const worker of workers)worker.worker.postMessage('go');const results=await Promise.all(workers.map(w=>w.response));await Promise.all(workers.map(w=>w.exit));assert.ok(results.every(r=>r.status===200));assert.equal(results[0].id,results[1].id);
 assert.equal(data.db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT id FROM projects').pluck().get(),data.binding.client_project_id);
 assert.equal(data.db.prepare('SELECT financial_project_id FROM client_projects').pluck().get(),data.binding.client_project_id);assert.equal(data.db.prepare('SELECT financial_project_id FROM owner_review_decisions').pluck().get(),data.binding.client_project_id);
 assert.equal(data.db.prepare('SELECT count(*) FROM workstream_allocations').pluck().get(),4);assert.equal(data.db.prepare("SELECT count(*) FROM authenticated_review_events WHERE action='decision'").pluck().get(),1);
 assert.equal((await data.app.inject({method:'POST',url:review.path+'/approve',headers:data.headers,payload:review.body})).statusCode,200);
 for(const table of ['ledger_entries','reservations','payment_approvals'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('failed linked approval rolls back financial activation and retains the single original draft',async t=>{
 const data=await fixture(t),result=await imported(data),review=await ready(data,result.id);
 data.db.exec("CREATE TRIGGER fail_linked_decision BEFORE INSERT ON owner_review_decisions BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
 assert.notEqual((await data.app.inject({method:'POST',url:review.path+'/approve',headers:data.headers,payload:review.body})).statusCode,200);
 assert.equal(data.db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT status FROM client_projects').pluck().get(),'draft');
 for(const table of ['projects','delivery_proposals','owner_review_decisions','workstream_allocations'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('legacy reviewed imports cannot silently change identity by adopting a project link',async t=>{
 const data=await fixture(t);const legacy=importBundle(data.db,data.bundle,validateBundle(data.bundle).fingerprint);
 const path='/v1/proposal-imports/'+legacy.id+'/review';const root=(await data.app.inject({url:path,headers:data.headers})).json().revision;
 await data.app.inject({method:'POST',url:path+'/notes',headers:data.headers,payload:{revisionId:root.id,fingerprint:root.fingerprint,gate:'scope',answer:'Legacy reviewed fact',reference:'synthetic:legacy'}});
 const preview=(await data.post('preview',data.bundle)).json();assert.equal((await data.post('confirm',{...data.bundle,jobId:preview.jobId,intakeHash:preview.intakeHash,fingerprint:preview.fingerprint})).statusCode,409);
 assert.equal(data.db.prepare('SELECT count(*) FROM project_import_links').pluck().get(),0);assert.equal(data.jobs.get(data.session,data.job.id).state,'needs_attention');
});
test('migration 10 preserves populated v9 bindings, jobs and every event, and repeats safely with foreign keys enabled',async()=>{
 const db=new BetterSqlite3(':memory:');try{
  db.pragma('foreign_keys=ON');applyMigrations(db,'test',migrations.slice(0,9));await provisionOwner(db,'migration-owner','Synthetic migration owner password','TASK');const {session}=await loginOwner(db,'migration-owner','Synthetic migration owner password','fixture');
  const binding=onboardProject(db,session,intake,'migrate');const jobs=new ProcessingJobs(db);jobs.create(session,binding.id,'migrate-job');await jobs.runNext();
  const before={jobs:db.prepare('SELECT * FROM processing_jobs').all(),events:db.prepare('SELECT * FROM processing_job_events').all(),binding:db.prepare('SELECT * FROM project_task_bindings').all(),migrations:db.prepare('SELECT * FROM schema_migrations').all()};
  assert.throws(()=>applyMigrations(db,'test',[...migrations,{version:11,name:'synthetic_upgrade_failure',sql:'NOT VALID SQL;'}]));
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(),before.migrations);
  assert.deepEqual(db.prepare('SELECT * FROM processing_jobs').all(),before.jobs);
  assert.deepEqual(db.prepare('SELECT * FROM processing_job_events').all(),before.events);
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='project_import_links'").get(),undefined);
  applyMigrations(db,'test');applyMigrations(db,'test');assert.deepEqual(db.prepare('SELECT * FROM processing_jobs').all(),before.jobs);assert.deepEqual(db.prepare('SELECT * FROM processing_job_events').all(),before.events);assert.deepEqual(db.prepare('SELECT * FROM project_task_bindings').all(),before.binding);assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=9').all(),before.migrations);
  assert.equal(db.pragma('foreign_keys',{simple:true}),1);assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});

test('legacy public import route cannot bypass project-bound upload authentication and binding checks',async t=>{
 const data=await fixture(t),payload={...data.bundle,fingerprint:validateBundle(data.bundle).fingerprint};
 const headers={...base,'x-roomtreasury-import':'1'};
 assert.equal((await data.app.inject({method:'POST',url:'/v1/proposal-imports/confirm',headers,payload})).statusCode,401);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/proposal-imports/confirm',headers:{...headers,...data.headers},payload})).statusCode,409);
 assert.equal(data.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});

test('workspace serves the three-file preview/confirmation flow without manufacturing results',async t=>{
 const data=await fixture(t);const html=await data.app.inject('/projects/'+data.binding.client_project_id);
 for(const id of ['pw-upload-form','pw-proposal-file','pw-evidence-file','pw-summary-file','pw-preview','pw-confirm-import','pw-open-upload'])assert.ok(html.body.includes(id));
 const script=await data.app.inject('/project-workspace.js');const {Script}=await import('node:vm');new Script(script.body);
 assert.match(script.body,/proposal-imports\/preview/);assert.match(script.body,/proposal-imports\/confirm/);assert.match(script.body,/Package not imported/);assert.ok(!script.body.includes('innerHTML'));
 assert.equal(data.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});
