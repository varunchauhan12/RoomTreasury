# Switch integration evidence and verification gates

Inspected 2026-11-06, read-only. No test messages sent, no agents started/reconfigured, and no credentials copied. This report distinguishes installed source support from tested deployment behavior.

## Evidence sources

Installed core source root (abbreviated `CORE` below):

```text
/Users/varunchauhan/Library/Application Support/switchdash/local-switch-server/native/switch-core/0.31.0/src/core/switch_core
```

| Capability | Installed source evidence | Verification status |
|---|---|---|
| Running specialists and Discord room | Switch Console Home/Your Rooms: four named Codex agents running; RoomTreasury connector, `#general`, four agents | Observed in UI; specialist execution not exercised |
| Room discovery and binding | `CORE/bridges/agent/operations/definitions.py:214` `list_rooms`; `:246` `connect_to_room(room_id, include_general_instructions=True)` | Source verified; live call pending |
| Participants | Same file `:738` `list_participants()` | Source verified; live membership/policies pending |
| Timeline context | Same file `:640` `read_context(limit=50, since=None, before=None, room_id=None)` | Source verified; live history/Discord mapping pending |
| Room output | Same file `:768` `post_message(body, thread_id=None)` returns `event_id` | Source verified; live call pending |
| Agent invocation by addressed room message | Same file `:795` `send_targeted_message(body, target_names=None, target_roles=None, thread_id=None)` | Source verified; agent-to-agent permission/delivery test pending |
| HTTP operation transport | `CORE/bridges/agent/api/operations.py:1` and `:273`: `POST /agents/{agent_id}/ops/{operation}`; same registry as MCP | Source verified; authenticated session/header handshake pending |
| MCP | `CORE/bridges/agent/app.py` mounts `/mcp`; `mcp/server.py:165` registers operation registry; bearer middleware wraps access | Source verified; usable tools in each existing Codex session pending |
| Main-agent routing | `CORE/bridges/agent/commands.py:785` `_cmd_assign_agent`, command `!assign-agent @agent-name`; `delivery/conversation.py:16` and routing logic | Source verified, feature-gated; deployed flag and routing pending |
| Feature gate | `CORE/feature_flags.py:48` `follow_the_conversation`; `commands.py:726` rejects following commands if disabled | Source verified; deployed setting unknown |

Local running core process listens on loopback ports 58317/58318 at inspection time. These are observed ephemeral endpoints, not configuration defaults to hardcode. Unauthenticated read-only probes to `/openapi.json` and `/agents/feature-flags` returned 404 on 58317 and 401 on 58318. This verifies that the probe did not obtain a schema or feature flags; it does **not** show that a feature is absent or disabled. No authentication bypass was attempted. No Switch tools are exposed in this chat's tool inventory.

## Actual supported semantics

- `send_targeted_message` addresses participant **names**, not IDs. Resolve from `list_participants`; retain IDs internally for authorization. Tool adds mention prefixes; do not add them manually.
- Other participants see the handoff as room context. This is messaging with asynchronous responses, not a private function call or a specialist completion result.
- Result contains `event_id` and `target_statuses`: `live`, `awaiting_manual_poll`, `no_session`, `disconnected`, or `not_permitted`. Only the last denotes refusal by addressing policy; a message may still have been posted. A successful post is not proof of successful work.
- `post_message` is broadcast and must not be used to wake a specialist. `send_targeted_message` is the explicit dispatch primitive.
- Tools normally act on the session's connected room. `connect_to_room` can disconnect an existing session of that same agent from the room. Reuse the installed agent's session; do not bind a second inspection/runtime session and interrupt it.
- `read_context` returns grouped threads, message IDs, sender information, timestamps, attachments and `truncated`. `before` takes ISO-8601 while `oldest_timestamp` is epoch milliseconds. Evidence discovery must paginate and preserve source IDs.
- Main-agent routing applies to eligible human text with no `@`, subject to policy and feature flag. It does not wake the Coordinator for every agent/app message. Explicit specialist results must be addressed to the Coordinator or submitted to its backend task.
- `!assign-agent` assigns an existing room participant after checking sender permission. `!unassign-agent` clears it. `!follow-ups off` controls follow-ups separately; it does not itself clear the main agent. No routing commands were run.

