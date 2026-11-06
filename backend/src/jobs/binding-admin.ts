import {userInfo} from 'node:os';
import {readConfig} from '../config.js';
import {openDatabase} from '../db/connection.js';
import {provisionLegacyBinding} from './bindings.js';
process.umask(0o077);
try{
 const [action,projectId,taskId,username,verificationRef,confirmation,...extra]=process.argv.slice(2);
 if(!process.stdin.isTTY||!process.stdout.isTTY||action!=='bind'||!projectId||!taskId||!username||!verificationRef||confirmation!=='CONFIRM_VERIFIED_RELATIONSHIP'||extra.length)throw new Error();
 const db=openDatabase(readConfig());
 try{const binding=provisionLegacyBinding(db,projectId,taskId,username,'local-os:'+userInfo().username,verificationRef);console.info('Verified legacy binding:',binding.id);}finally{db.close();}
}catch{console.error('Binding administration rejected. Use an interactive trusted terminal, explicit database configuration, and: bind PROJECT_ID TASK_ID USERNAME VERIFICATION_REF CONFIRM_VERIFIED_RELATIONSHIP');process.exitCode=1;}
