# Live Mirror identity rollout — 2026-10-05

Implementation: [PR #469](https://github.com/supersunxm/line-unified-inbox/pull/469),
merged `55ab20eb6b06ded6ac07b5671a9731b5dbd7373d` after all six checks passed.
Normal Railway backend and worker deployments succeeded at that revision. The
concurrent OA/chat unique index was applied by normal deployment and is valid.
Private immutable metadata receipts remain on the worker persistent volume;
customer data and session material are absent from this report.

## Architecture

Reuse `Conversation.lineChatUserId`, scoped by `lineOfficialAccountId`, with
`LIVE_MIRROR_RECONCILED` provenance and the existing mapped timestamp. Preserve
the existing operator. Proof version `live-mirror-identity-v1` accepts only
completed exact canonical event identity under the contract documented in
[LIVE_MIRROR_IDENTITY_BRIDGE.md](LIVE_MIRROR_IDENTITY_BRIDGE.md). The hook runs
after successful canonical reconciliation, with transactional revalidation and
both directions of uniqueness. It adds no browser requests or profile leases.

## Initial read-only audit

| Classification | Count |
| --- | ---: |
| Eligible OAs | 144 |
| Mirror identities examined | 18,054 |
| Already linked | 5,687 |
| Safe candidates | 383 |
| Multiple Manager IDs | 0 |
| Multiple Conversations | 0 |
| Existing mapping conflicts | 0 |
| Insufficient evidence | 11,984 |
| Conversation-only no-evidence rows, separate denominator | 14,565 |
| Unexplained | 0 |

The candidates span 57 OAs/Stores, profile A 311 and B 72. All 383 have latest
Conversation activity in September 2026 using Bangkok month boundaries.
October, August, before August and unknown-date candidates are zero. Global
Manager event/chat reuse across OAs was explicitly checked; identity is never
treated as global or inferred from names.

## Frozen manifest and rollout

- Rows: 383; OAs: 57; Stores: 57.
- SHA-256: `06a29198332beb99ef4946a8e48476c34a25de8eaa98beacb366391c6a35fa5c`.
- Canonical row-set SHA-256:
  `f2006530cfc2d9da2fc819e967bbc50619258303d79dba1f3af5731bcf70733a`.
- Six-row representative canary, A3/B3 and six Stores: applied six, read back
  six, wrong OA/Store/Conversation/chat zero, second-run writes zero.
- Full manifest in 16 batches of at most 25: 377 additional writes and six
  already-correct canary rows. Every batch dry-run/apply/read-back/rerun passed.
- Stale/conflict skips, outside scope, protected-field changes and second-run
  writes: zero. Completed 10:13:43 UTC.
- All 6,578 preexisting linked Conversations retain exact identity,
  provenance, mapped timestamp and operator metadata. Total linked: 6,961.

## Post-rollout audits

At 10:13:59 UTC: 144 eligible OAs, 18,108 Mirror identities, already linked
6,127, safe remaining zero, all three conflicting classes zero, insufficient
11,981, conversation-only no-evidence 14,568 and unexplained zero. Ordinary
runtime evidence growth explains changes outside the fixed manifest.

The same frozen 16,638 nickname observations were independently reclassified
read-only: matched identities 4,980 → 5,276 and identity conflicts
11,658 → 11,362. The bridge closes exactly 296 observed gaps. No nickname
observation/classification was rewritten and no new Source manifest was built.
Post-audit classifications: mapped three, needs-update zero, no signal 3,722,
ambiguous zero, identity conflict 11,362, unknown 1,551, unexplained zero.

## Direct-link acceptance and explicit limitations

All 383 protected cache API targets match the exact frozen Conversation,
Store, OA and chat identity; wrong destinations and cold/stale fallbacks zero.
The deployed backend's actual read-only transport and response validator return
the expected URLs for all six canary rows. Actual authenticated app-button
redirects were verified for two canary rows and authenticated Manager chat
navigation for one. Remaining browser verification was blocked by URL policy
or authentication could not be confirmed. No policy workaround was attempted;
API target validation does not imply a completed authenticated browser visit.
An existing stored-bot direct link was also reverified after deployment.

13,749 eligible Conversations lack a proven identity and retain existing
fallback behavior. Unproven/ambiguous mappings stay untouched. There are no
October activity candidates to validate as a production sample.

## Validation and safety

Focused bridge real-database/contract tests 14/14, nickname regression 16/16,
related Mirror/resolver/lease tests 99/99, canonical/timeline/exact-manifest
tests 95/95, new cache/resolver/coordinator/Mirror regression 86/86, and real
HTTP cache endpoint tests 3/3 passed with zero skips. Touched lint, production
TypeScript/backend build, clean full migrations and diff checks passed. All
required PR checks passed. Broad test-inclusive backend TypeScript retains
preexisting fixture errors; a full backend suite pass is not claimed.

Project existing-identity overwrites, Conversation merges, Manager nickname
writes, LINE sends, Historical writes, Reply/KPI edits and Source Tag writes
are all zero. Original Source applications remain three. The separately
owner-disabled legacy nickname job remains FAILED/non-executable; protected
non-status fields are unchanged.

## Scheduled regression gate

The first naturally scheduled deployed-worker NORMAL cycle completed
09:35:46 UTC: 144/144 success, failures/partials zero, A93/B51. This preceded
the backfill and is not substituted for post-rollout regression.

**Pending:** next naturally scheduled post-rollout NORMAL 144/144 completion.
No forced cycle, health relaxation or fleet change is permitted.
