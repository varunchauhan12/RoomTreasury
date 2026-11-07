export const projectWorkspaceCss=String.raw`
.pw-body{margin:0;font:14px/1.55 Inter,system-ui,sans-serif}
html[data-theme] .pw-body .pw-header{width:min(1180px,calc(100% - 32px));margin:16px auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-radius:20px}
.pw-header nav,.pw-actions,.pw-section-heading,.pw-breadcrumb,.pw-identity,.pw-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.pw-header a,.pw-button,.pw-anchor-nav a{text-decoration:none}
.pw-header nav a{font-size:13px;font-weight:650}
.pw-brand{font-weight:780;letter-spacing:-.04em;font-size:20px}
.pw-main,.pw-footer{width:min(1180px,calc(100% - 32px));margin:auto}
.pw-main{padding:16px 0 48px}
.pw-footer{padding:0 0 36px;color:var(--a-muted);font-size:12px}
.pw-body [hidden]{display:none!important}
.pw-project-header,.pw-card{background:var(--a-panel);border:1px solid var(--a-line);border-radius:18px;min-width:0}
.pw-project-header{padding:clamp(18px,3vw,32px)}
.pw-breadcrumb{font-size:13px;color:var(--a-muted);margin-bottom:20px;overflow-wrap:anywhere}
.pw-body a{color:var(--a-accent);text-underline-offset:3px}
.pw-identity{gap:16px;flex-wrap:nowrap}
.pw-identity>div:nth-child(2){min-width:0;flex:1}
.pw-project-mark{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;border-radius:15px;background:var(--a-accent-wash);color:var(--a-accent)}
html[data-theme] .pw-identity h1{font-size:clamp(25px,4vw,39px);line-height:1.13;margin:2px 0;overflow-wrap:anywhere}
.pw-identity p,.pw-section-heading p{margin:0}
.pw-identity #pw-subtitle{color:var(--a-muted)}
.pw-eyebrow{text-transform:uppercase}
.pw-header-facts,.pw-grid,.pw-progress{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:14px;margin:0}
.pw-header-facts{border-top:1px solid var(--a-line);padding-top:15px;margin-top:18px;display:flex;gap:24px;flex-wrap:wrap}
.pw-grid>div{padding:11px 12px;background:var(--a-subtle);border-radius:10px}
.pw-body dt{color:var(--a-muted);font-size:12px}
html[data-theme] .pw-body dd{margin:2px 0 0;color:var(--a-ink);font-weight:600;overflow-wrap:anywhere}
.pw-anchor-nav{display:flex;gap:4px;overflow-x:auto;scrollbar-width:thin;margin:14px 0;padding:4px 4px 5px;border:1px solid var(--a-line);background:var(--a-panel);border-radius:14px}
.pw-body .pw-anchor-nav a{flex:0 0 auto;padding:8px 12px;border-radius:10px;color:var(--a-muted);font-weight:650;white-space:nowrap;transition:background .18s,color .18s}
.pw-body .pw-anchor-nav a[aria-current=page]{color:var(--a-ink);background:var(--a-subtle)}
.pw-anchor-nav a:hover{background:var(--a-subtle)}
html[data-theme] .pw-body .pw-panel{padding:clamp(14px,2.5vw,24px);border:1px solid var(--a-line);box-shadow:none;background:var(--a-bg);min-width:0}
.pw-panel:not([hidden]){animation:pw-enter .16s ease-out}
@keyframes pw-enter{from{opacity:.65;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
.pw-section-heading{justify-content:space-between;margin:0 0 16px}
.pw-section-heading h2,.pw-section-heading h3{margin:0}
.pw-body h2{font-size:24px;letter-spacing:-.035em}
.pw-body h3{font-size:16px;letter-spacing:-.015em;margin:0 0 10px}
.pw-body h4{font-size:14px;margin:0}
.pw-body p{overflow-wrap:anywhere}
.pw-subtle,.pw-muted,.pw-meta{color:var(--a-muted);font-size:13px}
.pw-prose,.pw-message-text{white-space:pre-wrap;overflow-wrap:anywhere}
.pw-overview-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}
.pw-card{padding:clamp(14px,2vw,20px);background:var(--a-raised)}
.pw-panel>.pw-card,.pw-quick{margin-top:14px}
.pw-notice:empty,.pw-subtle:empty{display:none}
.pw-notice,.pw-empty{background:var(--a-subtle);padding:10px 12px;border-radius:10px}
.pw-notice[data-error=true]{color:var(--a-bad);background:var(--a-bad-bg)}
.pw-progress{grid-template-columns:1fr;gap:0}
.pw-progress>div,.pw-list-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--a-line)}
.pw-progress>div:last-child,.pw-list-row:last-child{border-bottom:0}
.pw-status{display:inline-flex;align-items:center;white-space:nowrap;max-width:100%;border-radius:999px;padding:4px 9px;background:var(--a-subtle);color:var(--a-ink);font-size:12px;font-weight:650}
.pw-status:is([data-state=approved],[data-state=imported],[data-state=complete],[data-state=active]){color:var(--a-good);background:var(--a-good-bg)}
.pw-status:is([data-state=blocked],[data-state=running],[data-state=collecting],[data-state=needs_attention],[data-state=dispatch_uncertain],[data-state=changes_requested]){color:var(--a-warn);background:var(--a-warn-bg)}
.pw-status:is([data-state=rejected],[data-state=failed]){color:var(--a-bad);background:var(--a-bad-bg)}
.pw-body :is(button,.pw-button){font:inherit;font-size:13px;font-weight:650;padding:7px 12px;min-height:36px;border:1px solid var(--a-line);border-radius:10px;background:var(--a-raised);color:var(--a-ink);cursor:pointer}
.pw-body :is(button,.pw-button):hover:not(:disabled){border-color:var(--a-accent)}
.pw-body button:disabled{opacity:.55;cursor:not-allowed}
.pw-body label{display:block;font-weight:600;margin:8px 0}
.pw-body :is(input:not([type=checkbox]),textarea,select){display:block;max-width:100%;width:100%;padding:7px 9px;margin-top:4px;font:inherit;border:1px solid var(--a-line)}
.pw-body textarea{min-height:80px;resize:vertical}
.pw-body fieldset{border:1px solid var(--a-line);border-radius:10px;margin:0;padding:10px 14px}
.pw-body input[type=checkbox]{margin:0 8px 0 0}
.pw-body summary{font-weight:650;cursor:pointer}
.pw-body details>form{padding:8px 0}
.pw-body .pw-list{padding:0;list-style:none;margin:0}
.pw-timeline{padding:0;list-style:none;margin:0}
.pw-timeline li{position:relative;margin-left:5px;padding:0 0 16px 17px;border-left:1px solid var(--a-line)}
.pw-timeline li::before{content:'';position:absolute;left:-4px;top:7px;width:7px;height:7px;border-radius:50%;background:var(--a-accent)}
.pw-timeline li:last-child{padding-bottom:0;border-color:transparent}
.pw-meta{display:block}
.pw-agent-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,205px),1fr));gap:14px;padding:0;list-style:none}
.pw-agent{border:1px solid var(--a-line);border-radius:12px;padding:16px;background:var(--a-panel);min-width:0;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.pw-agent h4{margin:0}.pw-agent p{margin:0}
.pw-message{padding:13px 0;border-top:1px solid var(--a-line)}
.pw-message[data-role=coordinator]{border-left:2px solid var(--a-accent);padding-left:10px}
.pw-message p{margin:7px 0}
.pw-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.pw-tabs button[aria-selected=true]{border-color:var(--a-accent);background:var(--a-accent-wash)}
.pw-tree{border-left:1px solid var(--a-line);padding:0 0 0 11px}
.pw-tree>div{margin:7px 0}.pw-tree p{margin:0}
.pw-viewer{margin-top:12px;border:1px solid var(--a-line);border-radius:12px;padding:12px;background:var(--a-panel)}
.pw-code{font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:440px;overflow:auto;background:var(--a-subtle);padding:12px;border-radius:10px}
.pw-markdown{max-height:540px;overflow:auto;overflow-wrap:anywhere}
.pw-markdown h4,.pw-markdown h5,.pw-markdown h6{margin:14px 0 6px}
.pw-markdown blockquote{margin:0;padding-left:12px;border-left:2px solid var(--a-line);color:var(--a-muted)}
.pw-ids{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}
.pw-approval-list{padding:0;list-style:none;display:grid;gap:10px}
.pw-approval-list summary .pw-status{margin-left:8px}
#pw-commercial-details>details,#pw-approval-details>details,#pw-commercial-details>.pw-card{margin-top:12px}
#pw-commercial-details .pw-card>details{border-top:1px solid var(--a-line);padding:10px 0}
.pw-finance-metrics>div{background:var(--a-raised);border:1px solid var(--a-line)}
.pw-lifecycle-sections{display:flex;flex-direction:column;gap:24px;margin-top:16px}
.pw-lifecycle-card{background:var(--a-panel);border:1px solid var(--a-line);border-radius:18px;padding:clamp(16px,2.5vw,24px);display:flex;flex-direction:column;gap:18px;min-width:0;transition:border-color .2s,box-shadow .2s}
.pw-lifecycle-card[data-active="true"]{border-color:var(--a-accent);box-shadow:0 4px 20px rgba(0,0,0,.06)}
.pw-lifecycle-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--a-line);padding-bottom:14px}
.pw-lifecycle-title-group{display:flex;align-items:center;gap:12px}
.pw-step-badge{font-size:11px;font-weight:750;letter-spacing:.06em;padding:4px 10px;border-radius:999px;background:var(--a-accent-wash);color:var(--a-accent);text-transform:uppercase}
.pw-hero-btn{font-size:14px!important;font-weight:700!important;padding:9px 20px!important;background:var(--a-accent)!important;color:#fff!important;border:none!important;border-radius:10px!important;box-shadow:0 2px 8px rgba(0,0,0,.15);cursor:pointer}
.pw-hero-btn:hover:not(:disabled){opacity:.92;transform:translateY(-1px)}
.pw-hero-btn:disabled{opacity:.55;transform:none;cursor:not-allowed}
.pw-draft-grid,.pw-agent-flow-grid,.pw-scope-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px}
.pw-review-banner{border:1px solid var(--a-accent);background:var(--a-accent-wash)}
[data-lifecycle="draft"] #pw-section-draft{border-color:var(--a-accent)}
[data-lifecycle="processing"] #pw-section-results{border-color:var(--a-accent)}
[data-lifecycle="review"] #pw-section-review{border-color:var(--a-accent)}
.pw-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;margin:14px 0 0}
.pw-facts>div{padding:11px 12px;background:var(--a-subtle);border-radius:10px;min-width:0}
.pw-project-details{min-width:0}
.pw-intake-details{width:100%;box-sizing:border-box;min-width:0}
.pw-intake-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;font-size:16px;font-weight:700;color:var(--a-ink);padding:2px 0}
.pw-intake-summary::-webkit-details-marker{display:none}
.pw-intake-chevron{flex:0 0 auto;color:var(--a-muted);transition:transform .18s}
.pw-intake-details[open] .pw-intake-chevron{transform:rotate(180deg)}
.pw-intake-details[open] .pw-intake-summary{border-bottom:1px solid var(--a-line);padding-bottom:12px;margin-bottom:6px}
.pw-intake-section{padding:14px 0;border-bottom:1px solid var(--a-line);min-width:0}
.pw-intake-section:last-child{border-bottom:0}
.pw-intake-section h4{font-size:14px;margin:0 0 8px;color:var(--a-ink)}
.pw-intake-section .pw-prose{margin:0;line-height:1.7;color:var(--a-ink);max-width:none}
.pw-send-block{border-top:1px solid var(--a-line);padding-top:18px;display:flex;flex-direction:column;gap:12px}
.pw-authorize-btn{align-self:flex-start}
.pw-send-note{margin:0;color:var(--a-muted);font-size:13px;line-height:1.6}
.pw-send-btn{width:100%;min-height:52px;display:flex!important;align-items:center;justify-content:center;gap:10px;font-size:15px!important;padding:14px 20px!important}
.pw-send-icon{flex:0 0 auto}
.pw-draft-actions{margin:0}
.pw-stage3-tabs{display:flex;gap:6px;border-bottom:1px solid var(--a-line);padding-bottom:12px}
.pw-stage3-tabs button{flex:0 0 auto}
.pw-stage3-tabs button[aria-selected=true]{border-color:var(--a-accent);background:var(--a-accent-wash);color:var(--a-ink)}
.pw-stage3-review{display:flex;flex-direction:column;gap:12px}
.pw-stage3-card{border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;background:var(--a-panel)}
.pw-stage3-card>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;font-size:15px;font-weight:700;color:var(--a-ink)}
.pw-stage3-card>summary::-webkit-details-marker{display:none}
.pw-stage3-chevron{color:var(--a-muted);transition:transform .18s}
.pw-stage3-card[open] .pw-stage3-chevron{transform:rotate(180deg)}
.pw-stage3-card[open]>summary{border-bottom:1px solid var(--a-line);padding-bottom:10px;margin-bottom:6px}
.pw-stage3-summary h3{margin-top:0}
.pw-stage3-approve{border-top:1px solid var(--a-line);padding-top:18px;display:flex;flex-direction:column;gap:10px}
.pw-approve-btn,.pw-revision-btn{width:100%;min-height:52px;font-size:15px!important;padding:14px 20px!important}
.pw-revision-form{display:flex;flex-direction:column;gap:16px;max-width:760px}
.pw-revision-categories{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr));gap:10px}
.pw-revision-categories label{display:flex!important;align-items:center;gap:8px;border:1px solid var(--a-line);border-radius:10px;padding:10px 12px;background:var(--a-panel);margin:0!important;cursor:pointer}
.pw-revision-label textarea{width:100%;box-sizing:border-box;line-height:1.6}
#pw-analysis,#pw-results{display:flex;flex-direction:column;gap:18px}
.pw-job-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px;margin:14px 0 0}
.pw-job-row>div{padding:11px 12px;background:var(--a-subtle);border-radius:10px;min-width:0}
.pw-job-card p{margin:0 0 6px;line-height:1.6}
.pw-status[data-state=observed]{color:var(--a-accent);background:var(--a-accent-wash)}
.pw-status[data-state=pending]{color:var(--a-muted);background:var(--a-subtle)}
.pw-discord-details{width:100%;box-sizing:border-box;min-width:0}
.pw-discord-summary{display:flex;align-items:center;gap:12px;list-style:none;font-size:16px;font-weight:700;color:var(--a-ink)}
.pw-discord-summary::-webkit-details-marker{display:none}
.pw-discord-summary .pw-meta{font-weight:400}
.pw-discord-chevron{margin-left:auto;color:var(--a-muted);transition:transform .18s}
.pw-discord-details[open] .pw-discord-chevron{transform:rotate(180deg)}
.pw-discord-body{border-top:1px solid var(--a-line);margin-top:14px;padding-top:14px;display:flex;flex-direction:column;gap:14px}
.pw-discord-controls{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.pw-discord-messages{display:flex;flex-direction:column}
.pw-discord-messages .pw-message{padding:14px 0}
.pw-discord-messages .pw-message:first-child{border-top:0;padding-top:0}
.pw-upload-form{margin:14px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:stretch}
.pw-upload-field{border:1px solid var(--a-line);border-radius:12px;padding:12px;background:var(--a-panel);margin:0!important;min-width:0;font-size:13px}
.pw-upload-hint{display:block;font-weight:400;color:var(--a-muted);font-size:12px;line-height:1.5;margin-top:4px}
#pw-upload-form .rt-upload-native{display:none!important}
#pw-upload-form .rt-upload-island{margin:10px 0 0}
#pw-upload-form .min-h-\[8\.5rem\]{min-height:5rem}
.pw-upload-actions{justify-content:center;grid-column:1/-1}
.pw-upload-form>.pw-notice{grid-column:1/-1}
.pw-artifact-list{display:flex;flex-direction:column}
.pw-artifact-row{display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--a-line);flex-wrap:wrap}
.pw-artifact-row:last-child{border-bottom:0}
.pw-artifact-file{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.pw-artifact-file strong{overflow-wrap:anywhere}
.pw-file-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;padding:0 8px;border-radius:10px;background:var(--a-accent-wash);color:var(--a-accent);font:700 11px/1 ui-monospace,monospace}
.pw-artifact-actions{display:flex;align-items:center;gap:10px;margin-left:auto}
.pw-structured-content{display:flex;flex-direction:column;gap:12px;margin-top:14px}
.pw-structured-section{border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;background:var(--a-panel)}
.pw-structured-section>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;font-size:15px;font-weight:700;color:var(--a-ink)}
.pw-structured-section>summary::-webkit-details-marker{display:none}
.pw-structured-chevron{color:var(--a-muted);transition:transform .18s}
.pw-structured-section[open] .pw-structured-chevron{transform:rotate(180deg)}
.pw-structured-section[open]>summary{border-bottom:1px solid var(--a-line);padding-bottom:10px;margin-bottom:6px}
.pw-field-group{display:flex;flex-direction:column}
.pw-field{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:8px 18px;padding:10px 0;border-bottom:1px solid var(--a-line);min-width:0}
.pw-field:last-child{border-bottom:0}
.pw-field-label{font-size:12px;font-weight:700;color:var(--a-muted);text-transform:capitalize;padding-top:2px;overflow-wrap:anywhere}
.pw-field-value{min-width:0}
.pw-field-value .pw-prose{margin:0;line-height:1.7;color:var(--a-ink)}
.pw-field-value .pw-field-group{margin-left:14px;border-left:2px solid var(--a-line);padding-left:14px}
.pw-field-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px}
.pw-scope-list{display:flex;flex-direction:column}
.pw-scope-item{padding:14px 0 14px 14px;border-bottom:1px solid var(--a-line)}
.pw-scope-item:first-child{padding-top:0}
.pw-scope-item:last-child{border-bottom:0;padding-bottom:0}
.pw-scope-item p{line-height:1.65;margin:6px 0}
@media(max-width:680px){.pw-field{grid-template-columns:1fr}.pw-artifact-actions{margin-left:0}.pw-upload-form{max-width:none}}
@media(max-width:680px){.pw-upload-form{grid-template-columns:1fr}.pw-overview-grid{grid-template-columns:1fr}.pw-identity{flex-wrap:wrap}.pw-identity>div:nth-child(2){flex-basis:70%}.pw-header-facts{gap:10px 20px}.pw-footer{padding-bottom:58px}.pw-facts{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.pw-panel:not([hidden]){animation:none}.pw-anchor-nav a{transition:none}}
`;
