import {approvalWorkspaceScript} from './approvals.js';
import {commercialWorkspaceScript} from './commercial.js';
import type {FastifyInstance} from 'fastify';
import {workspaceModel} from './workspace-model.js';
import {themeCss} from './theme.js';

import {projectWorkspaceLayout,workspaceTabs} from './project-workspace-layout.js';
import {projectWorkspaceCss} from './project-workspace.css.js';
import {workspacePanelsScript} from './project-workspace-panels.js';

const workspace=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Project workspace · RoomTreasury</title><link rel="stylesheet" href="/ui/components.css"><link rel="stylesheet" href="/project-workspace.css">
<script defer src="/workspace-model.js"></script><script defer src="/ui/components.js"></script><script defer src="/project-workspace.js"></script></head>
<body class="pw-body"><header class="pw-header"><a class="pw-brand" href="/">RoomTreasury</a><nav aria-label="Main navigation"><a href="/">Overview</a><a href="/#projects/all" aria-current="page">Projects</a></nav></header>
<main class="pw-main">${projectWorkspaceLayout}</main><footer class="pw-footer">Local agency workspace · Agreed revenue is separate from recorded cash.</footer></body></html>`;
export const workspaceCss=themeCss+'\n'+projectWorkspaceCss;
export const workspaceScript=String.raw`(()=>{
const M=RoomTreasuryWorkspace,$=id=>document.getElementById(id),el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
const errors={OWNER_LOGIN_REQUIRED:'Sign in with your operator-provisioned owner account.',BOUND_OWNER_SCOPE_REQUIRED:'This project is not bound to your active owner account. Legacy projects require explicit operator provisioning.',CSRF_REJECTED:'Your session or site address changed. Reload and sign in using the configured local address.',MOCK_MODE_DISABLED:'Mock processing is available only in non-production demo/test mode.',JOB_ALREADY_ACTIVE:'A job is already active. Refresh to see its progress.',JOB_ATTEMPT_LIMIT:'This intake has reached its three-attempt limit.',INVALID_JOB_TRANSITION:'This job can no longer be cancelled.',IDEMPOTENCY_CONFLICT:'This submission changed after a previous request. Review the form and submit again.',INVALID_REQUEST:'Request validation failed. Check request parameters.'};
let session=null,project=null,currentJob=null,watcher=null,eventCursor=0,seenEvents=new Set(),selectedImport=null,uploadBundle=null,uploadPreview=null,uploadVersion=0,jobSubmitting=false;
let intakeGate=null;
async function api(path,body,key,passive=false){const headers={};if(passive)headers['X-RoomTreasury-Passive']='1';if(body!==undefined){headers['Content-Type']='application/json';if(session?.csrfToken)headers['X-CSRF-Token']=session.csrfToken;if(key)headers['Idempotency-Key']=key;}const response=await fetch(path,{cache:'no-store',headers,...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok){const error=Error(errors[data.error?.code]||(data.error?.code==='PROPOSAL_IMPORT_REJECTED'?data.error.message:null)||(data.error?.message&&data.error.message!=='Request rejected.'?data.error.message:null)||('Request could not be completed'+(data.error?.code?' ('+data.error.code+')':'.')));error.status=response.status;throw error;}return data;}
function notice(text,error=false){if(!$('pw-notice'))return;$('pw-notice').textContent=text;$('pw-notice').dataset.error=String(error);}
function link(text,href){const a=el('a',text);a.href=href;return a;}
function detail(parent,name,value){const group=el('div');group.append(el('dt',name),el('dd',value??'Not supplied'));parent.append(group);}
function tree(value,key=''){if(value===null||value===undefined)return tagged('p','pw-prose','Unknown / not supplied');if(typeof value!=='object')return tagged('p','pw-prose',typeof value==='number'&&/Cents$/.test(key)?M.money(value):String(value));if(Array.isArray(value)){if(!value.length)return tagged('p','pw-prose','None supplied');const ul=tagged('ul','pw-field-list');for(const item of value){const li=el('li');li.append(tree(item,key));ul.append(li);}return ul;}const list=tagged('div','pw-field-group');for(const [name,item] of Object.entries(value)){const field=tagged('div','pw-field');field.append(tagged('span','pw-field-label',name.replace(/Cents$/,'').replace(/([a-z])([A-Z])/g,'$1 $2')));const body=tagged('div','pw-field-value');body.append(tree(item,name));field.append(body);list.append(field);}return list;}
function sections(items){const tabs=$('pw-result-tabs'),content=$('pw-result-content');tabs.replaceChildren();content.replaceChildren();items.forEach(([name,value],index)=>{const section=tagged('details','pw-structured-section');if(index===0)section.open=true;const summary=el('summary');summary.append(el('span',name),tagged('span','pw-structured-chevron','\u25be'));section.append(summary,tree(value));content.append(section);const button=el('button',name);button.type='button';button.setAttribute('aria-selected',String(index===0));button.addEventListener('click',()=>{for(const tab of tabs.children)tab.setAttribute('aria-selected','false');button.setAttribute('aria-selected','true');for(const other of content.children)other.open=false;section.open=true;section.scrollIntoView({behavior:'smooth',block:'start'});});tabs.append(button);});}
function renderJob(job){const previous=currentJob;currentJob=job;if(previous?.id!==job?.id||previous?.state!==job?.state){if(workspacePanelsReady)void refreshAttempts();if(!selectedImport)renderArtifacts(null);}renderOverview();const visual=$('pw-processing-visual');if(visual){const active=['queued','dispatching','running','collecting'].includes(job?.state);if(active)globalThis.RoomTreasuryUI?.processing(visual,[{id:job.id,label:M.status(job).label,status:'running',detail:['Persisted backend status · '+job.state]}]);else visual.replaceChildren();}$('pw-transport-label').textContent=M.transportLabel(job);const state=M.status(job);$('pw-state').textContent=state.label;$('pw-state').dataset.state=job?.state||'not-started';$('pw-description').textContent=state.description;$('pw-job-meta').replaceChildren();detail($('pw-job-meta'),'Job ID',job?.id||'No job yet');detail($('pw-job-meta'),'Transport',job?(job.transport==='discord'?'Discord transport · @make-proposal-agent':'Deterministic mock · no live AI'):'Not started');detail($('pw-job-meta'),'Attempt (shared across transports)',job?job.attempt+' of 3':'No attempts yet');detail($('pw-job-meta'),'Submitted',job?new Date(job.created_at).toLocaleString():'—');detail($('pw-job-meta'),'Last activity',job?new Date(job.updated_at).toLocaleString():'—');const retry=M.retryEligibility(job,jobSubmitting);$('pw-start').disabled=retry.disabled||Boolean(project?.workspace&&intakeGate&&intakeGate.status!=='approved');$('pw-start').title=project?.workspace&&intakeGate&&intakeGate.status!=='approved'?'Authorize the project brief before sending it to the agents.':retry.reason;const startLabel=$('pw-start-label');if(startLabel)startLabel.textContent=job?'Send to Agents again':'Send to Agents';else $('pw-start').textContent=job?'Send to Agents again':'Send to Agents';$('pw-cancel').hidden=!job||(!M.shouldPoll(job)&&job.state!=='dispatch_uncertain');$('pw-poll-note').textContent=M.shouldPoll(job)?'Checking persisted backend state every 2 seconds.':retry.reason||'Automatic polling stopped. You may explicitly start another attempt or refresh status.';const s=job?.state;const lifecycle=!job||s==='not-started'?'draft':['queued','dispatching','running','collecting'].includes(s)?'processing':s==='imported'?'review':'ready';if($('pw-workspace'))$('pw-workspace').dataset.lifecycle=lifecycle;if($('pw-section-draft'))$('pw-section-draft').dataset.active=String(lifecycle==='draft');if($('pw-section-results'))$('pw-section-results').dataset.active=String(lifecycle==='processing'||lifecycle==='review');if($('pw-section-review'))$('pw-section-review').dataset.active=String(lifecycle==='review');uploadStatus();}
async function activity(id){let more=true;while(more){const page=await api('/v1/processing-jobs/'+encodeURIComponent(id)+'/events?after='+eventCursor+'&limit=100',undefined,undefined,true);if(currentJob?.id!==id)return;for(const event of page.events){if(seenEvents.has(event.id))continue;seenEvents.add(event.id);jobEvents.set(event.id,{...event,jobId:id});const li=el('li',new Date(event.occurred_at).toLocaleString()+' · '+(event.from_state?(M.states[event.from_state]?.[0]||event.from_state)+' → ':'')+(M.states[event.to_state]?.[0]||event.to_state)+(event.code?' · '+event.code:''));$('pw-events').append(li);}eventCursor=page.nextCursor;more=page.events.length===100;}}
function watch(job){watcher?.stop();renderJob(job);if(!job){$('pw-events').replaceChildren(el('li','No recorded processing events yet.'));return;}eventCursor=0;seenEvents=new Set();$('pw-events').replaceChildren();watcher=M.poller({retryErrors:true,async read(){const result=await api('/v1/processing-jobs/'+encodeURIComponent(job.id),undefined,undefined,true);await activity(job.id);renderTimeline();await syncImportedJob(result.job);return result.job;},render:renderJob,onError:error=>{notice(error.message+' Will retry automatically.',true);$('pw-poll-note').textContent='Reconnecting…';}});void watcher.start();}
async function syncImportedJob(job){
 if(currentJob?.id!==job.id)return;
 const latest=await M.importedSnapshot(job,project,id=>api('/v1/client-projects/'+encodeURIComponent(id),undefined,undefined,true));
 if(!latest||currentJob?.id!==job.id)return;
 project=latest;selectedImport=null;results();renderOverview();renderTimeline();
 if(typeof BroadcastChannel==='function'){
  const channel=new BroadcastChannel('roomtreasury-commercial');
  channel.postMessage({type:'proposal-imported',projectId:latest.client.id});
  channel.close();
 }
 notice('New proposal imported for review.');
}
async function renderImported(id){
 selectedImport=id;
 const host=$('pw-review');host.replaceChildren();
 try{
  const record=await api('/v1/proposal-imports/'+encodeURIComponent(id));
  if(selectedImport!==id)return;
  if(record.taskId!==project.workspace.taskId)throw Error('Imported task does not match this project.');
  $('pw-result-notice').textContent='Actual project-linked import · revision '+record.revision+' · Review only';
  renderArtifacts(record);
  $('pw-structured').hidden=false;
  const presentation=M.proposalSections(record);
  if(record.evidence)presentation.push(['Evidence',record.evidence]);
  sections(presentation);
  if(id===project.workspace.imports[0]?.id){latestRecord=record;renderScope(record);renderOverview();}
 }catch(error){
  if(selectedImport!==id)return;
  selectedImport=null;
  $('pw-result-notice').textContent=error.message;
 }
}
function results(){
 const imports=project.workspace?.imports??[];
 $('pw-import-label').hidden=!imports.length;
 const select=$('pw-imports');
 if(!imports.length){
  $('pw-result-notice').textContent='No proposal package imported for this project.';
  $('pw-structured').hidden=true;
  renderArtifacts(null);
  return;
 }
 const previous=select.value;
 const current=imports.find(item=>item.id===selectedImport)??imports[0];
 select.replaceChildren(...imports.map(item=>{
  const option=el('option','Revision '+item.revision+' · '+human(item.status));option.value=item.id;return option;
 }));
 select.value=current.id;
 if(!selectedImport||previous!==current.id||$('pw-structured').hidden)void renderImported(current.id);
 if(current.id!==imports[0].id&&latestRecord?.id!==imports[0].id){
  const latestId=imports[0].id;
  void api('/v1/proposal-imports/'+encodeURIComponent(latestId)).then(record=>{
   if(project.workspace.imports[0]?.id!==latestId||record.taskId!==project.workspace.taskId)return;
   latestRecord=record;renderScope(record);renderOverview();
  }).catch(()=>{});
 }
}
const projectTabs=${workspaceTabs};
function selectProjectTab(){
 const hash=location.hash.slice(1),target=hash?$(hash):null;
 const selected=hash==='pw-section-results'||hash==='pw-analysis'||hash==='pw-results'?'pw-section-results':
  hash==='pw-section-review'||hash==='pw-approvals'||hash==='pw-commercial'||hash==='pw-activity'||hash.startsWith('invoice-')||hash.startsWith('cash-')?'pw-section-review':'pw-section-draft';
 for(const [id] of projectTabs){
  const panel=$(id);if(panel)panel.hidden=id!==selected;
  const tab=$(id+'-tab');
  if(tab){if(id===selected)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
 }
 const active=$(selected+'-tab'),nav=$('pw-section-nav');
 if(active&&nav){
  const item=active.getBoundingClientRect(),bounds=nav.getBoundingClientRect();
  if(item.left<bounds.left)nav.scrollLeft-=bounds.left-item.left+4;
  else if(item.right>bounds.right)nav.scrollLeft+=item.right-bounds.right+4;
 }
 if(hash==='pw-upload')$('pw-upload').open=true;
 if(workspacePanelsReady)void refreshAttempts();
 if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
}
function projectFinancials(){
 const panel=$('pw-finance-details');panel.replaceChildren();
 if(!project.delivery)panel.append(el('p','No delivery budget has been approved.'));
 else {
  const amounts=el('dl');amounts.className='pw-grid';
  for(const [name,value] of [['Approved delivery budget',project.delivery.budget],
   ['Committed',project.delivery.committed],['Reserved',project.delivery.reserved],['Simulated spending',project.delivery.spent],
   ['Available',project.delivery.available],['Projected gross margin',project.projectedGrossMarginCents]])detail(amounts,name,value==null?null:M.money(value));
  panel.append(amounts);
  for(const a of project.allocations){
   const amounts=el('dl');amounts.className='pw-grid';
   for(const [name,value] of [['Allocation limit',a.limitCents],['Committed',a.committed],['Reserved',a.reserved],['Simulated spending',a.spent],['Available',a.available]])detail(amounts,name,M.money(value));
   panel.append(el('h3',a.name),amounts);
  }
  if(project.receipts.length){const receipts=el('ul');for(const r of project.receipts)receipts.append(el('li',M.money(r.amount_cents)+' · '+r.purpose+' · '+r.id));panel.append(el('h3','Simulated settlement receipts'),receipts);}
 }
}
async function refreshIntakeAuthorization(){
 const button=$('pw-authorize-intake'),note=$('pw-intake-auth-note');
 if(!button||!note||!project?.workspace){if(button)button.hidden=true;if(note)note.textContent='';return;}
 try{
  const state=await api('/v1/client-projects/'+encodeURIComponent(project.client.id)+'/approval-workflow',undefined,undefined,true);
  intakeGate=state.gates.find(gate=>gate.id==='intake')??null;
  const approved=intakeGate?.status==='approved';
  button.hidden=approved;
  button.disabled=!intakeGate?.actions?.includes('approve');
  note.textContent=approved?'Project brief authorized.':intakeGate?.blockers?.length?'Project brief authorization needs attention: '+intakeGate.blockers.join(' '):'Authorize the project brief before sending it to the agents.';
 }catch(error){intakeGate=null;button.hidden=false;button.disabled=true;note.textContent='Could not check project brief authorization. '+error.message;}
 renderJob(currentJob);
}
async function authorizeIntake(){
 const button=$('pw-authorize-intake'),note=$('pw-intake-auth-note');
 if(!intakeGate)await refreshIntakeAuthorization();
 if(!intakeGate?.actions?.includes('approve')){if(note)note.textContent='This project brief cannot be authorized yet.';return;}
 button.disabled=true;note.textContent='Authorizing project brief…';
 try{
  await api('/v1/client-projects/'+encodeURIComponent(project.client.id)+'/approval-workflow/decisions',
   {gate:'intake',subjectHash:intakeGate.subjectHash,decision:'approve',reason:'Owner authorized the project brief from Stage 1.',evidence:['Owner reviewed the project brief in Stage 1'],checks:[...intakeGate.checks]},crypto.randomUUID());
  await refreshIntakeAuthorization();
  notice('Project brief authorized. You can now send it to the agents.');
 }catch(error){note.textContent='Could not authorize the project brief: '+error.message.replaceAll('_',' ');button.disabled=false;}
}
async function loadProject(id,next){
 project=next??await api('/v1/client-projects/'+encodeURIComponent(id));
 const brief=M.parseBrief(project.client.brief);
 const title=brief.name==='Client project'?project.client.client_name+' project':brief.name;
 const state=$('pw-project-status');state.textContent=human(project.client.status);state.dataset.state=project.client.status;
 $('pw-workspace').hidden=false;
 $('pw-title').textContent=title;$('pw-crumb').textContent=title;$('pw-subtitle').textContent=project.client.client_name;
 document.title=title+' · RoomTreasury';
 const facts=$('pw-header-facts');facts.replaceChildren();
 if(project.workspace?.bindingSource==='owner_onboarding')detail(facts,'Created',when(project.workspace.createdAt));
 if(brief.deadline&&brief.deadline!=='Not specified')detail(facts,'Requested deadline',brief.deadline);
 if(!facts.children.length)facts.hidden=true;else facts.hidden=false;
 $('pw-brief').textContent=project.client.brief;
 $('pw-overview-description').textContent=brief.description;
 const intakeSections=[['Description',brief.description],['Requirements & scope',brief.requirements],['Requested deliverables',brief.deliverables],['Additional notes',brief.notes]]
  .map(([label,value])=>{const section=tagged('section','pw-intake-section');section.append(el('h4',label),tagged('p','pw-prose',value??'Not supplied'));return section;});
 $('pw-details').replaceChildren(...intakeSections);
 const overview=$('pw-overview-facts');overview.replaceChildren();
 for(const [label,value] of [['Client',project.client.client_name],['Requested deadline',brief.deadline],['Recorded intake price',M.money(project.client.revenue_cents)],
  ['Approved delivery budget',project.approvedDeliveryBudgetCents==null?'Not approved':M.money(project.approvedDeliveryBudgetCents)]])detail(overview,label,value);
 const bound=!!project.workspace;
 $('pw-analysis-empty').hidden=bound;$('pw-analysis-controls').hidden=!bound;$('pw-open-upload').hidden=!bound;
 if(!bound){
  $('pw-approval-status').textContent='This legacy project has no linked approval workflow.';
  $('pw-commercial-sync').textContent='No linked commercial workflow. Recorded delivery finances are shown below.';
  $('pw-commercial-refresh').hidden=true;
 }
 const job=project.workspace?.latestJob;
 if(!currentJob||job?.id!==currentJob.id||job?.state!==currentJob.state)watch(job);
 const latest=project.workspace?.imports[0];
 const old=latestRecord?.id===latest?.id?latestRecord:null;
 if(!old)latestRecord=null;
 renderScope(old);renderOverview();renderTimeline();results();uploadStatus();projectFinancials();notice('');void refreshIntakeAuthorization();
}
function uploadStatus(){const discordEligible=currentJob?.transport==='discord'&&(currentJob.state==='running'||currentJob.state==='collecting'||(currentJob.state==='needs_attention'&&(currentJob.error_code==='discord_missing_attachments'||currentJob.error_code==='discord_timeout')));const ready=currentJob?.state==='imported'||(currentJob?.state==='needs_attention'&&(currentJob.error_code==='artifact_import_deferred'||currentJob.error_code==='artifact_validation_failed'))||discordEligible;$('pw-preview').disabled=!ready;$('pw-retrieve-discord').hidden=!(currentJob?.transport==='discord'&&currentJob?.state==='needs_attention'&&currentJob.error_code==='discord_missing_attachments');$('pw-upload-context').textContent=ready?'Upload target: job '+currentJob.id+' · intake revision '+currentJob.intake_revision+' · manual artifact upload for this project.':'Start a processing record and wait for completion/attention before uploading. Cancelled, failed and uncertain jobs cannot accept results.';}
function wireUpload(id){
 $('pw-open-upload').addEventListener('click',()=>{$('pw-upload').open=true;$('pw-upload').scrollIntoView({behavior:'smooth',block:'center'});});
 const form=$('pw-upload-form'),message=$('pw-upload-state'),confirm=$('pw-confirm-import');
 $('pw-retrieve-discord').addEventListener('click',async()=>{const button=$('pw-retrieve-discord');button.disabled=true;confirm.disabled=true;try{message.textContent='Retrieving the existing bound Discord delivery. No agents are dispatched…';const result=await api('/v1/client-projects/'+encodeURIComponent(id)+'/proposal-imports/retrieve-discord',{});uploadBundle=result.bundle;uploadPreview=result.preview;uploadVersion++;confirm.disabled=false;message.textContent='Original Discord files retrieved and validated for this exact job. '+result.preview.warnings.join(' ')+' Confirm the review-only import below.';}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
 form.addEventListener('change',()=>{uploadVersion++;uploadBundle=null;uploadPreview=null;confirm.disabled=true;message.textContent='Files changed. Validate all three files again.';});
 form.addEventListener('submit',async event=>{event.preventDefault();$('pw-preview').disabled=true;confirm.disabled=true;uploadBundle=null;uploadPreview=null;const version=++uploadVersion;try{
  const bundle={};for(const [kind,field,max,extension] of [['proposal','pw-proposal-file',262144,'.json'],['evidence','pw-evidence-file',524288,'.json'],['summary','pw-summary-file',65536,'.md']]){const file=$(field).files[0];if(!file)throw Error('All three files are required: proposal.json, evidence.json and summary.md.');if(file.size>max||!file.name.toLowerCase().endsWith(extension))throw Error(kind+': choose a '+extension+' file within the displayed size limit.');bundle[kind]={name:file.name,content:await file.text()};}
  message.textContent='Validating schema, finances and authoritative project/job binding…';
  const preview=await api('/v1/client-projects/'+encodeURIComponent(id)+'/proposal-imports/preview',bundle);
  if(version!==uploadVersion)return;message.dataset.error='false';uploadBundle=bundle;uploadPreview=preview;confirm.disabled=false;message.textContent='Validation passed for job '+preview.jobId+' · intake revision '+preview.intakeRevision+'. '+preview.warnings.join(' ');
 }catch(error){message.textContent='Package not imported: '+error.message;message.dataset.error='true';}finally{uploadStatus();}});
 confirm.addEventListener('click',async()=>{if(!uploadBundle||!uploadPreview)return;confirm.disabled=true;try{
  const result=await api('/v1/client-projects/'+encodeURIComponent(id)+'/proposal-imports/confirm',{...uploadBundle,jobId:uploadPreview.jobId,intakeHash:uploadPreview.intakeHash,fingerprint:uploadPreview.fingerprint});
  message.textContent=result.duplicate?'Identical project-linked import already exists. No records were duplicated.':'Actual package imported for review only. No owner approval or spending authority was created.';message.dataset.error='false';await loadProject(id);
  if(typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('roomtreasury-commercial');channel.postMessage({type:'proposal-imported',projectId:id});channel.close();}
 }catch(error){message.textContent='Package not imported: '+error.message;message.dataset.error='true';confirm.disabled=false;}});
}
async function init(){const demo=!!document.querySelector('.rt-demo-access-banner');try{session=await M.intakeSession(demo);const id=decodeURIComponent(location.pathname.slice('/projects/'.length));await loadProject(id);selectProjectTab();addEventListener('hashchange',selectProjectTab);wireWorkspacePanels();if(!project.workspace)return;commercialWorkspace(id);approvalWorkspace(id);wireUpload(id);if(typeof BroadcastChannel==='function'){const ch=new BroadcastChannel('roomtreasury-commercial');ch.addEventListener('message',async e=>{if(e.data?.projectId===id){try{await loadProject(id);}catch{}}});addEventListener('pagehide',()=>ch.close());}const submitJob=M.submission(async(payload,key)=>api('/v1/client-projects/'+encodeURIComponent(id)+'/processing-jobs',{transport:payload.transport},key),()=>crypto.randomUUID());$('pw-authorize-intake')?.addEventListener('click',()=>void authorizeIntake());$('pw-start').addEventListener('click',async()=>{if(submitJob.busy||M.retryEligibility(currentJob,jobSubmitting).disabled)return;if(!confirm('Start AI analysis? This sends the project intake to the configured Discord coordinator and can activate the existing agents.'))return;jobSubmitting=true;renderJob(currentJob);try{const result=await submitJob.run({transport:'discord',projectId:id,previousJob:currentJob?.id||null});if(result){notice('Discord analysis job queued. Waiting for backend dispatch acknowledgement.');watch(result.job);}}catch(error){notice(error.message,true);renderJob(currentJob);}finally{jobSubmitting=false;renderJob(currentJob);}});$('pw-cancel').addEventListener('click',async()=>{if(!currentJob)return;$('pw-cancel').disabled=true;try{const result=await api('/v1/processing-jobs/'+encodeURIComponent(currentJob.id)+'/cancel',{});watch(result.job);}catch(error){notice(error.message,true);}finally{$('pw-cancel').disabled=false;}});$('pw-refresh').addEventListener('click',async()=>{try{await loadProject(id);}catch(error){notice(error.message,true);}});$('pw-imports').addEventListener('change',()=>void renderImported($('pw-imports').value));}catch(error){notice(error.status===404?'Project not found. Return to Projects to select another workspace.':error.message,true);}}
${workspacePanelsScript}
${commercialWorkspaceScript}
${approvalWorkspaceScript}
addEventListener('pagehide',()=>watcher?.stop());void init();})();`;
export function registerProjectWorkspace(app:FastifyInstance){
 app.get('/projects/new',{schema:{hide:true}},(_request,reply)=>reply.header('Cache-Control','no-store').redirect('/#projects/new'));
 for(const [path,type,body] of [['/projects/:id','text/html',workspace],['/project-workspace.css','text/css',workspaceCss],['/workspace-model.js','text/javascript',workspaceModel],['/project-workspace.js','text/javascript',workspaceScript]]){
  app.get(path!,{schema:{hide:true}},(_request,reply)=>reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'").type(type!+'; charset=utf-8').send(body));
 }
}
