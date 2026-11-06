import { existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { type Config, assertDatabasePath } from '../config.js';
import { openDatabase } from '../db/connection.js';
import { AgencyEngine } from '../domain/agency-engine.js';
import type { HumanActor } from '../domain/financial-engine.js';

export const DEMO_PROJECT_ID = 'synthetic-northstar-landing-page';
export const DEMO_RELATIVE_PATH = 'var/demo/northstar-synthetic/roomtreasury.sqlite';
const clientName = 'Northstar Media [SYNTHETIC DEMO]';
const brief = 'Build a SaaS landing page for a new analytics product. Synthetic demo only; agreed revenue is not received cash.';

// Not a general seed/provisioning API. No application route imports this module.
export function setupSyntheticDemo(config: Config): { projectId: string; exists: boolean } {
  if (process.env.NODE_ENV === 'production') throw new Error('Synthetic setup is disabled in production.');
  if (config.mode !== 'demo' && config.mode !== 'test') throw new Error('Synthetic demo requires demo/test storage.');
  assertDatabasePath(config);
  if (config.mode === 'demo' && config.databasePath !== resolve(config.projectRoot, DEMO_RELATIVE_PATH)) throw new Error('Dedicated synthetic demo path required.');
  if (existsSync(config.databasePath)) {
    if (lstatSync(config.databasePath).isSymbolicLink()) throw new Error('Demo database aliases are not supported.');
    // Inspect before migrations or writes: ordinary data must never be changed by setup.
    const existing = new BetterSqlite3(config.databasePath, { readonly: true, fileMustExist: true });
    try {
      const tables = existing.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").pluck().all() as string[];
      if (tables.includes('schema_migrations') && existing.prepare('SELECT 1 FROM schema_migrations WHERE mode!=?').get(config.mode)) throw new Error('Storage mode mismatch.');
      const clients = tables.includes('client_projects') ? existing.prepare('SELECT id,client_name,brief,revenue_cents,status,financial_project_id FROM client_projects').all() as {id:string;client_name:string;brief:string;revenue_cents:number;status:string;financial_project_id:string|null}[] : [];
      if (clients.length === 1 && clients[0]!.id === DEMO_PROJECT_ID && clients[0]!.client_name === clientName && clients[0]!.brief === brief && clients[0]!.revenue_cents === 100000 && clients[0]!.status === 'active' && clients[0]!.financial_project_id === DEMO_PROJECT_ID) {
        const projects = existing.prepare('SELECT id,budget_cents FROM projects').all() as {id:string;budget_cents:number}[];
        if (projects.length !== 1 || projects[0]!.id !== DEMO_PROJECT_ID || projects[0]!.budget_cents !== 70000) throw new Error('Unrecognized demo storage.');
        return {projectId:DEMO_PROJECT_ID,exists:true}; // No reset, migrations or approval replay.
      }
      for (const table of tables.filter(name=>name!=='schema_migrations')) {
        const quoted = '"'+table.replaceAll('"','""')+'"';
        if (existing.prepare(`SELECT 1 FROM ${quoted} LIMIT 1`).get()) throw new Error('Refusing nonempty ordinary storage.');
      }
    } finally { existing.close(); }
  }
  const db = openDatabase(config);
  try {
    db.transaction(() => {
      const agency = new AgencyEngine(db);
      // Synthetic actor confined to this explicit local-only command; never an HTTP identity.
      const owner: HumanActor = Object.freeze({kind:'human',id:'synthetic-demo-owner',projectId:DEMO_PROJECT_ID,role:'owner'});
      agency.createClientProject(owner,DEMO_PROJECT_ID,clientName,brief,100000);
      const proposal = agency.createProposal(owner,DEMO_PROJECT_ID,{
        budgetCents:70000,provenance:'manual',
        explanation:'Estimated internal delivery cost for research, design, development and quality assurance.',
        allocations:[{name:'Research',limitCents:10000},{name:'Design',limitCents:15000},{name:'Development',limitCents:35000},{name:'QA',limitCents:10000}]
      });
      agency.approveProposal(owner,DEMO_PROJECT_ID,proposal.proposalId);
    }).immediate();
    return {projectId:DEMO_PROJECT_ID,exists:false};
  } finally { db.close(); }
}
