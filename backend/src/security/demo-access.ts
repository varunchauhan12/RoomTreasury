import {randomBytes,randomUUID,createHash} from 'node:crypto';
import type {Database} from 'better-sqlite3';
import type {FastifyInstance} from 'fastify';
import {ownerSession,sessionCookie,type AuthSettings} from './owner-auth.js';

export function openDemoAccess(db:Database):boolean{
 const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();
 return process.env.NODE_ENV!=='production'&&modes.length===1&&modes[0]==='demo';
}

// Deliberately public local-demo access. This is not proof of a human's identity.
// Existing task scopes, exact-revision gates, transactions and CSRF still apply.
export function registerDemoAccess(app:FastifyInstance,db:Database,settings:AuthSettings){
 if(!openDemoAccess(db))return;
 app.addHook('onRequest',async(request,reply)=>{
  const path=request.url.split('?')[0]??'';
  if(request.method!=='GET'||!(/^\/$|^\/owner-login$|^\/proposal-imports$|^\/projects(?:\/[^/]+)?$/.test(path)))return;
  const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.ip);
  if(!local||request.headers['sec-fetch-site']==='cross-site')return;
  const origin=new URL(settings.origin);
  if(request.headers.host!==origin.host){
   try{const requested=new URL('http://'+request.headers.host);if(['localhost','127.0.0.1','[::1]'].includes(requested.hostname)&&requested.port===origin.port)return reply.redirect(settings.origin+request.url);}catch{/* Unrecognized hosts never receive demo access. */}
   return;
  }
  reply.header('Cache-Control','no-store');
  try{ownerSession(db,request,settings);}catch(error){
   if(!(error instanceof Error)||!('statusCode' in error)||error.statusCode!==401)throw error;
   const token=randomBytes(32).toString('base64url');
   const digest=createHash('sha256').update('RoomTreasury/human-session/v1\0'+token).digest('hex');
   db.transaction(()=>{
    let owner=db.prepare('SELECT id,disabled_at FROM human_owners WHERE username=?').get('owner') as {id:string;disabled_at:number|null}|undefined;
    // No password is generated or distributed. Random verifier bytes cannot be used to sign in.
    if(!owner){owner={id:randomUUID(),disabled_at:null};db.prepare('INSERT INTO human_owners VALUES (?,?,?,?,?,NULL)').run(owner.id,'owner',randomBytes(16),randomBytes(64),Date.now());db.prepare('INSERT INTO human_owner_scopes VALUES (?,?,?,NULL)').run(owner.id,'local-demo-access',Date.now());}
    if(owner.disabled_at!==null)throw new Error('Local demo owner is disabled.');
    const now=Date.now();db.prepare('INSERT INTO human_sessions VALUES (?,?,?,?,?,NULL)').run(digest,owner.id,now,now+4*3600000,now);
   }).immediate();
   reply.header('Set-Cookie',sessionCookie(settings,token));
  }
  if(path==='/owner-login')return reply.redirect('/');
 });
 app.addHook('onSend',async(_request,reply,payload)=>{
  if(typeof payload==='string'&&String(reply.getHeader('content-type')).startsWith('text/html')){
   const note='<div class="rt-demo-access-banner" role="note">LOCAL DEMO · No sign-in · Shared owner controls. Decisions do not verify a human identity.</div>';
   return payload.replace('</body>',note+'</body>');
  }
  return payload;
 });
}
