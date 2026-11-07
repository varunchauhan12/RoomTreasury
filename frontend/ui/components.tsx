import {ProjectIntake} from "./project-intake";
import type {ComponentProps} from "react";
import {HaloButton} from './halo-button';
import {HaloTabs,HaloTabsList,HaloTabsTrigger,HaloTabsIndicator,HaloTabsContent} from './halo-tabs';
import {HaloDropzone} from './halo-dropzone';
import {AnalyticsLineChart,type AnalyticsDataPoint} from './analytics-chart';
import {KanbanBoard,type ColumnData} from './kanban-board';
import {GridBeam} from './grid-beam';
import Skeleton from './skeleton';
import Breadcrumb from './breadcrumb';
import AuthForm from './auth-form';
import CardFlip from './card-flip';
import AILoadingState,{type AgentStep} from './ai-loading';
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionConfig, useReducedMotion } from "motion/react";
import { BlurFade } from "./blur-fade";
import { Card, CardContent } from "./card";
import MetricCard from "./metric-card";
import SpendingRing, { type SpendingCategory } from "./spending-ring";
import CurrencyTransfer from "./currency-transfer";
import HalftoneBackground from "./halftone-background";

type Tab = { id: string; label: string };
type Balance = { label: string; value: string; description: string };

function PortalContent({ node }: { node: HTMLElement }) {
  const holder = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { holder.current?.append(node);enhanceForms(); }, [node]);
  return <div ref={holder} />;
}

let restoreTabFocus = false;

function WorkspaceTabs({ items, value, panel, change }: {
  items: Tab[];
  value: string;
  panel?: HTMLElement;
  change: (id: string) => void;
}) {
  const selected = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const tab = selected.current;
    const list = tab?.parentElement;
    if (tab && list) {
      const overflow = tab.getBoundingClientRect().right - list.getBoundingClientRect().right;
      if (overflow > 0) list.scrollLeft += overflow;
    }
    if (restoreTabFocus) {
      restoreTabFocus = false;
      tab?.focus({ preventScroll: true });
    }
  }, [value]);
  return (
    <HaloTabs value={value} onValueChange={id => {
      restoreTabFocus = true;
      change(String(id));
    }}>
      <HaloTabsList variant="pill" className="rt-library-tabs w-full justify-start overflow-x-auto">
        {items.map(item => <HaloTabsTrigger key={item.id} value={item.id} ref={item.id === value ? selected : undefined}
          {...(!panel && { "aria-controls": item.id, id: item.id + "-tab" })}>{item.label}</HaloTabsTrigger>)}
      <HaloTabsIndicator variant="pill" /></HaloTabsList>
      {panel && <HaloTabsContent value={value}><PortalContent node={panel} /></HaloTabsContent>}
    </HaloTabs>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return reduceMotion ? children : <BlurFade duration={0.22} blur="2px" offset={3}>{children}</BlurFade>;
}

const roots = new Map<HTMLElement, Root>();
function mount(host: HTMLElement, node: ReactNode) {
  if (!host.isConnected) {
    requestAnimationFrame(() => {
      if (host.isConnected) mount(host, node);
    });
    return;
  }
  const root = roots.get(host) ?? createRoot(host);
  roots.set(host, root);
  root.render(<MotionConfig reducedMotion="user">{node}</MotionConfig>);
}
// Portal moves temporarily detach native forms. Wait one frame before disposing
// islands so controls survive tab and expandable-screen layout transitions.
let cleanupPending=false;
new MutationObserver(records=>{
 if(cleanupPending||!records.some(record=>record.removedNodes.length))return;
 cleanupPending=true;
 requestAnimationFrame(()=>{cleanupPending=false;for(const [host,root] of roots){if(!host.isConnected){roots.delete(host);root.unmount();}}});
}).observe(document.body,{subtree:true,childList:true});

