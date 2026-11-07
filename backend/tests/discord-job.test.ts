import {onboardAuthorizedProject as onboardProject} from './helpers.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { testDatabase } from './helpers.js';
import { provisionOwner, loginOwner } from '../src/security/owner-auth.js';

import { ProcessingJobs } from '../src/jobs/service.js';
import { readDiscordConfig } from '../src/discord/config.js';
import { DiscordRestClient, type DiscordMessage } from '../src/discord/client.js';
import { DiscordTransport } from '../src/discord/transport.js';
import { buildApp } from '../src/app.js';
import type { ImportBundle } from '../src/imports/service.js';

const intake = {
  clientName: 'Discord test client',
  brief: 'Build a Discord transport project with live coordinator delegation.',
  revenueCents: 200000,
};

function validBundle(taskId: string): ImportBundle {
  const proposal = JSON.parse(readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-proposal.json', 'utf8').replaceAll('RT-APEX-001', taskId));
  proposal.client.name = intake.clientName;
  proposal.project.brief = intake.brief;
  proposal.project.agreedRevenueCents = intake.revenueCents;
  proposal.financialSummary.agreedRevenueCents = intake.revenueCents;
  proposal.financialSummary.projectedGrossMarginCents = intake.revenueCents - proposal.proposal.budgetCents;
  proposal.financialSummary.projectedGrossMarginPercent = 100 * proposal.financialSummary.projectedGrossMarginCents / intake.revenueCents;
  for (const s of proposal.financialSummary.scenarios) s.projectedGrossMarginCents = intake.revenueCents - s.totalCostCents;

  return {
    proposal: { name: 'proposal.json', content: JSON.stringify(proposal) },
    evidence: { name: 'evidence.json', content: readFileSync('docs/agent-import/RT-APEX-001/RT-APEX-001-specialist-evidence.json', 'utf8').replaceAll('RT-APEX-001', taskId) },
    summary: { name: 'summary.md', content: '# Discord Transport Summary\nLive coordinator delegation test.' },
  };
}

function boundBundle(job: ReturnType<ProcessingJobs['create']>): ImportBundle {
  const path='backend/tests/fixtures/nova-recovery/';
  const proposal=JSON.parse(readFileSync(path+'proposal.json','utf8'));
  const snapshot=JSON.parse(job.intake_snapshot);
  const replacements: Record<string,string> = {
    [proposal.projectId]:snapshot.projectId, [proposal.taskId]:snapshot.taskId,
    [proposal.processingJobId]:job.id, [proposal.intakeSha256]:job.intake_hash,
    [proposal.client.name]:snapshot.clientName, [proposal.project.brief]:snapshot.brief,
  };
  const rebind=(text:string)=>Object.entries(replacements).reduce((result,[from,to])=>result.replaceAll(from,to),text);
  const p=JSON.parse(rebind(JSON.stringify(proposal)));
  p.project.brief=snapshot.brief;
  const e=JSON.parse(rebind(readFileSync(path+'evidence.json','utf8')));
  e.originalBrief=snapshot.brief;
  return {proposal:{name:'proposal.json',content:JSON.stringify(p)},evidence:{name:'evidence.json',content:JSON.stringify(e)},
    summary:{name:'summary.md',content:rebind(readFileSync(path+'summary.md','utf8'))}};
}

async function fixture(t: TestContext, revenueCents=intake.revenueCents) {
  const data = testDatabase(t);
  const ownerId = await provisionOwner(data.db, 'discord-owner', 'Synthetic discord owner password', 'PREEXISTING');
  const login = await loginOwner(data.db, 'discord-owner', 'Synthetic discord owner password', 'fixture');
  const binding = onboardProject(data.db, login.session, {...intake,revenueCents}, 'discord-onboarding');
  const jobs = new ProcessingJobs(data.db);
  const config = readDiscordConfig({
    DISCORD_BOT_TOKEN: 'secret-test-bot-token-123456789',
    DISCORD_GUILD_ID: '1567957507656384543',
    DISCORD_CHANNEL_ID: '1567957508985847880',
  });
  return { ...data, ...login, ownerId, binding, jobs, config };
}

test('invalid Discord configuration records a certain failure without waiting for lease recovery', async t => {
  const data=await fixture(t),job=data.jobs.create(data.session,data.binding.id,'invalid-config','discord');
  const previous=process.env.DISCORD_BOT_TOKEN;
  try{
    process.env.DISCORD_BOT_TOKEN='invalid';
    assert.equal(await data.jobs.runNext(),true);
  }finally{
    if(previous===undefined)delete process.env.DISCORD_BOT_TOKEN;else process.env.DISCORD_BOT_TOKEN=previous;
  }
  const failed=data.jobs.get(data.session,job.id);
  assert.equal(failed.state,'failed');
  assert.equal(failed.error_code,'discord_dispatch_failed');
  assert.equal(failed.diagnostic,'configuration_invalid');
  assert.equal(failed.lease_owner,null);
});

test('Discord transport end-to-end: dispatch, specialist progress, completion marker, attachment download and automatic import', async (t) => {
  const data = await fixture(t,180000);
  const job = data.jobs.create(data.session, data.binding.id, 'discord-run-1', 'discord');
  assert.equal(job.transport, 'discord');
  assert.equal(job.state, 'queued');

  const bundle = boundBundle(job);
  const sentMessages: { channelId: string; content: string }[] = [];

  const conversationHistory: DiscordMessage[] = [
    {
      id: 'msg-ack',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'coord', username: 'make-proposal-agent', bot: true },
      content: `Acknowledged job ${job.id} for task ${data.binding.task_id}. Beginning specialist delegation.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
    {
      id: 'msg-req',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'spec-req', username: 'req-agent', bot: true },
      content: `Requirements report for job ${job.id}.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
    {
      id: 'msg-challenge',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'spec-chal', username: 'challenge-agent', bot: true },
      content: `Challenge and risk register for job ${job.id}.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
    {
      id: 'msg-comm',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'spec-comm', username: 'commitment-intelligence-agent', bot: true },
      content: `Commitment intelligence report for job ${job.id}.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
    {
      id: 'msg-treas',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'spec-treas', username: 'treasury-ops-agent', bot: true },
      content: `Treasury operations budget model for job ${job.id}.`,
      timestamp: new Date().toISOString(),
      attachments: [],
    },
    {
      id: 'msg-finish',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'coord', username: 'make-proposal-agent', bot: true },
      content: `Consolidation complete.\nROOMTREASURY_RESULT_READY job=${job.id} correlation=${job.correlation_id}`,
      timestamp: new Date().toISOString(),
      attachments: [
        { id: 'att-p', filename: 'proposal.json', size: Buffer.byteLength(bundle.proposal.content), url: 'https://cdn.discordapp.com/attachments/1/2/proposal.json' },
        { id: 'att-e', filename: 'evidence.json', size: Buffer.byteLength(bundle.evidence!.content), url: 'https://cdn.discordapp.com/attachments/1/2/evidence.json' },
        { id: 'att-s', filename: 'summary.md', size: Buffer.byteLength(bundle.summary!.content), url: 'https://cdn.discordapp.com/attachments/1/2/summary.md' },
      ],
    },
  ];

  // Discord may deliver the marker before three file-only message events.
  const completion = conversationHistory.at(-1)!;
  const splitFiles: DiscordMessage[] = completion.attachments.map((attachment,index)=>({
    ...completion,id:'msg-package-'+index,content:'',attachments:[attachment]
  }));
  completion.attachments=[];
  let historyReads=0;
  const downloads=new Map<string,number>();

  const mockFetch: typeof fetch = async (input, init) => {
    const urlStr = String(input);
    if (init?.method === 'POST') {
      const parsedBody = JSON.parse(init.body instanceof FormData?String(init.body.get('payload_json')):String(init.body));
      sentMessages.push({ channelId: data.config.channelId, content: parsedBody.content });
      return new Response(JSON.stringify({
        id: 'msg-dispatch-bot',
        channel_id: data.config.channelId,
        author: { id: 'bot-rt', username: 'RoomTreasuryBot', bot: true },
        content: parsedBody.content,
        timestamp: new Date().toISOString(),
        attachments: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (urlStr.includes('/messages')) {
      historyReads++;
      return new Response(JSON.stringify([...conversationHistory,...splitFiles.slice(0,historyReads-1)]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    downloads.set(urlStr,(downloads.get(urlStr)??0)+1);
    if (urlStr.endsWith('proposal.json')) return new Response(bundle.proposal.content, { status: 200 });
    if (urlStr.endsWith('evidence.json')) return new Response(bundle.evidence!.content, { status: 200 });
    if (urlStr.endsWith('summary.md')) return new Response(bundle.summary!.content, { status: 200 });

    return new Response('Not found', { status: 404 });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 10,
    timeoutMs: 2000,
  });

  const executed = await data.jobs.runNext(transport);
  assert.equal(executed, true);

  // Verify dispatch message content
  assert.equal(sentMessages.length, 1);
  assert.equal(historyReads>=4,true);
  assert.deepEqual([...downloads.values()],[1,1,1]);
  const sent = sentMessages[0]!.content;
  assert.match(sent, /<@&1568667302910501097>|@make-proposal-agent/);
  assert.match(sent, new RegExp(`Project ID: \`${data.binding.client_project_id}\``));
  assert.match(sent, new RegExp(`Task ID: \`${data.binding.task_id}\``));
  assert.match(sent, new RegExp(`Processing Job ID: \`${job.id}\``));
  assert.match(sent, new RegExp(`Correlation ID: \`${job.correlation_id}\``));
  assert.match(sent, /Do NOT approve, spend, reserve, settle or deploy/);
  assert.match(sent, /ROOMTREASURY_RESULT_READY/);

  // Check persisted job state and links
  const completed = data.jobs.get(data.session, job.id);
  assert.equal(completed.state, 'imported');
  assert.ok(completed.result_import_id);
  assert.equal(completed.error_code, null);
  assert.ok(completed.completed_at);

  // Check project_import_links table
  const link = data.db.prepare('SELECT * FROM project_import_links WHERE job_id=?').get(job.id) as any;
  assert.ok(link);
  assert.equal(link.import_id, completed.result_import_id);
  assert.equal(link.source, 'discord_agent_delivery');
  assert.equal(link.owner_id, data.ownerId);

  // Check recorded events
  const events = data.jobs.events(data.session, job.id).events as any[];
  const states = events.map((e) => e.to_state);
  assert.ok(states.includes('queued'));
  assert.ok(states.includes('dispatching'));
  assert.ok(states.includes('dispatched'));
  assert.ok(states.includes('running'));
  assert.ok(states.includes('collecting'));
  assert.ok(states.includes('validating'));
  assert.ok(states.includes('imported'));

  // Proposal import is available for authenticated owner review
  const app = await buildApp(data.db);
  try {
    const res = await app.inject({
      url: `/v1/proposal-imports/${completed.result_import_id}`,
      headers: { cookie: 'rt_demo_owner=' + data.token },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.taskId, data.binding.task_id);
    assert.equal(body.proposal.status, 'READY_FOR_OWNER_REVIEW');
    assert.equal(body.proposal.project.agreedRevenueCents,null);
  } finally {
    await app.close();
  }
});

test('Discord dispatch failure marks job failed with code discord_dispatch_failed', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'discord-fail-1', 'discord');

  const mockFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ code: 50001, message: 'Missing Access' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 10,
    timeoutMs: 1000,
  });

  const executed = await data.jobs.runNext(transport);
  assert.equal(executed, true);

  const failed = data.jobs.get(data.session, job.id);
  assert.equal(failed.state, 'failed');
  assert.equal(failed.error_code, 'discord_dispatch_failed');
  assert.ok(failed.completed_at);
});

test('Discord missing attachments moves job to needs_attention with discord_missing_attachments', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'discord-missing-att', 'discord');

  const historyWithoutAttachments: DiscordMessage[] = [
    {
      id: 'msg-no-att',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'coord', username: 'make-proposal-agent', bot: true },
      content: `Done!\nROOMTREASURY_RESULT_READY job=${job.id} correlation=${job.correlation_id}`,
      timestamp: new Date().toISOString(),
      attachments: [], // missing files!
    },
  ];

  const mockFetch: typeof fetch = async (input, init) => {
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'msg-post', channel_id: data.config.channelId, author: { id: 'bot', username: 'rt' }, content: '', timestamp: new Date().toISOString(), attachments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(historyWithoutAttachments), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 10,
    timeoutMs: 1000,
  });

  const executed = await data.jobs.runNext(transport);
  assert.equal(executed, true);

  const attention = data.jobs.get(data.session, job.id);
  assert.equal(attention.state, 'needs_attention');
  assert.equal(attention.error_code, 'discord_missing_attachments');
  assert.match(attention.diagnostic || '', /Missing required coordinator attachments/);
});

