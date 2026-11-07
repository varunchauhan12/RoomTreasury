import {onboardAuthorizedProject as onboardProject} from './helpers.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { testDatabase } from './helpers.js';
import { provisionOwner, loginOwner } from '../src/security/owner-auth.js';

import { ProcessingJobs } from '../src/jobs/service.js';
import { validateBundle, type ImportBundle, ImportError } from '../src/imports/service.js';
import { confirmProjectImport, importDiscordPackage, previewProjectImport } from '../src/imports/project-linked.js';
import { OwnerReview } from '../src/reviews/service.js';

const test004Intake = {
  clientName: 'PixelCraft Studio',
  brief: 'Five responsive pages:Home,About,Services,Portfolio,Contact; contact form with email notifications; portfolio displaying6 projects; basic SEO/performance optimization. Client supplies logo and written content. No CMS requirement specified. Hosting/domain costs excluded from proposed150000 USD-cent price. Requested deadline15 business days; no start trigger/calendar dates.',
  revenueCents: 150000,
};

function loadTest004Bundle(): ImportBundle {
  const proposalRaw = readFileSync('backend/tests/fixtures/test-004/proposal.json', 'utf8');
  const evidenceRaw = readFileSync('backend/tests/fixtures/test-004/evidence.json', 'utf8');
  const summaryRaw = readFileSync('backend/tests/fixtures/test-004/summary.md', 'utf8');

  return {
    proposal: { name: 'proposal.json', content: proposalRaw },
    evidence: { name: 'evidence.json', content: evidenceRaw },
    summary: { name: 'summary.md', content: summaryRaw },
  };
}

async function fixture(t: TestContext) {
  const data = testDatabase(t);
  const ownerId = await provisionOwner(data.db, 'compat-owner', 'Synthetic compat owner password', 'PREEXISTING');
  const login = await loginOwner(data.db, 'compat-owner', 'Synthetic compat owner password', 'fixture');
  const binding = onboardProject(data.db, login.session, test004Intake, 'compat-onboarding');
  const jobs = new ProcessingJobs(data.db);
  return { ...data, ...login, ownerId, binding, jobs };
}

test('Actual TEST-004 artifact package validates completely through compatibility layer', () => {
  const bundle = loadTest004Bundle();
  const validated = validateBundle(bundle);

  assert.ok(validated);
  assert.equal(validated.proposal.taskId, 'RT-INSTRUCTION-TEST-004');
  assert.equal(validated.proposal.client.name, 'PixelCraft Studio');
  assert.equal(validated.proposal.status, 'NEEDS_CLIENT_CLARIFICATION');

  // Proposed revenue is preserved, agreed revenue is null
  assert.equal(validated.proposal.project.agreedRevenueCents, null);
  assert.equal(validated.proposal.project.proposedRevenueCents, 150000);
  assert.equal(validated.proposal.financialSummary.agreedRevenueCents, null);
  assert.equal(validated.proposal.financialSummary.proposedRevenueCents, 150000);

  // Exact arithmetic checks hold down to the cent
  assert.equal(validated.proposal.financialSummary.baseEstimatedCostCents, 128800);
  assert.equal(validated.proposal.financialSummary.contingencyCents, 25760);
  assert.equal(validated.proposal.financialSummary.proposedDeliveryBudgetCents, 154560);
  assert.equal(validated.proposal.financialSummary.projectedGrossMarginCents, -4560);
  assert.equal(validated.proposal.financialSummary.projectedGrossMarginPercent, -3.04);

  // 4 specialist contributions verified with genuine Switch source message IDs
  assert.equal(validated.proposal.specialistContributions.length, 4);
  const specialists = validated.proposal.specialistContributions.map((c: any) => c.specialist);
  assert.deepEqual(specialists.sort(), [
    'challenge-agent',
    'commitment-intelligence-agent',
    'req-agent',
    'treasury-ops-agent',
  ]);

  // Warning labels proposed revenue correctly
  assert.ok(validated.warnings.some((w) => w.includes('Revenue is proposed estimate only')));
});

