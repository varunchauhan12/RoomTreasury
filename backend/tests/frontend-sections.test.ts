import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext, Script } from 'node:vm';
import { appScript } from '../src/web/app-client.js';
import { sectionsScript } from '../src/web/sections.js';

test('frontend workspace keeps proposed and verified agreed terms distinct', () => {
  new Script(appScript);
  let commercial: {agreedCents:number;proposedCents:number}|null=null;
  const { termsFor, stages } = runInNewContext(sectionsScript + '\n({termsFor,stages})', {
    commercialFor:()=>commercial,
    attentionOverviewJobs: new Set(['failed', 'needs_attention', 'dispatch_uncertain']),
    activeOverviewJobs: new Set(['running', 'collecting'])
  });
  const project = {
    client: { status: 'draft', revenue_cents: 180000 },
    workspace: { imports: [{ id: 'import' }], latestJob: { state: 'imported' } }
  };
  const revision = {
    fingerprint: 'exact-revision',
    proposal: { project: { proposedRevenueCents: 180000, agreedRevenueCents: null as number | null } }
  };
  const review = { status: 'BLOCKED', revision, verifications: [] };
  const reviews = new Map([['import', review]]);
  assert.equal(stages(project, reviews), 'Proposal Review');
  assert.equal(termsFor(project, reviews).proposed, 180000);
  assert.equal(termsFor(project, reviews).agreed, null);

  revision.proposal.project.agreedRevenueCents = 175000;
  assert.equal(termsFor(project, reviews).agreed, null);
  const verified = { ...review, verifications: [{ gate: 'revenue_payment_terms', fingerprint: 'exact-revision' }] };
  assert.equal(termsFor(project, new Map([['import', verified]])).agreed, null);
  assert.equal(termsFor({ ...project, delivery: {} }, reviews).agreed, null);
  commercial={agreedCents:175000,proposedCents:175000};
  assert.equal(termsFor(project,reviews).agreed,175000);
});

test('consolidated navigation retains legacy project, finance, and operations links', () => {
  const { resolveSection } = runInNewContext(sectionsScript + '\n({resolveSection})');
  const cases = [
    ['projects', undefined, 'projects', 'all'],
    ['projects', 'board', 'projects', 'board'],
    ['agency', undefined, 'projects', 'board'],
    ['operations', 'pipeline', 'projects', 'board'],
    ['finance', 'ledger', 'finance', 'budgets'],
    ['transactions', undefined, 'finance', 'transactions'],
    ['reviews', 'history', 'operations', 'approvals'],
    ['agents', undefined, 'operations', 'fleet'],
    ['audit', undefined, 'operations', 'audit']
  ];
  for (const [route, sub, section, tab] of cases) {
    assert.equal(resolveSection(route, sub).section, section);
    assert.equal(resolveSection(route, sub).tab, tab);
  }
});
