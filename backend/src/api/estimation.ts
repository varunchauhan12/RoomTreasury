import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { generateEstimate, EstimateError, type Intake } from '../ai/estimate.js';
import { AgencyEngine } from '../domain/agency-engine.js';
import { errorSchema } from './errors.js';
export function registerEstimation(app:FastifyInstance,db:Database,aiFetch?:typeof fetch) {
 let busy=false;
 app.post<{Body:Intake}>('/v1/client-projects/estimate', {schema:{operationId:'estimateDelivery',body:{type:'object',additionalProperties:false,required:['clientName','brief','revenueCents'],properties:{clientName:{type:'string',minLength:1,maxLength:300},brief:{type:'string',minLength:1,maxLength:4000},revenueCents:{type:'integer',minimum:1,maximum:1000000000}}},response:{201:{type:'object',additionalProperties:true},400:errorSchema,403:errorSchema,429:errorSchema,500:errorSchema,502:errorSchema,503:errorSchema}}},async(request,reply)=>{
  reply.header('Cache-Control','no-store');
  const mode=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
  if(mode.length!==1||!['test','demo'].includes(mode[0] as string)||request.headers['x-roomtreasury-intake']!=='1'||(request.headers.origin && request.headers.origin!==`http://${request.headers.host}`))throw new EstimateError('AI_INTAKE_DENIED',403);
  if(!request.body.clientName.trim()||!request.body.brief.trim())throw new EstimateError('AI_INPUT_LIMIT',400);
  if(busy)throw new EstimateError('AI_BUSY',429);
  busy=true;
  try {
   const estimate=await generateEstimate(request.body,aiFetch?{fetch:aiFetch}:{});
   const created=new AgencyEngine(db).createEstimatedProject(request.body,estimate);
   return reply.code(201).send(new AgencyEngine(db).economics(created.clientId,created.proposalId));
  }finally{busy=false;}
 });
}
