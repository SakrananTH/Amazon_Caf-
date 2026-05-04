const fs = require('fs');

const css = 
/* ====== MODERN PC THEME ====== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap');

:root {
  --bg: #f3f4f6;
  --surface: #ffffff;
  --border: #e5e7eb;
  --text-main: #111827;
  --text-muted: #6b7280;
  
  --primary: #0f172a;
  --primary-hover: #1e293b;
  
  --danger-bg: #fef2f2;
  --danger-border: #fca5a5;
  --danger-text: #b91c1c;

  --warning-bg: #fffbeb;
  --warning-border: #fcd34d;
  --warning-text: #b45309;

  --success-bg: #f0fdf4;
  --success-border: #86efac;
  --success-text: #15803d;

  --accent-bg: #eff6ff;
  --accent-border: #bfdbfe;
  --accent-text: #1d4ed8;

  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

* {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', 'Noto Sans Thai', sans-serif;
  color: var(--text-main);
  background-color: var(--bg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a, button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  text-decoration: none;
}

/* === LAYOUT === */
.page-root {
  height: 100vh;
  display: flex;
  justify-content: center;
  background-color: var(--bg);
}

.screen-stage {
  width: 100%;
  height: 100vh;
  display: flex;
}

.desktop-panel {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg);
}

.sidebar {
  width: 240px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: var(--space-lg) var(--space-md);
  flex-shrink: 0;
}

.desktop-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.desktop-topbar {
  height: 72px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  gap: var(--space-md);
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-main);
}

.spacer {
  flex: 1;
}

/* === SIDEBAR ITEMS === */
.logo-circle {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 32px;
  padding: 0 12px;
  display: flex;
  align-items: center;
}

.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar a, .sidebar button.logout {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  transition: all 0.15s ease;
}

.sidebar a:hover, .sidebar button.logout:hover {
  background: var(--bg);
  color: var(--text-main);
}

.sidebar a.selected {
  background: var(--accent-bg);
  color: var(--accent-text);
  font-weight: 600;
}

.sidebar button.logout {
  margin-top: auto;
}

/* === TOPBAR ITEMS === */
.store-button, .profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
}

.profile span {
  font-size: 16px;
}

/* === BUTTONS & LINKS === */
.primary-inline, .ghost-button, .inline-action, .add-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.primary-inline {
  background: var(--primary);
  color: #fff;
}
.primary-inline:hover { background: var(--primary-hover); }

.ghost-button {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}
.ghost-button:hover { background: #f9fafb; }

.priority-cta {
  background: var(--accent-text);
  color: #fff;
}
.priority-cta:hover { background: #1e40af; }

/* === CONTENT AREA === */
.desktop-main > *:not(.desktop-topbar) {
  padding: var(--space-lg);
  overflow-y: auto;
  height: 100%;
}

/* Restrict content width for better PC reading */
.dashboard-priority-bar, .ops-hero, .dashboard-grid, .workspace-columns, .quick-actions-grid, .schedule-workspace-grid, .schedule-command-card, .schedule-summary-grid {
  max-width: 1400px;
  margin: 0 auto var(--space-lg);
}

/* === COMPONENTS === */
.dashboard-priority-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.dashboard-priority-bar.is-critical {
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.priority-kicker {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  background: var(--accent-bg);
  color: var(--accent-text);
}
.is-critical .priority-kicker {
  background: #fecaca;
  color: var(--danger-text);
}

.dashboard-priority-bar strong {
  display: block;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}
.dashboard-priority-bar p {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

/* HERO SECTION */
.ops-hero {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: var(--space-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.ops-hero-copy h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
}
.ops-hero-copy p {
  margin: 0 0 24px 0;
  color: var(--text-muted);
}

.ops-hero-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  margin-bottom: 12px;
}

.ops-focus-list {
  display: grid;
  gap: 12px;
}
.ops-focus-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #f8fafc;
}
.ops-focus-item.danger { border-color: var(--danger-border); background: var(--danger-bg); }
.ops-focus-item.warning { border-color: var(--warning-border); background: var(--warning-bg); }
.ops-focus-item.ok { border-color: var(--success-border); background: var(--success-bg); }

.ops-focus-item strong { display: block; font-size: 15px; margin-bottom: 4px;}
.ops-focus-item span { font-size: 13px; color: var(--text-muted); }

.status-chip {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
}
.danger .status-chip { color: var(--danger-text); background: #fecaca; }
.warning .status-chip { color: var(--warning-text); background: #fde68a; }
.ok .status-chip { color: var(--success-text); background: #bbf7d0; }

/* HERO ASIDE */
.ops-hero-aside {
  display: grid;
  gap: 16px;
}
.ops-aside-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #f8fafc;
}
.ops-aside-card.emphasis {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}
.ops-aside-card.emphasis span { font-size: 14px; opacity: 0.8; }
.ops-aside-card.emphasis strong { display: block; font-size: 32px; margin: 8px 0; }
.ops-aside-card.emphasis small { font-size: 13px; opacity: 0.8; }

.ops-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.ops-signal-grid .ops-aside-card {
  padding: 12px;
  text-align: center;
}
.ops-signal-grid svg { margin: 0 auto 8px; display: block; color: var(--text-muted); }
.ops-signal-grid strong { display: block; font-size: 16px; margin-bottom: 4px; }
.ops-signal-grid small { font-size: 11px; color: var(--text-muted); }

/* METRICS GRID */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
}
.metric-card {
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
.metric-card span { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.metric-card strong { display: block; font-size: 28px; margin: 8px 0; color: var(--text-main); }
.metric-card small { font-size: 13px; color: var(--text-muted); }
.metric-card.metric-card-critical { border-color: var(--danger-border); background: var(--danger-bg); }
.metric-card.metric-card-critical strong { color: var(--danger-text); }
.metric-card.metric-card-positive { border-color: var(--success-border); background: var(--success-bg); }
.metric-card.metric-card-positive strong { color: var(--success-text); }

/* TWO COLUMNS */
.workspace-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}
.panel-card {
  padding: var(--space-lg);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.panel-head h3 { margin: 0 0 4px 0; font-size: 18px; }
.panel-head p { margin: 0; font-size: 14px; color: var(--text-muted); }
.panel-accent { color: var(--text-muted); }
.panel-accent.danger { color: var(--danger-text); }

.action-row, .request-feed-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.action-row:last-child, .request-feed-item:last-child {
  border-bottom: none;
}
.action-row strong, .request-feed-item strong { display: block; font-size: 15px; margin-bottom: 4px; }
.action-row p, .request-feed-item p { margin: 0; font-size: 13px; color: var(--text-muted); }

.inline-action {
  font-size: 13px;
  padding: 6px 12px;
}

.request-feed-item span.pending { color: var(--warning-text); font-size: 13px; font-weight: 500;}
.request-feed-item span.done { color: var(--success-text); font-size: 13px; font-weight: 500;}
.empty-card { font-size: 14px; color: var(--text-muted); padding: 20px; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-sm); }

/* QUICK ACTIONS */
.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}
.quick-link-card {
  display: block;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  color: var(--text-main);
  transition: all 0.15s ease;
}
.quick-link-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.quick-link-icon {
  display: inline-flex;
  padding: 10px;
  background: #f1f5f9;
  border-radius: 8px;
  color: var(--primary);
  margin-bottom: 16px;
}
.quick-link-card strong { display: block; font-size: 16px; margin-bottom: 8px; }
.quick-link-card p { margin: 0 0 16px 0; font-size: 13px; color: var(--text-muted); }

/* === SCHEDULE BOARD === */
.schedule-command-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.schedule-command-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.schedule-date-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.schedule-date-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.schedule-date-display svg { color: var(--text-muted); }
.schedule-date-display strong { display: block; font-size: 15px; }
.schedule-date-display span { display: block; font-size: 13px; color: var(--text-muted); }

.schedule-workspace-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--space-lg);
  align-items: start;
}

.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-md);
}

