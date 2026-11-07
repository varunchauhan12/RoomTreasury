import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { DiscordRestClient, DiscordApiError, dispatchDiagnostic, safeDispatchDiagnostic } from '../src/discord/client.js';
import { readDiscordConfig } from '../src/discord/config.js';
import { DiscordTransport } from '../src/discord/transport.js';
import type { DiscordGateway } from '../src/discord/gateway.js';
import { DispatchFailure } from '../src/jobs/transport.js';
import { ProcessingJobs, jobView } from '../src/jobs/service.js';
import { testDatabase } from './helpers.js';
import { provisionOwner, loginOwner } from '../src/security/owner-auth.js';
import { onboardProject } from '../src/jobs/bindings.js';

const config = readDiscordConfig({ DISCORD_BOT_TOKEN: 'disposable-audit-fixture-not-a-real-token' });
const acknowledgement = { id: '123456789012345678', channel_id: config.channelId, attachments: [] };
const request = {
  jobId: 'cd699e14-ba2d-45b2-a622-2fb8ef3ae2ca',
  correlationId: 'discord-cd699e14-ba2d-45b2-a622-2fb8ef3ae2ca',
  projectId: 'ad460c42-6d0c-408f-ab1e-c1922632c46e',
  taskId: 'rt-task-9f1d6348-a1aa-4e6a-baa6-b901a6ffcbfe',
  intakeHash: 'a'.repeat(64), clientName: 'Synthetic audit client', revenueCents: 150000,
  brief: 'Synthetic long brief. '.repeat(190) + '🧭 <@&999999999999999999> @everyone',
};

test('oversize intake is one bounded Discord message with a complete attachment, never split or truncated', async t => {
  const { db } = testDatabase(t);
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async (_url, init) => {
    calls++;
    assert.equal(init?.method, 'POST');
    assert.ok(init.body instanceof FormData);
    assert.equal((init.headers as Record<string,string>)['Content-Type'], undefined);
    const payload = JSON.parse(String(init.body.get('payload_json')));
    assert.ok(payload.content.length <= 2000);
    assert.match(payload.content, /Read the complete original brief in the attached/);
    for (const value of [request.projectId, request.taskId, request.jobId, request.correlationId, request.intakeHash]) assert.ok(payload.content.includes(value));
    assert.deepEqual(payload.allowed_mentions, { parse: [], roles: ['1568256403179569252'], users: [] });
    const file = init.body.get('files[0]') as File;
    assert.equal(file.name, 'roomtreasury-intake.txt');
    const text = await file.text();
    assert.ok(text.includes(request.brief));
    assert.match(text, /PROPOSED ESTIMATE — NOT AGREED OR RECEIVED REVENUE/);
    assert.match(text, /Do NOT approve, spend, reserve, settle or deploy/);
    assert.match(text, /ROOMTREASURY_RESULT_READY/);
    return Response.json(acknowledgement);
  }});
  const transport = new DiscordTransport({ db, config, client });
  assert.equal((await transport.dispatch(request)).messageId, acknowledgement.id);
  assert.equal(calls, 1);
});

test('REST preflight rejects content above 2000 characters before any HTTP request', async () => {
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async () => { calls++; throw Error('must not fetch'); } });
  await assert.rejects(client.sendMessage(config.channelId, 'x'.repeat(2001)), error => error instanceof DiscordApiError && error.code === 'MESSAGE_TOO_LONG');
  assert.equal(calls, 0);
});

for (const [status, code, category] of [
  [401, 0, 'authentication_failure'], [403, 50001, 'missing_access'],
  [403, 50013, 'missing_permissions'], [404, 10003, 'guild_channel_not_found'],
  [400, 50035, 'invalid_message_payload'], [429, 0, 'rate_limited'],
  [502, 0, 'unknown_dispatch_outcome'],
] as const) test(`Discord HTTP ${status}/${code} has safe ${category} diagnostics`, async () => {
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async () => {
    calls++;
    return Response.json({ code, message: config.botToken, retry_after: 10, errors: { content: config.botToken } }, { status });
  }});
  await assert.rejects(client.sendMessage(config.channelId, 'synthetic'), error => {
    assert.ok(error instanceof DiscordApiError);
    assert.equal(error.statusCode, status);
    const diagnostic = dispatchDiagnostic(error);
    assert.match(diagnostic, new RegExp('^' + category + '; http=' + status));
    assert.equal(safeDispatchDiagnostic(diagnostic), diagnostic);
    assert.ok(!String(error).includes(config.botToken));
    assert.ok(!JSON.stringify(error).includes(config.botToken));
    return true;
  });
  assert.equal(calls, 1);
});

test('ambiguous POST network failures are not retried and never echo the underlying error', async () => {
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async () => { calls++; throw Error(config.botToken); } });
  await assert.rejects(client.sendMessage(config.channelId, 'synthetic'), error => {
    assert.ok(error instanceof DiscordApiError);
    assert.match(dispatchDiagnostic(error), /^network_failure; http=0/);
    assert.ok(!String(error).includes(config.botToken));
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(safeDispatchDiagnostic(config.botToken), null);
  assert.equal(safeDispatchDiagnostic('invalid_message_payload; http=400; discord=' + config.botToken), null);
});

