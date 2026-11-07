export const overviewCss = String.raw`
/* Shared shell. The overview-specific rules below are scoped to .ov-view. */
.rt-shell {
  --shell-gutter: clamp(18px, 3vw, 44px);
  --shell-max: 1460px;
  align-items: flex-start;
}
.rt-shell .rt-sidebar {
  width: 210px;
  height: calc(100dvh - 28px);
  top: 14px;
  margin: 14px 0 14px 14px;
  padding: 12px 10px;
  border: 1px solid #dce4ed;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 5px 18px #17273b12;
  transition: width 190ms ease, transform 190ms ease;
}
.rt-shell .rt-brand {
  height: 60px;
  padding: 4px 3px 13px;
  gap: 9px;
  flex-shrink: 0;
}
.rt-shell .rt-brand-logo {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 50%;
  background: #122635;
  box-shadow: none;
}
.rt-shell .rt-brand-badge, .rt-shell .rt-user-role {
  font-size: 11px;
  color: #475569;
  white-space: nowrap;
}
.rt-shell .rt-sidebar-section {
  padding: 17px 10px 8px;
  font-size: 10px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .11em;
  color: #475569;
  white-space: nowrap;
}
.rt-shell .rt-nav-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rt-shell .rt-nav-item {
  min-height: 39px;
  border-radius: 999px;
  padding: 0 10px;
  gap: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 160ms ease, color 160ms ease;
}
.rt-shell .rt-nav-icon { display: grid; place-items: center; flex: 0 0 20px; }
.rt-shell .rt-nav-item.active { background: #142638; color: #fff; }
.rt-shell .rt-nav-item.active::before { content: none; }
.rt-shell .rt-sidebar-footer { padding-top: 10px; }
.rt-shell .rt-user-pill {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #101827;
  text-decoration: none;
  border-radius: 999px;
}
.rt-shell .rt-user-pill:hover { background: #edf4f8; }
.rt-shell .rt-user-avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  border-radius: 50%;
  background: #e2f2e8;
  color: #065e45;
  font-weight: 750;
}
.rt-shell .rt-user-name { font-weight: 650; font-size: 12px; white-space: nowrap; }
.rt-shell.rt-nav-collapsed .rt-sidebar { width: 66px; }
.rt-nav-collapsed :is(.rt-nav-label,.rt-brand-copy,.rt-user-info,.rt-sidebar-section) {
  position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);
}
.rt-nav-collapsed .rt-nav-list { padding-top: 13px; }
.rt-nav-collapsed :is(.rt-brand,.rt-nav-item,.rt-user-pill) { justify-content: center; padding-inline: 0; }
.rt-shell .rt-topbar {
  max-width: var(--shell-max);
  width: 100%;
  height: auto;
  min-height: 64px;
  margin: 0 auto;
  padding: 10px var(--shell-gutter);
  background: #f3f6fa;
  border-bottom-color: #dce4ed;
  align-items: center;
}
.rt-shell .rt-content { max-width: var(--shell-max); padding: 22px var(--shell-gutter) 40px; }
.rt-shell .rt-breadcrumbs { color: #475569; }
.rt-breadcrumb-active { color: #101827; font-weight: 650; }
.rt-shell .rt-topbar-left { min-width: 0; gap: 12px; }
.rt-shell .rt-topbar-right { gap: 8px; }
.rt-shell .rt-menu-toggle { padding: 0; width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; }
.rt-menu-toggle svg { width: 16px; height: 16px; }
.rt-shell .rt-menu-close, .rt-shell .rt-menu-backdrop { display: none; }
.rt-shell:is([data-route=overview],[data-route=projects],[data-route=agency]) .rt-topbar-new { display: none; }
.rt-shell :is(a,button):focus-visible, .ov-chart-track:focus-visible {
  outline: 2px solid #087352;
  outline-offset: 3px;
}

.ov-view {
  --ov-border: #dce4ed;
  --ov-muted: #475569;
  --ov-ink: #101827;
  display: grid;
  gap: 17px;
  color: var(--ov-ink);
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.ov-view :is(h1,h2,p,ul,ol) { margin: 0; }
.ov-hero {
  position: relative;
  isolation: isolate;
  max-width: none;
  width: 100%;
  margin: 0;
  overflow: hidden;
  min-height: 166px;
  padding: 22px 23px;
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 14px;
  background: #edf8f6;
  border: 1px solid #d7e9e7;
  border-radius: 16px;
  animation: ov-enter 280ms ease both;
}
.ov-halftone {
  width: min(62%, 600px);
  height: 100%;
  position: absolute;
  right: 0;
  top: 0;
  z-index: -1;
  fill: #40877d;
  opacity: .55;
  pointer-events: none;
}
.ov-context, .ov-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.ov-context time { color: #566557; font-size: 12px; }
.ov-hero h1 {
  margin: 9px 0 4px;
  font-size: clamp(29px, 3.3vw, 49px);
  line-height: 1.06;
  font-weight: 720;
  letter-spacing: -.055em;
}
.ov-hero p { font-size: 13px; color: #526052; }
.ov-refresh-status { width: 100%; }
.ov-refresh-status:empty { display: none; }
.ov-view .rt-btn { border-radius: 999px; min-height: 38px; }
.ov-view .rt-btn:active { transform: translateY(1px); }
.ov-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 13px; }
.ov-metric, .ov-panel {
  min-width: 0;
  background: #fff;
  border: 1px solid var(--ov-border);
  border-radius: 15px;
  box-shadow: 0 2px 4px #14233805;
}
.ov-metric {
  padding: 14px 16px;
  margin: 0;
  transition: border-color 160ms ease, transform 160ms ease;
  animation: ov-enter 280ms ease both;
}
.ov-metric:nth-child(2) { animation-delay: 35ms; }
.ov-metric:nth-child(3) { animation-delay: 70ms; }
.ov-metric:nth-child(4) { animation-delay: 105ms; }
@media (hover: hover) {
  .ov-metric:hover { transform: translateY(-2px); border-color: #bacbdd; }
}
.ov-metric-head, .ov-panel-head, .ov-attention-meta, .ov-chart-label {
  display: flex; justify-content: space-between; gap: 8px; align-items: flex-start;
}
.ov-metric-head { align-items: center; }
.ov-metric h2 { font-size: 12px; font-weight: 660; color: #49534c; }
.ov-metric-icon {
  width: 33px; height: 33px; flex: 0 0 33px; display: grid; place-items: center;
  border-radius: 50%; background: #eef5f9; color: #365b43;
}
.ov-metric-value { display: block; margin: 4px 0; font-size: clamp(22px, 2.35vw, 34px); letter-spacing: -.05em; line-height: 1.1; overflow-wrap: anywhere; }
.ov-metric p, .ov-panel p, .ov-muted { color: var(--ov-muted); font-size: 12px; line-height: 1.5; }
.ov-grid { display: grid; grid-template-columns: minmax(0,1.8fr) minmax(0,1fr); gap: 15px; align-items: start; }
.ov-panel { padding: 16px 17px; animation: ov-enter 290ms ease both; }
.ov-panel h2 { font-size: 17px; letter-spacing: -.027em; line-height: 1.25; }
.ov-panel-head { align-items: start; margin-bottom: 14px; }
.ov-panel-head p { margin-top: 4px; }
.ov-link {
  display: inline-flex; align-items: center; gap: 3px; color: #086647; text-decoration: none;
  font-size: 12px; font-weight: 680; white-space: nowrap;
}
.ov-link:hover { text-decoration: underline; }
.ov-badge {
  display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px;
  white-space: nowrap; font-size: 11px; line-height: 1.4; font-weight: 680;
  background: #eef3f8; color: #485345; text-transform: none;
}
.ov-badge-green { background: #e5f5e9; color: #075e40; }
.ov-badge-amber { background: #fbefda; color: #754715; }
.ov-chart { display: grid; gap: 8px; animation: ov-enter 320ms ease both; }
.ov-chart-label { font-size: 12px; align-items: baseline; }
.ov-chart-track { position: relative; margin-top: 3px; border-radius: 4px; }
.ov-chart-track svg { display: block; width: 100%; height: 8px; border-radius: inherit; }
.ov-tooltip {
  display: none; position: absolute; bottom: calc(100% + 8px); inset-inline-start: 0;
  width: max-content; max-width: 100%; z-index: 2; background: #142638; color: white;
  border-radius: 8px; padding: 7px 9px; font-size: 11px;
}
.ov-chart-track:is(:hover,:focus) .ov-tooltip { display: block; }
.ov-legend { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 13px 0 0; font-size: 11px; color: #475569; }
.ov-key { display: flex; gap: 5px; align-items: center; }
.ov-key::before { content: ''; width: 7px; height: 7px; border-radius: 2px; background: #079b70; }
.ov-key-1::before { background: #252a25; }
.ov-key-2::before { background: #64748b; }
.ov-key-3::before { background: #c8d4e2; }
.ov-review-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #e9eef4; }
.ov-review-row strong { font-size: 20px; line-height: 1.1; }
.ov-panel .ov-panel-note { margin-top: 10px; }
.ov-panel .ov-empty { padding: 11px; border-radius: 9px; background: #f1f5f9; }
.ov-view .ov-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: auto; }
.ov-view .ov-table :is(th,td) {
  padding: 8px 5px; border-bottom: 1px solid #e9eef4; text-align: left; color: #222822; white-space: normal;
}
.ov-view .ov-table thead th { font-size: 11px; color: #475569; }
.ov-view .ov-table tbody tr:last-child > * { border-bottom: 0; }
.ov-view .ov-table tbody tr:hover { background: #f8fafc; }
.ov-project-identity { display: flex; gap: 7px; align-items: center; }
.ov-project-identity strong { display: block; overflow-wrap: anywhere; font-weight: 690; line-height: 1.3; }
.ov-monogram { display: grid; place-items: center; width: 29px; height: 29px; flex: 0 0 29px; background: #eaf1f7; border-radius: 8px; color: #375240; font-size: 10px; font-weight: 750; }
.ov-project-revenue strong, .ov-project-revenue small, .ov-project-identity small { display: block; }
.ov-project-identity small { overflow-wrap: anywhere; font-weight: 400; }
.ov-project-revenue strong { white-space: nowrap; }
.ov-attention, .ov-timeline { padding: 0; list-style: none; }
.ov-attention { display: grid; gap: 8px; }
.ov-attention li { padding: 9px 10px; border-radius: 10px; border: 1px solid #e4ebf3; background: #f8fafc; animation: ov-enter 260ms ease both; }
.ov-attention-meta { align-items: center; flex-wrap: wrap; font-size: 13px; }
.ov-attention li p { margin: 5px 0; }
.ov-timeline li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0 8px 13px; border-left: 2px solid #d9eadc; }
.ov-timeline strong { display: block; font-size: 13px; text-transform: capitalize; }
.ov-timeline time { font-size: 11px; color: #475569; text-align: right; }
@keyframes ov-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 1140px) {
  .ov-grid { grid-template-columns: minmax(0,1.6fr) minmax(0,1fr); }
  .ov-monogram { display: none; }
}
@media (max-width: 980px) {
  .ov-grid { grid-template-columns: minmax(0,1fr); }
  .ov-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }
}
@media (max-width: 768px) {
  .rt-shell .rt-sidebar {
    position: fixed; top: 9px; left: 9px; margin: 0; height: calc(100dvh - 18px);
    width: min(224px, calc(100vw - 48px)); visibility: hidden; transform: translateX(calc(-100% - 12px));
  }
  .rt-shell.rt-drawer-open .rt-sidebar { visibility: visible; transform: translateX(0); }
  .rt-shell .rt-menu-close { display: grid; place-items: center; min-width: 38px; min-height: 34px; align-self: end; margin-bottom: 3px; }
  .rt-shell .rt-menu-backdrop:not([hidden]) { display: block; position: fixed; inset: 0; z-index: 95; background: #131b1766; }
  body:has(.rt-drawer-open) { overflow: hidden; }
  .rt-shell .rt-topbar { min-height: 56px; gap: 8px; }
}
@media (max-width: 500px) {
  .rt-shell { --shell-gutter: 12px; }
  .rt-shell .rt-topbar-left { gap: 7px; }
  .rt-shell .rt-breadcrumbs { flex-wrap: wrap; gap: 3px; font-size: 11px; }
  .rt-shell .rt-topbar-right .rt-btn { padding: 6px 8px; font-size: 11px; }
  .rt-shell .rt-content { padding-top: 13px; }
  .ov-view { gap: 12px; }
  .ov-hero { padding: 15px; align-items: start; }
  .ov-halftone { opacity: .31; }
  .ov-metrics, .ov-grid { gap: 9px; }
  .ov-metric { padding: 10px; }
  .ov-metric-icon { width: 25px; height: 25px; flex-basis: 25px; }
  .ov-metric-icon svg { width: 13px; height: 13px; }
  .ov-panel { padding: 12px; }
  .ov-view .ov-table, .ov-view .ov-table tbody { display: block; }
  .ov-view .ov-table thead { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); overflow: hidden; }
  .ov-view .ov-table tr { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 5px 10px; padding: 8px 0; border-bottom: 1px solid #e9eef4; }
  .ov-view .ov-table :is(th,td) { display: block; border: 0; padding: 0; }
  .ov-view .ov-table th[scope=row] { grid-column: 1 / -1; }
  .ov-view .ov-table td::before { content: attr(data-label); display: block; font-size: 10px; color: #475569; }
}
@media (prefers-reduced-motion: reduce) {
  .rt-shell .rt-sidebar, .rt-shell .rt-nav-item, .ov-view *, .ov-view *::before { animation: none !important; transition: none !important; }
  .ov-metric:hover, .ov-view .rt-btn:active { transform: none; }
}
/* Overview dashboard. Keep the surrounding workspace shell and other pages shared. */
.ov-dashboard {
  --ov-ease: cubic-bezier(.22,.75,.22,1);
  --ov-chart-ink: #363630;
  --ov-ring-sage: #819a73;
  --ov-ring-amber: #c18c3d;
  --ov-ring-blue: #7297b2;
  --ov-ring-lavender: #9383df;
  font-family: "General Sans", "Avenir Next", Inter, -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif;
}
[data-theme=dark] .ov-view,
[data-theme=dark] .ov-dashboard {
  --ov-border: var(--a-line);
  --ov-muted: var(--a-muted);
  --ov-ink: var(--a-ink);
  --ov-chart-ink: #818cf8;
  --ov-ring-sage: #4ade80;
  --ov-ring-amber: #fbbf24;
  --ov-ring-blue: #60a5fa;
  --ov-ring-lavender: #c084fc;
  color: var(--a-ink);
}
.ov-dashboard-grid { display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:clamp(16px,2vw,26px);align-items:start; }
.ov-dashboard-main,.ov-dashboard-aside { display:grid;gap:16px;min-width:0; }
html[data-theme] .ov-dashboard-title { display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0;margin:0;border:0;min-height:51px; }
html[data-theme] .ov-dashboard-title h1 { margin:0;font-weight:700;font-size:clamp(25px,2.5vw,34px);letter-spacing:-.045em;color:var(--a-ink); }
.ov-dashboard-title p { margin:3px 0 0;font-size:13px;color:var(--a-muted); }
.ov-dashboard-metrics { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px; }
.ov-kpi {
  min-width:0;min-height:108px;padding:13px 14px;margin:0;
  border-radius:19px;background:var(--ov-tint);color:var(--a-ink);
  border: 1px solid color-mix(in srgb, var(--ov-glyph) 16%, transparent);
  box-shadow:0 2px 10px #28211406;
  animation:ov-arrive 320ms var(--ov-ease) var(--ov-enter-delay,0ms) both;
}
[data-theme=dark] .ov-kpi {
  background: var(--a-panel);
  border: 1px solid var(--a-line);
  box-shadow: none;
}
[data-theme=dark] .ov-kpi:hover {
  background: var(--a-raised);
  border-color: rgba(255, 255, 255, 0.16);
}
.ov-kpi-sage { --ov-tint:#dce7d4;--ov-glyph:#315b3b; }
.ov-kpi-amber { --ov-tint:#f5e4b7;--ov-glyph:#74551b; }
.ov-kpi-lavender { --ov-tint:#e5defb;--ov-glyph:#594590; }
.ov-kpi-blue { --ov-tint:#dce8f0;--ov-glyph:#34566e; }
.ov-kpi-peach { --ov-tint:#f2ded3;--ov-glyph:#804733; }
.ov-kpi-stone { --ov-tint:#e9e1d3;--ov-glyph:#675747; }
[data-theme=dark] .ov-kpi-sage { --ov-glyph:#4ade80; }
[data-theme=dark] .ov-kpi-amber { --ov-glyph:#fbbf24; }
[data-theme=dark] .ov-kpi-lavender { --ov-glyph:#c084fc; }
[data-theme=dark] .ov-kpi-blue { --ov-glyph:#60a5fa; }
[data-theme=dark] .ov-kpi-peach { --ov-glyph:#f87171; }
[data-theme=dark] .ov-kpi-stone { --ov-glyph:#2dd4bf; }
.ov-kpi-label { display:flex;gap:7px;align-items:center;min-height:27px; }
html[data-theme] .ov-kpi-label h2 { font-size:12px;line-height:1.2;font-weight:650;margin:0;letter-spacing:0;color:var(--a-ink); }
.ov-kpi-icon { flex:0 0 24px;width:24px;height:24px;display:grid;place-items:center;border-radius:8px;color:var(--ov-glyph);background:color-mix(in srgb,var(--ov-glyph) 12%,transparent); }
[data-theme=dark] .ov-kpi-icon { background: color-mix(in srgb, var(--ov-glyph) 14%, transparent); }
.ov-kpi-value { display:block;margin:6px 0 2px;font-weight:700;font-size:clamp(19px,2.4vw,33px);line-height:1.15;letter-spacing:-.045em;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;color:var(--a-ink); }
[data-theme=dark] .ov-kpi-value { color: #ffffff; }
html[data-theme] .ov-kpi p { color:var(--ov-glyph);font-size:11px;margin:4px 0 0;line-height:1.35; }
[data-theme=dark] .ov-kpi p { color: var(--a-muted); }
html[data-theme] .ov-dashboard .ov-panel {
  min-width:0;padding:16px 17px;margin:0;border-radius:20px;
  background:var(--a-panel);border:1px solid var(--a-line);box-shadow:var(--a-shadow);color:var(--a-ink);
}
[data-theme=dark] .ov-dashboard .ov-panel {
  background:var(--a-panel);border:1px solid var(--a-line);box-shadow:none;
}
html[data-theme] .ov-dashboard .ov-panel-head { margin:0 0 8px;align-items:flex-start; }
html[data-theme] .ov-dashboard .ov-panel-head h2 { font-size:16px;margin:0;letter-spacing:-.022em;color:var(--a-ink);font-weight:650; }
[data-theme=dark] .ov-dashboard .ov-panel-head h2 { color: #ffffff; }
html[data-theme] .ov-dashboard .ov-panel-head p { font-size:11px;margin:3px 0 0;color:var(--a-muted); }
[data-theme=dark] .ov-dashboard .ov-panel-head p { color: var(--a-muted); }
.ov-period { flex-shrink:0;padding:5px 8px;border-radius:100px;background:var(--a-subtle);color:var(--a-muted);font-size:10px;white-space:nowrap; }
[data-theme=dark] .ov-period { background: var(--a-subtle); color: var(--a-muted); }
.ov-chart-total { display:block;font-size:25px;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:var(--a-ink);font-weight:700; }
[data-theme=dark] .ov-chart-total { color: #ffffff; }
.ov-daily-chart { display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:clamp(6px,1.6vw,17px);margin:11px 0 0; }
.ov-day { display:grid;justify-items:center;gap:7px;min-width:0; }
.ov-day-track { position:relative;isolation:isolate;width:min(100%,55px);height:clamp(92px,12vw,155px);border-radius:13px;background:var(--a-subtle);cursor:default; }
[data-theme=dark] .ov-day-track { background:var(--a-subtle);border:none; }
[data-theme=dark] .ov-day-track:hover,[data-theme=dark] .ov-day-track:focus-visible { background:var(--a-raised); }
.ov-day-fill { position:absolute;inset:0;border-radius:inherit;background:var(--ov-chart-ink);transform-origin:bottom;clip-path:inset(calc((1 - var(--ov-bar-scale,0))*100%) 0 0 round 12px);transition:clip-path 410ms var(--ov-ease),background-color 180ms ease; }
@starting-style { .ov-day-fill { clip-path: inset(100% 0 0 round 12px); } }
.ov-day-track:hover .ov-day-fill,.ov-day-track:focus-visible .ov-day-fill { background:var(--ov-ring-lavender); }
.ov-day-label { font-size:11px;color:var(--a-muted);font-weight:600; }
[data-theme=dark] .ov-day-label { color: var(--a-muted); font-size: 11px; }
.ov-day-tooltip { position:absolute;bottom:calc(100% + 6px);left:50%;transform:translate(-50%,4px);pointer-events:none;background:var(--a-ink);color:var(--a-bg);padding:5px 8px;white-space:nowrap;font-size:10px;border-radius:7px;opacity:0;transition:opacity 140ms ease,transform 140ms ease;z-index:2; }
[data-theme=dark] .ov-day-tooltip { background: #ffffff; color: #121316; font-weight: 600; }
.ov-day:first-child .ov-day-tooltip { left:0;transform:translate(0,4px); }
.ov-day:last-child .ov-day-tooltip { left:auto;right:0;transform:translate(0,4px); }
.ov-day-track:hover .ov-day-tooltip,.ov-day-track:focus-visible .ov-day-tooltip { opacity:1; }
.ov-chart-note,.ov-ring-context { margin:9px 0 0;font-size:11px;line-height:1.45;color:var(--a-muted); }
[data-theme=dark] .ov-chart-note { color: var(--a-muted); font-size: 11px; }
html[data-theme] .ov-ring-component { max-width:none;padding:0;background:transparent;border:0;animation:ov-arrive 320ms var(--ov-ease) both; }
.ov-ring-component [role=slider] { max-width:185px; }
.ov-ring-component ul {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
  gap: 8px !important;
  margin: 12px 0 0 !important;
  padding: 0 !important;
  list-style: none !important;
}
.ov-ring-component li {
  display: flex !important;
  justify-content: center !important;
  min-width: 0 !important;
}
.ov-ring-component li button { min-height:31px; }
[data-theme=dark] .ov-ring-component button {
  background: var(--a-raised) !important;
  color: var(--a-ink) !important;
  border: 1px solid var(--a-line) !important;
  border-radius: 999px !important;
  padding: 6px 14px !important;
  font-size: 11.5px !important;
  font-weight: 550 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  transition: all 160ms ease !important;
}
[data-theme=dark] .ov-ring-component button * {
  color: inherit !important;
}
[data-theme=dark] .ov-ring-component button[aria-pressed=true] {
  background: var(--a-subtle) !important;
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.22) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}
[data-theme=dark] .ov-ring-component button[aria-pressed=false]:hover {
  background: var(--a-subtle) !important;
  color: #ffffff !important;
}
[data-theme=dark] .ov-ring-component button .tabular-nums {
  color: var(--a-muted) !important;
  font-weight: 600 !important;
  margin-left: 4px !important;
}
[data-theme=dark] .ov-ring-component button[aria-pressed=true] .tabular-nums {
  color: #ffffff !important;
}
[data-theme=dark] .ov-ring-component p {
  color: var(--a-muted) !important;
}
[data-theme=dark] .ov-ring-component .font-semibold {
  color: #ffffff !important;
}
[data-theme=dark] .ov-ring-component svg > path:not([stroke]) {
  fill: #ffffff !important;
}
.ov-ring-component svg path.ov-ring-sage { stroke:var(--ov-ring-sage); }
.ov-ring-component svg path.ov-ring-amber { stroke:var(--ov-ring-amber); }
.ov-ring-component svg path.ov-ring-blue { stroke:var(--ov-ring-blue); }
.ov-ring-component svg path.ov-ring-lavender { stroke:var(--ov-ring-lavender); }
.ov-ring-component span.ov-ring-sage { background:var(--ov-ring-sage); }
.ov-ring-component span.ov-ring-amber { background:var(--ov-ring-amber); }
.ov-ring-component span.ov-ring-blue { background:var(--ov-ring-blue); }
.ov-ring-component span.ov-ring-lavender { background:var(--ov-ring-lavender); }
[data-theme=dark] .ov-ring-context {
  color: var(--a-muted);
  text-align: center;
  margin-top: 12px;
  font-size: 11px;
}
.ov-empty-ring { display:grid;justify-items:center;align-content:center;gap:8px;width:min(100%,172px);aspect-ratio:1;border:9px solid var(--a-subtle);border-radius:50%;margin:12px auto;color:var(--a-muted);font-size:11px; }
.ov-client-list { list-style:none;display:grid;gap:7px;margin:0;padding:0; }
.ov-client-row { display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:9px;align-items:center;padding:9px 10px;border-radius:13px;background:var(--a-raised);border:1px solid var(--a-line);color:var(--a-ink);text-decoration:none;transition:background-color 160ms ease,transform 160ms ease,border-color 160ms ease; }
[data-theme=dark] .ov-client-row {
  background: var(--a-raised);
  border: 1px solid var(--a-line);
}
[data-theme=dark] .ov-client-row:hover {
  background: var(--a-subtle);
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateX(2px);
}
.ov-client-avatar { display:grid;place-items:center;width:30px;height:30px;border-radius:50%;font-size:10px;font-weight:750;background:#e5defb;color:#594590; }
.ov-avatar-1 { background:#dce7d4;color:#315b3b; }
.ov-avatar-2 { background:#f5e4b7;color:#74551b; }
.ov-avatar-3 { background:#dce8f0;color:#34566e; }
[data-theme=dark] .ov-client-avatar { background:#2e2640;color:#c4b5fd;font-weight:700; }
[data-theme=dark] .ov-avatar-1 { background:#1e3325;color:#86efac;font-weight:700; }
[data-theme=dark] .ov-avatar-2 { background:#3b2d18;color:#fde047;font-weight:700; }
[data-theme=dark] .ov-avatar-3 { background:#1e2c3d;color:#93c5fd;font-weight:700; }
.ov-client-identity,.ov-client-meta { display:grid;min-width:0;gap:2px; }
.ov-client-identity strong,.ov-client-identity span,.ov-client-identity small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.ov-client-identity strong { font-size:12px;line-height:1.25;color:var(--a-ink);font-weight:650; }
[data-theme=dark] .ov-client-identity strong { color: #ffffff; }
.ov-client-identity span { font-size:11px;line-height:1.25;color:var(--a-muted); }
.ov-client-identity small { font-size:10px;line-height:1.2;color:var(--a-muted);opacity:.85; }
[data-theme=dark] .ov-client-identity small { color: var(--a-muted); opacity: 1; font-size: 11px; }
.ov-client-meta { text-align:right; }
.ov-client-meta small {
  display:inline-flex;align-items:center;justify-content:center;
  padding:2px 8px;border-radius:999px;background:var(--a-subtle);
  color:var(--a-ink);border:1px solid var(--a-line);font-size:10px;
  font-weight:600;letter-spacing:.02em;white-space:nowrap;
}
[data-theme=dark] .ov-client-meta small {
  background: var(--a-subtle);
  color: var(--a-muted);
  border: 1px solid var(--a-line);
}
.ov-client-meta strong { font-size:12px;line-height:1.25;color:var(--a-ink);font-weight:650; }
[data-theme=dark] .ov-client-meta strong { color: #ffffff; }
[data-theme=dark] .ov-client-panel .ov-link { color: var(--a-accent); font-weight: 600; }
[data-theme=dark] .ov-client-panel .ov-link:hover { color: #ffffff; }
.ov-dashboard .rt-compact-records>li+li { border-top:1px solid var(--a-line); }
.ov-dashboard .rt-compact-record { padding-block:8px; }
.ov-dashboard .rt-compact-record strong { color:var(--a-ink);font-size:12px;font-weight:650; }
[data-theme=dark] .ov-dashboard .rt-compact-record strong { color: #ffffff; }
.ov-dashboard .rt-compact-record small { color:var(--a-muted);font-size:11px; }
[data-theme=dark] .ov-dashboard .rt-compact-record small { color: var(--a-muted); }
.ov-dashboard .rt-record-value { color:var(--a-muted);font-size:11px;font-weight:600; }
[data-theme=dark] .ov-dashboard .rt-record-value { color: var(--a-muted); }
[data-theme=dark] .rt-compact-record:hover strong { color: var(--a-accent); }
.ov-dashboard .ov-empty { color:var(--a-muted);background:var(--a-subtle);border:1px solid var(--a-line);border-radius:12px;padding:14px; }
[data-theme=dark] .rt-demo-access-banner {
  background: var(--a-raised);
  border: 1px solid var(--a-line);
  color: var(--a-muted);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
.ov-dashboard-title [hidden] { display:none; }
@keyframes ov-arrive { from { opacity:0;transform:translateY(7px); } to { opacity:1;transform:translateY(0); } }
@media(max-width:1050px) {
  .ov-dashboard-grid { grid-template-columns:minmax(0,1fr); }
  .ov-dashboard-aside { grid-template-columns:repeat(2,minmax(0,1fr));align-items:start; }
}
@media(max-width:540px) {
  .ov-dashboard-aside { grid-template-columns:minmax(0,1fr); }
  .ov-dashboard-metrics { grid-template-columns:repeat(2,minmax(0,1fr));gap:8px; }
  .ov-kpi { padding:11px;min-height:96px; }
  .ov-day-track { border-radius:9px; }
}
@media(prefers-reduced-motion:reduce) {
  .ov-dashboard * { animation:none!important;transition:none!important; }
}

`;
