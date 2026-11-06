import {parentPort,workerData} from 'node:worker_threads';
import {openDatabase} from '../src/db/connection.js';
import {ProcessingJobs} from '../src/jobs/service.js';
const db=openDatabase(workerData.config),jobs=new ProcessingJobs(db);
parentPort!.once('message',async()=>{
 try{
  const result=workerData.operation==='create'?{id:jobs.create(workerData.session,workerData.bindingId,'concurrent').id}:{processed:await jobs.runNext()};
  parentPort!.postMessage(result);
 }catch{parentPort!.postMessage({failed:true});}finally{db.close();parentPort!.close();}
});
parentPort!.postMessage('ready');
