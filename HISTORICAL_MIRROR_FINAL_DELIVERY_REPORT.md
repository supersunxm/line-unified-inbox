# OPPO HISTORICAL MIRROR — FINAL DELIVERY

## Goal

Make LINE OA Manager text messages from 1 September 2026 onward available in lineoppo.click alongside current messages, with safe identity handling, read-only Historical views, and Historical-aware reply reporting.

## Status

**PARTIAL_BLOCKED — implementation is merged and deployed. The approved production runner reached Postgres and completed archive and Store/OA preflight, but its read-only dry-run stopped on 16,915 canonical source-ID payload/scope conflicts. No Historical backfill row was inserted.**

## Historical source coverage

- Strict stores inspected: 139.
- Archives with verified current hashes: 137; held: 2 (Stores 28326 and 30606).
- Target-period text candidates: 43,756; 42,587 from verified archives and 1,169 held with the two changed archives. All 42,587 verified-archive source event IDs are unique.
- Target-period chats: 7,217; 7,024 from verified archives and 193 held.
- Earliest text: 1 September 2026, 00:29:10 Asia/Bangkok.
- Source identity duplicates and conflicts in the archive scan: 0.
- HistoricalTimelineMessage rows currently backfilled: 0. Current production LineChatMirrorMessage rows contain chatRead events, not message text.

## Implementation and deployment

- PR #367 merged as `8cc605f5a24a684e49b2b9dd01eb25bf4192f714`; final-head Application CI, Unified Auth CI, and Adaptive Auth CI passed.
- Backend and frontend Railway deployments for that commit reached SUCCESS. Backend readiness uses `/health/readiness`; Railway reports the deployment healthy.
- Five additional services redeployed because their existing watch patterns include `backend/prisma/**`: follower-backfill-worker, tiktok-daily-metrics-cron, rich-menu-publish-worker, line-chat-nickname-worker, and google-review-daily-collector. All reached SUCCESS. No Railway configuration was changed by this task.
- The additive `20260927070000_add_historical_timeline_read_model` migration is present as finished in the production `_prisma_migrations` ledger. A read-only production schema probe confirmed the Historical table, primary key, source-identity unique index, chat-time/store-time/archive indexes, and Store/OA foreign keys.
- The authenticated Historical API, unified canonical+Historical timeline, pagination, read-only virtual chats, Historical-aware reply/responder analytics, and UI integration are implemented and deployed. They have no Historical data to serve until backfill.

## Production backfill preflight and hard stop

- The authenticated Railway runner targeted the approved production project/environment/Postgres service and used the public database URL without printing credentials. The read-only probe confirmed the expected database/schema and required tables. `HistoricalTimelineMessage` contained 0 rows before the attempt.
- The final dry-run verified archive hashes, 139 strict stores, 137 verified Store/OA mappings, and 2 held stores (28326 and 30606). It found 42,587 target text candidates, 42,587 unique source event IDs, and 0 existing Historical rows.
- Canonical comparison classified the candidates as 1,335 exact canonical matches, 16,915 source-ID conflicts, and 24,337 with no canonical source-ID match. Every conflict differs in `sentAt`; 14,623 also differ in `lineChatUserId`. Conflict rows agree on text, direction, Message type, Store, and OA. The source IDs are unique in the archive, but these time/chat identity differences prevent safely treating those rows as canonical duplicates or inserting them as Historical messages.
- The runner failed closed with `CANONICAL_SOURCE_ID_PAYLOAD_OR_SCOPE_CONFLICT`. No backfill apply was invoked and no Historical or canonical DML was performed. The existing guard was not weakened.
- Exact read-only dry-run command:

  ```sh
  railway run --project 4d6629ef-b284-4bf3-9fdf-982d37c63c32 --environment production --service Postgres --no-local -- sh -c 'export DATABASE_URL="$DATABASE_PUBLIC_URL"; exec node --import tsx scripts/historical-timeline-backfill.ts --target-environment production'
  ```

## Production worker activity observed

The automatic deployment also restarted the existing `line-chat-nickname-worker`. Its existing mirror reconciler ran with `apply=true` and a reconciliation start boundary of 21 September 2026. A subsequent read-only database audit found 60 exact-linked `IMPORTED` Mirror rows and canonical outbound Messages across 25 Conversations and 11 Stores through 09:29:18Z. Thirteen ActivityHistory entries recorded `NOT_REPLIED`/`FOLLOW_UP` to `REPLIED`/`COMPLETED` transitions. Current reply-state checks against the deployed reconciler logic passed for all 25 Conversations, and no `latestMessageAt` was earlier than the newest canonical Message. These changes came from the pre-existing LineChatMirror reconciler, not the Historical backfill. The worker remains online; exact later scan/recomputation totals are unavailable.

