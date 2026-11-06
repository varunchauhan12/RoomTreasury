// Child-process capture avoids intercepting the test runner's own reporting channel.
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { assertFixtureStorageHasNoSecrets, createFixturePrincipal, issueFixtureCredential, revokeFixtureCredential } from '../src/security/test-fixtures.js';
const db = openDatabase(readConfig());
const principal = createFixturePrincipal(db, 'log-project', 'request');
const token = issueFixtureCredential(db, principal);
const app = await buildApp(db);
try {
  for (const project of ['log-project', 'wrong-project']) {
    const response = await app.inject({ url: `/v1/projects/${project}/service-identity`, headers: { authorization: `Bearer ${token}` } });
    if (response.body.includes(token) || response.body.includes(token.split('.')[2]!)) throw new Error('Leak scan failed.');
  }
  revokeFixtureCredential(db, principal);
  const response = await app.inject({ url: '/v1/projects/log-project/service-identity', headers: { authorization: `Bearer ${token}` } });
  if (response.statusCode !== 401 || response.body.includes(token)) throw new Error('Leak scan failed.');
} finally { assertFixtureStorageHasNoSecrets(db); await app.close(); assertFixtureStorageHasNoSecrets(db); }
