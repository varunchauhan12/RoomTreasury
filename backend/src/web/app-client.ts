import {discordConsoleScript} from './discord-console.js';
import { commercialScript } from './commercial.js';
import { sectionsScript } from './sections.js';
import { overviewScript } from './overview.js';

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
  commercial:null,
  activeRoute:'overview'
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
    const message=data.error?.message;
    const err=Error(message&&message!=='Request rejected.'?message:(data.error?.code||'Request failed')+' (HTTP '+res.status+').');
    err.code=data.error?.code;
    throw err;
  }
  return data;
}

// Router & Route Switcher
function updateSidebarActive(){
  $('rt-sidebar').closest('.rt-shell').dataset.route=state.activeRoute;
  document.querySelectorAll('.rt-nav-item').forEach(item=>{
    const nav=item.getAttribute('data-nav');
    const active=nav===resolveSection(state.activeRoute,location.hash.slice(1).split('?')[0].split('/')[1]).section;
    item.classList.toggle('active',active);
    if(active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  });
  const breadcrumbActive=$('rt-breadcrumb-active');
  if(breadcrumbActive){
    const titles={overview:'Overview',finance:'Finance & Economics',agency:'Agency Operations',projects:'Projects',workspace:'Project Workspace',agents:'AI Agent Operations',proposals:'Proposal Reviews',approvals:'Approval Centre',transactions:'Financial Transactions',audit:'Activity & Audit',settings:'Settings & Security'};
    breadcrumbActive.textContent=sectionNames[resolveSection(state.activeRoute,location.hash.slice(1).split('?')[0].split('/')[1]).section]||titles[state.activeRoute]||'Overview';
  }
}

${overviewScript}

${discordConsoleScript}
${sectionsScript}

${commercialScript}

function renderSettingsView(){
  const view=el('div','rt-view-container');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'Settings & Owner Account'),el('p',null,'Local environment isolation, owner credentials, and active task scopes.'));
  header.append(titles);
  view.append(header);

  if(document.querySelector('[data-local-workspace]')){
    titles.replaceChildren(el('h1',null,'Settings'),el('p',null,'RoomTreasury runs as a shared workspace on this computer.'));
    return view;
  }
  const card=el('div','rt-card');
  card.append(el('h3','rt-card-title','Authenticated Session'));
  const dl=el('dl','rt-meta-list');
  dl.append(
    el('dt',null,'Owner ID'),el('dd',null,state.session?.ownerId||'Signed out'),
    el('dt',null,'Session protection'),el('dd',null,state.session?.csrfToken?'Active':'Sign in required')
  );
  card.append(dl);

  const outBtn=el('a','rt-btn rt-btn-secondary','Go to Owner Sign-In');
  outBtn.hidden=!!state.session?.demoAccess;
  outBtn.href='/owner-login';
  card.append(outBtn);

  view.append(card);
  return view;
}

let renderVersion=0;
let projectIntakeOpen=false;
let activeSectionFrame=null;
let overviewFrame=null;
const localDemo=()=>!!document.querySelector('.rt-demo-access-banner');

const NEW_PROJECT_HASH='#projects/new';
const ALL_PROJECTS_HASH='#projects/all';
function mountProjectIntake(host){
  const model=globalThis.RoomTreasuryWorkspace;
  const submission=model.submission(async(payload,key)=>{
    state.session=await model.intakeSession(localDemo());
    return api('/v1/client-projects/onboard',{method:'POST',body:JSON.stringify(payload),key});
  },()=>crypto.randomUUID());
  const initiallyOpen=location.hash.split('?')[0]===NEW_PROJECT_HASH;
  if(initiallyOpen)projectIntakeOpen=true;
  globalThis.RoomTreasuryUI.projectIntake(host,{
    initiallyOpen,
    demo:localDemo(),
    submit:fields=>submission.run(model.intake(fields)),
    onOpenChange:open=>{projectIntakeOpen=open;},
    onBack:()=>{
      projectIntakeOpen=false;
      if(location.hash!==ALL_PROJECTS_HASH)location.hash=ALL_PROJECTS_HASH.slice(1);
      else void renderRoute();
    },
    onCreated:async id=>{
      const href='/projects/'+encodeURIComponent(id);
      try{await loadDashboardData();}
      catch{/* The project already exists. Its workspace loads independently. */}
      location.assign(href);
    }
  });
}

