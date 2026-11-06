# RoomTreasury Lite

A multi-agent financial operations team built with Switch.

## Core workflow
One user request -> Coordinator -> Specialist agents -> Human approval
-> Authoritative ledger -> Simulated settlement -> Auditable receipt.

## Status
Under development for Flip the Switch Hackathon.

M2A synthetic financial engine and M1B-2B backend service identity are implemented. See [backend setup and tests](backend/README.md).
The financial engine is tested through trusted in-process actors; no financial HTTP routes exist yet. Human identity, operational credential provisioning and live agent integration remain pending.
See the [M2A completion report](docs/m2a-financial-engine-report.md).

## Design review

- [Architecture, repository review, and target directory structure](docs/architecture.md)
- [Switch integration evidence and verification gates](docs/switch-integration.md)
- [Database schema and financial transaction proposal](docs/database-schema.md)
- [API and specialist handoff contracts](docs/api-contract.md)
- [Implementation milestones and invariant test checklist](docs/milestones.md)

The existing Switch server, Discord room, and four specialists remain unchanged.
The environment example contains RoomTreasury placeholders only. The backend
currently provides health checks and scoped service identity; Switch integration is pending.
