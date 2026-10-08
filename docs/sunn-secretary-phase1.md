# เลขาซันน์ / Sunn Secretary — Phase 1 foundation

Status: **Foundation only; LINE Bot is NOT enabled or deployed by this change.**

## Pilot user experience

In one allowlisted LINE group, the owner tags the LINE OA bot:

> @เลขาซันน์ วันนี้เดือนตุลาคม LINE OA ไหนยังค้างตอบลูกค้าเท่าไหร่

Bot returns, from authorized server-side data only, the month-scoped **number of unanswered conversations per store**, total, Bangkok reporting month, source freshness timestamp, and a clear partial/unknown status when the metric cannot be verified. Do not confuse conversation counts with message counts or the 24-hour reply KPI. Never fabricate a number.

## Confirmed reuse points (main branch audit 2026-10-08)

- Existing NestJS backend has `ConversationsController` and an authenticated `GET /conversations/bm-reply-status-summary?month=YYYY-MM` returning month-scoped counts after `StoreAccessService.accessibleStoreIds` filtering.
- Existing LINE webhook at `POST /webhook/:webhookKey` validates the raw body HMAC signature and feeds the existing store OA ingestion path.
- Existing AI modules live under `backend/src/ai/`. The secretary must be logically isolated from the customer-facing BI assistant and from store OA ingestion.
- Frontend monthly metrics refactor is in PR #518. Do not duplicate counting rules; evaluate the final merged metrics contract before wiring.

## Security boundaries

1. Create a **dedicated LINE Official Account / Messaging API channel** for เลขาซันน์. Never reuse a store OA webhook key or channel secret.
2. Separate secret, callback route, permissions, event idempotency and group allowlist. Verify `X-Line-Signature` against the dedicated channel secret using raw bytes, before parsing or acknowledging actionable events.
3. Authorize BOTH LINE group ID **and** sending LINE user ID against explicitly provisioned owner/admin identities; group membership alone is insufficient. Deny unknown users, chats and groups with a safe generic response or silence. Do not trust the mention text as identity.
4. Bot must respond only to explicit `@เลขาซันน์` mentions or a controlled command prefix. Do not watch/answer every ordinary group message.
5. Use an explicit server-side query adapter under an authorized principal. Do not proxy arbitrary backend routes, issue client-controlled SQL, or reuse someone else's bearer token.
6. Limit access to permitted store scopes and aggregate-only outputs; exclude customer message contents, customer identities, access tokens and cross-store private data from prompts/logs.
7. Follow effective Dashboard / Chats month counting logic, Bangkok month boundaries, `NOT_REPLIED` definition, historical timeline inclusion and ambiguous/unverifiable reporting semantics. Match the UI summary for the same permission scope, month and snapshot.
8. Use **read-only** operations in Phase 1. No outbound customer LINE messages, reply-status mutation, backfill, Mirror worker or Prisma schema change.
9. Use a short queue/timeout, deduplicate webhook event IDs, rate-limit per sender and group; log redacted correlation IDs, duration, status, count and metric freshness only. Fail closed if data freshness or access checks fail.
10. Ensure privacy disclosure and retention limits for group messages; preserve minimal commands rather than collecting all group discussion.

## Implementation increments (separate PRs)

- **PR 1 (this PR):** isolated Thai question intent normalization + tests and architecture contract. No provider secrets needed; no runtime hookup.
- **PR 2:** read-only authorized analytics query adapter delegating to established `getBmReplyStatusSummary` monthly endpoint/service contract; exact numeric parity integration tests, unknown-data handling.
- **PR 3:** dedicated LINE secretary webhook, group/sender allowlist, HMAC signature, replay protection, mention parsing, rate limit, outbound LINE reply with strict response-size constraints and an integration test using a fake sender. Disabled without dedicated credentials.
- **PR 4:** production pilot in one consented allowlisted group; observed parity with the same month and store scope in `lineoppo.click`, no invented counts; CI and Railway verification.

## Acceptance criteria

- Query: `@เลขาซันน์ วันนี้เดือนตุลาคม LINE OA ไหนยังค้างตอบลูกค้าเท่าไหร่`.
- Correct year and month in Bangkok time; totals sum exactly from returned store entries, no reply-KPI substitution.
- Forbidden group/sender: zero sensitive data disclosure and no unauthorized request to analytics.
- Unknown, delayed, partial or stale Mirror state is shown as an explicit caveat, not silently zero.
- Security, build and CI gates green before merge; **merge commit only**, never bypass branch protection.
- No changes to current store webhook, raw/historical mirror workers, deployment config or schema in Phase 1.

## External setup needed for later pilot

A new LINE OA named **เลขาซันน์**, its Messaging API channel ID/secret/access token, a consenting test group ID and the owner's verified LINE user ID. Store only as Railway secrets, never in repository, issue descriptions or chat logs.
