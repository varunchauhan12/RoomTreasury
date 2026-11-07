export const commercialScript=String.raw`
function commercialFor(id){return state.commercial?.projects.find(p=>p.projectId===id);}
function commercialProjectName(id){const project=state.projects.find(p=>p.client.id===id);return project?projectTitle(project):id;}
const commercialLink=(id,invoice)=>'/projects/'+encodeURIComponent(id)+(invoice?'#invoice-'+encodeURIComponent(invoice):'#pw-commercial');
function commercialRecords(kind){
 return (state.commercial?.projects||[]).flatMap(p=>kind==='invoices'
  ?p.invoices.map(record=>({id:p.projectId,record}))
  :p.entries.map(record=>({id:p.projectId,record})));
}
function commercialTable(kind,rows= commercialRecords(kind)){
 if(!state.session)return empty('Sign in as owner to see commercial records.');
 if(!rows.length)return empty(kind==='invoices'?'No invoices recorded.':'No cash receipts or expenses recorded.');
 if(kind==='invoices')return table(['Invoice','Project','Status','Issued','Due','Amount','Paid','Outstanding'],rows.map(({id,record:r})=>[
  overviewLink(r.number,commercialLink(id,r.id)),commercialProjectName(id),overviewBadge(textStatus(r.status),r.overdue?'amber':r.status==='paid'?'green':'neutral'),
  r.issuedOn||'—',r.due_on,money(r.amount_cents),money(r.paidCents),money(r.outstandingCents)
 ]));
 return table(['Date','Project','Type','Reference','Method','Amount'],rows.map(({id,record:r})=>[
  r.paid_on,overviewLink(commercialProjectName(id),'/projects/'+encodeURIComponent(id)+'#cash-'+encodeURIComponent(r.id)),r.kind==='receipt'?'Recorded receipt':'Recorded expense',r.reference,r.method,money(r.amount_cents)
 ]));
}
function invoicesPanel(){
 const panel=el('section','rt-data-panel');
 panel.append(el('h2',null,'Invoices & Receivables'),el('p','rt-data-muted','Outstanding balances come from issued invoices and their allocated receipts.'));
 if(state.commercial?.demo)panel.append(overviewBadge('DEMO · Synthetic records','amber'));
 const holder=el('div');
 panel.append(searchControls('Search invoice or project',[
  ['Status',[['','All statuses'],...['draft','issued','partially_paid','overdue','paid','cancelled'].map(s=>[s,textStatus(s)])]]
 ],(query,status)=>holder.replaceChildren(commercialTable('invoices',commercialRecords('invoices').filter(({id,record})=>
  matches(query,record.number,commercialProjectName(id))&&(!status||record.status===status))))),holder);
 return panel;
}
function cashPanel(){
 const panel=el('section','rt-data-panel');
 panel.append(el('h2',null,'Recorded cash and expenses'),el('p','rt-data-muted',state.commercial?.demo?'DEMO · These sample receipts represent no real cash.':'Owner-recorded entries. RoomTreasury has no bank feed.'),commercialTable('entries'));
 return panel;
}
function commercialChart(){
 const panel=el('section','rt-data-panel'),months=new Map();
 panel.append(el('h2',null,'Monthly recorded financial activity'));
 for(const {record} of commercialRecords('entries')){
  const month=record.paid_on.slice(0,7),entry=months.get(month)||{receipts:0,expenses:0};
  entry[record.kind==='receipt'?'receipts':'expenses']+=record.amount_cents;months.set(month,entry);
 }
 if(!months.size){panel.append(empty('Record cash receipts or expenses to see monthly activity.'));return panel;}
 const chart=el('div');panel.append(chart);globalThis.RoomTreasuryUI?.chart(chart,[...months].sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,entry])=>({date:month+'-01',label:'Cash received',value:entry.receipts/100})),'USD cash received');
 const max=Math.max(...[...months.values()].flatMap(v=>[v.receipts,v.expenses]));
 for(const [month,entry] of [...months].sort(([a],[b])=>a.localeCompare(b)).slice(-12)){
  const group=el('div','rt-commercial-month');group.append(el('strong',null,month));
  for(const [label,value] of [['Cash recorded',entry.receipts],['Expenses recorded',entry.expenses]]){
   const line=el('div'),bar=el('progress');bar.max=max;bar.value=value;bar.setAttribute('aria-label',month+' '+label+' '+money(value));
   line.append(el('span',null,label+' · '+money(value)),bar);group.append(line);
  }
  panel.append(group);
 }
 return panel;
}
function invoiceChart(){
 const panel=el('section','rt-data-panel'),invoices=commercialRecords('invoices').map(item=>item.record);
 panel.append(el('h2',null,'Invoice payment status'));
 if(!invoices.length){panel.append(empty('Invoice payment status appears after you record invoices.'));return panel;}
 for(const status of ['draft','issued','partially_paid','overdue','paid','cancelled']){
  const count=invoices.filter(invoice=>invoice.status===status).length;
  if(!count)continue;
  const row=el('div','rt-commercial-month'),bar=el('progress');
  bar.max=invoices.length;bar.value=count;bar.setAttribute('aria-label',textStatus(status)+' invoices: '+count);
  row.append(el('strong',null,textStatus(status)+' · '+count),bar);panel.append(row);
 }
 return panel;
}
function commercialOverview(){
 const view=el('div','ov-grid'),pipeline=el('section','ov-panel'),dates=el('section','ov-panel'),payments=el('section','ov-panel');
 pipeline.append(el('h2',null,'Client pipeline'));
 const projects=state.commercial?.projects||[];
 if(projects.length)pipeline.append(table(['Project','Client stage','Proposed','Contracted'],projects.map(p=>[
  overviewLink(commercialProjectName(p.projectId),commercialLink(p.projectId)),textStatus(p.stage),money(p.proposedCents),money(p.agreedCents)
 ])));
 else pipeline.append(empty(state.session?'No owner-scoped client projects.':'Sign in to view your client pipeline.'));
 dates.append(el('h2',null,'Invoice due dates'),commercialTable('invoices',commercialRecords('invoices').filter(({record})=>record.outstandingCents>0)
  .sort((a,b)=>a.record.due_on.localeCompare(b.record.due_on)).slice(0,5)));
 payments.append(el('h2',null,'Recent recorded payments'),commercialTable('entries',commercialRecords('entries').filter(({record})=>record.kind==='receipt')
  .sort((a,b)=>b.record.paid_on.localeCompare(a.record.paid_on)).slice(0,5)));
 view.append(pipeline,dates,payments);return view;
}
`;

