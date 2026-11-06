import assert from 'node:assert/strict';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
const db = openDatabase(readConfig());
if(process.env.ROOMTREASURY_MODE==='real')process.env.ROOMTREASURY_AUTH_ORIGIN='https://127.0.0.1:3000';
const app = await buildApp(db);
try {
  await app.ready();
  const spec = app.swagger();
  assert.deepEqual(Object.keys(spec.paths ?? {}).sort(), ['/health', '/v1/projects/{projectId}/service-identity', '/v1/client-projects/', '/v1/client-projects/{projectId}', '/v1/client-projects/estimate', '/v1/proposal-imports/preview', '/v1/proposal-imports/confirm', '/v1/proposal-imports/', '/v1/proposal-imports/{id}', '/v1/owner-auth/login', '/v1/owner-auth/session', '/v1/owner-auth/logout', '/v1/proposal-imports/{id}/review', '/v1/proposal-imports/{id}/review/notes', '/v1/proposal-imports/{id}/review/verify', '/v1/proposal-imports/{id}/review/revisions', '/v1/proposal-imports/{id}/review/approve', '/v1/proposal-imports/{id}/review/decision'].sort());
  await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
  assert.equal((await app.inject({ method: 'POST', url: '/v1/projects/a/service-auth-probes/x/result' })).statusCode, 404);
  assert.equal((await app.inject('/v1/projects/a/service-identity')).statusCode, 401);
  assert.equal(db.prepare('SELECT count(*) FROM service_principals').pluck().get(), 0);
  assert.equal(db.prepare('SELECT count(*) FROM service_credentials').pluck().get(), 0);
} finally { await app.close(); }
