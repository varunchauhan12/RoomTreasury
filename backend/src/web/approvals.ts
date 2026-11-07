export const approvalWorkspaceScript=String.raw`
const stage3GateOrder=['intake','proposal','commercial','financial','activation'];
const stage3GateNames={intake:'Intake',proposal:'Proposal',commercial:'Commercial terms',financial:'Financial review',activation:'Activation'};
const stage3CategorySections={requirements:['scope'],price:['costs','commercial'],deliverables:['scope'],scope:['scope'],timeline:['capacity'],other:['evidence']};
const stage3CategoryNames={requirements:'Requirements',price:'Price',deliverables:'Deliverables',scope:'Scope',timeline:'Timeline',other:'Other'};
function approvalWorkspace(id){
 const base='/v1/client-projects/'+encodeURIComponent(id)+'/approval-workflow';
 let state=null,signature='',busy=false,evidenceCache={id:null,record:null},revisionRecorded=false;
 const status=()=>$('pw-approval-status'),feedback=()=>$('pw-approve-feedback'),revisionFeedback=()=>$('pw-revision-feedback');
 function showTab(name){
  const review=name==='review';
  $('pw-stage3-review-panel').hidden=!review;
  $('pw-stage3-revision-panel').hidden=review;
  $('pw-stage3-tab-review').setAttribute('aria-selected',String(review));
  $('pw-stage3-tab-revision').setAttribute('aria-selected',String(!review));
 }
 function reviewCard(name,value,open=false){
  const card=tagged('details','pw-stage3-card');if(open)card.open=true;
  const summary=el('summary');summary.append(el('span',name),tagged('span','pw-stage3-chevron','\u25be'));card.append(summary,tree(value));return card;
 }
 async function renderReview(){
  const host=$('pw-stage3-review');host.replaceChildren();
  if(!state?.review){
   host.append(empty(state?.active?'This project is already approved.':'No imported agent proposal yet. Agent results will appear here once a package is imported.'));
   return;
  }
  const proposal=state.review.revision.proposal;
  const projectCard=tagged('article','pw-stage3-card pw-stage3-summary');
  projectCard.append(el('h3','Project overview'));
  const facts=tagged('dl','pw-facts');
  const brief=M.parseBrief(state.project?.brief??proposal.project?.brief??'');
  detail(facts,'Client',state.project?.client_name??proposal.client?.name);
  detail(facts,'Project',proposal.project?.name);
  detail(facts,'Requested deadline',brief.deadline);
  detail(facts,'Recorded intake price',state.project?M.money(state.project.revenue_cents):null);
  projectCard.append(facts);
  if(brief.requirements)projectCard.append(el('h4','Original project requirements'),tagged('p','pw-prose',brief.requirements));
  host.append(projectCard);
  M.proposalSections({proposal}).forEach(([name,value],index)=>host.append(reviewCard(name,value,index===0)));
  const importId=state.review.revision.import_id;
  if(importId){
   if(evidenceCache.id!==importId){
    try{evidenceCache={id:importId,record:await api('/v1/proposal-imports/'+encodeURIComponent(importId),undefined,undefined,true)};}
    catch{evidenceCache={id:importId,record:null};}
   }
   if(state?.review?.revision.import_id===importId&&evidenceCache.record?.evidence)host.append(reviewCard('Evidence',evidenceCache.record.evidence));
  }
 }
 function render(){
  if(!state)return;
  setWorkspaceApprovals(state);
  void renderReview();
  const button=$('pw-approve-project');
  button.disabled=busy||state.active;
  button.textContent=state.active?'Project Approved':'Approve the Project';
  if(status())status().textContent=state.active?'Project approved and active.':state.review?'Review the agent proposal below, then approve or request a revision.':'Waiting for imported agent results.';
 }
 async function refresh(passive=false){
  if(busy)return;
  try{
   const next=await api(base,undefined,undefined,passive);
   const nextSignature=JSON.stringify([next.active,next.review?.revision.id,next.review?.revision.fingerprint,next.gates.map(g=>[g.id,g.status])]);
   state=next;
   if(nextSignature!==signature){signature=nextSignature;render();}
  }catch(error){if(status())status().textContent='Unable to load the review. '+error.message;}
 }
 async function approveProject(){
  if(busy)return;
  busy=true;render();
  if(feedback())feedback().textContent='Approving the project…';
  try{
   for(const gateId of stage3GateOrder){
    state=await api(base,undefined,undefined,true);
    if(state.active)break;
    const gate=state.gates.find(g=>g.id===gateId);
    if(!gate||gate.status==='approved')continue;
    if(gate.blockers.length)throw Error(stage3GateNames[gateId]+' needs attention: '+gate.blockers.join(' '));
    if(!gate.actions.includes('approve'))throw Error(stage3GateNames[gateId]+' cannot be approved yet. Review the requirements for this step and try again.');
    state=await api(base+'/decisions',{gate:gateId,subjectHash:gate.subjectHash,decision:'approve',
     reason:'Owner approved the project from the Stage 3 review.',evidence:['Owner reviewed the imported agent proposal in Stage 3'],checks:[...gate.checks]},crypto.randomUUID());
   }
   state=await api(base,undefined,undefined,true);signature='';render();
   if(state.active){if(feedback())feedback().textContent='Project approved and activated.';}
   else{
    const pending=state.gates.find(g=>g.status!=='approved');
    if(feedback())feedback().textContent=pending?'Not approved yet: '+(stage3GateNames[pending.id]||pending.id)+(pending.blockers.length?' — '+pending.blockers.join(' '):' is not ready.'):'Approval recorded. Activation is pending.';
   }
  }catch(error){if(feedback())feedback().textContent=error.message.replaceAll('_',' ');}
  finally{busy=false;render();}
 }
 async function sendRevision(event){
  event.preventDefault();
  if(busy)return;
  const selected=[...document.querySelectorAll('[data-revision-category]:checked')].map(input=>input.dataset.revisionCategory);
  const instructions=$('pw-revision-instructions').value.trim();
  if(!selected.length){revisionFeedback().textContent='Select at least one revision category.';return;}
  if(instructions.length<10){revisionFeedback().textContent='Describe what you want the agents to revise (at least a short sentence).';return;}
  busy=true;$('pw-send-revision').disabled=true;
  try{
   if(!revisionRecorded){
    state=await api(base,undefined,undefined,true);
    if(!state.review)throw Error('There is no imported agent proposal to revise yet.');
    const gate=state.gates.find(g=>g.id==='proposal');
    const sections=[...new Set(selected.flatMap(category=>stage3CategorySections[category]||['evidence']))];
    const reason='Revision categories: '+selected.map(category=>stage3CategoryNames[category]).join(', ')+'\n\n'+instructions;
    state=await api(base+'/decisions',{gate:'proposal',subjectHash:gate.subjectHash,decision:'changes',reason,
     evidence:['Owner revision request from Stage 3'],sections},crypto.randomUUID());
    revisionRecorded=true;
   }
   revisionFeedback().textContent='Dispatching your revision to the agents through Discord…';
   const result=await api(base+'/reanalyze',{},crypto.randomUUID());
   revisionRecorded=false;signature='';
   revisionFeedback().textContent='Revision dispatched to the coordinator and specialist agents through Discord. New results will appear for this project; the previous proposal is not approved.';
   await refresh(true);
   if(typeof loadProject==='function'){try{await loadProject(id);}catch{/* Revision already dispatched; Stage 2 refreshes on its own poll. */}}
  }catch(error){
   revisionFeedback().textContent=(revisionRecorded?'Revision recorded, but dispatch needs attention: ':'Could not send the revision: ')+error.message.replaceAll('_',' ');
  }finally{busy=false;$('pw-send-revision').disabled=false;}
 }
 $('pw-stage3-tab-review').addEventListener('click',()=>showTab('review'));
 $('pw-stage3-tab-revision').addEventListener('click',()=>showTab('revision'));
 $('pw-approve-project').addEventListener('click',()=>void approveProject());
 $('pw-revision-form').addEventListener('submit',event=>void sendRevision(event));
 const timer=setInterval(()=>{if(!document.hidden&&!busy&&document.activeElement?.id!=='pw-revision-instructions')void refresh(true);},6000);
 addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(timer);});
 void refresh();
}
`;
