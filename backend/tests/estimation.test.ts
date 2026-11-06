import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateEstimate, EstimateError, isVerifiedEstimate } from '../src/ai/estimate.js';
import { AgencyEngine } from '../src/domain/agency-engine.js';
import { buildApp } from '../src/app.js';
import { setupSyntheticDemo, DEMO_PROJECT_ID } from '../src/demo/setup.js';
import { testDatabase } from './helpers.js';
const intake={clientName:'Analytics client',brief:'Build a SaaS product site',revenueCents:100000};
const output={budgetCents:62000,explanation:'Delivery based on the supplied scope',assumptions:['Content supplied'],risks:['Integration complexity'],allocations:[{name:'Research',limitCents:8000},{name:'Design',limitCents:14000},{name:'Development',limitCents:30000},{name:'QA',limitCents:10000}]};
const env={OPENAI_API_KEY:'test-only-disposable-api-sentinel'};
const mock=(data:unknown=output):typeof fetch=>async()=>new Response(JSON.stringify({id:'chatcmpl-fixture',model:'gpt-4.1-mini-2025-04-14',choices:[{finish_reason:'stop',message:{content:JSON.stringify(data)}}]}),{status:200});
test('validated provider response has server-owned provenance, immutable terms and structured assumptions',async()=>{
 let called=false;
 const result=await generateEstimate(intake,{env,fetch:async(url,options)=>{called=true;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(options?.redirect,'error');const request=JSON.parse(options!.body as string);assert.equal(request.response_format.json_schema.strict,true);assert.equal(request.model,'gpt-4.1-mini');return mock()(url,options);}});
 assert.ok(called);assert.ok(isVerifiedEstimate(result));assert.equal(result.provider,'openai');assert.equal(result.model,'gpt-4.1-mini-2025-04-14');assert.deepEqual(result.assumptions,['Content supplied']);assert.ok(Object.isFrozen(result.allocations[0]));assert.equal(isVerifiedEstimate({...result}),false);
});
test('negative, fractional, excessive, unknown and duplicate workstreams or malformed model output are rejected',async()=>{
 for(const bad of [{...output,budgetCents:-1},{...output,budgetCents:1.5},{...output,budgetCents:1000001},{...output,budgetCents:60000},{...output,allocations:output.allocations.map(a=>({...a,limitCents:-1}))},{...output,allocations:output.allocations.map(a=>({...a,name:'Research'}))},{...output,allocations:[{name:'Unknown',limitCents:1}]},{...output,owner:true},{not:'an estimate'}]) {
  await assert.rejects(()=>generateEstimate(intake,{env,fetch:mock(bad)}),(e:unknown)=>e instanceof EstimateError&&e.code==='AI_INVALID_OUTPUT');
 }
 await assert.rejects(()=>generateEstimate({...intake,revenueCents:101},{env:{...env,ROOMTREASURY_MAX_PROJECT_CENTS:'100'},fetch:mock()}));
 await assert.rejects(()=>generateEstimate(intake,{env:{...env,ROOMTREASURY_MAX_DELIVERY_CENTS:'61000'},fetch:mock()}));
});
test('missing key, provider errors, refusals and timeout produce safe errors with no fallback',async()=>{
 await assert.rejects(()=>generateEstimate(intake,{env:{},fetch:mock()}),(e:unknown)=>e instanceof EstimateError&&e.code==='AI_NOT_CONFIGURED');
 await assert.rejects(()=>generateEstimate(intake,{env,fetch:async()=>new Response(env.OPENAI_API_KEY,{status:401})}),(e:unknown)=>e instanceof EstimateError&&!e.message.includes(env.OPENAI_API_KEY));
 await assert.rejects(()=>generateEstimate(intake,{env,fetch:async()=>new Response(JSON.stringify({id:'x',model:'gpt-4.1-mini',choices:[{finish_reason:'stop',message:{refusal:'No'}}]}))}));
 await assert.rejects(()=>generateEstimate(intake,{env,timeoutMs:5,fetch:async(_url,options)=>new Promise((_resolve,reject)=>{options!.signal!.addEventListener('abort',()=>reject(new Error('private provider payload')));})}),(e:unknown)=>e instanceof EstimateError&&e.code==='AI_TIMEOUT');
});
test('AI intake persists pending proposal via domains, leaves Northstar and all financial authority unchanged',async t=>{
 const {db,config}=testDatabase(t);db.close();setupSyntheticDemo(config);
 const {openDatabase}=await import('../src/db/connection.js');const opened=openDatabase(config);
 const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY=env.OPENAI_API_KEY;
 const app=await buildApp(opened,{aiFetch:mock()});try {
 const before=JSON.stringify(opened.prepare('SELECT * FROM projects').all());
 const priorHistory=JSON.stringify(opened.prepare('SELECT * FROM financial_audit_events').all());
 const response=await app.inject({method:'POST',url:'/v1/client-projects/estimate',headers:{'x-roomtreasury-intake':'1'},payload:intake});
 assert.equal(response.statusCode,201);const result=response.json();assert.equal(result.proposal.status,'pending');assert.equal(result.proposal.provenance,'ai');assert.equal(result.proposal.approved_by,null);assert.equal(result.client.revenue_cents,100000);assert.equal(result.proposal.budget_cents,62000);assert.equal(result.projectedGrossMarginCents,38000);assert.equal(result.delivery,null);assert.equal(result.client.financial_project_id,null);assert.equal(result.ai.model,'gpt-4.1-mini-2025-04-14');
 assert.equal(JSON.stringify(opened.prepare('SELECT * FROM projects').all()),before);assert.equal(JSON.stringify(opened.prepare('SELECT * FROM financial_audit_events').all()),priorHistory);assert.equal(opened.prepare('SELECT count(*) FROM payment_approvals').pluck().get(),0);assert.equal(opened.prepare('SELECT count(*) FROM service_credentials').pluck().get(),0);
 assert.equal(opened.prepare('SELECT budget_cents FROM projects WHERE id=?').pluck().get(DEMO_PROJECT_ID),70000);
 assert.throws(()=>new AgencyEngine(opened).createEstimatedProject(intake,{...output,provider:'openai',model:'forged',responseId:'forged'}));
 assert.equal((await app.inject({method:'POST',url:'/v1/client-projects/estimate',payload:intake})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/client-projects/estimate',headers:{'x-roomtreasury-intake':'1',origin:'https://unrelated.example'},payload:intake})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/v1/client-projects/estimate',headers:{'x-roomtreasury-intake':'1'},payload:{...intake,owner:true}})).statusCode,400);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;await app.close();}
});
test('provider failure over HTTP persists nothing and exposes no credential',async t=>{
 const {db}=testDatabase(t);const previous=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY=env.OPENAI_API_KEY;
 const app=await buildApp(db,{aiFetch:async()=>{throw new Error(env.OPENAI_API_KEY);}});try {
 const response=await app.inject({method:'POST',url:'/v1/client-projects/estimate',headers:{'x-roomtreasury-intake':'1'},payload:intake});assert.equal(response.statusCode,502);assert.ok(!response.body.includes(env.OPENAI_API_KEY));assert.equal(db.prepare('SELECT count(*) FROM client_projects').pluck().get(),0);
 }finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;await app.close();}
});
