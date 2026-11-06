import { existsSync, readFileSync } from 'node:fs';
import { assertDatabasePath } from '../config.js';
// Deliberately unavailable to operational/demo/real provisioning. No route or CLI imports this file.
import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { generateCredential, type Role } from './service-auth.js';

const fixtureSecrets = new WeakMap<Database, string[]>();
export function assertFixtureStorageHasNoSecrets(db: Database): void {
  for (const suffix of ['', '-wal', '-shm']) {
    if (!existsSync(db.name + suffix)) continue;
    const bytes = readFileSync(db.name + suffix);
    for (const token of fixtureSecrets.get(db) ?? []) {
      const secret = token.split('.')[2]!;
      if (bytes.includes(token) || bytes.includes(secret) || bytes.includes(Buffer.from(secret, 'base64url'))) throw new Error('Credential persistence detected.');
    }
  }
}
function testOnly(db: Database): void {
  if (process.env.NODE_ENV !== 'test' || db.prepare("SELECT count(*) FROM schema_migrations WHERE mode!='test'").pluck().get() !== 0) {
    throw new Error('Operational credential provisioning is unavailable.');
  }
  assertDatabasePath({ mode: 'test', databasePath: db.name, projectRoot: process.cwd(), host: '127.0.0.1', port: 3000 });
}
function event(db: Database, action: string, principal: string, credential: string | null, project: string | null, now: number): void {
  db.prepare(`INSERT INTO service_auth_events(action,actor_category,principal_id,credential_id,project_id,occurred_at,outcome)
    VALUES (?,'test_fixture',?,?,?,?,'success')`).run(action, principal, credential, project, now);
}
export function createFixturePrincipal(db: Database, project: string, role: Role): string {
  testOnly(db);
  return db.transaction(() => {
    const id = randomUUID(); const now = Date.now();
    db.prepare('INSERT INTO service_principals(id,label,created_at) VALUES (?,?,?)').run(id, `fixture-${randomUUID()}`, now);
    db.prepare('INSERT INTO service_scopes(project_id,principal_id,role,created_at) VALUES (?,?,?,?)').run(project, id, role, now);
    event(db, 'principal_created', id, null, null, now);
    event(db, 'scope_created', id, null, project, now);
    return id;
  }).immediate();
}
export function issueFixtureCredential(db: Database, principal: string, rotate = false, ttl = 86400000): string {
  testOnly(db);
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 86400000) throw new Error('Invalid credential lifetime.');
  return db.transaction(() => {
    const now = Date.now();
    if (!db.prepare(`SELECT 1 FROM service_principals p JOIN service_scopes s ON s.principal_id=p.id
      WHERE p.id=? AND p.disabled_at IS NULL AND s.disabled_at IS NULL`).get(principal)) throw new Error('Principal unavailable.');
    const current = db.prepare('SELECT id FROM service_credentials WHERE principal_id=? AND revoked_at IS NULL').get(principal) as { id: string } | undefined;
    if (current && !rotate) throw new Error('Rotation required, including for expired credentials.');
    if (current) db.prepare('UPDATE service_credentials SET revoked_at=? WHERE id=?').run(now, current.id);
    const generated = generateCredential();
    const secrets = fixtureSecrets.get(db) ?? [];
    secrets.push(generated.token); fixtureSecrets.set(db, secrets);
    db.prepare('INSERT INTO service_credentials(id,principal_id,secret_digest,created_at,expires_at) VALUES (?,?,?,?,?)')
      .run(generated.id, principal, generated.secretDigest, now, now + ttl);
    event(db, rotate ? 'rotated' : 'issued', principal, generated.id, null, now);
    return generated.token;
  }).immediate();
}
export function revokeFixtureCredential(db: Database, principal: string): void {
  testOnly(db);
  db.transaction(() => {
    const now = Date.now();
    const row = db.prepare('SELECT id FROM service_credentials WHERE principal_id=? AND revoked_at IS NULL').get(principal) as { id: string } | undefined;
    if (!row) return;
    db.prepare('UPDATE service_credentials SET revoked_at=? WHERE id=?').run(now, row.id);
    event(db, 'revoked', principal, row.id, null, now);
  }).immediate();
}
export function setFixtureScopeEnabled(db: Database, principal: string, project: string, enabled: boolean): void {
  testOnly(db);
  db.transaction(() => {
    const row = db.prepare('SELECT disabled_at FROM service_scopes WHERE principal_id=? AND project_id=?').get(principal, project) as { disabled_at: number | null } | undefined;
    if (!row) throw new Error('Scope unavailable.');
    if (enabled === (row.disabled_at === null)) return;
    const now = Date.now();
    db.prepare('UPDATE service_scopes SET disabled_at=? WHERE principal_id=? AND project_id=?').run(enabled ? null : now, principal, project);
    event(db, enabled ? 'scope_reactivated' : 'scope_disabled', principal, null, project, now);
  }).immediate();
}
export function disableFixturePrincipal(db: Database, principal: string): void {
  testOnly(db);
  db.transaction(() => {
    const now = Date.now();
    const result = db.prepare('UPDATE service_principals SET disabled_at=? WHERE id=? AND disabled_at IS NULL').run(now, principal);
    if (result.changes) event(db, 'principal_disabled', principal, null, null, now);
  }).immediate();
}
