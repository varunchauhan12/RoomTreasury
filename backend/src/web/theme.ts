// RoomTreasury Premium Design System & Theme Tokens
// Visual Reference: BizLink (Warm off-white #F6F7ED, Surface #FFFFFF, Accent Emerald #10B981, General Sans/Inter typography)

export const themeCss = String.raw`
:root {
  --rt-bg: #F6F7ED;
  --rt-surface: #FFFFFF;
  --rt-surface-subtle: #F4F5EE;
  --rt-surface-elevated: #FFFFFF;
  --rt-text: #1F1F1F;
  --rt-text-muted: #5A6660;
  --rt-text-subtle: #8A9890;
  --rt-border: #E2E7DE;
  --rt-border-subtle: #EDF1EA;
  --rt-emerald: #10B981;
  --rt-emerald-deep: #047857;
  --rt-emerald-dark: #064E3B;
  --rt-emerald-light: #E6F7F0;
  --rt-emerald-glow: rgba(16, 185, 129, 0.12);
  --rt-amber: #D97706;
  --rt-amber-light: #FEF3C7;
  --rt-rose: #E11D48;
  --rt-rose-light: #FFE4E6;
  --rt-indigo: #4F46E5;
  --rt-indigo-light: #EEF2FF;
  --rt-radius-sm: 8px;
  --rt-radius-md: 12px;
  --rt-radius-lg: 16px;
  --rt-radius-pill: 9999px;
  --rt-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --rt-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
  --rt-shadow-lg: 0 10px 25px -3px rgba(0, 0, 0, 0.06), 0 4px 8px -2px rgba(0, 0, 0, 0.03);
  --rt-font: "General Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body.rt-body, .rt-app {
  margin: 0;
  padding: 0;
  font-family: var(--rt-font);
  background-color: var(--rt-bg);
  color: var(--rt-text);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.sr-only, .rt-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* App Grid Shell */
.rt-shell {
  display: flex;
  min-height: 100vh;
  width: 100%;
}

/* Sidebar */
.rt-sidebar {
  width: 250px;
  flex-shrink: 0;
  background-color: var(--rt-surface);
  border-right: 1px solid var(--rt-border);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 24px 16px;
  z-index: 100;
  transition: transform 0.25s ease;
}

.rt-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 24px 8px;
  border-bottom: 1px solid var(--rt-border-subtle);
  text-decoration: none;
  color: var(--rt-text);
}

.rt-brand-logo {
  width: 36px;
  height: 36px;
  border-radius: var(--rt-radius-sm);
  background: linear-gradient(135deg, var(--rt-emerald-deep) 0%, var(--rt-emerald) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.rt-brand-title {
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -0.4px;
  line-height: 1.2;
}

.rt-brand-subtitle {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--rt-emerald-deep);
  font-weight: 650;
}

.rt-nav-group {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  overflow-y: auto;
}

.rt-nav-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--rt-text-subtle);
  padding: 10px 12px 6px;
}

.rt-nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: var(--rt-radius-sm);
  color: var(--rt-text-muted);
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 550;
  transition: all 0.15s ease;
  position: relative;
  cursor: pointer;
}

.rt-nav-item:hover {
  background-color: var(--rt-surface-subtle);
  color: var(--rt-text);
}

.rt-nav-item.active {
  background-color: var(--rt-emerald-light);
  color: var(--rt-emerald-deep);
  font-weight: 650;
}

.rt-nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background-color: var(--rt-emerald-deep);
  border-radius: var(--rt-radius-pill);
}

.rt-nav-badge {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--rt-radius-pill);
  background-color: var(--rt-surface-subtle);
  color: var(--rt-text-muted);
  font-weight: 600;
}

.rt-nav-badge.warning {
  background-color: var(--rt-amber-light);
  color: var(--rt-amber);
}

.rt-sidebar-footer {
  padding-top: 16px;
  border-top: 1px solid var(--rt-border-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rt-owner-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background-color: var(--rt-surface-subtle);
  border-radius: var(--rt-radius-sm);
}

.rt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--rt-emerald-light);
  color: var(--rt-emerald-deep);
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.rt-owner-details {
  flex: 1;
  min-width: 0;
}

.rt-owner-name {
  font-weight: 650;
  font-size: 13px;
  color: var(--rt-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rt-owner-badge {
  font-size: 10.5px;
  color: var(--rt-emerald-deep);
  display: flex;
  align-items: center;
  gap: 4px;
}

.rt-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--rt-emerald);
}

/* Main Layout */
.rt-main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100vh;
}

/* Topbar */
.rt-topbar {
  height: 64px;
  background-color: var(--rt-surface);
  border-bottom: 1px solid var(--rt-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  position: sticky;
  top: 0;
  z-index: 90;
  gap: 16px;
}

.rt-topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rt-mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--rt-text);
  border-radius: var(--rt-radius-sm);
}

.rt-breadcrumbs {
  font-size: 13px;
  color: var(--rt-text-subtle);
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-breadcrumbs strong {
  color: var(--rt-text);
  font-weight: 650;
}

.rt-topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rt-search-box {
  position: relative;
  width: 260px;
}

.rt-search-box input {
  width: 100%;
  padding: 8px 12px 8px 34px;
  border-radius: var(--rt-radius-pill);
  border: 1px solid var(--rt-border);
  background-color: var(--rt-bg);
  font-size: 13px;
  color: var(--rt-text);
  outline: none;
  transition: all 0.15s ease;
}

.rt-search-box input:focus {
  border-color: var(--rt-emerald);
  background-color: var(--rt-surface);
  box-shadow: 0 0 0 3px var(--rt-emerald-glow);
}

.rt-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--rt-text-subtle);
  pointer-events: none;
}

/* Main Content Area */
.rt-content {
  padding: 32px 36px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Headers & Headings */
.rt-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.rt-page-title-group h1 {
  font-size: 28px;
  font-weight: 750;
  letter-spacing: -0.7px;
  margin: 0 0 6px 0;
  color: var(--rt-text);
  line-height: 1.2;
}

.rt-page-title-group p {
  margin: 0;
  color: var(--rt-text-muted);
  font-size: 14px;
}

.rt-action-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Buttons */
.rt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 16px;
  font-size: 13.5px;
  font-weight: 600;
  border-radius: var(--rt-radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.rt-btn-primary {
  background-color: var(--rt-text);
  color: #FFFFFF;
}

.rt-btn-primary:hover {
  background-color: #000000;
}

.rt-btn-emerald {
  background-color: var(--rt-emerald-deep);
  color: #FFFFFF;
  border-color: var(--rt-emerald-deep);
}

.rt-btn-emerald:hover {
  background-color: var(--rt-emerald-dark);
}

.rt-btn-secondary {
  background-color: var(--rt-surface);
  color: var(--rt-text);
  border-color: var(--rt-border);
}

.rt-btn-secondary:hover {
  background-color: var(--rt-surface-subtle);
  border-color: #D0D7CE;
}

.rt-btn-sm {
  padding: 6px 11px;
  font-size: 12.5px;
}

.rt-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Cards & Surfaces */
.rt-card {
  background-color: var(--rt-surface);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-md);
  box-shadow: var(--rt-shadow-sm);
  padding: 22px;
  display: flex;
  flex-direction: column;
}

.rt-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.rt-card-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
  margin: 0;
  color: var(--rt-text);
}

.rt-card-subtitle {
  font-size: 12px;
  color: var(--rt-text-subtle);
  margin-top: 2px;
}

/* KPI Grid */
.rt-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.rt-kpi-card {
  background-color: var(--rt-surface);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--rt-shadow-sm);
  position: relative;
  overflow: hidden;
}

.rt-kpi-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--rt-text-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rt-kpi-value {
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -0.8px;
  color: var(--rt-text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.rt-kpi-note {
  font-size: 12px;
  color: var(--rt-text-subtle);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Gauge Card */
.rt-gauge-card {
  display: flex;
  align-items: center;
  gap: 24px;
}

.rt-gauge-svg {
  width: 120px;
  height: 70px;
  overflow: visible;
}

/* Grid Layouts */
.rt-grid-2 {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.rt-grid-equal-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.rt-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

/* Kanban / Pipeline Columns */
.rt-pipeline-board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  align-items: flex-start;
}

.rt-pipeline-col {
  background-color: var(--rt-surface-subtle);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 480px;
}

.rt-pipeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rt-border);
}

.rt-pipeline-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--rt-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.rt-pipeline-count {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  background-color: var(--rt-surface);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-pill);
}

.rt-project-kanban-card {
  background-color: var(--rt-surface);
  border: 1px solid var(--rt-border);
  border-radius: var(--rt-radius-sm);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

.rt-project-kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--rt-shadow-md);
  border-color: #CFD6CC;
}

/* Badges */
.rt-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 650;
  padding: 3px 9px;
  border-radius: var(--rt-radius-pill);
  white-space: nowrap;
}

.rt-badge-draft { background-color: #F1F4F2; color: #4F5E56; border: 1px solid #DCE3DD; }
.rt-badge-active { background-color: var(--rt-emerald-light); color: var(--rt-emerald-deep); border: 1px solid rgba(16, 185, 129, 0.25); }
.rt-badge-warning { background-color: var(--rt-amber-light); color: #B45309; border: 1px solid rgba(217, 119, 6, 0.25); }
.rt-badge-blocked { background-color: var(--rt-rose-light); color: #BE123C; border: 1px solid rgba(225, 29, 72, 0.25); }
.rt-badge-indigo { background-color: var(--rt-indigo-light); color: var(--rt-indigo); border: 1px solid rgba(79, 70, 229, 0.25); }

/* Tables */
.rt-table-container {
  overflow-x: auto;
  border-radius: var(--rt-radius-sm);
  border: 1px solid var(--rt-border);
  background-color: var(--rt-surface);
}

.rt-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.rt-table th {
  background-color: var(--rt-surface-subtle);
  padding: 12px 16px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--rt-text-muted);
  border-bottom: 1px solid var(--rt-border);
}

.rt-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--rt-border-subtle);
  font-size: 13.5px;
  color: var(--rt-text);
}

.rt-table tr:last-child td {
  border-bottom: none;
}

.rt-table tr:hover td {
  background-color: #FAFAF7;
}

.rt-table td.numeric, .rt-table th.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Tabs */
.rt-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--rt-border);
  padding-bottom: 0;
}

.rt-tab-btn {
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--rt-text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  bottom: -1px;
}

.rt-tab-btn:hover {
  color: var(--rt-text);
}

.rt-tab-btn.active {
  color: var(--rt-emerald-deep);
  border-bottom-color: var(--rt-emerald-deep);
}

/* Drawer */
.rt-drawer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
  animation: rtFadeIn 0.2s ease;
}

.rt-drawer {
  width: 540px;
  max-width: 90vw;
  background-color: var(--rt-surface);
  height: 100vh;
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  animation: rtSlideLeft 0.25s ease;
  overflow-y: auto;
  padding: 32px 28px;
  gap: 20px;
}

/* Alert Banner */
.rt-alert {
  padding: 14px 16px;
  border-radius: var(--rt-radius-sm);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.rt-alert-warning {
  background-color: var(--rt-amber-light);
  border: 1px solid rgba(217, 119, 6, 0.3);
  color: #92400E;
}

.rt-alert-danger {
  background-color: var(--rt-rose-light);
  border: 1px solid rgba(225, 29, 72, 0.3);
  color: #9F1239;
}

.rt-alert-info {
  background-color: #EBF5FF;
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #1E40AF;
}

.rt-alert-emerald {
  background-color: var(--rt-emerald-light);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: var(--rt-emerald-dark);
}

/* Keyframes */
@keyframes rtFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes rtSlideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }

/* Responsive */
@media (max-width: 1024px) {
  .rt-grid-2, .rt-grid-equal-2, .rt-grid-3 {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .rt-sidebar {
    position: fixed;
    transform: translateX(-100%);
  }
  .rt-sidebar.open {
    transform: translateX(0);
  }
  .rt-mobile-menu-btn {
    display: inline-flex;
  }
  .rt-topbar {
    padding: 0 16px;
  }
  .rt-content {
    padding: 20px 16px;
  }
  .rt-search-box {
    display: none;
  }
}
`;