## Proposed communication design

1. After review, verify the installed Coordinator's tool access or register a new Coordinator through documented Console controls. Preserve all four existing specialists.
2. When feature/policies are verified, assign the Coordinator as room main agent. This is a proposed configuration change, not completed work.
3. Existing Coordinator session creates/polls backend workflow tasks using its RoomTreasury service identity. It dispatches eligible tasks through its verified Switch tool, recording the returned event ID/status through the backend. It does not expose a generic arbitrary-message endpoint to the public.
4. Existing specialist sessions fetch context and submit typed results to the RoomTreasury API through scoped credentials/tools. Then they target the Coordinator with task ID and result ID. If that notification fails, the Coordinator's backend task polling still sees the result.
5. The backend persists outbox dispatch intentions. The Coordinator acknowledges delivery; failed or ambiguous sends are retryable by task ID. Specialist task claim is atomic, fenced and idempotent.
6. Coordinator reads final balances/receipt from the backend and posts the consolidated response. Human decision links lead to the backend's authenticated page. Agent text cannot authenticate a human approval.

Proposed handoff body (application schema, **not** a Switch API):

```json
{
  "schemaVersion": 1,
  "workflowRunId": "run_demo",
  "taskId": "task_review_r2",
  "attempt": 1,
  "projectId": "project_demo",
  "requestId": "request_edit",
  "revisionId": "revision_2",
  "contextVersion": 7,
  "operation": "review_policy",
  "sourceReferenceIds": ["source_request_2"],
  "expectedOutput": "PolicyReview.v1"
}
```

Specialist outputs include task/revision/context IDs, typed findings, evidence references, uncertainty and proposed next action. The backend derives agent identity from authentication and rejects mismatched assignee, revision, lease token, or context version. The message body and agent output are untrusted input.

## Integration gate before declaring the design operational

- [ ] Read authenticated live feature flags through the existing supported interface; record enabled/disabled state.
- [ ] Inspect each specialist's session-exposed tools, immutable identity, addressing policy and membership without disrupting its connection.
- [ ] Verify a harmless Coordinator → specialist → Coordinator task in the project room, including authenticated backend result submission. Task success requires result validation, not just `live` status.
- [ ] Verify one unmentioned human message routes to the Coordinator for both owner and teammate; test thread replies and explicit mention exceptions.
- [ ] Verify context pagination and original Discord/Switch message identity mapping; preserve both IDs where supplied. Do not synthesize unverifiable source links.
- [ ] Verify durable polling/resume behavior when the Coordinator or specialist restarts and when delivery returns disconnected/not-permitted.
- [ ] Verify RoomTreasury API connectivity from every existing Codex host; a local-only backend cannot be assumed reachable from a remote agent.
- [ ] Verify Discord OAuth identity and owner-role binding, including rejection of a forged owner name, bot/agent principal and ordinary teammate.
- [ ] Capture redacted transcripts, component versions and exact supported tool signatures in this document.

If main-agent routing is disabled, the one-message/no-mention requirement is not satisfied. If specialist addressing is denied, report that permission limitation rather than pretending mention text invokes work. Review an alternate documented Switch event/bridge integration only after inspecting its actual supported contract. A manually mentioned demo is a diagnostic fallback and must not be represented as fulfillment of the product vision. Never substitute a new bot or fabricated webhook API silently.

No Switch environment variable, CLI executable, RPC method named `invokeAgent`, or financial approval primitive is assumed by this design. The `.env.example` contains proposed RoomTreasury-owned settings only.
