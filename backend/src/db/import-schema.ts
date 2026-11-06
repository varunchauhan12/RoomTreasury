export const importSchema = `CREATE TABLE proposal_imports (
 id TEXT PRIMARY KEY NOT NULL, task_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 proposal_fingerprint TEXT NOT NULL CHECK(length(proposal_fingerprint)=64), bundle_fingerprint TEXT NOT NULL CHECK(length(bundle_fingerprint)=64),
 proposal_json TEXT NOT NULL CHECK(json_valid(proposal_json)), evidence_json TEXT CHECK(evidence_json IS NULL OR json_valid(evidence_json)),
 summary_markdown TEXT, imported_at INTEGER NOT NULL CHECK(imported_at>=0),
 source TEXT NOT NULL CHECK(source='human_mediated_file_import'), identity_authenticated INTEGER NOT NULL CHECK(identity_authenticated=0),
 UNIQUE(task_id,proposal_fingerprint), UNIQUE(task_id,revision)
) STRICT;
CREATE TRIGGER proposal_import_no_update BEFORE UPDATE ON proposal_imports BEGIN SELECT RAISE(ABORT,'immutable proposal import'); END;
CREATE TRIGGER proposal_import_no_delete BEFORE DELETE ON proposal_imports BEGIN SELECT RAISE(ABORT,'immutable proposal import'); END;`;
