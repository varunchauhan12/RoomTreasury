// Migration 4 adds agency planning without changing historical financial migrations.
const immutable = (table: string) => `
CREATE TRIGGER ${table}_immutable_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable allocation binding'); END;
CREATE TRIGGER ${table}_immutable_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable allocation binding'); END;`;
export const agencySchema = `
CREATE TABLE client_projects (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(trim(id))>0),
 client_name TEXT NOT NULL CHECK(length(trim(client_name))>0),
 brief TEXT NOT NULL CHECK(length(trim(brief))>0),
 revenue_cents INTEGER NOT NULL CHECK(revenue_cents BETWEEN 1 AND 1000000000),
 currency TEXT NOT NULL CHECK(currency='USD'),
 status TEXT NOT NULL CHECK(status IN ('draft','active')),
 financial_project_id TEXT UNIQUE REFERENCES projects(id),
 CHECK((status='draft' AND financial_project_id IS NULL) OR (status='active' AND financial_project_id IS NOT NULL))
) STRICT;
CREATE TABLE delivery_proposals (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), client_project_id TEXT NOT NULL REFERENCES client_projects(id),
 budget_cents INTEGER NOT NULL CHECK(budget_cents BETWEEN 1 AND 1000000000),
 explanation TEXT NOT NULL CHECK(length(trim(explanation))>0),
 provenance TEXT NOT NULL CHECK(provenance IN ('manual','ai')),
 status TEXT NOT NULL CHECK(status IN ('pending','approved')),
 approved_by TEXT, approved_at INTEGER,
 CHECK((status='pending' AND approved_by IS NULL AND approved_at IS NULL) OR
       (status='approved' AND approved_by IS NOT NULL AND length(trim(approved_by))>0 AND approved_at IS NOT NULL AND approved_at>=0))
) STRICT;
CREATE UNIQUE INDEX one_approved_delivery_proposal ON delivery_proposals(client_project_id) WHERE status='approved';
CREATE TABLE workstream_allocations (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), proposal_id TEXT NOT NULL REFERENCES delivery_proposals(id),
 name TEXT NOT NULL CHECK(length(trim(name))>0), limit_cents INTEGER NOT NULL CHECK(limit_cents BETWEEN 1 AND 1000000000),
 financial_project_id TEXT REFERENCES projects(id)
) STRICT;
CREATE TABLE request_allocations (
 request_id TEXT NOT NULL, revision INTEGER NOT NULL, allocation_id TEXT NOT NULL REFERENCES workstream_allocations(id),
 PRIMARY KEY(request_id,revision), FOREIGN KEY(request_id,revision) REFERENCES request_revisions(request_id,revision)
) STRICT;
CREATE TABLE commitment_allocations (
 commitment_id TEXT PRIMARY KEY NOT NULL REFERENCES commitments(id),
 allocation_id TEXT NOT NULL REFERENCES workstream_allocations(id)
) STRICT;
CREATE VIEW allocation_balances AS
 SELECT a.id AS allocation_id,a.financial_project_id,a.limit_cents,
 (SELECT coalesce(sum(c.amount_cents),0) FROM commitment_allocations m JOIN commitments c ON c.id=m.commitment_id WHERE m.allocation_id=a.id AND c.state='confirmed') AS committed,
 (SELECT coalesce(sum(v.amount_cents),0) FROM request_allocations m JOIN request_revisions v ON v.request_id=m.request_id AND v.revision=m.revision
 JOIN reservations h ON h.request_id=m.request_id AND h.revision=m.revision WHERE m.allocation_id=a.id AND h.state='active') AS reserved,
 (SELECT coalesce(sum(l.amount_cents),0) FROM request_allocations m JOIN ledger_entries l ON l.request_id=m.request_id AND l.revision=m.revision WHERE m.allocation_id=a.id) AS spent
 FROM workstream_allocations a;
CREATE TRIGGER client_initial BEFORE INSERT ON client_projects WHEN NEW.status!='draft'
 BEGIN SELECT RAISE(ABORT,'client must start draft'); END;
CREATE TRIGGER client_transition BEFORE UPDATE ON client_projects
 WHEN OLD.status!='draft' OR NEW.status!='active' OR NEW.id IS NOT OLD.id OR NEW.client_name IS NOT OLD.client_name
 OR NEW.brief IS NOT OLD.brief OR NEW.revenue_cents IS NOT OLD.revenue_cents OR NEW.currency IS NOT OLD.currency
 BEGIN SELECT RAISE(ABORT,'immutable client terms'); END;
CREATE TRIGGER client_no_delete BEFORE DELETE ON client_projects BEGIN SELECT RAISE(ABORT,'immutable client project'); END;
CREATE TRIGGER proposal_initial BEFORE INSERT ON delivery_proposals WHEN NEW.status!='pending'
 OR NOT EXISTS(SELECT 1 FROM client_projects WHERE id=NEW.client_project_id AND status='draft')
 BEGIN SELECT RAISE(ABORT,'proposal requires draft client'); END;
CREATE TRIGGER proposal_approve BEFORE UPDATE ON delivery_proposals
 WHEN OLD.status!='pending' OR NEW.status!='approved' OR NEW.id IS NOT OLD.id OR NEW.client_project_id IS NOT OLD.client_project_id
 OR NEW.budget_cents IS NOT OLD.budget_cents OR NEW.explanation IS NOT OLD.explanation OR NEW.provenance IS NOT OLD.provenance
 OR NOT EXISTS(SELECT 1 FROM workstream_allocations WHERE proposal_id=OLD.id)
 OR (SELECT sum(limit_cents) FROM workstream_allocations WHERE proposal_id=OLD.id)>NEW.budget_cents
 OR NOT EXISTS(SELECT 1 FROM client_projects c JOIN projects p ON p.id=c.financial_project_id
 WHERE c.id=OLD.client_project_id AND c.status='active' AND p.budget_cents=NEW.budget_cents)
 OR EXISTS(SELECT 1 FROM workstream_allocations a JOIN client_projects c ON c.id=OLD.client_project_id
 WHERE a.proposal_id=OLD.id AND a.financial_project_id IS NOT c.financial_project_id)
 BEGIN SELECT RAISE(ABORT,'invalid proposal approval'); END;
CREATE TRIGGER proposal_no_delete BEFORE DELETE ON delivery_proposals BEGIN SELECT RAISE(ABORT,'immutable proposal'); END;
CREATE TRIGGER allocation_initial BEFORE INSERT ON workstream_allocations
 WHEN NEW.financial_project_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM delivery_proposals WHERE id=NEW.proposal_id AND status='pending')
 OR NEW.limit_cents+(SELECT coalesce(sum(limit_cents),0) FROM workstream_allocations WHERE proposal_id=NEW.proposal_id)>
 (SELECT budget_cents FROM delivery_proposals WHERE id=NEW.proposal_id)
 BEGIN SELECT RAISE(ABORT,'invalid allocation total'); END;
CREATE TRIGGER allocation_bind BEFORE UPDATE ON workstream_allocations
 WHEN OLD.financial_project_id IS NOT NULL OR NEW.financial_project_id IS NULL
 OR NEW.id IS NOT OLD.id OR NEW.proposal_id IS NOT OLD.proposal_id OR NEW.name IS NOT OLD.name OR NEW.limit_cents IS NOT OLD.limit_cents
 OR NOT EXISTS(SELECT 1 FROM delivery_proposals p JOIN client_projects c ON c.id=p.client_project_id
 WHERE p.id=OLD.proposal_id AND p.status='pending' AND c.financial_project_id=NEW.financial_project_id)
 BEGIN SELECT RAISE(ABORT,'immutable allocation'); END;
CREATE TRIGGER allocation_no_delete BEFORE DELETE ON workstream_allocations BEGIN SELECT RAISE(ABORT,'immutable allocation'); END;
CREATE TRIGGER request_allocation_bind BEFORE INSERT ON request_allocations WHEN NOT EXISTS(
 SELECT 1 FROM request_revisions v JOIN workstream_allocations a ON a.id=NEW.allocation_id
 JOIN delivery_proposals p ON p.id=a.proposal_id WHERE v.request_id=NEW.request_id AND v.revision=NEW.revision
 AND v.project_id=a.financial_project_id AND p.status='approved'
 AND NOT EXISTS(SELECT 1 FROM payment_approvals WHERE request_id=NEW.request_id AND revision=NEW.revision))
 BEGIN SELECT RAISE(ABORT,'invalid request allocation'); END;
CREATE TRIGGER commitment_allocation_bind BEFORE INSERT ON commitment_allocations WHEN NOT EXISTS(
 SELECT 1 FROM commitments c JOIN workstream_allocations a ON a.id=NEW.allocation_id
 JOIN delivery_proposals p ON p.id=a.proposal_id WHERE c.id=NEW.commitment_id AND c.state='proposed'
 AND c.project_id=a.financial_project_id AND p.status='approved')
 BEGIN SELECT RAISE(ABORT,'invalid commitment allocation'); END;
CREATE TRIGGER commitment_allocation_capacity BEFORE UPDATE ON commitments
 WHEN NEW.state='confirmed' AND EXISTS(SELECT 1 FROM client_projects WHERE financial_project_id=NEW.project_id)
 AND NOT EXISTS(SELECT 1 FROM commitment_allocations m JOIN allocation_balances b ON b.allocation_id=m.allocation_id
 WHERE m.commitment_id=NEW.id AND NEW.amount_cents<=b.limit_cents-b.committed-b.reserved-b.spent)
 BEGIN SELECT RAISE(ABORT,'allocation capacity exceeded'); END;
CREATE TRIGGER reservation_allocation_capacity BEFORE INSERT ON reservations
 WHEN EXISTS(SELECT 1 FROM payment_requests r JOIN client_projects c ON c.financial_project_id=r.project_id WHERE r.id=NEW.request_id)
 AND NOT EXISTS(SELECT 1 FROM request_allocations m JOIN allocation_balances b ON b.allocation_id=m.allocation_id
 JOIN request_revisions v ON v.request_id=m.request_id AND v.revision=m.revision
 WHERE m.request_id=NEW.request_id AND m.revision=NEW.revision AND v.amount_cents<=b.limit_cents-b.committed-b.reserved-b.spent)
 BEGIN SELECT RAISE(ABORT,'allocation capacity exceeded'); END;
${['request_allocations','commitment_allocations'].map(immutable).join('\n')}
`;
