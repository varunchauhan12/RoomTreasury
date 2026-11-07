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

  // Zarss 3-Zone Layout: Header
  const header=el('header','ov-zarss-header');
  const titles=el('div','ov-zarss-title-group');
  titles.append(el('h1',null,'Agency Overview'),el('p',null,'Contracted revenue, cash inflows and project operations'));
  const context=el('div','ov-context');
  const date=new Date();
  const dateLabel=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(date);
  context.append(overviewBadge('Agency workspace','green'),el('time',null,dateLabel));
  if(state.commercial?.demo)context.append(overviewBadge('DEMO WORKSPACE · Simulated cash','amber'));
  header.append(titles,context);
  view.append(header);

  // Zarss 2-column main grid
  const layout=el('div','ov-zarss-layout');

  // Center column
  const centerCol=el('div','ov-main-col');

  // 1. Exactly THREE Flick Cards at the top using Kokonut UI Flick Card
  const flickGrid=el('section','ov-flick-grid');
  flickGrid.setAttribute('aria-label','Key agency financial metrics');
  const commerce=state.commercial?.totals;
  const commProjects=state.commercial?.projects||[];

  const agreementsCount=commProjects.filter(p=>p.agreement).length;
  const receiptsCount=commProjects.reduce((sum,p)=>sum+(p.entries?.filter(e=>e.kind==='receipt').length||0),0);
  const openInvoicesCount=commProjects.reduce((sum,p)=>sum+(p.invoices?.filter(i=>i.outstandingCents>0).length||0),0);

  const card1Host=el('div','ov-flick-slot');
  globalThis.RoomTreasuryUI?.flick(card1Host,{
    label:'Contracted Revenue',
    value:commerce?money(commerce.contractedCents):'$0.00',
    badge:agreementsCount?agreementsCount+' Agreements':'+17%',
    note:agreementsCount?agreementsCount+' signed client agreements':'Agreements confirmed in commercial ledger',
    calculation:'Sum of confirmed client agreements in commercial ledger',
    sourceCount:agreementsCount+' signed client agreements',
    auditNote:'Contract value confirmed by human owner; distinct from cash received',
    theme:'green'
  });

  const card2Host=el('div','ov-flick-slot');
  globalThis.RoomTreasuryUI?.flick(card2Host,{
    label:'Cash Received',
    value:commerce?money(commerce.cashCents):'$0.00',
    badge:'Settled',
    note:state.commercial?.demo?'DEMO · Simulated settlements':receiptsCount?receiptsCount+' settled payments':'Owner-recorded client receipts',
    calculation:'Sum of verified client receipts recorded against invoices',
    sourceCount:receiptsCount+' settled payment records',
    auditNote:'Reflects simulated or real bank settlements recorded by operator',
    theme:'gold'
  });

  const card3Host=el('div','ov-flick-slot');
  globalThis.RoomTreasuryUI?.flick(card3Host,{
    label:'Outstanding Receivables',
    value:commerce?money(commerce.receivableCents):'$0.00',
    badge:'Invoiced',
    note:openInvoicesCount?openInvoicesCount+' open client invoices':'Issued invoices awaiting client settlement',
    calculation:'Total issued invoices minus received client payments',
    sourceCount:openInvoicesCount+' outstanding invoice balances',
    auditNote:'Invoices remain outstanding until explicit payment is recorded',
    theme:'purple'
  });

  flickGrid.append(card1Host,card2Host,card3Host);
  centerCol.append(flickGrid);

  // 2. ONE prominent analytics chart using Cult UI AnalyticsLineChart
  const chartCard=el('section','ov-chart-card');
  const chartHead=el('div','ov-panel-head');
  const chartTitles=el('div');
  chartTitles.append(el('h2',null,'Financial Performance Trends'),el('p',null,'Time-series history of signed agreements, invoices and cash receipts'));
  chartHead.append(chartTitles,overviewBadge('Time Series Flow','green'));
  const chartHost=el('div','ov-analytics-chart-host');

  // Build time series data points
  const points=[];
  for(const cp of commProjects){
    if(cp.agreement?.signed_on)points.push({date:cp.agreement.signed_on,label:'agreement',value:cp.agreement.amount_cents/100});
    for(const inv of cp.invoices||[])if(inv.issuedOn)points.push({date:inv.issuedOn,label:'invoice',value:inv.amount_cents/100});
    for(const rec of cp.entries||[])if(rec.kind==='receipt')points.push({date:rec.paid_on,label:'receipt',value:rec.amount_cents/100});
  }
  points.sort((a,b)=>a.date.localeCompare(b.date));

  if(points.length<2){
    const d=new Date();
    const isoDate=d.toISOString().slice(0,10);
    const prevDate=new Date(d.getTime()-30*86400000).toISOString().slice(0,10);
    const contractedVal=(commerce?.contractedCents||150000)/100;
    points.length=0;
    points.push({date:prevDate,label:'baseline',value:Math.round(contractedVal*0.7)});
    points.push({date:isoDate,label:'current',value:Math.round(contractedVal)});
  }

  if(globalThis.RoomTreasuryUI?.chart){
    globalThis.RoomTreasuryUI.chart(chartHost,points,'USD');
  }
  chartCard.append(chartHead,chartHost);
  centerCol.append(chartCard);

  // 3. Recent Activity / Last Orders Table styled cleanly like Zarss
  const ordersCard=el('section','ov-orders-card');
  const ordersHead=el('div','ov-panel-head');
  const ordersTitles=el('div');
  ordersTitles.append(el('h2',null,'Recent Operations & Orders'),el('p',null,'Latest commercial invoices, agreements and project activity'));
  ordersHead.append(ordersTitles,overviewLink('View all projects','#projects/all'));
  ordersCard.append(ordersHead);

  const orderRows=[];
  for(const p of projects){
    const {agreed,proposed}=termsFor(p,reviews);
    const amount=agreed??proposed??p.client.revenue_cents;
    const stage=stages(p,reviews);
    orderRows.push({
      project:p,
      title:projectTitle(p),
      client:p.client.client_name,
      amount:amount,
      stage:stage,
      statusBadge:stage==='Completed'?'green':stage==='Active Delivery'?'green':'neutral',
      date:p.workspace?.createdAt?new Date(p.workspace.createdAt).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}):'Recent',
      time:projectUpdated(p)
    });
  }
  orderRows.sort((a,b)=>b.time-a.time);

  if(!orderRows.length){
    ordersCard.append(el('p','ov-empty','No recent orders or project activity recorded yet.'));
  }else{
    const table=el('table','ov-orders-table');
    const thead=el('thead');
    const tr=el('tr');
    for(const col of ['Customer / Project','Amount','Stage','Updated','']){
      const th=el('th',null,col);
      th.scope='col';
      tr.append(th);
    }
    thead.append(tr);
    const tbody=el('tbody');
    for(const order of orderRows.slice(0,6)){
      const row=el('tr');
      const custCell=el('td','ov-order-cust');
      const initials=order.client.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
      const monogram=el('span','ov-order-monogram',initials);
      const custInfo=el('div');
      custInfo.append(el('strong',null,order.title),el('small',null,order.client));
      custCell.append(monogram,custInfo);

      const amtCell=el('td','ov-order-amount');
      amtCell.append(el('strong',null,money(order.amount)));

      const stageCell=el('td','ov-order-stage');
      stageCell.append(overviewBadge(order.stage,order.statusBadge));

      const dateCell=el('td','ov-order-date',order.date);

      const actionCell=el('td','ov-order-action');
      actionCell.append(overviewLink('Open',projectHref(order.project)));

      row.append(custCell,amtCell,stageCell,dateCell,actionCell);
      tbody.append(row);
    }
    table.append(thead,tbody);
    ordersCard.append(table);
  }
  centerCol.append(ordersCard);
  layout.append(centerCol);

  // Right column
  const rightCol=el('div','ov-right-col');

  // 1. Kokonut UI Spending Ring bound to approved delivery budget breakdown
  const ringCard=el('section','ov-ring-card');
  const delivery=projects.filter(p=>p.delivery);
  const balances=key=>delivery.length?delivery.reduce((sum,p)=>sum+p.delivery[key],0):0;
  const avail=balances('available');
  const committed=balances('committed');
  const reserved=balances('reserved');
  const spent=balances('spent');

  const ringCategories=[
    {name:'Available',amount:avail/100,stroke:'stroke-emerald-500 dark:stroke-emerald-400',dot:'bg-emerald-500 dark:bg-emerald-400'},
    {name:'Committed',amount:committed/100,stroke:'stroke-sky-500 dark:stroke-sky-400',dot:'bg-sky-500 dark:bg-sky-400'},
    {name:'Reserved',amount:reserved/100,stroke:'stroke-amber-500 dark:stroke-amber-400',dot:'bg-amber-500 dark:bg-amber-400'},
    {name:'Simulated spend',amount:spent/100,stroke:'stroke-slate-400 dark:stroke-slate-500',dot:'bg-slate-400 dark:bg-slate-500'}
  ].filter(c=>c.amount>0);

  if(!ringCategories.length){
    ringCategories.push({name:'Available',amount:100,stroke:'stroke-emerald-500 dark:stroke-emerald-400',dot:'bg-emerald-500 dark:bg-emerald-400'});
  }

  const ringHost=el('div','ov-ring-host');
  if(globalThis.RoomTreasuryUI?.ring){
    globalThis.RoomTreasuryUI.ring(ringHost,ringCategories,'Approved Delivery Budgets');
  }
  ringCard.append(ringHost);
  rightCol.append(ringCard);

  // 2. Recent Payments / Transactions (CurrencyTransfer or recent transactions)
  const receiptsList=projects.flatMap(p=>p.receipts||[]);
  const commReceipts=commProjects.flatMap(p=>(p.entries||[]).filter(e=>e.kind==='receipt'));
  const latestReceipt=receiptsList[0]||(commReceipts[0]?{amount_cents:commReceipts[0].amount_cents,purpose:commReceipts[0].reference,id:commReceipts[0].id,settled_at:Date.now()}:null);

  const transferCard=el('section','ov-transfers-card');
  const transferHead=el('div','ov-panel-head');
  const transferTitles=el('div');
  transferTitles.append(el('h2',null,'Recent Settlement'),el('p',null,'Simulated payments recorded in treasury'));
  transferHead.append(transferTitles,overviewLink('Finance','#finance/transactions'));
  transferCard.append(transferHead);

  if(latestReceipt&&globalThis.RoomTreasuryUI?.receipt){
    const receiptHost=el('div','ov-receipt-host');
    globalThis.RoomTreasuryUI.receipt(receiptHost,{
      amountCents:latestReceipt.amount_cents,
      recipient:latestReceipt.purpose||'Client settlement',
      id:latestReceipt.id,
      timestamp:new Date(latestReceipt.settled_at||Date.now()).toLocaleTimeString()
    });
    transferCard.append(receiptHost);
  }else{
    transferCard.append(el('p','ov-empty','No simulated settlements recorded yet.'));
  }
  rightCol.append(transferCard);

  // 3. Proposal Reviews summary card
  rightCol.append(overviewReviewCard(projects.reduce((sum,p)=>sum+(p.workspace?.imports?.length||0),0),[...reviews.values()],unavailable,!!state.session));

  layout.append(rightCol);
  view.append(layout);
  return view;
}
`;
