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
  copy.append(el('h2',null,title));
  if(description)copy.append(el('p',null,description));
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

function compactRecords(records, emptyMessage){
  if(!records.length)return el('p','ov-empty',emptyMessage);
  const list=el('ul','rt-compact-records');
  for(const record of records){
    const item=el('li');
    const row=el('a','rt-compact-record');
    row.href=record.href;
    const copy=el('div');
    copy.append(el('strong',null,record.title),el('small',null,record.subtitle));
    row.append(copy);
    if(record.value!=null)row.append(el('span','rt-record-value',record.value));
    item.append(row);
    list.append(item);
  }
  return list;
}

const overviewMetrics=[
  ['Contracted revenue','Signed agreements','briefcase','sage'],
  ['Cash received','Recorded client receipts','wallet','amber'],
  ['Outstanding receivables','Unpaid issued invoices','file','lavender'],
  ['Active projects','In client delivery','folder','blue'],
  ['AI deliverables','Imported proposal packages','bot','peach'],
  ['Delivery budget','Approved internal spend','shield','stone']
];

function recordTime(value){
  return Number(new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00':value??NaN));
}
function shortRecordDate(value){
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(recordTime(value));
}
function localDateKey(date){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}

function weeklyReceipts(entries, today){
  const daily=new Map();
  for(const entry of entries){
    if(entry.kind==='receipt')daily.set(entry.paid_on,(daily.get(entry.paid_on)||0)+entry.amount_cents);
  }
  return Array.from({length:7},(_,index)=>{
    const date=new Date(today.getFullYear(),today.getMonth(),today.getDate()-6+index,12);
    return {date,key:localDateKey(date),cents:daily.get(localDateKey(date))||0};
  });
}

function overviewActivity(projects, commercialById){
  const events=[];
  for(const project of projects){
    const href=projectHref(project);
    const add=(title,at,url=href)=>{
      if(Number.isFinite(recordTime(at)))events.push({title,at,project,href:url});
    };
    add('Project created',project.workspace?.createdAt);
    for(const item of project.workspace?.imports||[])add('AI proposal imported',item.importedAt,href+'#pw-results');
    for(const item of project.proposals||[])add('Delivery budget approved',item.proposal.approved_at,href+'#pw-approvals');
    const commercial=commercialById.get(project.client.id);
    for(const invoice of commercial?.invoices||[])add('Invoice issued',invoice.issuedOn,commercialLink(project.client.id,invoice.id));
    for(const record of commercial?.entries||[]){
      add(record.kind==='receipt'?'Payment received':'Expense recorded',record.paid_on,href+'#cash-'+encodeURIComponent(record.id));
    }
  }
  return events.sort((a,b)=>recordTime(b.at)-recordTime(a.at));
}

function overviewClients(projects, commercialById, events){
  const latest=new Map();
  for(const event of events)if(!latest.has(event.project.client.id))latest.set(event.project.client.id,event);
  const sorted=projects.slice().reverse().sort((a,b)=>
    (recordTime(latest.get(b.client.id)?.at)||0)-(recordTime(latest.get(a.client.id)?.at)||0)
  );
  const clients=new Set();
  return sorted.filter(project=>{
    const key=project.client.client_name.trim().toLocaleLowerCase();
    if(clients.has(key))return false;
    clients.add(key);
    return true;
  }).slice(0,4).map(project=>{
    const commercial=commercialById.get(project.client.id);
    const event=latest.get(project.client.id);
    const stage=commercial?.stage==='delivery'?'In delivery':
      project.client.status==='active'?'Budget approved':textStatus(project.client.status);
    return {title:project.client.client_name,project:projectTitle(project),stage,
      activity:event?event.title+' · '+shortRecordDate(event.at):'No recent activity recorded',
      value:commercial?.agreedCents==null?null:money(commercial.agreedCents),href:projectHref(project)};
  });
}

function createOverviewView(){
  const view=el('div','ov-view ov-dashboard');
  const layout=el('div','ov-dashboard-grid'),main=el('div','ov-dashboard-main'),aside=el('aside','ov-dashboard-aside');
  const title=el('header','ov-dashboard-title');
  const sample=overviewBadge('Local demo','amber');
  title.append(el('div','ov-dashboard-heading'),sample);
  title.firstChild.append(el('h1',null,'Overview'),el('p',null,'Client revenue and delivery at a glance'));
  const metrics=el('section','ov-dashboard-metrics');
  metrics.setAttribute('aria-label','Financial and operational summary');
  const values=overviewMetrics.map(([label,description,symbol,tone],index)=>{
    const card=el('article','ov-kpi ov-kpi-'+tone);
    card.style.setProperty('--ov-enter-delay',index*35+'ms');
    const heading=el('div','ov-kpi-label'),glyph=el('span','ov-kpi-icon');
    glyph.append(icon(symbol,15));
    heading.append(glyph,el('h2',null,label));
    const value=el('strong','ov-kpi-value','—');
    card.append(heading,value,el('p',null,description));
    metrics.append(card);
    return value;
  });

  const cash=overviewPanel('Daily cash received','Recorded client payments');
  cash.panel.classList.add('ov-daily-panel');
  const period=el('span','ov-period','Last 7 days');
  cash.head.append(period);
  const cashTotal=el('strong','ov-chart-total');
  const chart=el('div','ov-daily-chart');
  const chartNote=el('p','ov-chart-note');
  const bars=Array.from({length:7},()=>{
    const column=el('div','ov-day');
    const track=el('div','ov-day-track'),fill=el('span','ov-day-fill');
    const tooltip=el('span','ov-day-tooltip'),day=el('span','ov-day-label');
    track.tabIndex=0;
    track.setAttribute('role','img');
    track.append(fill,tooltip);
    column.append(track,day);
    chart.append(column);
    return {track,fill,tooltip,day};
  });
  cash.panel.append(cashTotal,chart,chartNote);

  const activity=overviewPanel('Recent activity');
  const activityBody=el('div');
  activity.panel.append(activityBody);
  main.append(title,metrics,cash.panel,activity.panel);

  const usage=overviewPanel('Delivery budget usage','Approved spending capacity');
  usage.panel.classList.add('ov-usage-panel');
  const ring=el('div','ov-finance-ring');
  const spend=el('p','ov-ring-context');
  usage.panel.append(ring,spend);

  const clients=overviewPanel('Recent clients');
  clients.panel.classList.add('ov-client-panel');
  clients.head.append(overviewLink('View all','#projects/all'));
  const clientsBody=el('div');
  clients.panel.append(clientsBody);
  aside.append(usage.panel,clients.panel);
  layout.append(main,aside);
  view.append(layout);

  let chartKey='',ringKey='',activityKey='',clientsKey='';
  function update(){
    const projects=state.projects;
    const commercial=state.commercial;
    const totals=commercial?.totals;
    const commercialById=new Map((commercial?.projects||[]).map(project=>[project.projectId,project]));
    const entries=(commercial?.projects||[]).flatMap(project=>project.entries);
    const delivery=projects.filter(project=>project.delivery);
    const sum=key=>delivery.reduce((total,project)=>total+project.delivery[key],0);
    const approved=sum('budget');
    const packages=new Set(projects.flatMap(project=>(project.workspace?.imports||[]).map(item=>item.id)));
    sample.hidden=!(localDemo()||commercial?.demo||projects.some(project=>/\[(?:SYNTHETIC )?DEMO\]/i.test(project.client.client_name)));
    const amounts=[totals?.contractedCents,totals?.cashCents,totals?.receivableCents,
      commercial?.projects.filter(project=>project.stage==='delivery').length,
      state.session?packages.size:null,delivery.length?approved:null];
    amounts.forEach((amount,index)=>{
      const value=amount==null?'—':index===3||index===4?String(amount):money(amount);
      if(values[index].textContent!==value)values[index].textContent=value;
    });

    const days=weeklyReceipts(entries,new Date());
    const nextChartKey=JSON.stringify([!!commercial,days.map(day=>[day.key,day.cents])]);
    if(nextChartKey!==chartKey){
      chartKey=nextChartKey;
      const total=days.reduce((sum,day)=>sum+day.cents,0);
      const max=Math.max(1,...days.map(day=>day.cents));
      cashTotal.textContent=commercial?money(total):'—';
      chartNote.textContent=!commercial?'Payment records are unavailable.':
        total===0?'Payment activity will appear here as receipts are recorded.':'Daily totals are based on receipt dates.';
      chart.dataset.empty=String(total===0);
      days.forEach((day,index)=>{
        const bar=bars[index];
        const label=new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(day.date);
        const description=shortRecordDate(day.date)+' · '+(commercial?money(day.cents):'Unavailable');
        bar.day.textContent=label;
        bar.tooltip.textContent=description;
        bar.track.setAttribute('aria-label',description);
        bar.fill.style.setProperty('--ov-bar-scale',String(day.cents/max));
      });
    }

    const categories=[
      ['Available',sum('available'),'ov-ring-sage'],
      ['Committed',sum('committed'),'ov-ring-amber'],
      ['Reserved',sum('reserved'),'ov-ring-blue'],
      ['Simulated spend',sum('spent'),'ov-ring-lavender']
    ].filter(([,amount])=>amount>0).map(([name,amount,color])=>({name,amount:amount/100,stroke:color,dot:color}));
    const nextRingKey=JSON.stringify(categories);
    if(nextRingKey!==ringKey){
      ringKey=nextRingKey;
      if(categories.length&&globalThis.RoomTreasuryUI?.overviewRing)globalThis.RoomTreasuryUI.overviewRing(ring,categories);
      else if(categories.length)ring.replaceChildren(descriptionList(categories.map(item=>[item.name,money(item.amount*100)])));
      else{
        globalThis.RoomTreasuryUI?.unmount(ring);
        const emptyRing=el('div','ov-empty-ring');
        emptyRing.append(icon('wallet',24),el('span',null,'No approved budget'));
        ring.replaceChildren(emptyRing);
      }
    }
    spend.textContent=totals?'Recorded expenses '+money(totals.expenseCents)+' · Commercial ledger':'Commercial expenses unavailable';

    const events=overviewActivity(projects,commercialById);
    const recent=events.slice(0,4).map(event=>({
      title:event.title,subtitle:projectTitle(event.project),value:shortRecordDate(event.at),href:event.href
    }));
    const nextActivityKey=JSON.stringify(recent);
    if(nextActivityKey!==activityKey){
      activityKey=nextActivityKey;
      activityBody.replaceChildren(compactRecords(recent,'No recorded activity yet.'));
    }
    const recentClients=overviewClients(projects,commercialById,events);
    const nextClientsKey=JSON.stringify(recentClients);
    if(nextClientsKey!==clientsKey){
      clientsKey=nextClientsKey;
      if(!recentClients.length)clientsBody.replaceChildren(el('p','ov-empty','Clients appear here when you create a project.'));
      else{
        const list=el('ul','ov-client-list');
        recentClients.forEach((client,index)=>{
          const item=el('li');
          const link=el('a','ov-client-row');
          link.href=client.href;
          const initials=client.title.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toUpperCase();
          const avatar=el('span','ov-client-avatar ov-avatar-'+index,initials);
          avatar.setAttribute('aria-hidden','true');
          const identity=el('div','ov-client-identity');
          identity.append(el('strong',null,client.title),el('span',null,client.project),el('small',null,client.activity));
          const meta=el('div','ov-client-meta');
          meta.append(el('small',null,client.stage));
          if(client.value)meta.append(el('strong',null,client.value),el('small',null,'Contracted'));
          link.append(avatar,identity,meta);
          item.append(link);
          list.append(item);
        });
        clientsBody.replaceChildren(list);
      }
    }
  }
  return {view,update};
}
`;
