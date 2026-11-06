import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { buildApp } from '../src/app.js';
import { AgencyEngine } from '../src/domain/agency-engine.js';
import { FinancialEngine, type HumanActor } from '../src/domain/financial-engine.js';
import { authenticate } from '../src/security/service-auth.js';
import { createFixturePrincipal, issueFixtureCredential } from '../src/security/test-fixtures.js';
import { testDatabase } from './helpers.js';
const owner:HumanActor={kind:'human',id:'synthetic-owner',projectId:'p',role:'owner'};
test('dashboard serves safe HTML/assets and useful empty persisted project list',async t=>{
 const {db}=testDatabase(t);const app=await buildApp(db);try {
  assert.deepEqual((await app.inject('/v1/client-projects/')).json(),{projects:[]});
  const html=await app.inject('/');assert.equal(html.statusCode,200);assert.match(html.body,/Project economics/);assert.match(html.headers['content-security-policy'] as string,/script-src 'self'/);
  const script=await app.inject('/dashboard.js');assert.equal(script.statusCode,200);new Script(script.body);
  assert.match(script.body,/No client projects yet/);assert.ok(!script.body.includes('innerHTML'));
  assert.equal((await app.inject('/dashboard.css')).statusCode,200);
  assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
 }finally{await app.close();}
});
test('missing project returns 404; draft and pending proposals have no fabricated financial budget',async t=>{
 const {db}=testDatabase(t);const app=await buildApp(db);const agency=new AgencyEngine(db);try {
  assert.equal((await app.inject('/v1/client-projects/missing')).statusCode,404);
  agency.createClientProject(owner,'p','Client <script>','Brief',100000);
  let result=(await app.inject('/v1/client-projects/p')).json();assert.equal(result.client.revenue_cents,100000);assert.equal(result.delivery,null);assert.deepEqual(result.proposals,[]);
  agency.createProposal(owner,'p',{budgetCents:70000,explanation:'Manual estimate',allocations:[{name:'Development',limitCents:70000}]});
  result=(await app.inject('/v1/client-projects/p')).json();assert.equal(result.approvedDeliveryBudgetCents,null);assert.equal(result.projectedGrossMarginCents,null);assert.equal(result.proposals[0].projectedGrossMarginCents,30000);assert.equal(result.proposals[0].proposal.status,'pending');assert.deepEqual(result.receipts,[]);
 }finally{await app.close();}
});
test('approved project API derives exact balances and retrieves receipts and history without mutations',async t=>{
 const {db}=testDatabase(t);const agency=new AgencyEngine(db);const finance=new FinancialEngine(db);
 agency.createClientProject(owner,'p','Client','Landing page',100000);
 const proposal=agency.createProposal(owner,'p',{budgetCents:70000,explanation:'Manual',allocations:[{name:'Development',limitCents:70000}]});agency.approveProposal(owner,'p',proposal.proposalId);
 finance.addRecipient(owner,'p','eli','Eli');const terms={recipientId:'eli',amountCents:4000,purpose:'Captioning',currency:'USD' as const,sourceRefs:[],allocationId:proposal.allocationIds[0]!};
 finance.confirmCommitment(owner,'p',finance.proposeCommitment(owner,'p',terms));
 const req=finance.createRequest(owner,'p',{...terms,amountCents:5500});const approval=finance.approveRequest(owner,'p',req.requestId,1);
 const principal=createFixturePrincipal(db,'p','treasury_ops');const treasury=authenticate(db,issueFixtureCredential(db,principal));const receipt=finance.settle(treasury,'p',req.requestId,1,approval,'retry');
 const held=finance.createRequest(owner,'p',{...terms,amountCents:1000});finance.approveRequest(owner,'p',held.requestId,1);
 const app=await buildApp(db);try {
  const before=db.prepare('SELECT total_changes()').pluck().get();
  const response=await app.inject('/v1/client-projects/p');assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'no-store');const result=response.json();
  assert.equal(result.approvedDeliveryBudgetCents,70000);assert.equal(result.projectedGrossMarginCents,30000);
  assert.deepEqual(result.delivery,{budget:70000,committed:4000,reserved:1000,spent:5500,available:59500});assert.equal(result.allocations[0].available,59500);assert.equal(result.receipts[0].id,receipt.id);assert.equal(result.requests.length,2);assert.equal(result.approvals.length,2);assert.ok(result.history.length>0);
  assert.equal((await app.inject('/v1/client-projects/')).json().projects.length,1);
  for(const method of ['POST','PUT','PATCH','DELETE'] as const) assert.equal((await app.inject({method,url:'/v1/client-projects/p',payload:{role:'owner'}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:'/v1/client-projects/p/proposals/approve',payload:{owner:true}})).statusCode,404);
  assert.equal((await app.inject('/v1/client-projects/?role=owner')).statusCode,400);
  assert.equal(db.prepare('SELECT total_changes()').pluck().get(),before);
 }finally{await app.close();}
});
