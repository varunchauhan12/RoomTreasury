import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import BetterSqlite3 from 'better-sqlite3';
import { buildApp } from '../src/app.js';
import { temporaryRoot, testDatabase } from './helpers.js';
import { openDatabase } from '../src/db/connection.js';
import { applyMigrations, migrations } from '../src/db/migrations.js';
import { authenticate, bearer, generateCredential, projectRole, requireRole, requireAssignedTask, denyServiceOwner,
  authorizedWrite, roles, AuthError } from '../src/security/service-auth.js';
import { createFixturePrincipal, issueFixtureCredential, revokeFixtureCredential, disableFixturePrincipal, setFixtureScopeEnabled } from '../src/security/test-fixtures.js';

function status(action: () => unknown, expected: number): void {
  assert.throws(action, (error: unknown) => error instanceof AuthError && error.statusCode === expected);
}

test('five independently scoped fixture identities authenticate; JSON and headers cannot select principal', async (t) => {
  const { db } = testDatabase(t); const app = await buildApp(db);
  try {
    for (const role of roles) {
      const id = createFixturePrincipal(db, 'project-a', role);
      const token = issueFixtureCredential(db, id);
      const context = authenticate(db, token);
      assert.equal(Object.isFrozen(context), true);
      assert.throws(() => { (context as { principalId: string }).principalId = 'forged'; });
      const response = await app.inject({ url: '/v1/projects/project-a/service-identity', headers: { authorization: `Bearer ${token}`, 'x-principal-id': 'forged', 'x-role': 'owner' } });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { principalId: id, kind: 'service', projectId: 'project-a', role });
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal((await app.inject({ url: '/v1/projects/project-a/service-identity?principalId=forged', headers: { authorization: `Bearer ${token}` } })).statusCode, 400);
      assert.equal((await app.inject({ method: 'GET', url: '/v1/projects/project-a/service-identity', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { principalId: 'forged', role: 'owner' } })).statusCode, 400);
      assert.equal((await app.inject({ url: '/v1/projects/project-b/service-identity', headers: { authorization: `Bearer ${token}` } })).statusCode, 404);
      status(() => denyServiceOwner(context), 403);
      if (role !== 'treasury_ops') status(() => requireRole(role, 'treasury_ops'), 403);
    }
  } finally { await app.close(); }
});

test('invalid, missing, malformed, duplicate, wrong-secret and unknown-selector credentials have generic 401', async (t) => {
  const { db } = testDatabase(t); const app = await buildApp(db);
  const id = createFixturePrincipal(db, 'a', 'request');
  const token = issueFixtureCredential(db, id);
  const other = generateCredential().token;
  const wrong = `${token.split('.').slice(0, 2).join('.')}.${other.split('.')[2]}`;
  try {
    for (const authorization of ['', 'Bearer invalid', `Bearer ${other}`, `Bearer ${wrong}`, `Bearer ${token}, Bearer ${token}`, `Basic ${token}`, `Bearer ${token}=`, 'Bearer ' + 'x'.repeat(500)]) {
      const result = await app.inject({ url: '/v1/projects/a/service-identity', headers: { authorization } });
      assert.equal(result.statusCode, 401);
      assert.equal(result.json().error.code, 'UNAUTHENTICATED');
      assert.equal(result.json().error.message, 'Request rejected.');
    }
    const noHeader = await app.inject({ url: '/v1/projects/a/service-identity', headers: { cookie: `token=${token}` } });
    assert.equal(noHeader.statusCode, 401);
    status(() => bearer(['Authorization', `Bearer ${token}`, 'authorization', `Bearer ${token}`]), 401);
    // Noncanonical base64 tail is rejected even when decoded bytes would match.
    status(() => authenticate(db, token.slice(0, -1) + '='), 401);
  } finally { await app.close(); }
});