test('TEST-004 imports into project workspace with strict delivery approval blockers', async (t) => {
  const data = await fixture(t);
  const job = data.jobs.create(data.session, data.binding.id, 'compat-job-1', 'discord');

  // Align task ID in bundle with binding task_id for linked terms validation
  const rawBundle = loadTest004Bundle();
  const p = JSON.parse(rawBundle.proposal.content);
  p.taskId = data.binding.task_id;
  for (const c of p.specialistContributions) c.projectId = data.binding.task_id;
  for (const m of p.statementOfWork.milestones) m.milestoneId = data.binding.task_id + '-' + m.milestoneId.split('-').pop();

  const bundle: ImportBundle = {
    proposal: { name: 'proposal.json', content: JSON.stringify(p) },
    ...(rawBundle.evidence ? { evidence: rawBundle.evidence } : {}),
    ...(rawBundle.summary ? { summary: rawBundle.summary } : {}),
  };

  // Transition job to validating state as expected by discord_agent_delivery trigger
  const claimed = data.jobs.claim('discord');
  assert.ok(claimed);
  data.jobs.apply(claimed.id, claimed.lease_owner!, 'dispatch-ack', 'dispatched');
  data.jobs.apply(claimed.id, claimed.lease_owner!, 'discord-running', 'running');
  data.jobs.apply(claimed.id, claimed.lease_owner!, 'discord-collecting', 'collecting');
  data.jobs.apply(claimed.id, claimed.lease_owner!, 'discord-validating', 'validating');

  assert.throws(() => importDiscordPackage(data.db, job.id, bundle), error=>error instanceof ImportError&&error.issues.some(i=>i.includes('require exact project, job and intake binding')));
  assert.equal(data.db.prepare('SELECT count(*) FROM proposal_imports').pluck().get(),0);
  data.jobs.apply(claimed.id, claimed.lease_owner!, 'needs-attention', 'needs_attention','artifact_validation_failed');
  const preview=previewProjectImport(data.db,data.session,data.binding.client_project_id,bundle);
  const result=confirmProjectImport(data.db,data.session,data.binding.client_project_id,bundle,preview);
  assert.ok(result.id);
  assert.equal(result.duplicate, false);

  // Check owner review snapshot
  const review = new OwnerReview(data.db);
  const snapshot = review.snapshot(result.id);

  // The proposal must be BLOCKED from delivery approval:
  assert.equal(snapshot.status, 'BLOCKED');
  assert.ok(snapshot.blockers.length >= 3);

  // Blocker 1: Unconfirmed client revenue blocks approval
  assert.ok(snapshot.blockers.some((b) => b.includes('Client agreed revenue is unconfirmed')));

  // Blocker 2: Proposal status is NEEDS_CLIENT_CLARIFICATION
  assert.ok(snapshot.blockers.some((b) => b.includes('Proposal status blocks approval: NEEDS_CLIENT_CLARIFICATION')));

  // Blocker 3: Decision recommendation defers approval
  assert.ok(snapshot.blockers.some((b) => b.includes('Owner recommendation still defers or rejects delivery approval')));

  // Blocker 4: Negative gross margin requires explicit financial review
  assert.ok(snapshot.blockers.some((b) => b.includes('low or negative projected margin')));
});

test('Malformed, corrupted, or incomplete artifacts fail validation safely', () => {
  const baseBundle = loadTest004Bundle();

  // 1. Corrupted JSON syntax
  assert.throws(() => {
    validateBundle({
      ...baseBundle,
      proposal: { name: 'proposal.json', content: '{ invalid json syntax' },
    });
  }, ImportError);

  // 2. Missing required proposal file
  assert.throws(() => {
    validateBundle({
      proposal: undefined as any,
      ...(baseBundle.evidence ? { evidence: baseBundle.evidence } : {}),
      ...(baseBundle.summary ? { summary: baseBundle.summary } : {}),
    });
  }, ImportError);

  // 3. Arithmetically tampered cost / margin
  const tamperedProposal = JSON.parse(baseBundle.proposal.content);
  tamperedProposal.financialSummary.projectedGrossMarginCents = 999999; // Doesn't match 150000 - 154560
  assert.throws(() => {
    validateBundle({
      ...baseBundle,
      proposal: { name: 'proposal.json', content: JSON.stringify(tamperedProposal) },
    });
  }, ImportError);

  // 4. Missing specialist contribution sourceMessageIds
  const missingSourceProposal = JSON.parse(baseBundle.proposal.content);
  missingSourceProposal.specialistContributions[0].sourceMessageIds = [];
  assert.throws(() => {
    validateBundle({
      ...baseBundle,
      proposal: { name: 'proposal.json', content: JSON.stringify(missingSourceProposal) },
    });
  }, ImportError);

  // 5. Specialist message ID not found in evidence
  const wrongSourceProposal = JSON.parse(baseBundle.proposal.content);
  wrongSourceProposal.specialistContributions[0].sourceMessageIds = ['sw_completely_fake_nonexistent_id'];
  assert.throws(() => {
    validateBundle({
      ...baseBundle,
      proposal: { name: 'proposal.json', content: JSON.stringify(wrongSourceProposal) },
    });
  }, ImportError);
});
