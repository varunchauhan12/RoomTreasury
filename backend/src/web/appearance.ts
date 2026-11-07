import type {FastifyInstance} from 'fastify';

export const appearanceScript=String.raw`(()=>{
 const key='roomtreasury-appearance';let saved;try{saved=localStorage.getItem(key);}catch{}
 const initial=saved==='dark'||saved==='light'?saved:'light';
 function apply(value){document.documentElement.dataset.theme=value;document.documentElement.classList.toggle('dark',value==='dark');document.documentElement.style.colorScheme=value;}
 apply(initial);
 const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
 const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/></svg>';
 function install(){const host=document.querySelector('.rt-topbar-right')||document.querySelector('.pw-header nav')||document.querySelector('body>header')||document.querySelector('main');if(!host||document.getElementById('rt-theme-toggle'))return;const button=document.createElement('button');button.id='rt-theme-toggle';button.type='button';button.className='rt-theme-toggle';function update(){const dark=document.documentElement.dataset.theme==='dark';button.innerHTML=dark?sun:moon;button.setAttribute('aria-label','Switch to '+(dark?'light':'dark')+' mode');button.setAttribute('aria-pressed',String(dark));button.title=dark?'Light mode':'Dark mode';}button.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';apply(next);try{localStorage.setItem(key,next);}catch{}update();});host.append(button);update();addEventListener('storage',event=>{if(event.key===key&&(event.newValue==='light'||event.newValue==='dark')){apply(event.newValue);update();}});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();`;

