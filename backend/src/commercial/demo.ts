import {dirname,resolve} from 'node:path';
import {existsSync,realpathSync} from 'node:fs';
import type {Database} from 'better-sqlite3';
import type {Config} from '../config.js';
import {onboardProject,activeSession} from '../jobs/bindings.js';
import type {OwnerSession} from '../security/owner-auth.js';
import {CommercialLedger,commercialDemo,type Action} from './service.js';

export function assertLifecycleDemoPath(config:Config){
 const root=resolve(realpathSync(config.projectRoot),'var/demo/commercial-lifecycle');
 for(const path of [root,dirname(root),dirname(dirname(root)),config.databasePath]){
  if(existsSync(path)&&realpathSync(path)!==path)throw new Error('Dedicated lifecycle demo storage required.');
 }
 if(config.mode!=='demo'||process.env.NODE_ENV==='production'||dirname(config.databasePath)!==root)throw new Error('Dedicated lifecycle demo storage required.');
}

export function seedLifecycleDemo(config:Config,db:Database,session:OwnerSession){
 assertLifecycleDemoPath(config);
 if(db.name!==config.databasePath||realpathSync(config.databasePath)!==config.databasePath)throw new Error('Dedicated lifecycle demo storage required.');
 return db.transaction(()=>{
  activeSession(db,session);
  if(commercialDemo(db)){
   if(!db.prepare('SELECT 1 FROM project_task_bindings WHERE owner_id=?').get(session.ownerId))throw new Error('Use the original demo owner.');
   return false;
  }
  if(db.prepare('SELECT 1 FROM client_projects UNION ALL SELECT 1 FROM projects UNION ALL SELECT 1 FROM proposal_imports').get())throw new Error('Use an empty demo workspace.');
  db.prepare('INSERT INTO commercial_demo VALUES (1)').run();
  const ledger=new CommercialLedger(db);
  const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  const clients=[['Lumen Studio',240000],['Harbor Collective',180000],['Orbit Atelier',125000],['Spruce Works',95000]] as const;
  clients.forEach(([name,cents],index)=>{
   const project=onboardProject(db,session,{clientName:'[DEMO] '+name,brief:'[DEMO] Synthetic client lifecycle example.',revenueCents:cents},'demo-intake-'+index);
   let step=0;
   const write=(action:Action)=>ledger.apply(session,project.client_project_id,action,'demo-step-'+(++step));
   const quote=write({action:'submit',amountCents:cents,reference:'[DEMO] Submitted proposal '+(index+1)}).quote!;
   if(index===3){write({action:'revision_requested',quoteId:quote.id,reference:'[DEMO] Revised scope requested'});return;}
   if(index===2)return;
   write({action:'accept',quoteId:quote.id,reference:'[DEMO] Recorded client acceptance'});
   write({action:'agreement',quoteId:quote.id,amountCents:cents,signedOn:day(-25),terms:'[DEMO] Net 14 days',reference:'[DEMO] Signed agreement '+(index+1)});
   const invoice=write({action:'invoice_draft',amountCents:cents,number:'DEMO-'+(index+1),dueOn:day(index===0?-5:7)}).invoices[0]!;
   write({action:'invoice_issue',invoiceId:invoice.id,date:day(index===0?-19:-7)});
   if(index===0)write({action:'receipt',invoiceId:invoice.id,amountCents:cents,date:day(-8),method:'[DEMO] Simulated recording',reference:'[DEMO] Sample receipt 1'});
  });
  return true;
 }).immediate();
}
