# M2A — Synthetic financial engine completion

Status: **COMPLETE within M2A scope**, 2026-11-06. The financial library and its tests are implemented. This is not a live authenticated product workflow: human authentication, financial HTTP routes, frontend and Switch orchestration remain unimplemented.

## Files created and modified

Created:

- `backend/src/db/financial-schema.ts`: migration 3 SQL, financial constraints, balance view and transition triggers.
- `backend/src/domain/financial-engine.ts`: trusted actor types, validation and synchronous financial operations.
- `backend/tests/financial.test.ts`: 13 financial test cases against temporary SQLite files.
- `backend/tests/financial-worker.ts`: separate-worker connection helper for actual concurrent approval and settlement attempts.
- `docs/m2a-financial-engine-report.md`: this report.

Modified:

- `backend/src/db/migrations.ts`: import and append migration 3; update the migration-array comment.
- `backend/tests/database.test.ts`: preserve foundation checks while advancing schema expectations and pending fixture migration numbers.
- `backend/tests/identity.test.ts`: preserve identity tests while advancing the upgrade expectation through version 3.
- `backend/README.md`, `README.md`: current financial-library status, commands and trust boundaries.

`backend/openapi.json` was regenerated and is unchanged. No packages, lockfile, dependencies, runtime pins, config/path guards, server binding, application routes or service-auth implementation changed. The already-untracked `docs/m1b-2c-switch-transport-report.md` was preserved without modification. Ignored build/test output was regenerated; test databases were disposable.

## Migration 3

Name: `synthetic_financial_engine`. Versions 1 and 2 retain their original SQL and names; `service-schema.ts` is unchanged. The existing checksummed, ordered, immediate-transaction runner supplies all-or-nothing migration application, mode binding, repeat validation, foreign-key enforcement, WAL and bounded busy timeout.

All 11 financial tables are STRICT:

| Table | Purpose / binding |
|---|---|
| projects | Immutable synthetic USD budget, positive integer cents capped at 1,000,000,000 ($10 million) |
| project_recipients | Immutable recipient identity/name within a project; composite project/recipient key |
| payment_requests | Stable requester/project, current revision pointer; starts at 1 and advances one step at a time |
| request_revisions | Immutable recipient, amount, purpose, USD and source-reference array; composite request/revision key and project/recipient FKs |
| commitments | Immutable proposed terms and sources; one-way owner confirmation state and confirming actor ID |
| payment_approvals | Immutable owner decision referencing the exact immutable revision; one per revision |
| reservations | Approval/request/revision binding, one active hold per request; active → released or consumed only |
| ledger_entries | Immutable simulated spend, unique per request and reservation; exact amount/currency and receipt binding |
| settlement_receipts | Immutable receipt, unique per request and ledger entry; recipient/purpose snapshot matched to the revision |
| financial_audit_events | Append-only successful mutations and explicit policy-evaluation history, actor IDs, target IDs, JSON details and epoch-ms time |
| settlement_idempotency | Immutable principal/project/key → exact request/revision/approval/receipt binding; settlement action implicit in table |

`project_balances` derives budget, confirmed commitments, active reservation amounts and spends in SQLite; available is their difference. Reservation amounts derive from immutable revisions rather than a second editable amount.

SQL enforces positive bounded integer amounts, fixed USD, synthetic projects, valid relational bindings, JSON source arrays, immutable terms/history, sequential revisions, legal commitment/hold transitions and capacity checks for confirmation/reservation. Approvals and reservations have deferred reciprocal foreign keys, preventing an approval without its matching hold at commit. Ledger entries and receipts similarly have deferred reciprocal bindings. A matching ledger insert consumes the active hold through a trigger; a failed receipt or commit rolls that consumption back. No remote operation occurs inside a transaction.

Startup adds empty tables only; no project, human, agent or credential seed records are installed. Existing service scopes remain authorization namespaces under unchanged migration 2. Financial actions check their financial project and the caller's corresponding scope; this milestone does not retrofit a financial FK onto legacy authorization namespaces. Financial mutations reject real-mode databases before writing. Test/demo/real path isolation and explicit path requirements remain unchanged.

## Implemented operations and invariants

The engine exposes project initialization, recipient creation, balance reads, proposed commitments, owner confirmation, request creation/revision, explicit policy evaluation, owner approval/reservation and simulated settlement. There is no CLI seed command or HTTP registration for these operations.

- Integer USD cents are checked before writes. Budgets and individual amounts have a conservative cap; aggregate confirmed + held + spent cannot exceed the immutable project budget.
- Proposed commitments have no balance effect. Owner confirmation checks current capacity under the write lock and is idempotent by commitment ID. Repeated confirmation creates neither a second commitment nor a second confirmation event.
- Requests can record over-budget proposals. Explicit evaluation persists a pass/rejection and shortfall; rejection creates no hold. Approval independently recomputes current capacity and cannot rely on an earlier policy pass.
- Human owner decisions require a trusted human owner actor scoped to the project. Every service-kind actor uses the existing unconditional owner-denial guard. Coordinator receives no Treasury capability.
- Request revisions retain exact recipient, amount, purpose, currency and source references. Approvals reference that immutable row, so no separate editable approval terms can drift. Stale revision IDs are rejected.
- Only the original requester can revise. Revising releases an active unused hold atomically and requires a new exact-revision approval. Settled requests cannot be revised or approved again.
- Approval plus reservation plus audit commit together under `BEGIN IMMEDIATE`. Retrying approval for the current held revision returns its existing approval without reserving again.
- Settlement accepts a previously authenticated, trusted service context. It rechecks credential ownership, expiry, revocation, principal status, project scope and exact Treasury role under the write lock, before replay lookup. Context objects are not credentials and must never be constructed from caller JSON.
- Settlement requires the current revision, matching approval and active hold. It consumes that hold without comparing the amount against remaining available funds again. Spend, receipt, hold consumption, idempotency mapping and audit commit together.
- Retrying with either the same key or another key returns the original receipt. Unique business keys prevent additional spends/receipts independently of retry keys. Rebinding a key or supplying a different approval/revision conflicts. Revoked or unscoped callers cannot replay a receipt.
- Receipts/spends/approvals/revisions/audit/idempotency records cannot be updated or deleted through ordinary SQL. Failed transactions retain no partial financial state. Failed operations do not leave successful audit entries; this is not a separate denied-attempt security log.

