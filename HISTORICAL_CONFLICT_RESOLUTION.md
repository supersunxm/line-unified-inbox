# H1 — Historical Conflict Resolution

The fresh audit read all 42,587 candidates from the 137 hash-verified archives and used a repeatable-read, read-only production transaction. The H1 conflict population was recomputed as verified candidates with a canonical raw or `line-chat-manager:` source ID whose Store/OA/chat/payload/timestamp did not meet the previous strict exact check.

| Classification | Rows |
|---|---:|
| `CANONICAL_EXACT` across the full inventory | 1,335 |
| `CANONICAL_EQUIVALENT_WITH_TIME_DRIFT` in the conflict population | 2,314 |
| `CANONICAL_EQUIVALENT_VIA_SAFE_CROSSWALK` in the conflict population | 14,601 |
| `SAFE_HISTORICAL_MISSING` across the full inventory | 21,047 |
| `NO_PROVABLE_DESTINATION` across the full inventory | 3,290 |
| Ambiguous, payload conflict, scope conflict, archive not approved | 0 |

The recomputed conflict population is **16,915**: 2,314 same-identity payload matches with timestamp drift plus 14,601 payload matches whose historical chat identity maps to the exact canonical Conversation through one persisted `LINK_SAFE` crosswalk. Every conflict row matches Store, OA, direction, TEXT type, and full text. The historical and canonical `lineChatUserId` values were not changed.

All 16,915 canonical rows have a later `sentAt` than the archive event. Signed drift is +2 ms to +88 ms; absolute median and p95 are +3 ms. No tolerance was introduced. Duplicate canonical source rows: 0. The full candidate accounting is 42,587 classified, 0 unexplained. No new Historical row is needed for the 16,915 disputed candidates; safe inserts in that population: 0.

The private row-level audit, including both texts and per-row hashes, is stored with mode 0600 under ignored local archive data. Tracked progress and this report contain only aggregate counts and timing evidence. Two fresh production repeatable-read dry-runs each found 24,337 exact Historical rows, 18,250 canonical rows, zero held rows, and zero planned inserts across the 42,587 candidates. No production insert was needed. The existing Historical timeline regression suite passed.
