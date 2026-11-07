import {HaloButton} from './halo-button';
import {HaloTabs,HaloTabsList,HaloTabsTrigger,HaloTabsIndicator,HaloTabsContent} from './halo-tabs';
import {HaloDropzone} from './halo-dropzone';
import {AnalyticsLineChart,type AnalyticsDataPoint} from './analytics-chart';
import {KanbanBoard,Column,type ColumnData} from './kanban-board';
import {ExpandableScreen,ExpandableScreenContent,ExpandableScreenTrigger} from './expandable-screen';
import {GridBeam} from './grid-beam';
import Textarea from './textarea';
import Skeleton from './skeleton';
import Breadcrumb from './breadcrumb';
import AuthForm from './auth-form';
import CardFlip from './card-flip';
import StayPicker from './stay-picker';
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
import { cn } from "./utils";

type Tab = { id: string; label: string };
type Balance = { label: string; value: string; description: string };

export interface FlickMetricProps {
  label: string
  value: string
  badge?: string
  badgeTone?: "green" | "gold" | "purple"
  note?: string
  calculation: string
  sourceCount: string
  auditNote: string
  theme: "green" | "gold" | "purple"
}

function FlickMetricCard({
  label,
  value,
  badge,
  badgeTone = "green",
  note,
  calculation,
  sourceCount,
  auditNote,
  theme,
}: FlickMetricProps) {
  const themes = {
    green: {
      bg: "bg-[#d8eedb] dark:bg-[#1a3324]",
      text: "text-[#143c24] dark:text-[#a8e2b8]",
      badge: "bg-[#bfe0c3] text-[#0d542c] dark:bg-[#254d35] dark:text-[#c4ecd0]",
      border: "border-[#bde0c2] dark:border-[#2b573c]",
      spark: "#287a4a",
    },
    gold: {
      bg: "bg-[#fdf0d9] dark:bg-[#382b17]",
      text: "text-[#543306] dark:text-[#f7d6a5]",
      badge: "bg-[#fbe0b3] text-[#7c4d0a] dark:bg-[#4d3b20] dark:text-[#f8dfbb]",
      border: "border-[#f4d8a5] dark:border-[#523e20]",
      spark: "#b37617",
    },
    purple: {
      bg: "bg-[#e2dffa] dark:bg-[#282245]",
      text: "text-[#322368] dark:text-[#d3cdfb]",
      badge: "bg-[#cfc8f7] text-[#4b399a] dark:bg-[#3d3368] dark:text-[#dad4fc]",
      border: "border-[#c9c0f5] dark:border-[#433870]",
      spark: "#6a52cb",
    },
  }
  const t = themes[theme] || themes.green

  const front = (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-between rounded-3xl p-5 shadow-sm transition-all border select-none",
        t.bg,
        t.border
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-current opacity-70" />
          <span className={cn("text-xs font-bold tracking-wide uppercase opacity-85", t.text)}>
            {label}
          </span>
        </div>
        {badge && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight shadow-xs", t.badge)}>
            {badge}
          </span>
        )}
      </div>

      <div className="my-1.5">
        <div className={cn("text-[28px] font-black tracking-tight tabular-nums", t.text)}>
          {value}
        </div>
        {note && (
          <p className={cn("mt-0.5 text-xs opacity-75 leading-tight font-medium", t.text)}>
            {note}
          </p>
        )}
      </div>

      {/* Zarss aesthetic sparkline */}
      <div className="flex items-end justify-between pt-1">
        <svg
          className="h-6 w-28 opacity-75"
          viewBox="0 0 120 24"
          fill="none"
          stroke={t.spark}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 18 Q 20 6, 40 15 T 80 10 T 118 4" />
        </svg>
        <span className={cn("text-[10.5px] font-semibold opacity-70 flex items-center gap-1 hover:opacity-100", t.text)}>
          Flip details ↻
        </span>
      </div>
    </div>
  )

  const back = (
    <div className="relative flex h-full w-full flex-col justify-between rounded-3xl p-5 bg-[#17181a] text-white border border-[#2d2f34] shadow-md select-none">
      <div>
        <div className="flex items-center justify-between border-b border-[#2d2f34] pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {label}
          </span>
          <span className="text-[10px] text-gray-400">Ledger Details</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Calculation Basis</div>
            <div className="text-xs font-medium text-gray-100">{calculation}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Underlying Records</div>
            <div className="text-xs font-semibold text-gray-200 tabular-nums">{sourceCount}</div>
          </div>
          {auditNote && (
            <p className="text-[10.5px] text-gray-400 italic pt-0.5 leading-snug">
              {auditNote}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-[#2d2f34]">
        <span className="text-[10px] text-emerald-400 font-medium">Immutable Audit Trail</span>
        <span className="text-[10.5px] text-gray-400 font-semibold flex items-center gap-1">
          Summary ↺
        </span>
      </div>
    </div>
  )

  return (
    <CardFlip
      front={front}
      back={back}
      label={`${label}: ${value}`}
      className="h-[175px] w-full cursor-pointer"
      faceClassName="rounded-3xl"
    />
  )
}

function PortalContent({ node }: { node: HTMLElement }) {
  const holder = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { holder.current?.append(node);if(node.classList.contains('rt-create-content'))preparingIntake=false;enhanceForms(); }, [node]);
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
  kanban(host:HTMLElement,columns:ColumnData[],onMove?:(cardId:string,fromCol:string,toCol:string)=>Promise<boolean|void>|void){
    mount(host,<KanbanBoard initialColumns={columns} onMove={onMove}/>);
  },
  flick(host:HTMLElement,props:FlickMetricProps){
    mount(host,<FlickMetricCard {...props}/>);
  },
  flip(host:HTMLElement,title:string,description:string){mount(host,<CardFlip label={title+' — click for details'} className="rt-flip-card" front={<div className="rt-flip-content"><h3>{title}</h3><p>Click to reveal record details ↗</p></div>} back={<div className="rt-flip-content"><h3>Record details</h3><p>{description}</p></div>}/>);},
  processing(host:HTMLElement,steps:AgentStep[]){mount(host,<AILoadingState steps={steps} collapseWhenDone={false}/>);},
  expand(host:HTMLElement,form:HTMLElement){mount(host,<ExpandableScreen defaultExpanded lockScroll={false} animationDuration={matchMedia('(prefers-reduced-motion: reduce)').matches?0:.22}><ExpandableScreenContent showCloseButton={false} className="rt-project-expand"><a href="/#projects/all" className="rt-expand-close">← Projects</a><PortalContent node={form}/></ExpandableScreenContent></ExpandableScreen>);},
  expandModal(host:HTMLElement,triggerLabel:string,form:HTMLElement){
    mount(host,
      <ExpandableScreen defaultExpanded={false} lockScroll={true} animationDuration={0.3}>
        <ExpandableScreenTrigger className="w-full">
          <HaloButton className="rt-topbar-new-halo w-full" translucent={false}>{triggerLabel}</HaloButton>
        </ExpandableScreenTrigger>
        <ExpandableScreenContent showCloseButton={true} className="rt-project-expand-modal bg-[#fcfdfa] dark:bg-[#121315] border border-[var(--border)] shadow-2xl p-6 md:p-10 max-w-4xl mx-auto rounded-3xl">
          <PortalContent node={form}/>
        </ExpandableScreenContent>
      </ExpandableScreen>
    );
  },
  grid(host:HTMLElement){mount(host,<GridBeam rows={3} cols={4} active={false} colorVariant="mono" theme="light" className="h-full w-full"/>);},
  halftone(host: HTMLElement) {
    mount(host, <HalftoneBackground className="h-full min-h-0 bg-transparent" cell={7} loupe={false}>{null}</HalftoneBackground>);
  },
  metric(host: HTMLElement, balance: Balance) {
    mount(host, <Card className="h-full gap-0 border-0 bg-transparent py-0 shadow-none"><CardContent className="h-full px-0">
      <MetricCard label={balance.label} snapshot={balance.value} description={balance.description} className="rt-library-metric" />
    </CardContent></Card>);
  },
  ring(host: HTMLElement, categories: SpendingCategory[], title?: string) {
    mount(host, <SpendingRing categories={categories} title={title||"Approved delivery budget breakdown"} className="rt-library-metric" />);
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

function DeadlineBridge({input}:{input:HTMLInputElement}){
 return <details className="rt-deadline-picker"><summary>Choose deadline from calendar</summary><StayPicker deadlineMode getNight={()=>({price:0,blocked:false})} onDeadline={date=>{input.value=date;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.closest('label')?.querySelector('details')?.removeAttribute('open');}}/></details>;
}

function NativeButton({button}:{button:HTMLButtonElement}){
 const [state,setState]=useState({label:button.textContent||'Continue',disabled:button.disabled});
 useLayoutEffect(()=>{const observer=new MutationObserver(()=>setState({label:button.textContent||'Continue',disabled:button.disabled}));observer.observe(button,{attributes:true,childList:true,subtree:true});return()=>observer.disconnect();},[button]);
 return <HaloButton className="rt-halo-action" translucent={false} staggerLabel={false} type="button" disabled={state.disabled} onClick={()=>{if(!button.disabled)button.click();}}>{state.label}</HaloButton>;
}
let preparingIntake=!!document.getElementById('pw-intake');
function enhanceForms(){
 if(preparingIntake)return;
 for(const button of document.querySelectorAll<HTMLButtonElement>('button.rt-btn:not([data-halo-button]),button.pw-primary:not([data-halo-button])')){if(button.matches('.rt-menu-close,.rt-menu-toggle,.rt-theme-toggle'))continue;button.dataset.haloButton='true';const host=document.createElement('span');host.className='rt-halo-button-host';button.after(host);button.classList.add('rt-original-button');mount(host,<NativeButton button={button}/>);}

 for(const input of document.querySelectorAll<HTMLInputElement>('input[type=file]:not([data-halo])')){
  if(input.closest('.rt-upload-island'))continue;input.dataset.halo='true';const host=document.createElement('div');host.className='rt-upload-island';const label=input.closest('label');if(label)label.after(host);else input.after(host);input.classList.add('rt-upload-native');mount(host,<UploadBridge input={input}/>);
 }
 for(const input of document.querySelectorAll<HTMLInputElement>('input[type=date]:not([data-picker])')){input.dataset.picker='true';const host=document.createElement('div');input.after(host);mount(host,<DeadlineBridge input={input}/>);}
 for(const input of document.querySelectorAll<HTMLTextAreaElement>('#pw-intake textarea:not([data-smooth])')){input.dataset.smooth='true';const host=document.createElement('span');host.className='contents';input.replaceWith(host);mount(host,<Textarea data-smooth="true" name={input.name} required={input.required} maxLength={input.maxLength} placeholder={input.placeholder} defaultValue={input.value}/>);}
}
const authHost=document.getElementById('rt-auth-island');if(authHost){authHost.dataset.mounted='true';mount(authHost,<OwnerSignIn demo={authHost.dataset.demo==='true'}/>);}
let enhancePending=false;
new MutationObserver(()=>{if(enhancePending)return;enhancePending=true;requestAnimationFrame(()=>{enhancePending=false;enhanceForms();});}).observe(document.body,{childList:true,subtree:true});
enhanceForms();

requestAnimationFrame(()=>{const form=document.getElementById('pw-intake');const main=document.querySelector<HTMLElement>('.pw-main');if(form&&main){const content=document.createElement('div');content.className='rt-create-content';while(main.firstChild)content.append(main.firstChild);const host=document.createElement('div');main.append(host);mount(host,<ExpandableScreen defaultExpanded lockScroll={false} animationDuration={matchMedia('(prefers-reduced-motion: reduce)').matches?0:.22}><ExpandableScreenContent showCloseButton={false} className="rt-project-expand"><PortalContent node={content}/></ExpandableScreenContent></ExpandableScreen>);}});