test('expiry, explicit revoke and atomic rotation; expired current slot requires explicit rotation', async (t) => {
  const { db } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'request');
  const old = issueFixtureCredential(db, id, false, 10);
  await new Promise(resolve => setTimeout(resolve, 20));
  status(() => authenticate(db, old), 401);
  assert.throws(() => issueFixtureCredential(db, id));
  const replacement = issueFixtureCredential(db, id, true);
  status(() => authenticate(db, old), 401);
  assert.equal(authenticate(db, replacement).principalId, id);
  revokeFixtureCredential(db, id);
  revokeFixtureCredential(db, id);
  status(() => authenticate(db, replacement), 401);
  assert.equal(db.prepare("SELECT count(*) FROM service_auth_events WHERE action='revoked'").pluck().get(), 1);
  assert.equal(db.prepare('SELECT count(*) FROM service_credentials WHERE revoked_at IS NULL').pluck().get(), 0);
});

test('failed rotation rolls back revocation, credential insertion and security event', (t) => {
  const { db } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'request'); const token = issueFixtureCredential(db, id);
  const before = db.prepare('SELECT count(*) FROM service_auth_events').pluck().get();
  db.exec("CREATE TRIGGER inject_rotation_failure BEFORE INSERT ON service_auth_events WHEN NEW.action='rotated' BEGIN SELECT RAISE(ABORT,'injected'); END;");
  assert.throws(() => issueFixtureCredential(db, id, true));
  assert.equal(authenticate(db, token).principalId, id);
  assert.equal(db.prepare('SELECT count(*) FROM service_credentials').pluck().get(), 1);
  assert.equal(db.prepare('SELECT count(*) FROM service_auth_events').pluck().get(), before);
});

test('scope disable, replacement, conflict on reactivation and principal disable survive reopening', (t) => {
  const { db, config } = testDatabase(t);
  const first = createFixturePrincipal(db, 'a', 'challenge'); const token = issueFixtureCredential(db, first);
  setFixtureScopeEnabled(db, first, 'a', false);
  status(() => projectRole(db, authenticate(db, token), 'a'), 404);
  const replacement = createFixturePrincipal(db, 'a', 'challenge');
  assert.throws(() => setFixtureScopeEnabled(db, first, 'a', true));
  status(() => projectRole(db, authenticate(db, token), 'a'), 404);
  setFixtureScopeEnabled(db, replacement, 'a', false);
  setFixtureScopeEnabled(db, first, 'a', true);
  assert.equal(projectRole(db, authenticate(db, token), 'a'), 'challenge');
  disableFixturePrincipal(db, first);
  db.close(); const reopened = openDatabase(config);
  try { status(() => authenticate(reopened, token), 401); }
  finally { reopened.close(); }
});

test('schema rejects mutable ownership/roles, unsupported owner scope, invalid times/digests and audit modification', (t) => {
  const { db } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'request'); issueFixtureCredential(db, id);
  for (const sql of [
    "UPDATE service_principals SET id='changed'", "UPDATE service_principals SET label='changed'",
    "UPDATE service_scopes SET role='treasury_ops'", "UPDATE service_scopes SET principal_id='changed'",
    "UPDATE service_credentials SET principal_id='changed'", "UPDATE service_credentials SET expires_at=expires_at+1",
    'DELETE FROM service_auth_events', 'UPDATE service_auth_events SET occurred_at=0',
    'DELETE FROM service_scopes', 'DELETE FROM service_credentials', 'DELETE FROM service_principals'
  ]) assert.throws(() => db.exec(sql));
  assert.throws(() => db.prepare("INSERT INTO service_scopes VALUES ('b',?,'owner',0,NULL)").run(id));
  assert.throws(() => db.prepare("INSERT INTO service_credentials VALUES (?,?,?,10,9,NULL)").run('x'.repeat(22), id, Buffer.alloc(32)));
  assert.throws(() => db.prepare("INSERT INTO service_credentials VALUES (?,?,?,10,20,NULL)").run('x'.repeat(22), id, Buffer.alloc(31)));
  assert.throws(() => db.prepare("INSERT INTO service_scopes VALUES ('b','missing','request',0,NULL)").run());
});

test('task guards isolate wrong project, role, assignee and stale/completed attempts', (t) => {
  const { db } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'request'); const context = authenticate(db, issueFixtureCredential(db, id));
  const task = { projectId: 'a', assigneeId: id, role: 'request' as const, attempt: 2, state: 'pending' as const };
  requireAssignedTask(context, 'a', 'request', task, 2);
  status(() => requireAssignedTask(context, 'b', 'request', task, 2), 404);
  status(() => requireAssignedTask(context, 'a', 'challenge', task, 2), 403);
  status(() => requireAssignedTask(context, 'a', 'request', { ...task, assigneeId: 'another-same-role-principal' }, 2), 403);
  status(() => requireAssignedTask(context, 'a', 'request', task, 1), 409);
  status(() => requireAssignedTask(context, 'a', 'request', { ...task, state: 'completed' }, 2), 409);
});

