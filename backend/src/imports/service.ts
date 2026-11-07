import { Ajv, type ValidateFunction } from 'ajv';
import { createHash, randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { proposalSchema, evidenceSchema } from './schemas.js';
import { normalizeBoundArtifacts } from './bound-artifacts.js';
import { adaptAgentBundle } from './compatibility.js';
export interface Artifact { name:string; content:string }
export interface ImportBundle { proposal:Artifact; evidence?:Artifact; summary?:Artifact }
type Json = null | boolean | number | string | Json[] | {[key:string]:Json};
// Structural types are established by AJV before the business cross-checks below.
type RecordData = Record<string,any>;
const ajv=new Ajv({allErrors:true,coerceTypes:false,strict:false});
const proposalCheck=ajv.compile(proposalSchema), evidenceCheck=ajv.compile(evidenceSchema);
export class ImportError extends Error {
 constructor(readonly issues:string[],readonly statusCode=400){super('Proposal import rejected.');}
}
const reject=(message:string):never=>{throw new ImportError([message]);};
const canonical=(value:Json):string=>value!==null && typeof value==='object' ? Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k]!)).join(',')+'}':JSON.stringify(value);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function artifact(file:Artifact|undefined,extension:string,max:number,required=false):string|null {
 if(!file){if(required)reject('Proposal JSON is required.');return null;}
 if(typeof file.name!=='string'||!file.name.toLowerCase().endsWith(extension)||typeof file.content!=='string'||!file.content.trim())reject(`Provide a nonempty ${extension} file.`);
 if(Buffer.byteLength(file.content,'utf8')>max)reject(`${extension} file exceeds ${max} bytes.`);
 if(/-----BEGIN .*PRIVATE KEY|(?:sk-proj-|ghp_)[A-Za-z0-9_-]{20,}|rt1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/.test(file.content))reject('Remove credential-like material before importing.');
 return file.content;
}
function parse(raw:string,check:ValidateFunction):RecordData {
 let data;try{data=JSON.parse(raw);}catch{reject('Malformed JSON.');}
 const pending:[unknown,number][]=[[data,0]];let nodes=0;while(pending.length){const [value,depth]=pending.pop()!;if(depth>30||++nodes>30000)reject('Artifact structure is too deeply nested or too large.');if(value&&typeof value==='object')for(const child of Object.values(value))pending.push([child,depth+1]);}
 if(!check(data))throw new ImportError((check.errors??[]).slice(0,12).map(e=>`${e.instancePath||'/'}: ${e.message??'invalid field'}${e.keyword==='required'?' ('+e.params.missingProperty+')':''}`));
 return data as RecordData;
}
export function validateBundle(bundle:ImportBundle) {
 const rawProposal=artifact(bundle.proposal,'.json',256*1024,true)!;
 const rawEvidence=artifact(bundle.evidence,'.json',512*1024),rawSummary=artifact(bundle.summary,'.md',64*1024);
 let normalized:ReturnType<typeof normalizeBoundArtifacts>;
 try{normalized=normalizeBoundArtifacts(bundle);}catch{throw new ImportError(['Malformed or contradictory bound coordinator artifact metadata.']);}
 const { bundle: adaptedBundle } = adaptAgentBundle(normalized.bundle);
 const original=artifact(adaptedBundle.proposal,'.json',256*1024,true)!;
 const evidenceRaw=artifact(adaptedBundle.evidence,'.json',512*1024),summary=artifact(adaptedBundle.summary,'.md',64*1024);
 const p=parse(original,proposalCheck),e=evidenceRaw?parse(evidenceRaw,evidenceCheck):null;
 const money=(value:unknown,signed=false)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=(signed?-1000000000:0)&&value<=1000000000;
 function numbers(value:any,key=''):void {
  if(value && typeof value==='object')for(const [k,v] of Object.entries(value))numbers(v,k);
  else if(/Cents$/.test(key)&&value!==null&&!money(value,/Margin/.test(key)))reject('Amounts must be bounded integer USD cents.');
  else if(typeof value==='number'&&(!Number.isFinite(value)||value<0&&!/Margin/.test(key)))reject('Invalid negative numeric value.');
 }
 numbers(p);
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(p.taskId))reject('Invalid taskId.');
 const revenueCents = p.project.agreedRevenueCents ?? p.project.proposedRevenueCents;
 if(typeof revenueCents !== 'number' || revenueCents <= 0 || p.proposal.budgetCents <= 0)reject('Revenue and proposed budget must be positive.');
 const allocations=p.proposal.allocations as RecordData[];
 if(allocations.length!==4||new Set(allocations.map(a=>a.workstream)).size!==4||allocations.some(a=>!['Research','Design','Development','QA'].includes(a.workstream)||a.limitCents<=0||a.baseCostCents+a.contingencyCents!==a.limitCents))reject('Exactly four workstreams with reconciled base and contingency are required.');
 const sum=(key:string)=>allocations.reduce((total,a)=>total+a[key],0);
 const f=p.financialSummary;
 if(p.project.agreedRevenueCents===null&&f.proposedRevenueCents!==undefined&&f.proposedRevenueCents!==revenueCents)reject('Proposed revenue values disagree.');
 if(sum('limitCents')!==p.proposal.budgetCents||f.totalAllocationCents!==sum('limitCents')||f.baseEstimatedCostCents!==sum('baseCostCents')||f.contingencyCents!==sum('contingencyCents')||f.baseEstimatedCostCents+f.contingencyCents!==p.proposal.budgetCents||f.agreedRevenueCents!==p.project.agreedRevenueCents||f.proposedDeliveryBudgetCents!==p.proposal.budgetCents||f.projectedGrossMarginCents!==revenueCents-p.proposal.budgetCents)reject('Financial totals, base costs, contingency or projected margin do not reconcile.');
 if(Math.abs(f.projectedGrossMarginPercent-100*f.projectedGrossMarginCents/revenueCents)>0.01)reject('Projected margin percentage does not reconcile.');
 for(const s of f.scenarios){
  const scenarioTotal = s.totalCostCents ?? s.budgetCents;
  if(s.baseCostCents+s.contingencyCents!==scenarioTotal||revenueCents-scenarioTotal!==s.projectedGrossMarginCents)reject('Financial scenario does not reconcile.');
 }
 const tasks=p.executionPlan.tasks as RecordData[],ids=new Set(tasks.map(t=>t.taskId));
 if(ids.size!==tasks.length)reject('Duplicate execution task IDs.');
 const dependencies=new Map(tasks.map(t=>[t.taskId,t.dependencies as string[]]));
 const seen=new Set<string>(),active=new Set<string>();
 function visit(id:string){if(active.has(id))reject('Cyclic execution dependencies.');if(seen.has(id))return;active.add(id);for(const dependency of dependencies.get(id)??[]){if(!ids.has(dependency))reject('Unknown task dependency.');visit(dependency);}active.delete(id);seen.add(id);}
 for(const id of ids)visit(id);
 if(new Set(p.executionPlan.dependencies.map((r:RecordData)=>r.taskId)).size!==p.executionPlan.dependencies.length||p.executionPlan.dependencies.length!==tasks.filter(t=>t.dependencies.length).length)reject('Dependency index is incomplete or duplicated.');
 for(const row of p.executionPlan.dependencies)if(!ids.has(row.taskId)||canonical([...row.dependsOn].sort())!==canonical([...(dependencies.get(row.taskId)??[])].sort()))reject('Dependency lists disagree.');
 for(const a of allocations){if(a.relatedTasks.some((id:string)=>!ids.has(id)||tasks.find(t=>t.taskId===id)?.workstream!==a.workstream))reject('Allocation references an unknown or wrong-workstream task.');const hours=tasks.filter(t=>t.workstream===a.workstream).reduce((s,t)=>s+t.estimatedEffortHours,0);if(hours!==a.estimatedEffortHours)reject('Workstream effort does not reconcile.');}
 if(tasks.reduce((s,t)=>s+t.estimatedEffortHours,0)!==p.executionPlan.estimatedTotalHours)reject('Total effort does not reconcile.');
 for(const [rows,key] of [[p.riskRegister,'riskId'],[p.statementOfWork.milestones,'milestoneId']] as const)if(new Set(rows.map((r:RecordData)=>r[key])).size!==rows.length)reject('Duplicate risk or milestone IDs.');
 const allocatedTasks=allocations.flatMap(a=>a.relatedTasks as string[]);
 if(allocatedTasks.length!==tasks.length||new Set(allocatedTasks).size!==tasks.length)reject('Every execution task must belong to exactly one allocation.');
 const milestones=p.statementOfWork.milestones as RecordData[];
 for(const milestone of milestones)for(const dependency of milestone.dependencies as string[])if(/^M[0-9]+$/.test(dependency)&&!milestones.some(m=>m.milestoneId===p.taskId+'-'+dependency))reject('Unknown milestone dependency.');
 const contributors=p.specialistContributions as RecordData[];
 if(contributors.length!==4||new Set(contributors.map(c=>c.specialist)).size!==4||contributors.some(c=>!['req-agent','challenge-agent','commitment-intelligence-agent','treasury-ops-agent'].includes(c.specialist)||c.projectId!==p.taskId||!c.sourceMessageIds.length))reject('Four distinct specialist contributions tied to this task are required.');
 if(e){
  const messages=new Map<string,RecordData>();
  if(e.initial && e.reconciliation){
   for(const group of Object.values(e) as RecordData[])for(const thread of group.threads)for(const message of [thread.root,...thread.replies]){if(messages.has(message.id))reject('Duplicate evidence message IDs.');messages.set(message.id,message);}
   for(const c of contributors)for(const id of c.sourceMessageIds){if(messages.get(id)?.sender_name!==c.specialist)reject('Specialist source message is missing or its sender label disagrees.');}
  }else if(e.specialistReports || e.coordinationMessages){
   const specialistReports = Array.isArray(e.specialistReports) ? e.specialistReports : Object.values(e.specialistReports ?? {});
   const reportMap = new Map<string, string>();
   for(const rep of specialistReports as RecordData[]){
    const srcId = rep.finalReport?.sourceMessageId ?? rep.finalReport?.actualDiscordMessageId ?? rep.sourceMessageId;
    if(rep.specialist && srcId) reportMap.set(srcId, rep.specialist);
    for(const fu of (rep.followupResponses as RecordData[] ?? [])){
     const fuId = fu.sourceMessageId ?? fu.actualDiscordMessageId ?? fu.id;
     if(rep.specialist && fuId) reportMap.set(fuId, rep.specialist);
    }
   }
   for(const msg of (e.coordinationMessages as RecordData[] ?? [])){
    if(msg.id) messages.set(msg.id, msg);
   }
   for(const c of contributors)for(const id of c.sourceMessageIds){
    const match = reportMap.get(id) === c.specialist || messages.get(id)?.sender_name === c.specialist;
    if(!match)reject('Specialist source message is missing or its sender label disagrees.');
   }
  }
 }
 return {rawProposal,rawEvidence,rawSummary,normalization:{format:normalized.format,binding:normalized.binding,extensions:'extensions' in normalized?normalized.extensions:null,warnings:normalized.warnings},proposal:p,evidence:e,summary,original,evidenceRaw,proposalFingerprint:hash(canonical(p)),fingerprint:hash(canonical({proposal:p,evidence:e,summary,...(normalized.binding?{originals:{proposal:hash(rawProposal),evidence:rawEvidence?hash(rawEvidence):null,summary:rawSummary?hash(rawSummary):null}}:{})})),warnings:[...normalized.warnings,'Human-mediated import; agent identity is not cryptographically authenticated.','Review only: no approval, financial project or spending authority is created.',...(p.project.agreedRevenueCents===null?['Revenue is proposed estimate only; client agreed revenue is unconfirmed.']:[]),...(!e?['Specialist evidence was not supplied; source message claims are unverified.']:[])]};
}
export function importBundle(db:Database,bundle:ImportBundle,expectedFingerprint:string) {
 const validated=validateBundle(bundle);
 if(validated.fingerprint!==expectedFingerprint)throw new ImportError(['Files changed after preview; validate again.'],409);
 return db.transaction(()=>{
  const modes=db.prepare('SELECT DISTINCT mode FROM schema_migrations').pluck().all();if(modes.length!==1||!['test','demo'].includes(modes[0] as string))throw new ImportError(['Imports are restricted to local test/demo storage.'],403);
  const previous=db.prepare('SELECT id,bundle_fingerprint FROM proposal_imports WHERE task_id=? AND proposal_fingerprint=?').get(validated.proposal.taskId,validated.proposalFingerprint) as {id:string;bundle_fingerprint:string}|undefined;
  if(previous){if(previous.bundle_fingerprint!==validated.fingerprint)throw new ImportError(['This proposal already exists with different evidence or summary. Existing artifacts cannot be overwritten.'],409);return {id:previous.id,duplicate:true};}
  const revision=(db.prepare('SELECT coalesce(max(revision),0)+1 FROM proposal_imports WHERE task_id=?').pluck().get(validated.proposal.taskId) as number);
  const id=randomUUID();db.prepare("INSERT INTO proposal_imports VALUES (?,?,?,?,?,?,?,?,?,'human_mediated_file_import',0)").run(id,validated.proposal.taskId,revision,validated.proposalFingerprint,validated.fingerprint,validated.original,validated.evidenceRaw,validated.summary,Date.now());
  db.prepare('INSERT INTO proposal_import_originals VALUES (?,?,?,?,?,?,?,?,?)').run(id,validated.rawProposal,validated.rawEvidence,validated.rawSummary,hash(validated.rawProposal),validated.rawEvidence?hash(validated.rawEvidence):null,validated.rawSummary?hash(validated.rawSummary):null,JSON.stringify({...validated.normalization,discordAttachments:validated.normalization.binding?db.prepare('SELECT id,message_id,filename,sha256 FROM discord_attachments WHERE job_id=? ORDER BY filename').all(validated.normalization.binding.processingJobId):[]}),Date.now());
  return {id,duplicate:false};
 }).immediate();
}
