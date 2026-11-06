# M1B-2A — Service identity design

Status: proposed, 2026-11-06. Recommendation: **proceed to backend-only implementation after review; block live credential provisioning until a safe host delivery mechanism is verified.** This document implements nothing and creates no credentials.

The Review Gate controls the M0 proposal. Inputs reviewed: Review Gate, M1A inventory, M1B-1 completion report, architecture, API contract, database proposal, milestones and backend runbook. M1B-1 currently supplies only health and migration metadata. M1A did not establish a Coordinator, immutable specialist IDs, session HTTP tools or a safe private credential-injection path. Nothing here upgrades those unknowns to verified capabilities.

## 1. Minimal schema proposal

Append migration version 2 through the existing runner; never edit version 1. All proposed tables are STRICT. No financial Project table, human memberships, balances or task engine are required in this slice.

| Table | Fields and constraints |
|---|---|
| `service_principals` | `id TEXT PRIMARY KEY`, `label TEXT NOT NULL UNIQUE`, `disabled_at TEXT NULL`, `created_at TEXT NOT NULL`. Immutable backend-generated ID; label is administrative metadata, never authentication. |
| `service_scopes` | `project_id TEXT NOT NULL`, `principal_id TEXT NOT NULL REFERENCES service_principals(id) ON DELETE RESTRICT`, `role TEXT NOT NULL`, `disabled_at TEXT NULL`; primary key `(project_id, principal_id)`; unique `(project_id, role)` for this five-role demo; role CHECK limited to coordinator/request/challenge/commitment_intelligence/treasury_ops. |
| `service_credentials` | `id TEXT PRIMARY KEY` (public random lookup selector), `principal_id TEXT NOT NULL REFERENCES service_principals(id) ON DELETE RESTRICT`, `secret_digest BLOB NOT NULL CHECK(length(secret_digest)=32)`, `created_at`, `expires_at`, `revoked_at` (nullable only for revoked_at). Unique digest; partial unique index on principal_id WHERE revoked_at IS NULL gives at most one current credential per principal. |

Use backend-controlled opaque project IDs as authorization namespaces initially. This avoids inventing a financial Project solely for auth. Future Project migration must validate/backfill these namespaces and introduce the real relational FK before accepting financial operations. No public namespace creation, membership editing, role editing or credential administration endpoints. No role named owner is permitted in service scopes. Keep the five independent principals even when all share a project.

Scope rows are provisioned by a local trusted operator, never by the Coordinator. Assign coordinator to the future Coordinator; request to req-agent; challenge to challenge-agent; commitment_intelligence to commitment-intelligence-agent; treasury_ops to treasury-ops-agent. Do not create those database rows or credentials during this design task. An optional later immutable Switch-ID annotation is provenance only, not an authentication factor.

Dates use a single canonical UTC representation, server clock only. CHECK expiry > creation and revocation >= creation. Keep IDs, role assignments and credential ownership immutable; disable/revoke and replace rather than transfer credentials. No credential or scope deletion via service APIs. A minimal operator security-event record (action, actor category, public principal/credential IDs, timestamp, outcome) is needed for provision/rotate/revoke; write it transactionally, without tokens or digests. It may use a small append-only `service_auth_events` table until the general audit system exists. Never imply this is financial audit implementation.

## 2. Credential construction and lifecycle

Use an opaque bearer token with format `rt1.<selector>.<secret>`. Selector is 16 random bytes encoded as canonical base64url; secret is 32 independent cryptographically random bytes encoded as canonical base64url. No actual token example is included. Generate using Node's built-in crypto API, never human passwords or agent-chosen strings.

Persist only SHA-256 over a domain-separated, unambiguous string containing the version, selector and secret. Use `timingSafeEqual` on fixed-size digests. A fast digest is appropriate here only because the secret has 256 bits of uniformly generated entropy; this construction is not suitable for human passwords. No password library, pepper secret, JWT signing key, refresh-token subsystem or public-key infrastructure is needed. Domain/version tagging allows a future algorithm migration without ambiguous interpretation.

