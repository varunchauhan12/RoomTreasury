// Migration 3: synthetic USD finances only. Historical migrations remain unchanged.
const amount = 'INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000)';
const immutable = (table: string) => `
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable financial record'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable financial record'); END;`;
export const financialSchema = `
CREATE TABLE projects (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), name TEXT NOT NULL CHECK(length(trim(name))>0),
 budget_cents INTEGER NOT NULL CHECK(budget_cents BETWEEN 1 AND 1000000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'), synthetic INTEGER NOT NULL CHECK(synthetic=1)
) STRICT;
CREATE TABLE project_recipients (
 id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL CHECK(length(trim(name))>0),
 PRIMARY KEY(project_id,id), CHECK(length(id)>0)
) STRICT;
CREATE TABLE payment_requests (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), project_id TEXT NOT NULL REFERENCES projects(id),
 requester_id TEXT NOT NULL CHECK(length(requester_id)>0), current_revision INTEGER NOT NULL CHECK(current_revision>0),
 UNIQUE(id,project_id),
 FOREIGN KEY(id,current_revision) REFERENCES request_revisions(request_id,revision) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE TABLE request_revisions (
 request_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0), project_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL, amount_cents ${amount}, purpose TEXT NOT NULL CHECK(length(trim(purpose))>0),
 currency TEXT NOT NULL CHECK(currency='USD'), source_refs TEXT NOT NULL CHECK(json_valid(source_refs) AND json_type(source_refs)='array'),
 PRIMARY KEY(request_id,revision),
 FOREIGN KEY(request_id,project_id) REFERENCES payment_requests(id,project_id),
 FOREIGN KEY(project_id,recipient_id) REFERENCES project_recipients(project_id,id)
) STRICT;
CREATE TABLE commitments (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), project_id TEXT NOT NULL REFERENCES projects(id), recipient_id TEXT NOT NULL,
 amount_cents ${amount}, purpose TEXT NOT NULL CHECK(length(trim(purpose))>0), currency TEXT NOT NULL CHECK(currency='USD'),
 source_refs TEXT NOT NULL CHECK(json_valid(source_refs) AND json_type(source_refs)='array'),
 state TEXT NOT NULL CHECK(state IN ('proposed','confirmed')), confirmed_by TEXT,
 CHECK((state='proposed' AND confirmed_by IS NULL) OR (state='confirmed' AND length(confirmed_by)>0 AND confirmed_by IS NOT NULL)),
 FOREIGN KEY(project_id,recipient_id) REFERENCES project_recipients(project_id,id)
) STRICT;
CREATE TABLE payment_approvals (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0), request_id TEXT NOT NULL, revision INTEGER NOT NULL,
 owner_id TEXT NOT NULL CHECK(length(owner_id)>0), UNIQUE(request_id,revision), UNIQUE(id,request_id,revision),
 FOREIGN KEY(request_id,revision) REFERENCES request_revisions(request_id,revision),
 FOREIGN KEY(id) REFERENCES reservations(approval_id) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE TABLE reservations (
 id TEXT PRIMARY KEY NOT NULL, approval_id TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL, revision INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','released','consumed')),
 UNIQUE(id,request_id,revision,approval_id),
 FOREIGN KEY(approval_id,request_id,revision) REFERENCES payment_approvals(id,request_id,revision)
) STRICT;
CREATE UNIQUE INDEX one_active_reservation ON reservations(request_id) WHERE state='active';
CREATE TABLE ledger_entries (
 id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL, approval_id TEXT NOT NULL,
 reservation_id TEXT NOT NULL UNIQUE, amount_cents ${amount}, currency TEXT NOT NULL CHECK(currency='USD'),
 receipt_id TEXT NOT NULL UNIQUE REFERENCES settlement_receipts(id) DEFERRABLE INITIALLY DEFERRED,
 UNIQUE(id,request_id,revision,approval_id,reservation_id,amount_cents,currency,receipt_id),
 FOREIGN KEY(reservation_id,request_id,revision,approval_id) REFERENCES reservations(id,request_id,revision,approval_id)
) STRICT;
CREATE TABLE settlement_receipts (
 id TEXT PRIMARY KEY NOT NULL, ledger_id TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL,
 approval_id TEXT NOT NULL, reservation_id TEXT NOT NULL, amount_cents ${amount}, currency TEXT NOT NULL CHECK(currency='USD'),
 recipient_id TEXT NOT NULL, purpose TEXT NOT NULL, settled_at INTEGER NOT NULL CHECK(settled_at>=0),
 simulated INTEGER NOT NULL CHECK(simulated=1),
 FOREIGN KEY(ledger_id,request_id,revision,approval_id,reservation_id,amount_cents,currency,id)
 REFERENCES ledger_entries(id,request_id,revision,approval_id,reservation_id,amount_cents,currency,receipt_id)
) STRICT;
CREATE TABLE financial_audit_events (
 id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), actor_id TEXT NOT NULL CHECK(length(actor_id)>0),
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('human','service','operator')), action TEXT NOT NULL,
 target_id TEXT NOT NULL, details TEXT NOT NULL CHECK(json_valid(details)), occurred_at INTEGER NOT NULL CHECK(occurred_at>=0)
) STRICT;
CREATE TABLE settlement_idempotency (
 principal_id TEXT NOT NULL REFERENCES service_principals(id), project_id TEXT NOT NULL REFERENCES projects(id),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 1 AND 128), request_id TEXT NOT NULL, revision INTEGER NOT NULL, approval_id TEXT NOT NULL,
 receipt_id TEXT NOT NULL REFERENCES settlement_receipts(id), PRIMARY KEY(principal_id,project_id,key),
 FOREIGN KEY(approval_id,request_id,revision) REFERENCES payment_approvals(id,request_id,revision)
) STRICT;
CREATE VIEW project_balances AS
 SELECT p.id AS project_id,p.budget_cents AS budget,
 (SELECT coalesce(sum(c.amount_cents),0) FROM commitments c WHERE c.project_id=p.id AND c.state='confirmed') AS committed,
 (SELECT coalesce(sum(v.amount_cents),0) FROM reservations h JOIN request_revisions v ON v.request_id=h.request_id AND v.revision=h.revision WHERE v.project_id=p.id AND h.state='active') AS reserved,
 (SELECT coalesce(sum(l.amount_cents),0) FROM ledger_entries l JOIN payment_requests r ON r.id=l.request_id WHERE r.project_id=p.id) AS spent
 FROM projects p;
CREATE TRIGGER commitment_insert BEFORE INSERT ON commitments WHEN NEW.state!='proposed'
 BEGIN SELECT RAISE(ABORT,'commitment must start proposed'); END;
CREATE TRIGGER commitment_transition BEFORE UPDATE ON commitments
 WHEN OLD.state!='proposed' OR NEW.state!='confirmed' OR NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id
 OR NEW.recipient_id IS NOT OLD.recipient_id OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.purpose IS NOT OLD.purpose
 OR NEW.currency IS NOT OLD.currency OR NEW.source_refs IS NOT OLD.source_refs
 BEGIN SELECT RAISE(ABORT,'invalid commitment transition'); END;
CREATE TRIGGER commitment_budget BEFORE UPDATE ON commitments WHEN NEW.state='confirmed' AND
 NEW.amount_cents > (SELECT budget-committed-reserved-spent FROM project_balances WHERE project_id=NEW.project_id)
 BEGIN SELECT RAISE(ABORT,'insufficient funds'); END;
CREATE TRIGGER commitment_no_delete BEFORE DELETE ON commitments BEGIN SELECT RAISE(ABORT,'immutable financial record'); END;
CREATE TRIGGER request_initial BEFORE INSERT ON payment_requests WHEN NEW.current_revision!=1
 BEGIN SELECT RAISE(ABORT,'request must start at revision one'); END;
CREATE TRIGGER request_transition BEFORE UPDATE ON payment_requests
 WHEN NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.requester_id IS NOT OLD.requester_id
 OR NEW.current_revision!=OLD.current_revision+1 OR EXISTS(SELECT 1 FROM ledger_entries WHERE request_id=OLD.id)
 OR EXISTS(SELECT 1 FROM reservations WHERE request_id=OLD.id AND state='active')
 BEGIN SELECT RAISE(ABORT,'invalid request transition'); END;
CREATE TRIGGER request_no_delete BEFORE DELETE ON payment_requests BEGIN SELECT RAISE(ABORT,'immutable financial record'); END;
CREATE TRIGGER revision_current BEFORE INSERT ON request_revisions
 WHEN NEW.revision IS NOT (SELECT current_revision FROM payment_requests WHERE id=NEW.request_id)
 BEGIN SELECT RAISE(ABORT,'revision is not current'); END;
CREATE TRIGGER approval_current BEFORE INSERT ON payment_approvals
 WHEN NEW.revision IS NOT (SELECT current_revision FROM payment_requests WHERE id=NEW.request_id)
 OR EXISTS(SELECT 1 FROM ledger_entries WHERE request_id=NEW.request_id)
 BEGIN SELECT RAISE(ABORT,'stale or settled approval'); END;
CREATE TRIGGER reservation_insert BEFORE INSERT ON reservations
 WHEN NEW.state!='active' OR NEW.revision IS NOT (SELECT current_revision FROM payment_requests WHERE id=NEW.request_id)
 OR EXISTS(SELECT 1 FROM ledger_entries WHERE request_id=NEW.request_id)
 BEGIN SELECT RAISE(ABORT,'invalid reservation'); END;
CREATE TRIGGER reservation_budget BEFORE INSERT ON reservations WHEN
 (SELECT amount_cents FROM request_revisions WHERE request_id=NEW.request_id AND revision=NEW.revision) >
 (SELECT budget-committed-reserved-spent FROM project_balances WHERE project_id=(SELECT project_id FROM payment_requests WHERE id=NEW.request_id))
 BEGIN SELECT RAISE(ABORT,'insufficient funds'); END;
CREATE TRIGGER reservation_transition BEFORE UPDATE ON reservations
 WHEN OLD.state!='active' OR NEW.state NOT IN ('released','consumed') OR NEW.id IS NOT OLD.id
 OR NEW.approval_id IS NOT OLD.approval_id OR NEW.request_id IS NOT OLD.request_id OR NEW.revision IS NOT OLD.revision
 OR (NEW.state='consumed' AND NOT EXISTS(SELECT 1 FROM ledger_entries WHERE reservation_id=OLD.id))
 OR (NEW.state='released' AND EXISTS(SELECT 1 FROM ledger_entries WHERE reservation_id=OLD.id))
 BEGIN SELECT RAISE(ABORT,'invalid reservation transition'); END;
CREATE TRIGGER reservation_no_delete BEFORE DELETE ON reservations BEGIN SELECT RAISE(ABORT,'immutable financial record'); END;
CREATE TRIGGER ledger_match BEFORE INSERT ON ledger_entries WHEN NOT EXISTS(
 SELECT 1 FROM reservations h JOIN request_revisions v ON v.request_id=h.request_id AND v.revision=h.revision
 JOIN payment_requests r ON r.id=v.request_id WHERE h.id=NEW.reservation_id AND h.state='active'
 AND v.amount_cents=NEW.amount_cents AND v.currency=NEW.currency AND r.current_revision=NEW.revision)
 BEGIN SELECT RAISE(ABORT,'matching active hold required'); END;
CREATE TRIGGER ledger_consume AFTER INSERT ON ledger_entries BEGIN
 UPDATE reservations SET state='consumed' WHERE id=NEW.reservation_id; END;
CREATE TRIGGER idempotency_binding BEFORE INSERT ON settlement_idempotency WHEN NOT EXISTS(
 SELECT 1 FROM settlement_receipts s JOIN payment_requests r ON r.id=s.request_id
 WHERE s.id=NEW.receipt_id AND s.request_id=NEW.request_id AND s.revision=NEW.revision
 AND s.approval_id=NEW.approval_id AND r.project_id=NEW.project_id)
 BEGIN SELECT RAISE(ABORT,'idempotency binding mismatch'); END;
CREATE TRIGGER receipt_terms BEFORE INSERT ON settlement_receipts WHEN NOT EXISTS(
 SELECT 1 FROM request_revisions v WHERE v.request_id=NEW.request_id AND v.revision=NEW.revision
 AND v.recipient_id=NEW.recipient_id AND v.purpose=NEW.purpose)
 BEGIN SELECT RAISE(ABORT,'receipt terms mismatch'); END;
${['projects','project_recipients','request_revisions','payment_approvals','ledger_entries','settlement_receipts','financial_audit_events','settlement_idempotency'].map(immutable).join('\n')}
`;
