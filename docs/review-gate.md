# RoomTreasury Lite — Review Gate report

Reviewed 2026-11-06 against an approximately 36-hour hackathon window.

**Outcome: accept the financial authority and authorization model; revise orchestration scope; keep live integration acceptance pending.** This review is complete as a document review, not an unconditional implementation sign-off. M1 should resolve the transport, execution-lifecycle and identity dependencies before building the broader system.

All five baseline documents were read: [architecture](architecture.md), [Switch integration](switch-integration.md), [database schema](database-schema.md), [API contract](api-contract.md), and [milestones](milestones.md). This report proposes amendments rather than silently replacing their requirements. The baseline proposals remain unchanged apart from a review-status note in the milestone checklist.

No application code was implemented. No Switch configuration, agent lifecycle, Discord messaging, permissions or credentials were changed or copied. This review adds no new live integration evidence. M0's UI observations establish inventory only; installed source support establishes possible interfaces only. The historical 401/404 probes do not establish feature availability.

## Decisions that can be accepted

| Decision | Why it fits Lite | Conditions retained |
|---|---|---|
| One TypeScript/Node service and one RoomTreasury SQLite database | Small deployment and one financial transaction authority | Explicit transactions, local file, foreign keys, bounded contention and real concurrency tests |
| Preserve existing Switch server, room and four specialists | Avoids replacing working infrastructure | Coordinator is additive; no assumed right to repurpose `switch-buddy-admin` or rename specialists |
| Integer cents, fixed USD budget and simulated settlement | Covers the required demo without payment-provider integration | Choose a concrete conservative cap; validate sums; real-money operations excluded |
| Immutable request revisions and source observations | Preserves the $70 rejection and $55 revision history | Bind approval to exact recipient, amount, purpose, currency and revision; edits invalidate unused approval and release hold |
| Separate suspected/corroborated/confirmed commitments | Correctly distinguishes Maya's evidence from owner authority | Only authenticated owner confirmation creates the $40 encumbrance |
| Approval plus reservation in one transaction | Prevents two approvals spending the same available funds | Recheck current state inside the write transaction; preliminary policy pass grants no authority |
| Atomic settlement and business-unique receipt | Makes repeated settlement safe independently of retry keys | Hold consumption, spend, receipt and audit commit together; no network calls inside transaction |
| Backend checks human owner and agent capabilities | Prevents an agent's prose from granting permission | Recheck membership and exact target on every protected action; no shared owner token |
| Authenticated decision page | Practical path to identity verification independent of Discord message prose | Explicit POST, session, CSRF, exact-target one-use nonce and owner-role check; decision link alone grants nothing |
| Persisted workflow history and shared context | Required for handoffs and human waits | Keep this persistence even when simplifying scheduling |

The core financial invariants can be implemented without weakening security. Reduce infrastructure and feature breadth, not these transaction/authentication requirements.

## Findings and necessary corrections

### Blocking integration dependencies

**1. No Coordinator has been established.** `switch-integration.md:41–44` refers to an “installed” or “existing” Coordinator session, but M0 observed only four specialists. An empty repository directory is not an agent. Establish the Coordinator's actual identity, host and room membership in M1; adding/configuring it requires a later authorized action. Until then, main-agent routing is a conditional choice, not an available entry point.

**2. Main-agent support is source-level only.** The documented `!assign-agent @agent-name` path depends on the deployed `follow_the_conversation` flag, eligible human text, room membership, addressing policy and a reachable session. Text with mentions may bypass the default route. Even if assignment succeeds, owner permission does not prove teammate permission. M1 must test eligible unmentioned messages from both roles. Do not enable a flag or change policies during this review.

**3. Targeted messaging is asynchronous delivery, not task execution.** The documented `send_targeted_message` operation is a reasonable candidate for all four specialists, provided each is a participant and permits the Coordinator to address it. `event_id` or `live` does not prove receipt handling, backend access or task completion. Test each specialist individually; one successful Request Agent handoff does not establish the other three.

**4. Both return paths need evidence.** A specialist should submit a typed result directly under its RoomTreasury identity, then address the Coordinator with task/result IDs. The backend result is authoritative task state; the Switch reply is a wake-up hint. Coordinator addressing permission must admit specialist senders as well as humans. A broadcast `post_message` or ordinary agent reply cannot be assumed to trigger main-agent routing. A notification containing a result ID is also not proof of that result: Coordinator must fetch it from the backend.

