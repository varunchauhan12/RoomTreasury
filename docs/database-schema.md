# Database schema proposal

Status: design only; no migration has been applied. Names below are proposed RoomTreasury tables. All IDs are server-generated opaque text IDs; timestamps are UTC. Foreign keys are enabled on every connection. All project-scoped references use composite foreign keys `(project_id, id)` or equivalent guarded relational constraints to prevent cross-project associations.

## Tables

| Entity/table | Core fields | Required constraints / purpose |
|---|---|---|
| Project / `projects` | id, name, currency, budget_cents, financial_version, policy_version, created_at | USD for Lite; immutable seeded budget; nonnegative bounded integer budget; increment version on financial changes |
| Principal / `principals` | id, kind (`human`/`agent`/`system`), provider, external_id, disabled_at | Unique `(provider, external_id)`; human IDs come from verified auth, agent IDs from service credentials |
| ProjectMember / `project_members` | project_id, principal_id, role (`owner`/`teammate`/`producer`), active | Unique project/principal; owner transitions require active human membership; operator provisions owner |
| AgentCapability / `agent_capabilities` | project_id, principal_id, specialist_role, credential_hash, disabled_at | Least-privilege API scope; no human-owner capability; hashed credentials, never source-control raw keys |
| Recipient / `recipients` | id, project_id, version, display_name, simulated_destination, created_at | Immutable versioned records; revision references exact version; no real bank details required |
| Request / `requests` | id, project_id, producer_id, current_revision_id, status, created_at | Stable aggregate joining revisions; current revision must belong to this request; one settled payment per request |
| RequestRevision / `request_revisions` | id, project_id, request_id, revision_number, predecessor_id, recipient_id, amount_cents, currency, purpose, terms_digest, created_by, created_at | Unique `(request_id, revision_number)`; immutable business terms; positive bounded integer amount; exact recipient version |
| RevisionState / `revision_states` | revision_id, state, state_version, updated_at | Mutable guarded projection; states `submitted`, `reviewing`, `waiting_human`, `rejected`, `awaiting_owner`, `approved`, `settled`, `superseded`, `cancelled`; events preserve history |
| SourceReference / `source_references` | id, project_id, platform, room_id, message_id, external_message_id, author_external_id, observed_at, content_digest, excerpt, source_kind | Unique source identity plus observed digest; preserve edits as new observations; distinguish verified transport capture from agent-supplied evidence; never treat a copied author field as authentication |
| RevisionSource / `revision_sources` | project_id, revision_id, source_id | Unique pair; same-project FKs; retain original and revision source references |
| Commitment / `commitments` | id, project_id, current_version, state, created_at | States `suspected`, `corroborated`, `confirmed`, `dismissed`; only confirmed reserves budget; same obligation cannot be re-created on retry |
| CommitmentVersion / `commitment_versions` | id, project_id, commitment_id, version, amount_cents, currency, purpose, recipient_id?, terms_digest, created_by | Immutable; unique commitment/version; edits to confirmed obligations excluded from Lite (future explicit adjustment flow) |
| CommitmentEvidence / `commitment_evidence` | project_id, commitment_version_id, source_id, submitted_by | Unique evidence association; deduplicated discovery key per source/obligation; separate promises sharing a message require distinct explicit evidence keys |
| Corroboration / `corroborations` | id, project_id, commitment_version_id, human_id, decision, source_id?, created_at | Active human project member; teammate corroboration never changes ledger |
| PolicyEvaluation / `policy_evaluations` | id, project_id, revision_id, policy_version, financial_version, evidence_version, stage, outcome, reason_codes_json, available_cents, created_at | Append-only snapshot; backend calculated result; separate from advisory agent explanation |
| EvidenceClearance / `evidence_clearances` | id, workflow_run_id, revision_id, context_version, evidence_version, status, coverage_json, created_at | Records investigated scope, incomplete history and unresolved obligations; only valid current clearance permits approval/settlement |
| Approval / `approvals` | id, project_id, kind, revision_id?, commitment_version_id?, target_digest, policy_version, approved_by, auth_event_id, created_at, revoked_at, consumed_at | Exactly one target by kind; authenticated human owner only; unique effective approval per target; preserved after revocation/consumption |
| Reservation / `reservations` | id, project_id, revision_id, approval_id, amount_cents, state, created_at, released_at, consumed_at | States `active`, `released`, `consumed`; at most one active hold per request; hold amount must equal approved revision; unique approval/hold |
| LedgerEntry / `ledger_entries` | id, project_id, kind, amount_cents, commitment_version_id?, reservation_id?, receipt_id?, operation_id, created_at | Append-only; positive amounts with explicit kind/direction; unique business operation and kind; FK/trigger guards on reference/kind combinations |
| Receipt / `receipts` | id, project_id, request_id, revision_id, approval_id, reservation_id, recipient_id, amount_cents, currency, settlement_mode, created_at | Unique request, revision and reservation; mode fixed `simulated`; immutable terms copied from approved revision; no externally supplied amount |
| WorkflowRun / `workflow_runs` | id, project_id, request_id, active_revision_id, state, context_version, evidence_version, created_at, updated_at | Stable request workflow; revision-specific task graph; new revision cancels stale tasks and creates new graph |
| Task / `tasks` | id, project_id, workflow_run_id, revision_id?, commitment_version_id?, kind, assignee_id, state, input_json, output_json?, context_version, state_version | Immutable versioned input; typed output validated by backend; transition CAS; caller cannot choose an arbitrary next state |
| TaskDependency / `task_dependencies` | project_id, workflow_run_id, task_id, depends_on_id | Unique edge; no self edge; same-run constraint; cycle detection on graph creation/update |
| TaskAttempt / `task_attempts` | id, task_id, attempt_number, lease_token_hash, leased_until, started_at, finished_at, outcome, output_json? | Unique task/attempt; fencing tokens reject expired worker outputs; preserve failed/stale attempts |
| WorkflowEvent / `workflow_events` | id, run_id, task_id?, sequence, event_type, actor_id, details_json, created_at | Append-only ordered event history; unique run/sequence |
| AuditEvent / `audit_events` | id, project_id, sequence, actor_id, action, entity_type, entity_id, before_json?, after_json?, operation_id, created_at | Append-only; includes authentication reference and transition reasons; redact tokens; financial success event in same transaction as effect |
| IdempotencyRecord / `idempotency_records` | principal_id, operation, key, request_digest, response_status, response_json, created_at | Unique principal/operation/key; same key/different body is conflict; persist response atomically with mutation |
| DecisionNonce / `decision_nonces` | nonce_hash, owner_id, project_id, target_id, target_digest, expires_at, consumed_at | One-use, short-lived, exact target; nonce alone confers no authorization |
| Outbox / `outbox` | id, project_id, run_id, task_id?, kind, dedupe_key, payload_json, state, attempt_count, available_at, lease_until, delivery_event_id? | Unique dedupe key; durable task dispatch and outcome notifications; acknowledge separately from financial effect |
| InboundEvent / `inbound_events` | id, project_id, provider, room_id, event_id, payload_digest, workflow_run_id?, received_at | Unique provider/room/event; external request deduplication; signed/trusted adapter ingestion only |