export const commercialWorkspaceScript=String.raw`
function commercialWorkspace(id){
 const host=$('pw-commercial-details'),status=$('pw-commercial-sync');
 let latest=null,last='',busy=false,knownProject=JSON.stringify(project),knownReview=null;
 let retained=null,requestKey=null,writing=false;
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('roomtreasury-commercial'):null;
 const path='/v1/client-projects/'+encodeURIComponent(id)+'/commercial';
 const projectPath='/v1/client-projects/'+encodeURIComponent(id);
 const label=s=>s.replaceAll('_',' ');
 function row(name,value){const item=el('li');item.append(el('strong',name+' · '),document.createTextNode(value));return item;}
 function render(s){
  setWorkspaceCommercial(s);
  host.replaceChildren();
  const stats=el('dl');stats.className='pw-grid pw-finance-metrics';
  for(const [name,value] of [['Client stage',label(s.stage)],['Proposed revenue',s.proposedCents==null?'Not set':M.money(s.proposedCents)],
   ['Agreed contract amount',s.agreedCents==null?'Not set':M.money(s.agreedCents)],['Issued invoices',M.money(s.invoicedCents)],
   ['Cash receipts recorded',M.money(s.cashCents)],['Receivables',M.money(s.receivableCents)],
   ['Expenses recorded',M.money(s.expenseCents)],['Recorded cash margin',s.recordedMarginCents==null?'Available after closeout':M.money(s.recordedMarginCents)]])detail(stats,name,value);
  host.append(stats,el('p','Cash entries are owner-recorded. RoomTreasury has no bank feed or payment execution.'));
  if(s.agreement)host.append(el('p','Agreement signed '+s.agreement.signed_on+' · '+s.agreement.terms+' · Evidence: '+s.agreement.reference));
  if(s.quotes.length){
   const list=el('ul');
   for(const q of s.quotes){
    const item=row('Revision '+q.revision,M.money(q.amount_cents)+' · '+q.reference);
    if(q.import_id)item.append(document.createTextNode(' '),link('Linked proposal','/proposal-imports?id='+encodeURIComponent(q.import_id)));
    list.append(item);
   }
   host.append(el('h3','Submitted proposals'),list);
  }
  const invoices=tagged('article','pw-card');invoices.append(el('h3','Invoices'));
  if(!s.invoices.length)invoices.append(empty('No invoices have been recorded.'));
  for(const invoice of s.invoices){
   const card=el('details');card.id='invoice-'+invoice.id;
   card.append(el('summary',invoice.number+' · '+label(invoice.status)+' · '+M.money(invoice.outstandingCents)+' outstanding'),
    el('p',M.money(invoice.amount_cents)+' invoiced · '+M.money(invoice.paidCents)+' recorded against invoice · Due '+invoice.due_on+
      (invoice.issuedOn?' · Issued '+invoice.issuedOn:'')));
   if(invoice.status==='draft')card.append(actionForm('Issue invoice','invoice_issue',[['date','Issue date','date']],{invoiceId:invoice.id}));
   if(invoice.outstandingCents>0)card.append(actionForm('Record invoice receipt','receipt',cashFields(),{invoiceId:invoice.id}));
   if(invoice.status!=='cancelled'&&!invoice.paidCents)card.append(actionForm('Cancel invoice','invoice_cancel',[['reference','Reason or evidence']],{invoiceId:invoice.id}));
   invoices.append(card);
  }
  host.append(invoices);
  for(const [kind,title] of [['receipt','Receipt history'],['expense','Expenses']]){
   const card=tagged('article','pw-card'),list=tagged('ul','pw-list');
   card.append(el('h3',title));host.append(card);
   for(const entry of s.entries.filter(entry=>entry.kind===kind)){
    const item=row(M.money(entry.amount_cents),entry.paid_on+' · '+entry.method+' · '+entry.reference);
    item.className='pw-list-row';item.id='cash-'+entry.id;list.append(item);
   }
   card.append(list.children.length?list:empty('No '+(kind==='receipt'?'receipts':'expenses')+' recorded.'));
  }
  if(['inquiry','revision_requested','agreement_confirmed'].includes(s.stage)){
   host.append(actionForm('Record proposal submission','submit',[['amountCents','Proposed amount (USD)','number'],['reference','Proposal document or submission reference']]));
   if(project.workspace.imports.length){
    const chosen=project.workspace.imports[0];
    host.append(actionForm('Record submission of current imported revision','submit',[['reference','Proposal submission evidence']],{importId:chosen.id}));
   }
  }
  if(s.stage==='submitted'){
   host.append(actionForm('Record client acceptance','accept',[['reference','Client acceptance evidence']],{quoteId:s.quote.id}),
    actionForm('Record revision request','revision_requested',[['reference','Client revision request evidence']],{quoteId:s.quote.id}));
  }
  if(s.stage==='accepted')host.append(actionForm('Confirm signed agreement','agreement',
   [['signedOn','Agreement date','date'],['terms','Payment terms'],['reference','Signed agreement reference']],{quoteId:s.quote.id,amountCents:s.quote.amount_cents}));
  if(s.agreement&&s.stage!=='completed')host.append(actionForm('Create invoice draft','invoice_draft',[['number','Invoice number'],['amountCents','Invoice amount (USD)','number'],['dueOn','Due date','date']]),
   actionForm('Record unapplied cash receipt','receipt',cashFields()),actionForm('Record expense','expense',cashFields()));
  if(s.stage==='agreement_confirmed')host.append(el('p','Recording delivery progress does not activate a delivery budget.'),actionForm('Record delivery start','delivery_start',[['reference','Delivery start reference']]));
  if(s.stage==='delivery')host.append(actionForm('Record project completion','complete',[['reference','Completion reference']]));
  if(location.hash.startsWith('#invoice-')){const card=$(location.hash.slice(1));if(card)card.open=true;}
  if(s.events.length){
   const list=el('ol');
   for(const event of s.events)list.append(row(label(event.action),new Date(event.occurred_at).toLocaleString()+' · '+(event.evidence||event.target_id)));
   host.append(el('h3','Commercial audit trail'),list);
  }
 }
 const cashFields=()=>[['amountCents','Amount (USD)','number'],['date','Date recorded on evidence','date'],['method','Method'],['reference','Unique payment evidence reference']];
 function actionForm(title,action,fields,fixed={}){
  const form=el('form'),disclosure=el('details'),button=el('button',title),message=el('p');
  disclosure.append(el('summary',title),form);
  for(const [name,label,type='text'] of fields){
   const wrapper=el('label',label),field=el('input');field.name=name;field.type=type;field.required=true;
   if(type==='number'){field.min='0.01';field.max='10000000';field.step='0.01';}
   else if(type==='text')field.maxLength=name==='terms'?2000:name==='number'||name==='method'?80:500;
   wrapper.append(field);form.append(wrapper);
  }
  message.setAttribute('role','status');form.append(button,message);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(writing)return;writing=true;button.disabled=true;
   try{
    const input={action,...fixed,...Object.fromEntries(new FormData(form))};
    if(typeof input.amountCents==='string'){
     if(!/^\d+(?:\.\d{1,2})?$/.test(input.amountCents))throw Error('Enter an amount with at most two decimal places.');
     const [units,fraction='']=input.amountCents.split('.');input.amountCents=Number(units)*100+Number(fraction.padEnd(2,'0'));
    }
    if(input.importId){
     const review=await api('/v1/proposal-imports/'+encodeURIComponent(input.importId)+'/review');
     if(review.projectLink?.projectId!==id)throw Error('Proposal belongs to a different project.');
     input.revisionId=review.revision.id;input.fingerprint=review.revision.fingerprint;
     input.amountCents=review.revision.proposal.project.proposedRevenueCents??review.revision.proposal.project.agreedRevenueCents;
    }
    const signature=JSON.stringify(input);
    if(signature!==retained){retained=signature;requestKey=crypto.randomUUID();}
    latest=await api(path,input,requestKey);
    channel?.postMessage('commercial-updated');
    retained=null;requestKey=null;last=new Date().toLocaleTimeString();status.textContent='Recorded · '+last;render(latest);
   }catch(error){message.textContent=error.message.replaceAll('_',' ');}
   finally{writing=false;button.disabled=false;}
  });
  return disclosure;
 }
 async function poll(force=false){
  if(busy||writing||(!force&&document.hidden))return;
  busy=true;status.textContent='Syncing…';
  try{
   const [snapshot,next]=await Promise.all([api(path,undefined,undefined,!force),api(projectPath,undefined,undefined,!force)]);
   if(!next.workspace)throw Error('Project binding is unavailable.');
   $('pw-workspace').hidden=false;
   const signature=JSON.stringify(next);
   if(signature!==knownProject){knownProject=signature;await loadProject(id,next);}
   if(!latest||JSON.stringify(latest)!==JSON.stringify(snapshot)){
    if(force||!host.contains(document.activeElement)||!document.activeElement.closest('form')){
     latest=snapshot;render(snapshot);
    }
   }
   const imported=next.workspace.imports.find(i=>i.id===selectedImport);
   if(imported&&!$('pw-results').hidden){
    const review=await api('/v1/proposal-imports/'+encodeURIComponent(imported.id)+'/review',undefined,undefined,!force);
    const change=JSON.stringify([review.revision.fingerprint,review.status,review.blockers]);
    if(change!==knownReview){knownReview=change;const node=$('pw-live-review');node.textContent='Owner review: '+review.status+' · '+review.blockers.length+' blockers';}
   }
   last=new Date().toLocaleTimeString();status.textContent='Updated '+last;
  }catch(error){
   status.textContent=last?'Reconnecting · last update '+last:'Offline · unable to refresh';
  }finally{busy=false;}
 }
 const timer=setInterval(()=>void poll(),6000);
 channel?.addEventListener('message',()=>void poll());
 $('pw-commercial-refresh').addEventListener('click',()=>void poll(true));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll();});
 addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);channel?.close();}});
 void poll();
}
`;
