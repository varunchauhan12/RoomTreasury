export const discordConsoleScript=String.raw`
async function discordConsole(){
 const panel=el('section','rt-discord');
 if(!state.session){panel.append(el('h2',null,'Private Discord workspace'),el('p',null,'Sign in to see messages for projects you own.'),linkAction('Owner sign-in','/owner-login'));return panel;}
 const controls=el('div','rt-data-controls'),projectSelect=el('select'),jobSelect=el('select'),refresh=el('button','rt-btn rt-btn-secondary','Refresh');
 projectSelect.setAttribute('aria-label','Discord project');jobSelect.setAttribute('aria-label','Discord job');
 const sidebar=el('aside','rt-discord-sidebar'),feed=el('div','rt-discord-feed'),status=el('p','rt-data-muted');status.setAttribute('role','status');
 sidebar.append(el('p','rt-section-kicker','DISCORD CAPTURE'),el('h2',null,'Agency conversation'),el('p','rt-data-muted','Owner-scoped messages collected from Discord. Display names do not authenticate individual agents.'),controls,status);
 controls.append(projectSelect,jobSelect,refresh);panel.append(sidebar,feed);
 const projects=state.projects.filter(p=>p.workspace?.bindingId);
 if(!projects.length){feed.append(el('h3',null,'No owner-bound projects'),el('p',null,'Create a project to begin. External dispatch always requires your confirmation.'));return panel;}
 for(const p of projects){const o=el('option',null,projectTitle(p));o.value=p.client.id;projectSelect.append(o);}
 const query=new URLSearchParams(location.hash.split('?')[1]||'');if(projects.some(p=>p.client.id===query.get('project')))projectSelect.value=query.get('project');
 let reading=false,requestVersion=0,historyCursor=null,jobRecords=[];
 async function loadMessages(){
  if(reading||!jobSelect.value)return;reading=true;refresh.disabled=true;
  const id=jobSelect.value,version=++requestVersion;
  status.textContent='Refreshing captured messages…';
  try{
   const data=await api('/v1/processing-jobs/'+encodeURIComponent(id)+'/discord-messages?limit=100'+(historyCursor?'&before='+encodeURIComponent(historyCursor):''),{headers:{'X-RoomTreasury-Passive':'1'}});
   if(version!==requestVersion||id!==jobSelect.value)return;
   feed.replaceChildren();
   const header=el('div','rt-section-heading');header.append(el('h2',null,'Discord message history'));feed.append(header);
   const channel=data.messages[0]?.channel_id;
   const project=projects.find(p=>p.client.id===projectSelect.value);
   if(channel){const a=linkAction('Open channel in Discord','https://discord.com/channels/'+(data.channel.guildId||'@me')+'/'+encodeURIComponent(channel));a.target='_blank';a.rel='noopener noreferrer';header.append(a);sidebar.querySelector('[data-channel]')?.remove();const c=el('p','rt-data-muted','Server · '+(data.channel.guildId||'not captured')+' · Channel · '+channel);c.dataset.channel='';sidebar.append(c);}
   const selectedJob=jobRecords.find(j=>j.id===id);feed.append(el('p','rt-data-muted','Job '+id+' · '+(project?.workspace?.taskId||'')));if(selectedJob){feed.append(el('p','rt-data-badge','Backend state · '+textStatus(selectedJob.state)+(selectedJob.error_code?' · '+textStatus(selectedJob.error_code):'')));if(['failed','needs_attention','dispatch_uncertain'].includes(selectedJob.state))feed.append(linkAction('Inspect recovery options',projectHref(project)+'#pw-analysis'));}
   sidebar.querySelector('[data-participants]')?.remove();const participants=el('div');participants.dataset.participants='';participants.append(el('h3',null,'Observed participants'));for(const name of new Set(data.messages.map(m=>m.author_username)))participants.append(el('p','rt-data-muted',name));sidebar.append(participants);
   if(data.nextBefore){const earlier=el('button','rt-btn rt-btn-secondary','Earlier messages');earlier.onclick=()=>{historyCursor=data.nextBefore;void loadMessages();};feed.append(earlier);}if(historyCursor){const latest=el('button','rt-btn rt-btn-secondary','Latest messages');latest.onclick=()=>{historyCursor=null;void loadMessages();};feed.append(latest);}
   if(!data.messages.length)feed.append(el('h3',null,'No captured messages yet'),el('p',null,'A configured Discord run must collect messages for this job. This screen never dispatches an agent.'));
   for(const message of data.messages){
    const article=el('article','rt-discord-message');article.dataset.role=message.agent_role;
    const heading=el('div','rt-discord-author');heading.append(el('strong',null,message.author_username),el('span','rt-data-badge',textStatus(message.agent_role)+' · identity unverified'),el('time','rt-data-muted',displayDate(message.occurred_at)));
    article.append(heading,el('p','rt-discord-content',message.content));
    if(message.completionMarker)article.append(el('p','rt-discord-marker','Completion marker observed · backend validation still required'));
    for(const attachment of message.attachments){const card=el('div','rt-discord-attachment');card.append(el('strong',null,attachment.filename),el('small',null,new Intl.NumberFormat().format(attachment.byte_size)+' bytes · captured artifact'),linkAction('Download','/v1/processing-jobs/'+encodeURIComponent(id)+'/discord-attachments/'+encodeURIComponent(attachment.id)));article.append(card);}
    const details=el('details');details.append(el('summary',null,'Message details'),descriptionList([['Message ID',message.id],['Sender ID',message.author_id],['Channel ID',message.channel_id],['Captured',displayDate(message.recorded_at)]]));article.append(details);feed.append(article);
   }
   status.textContent='Read '+new Date().toLocaleTimeString()+' · Last Discord capture '+(data.lastCapturedAt?displayDate(data.lastCapturedAt):'not recorded')+'. Collector history; live channel connection is not verified.';
  }catch(error){status.textContent='Unable to refresh · '+error.message;if(!feed.children.length)feed.append(el('p',null,'Message history is unavailable. Use Refresh to retry.'));}
  finally{reading=false;refresh.disabled=false;}
 }
 async function loadJobs(){
  ++requestVersion;historyCursor=null;jobSelect.replaceChildren();feed.replaceChildren();status.textContent='Loading jobs…';
  try{const data=await api('/v1/client-projects/'+encodeURIComponent(projectSelect.value)+'/processing-jobs',{headers:{'X-RoomTreasury-Passive':'1'}});
   jobRecords=data.jobs;for(const job of data.jobs.filter(j=>j.transport==='discord')){const option=el('option',null,'Attempt '+job.attempt+' · '+textStatus(job.state)+' · '+job.id.slice(0,8));option.value=job.id;jobSelect.append(option);}
   if([...jobSelect.options].some(o=>o.value===query.get('job')))jobSelect.value=query.get('job');
   if(!jobSelect.value){status.textContent='No Discord attempts recorded.';feed.append(el('h3',null,'Ready when you are'),el('p',null,'Open the project workspace to review intake and explicitly start analysis.'),linkAction('Open project','/projects/'+encodeURIComponent(projectSelect.value)));return;}
   await loadMessages();
  }catch(error){status.textContent=error.message;}
 }
 projectSelect.onchange=loadJobs;jobSelect.onchange=()=>{historyCursor=null;void loadMessages();};refresh.onclick=loadMessages;
 await loadJobs();
 const timer=setInterval(()=>{if(!panel.isConnected){clearInterval(timer);return;}if(!document.hidden&&!panel.contains(document.activeElement))void loadMessages();},6000);
 return panel;
}
`;
