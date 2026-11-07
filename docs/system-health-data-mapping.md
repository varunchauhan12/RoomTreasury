# RoomTreasury frontend data mapping

This records the Phase 1–2 audit. For the signed agreement, invoice, receipt and polling changes introduced in Phase 3, see [Commercial lifecycle](commercial-lifecycle.md).

Observed against the running local demo and an authenticated isolated copy. A second, isolated test database exercised a synthetic automatic import with deterministic Discord HTTP fixtures. The live Discord checks only authenticated, read history and downloaded historical attachments. The audit sent no Discord messages.

## API and storage key

| Label | Request | Authoritative records |
| --- | --- | --- |
| Projects | `GET /v1/client-projects/` and `GET /v1/client-projects/:projectId` | `client_projects`, `delivery_proposals`, `project_balances`, `workstream_allocations`, `commitments`, `settlement_receipts`, `financial_audit_events`. An authorized owner also sees the matching `project_task_bindings`, latest `processing_jobs` record and `project_import_links`. |
| Jobs | `GET /v1/client-projects/:projectId/processing-jobs`, `GET /v1/processing-jobs/:id` and `GET /v1/processing-jobs/:id/events` | `processing_jobs` and `processing_job_events`, scoped through project/task owner binding. |
| Imports | `GET /v1/proposal-imports/` and `GET /v1/proposal-imports/:id` | `proposal_imports`, `project_import_links` and `proposal_import_originals`. |
| Review | `GET /v1/proposal-imports/:id/review` | Exact current proposal revision, authenticated verification records and decisions, and applicable policy gates. Authenticated revision and decision history comes from `authenticated_review_events`. |
| Originals | `GET /v1/proposal-imports/:id/original-artifacts/:kind` | Original proposal, evidence and summary bytes and stored SHA-256 values. Legacy normalized downloads use `/artifacts/:kind`. |
| Owner | `GET /v1/owner-auth/session` | Verified cookie session, active owner and enforced task/project scopes for restricted reads. |

## Overview and Finance

| UI component | API | Backend field and transformation | Observed value |
| --- | --- | --- | --- |
| Overview agreed client revenue | Projects | Sum `client.revenue_cents` only for projects with an approved `delivery` snapshot. Empty approved set displays Not set. | $1,000.00, from Northstar Media [SYNTHETIC DEMO]. |
| Finance agreed revenue and project ledger | Projects + Review | Approved projects use `client.revenue_cents`. Other records require an exact-fingerprint `revenue_payment_terms` verification and no blocker on that gate before showing `revision.proposal.project.agreedRevenueCents`. | $1,000.00 total. NovaCreative agreed revenue is Not set. |
| Proposed revenue and intake target | Projects + Review | `revision.proposal.project.proposedRevenueCents` is shown under proposed terms. A draft project's intake-only `client.revenue_cents` is a target in project views. | NovaCreative proposed $1,800.00. |
| Received cash | No receipt-of-cash API | Simulated settlement records are excluded. | Not recorded. |
| Approved budgets | Projects | Sum `delivery.budget` only for approved snapshots. Per project uses `approvedDeliveryBudgetCents`. | $700.00 across one approved delivery project. NovaCreative has no approved budget. |
| Available spending capacity | Projects | Sum `delivery.available`. The backend calculates budget less committed, reserved and spent. | $700.00 aggregate, NovaCreative Not set. |
| Commitments, reserved amounts and spending | Projects | `delivery.committed`, `delivery.reserved`, `delivery.spent` are backend balances. Sum only approved delivery records for agency totals. | $0.00 each for approved delivery. NovaCreative has no balance record. |
| Workstream bars and budget ring | Projects | Bars group `allocations[].limitCents/available/committed/reserved/spent`. Ring partitions positive components of the approved delivery balances. | Four allocations totaling $700.00. Available is the only nonzero ring slice. |
| Project margin | Projects + Review | Approved-project display uses `projectedGrossMarginCents`. Review preview calculates verified agreed revenue less `revision.proposal.proposal.budgetCents` when terms are confirmed. | NovaCreative review margin Not set. |
| Transactions and receipt detail | Projects | `receipts[]` uses immutable `id`, `amount_cents`, `purpose`, `settled_at` and synthetic settlement status. | No settlement receipts recorded. |
| Commitment detail | Projects | `commitments[]` uses `purpose`, `amount_cents`, `state` and `confirmed_by`. Pending obligations remain distinct from confirmed balance usage. | No commitments recorded. |
| Finance activity | Projects | `history[].action/occurred_at/target_id`, ordered by time. | Two existing synthetic financial audit records. |

