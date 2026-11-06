import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, symlinkSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setupSyntheticDemo, DEMO_PROJECT_ID, DEMO_RELATIVE_PATH } from '../src/demo/setup.js';
import { readConfig } from '../src/config.js';
import { FinancialEngine } from '../src/domain/financial-engine.js';
import { AgencyEngine } from '../src/domain/agency-engine.js';
import { openDatabase } from '../src/db/connection.js';
import { temporaryRoot, testDatabase } from './helpers.js';
const cli=resolve('.test-build/src/demo/cli.js');
test('explicit synthetic setup creates approved $700 delivery plan distinct from $1000 revenue, and repeats without history changes',t=>{
 const root=temporaryRoot(t);const path=join(root,'demo.sqlite');const config=readConfig({NODE_ENV:'test',ROOMTREASURY_DB_PATH:path});
 const run=()=>spawnSync(process.execPath,[cli],{env:{NODE_ENV:'test',TMPDIR:tmpdir(),ROOMTREASURY_DB_PATH:path},encoding:'utf8'});
 assert.equal(run().status,0);const db=openDatabase(config);try {
 const proposal=db.prepare('SELECT id FROM delivery_proposals').pluck().get() as string;const data=new AgencyEngine(db).economics(DEMO_PROJECT_ID,proposal);
 assert.equal(data.client.client_name,'Northstar Media [SYNTHETIC DEMO]');assert.match(data.client.brief,/not received cash/);
 assert.equal(data.client.revenue_cents,100000);assert.equal(data.proposal.status,'approved');assert.equal(data.proposal.provenance,'manual');assert.equal(data.proposal.approved_by,'synthetic-demo-owner');
 assert.equal(data.delivery!.budget,70000);assert.equal(data.delivery!.available,70000);assert.equal(data.projectedGrossMarginCents,30000);
 assert.deepEqual(data.allocations.map(a=>[a.name,a.limitCents]),[['Research',10000],['Design',15000],['Development',35000],['QA',10000]]);
 assert.equal(data.allocations.reduce((sum,a)=>sum+a.limitCents,0),70000);
 assert.equal(db.prepare('SELECT count(*) FROM workstream_allocations WHERE financial_project_id=?').pluck().get(DEMO_PROJECT_ID),4);
 const finance=new FinancialEngine(db);const owner={kind:'human' as const,id:'synthetic-demo-owner',projectId:DEMO_PROJECT_ID,role:'owner' as const};
 finance.addRecipient(owner,DEMO_PROJECT_ID,'synthetic-recipient','Synthetic recipient');
 const obligation=finance.proposeCommitment(owner,DEMO_PROJECT_ID,{recipientId:'synthetic-recipient',amountCents:1000,purpose:'Synthetic research obligation',currency:'USD',sourceRefs:['synthetic:test'],allocationId:data.allocations[0]!.allocationId});
 finance.confirmCommitment(owner,DEMO_PROJECT_ID,obligation);
 const before=JSON.stringify(db.prepare('SELECT * FROM financial_audit_events').all());const repeat=run();assert.equal(repeat.status,0);assert.match(repeat.stdout,/already exists/);assert.match(repeat.stdout,new RegExp(DEMO_PROJECT_ID));
 assert.equal(JSON.stringify(db.prepare('SELECT * FROM financial_audit_events').all()),before);
 assert.equal(finance.balance(DEMO_PROJECT_ID).committed,1000);assert.equal(finance.balance(DEMO_PROJECT_ID).available,69000);
 assert.equal(db.prepare('SELECT count(*) FROM client_projects').pluck().get(),1);assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),1);assert.equal(db.prepare('SELECT count(*) FROM service_credentials').pluck().get(),0);
 assert.deepEqual(db.pragma('foreign_key_check'),[]);
 }finally{db.close();}
});
test('CLI permits only dedicated demo path and rejects real, production, ordinary storage and aliases',t=>{
 const root=temporaryRoot(t);const run=(mode:string,path:string,extra:Record<string,string>={})=>spawnSync(process.execPath,[cli],{cwd:root,env:{ROOMTREASURY_MODE:mode,ROOMTREASURY_DB_PATH:path,...extra},encoding:'utf8'});
 for(const [mode,path] of [['real','var/real/data.sqlite'],['production','var/real/data.sqlite'],['demo','var/demo/ordinary.sqlite']]) {
  assert.equal(run(mode!,path!).status,1);assert.equal(existsSync(join(root,path!)),false);
 }
 assert.equal(run('demo',DEMO_RELATIVE_PATH,{NODE_ENV:'production'}).status,1);
 assert.equal(existsSync(join(root,DEMO_RELATIVE_PATH)),false);
 assert.equal(run('demo',DEMO_RELATIVE_PATH).status,0);assert.equal(run('demo',DEMO_RELATIVE_PATH).status,0);
 const aliasRoot=join(root,'alias');mkdirSync(join(aliasRoot,'var/demo/northstar-synthetic'),{recursive:true});
 symlinkSync(join(root,DEMO_RELATIVE_PATH),join(aliasRoot,DEMO_RELATIVE_PATH));
 const alias=spawnSync(process.execPath,[cli],{cwd:aliasRoot,env:{ROOMTREASURY_MODE:'demo',ROOMTREASURY_DB_PATH:DEMO_RELATIVE_PATH},encoding:'utf8'});assert.equal(alias.status,1);
});
test('nonempty test storage is refused without altering existing ordinary client or financial records',t=>{
 const {db,config}=testDatabase(t);const agency=new AgencyEngine(db);
 agency.createClientProject({kind:'human',id:'fixture-owner',projectId:'ordinary',role:'owner'},'ordinary','Ordinary client','Ordinary brief',10000);
 const before=JSON.stringify(db.prepare('SELECT * FROM client_projects').all());
 assert.throws(()=>setupSyntheticDemo(config));assert.equal(JSON.stringify(db.prepare('SELECT * FROM client_projects').all()),before);assert.equal(db.prepare('SELECT count(*) FROM projects').pluck().get(),0);
});
