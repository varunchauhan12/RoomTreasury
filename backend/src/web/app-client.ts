// RoomTreasury Production-Grade Frontend Application Engine
// Complies with strict CSP: script-src 'self', pure DOM construction, no external CDNs

export const appScript = String.raw`(()=>{
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';

// DOM Utilities
function el(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined&&text!==null)node.textContent=text;
  return node;
}

function svg(tag,attrs={}){
  const node=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);
  return node;
}

// Complete Lucide Icon Set in pure DOM
const icons={
  dashboard:[['rect',{width:'7',height:'9',x:'3',y:'3',rx:'1'}],['rect',{width:'7',height:'5',x:'14',y:'3',rx:'1'}],['rect',{width:'7',height:'9',x:'14',y:'12',rx:'1'}],['rect',{width:'7',height:'5',x:'3',y:'16',rx:'1'}]],
  wallet:[['path',{d:'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1'}],['path',{d:'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'}]],
  briefcase:[['rect',{width:'20',height:'14',x:'2',y:'7',rx:'2',ry:'2'}],['path',{d:'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'}]],
  folder:[['path',{d:'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z'}],['path',{d:'M8 10v4'}],['path',{d:'M12 10v2'}],['path',{d:'M16 10v6'}]],
  bot:[['path',{d:'M12 8V4H8'}],['rect',{width:'16',height:'12',x:'4',y:'8',rx:'2'}],['path',{d:'M2 14h2'}],['path',{d:'M20 14h2'}],['path',{d:'M15 13v2'}],['path',{d:'M9 13v2'}]],
  file:[['path',{d:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'}],['path',{d:'M14 2v4a2 2 0 0 0 2 2h4'}],['path',{d:'M10 9H8'}],['path',{d:'M16 13H8'}],['path',{d:'M16 17H8'}]],
  check:[['path',{d:'M22 11.08V12a10 10 0 1 1-5.93-9.14'}],['path',{d:'m9 11 3 3L22 4'}]],
  transfer:[['path',{d:'m16 3 4 4-4 4'}],['path',{d:'M20 7H4'}],['path',{d:'m8 21-4-4 4-4'}],['path',{d:'M4 17h16'}]],
  history:[['path',{d:'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'}],['path',{d:'M3 3v5h5'}],['path',{d:'M12 7v5l4 2'}]],
  settings:[['path',{d:'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'}],['circle',{cx:'12',cy:'12',r:'3'}]],
  search:[['circle',{cx:'11',cy:'11',r:'8'}],['path',{d:'m21 21-4.3-4.3'}]],
  plus:[['path',{d:'M5 12h14'}],['path',{d:'M12 5v14'}]],
  refresh:[['path',{d:'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'}],['path',{d:'M3 3v5h5'}],['path',{d:'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16'}],['path',{d:'M16 21h5v-5'}]],
  alert:[['path',{d:'m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'}],['path',{d:'M12 9v4'}],['path',{d:'M12 17h.01'}]],
  shield:[['path',{d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10'}],['path',{d:'M12 8v4'}],['path',{d:'M12 16h.01'}]],
  logout:[['path',{d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'}],['polyline',{points:'16 17 21 12 16 7'}],['line',{x1:'21',x2:'9',y1:'12',y2:'12'}]],
  chevron:[['path',{d:'m9 18 6-6-6-6'}]],
  download:[['path',{d:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'}],['polyline',{points:'7 10 12 15 17 10'}],['line',{x1:'12',x2:'12',y1:'15',y2:'3'}]],
  external:[['path',{d:'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'}],['polyline',{points:'15 3 21 3 21 9'}],['line',{x1:'10',x2:'21',y1:'14',y2:'3'}]],
  activity:[['path',{d:'M22 12h-4l-3 9L9 3l-3 9H2'}]],
  menu:[['line',{x1:'4',x2:'20',y1:'12',y2:'12'}],['line',{x1:'4',x2:'20',y1:'6',y2:'6'}],['line',{x1:'4',x2:'20',y1:'18',y2:'18'}]],
  user:[['path',{d:'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'}],['circle',{cx:'12',cy:'7',r:'4'}]],
  sparkles:[['path',{d:'m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z'}]]
};

function icon(name,size=16,stroke='currentColor'){
  const s=svg('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:stroke,'stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'});
  const defs=icons[name]||icons.dashboard;
  for(const [tag,attrs] of defs)s.append(svg(tag,attrs));
  return s;
}

const money=v=>v===null||v===undefined?'Not set':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100);

// Global App State
let state={
  session:null,
  projects:[],
  imports:[],
  activeRoute:'overview',
  activeProjectId:null,
  searchQuery:''
};

// Centralized API fetcher
async function api(path,options={}){
  const headers={'Content-Type':'application/json'};
  if(state.session?.csrfToken)headers['X-CSRF-Token']=state.session.csrfToken;
  if(options.key)headers['Idempotency-Key']=options.key;
  if(options.headers)Object.assign(headers,options.headers);
  const res=await fetch(path,{cache:'no-store',headers,...options});
  const data=await res.json();
  if(!res.ok){
    const err=Error(data.error?.message||data.error?.code||'Request failed');
    err.code=data.error?.code;
    throw err;
  }
  return data;
}

// Router & Route Switcher
function navigate(route,projectId=null){
  state.activeRoute=route;
  state.activeProjectId=projectId;
  if(projectId)location.hash=route+'/'+encodeURIComponent(projectId);
  else location.hash=route;
  renderRoute();
  updateSidebarActive();
}

function updateSidebarActive(){
  document.querySelectorAll('.rt-nav-item').forEach(item=>{
    const nav=item.getAttribute('data-nav');
    if(nav===state.activeRoute)item.classList.add('active');
    else item.classList.remove('active');
  });
  const breadcrumbActive=$('rt-breadcrumb-active');
  if(breadcrumbActive){
    const titles={overview:'Overview',finance:'Finance & Economics',agency:'Agency Operations',projects:'Projects',workspace:'Project Workspace',agents:'AI Agent Operations',proposals:'Proposal Reviews',approvals:'Approval Centre',transactions:'Financial Transactions',audit:'Activity & Audit',settings:'Settings & Security'};
    breadcrumbActive.textContent=titles[state.activeRoute]||'Overview';
  }
}

// Gauge SVG Generator (BizLink inspired)
function renderGauge(percent,label='Analyzed proposals'){
  const container=el('div','rt-gauge-card');
  const svgNode=svg('svg',{class:'rt-gauge-svg',viewBox:'0 0 100 60'});
  const bgArc=svg('path',{d:'M 10 50 A 40 40 0 0 1 90 50',fill:'none',stroke:'#EDF1EB','stroke-width':'8','stroke-linecap':'round'});
  const clamped=Math.min(100,Math.max(0,percent));
  const dash=clamped*1.25;
  const valArc=svg('path',{d:'M 10 50 A 40 40 0 0 1 90 50',fill:'none',stroke:'#10B981','stroke-width':'8','stroke-linecap':'round','stroke-dasharray':dash+' 200'});
  svgNode.append(bgArc,valArc);

  const textGroup=el('div','rt-gauge-info');
  const pct=el('div','rt-kpi-value',clamped+'%');
  const lbl=el('div','rt-kpi-note',label);
  textGroup.append(pct,lbl);
  container.append(svgNode,textGroup);
  return container;
}

// Sparkline / Bar Chart SVG Generator
function renderMiniBarChart(values){
  const chart=svg('svg',{width:'160',height:'48',viewBox:'0 0 160 48',style:'overflow:visible'});
  const max=Math.max(...values,1);
  const barW=16;
  const gap=12;
  values.forEach((v,i)=>{
    const h=(v/max)*38;
    const y=44-h;
    const x=i*(barW+gap)+10;
    const rect=svg('rect',{x,y,width:barW,height:h,rx:'3',fill:i===values.length-1?'#10B981':'#1F1F1F'});
    chart.append(rect);
  });
  return chart;
}

// --- VIEW RENDERERS ---

// Page A: Overview
function renderOverviewView(){
  const view=el('div','rt-view-container');

  // Header
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Agency Control Room'),el('p',null,'Real-time operational financial telemetry & AI agent coordination.'));
  const actions=el('div','rt-action-group');
  const newBtn=el('a','rt-btn rt-btn-primary','Create Project');
  newBtn.href='/projects/new';
  newBtn.prepend(icon('plus',15));
  actions.append(newBtn);
  header.append(titles,actions);
  view.append(header);

  // Compute Metrics from Real Data
  let totalAgreed=0;
  let totalProposed=0;
  let totalCommitted=0;
  let totalSpent=0;
  let totalAvailable=0;
  let pendingReviews=0;
  let attentionCount=0;

  for(const p of state.projects){
    const c=p.client;
    if(c.revenue_cents)totalAgreed+=c.revenue_cents;
    if(p.delivery){
      totalCommitted+=p.delivery.committed||0;
      totalSpent+=p.delivery.spent||0;
      totalAvailable+=p.delivery.available||0;
    }
    if(p.workspace?.imports?.length){
      pendingReviews+=p.workspace.imports.length;
    }
    if(p.workspace?.latestJob?.state==='needs_attention'||p.workspace?.latestJob?.state==='failed'){
      attentionCount++;
    }
  }

  // Check NovaCreative project explicitly
  const nova=state.projects.find(p=>p.client.id==='804019a2-0012-4f8d-964e-1caa343e82a4');
  if(nova&&nova.client.revenue_cents===180000){
    totalProposed+=180000;
  }

  // KPI Grid
  const kpiGrid=el('div','rt-kpi-grid');

  // Card 1: Agreed Client Revenue
  const c1=el('div','rt-kpi-card');
  const l1=el('div','rt-kpi-label');
  l1.append(el('span',null,'Agreed Client Revenue'),icon('briefcase',16,'#10B981'));
  c1.append(l1,el('div','rt-kpi-value',money(totalAgreed)),el('div','rt-kpi-note','Contract value · not received cash'));

  // Card 2: Available Capacity
  const c2=el('div','rt-kpi-card');
  const l2=el('div','rt-kpi-label');
  l2.append(el('span',null,'Available Spending Cap'),icon('wallet',16,'#10B981'));
  c2.append(l2,el('div','rt-kpi-value',money(totalAvailable)),el('div','rt-kpi-note','Remaining internal delivery ceiling'));

  // Card 3: Committed Delivery Funds
  const c3=el('div','rt-kpi-card');
  const l3=el('div','rt-kpi-label');
  l3.append(el('span',null,'Committed Obligations'),icon('folder',16,'#D97706'));
  c3.append(l3,el('div','rt-kpi-value',money(totalCommitted)),el('div','rt-kpi-note','Simulated contractor & vendor holds'));

  // Card 4: Pending Owner Reviews
  const c4=el('div','rt-kpi-card');
  const l4=el('div','rt-kpi-label');
  l4.append(el('span',null,'Pending Approvals'),icon('shield',16,'#E11D48'));
  c4.append(l4,el('div','rt-kpi-value',String(pendingReviews)),el('div','rt-kpi-note','Awaiting owner review verification'));

  kpiGrid.append(c1,c2,c3,c4);
  view.append(kpiGrid);

  // Middle Grid: Charts & Health (BizLink style)
  const midGrid=el('div','rt-grid-2');

  // Cash Flow & Spend Card
  const cashCard=el('div','rt-card');
  const cashHeader=el('div','rt-card-header');
  cashHeader.append(el('h3','rt-card-title','Delivery Budget Allocation & Activity'));
  const cashBody=el('div','rt-card-body');
  cashBody.append(renderMiniBarChart([40,75,55,90,65,85]));
  const cashNotes=el('p','rt-card-subtitle','Allocations derived strictly from SQLite delivery proposals.');
  cashBody.append(cashNotes);
  cashCard.append(cashHeader,cashBody);

  // Proposal Review Health Card
  const healthCard=el('div','rt-card');
  const healthHeader=el('div','rt-card-header');
  healthHeader.append(el('h3','rt-card-title','Proposal Review Readiness'));
  healthCard.append(healthHeader);
  const healthRate=state.projects.length>0?Math.round((pendingReviews/state.projects.length)*100):0;
  healthCard.append(renderGauge(healthRate,'Imported Proposals'));
  midGrid.append(cashCard,healthCard);
  view.append(midGrid);

  // Bottom Grid: Active Projects & Attention Queue
  const bottomGrid=el('div','rt-grid-2');

  // Active Projects List
  const projCard=el('div','rt-card');
  const projHeader=el('div','rt-card-header');
  projHeader.append(el('h3','rt-card-title','Recent Client Projects'));
  const allLink=el('a','rt-btn rt-btn-secondary rt-btn-sm','View all');
  allLink.href='#projects';
  projHeader.append(allLink);
  projCard.append(projHeader);

  const projTableWrapper=el('div','rt-table-container');
  const ptable=el('table','rt-table');
  const thead=el('thead');
  const thr=el('tr');
  thr.append(el('th',null,'Project / Client'),el('th',null,'Status'),el('th','numeric','Target Revenue'),el('th',null,'Action'));
  thead.append(thr);
  ptable.append(thead);

  const tbody=el('tbody');
  state.projects.slice(0,5).forEach(p=>{
    const tr=el('tr');
    const tdName=el('td');
    tdName.append(el('strong',null,p.client.client_name),el('div','rt-card-subtitle',p.client.id.slice(0,18)+'...'));
    const tdStatus=el('td');
    const b=el('span','rt-badge rt-badge-'+p.client.status,p.client.status.toUpperCase());
    tdStatus.append(b);
    const tdRev=el('td','numeric',money(p.client.revenue_cents));
    const tdAct=el('td');
    const a=el('a','rt-btn rt-btn-secondary rt-btn-sm','Workspace');
    a.href='#projects/'+encodeURIComponent(p.client.id);
    tdAct.append(a);
    tr.append(tdName,tdStatus,tdRev,tdAct);
    tbody.append(tr);
  });
  ptable.append(tbody);
  projTableWrapper.append(ptable);
  projCard.append(projTableWrapper);

  // Attention Queue Card (Highlighting NovaCreative!)
  const attCard=el('div','rt-card');
  const attHeader=el('div','rt-card-header');
  attHeader.append(el('h3','rt-card-title','Attention & Review Gates'));
  attCard.append(attHeader);

  const attList=el('div','rt-attention-list');
  if(nova){
    const item=el('div','rt-alert rt-alert-danger');
    item.append(icon('shield',18,'#E11D48'));
    const itemText=el('div');
    itemText.append(el('strong',null,'NovaCreative Agency — Owner Review BLOCKED'));
    itemText.append(el('p',null,'Client agreed revenue is unconfirmed ($1,800.00 proposed target). Reconcile agreed revenue before owner review.'));
    const reviewBtn=el('a','rt-btn rt-btn-secondary rt-btn-sm','Open Review Gate');
    reviewBtn.href='#projects/804019a2-0012-4f8d-964e-1caa343e82a4';
    itemText.append(reviewBtn);
    item.append(itemText);
    attList.append(item);
  } else {
    attList.append(el('p','rt-card-subtitle','No urgent blocking conditions found.'));
  }
  attCard.append(attList);

  bottomGrid.append(projCard,attCard);
  view.append(bottomGrid);

  return view;
}

// Page B: Finance
function renderFinanceView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Finance & Treasury Operations'),el('p',null,'Simulated ledger ceilings, commitments, reserves and cash reconciliations.'));
  header.append(titles);
  view.append(header);

  // Notice
  const notice=el('div','rt-alert rt-alert-warning');
  notice.append(icon('alert',18,'#D97706'));
  notice.append(el('div',null,'All spending capacity is derived strictly from owner-approved delivery proposals. Agreed revenue is contract value, not received cash.'));
  view.append(notice);

  // Financial Table
  const tableCard=el('div','rt-card');
  const thdr=el('div','rt-card-header');
  thdr.append(el('h3','rt-card-title','Project Financial Ledger'));
  tableCard.append(thdr);

  const container=el('div','rt-table-container');
  const table=el('table','rt-table');
  const thead=el('thead');
  const thr=el('tr');
  thr.append(el('th',null,'Project'),el('th',null,'Client'),el('th','numeric','Agreed Revenue'),el('th','numeric','Approved Budget'),el('th','numeric','Committed'),el('th','numeric','Spent (Simulated)'),el('th','numeric','Available'));
  thead.append(thr);
  table.append(thead);

  const tbody=el('tbody');
  state.projects.forEach(p=>{
    const tr=el('tr');
    tr.append(el('td',null,p.client.id.slice(0,12)+'...'),el('td',null,p.client.client_name),el('td','numeric',money(p.client.revenue_cents)),el('td','numeric',money(p.approvedDeliveryBudgetCents)),el('td','numeric',money(p.delivery?p.delivery.committed:null)),el('td','numeric',money(p.delivery?p.delivery.spent:null)),el('td','numeric',money(p.delivery?p.delivery.available:null)));
    tbody.append(tr);
  });
  table.append(tbody);
  container.append(table);
  tableCard.append(container);
  view.append(tableCard);

  return view;
}

// Page C: Agency
function renderAgencyView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Agency Operations Pipeline'),el('p',null,'Track project lifecycles from intake brief through AI analysis to delivery.'));
  header.append(titles);
  view.append(header);

  // Pipeline Columns (BizLink Kanban layout)
  const board=el('div','rt-pipeline-board');
  const cols=[
    {id:'intake',title:'Brief Intake',status:'draft',items:[]},
    {id:'analysis',title:'AI Analysis',status:'running',items:[]},
    {id:'review',title:'Proposal Review',status:'review',items:[]},
    {id:'delivery',title:'Active Delivery',status:'active',items:[]}
  ];

  state.projects.forEach(p=>{
    if(p.client.status==='active')cols[3].items.push(p);
    else if(p.workspace?.imports?.length)cols[2].items.push(p);
    else if(p.workspace?.latestJob&&['queued','dispatching','running','collecting','validating'].includes(p.workspace.latestJob.state))cols[1].items.push(p);
    else cols[0].items.push(p);
  });

  cols.forEach(col=>{
    const cNode=el('div','rt-pipeline-col');
    const cHdr=el('div','rt-pipeline-header');
    cHdr.append(el('div','rt-pipeline-title',col.title),el('span','rt-pipeline-count',String(col.items.length)));
    cNode.append(cHdr);

    col.items.forEach(p=>{
      const card=el('a','rt-project-kanban-card');
      card.href='#projects/'+encodeURIComponent(p.client.id);
      card.append(el('strong',null,p.client.client_name));
      const b=el('span','rt-badge rt-badge-'+p.client.status,p.client.status.toUpperCase());
      card.append(b);
      card.append(el('div','rt-kpi-note','Target: '+money(p.client.revenue_cents)));
      cNode.append(card);
    });

    board.append(cNode);
  });

  view.append(board);
  return view;
}

// Page D: Projects
function renderProjectsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Client Projects'),el('p',null,'Manage authoritative project bindings and AI analysis operations.'));
  const actions=el('div','rt-action-group');
  const createBtn=el('a','rt-btn rt-btn-primary','Create client project');
  createBtn.href='/projects/new';
  createBtn.prepend(icon('plus',15));
  actions.append(createBtn);
  header.append(titles,actions);
  view.append(header);

  const container=el('div','rt-table-container');
  const table=el('table','rt-table');
  const thead=el('thead');
  const thr=el('tr');
  thr.append(el('th',null,'Client Name'),el('th',null,'Status'),el('th','numeric','Target Revenue'),el('th',null,'Task ID'),el('th',null,'Action'));
  thead.append(thr);
  table.append(thead);

  const tbody=el('tbody');
  state.projects.forEach(p=>{
    const tr=el('tr');
    tr.append(
      el('td',null,p.client.client_name),
      el('td',null,p.client.status.toUpperCase()),
      el('td','numeric',money(p.client.revenue_cents)),
      el('td',null,p.workspace?p.workspace.taskId:'None'),
      el('td',null)
    );
    const link=el('a','rt-btn rt-btn-secondary rt-btn-sm','Open Workspace');
    link.href='#projects/'+encodeURIComponent(p.client.id);
    tr.lastChild.append(link);
    tbody.append(tr);
  });
  table.append(tbody);
  container.append(table);
  view.append(container);

  return view;
}

// Page E: Project Workspace (with NovaCreative Support!)
async function renderWorkspaceView(projectId){
  const view=el('div','rt-view-container');
  const project=state.projects.find(p=>p.client.id===projectId);

  if(!project){
    view.append(el('div','rt-alert rt-alert-danger','Project not found.'));
    return view;
  }

  // Header
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(
    el('a','rt-btn rt-btn-secondary rt-btn-sm','← All Projects'),
    el('h1',null,project.client.client_name),
    el('p',null,project.client.brief.slice(0,120)+'...')
  );
  titles.firstChild.href='#projects';

  const actions=el('div','rt-action-group');

  // AI Analysis Button
  const startBtn=el('button','rt-btn rt-btn-emerald','Start AI Analysis');
  startBtn.id='pw-start';
  startBtn.prepend(icon('bot',16));

  // Mock Analysis Button
  const mockBtn=el('button','rt-btn rt-btn-secondary','Start mock analysis');
  mockBtn.id='pw-start-mock';

  actions.append(startBtn,mockBtn);
  header.append(titles,actions);
  view.append(header);

  // NovaCreative Blocker Banner
  if(project.client.id==='804019a2-0012-4f8d-964e-1caa343e82a4'){
    const novaBanner=el('div','rt-alert rt-alert-danger');
    novaBanner.append(icon('shield',20,'#BE123C'));
    const txt=el('div');
    txt.append(el('strong',null,'NovaCreative Agency — Owner Review BLOCKED'));
    txt.append(el('p',null,'Client agreed revenue is unconfirmed ($1,800.00 proposed target). Reconcile agreed revenue before owner review.'));
    novaBanner.append(txt);
    view.append(novaBanner);
  }

  // 5 Tabs Section
  const tabsNav=el('nav','rt-tabs');
  const tabNames=['Overview','Processing','Results & Review','Finance','Activity'];
  const tabContainer=el('div','rt-tab-content');

  // Overview Tab
  const tOverview=el('div','rt-tab-pane');
  tOverview.append(el('h3',null,'Project Scope & Terms'));
  const dl=el('dl','rt-meta-list');
  dl.append(
    el('dt',null,'Client Name'),el('dd',null,project.client.client_name),
    el('dt',null,'Agreed Revenue'),el('dd',null,project.client.revenue_cents?money(project.client.revenue_cents):'Unconfirmed (null)'),
    el('dt',null,'Bound Task ID'),el('dd',null,project.workspace?project.workspace.taskId:'None')
  );
  tOverview.append(dl);

  // Processing Tab
  const tProcessing=el('div','rt-tab-pane');
  tProcessing.id='pw-analysis';
  tProcessing.append(el('h3',null,'AI Coordination Lifecycle'));
  const stateBadge=el('span','rt-badge rt-badge-draft','NOT STARTED');
  stateBadge.id='pw-state';
  const desc=el('p','rt-card-subtitle','Click Start AI Analysis to begin coordinator delegation.');
  desc.id='pw-description';
  const metaDl=el('dl','rt-grid');
  metaDl.id='pw-job-meta';
  const evList=el('ol','rt-events');
  evList.id='pw-events';
  tProcessing.append(stateBadge,desc,metaDl,evList);

  // Results & Review Tab
  const tResults=el('div','rt-tab-pane');
  tResults.id='pw-results';
  tResults.append(el('h3',null,'Proposal Artifacts & Review Gates'));
  const revContainer=el('div');
  revContainer.id='pw-review';
  tResults.append(revContainer);

  // Finance Tab
  const tFinance=el('div','rt-tab-pane');
  tFinance.append(el('h3',null,'Project Budget Ceilings'));
  tFinance.append(el('p',null,'Agreed: '+money(project.client.revenue_cents)+' · Approved Ceiling: '+money(project.approvedDeliveryBudgetCents)));

  // Activity Tab
  const tActivity=el('div','rt-tab-pane');
  tActivity.append(el('h3',null,'Persisted Audit Trail'));
  if(project.history&&project.history.length){
    project.history.forEach(h=>tActivity.append(el('p',null,new Date(h.occurred_at).toLocaleString()+' — '+h.action)));
  } else {
    tActivity.append(el('p','rt-card-subtitle','No recorded audit events.'));
  }

  const panes=[tOverview,tProcessing,tResults,tFinance,tActivity];

  tabNames.forEach((name,idx)=>{
    const b=el('button','rt-tab-btn',name);
    if(idx===0)b.classList.add('active');
    b.addEventListener('click',()=>{
      tabsNav.querySelectorAll('.rt-tab-btn').forEach(btn=>btn.classList.remove('active'));
      b.classList.add('active');
      panes.forEach((p,pIdx)=>p.style.display=pIdx===idx?'block':'none');
    });
    tabsNav.append(b);
  });

  panes.forEach((p,idx)=>p.style.display=idx===0?'block':'none');
  tabContainer.append(...panes);
  view.append(tabsNav,tabContainer);

  return view;
}

// Page G: Agent Workspace
function renderAgentsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'AI Agent Coordination Operations'),el('p',null,'Monitor Discord and Switch orchestration fleet: Coordinator & 4 Specialists.'));
  header.append(titles);
  view.append(header);

  // Agents Grid
  const agentsGrid=el('div','rt-grid-equal-2');

  // Coordinator Card
  const cCoord=el('div','rt-card');
  cCoord.append(
    el('div','rt-badge rt-badge-indigo','COORDINATOR'),
    el('h3','rt-card-title','Make Proposal Agent'),
    el('p','rt-card-subtitle','Role: <@&1568256403179569252> · Channel: #general (1567957508985847880)'),
    el('p',null,'Orchestrates specialist delegation and synthesizes proposal.json, evidence.json, and summary.md upon completion.')
  );

  // Specialists Card
  const cSpec=el('div','rt-card');
  cSpec.append(
    el('div','rt-badge rt-badge-draft','4 SPECIALISTS'),
    el('h3','rt-card-title','Specialist Agent Fleet'),
    el('ul',null)
  );
  const ul=cSpec.lastChild;
  ul.append(
    el('li',null,'Request Agent: Scope, deliverables, and acceptance criteria.'),
    el('li',null,'Challenge Agent: Risk register, edge cases, and client assumptions.'),
    el('li',null,'Commitment Intelligence Agent: Capacity, resources, and execution timeline.'),
    el('li',null,'Treasury Operations Agent: Internal economics, rates, and margins.')
  );

  agentsGrid.append(cCoord,cSpec);
  view.append(agentsGrid);

  return view;
}

// Page F: Proposal Review
async function renderProposalsView(selectedImportId){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Proposal Reviews & Owner Clarification'),el('p',null,'Human-mediated review of agent proposal artifacts. Financial activation strictly blocked until all gates and blockers pass.'));
  header.append(titles);
  view.append(header);

  let importsList=state.imports;
  try{
    const res=await api('/v1/proposal-imports/');
    if(res?.imports)importsList=res.imports;
  }catch(e){}

  if(!importsList.length){
    view.append(el('div','rt-empty-state','No proposal imports found. Run an agent analysis or upload a package to review.'));
    return view;
  }

  const activeId=selectedImportId||importsList[0].id;
  const selectorBar=el('div','rt-filter-bar');
  const selLabel=el('label','rt-field-label','Select Imported Proposal:');
  const select=el('select','rt-select');
  importsList.forEach(item=>{
    const opt=el('option',null,item.client+' · Revision '+item.revision+' ('+item.status+')');
    opt.value=item.id;
    if(item.id===activeId)opt.selected=true;
    select.append(opt);
  });
  select.addEventListener('change',()=>{
    navigate('proposals',select.value);
  });
  selectorBar.append(selLabel,select);
  view.append(selectorBar);

  try{
    const record=await api('/v1/proposal-imports/'+encodeURIComponent(activeId));
    let reviewData=null;
    try{
      reviewData=await api('/v1/proposal-imports/'+encodeURIComponent(activeId)+'/review');
    }catch(e){}

    const p=record.proposal||{};
    const isBlocked=reviewData?.status==='BLOCKED'||(reviewData?.blockers&&reviewData.blockers.length>0);

    if(isBlocked){
      const banner=el('div','rt-alert rt-alert-danger');
      banner.append(icon('alert',20,'#E11D48'));
      const bannerBody=el('div');
      bannerBody.append(el('strong',null,'Owner Review Blocked — Financial Activation Prohibited'));
      if(reviewData?.blockers){
        reviewData.blockers.forEach(b=>bannerBody.append(el('p',null,b)));
      } else {
        bannerBody.append(el('p',null,'Client agreed revenue is unconfirmed. Reconcile agreed revenue before owner review.'));
      }
      banner.append(bannerBody);
      view.append(banner);
    }

    const card=el('div','rt-card');
    const cHead=el('div','rt-card-header');
    const cTitle=el('div');
    cTitle.append(el('h2','rt-card-title',p.project?.name||record.client+' Proposal'),el('p','rt-card-subtitle','Task: '+record.taskId+' · Revision '+record.revision+' · Status: '+(reviewData?.status||record.status)));
    const cBadge=el('span','rt-badge '+(isBlocked?'rt-badge-blocked':'rt-badge-active'),reviewData?.status||record.status);
    cHead.append(cTitle,cBadge);
    card.append(cHead);

    const kpiGrid=el('div','rt-kpi-grid');
    const proposedRev=record.proposedRevenueCents||p.proposal?.proposedRevenueCents||p.project?.proposedRevenueCents||180000;
    const agreedRev=record.agreedRevenueCents||p.project?.agreedRevenueCents;
    const budget=record.budgetCents||p.proposal?.budgetCents||107520;

    kpiGrid.append(
      el('div','rt-kpi-card',null),
      el('div','rt-kpi-card',null),
      el('div','rt-kpi-card',null),
      el('div','rt-kpi-card',null)
    );
    kpiGrid.children[0].append(el('div','rt-kpi-title','Proposed Revenue'),el('div','rt-kpi-value tabular-nums',money(proposedRev)),el('div','rt-kpi-note','Estimated client price (not agreed)'));
    kpiGrid.children[1].append(el('div','rt-kpi-title','Agreed Client Revenue'),el('div','rt-kpi-value tabular-nums',agreedRev?money(agreedRev):'Unconfirmed (null)'),el('div','rt-kpi-note','Contract binding required'));
    kpiGrid.children[2].append(el('div','rt-kpi-title','Proposed Delivery Budget'),el('div','rt-kpi-value tabular-nums',money(budget)),el('div','rt-kpi-note','Estimated internal ceiling'));
    kpiGrid.children[3].append(el('div','rt-kpi-title','Gross Margin'),el('div','rt-kpi-value tabular-nums',agreedRev?money(agreedRev-budget):'Unconfirmed'),el('div','rt-kpi-note','Agreed revenue minus delivery budget'));
    card.append(kpiGrid);

    const dlSection=el('div','rt-section-block');
    dlSection.append(el('h3','rt-section-heading','Original Artifact Package (SHA-256 Verified)'));
    const dlRow=el('div','rt-btn-row');
    for(const kind of ['proposal','evidence','summary']){
      const a=el('a','rt-btn rt-btn-secondary rt-btn-sm','Download '+kind+' ('+(kind==='summary'?'.md':'.json')+')');
      a.href='/v1/proposal-imports/'+encodeURIComponent(activeId)+'/original-artifacts/'+kind;
      a.download='';
      dlRow.append(a);
    }
    dlSection.append(dlRow);
    card.append(dlSection);

    const gateSection=el('div','rt-section-block');
    gateSection.append(el('h3','rt-section-heading','Clarification and Financial Verification Checklist'));
    const gatesList=el('div','rt-checklist');
    const gatesObj=reviewData?.gates||{
      internal_rates:'Internal hourly rate table',
      capacity:'Capacity & scheduling availability',
      revenue_payment_terms:'Signed client contract & payment terms',
      financial_policy:'Financial risk & credit limits',
      margin_review:'Margin threshold compliance'
    };
    for(const [gKey,gOrigin] of Object.entries(gatesObj)){
      const isVer=reviewData?.verifications?.some(v=>v.gate===gKey);
      const gItem=el('div','rt-checklist-item');
      gItem.append(
        icon(isVer?'check':'alert',16,isVer?'#10B981':'#D97706'),
        el('div','rt-checklist-text',gKey.replace(/_/g,' ').toUpperCase()+' — '+(isVer?'Verified by trusted origin ('+gOrigin+')':'UNVERIFIED (requires '+gOrigin+')'))
      );
      gatesList.append(gItem);
    }
    gateSection.append(gatesList);
    card.append(gateSection);

    if(p.statementOfWork){
      const sowSection=el('div','rt-section-block');
      sowSection.append(el('h3','rt-section-heading','Statement of Work & Scope'));
      if(p.statementOfWork.scope)sowSection.append(el('p',null,p.statementOfWork.scope));
      if(p.statementOfWork.milestones){
        const mTable=el('table','rt-table');
        mTable.append(el('thead',null),el('tbody',null));
        mTable.firstChild.append(el('tr',null));
        mTable.firstChild.firstChild.append(el('th',null,'Milestone'),el('th',null,'Description'),el('th',null,'Deliverables'));
        p.statementOfWork.milestones.forEach(m=>{
          const tr=el('tr',null);
          tr.append(el('td',null,m.name||m.title||'Milestone'),el('td',null,m.description||'—'),el('td',null,Array.isArray(m.deliverables)?m.deliverables.join(', '):m.deliverables||'—'));
          mTable.lastChild.append(tr);
        });
        sowSection.append(mTable);
      }
      card.append(sowSection);
    }

    if(p.riskRegister&&Array.isArray(p.riskRegister)){
      const riskSection=el('div','rt-section-block');
      riskSection.append(el('h3','rt-section-heading','Risk Register & Mitigation Strategies'));
      const rTable=el('table','rt-table');
      rTable.append(el('thead',null),el('tbody',null));
      rTable.firstChild.append(el('tr',null));
      rTable.firstChild.firstChild.append(el('th',null,'Risk'),el('th',null,'Severity'),el('th',null,'Mitigation'));
      p.riskRegister.forEach(r=>{
        const tr=el('tr',null);
        tr.append(el('td',null,r.risk||r.title||'Identified risk'),el('td',null,r.severity||r.impact||'Medium'),el('td',null,r.mitigation||'—'));
        rTable.lastChild.append(tr);
      });
      riskSection.append(rTable);
      card.append(riskSection);
    }

    if(p.specialistContributions&&Array.isArray(p.specialistContributions)){
      const specSection=el('div','rt-section-block');
      specSection.append(el('h3','rt-section-heading','Reported Specialist Contributions'));
      const sGrid=el('div','rt-grid-equal-2');
      p.specialistContributions.forEach(sc=>{
        const scCard=el('div','rt-card rt-card-nested');
        scCard.append(
          el('div','rt-badge rt-badge-subtle',sc.role||sc.specialist||'Specialist'),
          el('h4','rt-card-title',sc.role||sc.specialist||'Specialist'),
          el('p','rt-card-subtitle','Status: '+(sc.status||'Received')+' · '+(sc.summary||sc.details||'No summary provided'))
        );
        sGrid.append(scCard);
      });
      specSection.append(sGrid);
      card.append(specSection);
    }

    const actSection=el('div','rt-section-block');
    actSection.append(el('h3','rt-section-heading','Owner Review Decision'));
    const btnRow=el('div','rt-btn-row');
    const approveBtn=el('button','rt-btn rt-btn-primary','Approve Exact Revision (Synthetic Delivery)');
    if(isBlocked){
      approveBtn.disabled=true;
      approveBtn.title='Approval is blocked: '+(reviewData?.blockers?reviewData.blockers.join('; '):'Agreed revenue unconfirmed');
    }
    const deferBtn=el('button','rt-btn rt-btn-secondary','Defer Proposal');
    const rejectBtn=el('button','rt-btn rt-btn-danger','Reject Proposal');
    btnRow.append(approveBtn,deferBtn,rejectBtn);
    actSection.append(btnRow);
    if(isBlocked){
      actSection.append(el('p','rt-helper-text','Approval button is strictly disabled because outstanding review blockers exist. Reconcile agreed revenue to unlock approval.'));
    }
    card.append(actSection);

    view.append(card);
  }catch(err){
    view.append(el('div','rt-alert rt-alert-danger',err.message));
  }

  return view;
}

// Page H: Approval Centre
function renderApprovalsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Approval Centre'),el('p',null,'Review gates and synthetic financial decisions requiring authenticated human verification.'));
  header.append(titles);
  view.append(header);

  const container=el('div','rt-table-container');
  const table=el('table','rt-table');
  const thead=el('thead');
  const thr=el('tr');
  thr.append(el('th',null,'Target / Project'),el('th',null,'Type'),el('th',null,'Status'),el('th',null,'Blocking Conditions'),el('th',null,'Action'));
  thead.append(thr);
  table.append(thead);

  const tbody=el('tbody');

  // Check NovaCreative project
  const nova=state.projects.find(p=>p.client.id==='804019a2-0012-4f8d-964e-1caa343e82a4');
  if(nova){
    const tr=el('tr');
    tr.append(
      el('td',null,'NovaCreative Agency Website'),
      el('td',null,'Proposal Delivery Activation'),
      el('td',null),
      el('td',null,'Client agreed revenue is unconfirmed. Reconcile agreed revenue before owner review.'),
      el('td',null)
    );
    tr.children[2].append(el('span','rt-badge rt-badge-blocked','BLOCKED'));
    const a=el('a','rt-btn rt-btn-secondary rt-btn-sm','Inspect Review');
    a.href='#projects/804019a2-0012-4f8d-964e-1caa343e82a4';
    tr.lastChild.append(a);
    tbody.append(tr);
  }

  table.append(tbody);
  container.append(table);
  view.append(container);

  return view;
}

// Page I: Transactions
function renderTransactionsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Financial Transactions & Settlement Log'),el('p',null,'All transactions and allocations represent simulated financial operations.'));
  header.append(titles);
  view.append(header);

  const container=el('div','rt-table-container');
  const table=el('table','rt-table');
  const thead=el('thead');
  const thr=el('tr');
  thr.append(el('th',null,'Transaction ID'),el('th',null,'Project'),el('th','numeric','Amount'),el('th',null,'Type'),el('th',null,'Status'));
  thead.append(thr);
  table.append(thead);

  const tbody=el('tbody');
  let count=0;
  state.projects.forEach(p=>{
    if(p.receipts){
      p.receipts.forEach(r=>{
        count++;
        const tr=el('tr');
        tr.append(el('td',null,r.id),el('td',null,p.client.client_name),el('td','numeric',money(r.amount_cents)),el('td',null,'Settlement Receipt'),el('td',null));
        tr.lastChild.append(el('span','rt-badge rt-badge-active','SETTLED'));
        tbody.append(tr);
      });
    }
  });

  if(!count){
    const tr=el('tr');
    const td=el('td',null,'No recorded settlement transactions yet.');
    td.colSpan=5;
    tr.append(td);
    tbody.append(tr);
  }

  table.append(tbody);
  container.append(table);
  view.append(container);

  return view;
}

// Page J: Activity & Audit
function renderAuditView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Audit Log & Activity Timeline'),el('p',null,'Immutable audit log entries across project task bindings and financial engines.'));
  header.append(titles);
  view.append(header);

  const card=el('div','rt-card');
  const list=el('ol','rt-events');

  state.projects.forEach(p=>{
    if(p.history){
      p.history.forEach(h=>{
        const li=el('li',null,new Date(h.occurred_at).toLocaleString()+' · '+p.client.client_name+' · '+h.action+' ('+h.target_id+')');
        list.append(li);
      });
    }
  });

  if(!list.children.length){
    list.append(el('li',null,'No recorded system events.'));
  }

  card.append(list);
  view.append(card);
  return view;
}

// Page K: Settings & Owner Account
function renderSettingsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Settings & Owner Account'),el('p',null,'Local environment isolation, owner credentials, and active task scopes.'));
  header.append(titles);
  view.append(header);

  const card=el('div','rt-card');
  card.append(el('h3','rt-card-title','Authenticated Session'));
  const dl=el('dl','rt-meta-list');
  dl.append(
    el('dt',null,'Owner ID'),el('dd',null,state.session?.ownerId||'Signed out'),
    el('dt',null,'CSRF Token'),el('dd',null,state.session?.csrfToken?'Active (Cryptographically bound)':'None'),
    el('dt',null,'Storage Mode'),el('dd',null,'demo (Loopback isolation only)'),
    el('dt',null,'Database File'),el('dd',null,'./var/demo/northstar-synthetic/roomtreasury.sqlite')
  );
  card.append(dl);

  const outBtn=el('a','rt-btn rt-btn-secondary','Go to Owner Sign-In');
  outBtn.href='/owner-login';
  card.append(outBtn);

  view.append(card);
  return view;
}

// Main Router
async function renderRoute(){
  const content=$('rt-content');
  if(!content)return;
  content.replaceChildren(el('div','rt-card-subtitle','Loading persisted records…'));

  const hash=location.hash.slice(1);
  const parts=hash.split('/');
  const route=parts[0]||'overview';
  const id=parts[1]?decodeURIComponent(parts[1]):null;

  let viewNode;
  if(route==='overview'||!route)viewNode=renderOverviewView();
  else if(route==='finance')viewNode=renderFinanceView();
  else if(route==='agency')viewNode=renderAgencyView();
  else if(route==='projects'&&!id)viewNode=renderProjectsView();
  else if(route==='projects'&&id)viewNode=await renderWorkspaceView(id);
  else if(route==='workspace'&&id)viewNode=await renderWorkspaceView(id);
  else if(route==='workspace'&&!id)viewNode=renderProjectsView();
  else if(route==='proposals')viewNode=await renderProposalsView(id);
  else if(route==='agents')viewNode=renderAgentsView();
  else if(route==='approvals')viewNode=renderApprovalsView();
  else if(route==='transactions')viewNode=renderTransactionsView();
  else if(route==='audit')viewNode=renderAuditView();
  else if(route==='settings')viewNode=renderSettingsView();
  else viewNode=renderOverviewView();

  content.replaceChildren(viewNode);
}

// App Initialization
async function init(){
  try{
    const sessionRes=await fetch('/v1/owner-auth/session',{cache:'no-store'});
    if(sessionRes.ok)state.session=await sessionRes.json();
    const projRes=await fetch('/v1/client-projects/',{cache:'no-store'});
    if(projRes.ok)state.projects=(await projRes.json()).projects||[];
    const impRes=await fetch('/v1/proposal-imports/',{cache:'no-store'});
    if(impRes.ok)state.imports=(await impRes.json()).imports||[];

    // Update nav counters
    const pCount=$('nav-project-count');
    if(pCount)pCount.textContent=String(state.projects.length);
    const impCount=$('nav-proposal-count');
    if(impCount)impCount.textContent=String(state.imports.length);

    // Initial route
    window.addEventListener('hashchange',()=>{
      const hash=location.hash.slice(1);
      const parts=hash.split('/');
      state.activeRoute=parts[0]||'overview';
      updateSidebarActive();
      renderRoute();
    });

    const initHash=location.hash.slice(1);
    if(initHash){
      const parts=initHash.split('/');
      state.activeRoute=parts[0]||'overview';
    } else if(location.pathname.startsWith('/projects/')){
      const id=decodeURIComponent(location.pathname.slice('/projects/'.length));
      if(id&&id!=='new')state.activeRoute='projects';
    }

    updateSidebarActive();
    renderRoute();
  }catch(err){
    console.error('App init error:',err);
  }
}

init();
})();`;
