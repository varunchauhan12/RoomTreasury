import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db/connection.js';

process.umask(0o077);
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
try {
  const config = readConfig();
  const db = openDatabase(config);
  try { app = await buildApp(db); }
  catch { db.close(); throw new Error(); }
  await app.listen({ host: config.host, port: config.port });
  console.info('RoomTreasury foundation listening on loopback.');
  const shutdown = async () => { await app?.close(); };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
} catch {
  await app?.close();
  console.error('Backend startup failed. Check runtime, configuration and database migrations.');
  process.exitCode = 1;
}
