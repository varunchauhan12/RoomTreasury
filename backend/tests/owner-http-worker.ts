import {parentPort,workerData} from 'node:worker_threads';
import {openDatabase} from '../src/db/connection.js';
import {buildApp} from '../src/app.js';
process.env.ROOMTREASURY_AUTH_ORIGIN='http://127.0.0.1:3000';
const app=await buildApp(openDatabase(workerData.config));parentPort!.postMessage('ready');
parentPort!.once('message',async()=>{try{const result=await app.inject({method:'POST',url:workerData.path+'/approve',headers:workerData.headers,payload:workerData.body});parentPort!.postMessage({status:result.statusCode,id:result.json().decision?.id});}catch{parentPort!.postMessage({status:500});}finally{await app.close();parentPort!.close();}});
