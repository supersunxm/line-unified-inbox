# Authenticated three-language visual QA

**Status: INCOMPLETE — both runtime-confirmed localization fixes are in the isolated branch; production visual verification after merge is pending.** Source three-language coverage remains PASS. The greeting manager showed Thai status explanations under EN/ZH. The existing Purchase Intelligence draft editor showed its language selector on English while the page content was Chinese. Both fixes use the existing shared localization architecture. Forced password reset remains `BLOCKED_SAFE_ACTION`.

## Revision and access

- Latest successfully fetched `origin/main`: `1543765b1e8fd854e0f33ab38fe4dab8680ede9e` (PR #529 merge). The isolated fix branch is `codex/i18n-greeting-final-qa` and has been synced to that main revision.
- Before the fix merges, Railway production frontend deployment `7f209690-6d2b-4091-8d92-83faaccb7c74` is `SUCCESS` on `1543765b1e8fd854e0f33ab38fe4dab8680ede9e`; the service is online with 1/1 replicas, no active warnings/criticals, no recent failures, and no pending work. Recheck the deployed revision and health after the fix merges.
- Authentication method: existing Chrome profile `Chutisorn`, using its already-authenticated `lineoppo.click` session. One repository search found no supported QA login, storage-state fixture, or QA/test login environment variable. No credentials, cookies, or tokens were read or entered.
- The broad protected-route pass below covered 1440×900 desktop and 375×812 mobile across Thai, English, and Simplified Chinese. The current production baseline was also read-only inspected on `/greeting-messages/manage` and an existing `/mass-messages/drafts/[campaignId]` record. The draft is unsent and its send action is locked; no content was saved or uploaded.
- Targeted routes: `/replymessage`, `/google-review-kpi`, `/broadcast`, `/mass-messages`, `/admin/registrations`, `/admin/registrations/hq`, `/admin/stores`, `/storemanagement`, `/admin/purchase-analytics`, `/monthly-operations-report`, `/operations/line-chat-health`, `/dashboard/message-traffic`, `/greeting-messages`, `/greeting-messages/manage`, `/coupons`, and `/download-center`. The route runs ended with 0 browser console errors and 0 known React 418 errors.
- Forced password reset was not naturally reachable and was not induced. The current fix branch has not yet completed its post-deployment browser restoration and final visual pass for the greeting manager and existing draft editor.

`PASS` means the visible route was inspected in all three languages and relevant sizes with no unresolved localization issue found. `FAIL_RUNTIME_I18N` records a visible mixed-language or broken-locale-switch defect. `PENDING_POST_DEPLOY` means the source fix is not yet deployed and runtime verification is outstanding. `BLOCKED_SAFE_ACTION` means the flow requires a naturally forced state or a write action that this read-only pass did not induce.

## Visual matrix

| Feature | TH Desktop | EN Desktop | ZH Desktop | TH Mobile | EN Mobile | ZH Mobile | Result |
|---|---|---|---|---|---|---|---|
| Dashboard | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Inbox, chat, conversation detail | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Response / unanswered screens | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Responder analytics (`/replymessage`) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| V2 overview, stores, reports, scorecards, partner/admin views | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| V2 Response | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Google Review KPI | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Broadcast landing and visible controls | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Existing broadcast draft editor (DRAFT ONLY; no save/upload/send) | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY |
| Main OA | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HQ / account management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Store management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Followers and follower insights | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Purchase / operations analytics | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Message traffic | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Auto replies | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Greeting message editor and preview | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Greeting manager status explanations (fix pending deployment) | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY |
| Rich messages and rich menus | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Coupons | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Friend-source pages | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Download Center | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Login page (visual only) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Forced password reset | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |

## Language switching

- On the earlier authenticated Inbox pass, the real selector changed TH → EN → ZH → TH immediately without logout; `/chats` and its month/conversation query remained, and refresh restored the saved locale.
- The existing authenticated session was used to inspect the targeted pages in TH, EN, and ZH. On the existing broadcast draft route, the settings selector displayed English while the page content was Chinese. The source wiring now reads and updates the shared application language; repeat TH → EN → ZH → TH after deployment and verify the route remains intact.
- The selected store/filter was not established across routes. Login has no query, store, or filter state to retain.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; the targeted post-fix desktop/mobile check passed in all three languages in this QA pass.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. The matrix above records the targeted post-fix checks completed during that pass.

A post-merge inspection of the deployed English Google Review KPI screen found Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. PR #514 routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. All required CI passed and the fix is deployed in `753c4283`. The latest targeted protected visual inspection passed in TH/EN/ZH at desktop and mobile sizes.

- **I18N:** The KPI English/Chinese source leakage is fixed and deployed in PR #514. The greeting manager's missing status phrases and dynamic active-store sentence are translated through the existing phrase/template boundary. The existing broadcast draft editor now reads and changes the shared app language instead of pinning its shell to English. Both source fixes still require post-deployment visual verification.
- **Layout:** The targeted protected routes listed in this pass had no horizontal overflow at 1440×900 or 375×812. V2 overview/store/response/partner pages and the V2 A4 report were previously observed wider than 375px; they were not in this targeted recheck, so that prior observation remains open.
- **Pre-existing:** `/friend-attribution` still reproduces React hydration error 418 in its no-configuration state on the deployed revision. It remains classified PRE_EXISTING and was not changed by localization.

## Regression and delivery state

- Focused localization/greeting/composer tests: 56/56 passed; full frontend suite: 966/966 passed.
- Focused ESLint on changed source/test files: 0 errors / 0 warnings. Full ESLint on latest main baseline: 61 errors / 101 warnings; branch: 61 / 97, with 0 new diagnostics and 4 resolved.
- TypeScript baseline check: 49 diagnostics versus 49 on latest main.
- Production build passed. Existing warnings remain: dynamic font download returned HTTP 400; `metadataBase` defaults to localhost.
- Local built server started on `127.0.0.1:3010`; `/api/health`, `/greeting-messages/manage`, and the dynamic draft route returned HTTP 200. No server startup errors were observed.
- `git diff --check`: passed. Required CI, merge, deployed revision, and post-deployment visual checks for this fix are pending.

## Safety and remaining work

No customer messages or broadcasts were sent. The existing DRAFT ONLY screen was opened without saving content or uploading an image; its send action remained disabled. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was bypassed.

The prior pass used an already-authenticated Chrome session and read-only visual checks. This continuation found an existing safe Purchase Intelligence draft, opened its composer, and confirmed its send control is disabled. The selector mismatch was an actual locale wiring defect and is fixed in source; the draft remains unsaved. Primary checkout status counts were read-only: `git status --porcelain=v1` showed 519 records, while `git status --porcelain=v1 -uall` showed 559. Default status collapses the same 166 untracked files to 126 directory records, which explains the 40-record difference; 393 tracked files are modified. No write operation was performed in the primary checkout. Forced password reset remains `BLOCKED_SAFE_ACTION`; it was not induced. Current protected-route status is `INCOMPLETE` pending PR, deployment, and authenticated visual verification.
