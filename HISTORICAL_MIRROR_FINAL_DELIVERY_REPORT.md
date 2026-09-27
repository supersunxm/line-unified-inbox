# OPPO Historical Mirror — Final Delivery

## Current status

**RELEASE_PENDING_ACCEPTANCE.** Store 30282 has been resolved from the verified archive and production source-event evidence. The additive crosswalk migration is applied. The backend timeline change has passed local checks but is not deployed; no crosswalk rows have been persisted yet. Backend/API acceptance, representative checks, and final delivery remain pending release.

This report supersedes the earlier `PARTIAL_BLOCKED` checkpoint below. That earlier text-only import preflight could not join rows whose canonical `Conversation.lineChatUserId` differed or was null. The current source-event crosswalk independently classifies each Historical identity and persists only uniquely anchored, exact Store/OA-scoped `LINK_SAFE` links. It does not change the historical or canonical chat IDs.

## Saraburi canary

- Store: `30282` — OBS Robinson Saraburi FL.2 By OPPO.
- Historical Manager ID: `Udbf1776bbad5d0095a7cc5f3273cbf1e`.
- Canonical Conversation: `e9f88a82-ffc4-45c0-b755-20a847fa6ef4`.
- Canonical `lineChatUserId`: `null`.
- Evidence anchor: source event `631303932702359672`, deterministic identity `line-chat-manager:631303932702359672`.
- Canonical Message: `735e0b36-05c9-4ff8-96f1-0dc67038be10`, external ID `631303932702359672`.
- Store/OA, direction, type, and text match exactly. The canonical timestamp is 3 ms later than the archive timestamp.
- Five archive text events belong to this Historical identity; four are already in the Historical read model and the anchor is represented canonically. The expected crosswalk classification is `LINK_SAFE`, with one anchor and no conflict/ambiguity reasons.
- Screenshot display names were locator evidence only. The archive has nearby sticker and image events; both remain `NON_TEXT_NOT_BACKFILLED` and do not block text acceptance.
- Full forensic details and neighboring events are in [HISTORICAL_CONVERSATION_LINK_CANARY.md](HISTORICAL_CONVERSATION_LINK_CANARY.md).

The proven prior omission cause is that the existing canonical timeline path used `storeId + OA + lineChatUserId`; the canonical ID is null while the Historical Manager ID is populated. The source anchor proves the destination without changing either identity.

## Verified fleet preflight

The read-only production preflight verified all 137 eligible archive snapshots and excluded the two previously held stores, for 42,587 source text rows across 7,024 Historical identities. Store 30282 archive hashes match the approved ledger.

| Classification | Identities | Archive text candidates | Imported Historical text rows |
| --- | ---: | ---: | ---: |
| `LINK_SAFE` | 4,052 | 33,107 | 18,493 |
| `DIRECT_VISIBLE` | 886 | 6,190 | 2,554 |
| `NO_CANONICAL_ANCHOR` | 2,086 | 3,290 | 3,290 |
| `LINK_AMBIGUOUS` | 0 | 0 | 0 |
| `LINK_CONFLICT` | 0 | 0 | 0 |

There are 18,250 compatible unique canonical source anchors. Absolute timestamp drift is 3 ms at p50/p95, 5 ms at p99, and 88 ms maximum; none exceeds one second. Source-event anchors must also agree on Store, OA, direction, TEXT type, and full text.

## Implementation and safety

- The new `HistoricalConversationCrosswalk` table is additive and constrained to `LINK_SAFE`, non-null canonical destinations, `SOURCE_EVENT_ID` evidence, and a positive anchor count.
- Crosswalk persistence is insert-only. It refuses ambiguity/conflicts and refuses any existing row set that differs from the complete freshly computed safe set.
- Canonical conversation reads merge Historical rows with direct IDs or a safe Store/OA/conversation crosswalk. Duplicate suppression uses the stable source event ID against raw or Manager-prefixed canonical external IDs.
- Virtual Historical chats exclude direct identities, safe crosslinks, and identities with any canonical source-event match. No-anchor chats remain virtual and read-only.
- The dedicated production acceptance runner uses the actual `ConversationsService.messages()` and virtual-chat service paths inside a read-only repeatable-read transaction.
- Current release actions so far: one additive migration applied; zero crosswalk rows written; zero Conversation, Customer, Message, owner, BM, follow-up, nickname, queue/job, archive, or LINE-send mutations performed by this task.

## Migration and deployment

- `20260927120000_add_historical_conversation_crosswalk`: **APPLIED**. It was the only pending production migration.
- Backend release and Railway readiness: **PENDING**.
- Crosswalk rows: **PENDING deployment and the apply script’s repeated production preflight**.
- Canary and representative backend/API acceptance: **PENDING**.
- Signed-in browser acceptance: **PENDING**; it is not required to establish the backend service-path result.

## Verification

- Prisma schema validation: passed.
- Historical script TypeScript (`tsconfig.historical-scripts.json`): passed.
- Touched-file backend ESLint: passed.
- Focused backend historical/conversation tests: **60/60 passed**.
- Backend production build: passed.
- Frontend tests: **604/604 passed**.
- Frontend production build: passed; Next.js reports that it skips its separate TypeScript validation.
- Separate full frontend `tsc --noEmit`: existing unrelated errors remain in auto-responses, broadcast, follower insights, Store 360, and stale test fixtures.
- Full backend suite: **2,323/2,338 passed**; the 14 failures are in unrelated auth/store-context, missing Vitest modules, nickname/health/worker/Store Insights fixtures, and a Playwright Dockerfile expectation. Full backend `tsc` also reports unrelated existing source/spec diagnostics; Nest production build passes.
- `git diff --check`: passed.

## Earlier checkpoint, retained as history

The earlier text-only backfill attempt stopped on source-ID payload/scope rules before inserting rows. The production Historical read model now contains 24,337 rows from the separately approved prior import. The current crosswalk phase does not rerun or alter that import and does not treat display name, approximate time, or text alone as identity proof. The two archive-held stores remain excluded until their source hashes are independently resolved.

## Next action

Commit/push and merge the reviewed branch under approval `SUNN-HISTORICAL-FINAL-COMPLETION-20260927`, monitor the backend and any services triggered by existing Railway watch paths, then persist the freshly revalidated safe crosswalk and run the read-only canary/representative acceptance runner. Update this report with actual production results before declaring final delivery.