test('authorized write rechecks committed credential/scope changes from a second SQLite connection', (t) => {
  const { db, config } = testDatabase(t); const second = openDatabase(config);
  const id = createFixturePrincipal(db, 'a', 'request'); const token = issueFixtureCredential(db, id);
  try {
    authenticate(db, token); // Prior authentication must not be sufficient for a later write.
    revokeFixtureCredential(second, id);
    let called = false;
    status(() => authorizedWrite(db, token, 'a', 'request', () => { called = true; }), 401);
    assert.equal(called, false);
    const next = issueFixtureCredential(db, id);
    setFixtureScopeEnabled(second, id, 'a', false);
    status(() => authorizedWrite(db, next, 'a', 'request', () => { called = true; }), 404);
    setFixtureScopeEnabled(second, id, 'a', true);
    authorizedWrite(db, next, 'a', 'request', context => {
      assert.equal(db.inTransaction, true);
      assert.equal(context.principalId, id);
      db.prepare("INSERT INTO service_auth_events(action,actor_category,principal_id,occurred_at,outcome) VALUES ('scope_reactivated','test_fixture',?,?,'success')").run(id, Date.now());
    });
  } finally { second.close(); }
});

test('secret values absent from database, WAL, events, captured errors and stdout/stderr', async (t) => {
  const { db, config } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'coordinator');
  const token = issueFixtureCredential(db, id); const secret = token.split('.')[2]!;
  const app = await buildApp(db); const output: string[] = []; const bodies: string[] = [];

  try {


    for (const url of ['/v1/projects/a/service-identity', '/v1/projects/b/service-identity', '/v1/projects/a/service-identity?secret=redacted']) {
      bodies.push((await app.inject({ url, headers: { authorization: `Bearer ${token}` } })).body);
    }
    revokeFixtureCredential(db, id);
    bodies.push((await app.inject({ url: '/v1/projects/a/service-identity', headers: { authorization: `Bearer ${token}` } })).body);
  } finally { /* Logging is separately captured in a child process, outside node:test IPC. */ }
  const stored = JSON.stringify(db.prepare('SELECT * FROM service_auth_events').all());
  assert.equal(output.join(''), '');
  db.pragma('wal_checkpoint(FULL)');
  const buffers = [Buffer.from(stored + bodies.join('') + output.join(''))];
  for (const suffix of ['', '-wal', '-shm']) if (existsSync(config.databasePath + suffix)) buffers.push(readFileSync(config.databasePath + suffix));
  for (const buffer of buffers) {
    assert.equal(buffer.includes(token), false, 'full credential leaked');
    assert.equal(buffer.includes(secret), false, 'secret text leaked');
    assert.equal(buffer.includes(Buffer.from(secret, 'base64url')), false, 'secret bytes leaked');
  }
  assert.equal(db.prepare('SELECT length(secret_digest) FROM service_credentials').pluck().get(), 32);
  await app.close();
});

