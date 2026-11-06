import { isVerifiedEstimate, type Estimate, type Intake } from '../ai/estimate.js';
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { AuthError, denyServiceOwner } from '../security/service-auth.js';
import { FinancialEngine, FinancialError, MAX_CENTS, type FinancialActor, type HumanActor } from './financial-engine.js';

export interface ProposalInput {
  readonly budgetCents: number;
  readonly explanation: string;
  readonly provenance?: 'manual' | 'ai';
  readonly allocations: readonly { readonly name: string; readonly limitCents: number }[];
}
interface Proposal {
  id: string; client_project_id: string; budget_cents: number; explanation: string;
  provenance: 'manual' | 'ai'; status: 'pending' | 'approved'; approved_by: string | null; approved_at: number | null;
}
interface ClientProject {
  id: string; client_name: string; brief: string; revenue_cents: number; currency: 'USD';
  status: 'draft' | 'active'; financial_project_id: string | null;
}
export interface AllocationBalance {
  readonly allocationId: string; readonly limitCents: number;
  readonly committed: number; readonly reserved: number; readonly spent: number; readonly available: number;
}
const validText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
function amount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CENTS) throw new FinancialError('INVALID_INPUT');
}

// Internal only. Human actors must come from trusted backend code, never request JSON.
export class AgencyEngine {
  constructor(private readonly db: Database) {}

  private write<T>(operation: () => T): T {
    try {
      return this.db.transaction(() => {
        const modes = this.db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
        if (modes.length !== 1 || !['test', 'demo'].includes(modes[0] as string)) throw new FinancialError('MODE_DISABLED');
        return operation();
      }).immediate();
    } catch (error) {
      if (error instanceof FinancialError || error instanceof AuthError) throw error;
      throw new FinancialError('STORAGE_FAILURE');
    }
  }

  private human(actor: FinancialActor, clientId: string, ownerOnly = false): asserts actor is HumanActor {
    if (ownerOnly && actor.kind === 'service') denyServiceOwner(actor);
    if (actor.kind !== 'human' || actor.projectId !== clientId || !validText(actor.id) ||
        !['owner', 'requester'].includes(actor.role) || (ownerOnly && actor.role !== 'owner')) throw new FinancialError('FORBIDDEN');
  }

  private client(id: string): ClientProject {
    const row = this.db.prepare('SELECT * FROM client_projects WHERE id=?').get(id) as ClientProject | undefined;
    if (!row) throw new FinancialError('NOT_FOUND');
    return row;
  }

  createClientProject(actor: FinancialActor, id: string, clientName: string, brief: string, revenueCents: number): void {
    this.write(() => {
      this.human(actor, id);
      if (!validText(id) || !validText(clientName) || !validText(brief)) throw new FinancialError('INVALID_INPUT');
      amount(revenueCents);
      this.insertClient(id,clientName,brief,revenueCents);
    });
  }

  private insertClient(id:string,clientName:string,brief:string,revenueCents:number): void {
      this.db.prepare("INSERT INTO client_projects VALUES (?,?,?,?,'USD','draft',NULL)").run(id, clientName, brief, revenueCents);
  }

  createProposal(actor: FinancialActor, clientId: string, input: ProposalInput): Readonly<{ proposalId: string; allocationIds: readonly string[] }> {
    return this.write(() => {
      this.human(actor, clientId);
      return this.insertProposal(clientId,input);
    });
  }

  private insertProposal(clientId:string,input:ProposalInput,estimate?:Estimate) {
      if (this.client(clientId).status !== 'draft') throw new FinancialError('CONFLICT');
      amount(input.budgetCents);
      if (!validText(input.explanation) || (input.provenance !== undefined && !['manual', 'ai'].includes(input.provenance)) ||
          !Array.isArray(input.allocations) || input.allocations.length < 1 || input.allocations.length > 100) throw new FinancialError('INVALID_INPUT');
      let total = 0;
      for (const allocation of input.allocations) {
        if (!validText(allocation.name)) throw new FinancialError('INVALID_INPUT');
        amount(allocation.limitCents);
        total += allocation.limitCents;
      }
      if (total > input.budgetCents) throw new FinancialError('INVALID_INPUT');
      const proposalId = randomUUID();
      if(estimate && !isVerifiedEstimate(estimate)) throw new FinancialError('FORBIDDEN');
      this.db.prepare("INSERT INTO delivery_proposals VALUES (?,?,?,?,?,'pending',NULL,NULL)")
        .run(proposalId, clientId, input.budgetCents, input.explanation,estimate?'ai':'manual');
      if(estimate)this.db.prepare('INSERT INTO proposal_ai_results VALUES (?,?,?,?,?,?)').run(proposalId,estimate.provider,estimate.model,estimate.responseId,JSON.stringify(estimate.assumptions),JSON.stringify(estimate.risks));
      const allocationIds = input.allocations.map(allocation => {
        const id = randomUUID();
        this.db.prepare('INSERT INTO workstream_allocations VALUES (?,?,?,?,NULL)').run(id, proposalId, allocation.name, allocation.limitCents);
        return id;
      });
      return Object.freeze({ proposalId, allocationIds: Object.freeze(allocationIds) });
  }

