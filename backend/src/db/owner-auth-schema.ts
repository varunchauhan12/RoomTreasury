const immutable=(table:string)=>`CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable owner authentication audit'); END;
CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'immutable owner authentication audit'); END;`;
export const ownerAuthSchema=`
CREATE TABLE human_owners(id TEXT PRIMARY KEY NOT NULL,username TEXT NOT NULL UNIQUE,
 password_salt BLOB NOT NULL CHECK(length(password_salt)=16),password_hash BLOB NOT NULL CHECK(length(password_hash)=64),
 created_at INTEGER NOT NULL,disabled_at INTEGER) STRICT;
CREATE TABLE human_owner_scopes(owner_id TEXT NOT NULL REFERENCES human_owners(id),task_id TEXT NOT NULL,
 granted_at INTEGER NOT NULL,revoked_at INTEGER,PRIMARY KEY(owner_id,task_id)) STRICT;
CREATE TABLE human_sessions(digest TEXT PRIMARY KEY NOT NULL CHECK(length(digest)=64),owner_id TEXT NOT NULL REFERENCES human_owners(id),
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,revoked_at INTEGER,
 CHECK(expires_at>created_at AND last_seen>=created_at)) STRICT;
CREATE TABLE human_login_limits(key TEXT PRIMARY KEY NOT NULL,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL) STRICT;
CREATE TABLE authenticated_review_events(id INTEGER PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES human_owners(id),
 session_digest TEXT NOT NULL REFERENCES human_sessions(digest),import_id TEXT NOT NULL REFERENCES proposal_imports(id),
 revision_id TEXT NOT NULL REFERENCES owner_review_revisions(id),fingerprint TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('note','verify','revise','decision')),target_id TEXT NOT NULL,gate TEXT,
 occurred_at INTEGER NOT NULL,auth_basis TEXT NOT NULL CHECK(auth_basis='authenticated_owner_session')) STRICT;
CREATE TRIGGER human_owner_identity BEFORE UPDATE ON human_owners WHEN NEW.id IS NOT OLD.id OR NEW.username IS NOT OLD.username OR NEW.created_at IS NOT OLD.created_at
 BEGIN SELECT RAISE(ABORT,'immutable owner identity'); END;
CREATE TRIGGER human_session_identity BEFORE UPDATE ON human_sessions WHEN NEW.digest IS NOT OLD.digest OR NEW.owner_id IS NOT OLD.owner_id OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR NEW.last_seen<OLD.last_seen OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NOT OLD.revoked_at)
 BEGIN SELECT RAISE(ABORT,'immutable session binding'); END;
${immutable('authenticated_review_events')}
`;