**5. Session tools and credentials are a missing deployment dependency.** No per-agent tool inventory, actual backend network path, or safe credential-injection mechanism was demonstrated. A Switch MCP endpoint in source does not mean each existing Codex session exposes it. Likewise, a task ID, signed task body or claimed `agentId` does not authenticate the submitting specialist. This dependency must be solved before coding four API clients around an assumed runtime.

**6. An idle Coordinator has no demonstrated polling loop.** `architecture.md:85` and `switch-integration.md:44–45` promise polling/recovery without identifying the process that runs it or the supported mechanism that wakes an idle Codex session. A browser owner decision updates SQLite but does not necessarily produce a Discord event. This can strand the workflow after Maya's corroboration or owner approval. A database outbox alone cannot run tools in an inactive agent session. M1 must prove a callback/poller owned by a running process, or a verified equivalent, for both specialist results and browser decisions. Requiring another human “continue” message is a disclosed scope change, not automatic orchestration.

### Financial and security ambiguities to fix before M2

**7. Settlement must not require the reserved amount to fit in available funds again.** `architecture.md:57` says to recheck financial state at settlement, but does not distinguish an approved hold from new spending. After approving $55, available is $5. Reapplying `5500 <= available` would reject the valid payment. New reservations/commitments require available funds; settlement requires an existing matching active hold and converts reserved to spent with zero change to available. Add this explicit test.

**8. Context/evidence invalidation can deadlock the happy path.** Global `contextVersion` changes, task writes, approval and reservation must not automatically invalidate their own inputs. Define separate relevant versions: immutable revision/terms, evidence version, fixed policy version, and task attempt/state version. Approval can advance financial state without invalidating evidence clearance merely because it created its own hold. New material evidence invalidates clearance. Logging, delivery acknowledgements and unrelated workflow progress do not. Recompute financial policy under lock rather than requiring an old financial snapshot to remain identical forever.

**9. “Complete evidence” is not yet an implementable rule.** A typed investigator result can report coverage; it cannot prove no unseen promise exists. Define the demo's investigation boundary: one mapped project room, a known history window through a captured cutoff, persisted commitments and explicitly identified sources. Incomplete pagination/access blocks clearance; new known material evidence increments its version. Owner review must show the scope and uncertainty. Do not claim exhaustive discovery across Discord or treat the agent's `clear=true` as proof. Freeze the deterministic demo policy and test it rather than building a general policy engine.

**10. Producer identity is not connected to the normal room flow yet.** The API correctly requires verified producer authorization (`api-contract.md:9,24–25`), but a Coordinator relaying a `sender` field does not create verified provenance. Choose one M1 path: an actual trusted event/context reader that verifies immutable source author IDs, or an authenticated producer acceptance of the proposed revision. The latter adds interaction and must be disclosed in the demo UX. Do not weaken owner checks to compensate. Preserve whether a source was captured by trusted code or merely suggested by an agent.

**11. Receipt replay must validate identity and binding before returning.** `database-schema.md:68` looks up an existing receipt first. That must mean after caller/project authorization and idempotency body validation, with comparison of request, revision and supplied approval binding. An incorrect approval ID must conflict rather than receiving a success response simply because the request was paid previously. An authorized retry of the same completed operation may return its original receipt even if current owner membership later changed; no new spend occurs. Scope idempotency to principal, project, action and target, and authorize before replaying stored responses.

**12. Logical API roles do not isolate same-user local agents.** The architecture acknowledges the shared-host trust boundary, but the milestone statement “No agent can bypass the service” overstates it if agents can read the SQLite file or one another's secret configuration. Per-agent credentials authenticate credential possession, not a cryptographic guarantee about which AI process used them. Keep owner credentials out of agent tool contexts, avoid sharing browser sessions, and restrict credential visibility where the host supports it. An untrusted-agent threat model requires OS/process isolation; do not claim that protection in this local hackathon demo. SQLite triggers do not protect against an actor with filesystem/DDL authority.

**13. Semantic duplicate obligations cannot be a universal invariant.** IDs and source keys prevent retries of one known promise from creating duplicate entries. They cannot prove two differently worded natural-language promises are the same obligation. Keep deterministic deduplication and show possible overlaps to the owner. The unsupported commitment-payout path must be rejected explicitly. Do not imply that the backend can reliably detect every disguised payment of an existing obligation.