  createEstimatedProject(input:Intake,estimate:Estimate) {
    return this.write(()=>{
      if(!isVerifiedEstimate(estimate))throw new FinancialError('FORBIDDEN');
      if(!validText(input.clientName)||!validText(input.brief))throw new FinancialError('INVALID_INPUT');
      amount(input.revenueCents);
      const clientId=randomUUID();
      this.insertClient(clientId,input.clientName,input.brief,input.revenueCents);
      const proposal=this.insertProposal(clientId,estimate,estimate);
      return {clientId,...proposal};
    });
  }

  approveProposal(actor: FinancialActor, clientId: string, proposalId: string): string {
    return this.write(() => {
      this.human(actor, clientId, true);
      const client = this.client(clientId);
      const proposal = this.db.prepare('SELECT * FROM delivery_proposals WHERE id=? AND client_project_id=?')
        .get(proposalId, clientId) as Proposal | undefined;
      if (!proposal) throw new FinancialError('NOT_FOUND');
      if (proposal.status !== 'pending' || client.status !== 'draft') throw new FinancialError('CONFLICT');
      const allocations = this.db.prepare('SELECT limit_cents FROM workstream_allocations WHERE proposal_id=?').pluck().all(proposalId) as number[];
      if (!allocations.length || allocations.reduce((sum, value) => sum + value, 0) > proposal.budget_cents) throw new FinancialError('INVALID_INPUT');
      // Keep the client/financial ID identical so the existing trusted project scope stays the same.
      if (this.db.prepare('SELECT 1 FROM projects WHERE id=?').get(clientId)) throw new FinancialError('CONFLICT');
      new FinancialEngine(this.db).initializeProject({ kind: 'operator', id: actor.id }, clientId, `${client.client_name} project`, proposal.budget_cents);
      this.db.prepare("UPDATE client_projects SET status='active',financial_project_id=? WHERE id=?").run(clientId, clientId);
      this.db.prepare('UPDATE workstream_allocations SET financial_project_id=? WHERE proposal_id=?').run(clientId, proposalId);
      const now = Date.now();
      this.db.prepare("UPDATE delivery_proposals SET status='approved',approved_by=?,approved_at=? WHERE id=?").run(actor.id, now, proposalId);
      this.db.prepare(`INSERT INTO financial_audit_events(project_id,actor_id,actor_kind,action,target_id,details,occurred_at)
        VALUES (?,?,'human','delivery_proposal_approved',?,?,?)`).run(clientId, actor.id, proposalId, JSON.stringify({ proposalId }), now);
      return clientId;
    });
  }

  allocationBalance(allocationId: string): Readonly<AllocationBalance> {
    const row = this.db.prepare('SELECT * FROM allocation_balances WHERE allocation_id=?').get(allocationId) as
      { limit_cents: number; committed: number; reserved: number; spent: number } | undefined;
    if (!row) throw new FinancialError('NOT_FOUND');
    return Object.freeze({ allocationId, limitCents: row.limit_cents, committed: row.committed, reserved: row.reserved,
      spent: row.spent, available: row.limit_cents - row.committed - row.reserved - row.spent });
  }

  economics(clientId: string, proposalId: string) {
    // A single read transaction keeps revenue, proposal and financial snapshots consistent.
    return this.db.transaction(() => {
      const client = this.client(clientId);
      const proposal = this.db.prepare('SELECT * FROM delivery_proposals WHERE id=? AND client_project_id=?')
        .get(proposalId, clientId) as Proposal | undefined;
      if (!proposal) throw new FinancialError('NOT_FOUND');
      const allocations = this.db.prepare('SELECT id,name FROM workstream_allocations WHERE proposal_id=? ORDER BY rowid')
        .all(proposalId) as { id: string; name: string }[];
      return Object.freeze({ client: Object.freeze(client), proposal: Object.freeze(proposal),
        ai: this.db.prepare('SELECT * FROM proposal_ai_results WHERE proposal_id=?').get(proposalId) ?? null,
        projectedGrossMarginCents: client.revenue_cents - proposal.budget_cents,
        delivery: proposal.status === 'approved' ? new FinancialEngine(this.db).balance(client.financial_project_id!) : null,
        allocations: Object.freeze(allocations.map(a => Object.freeze({ name: a.name, ...this.allocationBalance(a.id) }))) });
    })();
  }
}
