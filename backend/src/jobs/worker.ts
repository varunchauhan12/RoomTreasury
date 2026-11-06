import type {Database} from 'better-sqlite3';
import {mockMode} from './bindings.js';
import {ProcessingJobs} from './service.js';

export function startMockWorker(db:Database):()=>Promise<void>{
 mockMode(db);const jobs=new ProcessingJobs(db);
 let stopped=false,busy=false,pending:Promise<unknown>=Promise.resolve();
 const tick=()=>{
  if(stopped||busy)return;busy=true;
  // Unexpected failures leave durable leases for recovery; raw exceptions are never logged.
  pending=jobs.runNext().catch(()=>undefined).finally(()=>{busy=false;});
 };
 const timer=setInterval(tick,1000);timer.unref();tick();
 return async()=>{stopped=true;clearInterval(timer);await pending;};
}
