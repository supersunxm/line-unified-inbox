# Authenticated three-language visual QA

**Status: INCOMPLETE — the broadcast-draft copy fix is awaiting PR review and deployment.** Source three-language coverage remains PASS. PR #531's greeting-manager fix at `552119f7048def0f6360500f8661872bf3274d39` passed authenticated visual QA in TH/EN/ZH at 1440×900 and 375×812: all four status labels/subtitles localized, no Thai status copy under EN/ZH, no viewport overflow, and no browser console errors. On the same deployed revision, the existing draft composer showed mixed-language safety copy and untranslated audience labels/statuses on desktop, plus mixed English copy and a raw readiness enum on mobile. Commit `2f65a882cb8e5c182b4a5db46c2e82a87d2bc8e6` localizes those labels and mobile safety/preview copy. Forced password reset remains `BLOCKED_SAFE_ACTION`.

## Revision and access

- Latest fetched `origin/main`: `1d81947ebed7ef5ee5aa24498b95a3834149599f`. The isolated source branch is `codex/i18n-broadcast-draft-qa-20261008` at `2f65a882cb8e5c182b4a5db46c2e82a87d2bc8e6`.
- Latest verified successful Railway frontend deployment is `92e49888-199d-454f-aa09-ec2aa4a98e67`, revision `552119f7048def0f6360500f8661872bf3274d39`, in `sfo`; the service was Online with one replica. The Railway console showed a later main deployment in progress during this QA pass, so recheck the active revision and health after the source PR merges.
- Authentication method: existing Chrome profile `Chutisorn`, using its already-authenticated `lineoppo.click` session. One repository search found no supported QA login, storage-state fixture, or QA/test login environment variable. No credentials, cookies, or tokens were read or entered.
- Greeting manager used the real language selector for TH → EN → ZH → TH at desktop and mobile sizes. The `/greeting-messages/manage` route remained selected and reload restored Thai. Previously completed protected-route checks are retained in the matrix below. On the draft route, pre-fix desktop checks covered TH/EN/ZH; mobile EN/ZH recheck remains pending post-deploy. No customer messages, imports, downloads, account changes, or form submissions were performed.
- Targeted routes: `/replymessage`, `/google-review-kpi`, `/broadcast`, `/mass-messages`, `/admin/registrations`, `/admin/registrations/hq`, `/admin/stores`, `/storemanagement`, `/admin/purchase-analytics`, `/monthly-operations-report`, `/operations/line-chat-health`, `/dashboard/message-traffic`, `/greeting-messages`, `/greeting-messages/manage`, `/coupons`, and `/download-center`. Earlier sampled routes reported no console errors; recheck after deployment. The known `/friend-attribution` hydration issue is tracked separately below.
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
| Existing broadcast draft editor (DRAFT ONLY; no save/upload/send; branch fix pending deployment) | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | FAIL_RUNTIME_I18N | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY | PENDING_POST_DEPLOY |
| Main OA | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HQ / account management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Store management | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Followers and follower insights | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Purchase / operations analytics | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Message traffic | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Auto replies | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Greeting manager (PR #531 status descriptions) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Rich messages and rich menus | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Coupons | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Friend-source pages | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Download Center | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Login page (visual only) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Forced password reset | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |

## Language switching

- On the earlier authenticated Inbox pass, the real selector changed TH → EN → ZH → TH immediately without logout; `/chats` and its month/conversation query remained, and refresh restored the saved locale.
- On the deployed draft route, the real desktop selector changed TH → EN → ZH → TH, retained the route, and refresh restored Thai. The route had no query, selected store, active filter, or selected conversation to preserve. Repeat on desktop and mobile after the final copy fix deploys.
- On `/greeting-messages/manage`, the real desktop and mobile selectors both completed TH → EN → ZH → TH and preserved the route; reload restored Thai. This route has no query, store, filter, or conversation state. Login has no query, store, or filter state to retain.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; the targeted post-fix desktop/mobile check passed in all three languages in this QA pass.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. The matrix above records the targeted post-fix checks completed during that pass.

A post-merge inspection of the deployed English Google Review KPI screen found Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. PR #514 routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. All required CI passed and the fix is deployed in `753c4283`. The latest targeted protected visual inspection passed in TH/EN/ZH at desktop and mobile sizes.

- **I18N:** The KPI English/Chinese source leakage is fixed and deployed in PR #514. PR #531 fixed the greeting manager's Thai-only status subtitles by adding TH/EN/ZH phrase coverage and the dynamic active-store template to the manager route's i18n boundary; all four cards now pass runtime checks at desktop and mobile sizes. This branch localizes the draft composer's safety and preview copy, audience metrics, status labels, and readiness enum in desktop and mobile views. Verify the fix in all three languages and both sizes after deployment.
- **Layout:** The targeted protected routes listed in this pass had no horizontal overflow at 1440×900 or 375×812. V2 overview/store/response/partner pages and the V2 A4 report were previously observed wider than 375px; they were not in this targeted recheck, so that prior observation remains open.
- **Pre-existing:** `/friend-attribution` still reproduces React hydration error 418 in its no-configuration state on the deployed revision. It remains classified PRE_EXISTING and was not changed by localization.

## Regression and delivery state

- Focused greeting/localization/composer tests: 58/58 passed; full frontend suite: 968/968 passed on current main. The classified Thai source count is 655, with 0 unclassified candidates and 0 unfixed bugs.
- Focused ESLint reports only one inherited hook error and two inherited image warnings in the mobile composer; the exact `origin/main` file has the same diagnostics. Full ESLint is 61 errors / 97 warnings on both main baseline and branch, with 0 new diagnostics.
- TypeScript baseline check: 49 diagnostics versus 49 on latest main.
- Local production build passed; Next logged an existing dynamic-font HTTP 400 and `metadataBase` warning. Greeting route logs showed zero browser errors. Post-merge deployment health and authenticated draft runtime checks remain pending.
- `git diff --check`: passed. Required CI, merge, deployed revision, and post-deployment draft visual checks remain pending.

## Safety and remaining work

No customer messages or broadcasts were sent. The existing DRAFT ONLY screen was opened without saving content or uploading an image; its send action remained disabled. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was bypassed.

The prior pass used an already-authenticated Chrome session and read-only visual checks. This continuation found an existing safe Purchase Intelligence draft, opened its composer, and confirmed its send control is disabled. The desktop locale selector is shared with the app; the draft remains unsaved and no image was uploaded. No credentials, cookies, or tokens were read or entered. The primary checkout was read-only: `git status --short` counted 519 entries; `git status --porcelain=v1 -uall` counted 559 because default porcelain collapses untracked directories (126 records) while `-uall` expands them to 166 untracked file paths. The previous handoff's exact counting command is not recorded. Forced password reset remains `BLOCKED_SAFE_ACTION`; it was not induced. Current protected-route status is `INCOMPLETE` pending PR, deployment, and authenticated visual verification.
