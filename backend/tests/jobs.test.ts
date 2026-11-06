import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {Worker} from 'node:worker_threads';
import BetterSqlite3 from 'better-sqlite3';
import {testDatabase} from './helpers.js';
import {loginOwner,provisionOwner} from '../src/security/owner-auth.js';
import {onboardProject,hash} from '../src/jobs/bindings.js';
import {ProcessingJobs} from '../src/jobs/service.js';
import {MockTransport,type JobTransport} from '../src/jobs/transport.js';
import {openDatabase} from '../src/db/connection.js';
import {applyMigrations} from '../src/db/migrations.js';
import {buildApp} from '../src/app.js';

const origin='http://127.0.0.1:3000',base={origin,host:'127.0.0.1:3000'};
async function fixture(t:TestContext){
 const data=testDatabase(t);const ownerId=await provisionOwner(data.db,'jobs-owner','Synthetic jobs owner password','ORIGINAL-SCOPE');
 const login=await loginOwner(data.db,'jobs-owner','Synthetic jobs owner password','fixture');
 const binding=onboardProject(data.db,login.session,{clientName:'Synthetic jobs',brief:'Synthetic delivery brief',revenueCents:100000},'project');
 return {...data,ownerId,...login,binding,jobs:new ProcessingJobs(data.db)};
}
test('jobs persist the complete binding and immutable snapshot; creation is idempotent and restart preserves state',async t=>{
 const data=await fixture(t),job=data.jobs.create(data.session,data.binding.id,'create');
 assert.equal(job.submitting_owner_id,data.ownerId);assert.equal(job.binding_id,data.binding.id);
 assert.equal(job.intake_hash,hash(job.intake_snapshot));assert.equal(JSON.parse(job.intake_snapshot).taskId,data.binding.task_id);
 assert.equal(JSON.parse(job.intake_snapshot).projectId,data.binding.client_project_id);
 assert.equal(job.state,'queued');assert.equal(job.attempt,1);assert.equal(job.intake_revision,1);
 assert.equal(data.jobs.create(data.session,data.binding.id,'create').id,job.id);
 assert.throws(()=>data.jobs.create(data.session,data.binding.id,'another'));
 const db=openDatabase(data.config);try{assert.equal(new ProcessingJobs(db).get(data.session,job.id).intake_hash,job.intake_hash);}finally{db.close();}
 assert.throws(()=>data.db.prepare('UPDATE processing_jobs SET intake_snapshot=?').run('{}'));
 assert.throws(()=>data.db.exec('DELETE FROM processing_job_events'));
});
test('invalid transitions and fabricated imports fail in the service and database without changing history',async t=>{
 const {db,jobs,session,binding}=await fixture(t);const job=jobs.create(session,binding.id,'invalid'),claimed=jobs.claim()!;
 assert.throws(()=>jobs.apply(job.id,claimed.lease_owner!,'invalid','validating'));
 assert.throws(()=>db.prepare("UPDATE processing_jobs SET state='running' WHERE id=?").run(job.id));
 assert.throws(()=>jobs.apply(job.id,claimed.lease_owner!,'fake-import','imported'));
 assert.equal(jobs.events(session,job.id).events.length,2);
 assert.equal(jobs.get(session,job.id).state,'dispatching');
});
test('successful deterministic mock execution ends in attention, never creates artifacts or financial effects, and deduplicates events',async t=>{
 const {db,jobs,session,binding}=await fixture(t),job=jobs.create(session,binding.id,'success');
 assert.equal(await jobs.runNext(new MockTransport('duplicate')),true);
 const result=jobs.get(session,job.id);assert.equal(result.state,'needs_attention');assert.equal(result.error_code,'artifact_import_deferred');
 assert.ok(result.completed_at);assert.equal(result.result_import_id,null);assert.equal(result.lease_owner,null);
 const events=jobs.events(session,job.id).events as unknown as {id:number;to_state:string}[];
 assert.deepEqual(events.map(e=>e.to_state),['queued','dispatching','dispatched','running','collecting','validating','needs_attention']);
 const first=jobs.events(session,job.id,0,2),second=jobs.events(session,job.id,first.nextCursor,2);
 assert.equal(first.events.length,2);assert.ok(second.events[0]!.id>first.nextCursor);
 assert.throws(()=>jobs.events(session,job.id,0,101));
 for(const table of ['proposal_imports','projects','delivery_proposals','payment_approvals','reservations','ledger_entries','settlement_receipts'])assert.equal(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
 assert.equal(await jobs.runNext(),false);assert.throws(()=>jobs.cancel(session,job.id));
});
for(const scenario of ['dispatch_failure','uncertain','execution_failure'] as const)test(`mock controlled ${scenario} persists safe failure without losing the job`,async t=>{
 const {jobs,session,binding}=await fixture(t),job=jobs.create(session,binding.id,'failure');
 await jobs.runNext(new MockTransport(scenario));const result=jobs.get(session,job.id);
 assert.equal(result.state,scenario==='uncertain'?'dispatch_uncertain':'failed');
 assert.equal(result.error_code,scenario==='uncertain'?'dispatch_outcome_unknown':scenario==='dispatch_failure'?'mock_dispatch_failed':'mock_execution_failed');
 assert.equal(result.lease_owner,null);assert.equal(await jobs.runNext(),false);
 if(scenario==='uncertain')assert.throws(()=>jobs.create(session,binding.id,'unsafe-retry'));
});
test('expired dispatch lease recovers to uncertain after reopen; old workers cannot update or resend',async t=>{
 const data=await fixture(t),job=data.jobs.create(data.session,data.binding.id,'recover');const claim=data.jobs.claim()!;
 data.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now()-1,job.id);
 const db=openDatabase(data.config);try{
  const restarted=new ProcessingJobs(db);assert.equal(restarted.recover(),1);assert.equal(restarted.recover(),0);
  assert.equal(restarted.get(data.session,job.id).state,'dispatch_uncertain');assert.equal(await restarted.runNext(),false);
  assert.throws(()=>data.jobs.apply(job.id,claim.lease_owner!,'late-ack','dispatched'));
 }finally{db.close();}
});
test('interrupted acknowledged work is retained for attention instead of redispatched; attempts are explicit and bounded',async t=>{
 const {db,jobs,session,binding}=await fixture(t);const job=jobs.create(session,binding.id,'first'),claim=jobs.claim()!;
 jobs.apply(job.id,claim.lease_owner!,'ack','dispatched');db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now()-1,job.id);
 assert.equal(jobs.recover(),1);assert.equal(jobs.get(session,job.id).error_code,'worker_interrupted');
 for(const attempt of [2,3]){const retry=jobs.create(session,binding.id,'retry-'+attempt);assert.equal(retry.attempt,attempt);await jobs.runNext(new MockTransport('dispatch_failure'));}
 assert.throws(()=>jobs.create(session,binding.id,'fourth'));
});
test('cancellation is persisted and idempotent, and prevents a late acknowledgement from resuming work',async t=>{
 const {jobs,session,binding}=await fixture(t);const queued=jobs.create(session,binding.id,'queued');
 jobs.cancel(session,queued.id);jobs.cancel(session,queued.id);assert.equal(jobs.events(session,queued.id).events.length,2);
 const job=jobs.create(session,binding.id,'in-flight');let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const transport:JobTransport={type:'mock',async dispatch(request){await gate;return {correlationId:request.correlationId};},events:request=>new MockTransport().events(request)};
 const running=jobs.runNext(transport);assert.equal(jobs.get(session,job.id).state,'dispatching');jobs.cancel(session,job.id);release();await running;
 assert.equal(jobs.get(session,job.id).state,'cancelled');assert.equal(jobs.events(session,job.id).events.length,3);
});
test('revoked owner scope prevents access and stops queued or in-flight jobs',async t=>{
 const {db,jobs,session,binding,ownerId}=await fixture(t),job=jobs.create(session,binding.id,'revoked');
 db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),ownerId,binding.task_id);
 assert.throws(()=>jobs.get(session,job.id));assert.throws(()=>jobs.create(session,binding.id,'other'));
 await jobs.runNext();const stored=db.prepare('SELECT state,error_code FROM processing_jobs WHERE id=?').get(job.id) as {state:string;error_code:string};
 assert.equal(stored.state,'failed');assert.equal(stored.error_code,'owner_access_revoked');
});
async function parallel(data:Awaited<ReturnType<typeof fixture>>,operation:'create'|'dispatch'){
 const workers=await Promise.all([1,2].map(async()=>{
  const worker=new Worker(new URL('./jobs-worker.js',import.meta.url),{workerData:{config:data.config,operation,session:data.session,bindingId:data.binding.id}});
  const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));
  await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});
  const result=new Promise<{id?:string;processed?:boolean;failed?:boolean}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  return {worker,exit,result};
 }));for(const worker of workers)worker.worker.postMessage('go');
 const results=await Promise.all(workers.map(w=>w.result));await Promise.all(workers.map(w=>w.exit));return results;
}
test('independent worker connections converge to one created job and one dispatch history',async t=>{
 const data=await fixture(t),created=await parallel(data,'create');assert.ok(created.every(r=>!r.failed));assert.equal(created[0]!.id,created[1]!.id);
 const dispatched=await parallel(data,'dispatch');assert.ok(dispatched.every(r=>!r.failed));assert.equal(dispatched.filter(r=>r.processed).length,1);
 assert.equal(data.db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),1);
 assert.equal(data.db.prepare("SELECT count(*) FROM processing_job_events WHERE event_key='dispatch-ack'").pluck().get(),1);
});
test('job APIs enforce sessions, complete bindings, CSRF, origin, strict bodies and safe paginated read models',async t=>{
 const data=await fixture(t),app=await buildApp(data.db);t.after(()=>app.close());
 const headers={...base,cookie:'rt_demo_owner='+data.token,'x-csrf-token':data.session.csrf,'idempotency-key':'http-job'};
 const path='/v1/client-projects/'+data.binding.client_project_id+'/processing-jobs';
 const create=(override:Record<string,string>={},body:object={})=>app.inject({method:'POST',url:path,headers:{...headers,...override},payload:body});
 for(const override of [{cookie:''},{'x-csrf-token':''},{origin:'https://evil.example'}])assert.ok([401,403].includes((await create(override)).statusCode));
 assert.equal((await create({}, {taskId:data.binding.task_id,ownerId:data.ownerId})).statusCode,400);
 assert.equal((await create({'idempotency-key':''})).statusCode,400);
 const created=await create();assert.equal(created.statusCode,201);const job=created.json().job;
 assert.ok(!('lease_owner' in job));assert.ok(!('diagnostic' in job));
 assert.equal((await create()).json().job.id,job.id);
 assert.equal((await app.inject({url:path,headers})).json().jobs.length,1);
 const jobPath='/v1/processing-jobs/'+job.id;
 assert.equal((await app.inject(jobPath)).statusCode,401);
 assert.equal((await app.inject({url:jobPath+'/events?limit=1',headers})).json().events.length,1);
 assert.equal((await app.inject({url:jobPath+'/events?limit=101',headers})).statusCode,400);
 assert.equal((await app.inject({url:'/v1/processing-jobs/missing',headers})).statusCode,404);
 const otherId=await provisionOwner(data.db,'jobs-other','Different synthetic owner password',data.binding.task_id);
 const other=await loginOwner(data.db,'jobs-other','Different synthetic owner password','other');assert.notEqual(otherId,data.ownerId);
 const otherHeaders={...base,cookie:'rt_demo_owner='+other.token,'x-csrf-token':other.session.csrf,'idempotency-key':'other'};
 for(const url of [path,jobPath,jobPath+'/events'])assert.equal((await app.inject({url,headers:otherHeaders})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:path,headers:otherHeaders,payload:{}})).statusCode,403);
 for(const [cancelHeaders,status] of [[{...headers,'x-csrf-token':''},403],[headers,200]] as const)assert.equal((await app.inject({method:'POST',url:jobPath+'/cancel',headers:cancelHeaders,payload:{}})).statusCode,status);
 assert.equal((await app.inject({method:'POST',url:jobPath+'/cancel',headers,payload:{}})).statusCode,200);
 const onboard=(body:object,override:Record<string,string>={})=>app.inject({method:'POST',url:'/v1/client-projects/onboard',headers:{...headers,'idempotency-key':'http-onboard',...override},payload:body});
 const input={clientName:'HTTP synthetic client',brief:'HTTP synthetic brief',revenueCents:100000};
 assert.equal((await onboard({...input,projectId:'unrelated',taskId:data.binding.task_id})).statusCode,400);
 assert.equal((await onboard(input,{'x-csrf-token':''})).statusCode,403);
 const onboarded=await onboard(input);assert.equal(onboarded.statusCode,201);
 assert.equal((await onboard(input)).json().binding.id,onboarded.json().binding.id);
 assert.equal((await onboard({...input,revenueCents:200000})).statusCode,409);
 data.db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),data.ownerId,data.binding.task_id);
 assert.equal((await app.inject({url:jobPath,headers})).statusCode,403);
});
test('real-mode databases and production environment cannot run mock work',async t=>{
 const db=new BetterSqlite3(':memory:');try{db.pragma('foreign_keys=ON');applyMigrations(db,'real');assert.throws(()=>new ProcessingJobs(db).claim());}finally{db.close();}
 const data=await fixture(t),previous=process.env.NODE_ENV;
 try{process.env.NODE_ENV='production';assert.throws(()=>data.jobs.create(data.session,data.binding.id,'production'));assert.throws(()=>data.jobs.claim());}
 finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});