let newProjectFrame=null;
function newProjectView(){
  const view=el('div','rt-view-container rt-new-project-view');
  const back=el('a','rt-btn rt-btn-secondary','\u2190 Back to All Projects');
  back.href=ALL_PROJECTS_HASH;
  back.setAttribute('data-back-to-all-projects','');
  const header=el('div','rt-page-header');
  const titles=el('div','rt-page-title-group');
  titles.append(el('h1',null,'New Project'),el('p',null,'Create a new client project.'));
  header.append(titles);
  const cross=el('a','rt-new-project-close','\u00d7');
  cross.href=ALL_PROJECTS_HASH;
  cross.setAttribute('aria-label','Close and go to All Projects');
  cross.title='Close \u2014 All Projects';
  view.append(cross,back,header);
  if(state.session||localDemo()){
    const host=el('div','rt-intake-entry');
    view.append(host);
    if(globalThis.RoomTreasuryUI?.projectIntake)mountProjectIntake(host);
    else view.append(el('p',null,'Project intake is unavailable.'));
  }else view.append(linkAction('Owner sign-in','/owner-login'));
  return view;
}


// Main Router
async function renderRoute(){
  const content=$('rt-content');
  if(!content)return;
  const [route='overview',sub,selection]=location.hash.slice(1).split('?')[0].split('/');
  if(route==='projects'&&sub==='new'){
    if(newProjectFrame?.view.isConnected&&projectIntakeOpen)return;
    if(!newProjectFrame?.view.isConnected){
      activeSectionFrame=null;
      newProjectFrame={view:newProjectView()};
      content.replaceChildren(newProjectFrame.view);
    }
    return;
  }
  newProjectFrame=null;
  if(projectIntakeOpen)projectIntakeOpen=false;
  const version=++renderVersion;
  const {section,tab}=resolveSection(route,sub);
  let frame=null;
  try{
    const id=sub?decodeURIComponent(sub):null;
    const legacy=(route==='projects'||route==='workspace')&&id&&!sectionTabs.projects.some(([key])=>key===id);
    if(!legacy&&tab&&Object.hasOwn(sectionTabs,section)){
      if(activeSectionFrame?.section!==section||!activeSectionFrame.view.isConnected){
        activeSectionFrame=sectionFrame(section);
        content.replaceChildren(activeSectionFrame.view);
      }
      frame=activeSectionFrame;
      selectSectionTab(frame,tab);
      frame.panel.setAttribute('aria-busy','true');
      const panel=await sectionPanel(section,tab,route==='proposals'?id:selection?decodeURIComponent(selection):null);
      if(version===renderVersion){
        frame.panel.replaceChildren(panel);
        frame.panel.removeAttribute('aria-busy');
      }
      return;
    }
    activeSectionFrame=null;
    if(!legacy&&route!=='settings'){
      if(!overviewFrame?.view.isConnected){
        overviewFrame=createOverviewView();
        content.replaceChildren(overviewFrame.view);
      }
      overviewFrame.update();
      return;
    }
    const viewNode=legacy?legacyProjectView(id):renderSettingsView();
    if(version===renderVersion)content.replaceChildren(viewNode);
  }catch{
    if(version!==renderVersion)return;
    const message=el('section','rt-data-panel');
    message.append(el('h2',null,'Workspace unavailable'),el('p',null,'This view could not load. Use Refresh to try again.'));
    if(frame){
      frame.panel.replaceChildren(message);
      frame.panel.removeAttribute('aria-busy');
    }else content.replaceChildren(message);
  }
}

