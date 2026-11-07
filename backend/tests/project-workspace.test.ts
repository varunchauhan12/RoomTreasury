import {gateChecks} from '../src/approvals/policy.js';
import {ApprovalWorkflow} from '../src/approvals/service.js';
import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {Script,runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {buildApp} from '../src/app.js';
import {provisionOwner,loginOwner} from '../src/security/owner-auth.js';
import {testDatabase} from './helpers.js';
import {ProcessingJobs} from '../src/jobs/service.js';
import {importBundle,validateBundle} from '../src/imports/service.js';
import {workspaceModel} from '../src/web/workspace-model.js';

function model(){const context:Record<string,any>={Intl,setTimeout,clearTimeout};runInNewContext(workspaceModel,context);return context.RoomTreasuryWorkspace;}
const fields={clientName:'Synthetic client',projectName:'Analytics launch',description:'Build a landing page.',requirements:'Responsive scope.',deliverables:'One page and handoff.',price:'1000.01',deadline:'2026-12-01',notes:'Synthetic notes'};
async function fixture(t:TestContext){const data=testDatabase(t);await provisionOwner(data.db,'workspace-owner','Synthetic workspace owner password','PREEXISTING');const login=await loginOwner(data.db,'workspace-owner','Synthetic workspace owner password','fixture');const app=await buildApp(data.db);t.after(()=>app.close());const headers={origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000',cookie:'rt_demo_owner='+login.token,'x-csrf-token':login.session.csrf,'idempotency-key':'workspace-onboard'};return {...data,...login,app,headers};}
async function onboarding(data:Awaited<ReturnType<typeof fixture>>){const payload=model().intake(fields);const result=await data.app.inject({method:'POST',url:'/v1/client-projects/onboard',headers:data.headers,payload});assert.equal(result.statusCode,201);
 const binding=result.json().binding;
 const workflow=new ApprovalWorkflow(data.db),gate=workflow.snapshot(data.session,binding.client_project_id).gates[0]!;
 workflow.decide(data.session,binding.client_project_id,{gate:'intake',subjectHash:gate.subjectHash,decision:'approve',checks:[...gateChecks.intake],
  reason:'Fixture owner reviewed brief, scope, budget expectations and timeline.',evidence:['fixture:intake']},'fixture-intake');
 return binding;}

test('workspace pages and dashboard expose the unified owner flow, safe assets and responsive sections',async t=>{
 const {app}=await fixture(t);
 const page=await app.inject('/projects/new');assert.equal(page.statusCode,200);for(const field of ['clientName','projectName','description','requirements','deliverables','price','deadline','notes'])assert.ok(page.body.includes('name="'+field+'"'));
 assert.match(page.headers['content-security-policy'] as string,/form-action 'self'/);
 const workspace=await app.inject('/projects/project-id');for(const id of ['pw-analysis','pw-results','pw-events','pw-start','pw-cancel'])assert.ok(workspace.body.includes(id));
 const root=await app.inject('/');assert.match(root.body,/owner-projects/);assert.match(root.body,/Create client project/);assert.match(root.body,/Optional direct AI estimate/);
 for(const path of ['/workspace-model.js','/project-workspace.js']){const script=await app.inject(path);new Script(script.body);assert.ok(!script.body.includes('innerHTML'));assert.ok(!script.body.includes('eval('));assert.ok(!script.body.includes('/v1/client-projects/estimate'));}
 assert.match((await app.inject('/project-workspace.css')).body,/@media/);
});
test('intake helpers preserve all fields in the existing brief and validate cents and size',()=>{
 const M=model(),input=M.intake(fields);assert.equal(input.revenueCents,100001);const detail=M.parseBrief(input.brief);assert.equal(detail.name,fields.projectName);assert.equal(detail.description,fields.description);assert.equal(detail.deadline,fields.deadline);assert.equal(detail.notes,fields.notes);
 for(const price of ['','0','-1','1.001','1e3','10000000.01'])assert.throws(()=>M.intake({...fields,price}));
 assert.throws(()=>M.intake({...fields,projectName:' '}));assert.throws(()=>M.intake({...fields,notes:'x'.repeat(4100)}));
 assert.equal(M.parseBrief('Original legacy brief').description,'Original legacy brief');
});
test('submission gate prevents double clicks, retries ambiguous requests with the same key, and separates changed payloads',async()=>{
 const M=model();let release!:(value:unknown)=>void,calls=0;const keys:string[]=[];let sequence=0;
 const submission=M.submission(async(_payload:unknown,key:string)=>{calls++;keys.push(key);if(calls===1)return new Promise(resolve=>{release=resolve;});return {ok:true};},()=>String(++sequence));
 const pending=submission.run({brief:'first'});assert.equal(await submission.run({brief:'first'}),null);assert.equal(calls,1);release({ok:true});await pending;
 await submission.run({brief:'first'});assert.equal(keys[0],keys[1]);await submission.run({brief:'changed'});assert.notEqual(keys[1],keys[2]);
 const retryKeys:string[]=[];let attempt=0;const retry=M.submission(async(_payload:unknown,key:string)=>{retryKeys.push(key);if(++attempt===1)throw Error('Simulated transport failure');return true;},()=>String(++sequence));
 await assert.rejects(()=>retry.run({same:true}));await retry.run({same:true});assert.equal(retryKeys[0],retryKeys[1]);
});
test('polling uses actual backend states and stops at attention, terminal or uncertain states',async()=>{
 const M=model();for(const state of ['needs_attention','failed','cancelled','dispatch_uncertain','imported'])assert.equal(M.shouldPoll({state}),false);
 const reads=[{state:'queued'},{state:'running'},{state:'needs_attention',error_code:'artifact_import_deferred'}],scheduled:(()=>Promise<void>)[]=[],rendered:string[]=[];
 const poll=M.poller({async read(){return reads.shift();},render:(job:{state:string})=>rendered.push(job.state),onError:()=>assert.fail('Unexpected polling error'),schedule:(fn:()=>Promise<void>)=>{scheduled.push(fn);return scheduled.length;},clear:()=>{}});
 await poll.start();assert.equal(scheduled.length,1);await scheduled.shift()!();assert.equal(scheduled.length,1);await scheduled.shift()!();assert.equal(scheduled.length,0);assert.deepEqual(rendered,['queued','running','needs_attention']);
 assert.match(M.status({state:'needs_attention',error_code:'artifact_import_deferred'}).description,/no proposal was imported/);
 let errors=0;const failed=M.poller({async read(){throw Error('offline');},render:()=>assert.fail(),onError:()=>errors++,schedule:()=>assert.fail(),clear:()=>{}});await failed.start();assert.equal(errors,1);
 let resolve!:(job:object)=>void;let renderedAfterStop=false;const stopped=M.poller({read:()=>new Promise(done=>{resolve=done;}),render:()=>{renderedAfterStop=true;},onError:()=>{},clear:()=>{}});const inFlight=stopped.start();stopped.stop();resolve({state:'running'});await inFlight;assert.equal(renderedAfterStop,false);
});
test('hidden workspace polling schedules a retry without an HTTP read',async()=>{
 const M=model(),scheduled:(()=>Promise<void>)[]=[];
 let hidden=true,reads=0;
 const watcher=M.poller({pause:()=>hidden,read:async()=>{reads++;return {state:'imported'};},
  render:()=>{},onError:()=>assert.fail(),schedule:(fn:()=>Promise<void>)=>{scheduled.push(fn);return scheduled.length;},clear:()=>{}});
 await watcher.start();assert.equal(reads,0);assert.equal(scheduled.length,1);
 hidden=false;await scheduled.shift()!();assert.equal(reads,1);assert.equal(scheduled.length,0);
});

test('workspace polling refreshes only the imported result linked to the exact job and project',async()=>{
 const M=model(),project={client:{id:'project'},workspace:{taskId:'task',imports:[]}};
 const job={id:'job',state:'imported',result_import_id:'import'};
 const latest={...project,workspace:{...project.workspace,imports:[{id:'import',jobId:'job'}]}};
 let reads=0;
 const read=(id:string)=>{assert.equal(id,'project');reads++;return latest;};
 assert.equal(await M.importedSnapshot({...job,state:'validating'},project,read),null);
 assert.equal(await M.importedSnapshot(job,project,read),latest);
 assert.equal(await M.importedSnapshot(job,latest,read),null);
 assert.equal(reads,1);
 await assert.rejects(()=>M.importedSnapshot(job,project,()=>({...latest,client:{id:'other'}})),/not yet available/);
 await assert.rejects(()=>M.importedSnapshot(job,project,()=>({...latest,workspace:{...latest.workspace,imports:[{id:'import',jobId:'other'}]}})),/not yet available/);
});

test('synthetic result sections label estimates, unknowns and fixed economics without invented evidence',()=>{
 const M=model(),sections=M.demoSections({client:{client_name:'Synthetic',brief:'Brief',revenue_cents:420000}});
 assert.equal(sections.length,6);const json=JSON.stringify(sections);assert.match(json,/DEMONSTRATION ONLY/);assert.match(json,/Illustrative fixture amounts/);assert.match(json,/420000/);assert.ok(!json.includes('sourceMessageIds'));assert.ok(!json.includes('RECEIVED_AND_REVIEWED'));
});
test('browser intake and job API produce one project and job, show persisted events, and retain review-only outcome',async t=>{
 const data=await fixture(t),binding=await onboarding(data);
 const retry=await data.app.inject({method:'POST',url:'/v1/client-projects/onboard',headers:data.headers,payload:model().intake(fields)});assert.equal(retry.json().binding.id,binding.id);
 const path='/v1/client-projects/'+binding.client_project_id+'/processing-jobs';
 const post=()=>data.app.inject({method:'POST',url:path,headers:{...data.headers,'idempotency-key':'workspace-job'},payload:{}});
 const job=(await post()).json().job;assert.equal((await post()).json().job.id,job.id);
 await new ProcessingJobs(data.db).runNext();
 const snapshot=(await data.app.inject({url:'/v1/client-projects/'+binding.client_project_id,headers:data.headers})).json();
 assert.equal(snapshot.workspace.taskId,binding.task_id);assert.equal(snapshot.workspace.createdAt,binding.created_at);assert.equal(snapshot.workspace.bindingSource,'owner_onboarding');assert.equal(snapshot.workspace.latestJob.state,'needs_attention');assert.equal(snapshot.workspace.demoPreviewAvailable,true);assert.equal(snapshot.workspace.imports.length,0);
 const events=(await data.app.inject({url:'/v1/processing-jobs/'+job.id+'/events',headers:data.headers})).json().events;
 assert.equal(events.length,7);assert.equal(events.at(-1).code,'artifact_import_deferred');
 assert.equal(data.db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),1);
 for(const table of ['proposal_imports','projects','payment_approvals','reservations','ledger_entries'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('workspace metadata is owner-bound, scope-sensitive and synthetic previews are disabled in production',async t=>{
 const data=await fixture(t),binding=await onboarding(data),path='/v1/client-projects/'+binding.client_project_id;
 assert.ok(!(await data.app.inject(path)).json().workspace);
 await provisionOwner(data.db,'workspace-other','Synthetic other workspace owner password',binding.task_id);const other=await loginOwner(data.db,'workspace-other','Synthetic other workspace owner password','other');
 assert.ok(!(await data.app.inject({url:path,headers:{cookie:'rt_demo_owner='+other.token}})).json().workspace);
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.equal((await data.app.inject({url:path,headers:data.headers})).json().workspace.demoPreviewAvailable,false);}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
 data.db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),data.session.ownerId,binding.task_id);
 assert.ok(!(await data.app.inject({url:path,headers:data.headers})).json().workspace);
});
test('unlinked legacy imports remain readable but are not presented as project-linked workspace results',async t=>{
 const data=await fixture(t),binding=await onboarding(data);
 const proposal=JSON.parse(readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json','utf8').replaceAll('RT-APEX-001',binding.task_id));proposal.project.name='<img src=x onerror=alert(1)> Real manually imported proposal';
 const bundle={proposal:{name:'proposal.json',content:JSON.stringify(proposal)}};const imported=importBundle(data.db,bundle,validateBundle(bundle).fingerprint);
 const snapshot=(await data.app.inject({url:'/v1/client-projects/'+binding.client_project_id,headers:data.headers})).json();assert.equal(snapshot.workspace.imports.length,0);
 const record=(await data.app.inject('/v1/proposal-imports/'+imported.id)).json();const sections=model().proposalSections(record);assert.ok(JSON.stringify(sections).includes(proposal.project.name));assert.ok(JSON.stringify(sections).includes('141000'));assert.ok(!JSON.stringify(sections).includes('DEMONSTRATION ONLY'));
 const script=(await data.app.inject('/project-workspace.js')).body;assert.match(script,/\/proposal-imports\?id=/);assert.match(script,/not generated or imported by the mock job/);assert.match(script,/SYNTHETIC DEMONSTRATION/);assert.ok(!script.includes("'/approve'"));
 const review=await data.app.inject({url:'/v1/proposal-imports/'+imported.id+'/review',headers:data.headers});assert.equal(review.statusCode,200);assert.ok(review.json().blockers.length>0);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/proposal-imports/'+imported.id+'/review/approve',headers:data.headers,payload:{revisionId:imported.id,fingerprint:validateBundle(bundle).proposalFingerprint,confirmation:'APPROVE_EXACT_REVISION'}})).statusCode,409);
 assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});

test('regression: processing job creation validates strictly, returns safe diagnostics on invalid payload, and workspace script dispatches discord and mock correctly', async t => {
  const data = await fixture(t), binding = await onboarding(data);
  const path = '/v1/client-projects/' + binding.client_project_id + '/processing-jobs';

  // 1. Direct request with unexpected properties is rejected by AJV schema with safe diagnostic message
  const rejected = await data.app.inject({
    method: 'POST',
    url: path,
    headers: { ...data.headers, 'idempotency-key': 'rejected-job' },
    payload: { transport: 'discord', projectId: binding.client_project_id, previousJob: null }
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.json().error.code, 'INVALID_REQUEST');
  assert.match(rejected.json().error.message, /must NOT have additional properties/);
  assert.deepEqual(rejected.json().error.details, {});

  // 2. Workspace script projects { transport: payload.transport } to conform to backend schema
  const script = (await data.app.inject('/project-workspace.js')).body;
  assert.match(script, /submitJob=M\.submission\(async\(payload,key\)=>api\('\/v1\/client-projects\/'\+encodeURIComponent\(id\)\+'\/processing-jobs',\{transport:payload\.transport\},key\)/);

  // 3. Valid Discord job creation via projected payload succeeds with HTTP 201
  const discordJob = await data.app.inject({
    method: 'POST',
    url: path,
    headers: { ...data.headers, 'idempotency-key': 'valid-discord-job' },
    payload: { transport: 'discord' }
  });
  assert.equal(discordJob.statusCode, 201);
  assert.equal(discordJob.json().job.transport, 'discord');
  assert.equal(discordJob.json().job.state, 'queued');

  // 4. Second project for mock job creation succeeds with HTTP 201
  const payload2 = model().intake({ ...fields, projectName: 'Second project' });
  const onboard2 = await data.app.inject({
    method: 'POST',
    url: '/v1/client-projects/onboard',
    headers: { ...data.headers, 'idempotency-key': 'workspace-onboard-2' },
    payload: payload2
  });
  assert.equal(onboard2.statusCode, 201);
  const binding2 = onboard2.json().binding;
  const workflow2=new ApprovalWorkflow(data.db),gate2=workflow2.snapshot(data.session,binding2.client_project_id).gates[0]!;
  workflow2.decide(data.session,binding2.client_project_id,{gate:'intake',subjectHash:gate2.subjectHash,decision:'approve',
   checks:[...gateChecks.intake],reason:'Fixture owner reviewed second intake.',evidence:['fixture:intake']},'second-intake');

  const mockJob = await data.app.inject({
    method: 'POST',
    url: '/v1/client-projects/' + binding2.client_project_id + '/processing-jobs',
    headers: { ...data.headers, 'idempotency-key': 'valid-mock-job' },
    payload: { transport: 'mock' }
  });
  assert.equal(mockJob.statusCode, 201);
  assert.equal(mockJob.json().job.transport, 'mock');
  assert.equal(mockJob.json().job.state, 'queued');
});

test('transport labels and lifecycle descriptions use the persisted transport, including safe dispatch diagnostics', () => {
  const M = model();
  assert.equal(M.transportLabel(null), 'PROCESSING TRANSPORT · NOT STARTED');
  assert.equal(M.transportLabel({ transport: 'discord' }), 'DISCORD / SWITCH · AGENT TRANSPORT');
  assert.match(M.transportLabel({ transport: 'mock' }), /NO LIVE AGENTS/);
  for (const state of ['queued', 'dispatching', 'dispatched', 'running', 'collecting', 'validating', 'imported']) {
    const description = M.status({ transport: 'discord', state }).description;
    assert.ok(!/mock|manually uploaded/.test(description));
  }
  assert.match(M.status({ transport: 'discord', state: 'failed', error_code: 'discord_dispatch_failed', dispatch_diagnostic: 'invalid_message_payload; http=400; discord=50035' }).description, /message payload/);
  assert.match(M.status({ transport: 'discord', state: 'dispatch_uncertain', dispatch_diagnostic: 'network_failure; http=0; discord=none' }).description, /Do not blindly resend/);
  assert.match(M.status({ transport: 'mock', state: 'running' }).description, /deterministic mock/);
});

test('workspace serves external styles with strict CSP and no inline styling or style injection', async t => {
  const { app } = await fixture(t);
  for (const url of ['/projects/new', '/projects/project-id']) {
    const response = await app.inject(url);
    assert.match(String(response.headers['content-security-policy']), /style-src 'self'/);
    assert.ok(!String(response.headers['content-security-policy']).includes('unsafe-inline'));
    assert.ok(!/<style\b|\sstyle\s*=/i.test(response.body));
    assert.match(response.body, /<link rel="stylesheet" href="\/project-workspace.css">/);
  }
  const js = (await app.inject('/project-workspace.js')).body;
  assert.ok(!/\.style\.|createElement\(['"]style['"]\)/.test(js));
  assert.match(js, /pw-transport-label/);
  assert.match(js, /M\.transportLabel\(job\)/);
  const css = await app.inject('/project-workspace.css');
  assert.equal(css.statusCode, 200);
  assert.match(String(css.headers['content-type']), /text\/css/);
});

test('retry eligibility allows terminal failures below the shared limit and blocks active, uncertain and submitting states', () => {
  const M = model();
  assert.equal(M.retryEligibility(null).disabled, false);
  for (const transport of ['discord', 'mock']) {
    for (const attempt of [1, 2]) {
      assert.equal(M.retryEligibility({ state: 'failed', error_code: 'discord_dispatch_failed', transport, attempt }).disabled, false);
    }
    for (const state of ['queued', 'dispatching', 'dispatched', 'running', 'collecting', 'validating', 'dispatch_uncertain']) {
      assert.equal(M.retryEligibility({ state, transport, attempt: 1 }).disabled, true);
    }
    const exhausted = { state: 'failed', transport, attempt: 3 };
    assert.equal(M.retryEligibility(exhausted).disabled, true);
    assert.match(M.retryEligibility(exhausted).reason, /Three-attempt limit/);
    assert.match(M.retryEligibility(JSON.parse(JSON.stringify(exhausted))).reason, /refreshing does not reset/);
  }
  assert.equal(M.retryEligibility({ state: 'failed', attempt: 1 }, true).disabled, true);
  assert.equal(M.retryEligibility({ state: 'failed', attempt: 1 }, false).disabled, false);
});

test('workspace rendering synchronizes both retry buttons and explains exhausted attempts without disabling refresh', async t => {
  const { app } = await fixture(t);
  const script = (await app.inject('/project-workspace.js')).body;
  const nodes = new Map<string, any>();
  const node = () => ({ disabled: false, dataset: {}, hidden: false, textContent: '', title: '', append() {}, replaceChildren() {} });
  const document = { getElementById(id: string) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }, createElement: node };
  const context: Record<string, any> = { RoomTreasuryWorkspace: model(), document };
  const ending = "addEventListener('pagehide',()=>watcher?.stop());void init();})();";
  assert.ok(script.includes(ending));
  runInNewContext(script.replace(ending, 'globalThis.harness={renderJob,setSubmitting(value){jobSubmitting=value;}};})();'), context);
  const job = { id: 'synthetic-failed-job', state: 'failed', transport: 'discord', attempt: 1, created_at: 0, updated_at: 0 };
  const check = (disabled: boolean) => {
    assert.equal(document.getElementById('pw-start').disabled, disabled);
    assert.equal(document.getElementById('pw-start-mock').disabled, disabled);
    assert.equal(document.getElementById('pw-refresh').disabled, false);
  };
  context.harness.renderJob(job); check(false);
  context.harness.setSubmitting(true); context.harness.renderJob(job); check(true);
  context.harness.setSubmitting(false); context.harness.renderJob(job); check(false);
  context.harness.renderJob({ ...job, state: 'dispatching' }); check(true);
  context.harness.renderJob({ ...job, attempt: 3 }); check(true);
  assert.match(document.getElementById('pw-poll-note').textContent, /Three-attempt limit/);
  assert.match(document.getElementById('pw-start').title, /Discord and mock share/);
});

test('failed Discord jobs retry with fresh job IDs and keys; active duplicates and exhausted attempts are rejected', async t => {
  const data = await fixture(t), binding = await onboarding(data);
  const path = '/v1/client-projects/' + binding.client_project_id + '/processing-jobs';
  const M = model(), keys: string[] = [];
  const submit = M.submission(async (payload: { transport: string }, key: string) => {
    keys.push(key);
    const response = await data.app.inject({ method: 'POST', url: path, headers: { ...data.headers, 'idempotency-key': key }, payload: { transport: payload.transport } });
    assert.equal(response.statusCode, 201);
    return response.json().job;
  }, () => 'synthetic-retry-' + keys.length);
  const jobs = new ProcessingJobs(data.db);
  const first = await submit.run({ transport: 'discord', projectId: binding.client_project_id, previousJob: null });
  const claimed = jobs.claim('discord')!;
  jobs.apply(first.id, claimed.lease_owner!, 'synthetic-dispatch-failed', 'failed', 'discord_dispatch_failed');
  const firstEvents = jobs.events(data.session, first.id).events;
  const second = await submit.run({ transport: 'discord', projectId: binding.client_project_id, previousJob: first.id });
  assert.notEqual(first.id, second.id);
  assert.notEqual(keys[0], keys[1]);
  assert.equal(second.attempt, 2);
  assert.equal(second.transport, 'discord');
  assert.equal(jobs.get(data.session, first.id).state, 'failed');
  assert.deepEqual(jobs.events(data.session, first.id).events, firstEvents);
  assert.equal(submit.busy, false);
  for (const transport of ['discord', 'mock']) {
    const duplicate = await data.app.inject({ method: 'POST', url: path, headers: { ...data.headers, 'idempotency-key': 'active-duplicate-' + transport }, payload: { transport } });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(duplicate.json().error.code, 'JOB_ALREADY_ACTIVE');
  }
  const repeated = await data.app.inject({ method: 'POST', url: path, headers: { ...data.headers, 'idempotency-key': keys[1]! }, payload: { transport: 'discord' } });
  assert.equal(repeated.json().job.id, second.id);
  const secondClaim = jobs.claim('discord')!;
  jobs.apply(second.id, secondClaim.lease_owner!, 'synthetic-dispatch-failed', 'failed', 'discord_dispatch_failed');
  const third = await submit.run({ transport: 'mock', projectId: binding.client_project_id, previousJob: second.id });
  assert.equal(third.transport, 'mock');
  assert.equal(third.attempt, 3);
  assert.notEqual(third.id, second.id);
  const thirdClaim = jobs.claim('mock')!;
  jobs.apply(third.id, thirdClaim.lease_owner!, 'synthetic-mock-failed', 'failed', 'mock_dispatch_failed');
  const fourth = await data.app.inject({ method: 'POST', url: path, headers: { ...data.headers, 'idempotency-key': 'exhausted' }, payload: { transport: 'discord' } });
  assert.equal(fourth.statusCode, 409);
  assert.equal(fourth.json().error.code, 'JOB_ATTEMPT_LIMIT');
  assert.equal(jobs.list(data.session, binding.client_project_id).length, 3);
});
