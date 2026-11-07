import {isLocalAuditContext} from '../security/local-workspace.js';
import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { activeSession, bindingAuthorized, hash, key } from '../jobs/bindings.js';
import { OwnerReview } from '../reviews/service.js';
import type { OwnerSession } from '../security/owner-auth.js';
import { AuthError } from '../security/service-auth.js';

export type Action =
 | { action:'submit'; amountCents:number; reference:string; importId?:string; revisionId?:string; fingerprint?:string }
 | { action:'revision_requested'|'accept'; quoteId:string; reference:string }
 | { action:'agreement'; quoteId:string; amountCents:number; signedOn:string; terms:string; reference:string }
 | { action:'invoice_draft'; number:string; amountCents:number; dueOn:string }
 | { action:'invoice_issue'; invoiceId:string; date:string }
 | { action:'invoice_cancel'; invoiceId:string; reference:string }
 | { action:'receipt'|'expense'; invoiceId?:string; amountCents:number; date:string; method:string; reference:string }
 | { action:'delivery_start'|'complete'; reference:string };
interface Quote { id:string; revision:number; amount_cents:number; reference:string; import_id:string|null; review_revision_id:string|null; fingerprint:string|null }
interface Agreement { id:string; quote_id:string; amount_cents:number; signed_on:string; terms:string; reference:string; currency:'USD' }
interface Entry { id:string; invoice_id:string|null; kind:'receipt'|'expense'; amount_cents:number; paid_on:string; method:string; reference:string; owner_id:string }
interface Audit { id:number; owner_id:string; action:Action['action']; target_id:string; evidence:string; occurred_at:number }
interface InvoiceRow { id:string; number:string; amount_cents:number; due_on:string; currency:'USD' }
const fail=(code:string,status=409):never=>{throw new AuthError(status,code);};
const day=(now:number)=>new Date(now).toISOString().slice(0,10);
function date(value:string):string {
 const parsed=new Date(value+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(+parsed)||day(+parsed)!==value)fail('INVALID_DATE',400);
 return value;
}
function amount(value:number):number {
 if(!Number.isSafeInteger(value)||value<1||value>1_000_000_000)fail('INVALID_AMOUNT',400);
 return value;
}
function text(value:string,max=500):string {
 if(typeof value!=='string'||!value.trim()||value.length>max)fail('REFERENCE_OR_TERMS_REQUIRED',400);
 return value.trim();
}
const total=(rows:readonly {amount_cents:number}[])=>rows.reduce((sum,r)=>sum+r.amount_cents,0);
export function commercialDemo(db:Database):boolean {
 return Boolean(db.prepare('SELECT 1 FROM commercial_demo WHERE id=1').get());
}
export class CommercialLedger {
 constructor(private readonly db:Database,private readonly clock=Date.now){}
 private authorize(session:OwnerSession,projectId:string){
  activeSession(this.db,session);
  const row=this.db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').get(projectId) as {id:string}|undefined;
  return bindingAuthorized(this.db,session.ownerId,row?.id??'');
 }
 private read(projectId:string,now:number){
  const quotes=this.db.prepare('SELECT * FROM commercial_quotes WHERE project_id=? ORDER BY revision DESC').all(projectId) as Quote[];
  const originalAgreement=(this.db.prepare('SELECT * FROM commercial_agreements WHERE project_id=?').get(projectId) as Agreement|undefined)??null;
  const endorsement=this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='commercial_agreement_endorsements'").get()?this.db.prepare('SELECT * FROM commercial_agreement_endorsements WHERE project_id=? ORDER BY rowid DESC LIMIT 1').get(projectId) as {quote_id:string;signed_on:string;terms:string;reference:string}|undefined:undefined;
  const agreement=originalAgreement&&endorsement?{...originalAgreement,quote_id:endorsement.quote_id,signed_on:endorsement.signed_on,terms:endorsement.terms,reference:endorsement.reference}:originalAgreement;
  const entries=this.db.prepare('SELECT * FROM commercial_cash WHERE project_id=? ORDER BY paid_on DESC,id').all(projectId) as Entry[];
  const events=this.db.prepare('SELECT id,owner_id,action,target_id,evidence,occurred_at FROM commercial_events WHERE project_id=? ORDER BY id DESC').all(projectId) as Audit[];
  const invoices=(this.db.prepare('SELECT * FROM commercial_invoices WHERE project_id=? ORDER BY due_on,number').all(projectId) as InvoiceRow[]).map(invoice=>{
   const issue=events.find(e=>e.target_id===invoice.id&&e.action==='invoice_issue');
   const cancelled=events.some(e=>e.target_id===invoice.id&&e.action==='invoice_cancel');
   const receipts=entries.filter(e=>e.invoice_id===invoice.id&&e.kind==='receipt');
   const paidCents=total(receipts);
   const outstandingCents=issue&&!cancelled?invoice.amount_cents-paidCents:0;
   const overdue=outstandingCents>0&&invoice.due_on<day(now);
   const status=cancelled?'cancelled':!issue?'draft':!outstandingCents?'paid':overdue?'overdue':paidCents?'partially_paid':'issued';
   return {...invoice,status,overdue,issuedOn:issue?.evidence??null,paidCents,outstandingCents,receiptIds:receipts.map(e=>e.id)};
  });
  const quote=quotes[0]??null;
  const response=quote?events.find(e=>e.target_id===quote.id&&['accept','revision_requested'].includes(e.action)):null;
  const stage=events.some(e=>e.action==='complete')?'completed':events.some(e=>e.action==='delivery_start')?'delivery':
   quote&&agreement?.quote_id!==quote.id?(response?.action==='accept'?'accepted':response?.action==='revision_requested'?'revision_requested':'submitted'):agreement?'agreement_confirmed':quote?'submitted':'inquiry';
  const cashCents=total(entries.filter(e=>e.kind==='receipt'));
  const expenseCents=total(entries.filter(e=>e.kind==='expense'));
  return {projectId,stage,quote,quotes,agreement,invoices,entries,events,proposedCents:quote?.amount_cents??null,
   agreedCents:agreement?.amount_cents??null,cashCents,expenseCents,
   invoicedCents:total(invoices.filter(i=>i.issuedOn&&i.status!=='cancelled')),
   receivableCents:invoices.reduce((sum,i)=>sum+i.outstandingCents,0),overdueCount:invoices.filter(i=>i.overdue).length,
   recordedMarginCents:stage==='completed'?cashCents-expenseCents:null};
 }
 snapshot(session:OwnerSession,projectId:string){
  return this.db.transaction(()=>{this.authorize(session,projectId);return this.read(projectId,this.clock());})();
 }
 dashboard(session:OwnerSession){
  return this.db.transaction(()=>{
   activeSession(this.db,session);
   const now=this.clock();
   const local=isLocalAuditContext(this.db,session);
   const scope=local?[]:[session.ownerId];
   const ids=this.db.prepare(`SELECT b.client_project_id AS id FROM project_task_bindings b
    JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id
    WHERE s.revoked_at IS NULL ${local?'':'AND b.owner_id=?'} ORDER BY b.client_project_id`).all(...scope) as {id:string}[];
   const projects=ids.map(({id})=>this.read(id,now));
   const reviewVersion=local?this.db.prepare('SELECT coalesce(max(id),0) FROM authenticated_review_events').pluck().get():
    this.db.prepare(`SELECT coalesce(max(e.id),0) FROM authenticated_review_events e JOIN proposal_imports p ON p.id=e.import_id
    JOIN human_owner_scopes s ON s.task_id=p.task_id AND s.owner_id=? AND s.revoked_at IS NULL
    LEFT JOIN project_import_links l ON l.import_id=p.id LEFT JOIN project_task_bindings b ON b.id=l.binding_id
    WHERE l.import_id IS NULL OR b.owner_id=s.owner_id`).pluck().get(session.ownerId);
   const totals=projects.reduce((sum,p)=>({
    contractedCents:sum.contractedCents+(p.agreedCents??0),cashCents:sum.cashCents+p.cashCents,
    receivableCents:sum.receivableCents+p.receivableCents,overdueCount:sum.overdueCount+p.overdueCount,
    expenseCents:sum.expenseCents+p.expenseCents
   }),{contractedCents:0,cashCents:0,receivableCents:0,overdueCount:0,expenseCents:0});
   const approvalVersion=this.db.prepare(`SELECT coalesce(max(d.rowid),0) FROM approval_decisions d JOIN project_task_bindings b ON b.id=d.binding_id
    JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id WHERE s.revoked_at IS NULL ${local?'':'AND b.owner_id=?'}`).pluck().get(...scope);
   return {projects,totals,reviewVersion,approvalVersion,demo:commercialDemo(this.db)};
  })();
 }
 apply(session:OwnerSession,projectId:string,input:Action,requestKey:string){
  return this.db.transaction(()=>{
   const binding=this.authorize(session,projectId);key(requestKey);
   const requestHash=hash(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)))));
   const previous=this.db.prepare('SELECT request_hash FROM commercial_events WHERE project_id=? AND request_key=?').get(projectId,requestKey) as {request_hash:string}|undefined;
   const now=this.clock(),state=this.read(projectId,now);
   if(previous){if(previous.request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT');return state;}
   let target=randomUUID() as string,evidence='';
   switch(input.action){
    case 'submit': {
     if(this.db.prepare("SELECT 1 FROM approval_decisions WHERE binding_id=? AND gate='activation' AND decision='approve'").get(binding.id))fail('ACTIVE_DELIVERY_AMENDMENTS_DEFERRED');
     if(!['inquiry','revision_requested','agreement_confirmed'].includes(state.stage))fail('PROPOSAL_TRANSITION_INVALID');
     const proposed=amount(input.amountCents);evidence=text(input.reference);
     if(state.agreement&&proposed!==state.agreement.amount_cents)fail('CONTRACT_AMOUNT_AMENDMENTS_DEFERRED');
     if(input.importId||input.revisionId||input.fingerprint){
      if(!input.importId||!input.revisionId||!input.fingerprint)fail('EXACT_REVISION_REQUIRED',400);
      if(!this.db.prepare('SELECT 1 FROM project_import_links WHERE import_id=? AND binding_id=?').get(input.importId,binding.id))fail('PROPOSAL_SCOPE_REQUIRED',403);
      const snapshot=new OwnerReview(this.db).snapshot(input.importId!);
      const latest=this.db.prepare('SELECT id FROM proposal_imports WHERE task_id=? ORDER BY revision DESC LIMIT 1').pluck().get(binding.task_id);
      const terms=snapshot.revision.proposal.project;
      if(latest!==input.importId||snapshot.revision.id!==input.revisionId||snapshot.revision.fingerprint!==input.fingerprint||
         (terms.proposedRevenueCents??terms.agreedRevenueCents)!==proposed)fail('EXACT_REVISION_REQUIRED');
     }
     this.db.prepare('INSERT INTO commercial_quotes VALUES (?,?,?,?,?,?,?,?,?)').run(target,projectId,(state.quote?.revision??0)+1,proposed,'USD',evidence,input.importId??null,input.revisionId??null,input.fingerprint??null);
     break;
    }
    case 'revision_requested':
    case 'accept':
     if(state.stage!=='submitted'||state.quote?.id!==input.quoteId)fail('PROPOSAL_TRANSITION_INVALID');
     target=input.quoteId;evidence=text(input.reference);break;
    case 'agreement': {
     if(state.stage!=='accepted'||state.quote?.id!==input.quoteId)fail('ACCEPTED_REVISION_REQUIRED');
     const agreed=amount(input.amountCents);
     if(agreed!==state.quote?.amount_cents)fail('AGREEMENT_MUST_MATCH_ACCEPTED_QUOTE');
     const signed=date(input.signedOn);if(signed>day(now))fail('FUTURE_AGREEMENT_DATE',400);
     evidence=text(input.reference);
     if(state.agreement){
      if(agreed!==state.agreement.amount_cents||signed<state.agreement.signed_on)fail('CONTRACT_ENDORSEMENT_INVALID');
      this.db.prepare('INSERT INTO commercial_agreement_endorsements VALUES (?,?,?,?,?,?,?,?,?)').run(target,projectId,state.agreement.id,input.quoteId,signed,text(input.terms,2000),evidence,session.ownerId,now);
     }else this.db.prepare('INSERT INTO commercial_agreements VALUES (?,?,?,?,?,?,?,?)').run(target,projectId,input.quoteId,agreed,'USD',signed,text(input.terms,2000),evidence);
     break;
    }
    case 'invoice_draft': {
     if(!state.agreement||state.stage==='completed')fail('ACTIVE_AGREEMENT_REQUIRED');
     const number=text(input.number,80),value=amount(input.amountCents);
     if(this.db.prepare('SELECT 1 FROM commercial_invoices WHERE number=?').get(number))fail('DUPLICATE_INVOICE_NUMBER');
     if(total(state.invoices.filter(i=>i.status!=='cancelled'))+value>state.agreement!.amount_cents)fail('INVOICES_EXCEED_AGREEMENT');
     this.db.prepare('INSERT INTO commercial_invoices VALUES (?,?,?,?,?,?,?)').run(target,projectId,state.agreement!.id,number,value,'USD',date(input.dueOn));break;
    }
    case 'invoice_issue':
    case 'invoice_cancel': {
     const invoice=state.invoices.find(i=>i.id===input.invoiceId);
     if(!invoice)fail('INVOICE_SCOPE_REQUIRED',403);
     target=input.invoiceId;
     if(input.action==='invoice_issue'){
      evidence=date(input.date);
      if(invoice!.status!=='draft'||evidence>day(now)||evidence<state.agreement!.signed_on||evidence>invoice!.due_on)fail('INVOICE_ISSUE_INVALID');
     }else{
      if(invoice!.status==='cancelled'||invoice!.paidCents>0)fail('INVOICE_CANCEL_INVALID');
      evidence=text(input.reference);
     }
     break;
    }
    case 'receipt':
    case 'expense': {
     if(!state.agreement||state.stage==='completed')fail('ACTIVE_AGREEMENT_REQUIRED');
     const value=amount(input.amountCents),paid=date(input.date);
     if(paid>day(now)||paid<state.agreement!.signed_on)fail('PAYMENT_DATE_INVALID',400);
     evidence=text(input.reference);
     if(this.db.prepare('SELECT 1 FROM commercial_cash WHERE kind=? AND reference=?').get(input.action,evidence))fail('DUPLICATE_PAYMENT_REFERENCE');
     if(input.action==='expense'&&input.invoiceId)fail('EXPENSE_CANNOT_PAY_CLIENT_INVOICE',400);
     if(input.invoiceId){
      const invoice=state.invoices.find(i=>i.id===input.invoiceId);
      if(!invoice)fail('INVOICE_SCOPE_REQUIRED',403);
      if(!invoice!.issuedOn||paid<invoice!.issuedOn||value>invoice!.outstandingCents)fail('PAYMENT_EXCEEDS_OUTSTANDING_OR_INVOICE_NOT_PAYABLE');
     }
     if(input.action==='receipt'&&state.cashCents+value>state.agreement!.amount_cents)fail('RECEIPTS_EXCEED_AGREEMENT');
     this.db.prepare('INSERT INTO commercial_cash VALUES (?,?,?,?,?,?,?,?,?,?)').run(target,projectId,input.invoiceId??null,input.action,value,'USD',paid,text(input.method,80),evidence,session.ownerId);
     break;
    }
    case 'delivery_start':
     if(!this.db.prepare("SELECT 1 FROM approval_decisions WHERE binding_id=? AND gate='activation' AND decision='approve'").get(binding.id)||
       !this.db.prepare('SELECT financial_project_id FROM client_projects WHERE id=?').pluck().get(projectId))fail('FINAL_ACTIVATION_REQUIRED');
     if(state.stage!=='agreement_confirmed')fail('ACTIVE_AGREEMENT_REQUIRED');
     evidence=text(input.reference);break;
    case 'complete':
     if(state.stage!=='delivery'||state.receivableCents||state.invoices.some(i=>i.status==='draft')||state.cashCents!==state.agreement?.amount_cents)fail('DELIVERY_OR_RECEIVABLES_UNRESOLVED');
     evidence=text(input.reference);break;
    default: fail('INVALID_ACTION',400);
   }
   this.db.prepare('INSERT INTO commercial_events(project_id,owner_id,action,target_id,evidence,occurred_at,request_key,request_hash) VALUES (?,?,?,?,?,?,?,?)')
    .run(projectId,session.ownerId,input.action,target,evidence,now,requestKey,requestHash);
   return this.read(projectId,now);
  }).immediate();
 }
}