async function loadDashboardData(passive=false){
  const options=passive?{headers:{'X-RoomTreasury-Passive':'1'}}:{};
  let session;
  if(document.querySelector('[data-local-workspace]'))session={ownerId:'local-workspace',demoAccess:true};
  else{
    const response=await fetch('/v1/owner-auth/session',{cache:'no-store',...options});
    if(!response.ok&&response.status!==401)throw Error('Owner session unavailable');
    session=response.ok?await response.json():localDemo()?await globalThis.RoomTreasuryWorkspace.intakeSession(true):null;
  }
  if(!session&&state.session){
    state.session=null;state.commercial=null;state.projects=[];state.imports=[];
    if(!localDemo()&&!projectIntakeOpen)$('rt-content').replaceChildren(overviewLink('Owner sign-in','/owner-login'));
  }
  const [projects,imports,commercial]=await Promise.all([
    api('/v1/client-projects/',options).catch(error=>{if(!session&&error.code==='OWNER_LOGIN_REQUIRED')return {projects:[]};throw error;}),
    api('/v1/proposal-imports/',options),session?api('/v1/commercial',options):null
  ]);
  Object.assign(state,{session,projects:projects.projects||[],imports:imports.imports||[],commercial});
  updateNavCounters();
}
function updateNavCounters(){
  const pCount=$('nav-project-count');
  if(pCount)pCount.textContent=String(state.projects.length);
  const impCount=$('nav-proposal-count');
  if(impCount)impCount.textContent=String(state.imports.length);
}
function watchDashboard(){
  const signature=()=>JSON.stringify([state.session?.ownerId,state.projects,state.imports,state.commercial]);
  let displayed=signature(),busy=false,last=Date.now(),failed=false;
  const status=$('rt-sync');
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('roomtreasury-commercial'):null;
  const show=()=>{status.textContent=busy?'Syncing…':failed?'Reconnecting · last update '+new Date(last).toLocaleTimeString()
    :'Updated '+Math.floor((Date.now()-last)/1000)+'s ago';status.title='Last successful update '+new Date(last).toLocaleString();};
  async function refresh(force=false){
    const content=$('rt-content');
    if(busy||projectIntakeOpen||(document.hidden&&force!==true)||content.querySelector('input:focus,select:focus,details[open]'))return;
    busy=true;show();
    try{
      await loadDashboardData(true);
      last=Date.now();failed=false;
      const next=signature();
      if(next!==displayed&&!projectIntakeOpen&&!content.querySelector('input:focus,select:focus,details[open]')){
        displayed=next;await renderRoute();
      }
    }catch{failed=true;}
    finally{busy=false;show();}
  }
  $('rt-refresh-view')?.addEventListener('click', async event=>{
    const button=event.currentTarget;
    if(busy||projectIntakeOpen)return;
    busy=true;
    button.disabled=true;
    show();
    try{await loadDashboardData();last=Date.now();failed=false;displayed=signature();await renderRoute();}
    catch{failed=true;}
    finally{busy=false;button.disabled=false;show();}
  });
  const timer=setInterval(()=>{if(!document.hidden){show();void refresh();}},6000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.addEventListener('focus',refresh);
  channel?.addEventListener('message',()=>void refresh(true));
  window.addEventListener('pagehide',event=>{if(!event.persisted){clearInterval(timer);channel?.close();}});
  show();
}

function setupSidebar(){
  const sidebar=$('rt-sidebar');
  const shell=sidebar.closest('.rt-shell');
  const main=shell.querySelector('.rt-main-wrapper');
  const toggle=$('rt-menu-btn');
  const close=$('rt-close-menu');
  const backdrop=$('rt-menu-backdrop');
  const mobile=matchMedia('(max-width: 768px)');
  let collapsed=false;
  const sync=(open=false)=>{
    const drawer=mobile.matches&&open;
    shell.classList.toggle('rt-drawer-open',drawer);
    shell.classList.toggle('rt-nav-collapsed',!mobile.matches&&collapsed);
    sidebar.inert=mobile.matches&&!drawer;
    main.inert=drawer;
    backdrop.hidden=!drawer;
    toggle.setAttribute('aria-expanded',String(mobile.matches?drawer:!collapsed));
    toggle.setAttribute('aria-label',mobile.matches?'Open navigation':collapsed?'Expand navigation':'Collapse navigation');
    if(drawer){
      sidebar.setAttribute('role','dialog');
      sidebar.setAttribute('aria-modal','true');
    }else{
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
  };
  const dismiss=()=>{sync();toggle.focus();};
  toggle.addEventListener('click',()=>{
    if(mobile.matches){sync(true);close.focus();}
    else{collapsed=!collapsed;sync();}
  });
  close.addEventListener('click',dismiss);
  backdrop.addEventListener('click',dismiss);
  sidebar.addEventListener('click',event=>{
    if(shell.classList.contains('rt-drawer-open')&&event.target.closest('a'))dismiss();
  });
  sidebar.addEventListener('keydown',event=>{
    if(!shell.classList.contains('rt-drawer-open'))return;
    if(event.key==='Escape'){event.preventDefault();dismiss();}
    if(event.key==='Tab'){
      const items=sidebar.querySelectorAll('a[href],button');
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  mobile.addEventListener('change',()=>{
    const wasOpen=shell.classList.contains('rt-drawer-open');
    sync();
    if(wasOpen)toggle.focus();
  });
  sync();
}

async function init(){
  setupSidebar();
  try{
    await loadDashboardData();
    updateNavCounters();

    // Initial route
    window.addEventListener('hashchange',()=>{
      const hash=location.hash.slice(1);
      const parts=hash.split('/');
      state.activeRoute=parts[0]||'overview';
      window.scrollTo(0,0);
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
    await renderRoute();
    watchDashboard();
  }catch{
    const error=el('div','ov-panel');
    error.append(el('h2',null,'Workspace unavailable'),el('p',null,'RoomTreasury could not load its records. Try refreshing the page.'),overviewLink('Reload workspace','/'));
    $('rt-content').replaceChildren(error);
  }
}

init();
})();`;
