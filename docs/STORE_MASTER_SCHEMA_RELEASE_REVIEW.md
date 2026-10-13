# Store Master migration history and schema compatibility

## Scope and provenance

The history repair restores `20260818120000_add_app_release_management/migration.sql` from commit `357df6f0b6af73a58bba5a762d384cdb53e490f5`, SHA-256 `cb61e06ffb681a07f4b9adec27235aeb3a37d24547df78d77070d47742814ba9`. It includes the already-applied `20261001090000_retire_legacy_android_product/migration.sql`, SHA-256 `7d219fe00257605632a484a67a19e3a6ebb4badf904ee8601afa5522e9771f8c`. The latter is the preserved original local retirement file, documented by the October 1 retirement workstream. Both exact byte sequences match the October 13 read-only production migration ledger. No production ledger rewrite or new forward migration is required for these corrections.

## Schema comparison classification

Identical Prisma 6.19.3 tooling compared a disposable PostgreSQL 16 replay of the clean PR head's 168 migrations with the corrected 169-migration replay. Their database-to-database diff contains exactly one schema change: the retirement migration changes `User.canAccessMobile`'s default from true to false. The AppRelease restoration changes seed bytes, not schema. Both histories retain 43 release builds after complete replay; retirement marks all releases inactive without deleting rows.

All 24 other diff blocks are identical before and after the history repair. They are pre-existing baseline mismatches, not corrections proposed by this PR:

| Difference | Classification and treatment |
| --- | --- |
| CustomerSignalType includes historical rename enum values | A: additive historical enum values preserved; no enum replacement |
| CustomerSignal.customerEventId has a unique index in migrations versus a nonunique model index | A: existing constraint preserved; no relaxation |
| CouponCampaign and CouponCampaignStore tables and their four foreign keys | A: retained legacy structures absent from current Prisma models; no drops |
| RichMessage table | A: retained legacy structure absent from current Prisma models; no drop |
| AppRelease.updatedAt, ConversationSalesProduct.updatedAt, TikTokPublicAccount.updatedAt, TikTokPublicDailyMetric.updatedAt/collectedAt SQL defaults | A: historical defaults preserved; no removal |
| GreetingExecution status index name; LineChatMirrorChat identity/latest/status index names; LineChatMirrorMessage chat/direction/manager-message index names; Message reply-token index; MirrorBackfillConversation chat index; NicknameDerivedMetadataApplication observation/parser unique index | A: existing index names differ from Prisma's inferred names; no index rename |
| User.canAccessMobile default | C: introduced into repository replay by inclusion of the already-applied retirement migration; resolved by the narrowly scoped Prisma `@default(false)` alignment |

There are no category B schema changes from restoring the historical AppRelease migration. The default alignment removes the sole new mismatch; the remaining schema comparison output must equal the clean baseline byte-for-byte. This is baseline-relative compatibility, not a claim of total schema equivalence or that unrelated historic debt is harmless in every application flow. Generated comparison SQL is diagnostic only and must never be executed as a cleanup migration.

## Mobile permission behavior

The retired product denies access when a User create omits the permission, matching the already-applied database default. Existing boolean values are unchanged. HQ registration, HQ approval, and store registration intentionally set `canAccessMobile: true`; those explicit grants are preserved. Account management grants/revocations, mobile authentication, and permission-context role semantics are not changed. Authentication selects and uses the persisted permission; ADMIN does not override an explicit false mobile permission. The optional legacy permission-context fallback remains outside this correction's scope. Schema and real PostgreSQL tests verify implicit false, explicit true, unchanged web/role permissions, and rollback cleanup.

## Controlled release boundary

Publishing the feature branch is not authorization to merge or deploy. Inspected production services follow main. A main merge containing this PR can deploy all four services: Backend (`backend/**`), Frontend (`frontend/**`), Reply State Projection (`backend/**`), and LINE Chat Mirror Worker (`backend/prisma/**`). Other main-tracking services also watch `backend/prisma/**`: follower-backfill-worker, rich-menu-publish-worker, google-review-daily-collector, tiktok-daily-metrics-cron, and tiktok-public-persistence-pilot. Their configured disabled/one-shot/cron startup behavior must be included in release approval; do not assume only four deployments. No production service is configured to follow the PR feature branch. History corrections and the model change therefore invalidate any earlier claim that the worker is isolated from deployment triggers.

Backend's configured pre-deploy command is `npx prisma migrate deploy && node dist/store-master/store-master-sync-once.cli.js`. The corrected history is already applied in production; confirm the ledger again before release. The new no-argument CLI previews only; an identity-conflict preview returns nonzero. Never redeploy the old write-by-default CLI as a routine recovery action. The projection cron independently runs with `--apply` every five minutes, so release approval must explicitly include its production write behavior.

## Mirror baseline, monitoring, and stop conditions

Before owner-authorized main merge, record a fresh health baseline with deployment SHA, eligible store/OA IDs and counts, operation mode, authentication/session status, persistent profile volume, per-store last completed raw Mirror cycle, raw inbound/outbound high-water marks, and unresolved queue/lease status. Derive eligibility through the existing fleet-scope implementation, not by counting all OAs or using a historical count. Require the owner to review any existing PostgreSQL warning's impact.

Review actual production bootstrap flags without exposing secrets: discovery, mapping apply, response-method apply, outbound recovery, and history sync can run from the worker startup script. No restart is safe merely because the source diff lacks worker code. The current SIGTERM handler stops recovery, closes the HTTP server and Nest context; the Mirror destroy hook cancels scheduling timers. It does not prove that every in-flight operation is drained. Confirm active operations/leases and deployment overlap/drain behavior before restart; preserve the mounted Manager profile volume and avoid overlapping ownership.

After deployment, compare exact eligible IDs/counts with the preflight set; verify successful raw Mirror cycles and raw message high-water marks per store over at least two completed fleet cycles. Check logs for credential/authentication, profile-lock, lease, duplicate-writer and database errors. Confirm existing LINE inbox receipt/reply paths remain operational and Sunn Secretary stays disabled. Do not substitute deployment SUCCESS or derived KPI updates for raw Mirror continuity.

Stop release if pre-deploy fails, the ledger/source changes, eligible coverage shrinks, a baseline healthy store stops cycling, profile ownership conflicts appear, or raw continuity cannot be established. Preserve evidence and use the existing supported recovery flow only with release authorization. A rollback restores an image/configuration, not database state or projection writes. Review restored variables and legacy pre-deploy/bootstrap behavior before rollback; never delete profiles, reset sessions or mutate migration history automatically. No production migration, deployment, restart, or messaging is authorized by this review document.
