import {onboardProject} from '../src/jobs/bindings.js';
import {gateChecks} from '../src/approvals/policy.js';
import {ApprovalWorkflow} from '../src/approvals/service.js';
import type {Database} from 'better-sqlite3';
import type {OwnerSession} from '../src/security/owner-auth.js';
import type {ProjectIntake} from '../src/jobs/bindings.js';
import { assertFixtureStorageHasNoSecrets } from '../src/security/test-fixtures.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { readConfig } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';

export function temporaryRoot(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'roomtreasury-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
export function testDatabase(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'roomtreasury-test-'));
  const config = readConfig({ NODE_ENV: 'test', ROOMTREASURY_DB_PATH: join(root, 'test.sqlite') });
  const db = openDatabase(config);
  t.after(() => {
    try { assertFixtureStorageHasNoSecrets(db); }
    finally {
      if (db.open) db.close();
      try { assertFixtureStorageHasNoSecrets(db); }
      finally { rmSync(root, { recursive: true, force: true }); }
    }
  });
  return { root, config, db };
}

// Existing job fixtures explicitly pass the new owner intake gate before testing jobs.
export function onboardAuthorizedProject(db:Database,session:OwnerSession,intake:ProjectIntake,key:string){
 const binding=onboardProject(db,session,intake,key);
 if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='approval_decisions'").get()){
  const workflow=new ApprovalWorkflow(db),gate=workflow.snapshot(session,binding.client_project_id).gates[0]!;
  if(gate.status!=='approved')workflow.decide(session,binding.client_project_id,{
   gate:'intake',subjectHash:gate.subjectHash,decision:'approve',checks:[...gateChecks.intake],reason:'Owner reviewed the synthetic fixture intake, scope, budget and timeline.',
   evidence:['fixture:verified-intake']
  },'fixture-intake-authorization');
 }
 return binding;
}
