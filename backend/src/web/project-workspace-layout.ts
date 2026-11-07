const tabs = [
  ['pw-section-draft', 'Draft'],
  ['pw-section-results', 'Agent Results'],
  ['pw-section-review', 'Review & Approve'],
] as const;

export const workspaceTabs = JSON.stringify(tabs);
const tabLinks = tabs.map(([id, label]) => `<a href="#${id}" id="${id}-tab">${label}</a>`).join('');

export const projectWorkspaceLayout = `
<p id="pw-notice" class="pw-notice" role="status" aria-live="polite">Loading project…</p>
<div id="pw-workspace" hidden>
  <header class="pw-project-header">
    <nav class="pw-breadcrumb" aria-label="Breadcrumb"><a href="/#projects/all">Projects</a><span aria-hidden="true">/</span><span id="pw-crumb" aria-current="page"></span></nav>
    <div class="pw-identity"><div class="pw-project-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 12h16m-9 0v2h2v-2"/></svg></div>
    <div><p class="pw-eyebrow">Project workspace</p><h1 id="pw-title"></h1><p id="pw-subtitle"></p></div><span id="pw-project-status" class="pw-status"></span></div>
    <dl id="pw-header-facts" class="pw-header-facts"></dl>
  </header>
  <nav class="pw-anchor-nav" id="pw-section-nav" aria-label="Project lifecycle">${tabLinks}</nav>
  <div class="pw-lifecycle-sections">
    <section id="pw-section-draft" class="pw-lifecycle-card">
      <header class="pw-lifecycle-header">
        <div class="pw-lifecycle-title-group">
          <span class="pw-step-badge">Stage 1</span>
          <div>
            <h2>Project Draft &amp; Brief</h2>
            <p class="pw-subtle">Review project requirements, deliverables, and commercial intake before dispatching to specialist agents.</p>
          </div>
        </div>
      </header>
      <article class="pw-card pw-project-details">
        <h3>Project Details</h3>
        <p id="pw-overview-description" class="pw-prose"></p>
        <dl id="pw-overview-facts" class="pw-facts"></dl>
      </article>
      <details id="pw-submitted-intake" class="pw-card pw-intake-details">
        <summary class="pw-intake-summary"><span>Submitted Intake</span><span class="pw-intake-chevron" aria-hidden="true">▾</span></summary>
        <div id="pw-details" class="pw-intake-sections"></div>
        <section class="pw-intake-section pw-intake-raw">
          <h4>Complete original brief</h4>
          <p id="pw-brief" class="pw-prose"></p>
        </section>
      </details>
      <div class="pw-send-block">
        <p id="pw-intake-auth-note" class="pw-subtle" role="status"></p>
        <button id="pw-authorize-intake" class="pw-button pw-authorize-btn" type="button" hidden>Authorize Project Brief</button>
        <p class="pw-send-note">This dispatches the project brief to the coordinator and specialist agents through Discord.</p>
        <button id="pw-start" class="pw-primary pw-hero-btn pw-send-btn"><svg class="pw-send-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg><span id="pw-start-label">Send to Agents</span></button>
        <div class="pw-actions pw-draft-actions">
          <button id="pw-cancel" class="pw-button" hidden>Cancel processing</button>
          <button id="pw-refresh" type="button" class="pw-button">Refresh status</button>
        </div>
        <p id="pw-poll-note" class="pw-subtle"></p>
      </div>
    </section>

    <section id="pw-section-results" class="pw-lifecycle-card" hidden>
      <header class="pw-lifecycle-header">
        <div class="pw-lifecycle-title-group">
          <span class="pw-step-badge">Stage 2</span>
          <div>
            <h2>Agent Results &amp; Collaboration</h2>
            <p class="pw-subtle">Coordinator delegation, specialist analysis, Discord capture, and generated proposal package.</p>
          </div>
        </div>
        <div class="pw-row"><p id="pw-transport-label" class="pw-eyebrow"></p><span id="pw-state" class="pw-status"></span></div>
      </header>
      <p id="pw-analysis-empty" class="pw-empty" hidden>This project has no linked analysis task.</p>
      <div id="pw-analysis">
        <article id="pw-analysis-controls" class="pw-card pw-job-card">
          <p id="pw-description"></p>
          <div id="pw-processing-visual" class="rt-processing-island"></div>
          <dl id="pw-job-meta" class="pw-job-row"></dl>
        </article>
        <article class="pw-card pw-agents-card">
          <h3>Agent Collaboration</h3>
          <div id="pw-agents" class="pw-agent-grid"></div>
        </article>
        <details id="pw-discord-details" class="pw-card pw-discord-details">
          <summary class="pw-discord-summary"><span>Discord Collaboration</span><span id="pw-discord-count" class="pw-meta"></span><span class="pw-discord-chevron" aria-hidden="true">▾</span></summary>
          <div class="pw-discord-body">
            <div class="pw-discord-controls"><p id="pw-discord-status" class="pw-subtle" role="status"></p><div class="pw-actions"><label>Attempt <select id="pw-discord-attempt" aria-label="Discord attempt"></select></label><button id="pw-discord-refresh" type="button">Refresh capture</button><a id="pw-discord-channel" class="pw-button" target="_blank" rel="noopener noreferrer" hidden>Open in Discord ↗</a></div></div>
            <div id="pw-discord-messages" class="pw-discord-messages"></div><button id="pw-discord-earlier" type="button" hidden>Load earlier messages</button>
          </div>
        </details>
      </div>
      <div id="pw-results">
        <header class="pw-section-heading"><h3>Generated Deliverable Package</h3><a id="pw-open-upload" class="pw-button" href="#pw-upload">Upload agent package</a></header>
        <details id="pw-upload" class="pw-card pw-upload-card">
          <summary>Manual package upload</summary>
          <p id="pw-upload-context" class="pw-subtle"></p><button id="pw-retrieve-discord" type="button" hidden>Retrieve existing Discord artifacts</button>
          <form id="pw-upload-form" class="pw-upload-form">
            <label class="pw-upload-field">Proposal JSON (required, max 256 KiB)<span class="pw-upload-hint">What to upload: the proposal.json file from the agent package.</span><input id="pw-proposal-file" type="file" accept=".json,application/json" required></label>
            <label class="pw-upload-field">Specialist evidence JSON (required, max 512 KiB)<span class="pw-upload-hint">What to upload: the evidence.json file from the agent package.</span><input id="pw-evidence-file" type="file" accept=".json,application/json" required></label>
            <label class="pw-upload-field">Summary Markdown (required, max 64 KiB)<span class="pw-upload-hint">What to upload: the summary.md file from the agent package.</span><input id="pw-summary-file" type="file" accept=".md,text/markdown,text/plain" required></label>
            <div class="pw-actions pw-upload-actions"><button id="pw-preview" type="submit">Validate package</button><button id="pw-confirm-import" type="button" disabled>Confirm project import — review only</button></div>
            <p id="pw-upload-state" class="pw-notice" role="status" aria-live="polite">No package selected. All three files are required.</p>
          </form>
        </details>
        <p id="pw-result-notice" class="pw-notice"></p>
        <div id="pw-review"></div><p id="pw-live-review" role="status"></p>
        <label id="pw-import-label" hidden>Imported revision<select id="pw-imports"></select></label>
        <article class="pw-card"><h3>Artifact package (3 files)</h3><div id="pw-artifacts" class="pw-artifact-list"></div><div id="pw-artifact-preview" hidden></div></article>
        <article id="pw-structured" class="pw-card" hidden><h3>Structured proposal &amp; evidence</h3><nav id="pw-result-tabs" class="pw-tabs" aria-label="Result sections"></nav><div id="pw-result-content" class="pw-structured-content"></div></article>
        <div class="pw-scope-grid">
          <article class="pw-card"><h3>Proposed Deliverables</h3><div id="pw-deliverables" class="pw-scope-list"></div></article>
          <article class="pw-card"><h3>Proposed Milestones</h3><div id="pw-milestones" class="pw-scope-list"></div></article>
        </div>
      </div>
    </section>

    <section id="pw-section-review" class="pw-lifecycle-card" hidden>
      <header class="pw-lifecycle-header">
        <div class="pw-lifecycle-title-group">
          <span class="pw-step-badge">Stage 3</span>
          <div>
            <h2>Review &amp; Approve</h2>
            <p class="pw-subtle">Review what the agents produced, then approve the project or send it back for revision.</p>
          </div>
        </div>
      </header>
      <nav class="pw-stage3-tabs" aria-label="Stage 3 sections">
        <button id="pw-stage3-tab-review" type="button" aria-selected="true">Review</button>
        <button id="pw-stage3-tab-revision" type="button" aria-selected="false">Request Revision</button>
      </nav>
      <div id="pw-stage3-review-panel">
        <p id="pw-approval-status" class="pw-subtle" role="status"></p>
        <div id="pw-stage3-review" class="pw-stage3-review"></div>
        <div class="pw-stage3-approve">
          <button id="pw-approve-project" class="pw-primary pw-hero-btn pw-approve-btn" type="button">Approve the Project</button>
          <p id="pw-approve-feedback" class="pw-subtle" role="status"></p>
        </div>
      </div>
      <div id="pw-stage3-revision-panel" hidden>
        <form id="pw-revision-form" class="pw-revision-form">
          <fieldset class="pw-revision-categories">
            <legend>What should be revised?</legend>
            <label><input type="checkbox" data-revision-category="requirements"> Requirements</label>
            <label><input type="checkbox" data-revision-category="price"> Price</label>
            <label><input type="checkbox" data-revision-category="deliverables"> Deliverables</label>
            <label><input type="checkbox" data-revision-category="scope"> Scope</label>
            <label><input type="checkbox" data-revision-category="timeline"> Timeline</label>
            <label><input type="checkbox" data-revision-category="other"> Other</label>
          </fieldset>
          <label class="pw-revision-label" for="pw-revision-instructions">Describe what you want the agents to revise
            <textarea id="pw-revision-instructions" rows="7" maxlength="4000" placeholder="Explain exactly what should change and why."></textarea>
          </label>
          <button id="pw-send-revision" class="pw-primary pw-hero-btn pw-revision-btn" type="submit">Send to Agents for Revision</button>
          <p id="pw-revision-feedback" class="pw-subtle" role="status"></p>
        </form>
      </div>
      <div hidden aria-hidden="true">
        <p id="pw-commercial-sync"></p><button id="pw-commercial-refresh" type="button"></button><div id="pw-commercial-details"></div>
        <div id="pw-finance-details"></div><dl id="pw-progress"></dl><ol id="pw-recent"></ol><div id="pw-overview-docs"></div>
        <ol id="pw-timeline"></ol><ol id="pw-events"></ol>
      </div>
    </section>
  </div>
</div>`;
