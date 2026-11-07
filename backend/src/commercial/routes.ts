import type {FastifyInstance} from 'fastify';
import type {Database} from 'better-sqlite3';
import {errorSchema} from '../api/errors.js';
import {ownerSession,type AuthSettings} from '../security/owner-auth.js';
import {CommercialLedger,type Action} from './service.js';

const str=(max:number)=>({type:'string',minLength:1,maxLength:max});
const id=str(100), reference=str(500), date={type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'};
const amountCents={type:'integer',minimum:1,maximum:1000000000};
const variant=(action:string,required:Record<string,object>,optional:Record<string,object>={})=>({
 type:'object',additionalProperties:false,required:['action',...Object.keys(required)],
 properties:{action:{type:'string',enum:[action]},...required,...optional}
});
export function registerCommercial(app:FastifyInstance,db:Database,settings:AuthSettings){
 const ledger=new CommercialLedger(db);
 const response={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,409:errorSchema,500:errorSchema};
 const security=[{ownerCookie:[]}];
 const params={type:'object',required:['projectId'],properties:{projectId:id}};
 const project='/v1/client-projects/:projectId/commercial';
 const read=(request:Parameters<typeof ownerSession>[1])=>ownerSession(db,request,settings);
 app.get('/v1/commercial',{schema:{operationId:'commercialDashboard',security,response}},(request,reply)=>{
  reply.header('Cache-Control','no-store');return ledger.dashboard(read(request));
 });
 app.get<{Params:{projectId:string}}>(project,{schema:{operationId:'commercialProject',security,response,params}},(request,reply)=>{
  reply.header('Cache-Control','no-store');return ledger.snapshot(read(request),request.params.projectId);
 });
 app.post<{Params:{projectId:string};Body:Action;Headers:{'idempotency-key':string}}>(project,{
  schema:{operationId:'recordCommercialAction',security,response,params,
   headers:{type:'object',required:['idempotency-key'],properties:{'idempotency-key':{type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'}}},
   body:{oneOf:[
    variant('submit',{amountCents,reference},{importId:id,revisionId:id,fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'}}),
    variant('accept',{quoteId:id,reference}),variant('revision_requested',{quoteId:id,reference}),
    variant('agreement',{quoteId:id,amountCents,signedOn:date,terms:str(2000),reference}),
    variant('invoice_draft',{number:str(80),amountCents,dueOn:date}),
    variant('invoice_issue',{invoiceId:id,date}),variant('invoice_cancel',{invoiceId:id,reference}),
    variant('receipt',{amountCents,date,method:str(80),reference},{invoiceId:id}),
    variant('expense',{amountCents,date,method:str(80),reference}),
    variant('delivery_start',{reference}),variant('complete',{reference})
   ]}
  }
 },(request,reply)=>{
  reply.header('Cache-Control','no-store');
  return ledger.apply(ownerSession(db,request,settings,true),request.params.projectId,request.body,request.headers['idempotency-key']);
 });
}
