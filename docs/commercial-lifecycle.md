# Commercial lifecycle

RoomTreasury records commercial facts supplied by an authenticated owner. It does not send proposals, issue invoices externally, connect to a bank feed, or execute payments. Dates and amounts are entered from supporting documents. The commercial ledger is independent of approved delivery budgets, reservations, commitments and simulated settlements.

Open an owner-bound project and select **Client Finance**. Record a submitted proposal, client response and signed agreement. A signed agreement references the exact accepted commercial quote. For a RoomTreasury import, choose **Record submission of current imported revision** to record the import ID, exact review revision and fingerprint. A commercial action does not approve the underlying agent proposal or activate financial spending.

Draft an invoice, record its issue date, and add an independently documented receipt against the invoice. An unallocated receipt counts toward project cash but does not reduce any invoice balance. Invoices marked overdue can also be partially paid. Cash margin at closeout is recorded receipts less recorded expenses. No bank reconciliation, tax calculation, foreign exchange, credit notes, refunds, or expense reversals are supported. Project closeout requires recorded full contract collection and resolved invoices.

## Isolated demo

Use a new SQLite file directly under `var/demo/commercial-lifecycle` and a separate loopback port. From the repository root:

```sh
npm run build
export ROOMTREASURY_MODE=demo
export ROOMTREASURY_DB_PATH=./var/demo/commercial-lifecycle/example.sqlite
export ROOMTREASURY_PORT=3001
export ROOMTREASURY_AUTH_ORIGIN=http://127.0.0.1:3001
npm run owner:admin -- create demo-owner DEMO-ADMIN
npm run owner:admin -- seed-lifecycle demo-owner
npm start
```

Open [the demo workspace](http://127.0.0.1:3001) and sign in as the owner you just provisioned. Seeding requires a fresh workspace and is idempotent for that owner. To reset, stop the demo and choose a new database filename before provisioning and seeding again. The existing Northstar, NovaCreative, and Beacon database is not used. The seeded workspace labels all four projects as demo and disables agent-job creation, worker dispatch, and direct AI estimation.

The demo shows one paid invoice, one outstanding invoice, one submitted proposal awaiting response and one requested revision. Expected demo totals are $4,200 contracted, $2,400 in synthetic recorded receipts and $1,800 receivable. None is actual cash.

## Updates

Visible pages poll existing owner-scoped HTTP APIs at six-second intervals and retry after disconnects. Browser-recorded commercial actions also signal other same-origin tabs to refresh. Passive reads preserve the idle-session limit. The UI shows the last successful refresh and offers manual refresh. No SSE service is required.
