import type {Database} from 'better-sqlite3';
import {OwnerReview,gates} from './service.js';
export function authenticationBlockers(db:Database,id:string){const snapshot=new OwnerReview(db).snapshot(id);const verifications=db.prepare(`SELECT v.gate FROM owner_review_verifications v JOIN authenticated_review_events a
 ON a.revision_id=v.revision_id AND a.fingerprint=v.fingerprint AND a.action='verify' AND a.target_id=v.note_id AND a.gate=v.gate AND a.owner_id=v.owner_id
 JOIN human_owners o ON o.id=a.owner_id JOIN human_owner_scopes s ON s.owner_id=o.id
 JOIN proposal_imports p ON p.id=a.import_id AND p.task_id=s.task_id
 WHERE v.revision_id=? AND v.fingerprint=? AND o.disabled_at IS NULL AND s.revoked_at IS NULL`).pluck().all(snapshot.revision.id,snapshot.revision.fingerprint) as string[];
 return Object.keys(gates).filter(g=>!verifications.includes(g)).map(g=>'Authenticated owner verification required: '+g);}
