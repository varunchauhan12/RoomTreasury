import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase, BUSY_TIMEOUT_MS } from '../src/db/connection.js';
import { applyMigrations, migrations, MigrationError } from '../src/db/migrations.js';
import { testDatabase } from './helpers.js';
import BetterSqlite3 from 'better-sqlite3';
import { join } from 'node:path';
import { temporaryRoot } from './helpers.js';

test('SQLite opens a temporary file with enforced FK, bounded timeout and WAL', (t) => {
  const { db } = testDatabase(t);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(db.pragma('busy_timeout', { simple: true }), BUSY_TIMEOUT_MS);
  assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
  db.exec('CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE child(parent_id INTEGER REFERENCES parent(id));');
  assert.throws(() => db.prepare('INSERT INTO child VALUES (123)').run(), /FOREIGN KEY/);
});

test('a transaction commits; a deliberately failed transaction rolls back all writes', (t) => {
  const { db } = testDatabase(t);
  db.exec('CREATE TABLE smoke(id INTEGER PRIMARY KEY, value TEXT NOT NULL) STRICT;');
  db.transaction(() => { db.prepare('INSERT INTO smoke VALUES (?, ?)').run(1, 'committed'); }).immediate();
  assert.equal(db.prepare('SELECT value FROM smoke WHERE id=1').pluck().get(), 'committed');
  assert.throws(() => db.transaction(() => {
    db.prepare('INSERT INTO smoke VALUES (?, ?)').run(2, 'rolled back');
    db.prepare('INSERT INTO smoke VALUES (?, ?)').run(1, 'duplicate');
  }).immediate(), /UNIQUE/);
  assert.equal(db.prepare('SELECT count(*) FROM smoke').pluck().get(), 1);
  assert.equal(db.inTransaction, false);
});

test('identity schema contains only metadata and service tables and repeat/reopen applies exactly once', (t) => {
  const { db, config } = testDatabase(t);
  const rows = db.prepare('SELECT * FROM schema_migrations').all();
  assert.equal(rows.length, 2);
  assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").pluck().all(), ['schema_migrations', 'service_principals', 'service_scopes', 'service_credentials', 'service_auth_events']);
  applyMigrations(db, 'test');
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), rows);
  db.close();
  const reopened = openDatabase(config);
  try { assert.deepEqual(reopened.prepare('SELECT * FROM schema_migrations').all(), rows); }
  finally { reopened.close(); }
});

test('ordered pending migrations commit together and only once', (t) => {
  const { db } = testDatabase(t);
  const ordered = [...migrations,
    { version: 3, name: 'smoke_table', sql: 'CREATE TABLE smoke(value INTEGER);' },
    { version: 4, name: 'smoke_row', sql: 'INSERT INTO smoke VALUES (42);' }
  ];
  applyMigrations(db, 'test', ordered);
  applyMigrations(db, 'test', ordered);
  assert.equal(db.prepare('SELECT count(*) FROM smoke').pluck().get(), 1);
  assert.deepEqual(db.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all(), [1, 2, 3, 4]);
});

test('migration error rolls back every pending DDL/write and leaves previous history intact', (t) => {
  const { db } = testDatabase(t);
  const before = db.prepare('SELECT * FROM schema_migrations').all();
  assert.throws(() => applyMigrations(db, 'test', [...migrations,
    { version: 3, name: 'temporary', sql: 'CREATE TABLE should_rollback(id INTEGER);' },
    { version: 4, name: 'broken', sql: 'NOT VALID SQL;' }
  ]), MigrationError);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='should_rollback'").get(), undefined);
  assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(), before);
  assert.equal(db.inTransaction, false);
});

test('a failure during first bootstrap rolls back migration metadata too', (t) => {
  const db = new BetterSqlite3(join(temporaryRoot(t), 'bootstrap.sqlite'));
  try {
    db.pragma('foreign_keys = ON');
    assert.throws(() => applyMigrations(db, 'test', [...migrations, { version: 3, name: 'broken', sql: 'NOT SQL;' }]), MigrationError);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), []);
    assert.equal(db.inTransaction, false);
  } finally { db.close(); }
});

test('invalid order, changed historical SQL, unknown versions and mode mismatch fail closed', (t) => {
  const { db } = testDatabase(t);
  assert.throws(() => applyMigrations(db, 'test', [...migrations, { version: 4, name: 'gap', sql: 'SELECT 1;' }]), MigrationError);
  assert.throws(() => applyMigrations(db, 'test', [{ ...migrations[0]!, sql: 'SELECT 1;' }]), MigrationError);
  assert.throws(() => applyMigrations(db, 'real'), MigrationError);
  db.prepare('UPDATE schema_migrations SET version=99 WHERE version=2').run();
  assert.throws(() => applyMigrations(db, 'test'), MigrationError);
});

test('two independent SQLite files remain isolated', (t) => {
  const first = testDatabase(t);
  const second = testDatabase(t);
  assert.notEqual(first.config.databasePath, second.config.databasePath);
  first.db.exec('CREATE TABLE local_only(value INTEGER); INSERT INTO local_only VALUES (1);');
  assert.equal(second.db.prepare("SELECT 1 FROM sqlite_master WHERE name='local_only'").get(), undefined);
  assert.equal(second.db.prepare('SELECT count(*) FROM schema_migrations').pluck().get(), 2);
});

test('two connections use bounded contention and recover after lock release', (t) => {
  const { db, config } = testDatabase(t);
  const second = openDatabase(config);
  try {
    db.exec('BEGIN IMMEDIATE');
    const start = Date.now();
    assert.throws(() => second.exec('BEGIN IMMEDIATE'), /locked/);
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= BUSY_TIMEOUT_MS - 100 && elapsed < BUSY_TIMEOUT_MS + 3000);
    db.exec('ROLLBACK');
    second.transaction(() => second.prepare('SELECT 1').get()).immediate();
  } finally { if (db.inTransaction) db.exec('ROLLBACK'); second.close(); }
});