test('job creation and its first audit event roll back together',async t=>{
 const {db,jobs,session,binding}=await fixture(t);
 db.exec("CREATE TRIGGER fail_job_event BEFORE INSERT ON processing_job_events BEGIN SELECT RAISE(ABORT,'fixture event failure'); END;");
 assert.throws(()=>jobs.create(session,binding.id,'atomic'));
 assert.equal(db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),0);
 assert.equal(db.prepare('SELECT count(*) FROM processing_job_events').pluck().get(),0);
});
test('reused event IDs with changed payloads are rejected; identical events remain idempotent',async t=>{
 const {jobs,session,binding}=await fixture(t),job=jobs.create(session,binding.id,'event-conflict'),claim=jobs.claim()!;
 jobs.apply(job.id,claim.lease_owner!,'ack','dispatched');
 jobs.apply(job.id,claim.lease_owner!,'ack','dispatched');
 assert.throws(()=>jobs.apply(job.id,claim.lease_owner!,'ack','running'));
 assert.equal(jobs.get(session,job.id).state,'dispatched');assert.equal(jobs.events(session,job.id).events.length,3);
});
test('revocation during dispatch prevents progression and raw transport failures never reach stored diagnostics',async t=>{
 const {db,jobs,session,binding,ownerId}=await fixture(t),job=jobs.create(session,binding.id,'in-flight-revocation');
 const transport:JobTransport={type:'mock',async dispatch(){
  db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),ownerId,binding.task_id);
  throw new Error('private-transport-error-sentinel');
 },events:request=>new MockTransport().events(request)};
 await jobs.runNext(transport);
 const stored=db.prepare('SELECT * FROM processing_jobs WHERE id=?').get(job.id) as {state:string;error_code:string};
 assert.equal(stored.state,'failed');assert.equal(stored.error_code,'owner_access_revoked');
 assert.ok(!JSON.stringify(stored).includes('private-transport-error-sentinel'));
 assert.ok(!JSON.stringify(db.prepare('SELECT * FROM processing_job_events').all()).includes('private-transport-error-sentinel'));
});

test('application mock worker processes persisted queued work and stops cleanly',async t=>{
 const {startMockWorker}=await import('../src/jobs/worker.js');
 const data=await fixture(t),job=data.jobs.create(data.session,data.binding.id,'startup');
 const reopened=openDatabase(data.config);const stop=startMockWorker(reopened);
 try{await stop();assert.equal(data.jobs.get(data.session,job.id).error_code,'artifact_import_deferred');}
 finally{await stop();reopened.close();}
});
