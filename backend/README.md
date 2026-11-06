# RoomTreasury backend foundation

M1B-2B adds backend service identity to the HTTP/SQLite foundation. Only disposable test credentials can be issued; operational provisioning is blocked. There are no financial tables, human OAuth, live service records, Discord/Switch calls, seed data or workflow orchestration.

## Runtime and commands

Run from the repository root with the installed Node 22.22.3 / npm 10.9.8. `.nvmrc`, exact package engines and `.npmrc` enforce the selected toolchain; the default Node 20 shell must switch first.

```sh
nvm use
npm ci --no-fund
npm run typecheck
npm run build
npm run openapi
npm test
```

`npm test` compiles TypeScript tests and runs Node's built-in test runner with `NODE_ENV=test`. No watch service, transpiler daemon, ORM or workspace setup is required.

To explicitly create a **demo-mode foundation database** and run locally:

```sh
ROOMTREASURY_MODE=demo ROOMTREASURY_DB_PATH=./var/demo/roomtreasury.sqlite npm run migrate
ROOMTREASURY_MODE=demo ROOMTREASURY_DB_PATH=./var/demo/roomtreasury.sqlite npm start
curl --fail http://127.0.0.1:3000/health
```

These are usage instructions; implementation verification used temporary storage instead of creating this persistent demo database. Stop with Ctrl-C. Startup applies pending migrations before opening the listening socket. SIGINT/SIGTERM closes the HTTP server and database.

The application reads exported environment values, not `.env` files automatically. `.env.example` has placeholders only and cannot be used without filling valid values. No credentials are needed.

## Small application structure

- `src/config.ts`: AJV-validated mode, explicit database path, loopback host and port.
- `src/db/connection.ts`: path safety, SQLite open, enforced foreign keys, 1000ms busy timeout, migrations and verified WAL.
- `src/db/migrations.ts`: ordered SQL migrations and transactional migration history. Version 1 is unchanged; version 2 adds service identity tables and constraints.
- `src/db/migrate.ts`: migration CLI with safe errors and nonzero failure exit.
- `src/app.ts`: Fastify factory, strict route schemas and generated OpenAPI; app close owns database close.
- `src/api/errors.ts`: consistent error envelope; no raw exceptions or request input in responses.
- `src/server.ts`: startup/shutdown lifecycle; CLI errors are generic and contain no environment dumps.
- `src/api/export-openapi.ts`: generates `backend/openapi.json` with temporary storage independently of deployment configuration.

One root package and lockfile manage this backend. `dist/` is the production build; `.test-build/` is disposable test output. Existing empty specialist/domain directories are preserved for future work.

## HTTP and validation contract

`GET /health` remains public. `GET /v1/projects/:projectId/service-identity` requires a verified bearer credential and active project scope. Diagnostic probe routes are deferred in every mode. Success is HTTP 200 and `{"status":"ok"}` after a `SELECT 1` database read. No DB paths, runtime settings or credentials are returned. Database unavailability produces HTTP 503. This is a lightweight readiness check, not a financial reconciliation or SQLite integrity scan.

Health accepts no query parameters: unknown input returns HTTP 400 rather than being silently stripped. Fastify uses JSON Schema/AJV with coercion, default insertion and additional-property removal disabled. Future request body/parameter schemas must follow that convention; no future routes are stubbed now.

Errors consistently contain:

```json
{"error":{"code":"INVALID_REQUEST","message":"Request rejected.","details":{},"correlationId":"server-generated-UUID"}}
```

Unknown routes return 404 with `NOT_FOUND`; unexpected failures return 500 with `INTERNAL_ERROR`. Error text does not contain raw validation data, native SQLite details, stack traces or request URLs. Request logging is disabled, including headers/bodies; correlation IDs are generated server-side rather than trusted from a header.

`backend/openapi.json` is OpenAPI 3.0.3 generated from the registered health and service-identity routes, including their success and error responses and a reusable unknown-route 404 envelope. It is a file artifact, not an additional HTTP route. Tests validate it with Swagger Parser and compare it with the current route-generated document. Regenerate with `npm run build && npm run openapi` when schemas change.

## Environment isolation