.column {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}
.column.danger { border-top: 4px solid var(--danger-text); border-color: var(--danger-border); }
.column.warning { border-top: 4px solid var(--warning-text); border-color: var(--warning-border); }
.column.ok { border-top: 4px solid var(--success-text); border-color: var(--success-border); }

.column-head {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.column h3 { font-size: 20px; margin: 0 0 4px 0; }
.column h4 { font-size: 14px; margin: 0; color: var(--text-muted); font-weight: 500;}

.staff-count {
  padding: 16px;
}
.staff-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.staff-alert {
  padding: 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
}
.staff-alert.danger { background: var(--danger-bg); border: 1px solid var(--danger-border); }
.staff-alert.warning { background: var(--warning-bg); border: 1px solid var(--warning-border); }
.staff-alert.ok { background: var(--success-bg); border: 1px solid var(--success-border); }
.staff-alert strong { display: block; font-size: 14px; margin-bottom: 2px;}
.staff-alert span { font-size: 12px; }

.danger .staff-alert strong, .danger .staff-alert span { color: var(--danger-text); }
.warning .staff-alert strong, .warning .staff-alert span { color: var(--warning-text); }
.ok .staff-alert strong, .ok .staff-alert span { color: var(--success-text); }


.add-button {
  margin: 0 16px 16px;
  border: 1px dashed var(--border);
  background: var(--surface);
  color: var(--text-main);
  width: calc(100% - 32px);
}
.add-button:hover { background: #f8fafc; }
.add-button.is-urgent {
  background: var(--danger-text);
  color: #fff;
  border-style: solid;
  border-color: var(--danger-text);
}
.add-button.is-urgent:hover { background: #991b1b; }

.column-section {
  padding: 16px;
  border-top: 1px solid var(--border);
}
.column-section-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.column-section ul { margin: 0; padding-left: 20px; font-size: 13px; color: var(--text-muted); }
.column-section ul li { margin-bottom: 6px; }

.chip-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  width: 100%;
}
.chip-button:hover { background: #f1f5f9; }

.schedule-insight-list {
  display: grid;
  gap: 12px;
}
.schedule-insight-item {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.schedule-insight-item strong { display: block; font-size: 15px; margin-bottom: 4px; }
.schedule-insight-item p { margin: 0; font-size: 13px; color: var(--text-muted); }
.schedule-insight-actions { text-align: right; }

/* MODALS */
.screen-stage.standalone-modal {
  background: rgba(0, 0, 0, 0.4);
  align-items: center;
  justify-content: center;
}
.standalone-modal .mock-phone {
  background: var(--surface);
  width: 500px;
  height: auto;
  min-height: 400px;
  max-height: 80vh;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: var(--space-lg);
  overflow-y: auto;
}

/* MISC */
.segmented-control {
  display: inline-flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-sm);
}
.segmented-control button {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 4px;
  color: var(--text-muted);
  background: transparent;
}
.segmented-control button.active {
  background: var(--surface);
  color: var(--text-main);
  box-shadow: var(--shadow-sm);
}
\

fs.writeFileSync('src/styles/pc-theme.css', css);
console.log('pc-theme.css created');
