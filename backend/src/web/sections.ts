export const sectionsScript = String.raw`
const sectionTabs={
  finance:[['overview','Overview'],['invoices','Invoices & Receivables'],['transactions','Transactions'],['budgets','Project Budgets'],['commitments','Commitments & Expenses']],
  projects:[['board','Kanban Board'],['all','All Projects']],
  operations:[['discord','Discord Live'],['fleet','Agent Fleet'],['proposals','Proposal Reviews'],['approvals','Approvals'],['audit','Activity']]
};
const aliases={agency:['projects','board'],agents:['operations','fleet'],workspace:['projects','all'],
  proposals:['operations','proposals'],approvals:['operations','approvals'],transactions:['finance','transactions'],
  audit:['operations','audit'],reviews:['operations','proposals']};
const tabAliases={finance:{ledger:'budgets'},operations:{projects:'all',pipeline:'board',agents:'fleet'},reviews:{history:'approvals',import:'proposals'}};
function resolveSection(route,sub){
  if(route==='operations'&&['projects','pipeline'].includes(sub))return {section:'projects',tab:tabAliases.operations[sub]};
  const section=aliases[route]?.[0]||route;
  const requested=route==='projects'&&!sub?'all':tabAliases[route]?.[sub]||sub;
  const tabs=Object.hasOwn(sectionTabs,section)?sectionTabs[section]:[];
  return {section,tab:tabs.some(([id])=>id===requested)?requested:aliases[route]?.[1]||tabs[0]?.[0]};
}
const sectionNames={operations:'Operations',finance:'Finance',projects:'Projects'};
const sectionDescriptions={projects:'Follow client work from intake through delivery.',
  operations:'Monitor agent runs, review proposals, and follow owner decisions.',
  finance:'Track approved budgets, commitments, and simulated settlements.'};
const sectionPath=(section,tab)=>'#'+section+'/'+tab;
const textStatus=value=>value?String(value).replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase()):'Not recorded';
const displayDate=value=>value==null?'Not recorded':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const linkAction=(text,href)=>overviewLink(text,href,'rt-btn rt-btn-secondary');
const snapshotJob=p=>p.workspace?.latestJob;
const projectUpdated=p=>Math.max(0,snapshotJob(p)?.updated_at??0,p.workspace?.imports?.[0]?.importedAt??0,
  p.workspace?.createdAt??0,...p.proposals.map(p=>p.proposal.approved_at??0),...p.history.map(e=>e.occurred_at??0));
const reviewLabel=status=>({ELIGIBLE_FOR_AUTHENTICATED_OWNER_APPROVAL:'Ready for owner review',BLOCKED:'Blocked',
  APPROVED_SYNTHETIC_DELIVERY:'Approved for synthetic delivery'}[status]||textStatus(status));
const eventLabel=event=>event.event_key?.startsWith('discord-specialist-')
  ?'Specialist activity observed · '+event.event_key.slice('discord-specialist-'.length)
  :textStatus(event.to_state||event.event_key);
const blockerLabel=value=>value.replaceAll('_',' ');
const deadline=p=>globalThis.RoomTreasuryWorkspace?.parseBrief(p.client.brief).deadline||'Not specified';

async function reviewSnapshots(){
  if(!state.session)return new Map();
  const linked=state.projects.flatMap(p=>(p.workspace?.imports||[]).map(i=>[i.id,p]));
  const projects=new Map(linked);
  const ids=[...new Set([...linked.map(([id])=>id),...state.imports.map(i=>i.id)])];
  const rows=await Promise.all(ids.map(async id=>{
    try{
      const review=await api('/v1/proposal-imports/'+encodeURIComponent(id)+'/review');
      const p=projects.get(id);
      return [id,p&&review.projectLink?.projectId!==p.client.id?null:review];
    }catch{return [id,null];}
  }));
  return new Map(rows);
}
function reviewFor(p,reviews){return reviews.get(p.workspace?.imports?.[0]?.id);}
function termsFor(p,reviews){
  const terms=reviewFor(p,reviews)?.revision?.proposal?.project;
  const commercial=commercialFor(p.client.id);
  return {proposed:commercial?.proposedCents??terms?.proposedRevenueCents??null,agreed:commercial?.agreedCents??null};
}
function stages(p,reviews){
  const job=snapshotJob(p), review=reviewFor(p,reviews);
  const record=p.workspace?.imports?.[0];
  if(p.client.status==='completed')return 'Completed';
  if(p.delivery)return 'Active Delivery';
  if(activeOverviewJobs.has(job?.state))return 'AI Analysis';
  if(review?.status==='APPROVED_SYNTHETIC_DELIVERY')return 'Approved / Ready';
  if(record)return 'Proposal Review';
  return 'Brief Intake';
}
function empty(text){return el('p','rt-data-empty',text);}
function descriptionList(entries){
  const dl=el('dl','rt-data-facts');
  for(const [label,value] of entries)dl.append(el('dt',null,label),el('dd',null,value));
  return dl;
}
function table(headers, rows){
  const wrapper=el('div','rt-data-scroll'),node=el('table','rt-data-table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  for(const h of headers){const th=el('th',null,h);th.scope='col';tr.append(th);}
  head.append(tr);
  for(const row of rows){
    const line=el('tr');
    for(const value of row){const cell=el('td');if(typeof value==='object'&&value!==null)cell.append(value);else cell.textContent=value??'—';line.append(cell);}
    body.append(line);
  }
  node.append(head,body);wrapper.append(node);return wrapper;
}
function searchControls(label,filters,draw){
  const controls=el('div','rt-data-controls'), input=el('input');
  input.type='search';input.placeholder=label;input.setAttribute('aria-label',label);controls.append(input);
  const selections=filters.map(([title,values])=>{
    const label=el('label',null,title),select=el('select');
    for(const [value,text] of values){const option=el('option',null,text);option.value=value;select.append(option);}
    label.append(select);controls.append(label);return select;
  });
  const update=()=>draw(input.value.trim().toLowerCase(),...selections.map(s=>s.value));
  input.addEventListener('input',update);
  selections.forEach(s=>s.addEventListener('change',update));
  update();return controls;
}
const matches=(q,...parts)=>!q||parts.some(p=>String(p??'').toLowerCase().includes(q));

function projectsPanel(reviews){
  const panel=el('div'),results=el('div','rt-data-panel');
  const projects=state.projects;
  panel.append(searchControls('Search projects or clients',[
    ['Status',[['','All stages'],...[...new Set(projects.map(p=>stages(p,reviews)))].map(v=>[v,v])]],
    ['Client',[['','All clients'],...[...new Set(projects.map(p=>p.client.client_name))].sort().map(v=>[v,v])]],
    ['Sort',[['updated','Recently updated'],['name','Project name'],['status','Status']]]
  ],(q,stage,client,sort)=>{
    const visible=projects.filter(p=>matches(q,projectTitle(p),p.client.client_name)&&(!stage||stages(p,reviews)===stage)&&(!client||p.client.client_name===client))
      .sort((a,b)=>sort==='name'?projectTitle(a).localeCompare(projectTitle(b)):sort==='status'?stages(a,reviews).localeCompare(stages(b,reviews)):projectUpdated(b)-projectUpdated(a));
    results.replaceChildren(visible.length?table(['Project','Client','Project status','Processing','Owner review','Revenue','Deadline','Last recorded activity',''],visible.map(p=>{
      const {proposed,agreed}=termsFor(p,reviews);
      return [projectTitle(p),p.client.client_name,textStatus(p.client.status),overviewStates[snapshotJob(p)?.state]||'No job',
        reviewLabel(reviewFor(p,reviews)?.status),proposed!=null?money(proposed)+' proposed':agreed!=null?money(agreed)+' agreed':!p.delivery?money(p.client.revenue_cents)+' intake target':'Not set',
        deadline(p),displayDate(projectUpdated(p)||null),linkAction('Open workspace',projectHref(p))];
    })):empty(projects.length?'No projects match these filters.':'No client projects yet. Create a project to get started.'));
  }),results);
  return panel;
}
function pipelinePanel(reviews){
  const board=el('div','rt-pipeline');board.setAttribute('aria-label','Project pipeline');board.tabIndex=0;
  for(const stage of ['Brief Intake','AI Analysis','Proposal Review','Approved / Ready','Active Delivery','Completed']){
    const list=state.projects.filter(p=>stages(p,reviews)===stage);
    const column=el('section','rt-pipeline-column'),title=el('div','rt-pipeline-heading');
    title.append(el('h2',null,stage),overviewBadge(String(list.length),stage==='Active Delivery'?'green':'neutral'));column.append(title);
    for(const p of list){
      const card=el('article','rt-pipeline-card'),job=snapshotJob(p),review=reviewFor(p,reviews);
      const {proposed,agreed}=termsFor(p,reviews);
      const attention=attentionOverviewJobs.has(job?.state)||review?.status==='BLOCKED';
      const brief=globalThis.RoomTreasuryWorkspace?.parseBrief(p.client.brief);
      const flags=el('div','rt-card-flags');
      flags.append(overviewBadge(textStatus(p.client.status),p.delivery?'green':'neutral'));
      if(attention)flags.append(overviewBadge('Needs attention','amber'));
      card.append(flags,el('p','rt-data-muted',p.client.client_name),el('h3',null,projectTitle(p)),
        el('p','rt-project-excerpt',brief?.description||p.client.brief),
        descriptionList([['Processing',overviewStates[job?.state]||'No job'],
          ['Owner review',reviewLabel(review?.status)],['Proposed revenue',money(proposed??(!p.delivery?p.client.revenue_cents:null))],
          ['Agreed revenue',money(agreed)],['Due',deadline(p)],['Updated',displayDate(projectUpdated(p)||null)]]),
        linkAction('Open project',projectHref(p)));
      column.append(card);
    }
    if(!list.length)column.append(empty('No projects at this stage.'));
    board.append(column);
  }
  if(globalThis.RoomTreasuryUI?.kanban){
    const names=['Brief Intake','AI Analysis','Proposal Review','Approved / Ready','Active Delivery','Completed'];
    const kinds=['backlog','todo','in-progress','review','review','done'];
    const columns=names.map((stage,index)=>({id:'stage-'+index,status:kinds[index],title:stage,cards:state.projects.filter(p=>stages(p,reviews)===stage).map(p=>({id:p.client.id,title:projectTitle(p),href:projectHref(p),tags:[{label:p.client.client_name,variant:'feature'}],date:deadline(p)}))}));
    board.replaceChildren();globalThis.RoomTreasuryUI.kanban(board,columns);
  }
  return board;
}

async function jobReports(holder,project,job,imported){
  const id=encodeURIComponent(imported.id);
  holder.append(el('h3',null,'Imported reports and artifacts'));
  try{
    const record=await api('/v1/proposal-imports/'+id);
    if(record.taskId!==project.workspace.taskId||imported.jobId!==job.id)throw Error('Result binding mismatch');
    const reports=record.proposal.specialistContributions;
    if(reports.length){
      holder.append(el('p','rt-data-muted','Specialist names and statuses come from the imported package. Individual agent identities are unverified.'));
      for(const report of reports){
        const detail=el('details','rt-data-detail');
        detail.append(el('summary',null,report.specialist+' · '+textStatus(report.status)));
        if(report.conclusion)detail.append(el('p',null,report.conclusion));
        if(report.findings?.length){
          const list=el('ul');for(const finding of report.findings)list.append(el('li',null,finding));detail.append(list);
        }
        if(report.sourceMessageIds.length)detail.append(descriptionList([['Source message IDs',report.sourceMessageIds.join(', ')]]));
        holder.append(detail);
      }
    }else holder.append(empty('No individual specialist reports are listed in this package.'));
    for(const [kind,filename,content] of [['proposal','proposal.json',record.proposal],['evidence','evidence.json',record.evidence],['summary','summary.md',record.summary]]){
      if(!content)continue;
      const path=record.normalization?.hashes?.[kind]?'original-artifacts/':'artifacts/';
      const link=linkAction('Download '+filename,'/v1/proposal-imports/'+id+'/'+path+kind);link.download=filename;holder.append(link);
    }
  }catch{holder.append(empty('The linked report package could not be loaded.'));}
}

async function jobDetails(panel,job,p){
  panel.replaceChildren(descriptionList([['Job ID',job.id],['Project task',p.workspace.taskId],['Correlation',job.correlation_id],['Transport',textStatus(job.transport)],
    ['Status',overviewStates[job.state]],['Attempt',String(job.attempt)],['Updated',displayDate(job.updated_at)],
    ['Error',job.error_code||'None recorded']]),linkAction('Open processing workspace',projectHref(p)+'#pw-analysis'));
  const imported=p.workspace.imports.find(i=>i.jobId===job.id);
  if(imported){
    panel.append(linkAction('Open proposal review',reviewHref(imported.id)));
    const reports=el('div','rt-data-job-reports');panel.append(reports);void jobReports(reports,p,job,imported);
  }
  const lifecycle=el('ol','rt-job-lifecycle');
  const phases=[['queued','Queued'],['dispatching','Dispatching'],['running','Running'],['collecting','Collecting'],['validating','Validating'],['outcome','Outcome']];
  const phaseOf=state=>state==='dispatched'?'dispatching':phases.some(([key])=>key===state)?state:'outcome';
  const nodes=new Map(phases.map(([key,label])=>[key,el('li',null,key==='outcome'&&phaseOf(job.state)==='outcome'?overviewStates[job.state]:label)]));
  nodes.get(phaseOf(job.state)).setAttribute('aria-current','step');
  lifecycle.setAttribute('aria-label','Processing lifecycle');
  lifecycle.append(...nodes.values());panel.append(lifecycle);
  const timeline=el('ol','rt-data-timeline'),next=el('button','rt-btn rt-btn-secondary','Load more events'),notice=el('p','rt-data-muted');
  notice.setAttribute('role','status');next.hidden=true;panel.append(el('h3',null,'Recorded timeline'),notice,timeline,next);
  let cursor=null;
  async function page(){
    next.disabled=true;notice.textContent='Loading events…';
    try{
      const result=await api('/v1/processing-jobs/'+encodeURIComponent(job.id)+'/events'+(cursor?'?after='+encodeURIComponent(cursor):''));
      for(const event of result.events){
        if(event.to_state)nodes.get(phaseOf(event.to_state)).dataset.recorded='true';
        const item=el('li');
        item.append(el('strong',null,eventLabel(event)),el('span',null,[displayDate(event.occurred_at??event.created_at),event.actor_id,event.code].filter(Boolean).join(' · ')));
        timeline.append(item);
      }
      cursor=result.nextCursor;next.hidden=!cursor||result.events.length<50;
      notice.textContent=timeline.children.length?'':'No processing events were returned.';
    }catch{notice.textContent='The authorized event history could not be loaded.';}
    finally{next.disabled=false;}
  }
  next.addEventListener('click',page);
  await page();
}
async function agentsPanel(){
  const panel=el('div','rt-data-panel');
  panel.append(el('h2',null,'Processing runs'),el('p','rt-data-muted','Discord jobs target Make Proposal Agent. Specialist activity is shown where recorded in job events or imported reports.'));
  const projects=state.projects.filter(snapshotJob);
  const results=await Promise.all(projects.map(async p=>{
    try{
      const response=await api('/v1/client-projects/'+encodeURIComponent(p.client.id)+'/processing-jobs');
      return {p,jobs:response.jobs,failed:false};
    }catch{return {p,jobs:[snapshotJob(p)],failed:true};}
  }));
  for(const {p,jobs,failed} of results){
    const group=el('section','rt-data-job-group');
    group.append(el('h3',null,projectTitle(p)),el('p','rt-data-muted',p.client.client_name));
    if(failed)group.append(empty('Older attempts could not be loaded.'));
    for(const job of jobs){
      const detail=el('details','rt-data-detail'),body=el('div','rt-data-detail-body');
      detail.append(el('summary',null,'Attempt '+job.attempt+' · '+textStatus(job.transport)+' · '+(overviewStates[job.state]||textStatus(job.state))),body);
      detail.addEventListener('toggle',()=>{if(detail.open&&!body.children.length)void jobDetails(body,job,p);});
      group.append(detail);
    }
    panel.append(group);
  }
  if(!projects.length)panel.append(empty(state.session?'No processing jobs recorded for your projects.':'Sign in to view authorized processing jobs.'));
  const view=el('div','rt-data-stack');view.append(fleetOverview(),panel);return view;
}
function metric(label,value,description){
  const host=el('div','rt-metric-island');
  host.append(el('p',null,label),el('strong',null,value),el('small',null,description));
  globalThis.RoomTreasuryUI?.metric(host,{label,value,description});
  return host;
}
function financeOverview(reviews){
  const view=el('div','rt-finance-overview'),grid=el('div','rt-finance-grid');
  const delivery=state.projects.filter(p=>p.delivery);
  const sum=key=>delivery.reduce((n,p)=>n+p.delivery[key],0);
  const agreed=state.projects.map(p=>termsFor(p,reviews).agreed).filter(n=>n!=null);
  const commercial=state.commercial?.totals;
  const scoped=key=>commercial?money(commercial[key]):'Sign in to view';
  for(const [label,value,description] of [
    ['Contracted revenue',scoped('contractedCents'),'Owner-recorded signed agreements'],
    ['Cash received',scoped('cashCents'),state.commercial?.demo?'Synthetic receipts · no real cash':'Owner-recorded receipts · no bank feed'],
    ['Accounts receivable',scoped('receivableCents'),'Outstanding issued invoices'],
    ['Overdue invoices',commercial?String(commercial.overdueCount):'Sign in to view','Unpaid invoices past their due date'],
    ['Approved delivery budgets',delivery.length?money(sum('budget')):'Not set','Authorized delivery budget'],
    ['Available delivery capacity',delivery.length?money(sum('available')):'Not set','Remaining approved internal budget'],
    ['Confirmed commitments',delivery.length?money(sum('committed')):'Not set','Confirmed delivery obligations'],
    ['Recorded expenses',scoped('expenseCents'),'Owner-recorded costs, separate from simulation']
  ])grid.append(metric(label,value,description));
  if(delivery.some(p=>p.client.client_name.includes('[SYNTHETIC DEMO]')))view.append(el('p','rt-data-muted','Financial totals include records marked [SYNTHETIC DEMO].'));
  view.append(grid);
  const buckets=[['Available','emerald','available'],['Committed','amber','committed'],['Reserved','sky','reserved'],['Simulated spending','violet','spent']];
  const colors={emerald:['stroke-emerald-600','bg-emerald-600'],amber:['stroke-amber-500','bg-amber-500'],
    sky:['stroke-sky-600','bg-sky-600'],violet:['stroke-violet-500','bg-violet-500']};
  const categories=buckets.filter(([, ,key])=>sum(key)>0).map(([name,color,key])=>({name,amount:sum(key)/100,stroke:colors[color][0],dot:colors[color][1]}));
  const lower=el('div','rt-finance-lower'),breakdown=el('section','rt-data-panel'),activity=el('section','rt-data-panel');
  breakdown.append(el('h2',null,'Delivery budget breakdown'));
  if(categories.length&&globalThis.RoomTreasuryUI){const host=el('div');breakdown.append(host);globalThis.RoomTreasuryUI.ring(host,categories);}
  else if(categories.length)breakdown.append(descriptionList(categories.map(c=>[c.name,money(c.amount*100)])));
  else breakdown.append(empty('No approved delivery budgets to chart.'));
  activity.append(el('h2',null,'Recent financial activity'));
  const latest=state.projects.flatMap(p=>p.history.map(e=>({p,e}))).sort((a,b)=>b.e.occurred_at-a.e.occurred_at).slice(0,6);
  activity.append(latest.length?table(['Event','Project','Date'],latest.map(({p,e})=>[textStatus(e.action),projectTitle(p),displayDate(e.occurred_at)])):empty('No financial activity has been recorded.'));
  activity.append(el('p','rt-data-muted','Cash-flow and income trends require recorded cash receipts.'));
  lower.append(breakdown,activity);
  const projects=el('section','rt-data-panel');projects.append(el('h2',null,'Project financial breakdown'));
  projects.append(delivery.length?table(['Project','Approved budget','Committed','Spent (simulated)','Recorded expenses','Available'],
    delivery.map(p=>[overviewLink(projectTitle(p),projectHref(p)),money(p.delivery.budget),money(p.delivery.committed),money(p.delivery.spent),money(commercialFor(p.client.id)?.expenseCents),money(p.delivery.available)]))
    :empty('No approved project budgets to compare.'));
  const cashCharts=el('div','rt-finance-lower');cashCharts.append(commercialChart(),invoiceChart());
  view.append(lower,cashCharts,projects);return view;
}
function ledgerPanel(reviews){
  const panel=el('div'),results=el('div','rt-data-panel');
  panel.append(searchControls('Search project ledger',[
    ['Budget',[['','All projects'],['approved','Approved delivery'],['pending','No approved delivery']]],
    ['Sort',[['name','Project name'],['available','Available budget'],['agreed','Agreed revenue']]]
  ],(q,budget,sort)=>{
    const projects=state.projects.filter(p=>matches(q,projectTitle(p),p.client.client_name)&&(!budget||Boolean(p.delivery)===(budget==='approved')))
      .sort((a,b)=>sort==='available'?(b.delivery?.available??-1)-(a.delivery?.available??-1):sort==='agreed'?(termsFor(b,reviews).agreed??-1)-(termsFor(a,reviews).agreed??-1):projectTitle(a).localeCompare(projectTitle(b)));
    results.replaceChildren(projects.length?table(['Project','Client','Proposed revenue','Agreed revenue','Received cash','Approved budget','Committed','Reserved','Spent (simulated)','Available','Details'],
      projects.map(p=>{
        const terms=termsFor(p,reviews),detail=el('details','rt-ledger-details');
        detail.append(el('summary',null,'View record'),descriptionList([['Project ID',p.client.id],['Owner review',reviewLabel(reviewFor(p,reviews)?.status)],['Projected gross margin',money(p.projectedGrossMarginCents)]]),linkAction('Open workspace',projectHref(p)));
        return [projectTitle(p),p.client.client_name,money(terms.proposed),money(terms.agreed),money(commercialFor(p.client.id)?.cashCents),
          money(p.approvedDeliveryBudgetCents),...['committed','reserved','spent','available'].map(key=>money(p.delivery?.[key])),detail];
      })):empty('No matching project ledger records.'));
  }),results);return panel;
}
function budgetsPanel(){
  const panel=el('div','rt-data-stack'),projects=state.projects.filter(p=>p.allocations.length);
  for(const p of projects){
    const card=el('section','rt-data-panel');
    card.append(el('h2',null,projectTitle(p)),descriptionList([['Approved delivery budget',money(p.delivery.budget)],['Committed',money(p.delivery.committed)],['Reserved',money(p.delivery.reserved)],['Simulated spending',money(p.delivery.spent)],['Available',money(p.delivery.available)]]));
    if(p.allocations.length)card.append(table(['Workstream','Limit','Committed','Reserved','Simulated spending','Available','Limit used'],p.allocations.map(a=>{
      const progress=el('progress');progress.max=a.limitCents;progress.value=a.limitCents-a.available;progress.setAttribute('aria-label',a.name+' allocation used');
      return [a.name,money(a.limitCents),money(a.committed),money(a.reserved),money(a.spent),money(a.available),progress];
    })));
    panel.append(card);
  }
  if(!projects.length)panel.append(empty('No workstream allocations are recorded.'));
  return panel;
}
function transactionsPanel(){
  const panel=el('div'),results=el('div','rt-data-panel'),receipts=state.projects.flatMap(p=>p.receipts.map(r=>({p,r})));
  panel.append(searchControls('Search settlements by project, ID, or purpose',[
    ['Project',[['','All projects'],...[...new Map(receipts.map(({p})=>[p.client.id,projectTitle(p)]))]]],
    ['Sort',[['recent','Newest first'],['old','Oldest first'],['amount','Highest amount']]]
  ],(q,id,sort)=>{
    const visible=receipts.filter(({p,r})=>(!id||id===p.client.id)&&matches(q,projectTitle(p),r.id,r.purpose))
      .sort((a,b)=>sort==='amount'?b.r.amount_cents-a.r.amount_cents:sort==='old'?a.r.settled_at-b.r.settled_at:b.r.settled_at-a.r.settled_at);
    let page=0;
    function draw(){
      results.replaceChildren();
      if(!visible.length){results.append(empty(receipts.length?'No settlements match these filters.':'No settlement receipts have been recorded.'));return;}
      results.append(table(['Transaction ID','Project','Type','Amount','Date','Status','Source'],visible.slice(page*10,page*10+10).map(({p,r})=>{
        const detail=el('details','rt-ledger-details'),host=el('div','rt-receipt-island');
        detail.append(el('summary',null,r.id),host);
        host.append(descriptionList([['Receipt ID',r.id],['Request',r.request_id],['Purpose',r.purpose],['Amount',money(r.amount_cents)]]));
        let mounted=false;
        detail.addEventListener('toggle',()=>{if(detail.open&&!mounted&&globalThis.RoomTreasuryUI){
          const card=el('div');host.prepend(card);globalThis.RoomTreasuryUI.receipt(card,{amountCents:r.amount_cents,recipient:r.recipient_id,id:r.id,timestamp:displayDate(r.settled_at)});mounted=true;
        }});
        return [detail,projectTitle(p),'Settlement',money(r.amount_cents),displayDate(r.settled_at),'Simulated','Settlement receipt'];
      })));
      const nav=el('div','rt-data-controls'),prev=el('button','rt-btn rt-btn-secondary','Previous'),next=el('button','rt-btn rt-btn-secondary','Next');
      prev.disabled=page===0;next.disabled=(page+1)*10>=visible.length;
      prev.addEventListener('click',()=>{page--;draw();});
      next.addEventListener('click',()=>{page++;draw();});
      nav.append(prev,el('span',null,'Page '+(page+1)+' of '+Math.ceil(visible.length/10)),next);results.append(nav);
    }
    draw();
  }),results);return panel;
}
function queuePanel(reviews){
  const panel=el('div'),results=el('div','rt-data-panel');
  const list=new Map(state.imports.map(i=>[i.id,i]));
  for(const p of state.projects)for(const i of p.workspace?.imports||[])list.set(i.id,{...list.get(i.id),...i,client:p.client.client_name,project:projectTitle(p),p});
  const entries=[...list.values()].sort((a,b)=>b.importedAt-a.importedAt);
  const statuses=[...new Set(entries.map(i=>reviews.get(i.id)?.status).filter(Boolean))];
  panel.append(searchControls('Search proposal queue',[['Owner review',[['','All statuses'],...statuses.map(s=>[s,reviewLabel(s)])]]],(q,status)=>{
    const rows=entries.filter(i=>matches(q,i.client,i.project,i.id)&&(!status||reviews.get(i.id)?.status===status)).map(i=>{
      const r=reviews.get(i.id),job=i.p&&snapshotJob(i.p),blockers=el('ul','rt-blocker-list');
      for(const blocker of r?.blockers||[])blockers.append(el('li',null,blockerLabel(blocker)));
      return [i.project,i.client,'Rev '+i.revision,displayDate(i.importedAt),money(r?.revision?.proposal?.project?.proposedRevenueCents),
        reviewLabel(r?.status),r?(blockers.children.length?blockers:'None recorded'):'Unavailable',overviewStates[job?.state]||'Not recorded',
        linkAction('Inspect proposal','#operations/proposals/'+encodeURIComponent(i.id))];
    });
    results.replaceChildren(rows.length?table(['Project','Client','Revision','Imported','Proposed revenue','Owner review','Blockers','Latest processing',''],rows)
      :empty(state.session?'No matching proposal imports.':'Sign in to see owner-scoped reviews.'));
  }),results);return panel;
}
function importPanel(){
  const panel=el('div','rt-data-panel');
  panel.append(el('h2',null,'Import an agent package'),el('p',null,'Upload → Validate → Preview → Confirm import. Imports remain available for owner review.'));
  if(!state.session)panel.append(linkAction('Owner sign-in','/owner-login'));
  else{
    for(const p of state.projects.filter(p=>p.workspace))panel.append(linkAction('Upload for '+projectTitle(p),projectHref(p)+'#pw-upload'));
    panel.append(linkAction('Open manual import workspace','/proposal-imports'));
  }
  return panel;
}
function approvalPanel(reviews){
  const rows=[...reviews.entries()].flatMap(([id,r])=>(r?.reviewActivity||[])
    .map(event=>({id,event,project:r.revision.proposal.project.name})))
    .sort((a,b)=>b.event.occurred_at-a.event.occurred_at||b.event.id-a.event.id);
  const panel=el('div','rt-data-panel');
  panel.append(el('h2',null,'Owner review history'),rows.length?table(['Project','Review revision','Action','Owner','Date','Audit reference',''],rows.map(({id,event,project})=>[project,
    String(event.revision),event.action==='revise'?'Revision created':reviewLabel(event.decision),event.owner_id,
    displayDate(event.occurred_at),'#'+event.id,linkAction('Open review',reviewHref(id))]))
    :empty('No authenticated owner decisions or revisions are visible.'));
  return panel;
}

function projectBudgets(reviews){
  const panel=el('div','rt-data-stack');
  panel.append(ledgerPanel(reviews),budgetsPanel(),commitmentsPanel());return panel;
}
function commitmentsPanel(){
  const panel=el('div'),results=el('div','rt-data-panel');
  const records=state.projects.flatMap(p=>p.commitments.map(c=>({p,c})));
  panel.append(searchControls('Search commitments by project or purpose',[
    ['Status',[['','All obligations'],['proposed','Pending'],['confirmed','Confirmed']]]
  ],(q,status)=>{
    const rows=records.filter(({p,c})=>matches(q,projectTitle(p),c.purpose)&&(!status||status===c.state));
    results.replaceChildren(rows.length?table(['Project','Purpose','Amount','Status','Confirmed by'],rows.map(({p,c})=>[
      overviewLink(projectTitle(p),projectHref(p)),c.purpose,money(c.amount_cents),
      overviewBadge(c.state==='confirmed'?'Confirmed':'Pending',c.state==='confirmed'?'green':'amber'),c.confirmed_by||'Awaiting confirmation'
    ])):empty(records.length?'No obligations match these filters.':'No commitments have been recorded.'));
  }),results);return panel;
}

function fleetOverview(){
  const panel=el('section','rt-data-panel rt-fleet-map'),workflow=el('div','rt-workflow');
  panel.append(el('h2',null,'Orchestration workflow'),el('p','rt-data-muted','Configured roles. RoomTreasury tracks processing jobs and imported reports. Individual agent presence is unavailable.'));
  const coordinator=el('div','rt-fleet-card rt-fleet-coordinator');
  coordinator.append(icon('bot',20),el('strong',null,'Make Proposal Agent'),el('small',null,'Coordinates analysis and consolidates specialist findings.'));
  const group=el('div','rt-fleet-specialists');
  for(const [name,role,symbol] of [
    ['Request Agent','Clarifies client requirements and deliverables.','file'],
    ['Challenge Agent','Reviews assumptions, constraints, and risks.','shield'],
    ['Commitment Intelligence Agent','Checks capacity and existing obligations.','folder'],
    ['Treasury Operations Agent','Analyzes costs, allocations, and treasury implications.','wallet']
  ]){
    const card=el('div','rt-fleet-card');card.append(icon(symbol,19),el('strong',null,name),el('small',null,role));group.append(card);
  }
  workflow.append(coordinator,el('p','rt-workflow-connector','Delegates analysis ↓ · Findings return ↑'),group);
  const jobs=state.projects.map(snapshotJob).filter(Boolean),active=jobs.filter(j=>activeOverviewJobs.has(j.state)).length;
  panel.append(workflow,descriptionList([['Tracked active jobs',state.session?String(active):'Sign in to view'],
    ['Last recorded update',displayDate(jobs.reduce((date,j)=>Math.max(date,j.updated_at),0)||null)],
    ['Recorded transport',jobs.length?[...new Set(jobs.map(j=>textStatus(j.transport)))].join(', '):'Not recorded']]));
  return panel;
}
function fieldTree(value,key=''){
  if(value==null)return el('span','rt-data-muted','Not set');
  if(Array.isArray(value)){
    if(!value.length)return el('span','rt-data-muted','None recorded');
    const list=el('ul','rt-field-list');
    for(const entry of value){const item=el('li');item.append(fieldTree(entry,key));list.append(item);}return list;
  }
  if(typeof value==='object'){
    const fields=el('dl','rt-field-tree');
    for(const [name,entry] of Object.entries(value)){fields.append(el('dt',null,textStatus(name.replace(/([a-z])([A-Z])/g,'$1 $2'))));const dd=el('dd');dd.append(fieldTree(entry,name));fields.append(dd);}
    return fields;
  }
  return el('span',null,typeof value==='number'&&key.endsWith('Cents')?money(value):String(value));
}
async function proposalPanel(reviews,selectedId){
  const view=el('div','rt-data-stack');
  view.append(queuePanel(reviews));
  const imports=importPanel();const upload=el('details','rt-data-panel rt-data-detail');
  upload.append(el('summary',null,'Import or recover an artifact package'),imports);view.append(upload);
  if(!selectedId)return view;
  const details=el('section','rt-data-panel rt-proposal-detail');
  details.id='proposal-detail';view.prepend(details);
  const visible=state.imports.find(i=>i.id===selectedId)||state.projects.flatMap(p=>p.workspace?.imports||[]).find(i=>i.id===selectedId);
  if(!visible){details.append(empty('This proposal is unavailable to the current session.'));return view;}
  try{
    const record=await api('/v1/proposal-imports/'+encodeURIComponent(selectedId));
    const review=reviews.get(selectedId);
    const bound=state.projects.find(p=>p.workspace?.imports.some(i=>i.id===selectedId));
    if(record.id!==selectedId||(bound&&record.taskId!==bound.workspace.taskId))throw Error('Proposal binding mismatch');
    const shown=review?.revision?.proposal||record.proposal;
    const verified=review?.verifications?.some(v=>v.gate==='revenue_payment_terms'&&v.fingerprint===review.revision.fingerprint)&&!review.blockers?.some(b=>b.endsWith('revenue_payment_terms'));
    const agreed=bound?commercialFor(bound.client.id)?.agreedCents??null:verified?shown.project.agreedRevenueCents:null;
    const headline=el('div','rt-card-flags');
    headline.append(overviewBadge('Imported','neutral'),overviewBadge(review?reviewLabel(review.status):'Owner review unavailable',review?.status==='BLOCKED'?'amber':'neutral'));
    details.append(headline,el('h2',null,shown.project.name),el('p','rt-data-muted',shown.client.name+' · Import revision '+record.revision+
      (review?' · Review revision '+review.revision.revision:'')));
    const grid=el('div','rt-proposal-metrics');
    grid.append(metric('Proposed revenue',money(shown.project.proposedRevenueCents),'Commercial estimate'),
      metric('Agreed revenue',money(agreed),'Verified client terms'),metric('Estimated delivery budget',money(shown.proposal.budgetCents),'Proposal estimate'),
      metric('Estimated gross margin',agreed!=null?money(agreed-shown.proposal.budgetCents):'Not set','Based on verified agreed revenue'));
    details.append(grid);
    const identityCard=el('div','rt-record-flip');details.append(identityCard);globalThis.RoomTreasuryUI?.flip(identityCard,'Exact review identity','Task '+record.taskId+' · Import '+record.id+' · Review revision '+(review?.revision?.revision??'not available')+' · Fingerprint '+(review?.revision?.fingerprint??'not available')); 
    const blocks=review?.blockers||[];
    if(blocks.length){
      const warning=el('div','rt-review-alert'),list=el('ul');
      for(const block of blocks)list.append(el('li',null,blockerLabel(block)));
      warning.append(el('strong',null,'Owner review requirements'),list);details.append(warning);
    }
    const controls=el('div','rt-card-flags');
    controls.append(linkAction('Open authenticated review',reviewHref(selectedId)));
    if(bound)controls.append(linkAction('Open project',projectHref(bound)));
    details.append(controls);
    const sections=globalThis.RoomTreasuryWorkspace?.proposalSections({proposal:shown})||[];
    for(const [name,value] of [...sections,['Evidence and provenance',{normalization:record.normalization,summary:record.summary,evidence:record.evidence}]]){
      const group=el('details','rt-data-detail');group.append(el('summary',null,name),fieldTree(value));details.append(group);
    }
    const artifacts=el('div','rt-artifact-list');
    for(const [kind,name,content] of [['proposal','proposal.json',record.proposal],['evidence','evidence.json',record.evidence],['summary','summary.md',record.summary]]){
      if(!content)continue;
      const path=record.normalization?.hashes?.[kind]?'original-artifacts/':'artifacts/';
      const link=linkAction('Download '+name,'/v1/proposal-imports/'+encodeURIComponent(selectedId)+'/'+path+kind);link.download=name;artifacts.append(link);
    }
    details.append(artifacts);
  }catch{details.append(empty('This proposal could not be opened. Refresh or open it from its project workspace.'));}
  return view;
}
async function approvalCentre(reviews){
  const panel=el('div','rt-data-stack'),pending=el('section','rt-data-panel');
  const open=[...reviews].filter(([,r])=>r&&[reviewReady,'BLOCKED'].includes(r.status));
  pending.append(el('h2',null,'Owner decision queue'),el('p','rt-data-muted','Only eligible revisions can proceed through authenticated owner review.'));
  for(const [id,r] of open){
    const item=el('details','rt-data-detail');
    item.append(el('summary',null,r.revision.proposal.client.name+' · '+r.revision.proposal.project.name+' · '+reviewLabel(r.status)));
    if(r.blockers.length){const list=el('ul','rt-blocker-list');for(const b of r.blockers)list.append(el('li',null,blockerLabel(b)));item.append(list);}
    item.append(linkAction('Review exact revision','#operations/proposals/'+encodeURIComponent(id)));pending.append(item);
  }
  if(!open.length)pending.append(empty('No pending or blocked reviews are visible.'));
  const workflows=await Promise.all(state.projects.filter(p=>p.workspace).map(async p=>{
   try{return {p,state:await api('/v1/client-projects/'+encodeURIComponent(p.client.id)+'/approval-workflow')};}catch{return {p,state:null};}
  }));
  const items=el('section','rt-data-panel');items.append(el('h2',null,'Project approval workflow'));
  for(const {p,state:workflow} of workflows){
   const article=el('article','rt-data-detail'),current=workflow?.gates.find(g=>g.status!=='approved');
   article.append(el('strong',null,projectTitle(p)),el('p',null,workflow?.active?'Activated':current?textStatus(current.id)+' · '+textStatus(current.status):'Unavailable'),
    linkAction('Open approval timeline',projectHref(p)+'#pw-approvals'));
   items.append(article);
  }
  panel.append(items,pending,approvalPanel(reviews));return panel;
}
async function auditPanel(reviews){
  const panel=el('div','rt-data-panel'),items=[],jobs=[];
  const add=(at,label,subject,href,type)=>{if(at!=null)items.push({at,label,subject,href,type});};
  const scopes=await Promise.allSettled(state.projects.filter(p=>p.workspace?.latestJob).map(async p=>({
    p,jobs:(await api('/v1/client-projects/'+encodeURIComponent(p.client.id)+'/processing-jobs')).jobs
  })));
  for(const result of scopes)if(result.status==='fulfilled')for(const job of result.value.jobs)jobs.push([result.value.p,job]);
  let partial=scopes.some(result=>result.status==='rejected');
  const events=await Promise.allSettled(jobs.map(async ([p,job])=>({
    p,job,page:await api('/v1/processing-jobs/'+encodeURIComponent(job.id)+'/events?limit=100')
  })));
  partial||=events.some(result=>result.status==='rejected'||result.value.page.events.length===100);
  for(const result of events)if(result.status==='fulfilled'){
    const {p,job,page}=result.value;
    for(const e of page.events)add(e.occurred_at,eventLabel(e)+(e.code?' · '+textStatus(e.code):''),projectTitle(p)+' · Attempt '+job.attempt,projectHref(p)+'#pw-activity','Processing');
  }
  for(const p of state.projects){
    if(p.workspace)add(p.workspace.createdAt,p.workspace.bindingSource==='owner_onboarding'?'Project intake created':'Existing project linked',projectTitle(p),projectHref(p),'Project');
    for(const e of p.history)add(e.occurred_at,textStatus(e.action),projectTitle(p),projectHref(p),'Financial');
  }
  for(const i of state.imports)add(i.importedAt,'Proposal imported · revision '+i.revision,i.project,'#operations/proposals/'+encodeURIComponent(i.id),'Import');
  for(const [id,r] of reviews)for(const e of r?.reviewActivity||[])add(e.occurred_at,e.action==='revise'?'Review revision created':reviewLabel(e.decision),r.revision.proposal.project.name,'#operations/proposals/'+encodeURIComponent(id),'Owner review');
  items.sort((a,b)=>b.at-a.at);
  panel.append(el('h2',null,'Recorded activity'),el('p','rt-data-muted','Read-only timeline built from the records available to this session.'));
  if(partial)panel.append(empty('Some job events could not be shown here. Open an individual run in Agent Fleet for its event pages.'));
  const results=el('div');
  panel.append(searchControls('Search recorded activity',[['Category',[['','All categories'],...[...new Set(items.map(i=>i.type))].map(type=>[type,type])]]],(q,type)=>{
    const filtered=items.filter(i=>(!type||i.type===type)&&matches(q,i.subject,i.label));
    const list=el('ol','rt-audit-timeline');let visible=30;
    const more=el('button','rt-btn rt-btn-secondary','Show more events');
    const draw=()=>{
      list.replaceChildren(...filtered.slice(0,visible).map(i=>{
        const entry=el('li');entry.append(overviewBadge(i.type,'neutral'),el('strong',null,i.label),overviewLink(i.subject,i.href),el('time',null,displayDate(i.at)));return entry;
      }));
      more.hidden=filtered.length<=visible;
    };
    more.addEventListener('click',()=>{visible+=30;draw();});draw();
    results.replaceChildren(filtered.length?list:empty('No matching audit activity.'),more);
  }),results);
  return panel;
}

async function renderSection(section,tab,selectedImport){
  const view=el('div','rt-section-view'),header=el('header','rt-section-heading'),copy=el('div');
  copy.append(el('p','rt-section-kicker','RoomTreasury workspace'),el('h1',null,sectionNames[section]),el('p','rt-data-muted',sectionDescriptions[section]));
  header.append(copy);
  const refresh=el('button','rt-btn rt-btn-secondary','Refresh');refresh.prepend(icon('refresh',15));
  refresh.addEventListener('click',async()=>{refresh.disabled=true;try{await loadDashboardData();if(refresh.isConnected)await renderRoute();}
    catch{refresh.textContent='Refresh failed · retry';refresh.disabled=false;}});
  header.append(refresh);view.append(header);
  const needsReviews=!['discord','fleet','transactions','commitments'].includes(tab);
  const reviews=needsReviews?await reviewSnapshots():new Map();
  let panel;
  if(section==='projects')panel=tab==='board'?pipelinePanel(reviews):projectsPanel(reviews);
  if(section==='finance'){
    if(tab==='transactions'){panel=el('div','rt-data-stack');panel.append(cashPanel(),transactionsPanel());}
    else panel=tab==='commitments'?commitmentsPanel():tab==='budgets'?projectBudgets(reviews):tab==='invoices'?invoicesPanel():financeOverview(reviews);
  }
  if(section==='operations')panel=tab==='discord'?await discordConsole():tab==='fleet'?await agentsPanel():tab==='proposals'?await proposalPanel(reviews,selectedImport):tab==='approvals'?await approvalCentre(reviews):await auditPanel(reviews);
  const host=el('div','rt-section-tabs'),fallback=el('nav','rt-tab-fallback');
  fallback.setAttribute('aria-label',sectionNames[section]+' sections');
  const crumb=el('div','rt-breadcrumb');view.prepend(crumb);globalThis.RoomTreasuryUI?.breadcrumb(crumb,[{label:'Workspace',href:'/'},{label:sectionNames[section]}]);
  const items=sectionTabs[section].map(([id,label])=>{
    const link=overviewLink(label,sectionPath(section,id));if(id===tab)link.setAttribute('aria-current','page');fallback.append(link);return {id,label};
  });
  host.append(fallback,panel);view.append(host);
  globalThis.RoomTreasuryUI?.tabs(host,items,tab,panel,id=>{location.hash=sectionPath(section,id).slice(1);});
  return view;
}
function legacyProjectView(id){
  const p=state.projects.find(p=>p.client.id===id),view=el('div','rt-section-view'),panel=el('section','rt-data-panel');
  if(!p){panel.append(el('h1',null,'Project unavailable'),linkAction('Back to projects','#projects/all'));return panel;}
  const brief=globalThis.RoomTreasuryWorkspace?.parseBrief(p.client.brief);
  panel.append(el('h1',null,projectTitle(p)),el('p',null,brief?.description||p.client.brief),
    descriptionList([['Client',p.client.client_name],['Project status',textStatus(p.client.status)],['Desired deadline',deadline(p)],
      ['Scope',brief?.requirements||'Not recorded'],['Deliverables',brief?.deliverables||'Not recorded']]));
  if(p.workspace)panel.append(linkAction('Open owner workspace',projectHref(p)));
  else if(!state.session)panel.append(linkAction('Owner sign-in','/owner-login'));
  panel.append(linkAction('Back to projects','#projects/all'));view.append(panel);
  const finance=el('section','rt-data-panel');
  finance.append(el('h2',null,'Financial summary'),descriptionList([['Agreed revenue',money(commercialFor(p.client.id)?.agreedCents)],
    ['Approved delivery budget',money(p.approvedDeliveryBudgetCents)],['Committed obligations',money(p.delivery?.committed)],
    ['Reserved funds',money(p.delivery?.reserved)],['Simulated spending',money(p.delivery?.spent)],['Available',money(p.delivery?.available)]]));
  if(p.allocations.length)finance.append(table(['Workstream','Approved limit','Available'],p.allocations.map(a=>[a.name,money(a.limitCents),money(a.available)])));
  view.append(finance);return view;
}
`;