test('safe dispatch category persists and is exposed without raw errors or lease credentials', async t => {
  const { db } = testDatabase(t);
  await provisionOwner(db, 'audit-owner', 'Synthetic audit owner password', 'PREEXISTING');
  const { session } = await loginOwner(db, 'audit-owner', 'Synthetic audit owner password', 'fixture');
  const binding = onboardProject(db, session, { clientName: 'Synthetic audit', brief: 'Synthetic brief', revenueCents: 100000 }, 'audit-onboard');
  const jobs = new ProcessingJobs(db);
  const job = jobs.create(session, binding.id, 'audit-failed', 'discord');
  const client = new DiscordRestClient({ config, fetchFn: async () => Response.json({ code: 50035, message: config.botToken }, { status: 400 }) });
  await jobs.runNext(new DiscordTransport({ db, config, client }));
  const result = jobs.get(session, job.id);
  assert.equal(result.state, 'failed');
  assert.equal(result.diagnostic, 'invalid_message_payload; http=400; discord=50035');
  const view = jobView(result);
  assert.equal('dispatch_diagnostic' in view && view.dispatch_diagnostic, result.diagnostic);
  assert.ok(!('diagnostic' in view));
  assert.ok(!('lease_owner' in view));
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM processing_jobs').all()).includes(config.botToken));
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM processing_job_events').all()).includes(config.botToken));
});

test('accepted message followed by checkpoint failure becomes uncertain and cannot be redispatched', async t => {
  const { db } = testDatabase(t);
  await provisionOwner(db, 'audit-owner', 'Synthetic audit owner password', 'PREEXISTING');
  const { session } = await loginOwner(db, 'audit-owner', 'Synthetic audit owner password', 'fixture');
  const binding = onboardProject(db, session, { clientName: 'Synthetic audit', brief: 'Synthetic brief', revenueCents: 100000 }, 'audit-onboard');
  const jobs = new ProcessingJobs(db);
  const job = jobs.create(session, binding.id, 'audit-uncertain', 'discord');
  db.exec("CREATE TRIGGER fail_checkpoint BEFORE INSERT ON discord_checkpoints BEGIN SELECT RAISE(ABORT,'fixture checkpoint failure'); END");
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async () => { calls++; return Response.json(acknowledgement); } });
  const transport = new DiscordTransport({ db, config, client });
  await jobs.runNext(transport);
  const result = jobs.get(session, job.id);
  assert.equal(result.state, 'dispatch_uncertain');
  assert.equal(result.error_code, 'dispatch_outcome_unknown');
  assert.equal(result.diagnostic, 'unknown_dispatch_outcome');
  assert.equal(await jobs.runNext(transport), false);
  assert.throws(() => jobs.create(session, binding.id, 'unsafe-retry', 'discord'));
  assert.equal(calls, 1);
});

test('Gateway errors do not crash collection; REST fallback and timeout remain available', async t => {
  const { db } = testDatabase(t);
  const gateway = new EventEmitter() as DiscordGateway;
  const client = new DiscordRestClient({ config, fetchFn: async () => {
    gateway.emit('error', Error('synthetic gateway failure'));
    return Response.json([]);
  }});
  const transport = new DiscordTransport({ db, config, client, gateway, timeoutMs: 5, pollIntervalMs: 1 });
  const events = [];
  for await (const event of transport.events(request)) events.push(event);
  assert.equal(events.at(-1)?.code, 'discord_timeout');
  assert.equal(gateway.listenerCount('error'), 0);
});

test('unrecognised dispatch failures remain uncertain and discard arbitrary messages', async t => {
  const { db } = testDatabase(t);
  const client = new DiscordRestClient({ config, fetchFn: async () => Response.json(acknowledgement) });
  client.sendMessage = async () => { throw Error(config.botToken); };
  await assert.rejects(new DiscordTransport({ db, config, client }).dispatch(request), error => {
    assert.ok(error instanceof DispatchFailure);
    assert.equal(error.certain, false);
    assert.equal(error.diagnostic, 'unknown_dispatch_outcome');
    assert.ok(!String(error).includes(config.botToken));
    return true;
  });
});

test('unreadable successful acknowledgements remain uncertain without echoing response content or resending', async t => {
  const { db } = testDatabase(t);
  let calls = 0;
  const client = new DiscordRestClient({ config, fetchFn: async () => {
    calls++;
    return new Response('not JSON ' + config.botToken, { status: 200 });
  }});
  await assert.rejects(new DiscordTransport({ db, config, client }).dispatch(request), error => {
    assert.ok(error instanceof DispatchFailure);
    assert.equal(error.certain, false);
    assert.equal(error.diagnostic, 'unknown_dispatch_outcome; http=200; discord=none');
    assert.ok(!String(error).includes(config.botToken));
    return true;
  });
  assert.equal(calls, 1);
});
