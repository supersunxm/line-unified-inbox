# Historical Archive Recovery — Store 30606

Status: **PARTIALLY_PROVEN — 88 CANONICAL, 650 HELD, 0 RELEASED**

The prior snapshot at `backend/local-data/mirror-historical-20260925-evidence/store-30606` matches all seven per-file hashes in the current central ledger. Its `events.ndjson` is 1,692,444 bytes with SHA-256 `29de1a4e8aaeebd95323d900dd3a99e2fec0708d9bb05686b7e304291d35ed9e`. A fresh row scan found 738 target-period nonempty text events across 120 chats, with no duplicate source IDs or missing event identity fields.

The approved snapshot's collection validation is `PARTIAL`: 404 relevant conversations were selected, four are `INCOMPLETE`, and the run has four failures. Across the archive, it contains 1,914 events, zero conflicting duplicate identities, and three exact duplicate events. Therefore, the 738 rows present in the hash-proven event file are individually proven; this snapshot does not prove that collection reached the target for every relevant conversation.

| Measure | Rows |
|---|---:|
| Target-period text rows observed and event-level identity validated | 738 |
| Ledger-supported source rows | 738 |
| Already represented canonically, exact | 50 |
| Already represented canonically, timestamp drift | 38 |
| Already represented through `LINK_SAFE` | 0 |
| Released as new Historical rows | 0 |
| Held without a direct or `LINK_SAFE` destination | 438 |
| Held for canonical Store/OA/chat scope conflict | 212 |
| Total held source rows | 650 |
| Chats represented | 120 |

The production check used a repeatable-read, read-only transaction and found no rows eligible for Historical insertion. The 212 conflicts are all `CANONICAL_SCOPE_CONFLICT`; the 438 remaining rows have no direct production conversation or unique `LINK_SAFE` destination. No production writes occurred. The fresh bundle differs from the ledger on five of seven files. The four incomplete conversations and four collection failures leave additional archive coverage unproven; missing event counts cannot be inferred from this snapshot.

The seven prior-snapshot hashes match the current central ledger:

| File | SHA-256 |
|---|---|
| `manifest.json` | `c094b195bc3b2f2c0751777cd59f760c87f2ed7f7bce3b8162782c0ea7dd460b` |
| `inventory.ndjson` | `afa085abc0afcd37a07316ae7022a1cd4fef02ffed16217d4b29b74bab3aac9f` |
| `conversations.ndjson` | `92c90674e503a7a40f2e90662e8f516d1d7bc72c250de90355c8b23bffdcd5ed` |
| `events.ndjson` | `29de1a4e8aaeebd95323d900dd3a99e2fec0708d9bb05686b7e304291d35ed9e` |
| `checkpoints.json` | `d83dc44c92d7c39a260f2de09270849a35b2841305025f3c8c201d093b3a4b80` |
| `validation.json` | `9e2ae1db97e3b0d83644e891d058423b38dc471f1ccff7bdb5a7e14aabf52c85` |
| `run-summary.json` | `a613fde18b99f5deb1be58f79013a94ab08590819799f727c6cca6bdc19f5ce4` |

Additional evidence search: targeted Google Drive metadata searches for Store 30606, Historical Mirror archives, `events.ndjson`, and the fleet hash ledger found no independent archive or Manager collection run. GitHub PR search for `30606` returned no matching PR. PR #371 records a fleet crosswalk preflight and Store 30282 canary only; PRs #368/#369 repeat the earlier 0-row backfill blocker. These artifacts do not add row-level evidence for Store 30606. No separate read-only Manager retrieval path was available without using the shared worker runtime.
