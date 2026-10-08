# Authenticated three-language visual QA

**Status: INCOMPLETE — source fixes are ready for review; post-deployment visual verification is pending.** Source three-language coverage remains PASS. The greeting manager showed Thai status explanations under EN/ZH. An existing broadcast draft exposed a second runtime issue: its locale selector was pinned to English with a no-op change handler while the app locale remained Thai. Both are fixed in the isolated branch, but the deployed UI has not yet been rechecked. Forced password reset remains `BLOCKED_SAFE_ACTION`.

## Revision and access

- Latest successfully fetched `origin/main`: `3a94813d9adeb7c303a1f7b41ceedcbf02a8d3f9` (PR #528 merge). The isolated fix branch is `codex/i18n-greeting-final-qa`.
- The last observed Railway frontend deployment before this fix was the successful PR #526 deployment at `5fb5d1922c2e3c8cc04904517678c7297e9495f4`; this QA did not trigger a deployment. Recheck the deployed revision and health after the fix merges.
- Authentication method: existing Chrome profile `Chutisorn`, using its already-authenticated `lineoppo.click` session. One repository search found no supported QA login, storage-state fixture, or QA/test login environment variable. No credentials, cookies, or tokens were read or entered.
- Tested at 1440×900 desktop and 375×812 mobile across Thai, English, and Simplified Chinese for the previously blocked protected feature rows below. No customer messages, imports, downloads, account changes, or form submissions were performed.
- Targeted routes: `/replymessage`, `/google-review-kpi`, `/broadcast`, `/mass-messages`, `/admin/registrations`, `/admin/registrations/hq`, `/admin/stores`, `/storemanagement`, `/admin/purchase-analytics`, `/monthly-operations-report`, `/operations/line-chat-health`, `/dashboard/message-traffic`, `/greeting-messages`, `/greeting-messages/manage`, `/coupons`, and `/download-center`. The route runs ended with 0 browser console errors and 0 known React 418 errors.
- Forced password reset was not naturally reachable and was not induced. The current fix branch has not yet completed its post-deployment browser restoration and final visual pass.

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
| Existing broadcast draft editor (DRAFT ONLY; no save/upload/send) | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | FAIL_RUNTIME_I18N |
| Main OA | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HQ / account management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Store management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Followers and follower insights | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Purchase / operations analytics | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Message traffic | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Auto replies | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Greeting messages and preview (pre-fix deployed baseline) | PASS | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | PASS | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N |
| Greeting manager source fix pending deployment | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY |
| Rich messages and rich menus | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Coupons | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Friend-source pages | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Download Center | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Login page (visual only) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Other authenticated auth pages beyond login | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Forced password reset | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |

## Language switching

- On the earlier authenticated Inbox pass, the real selector changed TH → EN → ZH → TH immediately without logout; `/chats` and its month/conversation query remained, and refresh restored the saved locale.
- The existing authenticated session was used to inspect the targeted pages in TH, EN, and ZH. On the existing broadcast draft route, the selector displayed English while `document.documentElement.lang` remained Thai; attempts to change locale through that route's control did not change the shared app locale. The route remained intact. The source wiring is fixed in the current branch; the actual TH → EN → ZH → TH cycle must be repeated after deployment.
- The selected store/filter was not established across routes. Login has no query, store, or filter state to retain.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; the targeted post-fix desktop/mobile check passed in all three languages in this QA pass.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. The matrix above records the targeted post-fix checks completed during that pass.

A post-merge inspection of the deployed English Google Review KPI screen found Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. PR #514 routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. All required CI passed and the fix is deployed in `753c4283`. The latest targeted protected visual inspection passed in TH/EN/ZH at desktop and mobile sizes.

- **I18N:** The KPI English/Chinese source leakage is fixed and deployed in PR #514. The greeting manager's missing status phrases and dynamic active-store sentence are translated through the existing phrase/template boundary in the current branch. The existing broadcast draft editor now reads and changes the shared app language instead of pinning its shell to English. Both source fixes still require post-deployment visual verification.
- **Layout:** The targeted protected routes listed in this pass had no horizontal overflow at 1440×900 or 375×812. V2 overview/store/response/partner pages and the V2 A4 report were previously observed wider than 375px; they were not in this targeted recheck, so that prior observation remains open.
- **Pre-existing:** `/friend-attribution` still reproduces React hydration error 418 in its no-configuration state on the deployed revision. It remains classified PRE_EXISTING and was not changed by localization.

## Regression and delivery state

- Focused localization/composer tests: 14/14 passed; full frontend suite: 966/966 passed.
- Focused ESLint on changed source/test files: 0 errors / 0 warnings. Full ESLint on latest main baseline: 61 errors / 101 warnings; branch: 61 / 97, with 0 new diagnostics and 4 resolved.
- TypeScript baseline check: 49 diagnostics versus 49 on latest main.
- Production build passed. Existing warnings remain: dynamic font download returned HTTP 400; `metadataBase` defaults to localhost.
- Local built server started on `127.0.0.1:3010`; `/api/health`, `/greeting-messages/manage`, and the dynamic draft route returned HTTP 200. No server startup errors were observed.
- `git diff --check`: passed. Required CI, merge, deployed revision, and post-deployment visual checks for this fix are pending.

## Safety and remaining work

No customer messages or broadcasts were sent. The existing DRAFT ONLY screen was opened without saving content or uploading an image; its send action remained disabled. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was bypassed.

The prior pass used an already-authenticated Chrome session and read-only visual checks. This continuation found an existing safe Purchase Intelligence draft, opened its composer, and confirmed its send control is disabled. The selector mismatch was an actual locale wiring defect and is fixed in source; the draft remains unsaved. The primary checkout was read-only: `git status --short` counted 519 entries; `git status --porcelain=v1 -uall` counted 559 because default porcelain collapses untracked directories (126 records) while `-uall` expands them to 166 untracked file paths. The previous handoff's exact counting command is not recorded. Forced password reset remains `BLOCKED_SAFE_ACTION`; it was not induced. Current protected-route status is `INCOMPLETE` pending PR, deployment, and authenticated visual verification.
