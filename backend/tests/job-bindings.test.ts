import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {test,type TestContext} from 'node:test';
import {testDatabase} from './helpers.js';
import {loginOwner,provisionOwner} from '../src/security/owner-auth.js';
import {AgencyEngine} from '../src/domain/agency-engine.js';
import {bindingAuthorized,onboardProject,provisionLegacyBinding} from '../src/jobs/bindings.js';

const intake={clientName:'Synthetic jobs client',brief:'Synthetic landing page brief',revenueCents:100000};
async function fixture(t:TestContext){
 const data=testDatabase(t);const ownerId=await provisionOwner(data.db,'bound-owner','Synthetic disposable owner password','LEGACY-TASK');
 const {session}=await loginOwner(data.db,'bound-owner','Synthetic disposable owner password','local-test');
 return {...data,ownerId,session};
}
test('onboarding atomically creates server-owned project/task/scope binding and audit; retries preserve identity',async t=>{
 const {db,session,ownerId}=await fixture(t);const first=onboardProject(db,session,intake,'onboarding');
 assert.equal(first.owner_id,ownerId);assert.notEqual(first.client_project_id,first.task_id);
 assert.deepEqual(onboardProject(db,session,intake,'onboarding'),first);
 assert.equal(db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);
 assert.equal(db.prepare('SELECT count(*) FROM project_task_bindings').pluck().get(),1);
 assert.equal(db.prepare('SELECT count(*) FROM binding_audit_events').pluck().get(),1);
 assert.ok(db.prepare('SELECT 1 FROM human_owner_scopes WHERE owner_id=? AND task_id=? AND revoked_at IS NULL').get(ownerId,first.task_id));
 assert.throws(()=>onboardProject(db,session,{...intake,revenueCents:200000},'onboarding'));
 for(const table of ['projects','delivery_proposals','proposal_imports'])assert.equal(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
 assert.throws(()=>db.prepare('UPDATE project_task_bindings SET task_id=?').run('other'));
 assert.throws(()=>db.exec('DELETE FROM binding_audit_events'));
});
test('onboarding failure rolls back project, scope, binding and audit together',async t=>{
 const {db,session}=await fixture(t);
 db.exec("CREATE TRIGGER fail_binding_audit BEFORE INSERT ON binding_audit_events BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
 assert.throws(()=>onboardProject(db,session,intake,'rollback'));
 for(const table of ['client_projects','project_task_bindings','binding_audit_events'])assert.equal(db.prepare(`SELECT count(*) FROM ${table}`).pluck().get(),0);
 assert.equal(db.prepare('SELECT count(*) FROM human_owner_scopes').pluck().get(),1);
});
test('task scope alone cannot confer another owner binding; revocation, disable and invalid session fail closed',async t=>{
 const {db,session,ownerId}=await fixture(t);const bound=onboardProject(db,session,intake,'bound');
 const other=await provisionOwner(db,'other-owner','Another synthetic owner password',bound.task_id);
 assert.throws(()=>bindingAuthorized(db,other,bound.id));
 assert.throws(()=>onboardProject(db,{...session,ownerId:other},intake,'forged'));
 db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),ownerId,bound.task_id);
 assert.throws(()=>bindingAuthorized(db,ownerId,bound.id));
 db.prepare('UPDATE human_owners SET disabled_at=? WHERE id=?').run(Date.now(),ownerId);
 assert.throws(()=>onboardProject(db,session,intake,'disabled'));
});
test('legacy projects remain unowned until explicit operator verification; provisioning is idempotent and cannot rebind task/project/owner',async t=>{
 const {db,session,ownerId}=await fixture(t);const agency=new AgencyEngine(db);
 for(const id of ['legacy-a','legacy-b'])agency.createClientProject({kind:'human',role:'owner',id:ownerId,projectId:id},id,intake.clientName,intake.brief,intake.revenueCents);
 assert.equal(db.prepare('SELECT count(*) FROM project_task_bindings').pluck().get(),0);
 assert.throws(()=>bindingAuthorized(db,ownerId,'legacy-a'));
 const first=provisionLegacyBinding(db,'legacy-a','LEGACY-TASK','bound-owner','local-os:fixture','verified:ticket-001');
 assert.deepEqual(provisionLegacyBinding(db,'legacy-a','LEGACY-TASK','bound-owner','local-os:fixture','verified:ticket-001'),first);
 assert.throws(()=>provisionLegacyBinding(db,'legacy-b','LEGACY-TASK','bound-owner','local-os:fixture','verified:ticket-001'));
 assert.throws(()=>provisionLegacyBinding(db,'legacy-a','UNGRANTED','bound-owner','local-os:fixture','verified:ticket-001'));
 await provisionOwner(db,'other-owner','Another synthetic owner password','LEGACY-TASK');
 assert.throws(()=>provisionLegacyBinding(db,'legacy-a','LEGACY-TASK','other-owner','local-os:fixture','verified:ticket-001'));
 assert.equal(db.prepare('SELECT count(*) FROM binding_audit_events').pluck().get(),1);
 assert.equal(db.prepare('SELECT actor_kind FROM binding_audit_events').pluck().get(),'local_operator');
 assert.throws(()=>onboardProject(db,session,intake,first.idempotency_key));
});
test('legacy admin refuses non-interactive execution before opening a database',()=>{
 const result=spawnSync(process.execPath,[resolve('.test-build/src/jobs/binding-admin.js'),'bind','project','task','owner','verified:fixture','CONFIRM_VERIFIED_RELATIONSHIP'],{env:{},encoding:'utf8'});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,/interactive trusted terminal/);
});

test('migration 9 upgrades populated version-8 storage without claiming legacy projects or changing historical migrations',async t=>{
 const {migrations,applyMigrations}=await import('../src/db/migrations.js');
 const {default:Database}=await import('better-sqlite3');
 const db=new Database(':memory:');
 try{
  db.pragma('foreign_keys=ON');applyMigrations(db,'test',migrations.slice(0,8));
  const ownerId=await provisionOwner(db,'legacy-fixture','Synthetic migration owner password','LEGACY');
  new AgencyEngine(db).createClientProject({kind:'human',role:'owner',id:ownerId,projectId:'legacy-project'},'legacy-project','Synthetic legacy','Untouched legacy brief',100000);
  const before=db.prepare('SELECT * FROM schema_migrations').all();const project=db.prepare('SELECT * FROM client_projects').get();
  applyMigrations(db,'test');applyMigrations(db,'test');
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version<=8').all(),before);
  assert.deepEqual(db.prepare('SELECT * FROM client_projects').get(),project);
  assert.equal(db.prepare('SELECT count(*) FROM project_task_bindings').pluck().get(),0);
  assert.equal(db.prepare('SELECT count(*) FROM processing_jobs').pluck().get(),0);
  assert.equal(db.prepare('SELECT count(*) FROM schema_migrations').pluck().get(),11);
 }finally{db.close();}
});
