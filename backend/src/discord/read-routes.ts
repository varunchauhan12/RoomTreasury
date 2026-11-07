import type {FastifyInstance} from 'fastify';
import type {Database} from 'better-sqlite3';
import {ownerSession,type AuthSettings} from '../security/owner-auth.js';
import {ProcessingJobs} from '../jobs/service.js';
import {errorSchema} from '../api/errors.js';

// Only expose captures already correlated by the collector to an owner-authorized job.
// No arbitrary channel history, raw Discord payloads, CDN URLs or bot configuration.
export function registerDiscordReads(app:FastifyInstance,db:Database,settings:AuthSettings){
 const jobs=new ProcessingJobs(db);
 const params={type:'object',additionalProperties:false,required:['id'],properties:{id:{type:'string',minLength:1,maxLength:128}}};
 const response={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,500:errorSchema};
 app.get<{Params:{id:string};Querystring:{before?:string;limit?:string}}>('/v1/processing-jobs/:id/discord-messages',{schema:{operationId:'getAuthorizedDiscordMessages',security:[{ownerCookie:[]}],params,querystring:{type:'object',additionalProperties:false,properties:{before:{type:'string',pattern:'^[0-9]{1,21}$'},limit:{type:'string',pattern:'^[0-9]{1,3}$'}}},response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');
  const job=jobs.get(ownerSession(db,request,settings),request.params.id);
  const limit=Math.min(100,Math.max(1,Number(request.query.limit??50)));
  const cursor=request.query.before;
  const rows=db.prepare(`SELECT id,channel_id,author_id,author_username,is_bot,agent_role,agent_name,content,occurred_at,recorded_at FROM discord_messages WHERE job_id=? ${cursor?'AND (occurred_at,id) < (SELECT occurred_at,id FROM discord_messages WHERE id=? AND job_id=?)':''} ORDER BY occurred_at DESC,id DESC LIMIT ?`).all(...(cursor?[job.id,cursor,job.id,limit+1]:[job.id,limit+1])) as any[];
  const more=rows.length>limit;rows.splice(limit);
  const nextBefore=more?rows.at(-1)?.id:null;
  const messages=rows.reverse().map(row=>({...row,senderVerified:false,completionMarker:row.content.includes('ROOMTREASURY_RESULT_READY'),attachments:db.prepare('SELECT id,filename,byte_size,sha256 FROM discord_attachments WHERE job_id=? AND message_id=? ORDER BY id').all(job.id,row.id)}));
  const latest=db.prepare('SELECT MAX(recorded_at) AS at FROM discord_messages WHERE job_id=?').get(job.id) as {at:number|null};
  const captured=db.prepare('SELECT raw_json,channel_id FROM discord_messages WHERE job_id=? ORDER BY recorded_at DESC LIMIT 1').get(job.id) as {raw_json:string;channel_id:string}|undefined;
  let guildId:string|null=null;try{const value=JSON.parse(captured?.raw_json??'{}').guild_id;if(typeof value==='string'&&/^\d{17,21}$/.test(value))guildId=value;}catch{/* No raw payloads leave the backend. */}
  return {channel:{id:captured?.channel_id??null,name:null,guildId,guildName:null},jobId:job.id,source:'persisted_discord_capture',connectionStatus:'capture_history_only',lastCapturedAt:latest.at,nextBefore,messages};
 });
 app.get<{Params:{id:string;attachmentId:string}}>('/v1/processing-jobs/:id/discord-attachments/:attachmentId',{schema:{operationId:'downloadAuthorizedDiscordAttachment',security:[{ownerCookie:[]}],params:{type:'object',additionalProperties:false,required:['id','attachmentId'],properties:{id:{type:'string',minLength:1,maxLength:128},attachmentId:{type:'string',minLength:1,maxLength:128}}},querystring:{type:'object',properties:{},additionalProperties:false},response:{200:{description:'Captured UTF-8 artifact attachment.',content:{'text/plain':{schema:{type:'string'}}}},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema}}},(request,reply)=>{
  reply.header('Cache-Control','no-store');
  const job=jobs.get(ownerSession(db,request,settings),request.params.id);
  const row=db.prepare('SELECT filename,content_text FROM discord_attachments WHERE job_id=? AND id=?').get(job.id,request.params.attachmentId) as {filename:string;content_text:string}|undefined;
  if(!row)return reply.code(404).send({error:{code:'NOT_FOUND',message:'Attachment unavailable.',details:{},correlationId:request.id}});
  const filename=row.filename.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)||'artifact.txt';
  return reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',`attachment; filename="${filename}"`).type('text/plain; charset=utf-8').send(row.content_text);
 });
}
