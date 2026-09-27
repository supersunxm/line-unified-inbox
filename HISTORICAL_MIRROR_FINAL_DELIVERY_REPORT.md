# OPPO HISTORICAL MIRROR — FINAL DELIVERY

## Goal

Make LINE OA Manager text messages from 1 September 2026 onward available in lineoppo.click alongside current messages, with safe identity handling, read-only Historical views, and Historical-aware reply reporting.

## Status

**PARTIAL_BLOCKED — implementation is merged and production deployments succeeded, but the Historical text backfill and production user-level acceptance remain blocked on a controlled runner with access to both private archives and production Postgres.**

## Historical source coverage

- Strict stores inspected: 139.
- Archives with verified current hashes: 137; held: 2 (Stores 28326 and 30606).
- Target-period text candidates: 43,756; 42,587 from verified archives and 1,169 held with the two changed archives.
- Target-period chats: 7,217; 7,024 from verified archives and 193 held.
- Earliest text: 1 September 2026, 00:29:10 Asia/Bangkok.
- Source identity duplicates and conflicts in the archive scan: 0.
- HistoricalTimelineMessage rows currently backfilled: 0. Current production LineChatMirrorMessage rows contain chatRead events, not message text.

## Implementation and deployment

- PR #367 merged as `8cc605f5a24a684e49b2b9dd01eb25bf4192f714`; final-head Application CI, Unified Auth CI, and Adaptive Auth CI passed.
- Backend and frontend Railway deployments for that commit reached SUCCESS. Backend readiness uses `/health/readiness`; Railway reports the deployment healthy.
- Five additional services redeployed because their existing watch patterns include `backend/prisma/**`: follower-backfill-worker, tiktok-daily-metrics-cron, rich-menu-publish-worker, line-chat-nickname-worker, and google-review-daily-collector. All reached SUCCESS. No Railway configuration was changed by this task.
- The additive `20260927070000_add_historical_timeline_read_model` migration was processed by the successful backend pre-deploy `npx prisma migrate deploy` command. A direct production migration-ledger query was unavailable, so the ledger row was not independently read back.
- The authenticated Historical API, unified canonical+Historical timeline, pagination, read-only virtual chats, Historical-aware reply/responder analytics, and UI integration are implemented and deployed. They have no Historical data to serve until backfill.

## Production worker activity observed

The automatic deployment also restarted the existing `line-chat-nickname-worker`. Its existing mirror reconciler ran with `apply=true` and a reconciliation start boundary of 21 September 2026. At the 08:20Z observation cutoff, per-store logs recorded 16 outbound canonical Message imports and 5 Conversation state recomputations. The reconciler processed 2,293 rows in apply-enabled cycles, which use its raw Mirror reconciliation metadata update path. The most recent import/recomputation was at 08:16Z; cycles from 08:17Z through 08:20Z had none. These were produced by the pre-existing LineChatMirror reconciler, not by the Historical read-model backfill. The worker remained active at cutoff, so these counts describe the observed window and do not imply future activity has stopped.

The reconciler implementation can update `bmReplyStatus`, `followUpStatus`, `ownerUserId`, and `latestMessageAt`, and can add ActivityHistory when reply status changes. The logs do not identify the affected conversations or exact field deltas, and production database access was unavailable to verify those before/after values or ActivityHistory count. No reconciler failures or auto-responses were logged in the observed windows; no LINE send path is called by the inspected outbound import method, and no LINE sends were observed. No automatic rollback was performed because the deployments succeeded and there is no evidence of data loss; the exact operational deltas still require a read-only production audit.

No Historical read-model rows were inserted. The Historical backfill itself made no production data writes.

## Verification

- Prisma schema validation: passed.
- Backend TypeScript build and targeted ESLint: passed.
- Historical-focused backend tests: 10 passed.
- Frontend targeted ESLint: passed; frontend tests: 593 passed.
- Full backend suite: 2,093 passed; 14 failures were in existing auth/store-context, send-retry, nickname/health, image relay, and Store Insights tests outside the Historical change.
- Frontend build passed in PR CI. A repeat local build was blocked by sandbox denial of Turbopack's local port binding.
- PostgreSQL migration integration passed in PR CI against a clean database.
- Production backend deployment and readiness: SUCCESS. Direct authenticated Historical endpoint smoke tests and a production migration-ledger readback were unavailable from this environment.

## Exceptions and limits

- Stores 28326 and 30606 remain archive-held: 1,169 target text events and 193 chats. Their source hashes changed without an approved explanation.
- Parent-missing events, Manager conflicts, and 11 remaining raw chatRead identity conflicts remain outside the text-read-model scope. Prior approved raw chatRead reconciliation ended with zero safe missing rows at its checkpoint.
- Non-text media and non-message event types are excluded.
- Historical responder display names are unavailable in normalized archive metadata. 16,006 target outbound text events have a stable non-auto `bizId`; these can be grouped by a masked source identity after backfill without inventing a staff name.
- Production Store/OA mapping, existing canonical-message deduplication, and full-fleet usable-chat counts require a fresh production preflight in the backfill runner.
- Nickname validation remains UNKNOWN because the archives do not preserve the actual LINE OA Manager nickname observed at the time. No automatic rename is performed.

## Acceptance

1. Historical text visible in production for all safely mappable coverage: **NOT MET** — no read-model rows have been backfilled.
2. Historical/current ordered timeline in production: **IMPLEMENTED AND DEPLOYED, NOT VERIFIED WITH DATA** — the Historical side is empty.
3. No project-created duplicate timeline records: **NO HISTORICAL DUPLICATES CREATED** — no Historical rows were inserted; a production-wide canonical deduplication comparison remains pending.
4. Historical processing does not alter current operational state or trigger customer-facing actions: **HISTORICAL BACKFILL NOT RUN; FULL PRODUCTION VERIFICATION PENDING** — no LINE sends were observed, but the separate pre-existing reconciler made the production changes listed above and its exact field deltas were not available for audit.
5. Historical 24-hour KPI, responder analytics, and nickname validation: **CODE DEPLOYED, DATA COVERAGE NOT MET** — no Historical messages are available to the analytics; nickname evidence remains UNKNOWN.
6. Excluded populations have explicit classifications: **PARTIAL** — archive holds and source-level exceptions are classified; fresh production Store/OA and full-fleet classifications remain pending.

## Required next step

Provision a controlled one-off runner that can read the approved private archives and access production Postgres without exposing credentials. First run the fresh read-only archive-hash, Store/OA, identity, duplicate, and worker-side-effect audit; then run the idempotent insert-only Historical backfill and verify the unified timeline, analytics, and operational-state snapshots. Keep Stores 28326 and 30606 held until independent provenance is available.
