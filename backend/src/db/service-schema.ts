// Version 2: identity only. No records are seeded by this migration.
export const serviceSchema = `
CREATE TABLE service_principals (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)>0),
 label TEXT NOT NULL UNIQUE CHECK(length(label)>0),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 disabled_at INTEGER CHECK(disabled_at>=created_at)
) STRICT;
CREATE TABLE service_scopes (
 project_id TEXT NOT NULL CHECK(length(project_id)>0),
 principal_id TEXT NOT NULL REFERENCES service_principals(id) ON DELETE RESTRICT,
 role TEXT NOT NULL CHECK(role IN ('coordinator','request','challenge','commitment_intelligence','treasury_ops')),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 disabled_at INTEGER CHECK(disabled_at>=created_at),
 PRIMARY KEY(project_id,principal_id)
) STRICT;
CREATE UNIQUE INDEX service_active_role ON service_scopes(project_id,role) WHERE disabled_at IS NULL;
CREATE TABLE service_credentials (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=22),
 principal_id TEXT NOT NULL REFERENCES service_principals(id) ON DELETE RESTRICT,
 secret_digest BLOB NOT NULL UNIQUE CHECK(length(secret_digest)=32),
 created_at INTEGER NOT NULL CHECK(created_at>=0),
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
 revoked_at INTEGER CHECK(revoked_at>=created_at)
) STRICT;
CREATE UNIQUE INDEX service_current_credential ON service_credentials(principal_id) WHERE revoked_at IS NULL;
CREATE TABLE service_auth_events (
 id INTEGER PRIMARY KEY,
 action TEXT NOT NULL CHECK(action IN ('principal_created','principal_disabled','scope_created','scope_disabled','scope_reactivated','issued','rotated','revoked')),
 actor_category TEXT NOT NULL CHECK(actor_category='test_fixture'),
 principal_id TEXT NOT NULL REFERENCES service_principals(id) ON DELETE RESTRICT,
 credential_id TEXT REFERENCES service_credentials(id) ON DELETE RESTRICT,
 project_id TEXT,
 occurred_at INTEGER NOT NULL CHECK(occurred_at>=0),
 outcome TEXT NOT NULL CHECK(outcome='success')
) STRICT;
CREATE TRIGGER principal_immutable BEFORE UPDATE ON service_principals
 WHEN NEW.id IS NOT OLD.id OR NEW.label IS NOT OLD.label OR NEW.created_at IS NOT OLD.created_at OR OLD.disabled_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'immutable principal'); END;
CREATE TRIGGER scope_immutable BEFORE UPDATE ON service_scopes
 WHEN NEW.project_id IS NOT OLD.project_id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.role IS NOT OLD.role OR NEW.created_at IS NOT OLD.created_at
 BEGIN SELECT RAISE(ABORT,'immutable scope'); END;
CREATE TRIGGER credential_immutable BEFORE UPDATE ON service_credentials
 WHEN NEW.id IS NOT OLD.id OR NEW.principal_id IS NOT OLD.principal_id OR NEW.secret_digest IS NOT OLD.secret_digest OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at OR OLD.revoked_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'immutable credential'); END;
CREATE TRIGGER principal_no_delete BEFORE DELETE ON service_principals BEGIN SELECT RAISE(ABORT,'retain principal'); END;
CREATE TRIGGER scope_no_delete BEFORE DELETE ON service_scopes BEGIN SELECT RAISE(ABORT,'retain scope'); END;
CREATE TRIGGER credential_no_delete BEFORE DELETE ON service_credentials BEGIN SELECT RAISE(ABORT,'retain credential'); END;
CREATE TRIGGER auth_event_no_update BEFORE UPDATE ON service_auth_events BEGIN SELECT RAISE(ABORT,'append only'); END;
CREATE TRIGGER auth_event_no_delete BEFORE DELETE ON service_auth_events BEGIN SELECT RAISE(ABORT,'append only'); END;
`;
