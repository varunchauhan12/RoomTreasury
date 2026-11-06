# M1B-2C — Switch transport and credential-delivery verification

Date: 2026-11-06. Scope: read-only UI and installed-source investigation. **Final decision: NO-GO for beginning live M1C integration under the current evidence.** This is an evidence gap, not a finding that Switch cannot support the product. Complete the bounded verification prerequisites below before reconsidering.

## 1. Executive summary

The eight mandatory inputs were reviewed: service identity design, M1B-2B completion, M1A inventory, Review Gate, architecture, API contract, milestones and backend runbook. M1B-2B implements bearer verification but deliberately has no operational issuer, task-result endpoint or human decision page. Backend unit/integration tests do not verify specialist access.

**VERIFIED LIVE:** The current selected Console inventory still shows four running Codex specialists on This computer: req-agent, challenge-agent, commitment-intelligence-agent and treasury-ops-agent. No project Coordinator is visible. Request Agent settings show Anyone addressing, Auto mode on, Bypass permissions off and own-process mode off. Its advanced panel exposes model/provider options, not a secret field or session HTTP catalog. It reports that the execution machine could not be checked.

**VERIFIED SOURCE:** The bundled host contains dynamic Switch tool discovery, authenticated internal HTTP, Codex environment/MCP configuration, addressed-event queues and turn start/resume code. It also contains service-grant token injection/redaction infrastructure. None proves that each current specialist can perform a secret-safe arbitrary RoomTreasury HTTP request.

**UNKNOWN:** Actual catalogs, per-session network permissions, private credential delivery, sibling isolation, effective main-agent flag/assignment, live targeted execution and browser-decision continuation remain unresolved. No credential was generated, read, copied or tested, and no message was sent.

**UNSUPPORTED (specific source path only):** The installed machine-helper service-token endpoint explicitly permits only GitHub. Treating it as a generic RoomTreasury token endpoint is unsupported by that implementation. This does not rule out a separately supported custom connector/MCP mechanism, whose availability is unknown.

## Evidence definitions and exact locations

- **VERIFIED LIVE:** directly displayed by the current running UI; a Running label is configuration/presence evidence, not task execution.
- **VERIFIED SOURCE:** implementation inspected; not proof of current effective configuration.
- **PARTIALLY VERIFIED:** only named prerequisites are established.
- **UNKNOWN:** required access or execution evidence is missing.
- **UNSUPPORTED:** a specific inspected implementation rejects/does not offer the proposed operation; not a blanket claim about Switch.

Path abbreviations used for exact source references:

```text
HOST = /Applications/Switch Console.app/Contents/Resources/dist-sidecar/shared-host.mjs
CORE = /Users/varunchauhan/Library/Application Support/switchdash/local-switch-server/native/switch-core/0.31.0/src/core/switch_core
```

These are documentation abbreviations, not configuration variables. All runtime source inspected was bundled/installed code, not private session configuration or credential contents.

