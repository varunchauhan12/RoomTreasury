import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { EventEmitter } from 'node:events';
import { testDatabase } from './helpers.js';
import { provisionOwner, loginOwner } from '../src/security/owner-auth.js';
import {onboardAuthorizedProject as onboardProject} from './helpers.js';
import { ProcessingJobs } from '../src/jobs/service.js';
import { readDiscordConfig } from '../src/discord/config.js';
import { DiscordRestClient, type DiscordMessage } from '../src/discord/client.js';
import { DiscordTransport } from '../src/discord/transport.js';
import { DiscordGateway } from '../src/discord/gateway.js';

const intake = {
  clientName: 'Long running test client',
  brief: 'Build a long-running Discord integration with live coordinator delegation.',
  revenueCents: 150000,
};

async function fixture(t: TestContext) {
  const data = testDatabase(t);
  const ownerId = await provisionOwner(data.db, 'longrun-owner', 'Synthetic longrun owner password', 'PREEXISTING');
  const login = await loginOwner(data.db, 'longrun-owner', 'Synthetic longrun owner password', 'fixture');
  const binding = onboardProject(data.db, login.session, intake, 'longrun-onboarding');
  const jobs = new ProcessingJobs(data.db);
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
    DISCORD_GUILD_ID: '1567957507656384543',
    DISCORD_CHANNEL_ID: '1567957508985847880',
    DISCORD_COORDINATOR_MENTION: '<@&1568667302910501097>',
  });
  return { ...data, ...login, ownerId, binding, jobs, config };
}

test('Dispatch message uses verified coordinator role mention and proposed revenue estimate disclaimer', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'dispatch-mention-test', 'discord');

  let dispatchedContent = '';
  const mockFetch: typeof fetch = async (input, init) => {
    const payload = init?.body instanceof FormData ? init.body.get('payload_json') : init?.body;
    const body = JSON.parse(String(payload ?? '{}'));
    dispatchedContent = body.content || '';
    return new Response(JSON.stringify({
      id: 'msg-dispatch-1',
      channel_id: data.config.channelId,
      author: { id: 'bot-1', username: 'RoomTreasury', bot: true },
      content: dispatchedContent,
      timestamp: new Date().toISOString(),
      attachments: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 50,
    timeoutMs: 100,
  });

  const ack = await transport.dispatch({
    jobId: job.id,
    correlationId: job.correlation_id,
    intakeHash: job.intake_hash,
    projectId: data.binding.client_project_id,
    taskId: data.binding.task_id,
    clientName: intake.clientName,
    brief: intake.brief,
    revenueCents: intake.revenueCents,
    currency: 'USD',
  });

  assert.equal(ack.correlationId, job.correlation_id);
  // Priority 2: Genuine mention of make-proposal-agent role
  assert.match(dispatchedContent, /<@&1568667302910501097>/);
  // Revenue labeled as proposed estimate, distinct from agreed/received cash
  assert.match(dispatchedContent, /PROPOSED ESTIMATE — NOT AGREED OR RECEIVED REVENUE/);
  assert.match(dispatchedContent, /All spending is simulated and requires explicit human owner review in RoomTreasury/);
});

test('Lease renewal extends worker lease and prevents premature lease expiration', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'lease-renew-test', 'discord');

  // Claim the job
  const claimed = data.jobs.claim('discord');
  assert.ok(claimed);
  const originalLeaseUntil = claimed.lease_until!;
  const leaseOwner = claimed.lease_owner!;

  // Renew the lease by 60 seconds
  data.jobs.renewLease(claimed.id, leaseOwner, 60000);

  const row = data.db.prepare('SELECT lease_until FROM processing_jobs WHERE id=?').get(claimed.id) as { lease_until: number };
  assert.ok(row.lease_until > originalLeaseUntil);
});

test('Interrupted worker recovers to needs_attention without duplicate dispatch', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'interrupted-worker-test', 'discord');

  const claimed = data.jobs.claim('discord');
  assert.ok(claimed);
  const lease = claimed.lease_owner!;

  // Worker acknowledges dispatch
  data.jobs.apply(claimed.id, lease, 'dispatch-ack', 'dispatched');

  // Simulate worker interruption/crash: expire the lease artificially
  data.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now() - 1000, claimed.id);

  // Recovery runs
  const recoveredCount = data.jobs.recover('discord');
  assert.equal(recoveredCount, 1);

  const recoveredJob = data.jobs.get(data.session, claimed.id);
  // Transitioned to needs_attention with worker_interrupted
  assert.equal(recoveredJob.state, 'needs_attention');
  assert.equal(recoveredJob.error_code, 'worker_interrupted');

  // Priority 1: Prevent duplicate dispatch when recovering an already-dispatched job
  const nextClaim = data.jobs.claim('discord');
  assert.equal(nextClaim, null, 'Recovered job must not be claimed or dispatched again');
});

