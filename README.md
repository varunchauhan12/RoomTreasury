# RoomTreasury Lite

A multi-agent financial operations team built with Switch.

## Core workflow
One user request -> Coordinator -> Specialist agents -> Human approval
-> Authoritative ledger -> Simulated settlement -> Auditable receipt.

## Status
Under development for Flip the Switch Hackathon.

M1B-2B backend service identity is implemented. See [backend setup and tests](backend/README.md).
Financial domain, human identity, operational credential provisioning and live agent integration remain pending.

## Design review

- [Architecture, repository review, and target directory structure](docs/architecture.md)
- [Switch integration evidence and verification gates](docs/switch-integration.md)
- [Database schema and financial transaction proposal](docs/database-schema.md)
- [API and specialist handoff contracts](docs/api-contract.md)
- [Implementation milestones and invariant test checklist](docs/milestones.md)

The existing Switch server, Discord room, and four specialists remain unchanged.
The environment example contains RoomTreasury placeholders only. The backend
currently provides health checks and scoped service identity; Switch integration is pending.
