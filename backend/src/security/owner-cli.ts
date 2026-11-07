import {assertLifecycleDemoPath,seedLifecycleDemo} from '../commercial/demo.js';
import {emitKeypressEvents} from 'node:readline';
import {readConfig} from '../config.js';
import {openDatabase} from '../db/connection.js';
import {provisionOwner,ownerPasswordMinimum,loginOwner} from './owner-auth.js';
process.umask(0o077);
async function hidden(prompt:string):Promise<string>{
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Interactive terminal required.');
 process.stdout.write(prompt);emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const done=()=>{process.stdin.removeListener('keypress',handle);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};const handle=(text:string,key:{name?:string;ctrl?:boolean})=>{if(key.ctrl&&key.name==='c'){done();reject(new Error('Cancelled'));}else if(key.name==='return'){done();resolve(value);}else if(key.name==='backspace')value=value.slice(0,-1);else if(text&&!key.ctrl&&value.length<128)value+=text;};process.stdin.on('keypress',handle);});
}
try{
 const [action,username,taskId]=process.argv.slice(2);if(!username||(action!=='seed-lifecycle'&&!taskId)||!['create','grant','revoke','disable','seed-lifecycle'].includes(action??''))throw new Error('Invalid command.');
 const config=readConfig();if(action==='seed-lifecycle')assertLifecycleDemoPath(config);
 const db=openDatabase(config);try{
 if(action==='seed-lifecycle'){
  const login=await loginOwner(db,username,await hidden('Demo owner password (hidden): '),'local-demo-seed');
  try{console.info(seedLifecycleDemo(config,db,login.session)?'Four [DEMO] clients seeded.':'[DEMO] workspace already seeded.');}
  finally{db.prepare('UPDATE human_sessions SET revoked_at=? WHERE digest=?').run(Date.now(),login.session.digest);}
 }else if(action==='create'){const minimum=ownerPasswordMinimum(db);const password=await hidden(`New owner password (${minimum}–128 characters; hidden): `);const confirm=await hidden('Confirm password (hidden): ');if(password!==confirm){console.error('Passwords did not match. Run the command again and enter the same password twice.');throw new Error('Mismatch');}if(password.length<minimum||password.length>128){console.error(`Password must contain ${minimum}–128 characters for this environment.`);throw new Error('Length');}const id=await provisionOwner(db,username,password,taskId!);console.info('Owner provisioned:',id);}
 else db.transaction(()=>{const row=db.prepare('SELECT id FROM human_owners WHERE username=? AND disabled_at IS NULL').get(username) as {id:string}|undefined;if(!row)throw new Error();if(action==='grant')db.prepare('INSERT INTO human_owner_scopes VALUES (?,?,?,NULL) ON CONFLICT(owner_id,task_id) DO UPDATE SET revoked_at=NULL,granted_at=excluded.granted_at').run(row.id,taskId,Date.now());if(action==='revoke')db.prepare('UPDATE human_owner_scopes SET revoked_at=? WHERE owner_id=? AND task_id=?').run(Date.now(),row.id,taskId);if(action==='disable'){db.prepare('UPDATE human_owners SET disabled_at=? WHERE id=?').run(Date.now(),row.id);db.prepare('UPDATE human_sessions SET revoked_at=? WHERE owner_id=? AND revoked_at IS NULL').run(Date.now(),row.id);}}).immediate();
 }finally{db.close();}
}catch{console.error('Owner administration failed. Use create|grant|revoke|disable USERNAME TASK_ID with explicit database configuration; or seed-lifecycle USERNAME; password entry requires an interactive terminal.');process.exitCode=1;}
