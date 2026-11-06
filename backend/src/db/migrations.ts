import { agencySchema } from './agency-schema.js';
import { financialSchema } from './financial-schema.js';
import { serviceSchema } from './service-schema.js';
import { createHash } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { Mode } from '../config.js';

export interface Migration { readonly version: number; readonly name: string; readonly sql: string }
// Append migrations only; applied SQL is checked against its recorded checksum.
export const migrations: readonly Migration[] = [{
  version: 1, name: 'migration_metadata',
  sql: `CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('test', 'demo', 'real')),
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT;`
}, { version: 2, name: 'service_identity', sql: serviceSchema }, { version: 3, name: 'synthetic_financial_engine', sql: financialSchema }, { version: 4, name: 'agency_projects_and_allocations', sql: agencySchema }];
export class MigrationError extends Error {
  constructor() { super('Database migration failed; no pending migrations were committed.'); }
}
interface Applied { version: number; name: string; checksum: string; mode: Mode }
const checksum = (migration: Migration): string => createHash('sha256').update(migration.sql).digest('hex');
export function applyMigrations(db: Database, mode: Mode, ordered: readonly Migration[] = migrations): void {
  try {
    if (!ordered.length || ordered.some((m, i) => m.version !== i + 1 || !m.name.trim() || !m.sql.trim())) throw new MigrationError();
    db.transaction(() => {
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
      const applied = exists ? db.prepare('SELECT version, name, checksum, mode FROM schema_migrations ORDER BY version').all() as Applied[] : [];
      if (applied.some((row, i) => {
        const expected = ordered[i];
        return !expected || row.version !== expected.version || row.name !== expected.name || row.checksum !== checksum(expected) || row.mode !== mode;
      })) throw new MigrationError();
      for (const migration of ordered.slice(applied.length)) {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations(version, name, checksum, mode) VALUES (?, ?, ?, ?)')
          .run(migration.version, migration.name, checksum(migration), mode);
      }
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (db.pragma('foreign_keys', { simple: true }) !== 1 || violations.length) throw new MigrationError();
    }).immediate();
  } catch {
    throw new MigrationError(); // Do not expose SQL, paths or native error payloads.
  }
}
