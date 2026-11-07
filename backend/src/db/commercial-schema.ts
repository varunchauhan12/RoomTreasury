const immutable=(table:string)=>`
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable commercial record'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable commercial record'); END;`;
const cents='INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000)';
export const commercialSchema=`
CREATE TABLE commercial_demo (id INTEGER PRIMARY KEY CHECK(id=1)) STRICT;
CREATE TABLE commercial_quotes (
 id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES client_projects(id), revision INTEGER NOT NULL CHECK(revision>0),
 amount_cents ${cents}, currency TEXT NOT NULL CHECK(currency='USD'), reference TEXT NOT NULL CHECK(length(trim(reference))>0),
 import_id TEXT REFERENCES proposal_imports(id), review_revision_id TEXT, fingerprint TEXT,
 CHECK((import_id IS NULL AND review_revision_id IS NULL AND fingerprint IS NULL) OR
 (import_id IS NOT NULL AND review_revision_id IS NOT NULL AND fingerprint IS NOT NULL AND length(fingerprint)=64)),
 UNIQUE(project_id,revision), UNIQUE(project_id,id)
) STRICT;
CREATE TABLE commercial_agreements (
 id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL UNIQUE REFERENCES client_projects(id), quote_id TEXT NOT NULL,
 amount_cents ${cents}, currency TEXT NOT NULL CHECK(currency='USD'), signed_on TEXT NOT NULL,
 terms TEXT NOT NULL CHECK(length(trim(terms))>0), reference TEXT NOT NULL CHECK(length(trim(reference))>0),
 UNIQUE(project_id,id), FOREIGN KEY(project_id,quote_id) REFERENCES commercial_quotes(project_id,id)
) STRICT;
CREATE TABLE commercial_invoices (
 id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, agreement_id TEXT NOT NULL,
 number TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(number))>0),
 amount_cents ${cents}, currency TEXT NOT NULL CHECK(currency='USD'), due_on TEXT NOT NULL,
 UNIQUE(project_id,id), FOREIGN KEY(project_id,agreement_id) REFERENCES commercial_agreements(project_id,id)
) STRICT;
CREATE TABLE commercial_cash (
 id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES commercial_agreements(project_id),
 invoice_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('receipt','expense')),
 amount_cents ${cents}, currency TEXT NOT NULL CHECK(currency='USD'), paid_on TEXT NOT NULL,
 method TEXT NOT NULL CHECK(length(trim(method))>0), reference TEXT NOT NULL COLLATE NOCASE CHECK(length(trim(reference))>0),
 owner_id TEXT NOT NULL REFERENCES human_owners(id), UNIQUE(kind,reference),
 CHECK(kind='receipt' OR invoice_id IS NULL), FOREIGN KEY(project_id,invoice_id) REFERENCES commercial_invoices(project_id,id)
) STRICT;
CREATE TABLE commercial_events (
 id INTEGER PRIMARY KEY, project_id TEXT NOT NULL REFERENCES client_projects(id), owner_id TEXT NOT NULL REFERENCES human_owners(id),
 action TEXT NOT NULL CHECK(action IN ('submit','revision_requested','accept','agreement','invoice_draft','invoice_issue','invoice_cancel','receipt','expense','delivery_start','complete')),
 target_id TEXT NOT NULL, evidence TEXT NOT NULL, occurred_at INTEGER NOT NULL CHECK(occurred_at>=0),
 request_key TEXT NOT NULL, request_hash TEXT NOT NULL CHECK(length(request_hash)=64), UNIQUE(project_id,request_key)
) STRICT;
CREATE INDEX commercial_cash_project ON commercial_cash(project_id,invoice_id);
CREATE INDEX commercial_events_project ON commercial_events(project_id,id);
${['commercial_demo','commercial_quotes','commercial_agreements','commercial_invoices','commercial_cash','commercial_events'].map(immutable).join('\n')}
`;