Authentication session and OAuth state storage also lives server-side, separately from financial tables with short TTLs. Store secrets/keys outside SQLite financial payloads where possible; never store bearer tokens in audit/output JSON.

## Constraints and derived balances

SQLite schema uses `STRICT` tables where supported by the chosen driver and `CHECK(typeof(amount_cents) = 'integer' AND amount_cents > 0 AND amount_cents <= product_cap)` on every amount. Define one product cap in validation/migrations and prevent aggregate overflow. Use restrictive deletes, no cascading deletion of financial history. Triggers deny updates/deletes of immutable terms, ledger, receipt and audit rows. Lifecycle metadata transitions are guarded by service transactions and recorded as events.

Ledger kinds in Lite:

| Kind | Committed delta | Reserved delta | Spent delta | Unique business reference |
|---|---:|---:|---:|---|
| `commitment_confirmed` | +amount | 0 | 0 | commitment version |
| `reservation_created` | 0 | +amount | 0 | reservation |
| `reservation_released` | 0 | -amount | 0 | reservation |
| `reservation_consumed` | 0 | -amount | 0 | reservation |
| `simulated_spend` | 0 | 0 | +amount | receipt/request |

Amounts are unsigned; deltas come from the kind. A reservation has exactly one terminal ledger transition, either release or consume, enforced by a unique terminal-operation reference and guarded state transition. Spending a confirmed commitment directly is outside Lite; do not settle it as a new unrelated request and double-count the same obligation.

