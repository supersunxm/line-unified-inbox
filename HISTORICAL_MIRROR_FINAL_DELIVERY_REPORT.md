# OPPO Historical Mirror — Final Delivery

## Current status

**DELIVERED_BACKEND_ACCEPTED.** The Store 30282 canary and seven representative cases passed production backend service-path acceptance. Exactly 4,052 freshly revalidated `LINK_SAFE` crosswalks were inserted; all persisted rows match current discovery, and ambiguous/conflicting links remain zero. The backend and frontend deployments are `SUCCESS`, and their readiness/root URLs returned HTTP 200. Signed-in UI confirmation remains pending.

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
- The production crosswalk is present. The merged service path returned all four imported Historical text rows plus the canonical anchor; duplicate source messages: **0**; missing Historical text: **0**; chronological ordering: **PASS**; second virtual chat: **0**.
- Screenshot display names were locator evidence only. The archive has nearby sticker and image events; both remain `NON_TEXT_NOT_BACKFILLED` and do not block text acceptance.
- Full forensic details and neighboring events are in [HISTORICAL_CONVERSATION_LINK_CANARY.md](HISTORICAL_CONVERSATION_LINK_CANARY.md).

The proven prior omission cause is that the existing canonical timeline path used `storeId + OA + lineChatUserId`; the canonical ID is null while the Historical Manager ID is populated. The source anchor proves the destination without changing either identity.

## Verified fleet and text visibility

The read-only production preflight verified all 137 eligible archive snapshots and excluded the two previously held stores, for 42,587 source text rows across 7,024 Historical identities. Store 30282 archive hashes match the approved ledger.

| Classification | Identities | Archive text candidates | Imported Historical text rows |
| --- | ---: | ---: | ---: |
| `LINK_SAFE` | 4,052 | 33,107 | 18,493 |
| `DIRECT_VISIBLE` | 886 | 6,190 | 2,554 |
| `NO_CANONICAL_ANCHOR` | 2,086 | 3,290 | 3,290 |
| `LINK_AMBIGUOUS` | 0 | 0 | 0 |
| `LINK_CONFLICT` | 0 | 0 | 0 |

There are 18,250 compatible unique canonical source anchors. Absolute timestamp drift is 3 ms at p50/p95, 5 ms at p99, and 88 ms maximum; none exceeds one second. Source-event anchors must also agree on Store, OA, direction, TEXT type, and full text.

Post-apply production acceptance reclassified all 7,024 identities, verified all 4,052 persisted links against the fresh safe set, and confirmed zero ambiguous, conflicting, or duplicate persisted links. Text visibility totals were **24,337 imported Historical rows**, comprising 2,554 direct-visible, 18,493 crosslink-visible, and 3,290 virtual-visible rows. The runner found 18,250 canonical-held source rows, zero archive-held rows, and zero duplicate timeline rows.

## Representative backend acceptance

The acceptance runner called the actual `ConversationsService.messages()` and virtual-chat service paths against a production repeatable-read, read-only transaction. Every case passed ordering, zero duplicate, zero missing text, and zero virtual-copy checks.

| Representative | Store | Link type | Source text | Historical rows returned | Canonical text rows returned | Duplicates / missing |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Central Pinklao | 29113 | Direct | 47 | 29 | 19 | 0 / 0 |
| Central World | 25610 | Direct | 62 | 26 | 62 | 0 / 0 |
| The Mall Bangkapi | 27627 | Crosslink | 95 | 41 | 54 | 0 / 0 |
| Saraburi | 30282 | Crosslink | 5 | 4 | 1 | 0 / 0 |
| Profile A | 28194 | Crosslink | 239 | 129 | 128 | 0 / 0 |
| Profile B | 30413 | Crosslink | 514 | 258 | 270 | 0 / 0 |
| High-volume linked | 30413 | Crosslink | 514 | 258 | 270 | 0 / 0 |
| Sparse linked | 865 | Crosslink | 2 | 1 | 1 | 0 / 0 |

The authenticated HTTP conversation endpoint was not called because no signed-in production session was available. Production service-path acceptance passed; browser confirmation is tracked separately.

## Implementation and safety

- The new `HistoricalConversationCrosswalk` table is additive and constrained to `LINK_SAFE`, non-null canonical destinations, `SOURCE_EVENT_ID` evidence, and a positive anchor count.
- Crosswalk persistence is insert-only. It refuses ambiguity/conflicts and refuses any existing row set that differs from the complete freshly computed safe set.
- Canonical conversation reads merge Historical rows with direct IDs or a safe Store/OA/conversation crosswalk. Duplicate suppression uses the stable source event ID against raw or Manager-prefixed canonical external IDs.
- Virtual Historical chats exclude direct identities, safe crosslinks, and identities with any canonical source-event match. No-anchor chats remain virtual and read-only.
- The dedicated production acceptance runner uses the actual `ConversationsService.messages()` and virtual-chat service paths inside a read-only repeatable-read transaction.
- Production crosswalk persistence performed exactly **4,052 INSERTs** into `HistoricalConversationCrosswalk`; no updates or deletes. The crosswalk discovery/apply/acceptance scripts did not write Conversation, Customer, canonical Message, owner, BM, follow-up, nickname, queue/job, or archive data, and invoked no LINE send path.

## Publication and deployment

- PR: [#371](https://github.com/supersunxm/line-unified-inbox/pull/371), merged after all required workflows passed.
- Merged commit: `b0bc04b322abaa0eb1feb708c7392433792176ba`.
- Backend `line-unified-inbox`: deployment `eb7f445a-cb05-44c0-ad21-4587fb75e624`, **SUCCESS**; `/health/readiness` returned HTTP 200.
- Frontend: deployment `87ad31d3-17a0-4efd-a60b-06b009479ba1`, **SUCCESS**; `https://lineoppo.click/` returned HTTP 200.
- Existing shared `backend/**` watch paths also triggered five other services: follower-backfill-worker, tiktok-daily-metrics-cron, rich-menu-publish-worker, line-chat-nickname-worker, and google-review-daily-collector. All five deployments report **SUCCESS**. No Railway configuration or variable changes were made.
- The backend log confirmed **157 migrations found; no pending migrations to apply**.
- Crosswalk persistence: **4,052 INSERTs**; fresh post-apply acceptance verified exact set equality, **0** duplicate links, **0** ambiguous persisted links, and **0** conflicting persisted links.
- Backend service-path acceptance: **PASS**. Authenticated HTTP conversation endpoint: **NOT RUN** (no signed-in session). Signed-in browser confirmation: **PENDING**.

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
- PR workflows: Application CI #752, Unified Auth CI #161, and TikTok public profile PoC #36 all passed.
- Production API readiness and frontend root probes: HTTP **200** each.
- Production backend service-path acceptance: **PASS**, read-only repeatable-read transaction.

## Earlier checkpoint, retained as history

The earlier text-only backfill attempt stopped on source-ID payload/scope rules before inserting rows. The production Historical read model now contains 24,337 rows from the separately approved prior import. The current crosswalk phase does not rerun or alter that import and does not treat display name, approximate time, or text alone as identity proof. The two archive-held stores remain excluded until their source hashes are independently resolved.

## Next action

Sunn can perform the signed-in visual confirmation. Backend delivery is accepted; no additional production data action is pending for this phase.
