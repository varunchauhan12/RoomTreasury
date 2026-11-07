// Shared browser helpers; exercised without a browser by the focused UI tests.
export const workspaceModel=String.raw`(()=>{
const states={queued:['Queued','Waiting for the local mock worker.'],dispatching:['Dispatching','The backend is attempting mock dispatch.'],dispatched:['Dispatched','Dispatch was acknowledged; this does not mean analysis is complete.'],running:['Running','The deterministic mock execution is running. No live agents are being contacted.'],collecting:['Collecting','Mock collection stage. No artifact package has been imported.'],validating:['Validating','Mock validation stage. No actual agent results are available.'],needs_attention:['Needs attention','Processing needs human attention.'],failed:['Failed','The job stopped without producing a proposal import.'],cancelled:['Cancelled','Backend processing was cancelled.'],dispatch_uncertain:['Dispatch uncertain','Dispatch outcome is unknown. Do not blindly resend.'],imported:['Imported','Actual manually uploaded results are validated and linked to this project. Owner review is still required; the mock job did not produce these files.']};
const messages={artifact_import_deferred:'Mock execution finished. Artifact import is deferred; no proposal was imported.',mock_dispatch_failed:'Mock dispatch failed. You can explicitly start another attempt.',mock_execution_failed:'The mock execution failed. No proposal was imported.',dispatch_outcome_unknown:'Dispatch outcome is uncertain. Cancel and review the activity before another attempt.',worker_interrupted:'The worker was interrupted. Review the activity before another attempt.',owner_access_revoked:'Owner access was revoked. Contact the local operator.',discord_dispatch_failed:'Discord dispatch was rejected. Review the recorded failure category before retrying.',discord_gateway_error:'Discord Gateway connection error.',discord_timeout:'Discord processing timed out waiting for coordinator response.',discord_missing_attachments:'The collector could not retrieve a complete package. Check for the original attachments before starting another attempt.',attachment_retrieval_failed:'Failed to download proposal attachments from Discord.',artifact_validation_failed:'The agent proposal package failed validation against project requirements.'};
const shouldPoll=job=>!!job&&['queued','dispatching','dispatched','running','collecting','validating'].includes(job.state);
const discordStates={queued:'Waiting for the backend Discord worker.',dispatching:'The backend is attempting Discord dispatch.',dispatched:'Discord acknowledged the intake message; agent analysis is not yet complete.',running:'Correlated Discord agent activity has been observed.',collecting:'Collecting the coordinator and specialist results from Discord.',validating:'Validating the received artifact package against the authoritative project intake.',imported:'Discord artifacts were validated and imported for owner review. No spending has been approved.'};
const dispatchMessages={configuration_invalid:'Discord configuration is invalid. No dispatch was attempted.',authentication_failure:'Discord bot authentication failed.',missing_access:'The bot cannot access the configured guild or channel.',guild_channel_not_found:'Discord could not find the configured guild or channel.',missing_permissions:'The bot lacks a required Discord permission.',invalid_message_payload:'Discord rejected the message payload.',rate_limited:'Discord rate limited dispatch. Review before explicitly retrying.',network_failure:'The Discord connection failed; acceptance is unknown. Do not blindly resend.',unknown_dispatch_outcome:'Discord acceptance or acknowledgement persistence is uncertain. Do not blindly resend.'};
const transportLabel=job=>!job?'PROCESSING TRANSPORT · NOT STARTED':job.transport==='discord'?'DISCORD / SWITCH · AGENT TRANSPORT':'DETERMINISTIC MOCK · NO LIVE AGENTS';
const status=job=>!job?{label:'Not started',description:'Create an analysis job when the brief is ready.'}:{label:states[job.state]?.[0]||'Unknown state',description:dispatchMessages[job.dispatch_diagnostic?.split(';')[0]]||messages[job.error_code]||(job.transport==='discord'?discordStates[job.state]:null)||states[job.state]?.[1]||'Refresh to retrieve the persisted backend state.'};
function retryEligibility(job,submitting=false){
 if(submitting)return {disabled:true,reason:'Submitting an analysis job. Please wait.'};
 if(shouldPoll(job))return {disabled:true,reason:'A processing job is active. Wait for completion before starting another attempt.'};
 if(job?.state==='dispatch_uncertain')return {disabled:true,reason:'Dispatch outcome is uncertain. Review and explicitly resolve it before another attempt.'};
 if(job?.attempt>=3)return {disabled:true,reason:'Three-attempt limit reached for this project intake. Discord and mock share this limit; refreshing does not reset it.'};
 return {disabled:false,reason:''};
}
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function revenue(value){if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter a positive USD price with no more than two decimal places.');const [whole,fraction='']=value.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(cents)||cents<1||cents>1000000000)throw Error('Price must be between $0.01 and $10,000,000.');return cents;}
function intake(fields){
 const clientName=fields.clientName.trim(),name=fields.projectName.trim(),description=fields.description.trim(),requirements=fields.requirements.trim(),deliverables=fields.deliverables.trim();
 if(!clientName||!name||!description||!requirements||!deliverables)throw Error('Enter the client, project name, description, scope and deliverables.');
 const brief=['RoomTreasury project intake','Project name: '+name,'Description: '+description,'Requirements and scope: '+requirements,'Deliverables: '+deliverables,'Desired deadline: '+(fields.deadline||'Not specified'),'Additional notes: '+(fields.notes.trim()||'None supplied')].join('\n');
 if(clientName.length>300||brief.length>4000)throw Error('Keep the complete project brief within 4,000 characters.');
 return {clientName,brief,revenueCents:revenue(fields.price)};
}
function parseBrief(brief){
 if(!brief.startsWith('RoomTreasury project intake\n'))return {name:'Client project',description:brief,requirements:'See original brief',deliverables:'See original brief',deadline:'Not specified',notes:'None supplied'};
 const labels=['Project name','Description','Requirements and scope','Deliverables','Desired deadline','Additional notes'];const fields={};
 for(let i=0;i<labels.length;i++){const start=brief.indexOf('\n'+labels[i]+': '),end=i+1<labels.length?brief.indexOf('\n'+labels[i+1]+': ',start+1):brief.length;if(start>=0)fields[labels[i]]=brief.slice(start+labels[i].length+3,end<0?brief.length:end);}
 return {name:fields['Project name'],description:fields.Description,requirements:fields['Requirements and scope'],deliverables:fields.Deliverables,deadline:fields['Desired deadline'],notes:fields['Additional notes']};
}
async function intakeSession(demo){
 if(typeof document!=='undefined'&&document.querySelector('[data-local-workspace]'))return {ownerId:'local-workspace',demoAccess:true};
 const read=()=>fetch('/v1/owner-auth/session',{cache:'no-store',credentials:'same-origin'});
 let response=await read();
 if(demo&&response.status===401){
  // A same-origin page request renews the shared session through the existing
  // server policy. The onboarding POST still needs the matching CSRF token.
  const page=await fetch('/',{cache:'no-store',credentials:'same-origin',redirect:'error'});
  if(!page.ok)throw Error('Could not renew local demo access (HTTP '+page.status+').');
  response=await read();
 }
 if(!response.ok){
  if(response.status===401)throw Error(demo?'Local demo access could not be established. Open the configured local address and retry.':'Sign in as an owner to continue.');
  throw Error('Could not check project access (HTTP '+response.status+').');
 }
 return response.json();
}
function submission(send,makeKey){let busy=false,key=null,signature=null;return {async run(payload){if(busy)return null;const current=JSON.stringify(payload);if(current!==signature){key=makeKey();signature=current;}busy=true;try{return await send(payload,key);}finally{busy=false;}},get busy(){return busy;}};}
async function importedSnapshot(job,project,read){
 if(job.state!=='imported'||!job.result_import_id||project.workspace.imports.some(item=>item.id===job.result_import_id&&item.jobId===job.id))return null;
 const latest=await read(project.client.id);
 if(latest.client.id!==project.client.id||latest.workspace?.taskId!==project.workspace.taskId||!latest.workspace.imports.some(item=>item.id===job.result_import_id&&item.jobId===job.id))throw Error('The imported result is not yet available for this project.');
 return latest;
}
function poller({read,render,onError,schedule=setTimeout,clear=clearTimeout,pause=()=>false,retryErrors=false}){let stopped=false,timer=null;async function tick(){if(stopped)return;if(pause()){timer=schedule(tick,2000);return;}try{const job=await read();if(stopped)return;render(job);if(shouldPoll(job))timer=schedule(tick,2000);}catch(error){if(!stopped){onError(error);if(retryErrors)timer=schedule(tick,5000);}}}return {start:tick,stop(){stopped=true;if(timer!==null)clear(timer);}};}
function demoSections(project){const detail=parseBrief(project.client.brief);return [
 ['Project overview',{client:project.client.client_name,project:detail.name,originalBrief:project.client.brief,proposedPriceCents:project.client.revenue_cents,deadline:detail.deadline,scope:detail.requirements}],
 ['Requirements analysis',{confirmedRequirements:'None independently verified.',scopeFromOwnerBrief:detail.requirements,exampleClarificationQuestions:['What counts as acceptance?','Which assets and integrations will the client supply?'],acceptanceCriteria:'Unknown until client confirmation.'}],
 ['Risk assessment',{exampleScopeRisk:'Unconfirmed deliverable boundaries may expand scope.',exampleTimelineRisk:'Deadline feasibility has not been assessed.',exampleTechnicalRisk:'Integration requirements are unknown.',exampleCommercialRisk:'Payment terms and client acceptance remain unverified.',missingEvidence:'No specialist evidence package has been imported.'}],
 ['Resources and commitments',{exampleResources:['Research','Design','Development','QA'],capacityAssumptions:'Illustrative only; no capacity has been verified.',existingCommitments:'Not investigated by agents.',unverifiedObligations:'Unknown. See persisted financial records for actual commitments.'}],
 ['Financial analysis',{notice:'Illustrative fixture amounts; not an estimate for this project or an approved spending budget.',exampleEstimatedHours:28,exampleBaseCostCents:60000,exampleContingencyCents:10000,exampleDeliveryBudgetCents:70000,exampleClientPriceCents:100000,exampleProjectedMarginCents:30000,projectAgreedRevenueCents:project.client.revenue_cents,exampleCostBreakdown:[{workstream:'Research',limitCents:10000},{workstream:'Design',limitCents:15000},{workstream:'Development',limitCents:35000},{workstream:'QA',limitCents:10000}],assumptions:'Sample economics are fixed fixture data, unrelated to live agent analysis.',exclusions:'No payments, approval, reservation or spending are created.'}],
 ['Final recommendation',{status:'DEMONSTRATION ONLY',blockers:['Actual proposal and specialist evidence are missing.','Client facts and financial assumptions require verification.'],ownerDecisions:'Import a real package and use the existing exact-revision review workflow.'}]
];}
function proposalSections(record){const p=record.proposal;return [
 ['Project overview',{client:p.client,project:p.project,originalBrief:p.project?.brief,statementOfWork:p.statementOfWork}],
 ['Requirements analysis',{unresolvedQuestions:p.unresolvedQuestions,deliverables:p.statementOfWork?.deliverables,acceptanceCriteria:p.statementOfWork?.acceptanceCriteria,scope:p.statementOfWork?.scope,exclusions:p.statementOfWork?.exclusions}],
 ['Risk assessment',{riskRegister:p.riskRegister,blockingReviews:p.blockingReviews,specialistContactFailures:p.specialistContactFailures}],
 ['Resources and commitments',{executionPlan:p.executionPlan,specialistContributions:p.specialistContributions,notice:'Reported labels and contributions do not authenticate individual agents. Verify facts through owner review.'}],
 ['Financial analysis',{proposal:p.proposal,financialSummary:p.financialSummary,reconciliation:p.reconciliation,notice:'Proposed allocations are limits, not expenses. Agreed revenue is not received cash; projected margin is not final profit.'}],
 ['Final recommendation',{status:p.status,readiness:p.readinessExplanation,recommendation:p.ownerDecisionRecommendation,blockingReviews:p.blockingReviews,unresolvedQuestions:p.unresolvedQuestions,authority:p.authorityStatement}]
];}
globalThis.RoomTreasuryWorkspace=Object.freeze({states,status,transportLabel,shouldPoll,retryEligibility,money,intake,parseBrief,intakeSession,submission,poller,importedSnapshot,demoSections,proposalSections});})();`;
