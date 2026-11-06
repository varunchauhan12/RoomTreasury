import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { ServiceContext } from '../security/service-auth.js';
import { AuthError, denyServiceOwner, projectRole, requireRole } from '../security/service-auth.js';

// Trusted backend inputs, NOT authentication payloads. No route constructs human/operator actors.
// Synthetic human actors may be constructed by tests until human authentication is implemented.
export interface HumanActor { readonly kind: 'human'; readonly id: string; readonly projectId: string; readonly role: 'owner' | 'requester' }
export interface OperatorActor { readonly kind: 'operator'; readonly id: string }
export type FinancialActor = HumanActor | ServiceContext;
export interface Terms { readonly recipientId: string; readonly amountCents: number; readonly purpose: string; readonly currency: 'USD'; readonly sourceRefs: readonly string[]; readonly allocationId?: string }
export interface Balance { readonly budget: number; readonly committed: number; readonly reserved: number; readonly spent: number; readonly available: number }
export interface Revision { readonly request_id: string; readonly revision: number; readonly project_id: string; readonly recipient_id: string; readonly amount_cents: number; readonly purpose: string; readonly currency: 'USD'; readonly source_refs: string }
export interface Receipt { readonly id: string; readonly ledger_id: string; readonly request_id: string; readonly revision: number; readonly approval_id: string; readonly reservation_id: string; readonly amount_cents: number; readonly currency: 'USD'; readonly recipient_id: string; readonly purpose: string; readonly settled_at: number; readonly simulated: 1 }
export class FinancialError extends Error {
  constructor(readonly code: 'INVALID_INPUT' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INSUFFICIENT_FUNDS' | 'STORAGE_FAILURE' | 'MODE_DISABLED') { super('Financial operation rejected.'); }
}
export const MAX_CENTS = 1_000_000_000;
function fail(code: FinancialError['code']): never { throw new FinancialError(code); }
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
function money(value: number): void { if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CENTS) fail('INVALID_INPUT'); }
function terms(value: Terms): void {
  money(value.amountCents);
  if (!text(value.recipientId) || !text(value.purpose) || value.currency !== 'USD' || !Array.isArray(value.sourceRefs) || value.sourceRefs.length > 100 || !value.sourceRefs.every(text)) fail('INVALID_INPUT');
}
export class FinancialEngine {
  constructor(private readonly db: Database) {}
  private write<T>(operation: () => T): T {
    try {
      return this.db.transaction(() => {
        const modes = this.db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
        if (modes.length !== 1 || !['test','demo'].includes(modes[0] as string)) fail('MODE_DISABLED');
        return operation();
      }).immediate();
    } catch (error) {
      if (error instanceof FinancialError || error instanceof AuthError) throw error;
      // Do not leak source strings, actor data or native SQL errors.
      throw new FinancialError('STORAGE_FAILURE');
    }
  }
  private owner(actor: FinancialActor, projectId: string): asserts actor is HumanActor {
    if (actor.kind === 'service') denyServiceOwner(actor);
    if (actor.kind !== 'human' || actor.projectId !== projectId || actor.role !== 'owner' || !text(actor.id)) fail('FORBIDDEN');
  }
  private human(actor: FinancialActor, projectId: string): asserts actor is HumanActor {
    if (actor.kind !== 'human' || actor.projectId !== projectId || !['owner','requester'].includes(actor.role) || !text(actor.id)) fail('FORBIDDEN');
  }
  private bindAllocation(projectId: string, target: string, revision: number | null, allocationId: string | undefined): void {
    const managed = this.db.prepare('SELECT 1 FROM client_projects WHERE financial_project_id=?').get(projectId);
    if (!managed && allocationId === undefined) return; // Preserve standalone M2A projects.
    if (!allocationId || !this.db.prepare(`SELECT 1 FROM workstream_allocations a JOIN delivery_proposals p ON p.id=a.proposal_id
      WHERE a.id=? AND a.financial_project_id=? AND p.status='approved'`).get(allocationId, projectId)) fail('INVALID_INPUT');
    if (revision === null) this.db.prepare('INSERT INTO commitment_allocations VALUES (?,?)').run(target, allocationId);
    else this.db.prepare('INSERT INTO request_allocations VALUES (?,?,?)').run(target, revision, allocationId);
  }
  private spendingCapacity(projectId: string, target: string, revision: number | null): number {
    const available = this.balance(projectId).available;
    if (!this.db.prepare('SELECT 1 FROM client_projects WHERE financial_project_id=?').get(projectId)) return available;
    const row = (revision === null
      ? this.db.prepare(`SELECT b.limit_cents-b.committed-b.reserved-b.spent AS available FROM commitment_allocations m
          JOIN allocation_balances b ON b.allocation_id=m.allocation_id WHERE m.commitment_id=?`).get(target)
      : this.db.prepare(`SELECT b.limit_cents-b.committed-b.reserved-b.spent AS available FROM request_allocations m
          JOIN allocation_balances b ON b.allocation_id=m.allocation_id WHERE m.request_id=? AND m.revision=?`).get(target, revision)) as {available:number} | undefined;
    if (!row) fail('INVALID_INPUT');
    return Math.min(available, row.available);
  }
  private treasury(actor: ServiceContext, projectId: string): void {
    if (actor.kind !== 'service') fail('FORBIDDEN');
    // Recheck credential ownership, expiry, revocation, principal and scope under the write lock.
    const enabled = this.db.prepare(`SELECT 1 FROM service_credentials c JOIN service_principals p ON p.id=c.principal_id
      WHERE c.id=? AND c.principal_id=? AND c.revoked_at IS NULL AND c.expires_at>? AND p.disabled_at IS NULL`)
      .get(actor.credentialId, actor.principalId, Date.now());
    if (!enabled) fail('FORBIDDEN');
    requireRole(projectRole(this.db, actor, projectId), 'treasury_ops');
  }
  private audit(actor: FinancialActor | OperatorActor, projectId: string, action: string, target: string, details: object = {}): void {
    this.db.prepare('INSERT INTO financial_audit_events(project_id,actor_id,actor_kind,action,target_id,details,occurred_at) VALUES (?,?,?,?,?,?,?)')
      .run(projectId, actor.kind === 'service' ? actor.principalId : actor.id, actor.kind, action, target, JSON.stringify(details), Date.now());
  }
  balance(projectId: string): Readonly<Balance> {
    const row = this.db.prepare('SELECT budget,committed,reserved,spent FROM project_balances WHERE project_id=?').get(projectId) as Omit<Balance,'available'> | undefined;
    if (!row) fail('NOT_FOUND');
    return Object.freeze({ ...row, available: row.budget-row.committed-row.reserved-row.spent });
  }
  initializeProject(actor: OperatorActor, projectId: string, name: string, budgetCents: number): void {
    this.write(() => {
      if (actor.kind !== 'operator' || !text(actor.id)) fail('FORBIDDEN');
      if (!text(projectId) || !text(name)) fail('INVALID_INPUT');
      money(budgetCents);
      this.db.prepare('INSERT INTO projects(id,name,budget_cents,currency,synthetic) VALUES (?,?,?,\'USD\',1)').run(projectId,name,budgetCents);
      this.audit(actor,projectId,'project_initialized',projectId);
    });
  }
  addRecipient(actor: HumanActor, projectId: string, recipientId: string, name: string): void {
    this.write(() => {
      this.human(actor,projectId);
      if (!text(recipientId) || !text(name)) fail('INVALID_INPUT');
      this.db.prepare('INSERT INTO project_recipients(project_id,id,name) VALUES (?,?,?)').run(projectId,recipientId,name);
      this.audit(actor,projectId,'recipient_added',recipientId);
    });
  }
  proposeCommitment(actor: FinancialActor, projectId: string, input: Terms): string {
    return this.write(() => {
      this.human(actor,projectId); terms(input);
      const id=randomUUID();
      this.db.prepare(`INSERT INTO commitments(id,project_id,recipient_id,amount_cents,purpose,currency,source_refs,state)
        VALUES (?,?,?,?,?,?,?,'proposed')`).run(id,projectId,input.recipientId,input.amountCents,input.purpose,input.currency,JSON.stringify(input.sourceRefs));
      this.bindAllocation(projectId,id,null,input.allocationId);
      this.audit(actor,projectId,'commitment_proposed',id); return id;
    });
  }
  confirmCommitment(actor: FinancialActor, projectId: string, id: string): void {
    this.write(() => {
      this.owner(actor,projectId);
      const row=this.db.prepare('SELECT state,amount_cents FROM commitments WHERE id=? AND project_id=?').get(id,projectId) as { state: string; amount_cents: number } | undefined;
      if (!row) fail('NOT_FOUND');
      if (row.state==='confirmed') return; // Authorization precedes business-idempotent replay.
      if (row.amount_cents>this.spendingCapacity(projectId,id,null)) fail('INSUFFICIENT_FUNDS');
      this.db.prepare("UPDATE commitments SET state='confirmed',confirmed_by=? WHERE id=?").run(actor.id,id);
      this.audit(actor,projectId,'commitment_confirmed',id);
    });
  }
  private revision(projectId: string, requestId: string, expected: number): Revision {
    const row=this.db.prepare(`SELECT v.* FROM request_revisions v JOIN payment_requests r ON r.id=v.request_id
      WHERE r.id=? AND r.project_id=? AND r.current_revision=? AND v.revision=?`).get(requestId,projectId,expected,expected) as Revision | undefined;
    if (!row) fail('CONFLICT'); return row;
  }
  private insertRevision(projectId: string, requestId: string, revision: number, input: Terms): void {
    this.db.prepare('INSERT INTO request_revisions VALUES (?,?,?,?,?,?,?,?)')
      .run(requestId,revision,projectId,input.recipientId,input.amountCents,input.purpose,input.currency,JSON.stringify(input.sourceRefs));
    this.bindAllocation(projectId,requestId,revision,input.allocationId);
  }
  createRequest(actor: FinancialActor, projectId: string, input: Terms): Readonly<{ requestId: string; revision: number }> {
    return this.write(() => {
      this.human(actor,projectId); terms(input); const requestId=randomUUID();
      this.db.prepare('INSERT INTO payment_requests VALUES (?,?,?,1)').run(requestId,projectId,actor.id);
      this.insertRevision(projectId,requestId,1,input);
      this.audit(actor,projectId,'request_created',requestId,{revision:1});
      return Object.freeze({requestId,revision:1});
    });
  }
  reviseRequest(actor: FinancialActor, projectId: string, requestId: string, expectedRevision: number, input: Terms): number {
    return this.write(() => {
      this.human(actor,projectId); terms(input); this.revision(projectId,requestId,expectedRevision);
      const requester=this.db.prepare('SELECT requester_id FROM payment_requests WHERE id=?').pluck().get(requestId);
      if (requester!==actor.id) fail('FORBIDDEN');
      if (this.db.prepare('SELECT 1 FROM ledger_entries WHERE request_id=?').get(requestId)) fail('CONFLICT');
      const revision=expectedRevision+1;
      this.db.prepare("UPDATE reservations SET state='released' WHERE request_id=? AND state='active'").run(requestId);
      this.db.prepare('UPDATE payment_requests SET current_revision=? WHERE id=?').run(revision,requestId);
      this.insertRevision(projectId,requestId,revision,input);
      this.audit(actor,projectId,'request_revised',requestId,{revision}); return revision;
    });
  }
  evaluateRequest(actor: FinancialActor, projectId: string, requestId: string, expectedRevision: number): Readonly<{ accepted: boolean; shortfallCents: number }> {
    return this.write(() => {
      this.human(actor,projectId); const revision=this.revision(projectId,requestId,expectedRevision);
      if (this.db.prepare('SELECT 1 FROM ledger_entries WHERE request_id=?').get(requestId)) fail('CONFLICT');
      const ownHold=this.db.prepare("SELECT 1 FROM reservations WHERE request_id=? AND revision=? AND state='active'").get(requestId,expectedRevision);
      const shortfallCents=ownHold ? 0 : Math.max(0,revision.amount_cents-this.spendingCapacity(projectId,requestId,expectedRevision));
      const result=Object.freeze({accepted:shortfallCents===0,shortfallCents});
      this.audit(actor,projectId,result.accepted?'policy_passed':'policy_rejected',requestId,{revision:expectedRevision,...result}); return result;
    });
  }
  approveRequest(actor: FinancialActor, projectId: string, requestId: string, expectedRevision: number): string {
    return this.write(() => {
      this.owner(actor,projectId); const revision=this.revision(projectId,requestId,expectedRevision);
      if (this.db.prepare('SELECT 1 FROM ledger_entries WHERE request_id=?').get(requestId)) fail('CONFLICT');
      const existing=this.db.prepare("SELECT approval_id FROM reservations WHERE request_id=? AND revision=? AND state='active'").pluck().get(requestId,expectedRevision) as string | undefined;
      if (existing) return existing;
      if (revision.amount_cents>this.spendingCapacity(projectId,requestId,expectedRevision)) fail('INSUFFICIENT_FUNDS');
      const id=randomUUID();
      this.db.prepare('INSERT INTO payment_approvals VALUES (?,?,?,?)').run(id,requestId,expectedRevision,actor.id);
      this.db.prepare("INSERT INTO reservations VALUES (?,?,?,?,'active')").run(randomUUID(),id,requestId,expectedRevision);
      this.audit(actor,projectId,'request_approved_reserved',requestId,{revision:expectedRevision,approvalId:id}); return id;
    });
  }
  settle(actor: ServiceContext, projectId: string, requestId: string, expectedRevision: number, approvalId: string, key: string): Readonly<Receipt> {
    return this.write(() => {
      this.treasury(actor,projectId);
      if (!text(key) || key.length>128) fail('INVALID_INPUT');
      const revision=this.revision(projectId,requestId,expectedRevision);
      const approved=this.db.prepare('SELECT 1 FROM payment_approvals WHERE id=? AND request_id=? AND revision=?').get(approvalId,requestId,expectedRevision);
      if (!approved) fail('CONFLICT');
      const replay=this.db.prepare('SELECT * FROM settlement_idempotency WHERE principal_id=? AND project_id=? AND key=?').get(actor.principalId,projectId,key) as {request_id:string; revision:number; approval_id:string} | undefined;
      if (replay && (replay.request_id!==requestId || replay.revision!==expectedRevision || replay.approval_id!==approvalId)) fail('CONFLICT');
      let receipt=this.db.prepare('SELECT * FROM settlement_receipts WHERE request_id=?').get(requestId) as Receipt | undefined;
      if (receipt && (receipt.revision!==expectedRevision || receipt.approval_id!==approvalId)) fail('CONFLICT');
      if (!receipt) {
        const hold=this.db.prepare("SELECT id FROM reservations WHERE request_id=? AND revision=? AND approval_id=? AND state='active'").pluck().get(requestId,expectedRevision,approvalId) as string | undefined;
        if (!hold) fail('CONFLICT');
        const ledger=randomUUID(), id=randomUUID();
        this.db.prepare('INSERT INTO ledger_entries VALUES (?,?,?,?,?,?,?,?)').run(ledger,requestId,expectedRevision,approvalId,hold,revision.amount_cents,'USD',id);
        this.db.prepare('INSERT INTO settlement_receipts VALUES (?,?,?,?,?,?,?,?,?,?,?,1)')
          .run(id,ledger,requestId,expectedRevision,approvalId,hold,revision.amount_cents,'USD',revision.recipient_id,revision.purpose,Date.now());
        receipt=this.db.prepare('SELECT * FROM settlement_receipts WHERE id=?').get(id) as Receipt;
        this.audit(actor,projectId,'simulated_settlement',requestId,{revision:expectedRevision,receiptId:id});
      }
      if (!replay) this.db.prepare('INSERT INTO settlement_idempotency VALUES (?,?,?,?,?,?,?)').run(actor.principalId,projectId,key,requestId,expectedRevision,approvalId,receipt.id);
      return Object.freeze(receipt);
    });
  }
}
