# Authenticated three-language visual QA

**Status: BLOCKED_AUTH — protected-route visual QA is incomplete.** PR #514 fixed the newly found Google Review KPI language leakage and is merged/deployed, but the available Opera profile now redirects the protected route to login. No supported QA account, storage-state fixture, or environment login variable is available, so a post-fix authenticated visual check cannot be completed safely. ADMIN-only routes also remain inaccessible, and forced password reset was not induced.

## Revision and access

- Main commit tested: `753c428334d1b4a598a1ad3a6c81021fce7c0a00` (merge of PR #514; descends from localization merge `b890c9dbb87604449152f65c67ecff65da487028`).
- Environment: Railway production frontend. Deployed revision `753c428334d1b4a598a1ad3a6c81021fce7c0a00`; status `SUCCESS`, one replica online, zero active warnings/critical issues, and no pending deployment work. Backend and database were not redeployed.
- PR [#513](https://github.com/supersunxm/line-unified-inbox/pull/513) fixed the first post-localization visual issues. PR [#514](https://github.com/supersunxm/line-unified-inbox/pull/514) fixed the additional Google Review KPI English leaks and is merged/deployed.
- Authentication method: the pre-fix visual review used an existing Opera ASSISTANT session without entering credentials. After PR #514 deployed, a fresh protected KPI navigation in that profile redirected to `/login`. Repository search found no Playwright storage state, supported local QA account, documented QA login, or QA/test login environment variable. No credentials were entered or exposed.
- Post-deploy login page was visually checked through its real selector in TH/EN/ZH at 1440px and 375×812; `documentElement.scrollWidth` and `body.scrollWidth` matched the viewport in all sampled sizes. The protected KPI route could not be opened after deployment.
- The existing ADMIN-only routes were not opened through an authorization change. Forced password reset was not induced.

`PASS` means that surface was inspected in all three languages and relevant sizes after its UI change was deployed, with no unresolved localization-caused issue found. `BLOCKED_SAFE_ACTION` means a safe post-fix inspection requires an authenticated session or role that is not available. No protected route that could not be reached is marked PASS.

## Visual matrix

| Feature | TH Desktop | EN Desktop | ZH Desktop | TH Mobile | EN Mobile | ZH Mobile | Result |
|---|---|---|---|---|---|---|---|
| Dashboard | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Inbox, chat, conversation detail | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Response / unanswered screens | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Responder analytics (`/replymessage`) | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| V2 overview, stores, reports, scorecards, partner/admin views | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| V2 Response | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Google Review KPI | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Broadcast landing, create/edit, audience and content controls | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Main OA | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| HQ / account management | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Store management | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Followers and follower insights | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Purchase / operations analytics | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Message traffic | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Auto replies | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Greeting messages and preview | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Rich messages and rich menus | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Coupons | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Friend-source pages | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Download Center | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Login page (visual only) | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Other authenticated auth pages beyond login | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |
| Forced password reset | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION | BLOCKED_SAFE_ACTION |

## Language switching

- On the earlier authenticated Inbox pass, the real selector changed TH → EN → ZH → TH immediately without logout; `/chats` and its month/conversation query remained, and refresh restored the saved locale.
- After PR #514 deployed, the available login page selector changed TH → EN → ZH → TH with localized copy and retained `/login`. Refresh restored Thai. No login form was submitted or read. The protected KPI route could not be opened to verify its selector after the latest deployment.
- The selected store/filter was not established across routes. Login has no query, store, or filter state to retain.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; its targeted post-fix check remains blocked with the current session.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. Targeted post-fix rechecks remain blocked for changed surfaces whose matrix rows are blocked.

A post-merge inspection of the deployed English Google Review KPI screen found Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. PR #514 routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. All required CI passed and the fix is deployed in `753c4283`; the post-fix protected visual inspection remains BLOCKED_AUTH because the available browser profile redirects to login.

- **I18N:** The KPI English/Chinese source leakage is fixed and deployed in PR #514; post-fix authenticated visuals remain unverified. No new untranslated content was found on the rechecked login page.
- **Layout:** Rechecked login copy fits at 1440px and 375px in TH/EN/ZH with no horizontal overflow. V2 overview/store/response/partner pages and the V2 A4 report were previously observed wider than 375px in every language; this pre-existing shared layout behavior was not changed. KPI post-fix mobile layout remains unverified.
- **Pre-existing:** `/friend-attribution` still reproduces React hydration error 418 in its no-configuration state on the deployed revision. It remains classified PRE_EXISTING and was not changed by localization.

## Regression and delivery state

- Frontend tests: 974/974 passed locally and in required CI.
- Build: passed locally and in CI; Railway frontend deployment succeeded. Existing metadataBase and dynamic-font-download warnings remain.
- Focused ESLint: 7 errors / 20 warnings, matching the current main baseline.
- Full ESLint: 62 errors / 101 warnings, matching main baseline.
- Typecheck: 49 diagnostics, matching main baseline.
- `git diff --check`: passed.
- Required CI for PR #514: Frontend, Backend, web-adaptive-auth, and CI Gate all success.
- PR #514 merged normally as `753c428334d1b4a598a1ad3a6c81021fce7c0a00`; production is healthy on that exact frontend revision.

## Safety and remaining work

No customer messages, broadcasts, real content, KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run. No authentication control was changed or bypassed.

The available profile now reaches only the login page for protected routes, and no supported QA account/session fixture is present. Google Review KPI, Broadcast, HQ/account management, and forced password reset remain `BLOCKED_SAFE_ACTION`; the overall status remains `BLOCKED_AUTH`. Re-run the protected visual pass only when a legitimate authenticated QA session is available.
