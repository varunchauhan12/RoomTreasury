export const approvalWorkspaceScript=String.raw`
function approvalWorkspace(id){
 const host=$('pw-approval-details'),notice=$('pw-approval-status');
 const base='/v1/client-projects/'+encodeURIComponent(id)+'/approval-workflow';
 let signature='',busy=false,writing=false;
 const labels={intake:'1 · Intake Authorization',proposal:'2 · AI Proposal Review',commercial:'3 · Commercial Approval',
  financial:'4 · Financial and Delivery Approval',activation:'5 · Final Project Activation'};
 function requestForm(state,gate){
  const form=el('form'),reason=el('textarea'),evidence=el('textarea'),decision=el('select'),sections=el('select'),result=el('p'),button=el('button','Record owner decision');
  const label=(name,field)=>{const l=el('label',name);l.append(field);form.append(l);};
  reason.required=true;reason.maxLength=4000;evidence.required=true;evidence.maxLength=12000;
  for(const action of gate.actions){const option=el('option',action==='changes'?'Request changes':action==='blocked'?'Block pending evidence':action==='approve'?'Approve': 'Reject');option.value=action;decision.append(option);}
  sections.multiple=true;sections.size=6;
  for(const [value,name] of [['scope','Scope and deliverables'],['risks','Risk findings'],['capacity','Capacity and commitments'],['costs','Financial estimates'],['commercial','Commercial assumptions'],['evidence','Evidence package']]){
   const option=el('option',name);option.value=value;sections.append(option);
  }
  const checklist=el('fieldset');checklist.append(el('legend','Owner verification checklist'));
  for(const check of gate.checks){const wrapper=el('label'),input=el('input');input.type='checkbox';input.value=check;input.name='checks';wrapper.append(input,document.createTextNode(check.replaceAll('_',' ')));checklist.append(wrapper);}
  form.append(checklist);
  label('Decision',decision);label('Reason',reason);label('Supporting evidence references (one per line)',evidence);label('Affected sections for requested changes',sections);
  button.type='submit';result.setAttribute('role','status');form.append(button,result);
  let retained='',key='';
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(writing)return;writing=true;button.disabled=true;
   try{
    const input={gate:gate.id,subjectHash:gate.subjectHash,decision:decision.value,reason:reason.value.trim(),checks:[...checklist.querySelectorAll('input:checked')].map(input=>input.value),evidence:evidence.value.split('\n').map(s=>s.trim()).filter(Boolean),
     ...(decision.value==='changes'?{sections:[...sections.selectedOptions].map(o=>o.value)}:{})};
    const next=JSON.stringify(input);if(next!==retained){retained=next;key=crypto.randomUUID();}
    const response=await api(base+'/decisions',input,key);
    render(response);notice.textContent='Owner decision recorded.';signature='';
   }catch(error){result.textContent=error.message.replaceAll('_',' ');}
   finally{writing=false;button.disabled=false;}
  });
  return form;
 }
 function reportView(report){
  const saved=JSON.parse(report.snapshot),proposal=saved.review?.revision?.proposal;
  const d=el('details');d.append(el('summary','Report '+report.version+' · '+new Date(report.created_at).toLocaleString()),el('p','SHA-256 '+report.snapshot_hash));
  const facts=el('dl');facts.className='pw-grid';
  const fact=(label,value)=>detail(facts,label,value??'Not recorded');
  fact('Client',saved.project?.client_name??proposal?.client.name);
  fact('Project',proposal?.project.name??saved.projectId);
  fact('Exact proposal revision',report.revision_id);
  fact('Fingerprint',report.fingerprint);
  fact('Commercial agreement',saved.commercial?.agreement?.reference);
  fact('Contract value',saved.commercial?.agreedCents==null?'Unconfirmed':M.money(saved.commercial.agreedCents));
  fact('Estimated delivery budget',proposal?M.money(proposal.proposal.budgetCents):null);
  fact('Approved delivery budget',saved.financial?.delivery?M.money(saved.financial.delivery.budget):'Not activated');
  fact('Final activation',saved.active?'Authorized':'Pending');
  d.append(facts);
  if(saved.financial?.allocations){
   const allocations=el('ul');for(const a of saved.financial.allocations)allocations.append(el('li',a.name+' · '+M.money(a.limitCents)));
   d.append(el('h3','Approved workstream limits'),allocations);
  }
  if(proposal){
   for(const [name,value] of M.proposalSections({proposal})){
    const section=el('details');section.append(el('summary',name),tree(value));d.append(section);
   }
  }
  const decisions=el('ul');
  for(const decision of saved.decisions||[])decisions.append(el('li',labels[decision.gate]+' · '+decision.decision+' · '+decision.owner_id+' · '+decision.reason));
  d.append(el('h3','Owner decisions'),decisions);
  const blockers=el('ul');
  for(const gate of saved.gates||[])for(const blocker of gate.blockers)blockers.append(el('li',labels[gate.id]+' · '+blocker));
  if(blockers.children.length)d.append(el('h3','Outstanding conditions'),blockers);
  const original=el('details');original.append(el('summary','Full immutable report record'),el('pre',JSON.stringify(saved,null,2)));d.append(original);
  return d;
 }
 function render(state){
  host.replaceChildren();
  const heading=el('p','Exact revision: '+(state.review?.revision.id||'Intake')+' · '+(state.review?.revision.fingerprint||state.gates[0].subjectHash));heading.className='pw-ids';host.append(heading);
  if(state.review)host.append(link('Review facts and verify evidence','/proposal-imports?id='+encodeURIComponent(state.review.revision.import_id)));
  host.append(link('Commercial quote and signed agreement','#pw-commercial'));
  const timeline=el('ol');
  for(const gate of state.gates){
   const item=el('li'),detail=el('details');
   const text=gate.status.replaceAll('_',' ');
   detail.append(el('summary',labels[gate.id]+' · '+text),el('p','Assigned owner: '+gate.reviewer));
   if(gate.decision)detail.append(el('p',gate.decision.reason+' · '+new Date(gate.decision.created_at).toLocaleString()));
   if(gate.blockers.length){const list=el('ul');for(const b of gate.blockers)list.append(el('li',b));detail.append(list);}
   if(gate.actions.length&&!state.active)detail.append(requestForm(state,gate));
   item.append(detail);timeline.append(item);
  }
  host.append(timeline);
  if(state.analysis){
   const a=state.analysis;host.append(el('h3','Analysis revision '+a.revision),el('p',a.instructions),
    el('p','Affected specialists: '+a.specialists.join(', ')),el('p',a.pending?'Awaiting revised artifact package':'New artifact package imported'));
   if(a.pending&&!a.job){
    const button=el('button','Authorize coordinator re-analysis');
    button.type='button';const key=crypto.randomUUID();
    button.addEventListener('click',async()=>{
     if(writing)return;writing=true;button.disabled=true;
     try{
      const response=await api(base+'/reanalyze',{},key);
      notice.textContent='Analysis revision queued · '+response.job.id;await loadProject(id);signature='';
     }catch(error){notice.textContent=error.message.replaceAll('_',' ');button.disabled=false;}
     finally{writing=false;}
    });
    host.append(button);
   }
  }
  const history=el('details');history.append(el('summary','Decision history'));
  for(const d of state.decisions){
   const entry=el('p',labels[d.gate]+' · '+d.decision+' · '+d.reason+' · '+new Date(d.created_at).toLocaleString());
   history.append(entry,el('p','Revision '+(d.revision_id||'Intake')+' · '+d.owner_id+' · '+JSON.parse(d.evidence).join(', ')));
  }
  host.append(history);
  const reports=el('details'),list=el('div');reports.append(el('summary','Versioned approval reports'),list);
  reports.addEventListener('toggle',async()=>{
   if(!reports.open||list.children.length)return;
   try{
    const response=await api(base+'/reports');
    for(const report of response.reports){
     list.append(reportView(report));
    }
    if(!response.reports.length)list.append(el('p','No saved report yet.'));
   }catch(error){list.append(el('p',error.message));}
  });
  const refresh=el('button','Regenerate current report');refresh.type='button';
  refresh.addEventListener('click',async()=>{refresh.disabled=true;try{render(await api(base+'/reports',{}));}catch(error){notice.textContent=error.message;}finally{refresh.disabled=false;}});
  host.append(refresh,reports);
 }
 async function refresh(){
  if(busy||writing||document.hidden)return;
  busy=true;
  try{
   const state=await api(base,undefined,undefined,true),next=JSON.stringify(state);
   if(next!==signature&&!host.querySelector('details[open]')){render(state);signature=next;}
   notice.textContent='Updated '+new Date().toLocaleTimeString()+' · Approval eligibility verified by backend';
  }catch(error){notice.textContent='Unable to refresh approval workflow. '+error.message;}
  finally{busy=false;}
 }
 const timer=setInterval(()=>void refresh(),6000);
 addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);});
 void refresh();
}
`;
