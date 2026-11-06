import assert from 'node:assert/strict';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
const db = openDatabase(readConfig());
const app = await buildApp(db);
try {
  await app.ready();
  const spec = app.swagger();
  assert.deepEqual(Object.keys(spec.paths ?? {}).sort(), ['/health', '/v1/projects/{projectId}/service-identity']);
  await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
  assert.equal((await app.inject({ method: 'POST', url: '/v1/projects/a/service-auth-probes/x/result' })).statusCode, 404);
  assert.equal((await app.inject('/v1/projects/a/service-identity')).statusCode, 401);
  assert.equal(db.prepare('SELECT count(*) FROM service_principals').pluck().get(), 0);
  assert.equal(db.prepare('SELECT count(*) FROM service_credentials').pluck().get(), 0);
} finally { await app.close(); }
