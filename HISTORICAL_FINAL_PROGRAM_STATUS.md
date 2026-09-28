# HISTORICAL MIRROR — FINAL PROGRAM STATUS

Date: 2026-09-28 (Asia/Bangkok)
Worktree: /private/tmp/line-unified-inbox-historical-final-completion-20260928
Branch: codex/historical-final-completion-20260928
Base: origin/main at df527c7b8f852007ded02a78358c5039fd470163

## H1 Conflict Resolution

- Status: COMPLETE (100%).
- Disputed population 16,915 = 2,314 canonical equivalents with timestamp drift + 14,601 equivalents through persisted LINK_SAFE crosswalks.
- All 42,587 approved archive text candidates have a valid Historical or canonical representation: 24,337 Historical + 18,250 canonical.
- Ambiguous: 0. Payload conflict: 0. Scope conflict: 0. Unexplained: 0. Production inserts: 0.
- Final result: COMPLETE; two read-only production dry-runs confirmed no insert was needed.

## H2 Archive Recovery

- Status: COMPLETE as an evidence and hold decision (100%).
- Store 28326: 431 rows remain unproven and held; 0 released.
- Store 30606: 738 ledger-supported rows; 88 already represented canonically; 438 have no proven destination; 212 have scope conflicts.
- Final held: 1,081 (431 + 650); released: 0.
- Final result: Unsupported rows remain held. No further search is planned absent a genuinely new source.

## H3 Historical Media

- Architecture: No clean no-migration design exists. The production model has no typed media subtype or media metadata. Reusing sourceEventType loses its current meaning; encoding metadata in text makes media behave as text and risks analytics; provenance and identity columns have separate meanings.
- Migration required: YES. Add typed messageType, mediaMetadata, and fileName. Preserve sourceEventType, sourceEventId, archive provenance, direction, sentAt ordering, and unique Historical identity. Crosswalk resolution remains scoped and read-only; text analytics selects TEXT.
- Live Mirror restart required by normal deployment: YES. Railway line-chat-nickname-worker watches backend/prisma/**, including this migration. line-unified-inbox watches backend/** and its pre-deploy runs Prisma migrations and Store Master sync. frontend watches frontend/**.
- Local implementation: migration-based mapper, metadata-only backfill, read-only placeholders, and deterministic tests are complete on the feature branch. Production lacks the three columns; no migration or media backfill was applied.
- Branch: codex/historical-final-completion-20260928. PR: #379, draft and marked DO NOT MERGE. Deployment: none.
- Final result: READY_BUT_BLOCKED_BY_LIVE_MIRROR_ISOLATION (65%).

## H4 Names / Responders

- Historical identities: 7,748. Names recovered: 0.
- Manager responder evidence: 19,970 outbound events with source bizId across 282 distinct IDs.
- Auto: 6,799. Unknown: 5,154.
- Accounting: 19,970 + 6,799 + 5,154 = 31,923 outbound events.
- Final result: COMPLETE (100%); preserve UNKNOWN. No current Customer/User names were copied or changed.

## Safety

Live Mirror code modified: NO. Live Mirror config modified: NO. Live Mirror restarted: NO. LINE sends: 0. Canonical current-state mutations: 0. Historical production inserts and deployments: 0. Original dirty main checkout: untouched.

Root Markdown reports do not match Railway service watch paths, so docs-only publication is safe against the worker restart rule. The combined feature branch includes H3 migration and backend/frontend code and must remain unmerged under this gate.

## Git and Publication

- Feature commits 0258da2b and 8a3cfad4 are pushed. Draft PR #379 is open. Docs-only PR #380 is on codex/historical-final-reports-20260928; its prior head was 86545d1d.
- Current origin/main `4610df1a3db95afe158b91e576bdf201c23b80fc` was merged into the docs branch to resolve overlapping AI_PROGRESS.md and DECISIONS.md entries while preserving both histories.
- Pull requests: #379 (draft H3; DO NOT MERGE) and #380 (docs-only). Merged: no.
- Unmerged intentionally: #379 remains a draft because its migration triggers the Live Mirror worker watch. PR #380 remains unmerged pending post-push CI and GitHub mergeability checks.

## Changed-file inventory

H1:
- backend/scripts/historical-final-conflict-audit.ts
- backend/scripts/historical-timeline-backfill.ts
- backend/src/historical-source-classifier.ts
- backend/src/historical-source-classifier.spec.ts
- HISTORICAL_CONFLICT_RESOLUTION.md

H2:
- backend/scripts/historical-archive-recovery-30606.ts
- HISTORICAL_ARCHIVE_RECOVERY_28326.md
- HISTORICAL_ARCHIVE_RECOVERY_30606.md

H3:
- backend/prisma/schema.prisma
- backend/prisma/migrations/20260928100000_historical_media_snapshots/migration.sql
- backend/scripts/historical-media-backfill.ts
- backend/src/historical-media.ts
- backend/src/historical-media.spec.ts
- backend/src/historical-timeline.service.ts
- backend/src/historical-timeline.service.spec.ts
- frontend/src/app/historical-media-placeholder.ts
- frontend/src/app/historical-media-placeholder-view.tsx
- frontend/src/app/page.tsx
- frontend/src/components/chats/mobile-chats-app.tsx
- frontend/src/types/api.ts
- frontend/test/historical-media-placeholder.test.mts
- HISTORICAL_MEDIA_AND_RESPONDER_RECOVERY.md

H4 and shared evidence: backend/scripts/historical-final-evidence-inventory.ts; HISTORICAL_MEDIA_AND_RESPONDER_RECOVERY.md.
Shared validation tooling: backend/eslint.config.mjs; backend/tsconfig.historical-scripts.json.
Shared documentation: AI_PROGRESS.md; DECISIONS.md; HISTORICAL_FINAL_PROGRAM_STATUS.md; HISTORICAL_MIRROR_FINAL_COMPLETION_REPORT.md.

## Verification and limitations

Passed: 37 focused Historical tests; 606 frontend tests; backend/frontend builds; Prisma validation/generation; Historical-script TypeScript; changed-file ESLint; git diff --check; two read-only H1 dry-runs; H2 read-only production classification.

Existing failures: 790 full-backend lint violations, 14 unrelated full-backend test failures, and unrelated frontend TypeScript errors in app/test fixtures. Local app runtime check was unavailable because port 3000 belongs to an unrelated Node process and this worktree has no .env/DATABASE_URL or running Compose database. No unrelated process was stopped and no fallback port was used.

Overall: 91.25%.
FINAL STATUS: PARTIAL_BLOCKED_BY_LIVE_MIRROR_ISOLATION
