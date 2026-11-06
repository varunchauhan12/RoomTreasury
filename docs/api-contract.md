# RoomTreasury API contract proposal

Status: application-owned design, not implemented; these routes are **not Switch routes**. Prefix `/v1`. JSON, strict schemas, unknown fields rejected, UTC timestamps and integer cents. Publish machine-readable OpenAPI in milestone 1 after review.

## Authentication and common rules

- Human endpoints use server sessions from verified Discord OAuth identity; state, secure HttpOnly cookies, same-origin CSRF protection and one-use bound decision nonces. Operator provisions project roles. Browser mutation requires CSRF even when an idempotency key is supplied.
- Agent endpoints use per-agent hashed service credentials scoped by project and role. Agent principals cannot call owner endpoints or impersonate a human by adding an actor ID. Agents never receive owner session credentials.
- Producer authorizes initial request/revision through an authenticated action or a verified adapter capturing the real inbound Discord sender. Coordinator-supplied text alone is a proposal; it cannot assert a human command. Verify the ingress identity contract in the integration gate before enabling room-originated mutations.
- All mutations require `Idempotency-Key`; same principal/operation/key/body replays stored status/body, different body returns `409 IDEMPOTENCY_CONFLICT`. Inbound provider event IDs supply a second deduplication boundary. Business uniqueness applies across different keys.
- Version-sensitive mutations include `expectedVersion` or `expectedContextVersion`. Backend never accepts `isOwner`, `approvedBy`, balance, ledger deltas, arbitrary task transitions or settlement amount from an agent.
- `201` new resource, `200` read/transition/replay, `202` accepted asynchronous work. Error body: `{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "...", "details": {}, "correlationId": "..." } }`.
- Errors: `400` malformed input; `401` unauthenticated; `403` insufficient capability/role; `404` absent or inaccessible project resource; `409` stale version/state, unresolved evidence, insufficient budget or idempotency mismatch; `422` policy/domain validation failure; `503` temporary integration/database busy after bounded retries. Return stable machine codes alongside human explanation.
- Never return secrets or raw auth tokens in responses/history. Project membership and project scope enforced on every ID lookup.

## Human and ingress endpoints

| Method and route | Principal | Input → result |
|---|---|---|
| `GET /auth/discord/start` / `GET /auth/discord/callback` | Human login | OAuth state/code validation → server session; no project-role assignment |
| `GET /me` | Human | Verified identity and active memberships |
| `GET /projects/:projectId` | Member / scoped agent | Project and ledger-derived balances, financial/policy versions |
| `GET /projects/:projectId/requests/:requestId` | Member / scoped agent | Current revision, immutable history, evaluations, approval/hold/receipt |
| `POST /projects/:projectId/requests` | Producer / trusted ingress | `{recipientId, amountCents, currency, purpose, sourceReferenceIds}` → request, revision, workflow IDs |
| `POST /projects/:projectId/requests/:requestId/revisions` | Original producer / owner / trusted ingress acting for verified producer | `{expectedVersion, recipientId, amountCents, currency, purpose, sourceReferenceIds}` → new immutable revision; old hold released atomically |
| `POST /projects/:projectId/requests/:requestId/cancel` | Original producer / owner | `{expectedVersion, reason}` → cancelled state, released hold if any |
| `POST /projects/:projectId/commitments/:id/corroborations` | Active human teammate/producer/owner | `{commitmentVersionId, expectedVersion, decision, sourceReferenceIds}` → corroboration only |
| `POST /projects/:projectId/decision-nonces` | Owner | `{targetType, targetId, targetDigest}` → short-lived nonce for authenticated exact-target review |
| `POST /projects/:projectId/commitments/:id/confirm` | Owner only | `{commitmentVersionId, expectedVersion, targetDigest, decisionNonce}` → confirmed commitment and balances |
| `POST /projects/:projectId/commitments/:id/dismiss` | Owner only | Same exact-version fields plus reason → dismissed suspected commitment, audit |
| `POST /projects/:projectId/revisions/:revisionId/approve` | Owner only | `{expectedVersion, targetDigest, policyVersion, decisionNonce}` → approval and reservation created atomically |
| `POST /projects/:projectId/approvals/:id/revoke` | Owner only | `{expectedVersion, reason}` → revoked unused approval and released hold; settled receipts immutable |
| `GET /projects/:projectId/receipts/:receiptId` | Member / scoped agent | Immutable simulated receipt |
| `GET /projects/:projectId/audit?after=...&limit=...` | Owner / scoped read capability | Cursor-paginated audit history |
| `POST /integrations/switch/events` | Trusted verified adapter only | Verified event envelope, immutable sender identity and room mapping → deduplicated workflow intake; disabled until actual Switch ingress contract is verified |

