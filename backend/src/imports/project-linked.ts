import {requireIntake} from '../approvals/policy.js';
import {recordImportedReport} from '../approvals/reports.js';
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
 const candidateRevenue = payload.project.agreedRevenueCents ?? payload.project.proposedRevenueCents;
 if(!client||payload.taskId!==binding.task_id||payload.client.name!==client.client_name||payload.project.brief!==client.brief||candidateRevenue!==client.revenue_cents)throw new ImportError(['Proposal task, client, original brief and agreed revenue must match this authoritative project intake.'],409);
}
function context(db:Database,session:OwnerSession,projectId:string){
 mockMode(db);activeSession(db,session);
 const row=db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').get(projectId) as {id:string}|undefined;
 if(!row)throw new AuthError(403,'BOUND_OWNER_SCOPE_REQUIRED');
 const binding=bindingAuthorized(db,session.ownerId,row.id);
 const job=db.prepare('SELECT * FROM processing_jobs WHERE binding_id=? ORDER BY intake_revision DESC,attempt DESC LIMIT 1').get(binding.id) as Job|undefined;
 if(!job||!(job.state==='imported'||job.state==='needs_attention'&&(job.error_code==='artifact_import_deferred'||job.error_code==='artifact_validation_failed'||job.transport==='discord'&&job.error_code==='discord_missing_attachments')))throw new ImportError(['This project needs an eligible completed processing record awaiting artifact recovery. Running, uncertain, failed or cancelled jobs cannot accept results.'],409);
 if(job.submitting_owner_id!==binding.owner_id||hash(job.intake_snapshot)!==job.intake_hash)throw new ImportError(['The persisted processing context is inconsistent.'],409);
 const intake=JSON.parse(job.intake_snapshot);
 if(intake.projectId!==projectId||intake.taskId!==binding.task_id||intake.intakeRevision!==job.intake_revision)throw new ImportError(['The processing intake does not match the project binding.'],409);
 return {binding,job};
}
function checked(db:Database,bundle:ImportBundle,binding:Binding,job:Job){
 if(!bundle.proposal||!bundle.evidence||!bundle.summary)throw new ImportError(['Upload all three files: proposal.json, evidence.json and summary.md.']);
 const validated=validateBundle(bundle);checkLinkedTerms(db,binding,validated.proposal);
 const metadata=validated.normalization.binding;
 if(job.error_code==='discord_missing_attachments'&&!metadata)throw new ImportError(['Discord recovery requires original bound coordinator artifacts.'],409);
 if(metadata&&(metadata.projectId!==binding.client_project_id||metadata.taskId!==binding.task_id||metadata.processingJobId!==job.id||metadata.correlationId!==job.correlation_id||metadata.intakeRevision!==job.intake_revision||metadata.intakeSha256!==job.intake_hash))throw new ImportError(['Artifact binding does not match this exact processing job and intake revision.'],409);
 if(metadata&&[bundle.proposal.name,bundle.evidence!.name,bundle.summary!.name].join('|')!=='proposal.json|evidence.json|summary.md')throw new ImportError(['Bound recovery requires proposal.json, evidence.json and summary.md.']);
 return validated;
}
export function previewProjectImport(db:Database,session:OwnerSession,projectId:string,bundle:ImportBundle){
 return db.transaction(()=>{
  const {binding,job}=context(db,session,projectId),validated=checked(db,bundle,binding,job);
  return {jobId:job.id,intakeRevision:job.intake_revision,intakeHash:job.intake_hash,fingerprint:validated.fingerprint,proposal:validated.proposal,
   warnings:[...validated.warnings,'Manually uploaded package; individual agent identities are not authenticated.','Validated for this project and intake. Owner verification and exact-revision approval remain required.','The mock worker did not generate or collect these artifacts.']};
 })();
}
export function confirmProjectImport(db:Database,session:OwnerSession,projectId:string,bundle:ImportBundle,preview:{jobId:string;intakeHash:string;fingerprint:string}){
 return db.transaction(()=>{
  const {binding,job}=context(db,session,projectId),validated=checked(db,bundle,binding,job);
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
  recordImportedReport(db,imported.id);
  return {id:imported.id,jobId:job.id,duplicate:false};
 }).immediate();
}
export function importDiscordPackage(db:Database,jobId:string,bundle:ImportBundle):{id:string;duplicate:boolean}{
 return db.transaction(()=>{
  const job=db.prepare('SELECT * FROM processing_jobs WHERE id=?').get(jobId) as Job|undefined;
  if(!job)throw new ImportError(['Processing job not found.'],404);
  const binding=db.prepare('SELECT * FROM project_task_bindings WHERE id=?').get(job.binding_id) as Binding|undefined;
  if(!binding)throw new ImportError(['Project binding not found.'],404);
  if(!bundle.proposal||!bundle.evidence||!bundle.summary)throw new ImportError(['All three files are required: proposal.json, evidence.json and summary.md.']);
  const validated=checked(db,bundle,binding,job);
  if(!validated.normalization.binding)throw new ImportError(['Automatic Discord imports require exact project, job and intake binding in the artifacts.'],409);
  bindingAuthorized(db,job.submitting_owner_id,binding.id);
  requireIntake(db,binding.id);
  if(job.state==='imported'){
   const link=projectImportLink(db,job.result_import_id!);
   if(!link||link.bundle_fingerprint!==validated.fingerprint)throw new ImportError(['This attempt already has an immutable result.'],409);
   return {id:link.import_id,duplicate:true};
  }
  if(job.transport!=='discord'||job.state!=='validating'||!job.lease_owner||job.lease_until===null||job.lease_until<=Date.now()){
   throw new ImportError(['The Discord job is no longer actively validating.'],409);
  }
  const imported=importBundle(db,bundle,validated.fingerprint);
  const existing=projectImportLink(db,imported.id);
  if(existing)throw new ImportError(['This immutable package is already linked to another processing attempt.'],409);
  const now=Date.now();
  db.prepare("INSERT INTO project_import_links(import_id,job_id,binding_id,intake_revision,intake_hash,bundle_fingerprint,owner_id,session_digest,source,created_at) VALUES (?,?,?,?,?,?,?,NULL,'discord_agent_delivery',?)").run(imported.id,job.id,binding.id,job.intake_revision,job.intake_hash,validated.fingerprint,job.submitting_owner_id,now);
  db.prepare("UPDATE processing_jobs SET state='imported',result_import_id=?,updated_at=?,completed_at=?,error_code=NULL,diagnostic=NULL,lease_owner=NULL,lease_until=NULL WHERE id=?").run(imported.id,now,now,job.id);
  db.prepare("INSERT INTO processing_job_events(job_id,event_key,from_state,to_state,code,occurred_at,actor_kind,actor_id) VALUES (?,'discord-artifact-import',?,'imported','discord_agent_delivery',?,'backend','discord-transport')").run(job.id,job.state,now);
  recordImportedReport(db,imported.id);
  return {id:imported.id,duplicate:false};
 }).immediate();
}

