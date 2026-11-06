# M1B-2B — Backend service identity completion

Status: **COMPLETE**, 2026-11-06, within the approved backend-only scope. Operational provisioning and the optional diagnostic probe are deferred. No M1C or M2 work was started.

## Exact files changed in this task

Created:

- `backend/src/db/service-schema.ts`
- `backend/src/security/service-auth.ts`
- `backend/src/security/identity-route.ts`
- `backend/src/security/test-fixtures.ts`
- `backend/tests/identity.test.ts`
- `backend/tests/log-smoke.ts`
- `backend/tests/mode-smoke.ts`
- `docs/m1b-2b-completion-report.md`

Modified:

- `backend/src/db/migrations.ts`: append version 2 and import its SQL; version 1's name, SQL and version are unchanged.
- `backend/src/app.ts`: register identity read and bearer OpenAPI security scheme.
- `backend/src/api/errors.ts`: preserve safe AuthError codes and unavailable-storage 503.
- `backend/tests/helpers.ts`: automatic disposable-token storage leak scans before/after closing fixture databases.
- `backend/tests/database.test.ts`: retain foundation assertions, update migration counts/fixture versions for version 2.
- `backend/tests/http.test.ts`: retain health/error checks and validate the extended implemented-route specification.
- `backend/openapi.json`: regenerated API artifact.
- `backend/README.md`, `README.md`: current service identity status and safety boundary.
- `docs/milestones.md`: this completed submilestone only; broad M1 remains pending.

No package, lockfile, runtime pin, config/path-safety implementation, server binding or dependency was changed. Existing design documents are retained as historical proposals. Local ignored build/test output was regenerated. Earlier uncommitted project files are not new changes attributable to this task.

## Migration 2 and enforceable schema

The existing ordered/checksummed immediate-transaction runner applies `service_identity` after unchanged version 1. Startup creates empty tables only, never principal or credential seed rows. Test/demo/real mode binding, temporary-path enforcement, FK, WAL and bounded write timeout remain in place.

All four new tables are SQLite STRICT:

| Table | Exact column types | Key constraints |
|---|---|---|
| service_principals | id TEXT NOT NULL PK; label TEXT NOT NULL; created_at INTEGER NOT NULL; disabled_at INTEGER nullable | Nonempty ID/label, unique label; nonnegative creation and disable >= creation |
| service_scopes | project_id TEXT NOT NULL; principal_id TEXT NOT NULL; role TEXT NOT NULL; created_at INTEGER NOT NULL; disabled_at INTEGER nullable | PK(project_id,principal_id); principal FK RESTRICT; five-role CHECK; unique active project/role; timestamp checks |
| service_credentials | id TEXT NOT NULL PK; principal_id TEXT NOT NULL; secret_digest BLOB NOT NULL; created_at/expires_at INTEGER NOT NULL; revoked_at INTEGER nullable | 22-character selector; principal FK RESTRICT; unique 32-byte digest; expiry > creation; revoke >= creation; one unrevoked credential per principal |
| service_auth_events | id INTEGER PK; action/actor_category/principal_id/outcome TEXT NOT NULL; credential_id/project_id TEXT nullable; occurred_at INTEGER NOT NULL | Action CHECK; actor category fixed test_fixture; success outcome; principal/credential FKs; nonnegative time; append-only triggers |

Identity timestamps are integer UTC epoch milliseconds, explicitly chosen here instead of unspecified text dates in the proposal. Project IDs are authorization namespaces, not a financial Project entity. A future financial Project migration must validate/backfill those scopes and add its relational binding.

Triggers prohibit principal ID/label/creation changes, scope project/principal/role/creation changes, credential identity/ownership/digest/creation/expiry changes, deletion of principals/scopes/credentials, and update/deletion of security events. Principal disable and credential revoke are terminal. Database immutability protects API correctness, not against filesystem/DDL authority.

### Scope replacement and reactivation

Disabling a scope retains its immutable row and releases the unique active project/role slot. Another principal may occupy that role through trusted fixture setup. Reactivation is explicit, audited and fails atomically if the slot is occupied; no automatic takeover. The old scope cannot change roles even while disabled. A principal cannot obtain a different role for the same project by updating/replacing its scope; use another independently identified principal if a different assignment is needed. No public scope-management API exists.

### Safe provisioning boundary

There is no operational provisioning CLI or endpoint. The test-fixture module requires NODE_ENV=test, test-bound migration metadata and a database path accepted by the existing OS-temporary test path guard. Demo/real persistent credential issuance is unavailable. Tests create synthetic principals only; no names/records are mapped to live Switch agents.

Lifecycle functions create audited disposable fixture principals/scopes, issue, rotate, revoke, disable scopes/principals and explicitly reactivate scopes. They use immediate transactions. Audit events are committed with each successful change and contain public identifiers only.

TTL defaults to 24 hours and is bounded to positive safe-integer milliseconds <=24 hours. Expired but unrevoked credentials still occupy the current slot: ordinary issuance rejects them and explicit rotation revokes them before insertion. Revoked credentials never reactivate. Rotation revocation/insertion/security event are atomic; failure restores the previous credential state. No automatic expiry extension or overlap period exists.

Secure operator-to-host delivery remains unverified. Therefore no persistent operational credentials were issued. Future production provisioning needs separately reviewed delivery and actor-category support; migrations/startup do not supply it.

## Authentication and authorization

Generation uses independent Node crypto randomBytes calls: 16-byte selector and 32-byte secret, canonical base64url, versioned opaque bearer format. Raw material is returned only to trusted in-memory test callers. The database stores a domain-separated SHA-256 digest over the canonical full token. This is a high-entropy machine-token construction, not human-password hashing. Comparisons use timingSafeEqual, including a dummy digest comparison for unknown selectors.

