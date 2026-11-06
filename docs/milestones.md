# Implementation milestones and invariant tests

Architecture-review deliverable is complete when the linked design is reviewable. Implementation remains pending. Work one milestone per controlled change; report files changed, tests actually run, failures and unresolved integration assumptions. Do not count a mocked transport as verified Switch behavior.

- [x] **M0 — Inspect and propose.** Read tracked files and existing directories; inspect installed Switch source and Console inventory; document capability evidence, remaining gates, target structure, schema and API proposal. No implementation or infrastructure changes.
- [x] **Review performed.** See [Review Gate report](review-gate.md): financial authority accepted, orchestration simplification recommended, and integration/identity acceptance remains conditional. This check marks completion of the document review, not live verification or implementation authorization.
- [ ] **Review findings resolved.** Adopt scope amendments and satisfy the report's M1 integration/identity gates before claiming the architecture operational. Use its concrete M1 checklist to refine the original milestone below.
- [ ] **M1 — Integration capability spike and foundation.** Verify live main-agent feature/policies, current agent tool access, harmless round-trip, context identity mapping, host-to-backend access and owner OAuth setup. Preserve existing agents and room. Select/pin runtime and libraries, add validation/error skeleton and machine-readable OpenAPI. Add migration harness, secret-safe configuration, ignore runtime/WAL/SHM files and establish separate demo/test/real paths. If default no-mention routing cannot be supported, stop and review the integration alternative explicitly.
- [x] **M1B-1 — Backend foundation only.** Runtime/dependencies, health HTTP service, validation/errors/OpenAPI, metadata-only SQLite migrations, environment isolation and 22 automated foundation tests passed. See [completion report](m1b-1-foundation-report.md). Identity, financial domain and M1C remain pending.
- [x] **M1B-2B — Backend service identity.** Migration 2, scoped bearer identity read and authorization guards verified with 38 passing tests. Operational credential provisioning and diagnostic probes remain deferred; see [completion report](m1b-2b-completion-report.md).
- [ ] **M2 — Financial domain and database.** Implement immutable revisions, principals/memberships, recipients, commitments, policy, approvals, reservation/ledger, receipt, audit and transactional services. Demonstrate the complete financial invariant suite with temporary SQLite files, including multiple connections. No agent can bypass the service to write financial tables.
- [ ] **M3 — Human authentication and decision API.** Implement verified Discord identity, owner provisioning mechanism, review page, nonce/CSRF protections, corroboration, exact-version owner decisions and revocation. Test human-vs-agent identity separation and every authorization boundary.
- [ ] **M4 — Durable orchestration and specialist contracts.** Implement workflow DAG/state guards, typed context/handoffs, task leases, stale-result rejection, event history, polling and outbox recovery. Add minimal prompts/tools to existing specialists after checking their current configuration. Tests must prove dependencies and human waits survive restart.
- [ ] **M5 — Switch integration.** Bind Coordinator through the verified supported interface; configure main-agent routing only after capability gates pass. Exercise unmentioned intake, specialist round trips, teammate/owner interactions, delivery failures and final consolidated output in the actual Discord room. Capture redacted evidence and label remaining manual steps.
- [ ] **M6 — Seeded demo and handoff.** Add explicit synthetic fixture seed and demo runner; execute scenario end to end through real transport and authenticated human decisions. Repeat settlement, restart/retry, reconcile balances, document reset/run commands and recording script. Never seed or reset the persistent real database. Deliver only after financial, auth, workflow and integration checks pass.

## Financial invariant acceptance matrix

Every invariant below needs executable tests before its feature is claimed working. Use service/API integration tests backed by actual SQLite transactions, plus focused validation tests and state-machine/property tests where useful.