// Explicit authenticated recovery of an existing delivery; never dispatches or changes financial state.
export async function retrieveProjectArtifacts(db:Database,session:OwnerSession,projectId:string,client:import('../discord/client.js').DiscordRestClient,config:import('../discord/config.js').DiscordConfig){
 const {job}=context(db,session,projectId);
 if(job.transport!=='discord'||job.state!=='needs_attention'||job.error_code!=='discord_missing_attachments')throw new ImportError(['Only a missing-attachment Discord job can retrieve an existing delivery.'],409);
 const records=db.prepare("SELECT raw_json FROM discord_messages WHERE job_id=? AND agent_role='coordinator' ORDER BY occurred_at,id").all(job.id) as {raw_json:string}[];
 const stored=records.map(row=>JSON.parse(row.raw_json) as import('../discord/client.js').DiscordMessage);
 const anchor=stored.find(m=>m.channel_id===config.channelId&&m.attachments.some(a=>a.filename==='proposal.json'));
 const marker=stored.find(m=>m.content.includes('ROOMTREASURY_RESULT_READY job='+job.id)&&m.content.includes('correlation='+job.correlation_id));
 if(!anchor||!marker)throw new ImportError(['A persisted coordinator package and exact completion marker are required.'],409);
 const messages=[anchor];let after=anchor.id;
 for(let page=0;page<3;page++){
  const history=await client.getMessages(config.channelId,{after,limit:100});
  const ordered=history.filter(m=>/^\d{17,21}$/.test(m.id)).sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
  messages.push(...ordered.filter(m=>m.channel_id===anchor.channel_id&&(!m.guild_id||m.guild_id===config.guildId)&&m.author.id===anchor.author.id&&m.author.username===anchor.author.username&&BigInt(m.id)>BigInt(anchor.id)&&BigInt(m.id)<=BigInt(marker.id)));
  if(ordered.some(m=>BigInt(m.id)>=BigInt(marker.id))||history.length<100)break;
  const cursor=ordered.at(-1)?.id;if(!cursor||cursor===after)break;after=cursor;
 }
 const limits={'proposal.json':262144,'evidence.json':524288,'summary.md':65536};
 const files=new Map<string,{message:import('../discord/client.js').DiscordMessage;file:import('../discord/client.js').FetchedAttachment}>();
 for(const message of messages)for(const attachment of message.attachments){
  const limit=limits[attachment.filename as keyof typeof limits];if(!limit)continue;
  const file=await client.fetchAttachment(attachment,limit);
  // Attachment-only messages must prove the binding from downloaded bytes, not temporal proximity.
  const {DiscordMessageCollector}=await import('../discord/collector.js');
  const collector=new DiscordMessageCollector(db,config,client);
  if(!await collector.correlateMessage(message,job.id,job.correlation_id,JSON.parse(job.intake_snapshot).taskId))continue;
  const previous=files.get(attachment.filename);if(previous&&previous.file.id!==file.id)throw new ImportError(['Ambiguous duplicate artifact delivery; select original files manually.'],409);
  files.set(attachment.filename,{message,file});
 }
 if(files.size!==3)throw new ImportError(['The original three bound Discord artifacts could not all be recovered.'],409);
 const bundle:ImportBundle={proposal:{name:'proposal.json',content:files.get('proposal.json')!.file.contentText},evidence:{name:'evidence.json',content:files.get('evidence.json')!.file.contentText},summary:{name:'summary.md',content:files.get('summary.md')!.file.contentText}};
 return db.transaction(()=>{
  const current=context(db,session,projectId);if(current.job.id!==job.id)throw new ImportError(['Processing context changed during retrieval.'],409);
  const validated=checked(db,bundle,current.binding,current.job);
  for(const {message,file} of files.values()){
   const existing=db.prepare('SELECT job_id FROM discord_messages WHERE id=?').get(message.id) as {job_id:string}|undefined;
   if(existing&&existing.job_id!==job.id)throw new ImportError(['Discord message already belongs to another job.'],409);
   if(!existing)db.prepare('INSERT INTO discord_messages VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(message.id,job.id,message.channel_id,message.author.id,message.author.username,message.author.bot?1:0,'coordinator','make-proposal-agent',message.content,JSON.stringify(message),Date.parse(message.timestamp),Date.now());
   const attachment=db.prepare('SELECT job_id,sha256 FROM discord_attachments WHERE id=?').get(file.id) as {job_id:string;sha256:string}|undefined;
   if(attachment&&(attachment.job_id!==job.id||attachment.sha256!==file.sha256))throw new ImportError(['Conflicting immutable attachment provenance.'],409);
   if(!attachment)db.prepare('INSERT INTO discord_attachments VALUES (?,?,?,?,?,?,?,?,?)').run(file.id,message.id,job.id,file.filename,file.byteSize,file.sha256,file.contentText,file.url,Date.now());
  }
  db.prepare("INSERT OR IGNORE INTO processing_job_events(job_id,event_key,from_state,to_state,code,occurred_at,actor_kind,actor_id) VALUES (?,?,'needs_attention','needs_attention','authenticated_artifact_retrieval',?,'owner',?)").run(job.id,'owner-recovery-'+validated.fingerprint.slice(0,32),Date.now(),session.ownerId);
  return {bundle,preview:previewProjectImport(db,session,projectId,bundle)};
 }).immediate();
}
