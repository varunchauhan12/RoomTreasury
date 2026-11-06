import { readConfig } from '../config.js';
import { openDatabase } from './connection.js';

process.umask(0o077);
try {
  const db = openDatabase(readConfig());
  db.close();
  console.info('Database migrations are up to date.');
} catch {
  console.error('Migration command failed. Check configuration and database migration compatibility.');
  process.exitCode = 1;
}
