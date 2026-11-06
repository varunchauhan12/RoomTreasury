import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../app.js';
import { readConfig } from '../config.js';
import { openDatabase } from '../db/connection.js';

// Specification generation never reads deployment settings or real storage.
const root = mkdtempSync(join(tmpdir(), 'roomtreasury-test-'));
try {
  const db = openDatabase(readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(root, 'openapi.sqlite') }));
  const app = await buildApp(db);
  try {
    await app.ready();
    writeFileSync('backend/openapi.json', JSON.stringify(app.swagger(), null, 2) + '\n');
  } finally { await app.close(); }
} finally { rmSync(root, { recursive: true, force: true }); }
