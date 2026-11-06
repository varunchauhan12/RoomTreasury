import {ownerSession,authSettings,type OwnerSession,type AuthSettings} from '../security/owner-auth.js';
import {bindingAuthorized} from '../jobs/bindings.js';
import {AuthError} from '../security/service-auth.js';
import {ProcessingJobs,jobView} from '../jobs/service.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from 'better-sqlite3';
import { AgencyEngine } from '../domain/agency-engine.js';
import { FinancialError } from '../domain/financial-engine.js';
import { errorSchema } from './errors.js';

// One read transaction provides a consistent persisted snapshot, including all proposals.
export function projectSnapshot(db: Database, id: string) {
  return db.transaction(() => {
    const client = db.prepare('SELECT * FROM client_projects WHERE id=?').get(id);
    if (!client) throw new FinancialError('NOT_FOUND');
    const agency = new AgencyEngine(db);
    const proposals = (db.prepare('SELECT id FROM delivery_proposals WHERE client_project_id=? ORDER BY rowid').all(id) as {id:string}[])
      .map(p => agency.economics(id,p.id));
    const approved = proposals.find(p => p.proposal.status === 'approved');
    const financialId = approved?.client.financial_project_id ?? null;
    return { client, proposals, approvedDeliveryBudgetCents: approved?.proposal.budget_cents ?? null,
      projectedGrossMarginCents: approved?.projectedGrossMarginCents ?? null, delivery: approved?.delivery ?? null,
      allocations: approved?.allocations ?? [],
      requests: db.prepare(`SELECT v.*,r.current_revision FROM request_revisions v JOIN payment_requests r ON r.id=v.request_id WHERE r.project_id=? ORDER BY v.rowid`).all(financialId),
      commitments: db.prepare('SELECT * FROM commitments WHERE project_id=? ORDER BY rowid').all(financialId),
      approvals: db.prepare('SELECT a.* FROM payment_approvals a JOIN payment_requests r ON r.id=a.request_id WHERE r.project_id=? ORDER BY a.rowid').all(financialId),
      receipts: db.prepare('SELECT s.* FROM settlement_receipts s JOIN payment_requests r ON r.id=s.request_id WHERE r.project_id=? ORDER BY s.settled_at,s.id').all(financialId),
      history: db.prepare('SELECT * FROM financial_audit_events WHERE project_id=? ORDER BY id').all(financialId) };
  })();
}
export function registerClientProjects(app: FastifyInstance, db: Database,settings:AuthSettings=authSettings(db)): void {
  function authenticated(request:FastifyRequest):OwnerSession|null {
    if(!request.headers.cookie)return null;
    try{return ownerSession(db,request,settings);}catch(error){if(error instanceof AuthError)return null;throw error;}
  }
  function snapshot(id:string,owner:OwnerSession|null){
    const project=projectSnapshot(db,id);
    if(!owner)return project;
    const binding=db.prepare('SELECT id FROM project_task_bindings WHERE client_project_id=? AND owner_id=?').get(id,owner.ownerId) as {id:string}|undefined;
    if(!binding)return project;
    let bound;
    try{bound=bindingAuthorized(db,owner.ownerId,binding.id);}catch(error){if(error instanceof AuthError)return project;throw error;}
    const jobs=new ProcessingJobs(db).list(owner,id);
    const imports=db.prepare('SELECT p.id,p.revision,p.imported_at,p.proposal_json,l.job_id,l.intake_revision FROM proposal_imports p JOIN project_import_links l ON l.import_id=p.id WHERE l.binding_id=? AND p.task_id=? ORDER BY p.revision DESC').all(bound.id,bound.task_id) as {id:string;revision:number;imported_at:number;proposal_json:string;job_id:string;intake_revision:number}[];
    const mode=db.prepare('SELECT mode FROM schema_migrations LIMIT 1').pluck().get();
    return {...project,workspace:{bindingId:bound.id,taskId:bound.task_id,latestJob:jobs.length?jobView(jobs.reduce((latest,job)=>job.attempt>latest.attempt?job:latest)):null,
      demoPreviewAvailable:['demo','test'].includes(mode as string)&&process.env.NODE_ENV!=='production',
      imports:imports.map(row=>({id:row.id,revision:row.revision,jobId:row.job_id,intakeRevision:row.intake_revision,validation:'project_intake_validated',importedAt:row.imported_at,status:JSON.parse(row.proposal_json).status}))}};
  }
  const querystring = { type:'object', properties:{}, additionalProperties:false };
  const snapshotSchema = { type:'object', additionalProperties:true }; // Read model includes immutable domain records.
  const responses = {400:errorSchema,404:errorSchema,500:errorSchema,503:errorSchema};
  const noStore = async (_request: unknown, reply: {header:(name:string,value:string)=>unknown}) => { reply.header('Cache-Control','no-store'); };
  app.get('/v1/client-projects/', {onRequest:noStore,schema:{operationId:'listClientProjects',querystring,
    response:{200:{type:'object',required:['projects'],properties:{projects:{type:'array',items:snapshotSchema}}},...responses}}}, request => {
    try { const owner=authenticated(request);return db.transaction(() => ({projects:(db.prepare('SELECT id FROM client_projects ORDER BY rowid').all() as {id:string}[]).map(p=>snapshot(p.id,owner))}))(); }
    catch { throw Object.assign(new Error('Unavailable'),{statusCode:503}); }
  });
  app.get<{Params:{projectId:string}}>('/v1/client-projects/:projectId', {onRequest:noStore,schema:{operationId:'getClientProject',querystring,
    params:{type:'object',required:['projectId'],additionalProperties:false,properties:{projectId:{type:'string',minLength:1,maxLength:4096}}},
    response:{200:snapshotSchema,...responses}}}, request => {
    try { const owner=authenticated(request);return db.transaction(()=>snapshot(request.params.projectId,owner))(); }
    catch(error) { throw Object.assign(new Error('Unavailable'),{statusCode:error instanceof FinancialError && error.code==='NOT_FOUND'?404:503}); }
  });
}
