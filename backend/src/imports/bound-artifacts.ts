import type { ImportBundle } from './service.js';

export const bindingFields = ['projectId','taskId','processingJobId','correlationId','intakeRevision','intakeSha256'] as const;
export function artifactBinding(value: Record<string, unknown>) {
  return Object.fromEntries(bindingFields.map(key => [key, value[key]]));
}

// A deliberately narrow adapter for the bound coordinator package. Canonical schemas stay unchanged.
export function normalizeBoundArtifacts(bundle: ImportBundle) {
  const p = JSON.parse(bundle.proposal.content);
  const bound = p && typeof p === 'object' && bindingFields.some(k => k !== 'taskId' && k in p);
  if (!bound) return { bundle, binding: null, warnings: [] as string[], format: 'legacy_coordinator' };
  const fail = (): never => { throw Error('Bound coordinator artifacts have missing or contradictory binding metadata.'); };
  if (!bundle.evidence || !bundle.summary) fail();
  const e = JSON.parse(bundle.evidence!.content);
  if (!e || typeof e !== 'object') fail();
  for (const k of bindingFields) if (p[k] === undefined || p[k] !== e[k]) fail();
  if (typeof p.projectId !== 'string' || typeof p.taskId !== 'string' || typeof p.processingJobId !== 'string'
    || p.correlationId !== 'discord-' + p.processingJobId || !Number.isSafeInteger(p.intakeRevision) || p.intakeRevision < 1
    || typeof p.intakeSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(p.intakeSha256)) fail();
  if (p.project?.id !== p.projectId || p.project?.agreedRevenueCents !== null || e.originalBrief !== p.project?.brief
    || !Array.isArray(e.specialistReports) || !Array.isArray(e.coordinationEvidence)) fail();
  for (const key of ['projectId','taskId','processingJobId','correlationId','intakeSha256']) {
    if (!bundle.summary!.content.includes(p[key])) fail();
  }
  if (!new RegExp('(?:intake\\s+)?revision\\s*[:=]?\\s*`?'+p.intakeRevision+'\\b','i').test(bundle.summary!.content)) fail();
  const extensions:Record<string,unknown>={};
  const retain=(obj:Record<string,any>,key:string,path:string)=>{if(key in obj){extensions[path+'.'+key]=obj[key];delete obj[key];}};
  const binding = artifactBinding(p);
  for (const key of bindingFields) if (key !== 'taskId') delete p[key];
  delete p.project.id;
  // Retained verbatim in original storage; this is non-authoritative scheduling metadata.
  retain(p.project,'estimatedDurationBusinessDays','project');
  if (!Array.isArray(p.statementOfWork?.scope)) fail();
  p.statementOfWork.scope = p.statementOfWork.scope.map((entry: unknown) => {
    if(typeof entry==='string')return entry;
    if(!entry||typeof entry!=='object'||Array.isArray(entry))fail();
    const item=entry as Record<string,unknown>;
    if(typeof item.name!=='string'||!item.name.trim()||!Array.isArray(item.elements)||!item.elements.length||item.elements.some(v=>typeof v!=='string')||(item.acceptance!==undefined&&typeof item.acceptance!=='string'))fail();
    return JSON.stringify(entry);
  });
  for(const key of ['implementationStatus','qualityEvidenceStatus'])retain(p.executionPlan,key,'executionPlan');
  for(const [i,r] of (p.executionPlan.resources??[]).entries()){
    if(r.estimatedEffortHours!==undefined){if(r.estimatedHours!==undefined&&r.estimatedHours!==r.estimatedEffortHours)fail();r.estimatedHours=r.estimatedEffortHours;delete r.estimatedEffortHours;}
    if(r.assignmentStatus!==undefined){if(r.status!==undefined&&r.status!==r.assignmentStatus)fail();r.status=r.assignmentStatus;delete r.assignmentStatus;}
  }
  for(const r of p.riskRegister??[]){if(r.status!==undefined){if(r.evidenceStatus!==undefined&&r.evidenceStatus!==r.status)fail();r.evidenceStatus=r.status;delete r.status;}}
  for(const [i,c] of (p.specialistContributions??[]).entries())retain(c,'decision','specialistContributions.'+i);
  for(const key of ['settledSpendCents','externalExpensesCents','ledgerVerificationStatus'])retain(p.financialSummary,key,'financialSummary');
  if(p.ownerDecisionRecommendation?.decisions!==undefined){
    if(!p.ownerDecisionRecommendation.reason)p.ownerDecisionRecommendation.reason=JSON.stringify(p.ownerDecisionRecommendation.decisions);
    retain(p.ownerDecisionRecommendation,'decisions','ownerDecisionRecommendation');
  }
  const blocker = 'Client agreed revenue is unconfirmed. Authenticated owner verification and exact-revision approval remain required; no spending is authorized.';
  if (p.blockingReviews === undefined) p.blockingReviews = [blocker];
  else if (Array.isArray(p.blockingReviews) && !p.blockingReviews.includes(blocker)) p.blockingReviews.push(blocker);
  if (e.coordinationMessages !== undefined && JSON.stringify(e.coordinationMessages) !== JSON.stringify(e.coordinationEvidence)) fail();
  e.coordinationMessages = e.coordinationEvidence;
  return {
    bundle: { ...bundle, proposal: { ...bundle.proposal, content: JSON.stringify(p) }, evidence: { ...bundle.evidence!, content: JSON.stringify(e) } },
    binding, extensions, format: 'bound_coordinator_v1',
    warnings: ['Bound coordinator v1 normalized; original artifacts and binding metadata are retained separately.',
      'Object-valued scope entries are preserved as JSON strings. Client revenue remains unconfirmed; owner approval is blocked.'],
  };
}
