# Historical Media and Name/Responder Evidence

## H3 — Media inventory

The fresh hash-verified scan covered 137 approved archives and 82,919 target-period archive events. All 10,852 supported non-text events have a stable event identity, timestamp, chat identity, direction, type metadata, and a source reference ID. No media bytes or binary media artifacts are present in the approved archive files. Each event is therefore `METADATA_ONLY`; the reference ID's current availability was not tested, so no reference is described as expired.

| Type | Total | Full bytes | Metadata-only placeholder | Key metadata found |
|---|---:|---:|---:|---|
| Sticker | 4,190 | 0 | 4,190 | package ID and sticker ID for all 4,190 |
| Image | 6,513 | 0 | 6,513 | source reference for all 6,513 |
| Video | 79 | 0 | 79 | duration for all 79 |
| File | 70 | 0 | 70 | file name for all 70 |

Stable source identity duplicates: 0. Missing type metadata or source references: 0. Ambiguous media identity rows: 0. The local implementation stores typed Historical rows with no fabricated text and renders “Historical … unavailable” placeholders. A production dry run and release remain pending the additive schema deployment gate.

## H4 — Historical names and responders

The approved archives contain 7,748 distinct Store/chat identities and no timestamped chat names, display names, nicknames, rename observations, or owner names. Name evidence: 0 identities; no-name identities: 7,748; conflicting snapshots: 0. No current Customer name or User record was read or changed to fill this gap.

Among 31,923 outbound Historical message events, 19,970 carry a non-auto Manager `bizId`, 6,799 carry auto-response evidence, and 5,154 have no responder marker. The 19,970 known-source replies represent 282 distinct `bizId` values. None was mapped to a current internal User because the archive supplies no proven user link. Existing Historical analytics already use the source `bizId` and auto-response marker; unknown attribution stays unknown.

Production analytics acceptance is pending a fresh production read-only check. No current user identity, current Customer state, or Live Mirror behavior was changed.

## Final H3 isolation decision

Migration required: YES. Existing production columns cannot encode media subtype/metadata while preserving the meanings of sourceEventType, text, stable identity, and archive provenance. The typed migration is the correct local design. Normal Railway deployment matches line-chat-nickname-worker's backend/prisma/** watch, so production deployment would restart Live Mirror. No migration, backfill, or restart occurred; H3 remains READY_BUT_BLOCKED_BY_LIVE_MIRROR_ISOLATION.
