# Store 30282 Historical Conversation Link Canary

## Result

The Store 30282 Manager chat is deterministically linked to one canonical Conversation. The production read-only preflight classified the identity as `LINK_SAFE`; it has one compatible source-event anchor and a 3 ms timestamp difference. The canonical Conversation has no `lineChatUserId`, which explains why the prior Store/OA/chat-ID query omitted this Historical chat.

The additive crosswalk migration has been applied. The timeline change and crosswalk persistence are awaiting the authorized release deployment; no crosswalk rows have been written yet.

## Scope and archive integrity

- Approval: `SUNN-HISTORICAL-FINAL-COMPLETION-20260927`.
- Store: `30282` — OBS Robinson Saraburi FL.2 By OPPO.
- Store ID: `c3e1d1d4-fade-4890-8d9e-53d0cf36e72e`.
- OA ID: `d3d40e82-b19b-40e7-b535-638b8f8d8f96`.
- Historical `lineChatUserId`: `Udbf1776bbad5d0095a7cc5f3273cbf1e`.
- Source page identity: `a426c87c360f25e1c74dbf6b8d14258f00e84b8e0258f5eae75aa011bc2eebf7`.
- Full-fleet registry SHA-256: `8c0cfb6e37e9c736c265db6ba43d1c921d566573651742631a85c911daa8972f`.
- Approved archive hash ledger SHA-256: `e7e2f87a856b2e83b31a7baa07d7f30e9fa42b598b75f1a51fbeba02ea05a5a0`.
- All seven Store 30282 archive files match the approved ledger.

The screenshot’s customer label and the Manager label `Reno15F 09/69` were used only to locate the candidate. The archive inventory and an automated welcome message render the customer name as `ส.สายวสันต์`, while the screenshot says `ส.สายสันต์`. That display-name difference was not used as identity evidence.

## Source conversation evidence

All listed rows share the same Store/OA, Historical chat identity, and source page identity. Bangkok time is UTC+7.

| Bangkok time | Source event ID | Direction / type | Text or metadata |
| --- | --- | --- | --- |
| 16:08:55.866 | `event:follow:c957283a38b22866b1537214455a0b5b397ad765fdd0c1b546d01820dbd0b5bb` | UNKNOWN / follow | New follow event |
| 16:08:56.678 | `631303875793519149` | OUTBOUND / text | Automated welcome; contains `OPPO RBS Saraburi` |
| 16:08:56.679 | `631303875894182135` | OUTBOUND / text | `ส่วนลดพิเศษ เฉพาะคุณเท่านั้น อย่าลืมมาใช้สิทธิ์นะคะ` |
| 16:08:56.680 | `631303875777527886` | OUTBOUND / text | `ติดฟิล์มกันรอยฟรี ได้ที่ OPPO BRAND SHOP ` |
| 16:09:07.757 | `event:chatread:b036ea8ff377e000fc1ea590bd0a5a35ddc89ebd1494e7b0a3a5abf48de21265` | UNKNOWN / chatRead | Same Manager chat |
| 16:09:30.543 | `631303932702359672` | INBOUND / text | `Reno15F 8/256 Bl ` |
| 16:21:18.826 | `631305120948945036` | OUTBOUND / sticker | Package `11537`, sticker `52002739` |
| 16:21:34.934 | `event:chatread:fe4ee40fba2212f8d7f6c6771978cabdbf8cd9be6eff667143465af08ae84e3a` | UNKNOWN / chatRead | Same Manager chat |
| 16:22:10.355 | `631305207384375864` | OUTBOUND / image | Image binary is not part of the text archive |
| 16:22:21.486 | `event:chatread:24a0250f38ab8b8951fdb29da3a3e5c3b1a0865fbf24a6680c5998e8ab0b8bdb` | UNKNOWN / chatRead | Same Manager chat |
| 16:23:03.095 | `631305295934521540` | OUTBOUND / text | `ใบเสร็จค่ะ ` |
| 16:23:03.458 | `event:chatread:d000aa1cc9f4d645767627a796307db62b2bd5f3fc940c03505fa41b97797e0b` | UNKNOWN / chatRead | Same Manager chat |
| 16:23:34.517 | `631305348649058730` | INBOUND / sticker | Package `11538`, sticker `51626520` |

The archive has 15 events across two complete history pages for this conversation, from 16:08:55.866 through 16:29:39.065. Five are Historical text candidates. Four are already in `HistoricalTimelineMessage`; the canary text anchor is represented by the canonical Message.

## Canonical source anchor

The read-only production query found exactly one canonical match for source event `631303932702359672`:

- Message: `735e0b36-05c9-4ff8-96f1-0dc67038be10`.
- `externalMessageId`: `631303932702359672`.
- Conversation: `e9f88a82-ffc4-45c0-b755-20a847fa6ef4`.
- Store/OA: the exact Store 30282 and OA IDs above.
- Canonical `Conversation.lineChatUserId`: `null`.
- Direction/type/text: INBOUND / TEXT / `Reno15F 8/256 Bl `; text matches exactly.
- Historical time: `2026-09-11T09:09:30.543Z`.
- Canonical time: `2026-09-11T09:09:30.546Z`.
- Absolute drift: 3 ms (fleet-compatible maximum observed: 88 ms).
- Manager deterministic identity: `line-chat-manager:631303932702359672`.

The five Historical text source IDs all converge on this one identity and the compatible anchor points to exactly one canonical Conversation. Classification: **LINK_SAFE**; anchor count: **1**; ambiguity/conflict reasons: **none**.

## Fleet preflight

Fresh production discovery, with archive hashes revalidated, found 7,024 Historical identities and 42,587 verified archive text rows:

| Classification | Identities | Source text rows | Already imported Historical rows |
| --- | ---: | ---: | ---: |
| LINK_SAFE | 4,052 | 33,107 | 18,493 |
| DIRECT_VISIBLE | 886 | 6,190 | 2,554 |
| NO_CANONICAL_ANCHOR | 2,086 | 3,290 | 3,290 |
| LINK_AMBIGUOUS | 0 | 0 | 0 |
| LINK_CONFLICT | 0 | 0 | 0 |

There are 18,250 compatible unique canonical source-event matches. Absolute timestamp drift is 3 ms at p50, 3 ms at p95, 5 ms at p99, and 88 ms maximum; no compatible match exceeds one second.

## Read-path explanation and release status

Before the crosswalk read path, `ConversationsService.messages()` selected Historical rows using the canonical Conversation’s `lineChatUserId`. For this canary that canonical field is null, while the Historical source uses `Udbf1776bbad5d0095a7cc5f3273cbf1e`; the Historical rows therefore could not enter that canonical timeline. The new path selects LINK_SAFE Historical identities by exact Store, OA, and canonical Conversation, and deduplicates using the stable source event ID. The source anchor itself remains one canonical message.

The new migration `20260927120000_add_historical_conversation_crosswalk` is applied. It permits only `LINK_SAFE` evidence rows. Production crosswalk persistence, backend deployment, and post-deployment canary/API acceptance are pending. Stickers and images remain `NON_TEXT_NOT_BACKFILLED`; their absence does not block text acceptance.
