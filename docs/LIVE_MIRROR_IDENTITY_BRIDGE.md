# Live Mirror identity bridge

`Conversation.lineChatUserId` remains the canonical Manager chat identity, scoped
by `lineOfficialAccountId`. Mapping provenance is a free string; a new automated
claim uses `LIVE_MIRROR_RECONCILED` and the existing mapped timestamp. Same-ID
no-ops preserve every existing provenance/operator/timestamp field. This path
never invokes the manual mapping service or updates its nickname/send queues.

## Proof v1

Accept only a completed, error-free Mirror receipt with a present canonical
Message in the recorded canonical Conversation:

- `DUPLICATE` / `EXACT_EXTERNAL_ID`;
- `IMPORTED` / `IMPORTED_OUTBOUND`, outbound only.

The canonical Message must be delivered, agree on direction, retain an exact
external/provider/Manager event identity, and belong to the same current OA and
Store. Canonical payloads marked Historical are excluded. Imported outbound
receipts represent destinations previously accepted by the existing reconciler,
including the closed exact-manifest validation; this project does not execute
those manifests or infer links from Historical tables.

`CONTENT_TIME_MATCH`, unknown-direction skips, waiting, pending, failed and
ambiguous rows never establish identity. Every retained canonical claim is still
a conflict barrier: OA/chat must claim exactly one Conversation and that
Conversation must claim exactly one OA/chat. Claims from outside the eligible OA
that point into its Conversations remain barriers. Names, nickname text and
message text are absent from bridge proof queries.

## Storage and race protection

No new identity field/table. The concurrent unique index
`Conversation_oa_chat_identity_key` enforces OA/chat ownership across legacy
writers; multiple NULL values and the same chat ID in different OAs remain valid.
The bridge refuses writes until the index is present and valid. A per-row
serializable transaction revalidates the proof graph, current OA/Store, identity,
and active LINE-write jobs, then conditionally updates only a NULL chat identity,
mapping source and mapped timestamp. It never overwrites an existing identity.

The continuous hook runs after successful canonical reconciliation, performs no
browser operation, and isolates optional bridge failures from Mirror canonical
receipts. It does not attach identity during raw Manager collection.

## Operator audit and rollout

Run the compiled `dist/line-chat/mirror-identity-bridge.cli.js`:

1. `audit`: database-enforced read-only eligible-fleet snapshot and aggregate
   classifications. Mirror identity rows and conversation-only no-evidence rows
   are reported separately; they are different denominators.
2. `freeze --file <private-path>`: append a new immutable SAFE-only manifest;
   prints row/OA/Store counts, file SHA-256 and canonical row-set SHA-256.
3. `dry-run --file <path> --sha256 <hash> --offset <n> --limit <n>`.
4. `apply` with the same arguments, only after production quality/canary gates.

Each batch is at most 100 exact frozen rows (default 25). No discovery is allowed
inside the apply loop. Before a new write it requires current 144-OA healthy
coverage, unchanged fleet membership, exact frozen proof/provenance/activity and
zero active customer-write jobs. Drift/conflict holds stop the batch. Existing
correct claims are no-ops. Read back every row and repeat the exact batch to
prove zero additional writes. Preserve private operator evidence off GitHub.

No Source Tag application, Manager nickname/message request, Conversation merge,
canonical/Historical rewrite, Reply/KPI/status/assignment change, browser lease,
fleet eligibility change or extra scheduled cycle is part of this project.
