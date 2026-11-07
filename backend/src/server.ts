import {commercialDemo} from './commercial/service.js';
import { startMockWorker } from './jobs/worker.js';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db/connection.js';

process.umask(0o077);
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
let stopWorker:(()=>Promise<void>)|undefined;
try {
  const config = readConfig();
  const db = openDatabase(config);
  try { app = await buildApp(db,{localWorkspace:config.mode==='demo'}); }
  catch { db.close(); throw new Error(); }
  await app.listen({ host: config.host, port: config.port });
  if(['test','demo'].includes(config.mode)&&process.env.NODE_ENV!=='production'&&!commercialDemo(db))stopWorker=startMockWorker(db);
  console.info('RoomTreasury foundation listening on loopback.');
  const shutdown = async () => { await stopWorker?.(); await app?.close(); };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
} catch {
  await stopWorker?.();
  await app?.close();
  console.error('Backend startup failed. Check runtime, configuration and database migrations.');
  process.exitCode = 1;
}
