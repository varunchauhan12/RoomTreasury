import {createHash,randomUUID,randomBytes} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {OwnerSession} from './owner-auth.js';
import {AuthError} from './service-auth.js';

const contexts=new WeakMap<OwnerSession,Database>();
const loopbackHost=/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
export const isLocalAuditContext=(db:Database,actor:OwnerSession)=>contexts.get(actor)===db;

export function registerLocalWorkspace(app:FastifyInstance,db:Database){
 const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
 if(modes.length!==1||modes[0]!=='demo'||process.env.NODE_ENV==='production')throw Error('Local workspace requires non-production demo storage.');
 app.addHook('onRequest',async request=>{
  const host=request.headers.host??'';
  const origin=request.headers.origin;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.ip)||!loopbackHost.test(host)||
    request.headers['sec-fetch-site']==='cross-site'||(origin&&origin!=='http://'+host)){
   throw new AuthError(403,'LOCAL_WORKSPACE_ONLY');
  }
 });
 app.addHook('onSend',async(_request,reply,payload)=>{
  if(typeof payload!=='string'||!String(reply.getHeader('content-type')).startsWith('text/html'))return payload;
  return payload.replace('</body>','<div class="rt-demo-access-banner" data-local-workspace role="note">LOCAL DEMO · Shared workspace · Actions do not verify human identity.</div></body>');
 });
}

export function localAuditContext(db:Database,request:FastifyRequest,projectOwnerId?:string):OwnerSession{
 const params=(request.params??{}) as {projectId?:string;id?:string};
 const route=request.routeOptions.url??'';
 let ownerId=projectOwnerId;
 if(!ownerId&&params.projectId){
  ownerId=db.prepare('SELECT owner_id FROM project_task_bindings WHERE client_project_id=?').pluck().get(params.projectId) as string|undefined;
 }
 if(!ownerId&&params.id&&route.startsWith('/v1/processing-jobs/')){
  ownerId=db.prepare('SELECT submitting_owner_id FROM processing_jobs WHERE id=?').pluck().get(params.id) as string|undefined;
 }
 if(!ownerId&&params.id&&route.startsWith('/v1/proposal-imports/')){
  ownerId=db.prepare(`SELECT coalesce(b.owner_id,s.owner_id)
   FROM proposal_imports p LEFT JOIN project_import_links l ON l.import_id=p.id
   LEFT JOIN project_task_bindings b ON b.id=l.binding_id
   LEFT JOIN human_owner_scopes s ON s.task_id=p.task_id AND s.revoked_at IS NULL
   WHERE p.id=? ORDER BY s.owner_id LIMIT 1`).pluck().get(params.id) as string|undefined;
 }
 return db.transaction(()=>{
  if(!ownerId){
   ownerId=db.prepare("SELECT id FROM human_owners WHERE username='owner' AND disabled_at IS NULL").pluck().get() as string|undefined;
   if(!ownerId){
    ownerId=db.prepare("SELECT id FROM human_owners WHERE username='local-workspace'").pluck().get() as string|undefined;
    if(!ownerId){
     ownerId=randomUUID();
     db.prepare('INSERT INTO human_owners VALUES (?,?,?,?,?,NULL)').run(ownerId,'local-workspace',randomBytes(16),randomBytes(64),Date.now());
    }
   }
  }
  // Existing audit/import foreign keys reference this table. The row has no
  // token, cannot authenticate a browser and is already expired.
  const digest=createHash('sha256').update('RoomTreasury/local-audit/v1\0'+ownerId).digest('hex');
  if(!db.prepare('SELECT 1 FROM human_sessions WHERE digest=?').get(digest)){
   db.prepare('INSERT INTO human_sessions VALUES (?,?,0,1,0,NULL)').run(digest,ownerId);
  }
  const actor=Object.freeze({ownerId,digest,csrf:'',createdAt:Date.now()});
  contexts.set(actor,db);
  return actor;
 }).immediate();
}
