import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import BetterSqlite3, { type Database } from 'better-sqlite3';
import { assertDatabasePath, type Config } from '../config.js';
import { applyMigrations } from './migrations.js';

export const BUSY_TIMEOUT_MS = 1000;
export function openDatabase(config: Config): Database {
  assertDatabasePath(config);
  mkdirSync(dirname(config.databasePath), { recursive: true, mode: 0o700 });
  assertDatabasePath(config);
  let db: Database | undefined;
  try {
    db = new BetterSqlite3(config.databasePath, { timeout: BUSY_TIMEOUT_MS });
    db.pragma('foreign_keys = ON');
    db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    if (db.pragma('foreign_keys', { simple: true }) !== 1 || db.pragma('busy_timeout', { simple: true }) !== BUSY_TIMEOUT_MS) throw new Error();
    applyMigrations(db, config.mode);
    if (db.pragma('journal_mode = WAL', { simple: true }) !== 'wal') throw new Error();
    return db;
  } catch {
    db?.close();
    throw new Error('Database initialization failed; server was not started.');
  }
}