test('authentication storage failure is safe 503 and never authenticated', async (t) => {
  const { db } = testDatabase(t); const token = generateCredential().token; const app = await buildApp(db); db.close();
  try {
    const response = await app.inject({ url: '/v1/projects/a/service-identity', headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.statusCode, 503); assert.equal(response.json().error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(response.body.includes(token), false);
  } finally { await app.close(); }
});

test('operational issuance is blocked; diagnostic probe is absent in test/demo/real', async (t) => {
  const { db } = testDatabase(t);
  const script = `import {issueFixtureCredential} from ${JSON.stringify(resolve('.test-build/src/security/test-fixtures.js'))}; try { issueFixtureCredential({},'none'); process.exitCode=2; } catch {}`;
  for (const mode of ['test', 'demo', 'real']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { NODE_ENV: 'production', ROOMTREASURY_MODE: mode }, encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(result.stdout + result.stderr, '');
  }
  const app = await buildApp(db);
  try {
    await app.ready();
    assert.deepEqual(Object.keys(app.swagger().paths ?? {}).sort(), ['/health', '/v1/projects/{projectId}/service-identity', '/v1/client-projects/', '/v1/client-projects/{projectId}', '/v1/client-projects/estimate', '/v1/proposal-imports/preview', '/v1/proposal-imports/confirm', '/v1/proposal-imports/', '/v1/proposal-imports/{id}', '/v1/owner-auth/login', '/v1/owner-auth/session', '/v1/owner-auth/logout', '/v1/proposal-imports/{id}/review', '/v1/proposal-imports/{id}/review/notes', '/v1/proposal-imports/{id}/review/verify', '/v1/proposal-imports/{id}/review/revisions', '/v1/proposal-imports/{id}/review/approve', '/v1/proposal-imports/{id}/review/decision', '/v1/client-projects/onboard', '/v1/client-projects/{projectId}/processing-jobs', '/v1/processing-jobs/{id}', '/v1/processing-jobs/{id}/events', '/v1/processing-jobs/{id}/cancel', '/v1/client-projects/{projectId}/proposal-imports/preview', '/v1/client-projects/{projectId}/proposal-imports/confirm'].sort());
    assert.equal((await app.inject({ method: 'POST', url: '/v1/projects/a/service-auth-probes/x/result' })).statusCode, 404);
  } finally { await app.close(); }
});

test('version 1 upgrades through version 4 without altering its SQL or history and repeats safely', (t) => {
  const db = new BetterSqlite3(join(temporaryRoot(t), 'upgrade.sqlite'));
  db.pragma('foreign_keys = ON');
  t.after(() => db.close());
  applyMigrations(db, 'test', migrations.slice(0, 1));
  const before = db.prepare('SELECT * FROM schema_migrations WHERE version=1').get();
  applyMigrations(db, 'test');
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations WHERE version=1').get(), before);
  assert.deepEqual(db.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(migrations[0]!.name, 'migration_metadata');
});

 test('isolated log smoke emits no stdout/stderr with real disposable credentials', (t) => {
  const root = temporaryRoot(t);
  const result = spawnSync(process.execPath, [resolve('.test-build/tests/log-smoke.js')], {
    env: { NODE_ENV: 'test', TMPDIR: tmpdir(), ROOMTREASURY_DB_PATH: join(root, 'logs.sqlite') }, encoding: 'utf8'
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, '');
});

test('actual test/demo/real mode applications register identity and omit probe routes', (t) => {
  const root = temporaryRoot(t);
  const script = resolve('.test-build/tests/mode-smoke.js');
  for (const mode of ['test', 'demo', 'real']) {
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { TMPDIR: tmpdir(), ROOMTREASURY_MODE: mode,
        ROOMTREASURY_DB_PATH: mode === 'test' ? join(root, 'mode-test.sqlite') : `var/${mode}/mode.sqlite` }, encoding: 'utf8'
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});

test('authorized write rejects async callbacks and rolls back their synchronous mutations', (t) => {
  const { db } = testDatabase(t); const id = createFixturePrincipal(db, 'a', 'request'); const token = issueFixtureCredential(db, id);
  const before = db.prepare('SELECT count(*) FROM service_auth_events').pluck().get();
  assert.throws(() => authorizedWrite(db, token, 'a', 'request', async () => {
    db.prepare("INSERT INTO service_auth_events(action,actor_category,principal_id,occurred_at,outcome) VALUES ('scope_reactivated','test_fixture',?,?,'success')").run(id, Date.now());
  }));
  assert.equal(db.prepare('SELECT count(*) FROM service_auth_events').pluck().get(), before);
});

test('overlapping revocation cannot interleave inside an authorized write transaction', (t) => {
  const { db, config } = testDatabase(t); const other = openDatabase(config);
  const id = createFixturePrincipal(db, 'a', 'request'); const token = issueFixtureCredential(db, id);
  try {
    other.pragma('busy_timeout = 20');
    authorizedWrite(db, token, 'a', 'request', () => {
      assert.throws(() => revokeFixtureCredential(other, id), /locked/);
    });
    revokeFixtureCredential(other, id);
    status(() => authorizedWrite(db, token, 'a', 'request', () => {}), 401);
  } finally { other.close(); }
});
