import {isLocalAuditContext} from '../security/local-workspace.js';
import {createHash,randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import {AgencyEngine} from '../domain/agency-engine.js';
import type {OwnerSession} from '../security/owner-auth.js';
import {AuthError} from '../security/service-auth.js';

export interface Binding {id:string;client_project_id:string;task_id:string;owner_id:string;source:string;idempotency_key:string;request_hash:string;created_at:number}
export interface ProjectIntake {clientName:string;brief:string;revenueCents:number}
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function key(value:string):void {if(!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new AuthError(400,'INVALID_IDEMPOTENCY_KEY');}
export function mockMode(db:Database):void {
 const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
 if(modes.length!==1||!['test','demo'].includes(modes[0] as string)||process.env.NODE_ENV==='production')throw new AuthError(403,'MOCK_MODE_DISABLED');
}
export function activeSession(db:Database,session:OwnerSession):void {
 if(isLocalAuditContext(db,session))return;
 const now=Date.now();
 if(!db.prepare(`SELECT 1 FROM human_sessions s JOIN human_owners o ON o.id=s.owner_id
 WHERE s.digest=? AND s.owner_id=? AND s.revoked_at IS NULL AND o.disabled_at IS NULL AND s.expires_at>? AND s.last_seen>?`).get(session.digest,session.ownerId,now,now-900000))throw new AuthError(401,'OWNER_LOGIN_REQUIRED');
}
export function bindingAuthorized(db:Database,ownerId:string,bindingId:string):Binding {
 const binding=db.prepare(`SELECT b.* FROM project_task_bindings b JOIN client_projects c ON c.id=b.client_project_id
 JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id JOIN human_owners o ON o.id=b.owner_id
 WHERE b.id=? AND b.owner_id=? AND s.revoked_at IS NULL AND o.disabled_at IS NULL`).get(bindingId,ownerId) as Binding|undefined;
 if(!binding)throw new AuthError(403,'BOUND_OWNER_SCOPE_REQUIRED');return binding;
}
export function onboardProject(db:Database,session:OwnerSession,intake:ProjectIntake,idempotencyKey:string):Binding {
 return db.transaction(()=>{
  const real=db.prepare("SELECT 1 FROM schema_migrations WHERE version=1 AND mode='real'").get();
  if(!real)mockMode(db);
  activeSession(db,session);key(idempotencyKey);
  const requestHash=hash(JSON.stringify({clientName:intake.clientName,brief:intake.brief,revenueCents:intake.revenueCents}));
  const previous=db.prepare('SELECT * FROM project_task_bindings WHERE owner_id=? AND idempotency_key=?').get(session.ownerId,idempotencyKey) as Binding|undefined;
  if(previous){if(previous.source!=='owner_onboarding'||previous.request_hash!==requestHash)throw new AuthError(409,'IDEMPOTENCY_CONFLICT');return bindingAuthorized(db,session.ownerId,previous.id);}
  const projectId=randomUUID(),taskId='rt-task-'+randomUUID(),id=randomUUID(),now=Date.now();
  if(real){
   if(!intake.clientName.trim()||!intake.brief.trim()||intake.clientName.length>300||intake.brief.length>4000||
     !Number.isSafeInteger(intake.revenueCents)||intake.revenueCents<1||intake.revenueCents>1_000_000_000)throw new AuthError(400,'INVALID_PROJECT_INTAKE');
   db.prepare("INSERT INTO client_projects VALUES (?,?,?,?,'USD','draft',NULL)").run(projectId,intake.clientName,intake.brief,intake.revenueCents);
  }else new AgencyEngine(db).createClientProject(Object.freeze({kind:'human',role:'owner',id:session.ownerId,projectId}),projectId,intake.clientName,intake.brief,intake.revenueCents);
  db.prepare('INSERT INTO human_owner_scopes VALUES (?,?,?,NULL)').run(session.ownerId,taskId,now);
  db.prepare("INSERT INTO project_task_bindings VALUES (?,?,?,?,'owner_onboarding',?,?,?)").run(id,projectId,taskId,session.ownerId,idempotencyKey,requestHash,now);
  const local=isLocalAuditContext(db,session);
  db.prepare('INSERT INTO binding_audit_events(binding_id,actor_kind,actor_id,session_digest,verification_ref,occurred_at) VALUES (?,?,?,?,?,?)')
    .run(id,local?'local_operator':'owner_session',session.ownerId,local?null:session.digest,local?'local-workspace':null,now);
  return bindingAuthorized(db,session.ownerId,id);
 }).immediate();
}
// Internal operator boundary, imported only by the local admin CLI and tests, never by HTTP routes.
// Like owner:admin, authorization comes from trusted host/database access, not an actor flag.
export function provisionLegacyBinding(db:Database,projectId:string,taskId:string,username:string,operator:string,verificationRef:string):Binding {
 return db.transaction(()=>{
  mockMode(db);
  if(!operator.trim()||!/^[-A-Za-z0-9_:./]{1,200}$/.test(verificationRef))throw new AuthError(400,'VERIFICATION_REFERENCE_REQUIRED');
  const owner=db.prepare('SELECT id FROM human_owners WHERE username=? AND disabled_at IS NULL').get(username) as {id:string}|undefined;
  if(!owner||!db.prepare('SELECT 1 FROM human_owner_scopes WHERE owner_id=? AND task_id=? AND revoked_at IS NULL').get(owner.id,taskId))throw new AuthError(403,'OWNER_SCOPE_REQUIRED');
  if(!db.prepare('SELECT 1 FROM client_projects WHERE id=?').get(projectId))throw new AuthError(404,'PROJECT_NOT_FOUND');
  const previous=db.prepare('SELECT * FROM project_task_bindings WHERE client_project_id=? OR task_id=?').all(projectId,taskId) as Binding[];
  if(previous.length){const binding=previous[0]!;if(previous.length!==1||binding.client_project_id!==projectId||binding.task_id!==taskId||binding.owner_id!==owner.id)throw new AuthError(409,'BINDING_CONFLICT');return binding;}
  const id=randomUUID(),now=Date.now();
  db.prepare("INSERT INTO project_task_bindings VALUES (?,?,?,?,'operator_legacy',?,?,?)").run(id,projectId,taskId,owner.id,'legacy-'+id,hash(JSON.stringify({projectId,taskId,ownerId:owner.id})),now);
  db.prepare("INSERT INTO binding_audit_events(binding_id,actor_kind,actor_id,session_digest,verification_ref,occurred_at) VALUES (?,'local_operator',?,NULL,?,?)").run(id,operator,verificationRef,now);
  return bindingAuthorized(db,owner.id,id);
 }).immediate();
}
