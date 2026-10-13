# Sunn Secretary Phase 5.3: inbound preparation only

This implementation adds durable inbound processing to the existing dedicated controller. It does not query production metrics, invoke AI, or call LINE reply/push APIs. Keep `SUNN_SECRETARY_WEBHOOK_ENABLED=false`. Enabling ingress is a separate owner-authorized release decision after all later execution and delivery gates are ready.

## Flow and boundaries

Disabled flag -> 404 before credential reads or receipt writes. The recovery timer is not started in disabled mode; every intake/recovery method also checks the flag.

Enabled flag -> bounded raw body (128 KiB) -> dedicated encrypted-vault identity (environment fallback only if no vault record exists) -> existing raw-byte HMAC verifier -> exact destination binding -> bounded envelope (20 events) -> validation and existing sender/real-mention policy -> deterministic Thai parser -> atomic receipt creation.

A vault record must have a successful connection-test marker before inbound use. Only its Channel Secret is decrypted; its access token is never decrypted or returned by inbound processing. LINE's signature authenticates the provider's source-user metadata; no separate profile lookup or nickname authorization is used.

Any valid LINE group is eligible. Group membership alone grants nothing. Only `SUNN_SECRETARY_ALLOWED_USER_IDS` senders with a real bot mention can submit commands. No permanent group allowlist is added. Non-mentions, unauthorized senders, unsupported events and malformed identifiable events are terminal classifications. Malformed events without usable IDs are discarded without effects. No raw messages, reply tokens or group IDs are retained.

The parser runs once before durable acceptance; only its bounded deterministic intent and an opaque sender hash are stored. No customer content or arbitrary query is accepted as a plan. Preparation rechecks the current sender allowlist and requires a nonempty UUID store scope from server-side `SUNN_SECRETARY_STORE_SCOPE_BY_USER` (JSON mapping LINE user IDs to store IDs). Missing, invalid or empty scope becomes BLOCKED_SCOPE, never global access. Group membership cannot expand a sender's scope. This deployment does not provision any users or scopes.

## Persistence without migration

Reuse Phase 5.2 SHA-256 bot/event receipt keys and the existing PostgreSQL unique constraint. Insert the complete initial plan in the same `WebhookEvent.create`; there is no reserve-then-initialize crash window. Only verified P2002 on externalWebhookEventId means DUPLICATE. Other persistence errors produce a redacted 503 so LINE can redeliver. Earlier accepted events in a partially failed batch remain durable and deduplicate on retry.

All Sunn rows remain `processingStatus=IGNORED`, with no storefront OA relation. Isolated states use `eventType=SUNN_SECRETARY_INBOUND_<state>`. The existing nullable `errorMessage` field carries a bounded version-1 JSON preparation plan, not raw exceptions. This deliberate field reuse avoids migrations and Mirror watch-path changes. Generic storefront queue consumers must continue excluding IGNORED rows. Phase 5.2 RESERVED records are never promoted or reinterpreted as commands.

States:

- RECEIVED: durable authorized intent waiting for preparation.
- PROCESSING: compare-and-set owned lease; attempts increment atomically with the lease.
- PREPARED: authorization/scope preparation passed; **no query executed and no reply sent**.
- UNAUTHORIZED / UNSUPPORTED / MALFORMED / BLOCKED_SCOPE: terminal, no execution.
- FAILED_RETRYABLE: pure preparation failed; retry eligible after 30 seconds.
- FAILED_FINAL: three attempts exhausted, or stored plan invalid; visible terminal failure requiring reviewed remediation, not silent success.

One process checks at ten-second intervals, at most 20 rows per tick. Across processes, compare-and-set includes namespace, destination, IGNORED status, prior state, timestamp and prior plan. Finalization requires the unique lease. A stale worker cannot finalize a replacement lease. Crashed RECEIVED work and PROCESSING leases older than 30 seconds are recovered from PostgreSQL. Preparation is synchronous, deterministic and side-effect-free; the lease is not a general-purpose external API lease.

Database outages leave durable work unchanged for a later tick. Recovery logs only `SUNN_INBOUND_RECOVERY_UNAVAILABLE`; request handlers expose a fixed persistence diagnostic. No exception, SQL, identity, credential or message is logged. Bounded input and batches cap per-request and per-tick work; this is not a complete future per-sender quota policy.

## Deliberately deferred

PREPARED is not COMPLETED. No exactly-once execution or delivery guarantee is made. No LINE access token/reply token is attached to a plan. Scope must be resolved and reauthorized again at actual execution. A later read-only adapter must reuse ConversationsService's monthly summary, validate Bangkok coverage/freshness and totals, exclude synthetic duplication, and enforce store scope on returned rows. No outbound-delivery state machine, API retry, ambiguous-send resend, token-expiry handling, metric response or live AI is implemented here.

Before delivery implementation, design durable attempts and ambiguous-outcome recording explicitly. Never automatically resend an ambiguous LINE result. This preparation lease cannot safely protect a slow external send.

## Release and rollback

No schema, Store Master, existing storefront controller, Mirror, Historical Backfill or OBS changes. Backend `backend/**` and projection watch paths match these files; merge would automatically deploy those services. Mirror and frontend watch paths do not match. No merge or deployment is authorized by this PR.

Keep the feature disabled through review and deployment. Roll back to a previously approved disabled backend artifact if necessary; no database history rewrite or receipt deletion is required. Retain terminal receipts to prevent replay. Any future replay/reset procedure requires a specific reviewed plan.