Lifecycle, proposed for a separately authorized implementation:

1. Operator creates principal and project scope independently of credential generation. Issuance requires enabled principal plus at least one enabled scope. Default TTL 24 hours; never extend expiry silently.
2. Generate raw material in memory. Deliver exactly once over a verified private operator-to-host channel. Persist digest and public metadata only. Never output raw tokens to ordinary stdout, CLI arguments, room prompts, API logs or a repository file. No public issuance endpoint.
3. If delivery is not available, do not issue. If delivery fails after issuance, revoke it and issue a replacement only after fixing delivery. Do not promise atomicity across SQLite and host secret storage.
4. Rotation uses an immediate transaction to revoke the current credential and insert its replacement plus security event. No overlap/grace period. If insertion fails the entire transaction rolls back. Commit makes the old token invalid on the next check; callers may temporarily fail until replacement delivery completes.
5. Explicit revocation, scope disable or principal disable takes effect on every subsequent authorization check. No positive credential cache. Disabling a principal is the emergency kill switch for all its project access.
6. At expiry, deny authentication; replacement requires operator action. Restart must preserve expiry/revocation. Do not reuse tokens between test/demo/real databases.

Raw credentials necessarily exist briefly in issuer/verifier/client process memory. They must never be persisted by RoomTreasury server code or diagnostics. Avoid claims that JavaScript guarantees secure memory erasure. Client-side secret retention/distribution remains a separate live deployment gate; do not copy or repurpose Switch credentials.

## 3. Authentication and authorization flow

Only `Authorization: Bearer ...` is accepted. Reject duplicate authorization headers, multiple credentials, malformed versions/lengths/encoding and oversized values. Do not accept query/body tokens, cookies, forwarded identity headers, agent names or a supplied principal ID. No CORS enablement or cookie-based service authentication is needed.

1. Parse a bounded canonical token and look up the selector with a parameterized query.
2. Compare digest; for absent selector perform a fixed dummy digest comparison. Check expiry, revocation and principal enabled status. Return the same generic 401 for all credential failures; no selector/account existence detail.
3. Construct a server-owned immutable auth context containing principal ID and credential ID. Route/body parsing cannot replace it. Never merge client JSON into this object.
4. Verify enabled scope for the requested project; inaccessible resources return generic 404 to avoid resource enumeration. Check action capability against a fixed role allowlist; wrong capability within an accessible project returns 403.
5. For task results, load task by project and ID from trusted storage, then require exact assignee principal, permitted task kind, current attempt and pending state. Role alone cannot authorize another agent's task. Recheck auth/scope/assignment within the same immediate transaction as a mutation, including before replaying any saved result.
6. Owner-only guard requires a separately verified human auth context AND active owner membership. A service context always gets 403, regardless of role, label, JSON fields or any future accidental owner membership. Human authentication is not implemented in this slice. No Coordinator-to-owner or Coordinator-to-Treasury delegation exists.

Revocation serializes with writes: a write whose auth check and commit hold the write lock before revocation may complete; writes authorized after revocation commits fail. Do not promise cancellation of work already committed or an instantaneous abort of in-flight requests.

| Role | Minimal allowed service actions | Explicit exclusions |
|---|---|---|
| coordinator | Own identity, scoped context/status reads and future eligible dispatch | Specialist result impersonation, human decisions, settlement |
| request | Own identity and assigned request-proposal result | Owner decisions and settlement |
| challenge | Own identity and assigned advisory-review result | Setting authoritative financial policy, approval and settlement |
| commitment_intelligence | Own identity and assigned evidence result | Human corroboration, confirming commitments, approval and settlement |
| treasury_ops | Own identity and assigned operation result; future guarded simulated-settlement capability only when implemented separately | Human approval, arbitrary payment and changed approval terms |

No financial capability is implemented by this identity slice, including for Treasury. Role names describe future separation, not currently usable payout authority.

## 4. Harmless endpoint contracts