test('Dispatch uncertainty is cleanly distinguished from worker interruption', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'dispatch-uncertain-test', 'discord');

  // Job is claimed and enters dispatching state
  const claimed = data.jobs.claim('discord');
  assert.ok(claimed);
  assert.equal(claimed.state, 'dispatching');

  // Simulate lease expiration while still in dispatching state (before ack)
  data.db.prepare('UPDATE processing_jobs SET lease_until=? WHERE id=?').run(Date.now() - 1000, claimed.id);

  // Recovery runs
  const recoveredCount = data.jobs.recover('discord');
  assert.equal(recoveredCount, 1);

  const recoveredJob = data.jobs.get(data.session, claimed.id);
  // Clear distinction: dispatching expiration -> dispatch_uncertain with dispatch_outcome_unknown
  assert.equal(recoveredJob.state, 'dispatch_uncertain');
  assert.equal(recoveredJob.error_code, 'dispatch_outcome_unknown');
});

test('Discord execution timeout cleanly marks job needs_attention with discord_timeout', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'timeout-test', 'discord');

  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/messages') && init?.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'msg-start',
        channel_id: data.config.channelId,
        author: { id: 'bot-1', username: 'RoomTreasury', bot: true },
        content: 'dispatch',
        timestamp: new Date().toISOString(),
        attachments: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // No messages returned from history
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  // Fast timeout for deterministic test
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 20,
    timeoutMs: 80,
  });

  const executed = await data.jobs.runNext(transport);
  assert.equal(executed, true);

  const finishedJob = data.jobs.get(data.session, job.id);
  assert.equal(finishedJob.state, 'needs_attention');
  assert.equal(finishedJob.error_code, 'discord_timeout');
});

test('Gateway message delivery and REST backfill are deduplicated and correlated', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'gateway-backfill-test', 'discord');

  // Create a mock Gateway that is an EventEmitter
  class MockGateway extends EventEmitter {
    connect() {}
    close() {}
  }
  const mockGateway = new MockGateway() as any;

  const mockMessages: DiscordMessage[] = [
    {
      id: 'gw-msg-1',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'spec-1', username: 'req-agent', bot: true },
      content: `@make-proposal-agent Task ${data.binding.task_id} job=${job.id} Requirements report ready.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
  ];

  let restHistoryCalls = 0;
  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/messages') && init?.method === 'POST') {
      return new Response(JSON.stringify({
        id: 'msg-dispatch-1',
        channel_id: data.config.channelId,
        author: { id: 'bot-1', username: 'RoomTreasury', bot: true },
        content: 'dispatch',
        timestamp: new Date().toISOString(),
        attachments: [],
      }), { status: 200 });
    }
    if (url.includes('/messages')) {
      restHistoryCalls++;
      // Return the same message that gateway also emits to test deduplication
      return new Response(JSON.stringify(mockMessages), { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    gateway: mockGateway,
    pollIntervalMs: 50,
    timeoutMs: 150,
  });

  // Start events iterator in background
  const eventsPromise = (async () => {
    const events = [];
    for await (const event of transport.events({
      jobId: job.id,
      correlationId: job.correlation_id,
      taskId: data.binding.task_id,
      intakeHash: job.intake_hash,
    })) {
      events.push(event);
      if (events.length >= 2) break;
    }
    return events;
  })();

  // Emit Gateway message concurrently
  mockGateway.emit('message_create', mockMessages[0]);

  const receivedEvents = await eventsPromise;
  assert.ok(receivedEvents.length >= 1);
  assert.equal(receivedEvents[0]!.state, 'running');

  // Verify database record has exactly one row despite both Gateway and REST seeing gw-msg-1
  const rows = data.db.prepare('SELECT count(*) as count FROM discord_messages WHERE id=?').get('gw-msg-1') as { count: number };
  assert.equal(rows.count, 1, 'Message must be deduplicated in discord_messages table');
});