| Setting | Behavior |
|---|---|
| `ROOMTREASURY_MODE` | Required outside tests; exactly `test`, `demo`, or `real`. Defaults to `test` only with `NODE_ENV=test`. Tests reject other modes. |
| `ROOMTREASURY_DB_PATH` | Always required; no implicit path in any mode. Must end with `.sqlite`, `.sqlite3` or `.db`. |
| test storage | Must be within an OS temporary directory whose first child is named `roomtreasury-test-*`; tests create it with `mkdtemp` and remove it after closing handles. |
| demo storage | Must be inside `<project root>/var/demo/`. |
| real storage | Must be inside `<project root>/var/real/`. Only foundation metadata/health is supported; no real financial workflow exists. |
| `ROOMTREASURY_HOST` | Defaults to `127.0.0.1`; only that address or `::1` is accepted. |
| `ROOMTREASURY_PORT` | Defaults to 3000; otherwise an integer from 1 through 65535. |

Paths resolve relative to the working/project root, so run CLI commands from the repository root. Existing ancestors are resolved physically before containment checks, preventing symlink aliases between test/demo/real storage; multiply linked files are rejected. The migration history also binds a DB to its mode. Tests exercising demo/real configuration run child processes rooted in an isolated temporary project, never this repository's real storage. No reset/delete/seed command exists.

This protects against accidental path/environment mixing, not a hostile local process changing links between checks or directly modifying SQLite. The Review Gate's trusted-host limitation remains. Loopback binding is intentional until a protected remote identity/service path is separately designed.

## Migration behavior

Migrations are in an ordered typed array, numbered contiguously from 1. Each records version, name, SHA-256 SQL checksum, mode and UTC application time. Applied names/checksums/versions/modes must match before proceeding; modifying past SQL, unknown versions and gaps fail closed.

The runner obtains `BEGIN IMMEDIATE` through the driver's synchronous transaction helper. All pending migrations and their history rows commit together, or all pending DDL/writes/history roll back. Previously committed migrations survive failures. First-bootstrap failure also rolls back metadata creation. Reopening/re-running validates and skips applied versions. Foreign-key enforcement and violations are checked before commit. The runner supplies no automatic down migration.

Migrations create `schema_migrations`, `service_principals`, `service_scopes`, `service_credentials` and append-only `service_auth_events`; startup never seeds identities or credentials. Test-only smoke tables and failing SQL exist solely in temporary test databases.

CLI entry points set restrictive umask 077; newly created storage directories use mode 0700. Existing file permissions are not silently changed. Ignore rules exclude environment secrets, DB files/sidecars, runtime storage, logs, builds and local credential/token files; `.env.example` remains shareable.

## Verification and limits

See [M1B-1 completion report](../docs/m1b-1-foundation-report.md) for exact versions, executed commands and outcomes. The test suite covers native SQLite FK enforcement, transaction commit/rollback, migration atomicity/replay/drift rejection, independent files, write-lock timeout, environment/path isolation, CLI behavior, a real HTTP health request, error envelopes and OpenAPI validation.

Human auth, operational service provisioning, financial invariants and live Switch interoperability remain future work. See [service identity completion report](../docs/m1b-2b-completion-report.md) for the implemented backend-only auth boundary. A passing foundation test does not verify any specialist host's backend access.

## Service identity safety boundary

Migration 2 uses STRICT tables and integer UTC epoch milliseconds for timestamps. Scope project/principal/role are immutable. Disabling a scope releases its active role slot; explicit reactivation succeeds only when that slot is free. A disabled principal cannot be reactivated. Credential identity, ownership, digest and expiry are immutable; rotation revokes the old credential (even if expired) and inserts a replacement atomically. Security events accompany fixture lifecycle mutations.

No operational issuer or public provisioning endpoint exists. `security/test-fixtures.ts` rejects non-test execution, requires a test-mode database and validates its OS temporary path. It returns disposable raw tokens only to in-memory test callers. Future secure operator delivery needs separate review and implementation. All agent contexts are service-kind and are denied owner decisions. The Coordinator role has no Treasury authority. Fixed-role and task-assignment guards are tested directly; there are no task-result or settlement endpoints.

Authentication accepts exactly one bounded canonical Authorization bearer token, derives immutable principal identity server-side and does not cache success. Tokens use independent random selector/secret bytes, domain-separated SHA-256 digest storage and timing-safe comparison. It is not human-password hashing, OS isolation or proof of which local agent process possesses a token. Same-host trust limitations remain.