**14. Local decision-page access is unresolved.** A backend on `127.0.0.1` is reachable only on that host. Maya/owner may use different devices; OAuth redirect, browser access, cookie security and callback origin must all work for the actual demo participants. Choose and verify an appropriate protected origin/network path in M1. Do not casually bind to all interfaces or expose an unauthenticated tunnel. Preprovisioned project membership verifies role after login; login alone does not prove project membership or confer ownership.

**15. Several schema rules need concrete SQL design.** An active-hold-per-request rule needs request identity in the reservation/index or an equivalent relational guard; it cannot be a simple unique index across a join. Exact target/recipient relationships need composite keys, not only project IDs. Receipt/ledger references need a valid insertion order or deferred constraints. Commitment confirmation dedupe needs a stable logical obligation ID, not just a new version ID. Keep these safeguards, but design them in a small migration rather than promising triggers will infer all relationships.

## Live verification matrix

Every row is **unverified for the deployment** at this Review Gate. Requirements below describe future checks, not actions performed now.

| Agent | Required existing-session capabilities | Required addressing directions | RoomTreasury backend scope |
|---|---|---|---|
| Coordinator (not yet established) | Discover participants; read relevant context; target specialists; post final response; authenticated backend client; verified wake/resume mechanism | Humans → Coordinator, all four specialists → Coordinator; Coordinator → all four specialists | Intake/proposals, context, eligible dispatch, result/status read; no owner authority or Treasury settlement scope |
| `req-agent` | Read task/context; submit structured proposal/result; targeted return message | Coordinator → req-agent; req-agent → Coordinator | Its assigned request task and proposal writes; no financial approval |
| `challenge-agent` | Read financial/policy snapshot; submit advisory result; targeted return | Coordinator ↔ challenge-agent | Assigned review result and deterministic evaluation request; cannot set authoritative policy outcome |
| `commitment-intelligence-agent` | Paginated room context/evidence access; submit findings; targeted return | Coordinator ↔ commitment-intelligence-agent | Assigned investigation, suspected obligations and sources; no owner confirmation or human corroboration |
| `treasury-ops-agent` | Read approved revision/hold; call simulated settlement; submit/notify outcome | Coordinator ↔ treasury-ops-agent | Its assigned settlement only; backend verifies approval, hold, evidence and project |

Record non-secret immutable agent IDs, room IDs, actual tool names/signatures, host locality and effective addressing policy. A Console “Running” label cannot fill this matrix. Do not connect a second session of an agent to inspect a room if doing so could evict its working session.

### Backend identity recommendation

Use separate high-entropy RoomTreasury service credentials for Coordinator and each specialist, independently scoped to project/role and stored hashed server-side. This is a proposed application mechanism, not reuse or copying of Switch credentials. Provision later through a verified private per-agent host mechanism; no secrets in prompts shared with the room, handoff JSON, command-line arguments, repository or logs. If existing hosts cannot keep credentials separate, explicitly record the weaker trusted-host boundary or block the claimed per-agent isolation; do not distribute one shared administrative token.

The backend derives principal from the credential and enforces assigned task, attempt/version and project. It rejects a different specialist's result even when task IDs are known. A Coordinator-forwarded result must not be labeled specialist-authenticated unless backend trusted code independently verifies its immutable Switch sender identity. Direct specialist submission is the preferred minimum.

For humans, keep the proposed verified Discord login and locally provisioned immutable user-ID role mapping. M1 must demonstrate it with two real distinct identities. No need for guild-role synchronization in Lite. A verified teammate corroborates; only the provisioned owner confirms/approves. If OAuth or a separate securely authenticated human mechanism cannot be demonstrated, owner-authorized demo completion remains blocked. A name comparison, public magic link or agent-held owner token is not an acceptable shortcut.

## Simplifications recommended for the minimum demo

