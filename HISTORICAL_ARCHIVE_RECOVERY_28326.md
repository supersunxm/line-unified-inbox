# Historical Archive Recovery — Store 28326

Status: **UNPROVEN — HOLD**

The current Store 28326 bundle contains 431 target-period text rows across 73 chats, but none of its seven required files match the current full-fleet ledger. Its current `events.ndjson` is 1,351,674 bytes with SHA-256 `fdd502bacc1fc5218bba3e99b2d434c8bba07a5f1895dc06d9c98f54b7d3cff9`; the ledger expects an empty events file (0 bytes, SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).

The older local snapshot at `backend/local-data/mirror-historical-20260925-evidence/store-28326` matches all seven hashes in the current ledger. That approved snapshot contains an empty event file and zero target-period text rows. Its validation says inventory was partial and discovered zero conversations; it does not independently prove the 431 rows in the changed bundle.

| Measure | Rows |
|---|---:|
| Changed bundle target-period text rows | 431 |
| Proven from an approved source | 0 |
| Released to Historical processing | 0 |
| Held | 431 |

No production lookup or write was needed to preserve the hold. No archive, registry, ledger, or production data was changed. The 431 rows remain held until an independent Historical source establishes event-level provenance.

Additional evidence search: local Git refs/history and targeted Google Drive metadata searches for Store 28326, Historical Mirror archives, `events.ndjson`, and the fleet hash ledger found no independent source archive or Manager collection run. GitHub PR searches for `28326` returned no matching PR. Historical PRs #368/#369 document an earlier 0-row backfill blocker; PR #371 records fleet crosswalk evidence for a different canary and adds no Store 28326 provenance. No separate read-only Manager retrieval path was available without using the shared worker runtime.