export const appearanceCss=String.raw`
:root,[data-theme=light]{--a-bg:#eae4d9;--a-panel:#f7f2e9;--a-raised:#fffaf2;--a-subtle:#e7dfd2;--a-ink:#1b1815;--a-muted:#71695f;--a-line:#d8cfc1;--a-accent:#c83f36;--a-on-accent:#fff8ef;--a-accent-hover:#ad3029;--a-accent-wash:#f2ddd5;--a-sidebar:#191715;--a-side-text:#eee6da;--a-side-muted:#b8ac9d;--a-good:#287057;--a-good-bg:#e1eade;--a-warn:#815f24;--a-warn-bg:#f0e3c7;--a-bad:#b3312d;--a-bad-bg:#f3dcd5;--a-shadow:0 5px 18px #231a0c05;color-scheme:light}
[data-theme=dark]{--a-bg:#121316;--a-panel:#191a20;--a-raised:#21222a;--a-subtle:#282a35;--a-ink:#f8fafc;--a-muted:#94a3b8;--a-line:rgba(255, 255, 255, 0.08);--a-accent:#ef6a5e;--a-on-accent:#1b1410;--a-accent-hover:#ff8175;--a-accent-wash:#422823;--a-sidebar:#14151a;--a-side-text:#f8fafc;--a-side-muted:#94a3b8;--a-good:#4ade80;--a-good-bg:rgba(74, 222, 128, 0.12);--a-warn:#fbbf24;--a-warn-bg:rgba(251, 191, 36, 0.12);--a-bad:#f87171;--a-bad-bg:rgba(248, 113, 113, 0.12);--a-shadow:0 8px 24px rgba(0, 0, 0, 0.35);color-scheme:dark}
html[data-theme]{--rt-bg:var(--a-bg);--rt-surface:var(--a-panel);--rt-surface-elevated:var(--a-raised);--rt-surface-subtle:var(--a-subtle);--rt-text:var(--a-ink);--rt-text-muted:var(--a-muted);--rt-text-subtle:var(--a-muted);--rt-border:var(--a-line);--rt-border-subtle:var(--a-line);--rt-emerald:var(--a-accent);--rt-emerald-deep:var(--a-accent);--rt-emerald-light:var(--a-accent-wash);--card:var(--a-panel);--background:var(--a-panel);--foreground:var(--a-ink);--muted:var(--a-subtle);--muted-foreground:var(--a-muted);--border:var(--a-line);--ring:var(--a-accent);--brand:var(--a-accent);--color-card:var(--a-panel);--color-card-foreground:var(--a-ink);--color-background:var(--a-panel);--color-foreground:var(--a-ink);--color-muted:var(--a-subtle);--color-muted-foreground:var(--a-muted);--color-border:var(--a-line);--color-input:var(--a-line);--color-ring:var(--a-accent);--color-primary:var(--a-accent);--color-primary-foreground:var(--a-bg)}
html,html[data-theme] body{background:var(--a-bg);color:var(--a-ink)}body{font-family:"General Sans",Inter,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}::selection{background:var(--a-accent);color:#fff8ef}html[data-theme] :is(h1,h2,h3,h4,strong){color:var(--a-ink)}html[data-theme] h1{font-weight:750;letter-spacing:-.045em;line-height:1.04}html[data-theme] :is(.rt-section-heading h1,.ov-hero h1,.pw-heading h1){font-size:clamp(32px,4.2vw,54px)}html[data-theme] :is(.rt-section-kicker,.ov-eyebrow,.pw-eyebrow,.rt-auth-kicker){font:600 10px/1.5 ui-monospace,SFMono-Regular,monospace;letter-spacing:.16em;color:var(--a-accent)}
html[data-theme] :is(.rt-data-muted,.ov-muted,.pw-subtle,.rt-card-subtitle,.rt-sync,.rt-auth-note,.rt-breadcrumbs,.rt-breadcrumb-active,.rt-data-facts dt,.rt-data-facts dd,.pw-grid dt,.pw-grid dd,.rt-project-excerpt,.rt-discord-content,.rt-discord-message details,.rt-discord-attachment small,.ov-metric-label,.ov-metric-note,.ov-panel-subtitle){color:var(--a-muted)}
html[data-theme] :is(.rt-body,.pw-body,.rt-auth-body,.rt-shell,.rt-main,.rt-content,.rt-section-view,.ov-view,.pw-main){background:var(--a-bg);color:var(--a-ink)}html[data-theme] :is(.rt-data-panel,.rt-discord-sidebar,.rt-discord-feed,.pw-panel,.rt-project-expand,.rt-metric-island,.rt-library-metric,.ov-panel,.ov-metric,.rt-card,.rt-auth-card,.rt-data-table,.rt-proposal-detail,.metric,main>article){background:var(--a-panel);color:var(--a-ink);border-color:var(--a-line);box-shadow:var(--a-shadow)}html[data-theme] :is(.rt-data-panel,.ov-panel,.ov-metric,.pw-panel,.rt-discord-sidebar,.rt-discord-feed){border-radius:20px}
html[data-theme] .rt-shell .rt-sidebar{background:var(--a-sidebar);border-color:var(--a-line);box-shadow:none;border-radius:28px;width:210px;padding:14px 10px}html[data-theme] .rt-sidebar :is(.rt-brand-title,.rt-brand-name,.rt-user-name){color:var(--a-side-text)}html[data-theme] .rt-shell .rt-sidebar :is(.rt-brand-badge,.rt-sidebar-section,.rt-user-role,.rt-nav-label,.rt-nav-item){color:var(--a-side-muted)}html[data-theme] .rt-shell .rt-sidebar .rt-nav-item{border-radius:99px;min-height:44px}html[data-theme] .rt-shell .rt-sidebar .rt-nav-item.active{background:#eee5d6;color:#201b16}html[data-theme] .rt-shell .rt-sidebar .rt-nav-item.active :is(.rt-nav-label,.rt-nav-icon){color:#201b16}html[data-theme] .rt-shell .rt-sidebar .rt-nav-item:not(.active):hover{background:#23242c;color:#ffffff}html[data-theme] .rt-shell .rt-sidebar .rt-nav-item:not(.active):hover .rt-nav-label{color:#ffffff}html[data-theme] .rt-shell .rt-brand-logo{background:var(--a-accent);color:#fff8ee;box-shadow:none}html[data-theme] .rt-sidebar :is(.rt-user-pill,.rt-sidebar-footer){border-color:var(--a-line)}html[data-theme] .rt-user-avatar{background:#332b24;color:#eee5d6}
html[data-theme] .rt-shell .rt-topbar{background:var(--a-panel);color:var(--a-ink);border:1px solid var(--a-line);border-radius:99px;margin:16px 26px 0;padding:10px 18px;min-height:58px;position:relative;box-shadow:none}html[data-theme] .rt-topbar-right{gap:8px}html[data-theme] .rt-shell .rt-content{padding-top:28px}html[data-theme] .pw-header{background:var(--a-panel);border:1px solid var(--a-line);border-radius:99px;margin:16px auto;width:min(1180px,calc(100% - 32px));max-width:1180px;box-sizing:border-box;padding:15px 24px}html[data-theme] .pw-brand{color:var(--a-ink)}html[data-theme] .pw-brand span{color:var(--a-muted)}html[data-theme] .pw-header a{color:var(--a-ink)}
html[data-theme] .ov-hero{background:var(--a-panel);border:1px solid var(--a-line);border-radius:28px;padding:30px 32px;margin-bottom:22px;overflow:hidden}html[data-theme] .ov-hero h1{max-width:700px}html[data-theme] :is(.ov-hero p,.ov-hero time,.ov-hero-meta,.ov-hero-subtitle){color:var(--a-muted)}html[data-theme] .ov-library-halftone{opacity:.13}html[data-theme] .ov-metric{padding:22px 24px;min-height:152px}html[data-theme] .ov-metric-value{font-size:clamp(26px,3vw,39px);font-weight:650;letter-spacing:-1.8px;color:var(--a-ink)}html[data-theme] .ov-panel-heading{border-color:var(--a-line)}
html[data-theme] :is(input:not([type=checkbox]):not([type=radio]),textarea,select){background:var(--a-raised);color:var(--a-ink);border-color:var(--a-line);border-radius:10px}html[data-theme] :is(input,textarea)::placeholder{color:var(--a-muted);opacity:.8}html[data-theme] :is(input,textarea,select,button,a):focus-visible{outline:2px solid var(--a-accent);outline-offset:3px}html[data-theme] input[type=checkbox]{accent-color:var(--a-accent)}html[data-theme] label{color:var(--a-ink)}html[data-theme] :is(.rt-data-controls label,.pw-panel small,.pw-footer,footer){color:var(--a-muted)}
html[data-theme] :is(.rt-btn,.pw-button,.pw-panel button,#files button,#owner-review button){border-color:var(--a-line);background:var(--a-raised);color:var(--a-ink);border-radius:99px;box-shadow:none}html[data-theme] :is(.rt-btn-primary,.pw-primary,.rt-auth-card button[type=submit]){background:var(--a-accent)!important;color:var(--a-on-accent)!important;border-color:var(--a-accent)!important}html[data-theme] :is(.rt-btn-primary,.pw-primary):hover{background:var(--a-accent-hover)!important;border-color:var(--a-accent-hover)!important}html[data-theme] :is(.rt-btn-secondary,.rt-theme-toggle){background:var(--a-raised);color:var(--a-ink);border-color:var(--a-line)}html[data-theme] a:not([class]){color:var(--a-accent)}html[data-theme] .rt-halo-action button{background:var(--a-raised)!important;color:var(--a-ink)!important;border:1px solid var(--a-line);box-shadow:none}html[data-theme] .rt-halo-action button span{color:inherit}html[data-theme] .rt-halo-action{border-radius:99px!important}html[data-theme] .rt-halo-action>div>div{opacity:.16}
html[data-theme] :is(.rt-tab-fallback,.rt-library-tabs){background:var(--a-subtle);border-color:var(--a-line);border-radius:99px;padding:5px}html[data-theme] .rt-library-tabs [data-slot=halo-tabs-trigger]{color:var(--a-muted);padding-inline:17px}html[data-theme] .rt-library-tabs [data-slot=halo-tabs-trigger][data-active]{color:var(--a-ink);font-weight:650}html[data-theme] .rt-library-tabs [data-slot=halo-tabs-indicator]{background:var(--a-panel);border:1px solid var(--a-line);box-shadow:0 2px 4px #00000005}html[data-theme] :is(.pw-anchor-nav,.rt-section-tabs){color:var(--a-ink)}
html[data-theme] :is(.rt-data-table th,th){background:var(--a-subtle);color:var(--a-muted);font-size:10px;letter-spacing:.06em;text-transform:uppercase;border-color:var(--a-line)}html[data-theme] :is(.rt-data-table td,td){color:var(--a-ink);border-color:var(--a-line)}html[data-theme] .rt-data-table tbody tr:hover{background:var(--a-raised)}html[data-theme] :is(.rt-data-detail,.rt-ledger-details,.rt-discord-message,.rt-discord-sidebar [data-participants],fieldset,.ov-list-item,.ov-activity-item,.ov-project-row,.rt-data-job-group){border-color:var(--a-line)}html[data-theme] :is(.rt-data-detail summary,.rt-ledger-details summary,.rt-deadline-picker summary){color:var(--a-accent)}html[data-theme] :is(.rt-discord-attachment,.rt-fleet-card,.rt-pipeline-column,.rt-cult-kanban>div,.rt-commercial-month,.rt-data-empty,.rt-data-badge,.rt-job-lifecycle li,.pw-notice,.rt-discord-marker){background:var(--a-subtle);color:var(--a-muted);border-color:var(--a-line)}html[data-theme] :is(.rt-pipeline-card,.rt-fleet-coordinator){background:var(--a-raised);border-color:var(--a-line)}html[data-theme] .rt-cult-kanban a{color:var(--a-ink)}html[data-theme] .rt-discord-message[data-role=coordinator]{border-left-color:var(--a-accent)}html[data-theme] .rt-discord-message p{color:var(--a-muted)}html[data-theme] .rt-discord-marker{color:var(--a-good);background:var(--a-good-bg)}html[data-theme] .rt-discord-sidebar h3{color:var(--a-muted)}html[data-theme] .rt-record-flip{margin-block:18px}html[data-theme] .rt-flip-card{border-radius:20px}html[data-theme] .rt-flip-content{background:var(--a-raised);height:100%}
html[data-theme] :is(.ov-badge-neutral,.pw-badge){background:var(--a-subtle);color:var(--a-muted);border-color:var(--a-line)}html[data-theme] .ov-badge-green{background:var(--a-good-bg);color:var(--a-good)}html[data-theme] .ov-badge-amber{background:var(--a-warn-bg);color:var(--a-warn)}html[data-theme] :is(.ov-badge-rose,.rt-review-alert){background:var(--a-bad-bg);color:var(--a-bad);border-color:var(--a-line)}html[data-theme] .rt-demo-access-banner{background:var(--a-panel);border-color:var(--a-line);color:var(--a-muted);font:10px/1.5 ui-monospace,monospace;letter-spacing:.02em}
html[data-theme] :is(.rt-library-metric,.rt-upload-island,.rt-deadline-picker,.rt-processing-island){--card:var(--a-panel);--foreground:var(--a-ink);--muted:var(--a-subtle);--muted-foreground:var(--a-muted);--border:var(--a-line)}html[data-theme] :is([class~="bg-white"],[class~="bg-zinc-50"],[class~="bg-zinc-100"],[class~="bg-slate-50"],[class~="bg-zinc-950"]){background-color:var(--a-panel)}html[data-theme] :is([class~="text-zinc-900"],[class~="text-zinc-800"],[class~="text-zinc-950"],[class~="text-slate-900"]){color:var(--a-ink)}html[data-theme] :is([class~="text-zinc-500"],[class~="text-zinc-600"],[class~="text-slate-500"],[class~="text-slate-600"]){color:var(--a-muted)}html[data-theme] .rt-auth-story{background:var(--a-sidebar)}html[data-theme] .rt-auth-story :is(h1,a){color:#eee5d6}html[data-theme] .rt-auth-story :is(p,small){color:#b8ac9d}html[data-theme] pre{background:var(--a-subtle);color:var(--a-ink);border-radius:12px;padding:16px;overflow-x:auto}html[data-theme] hr{border-color:var(--a-line)}html[data-theme] progress{accent-color:var(--a-accent)}
.rt-theme-toggle{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;min-width:38px;flex:0 0 38px;padding:8px;border:1px solid var(--a-line);border-radius:50%!important;background:var(--a-ink)!important;color:var(--a-panel)!important;cursor:pointer;box-sizing:border-box}.rt-theme-toggle svg{width:20px;height:20px;pointer-events:none}.rt-theme-toggle:hover{transform:rotate(12deg)}
html[data-theme] .rt-shell .rt-topbar{width:calc(100% - 52px);box-sizing:border-box;margin-inline:auto}html[data-theme] :is(p,small,dt){color:var(--a-muted)}html[data-theme] :is(dd,li){color:var(--a-ink)}html[data-theme] .ov-metric-head{font:600 10px/1.5 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--a-muted)}html[data-theme] .ov-metric-icon{background:var(--a-subtle);color:var(--a-accent);border-radius:50%}html[data-theme] .ov-metric>p{color:var(--a-muted);font-size:12px;margin-top:10px}html[data-theme] .ov-panel-head h2{font-size:16px;letter-spacing:-.3px}html[data-theme] :is(.ov-table,.ov-table td,.ov-table th){border-color:var(--a-line)}html[data-theme] .ov-table tr:hover{background:var(--a-raised)}html[data-theme] :is(.ov-donut-legend,.ov-metric-head,.ov-table td){color:var(--a-muted)}
html[data-theme] :is(.ov-empty,.ov-panel .ov-empty,.ov-attention li){background:var(--a-subtle);color:var(--a-muted);border-color:var(--a-line)}html[data-theme] :is(table,.ov-table){background:var(--a-panel)}html[data-theme] :is(td,th[scope=row]){background:transparent}html[data-theme] :is(.ov-link,.ov-table a){color:var(--a-accent)}html[data-theme] :is(.ov-link,.ov-table a):hover{color:var(--a-ink)}html[data-theme] :is(.ov-review-row,.ov-project-identity){border-color:var(--a-line)}html[data-theme] .ov-monogram{background:var(--a-subtle);color:var(--a-muted)}html[data-theme] .rt-shell.rt-nav-collapsed .rt-sidebar{width:76px}
@media(max-width:800px){html[data-theme] .rt-shell .rt-topbar{margin:10px auto 0;width:calc(100% - 24px);padding:9px 12px;border-radius:20px}html[data-theme] .pw-header{margin:10px auto;width:calc(100% - 32px);max-width:none;border-radius:20px;gap:14px}html[data-theme] .rt-topbar-right{gap:6px}.rt-theme-toggle{width:34px;height:34px;min-width:34px;flex-basis:34px}html[data-theme] .ov-hero{padding:22px;border-radius:22px}html[data-theme] .ov-metric{padding:18px}}
@media(max-width:480px){html[data-theme] .rt-topbar .rt-topbar-new{font-size:11px;padding:8px}html[data-theme] .rt-topbar-right>a[href='/owner-login']{display:none}html[data-theme] .rt-topbar .rt-sync{display:none}html[data-theme] .pw-header nav{gap:10px;flex-wrap:wrap}html[data-theme] .ov-hero h1{font-size:34px}html[data-theme] .rt-content{padding-inline:14px}.rt-demo-access-banner{font-size:9px!important;bottom:4px}}

html[data-theme] .ov-compact {gap:18px}
html[data-theme] :is(.ov-compact>h1,.rt-section-heading h1,.pw-heading h1) {font-size:clamp(26px,3vw,36px);margin:0}
.ov-compact-layout {display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:18px;align-items:start}
.ov-compact-main,.ov-compact-aside {display:grid;gap:18px;min-width:0}
.ov-summary {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ov-summary-item {min-width:0;min-height:138px;border-radius:17px;background:var(--ov-tint)}
.ov-summary-sage {--ov-tint:#dce5d7}
.ov-summary-amber {--ov-tint:#f1e3bb}
.ov-summary-lavender {--ov-tint:#e6def3}
[data-theme=dark] .ov-summary-sage {--ov-tint:#2a392e}
[data-theme=dark] .ov-summary-amber {--ov-tint:#3b3122}
[data-theme=dark] .ov-summary-lavender {--ov-tint:#332b40}
html[data-theme] .ov-summary-flip {width:100%;height:138px;aspect-ratio:auto}
html[data-theme] .ov-summary-face {background:var(--ov-tint);border-color:transparent}
.ov-summary-flip>div:first-child {display:none}
.ov-summary-copy {display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:8px;height:100%;padding:14px 16px}
.ov-summary-copy h2,.ov-summary-item>h2 {margin:0;font-size:13px;line-height:1.25;font-weight:650}
.ov-summary-copy strong,.ov-summary-item>strong {font-size:clamp(19px,2.35vw,32px);letter-spacing:-.04em;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.ov-summary-copy :is(p,small) {font-size:11px;line-height:1.35;margin:0}
.ov-summary-item> :is(h2,strong) {display:block;padding:10px 14px 0}
html[data-theme] .ov-compact .ov-panel {padding:16px 18px;margin:0}
html[data-theme] .ov-compact .ov-panel h2 {font-size:15px}
.ov-compact .ov-panel-head {margin-bottom:10px}
.ov-compact .ov-empty {margin:0}
.ov-cash-chart {min-width:0}
.ov-budget-note {font-size:12px;margin:0}
.ov-spending-ring .rt-library-metric {border:0;box-shadow:none;padding:0}
.rt-compact-records {list-style:none;padding:0;margin:0}
.rt-compact-records>li+li {border-top:1px solid var(--a-line)}
.rt-compact-record {display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;color:var(--a-ink);text-decoration:none;font-size:13px}
.rt-compact-record:hover strong {color:var(--a-accent)}
.rt-compact-record>div {min-width:0;overflow-wrap:anywhere}
.rt-compact-record small {display:block;margin-top:3px;font-size:11px}
.rt-record-value {font-size:12px;text-align:right;font-variant-numeric:tabular-nums;flex-shrink:0;max-width:45%;overflow-wrap:anywhere}
.rt-finance-overview .rt-data-panel {margin:0}
html[data-theme] .rt-section-heading {margin-bottom:12px}
@media(max-width:1000px){.ov-compact-layout {grid-template-columns:minmax(0,1fr)}.ov-compact-aside {grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.ov-summary {gap:6px}.ov-summary-copy {padding:9px;gap:5px}.ov-summary-copy h2{font-size:11px}.ov-summary-copy strong{font-size:16px}.ov-summary-copy :is(p,small){font-size:10px}.ov-compact-aside {grid-template-columns:1fr}html[data-theme] #rt-refresh-view {font-size:11px;padding:7px 9px}}
@media(prefers-reduced-motion:reduce){.rt-theme-toggle:hover{transform:none}}
/* The selected tab indicator stays mounted while section content changes. */
html[data-theme] .rt-library-tabs {
  flex-wrap: nowrap;
  justify-content: flex-start;
  overflow-x: auto;
  scrollbar-width: thin;
}
html[data-theme] .rt-library-tabs [data-slot=halo-tabs-indicator] {
  transition: left 240ms cubic-bezier(.22,.8,.3,1), width 240ms cubic-bezier(.22,.8,.3,1);
}
.rt-section-panel { min-width: 0; }
.rt-section-panel[aria-busy=true] { opacity: .72; }
html[data-theme] .rt-filter-bar {
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--a-line);
  border-radius: 16px;
  background: var(--a-panel);
}
.rt-filter-search { position: relative; flex: 1 1 225px; min-width: 0; }
.rt-filter-search > svg, .rt-filter-select > svg {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--a-muted);
}
.rt-filter-search > svg { left: 13px; }
.rt-filter-select { position: relative; display: block; }
.rt-filter-select > svg { right: 11px; transform: translateY(-50%) rotate(90deg); }
html[data-theme] .rt-filter-bar :is(input,select) {
  min-width: 0;
  min-height: 40px;
  margin: 0;
  border-radius: 10px;
  font-size: 13px;
}
html[data-theme] .rt-filter-bar input { width: 100%; padding-left: 38px; }
html[data-theme] .rt-filter-bar select { width: 100%; padding-right: 32px; appearance: none; cursor: pointer; }
.rt-filter-label { min-width: 120px; flex: 0 1 auto; }
.rt-filter-label > span:first-child { font-size: 11px; font-weight: 650; letter-spacing: .025em; }
.rt-board-note { margin: 0 0 12px; font-size: 12px; }
.rt-board-stage { color: var(--a-muted); font-size: 11px; }
html[data-theme] .rt-board-move { align-self: flex-start; max-width: 100%; margin: 4px 0 0; padding: 4px 6px; font-size: 11px; cursor: pointer; }
html[data-theme] .rt-board-lane { min-height: 168px; border: 1px solid var(--a-line); }
html[data-theme] .rt-board-lane[data-drop-active=true] { border-color: var(--a-accent); }
@media(max-width:620px){
  .rt-filter-search { flex-basis: 100%; }
  .rt-filter-label { min-width: min(115px,100%); flex: 1 1 115px; }
}
@media(prefers-reduced-motion:reduce){
  html[data-theme] .rt-library-tabs [data-slot=halo-tabs-indicator] { transition: none; }
}

`;

export function registerAppearance(app:FastifyInstance){
 for(const [url,type,body] of [['/appearance.js','text/javascript',appearanceScript],['/appearance.css','text/css',appearanceCss]])app.get(url!,{schema:{hide:true}},(_request,reply)=>reply.header('Cache-Control','no-store').type(type!+'; charset=utf-8').send(body));
 app.addHook('onSend',async(_request,reply,payload)=>{
  if(typeof payload!=='string'||!String(reply.getHeader('content-type')).startsWith('text/html'))return payload;
  return payload.replace('<head>','<head><script src="/appearance.js"></script>').replace('</head>','<link rel="stylesheet" href="/appearance.css"></head>');
 });
}
