import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {hash} from '../jobs/bindings.js';
import {OwnerReview} from '../reviews/service.js';

// Called inside the existing import transaction after the bound link is persisted.
export function recordImportedReport(db:Database,importId:string){
 const link=db.prepare('SELECT binding_id FROM project_import_links WHERE import_id=?').get(importId) as {binding_id:string}|undefined;
 if(!link)return;
 const review=new OwnerReview(db).snapshot(importId);
 const payload=JSON.stringify({kind:'analysis_result',project:db.prepare('SELECT c.* FROM client_projects c JOIN project_task_bindings b ON b.client_project_id=c.id WHERE b.id=?').get(link.binding_id),
  review,decisions:db.prepare('SELECT * FROM approval_decisions WHERE binding_id=? ORDER BY rowid').all(link.binding_id),
  analysis:db.prepare('SELECT * FROM analysis_revisions WHERE binding_id=? ORDER BY revision DESC LIMIT 1').get(link.binding_id)??null});
 const version=db.prepare('SELECT coalesce(max(version),0)+1 FROM approval_reports WHERE binding_id=?').pluck().get(link.binding_id);
 db.prepare('INSERT INTO approval_reports VALUES (?,?,?,?,?,?,?,?,?)').run(randomUUID(),link.binding_id,version,importId,review.revision.id,review.revision.fingerprint,payload,hash(payload),Date.now());
}