Object.assign(globalThis, { RoomTreasuryUI: {
  tabs(host: HTMLElement, items: Tab[], value: string, panel: HTMLElement | undefined, change: (id: string) => void) {
    mount(host, <WorkspaceTabs {...{ items, value, panel, change }} />);
  },
  button(host:HTMLElement,label:string,action:()=>void){mount(host,<HaloButton translucent={false} onClick={action}>{label}</HaloButton>);},
  skeleton(host:HTMLElement){mount(host,<div className="space-y-3" role="status" aria-label="Loading records"><Skeleton className="h-10 w-2/3"/><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>);},
  breadcrumb(host:HTMLElement,items:{label:string;href?:string}[]){mount(host,<Breadcrumb items={items}/>);},
  chart(host:HTMLElement,data:AnalyticsDataPoint[],label:string){mount(host,<AnalyticsLineChart data={data} valueLabel={label}/>);},
  kanban(host: HTMLElement, columns: ColumnData[], scope: string) {
    mount(host, <KanbanBoard columns={columns} scope={scope} />);
  },
  flip(host:HTMLElement,title:string,description:string){mount(host,<CardFlip label={title+' — click for details'} className="rt-flip-card" front={<div className="rt-flip-content"><h3>{title}</h3><p>Click to reveal record details ↗</p></div>} back={<div className="rt-flip-content"><h3>Record details</h3><p>{description}</p></div>}/>);},
  projectIntake(host: HTMLElement, props: ComponentProps<typeof ProjectIntake>) {
    mount(host, <ProjectIntake {...props} />);
  },
  summaryFlip(host: HTMLElement, metric: {label:string;value:string;source:string;count:string}) {
    mount(host, <CardFlip label={metric.label + " — show calculation"} className="ov-summary-flip" faceClassName="ov-summary-face"
      front={<div className="ov-summary-copy"><h2>{metric.label}</h2><strong>{metric.value}</strong></div>}
      back={<div className="ov-summary-copy"><h2>{metric.label}</h2><p>{metric.source}</p><small>{metric.count}</small></div>} />);
  },
  processing(host:HTMLElement,steps:AgentStep[]){mount(host,<AILoadingState steps={steps} collapseWhenDone={false}/>);},
  grid(host:HTMLElement){mount(host,<GridBeam rows={3} cols={4} active={false} colorVariant="mono" theme="light" className="h-full w-full"/>);},
  halftone(host: HTMLElement) {
    mount(host, <HalftoneBackground className="h-full min-h-0 bg-transparent" cell={7} loupe={false}>{null}</HalftoneBackground>);
  },
  metric(host: HTMLElement, balance: Balance) {
    mount(host, <Card className="h-full gap-0 border-0 bg-transparent py-0 shadow-none"><CardContent className="h-full px-0">
      <MetricCard label={balance.label} snapshot={balance.value} description={balance.description} className="rt-library-metric" />
    </CardContent></Card>);
  },
  overviewRing(host: HTMLElement, categories: SpendingCategory[]) {
    mount(host, <SpendingRing categories={categories} title="Approved budget" animateUpdates className="ov-ring-component" />);
  },
  unmount(host: HTMLElement) {
    const root = roots.get(host);
    if (root) {
      roots.delete(host);
      root.unmount();
    }
  },
  ring(host: HTMLElement, categories: SpendingCategory[], title = "Approved delivery budget breakdown") {
    mount(host, <SpendingRing categories={categories} title={title} className="rt-library-metric" />);
  },
  receipt(host: HTMLElement, receipt: { amountCents: number; recipient: string; id: string; timestamp: string }) {
    const account = { amount: receipt.amountCents / 100, currency: "USD", bank: "RoomTreasury simulation" };
    mount(host, <Reveal><CurrencyTransfer simulated from={account} to={{ ...account, name: receipt.recipient }}
      status="completed" txnId={receipt.id} timestamp={receipt.timestamp} className="rt-library-metric" /></Reveal>);
  },
} });

