import {ownerSession,authSettings,type AuthSettings} from '../security/owner-auth.js';
import {projectImportLink} from './project-linked.js';
import {bindingAuthorized} from '../jobs/bindings.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from 'better-sqlite3';
import { ImportError, importBundle, validateBundle, type ImportBundle } from './service.js';
import { errorSchema } from '../api/errors.js';
export function registerImports(app:FastifyInstance,db:Database,settings:AuthSettings=authSettings(db)){
 function requireLinkedAccess(request:FastifyRequest,id:string){const link=projectImportLink(db,id);if(link){const owner=ownerSession(db,request,settings);bindingAuthorized(db,owner.ownerId,link.binding_id);}}
 function visible(request:FastifyRequest,id:string){try{requireLinkedAccess(request,id);return true;}catch{return false;}}
 const file={type:'object',additionalProperties:false,required:['name','content'],properties:{name:{type:'string',maxLength:200},content:{type:'string',maxLength:524288}}};
 const body={type:'object',additionalProperties:false,required:['proposal'],properties:{proposal:file,evidence:file,summary:file,fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'}}};
 const response={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,409:errorSchema,413:errorSchema,500:errorSchema};
 for(const action of ['preview','confirm'])app.post<{Body:ImportBundle & {fingerprint?:string}}>(`/v1/proposal-imports/${action}`,{bodyLimit:2*1024*1024,schema:{operationId:action+'ProposalImport',body,response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');
  const host=request.headers.host??'';
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)||request.headers['x-roomtreasury-import']!=='1'||(request.headers.origin&&request.headers.origin!==`http://${host}`))throw new ImportError(['Use the local import page.'],403);
  const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();if(modes.some(m=>!['test','demo'].includes(m as string)))throw new ImportError(['Imports are restricted to local test/demo storage.'],403);
  const v=validateBundle(request.body);
  const bound=db.prepare('SELECT id FROM project_task_bindings WHERE task_id=?').get(v.proposal.taskId) as {id:string}|undefined;
  if(bound){const owner=ownerSession(db,request,settings,true);bindingAuthorized(db,owner.ownerId,bound.id);throw new ImportError(['This task has an authoritative project binding. Upload through its project workspace.'],409);}
  if(action==='preview'){return {proposal:v.proposal,evidence:v.evidence,summary:v.summary,fingerprint:v.fingerprint,warnings:v.warnings};}
  if(!request.body.fingerprint)throw new ImportError(['Preview and validate files before confirming import.']);return importBundle(db,request.body,request.body.fingerprint);
 });
 app.get('/v1/proposal-imports/',{schema:{operationId:'listProposalImports',response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');return {imports:db.prepare('SELECT id,task_id,revision,imported_at,source,identity_authenticated,proposal_json FROM proposal_imports ORDER BY imported_at DESC,id').all().filter((row:any)=>visible(request,row.id)).map((row:any)=>({id:row.id,taskId:row.task_id,revision:row.revision,importedAt:row.imported_at,source:row.source,identityAuthenticated:false,client:JSON.parse(row.proposal_json).client.name,project:JSON.parse(row.proposal_json).project.name,status:JSON.parse(row.proposal_json).status}))};
 });
 app.get<{Params:{id:string}}>('/v1/proposal-imports/:id',{schema:{operationId:'getProposalImport',response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');const row=db.prepare('SELECT * FROM proposal_imports WHERE id=?').get(request.params.id) as any;
  if(!row)throw new ImportError(['Imported proposal not found.'],404);requireLinkedAccess(request,row.id);
  return {id:row.id,taskId:row.task_id,revision:row.revision,importedAt:row.imported_at,source:row.source,identityAuthenticated:false,executionAuthorized:false,fingerprint:row.bundle_fingerprint,normalization:originalMetadata(db,row.id),proposal:JSON.parse(row.proposal_json),evidence:row.evidence_json?JSON.parse(row.evidence_json):null,summary:row.summary_markdown};
 });
 app.get<{Params:{id:string;kind:string}}>('/v1/proposal-imports/:id/original-artifacts/:kind',{schema:{hide:true}},(request,reply)=>{
  ownerSession(db,request,settings);
  requireLinkedAccess(request,request.params.id);
  const column={proposal:'proposal_raw',evidence:'evidence_raw',summary:'summary_raw'}[request.params.kind];
  if(!column)throw new ImportError(['Artifact not found.'],404);
  const row=db.prepare(`SELECT ${column} AS content FROM proposal_import_originals WHERE import_id=?`).get(request.params.id) as {content:string|null}|undefined;
  if(!row?.content)throw new ImportError(['Original artifact not retained for this legacy import.'],404);
  return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').type('application/octet-stream').send(row.content);
 });
 app.get<{Params:{id:string;kind:string}}>('/v1/proposal-imports/:id/artifacts/:kind',{schema:{hide:true}},(request,reply)=>{
  const column={proposal:'proposal_json',evidence:'evidence_json',summary:'summary_markdown'}[request.params.kind];
  if(!column)throw new ImportError(['Artifact not found.'],404);
  const row=db.prepare(`SELECT ${column} AS content FROM proposal_imports WHERE id=?`).get(request.params.id) as {content:string|null}|undefined;
  if(!row?.content)throw new ImportError(['Artifact not supplied.'],404);requireLinkedAccess(request,request.params.id);
  return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',`attachment; filename="${request.params.kind}.${request.params.kind==='summary'?'md':'json'}"`).type('application/octet-stream').send(row.content);
 });
}

function originalMetadata(db:Database,id:string){const row=db.prepare('SELECT proposal_sha256,evidence_sha256,summary_sha256,normalization_json FROM proposal_import_originals WHERE import_id=?').get(id) as any;return row?{...JSON.parse(row.normalization_json),hashes:{proposal:row.proposal_sha256,evidence:row.evidence_sha256,summary:row.summary_sha256}}:null;}
