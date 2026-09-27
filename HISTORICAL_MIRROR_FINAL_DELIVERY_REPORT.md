# OPPO HISTORICAL MIRROR — FINAL DELIVERY

## Goal
Make LINE OA Manager text messages from 1 September 2026 onward available in lineoppo.click alongside current messages, with safe identity handling, read-only Historical views, and Historical-aware reply reporting.

## Status

**PARTIAL_BLOCKED — local implementation and verification are complete; production backfill, deployment, and acceptance verification have not run.**

The Railway production backend and frontend deployments currently report SUCCESS. No Historical timeline migration or application deployment was performed during this phase.

## Historical source coverage

- Strict stores inspected: 139.
- Archives with verified current hashes: 137; held: 2 (Stores 28326 and 30606).
- Target-period text candidates: 43,756; 42,587 from verified archives and 1,169 held with the two changed archives.
- Target-period chats: 7,217; 7,024 from verified archives and 193 held.
- Earliest text: 1 September 2026, 00:29:10 Asia/Bangkok.
- Source identity duplicates and conflicts in the archive scan: 0.
- Production migration was not applied, and the approved archive inputs have not been backfilled into the read model.
- Current production LineChatMirrorMessage rows contain chatRead events, not message text.

## Implementation prepared locally

- Additive `HistoricalTimelineMessage` table with source hashes, deterministic row IDs, and source identity constraints.
- Insert-only, restart-safe backfill command that verifies archive hashes and current Store/OA mappings, skips exact duplicates, and fails closed on conflicts.
- Authenticated read API for Historical-only chats and replies analytics.
- Unified ordering and exact-source deduplication for canonical and Historical messages in existing conversations; reply KPI bucket drilldowns use the same merged evidence, including read-only virtual chats.
- Separate read-only Historical chat discovery and virtual conversations. No send, retry, assignment, BM/follow-up, or customer mutation path is enabled for virtual chats.
- Reply-time analytics merge canonical and Historical text; responder IDs are reported only when source metadata carries a stable identifier.
- Rename/nickname validation status is UNKNOWN: the archive preserves customer profile display names but does not preserve the actual LINE OA Manager nickname observed at the time. No automatic rename is performed.

## Production deployment and safety

- Backend/frontend/worker deployments performed for this phase: none.
- Database migration applied: no.
- Production Historical backfill: no.
- Historical-caused LINE sends, operational-state changes, or duplicate production rows: 0, because no production read-model write occurred.
- Production endpoint smoke tests: not run.
- Destructive migrations: none proposed; the migration is additive.

## Verification

- Prisma schema validation: passed.
- Backend TypeScript build: passed.
- Historical-focused backend tests: 10 passed.
- Backend targeted ESLint: passed.
- Frontend targeted ESLint: passed.
- Frontend build: passed.
- Frontend tests: 593 passed.
- Full backend tests: 2,093 passed; 14 failed in existing auth/store-context, send-retry, nickname/health, image relay, Store Insights, and other unrelated cases. All Historical-focused tests passed; the 14 failures are in test files and code paths outside this change.
- Frontend TypeScript check: existing errors remain in Auto Responses, Google Review, Store 360, and test fixtures; none are in the changed Historical timeline/API/UI files.
- PostgreSQL migration integration passed in PR CI against a clean database. A repeat local frontend build was blocked by sandbox denial of Turbopack's local port binding; PR frontend CI build passed. Local API runtime checks and production health/endpoint smoke tests could not be run from this environment.

## Exceptions

- Archive-held: Stores 28326 and 30606 (1,169 target text events, 193 chats); source hashes changed without an approved explanation.
- Parent missing, Manager conflicts, and the 11 remaining raw chatRead identity conflicts stay outside this text-read-model scope; prior proven raw chatRead reconciliation completed with 0 safe missing records at its checkpoint.
- Non-text media and non-message event types are not included.
- Historical responder display names are not available in normalized archive metadata. 16,006 target outbound text events have a stable non-auto `bizId`; they can be grouped by a masked source identity after backfill, without inventing a staff name.
- Production Store/OA mapping and exact canonical-message deduplication still require the fresh production preflight in the backfill command.

## Acceptance

1. Historical text visible in production for all safely mappable coverage: **not met** — read-model rows have not been backfilled.
2. Historical/current ordered timeline: **implemented locally, production unverified**.
3. Project-created duplicate timeline records: **0 observed; production comparison pending**.
4. Operational-state protection and no customer-facing actions: **read/write boundaries implemented; production verification pending**.
5. 24-hour KPI and responder analysis: **implemented locally; production coverage unavailable until backfill**. Nickname status remains UNKNOWN because observed Manager nicknames are absent from the source.
6. Exclusions classified: **archive holds classified; full production Store/OA exceptions require fresh mapping preflight**.

## Required manual action

Provide a controlled one-off execution path that lets the approved backfill command access both the private Historical archive directory and the production database without exposing database credentials to this agent. The production Railway MCP connection currently redacts variable values, the Railway runtime has no Historical archive volume, and this shell cannot resolve the production host. Once that execution path exists, the command is ready to run with approval ID `SUNN-HISTORICAL-FINAL-COMPLETION-20260927`.
