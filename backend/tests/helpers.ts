import { assertFixtureStorageHasNoSecrets } from '../src/security/test-fixtures.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';

export function temporaryRoot(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'roomtreasury-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
export function testDatabase(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'roomtreasury-test-'));
  const config = readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(root, 'test.sqlite') });
  const db = openDatabase(config);
  t.after(() => {
    try { assertFixtureStorageHasNoSecrets(db); }
    finally {
      if (db.open) db.close();
      try { assertFixtureStorageHasNoSecrets(db); }
      finally { rmSync(root, { recursive: true, force: true }); }
    }
  });
  return { root, config, db };
}
