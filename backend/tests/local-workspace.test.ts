import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {applyMigrations} from '../src/db/migrations.js';
import {buildApp} from '../src/app.js';
import {gateChecks} from '../src/approvals/policy.js';

test('local demo creates, approves intake and queues Discord without cookies or a login endpoint',async t=>{
 const db=new Database(':memory:');
 db.pragma('foreign_keys=ON');
 applyMigrations(db,'demo');
 const app=await buildApp(db,{localWorkspace:true});
 t.after(()=>app.close());
 const host={host:'127.0.0.1:3000'};
 const page=await app.inject({url:'/',headers:host});
 assert.equal(page.statusCode,200);
 assert.equal(page.headers['set-cookie'],undefined);
 assert.match(page.body,/data-local-workspace/);
 for(const url of ['/owner-login','/v1/owner-auth/session']){
  assert.equal((await app.inject({url,headers:host})).statusCode,404);
 }
 const input={clientName:'Synthetic local client',brief:'Synthetic no-login workflow',revenueCents:200000};
 const onboard=(headers:Record<string,string>)=>app.inject({
  method:'POST',url:'/v1/client-projects/onboard',headers:{...host,'idempotency-key':'local-onboarding',...headers},payload:input
 });
 assert.equal((await onboard({origin:'https://example.com'})).statusCode,403);
 const created=await onboard({origin:'http://127.0.0.1:3000'});
 assert.equal(created.statusCode,201,created.body);
 const id=created.json().binding.client_project_id;
 const project='/v1/client-projects/'+id;
 assert.equal((await app.inject({url:project,headers:host})).json().workspace.taskId,created.json().binding.task_id);
 const queue=()=>app.inject({method:'POST',url:project+'/processing-jobs',headers:{...host,'idempotency-key':'local-dispatch'},payload:{transport:'discord'}});
 assert.equal((await queue()).json().error.code,'INTAKE_AUTHORIZATION_REQUIRED');
 const workflow=project+'/approval-workflow';
 const gate=(await app.inject({url:workflow,headers:host})).json().gates[0];
 const approved=await app.inject({method:'POST',url:workflow+'/decisions',headers:{...host,'idempotency-key':'local-intake'},payload:{
  gate:'intake',subjectHash:gate.subjectHash,decision:'approve',reason:'Synthetic explicit authorization',
  checks:gateChecks.intake,evidence:['synthetic:local']
 }});
 assert.equal(approved.statusCode,200,approved.body);
 const job=await queue();
 assert.equal(job.statusCode,201,job.body);
 assert.equal(job.json().job.state,'queued');
 assert.equal(db.prepare('SELECT actor_kind FROM binding_audit_events').pluck().get(),'local_operator');
 assert.equal(db.prepare('SELECT count(*) FROM human_sessions WHERE expires_at>?').pluck().get(Date.now()),0);
 assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});