1. **One fixed workflow template.** Keep persisted `WorkflowRun`, tasks, fixed prerequisites, results and audit events. Encode the required sequence directly with guarded transitions. Do not build a general editable DAG, dynamic scheduler or arbitrary next-action engine. A revised request creates a fresh revision-scoped set of tasks; stale results are rejected.
2. **One dispatcher owner.** Select one verified running execution mechanism in M1. Use targeted notifications as the normal path. If an idle-agent wake callback is unavailable, a small backend-owned bounded poll/dispatch loop is necessary, but only if it has a verified supported Switch/session interface. Do not implement duplicate Coordinator and backend polling systems.
3. **Minimal durable pending delivery state.** Keep task/result/financial writes durable and a pending-dispatch or pending-notification marker written atomically with the transition that requires it. It may live on task/workflow records for Lite. A separate generic outbox API, delivery leases, queue framework and exactly-once messaging claims are unnecessary. Retry may duplicate a message; deduped task/results/settlement must prevent duplicate effects. Expose failed delivery visibly and support an explicit operator retry.
4. **Simple attempt/version guard.** For the single dispatcher, retain compare-and-swap task state and a monotonically increasing attempt token. Reissuing work advances that token and invalidates older results. Defer distributed worker leasing/heartbeats; allow interrupted work to be visibly pending and resumed explicitly. Do not claim unattended crash recovery unless tested.
5. **One decision screen and one auth flow.** Reuse it for Maya corroboration, commitment owner confirmation and revision spending approval. Issue the exact-target nonce with the authenticated form rather than adding a separate public nonce-management product. Preserve session, CSRF, explicit terms and one-use decision semantics.
6. **Fixed recipient and policy data.** Seed immutable simulated recipients and USD policy for the demo. Keep revision-bound terms and policy identity, but defer recipient-edit APIs, policy editing and broad management interfaces.
7. **Keep necessary relational records; trim framework tables.** Required domain entities, memberships, immutable sources, approvals/holds/ledger/receipts and audit remain. Revision state can live on the immutable revision's lifecycle metadata; evidence coverage can be a structured persisted task result; fixed dependencies can live in code. Do not implement every proposed auxiliary table and endpoint simply because it appears in M0.

These changes preserve shared context, structured handoffs, task dependencies/lifecycles and persistent history. They narrow scheduler capabilities and automated recovery promises, so the baseline milestone tests for general DAGs, leases and outbox recovery must be revised when this scope is adopted; they must not be marked passing or silently omitted.

## Defer until after the core demo

- Generic workflow designer, arbitrary DAG edits, multi-worker orchestration, distributed leases, self-healing agent lifecycle and comprehensive automatic redelivery.
- Private handoff rooms, a replacement Discord bot, generic Switch webhook/bridge implementation, or a second transport when the supported session tools suffice.
- Real payments, wallets, provider retries, commitment payout/adjustments, refunds, budget top-ups and multiple currencies.
- Dynamic policy administration, recipient editing/version management UX, guild-role synchronization, public multi-tenant onboarding and broad role administration.
- Attachment ingestion, exhaustive cross-room discovery, semantic duplicate-promise guarantees and advanced dashboards.
- Production protection against a malicious same-OS-user agent; public production deployment. Describe this limitation rather than treating it as solved.

Do **not** defer authenticated human decisions, owner role checks, agent/project authorization, immutable revisions, integer cents, atomic reservation, receipt uniqueness, financial audit, source references, replay protection, or tests of financial invariants.

## Concrete M1 execution checklist

Target M1 timebox: **four hours after authorization to proceed**, including a minimal identity/transport slice. This is a planning limit, not a reliability claim. Stop adding features if a blocking capability cannot be established within the timebox. No checklist item below is marked complete by this review.

### M1A — Read-only capability inventory (target: 45 minutes)

- [ ] Record deployed component versions and a five-row agent capability matrix above using existing safe read interfaces. Every unknown is explicit; no credential values are captured.
- [ ] Establish whether a Coordinator exists and identify its host/session; otherwise document the supported additive creation step for later authorization. Preserve all four specialists.
- [ ] Read deployed main-agent feature availability, current assignment and effective policy through supported authenticated UI/tools if accessible without copying secrets. Acceptance: evidence distinguishes flag state, room membership, owner access, teammate access and specialist-sender access.
- [ ] Identify the exact session tool for each required operation and whether each host can make authenticated HTTP calls to the planned backend. Acceptance: no assumed shell/tool/network capability remains hidden in the plan; unknowns block the relevant test.
- [ ] Select the owner/teammate authentication and reachable decision-page origin. Acceptance: callback setup/access prerequisites and role-provisioning responsibility are documented with no secrets.

Current user restrictions prohibit configuration changes, starts/stops, messages, permission changes and credential copying. If M1A cannot obtain evidence without those actions, record the blocker. M1B/C require a later task explicitly authorizing their relevant setup and tests; this report does not authorize them.

