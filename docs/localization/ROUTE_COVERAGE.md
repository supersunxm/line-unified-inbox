# Three-language route coverage

Audit date: 2026-10-07. Supported locales: Thai (`th`), English (`en`), Simplified Chinese (`zh`).

Every route component below was reviewed against its direct-copy and locale-resource path. The global classified Thai AST sweep and route-scoped localization tests are the static evidence for the locale columns. The 59 routes present before rebase were opened at desktop width; the 19 public routes were exercised in all three locales at 1440px desktop and 375×812 mobile. `/change-password`, added from latest `main`, was also checked in all locales at both sizes for localized form and generic API-error rendering. Its valid forced-reset session remains `BLOCKED_AUTH` because this worktree has no API/session or documented QA account.

| Route | Source audit | TH keys | EN keys | ZH keys | Runtime QA |
|---|---|---|---|---|---|
| `/` | PASS — `frontend/src/app/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — public landing; three-locale browser QA |
| `/admin/purchase-analytics` | PASS — `frontend/src/app/admin/purchase-analytics/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/admin/registrations` | PASS — `frontend/src/app/admin/registrations/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/admin/registrations/hq` | PASS — `frontend/src/app/admin/registrations/hq/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/admin/stores` | PASS — `frontend/src/app/admin/stores/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/auto-responses` | PASS — `frontend/src/app/auto-responses/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/broadcast` | PASS — `frontend/src/app/broadcast/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/chats` | PASS — `frontend/src/app/chats/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/connect/tiktok` | PASS — `frontend/src/app/connect/tiktok/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/connect/tiktok/analytics` | PASS — `frontend/src/app/connect/tiktok/analytics/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/connect/tiktok/success` | PASS — `frontend/src/app/connect/tiktok/success/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/change-password` | PASS — `frontend/src/app/change-password/page.tsx`; route-owned TH/EN/ZH copy, localized generic API failures, and password-policy regression tests | PASS | PASS | PASS | BLOCKED_AUTH — fallback form rendering checked in all locales at desktop/mobile; valid forced-reset session requires the unavailable local API/session |
| `/coupons` | PASS — `frontend/src/app/coupons/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/dashboard` | PASS — `frontend/src/app/dashboard/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/dashboard/message-traffic` | PASS — `frontend/src/app/dashboard/message-traffic/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/download` | PASS — `frontend/src/app/download/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/download-center` | PASS — `frontend/src/app/download-center/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/download/history` | PASS — `frontend/src/app/download/history/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/follower-insights` | PASS — `frontend/src/app/follower-insights/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/friend-attribution` | PASS — `frontend/src/app/friend-attribution/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA; pre-existing hydration warning† |
| `/friend-source-links` | PASS — `frontend/src/app/friend-source-links/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/google-review-kpi` | PASS — `frontend/src/app/google-review-kpi/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/greeting-messages` | PASS — `frontend/src/app/greeting-messages/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/greeting-messages/manage` | PASS — `frontend/src/app/greeting-messages/manage/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/home` | PASS — `frontend/src/app/home/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/login` | PASS — `frontend/src/app/login/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/main-oa` | PASS — `frontend/src/app/main-oa/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/mass-messages` | PASS — `frontend/src/app/mass-messages/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/mass-messages/drafts/[campaignId]` | PASS — `frontend/src/app/mass-messages/drafts/[campaignId]/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/monthly-operations-report` | PASS — `frontend/src/app/monthly-operations-report/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/operations/line-chat-health` | PASS — `frontend/src/app/operations/line-chat-health/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/privacy` | PASS — `frontend/src/app/privacy/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/register` | PASS — `frontend/src/app/register/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/replymessage` | PASS — `frontend/src/app/replymessage/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/review15` | PASS — `frontend/src/app/review15/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA; input/count preserved |
| `/rich-menus` | PASS — `frontend/src/app/rich-menus/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/rich-menus/overview` | PASS — `frontend/src/app/rich-menus/overview/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/rich-messages` | PASS — `frontend/src/app/rich-messages/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/store-360` | PASS — `frontend/src/app/store-360/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/store-360/customer-voice` | PASS — `frontend/src/app/store-360/customer-voice/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/store-360/response` | PASS — `frontend/src/app/store-360/response/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/store-locator` | PASS — `frontend/src/app/store-locator/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA; localized error state |
| `/storemanagement` | PASS — `frontend/src/app/storemanagement/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/stores` | PASS — `frontend/src/app/stores/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA; query preserved |
| `/stores/[identifier]` | PASS — `frontend/src/app/stores/[identifier]/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA at /stores/qa-localization |
| `/terms` | PASS — `frontend/src/app/terms/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/tiktok` | PASS — `frontend/src/app/tiktok/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/tiktok-integration` | PASS — `frontend/src/app/tiktok-integration/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/tiktok/callback/result` | PASS — `frontend/src/app/tiktok/callback/result/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/tiktok/connect/error` | PASS — `frontend/src/app/tiktok/connect/error/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/tiktok/connect/success` | PASS — `frontend/src/app/tiktok/connect/success/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | PASS — three-locale browser QA |
| `/tiktok/dashboard` | PASS — `frontend/src/app/tiktok/dashboard/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/tiktok/dashboard/[accountId]` | PASS — `frontend/src/app/tiktok/dashboard/[accountId]/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/tiktok/stores/[storeMasterId]` | PASS — `frontend/src/app/tiktok/stores/[storeMasterId]/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/v2` | PASS — `frontend/src/app/v2/(shell)/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/v2/admin/partners` | PASS — `frontend/src/app/v2/(shell)/admin/partners/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/v2/report` | PASS — `frontend/src/app/v2/report/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/v2/response` | PASS — `frontend/src/app/v2/(shell)/response/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/v2/stores` | PASS — `frontend/src/app/v2/(shell)/stores/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |
| `/welcome` | PASS — `frontend/src/app/welcome/page.tsx`; classified scan + scoped resource tests | PASS | PASS | PASS | BLOCKED_AUTH — shared route gate; no supported local authenticated session |

`BLOCKED_AUTH` means route HTML/gate rendering was observed, but authenticated feature content was not treated as verified. No credentials were invented or entered. The isolated frontend has no backend on port 3001; API-dependent states therefore show fail-closed verification or a localized empty/error fallback. `/change-password` displayed its localized generic failure copy after the API request failed; no password field was filled and no form was submitted.

† `/friend-attribution` emits React minified hydration error 418 on the no-config state. The source route is unchanged from the branch base `de90d769`; its initializer reads `window.location.search` on the client while server rendering starts in `LOADING`. The route remains visually usable and its locale states were checked. This is a pre-existing issue, not introduced by localization.

For the aggregate classification counts and regression results, see [STATUS.md](./STATUS.md). Per-occurrence decisions are recorded in [FINAL_THAI_CLASSIFICATION.json](./FINAL_THAI_CLASSIFICATION.json) and [FINAL_EN_ZH_CLASSIFICATION.json](./FINAL_EN_ZH_CLASSIFICATION.json).
