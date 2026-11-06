import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { AgencyEngine } from '../domain/agency-engine.js';
import type { FinancialActor, HumanActor } from '../domain/financial-engine.js';
import { denyServiceOwner } from '../security/service-auth.js';
import { ImportError, validateBundle } from '../imports/service.js';

export const gates={scope:'client_confirmed',deliverables_exclusions:'client_confirmed',acceptance_criteria:'client_confirmed',internal_rates:'owner_verified_internal',capacity:'owner_verified_internal',cost_contingency:'owner_verified_internal',revenue_payment_terms:'client_confirmed',financial_policy:'owner_verified_internal',margin_review:'owner_verified_internal'} as const;
export type Gate=keyof typeof gates;
interface Revision {id:string;import_id:string;parent_id:string|null;revision:number;fingerprint:string;payload:string;reason:string;source:string;author_id:string|null;created_at:number}
const reject=(message:string,status=409):never=>{throw new ImportError([message],status);};
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=8000;
export class OwnerReview {
 constructor(private readonly db:Database){}
 private write<T>(operation:()=>T):T{return this.db.transaction(()=>{
  const modes=this.db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();if(modes.length!==1||!['test','demo'].includes(modes[0] as string))reject('Review mutations require synthetic demo/test mode.',403);
  return operation();
 }).immediate();}
 private original(importId:string){const row=this.db.prepare('SELECT * FROM proposal_imports WHERE id=?').get(importId) as any;if(!row)reject('Imported proposal not found.',404);return row;}
 private root(importId:string):Revision {
  const stored=this.db.prepare('SELECT * FROM owner_review_revisions WHERE id=?').get(importId) as Revision|undefined;
  if(stored)return stored;
  const original=this.original(importId);
  return {id:importId,import_id:importId,parent_id:null,revision:0,fingerprint:original.proposal_fingerprint,payload:original.proposal_json,reason:'Original imported analysis; unverified.',source:'original_import',author_id:null,created_at:original.imported_at};
 }
 private ensure(importId:string):void{const root=this.root(importId);this.db.prepare('INSERT OR IGNORE INTO owner_review_revisions VALUES (?,?,?,?,?,?,?,?,?,?)').run(root.id,root.import_id,root.parent_id,root.revision,root.fingerprint,root.payload,root.reason,root.source,root.author_id,root.created_at);}
 private current(importId:string,id:string,fingerprint:string):Revision {
  const latest=(this.db.prepare('SELECT * FROM owner_review_revisions WHERE import_id=? ORDER BY revision DESC LIMIT 1').get(importId) as Revision|undefined)??this.root(importId);
  const original=this.original(importId);const latestImport=this.db.prepare('SELECT id FROM proposal_imports WHERE task_id=? ORDER BY revision DESC LIMIT 1').pluck().get(original.task_id);
  if(latestImport!==importId||latest.id!==id||latest.fingerprint!==fingerprint)reject('Stale proposal revision or fingerprint. Reload and review the current revision.');return latest;
 }
 private owner(actor:FinancialActor,importId:string):asserts actor is HumanActor {
  if(actor.kind==='service')denyServiceOwner(actor);
  if(actor.kind!=='human'||actor.role!=='owner'||actor.projectId!==this.original(importId).task_id||!text(actor.id))reject('Trusted project owner context required; no browser owner identity exists.',403);
 }
 snapshot(importId:string){return this.db.transaction(()=>{
  const root=this.root(importId);const revisions=this.db.prepare('SELECT * FROM owner_review_revisions WHERE import_id=? ORDER BY revision').all(importId) as Revision[];
  const revision=revisions.at(-1)??root,p=JSON.parse(revision.payload);
  const notes=this.db.prepare('SELECT * FROM owner_review_notes WHERE revision_id=? ORDER BY rowid').all(revision.id);
  const verifications=this.db.prepare('SELECT * FROM owner_review_verifications WHERE revision_id=?').all(revision.id) as {gate:Gate;fingerprint:string;note_id:string}[];
  const decision=this.db.prepare('SELECT * FROM owner_review_decisions WHERE revision_id=?').get(revision.id) as any;
  const blockers:string[]=[];
  for(const gate of Object.keys(gates) as Gate[])if(!verifications.some(v=>v.gate===gate&&v.fingerprint===revision.fingerprint))blockers.push('Verification required: '+gate);
  for(const verification of verifications){const latest=(notes as any[]).filter(n=>n.gate===verification.gate).at(-1);if(latest&&latest.id!==verification.note_id)blockers.push('New unverified note requires a fresh review revision: '+verification.gate);}
  if(!decision&&this.db.prepare('SELECT 1 FROM projects WHERE id=?').get('review-'+p.taskId))blockers.push('A delivery project already exists for this task; budget amendments require a separate workflow.');
  if(revision.revision===0)blockers.push('Original agent analysis cannot authorize delivery; create a separately reviewed revision.');
  if(p.status!=='READY_FOR_OWNER_REVIEW')blockers.push('Proposal status blocks approval: '+p.status);
  if(p.blockingReviews.length)blockers.push(...p.blockingReviews.map((s:string)=>'Proposal blocker: '+s));
  if(p.ownerDecisionRecommendation.recommendation!=='SEEK_OWNER_REVIEW')blockers.push('Owner recommendation still defers or rejects delivery approval.');
  const margin=p.project.agreedRevenueCents-p.proposal.budgetCents;
  const marginPercent=100*margin/p.project.agreedRevenueCents;
  if(marginPercent<15&&!verifications.some(v=>v.gate==='margin_review'))blockers.push('Explicit financial review required: low or negative projected margin.');
  if(p.proposal.budgetCents>1000000||p.project.agreedRevenueCents>1000000)blockers.push('Local review policy cap is 1,000,000 cents for revenue and delivery budget.');
  const latestImport=this.db.prepare('SELECT id FROM proposal_imports WHERE task_id=? ORDER BY revision DESC LIMIT 1').pluck().get(this.original(importId).task_id);if(latestImport!==importId)blockers.push('A newer imported proposal exists.');
  return {revision:{...revision,proposal:p},history:revisions.length?revisions:[root],notes,verifications,decision:decision??null,gates,blockers,status:decision?.decision??(blockers.length?'BLOCKED':'ELIGIBLE_FOR_TRUSTED_OWNER_REVIEW'),projectedGrossMarginCents:margin,projectedGrossMarginPercent:marginPercent,ownerHttpApprovalAvailable:false,authBasis:'trusted_domain_only_no_human_authentication',unresolvedQuestions:p.unresolvedQuestions};
 })();}
 recordNote(importId:string,id:string,fingerprint:string,gate:Gate,answer:string,reference:string,actor?:FinancialActor):string {
  return this.write(()=>{this.current(importId,id,fingerprint);if(actor)this.owner(actor,importId);
   if(!(Object.hasOwn(gates,gate))||!text(answer)||!text(reference))reject('Choose a checklist gate and provide an answer and evidence reference.',400);
   if(this.db.prepare('SELECT 1 FROM owner_review_decisions WHERE revision_id=?').get(id))reject('Review already decided.');
   this.ensure(importId);const noteId=randomUUID();this.db.prepare('INSERT INTO owner_review_notes VALUES (?,?,?,?,?,?,?,?)').run(noteId,id,gate,answer,reference,actor?'trusted_owner_note':'unverified_human_note',actor?.kind==='human'?actor.id:null,Date.now());return noteId;
  });
 }
 verifyGate(actor:FinancialActor,importId:string,id:string,fingerprint:string,noteId:string,origin:typeof gates[Gate],facts:{rateCentsPerHour?:number;capacityHours?:number;paymentTerms?:string;policyLimitCents?:number;acceptLowMargin?:boolean;reason?:string}={}):void {
  this.write(()=>{this.owner(actor,importId);this.current(importId,id,fingerprint);
   const note=this.db.prepare('SELECT * FROM owner_review_notes WHERE id=? AND revision_id=?').get(noteId,id) as any;if(!note||gates[note.gate as Gate]!==origin)reject('Explicit fact classification does not match this gate.',400);
   if(this.db.prepare('SELECT 1 FROM owner_review_decisions WHERE revision_id=?').get(id))reject('Review already decided.');
   if(this.db.prepare('SELECT id FROM owner_review_notes WHERE revision_id=? AND gate=? ORDER BY rowid DESC LIMIT 1').pluck().get(id,note.gate)!==noteId)reject('Verify the latest note; earlier answers may be stale.');
   const p=JSON.parse(this.current(importId,id,fingerprint).payload);
   if(note.gate==='internal_rates'&&(!Number.isSafeInteger(facts.rateCentsPerHour)||(facts.rateCentsPerHour ?? 0)<1||p.executionPlan.estimatedTotalHours*(facts.rateCentsPerHour ?? 0)!==p.financialSummary.baseEstimatedCostCents))reject('Verified rate must reproduce the revised base cost.',400);
   if(note.gate==='capacity'&&(!Number.isFinite(facts.capacityHours)||(facts.capacityHours ?? 0)<p.executionPlan.estimatedTotalHours))reject('Assigned capacity must cover the revised delivery hours.',400);
   if(note.gate==='revenue_payment_terms'&&!text(facts.paymentTerms))reject('Explicit agreed payment terms required; revenue is not received cash.',400);
   if(note.gate==='financial_policy'&&(!Number.isSafeInteger(facts.policyLimitCents)||(facts.policyLimitCents ?? 0)>1000000||(facts.policyLimitCents ?? 0)<p.proposal.budgetCents))reject('Explicit policy ceiling must cover the budget within the demo cap.',400);
   const marginPercent=100*(p.project.agreedRevenueCents-p.proposal.budgetCents)/p.project.agreedRevenueCents;
   if(note.gate==='margin_review'&&(!text(facts.reason)||(marginPercent<15&&facts.acceptLowMargin!==true)))reject('Explicit financial rationale and low/negative-margin acknowledgment required.',400);
   this.db.prepare('INSERT INTO owner_review_verifications VALUES (?,?,?,?,?,?,?,?)').run(id,fingerprint,note.gate,noteId,origin,actor.id,Date.now(),JSON.stringify(facts));
  });
 }
 revise(actor:FinancialActor,importId:string,id:string,fingerprint:string,payload:unknown,reason:string):string {
  return this.write(()=>{this.owner(actor,importId);const parent=this.current(importId,id,fingerprint);if(!text(reason))reject('Revision reason required.',400);
   if(this.db.prepare("SELECT 1 FROM owner_review_decisions WHERE import_id=? AND decision='APPROVED_SYNTHETIC_DELIVERY'").get(importId))reject('Review already decided.');
   const original=this.original(importId);const bundle={proposal:{name:'revision.json',content:JSON.stringify(payload)}};const valid=validateBundle(bundle);
   if(valid.proposal.taskId!==original.task_id)reject('Revisions must preserve the original task identity.',400);
   if(valid.proposalFingerprint===parent.fingerprint)reject('Materially unchanged proposal; record a note instead.');
   this.ensure(importId);const revisedId=randomUUID();this.db.prepare('INSERT INTO owner_review_revisions VALUES (?,?,?,?,?,?,?,?,?,?)').run(revisedId,importId,id,parent.revision+1,valid.proposalFingerprint,valid.original,reason,'trusted_owner_revision',actor.id,Date.now());return revisedId;
  });
 }
 decide(actor:FinancialActor,importId:string,id:string,fingerprint:string,decision:'DEFERRED'|'REJECTED'|'APPROVED_SYNTHETIC_DELIVERY') {
  return this.write(()=>{this.owner(actor,importId);const revision=this.current(importId,id,fingerprint);
   if(!['DEFERRED','REJECTED','APPROVED_SYNTHETIC_DELIVERY'].includes(decision))reject('Invalid decision.',400);
   const existing=this.db.prepare('SELECT * FROM owner_review_decisions WHERE revision_id=?').get(id) as any;
   if(existing){if(existing.revision_id!==id||existing.fingerprint!==fingerprint||existing.decision!==decision)reject('Conflicting review decision.');return existing;}
   this.ensure(importId);let projectId:string|null=null;
   if(decision==='APPROVED_SYNTHETIC_DELIVERY'){
    const review=this.snapshot(importId);if(review.blockers.length)throw new ImportError(review.blockers);
    const p=validateBundle({proposal:{name:'approved-revision.json',content:revision.payload}}).proposal;
    projectId='review-'+p.taskId;const financialActor:HumanActor=Object.freeze({kind:'human',role:'owner',id:actor.id,projectId});
    const agency=new AgencyEngine(this.db);agency.createClientProject(financialActor,projectId,p.client.name,p.project.brief,p.project.agreedRevenueCents);
    const proposal=agency.createProposal(financialActor,projectId,{budgetCents:p.proposal.budgetCents,explanation:p.proposal.explanation,allocations:p.proposal.allocations.map((a:any)=>({name:a.workstream,limitCents:a.limitCents}))});
    agency.approveProposal(financialActor,projectId,proposal.proposalId);
   }
   const decisionId=randomUUID();this.db.prepare("INSERT INTO owner_review_decisions VALUES (?,?,?,?,?,?,?,?,'trusted_domain_context')").run(decisionId,importId,id,fingerprint,actor.id,decision,projectId,Date.now());
   return this.db.prepare('SELECT * FROM owner_review_decisions WHERE id=?').get(decisionId);
  });
 }
}
