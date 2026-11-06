import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {Worker} from 'node:worker_threads';
import {buildApp} from '../src/app.js';
import {testDatabase} from './helpers.js';
import {provisionOwner,authSettings} from '../src/security/owner-auth.js';
import {validateBundle,importBundle} from '../src/imports/service.js';
import {gates,OwnerReview} from '../src/reviews/service.js';
import {openDatabase} from '../src/db/connection.js';
const password='Temporary test-only owner passphrase 37!';
const origin='http://127.0.0.1:3000',base={origin,host:'127.0.0.1:3000'};
process.env.ROOMTREASURY_AUTH_ORIGIN=origin;
async function fixture(t:TestContext){
 const data=testDatabase(t);const p=JSON.parse(readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json','utf8').replaceAll('RT-APEX-001','SYNTHETIC-AUTH-001'));p.client.name='Synthetic authenticated approval test';
 const bundle={proposal:{name:'proposal.json',content:JSON.stringify(p)}};const imported=importBundle(data.db,bundle,validateBundle(bundle).fingerprint);
 const ownerId=await provisionOwner(data.db,'test-owner',password,p.taskId);const app=await buildApp(data.db);t.after(()=>app.close());
 const login=await app.inject({method:'POST',url:'/v1/owner-auth/login',headers:base,payload:{username:'test-owner',password}});assert.equal(login.statusCode,200);
 const setCookie=String(login.headers['set-cookie']),cookie=setCookie.split(';')[0]!;const headers={...base,cookie,'x-csrf-token':login.json().csrfToken};
 const path='/v1/proposal-imports/'+imported.id+'/review';
 const state=async()=>{const r=await app.inject({url:path,headers});assert.equal(r.statusCode,200);return r.json();};
 const post=async(action:string,body:object,override:Record<string,string>={})=>app.inject({method:'POST',url:path+'/'+action,headers:{...headers,...override},payload:body});
 return {...data,p,ownerId,app,headers,cookie,setCookie,importId:imported.id,path,state,post};
}
function readyPayload(p:any){const result=structuredClone(p);result.project.agreedRevenueCents=200000;result.financialSummary.agreedRevenueCents=200000;result.financialSummary.projectedGrossMarginCents=59000;result.financialSummary.projectedGrossMarginPercent=29.5;for(const s of result.financialSummary.scenarios)s.projectedGrossMarginCents=200000-s.totalCostCents;result.status='READY_FOR_OWNER_REVIEW';result.blockingReviews=[];result.ownerDecisionRecommendation.recommendation='SEEK_OWNER_REVIEW';return result;}
const facts={rateCentsPerHour:2500,capacityHours:60,paymentTerms:'Synthetic agreed invoice terms, cash not received',policyLimitCents:200000,reason:'Verified test economic model',acceptLowMargin:false};
async function eligible(data:Awaited<ReturnType<typeof fixture>>){
 let state=await data.state();let binding={revisionId:state.revision.id,fingerprint:state.revision.fingerprint};
 const revision=await data.post('revisions',{...binding,proposal:readyPayload(data.p),reason:'Synthetic scope and commercial terms revised'});assert.equal(revision.statusCode,200);state=revision.json();binding={revisionId:state.revision.id,fingerprint:state.revision.fingerprint};
 for(const [gate,origin] of Object.entries(gates)){
 const note=await data.post('notes',{...binding,gate,answer:'Synthetic independently checked fact',reference:'synthetic:evidence'});assert.equal(note.statusCode,200);const noteId=note.json().notes.at(-1).id;
 const verified=await data.post('verify',{...binding,noteId,origin,facts});assert.equal(verified.statusCode,200);
 }
 const result=await data.state();assert.equal(result.blockers.length,0);return {...binding,confirmation:'APPROVE_EXACT_REVISION'};
}
test('login uses hashed storage, opaque HttpOnly cookie, CSRF, explicit origin and no public account registration',async t=>{
 const data=await fixture(t);assert.match(data.setCookie,/HttpOnly/);assert.match(data.setCookie,/SameSite=Strict/);assert.match(data.setCookie,/Max-Age=14400/);assert.ok(!data.setCookie.includes('Secure'));
 const stored=JSON.stringify(data.db.prepare('SELECT * FROM human_owners').all());assert.ok(!stored.includes(password));const sessions=JSON.stringify(data.db.prepare('SELECT * FROM human_sessions').all());assert.ok(!sessions.includes(data.cookie.split('=')[1]!));assert.ok(!sessions.includes(data.headers['x-csrf-token']));
 for(const body of [{username:'test-owner',password:'Wrong password'},{username:'unknown-owner',password}])assert.equal((await data.app.inject({method:'POST',url:'/v1/owner-auth/login',headers:base,payload:body})).statusCode,401);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/owner-auth/login',headers:{host:base.host,origin:'https://evil.example'},payload:{username:'test-owner',password}})).statusCode,403);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/owner-auth/register',payload:{username:'self-owner',password}})).statusCode,404);
 const settings=authSettings(data.db,{ROOMTREASURY_AUTH_ORIGIN:'https://treasury.example',NODE_ENV:'production'});assert.equal(settings.cookieName,'__Host-rt_owner');assert.equal(settings.secure,true);assert.throws(()=>authSettings(data.db,{NODE_ENV:'production'}));assert.throws(()=>authSettings(data.db,{ROOMTREASURY_AUTH_ORIGIN:origin,NODE_ENV:'production'}));
 new Script((await data.app.inject('/owner-login.js')).body);new Script((await data.app.inject('/owner-review.js')).body);
});
test('unauthenticated, cross-project, actor spoofing, wrong origin and missing/wrong CSRF cannot mutate review',async t=>{
 const data=await fixture(t);const state=await data.state();const binding={revisionId:state.revision.id,fingerprint:state.revision.fingerprint};const body={...binding,gate:'scope',answer:'Untrusted input',reference:'ref'};
 assert.equal((await data.app.inject(data.path)).statusCode,401);
 assert.equal((await data.app.inject({method:'POST',url:data.path+'/notes',headers:base,payload:body})).statusCode,401);
 for(const override of [{'x-csrf-token':''},{'x-csrf-token':'wrong'},{origin:'https://evil.example'}])assert.equal((await data.post('notes',body,override)).statusCode,403);
 assert.equal((await data.post('notes',{...body,ownerId:'attacker',actor:{role:'owner'}})).statusCode,400);
 assert.equal((await data.app.inject({url:data.path,headers:{authorization:'Bearer fake-service-credential'}})).statusCode,401);
 data.db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=?').run(Date.now(),data.ownerId);
 assert.equal((await data.app.inject({url:data.path,headers:data.headers})).statusCode,403);
 assert.equal(data.db.prepare('SELECT count(*) FROM owner_review_notes').pluck().get(),0);
});
test('blocked proposals and synthetic verifications cannot be upgraded to authenticated approvals',async t=>{
 const data=await fixture(t);let state=await data.state();let binding={revisionId:state.revision.id,fingerprint:state.revision.fingerprint};assert.equal((await data.post('approve',{...binding,confirmation:'APPROVE_EXACT_REVISION'})).statusCode,409);
 const revised=await data.post('revisions',{...binding,proposal:readyPayload(data.p),reason:'Synthetic revision'});state=revised.json();binding={revisionId:state.revision.id,fingerprint:state.revision.fingerprint};const service=new OwnerReview(data.db);const actor={kind:'human' as const,id:data.ownerId,projectId:data.p.taskId,role:'owner' as const};
 for(const [gate,origin] of Object.entries(gates)){const note=service.recordNote(data.importId,binding.revisionId,binding.fingerprint,gate as keyof typeof gates,'Synthetic domain fixture','synthetic:domain',actor);service.verifyGate(actor,data.importId,binding.revisionId,binding.fingerprint,note,origin,facts);}
 assert.equal(service.snapshot(data.importId).blockers.length,0);assert.equal((await data.post('approve',{...binding,confirmation:'APPROVE_EXACT_REVISION'})).statusCode,409);assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});
test('authenticated checks bind owner, revision and fingerprint; duplicate and concurrent HTTP approval spends nothing and creates one project',async t=>{
 const data=await fixture(t);const old=(await data.state()).revision;const body=await eligible(data);
 assert.equal((await data.post('approve',{...body,revisionId:old.id,fingerprint:old.fingerprint})).statusCode,409);
 const results=await Promise.all([data.post('approve',body),data.post('approve',body)]);assert.ok(results.every(r=>r.statusCode===200));assert.equal(results[0]!.json().decision.id,results[1]!.json().decision.id);
 assert.equal((await data.post('approve',body)).statusCode,200);
 assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT count(*) FROM owner_review_decisions').pluck().get(),1);
 const audit=data.db.prepare("SELECT * FROM authenticated_review_events WHERE action='decision'").get() as any;assert.equal(audit.owner_id,data.ownerId);assert.equal(audit.revision_id,body.revisionId);assert.equal(audit.fingerprint,body.fingerprint);assert.equal(audit.auth_basis,'authenticated_owner_session');
 assert.equal(data.db.prepare("SELECT count(*) FROM authenticated_review_events WHERE action='decision'").pluck().get(),1);
 assert.throws(()=>data.db.exec("UPDATE authenticated_review_events SET owner_id='forged'"));assert.throws(()=>data.db.exec('DELETE FROM authenticated_review_events'));
 for(const table of ['commitments','reservations','ledger_entries','payment_requests'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('session rotation, logout, idle expiry, absolute expiry and owner disabling reject old cookies',async t=>{
 const data=await fixture(t);
 const second=await data.app.inject({method:'POST',url:'/v1/owner-auth/login',headers:base,payload:{username:'test-owner',password}});assert.equal(second.statusCode,200);
 assert.equal((await data.app.inject({url:'/v1/owner-auth/session',headers:{...base,cookie:data.cookie}})).statusCode,401);
 const cookie=String(second.headers['set-cookie']).split(';')[0]!,headers={...base,cookie,'x-csrf-token':second.json().csrfToken};
 assert.equal((await data.app.inject({method:'POST',url:'/v1/owner-auth/logout',headers:{...headers,'x-csrf-token':''}})).statusCode,403);
 assert.equal((await data.app.inject({method:'POST',url:'/v1/owner-auth/logout',headers})).statusCode,200);
 assert.equal((await data.app.inject({url:'/v1/owner-auth/session',headers})).statusCode,401);
 const third=await data.app.inject({method:'POST',url:'/v1/owner-auth/login',headers:base,payload:{username:'test-owner',password}});const thirdCookie=String(third.headers['set-cookie']).split(';')[0]!;
 const prior=data.db.prepare('SELECT * FROM human_sessions WHERE revoked_at IS NULL').get() as any;
 // A future clock exercises both server-side expiry checks without altering immutable session terms.
 const originalNow=Date.now;try{Date.now=()=>prior.last_seen+900001;assert.equal((await data.app.inject({url:'/v1/owner-auth/session',headers:{...base,cookie:thirdCookie}})).statusCode,401);Date.now=()=>prior.expires_at+1;assert.equal((await data.app.inject({url:'/v1/owner-auth/session',headers:{...base,cookie:thirdCookie}})).statusCode,401);}finally{Date.now=originalNow;}
 data.db.prepare('UPDATE human_owners SET disabled_at=? WHERE id=?').run(Date.now(),data.ownerId);assert.equal((await data.app.inject({url:'/v1/owner-auth/session',headers:{...base,cookie:thirdCookie}})).statusCode,401);
});
test('authenticated verification invalidates after scope revocation; session/approval survive reopen without reauthentication claims',async t=>{
 const data=await fixture(t);const body=await eligible(data);const second=openDatabase(data.config);const secondApp=await buildApp(second);try{assert.equal((await secondApp.inject({url:'/v1/owner-auth/session',headers:data.headers})).statusCode,200);second.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=?').run(Date.now(),data.ownerId);assert.equal((await data.post('approve',body)).statusCode,403);assert.equal(second.prepare('SELECT count(*) FROM projects').pluck().get(),0);}finally{await secondApp.close();}
});
test('persistent login throttling rejects brute-force attempts without user enumeration payloads',async t=>{
 const data=await fixture(t);data.db.prepare("UPDATE human_login_limits SET attempts=100 WHERE key='global'").run();const r=await data.app.inject({method:'POST',url:'/v1/owner-auth/login',headers:base,payload:{username:'unknown-owner',password}});assert.equal(r.statusCode,429);assert.ok(!r.body.includes(password));
});


test('independent authenticated worker connections converge to exactly one approval and audit event',async t=>{
 const data=await fixture(t);const body=await eligible(data);
 const workers=await Promise.all([1,2].map(async()=>{const worker=new Worker(new URL('./owner-http-worker.js',import.meta.url),{workerData:{config:data.config,path:data.path,headers:data.headers,body}});const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});const result=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});return {worker,result,exit};}));
 for(const w of workers)w.worker.postMessage('go');const results=await Promise.all(workers.map(w=>w.result));await Promise.all(workers.map(w=>w.exit));assert.ok(results.every(r=>r.status===200));assert.equal(results[0].id,results[1].id);
 assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(data.db.prepare("SELECT count(*) FROM authenticated_review_events WHERE action='decision'").pluck().get(),1);
});