### M1B — Minimal foundation and identity slice (target: 90 minutes)

- [ ] Pin one supported Node runtime, HTTP library, SQLite driver, validation and test tooling. Acceptance: clean install/build and actual driver transaction/FK smoke check; local SQLite CLI version is not used as driver proof.
- [ ] Establish explicit demo/test/real configuration and ignore all runtime DB/sidecar/secret files. Acceptance: test uses a temporary database; seed/reset cannot target real data; secret values never appear in repository/diffs/logs.
- [ ] Provision five private scoped **RoomTreasury** service identities through the verified host path. Acceptance: correct credential is mapped server-side; invalid credential gives 401, other role/project gives 403/404 as appropriate; each agent is denied owner actions. Never print or copy Switch credentials.
- [ ] Demonstrate actual owner and Maya login from their intended devices/browser contexts and preprovisioned immutable IDs. Acceptance: owner-only test decision succeeds once; teammate corroboration is attributed to Maya; teammate, agent and forged display name cannot make the owner decision. Verify expired/reused nonce and CSRF denial. Use a harmless test decision before financial implementation.
- [ ] Write the small fixed transition contract, typed task/result envelope and minimal endpoint schema. Acceptance: it defines the own-reservation settlement rule, relevant version invalidation, authentic producer ingress, one dispatcher/wake mechanism and stale-result handling; general outbox/DAG framework excluded.

### M1C — Authorized routing and return-path spike (target: 75 minutes)

- [ ] Add/assign Coordinator only through verified supported controls if needed and authorized; record previous room assignment for review. No specialist replacement, restart or permission expansion is implicit.
- [ ] Obtain one controlled eligible unmentioned human message from owner and one from teammate. Acceptance: both cause Coordinator handling without a specialist mention; record immutable event IDs. Record mention/thread exceptions separately.
- [ ] Run one correlated nonfinancial handoff through **each** existing specialist. Acceptance: four unique tasks, four specialist-authenticated backend results and four addressed return notifications; Coordinator retrieves each stored result. Delivery status alone fails this criterion.
- [ ] Let the Coordinator turn end, then cause a controlled result and a browser-side human-decision event. Acceptance: the selected running mechanism resumes the workflow without a new human Discord nudge. Measure delay; target under 15 seconds in the demo environment. A simulated local event may test the mechanism but cannot substitute for the real human/transport path in final acceptance.
- [ ] Capture one denied/stale/duplicate result test without changing live policies. Acceptance: forged principal, wrong assignee and old attempt cannot advance a task; duplicate result has one effect. Use a test backend and fake negative requests rather than disrupting agents.

### M1D — Evidence and go/no-go (target: 30 minutes)

- [ ] Attach redacted tool inventories, immutable IDs, correlated transcripts, login/authorization test output and unresolved gaps to an integration evidence report. Label every item `observed configuration`, `live tested`, `mock tested`, or `unverified`.
- [ ] Reconcile accepted scope amendments into the five design documents before M2. Acceptance: no contradictory promise of generic orchestration, installed Coordinator, complete evidence proof or automatic polling remains.
- [ ] Go only if routing, all four handoffs, authenticated direct results, human identity, backend reachability and idle-session continuation have evidence. Otherwise name the failed requirement and review a documented alternative; do not claim the single-entry multi-agent demo works.

M1 proves feasibility, not financial correctness. M2 must still pass the complete relevant financial invariant matrix, including the new own-hold settlement and approval-binding replay cases. Keep the $40 committed / $55 spent / $5 available scenario and repeat-settlement check as the final end-to-end acceptance test.

## Suggested remaining 36-hour budget

| Work | Hours | Exit condition |
|---|---:|---|
| M1 identity/routing feasibility and foundation | 4 | The gates above have evidence or an explicit no-go |
| Financial services, migrations, authenticated financial actions and invariant tests | 14 | Guarded transactions and role boundaries pass against actual SQLite |
| Fixed workflow and specialist contracts | 7 | Shared context, waits, stale/duplicate result handling persist correctly |
| Actual Discord integration and participant decision flow | 5 | Full scenario executes with all four preserved specialists |
| Regression, retry/restart checks, documentation and demo rehearsal | 6 | One receipt, reconciled final balances, reproducible isolated demo |

If time slips, cut deferred features first. A nonfinancial diagnostic can still demonstrate a routing limitation, but it cannot replace the required owner-authorized financial demo or justify bypassing its guards.
