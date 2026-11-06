import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ConfigurationError, readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { temporaryRoot } from './helpers.js';

test('tests default to test mode, still require an explicit temporary DB path', (t) => {
  const path = join(temporaryRoot(t), 'test.sqlite');
  const config = readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: path });
  assert.equal(config.mode, 'test');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(Object.isFrozen(config), true);
  assert.throws(() => readConfig({ NODE_ENV: 'test' }), ConfigurationError);
  assert.throws(() => readConfig({ ROOMTREASURY_DB_PATH: path }), ConfigurationError);
});

test('test execution rejects demo/real modes and persistent real paths before opening', (t) => {
  const root = temporaryRoot(t);
  for (const mode of ['demo', 'real']) {
    assert.throws(() => readConfig({ NODE_ENV: 'test', ROOMTREASURY_MODE: mode, ROOMTREASURY_DB_PATH: join(root, 'test.sqlite') }), ConfigurationError);
  }
  assert.throws(() => readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: 'var/real/roomtreasury.sqlite' }), ConfigurationError);
  const config = readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(root, 'test.sqlite') });
  assert.throws(() => openDatabase({ ...config, mode: 'real' }), ConfigurationError);
});

test('missing demo path never falls back and unsafe host/port values are rejected without echo', (t) => {
  assert.throws(() => readConfig({ ROOMTREASURY_MODE: 'demo' }), ConfigurationError);
  const base = { NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(temporaryRoot(t), 'test.sqlite') };
  for (const port of ['0', '65536', '1.5', 'NaN', '12secret']) {
    assert.throws(() => readConfig({ ...base, ROOMTREASURY_PORT: port }), ConfigurationError);
  }
  assert.throws(() => readConfig({ ...base, ROOMTREASURY_HOST: '0.0.0.0' }), ConfigurationError);
  assert.throws(() => readConfig({ ...base, ROOMTREASURY_MODE: 'invalid-sensitive-value' }), (e: unknown) => {
    assert.ok(e instanceof ConfigurationError);
    assert.ok(!e.message.includes('sensitive-value'));
    return true;
  });
});

test('test-path symlink escape is rejected', (t) => {
  const root = temporaryRoot(t);
  // Link to the temp parent, not a persistent database; no external file is opened.
  mkdirSync(join(root, 'links'));
  symlinkSync(join(root, '..'), join(root, 'links', 'escape'));
  assert.throws(() => readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(root, 'links', 'escape', 'persistent.sqlite') }), ConfigurationError);
});
