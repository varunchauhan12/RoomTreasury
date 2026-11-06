import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { testDatabase } from './helpers.js';
import { provisionOwner, loginOwner } from '../src/security/owner-auth.js';
import { onboardProject } from '../src/jobs/bindings.js';
import { ProcessingJobs } from '../src/jobs/service.js';
import {
  hasDiscordConfig,
  readDiscordConfig,
  DiscordConfigurationError,
} from '../src/discord/config.js';
import {
  DiscordRestClient,
  DiscordApiError,
  type DiscordMessage,
} from '../src/discord/client.js';
import { DiscordGateway } from '../src/discord/gateway.js';
import {
  DiscordMessageCollector,
  classifySender,
} from '../src/discord/collector.js';

test('Discord configuration validates token, snowflakes and provides safe defaults', () => {
  assert.equal(hasDiscordConfig({}), false);
  assert.equal(hasDiscordConfig({ DISCORD_BOT_TOKEN: '   ' }), false);
  assert.equal(hasDiscordConfig({ DISCORD_BOT_TOKEN: 'valid-test-bot-token-with-length' }), true);

  assert.throws(() => readDiscordConfig({}), DiscordConfigurationError);
  assert.throws(() => readDiscordConfig({ DISCORD_BOT_TOKEN: 'short' }), DiscordConfigurationError);
  assert.throws(() => readDiscordConfig({ DISCORD_BOT_TOKEN: 'token with spaces in between' }), DiscordConfigurationError);
  assert.throws(() => readDiscordConfig({ DISCORD_BOT_TOKEN: 'valid-bot-token-length-ok', DISCORD_GUILD_ID: 'invalid' }), DiscordConfigurationError);
  assert.throws(() => readDiscordConfig({ DISCORD_BOT_TOKEN: 'valid-bot-token-length-ok', DISCORD_CHANNEL_ID: 'abc' }), DiscordConfigurationError);

  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'sample-valid-bot-token-1234567890',
  });
  assert.equal(config.botToken, 'sample-valid-bot-token-1234567890');
  assert.equal(config.guildId, '1567957507656384543');
  assert.equal(config.channelId, '1567957508985847880');
  assert.equal(config.coordinatorMention, '@make-proposal-agent');
  assert.equal(config.apiBaseUrl, 'https://discord.com/api/v10');
});

