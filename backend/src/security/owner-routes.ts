import {openDemoAccess} from './demo-access.js';
import type {FastifyInstance} from 'fastify';
import type {Database} from 'better-sqlite3';
import {authSettings,checkOrigin,loginOwner,ownerSession,sessionCookie,type AuthSettings} from './owner-auth.js';
import {errorSchema} from '../api/errors.js';
export function registerOwnerAuth(app:FastifyInstance,db:Database,settings:AuthSettings=authSettings(db)){
 const responses={200:{type:'object',additionalProperties:true},400:errorSchema,401:errorSchema,403:errorSchema,429:errorSchema,500:errorSchema};
 let logins=0;
 app.post<{Body:{username:string;password:string}}>('/v1/owner-auth/login',{bodyLimit:2048,schema:{operationId:'ownerLogin',body:{type:'object',additionalProperties:false,required:['username','password'],properties:{username:{type:'string',minLength:1,maxLength:64},password:{type:'string',minLength:1,maxLength:128}}},response:responses}},async(request,reply)=>{
 checkOrigin(request,settings);if(logins>=2){const {AuthError}=await import('./service-auth.js');throw new AuthError(429,'LOGIN_RATE_LIMITED');}logins++;
 try{const result=await loginOwner(db,request.body.username,request.body.password,request.ip);reply.header('Cache-Control','no-store').header('Set-Cookie',sessionCookie(settings,result.token));return {ownerId:result.session.ownerId,csrfToken:result.session.csrf,sessionExpiresInSeconds:14400};}finally{logins--;}
 });
 app.get('/v1/owner-auth/session',{schema:{operationId:'ownerSession',response:responses}},(request,reply)=>{const session=ownerSession(db,request,settings);reply.header('Cache-Control','no-store');return {ownerId:session.ownerId,csrfToken:session.csrf,demoAccess:openDemoAccess(db)};});
 app.post('/v1/owner-auth/logout',{schema:{operationId:'ownerLogout',response:responses}},(request,reply)=>{db.transaction(()=>{const session=ownerSession(db,request,settings,true);db.prepare('UPDATE human_sessions SET revoked_at=? WHERE digest=? AND revoked_at IS NULL').run(Date.now(),session.digest);}).immediate();reply.header('Cache-Control','no-store').header('Set-Cookie',sessionCookie(settings,'',true));return {loggedOut:true};});
}
