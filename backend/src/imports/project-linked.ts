import type {Database} from 'better-sqlite3';
import type {OwnerSession} from '../security/owner-auth.js';
import {activeSession,bindingAuthorized,mockMode,hash} from '../jobs/bindings.js';
import type {Binding} from '../jobs/bindings.js';
import type {Job} from '../jobs/service.js';
import {AuthError} from '../security/service-auth.js';
import {ImportError,validateBundle,importBundle,type ImportBundle} from './service.js';

interface Link {import_id:string;job_id:string;binding_id:string;intake_revision:number;intake_hash:string;bundle_fingerprint:string;owner_id:string;session_digest:string;source:string;created_at:number}
export function projectImportLink(db:Database,importId:string):Link|undefined {
 return db.prepare('SELECT * FROM project_import_links WHERE import_id=?').get(importId) as Link|undefined;
}
export function checkLinkedTerms(db:Database,binding:Binding,payload:ReturnType<typeof validateBundle>['proposal']):void {
 const client=db.prepare('SELECT client_name,brief,revenue_cents FROM client_projects WHERE id=?').get(binding.client_project_id) as {client_name:string;brief:string;revenue_cents:number}|undefined;
 if(!client||payload.taskId!==binding.task_id||payload.client.name!==client.client_name||payload.project.brief!==client.brief||payload.project.agreedRevenueCents!==client.revenue_cents)throw new ImportError(['Proposal task, client, original brief and agreed revenue must match this authoritative project intake.'],409);
}
function context(db:Database,session:OwnerSession,projectId:string){
 mockMode(db);activeSession(db,session);
 const row=db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').get(projectId) as {id:string}|undefined;
 if(!row)throw new AuthError(403,'BOUND_OWNER_SCOPE_REQUIRED');
 const binding=bindingAuthorized(db,session.ownerId,row.id);
 const job=db.prepare('SELECT * FROM processing_jobs WHERE binding_id=? ORDER BY intake_revision DESC,attempt DESC LIMIT 1').get(binding.id) as Job|undefined;
 if(!job||!(job.state==='imported'||job.state==='needs_attention'&&job.error_code==='artifact_import_deferred'))throw new ImportError(['This project needs a completed mock processing record awaiting manual artifact upload. Running, uncertain, failed or cancelled jobs cannot accept results.'],409);
 if(job.submitting_owner_id!==binding.owner_id||hash(job.intake_snapshot)!==job.intake_hash)throw new ImportError(['The persisted processing context is inconsistent.'],409);
 const intake=JSON.parse(job.intake_snapshot);
 if(intake.projectId!==projectId||intake.taskId!==binding.task_id||intake.intakeRevision!==job.intake_revision)throw new ImportError(['The processing intake does not match the project binding.'],409);
 return {binding,job};
}
function checked(db:Database,bundle:ImportBundle,binding:Binding){
 if(!bundle.proposal||!bundle.evidence||!bundle.summary)throw new ImportError(['Upload all three files: proposal.json, evidence.json and summary.md.']);
 const validated=validateBundle(bundle);checkLinkedTerms(db,binding,validated.proposal);return validated;
}
export function previewProjectImport(db:Database,session:OwnerSession,projectId:string,bundle:ImportBundle){
 return db.transaction(()=>{
  const {binding,job}=context(db,session,projectId),validated=checked(db,bundle,binding);
  return {jobId:job.id,intakeRevision:job.intake_revision,intakeHash:job.intake_hash,fingerprint:validated.fingerprint,proposal:validated.proposal,
   warnings:['Manually uploaded package; individual agent identities are not authenticated.','Validated for this project and intake. Owner verification and exact-revision approval remain required.','The mock worker did not generate or collect these artifacts.']};
 })();
}
export function confirmProjectImport(db:Database,session:OwnerSession,projectId:string,bundle:ImportBundle,preview:{jobId:string;intakeHash:string;fingerprint:string}){
 return db.transaction(()=>{
  const {binding,job}=context(db,session,projectId),validated=checked(db,bundle,binding);
  if(preview.jobId!==job.id||preview.intakeHash!==job.intake_hash||preview.fingerprint!==validated.fingerprint)throw new ImportError(['The package or processing attempt changed after preview. Validate again.'],409);
  if(job.state==='imported'){
   const link=projectImportLink(db,job.result_import_id!);
   if(!link||link.bundle_fingerprint!==validated.fingerprint)throw new ImportError(['This attempt already has an immutable result. Start another explicit processing attempt for a changed package.'],409);
   return {id:link.import_id,jobId:job.id,duplicate:true};
  }
  const imported=importBundle(db,bundle,validated.fingerprint);
  const existing=projectImportLink(db,imported.id);
  if(existing)throw new ImportError(['This immutable package is already linked to another processing attempt.'],409);
  if(db.prepare('SELECT 1 FROM owner_review_revisions WHERE import_id=?').get(imported.id))throw new ImportError(['An existing legacy review cannot be reassigned to a project. Import a new proposal revision.'],409);
  db.prepare("INSERT INTO project_import_links VALUES (?,?,?,?,?,?,?,?,'authenticated_project_upload',?)").run(imported.id,job.id,binding.id,job.intake_revision,job.intake_hash,validated.fingerprint,session.ownerId,session.digest,Date.now());
  const now=Date.now();
  db.prepare("UPDATE processing_jobs SET state='imported',result_import_id=?,updated_at=?,completed_at=?,error_code=NULL,diagnostic=NULL,lease_owner=NULL,lease_until=NULL WHERE id=?").run(imported.id,now,now,job.id);
  db.prepare("INSERT INTO processing_job_events(job_id,event_key,from_state,to_state,code,occurred_at,actor_kind,actor_id) VALUES (?,'owner-artifact-import','needs_attention','imported','manual_project_upload',?,'owner',?)").run(job.id,now,session.ownerId);
  return {id:imported.id,jobId:job.id,duplicate:false};
 }).immediate();
}
