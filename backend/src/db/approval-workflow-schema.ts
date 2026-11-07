const immutable=(table:string)=>`
CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable workflow history'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'retain workflow history'); END;`;
export const approvalWorkflowSchema=`
CREATE TABLE approval_decisions (
 id TEXT PRIMARY KEY NOT NULL, binding_id TEXT NOT NULL REFERENCES project_task_bindings(id),
 gate TEXT NOT NULL CHECK(gate IN ('intake','proposal','commercial','financial','activation')),
 subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64), revision_id TEXT, fingerprint TEXT,
 job_id TEXT REFERENCES processing_jobs(id), owner_id TEXT NOT NULL REFERENCES human_owners(id),
 decision TEXT NOT NULL CHECK(decision IN ('approve','reject','changes','blocked')),
 reason TEXT NOT NULL CHECK(length(trim(reason))>0), evidence TEXT NOT NULL CHECK(json_valid(evidence) AND json_type(evidence)='array'),
 checklist TEXT NOT NULL CHECK(json_valid(checklist) AND json_type(checklist)='array'),
 created_at INTEGER NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 UNIQUE(binding_id,request_key)
) STRICT;
CREATE TABLE analysis_revisions (
 id TEXT PRIMARY KEY NOT NULL, binding_id TEXT NOT NULL REFERENCES project_task_bindings(id),
 revision INTEGER NOT NULL CHECK(revision>0), decision_id TEXT NOT NULL UNIQUE REFERENCES approval_decisions(id),
 source_import_id TEXT REFERENCES proposal_imports(id), source_revision_id TEXT, source_fingerprint TEXT,
 original_payload TEXT CHECK(original_payload IS NULL OR json_valid(original_payload)),
 sections TEXT NOT NULL CHECK(json_valid(sections)), specialists TEXT NOT NULL CHECK(json_valid(specialists)),
 instructions TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(binding_id,revision)
) STRICT;
CREATE TABLE analysis_revision_jobs (
 analysis_revision_id TEXT PRIMARY KEY NOT NULL REFERENCES analysis_revisions(id),
 job_id TEXT NOT NULL UNIQUE REFERENCES processing_jobs(id)
) STRICT;
CREATE TABLE commercial_agreement_endorsements (
 id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES client_projects(id),
 agreement_id TEXT NOT NULL, quote_id TEXT NOT NULL, signed_on TEXT NOT NULL, terms TEXT NOT NULL,
 reference TEXT NOT NULL CHECK(length(trim(reference))>0), owner_id TEXT NOT NULL REFERENCES human_owners(id),
 created_at INTEGER NOT NULL, UNIQUE(project_id,quote_id),
 FOREIGN KEY(project_id,agreement_id) REFERENCES commercial_agreements(project_id,id),
 FOREIGN KEY(project_id,quote_id) REFERENCES commercial_quotes(project_id,id)
) STRICT;
CREATE TABLE approval_reports (
 id TEXT PRIMARY KEY NOT NULL, binding_id TEXT NOT NULL REFERENCES project_task_bindings(id),
 version INTEGER NOT NULL CHECK(version>0), import_id TEXT REFERENCES proposal_imports(id),
 revision_id TEXT, fingerprint TEXT, snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64), created_at INTEGER NOT NULL,
 UNIQUE(binding_id,version)
) STRICT;
CREATE TRIGGER approval_owner_binding BEFORE INSERT ON approval_decisions WHEN NOT EXISTS(
 SELECT 1 FROM project_task_bindings b JOIN human_owner_scopes s ON s.owner_id=b.owner_id AND s.task_id=b.task_id
 JOIN human_owners o ON o.id=b.owner_id
 WHERE b.id=NEW.binding_id AND b.owner_id=NEW.owner_id AND s.revoked_at IS NULL AND o.disabled_at IS NULL
 AND (NEW.job_id IS NULL OR EXISTS(SELECT 1 FROM processing_jobs j WHERE j.id=NEW.job_id AND j.binding_id=b.id)))
 BEGIN SELECT RAISE(ABORT,'invalid owner workflow binding'); END;
${['approval_decisions','analysis_revisions','analysis_revision_jobs','commercial_agreement_endorsements','approval_reports'].map(immutable).join('\n')}
`;
