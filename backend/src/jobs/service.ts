import {randomUUID} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {OwnerSession} from '../security/owner-auth.js';
import {AuthError} from '../security/service-auth.js';
import {activeSession,bindingAuthorized,hash,key,mockMode} from './bindings.js';
import {DispatchFailure,MockTransport,type JobTransport,type TransportEvent} from './transport.js';

export type JobState='queued'|'dispatching'|'dispatched'|'running'|'collecting'|'validating'|'imported'|'dispatch_uncertain'|'needs_attention'|'failed'|'cancelled';
export interface Job {
 id:string;binding_id:string;submitting_owner_id:string;intake_snapshot:string;intake_hash:string;intake_revision:number;attempt:number;
 transport:'mock';correlation_id:string;idempotency_key:string;state:JobState;created_at:number;updated_at:number;completed_at:number|null;
 error_code:string|null;diagnostic:string|null;lease_owner:string|null;lease_until:number|null;result_import_id:string|null;
}
const terminal=new Set<JobState>(['needs_attention','failed','cancelled','imported']);
const next:Record<JobState,readonly JobState[]>={queued:['dispatching','failed','cancelled'],dispatching:['dispatched','failed','dispatch_uncertain','cancelled'],dispatched:['running','failed','needs_attention','cancelled'],running:['collecting','failed','needs_attention','cancelled'],collecting:['validating','failed','needs_attention','cancelled'],validating:['needs_attention','failed','cancelled'],dispatch_uncertain:['cancelled'],needs_attention:[],failed:[],cancelled:[],imported:[]};
const codes=new Set(['artifact_import_deferred','mock_dispatch_failed','mock_execution_failed','dispatch_outcome_unknown','worker_interrupted','owner_access_revoked']);
export class ProcessingJobs {
 constructor(private readonly db:Database){}
 private row(id:string):Job {const row=this.db.prepare('SELECT * FROM processing_jobs WHERE id=?').get(id) as Job|undefined;if(!row)throw new AuthError(404,'JOB_NOT_FOUND');return row;}
 private authorize(session:OwnerSession,id:string):Job {activeSession(this.db,session);const job=this.row(id);bindingAuthorized(this.db,session.ownerId,job.binding_id);return job;}
 create(session:OwnerSession,bindingId:string,idempotencyKey:string):Job {
  return this.db.transaction(()=>{
   mockMode(this.db);activeSession(this.db,session);key(idempotencyKey);
   const binding=bindingAuthorized(this.db,session.ownerId,bindingId);
   const previous=this.db.prepare('SELECT * FROM processing_jobs WHERE binding_id=? AND idempotency_key=?').get(bindingId,idempotencyKey) as Job|undefined;
   if(previous)return previous;
   if(this.db.prepare("SELECT 1 FROM processing_jobs WHERE binding_id=? AND completed_at IS NULL").get(bindingId))throw new AuthError(409,'JOB_ALREADY_ACTIVE');
   const attempt=(this.db.prepare('SELECT coalesce(max(attempt),0)+1 FROM processing_jobs WHERE binding_id=?').pluck().get(bindingId) as number);
   if(attempt>3)throw new AuthError(409,'JOB_ATTEMPT_LIMIT');
   const client=this.db.prepare('SELECT client_name,brief,revenue_cents,currency FROM client_projects WHERE id=?').get(binding.client_project_id) as {client_name:string;brief:string;revenue_cents:number;currency:string};
   const snapshot=JSON.stringify({projectId:binding.client_project_id,taskId:binding.task_id,clientName:client.client_name,brief:client.brief,revenueCents:client.revenue_cents,currency:client.currency,intakeRevision:1});
   const id=randomUUID(),now=Date.now();
   this.db.prepare(`INSERT INTO processing_jobs(id,binding_id,submitting_owner_id,intake_snapshot,intake_hash,intake_revision,attempt,transport,correlation_id,idempotency_key,state,created_at,updated_at)
    VALUES (?,?,?,?,?,1,?,'mock',?,?,'queued',?,?)`).run(id,bindingId,session.ownerId,snapshot,hash(snapshot),attempt,'mock-'+id,idempotencyKey,now,now);
   this.db.prepare("INSERT INTO processing_job_events(job_id,event_key,from_state,to_state,occurred_at,actor_kind,actor_id) VALUES (?,'created',NULL,'queued',?,'owner',?)").run(id,now,session.ownerId);
   return this.row(id);
  }).immediate();
 }
 get(session:OwnerSession,id:string){return this.db.transaction(()=>this.authorize(session,id))();}
 list(session:OwnerSession,projectId:string):Job[]{
  return this.db.transaction(()=>{
   activeSession(this.db,session);const binding=this.db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=?').get(projectId) as {id:string}|undefined;
   if(!binding)throw new AuthError(403,'BOUND_OWNER_SCOPE_REQUIRED');bindingAuthorized(this.db,session.ownerId,binding.id);
   return this.db.prepare('SELECT * FROM processing_jobs WHERE binding_id=? ORDER BY created_at,id').all(binding.id) as Job[];
  })();
 }
 events(session:OwnerSession,id:string,after=0,limit=50){
  if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new AuthError(400,'INVALID_EVENT_PAGE');
  return this.db.transaction(()=>{this.authorize(session,id);const events=this.db.prepare('SELECT id,from_state,to_state,code,occurred_at,actor_kind,actor_id FROM processing_job_events WHERE job_id=? AND id>? ORDER BY id LIMIT ?').all(id,after,limit) as {id:number}[];
   return {events,nextCursor:events.at(-1)?.id??after};})();
 }
 cancel(session:OwnerSession,id:string):Job {
  return this.db.transaction(()=>{
   mockMode(this.db);const job=this.authorize(session,id);if(job.state==='cancelled')return job;
   this.transition(job,'cancelled','owner-cancel',null,session.ownerId);return this.row(id);
  }).immediate();
 }
 private duplicate(id:string,eventKey:string,state:JobState,code:string|null):boolean {
  const previous=this.db.prepare('SELECT to_state,code FROM processing_job_events WHERE job_id=? AND event_key=?').get(id,eventKey) as {to_state:string;code:string|null}|undefined;
  if(previous&&(previous.to_state!==state||previous.code!==code))throw new AuthError(409,'JOB_EVENT_CONFLICT');return !!previous;
 }
 private transition(job:Job,state:JobState,eventKey:string,code:string|null,ownerId?:string):void {
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(eventKey)||(code!==null&&!codes.has(code)))throw new AuthError(400,'INVALID_JOB_EVENT');
  if(this.duplicate(job.id,eventKey,state,code))return;
  if(!next[job.state].includes(state))throw new AuthError(409,'INVALID_JOB_TRANSITION');
  const now=Date.now(),done=terminal.has(state),release=done||state==='dispatch_uncertain';
  this.db.prepare('UPDATE processing_jobs SET state=?,updated_at=?,completed_at=?,error_code=?,diagnostic=?,lease_owner=?,lease_until=? WHERE id=?').run(state,now,done?now:null,code,code,release?null:job.lease_owner,release?null:job.lease_until,job.id);
  this.db.prepare('INSERT INTO processing_job_events(job_id,event_key,from_state,to_state,code,occurred_at,actor_kind,actor_id) VALUES (?,?,?,?,?,?,?,?)').run(job.id,eventKey,job.state,state,code,now,ownerId?'owner':'backend',ownerId??'mock-worker');
 }
 recover():number {
  return this.db.transaction(()=>{
   mockMode(this.db);const expired=this.db.prepare('SELECT * FROM processing_jobs WHERE lease_until<=? AND completed_at IS NULL').all(Date.now()) as Job[];
   for(const job of expired)this.transition(job,job.state==='dispatching'?'dispatch_uncertain':'needs_attention','lease-expired',job.state==='dispatching'?'dispatch_outcome_unknown':'worker_interrupted');
   return expired.length;
  }).immediate();
 }
 claim():Job|null {
  return this.db.transaction(()=>{
   mockMode(this.db);const job=this.db.prepare("SELECT * FROM processing_jobs WHERE state='queued' ORDER BY created_at,id LIMIT 1").get() as Job|undefined;
   if(!job)return null;
   try{bindingAuthorized(this.db,job.submitting_owner_id,job.binding_id);}catch{this.transition(job,'failed','access-revoked','owner_access_revoked');return null;}
   const lease=randomUUID();this.db.prepare('UPDATE processing_jobs SET lease_owner=?,lease_until=? WHERE id=?').run(lease,Date.now()+30000,job.id);
   this.transition(this.row(job.id),'dispatching','dispatch-start',null);return this.row(job.id);
  }).immediate();
 }
 // Internal worker boundary; no HTTP route accepts lease tokens or transport events.
 apply(id:string,lease:string,eventKey:string,state:JobState,code:string|null=null):Job {
  return this.db.transaction(()=>{
   mockMode(this.db);const job=this.row(id);
   if(this.duplicate(id,eventKey,state,code))return job;
   if(job.lease_owner!==lease||job.lease_until===null||job.lease_until<=Date.now())throw new AuthError(409,'WORKER_LEASE_LOST');
   bindingAuthorized(this.db,job.submitting_owner_id,job.binding_id);
   this.transition(job,state,eventKey,code);
   if(!terminal.has(state)&&state!=='dispatch_uncertain')this.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now()+30000,id);
   return this.row(id);
  }).immediate();
 }
 async runNext(transport:JobTransport=new MockTransport()):Promise<boolean>{
  this.recover();const job=this.claim();if(!job)return false;
  const lease=job.lease_owner!,request={jobId:job.id,correlationId:job.correlation_id,intakeHash:job.intake_hash};
  try{
   const acknowledgement=await transport.dispatch(request);
   if(transport.type!==job.transport||acknowledgement.correlationId!==job.correlation_id)throw new DispatchFailure(false);
   this.apply(job.id,lease,'dispatch-ack','dispatched');
  }catch(error){
   this.finishFailure(job.id,lease,error instanceof DispatchFailure&&error.certain?'failed':'dispatch_uncertain',error instanceof DispatchFailure&&error.certain?'mock_dispatch_failed':'dispatch_outcome_unknown');return true;
  }
  try{for await(const event of transport.events(request)){
   const typed:TransportEvent=event;this.apply(job.id,lease,typed.key,typed.state,typed.code??null);
  }
   const latest=this.row(job.id);if(!terminal.has(latest.state))this.finishFailure(job.id,lease,'needs_attention','worker_interrupted');
  }catch{this.finishFailure(job.id,lease,'needs_attention','worker_interrupted');}
  return true;
 }
 private finishFailure(id:string,lease:string,state:JobState,code:string){
  this.db.transaction(()=>{
   const job=this.row(id);if(terminal.has(job.state)||job.state==='dispatch_uncertain'||job.lease_owner!==lease||job.lease_until===null||job.lease_until<=Date.now())return;
   let permitted=true;try{bindingAuthorized(this.db,job.submitting_owner_id,job.binding_id);}catch{permitted=false;}
   this.transition(job,permitted?state:'failed','worker-failure',permitted?code:'owner_access_revoked');
  }).immediate();
 }
}
// Public read model excludes internal lease tokens and diagnostics.
export function jobView(job:Job){const {lease_owner:_owner,lease_until:_until,diagnostic:_diagnostic,...view}=job;return view;}