test('Discord invalid proposal artifacts preserve attachments in DB and enter needs_attention without faking success', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'discord-invalid-proposal', 'discord');

  const bundle = validBundle(data.binding.task_id);
  // Modify proposal to have mismatched client name (like incompatible agent outputs)
  const proposalObj = JSON.parse(bundle.proposal.content);
  proposalObj.client.name = 'WRONG_CLIENT_NAME';
  const invalidProposalJson = JSON.stringify(proposalObj);

  const history: DiscordMessage[] = [
    {
      id: 'msg-invalid-pkg',
      channel_id: data.config.channelId,
      guild_id: data.config.guildId,
      author: { id: 'coord', username: 'make-proposal-agent', bot: true },
      content: `Package ready.\nROOMTREASURY_RESULT_READY job=${job.id} correlation=${job.correlation_id}`,
      timestamp: new Date().toISOString(),
      attachments: [
        { id: 'att-bad-p', filename: 'proposal.json', size: Buffer.byteLength(invalidProposalJson), url: 'https://cdn.discordapp.com/attachments/1/2/proposal.json' },
        { id: 'att-bad-e', filename: 'evidence.json', size: Buffer.byteLength(bundle.evidence!.content), url: 'https://cdn.discordapp.com/attachments/1/2/evidence.json' },
        { id: 'att-bad-s', filename: 'summary.md', size: Buffer.byteLength(bundle.summary!.content), url: 'https://cdn.discordapp.com/attachments/1/2/summary.md' },
      ],
    },
  ];

  const mockFetch: typeof fetch = async (input, init) => {
    const urlStr = String(input);
    if (init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'msg-post', channel_id: data.config.channelId, author: { id: 'bot', username: 'rt' }, content: '', timestamp: new Date().toISOString(), attachments: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.includes('/messages')) {
      return new Response(JSON.stringify(history), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (urlStr.endsWith('proposal.json')) return new Response(invalidProposalJson, { status: 200 });
    if (urlStr.endsWith('evidence.json')) return new Response(bundle.evidence!.content, { status: 200 });
    if (urlStr.endsWith('summary.md')) return new Response(bundle.summary!.content, { status: 200 });
    return new Response('Not found', { status: 404 });
  };

  const client = new DiscordRestClient({ config: data.config, fetchFn: mockFetch });
  const transport = new DiscordTransport({
    db: data.db,
    config: data.config,
    client,
    pollIntervalMs: 10,
    timeoutMs: 1000,
  });

  const executed = await data.jobs.runNext(transport);
  assert.equal(executed, true);

  const result = data.jobs.get(data.session, job.id);
  assert.equal(result.state, 'needs_attention');
  assert.equal(result.error_code, 'artifact_validation_failed');
  assert.match(result.diagnostic || '', /match this authoritative project intake/);

  // Original attachments are preserved in the DB for operator review
  const savedAttachments = data.db.prepare('SELECT filename, byte_size FROM discord_attachments WHERE job_id=?').all(job.id) as any[];
  assert.equal(savedAttachments.length, 3);
});
