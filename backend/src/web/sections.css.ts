export const sectionsCss = `
.rt-shell .rt-sidebar-footer > .rt-nav-item {margin-bottom:6px;}
.rt-section-view { display:grid; grid-template-columns:minmax(0,1fr); gap:24px; min-width:0; }
.rt-section-view h1,.rt-section-view h2,.rt-section-view h3 {margin:0;color:#101827;letter-spacing:-.025em;}
.rt-section-heading {width:100%;max-width:none;margin:0;border:0;padding:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.rt-section-heading > div {flex:1 0 min(300px,100%);}
.rt-section-heading h1 {font-size:clamp(2rem,5vw,3.2rem);line-height:1.1;}
.rt-section-kicker {font-size:.72rem;text-transform:uppercase;letter-spacing:.12em;color:#0d6d60;font-weight:700;margin:0 0 8px;}
.rt-data-muted {color:#475569;font-size:.875rem;}
.rt-section-tabs,.rt-section-tabs [data-slot=tabs-content],.rt-data-scroll {min-width:0;}
.rt-section-tabs [data-slot=tabs-list],.rt-tab-fallback {margin:0 0 16px;border-bottom:1px solid #dce4ed;max-width:100%;}
.rt-section-tabs [data-slot=tabs-trigger] {flex:0 0 auto;color:#475569;min-height:42px;}
.rt-section-tabs [data-slot=tabs-trigger][data-state=active] {color:#0f6253;font-weight:650;}
.rt-tab-fallback {display:flex;gap:14px;overflow:auto;padding:8px 0;}
.rt-tab-fallback a {white-space:nowrap;}
.rt-tab-fallback [aria-current] {font-weight:700;}
.rt-data-panel,.rt-pipeline-card {background:#ffffff;border:1px solid #dce4ed;border-radius:18px;padding:18px;min-width:0;}
.rt-data-panel h2 {font-size:1.2rem;margin-bottom:10px;}
.rt-data-panel > .rt-btn {margin:8px 8px 0 0;}
.rt-data-empty {margin:0;padding:20px 10px;color:#475569;font-size:.9rem;}
.rt-data-scroll {overflow-x:auto;}
.rt-data-table {width:100%;border-collapse:collapse;text-align:left;font-size:.875rem;background:transparent;}
.rt-data-table th,.rt-data-table td {padding:13px 12px;border-bottom:1px solid #e9eef4;vertical-align:top;text-align:left;}
.rt-data-table th {color:#475569;font-size:.73rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}
.rt-data-table td:not(:has(details)) {min-width:92px;}
.rt-data-table tr:last-child td {border-bottom:0;}
.rt-data-controls {display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:0 0 14px;}
.rt-data-panel .rt-data-controls {margin:16px 0 0;align-items:center;}
.rt-data-controls label {display:grid;gap:4px;color:#475569;font-size:.8rem;}
.rt-data-controls input,.rt-data-controls select {min-height:42px;color:#101827;background:#ffffff;border:1px solid #dce4ed;border-radius:10px;padding:8px 12px;font:inherit;max-width:100%;}
.rt-data-controls input {flex:1;min-width:min(240px,100%);}
.rt-data-facts {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 12px;font-size:.85rem;margin:12px 0;}
.rt-data-facts dt {color:#475569;}
.rt-data-facts dd {margin:0;overflow-wrap:anywhere;}
.rt-pipeline {display:grid;grid-auto-flow:column;grid-auto-columns:minmax(228px,1fr);gap:12px;overflow-x:auto;padding:0 0 14px;}
.rt-pipeline-column {background:#eaf0f6;border-radius:18px;padding:12px;min-height:244px;}
.rt-pipeline-heading {display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 1px 10px;}
.rt-pipeline-heading h2,.rt-pipeline-card h3 {font-size:1rem;}
.rt-pipeline-card {padding:12px;margin-bottom:8px;}
.rt-pipeline-card p {margin:0 0 5px;}
.rt-data-stack {display:grid;grid-template-columns:minmax(0,1fr);gap:12px;}
.rt-finance-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
.rt-finance-lower {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:14px;margin-top:14px;}
.rt-metric-island,.rt-library-metric {background:#ffffff;border-color:#dce4ed;min-width:0;}
.rt-metric-island {border-radius:24px;}
.rt-metric-island > :not([data-slot]) {margin:12px 16px;display:block;}
.rt-data-detail,.rt-ledger-details {padding:8px 0;}
.rt-data-detail + .rt-data-detail {border-top:1px solid #e9eef4;}
.rt-data-detail summary,.rt-ledger-details summary {cursor:pointer;font-weight:650;color:#0f6253;padding:5px 0;}
.rt-data-detail-body {padding:8px 0;overflow-wrap:anywhere;}
.rt-data-detail-body > .rt-btn {margin:0 8px 12px 0;}
.rt-data-job-group + .rt-data-job-group {margin-top:18px;border-top:1px solid #e9eef4;padding-top:18px;}
.rt-data-job-group > .rt-data-muted {margin:4px 0;}
.rt-data-job-reports {margin:10px 0 18px;}
.rt-data-job-reports > .rt-btn {margin:8px 8px 0 0;}
.rt-job-lifecycle {display:flex;gap:5px;flex-wrap:wrap;padding:0;list-style:none;}
.rt-job-lifecycle li {border-radius:99px;background:#eff3f8;padding:4px 9px;color:#475569;font-size:.78rem;}
.rt-job-lifecycle li[data-recorded=true] {background:#e3f3ef;color:#31533c;}
.rt-job-lifecycle li[aria-current=step] {background:#0f6253;color:#fff;}
.rt-data-timeline {padding:0 0 0 20px;}
.rt-data-timeline li {padding:4px 0;}
.rt-data-timeline li span {display:block;font-size:.8rem;color:#475569;}
.rt-ledger-details[open] {min-width:min(340px,68vw);}
.rt-blocker-list {padding-left:16px;margin:0;min-width:175px;}
.ov-library-halftone {pointer-events:none;opacity:.22;}
@media(prefers-reduced-motion:reduce){.rt-section-view *{scroll-behavior:auto!important;transition:none!important;animation:none!important;}}
.rt-section-view .rt-data-controls :is(input,select) {margin:0;}
@media(max-width:930px){.rt-finance-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:480px){.rt-finance-grid{grid-template-columns:minmax(0,1fr);}}
@media(max-width:720px){.rt-finance-lower{grid-template-columns:1fr;}.rt-data-panel{padding:13px;}.rt-section-heading{gap:8px;}}
.rt-shell .rt-sidebar { box-shadow:0 8px 24px #1e293b0a; }
.rt-shell .rt-nav-item.active { background:#142638; }
.rt-shell .rt-nav-item:not(.active):hover { background:#edf3f8; }
.rt-shell .rt-topbar { background:#f3f6fa; }
.rt-shell .rt-brand-logo { background:#112638; color:#7de2cd; }
.rt-section-heading h1 {font-size:clamp(2rem,4vw,2.7rem);}
.rt-section-heading .rt-data-muted {margin:.35rem 0 0;}
.rt-section-kicker {margin-bottom:5px;}
.rt-section-tabs [data-slot=tabs-trigger][data-state=active] {background:#e4f3ef;color:#0a5d4e;}
.rt-section-tabs [data-slot=tabs-list] {height:auto;padding-block:5px;}
.rt-section-tabs [data-slot=tabs-trigger] {padding-inline:14px;}
.rt-finance-overview {display:grid;gap:14px;}
.rt-finance-overview .rt-finance-lower {margin-top:0;}
.rt-data-table tbody tr:hover {background:#f8fafc;}
.rt-pipeline-column {background:#eaf0f6;border:1px solid #e0e8f2;}
.rt-pipeline-card {box-shadow:0 2px 8px #1529400c;}
.rt-card-flags {display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:9px;}
.rt-project-excerpt {display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;color:#475569;font-size:.79rem;}
.rt-fleet-map {padding:18px;}
.rt-workflow {display:grid;justify-items:center;gap:8px;margin:16px 0;}
.rt-fleet-card {display:grid;gap:5px;padding:13px;border:1px solid #dce4ed;border-radius:14px;background:#f8fafc;min-width:0;}
.rt-fleet-card svg {color:#0e7464;}
.rt-fleet-card small {color:#475569;line-height:1.4;}
.rt-fleet-coordinator {width:min(100%,390px);background:#edf8f6;border-color:#cae7e1;}
.rt-fleet-specialists {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;width:100%;}
.rt-workflow-connector {margin:0;font-size:.78rem;color:#0e7464;}
.rt-proposal-detail {display:grid;gap:10px;}
.rt-proposal-detail > p {margin:0;}
.rt-proposal-metrics {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
.rt-review-alert {background:#fff7e5;color:#763e13;border:1px solid #f2dbac;border-radius:12px;padding:10px 14px;}
.rt-review-alert ul {padding-left:20px;margin:4px 0;}
.rt-field-tree {display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,2.5fr);gap:7px 10px;overflow-wrap:anywhere;}
.rt-field-tree dt {color:#475569;font-weight:600;}
.rt-field-tree dd {margin:0;white-space:pre-wrap;min-width:0;}
.rt-field-list {padding-left:19px;}
.rt-artifact-list {display:flex;flex-wrap:wrap;gap:7px;}
.rt-audit-timeline {list-style:none;margin:10px 0;padding:0;}
.rt-audit-timeline li {border-left:2px solid #c9e8e1;padding:9px 0 9px 13px;display:grid;grid-template-columns:110px minmax(0,1fr) minmax(0,.8fr) auto;gap:8px;align-items:center;overflow-wrap:anywhere;}
.rt-audit-timeline .ov-link {min-width:0;white-space:normal;overflow-wrap:anywhere;}
.rt-audit-timeline .ov-link svg {flex:none;}
.rt-audit-timeline time {font-size:.78rem;color:#475569;}
.rt-audit-timeline li .ov-badge {justify-self:start;}
.rt-skeleton {height:68px;background:#e9eff6;border-radius:14px;margin-bottom:10px;max-width:700px;}
.rt-skeleton:first-of-type {width:60%;height:34px;}
@media(max-width:940px){.rt-fleet-specialists,.rt-proposal-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:720px){.rt-audit-timeline li{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:480px){.rt-proposal-metrics{grid-template-columns:minmax(0,1fr);}.rt-field-tree{grid-template-columns:minmax(0,1fr);}}
.rt-sync {font-size:.72rem;color:#475569;white-space:nowrap;}
.rt-commercial-month {display:grid;gap:4px;margin:10px 0;}
.rt-commercial-month > div {display:grid;grid-template-columns:minmax(105px,1fr) 2fr;gap:8px;align-items:center;}
.rt-commercial-month progress {width:100%;accent-color:#0e7464;}
/* Shared operations surfaces and official component adaptations. */
.rt-discord{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;min-width:0;align-items:start}.rt-discord-sidebar,.rt-discord-feed{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;min-width:0}.rt-discord-sidebar{position:sticky;top:16px}.rt-discord-sidebar h2{font-size:18px;margin:8px 0}.rt-discord-sidebar .rt-data-controls{display:grid;gap:10px}.rt-discord-sidebar select{width:100%;min-width:0}.rt-discord-feed{min-height:400px}.rt-discord-message{padding:20px 0;border-top:1px solid #e2e8f0;overflow-wrap:anywhere}.rt-discord-author{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rt-discord-author time{font-size:11px;margin-left:auto}.rt-discord-content{white-space:pre-wrap;line-height:1.7;font-size:13px;color:#334155}.rt-discord-message[data-role=coordinator]{border-left:3px solid #0d9870;padding-left:14px}.rt-discord-attachment{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#f5f7fa;border:1px solid #e2e8f0;padding:12px;border-radius:12px;margin:8px 0}.rt-discord-attachment small{color:#64748b}.rt-discord-marker{color:#087356;background:#edf9f4;padding:10px;border-radius:10px;font-size:12px}.rt-discord-message details{font-size:11px;color:#64748b}.rt-discord-message summary{cursor:pointer}.rt-data-badge{font-size:10px;color:#64748b;background:#f1f5f9;border-radius:5px;padding:3px 6px}.rt-breadcrumb{margin-bottom:16px}.rt-cult-kanban{display:grid;grid-template-columns:repeat(6,minmax(220px,1fr));gap:16px;min-width:0;padding:12px 3px}.rt-pipeline:has(.rt-cult-kanban){display:block;overflow-x:auto}.rt-cult-kanban>div{background:#edf1f6;border:1px solid #e2e8f0;border-radius:14px;padding:12px}.rt-cult-kanban a{color:#182230;font-weight:600;text-decoration:none}.rt-cult-kanban [draggable=false]{cursor:default;user-select:text}.rt-upload-island{margin:8px 0 16px}.rt-upload-native{font-size:11px!important;min-height:32px!important}.rt-original-button{display:none!important}.rt-halo-action{min-height:38px;border-radius:11px!important}.rt-halo-button-host{display:inline-flex;vertical-align:middle}.rt-deadline-picker{margin:8px 0}.rt-deadline-picker summary{cursor:pointer;font-size:12px;color:#08775a}.rt-deadline-picker button{margin:0;padding:0;border:0}.rt-deadline-picker [data-day]{font-family:inherit}.rt-project-expand{max-width:1040px;margin:auto;background:#f5f7fa;box-shadow:0 25px 80px #14223326;border:1px solid #dce4ed}.rt-create-content{padding:clamp(18px,4vw,44px);max-width:900px;margin:auto;box-sizing:border-box}.rt-create-content .pw-panel{background:white}.rt-flip-card{width:100%;height:190px;max-width:440px}.rt-flip-content{padding:24px;text-align:left}.rt-flip-content p{overflow-wrap:anywhere;font-size:12px}.rt-flip-content h3{font-size:17px}.rt-auth-body{margin:0;background:#f5f7fa;color:#182230;font-family:Inter,system-ui,sans-serif}.rt-auth-layout{min-height:100dvh;display:grid;grid-template-columns:1fr 1fr;align-items:center;max-width:1280px;margin:auto;padding:36px;gap:8vw;box-sizing:border-box}.rt-auth-story{background:#122132;color:white;align-self:stretch;border-radius:24px;padding:48px;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}.rt-auth-brand{color:white;font-size:20px;letter-spacing:-.5px;text-decoration:none;position:absolute;top:40px}.rt-auth-story h1{color:white;font-size:clamp(42px,5vw,68px);line-height:1.06;letter-spacing:-3px;margin:20px 0}.rt-auth-story p{color:#b3c4d8;line-height:1.8;font-size:15px}.rt-auth-story small{margin-top:64px;color:#b3c4d8;line-height:1.7}.rt-auth-kicker{color:#0d9870;font-size:11px;font-weight:650;letter-spacing:2px}.rt-auth-story .rt-auth-kicker{color:#7edbb6}.rt-auth-card{min-width:0;width:100%;max-width:420px;margin:auto;padding:24px 0}.rt-auth-card h1,.rt-auth-card h2{font-size:32px;letter-spacing:-1px}.rt-auth-note{font-size:12px;color:#64748b;line-height:1.8}.rt-auth-card button[type=submit]{background:#0d9870!important;color:white;min-height:44px;border:0;border-radius:10px}.rt-auth-card input{box-sizing:border-box;min-width:0}.rt-auth-card button{font-family:inherit;cursor:pointer}.rt-auth-card a{font-size:12px;color:#08775a}.rt-auth-card [data-slot=smooth-button]{border-radius:10px}.rt-auth-card p{line-height:1.7}
.rt-shell .rt-sidebar{background:#142132;border:1px solid #27384b;color:#dce6f2;box-shadow:0 12px 30px #14213214}.rt-shell .rt-sidebar :is(.rt-brand-name,.rt-brand-title){color:white}.rt-shell .rt-sidebar .rt-nav-item{color:#adbed2;border-radius:12px}.rt-shell .rt-sidebar .rt-nav-item.active{background:#0d9870;color:white}.rt-shell .rt-sidebar .rt-nav-item:not(.active):hover{background:#22374e;color:white}.rt-shell .rt-sidebar :is(.rt-nav-label,.rt-sidebar-footer,.rt-brand-subtitle){color:#91a5bd}.rt-shell .rt-sidebar .rt-brand-logo{background:#243c50;color:#7edbb6}.rt-shell .rt-topbar{background:#f5f7fa}.rt-shell .rt-data-panel{border-radius:16px}.rt-library-tabs[data-slot=halo-tabs-list]{max-width:100%;flex-wrap:nowrap;overflow-x:auto;gap:4px}.rt-library-tabs [data-slot=halo-tabs-trigger]{font-size:12px;flex-shrink:0;min-height:36px}.rt-library-tabs [data-slot=halo-tabs-trigger][data-active]{color:#08775a}.rt-library-tabs [data-slot=halo-tabs-indicator]{background:#e0f3eb;border:1px solid #c2e6d8;box-shadow:none}.rt-library-tabs [data-slot=halo-tabs-indicator] span{display:none}.rt-library-tabs [data-slot=halo-tabs-trigger]{border:0;background:transparent}
@keyframes kokonut-ai-wave{50%{opacity:.3}}.kokonut-ai-wave{animation:kokonut-ai-wave 1.6s ease-in-out infinite both}.rt-processing-island{margin:16px 0}.rt-processing-island [class*=tabular-nums]{display:none}
@media(max-width:1000px){.rt-discord{grid-template-columns:220px minmax(0,1fr)}.rt-discord-sidebar,.rt-discord-feed{padding:14px}.rt-auth-layout{gap:32px;padding:24px}.rt-auth-story{padding:28px}}
@media(max-width:760px){.rt-discord{grid-template-columns:1fr}.rt-discord-sidebar{position:static}.rt-discord-sidebar .rt-data-controls{grid-template-columns:1fr 1fr}.rt-discord-sidebar .rt-data-controls button{grid-column:1/-1}.rt-discord-author time{margin-left:0}.rt-auth-layout{grid-template-columns:1fr;min-height:100dvh;padding:24px}.rt-auth-story{min-height:220px;padding:24px}.rt-auth-story h1{font-size:36px;letter-spacing:-1.5px;margin:28px 0 5px}.rt-auth-story .rt-auth-kicker,.rt-auth-story small{display:none}.rt-auth-brand{top:20px;font-size:16px}.rt-auth-story p{margin-bottom:0;font-size:12px}.rt-auth-card{padding:0}.rt-create-content{padding:18px}.rt-discord-attachment .rt-btn{width:100%}}
@media(prefers-reduced-motion:reduce){.kokonut-ai-wave{animation:none}.rt-discord-message{animation:none}.rt-project-expand *{transition:none!important}}
`;
