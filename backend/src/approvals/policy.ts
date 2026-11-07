import type {Database} from 'better-sqlite3';
import {hash} from '../jobs/bindings.js';
import {AuthError} from '../security/service-auth.js';
export const gateChecks={
 intake:['brief','scope','deliverables','budget_expectations','timeline'],
 proposal:['requirements','challenge_findings','commitment_findings','treasury_findings','assumptions','risks','evidence'],
 commercial:['price','client_response','accepted_revision','payment_terms','signed_agreement'],
 financial:['rates','cost','capacity','schedule','budget','allocations','contingency','commitments','policy','risks'],
 activation:['consolidated_report','outstanding_conditions']
} as const;
export const gateOrder=['intake','proposal','commercial','financial','activation'] as const;
export type Gate=typeof gateOrder[number];
export const gateDependencies:Record<Gate,readonly Gate[]>={
 intake:[],proposal:['intake'],commercial:['proposal'],financial:['commercial'],activation:['financial']
};
export const sectionSpecialists={
 scope:['req-agent'],risks:['challenge-agent'],capacity:['commitment-intelligence-agent'],
 costs:['treasury-ops-agent'],commercial:['req-agent','treasury-ops-agent'],
 evidence:['req-agent','challenge-agent','commitment-intelligence-agent','treasury-ops-agent']
} as const;
export type Section=keyof typeof sectionSpecialists;
export function intakeSubject(db:Database,bindingId:string):string {
 const row=db.prepare('SELECT c.id,c.client_name,c.brief,c.revenue_cents,c.currency FROM client_projects c JOIN project_task_bindings b ON b.client_project_id=c.id WHERE b.id=?').get(bindingId);
 const negative=db.prepare("SELECT id FROM approval_decisions WHERE binding_id=? AND gate='intake' AND decision!='approve' ORDER BY rowid DESC LIMIT 1").pluck().get(bindingId);
 return hash(JSON.stringify([row,negative??null]));
}
export function requireIntake(db:Database,bindingId:string):void{
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='approval_decisions'").get())return;
 const approved=db.prepare("SELECT 1 FROM approval_decisions WHERE binding_id=? AND gate='intake' AND subject_hash=? AND decision='approve'").get(bindingId,intakeSubject(db,bindingId));
 if(!approved)throw new AuthError(409,'INTAKE_AUTHORIZATION_REQUIRED');
}
