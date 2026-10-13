# Live Mirror PR1 — Preserve distinct exact message identities during dedupe (P0)

2026-10-13. **Identity collision fixed in code; production remains unverified.**
Delivery: [draft PR #548](https://github.com/supersunxm/line-unified-inbox/pull/548). Validated code commit: `e7c6c43fd400cf0e465e3dfff814a0f39843c934`.
This is original PR1 of the approved seven-PR Root Cause and Remediation Report (§G), not a new numbering of that plan. No dependency on PR545, PR2 or PR3 is required for this core fix. No other remediation PR is implemented here.

## Evidence and root cause

The Oct 13 report (§C, E3 identity-cases-59.csv, C1/C2/C6) proves seven Raw source identities were linked to another exact Manager identity's Canonical record. The single content/time candidate branch certified DUPLICATE within ±2 seconds without comparing source IDs, skipped import, and placed those Raw rows outside normal retry selection. Distinct source IDs were therefore underrepresented. Whether LINE considers any pair a provider echo still requires independent source evidence; similarity cannot certify equivalence.

Current main and backend deployment source were verified as `428f04bafc7572b25e619e7a91226ba17cd2bbe2`. Backend deployment: `796f9edc-ab0f-40bb-aa8c-c1bede6f1de8`, SUCCESS. Worker deployment: `5d130d65-105e-42a7-9101-2784edd9c6a5`, source `b890c9dbb87604449152f65c67ecff65da487028`, SUCCESS. Main still contained the same defective branch. Deployment SUCCESS is not message-completeness proof.

The dirty primary branch (`feat/google-review-rating-metadata`) and existing worktrees/open PRs were inspected. Implementation uses `codex/live-mirror-exact-identity-pr1` in a separate temporary bare repository/worktree based on main. No changes from the primary checkout or other pending branches are included.

## Identity rules

- Exact source lookup accepts the raw or `line-chat-manager:` external identity, and existing OA-scoped explicit provider/Manager payload aliases. More than one claimant is held, not selected arbitrarily.
- Every accepted exact receipt must agree on conversation, Store, OA, direction, delivery status and nonconflicting authoritative identities. Exact-manifest payload/time/media preconditions remain strict.
- Inbound external IDs are authoritative webhook `message.id` by the existing webhook persistence contract. Namespaced Manager outbound external IDs are authoritative. Application outbound external IDs are client keys: provider/Manager payload aliases are required to prove their source identity. Numeric resemblance is not evidence.
- A near-match with one proven different source ID never certifies DUPLICATE. Mapped outbound events retain their own source ID; unmatched inbound events continue waiting for their exact webhook record.
- An ID-less, conflicting or incompletely examined near-match is AMBIGUOUS / CONTENT_TIME_IDENTITY_UNPROVEN, with no new Canonical link or blind import. Blank, whitespace-altered and event-only synthetic source identities are held. UNKNOWN direction remains skipped under the existing rule.
- The near-match scan stays within the existing conversation/direction/type/content/±2s window, bounded to 100 metadata candidates. A saturated set fails closed. No new recurring task, service, schema, index, provider request or historical query is added. Exact alias lookup may cost more than external-ID-only lookup; approved rollout must compare query latency and index plans. This is not a cost-neutrality claim.
- Replay uses stable source IDs and the existing global external-ID unique constraint. INSERT uniqueness recovery additionally checks direction, delivery status and identity consistency.

`contentTimeDuplicates` remains available for API/log compatibility and is no longer incremented by reconciliation. Existing Historical/exact-manifest near-match review holds remain conservative; no Historical resource admission or pagination behavior changes.

## Seven-case reproduction

Customer text, customer/chat identities and Raw/Canonical record UUIDs are removed. Fixtures retain source IDs, Store codes, event times and source class; every text is a synthetic repeated string. Every case reproduces import suppression on unchanged main with a compatible read-only database stub. Every case passes both the corrected unit test and real PostgreSQL reconciliation: two identities, two Canonical records, no additional record after replay.

| Store | Previously suppressed Manager ID | Other Canonical Manager ID | Separation | Result |
|---|---|---|---|---|
|32687|635777167095496705|635777167480848848|399ms|PASS|
|32687|635777166810022000|635777167699738813|399ms|PASS|
|19704|635646506909303353|635646510063157505|1741ms|PASS|
|19704|635056967668728530|635056969950167195|1268ms|PASS|
|19704|635177210764329131|635177211469234474|592ms|PASS|
|19704|635328379788722912|635328381163930251|814ms|PASS|
|32610|635054091399594363|635054092657623558|674ms|PASS|

The four Store19704 pairs retain AUTO_RESPONSE source tagging and still preserve distinct exact IDs.

## Changes and validation

- `backend/src/line-chat/line-chat-mirror-reconciler.service.ts`: exact receipt guards, proven distinct identity rules, unproven holds and safe uniqueness recovery.
- Reconciler spec: all ten requested scenarios, all seven pairs, six identical sends within one second, conflicting scopes/aliases, capped candidates and numeric client-key hold.
- `fixtures/live-mirror-identity-collisions.ts`: seven sanitized evidence fixtures.
- `line-chat-mirror-identity.integration.spec.ts`: actual PostgreSQL seven-pair inserts, receipt-loss/service-restart replay, simultaneous polls, OA-scoped provider alias lookup, concurrent INSERT/P2002 and direction-conflict rejection. Tests require a dedicated loopback database, or GitHub's loopback CI database.
- Text/media exact-manifest specs: mocks include the selected conversation relation; contradicted source evidence cannot certify parity.
- `.github/workflows/backend-ci.yml`: run the identity database regression against the existing disposable CI PostgreSQL service. No runner/permission/branch-policy changes or extra service.
- This handoff, AI_PROGRESS.md and DECISIONS.md: scoped evidence, baseline failures and release gates.

| Check | Actual local result |
|---|---|
|Affected regression tests (15 spec files)|170 passed, 0 failed, 0 skipped|
|Dedicated PostgreSQL identity integration|1 passed, including all seven pairs, real race and provider alias|
|Before-fix production pair reproduction|All seven fail preservation assertion on unchanged main; defect reproduced|
|Changed-file lint|PASS, no diagnostics|
|Production TypeScript (`tsconfig.build.json`)|PASS|
|Backend build (`npm run build`)|PASS|
|Prisma existing migrations|PASS, dedicated local Compose databases only; no new migration|
|Built backend /health; built worker /internal/health|200 / 200, backend database healthy|
|Protected backend and worker probes|401 / 401|
|Backend/worker startup logs|No ERROR/WARN startup entries; storage intentionally disabled locally|
|Workflow YAML parse and wiring; whitespace diff|PASS|
|Full backend suite vs unchanged-main baseline|Changed: 2726 tests, 2695 pass, 18 fail, 13 skip. Baseline: 2698 tests, 2668 pass, same 18 fail, 12 skip. No new failure identities. Extra skipped test is the database regression without its dedicated URL; it separately passed with that URL.|
|Full TypeScript including existing specs|295 baseline errors, 295 after; no added normalized diagnostics|
|Full backend lint|893 baseline errors + 2 warnings, unchanged; changed scope passes|
|Hosted CI|**BLOCKED** on validated code commit: Application CI run38353945146 and Artifact Retention run38353944965. Backend, Frontend, CI Gate and retention jobs have zero steps; all annotate failed account payments or spending-limit restriction. No test code executed. Local validation does not replace hosted CI. No manual workflow dispatch.|

Baseline failures remain outside PR1: missing Jest describe/Vitest dependencies; conversation summary mocks/date assumptions; weekly-collector credential-resolution precedence; health-state/queue mocks; sales-sync eligibility expectation; nickname DI ownership tests; worker Docker archive assertion; store-priority business summary mocks; two Vision expectations; TikTok viewer authorization expectation. Exact failure identities were compared, not only totals. Full repository checks are not green. Prisma package.json deprecation and npm allow-scripts warnings were retained and inspected; no lint rules, tests or warnings were suppressed.

## Database and compatibility

No schema/data migration. Existing constraints: Message.externalMessageId is globally unique; Raw identity is unique on (OA, Manager ID); Conversation identity is unique on (OA, chat ID). These are exercised locally. A same Manager identity attributed to another OA/conversation is a hold/conflict, not an excuse to bypass global uniqueness. New AMBIGUOUS reasons use the existing enum and retry policy; no enum migration is needed.

New unresolved echo holds can increase visible debt; that is intentional and requires PR3 evidence capture, not another heuristic. Exact provider/application alias creation can still race independently in other writer paths because aliases are JSON metadata without a unique relation; this PR guards the reconciler and exposes competing claims, but cannot provide cross-writer transactional alias uniqueness. Existing legacy terminal CONTENT_TIME_MATCH receipts are not automatically reconsidered. The 419 held conversation identities and 52 legacy ID-less auto replies are untouched.

## Separate historical recovery proposal — no execution authorized

Exact scope is only the seven suppressed source IDs in the table, under the original Raw row IDs, Store/OA/chat and other Canonical IDs saved in E3. Preserve the existing Canonical messages and Raw evidence. Before proposing any write, independently confirm source event/alias semantics and destination ownership, build a read-only exact manifest with immutable prior-state/payload hashes, check all exact alternate paths, list every proposed import/relink and capture a reversal receipt. Any proven provider alias is held for PR3 instead of split. Unknown cases remain held. Require separate approval for the exact row set and writes; use guarded small transactions and rollback only unchanged receipts. Text/time similarity is never authorization. No replay, backfill, split, migration or historical mutation ran here.

## Deployment, acceptance and rollback — approval required

1. Hosted checks must pass or remain explicitly BLOCKED; broad baseline failures must not be presented as green. Review this one PR and its exact source SHA. No bypass of branch protection.
2. Before an approved worker release, preserve deployment/config fingerprints and establish a cutover time. Use the existing reconciliation apply gate for an approved dry run; do not reduce the active Live fleet to manufacture a canary. Raw polling and Historical isolation remain intact.
3. After approval, release the reviewed worker code and monitor a bounded set of real completed cycles. Compare new post-cutover receipts: zero CONTENT_TIME_MATCH certifications; zero contradictory exact identity links; known different IDs remain distinct; exact reprocessing adds zero records; unknown IDs/echoes remain explicit holds. Confirm direction/Store/OA/conversation and inspect query latency, candidate saturation, holds and failed uniqueness recovery. Health-route success alone does not certify completeness.
4. Seven legacy targets remain open recovery exceptions until a separately approved exact recovery or provider alias proof. No assertion of overall Live Mirror health is made.
5. If containment is needed, disable Canonical reconcile apply through the existing gate while preserving Raw collection, subject to operator approval. Reverting to old code re-enables the confirmed collision defect and requires an explicit containment decision. No automatic data deletion/split/reversal. Keep any future recovery receipts for independent guarded rollback.

## Intentionally deferred original plan

PR2 shared eligibility/truthful debt; PR3 durable provider aliases; PR4 conversation/inbound identity recovery; PR5 bounded source coverage checkpoints; PR6 Mirror-first admission/revisits; PR7 durable cycle/debt/alerts. Incomplete cycles, source omissions at20789/29496, fleet exclusions, historical backfill, UI and monitoring redesign are not implemented. Stop after this PR is prepared; merge, deployment and next PR await user approval.


## Current-main repair verification (2026-10-13)

The previous validation tables describe the original428f04ba baseline. Superseding integration base is `f0471c640257787d9cfcf387250056a42a8ca9e9`. Merge conflicts were only appended AI_PROGRESS.md and DECISIONS.md entries; both sides are preserved. The workflow retains PR547's Store Master PostgreSQL step plus PR548's identity step. All main schema/migration/Store Master/frontend files are unchanged relative to this new base. No force-push/history rewrite.

A pre-existing direct OA/chat mapping safety defect was additionally reproduced on this main: a Conversation's Store may disagree with its OA owner, and the old direct resolution imported into that wrong Store. PR1 now selects Store identity and holds conflicting/null Store mappings as DIRECT_CONVERSATION_STORE_SCOPE_CONFLICT, without import or Canonical link. PostgreSQL before/after and two permanent unit cases verify it. Original identity rules and seven source pairs remain intact.

Updated local results:172 focused tests (all original170 plus2 scope guards); dedicated PostgreSQL identity integration;78 Store Master/database tests;39 webhook/default-permission tests;974 frontend tests; changed-scope lint,production types,backend build and local runtime200/200 plus guarded401/401 pass.169 existing migrations replay only locally. New main broad suite2733 total,2702 pass,19 fail,12 skip; integrated suite2763 total,2731 pass,the same19 fail,13 skip. There are no added failure identities. Two failures are test setup/environment (HTTP socket restriction, missing dedicated Store Master database); they pass under separate appropriate verification. Types295 errors and full lint893 errors/2 warnings remain unchanged. These are not green repository-wide results.

Registered GitHub runners:0. Existing alternative CI adapter recognizes updated workflow inventory (31 backend run steps) without errors, but its stopped ARM64 Lima base supplies unsigned local results and explicitly cannot post trusted GitHub Required Checks. No runner was created/activated. Branch protection/ruleset reads return403 requiring a plan upgrade; no bypass or policy change was attempted. Fresh head/check evidence and the quantitative release monitoring plan are recorded in the final PR548 readiness report, not inferred from historical billing failures.
