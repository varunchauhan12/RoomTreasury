import {onboardAuthorizedProject as onboardProject} from './helpers.js';
import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {testDatabase} from './helpers.js';
import {provisionOwner,loginOwner} from '../src/security/owner-auth.js';

import {ProcessingJobs} from '../src/jobs/service.js';
import {buildApp} from '../src/app.js';
import {validateBundle,ImportError,type ImportBundle} from '../src/imports/service.js';
import {importDiscordPackage,retrieveProjectArtifacts} from '../src/imports/project-linked.js';
import {OwnerReview} from '../src/reviews/service.js';
import {DiscordMessageCollector} from '../src/discord/collector.js';
import {DiscordRestClient,type DiscordMessage} from '../src/discord/client.js';
import {DiscordTransport} from '../src/discord/transport.js';
import {readDiscordConfig} from '../src/discord/config.js';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
function original():ImportBundle{return Object.fromEntries([['proposal','proposal.json'],['evidence','evidence.json'],['summary','summary.md']].map(([kind,name])=>[kind,{name:name!,content:readFileSync('backend/tests/fixtures/nova-recovery/'+name,'utf8')}])) as unknown as ImportBundle;}
async function fixture(t:TestContext,attention=true){
 const data=testDatabase(t),raw=original(),p=JSON.parse(raw.proposal.content);
 await provisionOwner(data.db,'recover-owner','Synthetic recovery owner password','PREEXISTING');
 const login=await loginOwner(data.db,'recover-owner','Synthetic recovery owner password','fixture');
 const binding=onboardProject(data.db,login.session,{clientName:p.client.name,brief:p.project.brief,revenueCents:p.project.proposedRevenueCents},'recover-onboard');
 const jobs=new ProcessingJobs(data.db),job=jobs.create(login.session,binding.id,'recover-job','discord');
 const replacements:Record<string,string>={[p.projectId]:binding.client_project_id,[p.taskId]:binding.task_id,[p.processingJobId]:job.id,[p.intakeSha256]:job.intake_hash};
 const bundle=Object.fromEntries(Object.entries(raw).map(([key,file])=>[key,{...file,content:Object.entries(replacements).reduce((s,[from,to])=>s.replaceAll(from,to),file.content)}])) as unknown as ImportBundle;
 if(attention){const claim=jobs.claim('discord')!;for(const state of ['dispatched','running','collecting','validating'] as const)jobs.apply(job.id,claim.lease_owner!,state,state);jobs.apply(job.id,claim.lease_owner!,'missing','needs_attention','discord_missing_attachments');}
 const app=await buildApp(data.db);t.after(()=>app.close());
 const headers={origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000',cookie:'rt_demo_owner='+login.token,'x-csrf-token':login.session.csrf};
 const url='/v1/client-projects/'+binding.client_project_id+'/proposal-imports/';
 return {...data,...login,binding,jobs,job,bundle,app,headers,url};
}

test('original Nova package normalizes without changing raw bytes, evidence, scope information or unconfirmed revenue',()=>{
 const raw=original(),before=JSON.stringify(raw),v=validateBundle(raw);
 assert.equal(JSON.stringify(raw),before);assert.equal(v.rawProposal,raw.proposal.content);assert.equal(v.rawEvidence,raw.evidence!.content);assert.equal(v.rawSummary,raw.summary!.content);
 assert.equal(v.proposal.project.agreedRevenueCents,null);assert.equal(v.proposal.financialSummary.agreedRevenueCents,null);
 assert.equal(v.proposal.project.proposedRevenueCents,180000);assert.equal(v.proposal.proposal.budgetCents,107520);
 assert.ok(v.proposal.blockingReviews.some((s:string)=>s.includes('Client agreed revenue is unconfirmed')));
 assert.equal(v.normalization.format,'bound_coordinator_v1');assert.ok(v.normalization.warnings.length);
 const p=JSON.parse(raw.proposal.content),e=JSON.parse(raw.evidence!.content);
 assert.deepEqual(v.proposal.statementOfWork.scope.map((s:string)=>JSON.parse(s)),p.statementOfWork.scope);
 assert.deepEqual(v.evidence!.specialistReports,e.specialistReports);assert.deepEqual(v.evidence!.coordinationMessages,e.coordinationEvidence);
 assert.equal(v.proposal.riskRegister.length,p.riskRegister.length);
 assert.equal(v.normalization.binding!.processingJobId,p.processingJobId);
});

test('authenticated recovery imports into the existing job exactly once, retains raw hashes/history and creates no financial authority',async t=>{
 const d=await fixture(t),history=d.jobs.events(d.session,d.job.id).events;
 const preview=await d.app.inject({method:'POST',url:d.url+'preview',headers:d.headers,payload:d.bundle});assert.equal(preview.statusCode,200,preview.body);
 const post=()=>d.app.inject({method:'POST',url:d.url+'confirm',headers:d.headers,payload:{...d.bundle,jobId:preview.json().jobId,intakeHash:preview.json().intakeHash,fingerprint:preview.json().fingerprint}});
 const result=await post();assert.equal(result.statusCode,200,result.body);const id=result.json().id;
 assert.equal((await post()).json().id,id);assert.equal((await post()).json().duplicate,true);
 assert.equal(d.jobs.get(d.session,d.job.id).state,'imported');assert.equal(d.jobs.get(d.session,d.job.id).result_import_id,id);
 assert.deepEqual(d.jobs.events(d.session,d.job.id).events.slice(0,history.length),history);
 assert.equal(d.db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),1);assert.equal(d.db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);
 const raw=d.db.prepare('SELECT * FROM proposal_import_originals WHERE import_id=?').get(id) as any;
 assert.equal(raw.proposal_raw,d.bundle.proposal.content);assert.equal(raw.evidence_raw,d.bundle.evidence!.content);assert.equal(raw.summary_raw,d.bundle.summary!.content);
 assert.equal(raw.proposal_sha256,hash(d.bundle.proposal.content));assert.equal(raw.evidence_sha256,hash(d.bundle.evidence!.content));assert.equal(raw.summary_sha256,hash(d.bundle.summary!.content));
 assert.throws(()=>d.db.prepare('UPDATE proposal_import_originals SET proposal_raw=? WHERE import_id=?').run('{}',id));assert.throws(()=>d.db.prepare('DELETE FROM proposal_import_originals WHERE import_id=?').run(id));
 const view=await d.app.inject({url:'/v1/proposal-imports/'+id,headers:d.headers});assert.equal(view.statusCode,200);assert.equal(view.json().normalization.binding.processingJobId,d.job.id);
 for(const kind of ['proposal','evidence','summary'] as const){const download=await d.app.inject({url:'/v1/proposal-imports/'+id+'/original-artifacts/'+kind,headers:d.headers});assert.equal(download.body,d.bundle[kind]!.content);}
 assert.equal((await d.app.inject({url:'/v1/proposal-imports/'+id+'/original-artifacts/proposal'})).statusCode,401);
 const project=(await d.app.inject({url:'/v1/client-projects/'+d.binding.client_project_id,headers:d.headers})).json();assert.equal(project.workspace.imports[0].id,id);
 const review=new OwnerReview(d.db).snapshot(id);assert.equal(review.status,'BLOCKED');assert.ok(review.blockers.some(b=>b.includes('Client agreed revenue is unconfirmed')));
 for(const table of ['projects','delivery_proposals','commitments','payment_approvals','reservations','ledger_entries','settlement_receipts','owner_review_decisions'])assert.equal(d.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});

test('recovery enforces owner authentication, CSRF, origin, exact job binding, filenames and invalid artifacts',async t=>{
 const d=await fixture(t);
 for(const headers of [{}, {...d.headers,'x-csrf-token':'wrong'}, {...d.headers,origin:'http://untrusted.example'}]){
  const r=await d.app.inject({method:'POST',url:d.url+'preview',headers,payload:d.bundle});assert.ok([401,403].includes(r.statusCode));
 }
 await provisionOwner(d.db,'other-recover-owner','Synthetic other owner password','PREEXISTING');const other=await loginOwner(d.db,'other-recover-owner','Synthetic other owner password','fixture');
 const wrong=await d.app.inject({method:'POST',url:d.url+'preview',headers:{...d.headers,cookie:'rt_demo_owner='+other.token,'x-csrf-token':other.session.csrf},payload:d.bundle});assert.equal(wrong.statusCode,403);
 const changed=JSON.parse(JSON.stringify(d.bundle));for(const file of Object.values(changed) as {content:string}[])file.content=file.content.replaceAll(d.job.id,'another-processing-job');
 assert.equal((await d.app.inject({method:'POST',url:d.url+'preview',headers:d.headers,payload:changed})).statusCode,409);
 for(const proposal of [{name:'other.json',content:d.bundle.proposal.content},{name:'proposal.json',content:'{ invalid'},{name:'proposal.json',content:d.bundle.proposal.content.replace('"agreedRevenueCents": null','"agreedRevenueCents": 180000')}]){
  const r=await d.app.inject({method:'POST',url:d.url+'preview',headers:d.headers,payload:{...d.bundle,proposal}});assert.ok(r.statusCode>=400,r.body);
 }
 const contradictory=original();const evidence=JSON.parse(contradictory.evidence!.content);evidence.intakeRevision=2;contradictory.evidence!.content=JSON.stringify(evidence);assert.throws(()=>validateBundle(contradictory),ImportError);
 assert.equal(d.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});

test('failed raw-artifact persistence rolls back import, link, event and job transition atomically',async t=>{
 const d=await fixture(t);const p=await d.app.inject({method:'POST',url:d.url+'preview',headers:d.headers,payload:d.bundle});assert.equal(p.statusCode,200);
 const before=d.jobs.events(d.session,d.job.id).events;
 d.db.exec("CREATE TRIGGER fail_raw BEFORE INSERT ON proposal_import_originals BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END");
 const r=await d.app.inject({method:'POST',url:d.url+'confirm',headers:d.headers,payload:{...d.bundle,jobId:p.json().jobId,intakeHash:p.json().intakeHash,fingerprint:p.json().fingerprint}});assert.equal(r.statusCode,500);
 assert.equal(d.jobs.get(d.session,d.job.id).state,'needs_attention');assert.deepEqual(d.jobs.events(d.session,d.job.id).events,before);
 assert.equal(d.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);assert.equal(d.db.prepare('SELECT count(*) FROM project_import_links').pluck().get(),0);
});

test('split coordinator messages correlate by verified file binding before completion; unrelated and wrong-task files are rejected',async t=>{
 const d=await fixture(t,false),config=readDiscordConfig({DISCORD_BOT_TOKEN:'disposable-offline-recovery-fixture'});
 const bodies:Record<string,string>={proposal:d.bundle.proposal.content,evidence:d.bundle.evidence!.content,summary:d.bundle.summary!.content,unrelated:'{}',wrongTask:d.bundle.evidence!.content.replaceAll(d.binding.task_id,'wrong-task')};
 const attachment=(kind:string,name:string)=>({id:kind,filename:name,size:Buffer.byteLength(bodies[kind]!),url:'https://cdn.discordapp.com/offline/'+kind});
 const message=(id:string,content:string,attachments:DiscordMessage['attachments']):DiscordMessage=>({id,content,attachments,channel_id:config.channelId,guild_id:config.guildId,author:{id:'coordinator-webhook',username:'make-proposal-agent',bot:true},timestamp:new Date().toISOString()});
 const messages=[message('100000000000000101','',[attachment('unrelated','proposal.json')]),message('100000000000000102','',[attachment('wrongTask','evidence.json')]),message('100000000000000103','Package for '+d.job.id,[attachment('proposal','proposal.json')]),message('100000000000000104','',[attachment('evidence','evidence.json')]),message('100000000000000105','',[attachment('summary','summary.md')]),message('100000000000000106','ROOMTREASURY_RESULT_READY job='+d.job.id+' correlation='+d.job.correlation_id,[])];
 const client=new DiscordRestClient({config,fetchFn:async(url,init)=>{
  if(init?.method==='POST')return Response.json({...messages[0],id:'100000000000000100'});
  if(String(url).includes('/messages'))return Response.json([...messages].reverse());
  const kind=String(url).split('/').at(-1)!;return new Response(bodies[kind]??'{}');
 }});
 const collector=new DiscordMessageCollector(d.db,config,client);
 assert.equal(collector.isCorrelated(messages[3]!,d.job.id,d.job.correlation_id,d.binding.task_id),false);
 assert.equal(await collector.correlateMessage(messages[0]!,d.job.id,d.job.correlation_id,d.binding.task_id),false);
 assert.equal(await collector.correlateMessage(messages[1]!,d.job.id,d.job.correlation_id,d.binding.task_id),false);
 await d.jobs.runNext(new DiscordTransport({db:d.db,config,client,pollIntervalMs:1,timeoutMs:3000}));
 const result=d.jobs.get(d.session,d.job.id);assert.equal(result.state,'imported',result.diagnostic??'');
 const captured=d.db.prepare('SELECT id,raw_json FROM discord_messages WHERE job_id=? ORDER BY id').all(d.job.id) as any[];
 assert.deepEqual(captured.map(r=>r.id),messages.slice(2).map(m=>m.id));
 assert.equal(JSON.parse(captured[1].raw_json).attachments[0].id,'evidence');
 assert.equal(d.db.prepare('SELECT count(*) FROM discord_attachments WHERE job_id=?').pluck().get(d.job.id),3);
 assert.ok(new OwnerReview(d.db).snapshot(result.result_import_id!).blockers.some(b=>b.includes('Client agreed revenue is unconfirmed')));
});

test('bound package rejects contradictory revenue, missing scope structure and mismatched summary metadata',()=>{
 for(const mutate of [(p:any)=>{p.financialSummary.proposedRevenueCents=1;},(p:any)=>{p.statementOfWork.scope=[{}];}]){
  const b=original(),p=JSON.parse(b.proposal.content);mutate(p);b.proposal.content=JSON.stringify(p);assert.throws(()=>validateBundle(b),ImportError);
 }
 const b=original();b.summary!.content=b.summary!.content.replaceAll('discord-e8c2e4a1-1546-45b3-b9f2-80b05000ecca','wrong-correlation');assert.throws(()=>validateBundle(b),ImportError);
});

test('automatic import rejects another job and a lost lease without writing any result',async t=>{
 const d=await fixture(t,false),claim=d.jobs.claim('discord')!;
 for(const state of ['dispatched','running','collecting','validating'] as const)d.jobs.apply(d.job.id,claim.lease_owner!,state,state);
 const otherId='00000000-0000-4000-8000-000000000001';
 const wrong=Object.fromEntries(Object.entries(d.bundle).map(([kind,file])=>[kind,{...file,content:file.content.replaceAll(d.job.id,otherId)}])) as unknown as ImportBundle;
 assert.throws(()=>importDiscordPackage(d.db,d.job.id,wrong),error=>error instanceof ImportError&&error.issues.some(i=>i.includes('exact processing job')));
 d.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now()-1,d.job.id);
 assert.throws(()=>importDiscordPackage(d.db,d.job.id,d.bundle),error=>error instanceof ImportError&&error.issues.some(i=>i.includes('no longer actively validating')));
 assert.equal(d.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
 assert.equal(d.db.prepare('SELECT count(*) FROM project_import_links').pluck().get(),0);
});

test('completion requires the exact coordinator job/correlation marker; active jobs cannot be manually recovered',async t=>{
 const d=await fixture(t,false),config=readDiscordConfig({DISCORD_BOT_TOKEN:'disposable-offline-recovery-fixture'});
 const collector=new DiscordMessageCollector(d.db,config,new DiscordRestClient({config,fetchFn:async()=>{throw Error('No HTTP permitted');}}));
 const msg:DiscordMessage={id:'marker-1',channel_id:config.channelId,author:{id:'coord',username:'make-proposal-agent',bot:true},content:'ROOMTREASURY_RESULT_READY job='+d.job.id+' correlation=wrong',attachments:[],timestamp:new Date().toISOString()};
 assert.equal(collector.recordMessage(msg,d.job.id)!.isCompletionMarker,false);
 assert.equal(collector.recordMessage({...msg,id:'marker-2',content:msg.content.replace('correlation=wrong','correlation='+d.job.correlation_id)},d.job.id)!.isCompletionMarker,true);
 const r=await d.app.inject({method:'POST',url:d.url+'preview',headers:d.headers,payload:d.bundle});assert.equal(r.statusCode,409);
 assert.equal(d.jobs.get(d.session,d.job.id).state,'queued');assert.equal(d.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
});

test('owner-triggered retrieval stages the original three messages and provenance without dispatch or import',async t=>{
 const d=await fixture(t),config=readDiscordConfig({DISCORD_BOT_TOKEN:'disposable-offline-recovery-fixture'});
 const make=(id:string,content:string,file?:{name:string;content:string}):DiscordMessage=>({id,content,channel_id:config.channelId,guild_id:config.guildId,author:{id:'same-coordinator',username:'make-proposal-agent',bot:true},timestamp:new Date().toISOString(),attachments:file?[{id:'att-'+id,filename:file.name,size:Buffer.byteLength(file.content),url:'https://cdn.discordapp.com/recover/'+file.name}]:[]});
 const messages=[make('100000000000000101','Package '+d.job.id,d.bundle.proposal),make('100000000000000102','',d.bundle.evidence),make('100000000000000103','',d.bundle.summary),make('100000000000000104','ROOMTREASURY_RESULT_READY job='+d.job.id+' correlation='+d.job.correlation_id)];
 const calls:string[]=[];
 const client=new DiscordRestClient({config,fetchFn:async(url,init)=>{assert.equal(init?.method,'GET');calls.push(String(url));if(String(url).includes('/messages'))return Response.json(messages.slice(1));const file=Object.values(d.bundle).find(f=>String(url).endsWith(f.name))!;return new Response(file.content);}});
 const collector=new DiscordMessageCollector(d.db,config,client);collector.recordMessage(messages[0]!,d.job.id);collector.recordMessage(messages[3]!,d.job.id);
 const retrieved=await retrieveProjectArtifacts(d.db,d.session,d.binding.client_project_id,client,config);
 assert.equal(retrieved.bundle.evidence!.content,d.bundle.evidence!.content);assert.equal(retrieved.preview.jobId,d.job.id);
 assert.equal(d.jobs.get(d.session,d.job.id).state,'needs_attention');assert.equal(d.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
 assert.equal(d.db.prepare('SELECT count(*) FROM discord_attachments').pluck().get(),3);
 const result=await d.app.inject({method:'POST',url:d.url+'confirm',headers:d.headers,payload:{...retrieved.bundle,jobId:retrieved.preview.jobId,intakeHash:retrieved.preview.intakeHash,fingerprint:retrieved.preview.fingerprint}});assert.equal(result.statusCode,200,result.body);
 const raw=d.db.prepare('SELECT normalization_json FROM proposal_import_originals WHERE import_id=?').get(result.json().id) as any;
 assert.equal(JSON.parse(raw.normalization_json).discordAttachments.length,3);
 const unauthenticated=await d.app.inject({method:'POST',url:d.url+'retrieve-discord',payload:{}});assert.equal(unauthenticated.statusCode,401);
 assert.ok(calls.length>0);assert.equal(d.db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),1);
});