The reconciler can update `bmReplyStatus`, `followUpStatus`, `ownerUserId`, and `latestMessageAt`, and can add ActivityHistory when reply status changes. Historical before-values for owner assignment and `latestMessageAt` are unavailable. There were 0 `LineChatMessageSendJob` rows linked to these imports and 0 `AutoResponseExecution` rows linked to the imported source IDs; the inspected import path does not call LINE send APIs. No automatic rollback was performed. This worker activity is separate from the authorized Historical backfill, which made no writes.

No Historical read-model rows were inserted. The Historical backfill itself made no production data writes.

## Verification

- Prisma schema validation: passed.
- Backend TypeScript build and targeted ESLint: passed.
- Historical-focused backend tests: 10 passed.
- Frontend targeted ESLint: passed; frontend tests: 593 passed.
- Full backend suite: 2,093 passed; 14 failures were in existing auth/store-context, send-retry, nickname/health, image relay, and Store Insights tests outside the Historical change.
- Frontend build passed in PR CI. A repeat local build was blocked by sandbox denial of Turbopack's local port binding.
- PostgreSQL migration integration passed in PR CI against a clean database.
- Production backend deployment and readiness: SUCCESS. Direct authenticated Historical endpoint smoke tests remain unavailable because no Historical rows exist. Read-only production migration-ledger and schema checks passed. The Historical backfill dry-run reached the explicit canonical conflict guard and stopped; it performed no writes.

## Exceptions and limits

- Stores 28326 and 30606 remain archive-held: 1,169 target text events and 193 chats. Their source hashes changed without an approved explanation.
- Parent-missing events, Manager conflicts, and 11 remaining raw chatRead identity conflicts remain outside the text-read-model scope. Prior approved raw chatRead reconciliation ended with zero safe missing rows at its checkpoint.
- Non-text media and non-message event types are excluded.
- Historical responder display names are unavailable in normalized archive metadata. 16,006 target outbound text events have a stable non-auto `bizId`; these can be grouped by a masked source identity after backfill without inventing a staff name.
- The fresh production mapping preflight passed for 137 verified stores, but canonical deduplication is unresolved for 16,915 source IDs with `sentAt` and/or chat-user identity conflicts. These require a documented human disposition before another dry-run. Do not bypass the fail-closed guard or modify canonical rows under the current approval.
- Nickname validation remains UNKNOWN because the archives do not preserve the actual LINE OA Manager nickname observed at the time. No automatic rename is performed.

## Acceptance

1. Historical text visible in production for all safely mappable coverage: **NOT MET** — no read-model rows have been backfilled.
2. Historical/current ordered timeline in production: **IMPLEMENTED AND DEPLOYED, NOT VERIFIED WITH DATA** — the Historical side is empty.
3. No project-created duplicate timeline records: **NO HISTORICAL DUPLICATES CREATED** — no Historical rows were inserted; a production-wide canonical deduplication comparison remains pending.
4. Historical processing does not alter current operational state or trigger customer-facing actions: **BACKFILL NOT RUN; NO BACKFILL SIDE EFFECTS** — the separate pre-existing reconciler made the production changes listed above; historical before-values for owner assignment and `latestMessageAt` are unavailable.
5. Historical 24-hour KPI, responder analytics, and nickname validation: **CODE DEPLOYED, DATA COVERAGE NOT MET** — no Historical messages are available to the analytics; nickname evidence remains UNKNOWN.
6. Excluded populations have explicit classifications: **PARTIAL** — archive holds, Store/OA mappings, source-level exceptions, and canonical source-ID conflicts are classified; the 16,915 conflicts need human disposition.

## Required next step

Resolve the 16,915 canonical source-ID conflicts by establishing the correct historical chat/time interpretation or approving a documented conflict-hold policy. Then run a fresh read-only preflight and dry-run with the unchanged fail-closed safeguards. Only after that dry-run classifies every candidate safely should the separately approved insert-only backfill proceed. Keep Stores 28326 and 30606 held until independent provenance is available. Do not run another apply under the current approval.