These are proposed RoomTreasury routes, not Switch APIs. Existing GET /health remains unauthenticated and unchanged. Use existing JSON error envelopes and server-generated correlation IDs; add generic `UNAUTHENTICATED` 401 and `FORBIDDEN` 403, without sensitive details. Set authenticated responses `Cache-Control: no-store`.

### GET /v1/projects/:projectId/service-identity

No body/query parameters. Valid credential plus project scope returns 200:

`{principalId, kind: "service", projectId, role}`

All values come from verified database records. No secret, digest, credential selector, expiry or other project scopes are returned. Missing/invalid/revoked/expired credential gives generic 401; unknown or wrong project gives generic 404. Unknown request fields are rejected with 400 after authentication. It is deliberately available to all five roles, so this endpoint alone does not prove wrong-role or task enforcement.

### Optional POST /v1/projects/:projectId/service-auth-probes/:probeId/result

Implement only in explicit test/demo mode, never real; absent route returns 404 in real. This harmless diagnostic has no financial effect and no arbitrary task execution. It requires an idempotency key and strict body `{attempt: positive integer, outcome: "acknowledged"}`. Reject principalId, role, owner flags, project override and other fields. Return 200 `{probeId, accepted: true}` with exactly one stored result.

If adopted, add only one nonfinancial table `service_auth_probes`: composite key `(project_id,id)`, FK `(project_id,assignee_id)` to service_scopes, action enum (one result action per role plus `human_owner_decision`), positive attempt, pending/completed state, result digest and idempotency metadata. Operator/test fixture chooses action/assignee; callers cannot create or reassign probes. Result acceptance checks action-to-role plus exact assignee. Same key/body/attempt replays after authorization; changed body/key reuse or stale attempt gives 409. A completed probe cannot gain another result with a new key.

The `human_owner_decision` probe is deny-only for service auth and cannot accept any successful mutation in this slice. It is a test of the shared owner guard, not a financial approval endpoint or human authentication substitute. Unit tests also exercise the guard directly with every service role. Wrong-role cases use an accessible project and a probe action for another role; wrong-assignee cases use two synthetic principals with the same role in different fixture arrangements (or direct guard fixtures), so a role denial cannot conceal an untested assignment check. The production five-role uniqueness constraint remains intact.

Prefer implementing the identity endpoint and shared guards first. The probe route is useful for later authorized live tests but must remain explicitly diagnostic. Without it, exercise role/task/owner guards in executable unit tests using trusted in-memory fixtures; do not claim task integration is tested merely by unit tests.

## 5. Threat model and trust boundary

Protect against guessed/replayed invalid tokens, expired/revoked tokens, JSON identity spoofing, horizontal project access, role confusion, task-assignee substitution and agents claiming owner permission. Bearer tokens are replayable by anyone who obtains them; HTTPS is mandatory for any non-loopback transport. Retain the existing loopback bind until remote transport is reviewed. Do not forward authorization headers across redirects. Rate-limit authentication attempts before exposing remotely; remote deployment is not approved here.

Separate credentials provide independent backend capability control and revocation. They do not isolate local processes sharing an OS account, protect the database from its filesystem owner or prove which model/process possesses a token. Malicious same-host agents could read sibling files/process state or alter SQLite if allowed. Prompts and file mode 0600 are not OS-user isolation. Keep human sessions/credentials out of agent contexts. Production hostile-agent isolation needs separate OS identities/sandboxes and a protected database service.

Existing logging is disabled; keep it so. Never log authorization headers, entire requests, token parse errors, digests, secret-bearing exceptions or provisioning output. If operational logs are added, allowlist correlation ID, public principal ID, action and outcome only. Security event storage must never contain request bodies. Database unavailable means a safe 503 and no authenticated context, never fail-open access.

## 6. Executable tests and acceptance criteria

Use current node:test, Fastify injection and real temporary SQLite databases under M1B-1 path guards. Generate disposable test secrets in memory only; do not print them in assertions. Every persisted test database and log capture must be scanned for those exact secret/full-token sentinel values before cleanup.

