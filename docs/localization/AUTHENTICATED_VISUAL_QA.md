# Authenticated three-language visual QA

**Status: PROTECTED ROUTE VISUAL QA: PASS.** Source three-language coverage remains PASS. PR #531's greeting-manager fix at `552119f7048def0f6360500f8661872bf3274d39` passed authenticated visual QA in TH/EN/ZH at 1440×900 and 375×812: all four status labels/subtitles localized, no Thai status copy under EN/ZH, no viewport overflow, and no browser console errors. PR #535 localizes the existing Purchase Intelligence DRAFT ONLY composer, including safety/preview copy, audience metrics/statuses, and the readiness message. Post-deploy visual QA passed in all three languages at desktop 1440×900 and mobile 375×812. Forced password reset is the only remaining `BLOCKED_SAFE_ACTION` exception.

## Revision and access

- Full QA matrix tested on PR #535 merge revision `29e889e86e379aa00cb8cc450940c02f26e5f4d0`; source PR #535 was `codex/i18n-broadcast-draft-qa-20261008` at `2f65a882cb8e5c182b4a5db46c2e82a87d2bc8e6` with docs commit `fbdd3ab043f577f9bbd6a095f27e32926e764469`.
- Railway frontend deployment `46019769-2d5a-4ccb-ab52-f8b072cfccf9` succeeded on `29e889e`. A later, unrelated PR #536 deployment `d2c3d689-c859-4829-809c-aa59c2db898f` became active on commit `e3e45796a590551031111532fa629abd9480ea03`; Railway showed the frontend Online with one replica. After #536, a fresh Thai smoke check of the existing draft confirmed the route loaded, DRAFT ONLY remained, Review & Send stayed disabled, and browser errors were zero. The full TH/EN/ZH desktop/mobile matrix above was run on #535; #536 changes a separate HQ status modal.
- Authentication method: existing Chrome profile `Chutisorn`, using its already-authenticated `lineoppo.click` session. One repository search found no supported QA login, storage-state fixture, or QA/test login environment variable. No credentials, cookies, or tokens were read or entered.
- Greeting manager used the real language selector for TH → EN → ZH → TH at desktop and mobile sizes. The `/greeting-messages/manage` route remained selected and reload restored Thai. On the draft route, the desktop language selector completed TH → EN → ZH → TH with `/mass-messages/drafts/b7dbdd8b-586a-4688-b1e3-b9237ea6cf97` retained; refresh in Thai restored Thai. Mobile at 375×812 was reloaded in TH, EN and ZH and Content, Audience and Preview were inspected in each locale. The mobile More drawer does not expose the language selector. No customer messages, imports, downloads, account changes, or form submissions were performed.
- Targeted routes: `/replymessage`, `/google-review-kpi`, `/broadcast`, `/mass-messages`, `/admin/registrations`, `/admin/registrations/hq`, `/admin/stores`, `/storemanagement`, `/admin/purchase-analytics`, `/monthly-operations-report`, `/operations/line-chat-health`, `/dashboard/message-traffic`, `/greeting-messages`, `/greeting-messages/manage`, `/coupons`, and `/download-center`. The existing route matrix records the previously completed checks; this closeout rechecked `/greeting-messages/manage` and the safe draft after their relevant frontend revisions. The known `/friend-attribution` hydration issue is tracked separately below.
- Forced password reset was not naturally reachable and was not induced. The existing safe draft remained unsaved; the audience stayed locked and Review & Send remained disabled.

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
| Existing Purchase Intelligence draft editor (DRAFT ONLY; no save/upload/send) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
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
- On the deployed draft route, the real desktop selector changed TH → EN → ZH → TH, retained the exact route, and same-tab refresh restored Thai. At mobile width, the route was reloaded under TH, EN and ZH and retained the same path. The draft route had no query, selected store, active filter, or selected conversation to preserve.
- On `/greeting-messages/manage`, the real desktop and mobile selectors both completed TH → EN → ZH → TH and preserved the route; reload restored Thai. This route has no query, store, filter, or conversation state. Login has no query, store, or filter state to retain.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; the targeted post-fix desktop/mobile check passed in all three languages in this QA pass.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. The matrix above records the targeted post-fix checks completed during that pass.

A post-merge inspection of the deployed English Google Review KPI screen found Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. PR #514 routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. All required CI passed and the fix is deployed in `753c4283`. The latest targeted protected visual inspection passed in TH/EN/ZH at desktop and mobile sizes.

- **I18N:** The KPI English/Chinese source leakage is fixed and deployed in PR #514. PR #531 fixed the greeting manager's Thai-only status subtitles by adding TH/EN/ZH phrase coverage and the dynamic active-store template to the manager route's i18n boundary; all four cards pass runtime checks at desktop and mobile sizes. PR #535 localizes the draft composer's safety and preview copy, audience metrics, status labels, and readiness message in desktop and mobile views; all six locale/viewport cells pass.
- **Layout:** The targeted protected routes listed in this pass had no horizontal overflow at 1440×900 or 375×812. V2 overview/store/response/partner pages and the V2 A4 report were previously observed wider than 375px; they were not in this targeted recheck, so that prior observation remains open.
- **Pre-existing:** `/friend-attribution` still reproduces React hydration error 418 in its no-configuration state on the deployed revision. It remains classified PRE_EXISTING and was not changed by localization.

## Regression and delivery state

- Focused greeting/localization/composer tests: 58/58 passed; full frontend suite: 968/968 passed on current main. The classified Thai source count is 655, with 0 unclassified candidates and 0 unfixed bugs.
- Focused ESLint reports only one inherited hook error and two inherited image warnings in the mobile composer; the exact `origin/main` file has the same diagnostics. Full ESLint is 61 errors / 97 warnings on both main baseline and branch, with 0 new diagnostics.
- TypeScript baseline check: 49 diagnostics versus 49 on latest main.
- Local production build passed; Next logged an existing dynamic-font HTTP 400 and `metadataBase` warning. Greeting and draft route browser error logs were zero on the verified UI tabs.
- Required PR #535 checks all passed (Adaptive Auth, Backend, Frontend, CI Gate); it merged normally. Railway deployment `46019769-2d5a-4ccb-ab52-f8b072cfccf9` is active on `29e889e`; the route loaded successfully. `git diff --check`: passed.

## Safety and remaining work

No customer messages or broadcasts were sent. The existing DRAFT ONLY screen was opened without saving content or uploading an image; its send action remained disabled. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was bypassed.

The prior pass used an already-authenticated Chrome session and read-only visual checks. The existing safe Purchase Intelligence draft was opened and visually checked without saving content or uploading an image; its audience remained locked and Review & Send stayed disabled. No customer message or broadcast was sent. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was bypassed. No credentials, cookies, or tokens were read or entered. The primary checkout was read-only: `git status --porcelain=v1` counted 519 entries; `git status --porcelain=v1 -uall` counted 559 because default porcelain collapses untracked directories (126 records) while `-uall` expands them to 166 untracked file paths. The previous handoff's exact counting command is not recorded. No attempt was made to recover missing edits. Forced password reset remains `BLOCKED_SAFE_ACTION`; it was not induced.
