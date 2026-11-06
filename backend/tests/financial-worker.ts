import { AgencyEngine } from '../src/domain/agency-engine.js';
import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from '../src/db/connection.js';
import { FinancialEngine } from '../src/domain/financial-engine.js';
const db=openDatabase(workerData.config);
const engine=new FinancialEngine(db);
parentPort!.postMessage('ready');
parentPort!.once('message', () => {
  try {
    const result=workerData.operation==='proposal'
      ? new AgencyEngine(db).approveProposal(workerData.actor,'p',workerData.proposalId)
      : workerData.operation==='settle'
      ? engine.settle(workerData.actor,'p',workerData.requestId,1,workerData.approvalId,workerData.key)
      : engine.approveRequest(workerData.actor,'p',workerData.requestId,1);
    parentPort!.postMessage({ok:true,result});
  } catch (error) {
    parentPort!.postMessage({ok:false,code:(error as {code?:string}).code});
  } finally { db.close(); parentPort!.close(); }
});