| Test | Required evidence |
|---|---|
| Correct credential | Each of five synthetic service identities returns its own ID/role for allowed project; fixture labels differ from IDs |
| Invalid input | Missing, random, malformed, unknown selector, wrong secret, duplicate header and expired token all produce generic 401; no principal attached |
| Revocation/disable | Credential revoke, principal disable and scope disable deny subsequent requests; reopening DB preserves decisions |
| Rotation | Old token rejected immediately after commit, replacement accepted; injected rotation failure leaves old credential valid and no partial replacement |
| Identity spoof | Valid token plus body/query/header principal/role overrides cannot change auth context; strict payload validation rejects unknown fields |
| Cross-project | Project A token cannot read/write B even with known probe IDs or forged project JSON; no scope metadata disclosed |
| Wrong role | Authenticated, project-scoped principal denied a disallowed action with 403 |
| Wrong assignee | Direct guard tests isolate same-role wrong-assignee denial; optional probe tests prove trusted task lookup and assignment are enforced |
| Owner boundary | All five roles denied owner-only guard and deny-only owner probe; forged owner flags and administrative labels confer nothing |
| Replay/stale task | One accepted probe result; duplicate is idempotent; changed replay conflicts; old attempt and reassignment invalidate late results |
| Transaction race | A committed revocation/scope change is observed before a new result mutation; repeat auth checks share the mutation transaction |
| Secret absence | Logs/errors/events/DB contain neither full tokens nor raw secret values; DB contains expected 32-byte digest only |
| Storage and migrations | Fresh/repeat migration, FK/unique constraints, unsupported role, changed history and failure rollback checked; test/demo/real isolation preserved |
| Existing behavior | All 22 foundation tests remain passing; generated OpenAPI documents only actually registered routes; probe absent in real |

Acceptance requires actual typecheck/build/test execution and inspected output during implementation. No tests were executed for this design. Human owner success remains untestable until separate human auth work; this slice proves service denial only.

## 7. Dependencies and implementation sequence

**No new dependencies.** Use Node 22.22.3 built-ins `node:crypto` (randomBytes, createHash, timingSafeEqual), existing Fastify 5.12.8, AJV 8.20.0, better-sqlite3 13.0.3 and node:test. Existing Swagger generation/validation covers the new route contract. No password hashing library is required for machine-generated 256-bit secrets; human-password authentication is excluded.

After review: add migration 2 plus schema constraints; implement credential verifier and typed server-owned auth context; add project/role/assignee/human guards; register identity endpoint; optionally add mode-gated probes; extend tests and OpenAPI. Operator provisioning design must avoid ordinary stdout and shared secrets before enabling issuance. Backend tests can mint only temporary in-memory fixtures. Do not add live principal records or issue deployed credentials as a side effect of migrations or server startup.

## 8. Remaining live Switch gates

M1A unknowns remain: Coordinator existence/identity/host, effective main-agent routing, immutable specialist mappings, actual existing-session tools, backend network access and permission/approval behavior. Internal Switch HTTP code does not prove arbitrary service HTTP is exposed to an agent.

Before provisioning, verify a private per-agent host secret mechanism, whether sibling agents can read it, an authenticated HTTP client that does not echo secrets or require command-line tokens, actual host-to-backend routing, and safe credential rotation/revocation delivery. Never inspect/copy Switch token stores to solve these gaps. Later authorized tests must prove each existing specialist directly authenticates its own result and sends a correlated return notification; idle Coordinator/browser-decision continuation still needs separate evidence.

**Recommendation: proceed to backend-only implementation of this design after review. Block deployed credential issuance/distribution and claims of live agent authentication until the safe provisioning and session HTTP dependencies are resolved.** Same-host isolation remains an explicitly accepted demo limitation, not a solved security feature.

Only this document was created. Application code, packages, migrations, existing documents, Switch settings/infrastructure and credentials were not modified. No Coordinator was created, no credentials issued and no messages sent.