test('Discord REST client sends messages and headers without exposing tokens', async () => {
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
    DISCORD_CHANNEL_ID: '1567957508985847880',
  });

  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  let capturedBody = '';

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedBody = String(init?.body || '');
    return new Response(JSON.stringify({
      id: 'msg-1001',
      channel_id: '1567957508985847880',
      author: { id: 'bot-1', username: 'RoomTreasuryBot', bot: true },
      content: 'hello',
      timestamp: new Date().toISOString(),
      attachments: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const client = new DiscordRestClient({ config, fetchFn: mockFetch });
  const result = await client.sendMessage('1567957508985847880', 'hello from test');

  assert.equal(result.id, 'msg-1001');
  assert.equal(capturedUrl, 'https://discord.com/api/v10/channels/1567957508985847880/messages');
  assert.equal(capturedHeaders['Authorization'], 'Bot secret-test-bot-token-123456789');
  assert.match(capturedBody, /hello from test/);
});

test('Discord REST client handles rate limits and retries gracefully', async () => {
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
  });

  let calls = 0;
  const mockFetch: typeof fetch = async () => {
    calls++;
    if (calls === 1) {
      return new Response(JSON.stringify({ retry_after: 0.05 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ id: 'msg-rate-limited-ok', channel_id: '1', author: { id: '1', username: 'bot' }, content: 'ok', timestamp: new Date().toISOString(), attachments: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new DiscordRestClient({ config, fetchFn: mockFetch });
  const result = await client.sendMessage('1567957508985847880', 'test rate limit');
  assert.equal(result.id, 'msg-rate-limited-ok');
  assert.equal(calls, 2);
});

test('Discord REST client attachment download enforces domain, size limit and SHA-256', async () => {
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
  });

  const payload = '{"test": "proposal json content"}';
  const expectedHash = createHash('sha256').update(payload).digest('hex');

  const mockFetch: typeof fetch = async (url) => {
    if (String(url).includes('cdn.discordapp.com')) {
      return new Response(payload, { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  };

  const client = new DiscordRestClient({ config, fetchFn: mockFetch });

  // Untrusted domain rejected
  await assert.rejects(
    () => client.fetchAttachment({ id: 'att-1', filename: 'proposal.json', size: 100, url: 'https://malicious-site.com/proposal.json' }, 1024),
    (err: any) => err.code === 'UNTRUSTED_ATTACHMENT_URL'
  );

  // File exceeding size limit rejected
  await assert.rejects(
    () => client.fetchAttachment({ id: 'att-1', filename: 'proposal.json', size: 2000, url: 'https://cdn.discordapp.com/attachments/1/2/proposal.json' }, 1024),
    (err: any) => err.code === 'ATTACHMENT_TOO_LARGE'
  );

  // Valid download
  const downloaded = await client.fetchAttachment({
    id: 'att-1',
    filename: 'proposal.json',
    size: Buffer.byteLength(payload),
    url: 'https://cdn.discordapp.com/attachments/1/2/proposal.json',
  }, 1024);

  assert.equal(downloaded.id, 'att-1');
  assert.equal(downloaded.contentText, payload);
  assert.equal(downloaded.sha256, expectedHash);
});

test('Sender classification accurately identifies coordinator, specialists and other participants', () => {
  assert.deepEqual(classifySender('make-proposal-agent', true), { role: 'coordinator', agentName: 'make-proposal-agent' });
  assert.deepEqual(classifySender('Coordinator', false), { role: 'coordinator', agentName: 'make-proposal-agent' });
  assert.deepEqual(classifySender('req-agent', true), { role: 'specialist', agentName: 'req-agent' });
  assert.deepEqual(classifySender('Request Agent', true), { role: 'specialist', agentName: 'req-agent' });
  assert.deepEqual(classifySender('challenge-agent', true), { role: 'specialist', agentName: 'challenge-agent' });
  assert.deepEqual(classifySender('commitment-intelligence-agent', true), { role: 'specialist', agentName: 'commitment-intelligence-agent' });
  assert.deepEqual(classifySender('treasury-ops-agent', true), { role: 'specialist', agentName: 'treasury-ops-agent' });
  assert.deepEqual(classifySender('RandomUser', false), { role: 'other', agentName: null });
  assert.deepEqual(classifySender('SomeOtherBot', true), { role: 'bot', agentName: null });
});

test('Message collector filters channels, correlates jobs, tracks specialists and retrieves attachments', async (t) => {
  const { db } = testDatabase(t);
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
    DISCORD_GUILD_ID: '1567957507656384543',
    DISCORD_CHANNEL_ID: '1567957508985847880',
  });

  const attachmentsMap: Record<string, string> = {
    'proposal.json': '{"taskId":"rt-task-1","status":"READY_FOR_OWNER_REVIEW"}',
    'evidence.json': '{"threads":[]}',
    'summary.md': '# Summary markdown',
  };

  const mockFetch: typeof fetch = async (url) => {
    const filename = String(url).split('/').pop()!;
    if (attachmentsMap[filename]) {
      return new Response(attachmentsMap[filename], { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  };

  const client = new DiscordRestClient({ config, fetchFn: mockFetch });
  const collector = new DiscordMessageCollector(db, config, client);

  // Setup binding & job via authoritative onboardProject helper
  await provisionOwner(db, 'test-owner', 'Synthetic test password', 'PREEXISTING');
  const login = await loginOwner(db, 'test-owner', 'Synthetic test password', 'fixture');
  const binding = onboardProject(db, login.session, { clientName: 'Collector Client', brief: 'Brief', revenueCents: 100000 }, 'bind-collector');
  const jobs = new ProcessingJobs(db);
  const job = jobs.create(login.session, binding.id, 'job-collector-key', 'discord');

  // 1. Wrong channel is filtered out
  const wrongChannelMsg: DiscordMessage = {
    id: 'msg-wrong',
    channel_id: '9999999999999999999',
    author: { id: 'u1', username: 'make-proposal-agent', bot: true },
    content: job.id,
    timestamp: new Date().toISOString(),
    attachments: [],
  };
  assert.equal(collector.recordMessage(wrongChannelMsg, job.id), null);

  // 2. Correlated coordinator message is recorded
  const coordMsg: DiscordMessage = {
    id: 'msg-coord-1',
    channel_id: '1567957508985847880',
    guild_id: '1567957507656384543',
    author: { id: 'coord-1', username: 'make-proposal-agent', bot: true },
    content: `Acknowledged ${job.id}. Starting delegation.`,
    timestamp: new Date().toISOString(),
    attachments: [],
  };
  const recordedCoord = collector.recordMessage(coordMsg, job.id);
  assert.ok(recordedCoord);
  assert.equal(recordedCoord.role, 'coordinator');
  assert.equal(recordedCoord.isCoordinatorAck, true);

  // 3. Specialist progress is recorded
  for (const name of ['req-agent', 'challenge-agent', 'commitment-intelligence-agent', 'treasury-ops-agent']) {
    const specMsg: DiscordMessage = {
      id: `msg-${name}`,
      channel_id: '1567957508985847880',
      guild_id: '1567957507656384543',
      author: { id: `id-${name}`, username: name, bot: true },
      content: `Report from ${name} for ${job.id}`,
      timestamp: new Date().toISOString(),
      attachments: [],
    };
    collector.recordMessage(specMsg, job.id);
  }

  const specialists = collector.getObservedSpecialists(job.id);
  assert.equal(specialists.size, 4);
  assert.ok(specialists.has('req-agent'));
  assert.ok(specialists.has('treasury-ops-agent'));

  // 4. Completion marker with attachments
  const completionMsg: DiscordMessage = {
    id: 'msg-complete',
    channel_id: '1567957508985847880',
    guild_id: '1567957507656384543',
    author: { id: 'coord-1', username: 'make-proposal-agent', bot: true },
    content: `ROOMTREASURY_RESULT_READY job=${job.id} correlation=${job.correlation_id}`,
    timestamp: new Date().toISOString(),
    attachments: [
      { id: 'att-1', filename: 'proposal.json', size: 100, url: 'https://cdn.discordapp.com/attachments/1/2/proposal.json' },
      { id: 'att-2', filename: 'evidence.json', size: 50, url: 'https://cdn.discordapp.com/attachments/1/2/evidence.json' },
      { id: 'att-3', filename: 'summary.md', size: 30, url: 'https://cdn.discordapp.com/attachments/1/2/summary.md' },
    ],
  };

  const recordedComplete = collector.recordMessage(completionMsg, job.id);
  assert.ok(recordedComplete);
  assert.equal(recordedComplete.isCompletionMarker, true);

  // Retrieve attachments
  const artifacts = await collector.retrieveAttachmentsForJob(job.id, [completionMsg]);
  assert.equal(artifacts.proposal.filename, 'proposal.json');
  assert.equal(artifacts.evidence.filename, 'evidence.json');
  assert.equal(artifacts.summary.filename, 'summary.md');

  // Verify attachments are persisted in discord_attachments
  const rows = db.prepare('SELECT filename, byte_size FROM discord_attachments WHERE job_id=?').all(job.id) as { filename: string; byte_size: number }[];
  assert.equal(rows.length, 3);
});