| ID | Class | Evidence and actual observation | Remaining gap / sufficient for RoomTreasury? |
|---|---|---|---|
| L1 | VERIFIED LIVE | Console → Your Agents: four named specialists, Codex · This computer · Running; separate sidebar switch-buddy-admin | No Coordinator or session execution proof; insufficient |
| L2 | VERIFIED LIVE | req-agent → Agent settings: Anyone, Auto on, Bypass off, Can manage agents off, own process off; directory `/Users/varunchauhan/.switch/agents/localhost-58318/req-agent` | Effective per-tool permissions/catalog not shown; insufficient |
| L3 | VERIFIED LIVE | req-agent → Agent settings → Advanced configuration: Model, Reasoning effort, Verbosity, Reasoning summary, Web search. Defaults displayed; “Could not check this execution machine. Check provider setup and retry.” | Not an HTTP/secret configuration surface; model warning is not proof the running agent is broken |
| P1 | PARTIALLY VERIFIED | M1A records Console 0.40.1, deployed Core 0.31.0, Discord general with four agents/two people and Anyone on all specialists | Versions/room/other specialist policies were not newly re-read in this task; historical observations retained explicitly |
| S1 | VERIFIED SOURCE | HOST:79339 `loadOperations`, SwitchToolCatalog immediately following; HOST:79436 `callOperation` | Dynamic authenticated catalog and Switch operation HTTP, not each actual session's tools or arbitrary backend HTTP |
| S2 | VERIFIED SOURCE | HOST:61380–61515 `CodexAdapter.startSession/sendTurn`; HOST:61280 `threadModeConfig` vicinity | Builds app-server environment/MCP args and starts/steers turns; current inputs/tool exposure/network policy unknown |
| S3 | VERIFIED SOURCE | HOST:72190–72315 shared execution schema and `prepareSharedConfig` | Has inheritEnv, shellSetup, codexConfig and merges startup environment; no observed private RoomTreasury provisioning UI/hot update |
| S4 | VERIFIED SOURCE | HOST:25003 `prepareCodexSessionHome`; creates per-session provider home, merges source and supplied config | Per-session directory/mode support is not sibling OS isolation. No private files were opened |
| S5 | VERIFIED SOURCE | HOST:73136 `ServiceCredential`, :73198 `redactServiceToken`, :79724 `AgentServiceTokens`, :79835 dynamic catalog loading | Service credential templating, cache/grant checks and redaction exist; custom RoomTreasury service support and end-to-end redaction unverified |
| S6 | UNSUPPORTED | HOST:82932–82972 `startServiceEndpoint`: MACHINE_HELPER_SERVICES is `{github}`; refuses other services to session-run tools | This machine-helper path cannot simply be reused for RoomTreasury; no call was made |
| S7 | VERIFIED SOURCE | CORE/bridges/agent/operations/agent_services.py:43 `set_agent_service`: owner-connected service, agent-management permission, broker grant | A supported connected service is required; arbitrary custom service registration/delivery was not established |
| S8 | VERIFIED SOURCE | HOST:80795–80885 queued delivery/pump/admit; HOST:82903 addressed event converted to message.send delivery queue; :61493 sendTurn | Plausible idle notification → queued turn path; no current Coordinator/session delivery test |
| S9 | VERIFIED SOURCE | CORE/delivery/conversation.py:16–26; CORE/bridges/agent/commands.py:726–849 | Human no-mention routing and assignment gate semantics; actual flag/main assignment unknown |
| S10 | VERIFIED SOURCE | CORE/gateway/feature_flags.py:15 authenticated flag read; CORE/db/stores/room_store.py:27,76 main-agent metadata; CORE/bridges/agent/protocol/agent_detail.py:183–321 tools/session metadata | Candidate read-only metadata sources, not responses obtained from deployment |
| B1 | VERIFIED SOURCE | Repository backend/src/security/identity-route.ts and test-fixtures.ts; backend runbook and completion report | Identity read exists in code; issuer limited to disposable tests; no task-result receiver. No server started or DB inspected in this task |

## 2. Investigation 1 — Actual agent HTTP capability

**PARTIALLY VERIFIED:** Host locality is displayed for the four agents (L1). Request's directory and permission settings were refreshed (L2). M1A's other settings are historical evidence only. A local host would ordinarily share loopback absent isolation, but that is not an observed network route from any actual session.

| Specialist | Current host/presence | Actual session catalog | Arbitrary HTTP / header injection | Loopback and approval behavior |
|---|---|---|---|---|
| req-agent | VERIFIED LIVE: local, Running | UNKNOWN: no catalog exposed in inspected views | UNKNOWN | UNKNOWN; Auto on / Bypass off observed, not a successful request |
| challenge-agent | VERIFIED LIVE: local, Running | UNKNOWN | UNKNOWN | UNKNOWN |
| commitment-intelligence-agent | VERIFIED LIVE: local, Running | UNKNOWN | UNKNOWN | UNKNOWN |
| treasury-ops-agent | VERIFIED LIVE: local, Running | UNKNOWN | UNKNOWN | UNKNOWN |

