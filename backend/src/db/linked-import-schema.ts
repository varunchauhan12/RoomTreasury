// Migration 10 rebuilds only the v9 job tables to permit an actual linked import.
// Child events are copied and restored with their original IDs; FK enforcement stays enabled.
export const linkedImportSchema = `
CREATE TABLE job_events_v10_backup AS SELECT * FROM processing_job_events;
CREATE TABLE jobs_v10_backup AS SELECT * FROM processing_jobs;
DROP TABLE processing_job_events;
DROP TABLE processing_jobs;
CREATE TABLE processing_jobs (
 id TEXT PRIMARY KEY NOT NULL, binding_id TEXT NOT NULL REFERENCES project_task_bindings(id),
 submitting_owner_id TEXT NOT NULL REFERENCES human_owners(id),
 intake_snapshot TEXT NOT NULL CHECK(json_valid(intake_snapshot)), intake_hash TEXT NOT NULL CHECK(length(intake_hash)=64),
 intake_revision INTEGER NOT NULL CHECK(intake_revision=1), attempt INTEGER NOT NULL CHECK(attempt BETWEEN 1 AND 3),
 transport TEXT NOT NULL CHECK(transport='mock'), correlation_id TEXT NOT NULL UNIQUE,
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 state TEXT NOT NULL CHECK(state IN ('queued','dispatching','dispatched','running','collecting','validating','imported','dispatch_uncertain','needs_attention','failed','cancelled')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL CHECK(updated_at>=created_at), completed_at INTEGER,
 error_code TEXT CHECK(error_code IS NULL OR error_code IN ('artifact_import_deferred','mock_dispatch_failed','mock_execution_failed','dispatch_outcome_unknown','worker_interrupted','owner_access_revoked')),
 diagnostic TEXT CHECK(diagnostic IS NULL OR length(diagnostic)<=200),
 lease_owner TEXT, lease_until INTEGER, result_import_id TEXT REFERENCES proposal_imports(id),
 CHECK((lease_owner IS NULL)=(lease_until IS NULL)),
 CHECK((state IN ('needs_attention','failed','cancelled','imported'))=(completed_at IS NOT NULL)),
 CHECK((state='imported')=(result_import_id IS NOT NULL)), UNIQUE(binding_id,intake_revision,attempt), UNIQUE(binding_id,idempotency_key)
) STRICT;
CREATE UNIQUE INDEX one_active_processing_job ON processing_jobs(binding_id)
 WHERE state IN ('queued','dispatching','dispatched','running','collecting','validating','dispatch_uncertain');
CREATE TABLE processing_job_events (
 id INTEGER PRIMARY KEY, job_id TEXT NOT NULL REFERENCES processing_jobs(id),
 event_key TEXT NOT NULL CHECK(length(event_key) BETWEEN 1 AND 160),
 from_state TEXT, to_state TEXT NOT NULL, code TEXT, occurred_at INTEGER NOT NULL,
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner','backend')), actor_id TEXT NOT NULL,
 UNIQUE(job_id,event_key)
) STRICT;
CREATE INDEX job_events_page ON processing_job_events(job_id,id);
INSERT INTO processing_jobs SELECT * FROM jobs_v10_backup;
INSERT INTO processing_job_events SELECT * FROM job_events_v10_backup;
DROP TABLE job_events_v10_backup;
DROP TABLE jobs_v10_backup;
CREATE TRIGGER job_owner_binding BEFORE INSERT ON processing_jobs WHEN NEW.state!='queued' OR NOT EXISTS(
 SELECT 1 FROM project_task_bindings b JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id
 JOIN human_owners o ON o.id=b.owner_id WHERE b.id=NEW.binding_id AND b.owner_id=NEW.submitting_owner_id
 AND s.revoked_at IS NULL AND o.disabled_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'invalid job binding'); END;
CREATE TRIGGER job_identity BEFORE UPDATE ON processing_jobs WHEN
 NEW.id IS NOT OLD.id OR NEW.binding_id IS NOT OLD.binding_id OR NEW.submitting_owner_id IS NOT OLD.submitting_owner_id OR
 NEW.intake_snapshot IS NOT OLD.intake_snapshot OR NEW.intake_hash IS NOT OLD.intake_hash OR NEW.intake_revision IS NOT OLD.intake_revision OR
 NEW.attempt IS NOT OLD.attempt OR NEW.transport IS NOT OLD.transport OR NEW.correlation_id IS NOT OLD.correlation_id OR
 NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.created_at IS NOT OLD.created_at OR NEW.updated_at<OLD.updated_at OR
 (OLD.result_import_id IS NOT NULL AND NEW.result_import_id IS NOT OLD.result_import_id)
 BEGIN SELECT RAISE(ABORT,'immutable job identity'); END;
CREATE TRIGGER job_transition BEFORE UPDATE OF state ON processing_jobs WHEN NEW.state!=OLD.state AND NOT (
 (NEW.state='cancelled' AND OLD.state IN ('queued','dispatching','dispatched','running','collecting','validating','dispatch_uncertain')) OR
 (OLD.state='queued' AND NEW.state='dispatching') OR
 (OLD.state='dispatching' AND NEW.state IN ('dispatched','failed','dispatch_uncertain')) OR
 (OLD.state='dispatched' AND NEW.state IN ('running','failed','needs_attention')) OR
 (OLD.state='running' AND NEW.state IN ('collecting','failed','needs_attention')) OR
 (OLD.state='collecting' AND NEW.state IN ('validating','failed','needs_attention')) OR
 (OLD.state='validating' AND NEW.state IN ('needs_attention','failed')) OR
 (OLD.state='queued' AND NEW.state='failed') OR
 (OLD.state='needs_attention' AND OLD.error_code='artifact_import_deferred' AND NEW.state='imported'))
 BEGIN SELECT RAISE(ABORT,'invalid job transition'); END;
CREATE TABLE project_import_links (
 import_id TEXT PRIMARY KEY NOT NULL REFERENCES proposal_imports(id), job_id TEXT NOT NULL UNIQUE REFERENCES processing_jobs(id),
 binding_id TEXT NOT NULL REFERENCES project_task_bindings(id), intake_revision INTEGER NOT NULL CHECK(intake_revision=1),
 intake_hash TEXT NOT NULL CHECK(length(intake_hash)=64), bundle_fingerprint TEXT NOT NULL CHECK(length(bundle_fingerprint)=64),
 owner_id TEXT NOT NULL REFERENCES human_owners(id), session_digest TEXT NOT NULL REFERENCES human_sessions(digest),
 source TEXT NOT NULL CHECK(source='authenticated_project_upload'), created_at INTEGER NOT NULL
) STRICT;
CREATE TRIGGER project_import_link_valid BEFORE INSERT ON project_import_links WHEN NOT EXISTS(
 SELECT 1 FROM processing_jobs j JOIN project_task_bindings b ON b.id=j.binding_id
 JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id
 JOIN human_owners o ON o.id=b.owner_id JOIN human_sessions h ON h.owner_id=b.owner_id
 JOIN proposal_imports p ON p.id=NEW.import_id
 WHERE j.id=NEW.job_id AND j.binding_id=NEW.binding_id AND b.owner_id=NEW.owner_id
 AND j.intake_revision=NEW.intake_revision AND j.intake_hash=NEW.intake_hash
 AND j.state='needs_attention' AND j.error_code='artifact_import_deferred' AND j.result_import_id IS NULL
 AND p.task_id=b.task_id AND p.bundle_fingerprint=NEW.bundle_fingerprint
 AND s.revoked_at IS NULL AND o.disabled_at IS NULL AND h.digest=NEW.session_digest AND h.revoked_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'invalid project import binding'); END;
CREATE TRIGGER job_result_link BEFORE UPDATE OF result_import_id ON processing_jobs
 WHEN NEW.result_import_id IS NOT OLD.result_import_id AND NOT (
 OLD.result_import_id IS NULL AND OLD.state='needs_attention' AND OLD.error_code='artifact_import_deferred'
 AND NEW.state='imported' AND EXISTS(SELECT 1 FROM project_import_links l WHERE l.import_id=NEW.result_import_id
 AND l.job_id=OLD.id AND l.binding_id=OLD.binding_id AND l.intake_hash=OLD.intake_hash AND l.intake_revision=OLD.intake_revision))
 BEGIN SELECT RAISE(ABORT,'actual bound import required'); END;
CREATE TRIGGER job_no_delete BEFORE DELETE ON processing_jobs BEGIN SELECT RAISE(ABORT,'retain job'); END;
CREATE TRIGGER processing_job_events_no_update BEFORE UPDATE ON processing_job_events BEGIN SELECT RAISE(ABORT,'append only'); END;
CREATE TRIGGER processing_job_events_no_delete BEFORE DELETE ON processing_job_events BEGIN SELECT RAISE(ABORT,'retain history'); END;
CREATE TRIGGER project_import_links_no_update BEFORE UPDATE ON project_import_links BEGIN SELECT RAISE(ABORT,'immutable import link'); END;
CREATE TRIGGER project_import_links_no_delete BEFORE DELETE ON project_import_links BEGIN SELECT RAISE(ABORT,'retain import link'); END;
`;
