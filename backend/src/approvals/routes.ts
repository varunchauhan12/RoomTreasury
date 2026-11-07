import type {FastifyInstance} from 'fastify';
import type {Database} from 'better-sqlite3';
import {ownerSession,type AuthSettings} from '../security/owner-auth.js';
import {errorSchema} from '../api/errors.js';
import {ApprovalWorkflow,type DecisionInput} from './service.js';
import {gateOrder,sectionSpecialists} from './policy.js';
export function registerApprovalWorkflow(app:FastifyInstance,db:Database,settings:AuthSettings){
 const workflow=new ApprovalWorkflow(db);
 const base='/v1/client-projects/:projectId/approval-workflow';
 const params={type:'object',required:['projectId'],additionalProperties:false,properties:{projectId:{type:'string',minLength:1,maxLength:100}}};
 const security=[{ownerCookie:[]}],response={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,404:errorSchema,409:errorSchema,500:errorSchema};
 const empty={type:'object',additionalProperties:false,properties:{}};
 const headers={type:'object',required:['idempotency-key'],properties:{'idempotency-key':{type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}}};
 const session=(request:Parameters<typeof ownerSession>[1],mutation=false)=>ownerSession(db,request,settings,mutation);
 app.get<{Params:{projectId:string}}>(base,{schema:{operationId:'approvalWorkflow',security,params,response}},(req,reply)=>{
  reply.header('Cache-Control','no-store');return workflow.snapshot(session(req),req.params.projectId);
 });
 app.get<{Params:{projectId:string}}>(base+'/reports',{schema:{operationId:'approvalReports',security,params,response}},(req,reply)=>{
  reply.header('Cache-Control','no-store');return {reports:workflow.reports(session(req),req.params.projectId)};
 });
 app.post<{Params:{projectId:string};Body:DecisionInput;Headers:{'idempotency-key':string}}>(base+'/decisions',{schema:{
  operationId:'decideApprovalGate',security,params,response,headers,body:{type:'object',additionalProperties:false,
   required:['gate','subjectHash','decision','reason','evidence'],properties:{
    gate:{type:'string',enum:gateOrder},subjectHash:{type:'string',pattern:'^[a-f0-9]{64}$'},
    decision:{type:'string',enum:['approve','reject','changes','blocked']},reason:{type:'string',minLength:1,maxLength:4000},
    evidence:{type:'array',minItems:1,maxItems:30,items:{type:'string',minLength:1,maxLength:1000}},
    checks:{type:'array',uniqueItems:true,maxItems:20,items:{type:'string',minLength:1,maxLength:80}},
    sections:{type:'array',uniqueItems:true,minItems:1,maxItems:6,items:{type:'string',enum:Object.keys(sectionSpecialists)}}
   }}
 }},(req,reply)=>{reply.header('Cache-Control','no-store');return workflow.decide(session(req,true),req.params.projectId,req.body,req.headers['idempotency-key']);});
 app.post<{Params:{projectId:string};Headers:{'idempotency-key':string}}>(base+'/reanalyze',{schema:{
  operationId:'reanalyzeApprovalRevision',security,params,response,headers,body:empty
 }},(req,reply)=>{reply.header('Cache-Control','no-store');return {job:workflow.reanalyze(session(req,true),req.params.projectId,req.headers['idempotency-key'])};});
 app.post<{Params:{projectId:string}}>(base+'/reports',{schema:{
  operationId:'regenerateApprovalReport',security,params,response,body:empty
 }},(req,reply)=>{reply.header('Cache-Control','no-store');return workflow.regenerate(session(req,true),req.params.projectId);});
}