**VERIFIED SOURCE:** S1 makes HTTP requests to Switch using internal session/connection identity. S2 configures a Codex app-server and MCP servers; command execution approval content includes the command text (HOST:61340 vicinity, `commandApprovalContent`). Permission handlers include network/file approval requests (HOST:61856). Thus passing an actual token through command text would be an exposure risk, even if shell HTTP were available. These functions are not a verified agent-callable fetch tool.

**UNKNOWN:** Current sandbox network settings, shell availability, target allowlisting, supplied-header behavior, actual host/port reachability and automatic-review decisions. No localhost probe was run from an agent; no prompt was sent to ask it for tools. No RoomTreasury listener was started. The inspected advanced panel did not expose a catalog and failed its execution-machine check. The same uncertainty applies separately to every specialist.

**Insufficient for RoomTreasury:** Need a non-secret tool inventory from the existing session, then a later explicitly authorized harmless endpoint test from each actual session. Do not export credentials or connect another session to obtain that inventory. A request from this Codex chat would not prove specialist capability.

## 3. Investigation 2 — Private credential delivery

No genuinely verified private delivery mechanism for RoomTreasury was found. **UNKNOWN** does not mean no mechanism exists; it means operational issuance must remain blocked.

| Candidate | Classification | Own access / sibling access | History/log risk | Rotate/revoke / restart / existing agents |
|---|---|---|---|---|
| Per-agent environment | VERIFIED SOURCE for startup environment plumbing (S3); UNKNOWN deployment support | Child input.env possible in code; per-agent operator setter and sibling exclusion unknown | Shell env dumps, tools and diagnostics could expose values; not verified covered by redaction | Backend revoke semantics exist, but delivery/update method and hot applicability unknown; startup injection may require session lifecycle changes |
| Per-agent secret store | UNKNOWN | No private RoomTreasury store or scoped retrieval interface observed | Unknown | Unknown for rotation, persistence and existing agents |
| Private host-side file | VERIFIED SOURCE for private session-directory creation (S4); UNKNOWN as RoomTreasury delivery | No file was created/read; same OS account generally defeats sibling confidentiality | File-read tool could copy secret into history; no broker enforcement shown | No verified operator delivery/atomic replacement/reload mechanism; surviving restarts is not established |
| Secure MCP/tool configuration | VERIFIED SOURCE for MCP/connector configuration (S2/S3/S5); UNKNOWN custom support | Potential host-side header rendering; current session registration/identity binding unknown | Tool responses/errors could leak; redactor existence does not prove all channels covered | Source has grant checks/renewal, but RoomTreasury registration and existing-session refresh unknown |
| Existing service-token helper | UNSUPPORTED for generic RoomTreasury use in this path (S6) | Only GitHub is allowed for machine tools | No secret response was requested | Not a supported route to deliver arbitrary backend tokens |
| Switch service grants | VERIFIED SOURCE (S5/S7); UNKNOWN custom RoomTreasury availability | Must be owner-connected, broker-supported service; no RoomTreasury grant established | Some host-side redaction exists, full trace coverage untested | Service grant/token renewal logic exists; custom service setup, revocation semantics and existing-session attachment unverified |

**Security conclusion:** Do not recommend a plain environment variable or mode-0600 file as a verified safe mechanism. Per-session directories are not separate OS users. Do not put tokens in shared prompts, command arguments, normal tool results, global shell configuration or Switch credential files. Do not reinterpret an existing GitHub/Discord credential as a RoomTreasury identity.

**UNKNOWN — minimal acceptable future choice:** A documented host-side tool/connector that holds each principal's token outside model-visible arguments, binds the caller to that principal, restricts target origin and strips secrets from all responses/errors would satisfy the desired shape. This is an acceptance requirement, not an installed solution or instruction to build a workaround. No credential-delivery mechanism is proposed as ready for use today.

## 4. Investigation 3 — Specialist-to-backend typed results