## Projects and Operations

| UI component | API | Backend field and transformation | Observed value |
| --- | --- | --- | --- |
| Project count, status and client | Projects | Count records and `client.status` values. Project display name and requested due date are parsed from the stored intake brief when present. | Four projects, one active and three draft. |
| Pipeline and attention | Projects + Review | Stage uses approved delivery, active job states or linked import. Attention badges use failed, uncertain or attention job states and actual blocked review status. | NovaCreative in Proposal Review, with attention and blocked review despite the imported job. |
| Processing and errors | Jobs + Projects | Show `state`, `attempt`, `correlation_id`, `updated_at`, `error_code` and allowlisted `dispatch_diagnostic`. The event list pages `id,event_key,from_state,to_state,code,occurred_at`. | NovaCreative imported. Events 21–24 recorded four specialist labels, 27 recorded collection failure and 28 recorded manual import. |
| Agent Fleet and reports | Jobs + Imports | Configuration describes responsibilities. Actual job state comes from the job, while observed specialists come from recorded events and `proposal.specialistContributions`. | Historical activity for four specialists. No individual live presence inferred. |
| Import queue and revision identity | Imports + Projects | Rows key on import `id`, with `taskId`, `revision`, `importedAt` and owner-scoped `workspace.imports[].jobId`. Inspector verifies record ID and bound task before display. | NovaCreative import `938c9972-f270-4246-9493-17884aba2344` linked to job `e8c2e4a1-1546-45b3-b9f2-80b05000ecca`. |
| Review counts and pending owner decisions | Review + Projects | Overview counts the latest owner-scoped linked imports. Pending means `ELIGIBLE_FOR_AUTHENTICATED_OWNER_APPROVAL`. Blocked uses `BLOCKED`. Approval Centre lists actual review status and blockers from authorized snapshots. | NovaCreative is blocked and contributes zero eligible approvals. Imported and approved remain separate. |
| Proposal evidence and artifacts | Imports + Originals + Review | Selected proposal drives budget, scope, contributions, risks and blockers. Original endpoints return preserved bytes. Normalization metadata indicates format and recorded hashes. | Three historical originals returned HTTP 200 by Discord and matched retained SHA-256. Authenticated app downloads also returned the retained bytes. |
| Activity and Audit | Projects + Jobs + Imports + Review | Time-order project binding creation, job events, imported timestamps, authenticated review activity and financial history. The consolidated view uses up to 100 events per job and links to its paged event history. | Existing intake, processing, import and financial records displayed. No decisions were written by the audit. |

## Refresh and unavailable data

- The project workspace polls active jobs every two seconds. On an imported result, it reads the exact project again, checks the project, task and job linkage and refreshes the result panel. The existing manual refresh remains available.
- The dashboard reads on entry, window focus, return to visibility and every ten seconds while visible with a known active job. It avoids replacing a focused filter or expanded detail. It uses the existing HTTP APIs and their session semantics.
- The isolated browser run observed the new import in both views with zero page navigations. Imports that happen elsewhere while the dashboard has no known active job are picked up on return to the tab or manual refresh.
- Cash-flow series, individual agent presence and actual received cash have no authoritative endpoint. The UI has no synthetic substitutes for these fields. Existing explicitly labeled demo fixtures remain separate from actual imported proposals.