Authentication accepts exactly one bounded Authorization bearer header and rejects malformed/noncanonical values, missing headers, duplicate raw headers, unknown selectors, incorrect secrets, revoked/expired credentials and disabled principals with generic 401. Database failure gives safe 503. No token is accepted from cookies, query strings, bodies, agent IDs or forwarded identity claims; no success cache is used.

The service context is frozen, server-derived and kept in a route-local WeakMap keyed by the server request. Caller data cannot overwrite it. Identity query/body overrides are rejected; arbitrary identity headers confer nothing. Project scope is read from the database; inaccessible scope returns 404. Shared guards enforce exact role (403), trusted task project/assignee (404/403), current pending attempt (409) and unconditional owner denial for service principals (403). Coordinator is not Treasury and receives no settlement capability. No financial endpoint exists for either role.

The synchronous authorizedWrite helper reacquires authentication/scope/role inside BEGIN IMMEDIATE before invoking trusted mutation code. Future task mutations must load their task and enforce assignment inside that callback. Async callbacks are rejected and synchronous changes rolled back. This helper is not a public task mutation API.

Revocation ordering is serialized: an already-authorized write holding the lock may finish before revocation; operations starting authorization after revocation commits fail. This does not cancel completed operations or promise immediate abort of every in-flight read.

## Endpoint and OpenAPI

`GET /health` is unchanged. The added route is:

`GET /v1/projects/:projectId/service-identity`

It returns only `{principalId,kind:"service",projectId,role}` after bearer authentication and active scope lookup. It accepts no body/query fields, uses strict project-path validation, sends Cache-Control:no-store and preserves the common error envelope. OpenAPI documents the bearer scheme, strict request/success schemas and 400/401/403/404/503 errors. No raw token, secret, digest, credential ID or list of other scopes is returned.

The diagnostic probe was deferred in every mode. Tests inspect actual test/demo/real application schemas and requests: exactly health and identity routes exist, probe POST is 404, unauthenticated identity is 401, and startup leaves principals/credentials empty. No fake payment, settlement, owner-success or task-result endpoint was added.

## Executed verification

Used existing Node 22.22.3/npm 10.9.8 and existing dependencies. Commands actually executed from the repository root:

```sh
export PATH=/Users/varunchauhan/.nvm/versions/node/v22.22.3/bin:$PATH
npm run typecheck
npm run build
npm run openapi
npm test
```

Final results: **typecheck PASS; build PASS; OpenAPI generation PASS; 38 tests PASS, 0 failed, 0 skipped.** No new installation/dependency was needed.

The original 22 foundation cases remain, with expected schema/route counts advanced to version 2. Sixteen additional identity cases cover:

- All five synthetic role identities, frozen contexts, identity-field/header spoofing and cross-project denial.
- Invalid/missing/malformed/unknown/wrong-secret/duplicate credentials and generic errors.
- Actual expiry, explicit expired-token rotation, revocation and no-overlap replacement.
- Injected rotation failure rolling back token insertion, revocation and security event.
- Disabled scopes, occupied-slot reactivation conflict, explicit reactivation and disabled-principal persistence after reopening.
- SQL constraints, immutable ownership/roles and append-only events.
- Wrong role, isolated same-role wrong assignee, wrong task project and stale/completed task attempts; every service role denied owner decisions.
- Authorization recheck after second-connection committed revoke/scope disable; overlapping revoke cannot interleave inside an authorized write; post-revoke writes fail.
- Async callback rejection with rollback.
- Automatic fixture scans of database and available WAL/SHM files before/after close for full tokens, secret text and decoded secret bytes; events and captured error bodies scanned explicitly.
- Isolated child-process successful/denied/revoked requests produce no stdout/stderr. No raw material is emitted by fixture creation.
- Safe storage-failure 503, blocked operational issuance and route/OpenAPI validation in all three modes.
- Actual migration-1-only database upgrade to version 2, preserved version-1 history and repeat validation.

Initial checks found a legacy migration corruption test updating two rows to one primary key, and process-stream interception capturing node:test's own reporting frames. The former now targets one row; the latter was replaced by isolated child-process capture. These test-harness failures are resolved; final output was inspected.

Probe-result replay/idempotent mutation tests are **deferred**, because no probe/task-result endpoint or result persistence is implemented. Completed/stale task-state rejection is directly tested, not represented as end-to-end task replay coverage. Actual human owner authentication/success is outside scope; only service denial is established.

## Security limitations and next gates

Separate backend credentials do not provide OS/process isolation or identify which model holds a bearer secret. Same-account agents with filesystem/process/DDL authority remain trusted infrastructure. Raw bearer material necessarily exists briefly in memory; JavaScript memory erasure is not guaranteed. HTTPS/rate limiting are required before future non-loopback exposure; loopback binding was preserved.

Operational private credential delivery, live agent ID mapping, actual session HTTP tools, backend network access, reciprocal addressing, main-agent routing and idle/browser-decision continuation all remain unverified. No live Switch authentication or agent isolation is claimed. No unresolved failure remains within the implemented backend/test scope.

No Switch settings, installations, agents, existing credentials or messages were read or modified by this task. Only disposable synthetic test credentials were generated in memory; their raw values were not persisted, logged or returned in HTTP responses. No deployed credential was issued or distributed. No Coordinator, human OAuth, financial domain, payout, payment or settlement functionality was implemented. Work stops after M1B-2B verification.