| Step | Classification | Exact candidate / blocker | Sufficient now? |
|---|---|---|---|
| Receive task from Coordinator | VERIFIED SOURCE; live path UNKNOWN | CORE/bridges/agent/operations/definitions.py:795 send_targeted_message; S8 host queue | No Coordinator or tested receive/execute path |
| Authenticate to RoomTreasury | PARTIALLY VERIFIED | Backend bearer verification is implemented; actual specialist HTTP and safe token delivery unknown | No |
| Submit typed result directly | UNSUPPORTED by current RoomTreasury API | No task-result endpoint exists; task guards are library tests only | No; deliberately not implemented here |
| Receive task/result acknowledgement | UNKNOWN / blocked by missing endpoint | Identity read acknowledgement is not a task result acknowledgement | No |
| Notify Coordinator result is ready | VERIFIED SOURCE; live path UNKNOWN | send_targeted_message to participant name; reverse policy and session delivery needed | No |

**PARTIALLY VERIFIED — proposed future flow:** Coordinator creates an authoritative task; sends task/revision/attempt IDs via targeted room message; specialist's verified private tool fetches context and authenticates its direct typed result; backend validates scope/role/assignee/attempt and returns an immutable result ID; specialist targets the Coordinator with IDs only; Coordinator fetches the stored result before advancing. Every unimplemented/unverified dependency remains a gate. Never authenticate a result by trusting forwarded agent names or a Coordinator assertion. Do not include a credential in the room handoff.

## 5. Investigation 4 — Wake-up and continuation

**VERIFIED SOURCE:** S8 maintains per-session room-event queues and delivers a handoff to the session host. `CodexAdapter.sendTurn` starts a turn or attempts steering into an active turn (S2). The host also describes failed deliveries remaining queued and requiring another addressing event or an explicit lifecycle action. This establishes a candidate implementation sequence, not a healthy currently bound Coordinator.

| Event | Classification | Candidate behavior and missing proof |
|---|---|---|
| Backend result submitted alone | UNKNOWN | A DB write does not inherently create a Switch event; no integration callback is configured |
| Specialist targeted notification | VERIFIED SOURCE / live UNKNOWN | Explicit targeting can create addressed event → queue → session handoff → turn call. Need actual Coordinator, reverse permission and a measured idle-turn test |
| Browser human decision | UNKNOWN | No human decision page or backend-to-Switch callback exists. Browser completion cannot be assumed to enter room routing |
| New relevant Discord human message | VERIFIED SOURCE / live UNKNOWN | Bridge/addressing/main-agent policy may select recipient; deployed flag/assignment and sender permissions remain unknown |
| Background backend polling | UNKNOWN | No persistent RoomTreasury poller verified. A model turn ending is not an always-running polling process |

**Insufficient for automatic orchestration:** Posting success proves at most a posted event; target `live` status is reachability at send time. Neither proves handoff consumption, resumed turn, correct task execution or committed backend result. Verify each stage with correlated non-secret IDs later.

**Proposed candidate only:** Use explicit targeted specialist notifications to wake the Coordinator if that path is proven. Persist results independently. For browser decisions, select a separately documented supported callback/dispatcher only after verifying its real authenticated interface. An outbox without a running sender cannot wake a session. Do not claim an ordinary broadcast agent message triggers human main-agent rules, or silently require another human “continue” message.

## 6. Investigation 5 — Main-agent routing and permissions

**UNKNOWN:** Effective follow_the_conversation and current main-agent ID/null. Current inventory contains no project Coordinator, but this does not prove the room has no main agent: an existing specialist might be assigned. No assignment/query chat command was sent. No live authenticated flag/metadata response was obtained; no token extraction was used to call the candidate APIs in S10.

**VERIFIED SOURCE:** S9 gates assignment, resolves an existing room participant and checks sender permission. Main-agent and conversational-follow rules consider eligible human text without `@`; agent/app messages do not get that fallback. Explicit mentions use a separate addressing path. Clearing follow-ups is distinct from clearing main assignment. This is source behavior, not a tested Discord route.

