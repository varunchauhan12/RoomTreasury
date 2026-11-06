import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { temporaryRoot } from './helpers.js';

const migrate = resolve('.test-build/src/db/migrate.js');
const server = resolve('.test-build/src/server.js');

test('migration CLI runs twice with one explicit temporary database', (t) => {
  const root = temporaryRoot(t);
  const path = join(root, 'cli.sqlite');
  const env = { NODE_ENV: 'test', TMPDIR: tmpdir(), ROOMTREASURY_DB_PATH: path };
  for (let i = 0; i < 2; i++) {
    const result = spawnSync(process.execPath, [migrate], { env, encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), 'Database migrations are up to date.');
    assert.equal(result.stderr, '');
  }
  assert.equal(existsSync(path), true);
});

test('invalid startup fails before listening and does not echo supplied values', () => {
  const result = spawnSync(process.execPath, [server], {
    env: { ROOMTREASURY_MODE: 'demo', ROOMTREASURY_PORT: 'secret-invalid-port' }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.ok(!result.stderr.includes('secret-invalid-port'));
  assert.equal(result.stdout, '');
});

test('demo and real mode storage are separated in an isolated temporary project', (t) => {
  const root = temporaryRoot(t);
  for (const mode of ['demo', 'real']) {
    const result = spawnSync(process.execPath, [migrate], {
      cwd: root, env: { ROOMTREASURY_MODE: mode, ROOMTREASURY_DB_PATH: `var/${mode}/foundation.sqlite` }, encoding: 'utf8'
    });
    assert.equal(result.status, 0);
    assert.ok(existsSync(join(root, 'var', mode, 'foundation.sqlite')));
  }
  const wrong = spawnSync(process.execPath, [migrate], {
    cwd: root, env: { ROOMTREASURY_MODE: 'demo', ROOMTREASURY_DB_PATH: 'var/real/foundation.sqlite' }, encoding: 'utf8'
  });
  assert.equal(wrong.status, 1);
});

test('demo mode rejects symlink alias into real mode storage before opening', (t) => {
  const root = temporaryRoot(t);
  mkdirSync(join(root, 'var', 'real'), { recursive: true });
  symlinkSync(join(root, 'var', 'real'), join(root, 'var', 'demo'));
  const result = spawnSync(process.execPath, [migrate], {
    cwd: root, env: { ROOMTREASURY_MODE: 'demo', ROOMTREASURY_DB_PATH: 'var/demo/rejected.sqlite' }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.equal(existsSync(join(root, 'var', 'real', 'rejected.sqlite')), false);
});
