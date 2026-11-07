import {ApprovalWorkflow} from '../approvals/service.js';
import {authenticationBlockers} from './auth-policy.js';
import {projectImportLink} from '../imports/project-linked.js';
import {bindingAuthorized} from '../jobs/bindings.js';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from 'better-sqlite3';
import {gates,OwnerReview,type Gate} from './service.js';
import {ImportError} from '../imports/service.js';
import {errorSchema} from '../api/errors.js';
import {ownerSession,authorizeOwner,type AuthSettings,type OwnerSession} from '../security/owner-auth.js';
import {AuthError} from '../security/service-auth.js';

export function registerReview(app:FastifyInstance,db:Database,settings:AuthSettings){
 const response={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,409:errorSchema,500:errorSchema};
 const params={type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',minLength:1,maxLength:100}}};
 const binding={revisionId:{type:'string',minLength:1,maxLength:100},fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'}};
 const string={type:'string',minLength:1,maxLength:8000};
 function actor(request:FastifyRequest,id:string,mutation:boolean){const session=ownerSession(db,request,settings,mutation);const taskId=settings.localWorkspace?(db.prepare('SELECT task_id FROM proposal_imports WHERE id=?').pluck().get(id) as string|undefined):authorizeOwner(db,session,id);if(!taskId)throw new AuthError(404,'NOT_FOUND');const link=projectImportLink(db,id);if(link)bindingAuthorized(db,session.ownerId,link.binding_id);return {session,actor:Object.freeze({kind:'human' as const,id:session.ownerId,role:'owner' as const,projectId:taskId})};}
 function state(id:string){const snapshot=new OwnerReview(db).snapshot(id);const authentication=authenticationBlockers(db,id);return {...snapshot,blockers:[...snapshot.blockers,...authentication],status:snapshot.decision?snapshot.status:snapshot.blockers.length||authentication.length?'BLOCKED':'ELIGIBLE_FOR_AUTHENTICATED_OWNER_APPROVAL',ownerHttpApprovalAvailable:!projectImportLink(db,id),authBasis:settings.localWorkspace?'local_workspace':'authenticated_owner_session',authenticationBlockers:authentication};}
 function audit(session:OwnerSession,id:string,revisionId:string,fingerprint:string,action:string,target:string,gate:string|null=null){db.prepare("INSERT INTO authenticated_review_events(owner_id,session_digest,import_id,revision_id,fingerprint,action,target_id,gate,occurred_at,auth_basis) VALUES (?,?,?,?,?,?,?,?,?,'authenticated_owner_session')").run(session.ownerId,session.digest,id,revisionId,fingerprint,action,target,gate,Date.now());}
 app.get<{Params:{id:string}}>('/v1/proposal-imports/:id/review',{schema:{operationId:'getOwnerReview',params,response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');
  const id=request.params.id;
  actor(request,id,false);
  return db.transaction(()=>{
   const review=state(id);
   const reviewActivity=db.prepare(`
    SELECT a.id,a.owner_id,a.occurred_at,a.action,a.target_id,r.revision,d.decision
    FROM authenticated_review_events a
    JOIN owner_review_revisions r ON r.id=a.revision_id AND r.import_id=a.import_id AND r.fingerprint=a.fingerprint
    LEFT JOIN owner_review_decisions d ON a.action='decision' AND d.id=a.target_id AND d.revision_id=r.id
    WHERE a.import_id=? AND (a.action='revise' OR d.id IS NOT NULL)
    ORDER BY a.occurred_at DESC,a.id DESC
   `).all(id);
   return {...review,reviewActivity};
  })();
 });
 const definitions={
 notes:{required:['gate','answer','reference'],properties:{gate:{type:'string',enum:Object.keys(gates)},answer:string,reference:string}},
 verify:{required:['noteId','origin','facts'],properties:{noteId:{type:'string',maxLength:100},origin:{type:'string',enum:['client_confirmed','owner_verified_internal']},facts:{type:'object',additionalProperties:false,properties:{rateCentsPerHour:{type:'integer',minimum:1,maximum:1000000000},capacityHours:{type:'number',minimum:1,maximum:100000},paymentTerms:string,policyLimitCents:{type:'integer',minimum:1,maximum:1000000},acceptLowMargin:{type:'boolean'},reason:string}}}},
 revisions:{required:['proposal','reason'],properties:{proposal:{type:'object',additionalProperties:true},reason:string}},
 approve:{required:['confirmation'],properties:{confirmation:{const:'APPROVE_EXACT_REVISION'}}},
 decision:{required:['decision'],properties:{decision:{type:'string',enum:['DEFERRED','REJECTED']}}}
 };
 for(const [action,definition] of Object.entries(definitions))app.post<{Params:{id:string};Body:any}>(`/v1/proposal-imports/:id/review/${action}`,{bodyLimit:512*1024,schema:{operationId:'authenticatedOwner_'+action,params,body:{type:'object',additionalProperties:false,required:['revisionId','fingerprint',...definition.required],properties:{...binding,...definition.properties}},response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');return db.transaction(()=>{
   const id=request.params.id,b=request.body as Record<string,any>,{session,actor:owner}=actor(request,id,true),review=new OwnerReview(db);
   // Authority is derived here and rechecked under the same write lock as the financial operation.
   if(action==='notes'){const note=review.recordNote(id,b.revisionId,b.fingerprint,b.gate as Gate,b.answer,b.reference,owner);audit(session,id,b.revisionId,b.fingerprint,'note',note,b.gate);}
   if(action==='verify'){review.verifyGate(owner,id,b.revisionId,b.fingerprint,b.noteId,b.origin,b.facts);const note=db.prepare('SELECT gate FROM owner_review_notes WHERE id=?').pluck().get(b.noteId) as string;audit(session,id,b.revisionId,b.fingerprint,'verify',b.noteId,note);}
   if(action==='revisions'){const revised=review.revise(owner,id,b.revisionId,b.fingerprint,b.proposal,b.reason);const fp=db.prepare('SELECT fingerprint FROM owner_review_revisions WHERE id=?').pluck().get(revised) as string;audit(session,id,revised,fp,'revise',revised);}
   if(action==='approve'&&projectImportLink(db,id))throw new AuthError(409,'USE_PROJECT_APPROVAL_WORKFLOW');
   if(action==='approve'||action==='decision'){
    if(Date.now()-session.createdAt>900000)throw new AuthError(401,'RECENT_OWNER_LOGIN_REQUIRED');
    const existing=db.prepare('SELECT id FROM owner_review_decisions WHERE revision_id=? AND fingerprint=?').pluck().get(b.revisionId,b.fingerprint) as string|undefined;
    if(action==='approve'){
     if(!existing){const blockers=authenticationBlockers(db,id);if(blockers.length)throw new ImportError(blockers,409);}
     else if(!db.prepare("SELECT 1 FROM authenticated_review_events WHERE action='decision' AND target_id=?").get(existing))throw new AuthError(403,'SYNTHETIC_APPROVAL_NOT_AUTHENTICATED');
    }
    const decision=review.decide(owner,id,b.revisionId,b.fingerprint,action==='approve'?'APPROVED_SYNTHETIC_DELIVERY':b.decision) as {id:string};
    if(!existing)audit(session,id,b.revisionId,b.fingerprint,'decision',decision.id);
   }
   if(action==='revisions'){const link=projectImportLink(db,id);if(link){const b=bindingAuthorized(db,session.ownerId,link.binding_id);new ApprovalWorkflow(db).regenerate(session,b.client_project_id);}}
   return state(id);
  }).immediate();
 });
}