Project budget minus ledger-derived committed/reserved/spent must remain nonnegative after every transaction. No cross-row SQLite CHECK can guarantee this alone: every budget-changing path uses `BEGIN IMMEDIATE` on the same authoritative database, computes current balances after acquiring the write lock, validates, appends entries, changes projections, increments financial version, writes audit/idempotency rows, and commits. Race tests exercise multiple connections. Reconciliation compares projections and ledger; discrepancy blocks settlement. Never read a balance outside the transaction and later reserve using it.

## Transaction protocols

**Confirm commitment:** authenticate active human owner; validate nonce, exact version/digest and corroboration/evidence resolution; acquire write transaction; re-check owner and current target; require amount <= available; insert commitment approval, confirmation ledger entry and audit; transition state; increment financial/context/evidence versions and invalidate stale evaluations; store idempotent response; commit. Duplicate confirmation returns the original result. Owner dismissal records a reason and audit without a budget change. Maya's corroboration writes no ledger entry.

**Approve request and reserve:** acquire write transaction; re-check active human owner, nonce, current unsettled request revision/recipient digest, policy version, complete evidence clearance and no unresolved promises; rerun deterministic policy and calculate available; if eligible, insert approval, active hold, reservation ledger entry, state/audit/outbox/idempotency updates together. Failure leaves no approval/hold. Failed evaluation may be preserved in a separate completed transaction. Approval consumes the decision nonce only on successful decision processing.

**Revise/cancel/revoke:** authorized producer (their own request) or owner as appropriate; acquire write lock; reject settled requests; validate expected current revision; preserve old terms; revoke unused approval, release active reservation exactly once, append ledger/audit events; update current revision and workflow context; cancel obsolete tasks and invalidate clearance. New request terms require fresh review and approval. Cancellation/revocation and settlement racing against one another serialize; exactly one valid outcome wins.

**Simulated settlement:** authenticate Treasury Ops capability; acquire write lock; first look up receipt for this request/revision. If an identical completed settlement exists, return its receipt even for a new idempotency key. Otherwise require current revision, valid unrevoked exact approval, active equal-sized reservation, current owner authorization, current policy/evidence clearance, and reconciled ledger. Any policy/evidence change requires renewed clearance; fail closed while retaining the hold. Consume hold and approval, insert paired reservation-consumed/spend entries, receipt, audit and notification outbox in the same transaction. Commit once. No network call within this transaction. Crash before commit rolls everything back; crash after commit returns the same receipt on retry.

Changing a target/amount on a retry conflicts; it never changes an existing receipt. HTTP timeout is not evidence that settlement failed. Business uniqueness on request/revision prevents a second spend independently of the caller's idempotency key.

## Demo checkpoints (USD cents)

| Checkpoint | Budget | Committed | Reserved | Spent | Available |
|---|---:|---:|---:|---:|---:|
| Seed / preliminary $70 pass | 10000 | 0 | 0 | 0 | 10000 |
| Suspected $40 / Maya corroborates | 10000 | 0 | 0 | 0 | 10000 |
| Owner confirms $40 | 10000 | 4000 | 0 | 0 | 6000 |
| $70 revision rejected (1000 short) | 10000 | 4000 | 0 | 0 | 6000 |
| New $55 revision reviewed | 10000 | 4000 | 0 | 0 | 6000 |
| Owner approves $55, holds funds | 10000 | 4000 | 5500 | 0 | 500 |
| Simulated $55 settlement | 10000 | 4000 | 0 | 5500 | 500 |
| Settlement retry | 10000 | 4000 | 0 | 5500 | 500 |

No real database is seeded by default. Demo and real modes use separate explicit paths, and demo fixtures contain synthetic identities. A demo reset may target only the validated demo path, never a caller-supplied arbitrary database path.
