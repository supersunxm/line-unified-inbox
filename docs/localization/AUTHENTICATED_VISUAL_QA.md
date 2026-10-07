# Authenticated three-language visual QA

**Status: BLOCKED_AUTH — final post-fix verification is incomplete.** This report separates visual inspection of the deployed baseline from final verification of fixes that have not reached production.

## Revision and access

- Main commit inspected: `b890c9dbb87604449152f65c67ecff65da487028`.
- Environment: Railway production frontend, healthy at deployed revision `b890c9dbb87604449152f65c67ecff65da487028`.
- QA fixes: PR [#513](https://github.com/supersunxm/line-unified-inbox/pull/513), branch `codex/i18n-authenticated-visual-qa`; source fix commit `556f74156818f0cca8b56a904126d7449caf5046`.
- The existing Opera session was authenticated as ASSISTANT. No credentials were entered or exposed. Admin-only routes were not opened through an authorization change.
- Desktop viewport: approximately 1440px. Mobile viewport: approximately 375px.

`PASS` means the deployed baseline was actually inspected in all three languages at both viewport sizes and no localization-caused issue was found in that row. `BLOCKED_SAFE_ACTION` means final post-fix inspection is pending because the fixes cannot safely be deployed until required CI is green, or the route requires an existing ADMIN session. No uninspected page is marked PASS.

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
- Coupon desktop locale synchronization was defective on the deployed baseline and is fixed in PR #513; persistence and immediate switching there still require post-deployment verification.
- Selected-store preservation was not established across the inspected routes.

## Defects found

The following presentation defects were observed on the deployed baseline and fixed in PR #513. They are not marked PASS until the normal merge/deploy path allows a post-fix visual recheck:

- **I18N:** Thai responder-analytics labels; Google Review KPI title/tabs/week periods; Thai store `Archived` label; purchase-analytics copy and shared locale propagation; Chinese greeting-preview labels; coupon desktop language state; Thai message-traffic titles; and Thai/Chinese Download Center headings.
- **Layout:** No localization-caused overflow was found in the changed views during the baseline pass. V2 overview/store/response/partner pages and the V2 A4 report remain wider than 375px in every language; this is pre-existing shared layout behavior and was not changed.
- **Pre-existing:** `/friend-attribution` still produces React hydration error 418 in its no-configuration state. The same issue was present before localization and is unchanged.

## Regression and delivery state

- Frontend tests: 972/972 passed locally.
- Build: passed locally; the existing dynamic-font download warning remains.
- Focused ESLint: 8 errors / 21 warnings, matching main baseline.
- Full ESLint: 62 errors / 101 warnings, matching main baseline.
- Typecheck: 49 diagnostics, matching main baseline.
- `git diff --check`: passed.
- Adaptive Auth CI: success.
- Application CI run `37655248870`: GitHub reports workflow-level failure although both listed jobs and all listed steps report success. GitHub's failed-job rerun endpoint returned 403 (`This workflow run cannot be retried`). Do not merge until required CI is green.
- The PR is open; no merge or deployment of the fix branch has occurred. Production remains healthy on `b890c9db`.

## Safety and remaining work

No customer messages, broadcasts, or real content were sent. No KPI evidence, store mappings/configuration, OA settings/credentials, roles, passwords, or business records were changed. No migration was added or run.

The existing ASSISTANT session cannot access Broadcast or HQ/account-management routes. Forced password reset was not induced. Complete the blocked rows only after required CI is green, PR #513 is merged normally, the deployed frontend revision is verified, and an already-authorized ADMIN session is available for admin-only views. Then update this matrix with the post-fix results.
