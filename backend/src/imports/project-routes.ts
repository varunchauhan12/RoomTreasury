import type {FastifyInstance} from 'fastify';
import type {Database} from 'better-sqlite3';
import {ownerSession,type AuthSettings} from '../security/owner-auth.js';
import {errorSchema} from '../api/errors.js';
import type {ImportBundle} from './service.js';
import {previewProjectImport,confirmProjectImport} from './project-linked.js';
export function registerProjectImports(app:FastifyInstance,db:Database,settings:AuthSettings){
 const file={type:'object',additionalProperties:false,required:['name','content'],properties:{name:{type:'string',maxLength:200},content:{type:'string',maxLength:524288}}};
 for(const action of ['preview','confirm'] as const)app.post<{Params:{projectId:string};Body:ImportBundle&{jobId:string;intakeHash:string;fingerprint:string}}>(`/v1/client-projects/:projectId/proposal-imports/${action}`,{
  bodyLimit:2*1024*1024,schema:{operationId:action+'ProjectProposalImport',security:[{ownerCookie:[]}],
   params:{type:'object',additionalProperties:false,required:['projectId'],properties:{projectId:{type:'string',minLength:1,maxLength:4096}}},
   body:{type:'object',additionalProperties:false,required:['proposal','evidence','summary',...(action==='confirm'?['jobId','intakeHash','fingerprint']:[])],properties:{proposal:file,evidence:file,summary:file,...(action==='confirm'?{jobId:{type:'string',minLength:1,maxLength:100},intakeHash:{type:'string',pattern:'^[a-f0-9]{64}$'},fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'}}:{})}},
   response:{200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,409:errorSchema,413:errorSchema,500:errorSchema}}},(request,reply)=>{
   reply.header('Cache-Control','no-store');
   return db.transaction(()=>{const session=ownerSession(db,request,settings,true);
    return action==='preview'?previewProjectImport(db,session,request.params.projectId,request.body):confirmProjectImport(db,session,request.params.projectId,request.body,request.body);
   }).immediate();
  });
}
