import type { FastifyInstance } from 'fastify';
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
export function registerClientProjects(app: FastifyInstance, db: Database): void {
  const querystring = { type:'object', properties:{}, additionalProperties:false };
  const snapshotSchema = { type:'object', additionalProperties:true }; // Read model includes immutable domain records.
  const responses = {400:errorSchema,404:errorSchema,500:errorSchema,503:errorSchema};
  const noStore = async (_request: unknown, reply: {header:(name:string,value:string)=>unknown}) => { reply.header('Cache-Control','no-store'); };
  app.get('/v1/client-projects/', {onRequest:noStore,schema:{operationId:'listClientProjects',querystring,
    response:{200:{type:'object',required:['projects'],properties:{projects:{type:'array',items:snapshotSchema}}},...responses}}}, () => {
    try { return db.transaction(() => ({projects:(db.prepare('SELECT id FROM client_projects ORDER BY rowid').all() as {id:string}[]).map(p=>projectSnapshot(db,p.id))}))(); }
    catch { throw Object.assign(new Error('Unavailable'),{statusCode:503}); }
  });
  app.get<{Params:{projectId:string}}>('/v1/client-projects/:projectId', {onRequest:noStore,schema:{operationId:'getClientProject',querystring,
    params:{type:'object',required:['projectId'],additionalProperties:false,properties:{projectId:{type:'string',minLength:1,maxLength:4096}}},
    response:{200:snapshotSchema,...responses}}}, request => {
    try { return projectSnapshot(db,request.params.projectId); }
    catch(error) { throw Object.assign(new Error('Unavailable'),{statusCode:error instanceof FinancialError && error.code==='NOT_FOUND'?404:503}); }
  });
}
