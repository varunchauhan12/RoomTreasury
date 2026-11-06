import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { buildApp } from '../src/app.js';
import { validateBundle, importBundle, ImportError, type ImportBundle } from '../src/imports/service.js';
import { openDatabase } from '../src/db/connection.js';
import { setupSyntheticDemo } from '../src/demo/setup.js';
import { testDatabase } from './helpers.js';
const fixture=(kind:string,ext:string)=>({name:`RT-APEX-001-${kind}.${ext}`,content:readFileSync(`docs/agent-import/RT-APEX-001/RT-APEX-001-${kind}.${ext}`,'utf8')});
const bundle:ImportBundle={proposal:fixture('proposal','json'),evidence:fixture('specialist-evidence','json'),summary:fixture('summary','md')};
const changed=(edit:(p:any)=>void)=>{const p=JSON.parse(bundle.proposal.content);edit(p);return {...bundle,proposal:{...bundle.proposal,content:JSON.stringify(p)}};};
test('real Apex artifacts validate completely, preserve 11 tasks, 13 risks, four source-labelled contributions and finances',()=>{
 const v=validateBundle(bundle),p=v.proposal;
 assert.equal(p.status,'NEEDS_CLIENT_CLARIFICATION');assert.equal(p.executionPlan.tasks.length,11);assert.equal(p.riskRegister.length,13);assert.equal(p.specialistContributions.length,4);assert.equal(p.proposal.allocations.reduce((s:number,a:any)=>s+a.limitCents,0),141000);
 assert.equal(p.financialSummary.baseEstimatedCostCents,117500);assert.equal(p.financialSummary.contingencyCents,23500);assert.equal(p.proposal.budgetCents,141000);assert.equal(p.project.agreedRevenueCents,150000);assert.equal(p.financialSummary.projectedGrossMarginCents,9000);
 assert.equal(p.executionPlan.estimatedTotalHours,47);assert.match(JSON.stringify(p),/41–58/);assert.match(p.statementOfWork.timelineBasis,/15-business-day/);assert.ok(p.blockingReviews.includes('FINANCIAL_VIABILITY_AND_BACKEND_VALIDATION'));assert.equal(v.original,bundle.proposal.content);
});
test('malformed files, missing fields, bad currencies/amounts, duplicates, unknown references, cycles and source mismatches fail validation',()=>{
 for(const edit of [(p:any)=>{delete p.statementOfWork;},(p:any)=>p.currency='EUR',(p:any)=>p.project.agreedRevenueCents=-1,(p:any)=>p.proposal.allocations[0].limitCents=1.5,(p:any)=>p.financialSummary.projectedGrossMarginCents=9001,(p:any)=>p.executionPlan.tasks[0].dependencies=[p.executionPlan.tasks[1].taskId],(p:any)=>p.riskRegister[1].riskId=p.riskRegister[0].riskId,(p:any)=>p.specialistContributions[0].sourceMessageIds=['missing']])assert.throws(()=>validateBundle(changed(edit)),ImportError);
 assert.throws(()=>validateBundle({...bundle,proposal:{name:'bad.json',content:'{'}}),ImportError);
 assert.throws(()=>validateBundle({...bundle,proposal:{name:'bad.html',content:bundle.proposal.content}}),ImportError);
 assert.throws(()=>validateBundle({...bundle,summary:{name:'big.md',content:'a'.repeat(65537)}}),ImportError);
 assert.throws(()=>validateBundle({...bundle,evidence:{name:'bad.json',content:'{}'}}),ImportError);
});
test('duplicate imports are canonical/idempotent, changed proposals create immutable revisions, changed evidence cannot overwrite',t=>{
 const {db}=testDatabase(t);const v=validateBundle(bundle);const first=importBundle(db,bundle,v.fingerprint);assert.equal(first.duplicate,false);assert.equal(importBundle(db,bundle,v.fingerprint).id,first.id);
 const formatted={...bundle,proposal:{...bundle.proposal,content:JSON.stringify(JSON.parse(bundle.proposal.content))}};assert.equal(importBundle(db,formatted,validateBundle(formatted).fingerprint).duplicate,true);
 assert.throws(()=>importBundle(db,{...bundle,summary:{name:'summary.md',content:'Changed'}},validateBundle({...bundle,summary:{name:'summary.md',content:'Changed'}}).fingerprint),ImportError);
 const revised=changed(p=>p.proposal.explanation+=' Revised review.');assert.notEqual(importBundle(db,revised,validateBundle(revised).fingerprint).id,first.id);
 assert.deepEqual(db.prepare('SELECT revision FROM proposal_imports ORDER BY revision').pluck().all(),[1,2]);assert.throws(()=>db.exec('DELETE FROM proposal_imports'));assert.throws(()=>db.exec("UPDATE proposal_imports SET source='automated'"));
 assert.throws(()=>importBundle(db,bundle,'0'.repeat(64)),ImportError);
 for(const table of ['projects','client_projects','delivery_proposals','commitments','reservations','payment_requests','ledger_entries'])assert.equal(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
});
test('optional artifacts can be omitted and original persisted payload survives reopening',t=>{
 const {db,config}=testDatabase(t);const minimal={proposal:bundle.proposal};const result=importBundle(db,minimal,validateBundle(minimal).fingerprint);db.close();const reopened=openDatabase(config);try {
 const row=reopened.prepare('SELECT * FROM proposal_imports WHERE id=?').get(result.id) as any;assert.equal(row.proposal_json,bundle.proposal.content);assert.equal(row.evidence_json,null);assert.equal(row.summary_markdown,null);assert.equal(row.source,'human_mediated_file_import');assert.equal(row.identity_authenticated,0);
 }finally{reopened.close();}
});
test('preview and confirm API, artifact downloads and workspace serve safely without changing Northstar or finances',async t=>{
 const {db,config}=testDatabase(t);db.close();setupSyntheticDemo(config);const active=openDatabase(config);const before=JSON.stringify(active.prepare('SELECT * FROM projects').all());
 const app=await buildApp(active);const headers={'host':'127.0.0.1','x-roomtreasury-import':'1'};try {
 const preview=await app.inject({method:'POST',url:'/v1/proposal-imports/preview',headers,payload:bundle});assert.equal(preview.statusCode,200);assert.equal(active.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
 const confirmed=await app.inject({method:'POST',url:'/v1/proposal-imports/confirm',headers,payload:{...bundle,fingerprint:preview.json().fingerprint}});assert.equal(confirmed.statusCode,200);const id=confirmed.json().id;
 const detail=(await app.inject('/v1/proposal-imports/'+id)).json();assert.equal(detail.proposal.status,'NEEDS_CLIENT_CLARIFICATION');assert.equal(detail.executionAuthorized,false);assert.equal(detail.identityAuthenticated,false);assert.deepEqual(detail.evidence,JSON.parse(bundle.evidence!.content));
 assert.equal((await app.inject('/v1/proposal-imports/')).json().imports.length,1);
 const download=await app.inject(`/v1/proposal-imports/${id}/artifacts/proposal`);assert.equal(download.body,bundle.proposal.content);assert.match(download.headers['content-disposition'] as string,/attachment/);
 assert.equal((await app.inject('/v1/proposal-imports/missing')).statusCode,404);assert.equal((await app.inject(`/v1/proposal-imports/${id}/artifacts/unknown`)).statusCode,404);
 assert.equal((await app.inject({method:'POST',url:'/v1/proposal-imports/confirm',payload:bundle})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/proposal-imports/preview',headers:{...headers,origin:'https://evil.example'},payload:bundle})).statusCode,403);
 const html=await app.inject('/proposal-imports');assert.equal(html.statusCode,200);assert.match(html.body,/Confirm import only/);const script=await app.inject('/proposal-imports.js');new Script(script.body);assert.ok(!script.body.includes('innerHTML'));assert.match(script.body,/Statement of Work/);assert.match(script.body,/Risk register/);assert.match(script.body,/Unresolved questions/);
 assert.equal(JSON.stringify(active.prepare('SELECT * FROM projects').all()),before);assert.equal(active.prepare('SELECT count(*) FROM payment_approvals').pluck().get(),0);
 }finally{await app.close();}
});

test('import insertion failure rolls back and hostile Markdown/HTML remain inert stored text',async t=>{
 const {db}=testDatabase(t);const v=validateBundle(bundle);
 db.exec("CREATE TRIGGER fail_import BEFORE INSERT ON proposal_imports BEGIN SELECT RAISE(ABORT,'injected'); END;");assert.throws(()=>importBundle(db,bundle,v.fingerprint));assert.equal(db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);db.exec('DROP TRIGGER fail_import');
 const hostile=changed(p=>p.project.name='<img src=x onerror=alert(1)>');hostile.summary={name:'summary.md',content:'<script>alert(1)</script> [unsafe](javascript:alert(1))'};
 const result=importBundle(db,hostile,validateBundle(hostile).fingerprint);const app=await buildApp(db);try{
 const download=await app.inject(`/v1/proposal-imports/${result.id}/artifacts/summary`);assert.equal(download.body,hostile.summary.content);assert.match(download.headers['content-type'] as string,/application\/octet-stream/);assert.equal(download.headers['x-content-type-options'],'nosniff');
 const script=await app.inject('/proposal-imports.js');assert.match(script.body,/textContent/);assert.ok(!script.body.includes('innerHTML'));assert.ok(!script.body.includes('eval('));
 const oversized=await app.inject({method:'POST',url:'/v1/proposal-imports/preview',headers:{host:'127.0.0.1','x-roomtreasury-import':'1'},payload:{proposal:{name:'big.json',content:'x'.repeat(262145)}}});assert.equal(oversized.statusCode,400);
 }finally{await app.close();}
});
