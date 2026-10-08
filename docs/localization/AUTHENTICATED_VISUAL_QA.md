# Authenticated three-language visual QA

**Status: BLOCKED_AUTH — final authenticated coverage is incomplete.** The existing production ASSISTANT session cannot safely reach ADMIN-only routes. A separate live Google Review KPI leakage was found after PR #513 deployed; its focused fix is in a follow-up PR and awaits normal CI, merge, deployment, and visual recheck.

## Revision and access

- Main commit inspected: `02a179e961dd20ddf384c8fa29d31170c81a9dfc` (merge of localization QA PR #513; descendant of `b890c9dbb87604449152f65c67ecff65da487028`).
- Environment: Railway production frontend, healthy at deployed revision `02a179e961dd20ddf384c8fa29d31170c81a9dfc`.
- Deployed QA fixes: PR [#513](https://github.com/supersunxm/line-unified-inbox/pull/513), source commit `556f74156818f0cca8b56a904126d7449caf5046`.
- Current focused KPI follow-up: branch `codex/i18n-authenticated-visual-qa-followup`; normal PR/deployment pending.
- The existing Opera session was authenticated as ASSISTANT. No credentials were entered or exposed. Admin-only routes were not opened through an authorization change.
- Desktop viewport: approximately 1440px. Mobile viewport: approximately 375px.

`PASS` means that surface was actually inspected in all three languages at both viewport sizes on the deployed revision with no unresolved localization-caused issue. `BLOCKED_SAFE_ACTION` means final inspection is pending a follow-up deployment or the route requires a legitimately authenticated ADMIN session. No uninspected page is marked PASS.

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

- The real application language selector was used in authenticated pages: Thai → English → Simplified Chinese → Thai.
- Visible copy changed immediately; the current route remained open and no logout occurred.
- In Inbox, the month query/filter and selected conversation query remained through switching. Refresh restored the saved locale.
- Login-page switching also retained `/login`; no form was submitted and no input values were read. Other authentication flows were not opened.
- Coupon desktop locale synchronization was defective on the original baseline and fixed in deployed PR #513; its post-fix immediate switching and persistence still need a targeted recheck.
- Selected-store preservation was not established across the inspected routes.

## Defects found

The following presentation defects were observed on the original deployed baseline and fixed in PR #513: Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings. Targeted post-fix rechecks are still pending for changed surfaces whose matrix rows remain blocked.

A post-merge inspection of the deployed English Google Review KPI screen found additional Thai-only static copy across the monthly overview, import history, store table/drawer, criteria, import/paste dialogs, and weekly summary. The follow-up fix routes these labels and sample dates through existing locale phrases, adds translations for the mismatch and import-success notices, and corrects the Thai coverage label. This follow-up has not yet been deployed and remains BLOCKED pending CI and post-deploy verification.

- **I18N:** No remaining production-confirmed defect claims are made beyond the KPI leakage above, which is fixed in the follow-up source but awaits deployed visual verification.
- **Layout:** No localization-caused overflow was found in the changed views during the baseline pass. V2 overview/store/response/partner pages and the V2 A4 report remain wider than 375px in every language; this is pre-existing shared layout behavior and was not changed.
- **Pre-existing:** `/friend-attribution` still produces React hydration error 418 in its no-configuration state. The same issue was present before localization and is unchanged.

## Regression and delivery state

- Frontend tests before the focused KPI follow-up: 972/972 passed; current follow-up: 974/974 passed locally.
- Build: passed locally; the existing dynamic-font download warning remains.
- Focused ESLint: 8 errors / 21 warnings, matching main baseline.
- Full ESLint: 62 errors / 101 warnings, matching main baseline.
- Typecheck: 49 diagnostics, matching main baseline.
- `git diff --check`: passed.
- Adaptive Auth CI: success.
- PR #513 is merged, and production is healthy on `02a179e961dd20ddf384c8fa29d31170c81a9dfc`. The focused KPI follow-up is awaiting its own normal PR/CI/deployment cycle.

## Safety and remaining work

No customer messages, broadcasts, or real content were sent. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run.

The existing ASSISTANT session cannot access Broadcast or HQ/account-management routes. Forced password reset was not induced. These flows remain `BLOCKED_SAFE_ACTION`; no auth changes will be made to manufacture access. Continue the focused KPI follow-up through normal CI and deployment, then inspect it in all locales and both viewports before changing its matrix cells.