## Executed verification

Used the existing Node **22.22.3**, npm **10.9.8**, Fastify **5.12.8**, AJV **8.20.0**, better-sqlite3 **13.0.3**, @fastify/swagger **9.9.3**, TypeScript **5.9.3**, Swagger Parser **13.1.0** and Node test runner. No new dependencies were installed.

Commands actually executed from the repository root:

```sh
export PATH=/Users/varunchauhan/.nvm/versions/node/v22.22.3/bin:$PATH
npm run typecheck
npm run build
npm run openapi
npm test
git diff --check
```

Final inspected results: **typecheck PASS; production build PASS; OpenAPI generation PASS; 51 tests PASS, 0 failed, 0 cancelled, 0 skipped; diff whitespace check PASS.** All 38 previous foundation/identity cases remain, with schema-version expectations updated. Existing tests validate OpenAPI with Swagger Parser, compare the generated artifact, exercise the actual HTTP health endpoint, and verify that all modes still expose only health and service identity.

New financial coverage includes:

- Full $100 scenario: proposal has no effect, owner confirms $40 exactly once, $70 evaluation fails by $10, approval fails without writes, immutable $55 revision passes, stale approval fails, owner approval reserves $55, and Treasury settles against the hold despite only $5 available.
- Final balance assertion: **$40 committed, $0 reserved, $55 spent, $5 available**; exactly one ledger spend and one immutable receipt.
- Same-key/different-key retries, changed target/key binding denial, and retries after reopening through another connection.
- Revision hold release; changed recipient/purpose/amount require a new approval; original requester ownership and settled-request restrictions.
- All five service roles denied both owner actions with 403, added owner claims ignored, wrong-project humans denied, and Coordinator denied settlement.
- Treasury scope disable/re-enable, credential revocation, rotation and expiry rechecked using previously authenticated contexts.
- Two worker threads, each with a distinct SQLite connection, simultaneously attempt separate $60 approvals against $100: exactly one succeeds, the other fails insufficient funds, available is $40.
- Two separate worker connections simultaneously settle the same request with different keys: both receive the same receipt and only one spend exists.
- Injected audit failures roll back commitment confirmation, approval/hold, revision/hold release and settlement. Injected idempotency insertion failure rolls back the entire settlement, including the trigger-consumed hold.
- Domain and direct SQL checks reject invalid amounts/currency, cross-recipient relationships, initial confirmed commitments, altered immutable records, illegal transitions, over-budget reservations and orphan approval/spend records.
- Migration-2 database upgrades to 3 without changing historical metadata or synthetic service identity/credential validity; repeat application adds nothing; real-mode financial writes fail closed. Fresh migration, migration rollback and repeat/reopen remain covered by foundation tests.
- Existing automatic credential scans inspect temporary DB/WAL/SHM files, including new financial fixture databases; existing error/log/stdout secret tests continue to pass. No new request/body/token logging was added.

Initial typecheck failures were confined to new test-fixture call signatures and TypeScript narrowing; these were corrected before the passing runs. No unresolved test failure remains.

## Deferred requirements and trust boundary

Human/operator contexts are an explicit **trusted in-process domain boundary**, not a new authentication mechanism. Tests construct synthetic owners/requesters; this does not prove any real person authenticated or any real owner approved a payment. No HTTP caller or agent has a financial entry point. A future adapter must derive human identity/membership from verified authentication and implement the reviewed decision/CSRF protections; it must never deserialize these actor types from caller data. Balance reads also remain internal and need caller authorization before future exposure.

Human OAuth/browser sessions, owner provisioning, financial HTTP contracts, frontend, live agent credentials, task-assignee integration, investigation/evidence coverage, Maya corroboration, Coordinator routing, source authenticity and automatic orchestration remain deferred. The policy implemented here is the deterministic synthetic USD/budget/revision policy, not proof of exhaustive obligation discovery. Source references preserve supplied provenance; they do not verify Discord authors. Commitments remain outstanding; paying/releasing a commitment, refunds, budget changes and real payments are unsupported. Semantic duplicate obligations are not inferred from natural-language text.

Existing same-host trust limitations remain: trusted code can construct actor contexts, and a process with filesystem/DDL authority can bypass SQLite triggers or read local data. API roles do not provide OS/process isolation. No live Switch authentication or integration capability is claimed.

No Switch installation, configuration, existing agents, prompts, permissions, room assignments or infrastructure was inspected or modified by M2A. No Discord/Switch messages were sent. No Switch/deployed credentials were accessed, created or distributed. Only disposable synthetic service credentials were generated in memory by tests; no raw credential was persisted, logged or returned by an API. No persistent real/demo financial data or real payment was created. Work stops at M2A.
