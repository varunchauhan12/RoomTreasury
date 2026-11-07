import {AgencyEngine} from '../domain/agency-engine.js';
import {randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {OwnerSession} from '../security/owner-auth.js';
import {AuthError} from '../security/service-auth.js';
import {activeSession,bindingAuthorized,hash,key,type Binding} from '../jobs/bindings.js';
import {OwnerReview} from '../reviews/service.js';
import {authenticationBlockers} from '../reviews/auth-policy.js';
import {CommercialLedger} from '../commercial/service.js';
import {ProcessingJobs,jobView,type Job} from '../jobs/service.js';
import {gateChecks,gateDependencies,gateOrder,intakeSubject,requireIntake,sectionSpecialists,type Gate,type Section} from './policy.js';

interface Decision {id:string;gate:Gate;subject_hash:string;revision_id:string|null;fingerprint:string|null;job_id:string|null;owner_id:string;decision:'approve'|'reject'|'changes'|'blocked';reason:string;evidence:string;checklist:string;created_at:number}
interface Analysis {id:string;revision:number;source_import_id:string|null;source_revision_id:string|null;sections:string;specialists:string;instructions:string}
export interface DecisionInput {
 gate:Gate;subjectHash:string;decision:Decision['decision'];reason:string;evidence:string[];checks?:string[];sections?:Section[];
}
const fail=(code:string):never=>{throw new AuthError(409,code);};
export class ApprovalWorkflow {
 constructor(private readonly db:Database){}
 private binding(session:OwnerSession,projectId:string):Binding{
  activeSession(this.db,session);
  const id=this.db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').pluck().get(projectId) as string|undefined;
  return bindingAuthorized(this.db,session.ownerId,id??'');
 }
 snapshot(session:OwnerSession,projectId:string){
  return this.db.transaction(()=>{
   const b=this.binding(session,projectId);
   const project=this.db.prepare('SELECT * FROM client_projects WHERE id=?').get(projectId) as {financial_project_id:string|null;brief:string};
   const approvedId=this.db.prepare("SELECT id FROM delivery_proposals WHERE client_project_id=? AND status='approved'").pluck().get(projectId) as string|undefined;
   const financial=approvedId?new AgencyEngine(this.db).economics(projectId,approvedId):null;
   const linked=this.db.prepare('SELECT p.id,l.job_id FROM proposal_imports p JOIN project_import_links l ON l.import_id=p.id WHERE l.binding_id=? ORDER BY p.revision DESC LIMIT 1').get(b.id) as {id:string;job_id:string}|undefined;
   const review=linked?new OwnerReview(this.db).snapshot(linked.id):null;
   const commercial=new CommercialLedger(this.db).snapshot(session,projectId);
   const decisions=this.db.prepare('SELECT * FROM approval_decisions WHERE binding_id=? ORDER BY rowid').all(b.id) as Decision[];
   const analysis=(this.db.prepare('SELECT * FROM analysis_revisions WHERE binding_id=? ORDER BY revision DESC LIMIT 1').get(b.id) as Analysis|undefined)??null;
   const analysisJob=analysis?this.db.prepare('SELECT j.* FROM processing_jobs j JOIN analysis_revision_jobs l ON l.job_id=j.id WHERE l.analysis_revision_id=?').get(analysis.id) as Job|undefined:null;
   const latestAttempt=this.db.prepare('SELECT id,result_import_id FROM processing_jobs WHERE binding_id=? ORDER BY attempt DESC LIMIT 1').get(b.id) as {id:string;result_import_id:string|null}|undefined;
   const pendingAnalysis=Boolean(analysis&&(!analysisJob||!analysisJob.result_import_id||analysisJob.result_import_id!==linked?.id));
   const proposalHash=hash(JSON.stringify([intakeSubject(this.db,b.id),linked?.id,linked?.job_id,review?.revision.id,review?.revision.fingerprint,analysis?.id,latestAttempt?.id]));
   const commercialHash=hash(JSON.stringify([proposalHash,commercial.quote,commercial.agreement]));
   const verifications=review?.verifications??[];
   const financialHash=hash(JSON.stringify([commercialHash,verifications,review?.notes]));
   const subjects={intake:intakeSubject(this.db,b.id),proposal:proposalHash,commercial:commercialHash,financial:financialHash,activation:financialHash};
   const gates: {dependsOn:readonly Gate[];checks:readonly string[];id:Gate;subjectHash:string;status:string;decision:Decision|null;blockers:string[];actions:string[];reviewer:string}[]=[];
   for(const gate of gateOrder){
    const latestNegative=decisions.filter(d=>d.gate===gate&&d.decision!=='approve').at(-1);
    const subjectHash=gate!=='intake'&&latestNegative?hash(JSON.stringify([subjects[gate],latestNegative.id])):subjects[gate];
    const exact=decisions.filter(d=>d.gate===gate&&d.subject_hash===subjectHash).at(-1)??null;
    const decision=exact??latestNegative??null;
    const blockers:string[]=[];
    for(const dependency of gateDependencies[gate])if(gates.find(g=>g.id===dependency)?.status!=='approved')blockers.push('Previous gate requires approval: '+dependency);
    if(gate!=='intake'&&!review)blockers.push('A valid project-linked proposal import is required.');
    if(gate!=='intake'&&latestAttempt&&latestAttempt.result_import_id!==linked?.id)blockers.push('The latest processing attempt awaits its own validated result.');
    if(gate!=='intake'&&pendingAnalysis)blockers.push('Requested analysis revision awaits a new validated artifact import.');
    if(gate==='commercial'||gate==='financial'||gate==='activation'){
     if(!commercial.agreement)blockers.push('Signed agreement and recorded client acceptance required.');
     const quote=commercial.quote;
     if(!quote||quote.import_id!==linked?.id||quote.review_revision_id!==review?.revision.id||quote.fingerprint!==review?.revision.fingerprint)blockers.push('Commercial quote must reference this exact imported proposal revision and fingerprint.');
     if(commercial.agreement?.quote_id!==quote?.id)blockers.push('Agreement must reference the exact accepted quote.');
     if(commercial.agreedCents!==review?.revision.proposal.project.agreedRevenueCents)blockers.push('Verified proposal revenue and signed contract amount must agree.');
    }
    if((gate==='financial'||gate==='activation')&&review){
     blockers.push(...review.blockers,...authenticationBlockers(this.db,linked!.id));
     if(!this.db.prepare("SELECT 1 FROM schema_migrations WHERE version=1 AND mode IN ('demo','test')").get())blockers.push('Existing delivery activation policy supports synthetic demo/test only.');
    }
    const status=exact?.decision==='approve'&&!blockers.length?'approved':decision?.decision==='changes'?'changes_requested':
     decision?.decision==='reject'?'rejected':blockers.length||decision?.decision==='blocked'?'blocked':'awaiting_owner';
    gates.push({id:gate,dependsOn:gateDependencies[gate],subjectHash,status,decision,blockers,checks:gateChecks[gate],actions:project.financial_project_id?[]:blockers.length?['changes','reject','blocked']:['approve','changes','reject','blocked'],reviewer:session.ownerId});
   }
   const report=this.db.prepare('SELECT id,version,revision_id,fingerprint,created_at FROM approval_reports WHERE binding_id=? ORDER BY version DESC LIMIT 1').get(b.id);
   return {project,financial,projectId,taskId:b.task_id,bindingId:b.id,jobId:linked?.job_id??null,review,commercial,gates,decisions,
    analysis:analysis?{...analysis,sections:JSON.parse(analysis.sections),specialists:JSON.parse(analysis.specialists),job:analysisJob?jobView(analysisJob):null,pending:pendingAnalysis}:null,
    report:report??null,active:Boolean(project.financial_project_id)};
  })();
 }
 decide(session:OwnerSession,projectId:string,input:DecisionInput,requestKey:string){
  return this.db.transaction(()=>{
   const b=this.binding(session,projectId);key(requestKey);
   if(!gateOrder.includes(input.gate)||!input.reason.trim()||input.reason.length>4000||!input.evidence.length||
      input.evidence.some(e=>!e.trim()||e.length>1000))throw new AuthError(400,'REASON_AND_EVIDENCE_REQUIRED');
   const requestHash=hash(JSON.stringify(input));
   const duplicate=this.db.prepare('SELECT request_hash FROM approval_decisions WHERE binding_id=? AND request_key=?').get(b.id,requestKey) as {request_hash:string}|undefined;
   if(duplicate){if(duplicate.request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT');return this.snapshot(session,projectId);}
   const state=this.snapshot(session,projectId),gate=state.gates.find(g=>g.id===input.gate)!;
   if(input.subjectHash!==gate.subjectHash)fail('STALE_APPROVAL_SUBJECT');
   if(this.db.prepare('SELECT 1 FROM approval_decisions WHERE binding_id=? AND gate=? AND subject_hash=? AND decision=?').get(b.id,input.gate,gate.subjectHash,input.decision))fail('GATE_ALREADY_DECIDED_FOR_SUBJECT');
   if(!gate.actions.includes(input.decision))fail('APPROVAL_GATE_BLOCKED');
   if(input.decision==='approve'&&gateChecks[input.gate].some(check=>!input.checks?.includes(check)))fail('OWNER_CHECKLIST_REQUIRED');
   if(Date.now()-session.createdAt>900000)throw new AuthError(401,'RECENT_OWNER_LOGIN_REQUIRED');
   const id=randomUUID(),revision=state.review?.revision;
   this.db.prepare('INSERT INTO approval_decisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,b.id,input.gate,gate.subjectHash,
    revision?.id??null,revision?.fingerprint??null,state.jobId,session.ownerId,input.decision,input.reason,JSON.stringify(input.evidence),JSON.stringify(input.checks??[]),Date.now(),requestKey,requestHash);
   if(input.decision==='changes'){
    const sections=input.sections??[];
    if(!sections.length||sections.some(s=>!Object.hasOwn(sectionSpecialists,s)))throw new AuthError(400,'AFFECTED_SECTIONS_REQUIRED');
    if(state.active)fail('ACTIVE_DELIVERY_AMENDMENTS_DEFERRED');
    const number=(state.analysis?.revision??0)+1;
    const specialists=[...new Set(sections.flatMap(section=>sectionSpecialists[section]))];
    const importId=state.review?.revision.import_id??null;
    this.db.prepare('INSERT INTO analysis_revisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),b.id,number,id,
     importId,revision?.id??null,revision?.fingerprint??null,revision?JSON.stringify(revision.proposal):null,
     JSON.stringify(sections),JSON.stringify(specialists),input.reason,Date.now());
   }
   if(input.gate==='activation'&&input.decision==='approve'){
    requireIntake(this.db,b.id);
    const fresh=this.snapshot(session,projectId);
    if(fresh.gates.some(g=>g.id!=='activation'&&g.status!=='approved')||fresh.gates[4]!.blockers.length)fail('APPROVAL_GATE_BLOCKED');
    const importId=state.review!.revision.import_id;
    const owner=Object.freeze({kind:'human' as const,role:'owner' as const,id:session.ownerId,projectId:b.task_id});
    const result=new OwnerReview(this.db).decide(owner,importId,revision!.id,revision!.fingerprint,'APPROVED_SYNTHETIC_DELIVERY') as {id:string};
    this.db.prepare("INSERT INTO authenticated_review_events(owner_id,session_digest,import_id,revision_id,fingerprint,action,target_id,gate,occurred_at,auth_basis) VALUES (?,?,?,?,?,'decision',?,NULL,?,'authenticated_owner_session')")
      .run(session.ownerId,session.digest,importId,revision!.id,revision!.fingerprint,result.id,Date.now());
   }
   this.report(session,projectId);
   return this.snapshot(session,projectId);
  }).immediate();
 }
 private report(session:OwnerSession,projectId:string){
  const state=this.snapshot(session,projectId);
  const version=(this.db.prepare('SELECT coalesce(max(version),0)+1 FROM approval_reports WHERE binding_id=?').pluck().get(state.bindingId) as number);
  const snapshot=JSON.stringify({...state,report:null});
  const previous=this.db.prepare('SELECT snapshot_hash FROM approval_reports WHERE binding_id=? ORDER BY version DESC LIMIT 1').pluck().get(state.bindingId);
  if(previous===hash(snapshot))return;
  this.db.prepare('INSERT INTO approval_reports VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),state.bindingId,version,
   state.review?.revision.import_id??null,state.review?.revision.id??null,state.review?.revision.fingerprint??null,snapshot,hash(snapshot),Date.now());
 }
 regenerate(session:OwnerSession,projectId:string){return this.db.transaction(()=>{this.report(session,projectId);return this.snapshot(session,projectId);}).immediate();}
 reports(session:OwnerSession,projectId:string){
  const b=this.binding(session,projectId);
  return this.db.prepare('SELECT id,version,revision_id,fingerprint,snapshot,snapshot_hash,created_at FROM approval_reports WHERE binding_id=? ORDER BY version DESC').all(b.id);
 }
 reanalyze(session:OwnerSession,projectId:string,requestKey:string){
  return this.db.transaction(()=>{
   const state=this.snapshot(session,projectId);
   if(!state.analysis||!state.analysis.pending)fail('NO_PENDING_ANALYSIS_REVISION');
   if(state.analysis!.job)return state.analysis!.job;
   requireIntake(this.db,state.bindingId);
   const job=new ProcessingJobs(this.db).create(session,state.bindingId,requestKey,'discord');
   this.db.prepare('INSERT OR IGNORE INTO analysis_revision_jobs VALUES (?,?)').run(state.analysis!.id,job.id);
   return jobView(job);
  }).immediate();
 }
}
