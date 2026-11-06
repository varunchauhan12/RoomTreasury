import {parentPort,workerData} from 'node:worker_threads';
import {openDatabase} from '../src/db/connection.js';
import {OwnerReview} from '../src/reviews/service.js';
const db=openDatabase(workerData.config);parentPort!.postMessage('ready');parentPort!.once('message',()=>{try{const result=new OwnerReview(db).decide(workerData.actor,workerData.importId,workerData.revisionId,workerData.fingerprint,'APPROVED_SYNTHETIC_DELIVERY') as {id:string};parentPort!.postMessage({ok:true,id:result.id});}catch{parentPort!.postMessage({ok:false});}finally{db.close();parentPort!.close();}});
