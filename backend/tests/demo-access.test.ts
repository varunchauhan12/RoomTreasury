import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {applyMigrations} from '../src/db/migrations.js';
import {buildApp} from '../src/app.js';
import {openDemoAccess} from '../src/security/demo-access.js';
const host={host:'127.0.0.1:3000'};

test('local demo opens without a password, reuses a shared owner, and preserves sessions and CSRF',async t=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');applyMigrations(db,'demo');
 const app=await buildApp(db);t.after(()=>app.close());
 const page=await app.inject({url:'/',headers:host});assert.equal(page.statusCode,200);assert.match(page.body,/LOCAL DEMO/);
 const cookie=String(page.headers['set-cookie']).split(';')[0]!;assert.match(cookie,/^rt_demo_owner=/);
 const result=await app.inject({url:'/v1/owner-auth/session',headers:{...host,cookie}});assert.equal(result.statusCode,200);assert.equal(result.json().demoAccess,true);
 const body={clientName:'Synthetic open demo client',brief:'Synthetic access test only',revenueCents:100000};
 assert.equal((await app.inject({method:'POST',url:'/v1/client-projects/onboard',headers:{...host,cookie,origin:'http://127.0.0.1:3000','idempotency-key':'blocked'},payload:body})).statusCode,403);
 const created=await app.inject({method:'POST',url:'/v1/client-projects/onboard',headers:{...host,cookie,origin:'http://127.0.0.1:3000','x-csrf-token':result.json().csrfToken,'idempotency-key':'created'},payload:body});assert.equal(created.statusCode,201);
 const again=await app.inject({url:'/',headers:{...host,cookie}});assert.equal(again.headers['set-cookie'],undefined);
 const visitor=await app.inject({url:'/',headers:host});assert.ok(visitor.headers['set-cookie']);assert.equal(db.prepare('SELECT count(*) FROM human_owners').pluck().get(),1);
 assert.equal((await app.inject({url:'/v1/owner-auth/session',headers:{...host,cookie}})).statusCode,200);
 const account=await app.inject({url:'/owner-login',headers:{...host,cookie}});assert.equal(account.statusCode,302);assert.equal(account.headers.location,'/');
 assert.equal(db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),0);
 assert.equal(db.prepare('SELECT count(*) FROM service_credentials').pluck().get(),0);
});

test('demo access rejects hostile origins, hosts and remote clients and never activates for test/real storage',async t=>{
 const db=new Database(':memory:');db.pragma('foreign_keys=ON');applyMigrations(db,'demo');const app=await buildApp(db);t.after(()=>app.close());
 for(const request of [{url:'/',headers:{host:'attacker.example'}},{url:'/',headers:{...host,'sec-fetch-site':'cross-site'}},{url:'/',headers:host,remoteAddress:'192.0.2.10'}])assert.equal((await app.inject(request)).headers['set-cookie'],undefined);
 const alias=await app.inject({url:'/',headers:{host:'localhost:3000'}});assert.equal(alias.statusCode,302);assert.equal(alias.headers.location,'http://127.0.0.1:3000/');
 assert.equal(db.prepare('SELECT count(*) FROM human_owners').pluck().get(),0);
 for(const mode of ['test','real'] as const){const other=new Database(':memory:');applyMigrations(other,mode);assert.equal(openDemoAccess(other),false);other.close();}
 const previous=process.env.NODE_ENV;try{process.env.NODE_ENV='production';assert.equal(openDemoAccess(db),false);}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