// Locally bundled official registry components; existing domain forms remain authoritative.
function OwnerSignIn({demo}:{demo:boolean}){
 const [status,setStatus]=useState<'idle'|'submitting'|'success'|'error'>('idle');
 const [error,setError]=useState<string>();
 const [notice,setNotice]=useState('');
 return <><p className="rt-auth-kicker">OWNER WORKSPACE</p><AuthForm mode="sign-in" initialUsername={demo?'owner':''} initialPassword={demo?'demo123':''} status={status} error={error} providers={[]} showMagicLink={false} onSubmit={async values=>{
  setStatus('submitting');setError(undefined);
  try{const response=await fetch('/v1/owner-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:values.email,password:values.password})});const data=await response.json();if(!response.ok)throw Error(data.error?.code||'Sign-in failed');setStatus('success');location.assign('/');}
  catch(e){setError(e instanceof Error?e.message:'Sign-in failed');setStatus('error');}
 }} footer={<p className="rt-auth-note">{demo?'Local demo suggestion: owner / demo123. This form does not create or reset an account.':'Use your operator-provisioned account.'} Signing in does not approve a proposal.</p>}/><p role="status" className="rt-auth-note">{notice}</p><HaloButton translucent={false} staggerLabel={false} type="button" onClick={async()=>{try{const sessionResponse=await fetch('/v1/owner-auth/session',{cache:'no-store'});if(sessionResponse.status===401){setNotice('No active session on this browser.');return;}if(!sessionResponse.ok)throw Error('Unable to check session.');const session=await sessionResponse.json();const response=await fetch('/v1/owner-auth/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken}});if(!response.ok)throw Error('Sign-out failed.');setNotice('Signed out.');}catch(e){setNotice(e instanceof Error?e.message:'Sign-out failed.');}}}>Sign out</HaloButton><p><a href="/">Return to workspace</a></p></>;
}

function UploadBridge({input}:{input:HTMLInputElement}){
 const [disabled,setDisabled]=useState(input.disabled);
 useLayoutEffect(()=>{const observer=new MutationObserver(()=>setDisabled(input.disabled));observer.observe(input,{attributes:true,attributeFilter:['disabled']});return()=>observer.disconnect();},[input]);
 return <HaloDropzone disabled={disabled} translucent={false} accept={input.accept||undefined} multiple={input.multiple} showSuccessThumbnails={false} emptyLabel={'Choose '+(input.accept.includes('json')?'JSON artifact':'artifact file')} formatHint="Select a file to validate · nothing is uploaded automatically" successLabel="File selected · awaiting package validation" successResetMs={0} onFiles={files=>{const data=new DataTransfer();for(const file of files.slice(0,input.multiple?files.length:1))data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));}}/>;
}

function NativeButton({button}:{button:HTMLButtonElement}){
 const [state,setState]=useState({label:button.textContent||'Continue',disabled:button.disabled});
 useLayoutEffect(()=>{const observer=new MutationObserver(()=>setState({label:button.textContent||'Continue',disabled:button.disabled}));observer.observe(button,{attributes:true,childList:true,subtree:true});return()=>observer.disconnect();},[button]);
 return <HaloButton className="rt-halo-action" translucent={false} staggerLabel={false} type="button" disabled={state.disabled} onClick={()=>{if(!button.disabled)button.click();}}>{state.label}</HaloButton>;
}
function enhanceForms(){
 for(const button of document.querySelectorAll<HTMLButtonElement>('button.rt-btn:not([data-halo-button]),button.pw-primary:not([data-halo-button])')){if(button.matches('.rt-menu-close,.rt-menu-toggle,.rt-theme-toggle'))continue;button.dataset.haloButton='true';const host=document.createElement('span');host.className='rt-halo-button-host';button.after(host);button.classList.add('rt-original-button');mount(host,<NativeButton button={button}/>);}

 for(const input of document.querySelectorAll<HTMLInputElement>('input[type=file]:not([data-halo])')){
  if(input.closest('.rt-upload-island'))continue;input.dataset.halo='true';const host=document.createElement('div');host.className='rt-upload-island';const label=input.closest('label');if(label&&label.classList.contains('pw-upload-field'))label.append(host);else if(label)label.after(host);else input.after(host);input.classList.add('rt-upload-native');mount(host,<UploadBridge input={input}/>);
 }
}
const authHost=document.getElementById('rt-auth-island');if(authHost){authHost.dataset.mounted='true';mount(authHost,<OwnerSignIn demo={authHost.dataset.demo==='true'}/>);}
let enhancePending=false;
new MutationObserver(()=>{if(enhancePending)return;enhancePending=true;requestAnimationFrame(()=>{enhancePending=false;enhanceForms();});}).observe(document.body,{childList:true,subtree:true});
enhanceForms();
