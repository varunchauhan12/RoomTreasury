export const workspacePanelsScript=String.raw`
const human=value=>String(value??'').replaceAll('_',' ').replaceAll('-',' ').replace(/^./,c=>c.toUpperCase());
const when=value=>value==null?'Not recorded':new Date(value).toLocaleString();
const tagged=(tag,cls,text)=>{const node=el(tag,text);node.className=cls;return node;};
function badge(state,label=human(state)){const node=tagged('span','pw-status',label);node.dataset.state=state;return node;}
const empty=text=>tagged('p','pw-empty',text);
let approvalSnapshot=null,commercialSnapshot=null,latestRecord=null;
const jobHistory=new Map();
const jobEvents=new Map();
function setWorkspaceApprovals(state){approvalSnapshot=state;renderOverview();renderTimeline();}
function setWorkspaceCommercial(state){commercialSnapshot=state;renderOverview();renderTimeline();}
function renderOverview(){
 if(!project)return;
 const progress=$('pw-progress');progress.replaceChildren();
 const approved=approvalSnapshot?.gates.filter(gate=>gate.status==='approved').length;
 const currentImport=project.workspace?.imports[0];
 const approval=approvalSnapshot?.gates.find(gate=>gate.status!=='approved');
 const deliverables=latestRecord?.proposal.statementOfWork?.deliverables;
 for(const [label,value] of [['Overall',human(commercialSnapshot?.stage??project.client.status)],
  ['AI analysis',M.status(currentJob).label],['Proposal',currentImport?'Revision '+currentImport.revision+' · '+human(currentImport.status):'No package imported'],
  ['Approval progress',approved==null?'No decisions available':approved+' of '+approvalSnapshot.gates.length+' approved'],
  ['Next approval',approval?approvalName[approval.id]+' · '+human(approval.status):approved==null?'Not available':'All gates approved'],
  ['Deliverables',deliverables?.length?deliverables.length+' proposed · progress not tracked':'No tracked deliverables']])detail(progress,label,value);
 const docs=$('pw-overview-docs');docs.replaceChildren();
 if(!currentImport){docs.append(empty('No proposal package has been imported for this project.'));return;}
 docs.append(el('p','Revision '+currentImport.revision+' · '+when(currentImport.importedAt)),link('Review the package →','#pw-results'));
 if(latestRecord?.proposal.readinessExplanation)docs.append(tagged('p','pw-prose',latestRecord.proposal.readinessExplanation));
}
const approvalName={intake:'Intake Authorization',proposal:'AI Proposal Review',commercial:'Commercial Approval',financial:'Financial & Delivery Approval',activation:'Final Activation'};
function renderTimeline(){
 if(!project)return;
 const entries=[];
 const add=(at,title,source,state)=>{if(at!=null)entries.push({at,title,source,state});};
 if(project.workspace?.bindingSource==='owner_onboarding')add(project.workspace.createdAt,'Project created','Project onboarding');
 else if(project.workspace?.createdAt)add(project.workspace.createdAt,'Project linked to an analysis task','Project binding');
 for(const event of jobEvents.values())add(event.occurred_at,human(event.event_key),event.actor_kind==='owner'?'Recorded workspace decision · '+event.actor_id:human(event.actor_kind),human(event.to_state));
 for(const record of project.workspace?.imports??[])add(record.importedAt,'Proposal revision '+record.revision+' imported','Proposal import','Ready for review');
 for(const decision of approvalSnapshot?.decisions??[])add(decision.created_at,approvalName[decision.gate],decision.owner_id?'Recorded reviewer · '+decision.owner_id:'Approval workflow',human(decision.decision));
 for(const event of commercialSnapshot?.events??[])add(event.occurred_at,human(event.action),event.owner_id?'Recorded reviewer · '+event.owner_id:'Commercial');
 for(const event of project.history)add(event.occurred_at,human(event.action),event.actor_id?'Delivery finances · '+event.actor_id:'Delivery finances');
 entries.sort((a,b)=>b.at-a.at);
 for(const [id,items] of [['pw-recent',entries.slice(0,4)],['pw-timeline',entries]]){
  const host=$(id);host.replaceChildren();
  if(!items.length){host.append(el('li','No recorded project activity yet.'));continue;}
  for(const item of items){
   const node=el('li');node.append(el('strong',item.title));
   const metadata=tagged('div','pw-meta',when(item.at)+' · '+item.source+(item.state?' · '+item.state:''));
   node.append(metadata);host.append(node);
  }
 }
}
async function loadAttemptEvents(){
 const base='/v1/processing-jobs/';
 await Promise.all([...jobHistory.values()].filter(job=>job.id!==currentJob?.id).map(async job=>{
  try{
   let after=0;
   for(;;){
    const data=await api(base+encodeURIComponent(job.id)+'/events?after='+after+'&limit=100',undefined,undefined,true);
    for(const event of data.events)jobEvents.set(event.id,{...event,jobId:job.id});
    if(data.events.length<100)break;
    after=data.events.at(-1).id;
   }
  }catch{/* Latest job and other records remain available. */}
 }));
 renderTimeline();
}
const agents=[
 ['make-proposal-agent','Make Proposal Agent','Coordinator'],
 ['req-agent','Request Agent','Requirements and scope'],
 ['challenge-agent','Challenge Agent','Risk and policy'],
 ['commitment-intelligence-agent','Commitment Intelligence Agent','Obligations and evidence'],
 ['treasury-ops-agent','Treasury Ops Agent','Cost and delivery estimates']
];
function renderAgents(messages){
 const host=$('pw-agents');host.replaceChildren();
 for(const [id,name,role] of agents){
  const observed=messages.filter(message=>message.agent_name===id);
  const last=observed.at(-1);
  const completed=id==='make-proposal-agent'&&observed.some(message=>message.completionMarker);
  const card=tagged('article','pw-agent');card.append(el('h4',name),tagged('p','pw-subtle',role),
   badge(completed?'complete':last?'observed':'pending',completed?'Result marker captured':last?'Activity captured':'No activity captured'),
   tagged('p','pw-meta',last?when(last.occurred_at)+' · '+last.author_username:'No message for this attempt'));
  if(last?.content)card.append(tagged('p','pw-message-text',last.content.length>140?last.content.slice(0,140)+'…':last.content));
  if(last&&!completed)card.append(tagged('p','pw-meta','Completion not independently recorded'));
  host.append(card);
 }
}
const capture={jobId:null,next:null,messages:[],version:0,signature:'',jobState:null};
let attemptsLoading=false,workspacePanelsReady=false,selectedDiscordAttempt=null;
async function refreshAttempts(){
 if(!project?.workspace||attemptsLoading)return;
 attemptsLoading=true;
 const select=$('pw-discord-attempt');
 try{
  const {jobs}=await api('/v1/client-projects/'+encodeURIComponent(project.client.id)+'/processing-jobs',undefined,undefined,true);
  for(const job of jobs)jobHistory.set(job.id,job);
  const discord=jobs.filter(job=>job.transport==='discord').sort((a,b)=>b.attempt-a.attempt);
  const previous=selectedDiscordAttempt;
  const signature=JSON.stringify(discord.map(job=>[job.id,job.state]));
  if(signature!==capture.signature){
   capture.signature=signature;
   select.replaceChildren(...discord.map(job=>{
    const option=el('option','Attempt '+job.attempt+' · '+M.status(job).label);option.value=job.id;return option;
   }));
   if(discord.some(job=>job.id===previous))select.value=previous;
  }
  select.disabled=!discord.length;$('pw-discord-refresh').disabled=!discord.length;
  const jobState=jobHistory.get(select.value)?.state??null;
  if(select.value!==capture.jobId||jobState!==capture.jobState){capture.jobState=jobState;await loadCapture();}
 }catch(error){$('pw-discord-status').textContent='Unable to read attempts. '+error.message;}
 finally{attemptsLoading=false;}
}
const attachmentPath=(id,file)=>'/v1/processing-jobs/'+encodeURIComponent(id)+'/discord-attachments/'+encodeURIComponent(file);
function renderCapture(data){
 const messages=capture.messages,feed=$('pw-discord-messages');feed.replaceChildren();
 renderAgents(messages);
 const channel=$('pw-discord-channel');
 channel.hidden=!data.channel?.id;
 if(!channel.hidden)channel.href='https://discord.com/channels/'+encodeURIComponent(data.channel.guildId||'@me')+'/'+encodeURIComponent(data.channel.id);
 $('pw-discord-status').textContent=(data.channel?.id?'Channel '+data.channel.id+' · ':'')+
  (data.lastCapturedAt?'Last captured '+when(data.lastCapturedAt):'No captured messages yet.');
 const discordCount=$('pw-discord-count');if(discordCount)discordCount.textContent=messages.length?messages.length+' captured message'+(messages.length===1?'':'s'):'';
 for(const message of messages){
  const article=tagged('article','pw-message');article.dataset.role=message.agent_role;
  const heading=tagged('div','pw-row');heading.append(el('strong',message.author_username),badge(message.agent_role),tagged('time','pw-meta',when(message.occurred_at)));
  article.append(heading);
  if(message.content)article.append(tagged('p','pw-message-text',message.content));
  if(message.completionMarker)article.append(badge('complete','Result marker captured'));
  for(const file of message.attachments){
   const row=tagged('div','pw-list-row');row.append(el('span',file.filename+' · '+file.byte_size.toLocaleString()+' bytes'),
    link('Download',attachmentPath(data.jobId,file.id)));article.append(row);
  }
  feed.append(article);
 }
 $('pw-discord-earlier').hidden=!capture.next;
}
async function loadCapture(earlier=false){
 const id=$('pw-discord-attempt').value,version=++capture.version;
 const same=id===capture.jobId;
 capture.jobId=id;
 if(!same){capture.next=null;capture.messages=[];renderCapture({});}
 if(!id){
  $('pw-discord-status').textContent='No Discord attempts have been recorded.';
  return;
 }
 try{
  const data=await api('/v1/processing-jobs/'+encodeURIComponent(id)+'/discord-messages?limit=50'+(earlier&&capture.next?'&before='+encodeURIComponent(capture.next):''),undefined,undefined,true);
  if(version!==capture.version)return;
  capture.next=data.nextBefore;
  capture.messages=earlier?[...new Map([...data.messages,...capture.messages].map(message=>[message.id,message])).values()]:data.messages;
  renderCapture(data);
  if(currentJob?.id===id){
   const files=data.messages.flatMap(message=>message.attachments.map(file=>({...file,occurred_at:message.occurred_at})));
   renderCapturedArtifacts(files,id);
  }
 }catch(error){if(version===capture.version)$('pw-discord-status').textContent='Capture unavailable. '+error.message;}
}
function wireWorkspacePanels(){
 workspacePanelsReady=true;renderAgents([]);
 $('pw-discord-status').textContent='No Discord attempts have been recorded.';
 if(!project.workspace){$('pw-discord-refresh').disabled=true;$('pw-discord-attempt').disabled=true;return;}
 $('pw-discord-attempt').addEventListener('change',event=>{selectedDiscordAttempt=event.target.value;void loadCapture();});
 $('pw-discord-refresh').addEventListener('click',async()=>{await refreshAttempts();await loadCapture();});
 $('pw-discord-earlier').addEventListener('click',()=>void loadCapture(true));
 const refresh=async()=>{
  if(document.hidden||$('pw-analysis').hidden)return;
  await refreshAttempts();
  if(M.shouldPoll(jobHistory.get(capture.jobId)))await loadCapture();
 };
 const timer=setInterval(()=>void refresh(),6000);
 addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);});
 void refreshAttempts().then(loadAttemptEvents);
}
function markdownText(tag,text){
 const node=el(tag);
 const tokens=/\*\*([^*]+)\*\*|\x60([^\x60]+)\x60|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
 let offset=0;
 for(const match of text.matchAll(tokens)){
  node.append(document.createTextNode(text.slice(offset,match.index)));
  if(match[1])node.append(el('strong',match[1]));
  else if(match[2])node.append(el('code',match[2]));
  else{
   const anchor=link(match[3],match[4]);anchor.target='_blank';anchor.rel='noopener noreferrer';node.append(anchor);
  }
  offset=match.index+match[0].length;
 }
 node.append(document.createTextNode(text.slice(offset)));return node;
}
function fileViewer(markdown){
 const root=tagged('div','pw-markdown');
 let list=null,code=null,paragraph=[];
 const flush=()=>{if(paragraph.length){root.append(markdownText('p',paragraph.join(' ')));paragraph=[];}list=null;};
 for(const line of markdown.split(/\r?\n/)){
  if(/^\s*\x60{3}/.test(line)){
   flush();
   if(code){root.append(tagged('pre','pw-code',code.join('\n')));code=null;}
   else code=[];
   continue;
  }
  if(code){code.push(line);continue;}
  const heading=line.match(/^\s*(#{1,6})\s+(.+)$/);
  const item=line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
  if(heading){flush();root.append(markdownText('h'+Math.min(6,3+heading[1].length),heading[2]));}
  else if(item){
   const tag=item[2]?'OL':'UL';
   if(list?.tagName!==tag){flush();list=el(tag.toLowerCase());root.append(list);}
   list.append(markdownText('li',item[3]));
  }else if(/^>\s?/.test(line)){flush();root.append(markdownText('blockquote',line.replace(/^>\s?/,'')));}
  else if(!line.trim())flush();
  else{list=null;paragraph.push(line.trim());}
 }
 flush();if(code)root.append(tagged('pre','pw-code',code.join('\n')));
 return root;
}
const packageFiles=[['proposal','proposal.json','JSON'],['evidence','evidence.json','JSON'],['summary','summary.md','Markdown']];
let artifactSignature='',previewVersion=0;
let capturedArtifacts=[];
function renderCapturedArtifacts(files,jobId){
 if(currentJob?.id!==jobId||selectedImport)return;
 const unique=new Map(capturedArtifacts.filter(file=>file.jobId===jobId).map(file=>[file.id,file]));
 for(const file of files)unique.set(file.id,{...file,jobId});
 capturedArtifacts=[...unique.values()];renderArtifacts(null);
}
function renderArtifacts(record){
 const files=capturedArtifacts.filter(file=>file.jobId===currentJob?.id);
 const signature=record?.id??JSON.stringify(files);
 if(signature===artifactSignature)return;
 artifactSignature=signature;++previewVersion;
 const host=$('pw-artifacts'),preview=$('pw-artifact-preview');
 host.replaceChildren();preview.replaceChildren();preview.hidden=true;
 for(const [key,name,type] of packageFiles){
  const value=record?.[key];
  const file=record?null:files.find(file=>file.filename.toLowerCase().endsWith(name));
  const available=value!=null||!!file;
  const row=tagged('div','pw-artifact-row'),description=tagged('div','pw-artifact-file');
  description.append(tagged('span','pw-file-icon',key==='summary'?'MD':'{ }'),el('strong',file?.filename??name),tagged('span','pw-meta',type+(available?'':' · Awaiting file')));
  row.append(description);host.append(row);
  if(!available)continue;
  const url=record?'/v1/proposal-imports/'+encodeURIComponent(record.id)+'/artifacts/'+key:attachmentPath(file.jobId,file.id);
  const open=el('button','Preview');open.type='button';open.setAttribute('aria-label','Preview '+name);
  const download=link('Download',url);download.download=file?.filename??name;
  const actions=tagged('div','pw-artifact-actions');actions.append(open,download);row.append(actions);
  if(record?.normalization?.hashes?.[key]){const original=link('Original','/v1/proposal-imports/'+encodeURIComponent(record.id)+'/original-artifacts/'+key);original.download=name;actions.append(original);}
  open.onclick=async()=>{
   const version=++previewVersion;
   preview.hidden=false;preview.className='pw-viewer';preview.replaceChildren(el('h4',file?.filename??name),el('p','Loading preview…'));
   try{
    let raw;
    if(record)raw=key==='summary'?value:JSON.stringify(value,null,2);
    else{
     const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('Attachment unavailable.');
     raw=await response.text();
    }
    if(version!==previewVersion)return;
    let output=raw,invalid=false;
    if(key!=='summary'){try{output=JSON.stringify(JSON.parse(raw),null,2);}catch{invalid=true;}}
    const view=key==='summary'?fileViewer(raw):tagged('pre','pw-code',output);
    const copy=el('button','Copy');copy.type='button';copy.hidden=!navigator.clipboard;
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(output);copy.textContent='Copied';}catch{copy.textContent='Copy unavailable';}};
    const close=el('button','Close');close.type='button';close.onclick=()=>{preview.hidden=true;open.focus();};
    const toolbar=tagged('div','pw-row');toolbar.append(el('h4',file?.filename??name),copy,close);
    preview.replaceChildren(toolbar);
    if(invalid)preview.append(empty('This file is not valid JSON. Raw text is shown below.'));
    preview.append(view);
   }catch(error){if(version===previewVersion)preview.replaceChildren(el('p',error.message));}
  };
 }
}
function renderScope(record){
 const work=record?.proposal.statementOfWork;
 const deliverables=$('pw-deliverables'),milestones=$('pw-milestones');
 deliverables.replaceChildren();milestones.replaceChildren();
 if(!work?.deliverables?.length)deliverables.append(empty('No structured deliverables are available. Any requested deliverables are shown in the intake above.'));
 else for(const item of work.deliverables){
  const row=tagged('div','pw-scope-item');const copy=el('div');
  copy.append(el('strong',item.name),tagged('p','pw-prose',item.description),tagged('span','pw-meta','Proposed · delivery status not recorded'));
  row.append(copy);deliverables.append(row);
 }
 if(!work?.milestones?.length)milestones.append(empty('No project milestones have been recorded.'));
 else for(const item of work.milestones){
  const row=tagged('div','pw-scope-item');const copy=el('div');
  copy.append(el('strong',item.name),el('p',item.completionCriteria),tagged('span','pw-meta','Proposed · '+item.expectedCompletion+' · completion not recorded'));
  row.append(copy);milestones.append(row);
 }
 const scope=$('pw-proposal-scope');scope?.remove();
 if(work?.objective||work?.scope?.length){
  const card=tagged('article','pw-card');card.id='pw-proposal-scope';card.append(el('h3','Proposed scope · revision '+record.revision));
  if(work.objective)card.append(tagged('p','pw-prose',work.objective));
  if(work.scope?.length)card.append(tree(work.scope));$('pw-details').append(card);
 }
}
`;
