export const artifactRecoverySchema = `CREATE TABLE proposal_import_originals (
 import_id TEXT PRIMARY KEY NOT NULL REFERENCES proposal_imports(id),
 proposal_raw TEXT NOT NULL CHECK(json_valid(proposal_raw)), evidence_raw TEXT CHECK(evidence_raw IS NULL OR json_valid(evidence_raw)), summary_raw TEXT,
 proposal_sha256 TEXT NOT NULL CHECK(length(proposal_sha256)=64), evidence_sha256 TEXT CHECK(evidence_sha256 IS NULL OR length(evidence_sha256)=64), summary_sha256 TEXT CHECK(summary_sha256 IS NULL OR length(summary_sha256)=64),
 normalization_json TEXT NOT NULL CHECK(json_valid(normalization_json)), created_at INTEGER NOT NULL
) STRICT;
CREATE TRIGGER import_originals_no_update BEFORE UPDATE ON proposal_import_originals BEGIN SELECT RAISE(ABORT,'immutable original artifacts'); END;
CREATE TRIGGER import_originals_no_delete BEFORE DELETE ON proposal_import_originals BEGIN SELECT RAISE(ABORT,'retain original artifacts'); END;

DROP TRIGGER job_transition;
CREATE TRIGGER job_transition BEFORE UPDATE OF state ON processing_jobs WHEN NEW.state!=OLD.state AND NOT (
 (NEW.state='cancelled' AND OLD.state IN ('queued','dispatching','dispatched','running','collecting','validating','dispatch_uncertain')) OR
 (OLD.state='queued' AND NEW.state='dispatching') OR
 (OLD.state='dispatching' AND NEW.state IN ('dispatched','failed','dispatch_uncertain')) OR
 (OLD.state='dispatched' AND NEW.state IN ('running','failed','needs_attention')) OR
 (OLD.state='running' AND NEW.state IN ('collecting','failed','needs_attention')) OR
 (OLD.state='collecting' AND NEW.state IN ('validating','failed','needs_attention')) OR
 (OLD.state='validating' AND NEW.state IN ('needs_attention','failed','imported')) OR
 (OLD.state='queued' AND NEW.state='failed') OR
 (OLD.state='needs_attention' AND OLD.error_code IN ('artifact_import_deferred','artifact_validation_failed','discord_missing_attachments') AND NEW.state='imported'))
 BEGIN SELECT RAISE(ABORT,'invalid job transition'); END;
DROP TRIGGER project_import_link_valid;
CREATE TRIGGER project_import_link_valid BEFORE INSERT ON project_import_links WHEN NOT EXISTS(
 SELECT 1 FROM processing_jobs j JOIN project_task_bindings b ON b.id=j.binding_id
 JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id
 JOIN human_owners o ON o.id=b.owner_id
 LEFT JOIN human_sessions h ON h.owner_id=b.owner_id AND h.digest=NEW.session_digest AND h.revoked_at IS NULL
 JOIN proposal_imports p ON p.id=NEW.import_id
 WHERE j.id=NEW.job_id AND j.binding_id=NEW.binding_id AND b.owner_id=NEW.owner_id
 AND j.intake_revision=NEW.intake_revision AND j.intake_hash=NEW.intake_hash
 AND (
   (NEW.source='authenticated_project_upload' AND j.state='needs_attention' AND (j.error_code IN ('artifact_import_deferred','artifact_validation_failed') OR (j.transport='discord' AND j.error_code='discord_missing_attachments')) AND j.result_import_id IS NULL AND h.digest IS NOT NULL)
   OR
   (NEW.source='discord_agent_delivery' AND (j.state='validating' OR (j.state='needs_attention' AND j.error_code IN ('artifact_import_deferred','artifact_validation_failed'))) AND j.result_import_id IS NULL)
 )
 AND p.task_id=b.task_id AND p.bundle_fingerprint=NEW.bundle_fingerprint
 AND s.revoked_at IS NULL AND o.disabled_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'invalid project import binding'); END;
DROP TRIGGER job_result_link;
CREATE TRIGGER job_result_link BEFORE UPDATE OF result_import_id ON processing_jobs
 WHEN NEW.result_import_id IS NOT OLD.result_import_id AND NOT (
 OLD.result_import_id IS NULL AND
 (OLD.state='validating' OR (OLD.state='needs_attention' AND OLD.error_code IN ('artifact_import_deferred','artifact_validation_failed','discord_missing_attachments')))
 AND NEW.state='imported' AND EXISTS(SELECT 1 FROM project_import_links l WHERE l.import_id=NEW.result_import_id
 AND l.job_id=OLD.id AND l.binding_id=OLD.binding_id AND l.intake_hash=OLD.intake_hash AND l.intake_revision=OLD.intake_revision))
 BEGIN SELECT RAISE(ABORT,'actual bound import required'); END;`;
