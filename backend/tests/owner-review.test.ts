import assert from 'node:assert/strict';
import {test,type TestContext} from 'node:test';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {Worker} from 'node:worker_threads';
import {OwnerReview,gates,type Gate} from '../src/reviews/service.js';
import {validateBundle,importBundle} from '../src/imports/service.js';
import {type HumanActor} from '../src/domain/financial-engine.js';
import {testDatabase} from './helpers.js';
import {openDatabase} from '../src/db/connection.js';
import {buildApp} from '../src/app.js';
import {roles} from '../src/security/service-auth.js';
const original=readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json','utf8');
function fixture(t:TestContext,synthetic=true){
 const data=testDatabase(t);const payload=JSON.parse(synthetic?original.replaceAll('RT-APEX-001','SYNTHETIC-REVIEW-001'):original);if(synthetic)payload.client.name='Explicitly synthetic review test';
 const bundle={proposal:{name:'proposal.json',content:JSON.stringify(payload)}};const validated=validateBundle(bundle);const imported=importBundle(data.db,bundle,validated.fingerprint);const review=new OwnerReview(data.db);const owner:HumanActor={kind:'human',id:'synthetic-test-owner',role:'owner',projectId:payload.taskId};return {...data,payload,importId:imported.id,review,owner};
}
function revised(data:ReturnType<typeof fixture>,revenue=200000){
 const p=structuredClone(data.payload);p.project.agreedRevenueCents=revenue;p.financialSummary.agreedRevenueCents=revenue;p.financialSummary.projectedGrossMarginCents=revenue-p.proposal.budgetCents;p.financialSummary.projectedGrossMarginPercent=100*p.financialSummary.projectedGrossMarginCents/revenue;
 for(const scenario of p.financialSummary.scenarios)scenario.projectedGrossMarginCents=revenue-scenario.totalCostCents;
 p.status='READY_FOR_OWNER_REVIEW';p.blockingReviews=[];p.ownerDecisionRecommendation.recommendation='SEEK_OWNER_REVIEW';
 const current=data.review.snapshot(data.importId).revision;data.review.revise(data.owner,data.importId,current.id,current.fingerprint,p,'Synthetic test: confirmed scope and revised client terms; original agent analysis retained.');return data.review.snapshot(data.importId).revision;
}
function verify(data:ReturnType<typeof fixture>,skip?:Gate,acceptLowMargin=false){
 const r=data.review.snapshot(data.importId).revision;
 for(const gate of Object.keys(gates) as Gate[]){if(gate===skip)continue;
 const note=data.review.recordNote(data.importId,r.id,r.fingerprint,gate,'Synthetic fixture fact explicitly confirmed for test only','synthetic:test-evidence',data.owner);
 data.review.verifyGate(data.owner,data.importId,r.id,r.fingerprint,note,gates[gate],{rateCentsPerHour:2500,capacityHours:60,paymentTerms:'Synthetic agreed invoice terms, not cash received',policyLimitCents:200000,acceptLowMargin,reason:'Synthetic explicit financial review and risk acceptance for this revision.'});
 }
 return data.review.snapshot(data.importId);
}
test('original Apex stays blocked; typed answers never verify scope, rates, capacity or margin',t=>{
 const data=fixture(t,false);const r=data.review.snapshot(data.importId).revision;
 assert.equal(r.proposal.status,'NEEDS_CLIENT_CLARIFICATION');assert.equal(data.review.snapshot(data.importId).projectedGrossMarginCents,9000);
 data.review.recordNote(data.importId,r.id,r.fingerprint,'scope','An answer was typed','Human provided reference');
 const state=data.review.snapshot(data.importId);assert.equal(state.verifications.length,0);assert.equal((state.notes[0] as any).source,'unverified_human_note');assert.ok(state.blockers.some(b=>b.includes('internal_rates')));assert.ok(state.blockers.some(b=>b.includes('low or negative')));
 assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),0);assert.equal(JSON.parse((data.db.prepare('SELECT proposal_json FROM proposal_imports').pluck().get() as string)).status,'NEEDS_CLIENT_CLARIFICATION');
});
test('synthetic revision requires fresh client and financial verifications, then creates exactly one financial project idempotently',t=>{
 const data=fixture(t);const root=data.review.snapshot(data.importId).revision;
 verify(data,undefined,true);const r=revised(data);assert.equal(data.review.snapshot(data.importId).verifications.length,0);
 assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 verify(data,'capacity');assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 const note=data.review.recordNote(data.importId,r.id,r.fingerprint,'capacity','60 assigned synthetic hours','synthetic:staffing',data.owner);data.review.verifyGate(data.owner,data.importId,r.id,r.fingerprint,note,'owner_verified_internal',{capacityHours:60});
 const decision=data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY') as any;
 assert.deepEqual(data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'),decision);
 assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT budget_cents FROM projects').pluck().get(),141000);assert.equal(data.db.prepare('SELECT revenue_cents FROM client_projects').pluck().get(),200000);assert.equal(data.db.prepare('SELECT count(*) FROM workstream_allocations').pluck().get(),4);
 assert.throws(()=>data.review.decide(data.owner,data.importId,root.id,root.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 assert.equal(data.review.snapshot(data.importId).history[0]!.payload,root.payload);assert.equal(data.review.snapshot(data.importId).history[1]!.parent_id,root.id);
 for(const table of ['commitments','reservations','ledger_entries','payment_requests'])assert.equal(data.db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
 assert.throws(()=>data.db.exec("UPDATE owner_review_decisions SET owner_id='changed'"));
});
test('low and negative margins require explicit financial exception, not an ordinary note',t=>{
 for(const revenue of [150000,120000]){
 const data=fixture(t);const r=revised(data,revenue);verify(data,'margin_review');const note=data.review.recordNote(data.importId,r.id,r.fingerprint,'margin_review','Low margin assessed','synthetic:risk-review',data.owner);
 assert.throws(()=>data.review.verifyGate(data.owner,data.importId,r.id,r.fingerprint,note,'owner_verified_internal',{reason:'Risk assessed'}));
 assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 data.review.verifyGate(data.owner,data.importId,r.id,r.fingerprint,note,'owner_verified_internal',{reason:'Explicit synthetic risk exception',acceptLowMargin:true});assert.equal(data.review.snapshot(data.importId).blockers.length,0);
 }
});
test('invalid allocations/rates/capacity/policy and source classifications are rejected',t=>{
 const data=fixture(t);const root=data.review.snapshot(data.importId).revision;const p=structuredClone(data.payload);p.proposal.allocations[0].limitCents++;
 assert.throws(()=>data.review.revise(data.owner,data.importId,root.id,root.fingerprint,p,'Invalid sum'));
 const r=revised(data);
 for(const [gate,facts,origin] of [['internal_rates',{rateCentsPerHour:100},'owner_verified_internal'],['capacity',{capacityHours:1},'owner_verified_internal'],['financial_policy',{policyLimitCents:1},'owner_verified_internal'],['scope',{},'owner_verified_internal']] as const){
 const note=data.review.recordNote(data.importId,r.id,r.fingerprint,gate,'Synthetic answer','synthetic:reference',data.owner);assert.throws(()=>data.review.verifyGate(data.owner,data.importId,r.id,r.fingerprint,note,origin,facts));}
});
test('service actors and requester contexts cannot verify, revise or approve; HTTP has no owner-success endpoint',async t=>{
 const data=fixture(t);const r=revised(data);verify(data);
 for(const role of roles){const actor={kind:'service' as const,principalId:role,credentialId:'none'};assert.throws(()=>data.review.decide(actor,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));assert.throws(()=>data.review.revise(actor,data.importId,r.id,r.fingerprint,data.payload,'Forged'));}
 assert.throws(()=>data.review.decide({...data.owner,role:'requester'},data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 const app=await buildApp(data.db);try{
 assert.equal((await app.inject('/v1/proposal-imports/'+data.importId+'/review')).statusCode,401);
 const note=await app.inject({method:'POST',url:'/v1/proposal-imports/'+data.importId+'/review/notes',headers:{host:'127.0.0.1','x-roomtreasury-review':'1'},payload:{revisionId:r.id,fingerprint:r.fingerprint,gate:'scope',answer:'Typed browser answer',reference:'Unverified reference'}});assert.equal(note.statusCode,401);
 for(const action of ['approve','verify','revisions'])assert.notEqual((await app.inject({method:'POST',url:'/v1/proposal-imports/'+data.importId+'/review/'+action,payload:{owner:true}})).statusCode,200);
 const script=await app.inject('/owner-review.js');new Script(script.body);assert.match(script.body,/Sign in as owner/);
 }finally{await app.close();}
});
test('approval failure rolls back financial creation and decision; review survives database reopen',t=>{
 const data=fixture(t);const r=revised(data);verify(data);
 data.db.exec("CREATE TRIGGER fail_decision BEFORE INSERT ON owner_review_decisions BEGIN SELECT RAISE(ABORT,'injected'); END;");assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),0);assert.equal(data.db.prepare('SELECT count(*) FROM client_projects').pluck().get(),0);data.db.exec('DROP TRIGGER fail_decision');
 data.db.close();const reopened=openDatabase(data.config);try{const review=new OwnerReview(reopened);assert.equal(review.snapshot(data.importId).verifications.length,9);review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY');assert.equal(reopened.prepare('SELECT count(*) FROM projects').pluck().get(),1);}finally{reopened.close();}
});
test('deferral remains in history while a fresh revision can be clarified and reviewed',t=>{
 const data=fixture(t);const root=data.review.snapshot(data.importId).revision;data.review.decide(data.owner,data.importId,root.id,root.fingerprint,'DEFERRED');const r=revised(data);assert.equal(r.revision,1);assert.equal(data.review.snapshot(data.importId).decision,null);assert.equal(data.db.prepare('SELECT decision FROM owner_review_decisions').pluck().get(),'DEFERRED');
});
test('concurrent trusted approvals serialize and return one immutable decision and financial project',async t=>{
 const data=fixture(t);const r=revised(data);verify(data);
 const workers=await Promise.all([1,2].map(async()=>{const worker=new Worker(new URL('./review-worker.js',import.meta.url),{workerData:{config:data.config,actor:data.owner,importId:data.importId,revisionId:r.id,fingerprint:r.fingerprint}});const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));await new Promise<void>((resolve,reject)=>{worker.once('message',()=>resolve());worker.once('error',reject);});const result=new Promise<any>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});return {worker,result,exit};}));
 for(const w of workers)w.worker.postMessage('go');const results=await Promise.all(workers.map(w=>w.result));await Promise.all(workers.map(w=>w.exit));assert.ok(results.every(r=>r.ok));assert.equal(results[0].id,results[1].id);assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(data.db.prepare('SELECT count(*) FROM owner_review_decisions').pluck().get(),1);
});

test('new unverified evidence blocks an otherwise eligible revision, and a newer import invalidates old review',t=>{
 const data=fixture(t);const r=revised(data);verify(data);assert.equal(data.review.snapshot(data.importId).blockers.length,0);
 data.review.recordNote(data.importId,r.id,r.fingerprint,'scope','New contradictory client question','unverified:new-message');assert.ok(data.review.snapshot(data.importId).blockers.some(b=>b.includes('New unverified note')));assert.throws(()=>data.review.decide(data.owner,data.importId,r.id,r.fingerprint,'APPROVED_SYNTHETIC_DELIVERY'));
 const changed=structuredClone(data.payload);changed.proposal.explanation+=' New agent revision.';const bundle={proposal:{name:'new.json',content:JSON.stringify(changed)}};importBundle(data.db,bundle,validateBundle(bundle).fingerprint);
 assert.throws(()=>data.review.recordNote(data.importId,r.id,r.fingerprint,'scope','Late answer','late:ref'));assert.equal(data.db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});