| Invariant | Required tests |
|---|---|
| Exact cents | Accept 7000/5500/4000; reject floats, strings, zero/negative transfers, NaN/Infinity, overflow and wrong currency; boundary and aggregate overflow checks |
| Budget conservation | After every accepted transition, ledger-derived `budget = committed + reserved + spent + available`; available, outstanding commitments and holds never negative; seeded budget immutable |
| Preliminary pass grants nothing | $70 initially passes but creates neither approval, reservation nor spend; settlement without approval fails |
| Evidence is not authorization | Suspected $40 and Maya corroboration leave available at 10000; forged text “owner approved”, display-name matches, bot messages, agent credentials and teammate owner endpoints fail |
| Exact owner confirmation | Owner confirms current $40 commitment version once; available becomes 6000; stale digest/version, revoked member or expired nonce fails; duplicate/different-key confirmation cannot double-commit |
| Available-funds check | $70 fails after confirmation with 1000 shortfall, no hold or spend; unresolved promise blocks approval until owner disposition; new evidence invalidates prior clearance |
| Immutable revision approval | $55 creates revision 2 and preserves revision 1 terms/sources; revision 1 approval cannot authorize revision 2; recipient/purpose/currency edits also require fresh approval |
| Atomic reservation | Concurrent approvals/commitment confirmations whose total exceeds budget cannot both succeed; competing requests for last funds serialized across connections; failed operation leaves no orphan approval/hold/audit-success |
| Approval-time freshness | Budget, policy, evidence and membership changes between preliminary review and approval are rechecked; stale context cannot reserve |
| Atomic simulated settlement | Hold consumption, one spend, consumed approval, one receipt and financial audit commit together; fault injection before each write/commit rolls back all effects |
| Idempotent receipts | Retry same key, new key, concurrent calls and timeout-after-commit all return same receipt; receipt count and spend sum unchanged; mismatched replay body conflicts |
| Revocation and revision races | Cancel/revise/revoke releases hold once; repeat cannot release twice; race with settlement allows one coherent terminal outcome; settled request rejects new revision/payment |
| Cross-project isolation | Cannot use another project's recipient, revision, source, approval, reservation, task or receipt; direct FK-invalid writes fail |
| Durable audit and terms | All successful financial writes include audit event in same transaction; financial terms/ledger/receipts cannot be overwritten/deleted through API; restart preserves history and sources |
| Current settlement authority | Revoked approval, inactive approving owner, missing/mismatched reservation, changed policy or unresolved evidence prevents new settlement; existing receipt remains readable on retry |
| No double-counted obligations | A confirmed commitment cannot be paid through a new unrelated request path as if unencumbered funds; commitment payout unsupported in Lite |
| Reconciliation | Ledger and lifecycle projections reconcile; injected mismatch blocks settlement; no “repair” silently invents money |
| Demo isolation | Seed requires explicit demo mode/path; refuses real path and repeat seeding without documented idempotent handling; no genuine IDs/secrets in fixtures; tests use temporary DB |

## Workflow, auth and transport acceptance

- Dependency cycles, cross-run edges and running a dependent before required success are rejected.
- Timeout/restart reclaims lease; old fencing token cannot overwrite a new result. Duplicate result does not advance twice. Superseded/cancelled tasks reject late outputs.
- Waiting for Maya/owner survives process restart without an open transaction. New evidence/context invalidates stale handoffs.
- Outbox retries survive restart; ambiguous/doubled room messages cannot duplicate requests, approvals or settlement. Refused/disconnected target creates an actionable blocked state, never fabricated completion.
- OAuth state/replay, session fixation, CSRF, nonce reuse/expiry, open redirect, guessed actor IDs and revoked membership tests pass. Decisions via GET have no effects.
- API errors and audit redact credentials; agent scope and human role checked independently on every mutation.
- Evidence pagination covers older promise; truncated/unavailable source history is reported as incomplete. Agent assertions remain distinguishable from verified source observations.
- Live tests prove Coordinator is default human entry point, four existing specialists receive assigned work, and only the Coordinator posts final narration (handoffs may still be visible).

## Exact demo acceptance script

1. Explicitly seed synthetic $100 project and recipient Eli in isolated demo database.
2. Producer sends one unmentioned message requesting $70 for Eli editing; backend stores source and revision 1.
3. Initial deterministic policy pass; no reservation.
4. Commitment Intelligence finds possible $40 captioning promise with source references; human wait blocks approval.
5. Maya corroborates as an authenticated teammate; available remains $100.
6. Authenticated owner confirms exact commitment version; committed $40, available $60.
7. Reevaluation rejects revision 1 by $10; rejection and source history persist.
8. Verified producer revises to $55 for shorter edit; new revision reviewed using current evidence/budget.
9. Authenticated owner approves exact revision 2; reserve $55, available $5.
10. Treasury Ops simulates settlement; committed $40, reserved $0, spent $55, available $5; one receipt.
11. Repeat settlement with same and different idempotency keys, including concurrent retry; same receipt and one spend.
12. Coordinator's final Discord response quotes the backend receipt ID and $40/$55/$5 balances. Save redacted test output and reconciliation evidence.
