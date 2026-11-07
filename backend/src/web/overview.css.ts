export const overviewCss = String.raw`
/* Shared shell. The overview-specific rules below are scoped to .ov-view. */
.rt-shell {
  --shell-gutter: clamp(18px, 3vw, 44px);
  --shell-max: 1460px;
  align-items: flex-start;
}
.rt-shell .rt-sidebar {
  width: 220px;
  height: calc(100dvh - 28px);
  top: 14px;
  margin: 14px 0 14px 14px;
  padding: 16px 12px;
  border: 1px solid #282a2e;
  border-radius: 28px;
  background: #18191b;
  color: #9ca3af;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  transition: width 190ms ease, transform 190ms ease;
}
.rt-shell .rt-brand {
  height: 60px;
  padding: 4px 6px 16px;
  gap: 10px;
  flex-shrink: 0;
  color: #ffffff;
}
.rt-shell .rt-brand-logo {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border-radius: 12px;
  background: #25262a;
  color: #10b981;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.rt-shell .rt-brand-title {
  color: #ffffff;
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.3px;
}
.rt-shell .rt-brand-badge {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}
.rt-shell .rt-sidebar-section {
  padding: 16px 10px 8px;
  font-size: 10px;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: .12em;
  color: #6b7280;
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
  gap: 4px;
}
.rt-shell .rt-nav-item {
  min-height: 40px;
  border-radius: 12px;
  padding: 0 12px;
  gap: 10px;
  white-space: nowrap;
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 13.5px;
  font-weight: 550;
  transition: background-color 160ms ease, color 160ms ease;
}
.rt-shell .rt-nav-icon { display: grid; place-items: center; flex: 0 0 20px; color: #9ca3af; }
.rt-shell .rt-nav-item:hover {
  background: #232427;
  color: #f3f4f6;
}
.rt-shell .rt-nav-item:hover .rt-nav-icon {
  color: #f3f4f6;
}
.rt-shell .rt-nav-item.active {
  background: #282a2e;
  color: #ffffff;
  font-weight: 650;
}
.rt-shell .rt-nav-item.active .rt-nav-icon {
  color: #10b981;
}
.rt-shell .rt-nav-item.active::before { content: none; }
.rt-shell .rt-sidebar-footer {
  padding-top: 14px;
  border-top: 1px solid #26282c;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rt-shell .rt-user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  color: #ffffff;
  text-decoration: none;
  border-radius: 14px;
  background: #202124;
  border: 1px solid #2a2c30;
}
.rt-shell .rt-user-pill:hover { background: #282a2e; }
.rt-shell .rt-user-avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  border-radius: 50%;
  background: #2a2d33;
  color: #10b981;
  font-weight: 750;
  font-size: 12px;
}
.rt-shell .rt-user-name { font-weight: 650; font-size: 12px; white-space: nowrap; color: #ffffff; }
.rt-shell .rt-user-role { font-size: 10.5px; color: #9ca3af; }
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
  background: #f4f5f7;
  border-bottom: 1px solid #dce4ed;
  align-items: center;
}
.rt-shell .rt-content { max-width: var(--shell-max); padding: 22px var(--shell-gutter) 40px; }
.rt-shell .rt-breadcrumbs { color: #64748b; font-size: 13px; }
.rt-breadcrumb-active { color: #101827; font-weight: 650; }
.rt-shell .rt-topbar-left { min-width: 0; gap: 12px; }
.rt-shell .rt-topbar-right { gap: 10px; align-items: center; }
.rt-shell .rt-menu-toggle { padding: 0; width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; }
.rt-menu-toggle svg { width: 16px; height: 16px; }
.rt-shell .rt-menu-close, .rt-shell .rt-menu-backdrop { display: none; }
.rt-shell :is(a,button):focus-visible, .ov-chart-track:focus-visible {
  outline: 2px solid #087352;
  outline-offset: 3px;
}

/* Topbar search bar */
.rt-topbar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #dce4ed;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  color: #64748b;
  min-width: 220px;
}
.rt-topbar-search input {
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  color: #101827;
  padding: 0;
  margin: 0;
  width: 100%;
}
.rt-topbar-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12.5px;
}

/* Zarss 3-Zone Layout */
.ov-view {
  --ov-border: #e2e8f0;
  --ov-muted: #64748b;
  --ov-ink: #0f172a;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--ov-ink);
  min-width: 0;
  font-variant-numeric: tabular-nums;
}
.ov-view :is(h1,h2,p,ul,ol) { margin: 0; }

.ov-zarss-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 4px;
}
.ov-zarss-title-group h1 {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 0 0 4px;
  color: #0f172a;
}
.ov-zarss-title-group p {
  color: var(--ov-muted);
  font-size: 13.5px;
  margin: 0;
}
.ov-context { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ov-context time { color: #64748b; font-size: 12px; font-weight: 500; }

.ov-zarss-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 24px;
  align-items: start;
}
@media (max-width: 1080px) {
  .ov-zarss-layout {
    grid-template-columns: 1fr;
  }
}

.ov-main-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}
.ov-right-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* 3 Compact Kokonut UI Flick Cards */
.ov-flick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 768px) {
  .ov-flick-grid {
    grid-template-columns: 1fr;
  }
}
.ov-flick-slot {
  min-width: 0;
  height: 175px;
}

/* Prominent Analytics Chart Card */
.ov-chart-card, .ov-orders-card, .ov-ring-card, .ov-transfers-card {
  background: #ffffff;
  border: 1px solid var(--ov-border);
  border-radius: 24px;
  padding: 22px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}
.ov-chart-card .ov-panel-head, .ov-orders-card .ov-panel-head, .ov-transfers-card .ov-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 10px;
}
.ov-chart-card h2, .ov-orders-card h2, .ov-transfers-card h2 {
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: #0f172a;
}
.ov-chart-card p, .ov-orders-card p, .ov-transfers-card p {
  font-size: 12.5px;
  color: var(--ov-muted);
  margin-top: 3px;
}

.ov-analytics-chart-host {
  min-height: 280px;
  margin-top: 8px;
}

/* Recent Activity / Last Orders Table */
.ov-orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ov-orders-table th {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  font-size: 11px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ov-muted);
}
.ov-orders-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.ov-orders-table tr:last-child td {
  border-bottom: none;
}
.ov-orders-table tr:hover td {
  background: #f8fafc;
}
.ov-order-cust {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ov-order-monogram {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #334155;
  font-weight: 750;
  font-size: 11.5px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
}
.ov-order-cust strong {
  display: block;
  font-size: 13.5px;
  font-weight: 650;
  color: #0f172a;
}
.ov-order-cust small {
  display: block;
  font-size: 11.5px;
  color: var(--ov-muted);
}
.ov-order-amount strong {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}
.ov-order-date {
  color: var(--ov-muted);
  font-size: 12px;
}

/* Badges */
.ov-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}
.ov-badge-green { background: #dcfce7; color: #15803d; }
.ov-badge-amber { background: #fef3c7; color: #b45309; }
.ov-badge-neutral { background: #f1f5f9; color: #475569; }

.ov-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #047857;
  text-decoration: none;
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}
.ov-link:hover { text-decoration: underline; }
.ov-empty {
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
  color: var(--ov-muted);
  font-size: 12.5px;
  text-align: center;
}

/* Proposal review & attention rows */
.ov-review-counts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.ov-review-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;
}
.ov-review-row:last-child {
  border-bottom: none;
}
.ov-review-row strong {
  font-size: 17px;
  font-weight: 750;
}
.ov-panel-note {
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--ov-muted);
  line-height: 1.5;
}
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
`;
