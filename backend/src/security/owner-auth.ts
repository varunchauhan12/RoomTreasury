import {localAuditContext} from './local-workspace.js';
import {randomBytes,randomUUID,createHash,createHmac,scrypt,timingSafeEqual} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {FastifyRequest} from 'fastify';
import {AuthError} from './service-auth.js';
export interface OwnerSession {readonly ownerId:string;readonly digest:string;readonly csrf:string;readonly createdAt:number}
export interface AuthSettings {readonly origin:string;readonly secure:boolean;readonly cookieName:string;readonly localWorkspace?:boolean}
export function authSettings(db:Database,env:NodeJS.ProcessEnv=process.env):AuthSettings {
 const mode=db.prepare('SELECT mode FROM schema_migrations LIMIT 1').pluck().get();const production=mode==='real'||env.NODE_ENV==='production';
 const raw=env.ROOMTREASURY_AUTH_ORIGIN??(!production?'http://127.0.0.1:3000':undefined);
 if(!raw)throw new Error('Explicit HTTPS owner authentication origin required.');
 let url:URL;try{url=new URL(raw);}catch{throw new Error('Invalid owner authentication origin.');}
 if(raw!==url.origin||url.username||url.password||!['http:','https:'].includes(url.protocol)||(url.protocol==='http:'&&(production||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('Owner authentication requires HTTPS except local demo/test.');
 return Object.freeze({origin:url.origin,secure:url.protocol==='https:',cookieName:url.protocol==='https:'?'__Host-rt_owner':'rt_demo_owner'});
}
const digest=(token:string)=>createHash('sha256').update('RoomTreasury/human-session/v1\0'+token).digest('hex');
const csrf=(token:string)=>createHmac('sha256',token).update('RoomTreasury/csrf/v1').digest('base64url');
export function checkOrigin(request:FastifyRequest,settings:AuthSettings):void {
 if(request.headers.origin!==settings.origin||request.headers.host!==new URL(settings.origin).host||request.headers['sec-fetch-site']==='cross-site')throw new AuthError(403,'CSRF_REJECTED');
}
function tokenFrom(request:FastifyRequest,settings:AuthSettings):string {
 if(request.headers.authorization)throw new AuthError(401,'OWNER_LOGIN_REQUIRED');
 const cookies=(request.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(settings.cookieName+'='));
 if(cookies.length!==1)throw new AuthError(401,'OWNER_LOGIN_REQUIRED');const token=cookies[0]!.slice(settings.cookieName.length+1);
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AuthError(401,'OWNER_LOGIN_REQUIRED');return token;
}
export function ownerSession(db:Database,request:FastifyRequest,settings:AuthSettings,mutation=false):OwnerSession {
 if(settings.localWorkspace)return localAuditContext(db,request);
 const token=tokenFrom(request,settings),now=Date.now();
 const row=db.prepare(`SELECT s.*,o.disabled_at FROM human_sessions s JOIN human_owners o ON o.id=s.owner_id WHERE s.digest=?`).get(digest(token)) as any;
 if(!row||row.revoked_at!==null||row.disabled_at!==null||row.expires_at<=now||row.last_seen+900000<=now)throw new AuthError(401,'OWNER_LOGIN_REQUIRED');
 const expected=csrf(token);
 if(mutation){checkOrigin(request,settings);const supplied=request.headers['x-csrf-token'];if(typeof supplied!=='string'||supplied.length!==expected.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))throw new AuthError(403,'CSRF_REJECTED');}
 if(mutation||request.method!=='GET'||request.headers['x-roomtreasury-passive']!=='1')db.prepare('UPDATE human_sessions SET last_seen=? WHERE digest=?').run(now,row.digest);
 return Object.freeze({ownerId:row.owner_id,digest:row.digest,csrf:expected,createdAt:row.created_at});
}
export function authorizeOwner(db:Database,session:OwnerSession,importId:string):string {
 const row=db.prepare(`SELECT p.task_id FROM proposal_imports p JOIN human_owner_scopes s ON s.task_id=p.task_id
 JOIN human_owners o ON o.id=s.owner_id WHERE p.id=? AND s.owner_id=? AND s.revoked_at IS NULL AND o.disabled_at IS NULL`).get(importId,session.ownerId) as {task_id:string}|undefined;
 if(!row)throw new AuthError(403,'OWNER_SCOPE_REQUIRED');return row.task_id;
}
function passwordHash(password:string,salt:Buffer):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
export function ownerPasswordMinimum(db:Database,env:NodeJS.ProcessEnv=process.env):number {
 const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
 return env.NODE_ENV!=='production'&&modes.length===1&&['demo','test'].includes(modes[0] as string)?3:15;
}
// Operator-only function. No public registration or scope-management endpoint imports it.
export async function provisionOwner(db:Database,username:string,password:string,taskId:string):Promise<string>{
 if(!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username)||typeof password!=='string'||password.length<ownerPasswordMinimum(db)||password.length>128||!taskId.trim()||taskId.length>100)throw new Error('Invalid owner provisioning input.');
 const salt=randomBytes(16),hash=await passwordHash(password,salt),id=randomUUID();
 db.transaction(()=>{db.prepare('INSERT INTO human_owners VALUES (?,?,?,?,?,NULL)').run(id,username,salt,hash,Date.now());db.prepare('INSERT INTO human_owner_scopes VALUES (?,?,?,NULL)').run(id,taskId,Date.now());}).immediate();return id;
}
export async function loginOwner(db:Database,username:string,password:string,ip:string):Promise<{token:string;session:OwnerSession}>{
 const now=Date.now();const keys=['global',createHash('sha256').update('user:'+username).digest('hex'),createHash('sha256').update('ip:'+ip).digest('hex')];
 db.transaction(()=>{for(const key of keys){const row=db.prepare('SELECT * FROM human_login_limits WHERE key=?').get(key) as any;const max=key==='global'?100:10;if(row&&row.reset_at>now&&row.attempts>=max)throw new AuthError(429,'LOGIN_RATE_LIMITED');db.prepare('INSERT INTO human_login_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset_at<=? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END').run(key,now+900000,now,now);}}).immediate();
 const row=db.prepare('SELECT * FROM human_owners WHERE username=?').get(username) as any;
 const hash=await passwordHash(password,row?.password_salt??Buffer.alloc(16));
 if(!row||row.disabled_at!==null||!timingSafeEqual(hash,row.password_hash))throw new AuthError(401,'INVALID_OWNER_CREDENTIALS');
 const token=randomBytes(32).toString('base64url'),sessionDigest=digest(token);
 db.transaction(()=>{const enabled=db.prepare('SELECT 1 FROM human_owners WHERE id=? AND disabled_at IS NULL AND password_hash=?').get(row.id,row.password_hash);if(!enabled)throw new AuthError(401,'INVALID_OWNER_CREDENTIALS');
 db.prepare('UPDATE human_sessions SET revoked_at=? WHERE owner_id=? AND revoked_at IS NULL').run(Date.now(),row.id);
 db.prepare('INSERT INTO human_sessions VALUES (?,?,?,?,?,NULL)').run(sessionDigest,row.id,Date.now(),Date.now()+4*3600000,Date.now());}).immediate();
 return {token,session:Object.freeze({ownerId:row.id,digest:sessionDigest,csrf:csrf(token),createdAt:Date.now()})};
}
export function sessionCookie(settings:AuthSettings,token:string,clear=false):string{return `${settings.cookieName}=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:14400}${settings.secure?'; Secure':''}`;}
