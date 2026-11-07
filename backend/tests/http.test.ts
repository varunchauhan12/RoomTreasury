import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import SwaggerParser from '@apidevtools/swagger-parser';
import { buildApp } from '../src/app.js';
import { testDatabase } from './helpers.js';

test('GET /health works over a real loopback HTTP socket', async (t) => {
  const { db } = testDatabase(t);
  const app = await buildApp(db);
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${address}/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally { await app.close(); }
  assert.equal(db.open, false);
});

test('strict health query validation rejects unexpected inputs rather than stripping them', async (t) => {
  const app = await buildApp(testDatabase(t).db);
  try {
    const response = await app.inject('/health?unexpected=private-input');
    assert.equal(response.statusCode, 400);
    const error = response.json().error;
    assert.equal(error.code, 'INVALID_REQUEST');
    assert.deepEqual(error.details, {});
    assert.match(error.correlationId, /^[0-9a-f-]{36}$/);
    assert.ok(!response.body.includes('private-input'));
  } finally { await app.close(); }
});

test('404 and unexpected errors use the same safe envelope', async (t) => {
  const app = await buildApp(testDatabase(t).db);
  // Test-only failure injection; this route is never shipped or included in the spec.
  app.get('/failure-injection', () => { throw new Error('private-database-path-and-token'); });
  try {
    for (const [url, status, code] of [['/missing', 404, 'NOT_FOUND'], ['/failure-injection', 500, 'INTERNAL_ERROR']] as const) {
      const response = await app.inject({ url, headers: { authorization: 'Bearer test-only-sentinel', 'x-request-id': 'untrusted-id' } });
      assert.equal(response.statusCode, status);
      assert.equal(response.json().error.code, code);
      assert.deepEqual(response.json().error.details, {});
      assert.match(response.json().error.correlationId, /^[0-9a-f-]{36}$/);
      assert.ok(!response.body.includes('private-database-path-and-token'));
      assert.ok(!response.body.includes('test-only-sentinel'));
    }
  } finally { await app.close(); }
});

test('health returns a safe 503 when SQLite is unavailable', async (t) => {
  const { db } = testDatabase(t);
  const app = await buildApp(db);
  db.close();
  try {
    const response = await app.inject('/health');
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'DATABASE_UNAVAILABLE');
    assert.ok(!response.body.includes('SQLite'));
  } finally { await app.close(); }
});

test('generated OpenAPI validates, matches committed artifact, and documents only implemented routes', async (t) => {
  const app = await buildApp(testDatabase(t).db);
  try {
    await app.ready();
    const spec = app.swagger();
    assert.deepEqual(Object.keys(spec.paths ?? {}).sort(), ['/health', '/v1/projects/{projectId}/service-identity', '/v1/client-projects/', '/v1/client-projects/{projectId}', '/v1/client-projects/{projectId}/commercial', '/v1/commercial', '/v1/client-projects/{projectId}/approval-workflow', '/v1/client-projects/{projectId}/approval-workflow/decisions', '/v1/client-projects/{projectId}/approval-workflow/reports', '/v1/client-projects/{projectId}/approval-workflow/reanalyze',  '/v1/client-projects/estimate', '/v1/proposal-imports/preview', '/v1/proposal-imports/confirm', '/v1/proposal-imports/', '/v1/proposal-imports/{id}', '/v1/owner-auth/login', '/v1/owner-auth/session', '/v1/owner-auth/logout', '/v1/proposal-imports/{id}/review', '/v1/proposal-imports/{id}/review/notes', '/v1/proposal-imports/{id}/review/verify', '/v1/proposal-imports/{id}/review/revisions', '/v1/proposal-imports/{id}/review/approve', '/v1/proposal-imports/{id}/review/decision', '/v1/client-projects/onboard', '/v1/client-projects/{projectId}/processing-jobs', '/v1/processing-jobs/{id}', '/v1/processing-jobs/{id}/events', '/v1/processing-jobs/{id}/cancel', '/v1/processing-jobs/{id}/discord-messages', '/v1/processing-jobs/{id}/discord-attachments/{attachmentId}', '/v1/client-projects/{projectId}/proposal-imports/preview', '/v1/client-projects/{projectId}/proposal-imports/confirm', '/v1/client-projects/{projectId}/proposal-imports/retrieve-discord'].sort());
    assert.deepEqual(Object.keys(spec.paths?.['/health'] ?? {}), ['get']);
    assert.deepEqual(Object.keys(spec.paths?.['/health']?.get?.responses ?? {}).sort(), ['200', '400', '500', '503']);
    assert.deepEqual(spec, JSON.parse(readFileSync('backend/openapi.json', 'utf8')));
    await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
    // Verify the validator actually rejects a malformed specification.
    await assert.rejects(() => SwaggerParser.validate(JSON.parse('{"openapi":"3.0.3","info":{"title":"invalid"},"paths":{}}')));
  } finally { await app.close(); }
});
