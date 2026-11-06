// Additive migration 9. Existing financial, import and approval schemas stay untouched.
export const jobSchema = `
CREATE TABLE project_task_bindings (
 id TEXT PRIMARY KEY NOT NULL, client_project_id TEXT NOT NULL UNIQUE REFERENCES client_projects(id),
 task_id TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES human_owners(id),
 source TEXT NOT NULL CHECK(source IN ('owner_onboarding','operator_legacy')),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64), created_at INTEGER NOT NULL CHECK(created_at>=0),
 FOREIGN KEY(owner_id,task_id) REFERENCES human_owner_scopes(owner_id,task_id),
 UNIQUE(owner_id,idempotency_key)
) STRICT;
CREATE TABLE binding_audit_events (
 id INTEGER PRIMARY KEY, binding_id TEXT NOT NULL UNIQUE REFERENCES project_task_bindings(id),
 actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner_session','local_operator')),
 actor_id TEXT NOT NULL, session_digest TEXT REFERENCES human_sessions(digest),
 verification_ref TEXT, occurred_at INTEGER NOT NULL,
 CHECK((actor_kind='owner_session' AND session_digest IS NOT NULL AND verification_ref IS NULL) OR
       (actor_kind='local_operator' AND session_digest IS NULL AND length(verification_ref) BETWEEN 1 AND 200))
) STRICT;
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
 lease_owner TEXT, lease_until INTEGER, result_import_id TEXT REFERENCES proposal_imports(id) CHECK(result_import_id IS NULL),
 CHECK((lease_owner IS NULL)=(lease_until IS NULL)),
 CHECK((state IN ('needs_attention','failed','cancelled','imported'))=(completed_at IS NOT NULL)),
 CHECK(state!='imported'), UNIQUE(binding_id,intake_revision,attempt), UNIQUE(binding_id,idempotency_key)
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
CREATE TRIGGER binding_active_scope BEFORE INSERT ON project_task_bindings WHEN NOT EXISTS(
 SELECT 1 FROM human_owner_scopes s JOIN human_owners o ON o.id=s.owner_id
 WHERE s.owner_id=NEW.owner_id AND s.task_id=NEW.task_id AND s.revoked_at IS NULL AND o.disabled_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'active owner scope required'); END;
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
 NEW.result_import_id IS NOT OLD.result_import_id
 BEGIN SELECT RAISE(ABORT,'immutable job identity'); END;
CREATE TRIGGER job_transition BEFORE UPDATE OF state ON processing_jobs WHEN NEW.state!=OLD.state AND NOT (
 (NEW.state='cancelled' AND OLD.state IN ('queued','dispatching','dispatched','running','collecting','validating','dispatch_uncertain')) OR
 (OLD.state='queued' AND NEW.state='dispatching') OR
 (OLD.state='dispatching' AND NEW.state IN ('dispatched','failed','dispatch_uncertain')) OR
 (OLD.state='dispatched' AND NEW.state IN ('running','failed','needs_attention')) OR
 (OLD.state='running' AND NEW.state IN ('collecting','failed','needs_attention')) OR
 (OLD.state='collecting' AND NEW.state IN ('validating','failed','needs_attention')) OR
 (OLD.state='validating' AND NEW.state IN ('needs_attention','failed')) OR
 (OLD.state='queued' AND NEW.state='failed'))
 BEGIN SELECT RAISE(ABORT,'invalid job transition'); END;
${['project_task_bindings','binding_audit_events','processing_job_events'].map(table=>`
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'append only'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'retain history'); END;`).join('')}
CREATE TRIGGER job_no_delete BEFORE DELETE ON processing_jobs BEGIN SELECT RAISE(ABORT,'retain job'); END;
`;