The ingress route is a proposed internal boundary, not a claim that Switch supplies a webhook. Prefer the existing agent session adapter if it can authenticate event provenance; otherwise retain proposals until a human authenticates. Any signed envelope protocol must be defined and tested as RoomTreasury-owned code. Do not trust a public request body declaring a Discord sender ID.

Owner decision page is a server-rendered route outside `/v1`, e.g. `/decisions/:targetType/:targetId`. It shows exact terms and source evidence after login. A copied link cannot grant authority. Login callback returns only to allowlisted same-origin paths.

## Specialist and workflow endpoints

| Method and route | Agent capability | Input → result |
|---|---|---|
| `POST /projects/:projectId/request-proposals` | Request Agent | Structured terms plus source IDs/context version → proposal; verified producer authorization needed before materializing revision |
| `POST /projects/:projectId/commitments` | Commitment Intelligence | Possible obligation, immutable versioned terms, evidence and dedupe key → suspected commitment only |
| `POST /projects/:projectId/sources` | Scoped specialist / verified adapter | Source identity, observed digest, excerpt and capture provenance → append-only observation; agent input cannot mark itself verified |
| `POST /projects/:projectId/revisions/:revisionId/evaluate` | Challenge / Coordinator | `{expectedContextVersion}` → backend policy result and snapshot; advisory text is separate task output |
| `GET /projects/:projectId/workflows/:runId/context` | Assigned project-scoped agents | Typed current request/commitment/evidence/balance/task snapshot and context version |
| `GET /projects/:projectId/workflows/:runId` | Member / scoped agent | State, dependencies, task attempts and cursor-paginated events |
| `GET /projects/:projectId/tasks?state=ready&after=...` | Assigned specialist / Coordinator | Eligible tasks filtered by credential scope; no caller-selected assignee spoofing |
| `POST /projects/:projectId/tasks/:taskId/claim` | Assigned specialist | `{expectedVersion}` → lease token, attempt number, expiry and immutable input |
| `POST /projects/:projectId/tasks/:taskId/results` | Current leased assignee | `{leaseToken, attempt, expectedContextVersion, revisionId, output}` → validated result and backend-selected next state/tasks |
| `POST /projects/:projectId/tasks/:taskId/fail` | Current leased assignee | `{leaseToken, attempt, code, retryable, details}` → attempt failure; backend chooses bounded retry/blocking behavior |
| `GET /projects/:projectId/outbox?state=pending` | Coordinator | Dispatch/post intentions with task IDs and dedupe keys |
| `POST /projects/:projectId/outbox/:id/claim` | Coordinator | `{expectedVersion}` → delivery lease/token |
| `POST /projects/:projectId/outbox/:id/ack` | Leased Coordinator | `{leaseToken, eventId, targetStatuses}` → persisted dispatch evidence; refusal/disconnection never marks a task succeeded |
| `POST /projects/:projectId/outbox/:id/fail` | Leased Coordinator | `{leaseToken, code, ambiguousDelivery}` → bounded retry or visible blocked delivery |
| `POST /projects/:projectId/revisions/:revisionId/settle` | Treasury Ops only | `{approvalId, expectedVersion}` → backend-derived simulated receipt and current balances |

Source capture/attachment APIs accept verified adapter observations or explicitly marked agent-provided evidence. Only authenticated human decision endpoints create corroboration/owner decisions. Workflow graph creation and state advancement are backend services, not general agent CRUD endpoints.

Typed result families: `RequestProposal.v1`, `PolicyReview.v1`, `CommitmentInvestigation.v1`, `SettlementOutcome.v1`. Each includes evidence references and uncertainty. Context completion requires a server-validated investigation result; an arbitrary `clear=true` field is not accepted as clearance.

## Example success and rejection

Owner approves the $55 revision:

```json
{
  "approvalId": "approval_edit_2",
  "revisionId": "revision_edit_2",
  "reservationId": "reservation_edit_2",
  "balances": {"budgetCents": 10000, "committedCents": 4000, "reservedCents": 5500, "spentCents": 0, "availableCents": 500},
  "financialVersion": 3
}
```

The previous $70 revision fails after commitment confirmation:

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Requested $70.00; $60.00 available. Reduce by at least $10.00.",
    "details": {"revisionId": "revision_edit_1", "amountCents": 7000, "availableCents": 6000, "shortfallCents": 1000},
    "correlationId": "correlation_demo"
  }
}
```

Settlement returns `{receipt: {id, requestId, revisionId, approvalId, recipientId, amountCents: 5500, currency: "USD", settlementMode: "simulated", settledAt}, balances}`. Retrying with the same or a different idempotency key returns the same receipt identity/timestamp; the current balance snapshot may reflect later independent operations. No duplicate ledger spend or second receipt is allowed.
