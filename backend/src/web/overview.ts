// Runs inside the dashboard client so it shares the existing API, DOM and routing helpers.
export const overviewScript = String.raw`
function overviewLink(label, href, className='ov-link'){
  const link=el('a',className,label);
  link.href=href;
  link.append(icon('chevron',14));
  return link;
}

function overviewPanel(title, description){
  const panel=el('section','ov-panel');
  const head=el('div','ov-panel-head');
  const copy=el('div');
  copy.append(el('h2',null,title),el('p',null,description));
  head.append(copy);
  panel.append(head);
  return {panel,head};
}

function overviewBadge(label,tone='neutral'){
  return el('span','ov-badge ov-badge-'+tone,label);
}

const overviewStates={
  queued:'Queued', dispatching:'Dispatching', dispatched:'Dispatched', running:'Running',
  collecting:'Collecting', validating:'Validating', imported:'Imported', failed:'Failed',
  needs_attention:'Needs attention', dispatch_uncertain:'Dispatch uncertain', cancelled:'Cancelled'
};
const activeOverviewJobs=new Set(['queued','dispatching','dispatched','running','collecting','validating']);
const attentionOverviewJobs=new Set(['failed','needs_attention','dispatch_uncertain']);
const reviewReady='ELIGIBLE_FOR_AUTHENTICATED_OWNER_APPROVAL';
const projectHref=project=>project.workspace?'/projects/'+encodeURIComponent(project.client.id):'#projects/'+encodeURIComponent(project.client.id);
const reviewHref=id=>'/proposal-imports?id='+encodeURIComponent(id);
const projectTitle=project=>{
  const name=globalThis.RoomTreasuryWorkspace?.parseBrief(project.client.brief||'').name;
  return name&&name!=='Client project'?name:project.client.client_name;
};

function overviewHalftone(){
  if(globalThis.RoomTreasuryUI){
    const host=el('div','ov-halftone ov-library-halftone');
    host.setAttribute('aria-hidden','true');
    globalThis.RoomTreasuryUI.grid?globalThis.RoomTreasuryUI.grid(host):globalThis.RoomTreasuryUI.halftone(host);
    return host;
  }
  const field=svg('svg',{class:'ov-halftone',viewBox:'0 0 520 215','aria-hidden':'true',preserveAspectRatio:'xMaxYMid slice'});
  for(let y=5;y<215;y+=8)for(let x=4;x<520;x+=8){
    const distance=Math.hypot((x-402)/155,(y-74)/93);
    const wave=(Math.cos(distance*8)+1)/2;
    const fade=Math.max(0,Math.min(1,(x-65)/360))*Math.max(0,1-distance/2.65);
    const radius=fade*(.65+1.8*wave);
    if(radius>.17)field.append(svg('circle',{cx:x,cy:y,r:radius.toFixed(2)}));
  }
  return field;
}

function overviewChart(projects){
  const {panel,head}=overviewPanel('Delivery budget allocation','Approved workstream limits and their current balances.');
  head.append(overviewBadge('Approved budgets','green'));
  const workstreams=new Map();
  const segments=[['Available','available','#079b70'],['Committed','committed','#252a25'],['Reserved','reserved','#8a9180'],['Simulated spend','spent','#c4cbc0']];
  for(const project of projects)for(const allocation of project.allocations||[]){
    const row=workstreams.get(allocation.name)||{limitCents:0,available:0,committed:0,reserved:0,spent:0};
    for(const key of Object.keys(row))row[key]+=allocation[key];
    workstreams.set(allocation.name,row);
  }
  if(!workstreams.size){
    panel.append(el('p','ov-empty','Approved allocations will appear here once a delivery budget is in place.'));
    return panel;
  }
  const largest=Math.max(1,...Array.from(workstreams.values(),row=>row.limitCents));
  const chart=el('div','ov-chart');
  const legend=el('ul','ov-legend');
  segments.forEach(([label],i)=>legend.append(el('li','ov-key ov-key-'+i,label)));
  for(const [name,row] of workstreams){
    const line=el('div','ov-chart-row');
    const title=el('div','ov-chart-label');
    title.append(el('span',null,name),el('strong',null,money(row.limitCents)));
    const description=segments.map(([label,key])=>label+': '+money(row[key])).join(' · ');
    const bar=svg('svg',{viewBox:'0 0 100 8',preserveAspectRatio:'none',role:'img','aria-label':name+'. '+description});
    bar.append(svg('rect',{width:100,height:8,fill:'#eff1ec'}));
    let offset=0;
    for(const [,key,color] of segments){
      const width=100*row[key]/largest;
      if(width>0)bar.append(svg('rect',{x:offset,width,height:8,fill:color}));
      offset+=width;
    }
    const tooltip=el('span','ov-tooltip',description);
    const track=el('div','ov-chart-track');
    track.tabIndex=0;
    track.setAttribute('aria-label',name+'. '+description);
    track.append(bar,tooltip);
    line.append(title,track);
    chart.append(line);
  }
  panel.append(chart,legend);
  return panel;
}

function overviewReviewCard(importCount,reviews,unavailable,signedIn){
  const {panel,head}=overviewPanel('Proposal review readiness','Imported packages and latest owner review statuses.');
  head.append(overviewLink('Reviews','#operations/proposals'));
  const counts=el('div','ov-review-counts');
  const countsData=[
    [importCount,'Imported','neutral'],
    [reviews.filter(r=>r.status===reviewReady).length,'Ready','green'],
    [reviews.filter(r=>r.status==='BLOCKED').length,'Blocked','amber']
  ];
  for(const [count,label,tone] of countsData){
    const row=el('div','ov-review-row');
    row.append(overviewBadge(label,tone),el('strong',null,!signedIn||unavailable&&label!=='Imported'?'—':String(count)));
    counts.append(row);
  }
  const note=!signedIn?'Sign in to see owner-scoped reviews.':unavailable?'Some review statuses could not be loaded.':'Imported packages remain subject to owner review and exact-revision approval.';
  panel.append(counts,el('p','ov-panel-note',note));
  return panel;
}

function overviewProjects(projects,reviews){
  const {panel,head}=overviewPanel('Recent client projects','Client intake, commercial terms and the latest processing state.');
  head.append(overviewBadge(projects.filter(p=>p.client.status==='active').length+' active','green'),overviewLink('View all','#projects/all'));
  if(!projects.length){
    panel.append(el('p','ov-empty','No client projects yet. Create a project to add it to this workspace.'));
    return panel;
  }
  const table=el('table','ov-table');
  const header=el('tr');
  for(const name of ['Project / client','Status','Client revenue','Processing','Workspace']){
    const cell=el('th',null,name);
    cell.scope='col';
    header.append(cell);
  }
  const thead=el('thead');
  thead.append(header);
  const tbody=el('tbody');
  for(const project of projects.slice().reverse().slice(0,6)){
    const client=project.client;
    const job=project.workspace?.latestJob;
    const review=reviews.get(client.id);
    const {agreed,proposed}=termsFor(project,new Map([[project.workspace?.imports?.[0]?.id,review]]));
    const amount=agreed??proposed??client.revenue_cents;
    const row=el('tr');
    const name=el('th','ov-project-name');
    name.scope='row';
    const initials=client.client_name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
    const identity=el('div','ov-project-identity');
    identity.title=client.id;
    const details=el('div');
    details.append(el('strong',null,projectTitle(project)),el('small',null,client.client_name));
    identity.append(el('span','ov-monogram',initials),details);
    name.append(identity);
    row.append(name);
    const processing=job?overviewBadge(overviewStates[job.state]||job.state,attentionOverviewJobs.has(job.state)?'amber':job.state==='imported'?'green':'neutral'):el('span','ov-muted','—');
    const revenue=el('div','ov-project-revenue');
    revenue.append(el('strong',null,money(amount)),el('small',null,agreed!=null?'Agreed':proposed!=null?'Proposed':'Intake amount'));
    for(const [label,child] of [
      ['Status',overviewBadge(client.status,client.status==='active'?'green':'neutral')],
      ['Client revenue',revenue],['Processing',processing],
      ['Workspace',overviewLink('Open',projectHref(project))]
    ]){
      const cell=el('td');
      cell.dataset.label=label;
      cell.append(child);
      row.append(cell);
    }
    tbody.append(row);
  }
  table.append(thead,tbody);
  panel.append(table);
  return panel;
}

function overviewAttention(projects,reviews,signedIn,unavailable){
  const {panel}=overviewPanel('Needs attention','Processing issues and proposal review gates.');
  const list=el('ul','ov-attention');
  const ordered=projects.slice().reverse();
  const add=(project,label,reason,href,action)=>{
    const item=el('li');
    const meta=el('div','ov-attention-meta');
    meta.append(el('strong',null,project.client.client_name),overviewBadge(label,'amber'));
    item.append(meta,el('p',null,reason),overviewLink(action,href));
    list.append(item);
  };
  for(const project of ordered){
    const review=reviews.get(project.client.id);
    const job=project.workspace?.latestJob;
    if(review?.status==='BLOCKED'){
      const terms=review.revision?.proposal?.project;
      const reason=review.blockers?.find(text=>text.startsWith('Client agreed revenue is unconfirmed.'))??review.blockers?.[0]??'Owner review is blocked.';
      const target=terms?.agreedRevenueCents==null&&terms?.proposedRevenueCents!=null?' Proposed revenue: '+money(terms.proposedRevenueCents)+'.':'';
      add(project,'Review blocked',reason+target,reviewHref(project.workspace.imports[0].id),'Open review');
    }
    if(job&&attentionOverviewJobs.has(job.state)){
      const reason=globalThis.RoomTreasuryWorkspace?.status(job).description||overviewStates[job.state];
      add(project,overviewStates[job.state],reason,projectHref(project),'Open workspace');
    }
  }
  panel.append(list.children.length?list:el('p','ov-empty',!signedIn?'Sign in to see processing and review gates.':unavailable?'Some review gates could not be loaded.':'No processing issues or blocked reviews are recorded.'));
  return panel;
}

function overviewActivity(projects,signedIn){
  const {panel,head}=overviewPanel('Recent activity','Latest processing updates, imports and financial events.');
  const active=projects.filter(p=>activeOverviewJobs.has(p.workspace?.latestJob?.state)).length;
  if(signedIn)head.append(overviewBadge(active+' processing',active?'green':'neutral'));
  const events=[];
  for(const project of projects){
    const job=project.workspace?.latestJob;
    if(job)events.push({label:'Processing · '+(overviewStates[job.state]||job.state),time:job.updated_at,project,href:projectHref(project)+'#pw-analysis'});
    for(const item of project.workspace?.imports||[])events.push({label:'Proposal imported · revision '+item.revision,time:item.importedAt,project,href:'#operations/proposals/'+encodeURIComponent(item.id)});
    for(const event of project.history||[])events.push({label:event.action.replaceAll('_',' '),time:event.occurred_at,project});
  }
  const list=el('ol','ov-timeline');
  for(const event of events.sort((a,b)=>b.time-a.time).slice(0,6)){
    const date=new Date(event.time);
    const item=el('li');
    const copy=el('div');
    copy.append(el('strong',null,event.label),overviewLink(event.project.client.client_name,event.href||projectHref(event.project)));
    const timestamp=el('time',null,new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(date));
    timestamp.dateTime=date.toISOString();
    item.append(copy,timestamp);
    list.append(item);
  }
  panel.append(list.children.length?list:el('p','ov-empty','Recorded project activity will appear here.'));
  return panel;
}

function overviewMilestones(projects){
  const {panel,head}=overviewPanel('Upcoming milestones','Upcoming deadlines from recorded project briefs.');
  head.append(overviewLink('Projects','#projects/board'));
  const today=new Date();today.setHours(0,0,0,0);
  const due=projects.map(p=>({p,date:deadline(p)})).filter(item=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&new Date(item.date+'T00:00:00')>=today)
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
  if(!due.length)panel.append(el('p','ov-empty','No upcoming project deadlines are recorded.'));
  else{
    const timeline=el('ol','ov-timeline');
    for(const item of due){
      const entry=el('li'),date=el('time',null,new Date(item.date+'T00:00:00').toLocaleDateString(undefined,{dateStyle:'medium'}));
      date.dateTime=item.date;entry.append(overviewLink(projectTitle(item.p),projectHref(item.p)),date);timeline.append(entry);
    }
    panel.append(timeline);
  }
  return panel;
}

async function renderOverviewView(){
  const projects=state.projects;
  const latest=projects.filter(p=>p.workspace?.imports?.length);
  const reviewResults=await Promise.allSettled(latest.map(project=>api('/v1/proposal-imports/'+encodeURIComponent(project.workspace.imports[0].id)+'/review')));
  const reviews=new Map();
  let unavailable=false;
  reviewResults.forEach((result,index)=>{
    const project=latest[index];
    if(result.status==='fulfilled'&&result.value.projectLink?.projectId===project.client.id)reviews.set(project.client.id,result.value);
    else unavailable=true;
  });
  const view=el('div','ov-view');
  const hero=el('header','ov-hero');
  const copy=el('div','ov-hero-copy');
  const date=new Date();
  const dateLabel=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date);
  const context=el('div','ov-context');
  const day=el('time',null,dateLabel);
  day.dateTime=date.toISOString();
  context.append(overviewBadge('Agency workspace','green'),day);
  if(projects.some(p=>p.delivery&&p.client.client_name.includes('[SYNTHETIC DEMO]')))context.append(overviewBadge('Totals include synthetic demo data','amber'));
  copy.append(context,el('h1',null,'Agency Overview'),el('p',null,'Track delivery budgets, client projects and the decisions that need your attention.'));
  const actions=el('div','ov-actions');
  const newProject=el('a','rt-btn rt-btn-primary','New Project');
  newProject.href='/projects/new';
  newProject.prepend(icon('plus',16));
  const refresh=el('button','rt-btn rt-btn-secondary','Refresh');
  refresh.type='button';
  refresh.prepend(icon('refresh',15));
  const status=el('p','ov-refresh-status');
  status.setAttribute('role','status');
  refresh.addEventListener('click',async()=>{
    refresh.disabled=true;
    status.textContent='Refreshing workspace…';
    try{
      await loadDashboardData();
      if(refresh.isConnected)await renderRoute();
    }catch{
      status.textContent='Refresh failed. Showing the previously loaded records.';
      refresh.disabled=false;
    }
  });
  actions.append(refresh,newProject);
  hero.append(overviewHalftone(),copy,actions,status);
  view.append(hero);

  const delivery=projects.filter(p=>p.delivery);
  const balances=key=>delivery.length?delivery.reduce((sum,p)=>sum+p.delivery[key],0):null;
  const ready=[...reviews.values()].filter(r=>r.status===reviewReady).length;
  const commerce=state.commercial?.totals;
  const metrics=[
    ['Contracted revenue',commerce?money(commerce.contractedCents):'Sign in to view','Signed agreements','briefcase'],
    ['Cash received',commerce?money(commerce.cashCents):'Sign in to view',state.commercial?.demo?'DEMO · Synthetic receipts':'Owner-recorded receipts','wallet'],
    ['Outstanding receivables',commerce?money(commerce.receivableCents):'Sign in to view','Unpaid issued invoices','file'],
    ['Proposals awaiting response',commerce?String(state.commercial.projects.filter(p=>p.stage==='submitted').length):'—','Submitted client proposals','folder'],
    ['Revisions requested',commerce?String(state.commercial.projects.filter(p=>p.stage==='revision_requested').length):'—','Recorded client feedback','history'],
    ['Available Spending Capacity',money(balances('available')),'Remaining across approved delivery budgets','wallet'],
    ['Committed Obligations',money(balances('committed')),'Confirmed obligations against delivery budgets','folder'],
    ['Pending Approvals',state.session&&!unavailable?String(ready):'—','Latest proposals eligible for owner decision','shield']
  ];
  const grid=el('section','ov-metrics');
  grid.setAttribute('aria-label','Key financial and review metrics');
  for(const [label,value,note,symbol] of metrics){
    const card=el('article','ov-metric');
    const top=el('div','ov-metric-head');
    const glyph=el('span','ov-metric-icon');
    glyph.append(icon(symbol,17));
    top.append(el('h2',null,label),glyph);
    card.append(top,el('strong','ov-metric-value',value),el('p',null,note));
    grid.append(card);
  }
  const analytics=el('div','ov-grid');
  analytics.append(overviewChart(projects),overviewReviewCard(projects.reduce((sum,p)=>sum+(p.workspace?.imports?.length||0),0),[...reviews.values()],unavailable,!!state.session));
  const lower=el('div','ov-grid');
  lower.append(overviewProjects(projects,reviews),overviewAttention(projects,reviews,!!state.session,unavailable));
  const activity=el('div','ov-grid');activity.append(overviewActivity(projects,!!state.session),overviewMilestones(projects));
  if(state.commercial?.demo)context.append(overviewBadge('DEMO WORKSPACE · No real cash','amber'));
  view.append(grid,commercialOverview(),analytics,lower,activity);
  return view;
}
`;
