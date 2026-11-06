const immutable=(table:string)=>`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable review history'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable review history'); END;`;
export const reviewSchema=`
CREATE TABLE owner_review_revisions (
 id TEXT PRIMARY KEY NOT NULL, import_id TEXT NOT NULL REFERENCES proposal_imports(id),
 parent_id TEXT REFERENCES owner_review_revisions(id), revision INTEGER NOT NULL CHECK(revision>=0),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64), payload TEXT NOT NULL CHECK(json_valid(payload)),
 reason TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('original_import','trusted_owner_revision')),
 author_id TEXT, created_at INTEGER NOT NULL, UNIQUE(import_id,revision),
 CHECK((revision=0 AND parent_id IS NULL AND source='original_import' AND author_id IS NULL) OR
 (revision>0 AND parent_id IS NOT NULL AND source='trusted_owner_revision' AND length(author_id)>0 AND author_id IS NOT NULL))
) STRICT;
CREATE TABLE owner_review_notes (
 id TEXT PRIMARY KEY NOT NULL, revision_id TEXT NOT NULL REFERENCES owner_review_revisions(id),
 gate TEXT NOT NULL, answer TEXT NOT NULL CHECK(length(trim(answer))>0), reference TEXT NOT NULL CHECK(length(trim(reference))>0),
 source TEXT NOT NULL CHECK(source IN ('unverified_human_note','trusted_owner_note')), author_id TEXT,
 created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE owner_review_verifications (
 revision_id TEXT NOT NULL REFERENCES owner_review_revisions(id), fingerprint TEXT NOT NULL,
 gate TEXT NOT NULL, note_id TEXT NOT NULL REFERENCES owner_review_notes(id),
 fact_origin TEXT NOT NULL CHECK(fact_origin IN ('client_confirmed','owner_verified_internal')),
 owner_id TEXT NOT NULL CHECK(length(trim(owner_id))>0), verified_at INTEGER NOT NULL, facts TEXT NOT NULL CHECK(json_valid(facts)),
 PRIMARY KEY(revision_id,gate)
) STRICT;
CREATE TABLE owner_review_decisions (
 id TEXT PRIMARY KEY NOT NULL, import_id TEXT NOT NULL REFERENCES proposal_imports(id),
 revision_id TEXT NOT NULL UNIQUE REFERENCES owner_review_revisions(id), fingerprint TEXT NOT NULL,
 owner_id TEXT NOT NULL CHECK(length(trim(owner_id))>0), decision TEXT NOT NULL CHECK(decision IN ('APPROVED_SYNTHETIC_DELIVERY','DEFERRED','REJECTED')),
 financial_project_id TEXT UNIQUE REFERENCES projects(id), decided_at INTEGER NOT NULL,
 auth_basis TEXT NOT NULL CHECK(auth_basis='trusted_domain_context'),
 CHECK((decision='APPROVED_SYNTHETIC_DELIVERY' AND financial_project_id IS NOT NULL) OR (decision!='APPROVED_SYNTHETIC_DELIVERY' AND financial_project_id IS NULL))
) STRICT;
CREATE UNIQUE INDEX one_approved_review_per_import ON owner_review_decisions(import_id) WHERE decision='APPROVED_SYNTHETIC_DELIVERY';
CREATE TRIGGER review_revision_chain BEFORE INSERT ON owner_review_revisions WHEN NEW.revision>0 AND NOT EXISTS(
 SELECT 1 FROM owner_review_revisions p WHERE p.id=NEW.parent_id AND p.import_id=NEW.import_id AND p.revision=NEW.revision-1)
 BEGIN SELECT RAISE(ABORT,'invalid review revision chain'); END;
CREATE TRIGGER review_verification_binding BEFORE INSERT ON owner_review_verifications WHEN NOT EXISTS(
 SELECT 1 FROM owner_review_revisions r JOIN owner_review_notes n ON n.revision_id=r.id
 WHERE r.id=NEW.revision_id AND r.fingerprint=NEW.fingerprint AND n.id=NEW.note_id AND n.gate=NEW.gate)
 BEGIN SELECT RAISE(ABORT,'invalid verification binding'); END;
CREATE TRIGGER review_decision_binding BEFORE INSERT ON owner_review_decisions WHEN NOT EXISTS(
 SELECT 1 FROM owner_review_revisions WHERE id=NEW.revision_id AND fingerprint=NEW.fingerprint AND import_id=NEW.import_id)
 BEGIN SELECT RAISE(ABORT,'invalid decision binding'); END;
${['owner_review_revisions','owner_review_notes','owner_review_verifications','owner_review_decisions'].map(immutable).join('\n')}
`;
