import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Database} from 'better-sqlite3';
import {ownerSession,type AuthSettings} from '../security/owner-auth.js';
import {AuthError} from '../security/service-auth.js';
import {errorSchema} from '../api/errors.js';
import {onboardProject,type ProjectIntake} from './bindings.js';
import {ProcessingJobs,jobView} from './service.js';

export function registerJobs(app:FastifyInstance,db:Database,settings:AuthSettings){
 const jobs=new ProcessingJobs(db);
 const responses={200:{type:'object',additionalProperties:true},201:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,409:errorSchema,500:errorSchema};
 const empty={type:'object',properties:{},additionalProperties:false};
 const params=(name:string)=>({type:'object',additionalProperties:false,required:[name],properties:{[name]:{type:'string',minLength:1,maxLength:4096}}});
 const security=[{ownerCookie:[]}];
 function session(request:FastifyRequest,mutation=false){return ownerSession(db,request,settings,mutation);}
 function idempotency(request:FastifyRequest):string {const value=request.headers['idempotency-key'];if(typeof value!=='string')throw new AuthError(400,'IDEMPOTENCY_KEY_REQUIRED');return value;}
 const keyHeader={type:'object',required:['idempotency-key'],properties:{'idempotency-key':{type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}}};
 const noStore=async(_request:unknown,reply:{header:(key:string,value:string)=>unknown})=>{reply.header('Cache-Control','no-store');};
 app.post<{Body:ProjectIntake}>('/v1/client-projects/onboard',{onRequest:noStore,schema:{operationId:'onboardBoundClientProject',security,headers:keyHeader,querystring:empty,body:{type:'object',additionalProperties:false,required:['clientName','brief','revenueCents'],properties:{clientName:{type:'string',minLength:1,maxLength:300},brief:{type:'string',minLength:1,maxLength:4000},revenueCents:{type:'integer',minimum:1,maximum:1000000000}}},response:responses}},(request,reply)=>{
  const binding=db.transaction(()=>onboardProject(db,session(request,true),request.body,idempotency(request))).immediate();
  return reply.code(201).send({binding});
 });
 const projectPath='/v1/client-projects/:projectId/processing-jobs';
 app.post<{Params:{projectId:string}}>(projectPath,{onRequest:noStore,schema:{operationId:'createProcessingJob',security,headers:keyHeader,params:params('projectId'),querystring:empty,body:empty,response:responses}},(request,reply)=>{
  const job=db.transaction(()=>{const owner=session(request,true);const binding=db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').get(request.params.projectId) as {id:string}|undefined;
   if(!binding)throw new AuthError(403,'BOUND_OWNER_SCOPE_REQUIRED');
   return jobs.create(owner,binding.id,idempotency(request));
  }).immediate();
  return reply.code(201).send({job:jobView(job)});
 });
 app.get<{Params:{projectId:string}}>(projectPath,{onRequest:noStore,schema:{operationId:'listProcessingJobs',security,params:params('projectId'),querystring:empty,response:responses}},request=>({jobs:jobs.list(session(request),request.params.projectId).map(jobView)}));
 app.get<{Params:{id:string}}>('/v1/processing-jobs/:id',{onRequest:noStore,schema:{operationId:'getProcessingJob',security,params:params('id'),querystring:empty,response:responses}},request=>({job:jobView(jobs.get(session(request),request.params.id))}));
 app.get<{Params:{id:string};Querystring:{after?:string;limit?:string}}>('/v1/processing-jobs/:id/events',{onRequest:noStore,schema:{operationId:'getProcessingJobEvents',security,params:params('id'),querystring:{type:'object',additionalProperties:false,properties:{after:{type:'string',pattern:'^[0-9]{1,15}$'},limit:{type:'string',pattern:'^[0-9]{1,3}$'}}},response:responses}},request=>jobs.events(session(request),request.params.id,Number(request.query.after??0),Number(request.query.limit??50)));
 app.post<{Params:{id:string}}>('/v1/processing-jobs/:id/cancel',{onRequest:noStore,schema:{operationId:'cancelProcessingJob',security,params:params('id'),querystring:empty,body:empty,response:responses}},request=>db.transaction(()=>({job:jobView(jobs.cancel(session(request,true),request.params.id))})).immediate());
}
