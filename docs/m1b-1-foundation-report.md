# M1B-1 — Backend foundation completion report

Status: **COMPLETE**. Implemented and verified 2026-11-06. Only M1B-1 is complete; the broader M1B identity work, financial domain and M1C integration remain pending. The Review Gate amendments control scope; no scheduler/outbox, agent identity or financial schema was added.

## A. Runtime and pinned dependencies

Initial inspection found a shell default of Node 20.20.2/npm 10.8.2 and an already-installed Node 22.22.3/npm 10.9.8. Verification used the latter by prepending its existing bin directory to PATH. No Node installation, global default or Switch runtime was changed.

| Component | Exact version | Role |
|---|---|---|
| Node.js | 22.22.3 | Pinned in `.nvmrc` and package engines; includes `node:test` |
| npm | 10.9.8 | Pinned package manager/engine; lockfile v3 |
| fastify | 5.12.8 | HTTP server and route schema handling |
| ajv | 8.20.0 | Configuration validation and Fastify's resolved JSON Schema validator |
| better-sqlite3 | 13.0.3 | Native synchronous SQLite driver |
| @fastify/swagger | 9.9.3 | OpenAPI from actual registered routes |
| typescript | 5.9.3 | Strict type checking and production/test compilation |
| @types/node | 22.20.5 | Node 22 types |
| @types/better-sqlite3 | 9.6.0 | Driver types |
| @apidevtools/swagger-parser | 13.1.0 | Development-only OpenAPI validation |
| Driver-reported SQLite | 3.53.4 | Observed through `SELECT sqlite_version()` on the installed driver |

All direct dependency versions are exact in `package.json`; `package-lock.json` pins the resolved tree/integrities. `.npmrc` enables exact saves and strict engine checks. No ORM, external test runner, monorepo or hot-reload framework was installed.