**PARTIALLY VERIFIED:** Request currently displays Anyone; M1A observed Anyone for all four specialists and their room membership. These are promising inbound policies, not proof of every agent-to-agent direction. An eventual Coordinator must itself admit the owner, teammate and four specialist senders. Switch ownership/admin status is unrelated to RoomTreasury financial owner membership.

**UNKNOWN:** Whether an additive Coordinator can be created, admitted and assigned on this deployment without affecting placements or policies. Source does not require replacing specialists, but actual admission/placement behavior must be reviewed. No creation, reconnect, invite or assignment was attempted. Do not repurpose switch-buddy-admin or req-agent silently.

## 7. Limitations, blockers and alternatives

1. **UNKNOWN:** Existing-session actual tool catalogs and network/approval policy. Obtain a supported non-secret session metadata view/export, or vendor guidance, without reading token stores or evicting sessions.
2. **UNKNOWN:** Safe custom credential injection. Obtain documented support for a per-agent host-side secret/tool boundary, covering sibling access, logs, rotation, restart persistence and attachment to existing agents. If unavailable, retain the no-provisioning boundary. A new isolated tool broker would be a separately reviewed architecture change, not a verified Switch feature.
3. **UNKNOWN:** Effective main-agent flag/assignment. Obtain authenticated non-secret configuration evidence through a supported read-only interface. Historical 401/404 probes do not answer this.
4. **UNKNOWN:** Actual idle resume and reverse targeting. Needs later authorization for Coordinator setup and controlled messages; it cannot be established by this strictly read-only task.
5. **UNSUPPORTED by current backend:** Typed result submission and browser-decision flow. Implement only in later explicitly scoped milestones after transport/identity feasibility is resolved.
6. **PARTIALLY VERIFIED:** Local service identity guards work in synthetic backend tests, but operational provisioning remains intentionally unavailable. Do not relax that guard for a demo.

**Recommended alternative sequence:** first close metadata and vendor-interface gaps without secrets. Then review a specific documented delivery mechanism. Only after authorization should one controlled identity-read test be attempted from each existing session, followed by nonfinancial correlated receive/result/notify and idle continuation tests once a receiver exists. Manual forwarding can be a labeled diagnostic, never proof of direct specialist authentication. If safe delivery cannot be supported, revise the architecture rather than inventing Switch APIs, sharing administrative credentials or weakening human authority.

## 8. Decision and inspection boundary

**NO-GO for M1C live integration now.** The source contains credible building blocks, but the minimum acceptance evidence—safe private token delivery, actual HTTP tools, effective routing and idle execution—is incomplete. This report completes the investigation deliverable; it does not complete those capabilities. No unsupported blanket claim about Switch is intended.

Exactly inspected in this task:

- The eight mandatory repository documents listed in section 1.
- Current Console Your Agents inventory; existing req-agent view; req-agent settings and its expanded five-option Advanced configuration panel. The other specialists were preserved and observed in inventory, not prompted or reconnected. Expanding the panel displayed a host-check failure; no explicit model-probe, restart or permission action was requested.
- Installed HOST source excerpts/functions referenced in the evidence table: Codex input/approval mapping, adapter/thread/turn handling, startup environment/MCP preparation, provider-home preparation, service token/credential/redaction/endpoint machinery, dynamic tool catalog and queued room delivery references.
- Installed CORE agent service-grant operation, feature flag read, room main-agent metadata and agent detail tool/session assembly references, alongside the source locations already recorded in M1A/Review Gate.
- Repository Git status (clean at inspection baseline). No backend server, database, migration or authentication test was run in this read-only investigation.

Only `docs/m1b-2c-switch-transport-report.md` was created. No backend or Switch configuration/source, dependencies, schemas, migrations, prompts, permissions, assignments or infrastructure was modified. No agent was created, renamed, replaced, started, stopped or connected/disconnected by an explicit task action. No Discord/Switch messages were sent. No credentials, token stores, private session configuration, process environments or secret files were read, created, copied or exposed. No M1C or M2 implementation began.
