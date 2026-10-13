# Sunn Secretary Phase 5.4 — read-only KPI execution

Phase 5.4 adds an injectable, explicit execution boundary for prepared
`UNANSWERED_BY_STORE` intents. It is not called by the Phase 5.3 receipt
recovery loop. A reserved receipt or a `PREPARED` receipt remains neither an
executed command nor a completed response.

## Read path

`SunnSecretaryReadOnlyKpiService.executePrepared` accepts only a prepared
Phase 5.3 plan, validates its persisted shape, and checks that
`SUNN_SECRETARY_WEBHOOK_ENABLED` is still true. Before data access it resolves
the sender hash against the current `SUNN_SECRETARY_ALLOWED_USER_IDS` and reads
that sender's store IDs only from the server-owned
`SUNN_SECRETARY_STORE_SCOPE_BY_USER` configuration. It repeats that check at
the database-read boundary. The request and intent contain no store IDs.

Within a PostgreSQL `REPEATABLE READ`, read-only transaction, the adapter
verifies every scoped store is active and non-archived; every scoped store has
an active Store OA; every such OA has a healthy Mirror state with a successful
sync no more than two hours old; and the Mirror state remains bound to the OA's
store. It then calls the existing
`ConversationsService.getBmReplyStatusSummary(storeIds, month)` through the
transaction client. The existing monthly counting logic remains authoritative.
The query is capped at 10,000 source conversations and runs with a five-second
PostgreSQL statement timeout and a seven-second transaction timeout.

The adapter checks that the returned unique store IDs exactly match the
authorized scope, source conversation counts reconcile to store totals, the
synthetic Focus group row matches but is excluded from totals, no conversation
has an unresolved or cross-store OA identity, and every returned operational
conversation has a current `reply-state-v1` projection computed no earlier
than its latest message. Missing, stale, partial, over-budget, duplicate, or
inconsistent data returns a structured failure without metrics.

## Metric contract and limits

Only the deterministic `UNANSWERED_BY_STORE` intent is supported. Thai month
names and Buddhist Era years continue to be parsed by the existing intent
parser and normalized to Gregorian `YYYY-MM`; Bangkok month boundaries and
the existing `latestMessageAt` bucket are preserved. The existing effective
reply-state resolver supplies projection state with its established fallback
rules. The result counts unanswered **conversations**, not individual
messages, and is separate from the 24-hour response KPI. The synthetic
Focus-seven-store aggregate is never added to store totals.

Months before `CHAT_REPLY_STATUS_COVERAGE_MONTH` (`2026-09`) and future months
are refused. Results include the calculation time, the oldest successful Mirror
sync in the authorized scope, the verified operational coverage start, and a
data-quality status. A recent successful Mirror poll does not certify complete
historical message coverage; the response states this limitation and labels
counts as values from the verified operational source snapshot. A month in
progress is therefore an as-of snapshot, not a final month close.

All execution failures are redacted reason codes. The adapter has no LINE
Messaging API or generative AI dependency, persists no metrics or result, and
does not update BM reply states. The existing webhook flag remains
`SUNN_SECRETARY_WEBHOOK_ENABLED=false`; no automatic execution or outbound
delivery loop is introduced. A later phase must separately design durable
result recording and delivery behavior before connecting this adapter to
receipt recovery.