Compatibility was checked using registry metadata, official project documentation, a native installation, actual driver tests and build/server execution. The chosen driver requires Node >=22; Swagger Parser requires >=22.19.0. Node 22.22.3 satisfies both. Node 20 was deliberately not used for installation/testing. [Node release status](https://nodejs.org/en/about/previous-releases), [Fastify support](https://fastify.dev/docs/latest/Reference/LTS/), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Swagger plugin](https://github.com/fastify/fastify-swagger).

## B. Files created or modified

Created:

- `.nvmrc`, `.npmrc`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`.
- `backend/src/config.ts`, `backend/src/app.ts`, `backend/src/server.ts`.
- `backend/src/api/errors.ts`, `backend/src/api/export-openapi.ts`.
- `backend/src/db/connection.ts`, `backend/src/db/migrations.ts`, `backend/src/db/migrate.ts`.
- `backend/tests/helpers.ts`, `backend/tests/config.test.ts`, `backend/tests/database.test.ts`, `backend/tests/http.test.ts`, `backend/tests/cli.test.ts`.
- `backend/openapi.json` (generated, validated API artifact), `backend/README.md`, this report.

Modified:

- `.gitignore`: environment/runtime/SQLite sidecar/log/build/local credential exclusions.
- `.env.example`: names and placeholders only, matching actual config names and constraints.
- `README.md`: narrow status correction and backend runbook link.
- `docs/milestones.md`: record only the completed M1B-1 submilestone; broader M1 remains pending.

`node_modules/`, `dist/` and `.test-build/` were generated locally and are ignored. No persistent project `var/demo` or `var/real` DB was created during verification. Earlier uncommitted design files were preserved.

## C. Foundation architecture

One root Node package builds TypeScript under `backend/src` into `dist`. Config is validated before opening SQLite; the DB is initialized/migrated before server listen. Fastify registers only `GET /health`, checks SQLite using `SELECT 1`, returns a strict status response and closes the DB on application shutdown. The service binds to loopback only.

AJV conventions reject unknown schema properties without coercion or silent stripping. Safe JSON errors use `{error:{code,message,details,correlationId}}`; correlation IDs are server-generated, request logging disabled and raw error/input payloads never returned. OpenAPI 3.0.3 is generated from actual route schemas, exported as a file and checked against runtime generation in tests. No future API routes were stubbed.

## D. Migration behavior

Only version 1 creates `schema_migrations` (version/name/checksum/mode/UTC applied time). There are no financial tables. All pending migrations apply in a single immediate transaction. Failure rolls back their schema changes, writes and history; previously applied history remains. Initial bootstrap failure leaves no metadata table. Repeat/reopen validates and skips applied versions. Wrong order, changed SQL/name, unknown history or different mode fails closed.

Every connection enables/verifies FK enforcement, sets/verifies a 1000ms busy timeout and verifies WAL. Tests exercise real FK failure, committed and rolled-back transactions, repeatability, initial/incremental migration failure, independent files and two-connection lock contention.

## E. Environment and secret protection

Modes are explicit `test`, `demo`, `real`. With `NODE_ENV=test`, mode defaults to test and non-test modes are rejected. Every mode requires a database path; missing demo config never falls back to real. Test paths are confined to OS temporary `roomtreasury-test-*` directories, demo to project `var/demo/`, real to `var/real/`. Real mode supports foundation metadata only, with no financial workflow. Existing ancestors are physically resolved to reject symlink escapes, hard-linked files are rejected and migration records bind mode.

Automated tests generate temporary files, explicitly isolate environment variables for child processes and clean up handles/files. The tests for demo/real parsing run in a temporary fake project root, not persistent real storage. CLI umask is 077 and new storage directories are 0700. No reset or seed tool exists. No secrets are needed by this milestone; `.env.example` contains placeholders. Logging and generic startup/migration errors do not dump config or requests. This does not claim isolation against hostile processes on the same OS account.

## F. Commands used and run instructions

All implementation verification commands ran from `/Users/varunchauhan/projects/RoomTreasury` with:

```sh
export PATH=/Users/varunchauhan/.nvm/versions/node/v22.22.3/bin:$PATH
npm install --no-fund
npm ci --no-fund
npm run typecheck
npm run build
npm run openapi
npm test
npm ls --depth=0
git diff --check
```

Registry inspection used `npm view` for exact versions/engines/dependencies before selection. The clean-install command `npm ci --no-fund` actually reinstalled 71 packages and audited 72, reporting zero vulnerabilities. The final type/build/spec/test commands were rerun after correcting implementation/test errors described below.

`npm test` expands to:

```sh
tsc -p tsconfig.test.json && NODE_ENV=test node --test .test-build/tests/*.test.js
```

An additional Node ESM smoke script was executed through `node --input-type=module`: it created a temporary directory/free loopback port, spawned `node dist/server.js` with an explicit test DB path, fetched `/health`, sent SIGTERM, checked exit 0 and empty stderr, read the migration row count/native SQLite version, then removed the temporary directory. This tested the compiled entry point separately from Fastify injection tests.

Operational migration/start commands and configuration are in [backend runbook](../backend/README.md). The service does not automatically read `.env`; export values or use Node's explicit environment-file support with a private valid file.

## G. Executed results

| Check | Result |
|---|---|
| Clean dependency install | PASS — npm ci, native driver installed on Node 22.22.3 |
| Strict TypeScript check | PASS |
| Production build | PASS |
| OpenAPI artifact generation | PASS |
| Foundation suite | PASS — 22 tests, 0 failures, 0 skipped |
| SQLite FK, commit and rollback | PASS — actual driver/temp files |
| Migration repeat/reopen and rollback/drift/order/mode checks | PASS |
| Two SQLite files isolated / two connections bounded lock wait | PASS |
| Config mode/path checks and symlink escapes | PASS |
| Actual loopback HTTP GET /health | PASS |
| Strict query rejection, 404/500 envelope and unavailable-DB 503 | PASS |
| OpenAPI validator, malformed-spec rejection and generated-artifact match | PASS |
| Compiled server startup, HTTP and SIGTERM shutdown | PASS — exit 0, empty stderr |
| Installed top-level dependency list | PASS — exact versions above |
| Git whitespace / ignore probes | PASS — secret/runtime examples ignored; `.env.example` not ignored (expected check-ignore exit 1) |

No financial invariant, OAuth, agent identity, specialist connectivity or Switch messaging test was run or claimed.

## H. Failures encountered and remaining limitations

Development checks initially found TypeScript typing errors around the driver's unknown PRAGMA result, malformed-spec negative test and readonly OpenAPI schema arrays. Those were corrected; final type check/build passed. The first running suite passed 20/21 tests: its CLI child omitted macOS TMPDIR, causing the strict temporary-path guard to reject a valid test path. The test now explicitly passes the OS temp location; the safety guard was retained. A bootstrap rollback case was added, bringing the final suite to 22 passing tests.

No foundation failure remains unresolved. Native-driver support was verified on this Mac/toolchain only. Loopback service/device access, auth, protected remote origin, per-agent credential injection and live routing/continuation remain outside M1B-1. Review Gate financial and context-version requirements are unchanged and unimplemented. Do not infer broader M1 completion from this report.

## I. Scope and infrastructure confirmation

No Switch installation/configuration was read or changed during implementation. No agents were created, configured, restarted, renamed, replaced or messaged. No Discord/Switch messages were sent. No credentials/tokens were read, copied, provisioned or exposed. No financial domain, payment functionality, seed data, identity provider or Coordinator orchestration was implemented. Work stops at M1B-1.
