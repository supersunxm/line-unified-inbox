# AI progress

## Current task: Rebase Android Release PR #47 onto latest main (2026-08-25)

- Fetched and rebased `release/android-1.0.14` onto `origin/main` `ef07cfdca530dc8203f83a614de127437baede19` without changing or pushing main.
- Resolved the sole conflict in `DECISIONS.md` by preserving all newer main TikTok/public-site decisions and the Android 1.0.14 permanent-signing decision.
- Confirmed no Android source changed between the previously verified release commit and the rebased result, so the signed APK was not rebuilt or replaced.
- Verified APK SHA-256 remains `10d9716e8f75ec989a2c4979a6fef3b33b0173c862d94537b07a927fce49d1ba`; release metadata remains 1.0.14+15 dated 25 Aug 2026 with previous history intact.
- Checks passed: `git diff --check`, Flutter analyze, all 105 Flutter tests, targeted `/download` lint and 3/3 regression tests, and Next.js production build.
- Initial post-rebase CI exposed one stale newer-main TikTok test that still expected Bearer authorization after main changed WEB session forwarding to the canonical `oppo_session` cookie. Updated that test only, preserving the newer main implementation; full frontend tests now pass 393/393, targeted lint passes cleanly, and the production build passes.
- Next action: push the CI compatibility repair with `--force-with-lease` and wait for all PR #47 CI checks. Do not merge the PR.

## Current task: Android Production Release v1.0.14+15 (2026-08-25)

- Located the existing production signing material in the local Downloads credential setup; verified the store password, key alias, private-key password, and permanent certificate without exposing secret values.
- Configured the four Android signing values as GitHub Actions repository secrets.
- Corrected the production workflow's certificate check to normalize the compact lowercase digest emitted by current `apksigner`; added explicit `versionName` and `versionCode` gates.
- GitHub Actions run `32805224478` passed build, package ID, version, signature, rename, and artifact upload.
- Independently verified the downloaded APK: package `click.lineoppo.chat`, version `1.0.14+15`, permanent certificate SHA-256 `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`, production Railway API URL, and APK SHA-256 `10d9716e8f75ec989a2c4979a6fef3b33b0173c862d94537b07a927fce49d1ba`.
- Published the verified artifact only to the release branch download tree and added 1.0.14 to `/download` metadata while retaining 1.0.13 history.
- Final checks passed: Flutter analyze, all 105 Flutter tests, targeted `/download` lint and 3/3 regression tests, Next.js production build, live frontend health/download/history/APK HTTP checks, and independent APK package/version/signature/API/checksum verification.
- Release publication work is complete on the isolated release branch. PR #47 remains Draft pending explicit merge approval.

## Current task: Brand Accent Modernization to OPPO Green (2026-08-20)

- **Audit & Implementation**:
  - Replaced legacy orange brand tokens (`#ff6900`, `#e65e00`, `#fff1e6`, `#2e1808`) in `frontend/src/app/globals.css` with official **OPPO Green** tokens:
    - `:root` (Light mode): `--app-accent: #00a651; --app-accent-hover: #008f46; --app-accent-soft: #e8f9ec; --focus: #00a651;`
    - `html[data-theme="dark"]` (Dark mode): `--app-accent: #00a651; --app-accent-hover: #00bf5c; --app-accent-soft: #0d281a; --focus: #00a651;`
  - Replaced hardcoded `#FF6900` in `frontend/src/app/dashboard/executive-dashboard-v2.tsx` Tier 1 7-day follower trend chart with `var(--app-accent, #00A651)`.
  - Preserved semantic warning tokens (`--app-warning: #ff9500`, `--app-warning-soft: #fff4e0` in light / `#2e1e05` in dark) and error tokens (`--app-danger: #ff3b30`) strictly separate from the brand accent.
- **Verification & Test Results**:
  - Added automated test in `frontend/test/design-system-foundation.test.mts` verifying `--app-accent` is `#00a651`, warning tokens remain distinct, and navigation & charts consume semantic tokens.
  - All 376 frontend unit and regression tests passing (`npm test`).
  - Next.js Turbopack production build succeeded cleanly across all 21 routes (`npm run build`).

## Previous task: Follower Insights Dark Mode Canvas & Scoped CSS Normalization (2026-08-20)

- **Root Cause & Architectural Trace**:
  - **Scoped CSS Module Override**: `frontend/src/app/follower-insights/follower-insights-modern.module.css` declared hardcoded light variables (`--background: #f5f5f7`, `--surface: #ffffff`, `--input-background: #ffffff`, `--border: #e5e5ea`) and applied `background: ... var(--background) !important;` directly on `.scope :global(.app-content-section)` wrapping `follower-insights-view.tsx`.
  - In Dark Mode, this scoped rule forced the entire page canvas to remain a large light `#f5f5f7` rectangle while child cards were forced to white `#ffffff`.
  - `frontend/src/app/follower-insights/store-analytics-overview.tsx` had hardcoded `bg-white`, `border-[#E5E5EA]`, and `text-[#1D1D1F]` styles on Performance Analytics cards.
- **Normalization Applied**:
  - Aliased all CSS module variables in `follower-insights-modern.module.css` to global design tokens (`--background: var(--app-bg)`, `--foreground: var(--app-text-primary)`, `--surface: var(--app-surface)`, `--surface-elevated: var(--app-surface-subtle)`, `--input-background: var(--app-surface)`, `--border: var(--app-border)`, `--muted: var(--app-text-secondary)`, `--hover: var(--app-surface-hover)`, `--badge-background: var(--app-neutral-soft)`, `--badge-foreground: var(--app-text-secondary)`).
  - Updated card borders, inputs, selects, segmented controls, table headers, and scrollbars to semantic tokens.
  - Normalized `store-analytics-overview.tsx` cards, metric bars, and distribution buckets to use semantic design tokens (`--app-surface`, `--app-border`, `--app-text-primary`, `--app-surface-subtle`).
  - Normalized `StoreBreakdownTable` pagination buttons.
- **Verification & Test Results**:
  - Added targeted automated test assertions in `frontend/test/design-system-foundation.test.mts`.
  - Targeted test suite: `35 / 35 passed (100%)` (`follower-insights.test.mts`, `design-system-foundation.test.mts`).
  - Full frontend test suite: `375 / 375 passed (100%)`.
  - Next.js Turbopack build: Succeeded cleanly across all 21 routes (`npm run build`).

## Previous task: Site-Wide Dark Mode Normalization Pass (2026-08-20)

- **Root Cause Analysis**:
  - **Root Cause 1 (Tailwind CSS v4 Dark Variant Disconnect)**: In Tailwind CSS v4 (`@tailwindcss/postcss: ^4`), default `dark:` variants rely exclusively on the `@media (prefers-color-scheme: dark)` media query. Because the application toggles theme via `document.documentElement.dataset.theme = "dark"`, all standard Tailwind `dark:...` utility classes across the application failed to activate whenever the user chose Dark Mode on an OS in light mode.
  - **Root Cause 2 (Hardcoded Inline Variable Overrides in Dashboard)**: `frontend/src/app/dashboard/executive-dashboard-v2.tsx` declared an explicit inline `style={{ "--dash-bg": "#F5F5F7", "--dash-card": "#FFFFFF", ... }}` on the root container, forcing all `--dash-*` tokens to light hex values regardless of the active theme.
  - **Root Cause 3 (Hardcoded Sub-Component Hex Colors & Styles)**: Specific sub-components (such as `ReplyDonut` center circle, skeleton loaders, error cards, KPI badges, `StoreBreakdownTable` pagination, search input, sort buttons, and status pills) contained hardcoded hex backgrounds (`#E8F9EC`, `#FFF4E0`, `#FDE8E8`, `#F5F5F7`, `#FBFBFC`, `bg-white`) rather than semantic CSS tokens.
- **Global & Semantic Normalization Applied**:
  - Added `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, .dark, .dark *));` to `frontend/src/app/globals.css`. This immediately unifies all Tailwind `dark:` variants across the entire repository under the `[data-theme="dark"]` attribute selector.
  - Removed hardcoded inline styles from `frontend/src/app/dashboard/executive-dashboard-v2.tsx`, allowing `--dash-*` variables to seamlessly inherit the global `--app-*` dark mode palette (`--app-bg: #0d0f12`, `--app-surface: #14171d`, etc.).
  - Replaced hardcoded `#F5F5F7`, `bg-white`, and hex gradients in `ReplyDonut`, loading skeletons, error states, and Watchlist KPI pills with semantic variables (`--dash-card`, `--dash-bg`, `--dash-text`, `--dash-green`, `--dash-amber`, `--dash-red`, `--dash-purple`).
  - Normalized `frontend/src/app/follower-insights/store-breakdown-table.tsx` to use semantic variables (`--surface`, `--surface-elevated`, `--app-success-soft`, `--app-warning-soft`, `--app-danger-soft`, `--app-neutral-soft`).
  - Normalized `frontend/src/app/components/customer/customer-signals.tsx` and `frontend/src/app/tiktok/dashboard/tiktok-follower-chart.tsx` to use `--app-*` semantic tokens.
  - Normalized pilot checklist and system status views in `frontend/src/app/page.tsx` with `--app-bg`, `--app-surface`, `--app-border`, and `--app-text-primary`.
- **Verification & Test Results**:
  - Added automated test assertions in `frontend/test/design-system-foundation.test.mts` verifying that `@custom-variant dark` is declared and that no dashboard views declare inline light-mode overrides.
  - Frontend test suite: `374 / 374 passed (100%)`.
  - Next.js Turbopack build: Succeeded cleanly across all 20 routes (`npm run build`).
  - Backend test suite: `1,255 / 1,255 passed (100%)`.

## Previous task: Phase 3 — Unified Chat Inbox (/chats) Workspace Modernization (2026-08-20)

- Workspace Modernization: Modernized the interaction-heavy `/chats` 3-pane operational workspace into the shared application design system while preserving high operational information density.
- Preserved Core Layout & Interactions: Retained the desktop 5-grid track layout (`<ContextSidebar>`, `ResizableSeparator (sidebar)`, `<section data-chat-pane="conversations">`, `ResizableSeparator (conversations)`, `<section data-chat-pane="detail">`) with all resizing mechanics, minimums, maximums, and reset controls intact.
- Conversation List Pane (`data-chat-pane="conversations"`):
  - Upgraded pane container, header counter, bulk mark replied button, and search/filter controls with semantic tokens (`--app-surface`, `--app-border`, `--app-text-primary`, `--app-text-tertiary`).
  - Styled `ConversationRow` items with semantic selected state (`.is-selected`), action dropdown menus, customer avatar/identity typography, and structured BM reply status badges (`NOT_REPLIED`, `NOTIFIED_BM`, `REPLIED`).
  - Modernized toast banners for bulk status updates and incoming conversation notifications.
- Active Conversation Detail Pane (`data-chat-pane="detail"`):
  - Modernized compact header (`data-chat-detail-header`) with customer avatar, profile fetch indicator, stage badge, follow-up status, priority pill, `data-bm-reply-status-select`, refresh button, and primary "เปิดใน LINE OA" action.
  - Modernized chat message timeline (`data-chat-message-scroll`) with subtle surface backdrop, inbound bubble cards, outbound accent bubble cards, date separators, and image attachment viewer.
  - Modernized reply composer (`data-chat-reply-composer`) with duplicate-send protection, character counter, keyboard shortcut hint (`Enter` to send, `Shift+Enter` for newline), error feedback, and LINE OA manager notice.
  - Modernized customer intelligence area (`data-chat-detail-lower`): customer purchase card, product intent & AI insight card, internal staff notes textarea, and activity timeline.
  - Modernized bulk confirmation modal (`bulkConfirmState`) with semantic surface, backdrop blur, and accessible action buttons.
- Verification & Test Results:
  - 100% test pass rate across 373 frontend tests in `npm test` (including dedicated `shell-navigation.test.mts`, `bulk-mark-replied.test.mts`, `conversation-state-consistency.test.mts`, `chat-detail-hierarchy.test.mts`, and `design-system-foundation.test.mts`).
  - Next.js Turbopack build passed cleanly (`npm run build`).

## Previous task: Follower Insights Trend UX & Multi-Store Comparison (2026-08-20)

- Updated Follower Insights trend comparison to default to "All accounts with available data" (`available` / `บัญชีทั้งหมดที่มีข้อมูล`).
- Multi-store selection: replaced single-store combobox with accessible multi-select checkbox combobox supporting `ทุกร้าน`, single store name, or `Store +N`, with search filtering, `เลือกทั้งหมด`, and `ล้างการเลือก`.
- Multi-series trend chart: displays one distinct SVG line series per selected store using a 12-color high-contrast palette (`STORE_PALETTE`), store legend badges, and multi-store hover tooltip.
- Metrics switching: `followers`, `targetedReaches`, and `blocks` seamlessly update all selected store series without clearing store selections.
- Resilient partial data and empty states: displays partial coverage indicator (`3 จาก 5 ร้านมีข้อมูลในช่วงเวลานี้` / `เปรียบเทียบได้ 3 จาก 5 ร้าน`) when some accounts have data, and only triggers empty state when zero usable data points exist across all selected series.
- Single-store drilldown: retains store daily changes table when exactly 1 store is selected.
- Complete localization across Thai, English, and Chinese for all new keys (`selectAll`, `clearSelection`, `selectedStoresCount`, `storesWithDataCount`, `comparableStoresCount`).
- Verification: 100% test pass rate (360/360 frontend unit/regression tests, 1,255/1,255 backend tests), clean TypeScript compilation, Next.js build passed, NestJS build passed.


## Previous task: Executive Dashboard Redesign v2 (2026-08-19)

- Redesigned `/dashboard` into a five-tier executive information hierarchy.
- Tier 1: total followers hero, 7-day trend, and reply-status summary.
- Tier 2: response-speed distribution and peak-time operational view.
- Tier 3: unified store Watchlist with combined inactive/reach/block issues, fastest-growing stores, and partner rollup.
- Tier 4: Top 10 follower stores versus stores needing care.
- Tier 5: compact supplemental metrics.
- Added authenticated `GET /dashboard/executive-store-health` based on real LINE OA follower snapshots.
- Partner attribution is derived from the trailing `By XXX` store-name pattern; no database field or migration was added.
- Missing reach/block snapshot values remain null rather than being classified as a problem.
- Fixed reply-bucket percentage handling: when there are zero duration-backed replies, percentage is `null` and the UI displays a no-data state instead of misleading 0%/100%.
- Added backend and frontend regression coverage for the executive dashboard contract and zero-reply behavior.
- CI run #143 passed frontend lint/tests/build, backend migrations/lint/tests/build/auth smoke, and mobile analyze/tests.
- Draft PR: #32.
- No production deployment has occurred yet.


## Current task: Phase 2B Purchase Intelligence Campaign Composer (2026-08-19)

- Added a dedicated ADMIN-only composer for Purchase Intelligence `DRAFT + SELECTED_USERS` campaigns.
- Composer loads the exact Phase 2A recipient snapshot and exposes aggregate customer/store/LINE OA counts plus store/OA breakdown without returning customer recipient references.
- Campaign title, one text message, and one image can be edited and saved while the campaign remains `DRAFT`.
- Image attachment reuses the existing protected Mass Message JPEG/PNG upload path and limits.
- Save Draft preserves the existing `audienceSource` snapshot and creates no `MassMessageStoreDelivery` rows.
- Composer editing fails closed if a campaign is no longer DRAFT/SELECTED_USERS or already has delivery records.
- Existing Mass Message preview/send endpoints continue to reject `SELECTED_USERS`.
- `Review & Send` is visibly disabled; Phase 2B performs no LINE API send, processor invocation, or quota-consuming action.
- Draft PR: #30.
- CI #111 passed backend lint/regressions/build/startup smoke, frontend composer regression/lint/build, and Flutter analyze/tests.


## Current task: Phase 2A Purchase Intelligence → Broadcast Audience Draft (2026-08-19)

- Added ADMIN-only `POST /admin/purchase-analytics/audience/broadcast-draft`.
- Purchase Intelligence can create an exact Mass Message audience draft from the current authorized date/store/status selection.
- Broadcast draft creation requires `Only messageable users`; the backend recomputes the authorized audience rather than trusting client recipient IDs.
- Recipient membership is snapshotted as internal `customerId`, `conversationId`, `storeId`, and `lineOfficialAccountId` references only. Customer names and LINE User IDs are not duplicated into the campaign payload.
- Campaigns are created as `DRAFT + SELECTED_USERS` with zero store deliveries and no Mass Message processor invocation.
- `campaignRequestId` provides retry-safe idempotency.
- Legacy Mass Message preview/send endpoints explicitly reject `SELECTED_USERS` so the new audience type cannot fall through to a broader recipient scope.
- No Prisma migration was required; Phase 2A reuses the existing MassMessageCampaign JSON payload and DRAFT status.
- CI #98 passed backend lint/regressions/build/startup smoke, frontend regression/lint/build, and Flutter analyze/tests.
- Draft PR: #28.
- No LINE message, broadcast, or quota-consuming action is introduced in Phase 2A.


## Current task: Phase 1 Customer Audience Export for Purchase Intelligence (2026-08-19)

- Added authenticated `GET /admin/purchase-analytics/audience` using the existing date/store authorization scope.
- Audience is deduplicated to one row per customer and aggregates purchase products, variants, quantities, channels, and payment methods while preserving latest purchase/store/OA/BM context.
- Operational `canMessage` requires a LINE User ID plus an active, non-archived LINE OA in READY/CONNECTED state. This does not represent verified per-customer friend/block status.
- Added Purchase Intelligence `Export audience` workflow with Purchased / Interested / Not specified filters, messageable-only default, recipient counts, and UTF-8 BOM/formula-safe CSV generation.
- Preserved denormalized RAM/ROM/color from recorded sales items when no catalog variant relation exists.
- CI gate now explicitly lints Purchase Analytics and runs `purchase-analytics.service.spec.ts`; final PR CI #96 passed Backend / Frontend / Mobile.
- PR #27 merged to `main` as `ab716c25347d383e1c33d5ad5285a95772d8f6e7`.
- Railway production deployments succeeded: backend `f67fb343-d8ce-4a1f-9c61-5d04527e7fe6`, frontend `be1f46a4-77c9-4488-9126-81df760cd566`; backend runtime logs confirm `/admin/purchase-analytics/audience` is registered and frontend production build includes `/admin/purchase-analytics`.
- Remaining acceptance: authenticated operator download/review of a production CSV. No broadcast send action is included in Phase 1.

## Current task: Android Release v1.0.12+13 (Responsive Customer Sales Header)

- Fixed the narrow-screen Customer Sales Information header so the title can no longer collapse into one-character-per-line wrapping.
- Narrow layouts place Close + title on the first row and Clear all + Save on a second right-aligned action row; wider layouts retain the single-row header.
- Customer Sales Info tagging, persistence, nullable status, Clear all, and backend semantics are unchanged.
- Exact production APK: `oppo-line-oa-chat-v1.0.12-production.apk`.
- Version/build: `1.0.12+13`.
- Size: `56.9 MB (56898658 bytes)`.
- SHA-256: `376a29715cf143b1d92697990d22f8261fb246b7f9e1a80de5b8c621d90da82e`.
- Production API and APP_ENV verified; AOT check PASS.


## Current task: Android Release v1.0.6+7 (POS/CRM Draft Selection UX Flow)

- **Release Overview & Architecture**:
  - Implemented **Draft Selection Flow (POS / CRM paradigm: Select → Configure → Confirm → Save CRM)** in `ConversationTagsSheet`.
  - **Strict State Separation**:
    - `_selectedProducts`: strictly stores committed customer CRM products (`List<CustomerSalesProductItem>`).
    - `_draftProduct`: `ProductSelectorItem?` (temporary picker draft).
    - `_draftVariant`: `ProductVariantSelectorItem?` (temporary picker draft variant).
    - `_draftQuantity`: `int` (temporary picker quantity stepper, default 1).
    - Decoupled completely so the temporary picker NEVER mutates or shares state with existing CRM items until explicitly committed.
  - **Draft Flow Mechanics**:
    - Tapping `+ Add Product` opens catalog with `_draftProduct = null`, `_draftVariant = null`, `_draftQuantity = 1`.
    - User selects product → transitions to Draft Configuration view with `✓ Selected` badge and `[ Change Product ]` action.
    - User selects variant & adjusts quantity.
    - `[ Confirm Selection ]` button (`_canConfirmSelection`) is disabled until required product and variant configurations are selected.
    - Tapping `[ Confirm Selection ]` commits the draft item to `_selectedProducts`, resets all draft fields, and closes the picker.
    - Canceling or closing picker without confirming leaves `_selectedProducts` completely untouched.
- **Multilingual Support**:
  - Added localized strings for `confirmSelection`:
    - English (`app_en.arb`): `"Confirm Selection"`
    - Thai (`app_th.arb`): `"ยืนยันการเลือก"`
    - Chinese (`app_zh.arb`, `app_zh_CN.arb`): `"确认选择"`
- **Distribution & Checksums**:
  - Production APK: `oppo-line-oa-chat-v1.0.6-production.apk` (56.9 MB, SHA256: `6a6290a3bf54859303fed8fc3d37dad727dce455ffa38508df7c931d11499d6c`).
  - Synced to `frontend/public/downloads/`, download portal (`frontend/src/app/download/page.tsx`), database `AppRelease`, and `AppVersionService`.
- **Verification & Test Results**:
  - Backend tests: `1,230 / 1,230 passed (100%)`.
  - Backend build: Compiled cleanly (`prisma generate && nest build`).
  - Frontend tests: `344 / 344 passed (100%)`.
  - Frontend build: Compiled cleanly (19 routes).
  - Flutter analyze: `0 issues`.
  - Flutter tests: `89 / 89 passed (100%)` (including 8 dedicated POS/CRM Draft Selection and regression tests).
  - Emulator validation: Verified on Android emulator (`emulator-5554`) with screen captures.

## Previous task: Customer Sales Product & Variant Selection UX Improvements (v1.0.5+6)

- **UX Problem & Root Cause**:
  - Previously, product catalog items lacked explicit action buttons (`[Select]`) and the initial selection state was ambiguous.
- **Implemented Changes**:
  - **Explicit Catalog Unselected State**:
    - Each catalog item displays `○ Product Name` with series subtitle and category icon.
    - Explicit trailing action button: `[ Select ]` (`[ เลือก ]` / `[ 选择 ]`).
    - Initial state is strictly `_addingProduct = null` (no implicit auto-selection).
  - **Selected Product Visual Confirmation**:
    - When selected, product card transitions to a green-tinted container with a bold `✓ Selected` badge.
    - Trailing button: `[ Change Product ]` (`[ เปลี่ยนสินค้า ]` / `[ 更换产品 ]`), allowing 1-tap return to the catalog browser.
  - **Explicit Variant / Configuration Chips**:
    - Unselected variants display `○ RAM / ROM / Color`.
    - Selected variant displays `✓ RAM / ROM / Color` with brand primary highlight and border.
  - **Clear Addition CTA**:
    - Bottom action button changed to `[ Add to List ]` (`[ เพิ่มลงรายการ ]` / `[ 添加到列表 ]`) with cart icon, adding the item to the CRM sale list.
  - **Multilingual Support**:
    - Added localization across EN, TH, ZH, and ZH-CN.
- **Verification & Test Results**:
  - Backend tests: `1,230 / 1,230 passed (100%)`.
  - Backend build: Compiled cleanly (`prisma generate && nest build`).
  - Frontend tests: `344 / 344 passed (100%)`.
  - Frontend build: Compiled cleanly (19 routes).
  - Flutter analyze: `0 issues`.
  - Flutter tests: `85 / 85 passed (100%)` including dedicated product selection UX widget tests.
  - Production APK: Rebuilt and synced to download portal (`a59f8903b9f7ad5f39173612017054f30dc00cdeafb2525e970fbe4495001bd8`).

## Previous task: Android Release v1.0.5+6 (In-App APK Update System Release)

- **Release Overview & Features**:
  - **In-App APK Update System**:
    - Automatic version check upon app launch (`_restore()`) and app resume (`didChangeAppLifecycleState: resumed`).
    - Manual "Check for updates" option in `SettingsSection` (Profile tab).
    - Compares integer `buildNumber` rather than version strings for reliable progression.
    - Dialog with version badge (`Version 1.0.5+6 · 56.9 MB`), release highlights list, and "Update Now" action.
    - Supports both Optional Update (dismissible, "Update Now" / "Later") and Forced Update (non-dismissible barrier, `currentBuildNumber < minimumSupportedBuildNumber` or `forceUpdate: true`).
    - Non-silent download via verified HTTPS URL (`launchUrl` external intent) respecting Android enterprise security policies.
    - Download count tracking endpoint (`POST /app/version/track-download`).
  - **Backend Version API & Persistence**:
    - Created `AppPlatform` enum and `AppRelease` model in PostgreSQL schema (`backend/prisma/migrations/20260818120000_add_app_release_management`).
    - Created `AppVersionModule` exposing public endpoint `GET /app/version/android` (and parametric `GET /app/version/:platform`) with fallback defaults for zero-downtime resilience.
    - Admin management routes (`GET /app/releases`, `POST /app/releases`, `PATCH /app/releases/:id`).
  - **Portal & APK Distribution**:
    - Built production APK `oppo-line-oa-chat-v1.0.5-production.apk` (56.9 MB, SHA256: `da00c1a50ef111cbf290ca2783575aaaa5d8c2088f0422a765d4b6219d8afc2f`).
    - Updated download portal (`frontend/src/app/download/page.tsx`) with new badge, highlights, and exact checksum.
- **Verification & Test Results**:
  - Backend tests: `1,230 / 1,230 passed (100%)`.
  - Backend build: Compiled cleanly (`prisma generate && nest build`).
  - Frontend tests: `344 / 344 passed (100%)`.
  - Frontend build: Compiled cleanly (19 routes).
  - Flutter analyze: `0 issues`.
  - Flutter tests: `84 / 84 passed (100%)`.
  - Local API endpoint test: `GET /app/version/android` returning 200 with complete JSON metadata.

## Previous task: Android Release v1.0.4+5 (CRM UX Improvement Release)

- **Release Overview & Features**:
  - **Interested → Purchased Conversion Flow**: Added quick-action banner `[ 🛍️ Convert to Purchased ]` for existing Interested leads, automatically preserving existing products & variants while switching status to `PURCHASED`.
  - **Conversion Telemetry & Timeline**: Backend captures `isConversion: true`, `conversionTimeMs`, and `interestRecordedAt` in `ActivityHistory.metadata`. Web Monitor renders conversion badges `🎯 → 🛍️ (2d 4h)`.
  - **Instant Save Feedback**: Mobile chat page displays a floating `SnackBar` notification (`✓ Customer sales information saved` / `✓ Customer converted to Purchased`).
  - **Pilot Ergonomics (3-5 Taps)**: Clean chip visual states (`✓ Option` vs `○ Option`), neutral temperature selection (`Not specified`), and pre-save confirmation modal.
  - **Portal Update**: Updated download page (`frontend/src/app/download/page.tsx`) to `Version 1.0.4+5 (CRM UX Improvement Release) · 56.8 MB` with SHA256 checksum `4068576a687d328f5b4843105dfc63d904832e835014db8f129fdba26729221b`.
- **Verification & Test Results**:
  - Backend tests: `1,227 / 1,227 passed (100%)`.
  - Backend build: Compiled cleanly (`prisma generate && nest build`).
  - Frontend tests: `344 / 344 passed (100%)`.
  - Frontend build: Compiled cleanly (19 routes).
  - Flutter analyze: `0 issues`.
  - Flutter tests: `78 / 78 passed (100%)`.
  - Android emulator smoke test: APK installed and verified on `emulator-5554`.
  - Git diff check: Clean whitespace.

## Previous task: Phase 10C.11.1 — Remove Reply Token Age Cutoff (Always Attempt Unused LINE replyToken Before Push)

- **Overview & Architecture**:
  - Removed application-defined 45-second replyToken cutoff window.
  - New selection algorithm: queries newest unused replyToken (`encryptedLineReplyToken IS NOT NULL`, `lineReplyTokenUsedAt IS NULL`, `ORDER BY lineReplyTokenReceivedAt DESC LIMIT 1`) with zero age filter.
  - Reply API is always attempted first whenever an unused token exists. LINE determines token acceptance or rejection.
  - Explicit LINE token rejection (`invalidReplyToken: true`) falls back cleanly to Push API with single send.
  - Ambiguous network failures (timeout, socket error, 5xx) fail safely without duplicate push attempts.
  - Concurrency protected by atomic PostgreSQL conditional update (`lineReplyTokenUsedAt = now() WHERE id = $id AND lineReplyTokenUsedAt IS NULL`).
  - Added empirical age bucketing in structured telemetry: `< 30 seconds`, `30-60 seconds`, `1-2 minutes`, `2-5 minutes`, `5-10 minutes`, `> 10 minutes`.
- **Verification & Test Results**:
  - Backend tests: `1,225 / 1,225 passed (100%)`.
  - Backend build: Compiled cleanly (`prisma generate && nest build`).
  - Frontend tests: `344 / 344 passed (100%)`.
  - Frontend build: Compiled cleanly (19 routes).
  - Flutter analyze: `0 issues`.
  - Flutter tests: `79 / 79 passed (100%)`.
  - Git diff check: Clean whitespace.

## Previous task: Investigation of Production APK Image & Message Sending Diagnostics

- **Investigation Findings**:
  - **Environment Difference**:
    - Simulator (Device A): Connected to local backend (`http://10.0.2.2:3001`), using local mock stores or store with active/unrestricted quota. Both text and images send successfully.
    - Production APK (Device B): Connected to Railway production (`https://line-unified-inbox-production-544f.up.railway.app`), using real store tokens (Store: OBS).
  - **Root Cause of "LINE จำกัดจำนวนการส่งชั่วคราว"**:
    - When LINE Messaging API returns `HTTP 429 Too Many Requests`, it indicates either a burst rate limit OR **Monthly Free Message Quota Exhaustion** (`{"message":"You have reached your monthly limit."}`).
    - The backend previously threw a generic Thai message `"LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง"` for all 429 status codes without parsing the body.
    - For Store OBS, the LINE OA free tier monthly push quota (500 messages/month) was reached, causing LINE to reject all push requests (both text and image) with HTTP 429.
  - **Structured Diagnostic Logging & Quota Detection**:
    - Updated `LineMessagingService` (`pushText`, `pushImage`, `multicast`) with structured JSON logs containing `userId`, `storeId`, `storeName`, `channelIdMasked`, `messageType`, `imageUrlDomain`, `statusCode`, and `errorBody`.
    - Added automatic classification on HTTP 429: if the error message contains `monthly limit` or `quota`, the backend explicitly responds with `"โควต้าการส่งข้อความฟรีรายเดือนของ LINE OA ร้านนี้เต็มแล้ว กรุณาอัปเกรดแพ็กเกจใน LINE Official Account Manager"`.
  - **Verification**:
    - Backend test suite: `1,216 / 1,216 passed (100%)`.
    - Frontend test suite: `344 / 344 passed (100%)`.
    - Signed media URL generation and verification tested and intact.

## Previous task: Android Release v1.0.2 (Pilot Messaging Release)

- **Release Overview & Features**:
  - **Version & Build**: `v1.0.2+3` (`oppo-line-oa-chat-v1.0.2-production.apk`).
  - **Image Preview Before Sending**: Dedicated fullscreen modal preview (`_ImagePreviewPage`) with interactive pinch-to-zoom before user confirms with `[Send]` or aborts with `[Cancel]`.
  - **Camera Capture & Gallery Attachment**: Modal attachment sheet (`Take Photo` via `ImageSource.camera` / `Gallery` via `ImageSource.gallery`).
  - **Client-Side Compression**: Auto-scales large camera/gallery images (`maxWidth: 2048`, `maxHeight: 2048`, `imageQuality: 85`) keeping uploads fast and within limits.
  - **Image Delivery Reliability**: Upgraded `ApiClient._extractErrorMessage` to extract real server error messages and handle session expiry, eliminated artificial S3 restriction in backend, and added detailed LINE push message error logging.
- **Binary & Distribution**:
  - Binary File: `frontend/public/downloads/oppo-line-oa-chat-v1.0.2-production.apk` (56,118,743 bytes, ~56.1 MB).
  - SHA256: `4811ca85df647b39eaa04f51fec5e03a48c851102a7563edfbd3cee4626b8258`.
  - Download Page: Updated at `/download` with release badge `Version 1.0.2+3 (Pilot Messaging Release) · 56.1 MB`.
- **Validation & Verification**:
  - Flutter analyze: `0 issues`.
  - Flutter test suite: `79 / 79 passed (100%)`.
  - Backend test suite: `1,215 / 1,215 passed (100%)`.
  - Frontend test suite: `344 / 344 passed (100%)`.
  - Next.js production build: Succeeded with `/download` static route.
  - Real device / emulator: Installed on `emulator-5554` and verified inbox, chat detail, attachment bottom sheet, and image preview actions.

## Previous task: Android Production APK Release v1.0.1+2

- **App Version & Build**:
  - Incremented version in `android_app/pubspec.yaml` to `1.0.1+2`.
  - Built release APK with Flutter 3.4.0 & Dart defines: `API_BASE_URL=https://line-unified-inbox-production-544f.up.railway.app`, `APP_ENV=production`.
  - APK Binary: `oppo-line-oa-chat-v1.0.1-production.apk` (56,183,971 bytes, ~56.2 MB).
  - SHA256 Checksum: `e8d06e4b7249a5b4ee06b0e7717fd4af437884e7a2e2d1b813aafee9b1eb93b4`.
- **Validation on Real Android Device / Emulator**:
  - Clean install via `adb install -r android_app/build/app/outputs/flutter-apk/app-release.apk` on `emulator-5554`.
  - Verified official app branding ("OPPO LINE OA Chat" with OPPO Brand Shop logo).
  - Verified compact Inbox layout with 5+ conversation cards visible above the fold.
  - Verified reordered filter chips: `[All] ➔ [Need Reply] ➔ [Completed] ➔ [Priority]`.
  - Verified thread view, customer slip image rendering, message replies, and purchase information tagging.
- **Distribution Package**:
  - Placed distribution APK at `frontend/public/downloads/oppo-line-oa-chat-v1.0.1-production.apk`.
  - Updated download portal `frontend/src/app/download/page.tsx` with version `1.0.1+2`, updated filename, SHA256 checksum, and installation guide.
- **Verification & Test Results**:
  - `flutter analyze`: 0 issues.
  - `flutter test`: 77 / 77 passed (100%).
  - Next.js build: Compiled cleanly with `/download` route generated.

## Previous task: Phase 10C.10 — Bulk "Mark as Replied" Pagination Independence & Filter-Based Execution

- **Pagination Independence & Scalability Audit**:
  - Identified risk in initial client-ID passing where frontend only provided loaded page IDs (e.g. 50 items) rather than the full database queue (1,466+ conversations).
  - Implemented `POST /conversations/bulk-mark-replied-by-filter` endpoint in `ConversationsController` and `ConversationsService.bulkMarkRepliedByFilter(dto, user)`.
  - Accepts `{ bmReplyStatus?: 'NOT_REPLIED', storeId?: string }` (e.g. `storeId: 'all'` or specific store ID).
  - Evaluates operational filters and store authorization:
    - `ADMIN`: Authorized for `storeId: 'all'`, marks all matching database records across all accessible stores (e.g. 1,466 records).
    - `STORE_MANAGER` / `BM`: Restricted to assigned stores (`assertStoreAccess`); requesting `storeId: 'all'` is rejected with 403 `ForbiddenException`.
  - Transactional update: updates `bmReplyStatus = REPLIED`, `followUpStatus = COMPLETED`, `updatedAt = new Date()`, chunks `ActivityHistory` creation in batches of 100, and writes `AuditLog` entry.
- **Frontend Integration (`/chats`)**:
  - `handleExecuteBulkUpdate` calls `api.bulkMarkRepliedByFilter({ bmReplyStatus: 'NOT_REPLIED', storeId: bulkConfirmState.storeId === 'all' ? undefined : bulkConfirmState.storeId })`.
  - Accurately reconciles all 1,466+ records in the database, refreshing list pagination and all KPI counters.
- **Verification & Test Results**:
  - Backend tests: `1,215 / 1,215 passed (100%)` including dedicated unit tests for Admin 1466-item bulk update, BM own store update, BM all-store 403 rejection, and pagination independence.
  - Frontend tests: `344 / 344 passed (100%)`.
  - Mobile tests: `77 / 77 passed (100%)`.
  - TypeScript builds: Backend (`prisma generate && nest build`) and Frontend (`next build`) compiled cleanly with 0 errors.

## Previous task: Dedicated Public TikTok Store Authorization Flow with Internal Service Authentication

- **Security Remediation & Architecture**:
  - Reverted unrestricted `@Public()` on general `POST /tiktok/sync`. Normal `POST /tiktok/sync` remains protected by session `AuthGuard`.
  - Created dedicated internal service-to-service endpoint: `POST /tiktok/internal/sync` protected by `InternalTikTokSyncGuard` (`backend/src/tiktok/internal-sync.guard.ts`).
  - `InternalTikTokSyncGuard` requires and validates the `X-Internal-TikTok-Secret` header using constant-time `crypto.timingSafeEqual` against `process.env.TIKTOK_INTERNAL_SYNC_SECRET`. Fails closed if the secret is missing or mismatched. Secrets are never leaked into responses, URLs, or logs.
  - Server-side Next.js OAuth callback (`frontend/src/app/tiktok/callback/route.ts`) calls `syncTikTokAccountInternallyToBackend` using `process.env.TIKTOK_INTERNAL_SYNC_SECRET` strictly on the server side. Fails safely and redirects to the error page if the secret is unconfigured.
  - **Success Page Integrity**: Replaced URL query parameters with a short-lived (60s), HttpOnly cookie `tiktok_connect_result` scoped to `/tiktok/connect/success`. The public success page reads and verifies the cookie server-side, preventing arbitrary URL parameter tampering or false connection confirmations.
- **Public Authorization Routes**:
  - `GET /tiktok/connect`: Public entry route handler. Generates 32-byte cryptographic OAuth state, sets HttpOnly cookie (`tiktok_oauth_state`, SameSite=Lax, 10 min maxAge), and immediately 302 redirects to TikTok OAuth with read-only scopes `user.info.basic,user.info.profile,user.info.stats,video.list`.
  - `GET /tiktok/callback`: Public callback. Validates state cookie, exchanges code server-side, fetches profile & video data, syncs via internal backend endpoint, and handles StoreMaster routing.
  - `GET /tiktok/connect/success`: Mobile-first standalone page with bilingual Thai and English confirmation, displaying verified store information from short-lived cookie without admin navigation.
  - `GET /tiktok/connect/error`: Mobile-first standalone page handling error reasons (`authorization_denied`, `invalid_state`, `store_not_found`, `duplicate_store_mapping`, `oauth_failed`).
  - **Admin Protection Preserved**: `/tiktok`, `/tiktok/dashboard`, `/tiktok/dashboard/[accountId]`, and admin backend APIs remain strictly authenticated via `oppo_session`.
- **Verification**:
  - Backend tests: `1,185 / 1,185 passed (100%)`.
  - Backend build: `prisma generate && nest build` completed cleanly.
  - Frontend tests: `340 / 340 passed (100%)`.
  - Frontend build: `next build` (Turbopack) completed cleanly with all routes generated.

## Previous task: Multi-Account 2-Store Test Preparation & Account-Specific Dashboard

- **Multi-Account Overview (`/tiktok`)**:
  - Updated `frontend/src/app/tiktok/page.tsx` and `tiktok-overview-view.tsx` to fetch `GET /tiktok/accounts` list from backend.
  - If 0 accounts: renders clean empty state.
  - If 1 account: renders full single-store overview + StoreMaster attribution badge + direct link to `/tiktok/dashboard/${accountId}`.
  - If 2+ accounts: renders responsive grid of connected store accounts cards displaying avatar, TikTok display name, `@username`, StoreMaster store name, province, region, follower count, connection status badge, last synced timestamp, and "Open Dashboard" button linking to `/tiktok/dashboard/${accountId}`.
- **Account-Specific Dashboard (`/tiktok/dashboard/[accountId]`)**:
  - Introduced dynamic route `frontend/src/app/tiktok/dashboard/[accountId]/page.tsx` fetching individual store account data and historical metrics (`GET /tiktok/accounts/:id`, `GET /tiktok/accounts/:id/metrics`).
  - Updated `/tiktok/dashboard/page.tsx` to redirect to the primary/first account dashboard when accounts exist (`/tiktok/dashboard/${accounts[0].id}`).
  - Added store switcher dropdown selector to `TikTokDashboardView` when multiple accounts exist, allowing instant switching between stores.
- **Backend Multi-Account Isolation**:
  - Added `getTikTokAccountById(id)` in `TikTokService` and `@Get("accounts/:id")` in `TikTokController`.
  - Refactored `mapToSafeAccountOverview` in `TikTokService` and updated `upsertTikTokAccount` to return the exact account upserted by ID.
  - Verified account isolation: distinct openIds create separate records, duplicate openId reconnects update in-place without creating duplicate rows, videos and daily metrics are strictly isolated by `tikTokAccountId`.
- **Verification**:
  - Backend tests: `1,107 / 1,107 passed (100%)`.
  - Backend build: `nest build` completed with 0 errors.
  - Frontend tests: `312 / 312 passed (100%)`.
  - Frontend build: `next build` completed with 0 errors, registering `/tiktok/dashboard/[accountId]`.

## Previous task: Automatic Daily TikTok Metric Collection & Follower Growth Dashboard UI

## Previous task: TikTok Daily Account Metric Snapshots for Follower-Growth Tracking

## Previous task: Automatic TikTokAccount to StoreMaster Binding & Reconciliation

## Previous task: TikTok Video Data Retrieval and Display API Metric Enrichment

## Previous task: Investigation and Fix for oppo_session Scoping and TikTok Authentication Boundary

## Previous task: Canonical Bearer Session Authentication Forwarding for TikTok Backend Sync

- **Canonical Bearer Authentication**:
  - Implemented single canonical server-to-server authentication pattern (`Authorization: Bearer <sessionToken>`) for all TikTok backend endpoints (`POST /tiktok/sync`, `GET /tiktok/latest`, `GET /tiktok/accounts`).
  - Extracted solely the `oppo_session` token from incoming `NextRequest` cookies or Server Component `cookies()` context without forwarding raw cookie headers or duplicating cookie parameters.
  - Fail-closed unauthenticated behavior: If `oppo_session` is absent, requests are short-circuited/rejected with 401 without dispatching unauthenticated empty-token requests.
  - Safe boolean/status diagnostic telemetry: Logs `sessionTokenPresent: boolean`, `backendSyncStatus`, and `backendReadStatus` while strictly preserving token confidentiality.
- **Verification**:
  - Backend tests: Added `backend/src/tiktok/tiktok.controller.spec.ts` testing `AuthGuard` protection (1,113/1,113 passing).
  - Frontend tests: Updated `frontend/test/tiktok-token-exchange.test.mts` testing Bearer forwarding, cookie exclusion, and diagnostic safety (306/306 passing).
  - Production builds: Backend `nest build` and Frontend `next build` succeeded with 0 errors.

## Previous task: TikTok Frontend Route Restructuring & Performance Dashboard

- **Route Architecture**:
  - Restructured `/tiktok` to serve as the TikTok Module Overview / Home (`frontend/src/app/tiktok/page.tsx` + `tiktok-overview-view.tsx`).
    - If account is connected: Renders account card, avatar, display name, `@username`, store attribution badge (`StoreMaster` or `O-Central World POC Sandbox`), connection status, audience metrics, quick profile link, and primary button to open dashboard.
    - If no account is connected: Renders clean empty state with direct action buttons linking to `/tiktok/connect` and `/tiktok/dashboard`.
  - Created `/tiktok/dashboard` as the dedicated TikTok Performance Dashboard (`frontend/src/app/tiktok/dashboard/page.tsx` + `tiktok-dashboard-view.tsx`).
    - Renders 6 real-time KPI cards: Followers, Following, Total Likes, Total Videos, Total Video Views, and Average Views per Video.
    - Renders Performance Summary: Top Video by Views, Top Video by Likes, Total Video Engagement, and Average Engagement per Post.
    - Renders Recent Published Videos section with cover thumbnails, durations, titles, publish dates, views, likes, comments, shares, and direct video links.
  - Updated `/tiktok/connect` navigation and footer links to direct users to `/tiktok` and `/tiktok/dashboard` rather than the main LINE OA `/dashboard`.
- **Store Attribution & Data Integrity**:
  - Leverages persisted PostgreSQL data via backend `GET /tiktok/latest` (Server Components).
  - Central World POC account is cleanly displayed; if `storeMaster` is linked, displays store metadata, and if `null`, gracefully displays TikTok account identity without fake foreign keys or dashboard disruption.
- **Verification**:
  - Added test coverage in `frontend/test/tiktok-token-exchange.test.mts` verifying overview and dashboard route separation, 6 KPI cards, performance highlights, video analytics, internal TikTok route navigation, and zero token leakage (306/306 tests passing).
  - Next.js Turbopack build compiled `ƒ /tiktok`, `ƒ /tiktok/dashboard`, and `○ /tiktok/connect` with zero errors.

## Previous task: StoreMaster TikTok Account Mapping & Importer Pipeline Update

- **Prisma Schema & Migration**:
  - Added nullable fields `tiktokUsername String?` and `tiktokProfileUrl String?` with index `@@index([tiktokUsername])` to `StoreMaster` model in `backend/prisma/schema.prisma`.
  - Added migration `backend/prisma/migrations/20260814160000_add_store_master_tiktok_fields/migration.sql`.
- **Importer Pipeline & Utilities**:
  - Updated `parseStoreMasterCsv` in `backend/src/store-master/store-master.utils.ts` to map Column I (`TikTok Username`) and Column J (`TikTok Profile URL`).
  - Added `cleanTikTokUsername` to strip leading `@`, trim whitespace, and normalize empty/`#REF!` values to `null`.
  - Added `isValidTikTokProfileUrl` and `extractTikTokUsernameFromUrl` to validate URLs and detect handle mismatches between username and profile link.
  - Updated `StoreMasterService.importCsv` and `StoreMasterService.search` in `backend/src/store-master/store-master.service.ts` to persist TikTok fields during Google Sheet/CSV imports and support search by TikTok handle.
  - Added import diagnostics for missing TikTok handles, duplicate TikTok handles, malformed URLs, and username/URL mismatches without failing the overall import.
- **Verification**:
  - Added test suites in `backend/src/store-master/store-master.utils.spec.ts` and `backend/src/store-master/store-master.service.spec.ts` testing Column I & J parsing, `@` stripping, empty values to null, duplicate diagnostics, and safe re-imports.
  - Backend tests: **1,112 / 1,112 passed (100%)**.
  - Backend build: `nest build` passed with 0 errors.
  - Frontend tests: **304 / 304 passed (100%)**.
  - Frontend build: Next.js Turbopack build passed with 0 errors.

## Previous task: Final Architecture & Security Audit for TikTok PostgreSQL Persistence

- **Backend Architecture & Prisma Schema**:
  - Added `TikTokConnectionStatus` enum (`CONNECTED`, `EXPIRED`, `DISCONNECTED`, `ERROR`), `TikTokAccount` model, and `TikTokVideo` model to `backend/prisma/schema.prisma` with reverse relations to `Store` and `StoreMaster`.
  - Added migration `backend/prisma/migrations/20260814150000_add_tiktok_account_and_videos/migration.sql` creating tables, foreign keys, and indexes.
  - Implemented `TikTokService` in `backend/src/tiktok/tiktok.service.ts` with AES-256-GCM token encryption via existing `CredentialEncryptionService` (`encryptedAccessToken`, `encryptedRefreshToken`), unique `openId` upserting, video analytics upserting, and safe DTO projections strictly omitting token fields.
  - Implemented `TikTokController` in `backend/src/tiktok/tiktok.controller.ts` providing `POST /tiktok/sync`, `GET /tiktok/latest`, and `GET /tiktok/accounts`.
  - Registered `TikTokModule` in `backend/src/app.module.ts`.
- **Frontend Integration**:
  - Updated `/tiktok/callback/route.ts` to call backend `POST /tiktok/sync` to persist accounts and videos upon successful authorization.
  - Updated `/tiktok/page.tsx` as an async Server Component fetching persisted data from backend `GET /tiktok/latest`.
  - Removed temporary single-instance in-memory store (`frontend/src/app/tiktok/tiktok-data-store.ts`).
- **Verification**:
  - Backend unit tests (`backend/src/tiktok/tiktok.service.spec.ts`) verified token encryption at rest, unique openId reconnect/update handling, video upserting, and DTO token sanitization.
  - All 1,108 backend tests passing across NestJS test suites.
  - All 304 frontend tests passing across 39 suites.
  - Prisma validation and Next.js Turbopack build succeeded.

## Current task: TikTok Server-Side Token Exchange and Account Data Retrieval

- **Token Exchange & API Client**:
  - Implemented `exchangeTikTokAuthorizationCode` in `frontend/src/app/tiktok/tiktok-api-client.ts` issuing server-side `POST https://open.tiktokapis.com/v2/oauth/token/` with `application/x-www-form-urlencoded` encoding (`client_key`, `client_secret`, `code`, `grant_type=authorization_code`, `redirect_uri`).
  - Added safe diagnostic logger `logTikTokTokenDiagnostic` logging boolean/metadata only (`tokenExchangeSucceeded`, `accessTokenPresent`, `refreshTokenPresent`, `openIdPresent`, `grantedScopeCount`, `expiresIn`).
  - Implemented `fetchTikTokUserProfile` calling `GET https://open.tiktokapis.com/v2/user/info/` with `fields` for basic profile info, verification status, and statistics (followers, following, likes, video count).
  - Implemented `fetchTikTokVideoList` calling `POST https://open.tiktokapis.com/v2/video/list/` retrieving public video metadata and engagement metrics.
- **Server Store & Proof-of-Concept Dashboard**:
  - Created server-side in-memory data store in `frontend/src/app/tiktok/tiktok-data-store.ts` (`setLatestTikTokData`, `getLatestTikTokData`) ensuring tokens and secrets are never stored in client cookies, localStorage, or rendered HTML.
  - Implemented proof-of-concept dashboard page at `/tiktok` (`frontend/src/app/tiktok/page.tsx` and `tiktok-dashboard-view.tsx`) displaying account header, verified badge, 4 key performance metric cards, and recent video performance list.
- **Callback Orchestration**:
  - Enhanced `/tiktok/callback/route.ts` to orchestrate token exchange, profile retrieval, and video list fetch, saving data to server store and redirecting to `https://lineoppo.click/tiktok` on success.
  - Handled failures safely by redirecting to `/tiktok/callback/result?status=token_error` and `status=profile_error` without exposing raw errors or tokens.
- **Verification**:
  - Added test suite in `frontend/test/tiktok-token-exchange.test.mts` validating token response parsing, error handling, safe diagnostics, server store, and non-exposure of secrets (304/304 tests passing across 39 test files).
  - Next.js Turbopack build verified routes `ƒ /tiktok`, `ƒ /tiktok/callback`, `ƒ /tiktok/callback/result`, `○ /tiktok/connect`, and `ƒ /api/tiktok/authorize`.

## Current task: Public Origin for OAuth Callback Result Redirect

- **Route & Architecture**:
  - Implemented `getPublicAppUrl` in `frontend/src/app/tiktok/connect/tiktok-oauth.ts` resolving `NEXT_PUBLIC_APP_URL` or falling back to `https://lineoppo.click`, while rejecting internal container hosts (`0.0.0.0`, `localhost`).
  - Updated `/tiktok/callback/route.ts` and `/api/tiktok/authorize/route.ts` to construct destination redirect URLs (`/tiktok/callback/result`, `/tiktok/connect`) using the public application origin rather than `request.url` / `request.nextUrl`, preventing internal Railway container address exposure (`http://0.0.0.0:8080`).
  - Documented `NEXT_PUBLIC_APP_URL=https://lineoppo.click` in `frontend/.env.example`.
- **Verification**:
  - Added test cases in `frontend/test/tiktok-callback.test.mts` validating public origin resolution, absence of `0.0.0.0` or `localhost`, and uniform redirect construction across all callback outcomes (294/294 tests passing across 38 test files).
  - Next.js Turbopack build verified clean build.

## Current task: Resolve TikTok OAuth Callback Double-Processing Bug

- **Root Cause Resolution**:
  - Diagnosed that the previous `useEffect` calling Server Action `consumeTikTokOAuthStateAction()` generated a `POST /tiktok/callback` request. In Next.js App Router, Server Actions automatically re-render the page Server Component after mutation. Because the cookie was already cleared by the action, the second render re-evaluated state without the cookie and rendered `STATE_MISMATCH`.
  - Replaced the callback architecture with a dedicated Route Handler at `/tiktok/callback` (`frontend/src/app/tiktok/callback/route.ts`) that validates state, immediately clears the `tiktok_oauth_state` cookie on the server redirect response, and redirects to `/tiktok/callback/result?status=...`.
  - Created pure presentational result page at `frontend/src/app/tiktok/callback/result/page.tsx` with zero client-side `useEffect`, zero Server Actions, and zero `POST` requests.
  - Deleted obsolete `frontend/src/app/tiktok/callback/actions.ts`.
- **Verification**:
  - Added test suites in `frontend/test/tiktok-callback.test.mts` verifying single server-side evaluation, route handler cookie cleanup, absence of `useEffect`/Server Actions, and client prop isolation (292/292 tests passing across 38 test files).
  - Next.js Turbopack build verified routes `ƒ /tiktok/callback` (Route Handler) and `ƒ /tiktok/callback/result` (Result Page).

## Current task: TikTok OAuth State Lifecycle Hardening and Diagnostics

- **Route & Architecture**:
  - Implemented direct HTTP redirect route handler at `/api/tiktok/authorize` in `frontend/src/app/api/tiktok/authorize/route.ts` to replace client-side action redirection with standard HTTP 302 redirect carrying `Set-Cookie: tiktok_oauth_state=...; Path=/; HttpOnly; SameSite=Lax; Secure`.
  - Updated `frontend/src/app/tiktok/connect/connect-form.tsx` to submit natively via GET to `/api/tiktok/authorize`, ensuring guaranteed cookie persistence before navigating to TikTok Login Kit.
  - Isolated `TikTokCallbackView` props to strictly pass `status` and `errorMessage`, ensuring authorization codes and state strings never enter client component props.
- **Diagnostics & Safe Logging**:
  - Implemented `logTikTokCallbackDiagnostic` in `frontend/src/app/tiktok/callback/tiktok-callback-validator.ts` and `page.tsx` emitting safe booleans only (`callbackStatePresent`, `stateCookiePresent`, `stateLengthsMatch`, `stateMatched`, `hasCode`, `hasError`) without logging sensitive strings.
- **Verification**:
  - Added test suites in `frontend/test/tiktok-connect.test.mts` and `frontend/test/tiktok-callback.test.mts` (291/291 tests passing across 38 test files).
  - Next.js Turbopack build verified routes `ƒ /api/tiktok/authorize`, `ƒ /tiktok/callback`, and `○ /tiktok/connect`.

## Current task: TikTok OAuth State Validation and Cookie Consumption

- **Route & Architecture**:
  - Enhanced `/tiktok/callback` in `frontend/src/app/tiktok/callback/page.tsx`, `tiktok-callback-view.tsx`, and `tiktok-callback-validator.ts`.
  - Implemented server-side timing-safe state comparison via `timingSafeStringEqual` and `validateTikTokOAuthState` in `tiktok-callback-validator.ts`.
  - Added server action `consumeTikTokOAuthStateAction` in `frontend/src/app/tiktok/callback/actions.ts` to immediately clear/expire the `tiktok_oauth_state` HttpOnly cookie upon callback processing to prevent replay attacks.
- **Validation & Security**:
  - Rejects callbacks with missing state query parameter, missing `tiktok_oauth_state` cookie, or mismatched state values.
  - Renders user-friendly security message: *"Unable to verify the TikTok authorization request. Please start the connection again."*
  - State values and authorization codes are strictly NEVER exposed to client-side DOM, window properties, or console logs.
  - Maintained safe error mapping for TikTok platform errors and preserved absence of client secrets.
- **Verification**:
  - Added test suite in `frontend/test/tiktok-callback.test.mts` validating matching state, missing query state, missing cookie state, mismatched state, safe user-facing messaging, cookie clearance, and non-exposure of codes/states (289/289 tests passing across 38 test files).
  - Next.js Turbopack build verified dynamic route generation `ƒ /tiktok/callback` alongside static routes `○ /tiktok/connect`, `○ /terms`, and `○ /privacy`.

## Current task: TikTok OAuth Connect Entry Page

- **Route & Architecture**:
  - Implemented public OAuth initiation page at `/tiktok/connect` in `frontend/src/app/tiktok/connect/page.tsx`, `connect-form.tsx`, `actions.ts`, and `tiktok-oauth.ts`.
  - Configured Next.js App Router metadata with title `Connect TikTok Account | OPPO Retail TikTok Monitor` and `robots: { index: false, follow: false }`.
  - Documented server-side environment variables `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, and `TIKTOK_REDIRECT_URI=https://lineoppo.click/tiktok/callback` in `frontend/.env.example`.
- **OAuth Preparation & Security**:
  - Server action `initiateTikTokOAuthAction` reads `TIKTOK_CLIENT_KEY` and `TIKTOK_REDIRECT_URI` strictly on the server.
  - Generates a 64-character cryptographically secure OAuth state (`generateOAuthState`) and stores it in an HttpOnly, secure, SameSite=Lax cookie (`tiktok_oauth_state`).
  - Constructs TikTok OAuth authorization URL requesting read-only scopes: `user.info.basic,user.info.profile,user.info.stats,video.list`.
  - UI clearly states that the application only requests read-only monitoring and does not request permission to publish, edit, or delete videos.
  - `TIKTOK_CLIENT_SECRET` is never exposed to client-side code or bundles; missing credentials fail safely with an informative configuration message.
- **Verification**:
  - Added unit, integration, and security test suite in `frontend/test/tiktok-connect.test.mts` (286/286 tests passing across 38 test files).
  - Next.js Turbopack build verified static route generation `○ /tiktok/connect` (0 errors, clean build).

## Current task: TikTok OAuth Callback Foundation

- **Route & Architecture**:
  - Implemented public OAuth callback route at `/tiktok/callback` in `frontend/src/app/tiktok/callback/page.tsx`, `tiktok-callback-view.tsx`, and `tiktok-callback-utils.ts`.
  - Configured Next.js App Router metadata with title `TikTok Authorization | OPPO Retail TikTok Monitor` and `robots: { index: false, follow: false }` to prevent search engine indexing.
  - Wrapped search params consumer inside React `<Suspense>` boundary for static page prerendering compatibility.
- **Behavior & Security**:
  - Handles 3 distinct callback states:
    1. **Code Received (Success/Pending)**: Displays clean confirmation that authorization was received and is pending server-side verification; authorization codes and tokens are strictly NOT rendered on screen or logged to browser console.
    2. **Error Received**: Uses `getSafeTikTokErrorMessage` to map standard OAuth error codes (`access_denied`, `invalid_scope`, `unauthorized_client`, `server_error`, `temporarily_unavailable`) to safe human-readable messages without exposing raw payloads or stack traces.
    3. **Missing Parameters (Invalid)**: Displays an invalid request message directing users to initiate authorization from the dashboard.
  - No client secrets, tokens, or hardcoded TikTok credentials exist in the client bundle.
- **Verification**:
  - Added test suite in `frontend/test/tiktok-callback.test.mts` verifying route existence, metadata, robots tag, error mapping, state rendering, security invariants, and separation from `TopNavigation` (275/275 tests passing across 37 test files).
  - Next.js Turbopack build verified static route generation `○ /tiktok/callback` (0 errors, clean build).

## Current task: Public Privacy Policy Page for OPPO Retail TikTok Monitor

- **Route & Architecture**:
  - Implemented standalone public page at `/privacy` in `frontend/src/app/privacy/page.tsx`.
  - Configured Next.js App Router metadata with title `Privacy Policy | OPPO Retail TikTok Monitor` and description tailored for TikTok Developer App review.
  - Rendered public legal documentation without requiring user authentication and without altering existing LINE OA pages or navigation headers.
- **Content & Coverage**:
  - Included all 11 policy sections matching developer app review requirements:
    1. Information We Collect (account identifiers, profile info, follower/following count, likes, video metrics, OAuth tokens)
    2. How We Collect Information (TikTok Login Kit, authorized APIs with explicit operator consent)
    3. How We Use Information (internal operations monitoring, store-level analytics, content tracking, reporting)
    4. Data Sharing (data is not sold, not shared with advertisers, authorized internal use/legal compliance only)
    5. Data Storage and Security (reasonable technical and organizational security measures, secure backend token storage, no frontend exposure)
    6. Data Retention (retained only as long as necessary, deleted or anonymized when no longer required)
    7. Account Disconnection and Data Deletion (self-serve disconnection, deletion requests via `obsthailand@gmail.com`)
    8. Third-Party Services (integration with TikTok and governing platform policies)
    9. User Rights and Requests (access, correction, deletion via `obsthailand@gmail.com`)
    10. Changes to This Privacy Policy
    11. Contact Information (`obsthailand@gmail.com`, `https://lineoppo.click`)
- **Verification**:
  - Added unit and regression test suite in `frontend/test/privacy-policy.test.mts` (269/269 tests passing across 36 test files).
  - Next.js Turbopack build verified static route generation `○ /privacy` alongside `○ /terms` (0 errors, clean build).

## Current task: Public Terms of Service Page for OPPO Retail TikTok Monitor

- **Route & Architecture**:
  - Implemented standalone public page at `/terms` in `frontend/src/app/terms/page.tsx`.
  - Configured Next.js App Router metadata with title `Terms of Service | OPPO Retail TikTok Monitor` and description tailored for TikTok Developer App review.
  - Rendered public legal documentation without requiring user authentication and without altering existing LINE OA pages or navigation headers.
- **Content & Coverage**:
  - Included all 9 policy sections required for developer app verification:
    1. Purpose of Service
    2. Authorized Use
    3. TikTok Account Authorization (OAuth 2.0 and scoped permissions)
    4. Data Usage (internal retail operations only, encryption, no third-party resale/sharing, retention & deletion)
    5. User Responsibilities
    6. Service Availability
    7. Limitation of Liability
    8. Changes to These Terms
    9. Contact (`obsthailand@gmail.com`, `https://lineoppo.click`)
- **Verification**:
  - Added unit and regression test suite in `frontend/test/terms-of-service.test.mts` (259/259 tests passing).
  - Next.js Turbopack build verified static route generation `○ /terms` (0 errors, clean build).

## Current task: Fix Top Navigation Click Target & Pointer Event Interception

- **Root Cause Analysis**:
  - `ResponsiveSearch` in `frontend/src/components/shell/top-navigation.tsx` had `className="relative min-w-0 lg:flex lg:flex-1 lg:justify-end"`, and its parent `.app-header-controls` had `lg:flex-1`.
  - Together with the left branding/navigation container having `flex-1`, the header allocated 50% width to the left side and 50% to the right side.
  - At $\ge 1536\text{px}$ (2xl) where all 8 navigation items are rendered inline, and at 1280px where the "More" dropdown is rendered, the left navigation items overflowed past the 50% flex boundary into the right-hand area.
  - Because `app-header-controls` and `ResponsiveSearch` come after the left container in DOM order and had `flex-1`, `ResponsiveSearch` created an invisible, transparent box spanning across the header that sat on top of `Follower Insights`, `Friend Source Links`, `Mass Message` (and the `More` button at 1280px).
  - Hover visual styles could trigger when approaching the buttons from the left, but clicking inside the invisible search wrapper hit the search `<div>` / `<input>` rather than the underlying `<a>` tag.
- **Implemented Fix**:
  - Replaced `lg:flex lg:flex-1 lg:justify-end` on `ResponsiveSearch` container with `shrink-0`.
  - Replaced `min-w-0 shrink lg:flex-1` on `.app-header-controls` with `shrink-0 ml-auto`.
  - Adjusted left container gaps (`gap-3 xl:gap-4 2xl:gap-5`) and nav link padding (`px-2 2xl:px-2.5 py-1.5`) and tuned search label responsive clamp (`2xl:w-[clamp(11rem,13vw,16rem)]`) so all 8 navigation links and right-side controls fit comfortably without collisions across all desktop widths.
- **Verification**:
  - Ran headless Chrome DevTools CDP layout and click simulation across viewports (1920, 1680, 1600, 1536, 1440, 1366, 1280, 1024, 900, 768, 640) in both Thai and English: 100% of visible navigation links and buttons are directly clickable with `topElement === linkElement` and `isClickableDirectly === true`.
  - All 253 frontend unit and regression tests passing cleanly (`npm --prefix frontend test`).
  - Next.js Turbopack production build clean (`npm --prefix frontend run build`).
## Current task: Phase 6A Design System Foundation

- Added centralized Flutter design tokens for colors, spacing, typography, and Material 3 theme configuration under `android_app/lib/core/theme/`.
- Added reusable presentation-only widgets under `android_app/lib/core/widgets/`: scaffold/top bar, status and unread badges, avatar/store badge, and loading/empty/error states.
- Wired `LineOaApp` to use `AppTheme.light()` without changing repositories, realtime handling, notification handling, or feature state.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and `git diff --check` passed.

## Current task: Phase 6B Modern Inbox Redesign

- Added presentation-only conversation cards, previews, search visual, filter chips, and realtime status indicator under `android_app/lib/features/inbox/widgets/`.
- Replaced Inbox `ListTile` rendering with the new card layout while preserving existing SSE patching, unread reconciliation, pagination, pull-to-refresh, and open-conversation callbacks.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6C.1 Chat presentation components

- Extracted the existing conversation header and message bubble rendering into stateless `ConversationHeader` and `MessageBubble` widgets under `android_app/lib/features/chat/widgets/`.
- ChatPage retains all state, realtime handling, scrolling, pagination, sending, media fetching, notification cleanup, and unread behavior; the extraction only delegates rendering and callbacks.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), the debug APK build completed successfully, and the scoped diff check passed.

## Current task: Phase 6C.2 ImageBubble presentation component

- Extracted image placeholder, fixed 240×240 layout, processing states, and the image-open gesture into the stateless `ImageBubble` widget.
- ChatPage remains responsible for media fetching, byte cache, processing snapshots, viewer navigation callback, and all realtime/state behavior.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6C.3 ChatComposer presentation component

- Extracted the existing safe-area composer row, text field, attachment action, and send action into the stateless `ChatComposer` widget.
- The widget receives ChatPage's existing controller and callbacks; optional enabled/attaching/sending flags provide presentation states without owning API, idempotency, retry, or optimistic-message logic.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6C.4 MessageTimeline presentation component

- Extracted the message list, date separators, older-loading indicator, regular message rendering, and pending-message placement into `MessageTimeline`.
- ChatPage retains ScrollController ownership, scroll-generation/programmatic guards, initial-scroll stabilization, `_loadOlder`, SSE/state mutation, media fetching, retry callbacks, and image navigation callbacks.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6C.5 ConversationHeader enhancement

- Enhanced the stateless conversation header with the existing customer avatar, store badge/code, BM reply status badge, profile action, and a presentation-only More actions placeholder.
- ChatPage still owns navigation callbacks, read marking, notification cleanup, realtime state, and all chat behavior; only existing `ConversationDetail` fields are used.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6C.6 QuickReplyPanel presentation component

- Added the reusable, stateless `QuickReplyPanel` with disabled, loading, empty, and suggestion-chip presentations.
- Integrated it into `ChatComposer` behind optional, disabled-by-default inputs. It emits only the supplied selection callback and has no AI/API/repository or send-state behavior.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6D App Shell and Profile audit

- Audited `main.dart`, `ProfilePage`, Inbox/Chat/Profile/Admin Approval navigation, authentication restore, realtime lifecycle, notification lifecycle, and back behavior.
- Recommended an `AuthenticatedShell` extraction that preserves app-level auth/service ownership and moves only authenticated route composition/profile section presentation behind a safe callback boundary.
- No application code changed; implementation is awaiting approval.

## Current task: Phase 6D.1 AuthenticatedShell extraction

- Added `AuthenticatedShell` for authenticated Inbox, Chat, Profile, and Admin Approval composition and route entry points using the existing root Navigator.
- `main.dart` retains Firebase/bootstrap, auth restore, token/session expiry, realtime and notification lifecycle, logout cleanup, and notification deep-link delegation.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6D.2 Profile presentation sections

- Split ProfilePage presentation into `ProfileHeader`, `AccountSection`, `MembershipSection`, `SettingsSection`, and `AdminToolsSection` under `features/profile/widgets/`.
- ProfilePage remains responsible for the CurrentUser snapshot, logout callback, and approval callback. Admin visibility remains a UI convenience; no authorization or navigation behavior changed.
- Verification: `flutter analyze` passed, `flutter test` passed (28 tests), and the debug APK build completed successfully.

## Current task: Phase 6E Customer Profile audit

- Audited mobile conversation/customer payloads, Prisma Customer/Conversation/Message ownership, existing customer endpoints, LINE profile synchronization, and Flutter detail models.
- Version 1 can present existing customer name, initials/avatar fallback, assigned store, reply status, conversation metadata, and message-derived context. Rich profile fields and customer intelligence require a store-authorized customer-profile contract before mobile use.
- No application code or API behavior changed; no tests were required for this audit.

## Current task: Phase 6E.1 Customer Profile sheet

- Added a presentation-only `CustomerProfileSheet` using the existing ConversationDetail name, store, reply status, unread count, loaded messages, and latest message timestamp.
- Wired the existing ConversationHeader profile action to open the sheet. No backend calls, customer IDs, LINE IDs, chat state, read state, or notification behavior changed.

## Current task: Phase 6F AI Quick Reply audit

- Audited backend AI modules, deterministic classification/product intelligence, dashboard recommendations, operational memory, mobile conversation context, and the Flutter QuickReplyPanel.
- No generative provider, RAG/vector retrieval layer, quick-reply API, suggestion persistence, or BM approval workflow currently exists. QuickReplyPanel remains a disabled-by-default presentation component.
- No application code or API behavior changed; the next phase should introduce an authorized, backend-owned, human-reviewed suggestion boundary.

## Current task: AI Quick Reply product specification

- Defined the BM journey, grounded assistance scenarios, supported and high-risk intents, source precedence, human approval requirements, safety rules, MVP boundaries, success metrics, and future roadmap.
- This is a product specification only; no implementation code, API, schema, or provider configuration changed.

## Current task: Store Master ID Propagation Across Web App and Exports

- **Identity and Key Invariant**:
  - `Store.id` = internal system UUID (never mutated, replaced, or exported as "Store ID").
  - `StoreMaster.externalStoreId` = Master File business Store ID (e.g., `28220`).
  - Added additive `storeId: store.storeMaster?.externalStoreId ?? null` and `masterStoreId` / `externalStoreId` across backend responses, frontend types, UI components, and data export routines.
  - Sourced missing or unlinked store IDs safely as `null` / `""` without ever falling back to UUID or auto-generated numbers.
- **Backend API Endpoints Updated**:
  - `GET /stores` & `GET /stores/:id` (`stores.controller.ts`): Expose `storeId: store.storeMaster?.externalStoreId ?? null`.
  - `GET /conversations/bm-reply-status-summary` (`conversations.service.ts`): Included `storeMaster` and return `id`, `storeId`, `masterStoreId`, `externalStoreId`.
  - `GET /dashboard/analytics` (`dashboard-analytics.service.ts`): Included `storeMaster` query and exposed `masterStoreId` and `externalStoreId` on store performance ranking, need-action queue, SLA prediction, and quick view drawer data.
  - `GET /line-official-accounts` & `GET /line-official-accounts/export` (`line-official-accounts.service.ts`): Expose `storeId: store.storeMaster?.externalStoreId ?? null`, CSV export sets `Store ID` (`item.store.externalStoreId ?? ""`) as Column 1, and search filter includes Store ID.
  - `GET /follower-insights/by-store` (`follower-insights.service.ts`): Expose `masterStoreId` / `externalStoreId`.
  - `GET /friend-source-links` & `GET /friend-source-links/summary` (`friend-source-links.service.ts`): Propagate `masterStoreId` / `externalStoreId`.
  - `POST /mass-messages/preview` & `GET /mass-messages/:campaignId` (`mass-message.service.ts`, `mass-message-scope.service.ts`): Propagate `masterStoreId` / `externalStoreId` in scope items, preview results, and store deliveries.
- **Frontend Views & Exports Updated**:
  - `types/api.ts`: Updated `ApiStore`, `StorePerformanceRow`, `NeedActionStoreItem`, `StoreQuickViewData`, `ByStoreAccountRow`, `FriendSourceLink`, `FriendSourceLinksSummaryItem`, `StorePreviewResult`, `StoreDeliveryDetail`, and `LineOfficialAccountResponse.store`.
  - `components/shell/store-search.ts` & `context-sidebar.tsx`: Search includes Store ID, and store list items display subtle `[Store ID]` badge.
  - `app/page.tsx`: LINE OA management table displays `[Store ID]` badge, `Store ID: <id>` detail metadata, search filter supports Store ID, and available stores dropdown displays `[Store ID]`.
  - `app/dashboard/*`: Store Performance Table, Today Action Center, and Store Quick View Drawer display `[Store ID]` badge and support Store ID search.
  - `app/follower-insights/*`: Store Breakdown Table displays `[Store ID]` badge, search filter supports Store ID, and `exportStoreCsv` outputs `Store ID` as Column 1.
  - `app/friend-source-links/*`: Excel Sheet 1 (Store Distribution) and Sheet 2 (Link Details) updated to output `Store ID` (`masterStoreId`, blank if unlinked) as Column 1.
  - `app/mass-messages/*`: Store picker selector, live preview skipped stores, and campaign monitor store delivery breakdown display `[Store ID]`.
- **Verification**:
  - Backend tests: 1,090 / 1,090 passed (100%).
  - Backend build: `prisma generate && nest build` passed cleanly.
  - Frontend tests: 243 / 243 passed (100%).
  - Frontend build: Next.js Turbopack build passed cleanly.


- Identified the registration-flow bootstrap failure: a constructor parameter typed as `() => string` emitted runtime metadata as `Function`, which Nest cannot resolve as a provider.
- The current AuthModule resolves the generator with the explicit `OTP_CODE_GENERATOR` token and a registered `useValue` provider. Added a focused metadata/provider regression test.
- Verification: backend build, lint, and targeted OTP DI tests pass. Local production startup reaches AuthModule initialization without `UnknownDependenciesException`; it cannot finish locally because PostgreSQL at `localhost:5432` is unavailable.

## Current task: Phase 3A Android Production Hardening

- Added offline-aware API preflight/transport errors, sanitized diagnostics, session-expiry cleanup, and lifecycle refresh on app resume.
- Added incremental inbox pagination, client-ready message cursor field, and visible sending/failed/retry message states using stable idempotency keys.
- FCM now registers a background handler and preserves deep-link opening behavior for terminated/background app launches.
- Validation blocker remains unchanged: Flutter/Dart SDK is not installed and package hosts cannot resolve, so analyze/tests/debug APK cannot run here. XML and git diff checks pass.

## Current task: Android Mobile MVP Foundation

- Added isolated Flutter project under `android_app/` with feature-based authentication, inbox, chat, profile, notification, and core network/storage layers.
- Implemented OTP bearer login, secure token persistence/auto-login, active-membership waiting state, inbox refresh/unread badges, conversation replies with idempotency keys, and FCM conversation deep-link handling.
- Android Firebase configuration and backend base URL are externalized: Firebase `google-services.json` is ignored, service-account credentials remain backend-only, and `API_BASE_URL` is passed by Dart define.
- Validation blocker: Flutter/Dart SDK is not installed and the environment cannot resolve package hosts, so `flutter pub get`, tests, and debug APK build could not run. Source diff check passed.

## Current task: Phase 2D Android Mobile API Contract

- Added public `GET /mobile/config` for minimum app version and maintenance state, plus documented Android OTP/bearer, inbox/reply, and FCM deep-link flows in `backend/docs/MOBILE_API.md`.
- Extended `/auth/me` additively with profile, assigned stores, membership roles, and derived permissions.
- Added stable mobile-only error envelopes: `SESSION_EXPIRED` (401), `ACCESS_DENIED` (403), and `RESOURCE_NOT_FOUND` (404); web API error behavior remains unchanged.
- Verification: Prisma validation and backend build passed; 11 focused mobile/auth contract tests passed.

## Current task: Phase 2C FCM Push Provider Integration

- Added Firebase Admin-based FCM provider using backend-only `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY` configuration. Credentials and FCM tokens are never returned or logged.
- Added a background notification-outbox worker: it claims `PENDING` rows, dispatches via the existing dispatcher, records `SENT`/`FAILED`, and retries failed rows up to three total attempts.
- FCM invalid registration-token responses deactivate the affected encrypted `DeviceToken`, preventing future delivery attempts.
- Verification: Prisma validation and backend build passed; 17 focused FCM/notification/webhook tests passed.

## Current task: Phase 2B Mobile Conversation API Layer

- Added mobile-only conversation list, detail, and reply APIs. Store and LINE OA ownership are resolved from the authenticated user's database membership and the target conversation; clients cannot supply either identifier.
- Added per-user mobile notification read/open APIs and unread badge counts. Conversation list/detail unread counts use the same notification state.
- Added additive `PushNotification.readAt` and `openedAt` fields with an index for badge queries.
- Verification: Prisma validation and backend build passed; 17 focused mobile/notification/webhook tests passed. Module startup completed and registered application routes; local health remains blocked because local PostgreSQL/Docker is unavailable.

## Current task: Phase 2A Mobile Push Notification Backend Foundation

- Added authenticated device-token registration, unregistration, and last-seen APIs. New registrations encrypt push tokens and retain only a SHA-256 lookup hash for token matching/deduplication.
- Added `PENDING → PROCESSING → SENT | FAILED` notification-outbox lifecycle, a future-provider `NotificationDispatcher`, and transactional notification enqueueing after inbound LINE message persistence.
- Eligibility is database-resolved: only active users with active membership in the conversation store and at least one active device token receive an outbox record. The `(userId, messageId)` uniqueness constraint prevents webhook-retry duplicates.
- Verification: Prisma validation and backend build passed; 18 focused notification/webhook/auth tests passed. Application module initialization and all new routes registered successfully; local health was blocked because the Docker/PostgreSQL daemon is not running.

## Current task: Chat Detail Message Viewport Height Fix (/chats)

- **Chat Detail Vertical Hierarchy Restructured (`frontend/src/app/page.tsx`)**:
  - Replaced unbounded `flex-1` expansion on the chat message wrapper and `data-chat-message-scroll` with a bounded responsive clamp: `h-[clamp(320px,48vh,540px)] min-h-0 space-y-2 overflow-y-auto`.
  - Replaced constrained `shrink-0` with `style={{ maxHeight: "clamp(14rem, 30vh, 22rem)" }}` on `data-chat-detail-scroll` with `min-h-0 flex-1 overflow-y-auto`.
  - Customer Profile, AI Intelligence, and Product Insights panels now appear cleanly right below the message viewport without excessive dark void when there are only 1-2 messages.
  - Independent scrolling preserved for store sidebar, conversation list, message history, and lower information panels with complete shell viewport lock.
- **Verification**:
  - Frontend unit tests: 229/229 passing.
  - Next.js production build: clean (`npm run build`).

## Previous task: Smart Product Review Queue & Ultra-Fast Operations Workflow

- **Deterministic Review Classification (`product-review-queue.service.ts`)**:
  - Implemented deterministic priority categorizer:
    - **P0 UNCLASSIFIED**: Meaningful inbound customer text but 0 product tags and no previous human confirmation.
    - **P1 AMBIGUOUS / CONFLICT**: Multiple competing product models or conflict detected on conversation.
    - **P2 LOW CONFIDENCE**: Confidence $< 0.85$ or `COMPACT_ALIAS` match.
    - **P3 SERIES ONLY**: Model matches generic/family series (e.g. `OPPO Reno Series`, `OPPO Pad Series`, `OPPO Smartphone`).
    - **P4 RECENTLY REVIEWED**: Conversation already verified by human (MANUAL tag or "No product confirmed" in ActivityHistory). Excluded from default queue.
    - **P5 GOOD**: Specific, high-confidence single model prediction. Excluded from default queue.
- **Fast Human Actions (3-5 Second Workflow)**:
  - **Action A (Confirm)**: `POST /product-intelligence/review-queue/confirm` sets current RULE tags to `MANUAL` (permanently protected) and logs `Product tag confirmed: [modelNames]` in `ActivityHistory`.
  - **Action B (Correct)**: `POST /product-intelligence/review-queue/correct` removes old tags, creates new `MANUAL` tag, and logs structured correction metadata into `ActivityHistory` feeding `ProductCorrectionInsightService`.
  - **Action C (No Product)**: `POST /product-intelligence/review-queue/no-product` removes all product tags and logs `No product confirmed: human verified no product mentioned` into `ActivityHistory`.
  - **Zero Database Migrations**: Derived entirely from existing `ConversationProduct`, `ActivityHistory`, `Conversation`, and `Message` tables.
- **Review Queue Controller & Service (`product-intelligence.controller.ts` & `product-review-queue.service.ts`)**:
  - `GET /product-intelligence/review-queue` with store, reason, productModel filters, pagination, and operational metrics (`totalNeedsReview`, `unclassified`, `lowConfidence`, `ambiguous`, `seriesOnly`, `reviewedTotal`, `confirmedCount`, `correctedCount`, `noProductCount`, `observedAccuracyPct`, `hasSufficientData`).
- **Interactive Operations UI (`classification-insights-view.tsx` & `classification-insights-translations.ts`)**:
  - Filter by Store dropdown (All Stores + active store list).
  - Review reason filter pills with live count badges.
  - Interactive table with immediate optimistic removal, auto-focus next item, fast action buttons, and keyboard shortcuts (`C` = Confirm, `E` = Edit/Correct, `N` = No Product).
  - Product Model selection modal powered by live `api.products()` metadata.
- **Full Verification**:
  - Unit tests: 2/2 in `product-review-queue.service.spec.ts` passing.
  - Backend test suite: 628/628 passed.
  - Frontend test suite: 229/229 passed.
  - Backend & frontend production builds: 100% clean.
  - Live production database audit: correctly categorized 6 real conversations requiring human review without errors.

## Previous task: Product Intelligence Production Integration & Real-World Validation

- **Catalog Reproducibility & Idempotency (`scripts/bootstrap-product-catalog.ts`)**: Made product catalog bootstrap completely reproducible and self-healing from code alone. Safely adopts matching MANUAL aliases to CATALOG source by normalized key, seeds all 102 catalog aliases, preserves 15 non-catalog/blocked manual aliases, and verified 100% idempotency (0 insertions/updates on subsequent runs).
- **Golden Evaluation Benchmark (`product-golden-evaluation-cases.ts` & `product-golden-evaluation.spec.ts`)**: Built an independent 184-case benchmark strictly defined according to business meaning (covering Reno16, Reno16 Pro, Find X9, A6 5G, A6 Pro, Pad 3, Watch X2, Enco Air4, device-with-accessory queries, and 48 false-positive/competitor test cases). Achieved **184/184 tests passed (100.0% Exact Product Accuracy, 0% False Positive Rate, 0% False Negative Rate)**.
- **Matcher Refinements (`product-matcher.ts` & `product-normalization.ts`)**:
  - Refined `hasUnsupportedSuffix` to block only `protectedModelSuffixes` (pro, ultra, lite, air, se, neo, max, plus, 5g, mini, zoom), allowing general English words (e.g. `trade`, `wifi`, `review`, `discount`) to follow model names without blocking matches.
  - Added Thai commercial and conversational particle boundary separation in `normalizeProductText` so unspaced Thai queries (e.g. `รีโน16โปรเท่าไหร่`, `มีโปรผ่อน reno16`) tokenize cleanly.
  - Set candidate scoring so specific device `MODEL` (300) > `ACCESSORIES` (250) > `FAMILY` (200) > `GENERIC` (100). When customers inquire about `"เคส Reno16"` or `"เคส Reno16 Pro"`, the Phone Model wins as the product and accessory intent is classified by Topic rules.
- **Safe Bulk Re-Analysis Capability (`scripts/reanalyze-products.ts` & `npm run product:reanalyze`)**: Implemented safe, batched re-analysis with `--dry-run` support, complete `MANUAL` tag protection (MANUAL always wins over RULE), detailed difference preview, and structured JSON reporting.
- **Manual Correction Feedback & Accuracy Tracking (`conversations.service.ts` & `product-accuracy.service.ts`)**: `updateManualTags` logs manual overrides into `ActivityHistory` (`CLASSIFICATION_UPDATED`), cleans up superseded RULE tags, and enables `ProductAccuracyService` to compute real-world precision and identify top problematic matched phrases.
- **All Verification Checks Passed**:
  - Backend TypeScript build: clean (`nest build && prisma generate`)
  - Full backend test suite: 617/617 classification tests passing
  - Frontend test suite: 229/229 passing
  - Golden benchmark: 184/184 passing (100.0% accuracy)
  - Phase 7 exact scenarios: 10/10 passing (100.0%)
  - Re-analysis dry-run: clean execution on live DB (8 detected changes, 0 errors, 0 mutations)

## Previous task: OPPO LINE OA Executive Dashboard Hero & Data Correctness Overhaul

- Fixed Health Score calculation in `backend/src/dashboard-analytics.service.ts` and `frontend/src/app/dashboard/dashboard-transformers.ts`: clamped strictly to `[0, 100]` with `Math.min(100, Math.max(0, score))` and eliminated 100x multiplication unit mismatch.
- Re-architected 7-day message trend aggregation in `backend/src/dashboard-analytics.service.ts` to query 7 calendar days (`gte: sevenDaysAgo`) regardless of active period ("today", "7d", "30d"), producing 7 consecutive Bangkok date buckets (`trend7Days`), zero-filled for missing days.
- Added `storeFollowersRanking` query in backend aggregating real `LineOaFollowerSnapshot` records by store, exposing `top10`, `bottom10`, `top10Average`, `bottom10Average`, and `ratio`.
- Created dedicated `ExecutiveHero` (`frontend/src/app/dashboard/executive-hero.tsx`) with 4 distinct hierarchy levels:
  - **LEVEL 1 (KPI Row)**: 5 cards (Messages Today + delta vs yesterday, Pending + danger styling + "Waiting for store reply", SLA Achievement + danger below 95% + "Target 95%", Stores Critical `${storesNeedAttentionCount} / ${activeStoresCount}` + "Needs follow-up", Followers + net today delta in green).
  - **LEVEL 2 (Operational Trend)**: Two columns (Left ~60%: 7-Day Message Volume bar/area chart with total & replied series; Right ~40%: Reply Status Donut with canonical `NOT_REPLIED`, `NOTIFIED_BM`, `REPLIED` states where sum reconciles to total conversations).
  - **LEVEL 3 (Followers by Store)**: Top 10 stores (green horizontal bars) vs Bottom 10 stores (red horizontal bars) sorted descending by real followers.
  - **LEVEL 4 (Follower Distribution Summary)**: Top 10 avg vs Bottom 10 avg, ratio gap (`31.2x gap` with bottomAvg === 0 protection), and proportional comparison bar.
- Removed duplicated hero store list panels from dashboard rendering (`TodayActionCenter`, `AiRootCauseAnalysisPanel`, `AiActionCenterPanel`, `AiImpactDashboardPanel`, `AiOperationalMemoryPanel`, `AiExecutiveDailyBrief`, `AiBiAssistantPanel`, `OperationalInsightCard`, `NetworkHealthBanner`, `SlaRiskPredictionCard`) while preserving all backend AI services, models, and tests.
- Preserved all sections below hero (`CustomerDemandSignals`, `StorePerformanceOverview`, `MessageOverviewCard`, `ResponseRateCard`, `CustomerDemandCard`, `PeakHourAnalysisCard`, `FollowerGrowthCard`, `ActionStatusCard`, `DashboardDataQualityCard`, `AdminActivityHistoryCard`, `StoreQuickViewDrawer`).
- Full verification passed: frontend tests (229/229 passing), frontend ESLint (0 errors), Next.js production build clean, backend build (`nest build && prisma generate`) clean.

- Refactored `ContextSidebar` (`frontend/src/components/shell/context-sidebar.tsx`) and `SidebarView` type to include the `ALL` tab ("🌐 ทั้งหมด") alongside `NOT_REPLIED` ("⚪ ยังไม่ตอบ"), `NOTIFIED_BM` ("🟣 แจ้ง BM แล้ว"), and `REPLIED` ("🟢 ตอบแล้ว").
- Updated `ALL` overview badge count to compute total sum of all non-archived conversations across all status types (`notReplied + notifiedBm + replied`).
- Updated `frontend/src/app/page.tsx` default `sidebarView` initialization to `"all"`, mapping `ALL` view to `activeConversationBmReplyStatus: undefined`, which fetches all conversations across all statuses without filtering.
- Updated `updateBmReplyStatus` and `updateConversationBmReplyStatus` state mutations in `page.tsx` to optimistically update `conversations` array items in place:
  - When in `ALL` view (`sidebarView === "all"`), updating a conversation's `bmReplyStatus` (e.g. from `NOT_REPLIED` to `REPLIED`) updates its status badge in place while keeping the conversation visible in the `ALL` list.
  - When in a filtered view (e.g. `sidebarView === "notReplied"`), updating `bmReplyStatus` to `REPLIED` triggers `loadConversations(activeConversationQuery, true)`, allowing the item to leave the filtered view while remaining present in `ALL`.
- Updated URL route hydration (`restoreRoute`), URL sync state, active filter chip badge dismiss action, and `clearAllFilters` to set `sidebarView: "all"`.
- Updated unit tests in `frontend/test/shell-navigation.test.mts`, `frontend/test/bm-reply-status-presentation.test.mts`, and `frontend/test/chat-detail-hierarchy.test.mts`.
- Full verification passed: frontend build (`npm run build`) passed with 0 errors, all 226/226 frontend unit tests passed, backend build (`npm run build`) passed with 0 errors.

## Current task: Store Chats Sidebar BM Reply Status Overview & Store Breakdown Counts

- Added backend aggregation endpoint `GET /conversations/bm-reply-status-summary` (`backend/src/conversations.controller.ts` & `backend/src/conversations.service.ts`) returning global OVERVIEW totals across ALL non-archived stores, and per-store `NOT_REPLIED`, `NOTIFIED_BM`, `REPLIED` breakdowns.
- Updated `frontend/src/components/shell/context-sidebar.tsx` to render global OVERVIEW counters (independent of store selection filter) and 3 color-coded badges per store row (Gray `NOT_REPLIED`, Purple `NOTIFIED_BM`, Green `REPLIED`).
- Updated `frontend/src/app/page.tsx`, `frontend/src/lib/api.ts`, and `frontend/src/types/api.ts` to fetch and statefully sync `bmReplyStatusSummary`.
- Added unit tests for backend summary aggregation (global totals, store breakdowns, empty store handling, filter independence) in `conversations.service.spec.ts`, and updated frontend tests in `bm-reply-status-presentation.test.mts` and `shell-navigation.test.mts`.
- Full verification passed: backend ESLint clean, 579/579 backend tests passing, NestJS build clean, frontend ESLint clean, 204/204 frontend tests passing, Next.js production build clean.

## Current task: BM Reply Status Feature Completion

- Resolved concurrent race condition in `line-webhook.service.ts`: re-read conversation row inside transaction `tx` before checking `bmReplyStatus !== NOT_REPLIED` and creating `BM_REPLY_STATUS_CHANGED` activity history entry.
- Added comprehensive backend unit tests in `conversations.service.spec.ts` for `UpdateBmReplyStatusDto` validation (accepts `NOT_REPLIED`, `NOTIFIED_BM`, `REPLIED`, rejects invalid), route metadata `PATCH /conversations/:id/bm-reply-status`, `ConversationsService.updateBmReplyStatus()` (state transitions, auto COMPLETED followUpStatus on REPLIED, activity logging, repeating status no-op), and `AuthGuard` role authorization (`VIEWER` rejected with 403, `ADMIN` allowed).
- Added backend webhook unit tests in `line-webhook.service.spec.ts` covering auto-reset of `bmReplyStatus` to `NOT_REPLIED` when inbound messages arrive on `REPLIED` or `NOTIFIED_BM` conversations, avoiding redundant activity history when already `NOT_REPLIED`, and leaving `followUpStatus` logic intact.
- Updated `frontend/src/app/conversation-list-presentation.ts` with `getBmReplyStatusBadge` helper.
- Added 3-state control (`<select data-bm-reply-status-select>`) in detail view header in `frontend/src/app/page.tsx` near Priority and Follow-up badges with optimistic update + rollback pattern via `api.updateBmReplyStatus`, disabled for `VIEWER` role.
- Added read-only `bmReplyStatus` badge (`data-conversation-bm-reply-status`) per row in conversation list, rendered separately from `tags.visible` truncation.
- Extended frontend activity history mapping and rendering on detail view and dashboard for `BM_REPLY_STATUS_CHANGED` events with localized strings.
- Added full multi-language labels for Thai, English, and Chinese: `NOT_REPLIED` (ยังไม่ตอบ / Not replied / 尚未回复), `NOTIFIED_BM` (แจ้ง BM แล้ว / BM notified / 已通知 BM), `REPLIED` (ตอบแล้ว / Replied / 已回复).
- Added frontend unit tests in `conversation-list-presentation.test.mts` and `bm-reply-status-presentation.test.mts`.
- Full verification passed: backend ESLint clean, 577/577 backend tests passing, NestJS build clean, frontend ESLint clean, 203/203 frontend tests passing, Next.js production build clean.

## Current task: Desktop header consolidation

- Refactored the global desktop header into product branding and responsive primary navigation on the left, with responsive search, a compact last-updated control, and one profile menu on the right.
- Removed the hard-coded notification bell/count. Consolidated display name, role, Pilot status, language, appearance, logout, and avatar into one keyboard-accessible profile dropdown without changing their underlying behavior.
- Moved the existing Store Chats pane-reset callback into a page-level overflow menu beside the conversation-list controls.
- Secondary navigation collapses into a More menu below the widest desktop breakpoint. Search uses flexible desktop widths and becomes an icon-triggered popover below 1024px.
- Verification passed: frontend ESLint, 184/184 tests, TypeScript production build, local frontend/backend startup, frontend health and Store Chats HTTP 200, and authenticated rendered-DOM checks at 1280px, 1024px, and 900px. No viewport or header overflow was observed; Store Chats remained active; profile and pane-reset menus were present; Escape closed the profile menu.
- Two repeated 404s for one external LINE profile image were observed during browser verification. They predate and are unrelated to the header controls; no new header, authentication, API, or startup error was found.
- No backend source, routes, authentication behavior, database schema/data, or Friend Attribution rewrite was changed. No commit, push, or deployment was performed.

## Current task: Phase 1.5 Classification Insights

- Added an authenticated read-only `GET /classification-insights` feature that reports current-state text eligibility, product coverage, RULE/MANUAL source mix, product ranking, no-product opportunities, compact-match behavior, and catalog health.
- Aggregations exclude archived stores, use distinct conversation counts, bound the review queue and aggregate tables, and return no message text or customer identity.
- Added the `/classification-insights` workspace in the existing application shell with Thai, English, and Chinese copy, semantic theme tokens, KPI cards, a coverage funnel, ranking and review tables, compact monitoring, and catalog health.
- The dashboard explicitly reports coverage and rule behavior only; it does not claim accuracy, precision, recall, correction rate, or historical quality.
- Backend and frontend compile, lint, tests, and builds pass. Local runtime verification confirms unauthenticated 401 and authenticated 200 with a sanitized payload. Final manual light/dark browser inspection remains because no browser surface was available in the verification session.

## Current task: ProductAlias provenance and safe catalog reconciliation

- The Phase 1 acceptance review found that `ProductAlias` rows had no trustworthy catalog-versus-operator ownership marker, so stale alias reconciliation could not safely proceed.
- Added explicit `ProductAliasSource` provenance with a conservative `MANUAL` default. Existing aliases remain operator-owned unless explicitly recreated as catalog-owned; no existing row is automatically adopted by the catalog.
- Catalog synchronization writes new aliases as `CATALOG`, reconciles only `CATALOG` rows, deactivates stale catalog aliases without deletion, and reactivates restored catalog aliases.
- Added the reviewed Phase 1 ownership manifest and a guarded one-time adoption command for exactly 75 eligible legacy aliases. It supports a non-mutating fixture dry run, preflights optimistic identity/ownership checks, updates only `source` in one transaction, and safely reports an already-adopted second run.
- Ten broad or ambiguous legacy aliases remain `MANUAL` and fail closed: `power bank`, `reno`, `smart home`, `smart tv`, `smart watch`, `กล้องวงจรปิด`, `ทีวี`, `เราเตอร์`, `สาย Type-C`, and `คีย์บอร์ดแท็บเล็ต`.
- Brand-qualified safe alternatives remain available at runtime. The two new brand-qualified accessory phrases are intentionally runtime-only so the first catalog sync creates only the approved `a6pro5g` alias.
- A desired catalog alias that conflicts with an existing `MANUAL` normalized key stops synchronization before catalog mutation.
- Database aliases marked `MANUAL`, or aliases with missing/unknown provenance, fail closed as `REVIEW_REQUIRED`. The normal classification service and product backfill script apply the same safety mapping; no backfill was run.
- Local verification passed: Prisma validation/generation, TypeScript, ESLint, 447/447 backend tests, build, catalog validation, the fixture-only 75-row adoption dry run, and backend health/readiness. Production rollout remains blocked pending final review. No production migration, ownership adoption, catalog synchronization, reanalysis, or backfill has run.

## Current task

Completed focused conversation-list and right-detail hierarchy refinements without changing filters, pagination, selection behavior, routing, pane resizing, APIs, authentication, notes behavior, LINE OA handlers, or backend logic. The detail header now groups customer identity, store/time metadata, profile refresh, priority, follow-up status, and the existing primary LINE OA action. The message viewport is content-friendly with a 420px scroll cap, and product intent, topics, note, and follow-up cards use tighter semantic spacing.

Runtime tracing confirmed `/chats` directly renders `ApplicationWorkspace` from `page.tsx`, there is no duplicate conversation-list branch, and PID 89210 serves port 3000 from this repository's frontend directory. An isolated authenticated headless Chrome session verified the actual rendered DOM rather than inferred source: Incoming, Follow-up, and Reminded each render their matching Thai headings; Incoming renders `กรองเพิ่มเติม`; the visible normal-priority count is zero; high priority remains visible; and the selected row exposes its selected marker and scoped styling class.

Verification passed: frontend TypeScript, zero-warning ESLint, 173/173 tests, and production build. Focused detail tests cover action hierarchy and unchanged handlers, customer-name prominence, message scroll sizing, message order, date separators, image and translation paths, LINE OA Manager notice, product fields and confidence, topics, and note save behavior. Authenticated rendered-DOM verification confirmed the 700-weight customer name, primary and four secondary actions, 420px automatic-overflow message viewport, date separator, manager notice, complete product card, and editable note field.

## Completed work

- Refactored `ApplicationWorkspace` in `frontend/src/app/page.tsx` to render `<AppShell>`, `<TopNavigation>`, `<ContextSidebar>`, and `<PageContainer>`, replacing legacy sticky `<header>` and permanent `<aside>` elements across all 5 production routes.
- Proved actual render-tree integration across `/dashboard`, `/chats`, `/stores`, `/follower-insights`, and `/friend-source-links`.
- Verified route-specific sidebar behavior:
  - `/dashboard`: NO contextual sidebar
  - `/follower-insights`: NO contextual sidebar
  - `/friend-source-links`: NO contextual sidebar
  - `/stores`: NO permanent 73-store list sidebar
  - `/chats`: contextual sidebar (`ContextSidebar`) rendered exclusively with status filters (`incoming`, `followUp`, `reminded`) and store filter selection list.
- Preserved workspace state across navigation (conversations list, selected conversation, selected store, status filters, search query, pagination, theme, language, and resizable pane widths).
- Added executable route-tree integration unit tests in `frontend/test/route-tree-integration.test.mts` proving single global navigation landmark, route delegation, context sidebar scoping, and account control presence.
- Passed full verification loop: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` (158/158 passing), and `git diff --check`.

- Established unified global application shell (`AppShell`) with sticky `TopNavigation`, semantic design tokens, and standardized layout container primitives (`PageContainer`, `PageHeader`, `SectionHeader`).
- Integrated 5 primary navigation modules (`/dashboard`, `/chats`, `/stores`, `/follower-insights`, `/friend-source-links`) with active navigation selection (`aria-current="page"`).
- Normalized primary active navigation and focus styling from success green to semantic blue design tokens while keeping green reserved for success indicators.
- Scoped contextual sidebar (`ContextSidebar`) exclusively to `/chats` workspace with status filters (`incoming`, `followUp`, `reminded`) and store selection.
- Removed permanent 73-store sidebar from `/stores`, `/dashboard`, `/follower-insights`, and `/friend-source-links`.
- Applied PageContainer layout variants: `readable` (`max-w-7xl`) for reports/insights, `wide` (`max-w-[1440px]`) for Store Management, and `full` (`w-full h-full`) for Conversations workspace.
- Added comprehensive unit tests in `frontend/test/shell-navigation.test.mts` covering top navigation, layout variants, contextual sidebar, page headers, app shell integration, and active navigation state mapping.
- Verified TypeScript compilation (`npx tsc --noEmit`), linter (`npm run lint`), production build (`npm run build`), and test suite (`npm test` - 153/153 passing).

- Upgraded Friend Attribution tracking from a single-pilot environment variable configuration to database-driven per-LINE-OA configuration model (`FriendAttributionConfig`).
- Added Prisma `FriendAttributionConfig` model and safe lexicographically-ordered database migration (`20260724160000_add_friend_attribution_config`).
- Extended NestJS `FriendSourceLinksService` to resolve per-LINE-OA LIFF ID during public short link redirect and verify ID tokens using per-LINE-OA LINE Login Channel ID in `identifySession`.
- Added Admin REST API endpoints (`GET /friend-source-links/attribution-configs`, `PUT /friend-source-links/attribution-configs/:lineOaId`, `DELETE /friend-source-links/attribution-configs/:lineOaId`) guarded with `@Roles("ADMIN")`.
- Validated Channel ID (`/^[0-9]{8,20}$/`) and LIFF ID (`/^[0-9]{8,20}-[a-zA-Z0-9_-]+$/`) formats via `class-validator` DTOs and client validation.
- Added per-store Attribution Configuration card and configuration modal to `/friend-source-links` in Next.js frontend for ADMIN users with status badges (Not Configured, LIFF Enabled, LIFF Disabled).
- Added multi-language copy across Thai, English, and Chinese for all Attribution Configuration UI elements.
- Preserved full backward compatibility with legacy environment pilot settings via auto-backfill helper (`backfillLegacyPilotAttributionConfig`).
- Added comprehensive unit test coverage: 12 backend unit test scenarios in `friend-attribution.service.spec.ts` and 6 frontend unit test scenarios in `friend-source-links.test.mts`.
- Verified all **255/255 backend tests** and **134/134 frontend tests** passing cleanly. Zero linter or TypeScript compilation errors.
- Formatted `conversionRate` to 2-decimal place percentage string (`6.67%`, `0.00%`).
- Added visual emphasis to `confirmedAdds > 0` with emerald background badge and font bolding.
- Added header tooltips with dotted underlines explaining Identified visits (LIFF verification), Confirmed Adds (LINE follow webhook match), and Conversion rate.
- Added top-level attribution KPI cards (Total Clicks, Total Identified Visits, Total Confirmed Adds, Overall Conversion Rate) computed dynamically over filtered rows.
- Updated Excel export formatting (`pivotLinksByStore` and `prepareLinkDetailsRows`) to output 2-decimal place percentages (`6.67%`).
- Added comprehensive frontend tests in `friend-source-links.test.mts` and updated `friend-attribution.test.mts`.
- Verified all 250 backend tests and all 132 frontend tests passing cleanly. All linters and typecheckers passing.
- Updated reconciliation to persist `lastBackfillReconciledAt` ONLY after an account has been fully inspected (or enqueued / collided on P2002), leaving timestamps untouched on unexpected failures.
- Updated `schema.prisma` and migration `20260723143000_add_line_oa_backfill_jobs/migration.sql` with `lastBackfillReconciledAt` on `LineOfficialAccount` and index `@@index([isActive, lastBackfillReconciledAt])`.
- Configured safe-by-default environment flags: `FOLLOWER_BACKFILL_WORKER_ENABLED=false`, `FOLLOWER_BACKFILL_RECONCILIATION_ENABLED=false`, and `FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS=300000` (5 minutes). Removed misleading `FOLLOWER_BACKFILL_JOB_CONCURRENCY` setting in favor of strict single-job per instance concurrency lock.
- Fixed `getJobStatus` contract for unknown jobs to throw `NotFoundException` (HTTP 404).
- Added periodic reconciliation timer with separate lifecycle management and shutdown cleanup.
- Added comprehensive unit tests for reconciliation timestamp safety, 150-account scale reconciliation, rapid connection enqueueing, 429 Retry-After parsing (seconds & HTTP-date), queue summary estimated remaining API calls, and `@Roles("ADMIN")` route authorization.
- All 215 backend unit tests and 89 frontend unit tests passing cleanly.

- Made the LINE OA create response authoritative by returning the canonical URL derived from the key persisted in the same transaction; normal reads now return the same URL.
- Added collision-only key allocation retry, explicit failure for invalid public webhook configuration or missing persisted keys, and preserved stable keys across reads/edits.
- Removed the frontend's second webhook-info request, validated the returned HTTPS `/webhook/` URL before showing success, refreshed on incomplete responses, and added a synchronous duplicate-submit lock.
- Added an explicit backfill command for null/blank legacy keys that preserves existing keys and prints only repair counts.
- Added a 50-record stress regression (25 sequential and 25 concurrent creates) proving every URL is unique, canonical, and stable on re-read.
- Added idempotent `MessageMedia` persistence with PENDING/READY/FAILED status, provider message identity, MIME type, object key, size, and sanitized processing errors.
- Added local-development and S3-compatible storage drivers, bounded/timeout-protected LINE content download using the exact OA access token, and collision-safe date-partitioned object keys.
- Added an authenticated ADMIN-only media delivery endpoint with private caching that never exposes local paths, object keys, storage credentials, or LINE tokens.
- Added conversation image summaries, authenticated thumbnail loading, dark-safe skeleton/error/historical states, retry, and an accessible click/Escape lightbox.
- Documented local and Railway S3 variables, enforced S3 media storage in production validation, and applied the forward-only media migration locally.
- Added one reusable, timezone-neutral relative-time formatter with concise Thai, English, and Chinese output for seconds, minutes, hours with optional remaining minutes, days, 30-day months, and 365-day years.
- Replaced minute-only conversation values with their original timestamps and applied the formatter to conversation rows, the selected-conversation header, waiting time, dashboard recent activity, and activity history.
- Added safe `-` handling for invalid or missing timestamps and deterministic boundary tests using an injected current time.
- Rewired the actual Store Management modal input to an explicit `searchQuery` state and colocated 300 ms `useEffect` that directly calls `api.searchStoreMaster(query, 10)`.
- Replaced fragmented autocomplete flags with a discriminated `idle | loading | success | error` state, including stale-response suppression and timeout cleanup.
- Added the required focused `lam` test, which proves the debounced path calls `api.searchStoreMaster("lam", 10)`, plus source assertions tying the current input and effect together.
- Fixed the Store Master autocomplete trigger by removing the accidental two-character threshold and routing every non-empty query through a reusable 300 ms debounce runner.
- Kept idle, loading, results, successful-empty, and API-error states distinct; the modal now shows the dedicated Thai searching message and never presents failures as no matches.
- Added executable regression tests proving non-empty typing calls search, empty input remains idle, loading precedes results, successful empty responses show no-match eligibility, and rejected requests reach only the error state.
- Restored the complete synchronized Store Master card below ACCOUNT NAME search, including Store ID, store/account names, LINE ID, province, region, and safe LINE OA/Manager links.
- Kept the selected Store Master identifier and existing store identifier in the create payload while preserving credentials and avoiding a duplicate manual store payload.
- Made the no-match message depend on completion of the current search and retained manual LINE OA creation when no Store Master is selected.
- Added explicit light/dark semantic tokens for the synchronized card and focused regression tests for search wiring, selection, credential edits, payload identifiers, manual fallback, no-match timing, and theme coverage.

- Made theme changes update `html[data-theme]` synchronously and exclusively, clearing stale root theme classes and attributes before every application.
- Replaced the provider's competing localStorage/effect resolution with one mounted system listener that reads the current preference and cleans up correctly.
- Added explicit paired light/dark tokens for backgrounds, surfaces, text, inputs, navigation selection, buttons, badges, disabled states, hover states, and borders.
- Applied semantic theme classes to the application shell, header, sidebar navigation, store list, filter panel, selects, filter chips, conversation selection, buttons, and empty state.
- Added regression coverage for light → dark → light root cleanup and representative semantic-token usage.
- Added real `/dashboard` and `/stores` App Router entry points with accessible active-state navigation.
- Scoped conversation monitoring to Dashboard and LINE OA/store administration, archived-store controls, store search, and the connect action to Store Management.
- Reworked the header, KPI cards, management summary cards, spacing, radii, shadows, and responsive collapse behavior into a calmer content-first hierarchy.
- Added explicit primary-button enabled, hover, and disabled tokens with tested contrast in both themes; migrated the connect action and all legacy primary buttons through the same variant.

- Added a production-only, pilot-only startup bootstrap gated by `PILOT_ADMIN_BOOTSTRAP_ENABLED=true`.
- Added fail-fast username/password validation, common-password rejection, normalized usernames, scrypt hashing, verified ADMIN creation, and safe targeted updates without changing unrelated administrators.
- Preserved normal username login, database sessions, secure cookies, guards, and first-admin setup behavior; no public creation route or authentication bypass was added.
- Added Railway variables and an exact create-login-disable lifecycle to the deployment guide and environment example.
- Added bootstrap, setup-status, login, update-safety, validation, and secret-safe logging tests.

- Added a persisted `light` / `dark` / `system` theme provider and accessible selector in the application header.
- Defaulted new users to the operating-system preference and subscribed to live `prefers-color-scheme` changes with listener cleanup.
- Added a pre-hydration head script that resolves `oppo-line-oa-theme` and sets `html[data-theme]` before page content renders.
- Reworked the frontend palette around semantic surface, border, text, input, hover, selected, and focus tokens, including dark-safe status colors across authentication, navigation, dashboards, inbox, conversations, forms, tables, dialogs, and state feedback.
- Removed the build-time Google Fonts network dependency in favor of deterministic local system font stacks.
- Added dependency-free focused theme tests covering restoration/defaulting, all persisted selections, and system preference resolution.

- Consolidated inbound LINE delivery to the single public, signature-protected `POST /webhook/:webhookKey` route.
- Removed legacy destination/environment-secret fallback resolution.
- Extended local signed verification to cover exact raw bytes, empty Verify payload, invalid signatures, unknown keys, customer text persistence, profile failure isolation, key stability, and exact cleanup of temporary records.
- Added key fingerprint comparison across build/restart and confirmed normal edits do not change the key.
- Updated local test tooling, environment example, and README to use persisted per-OA credentials and URLs exclusively.
- Completed independent correctness and security reviews; stopped opaque key output and made test cleanup failure-safe.
- Changed the backend webhook-info source of truth, Test Connection output, create/regeneration responses, scripts, documentation, and tests to `/webhook/:webhookKey`.
- Confirmed every frontend display/copy location consumes the webhook-info response and no webhook URL is stored in localStorage.
- Confirmed the reported stale key is absent, restarted both services through repository scripts, and verified the running route log maps `/webhook/:webhookKey`.
- Fixed managed launcher detachment for normal terminal usage.
- Added production environment validation, compiled startup and migration scripts, Prisma-generating builds, protected database readiness, production cookie policy, Railway-safe environment examples, deployment documentation, and `npm run deploy:check`.
- Selected Railway Root Directory `backend`; no frontend deployment or remote mutation was performed.
- Completed webhook, deployment, Prisma safety, authentication/CORS, secret-management, and beginner-usability review passes.

## Checks run and passed

- Backend lint/build passed and all 80 backend tests passed; frontend lint/build and all 26 frontend tests passed.
- Final `npm run verify` exited 0 with `PASS`; schema validation, all 14 migrations, both builds, runtime health, protected routes, and signed webhook stability checks passed.
- Backend lint/build passed; 77 backend tests passed, including image download, exact token use, MIME/size rejection, 404/410 failure recording, authenticated delivery, and duplicate-redelivery behavior.
- Twenty-three frontend tests passed, including image summary, thumbnail, historical/failed/loading states, and lightbox behavior; frontend lint/build passed.
- Final `npm run verify` exited 0 with `PASS`; schema validation, all 14 migrations, 77 backend tests, both builds, runtime health, protected routes, and signed webhook checks passed.
- Nineteen frontend tests passed, including all requested relative-time boundaries and invalid/missing timestamp cases; frontend lint passed.
- Frontend production build passed, and final `npm run verify` exited 0 with `PASS`; 70 backend tests, both builds, migrations, runtime health, protected routes, and signed webhook checks passed.
- The focused `lam` API-call test and all 17 frontend tests passed; frontend lint and the production build passed after the direct modal event-flow rewrite.
- Final `npm run verify` after the direct event-flow rewrite exited 0 with `PASS`; 70 backend tests, both builds, migrations, runtime health, protected Store Master routing, and signed webhook checks passed.
- Seventeen frontend tests passed after the autocomplete trigger repair; frontend lint and production build passed.
- Final repository verification after the autocomplete repair exited 0 with `PASS`; 70 backend tests, both production builds, migrations, runtime health, protected Store Master routing, and signed webhook checks passed.
- Fourteen frontend tests passed, including six focused Store Master regressions.
- Frontend lint passed with no warnings; the production build passed after granting Turbopack its required internal worker-port permission.
- Final `npm run verify` exited 0 with `PASS`; 70 backend tests, both builds, migrations, runtime health, protected routes, and signed webhook checks passed.

- Eight focused frontend theme/navigation tests passed.
- Frontend lint and production build passed after the build was rerun with the required Turbopack worker permission.
- Final `npm run verify` exited 0 with `PASS`; backend/frontend builds, 70 backend tests, migrations, runtime health, protected routes, and signed webhook checks passed.
- Local `/dashboard` and `/stores` requests both returned HTTP 200 after hot compilation; the production build emitted both routes and recent route compilation introduced no new frontend errors.

- Backend lint passed and the final backend test suite passed with 70 tests.
- Backend and frontend production builds passed; Prisma validation/generation/status passed with all 13 migrations current.
- Final `npm run verify` exited 0 with `PASS`; runtime health, protected routes, and signed LINE webhook checks passed.

- Frontend lint passed.
- Frontend production build passed after rerunning outside the restricted process sandbox; TypeScript and static generation passed.
- Three focused frontend theme tests passed.
- Repository `npm run verify` passed, including 62 backend tests, both builds, migrations, service startup, health checks, and signed webhook verification.
- Runtime frontend returned 200 with the pre-paint initializer and all theme choices present; recent service logs contained no hydration, compilation, or startup errors.

- Prisma validation/generation/status passed; 13 migrations are current.
- Backend lint/build passed; 57 tests passed.
- Frontend lint/build passed.
- Runtime health and authentication checks passed.
- Signed empty event returned 200; invalid signature 401; unknown key 404; signed customer text 200 and was stored; simulated and live profile failure did not block storage.
- Webhook key fingerprint remained unchanged across build/restart and request processing; legacy route returned 404.
- Final `npm run verify` exited 0 with `PASS WITH SKIPS`; only Git-specific checks were skipped because Git metadata is absent.
- Canonical signed local verification passed with valid empty events 200, invalid signature 401, unknown key 404, and stored customer text 200.
- Backend tests increased to 62 and passed; compiled `npm run start:prod` returned `/health` 200 on isolated port 3101.
- Final `npm run verify`: `PASS WITH SKIPS` (Git metadata unavailable).
- Final `npm run deploy:check`: `READY WITH EXTERNAL STEPS`.

## Remaining blockers

- Git metadata/history is absent, so tracked-file and history secret checks must be completed after creating/restoring the private Git repository.
- GitHub and Railway account configuration remain external steps.

## Next action

- Frontend theme, hierarchy, and route refactor is complete; await user review. Do not push or deploy without explicit approval.
# Current task: data-driven OPPO product classification

- Extended the existing ProductSeries → ProductModel → ProductAlias schema with product groups, classification levels, priorities, and match evidence.
- Added a centralized idempotent catalog, validation/seed commands, normalization, scored matching, and safe batch backfill.
- Integrated matching into conversation re-analysis while preserving manual classifications and independent topic detection.
- Added catalog/matcher regression coverage and exposed group/family/model/confidence in the frontend.
- Next: complete the repository verification loop and repair any failures.
# Current task: optional inbound media storage

- Added `MEDIA_STORAGE_ENABLED`, defaulting to disabled in all environments.
- Production S3 validation now runs only when media storage is explicitly enabled.
- Disabled image storage persists the image message and a `SKIPPED` media record without downloading content.
- Added production-validation, processing, and frontend placeholder regression coverage.
- Next: apply the additive enum migration and complete the full verification loop.
# Current task: separate LINE OA Manager conversation action

- Preserved the original/translated message toggle as an independent action.
- Added validated `manager.line.biz` navigation using the selected conversation's Store Master manager URL.
- Added clipboard-assisted customer search, success/fallback/missing-link toasts, and a Store Management link when configuration is absent.
- Next: complete frontend and repository verification.
# Current task: Store Master refresh and connected LINE OA metadata sync

- Changed Store Master import identity from sheet row position to stable external Store ID when available.
- Added an idempotent connected-LINE-OA metadata sync command with dry-run and outcome counters.
- Protected credentials and webhook identity by limiting writes to Store metadata and the Store Master relation.
- Conversation responses now resolve the latest validated manager URL through Store Master.
- Next: run the full backend/frontend verification and inspect the final diff.
# Current task: canonical LINE OA Manager URL resolution

- Added one backend resolver shared by connected LINE OA list and conversation responses.
- Resolution prefers the newest active Store Master row by stable Store ID, then the connected Store Master relation, then null.
- Conversation detail now consumes `resolvedLineOaManagerUrl` directly with no frontend reconstruction.
- Next: complete backend/frontend tests, builds, runtime checks, and diff review.
# Current task: safe conversation API and resolved Manager URL

- Replaced full Prisma LINE OA serialization in conversations with an explicit safe connected-account projection.
- Conversation list/detail now include the canonical `resolvedLineOaManagerUrl` and omit Store Master internals and all credential/webhook identity fields.
- Strengthened Manager URL validation against embedded credentials, query strings, fragments, and unsupported paths.
- Added response-level regression tests that inspect serialized JSON for forbidden credential names and ciphertext values.
- Next: complete all lint, build, test, runtime, and diff checks.
# Current task: one-store LINE chat workspace test

- Disabled the temporary bot-info/chat URL runtime flow and removed its one-store command and mapping.
- Preserved the nullable database field and migration for possible future use, but conversation DTOs and UI no longer read or expose it.
- Restored the stable canonical Store Master-first, connected-manager fallback through `resolvedLineOaManagerUrl` only.
- Next: complete backend/frontend verification and review the final diff.

# Current task: primary workspace navigation refactor

- Split the authenticated application into `/dashboard`, `/chats`, and `/stores` route-focused workspaces while retaining the shared application shell, authentication, theme, language, and API state logic.
- Added route-backed chat filters with refresh restoration and browser back/forward handling; dashboard and store actions now deep-link into filtered workspaces.
- Dashboard is summary-only, Store Management contains LINE OA configuration, and Store Chats retains the operational three-column conversation workspace.
- Added navigation, route-state, focus-boundary, responsive, theme, translation, and LINE OA action regression coverage.
- Next: run the full repository verification and inspect route responses and final diff.

# Current task: conversation connection-exhaustion repair

- Removed the per-conversation Store Master lookup from conversation serialization and replaced it with one deduplicated `findMany` batch plus a synchronous URL map resolver.
- Added a dedicated list projection that loads only the latest message, note, and activity summary while detail retains its complete relation shape.
- Added defense-in-depth page-size clamping at 100 and a 100-row query-count regression test.
- Removed the analogous LINE OA list N+1 patterns by batching manager metadata and daily message counts.
- Centralized PrismaService in one global PrismaModule and enabled Nest shutdown hooks so one client pool is shared and disconnected only during application shutdown.
- Next: run full verification, exercise runtime health, and review the final diff.

# Current task: resizable Store Chats panes

- Added two dependency-free draggable separators to the desktop Store Chats workspace with persisted sidebar and conversation-list widths.
- Enforced the requested defaults and bounds while preserving a minimum 520px conversation-detail pane.
- Added pointer capture, keyboard arrow resizing, accessible separator metadata, reset behavior, validated client-only restoration, and responsive fixed layouts below the desktop breakpoint.
- Added focused regression coverage for resizing, bounds, persistence, reset, accessibility, responsive behavior, and theme-token readability.
- Frontend lint, 46 frontend tests, and the production frontend build pass.
- Next: complete full repository verification, runtime checks, and final diff review.

# Current task: Railway production frontend

- Replaced the legacy public API variable with validated `NEXT_PUBLIC_API_BASE_URL` and an explicit `NEXT_PUBLIC_APP_ENV` production gate.
- Added Railway-compatible host/port startup, a safe `/api/health` route, and frontend-service deployment documentation.
- Preserved server-cookie authentication restoration, centralized 401 expiry handling at `/login`, and contained network/500 failures in existing error UI.
- Added focused deployment, environment, session, error, health-route, and command regression coverage.
- Frontend lint, 53 frontend tests, the Railway-configured production build, live `/api/health`, `/login`, and `/dashboard` probes, and full repository verification pass.
- Next: await user approval before any push or Railway deployment.

# Current task: custom-domain Friend Attribution public links

- Added one isolated Next.js external rewrite from `/f/:shortCode` to the existing backend `/f/:shortCode`, using the already validated frontend API origin.
- Kept click tracking, attribution session creation, LIFF redirects, status handling, and all backend business logic backend-owned.
- Added focused rewrite-contract coverage for exact path scope, query preservation, unrelated routes, and absence of frontend redirect/status behavior.
- Frontend lint, all 182 frontend tests, the production build, and 41 existing backend friend-source/attribution tests pass.
- Controlled Next.js development and production-mode proxy checks preserved query strings, upstream `302 Location`, `404`, `410`, `User-Agent`, `Referer`, and a supplied `X-Forwarded-For` chain; Railway edge behavior still requires a production smoke test.
- Next: review the implementation report before any commit, push, or deployment.

# Current task: Store Chats authoritative conversation state

- Replaced competing filtered and unfiltered conversation writers with one authoritative query snapshot and one guarded loader used by filter changes, pagination, manual refresh, and 12-second polling.
- Moved store, LINE OA, queue/status, search, priority, product-series, product-model, topic, page, and page-size filtering into the backend-supported list request; the paginated response is no longer filtered again client-side.
- Added request-generation protection, real page reconciliation when totals shrink, exact zero-total rendering, selected-conversation containment, and metadata-backed persisted-filter validation that also runs for empty lists.
- Kept store and queue badge semantics unchanged: store badges remain global lifetime totals and queue badges remain page-local rather than authoritative filtered aggregates.
- Frontend lint, 192 frontend tests, production build, 4 conversation backend contract tests, and deterministic production-mode browser polling/pagination/store-switch verification pass.
- Next: review the final diff and implementation report before any commit, push, or deployment.

# Current task: Store Chats conversation-detail hierarchy

- Reorganized the detail pane into a compact customer header, dominant message viewport, consolidated Insights and Internal Note workspace, integrated Activity History, and a persistent Store Follow-up footer.
- Preserved the existing LINE OA, refresh, translation, reanalysis, tag-editing, note-save, and all five follow-up status handlers without changing conversation state, polling, pagination, backend contracts, or routing.
- Added container-responsive detail-pane rules and reserved the lower-right assistant area without coupling the application to externally injected mascot markup.
- Frontend ESLint, all 194 frontend tests, the production build, frontend `/api/health` and `/chats`, backend health/readiness, and `git diff --check` pass.
- Authenticated responsive visual verification and its two live polling cycles remain unverified because no managed browser was available in this session; no substitute automation was used and no visual claim is being made.
- Next: review this implementation before any commit, push, or deployment, then run the outstanding authenticated browser QA when a managed browser is available.

# Current task: disabled message-translation backend foundation

- Added an ADMIN-only manual message-translation endpoint contract for English and Chinese targets behind `MESSAGE_TRANSLATION_ENABLED`, which defaults to false and rejects malformed boolean configuration.
- Added a provider abstraction; disabled requests fail before database/provider access, and enabled requests remain unavailable unless an approved provider and credentials are both configured.
- Reused existing nullable Message translation columns as durable cache and added inbound-text eligibility boundaries without changing ingestion, serialization, or schema.
- Backend ESLint, all 459 backend tests, TypeScript production build, startup, health/readiness 200, unauthenticated 401, authenticated disabled-feature 503, and `git diff --check` pass.
- Next: review the implementation report before any provider integration, commit, push, or deployment.

# Current task: offline translation benchmark framework

- Added a provider-neutral benchmark for synthetic Thai customer-service messages with English and Simplified-Chinese references, protected OPPO terminology, and operational intent coverage.
- Added deterministic completeness, source-copy, protected-term, reference-similarity, and human-review scoring without provider calls, credentials, production messages, or database access.
- Added an offline CLI that evaluates pre-generated JSON submissions and reports only aggregate results and candidate keys, never candidate text.
- Backend ESLint, all 464 tests, TypeScript production build, offline CLI metadata smoke test, backend startup, health/readiness, and `git diff --check` pass.
- Next: review the benchmark framework before generating any provider candidates or making provider, configuration, commit, push, or deployment changes.

# Current task: Google Cloud Translation provider adapter

- Added a Google Cloud Translation v3 adapter that normalizes Thai-to-English and Thai-to-Simplified-Chinese results and sanitizes empty or failed provider responses.
- Added fail-closed `TRANSLATION_PROVIDER=none|google` configuration. Google credentials are read only from environment variables when both translation and Google are selected; no credential or production variable was added.
- Translation remains disabled by default, cache-first, ADMIN-only, and original-text immutable. Successful provider output writes only the selected existing translation cache column; failures write nothing.
- Extended the provider-neutral benchmark with an offline runner fixture and a non-production Google candidate generator that never imports Prisma or application messages.
- Backend ESLint, all 471 tests, production build, offline benchmark smoke test, production dependency audit, local health/readiness, authenticated disabled-feature 503, and `git diff --check` pass.
- Next: review before any credential provisioning, benchmark provider call, commit, push, configuration change, or deployment.

# Current task: OPPO retail translation benchmark quality

- Added a protected OPPO glossary covering requested product, technology, and retail terminology, with verbatim brand/feature preservation and localized retail-concept validation.
- Added category-weighted diagnostic scoring, English/Chinese scores, protected-term issue details, optional retail-intent expectations, reviewer notes, and an explicit readiness decision.
- Preserved and froze existing synthetic benchmark records; added separate retail-intent and terminology coverage cases without changing application runtime or provider behavior.
- Readiness still requires structural integrity, complete protected-term preservation, and human review of every candidate; automated scoring and intent flags remain advisory.
- Backend ESLint, all 475 tests, TypeScript production build, offline v2 benchmark metadata smoke test, and `git diff --check` pass.
- Next: review the benchmark report before any provider run, credential use, commit, push, or deployment.

# Current task: Phase 2D benchmark execution readiness

- Added configurable per-million-character cost estimation with Unicode source counts for both benchmark targets and no billing integration.
- Added provider version and deterministic snapshot identifiers to reports, plus metadata-only snapshot serialization and provider/version comparison helpers.
- Snapshot artifacts exclude source messages, reference translations, candidate translations, and reviewer notes; the CLI uses create-only writes for explicit snapshot output.
- Backend ESLint, all 478 tests, TypeScript production build, offline benchmark smoke test, and `git diff --check` pass.
- Next: review Phase 2D preparation before any external benchmark execution, credential use, commit, push, or deployment.

# Current task: Phase 2E OPPO translation glossary enforcement

- Added a reusable deterministic English and Simplified-Chinese glossary package for protected OPPO product/technology terminology and approved retail phrases.
- Added Google-style Chinese recovery for pickup, AI Eraser, and AI Studio, plus placeholder-based idempotent normalization that prevents replacement cascades.
- Kept the evaluator as the only integration point: candidates are normalized in memory before scoring, while runtime translation persistence, provider calls, and original messages remain untouched.
- Offline evaluation of the existing Google v3 candidate improved overall score from 77.35 to 78.92 and protected-term pass rate from 95.83% to 100%; the remaining `到店自提` pickup mismatch was added as a focused regression rule.
- Backend ESLint, all 484 tests, the TypeScript production build, and `git diff --check` pass; no provider call or benchmark generation ran. The final v4 snapshot is metadata-only and remains outside the repository.
- Next: review Phase 2E before any commit, runtime integration, or deployment.

# Current task: Phase 2F translation benchmark human review

- Added an explicit benchmark-only review input model keyed by candidate and language, with 1–5 adequacy, fluency, terminology, and safety scores, a required non-sensitive reviewer alias, and optional notes.
- Added deterministic validation for unknown, duplicate, language-mismatched, malformed-score, and missing-alias reviews while retaining compatibility with legacy embedded synthetic reviews.
- Added per-dimension averages and an overall human score; notes are excluded from scoring and snapshot identity.
- Readiness now explicitly requires structural checks, protected-term checks, and 100% valid human review coverage.
- Validated the workflow with an external synthetic 30-review fixture covering all 15 English and 15 Chinese candidates: human review reached 100%, overall human score was 4.38, translation score remained 78.92, and readiness advanced to `READY_FOR_HUMAN_DECISION`.
- The external v5 metadata snapshot excludes candidate text, source text, notes, and reviewer aliases; no Google API call or production path was used.
- Backend ESLint, all 488 tests, the TypeScript production build, and `git diff --check` pass; no provider, database, frontend, runtime, or production path was exercised.
- Next: review Phase 2F before any human-review data entry, commit, or deployment.

# Current task: Phase 2G translation provider decision

- Added a pure benchmark-only decision layer with `APPROVED_FOR_PILOT`, `NEEDS_IMPROVEMENT`, and `REJECTED` outcomes.
- Approval requires structural integrity, protected terminology, zero intent mismatches, 100% human review coverage, and an overall human score of at least 4.0.
- Automatic structural, terminology, or intent failures reject the provider; incomplete or low-scoring human review requires improvement.
- Added deterministic recommendation metadata, passed reasons, blocking issues, automated/human scores, and generation time without changing runtime translation.
- Backend ESLint, all 493 tests, the TypeScript production build, and `git diff --check` pass; verification made no provider call and exercised no runtime, database, frontend, or production path.
- Next: review the Phase 2G recommendation before any commit, runtime enablement, or deployment.

# Current task: Phase 3A.1 production translation pilot safety

- Added a second fail-closed `TRANSLATION_PILOT_MODE` gate, defaulting false, so benchmark approval alone cannot expose runtime translation; the existing endpoint remains ADMIN-only.
- Added whitelist-only structured audit metadata containing message/user identifiers, target/provider, outcome, duration, character count, and sanitized error category, with no source or translated content.
- Added a dependency-free per-process, per-admin limiter for uncached provider requests, configurable with `TRANSLATION_RATE_LIMIT_PER_MINUTE` and returning a controlled HTTP 429 without provider or database writes when exhausted.
- Production defaults remain disabled and provider-free; no credential, schema, frontend, provider call, configuration deployment, or production change was made.
- Backend ESLint, all 498 tests, production build, startup, health/readiness 200, unauthenticated 401, authenticated ADMIN pilot-off 503, and `git diff --check` pass. No provider request was made.
- Next: review Phase 3A.1 before any commit, credential provisioning, pilot enablement, or deployment.

# Current task: Phase 3A.2 internal translation pilot monitoring

- Added an in-memory translation metrics abstraction tracking aggregate request, success, failure, provider-failure, rate-limit, cache-hit, duration, and character-count data only.
- Integrated metrics into active-pilot terminal paths, including cache and same-language reuse, provider and persistence failures, successful translations, unsupported messages, provider unavailability, and rate limiting.
- Separated provider invocation failures from persistence failures so provider-failure metrics cannot misclassify database write errors.
- The collector stores no message IDs, acting-user IDs, LINE identifiers, source text, translated text, or customer attributes and requires no schema or external dependency.
- Backend ESLint, all 500 tests, production build, module startup, health/readiness 200, protected endpoint 401, and `git diff --check` pass. No provider request was made.
- Next: review Phase 3A.2 before any commit, monitoring exposure, pilot enablement, or deployment.

# Current task: Phase 3A.3 internal translation pilot monitoring endpoint

- Added `GET /translation/metrics` as an ADMIN-only projection of the in-memory pilot aggregates, protected by the existing global session and role guard.
- The Phase 3A.3 response initially contained eight numeric fields for request, success, failure, provider-failure, rate-limit, cache-hit, duration, and character-count aggregates; Phase 3A.5 extends it with three daily-budget aggregates.
- Added internal `resetMetrics()` for isolated pilot tests without creating an HTTP mutation route.
- Added regression coverage for ADMIN access, VIEWER 403, unauthenticated 401, aggregate-only response shape, and complete counter reset.
- Backend ESLint, all 504 tests, production build, startup, health 200, unauthenticated metrics 401, authenticated ADMIN metrics 200 with the exact numeric aggregate contract, and `git diff --check` pass.
- Next: review Phase 3A.3 before any commit, pilot enablement, frontend dashboard, or deployment.

# Current task: Phase 3A.4 translation pilot user allowlist

- Added comma-separated `TRANSLATION_PILOT_ALLOWED_ADMIN_IDS` parsing with whitespace normalization, deduplication, and a fail-closed empty default.
- Active pilot translation now requires both the existing ADMIN role and exact acting-user ID membership before any Prisma lookup, provider call, metric mutation, or translation persistence.
- Pilot-off behavior remains unchanged and ignores the allowlist; missing or empty allowlist configuration denies all active-pilot requests with controlled HTTP 403.
- Added a dedicated blocked-access audit event limited to acting user ID, fixed reason category, and timestamp.
- Added regression coverage for pilot-off behavior, allowed and blocked admins, empty configuration, pre-database rejection, no provider call, no persistence, and safe audit shape.
- Backend ESLint, all 506 tests, production build, startup, health/readiness 200, authenticated pilot-off 503, and `git diff --check` pass. No provider request was made.
- Next: review Phase 3A.4 before any commit, allowlist provisioning, pilot enablement, or deployment.

# Current task: Phase 3A.5 translation pilot usage budget guard

- Added a process-local daily source-character budget for active, allowlisted, uncached provider attempts, configured by `TRANSLATION_DAILY_CHARACTER_LIMIT` with a safe 50,000-character default.
- Budget reservation occurs after cache/provider/rate-limit checks and before provider invocation; over-budget requests return controlled HTTP 429 without provider calls, persistence, or success metrics.
- Usage and exceeded-request counts reset automatically at the Asia/Bangkok calendar-date boundary and naturally reset on process restart. There is no manual HTTP reset.
- Extended the ADMIN metrics response with `dailyCharacterUsage`, `dailyCharacterLimit`, and `budgetExceededRequests`, all numeric aggregate metadata.
- Added deterministic coverage for consumption, cache bypass, rejection, provider/write suppression, restart reset, Bangkok midnight reset, safe default, and metrics projection.
- Backend ESLint, all 512 tests, production build, startup, health/readiness 200, and authenticated ADMIN metrics 200 with zero usage and the 50,000-character default pass; `git diff --check` passes.
- Next: review Phase 3A.5 before any commit, budget configuration, pilot enablement, or deployment.

# Current task: Phase 3B.0 translation pilot readiness check

- Added a pure internal readiness service that evaluates validated feature, Google provider, pilot, allowlist, rate-limit, and daily-budget configuration without provider or database access.
- Added ADMIN-only `GET /translation/readiness`, returning one overall boolean and six named boolean checks only.
- Readiness is false for disabled/incomplete configuration, missing Google options, or an empty active-pilot allowlist; invalid raw values remain fail-fast startup errors through existing configuration validation.
- Added regression coverage for complete readiness, missing credentials, missing allowlist, VIEWER rejection, and absence of credential, project, and allowlist values from responses.
- Backend ESLint, all 516 tests, production build, startup, health 200, unauthenticated readiness 401, and authenticated ADMIN readiness 200 with `ready: false` under current disabled local defaults pass; `git diff --check` passes.
- Next: review Phase 3B.0 before any commit, readiness configuration, pilot enablement, or deployment.

# Current task: Phase 3B.1.1 translation pilot smoke test

- Added `npm run translation:pilot:smoke-test`, guarded against production execution and gated by all six readiness checks before Google provider construction or invocation.
- Added a provider-neutral runner using only the frozen synthetic Thai sentence `OPPO Reno16 มีของไหมครับ` for English and Simplified-Chinese targets, with in-memory result caching and no Prisma/application repository.
- Each target is invoked once and immediately replayed from cache; the runner verifies normalized non-empty responses, character counts, success/cache metrics, and exact daily-budget consumption.
- CLI output is restricted to readiness booleans, provider status, target languages, aggregate latency, source character count, and success. Provider errors are sanitized.
- Added regression coverage for readiness short-circuit, safe provider failure, budget rejection before provider, successful metrics/cache/budget validation, and absence of production-data dependencies.
- The local CLI smoke check correctly failed closed under disabled defaults with provider `NOT_INVOKED`; no Google call occurred.
- Backend ESLint, all 521 tests, production build, startup, health/readiness 200, fail-closed smoke CLI, and `git diff --check` pass. No provider request was made during verification.
- Next: review Phase 3B.1.1 before any credentialed non-production smoke run, commit, pilot enablement, or deployment.

# Current task: Phase 3B.1.2 translation pilot audit report

- Added a pure report service that aggregates the existing process-local translation metrics and daily budget into the approved operational contract.
- Added ADMIN-only `GET /translation/report`; it initially returned process period, status, nine numeric metrics, and three numeric health indicators only, with Phase 3B.1.3 extending metrics by three feedback counters.
- Defined success rate as successful provider translations plus cache hits over total requests, with an idle process at 100%; average duration reuses the existing aggregate and budget utilization is daily usage divided by configured limit.
- Implemented HEALTHY at success >=95% and budget <80%, WARNING at success >=80% but <95% or budget >=80%, and CRITICAL at success <80% or exhausted budget, with critical precedence.
- Added regression coverage for exact aggregation, 95%/80% boundaries, budget warning/exhaustion, critical precedence, sensitive-field exclusion, and ADMIN/VIEWER authorization.
- Backend ESLint, all 525 tests, production build, startup, health 200, unauthenticated report 401, and authenticated ADMIN report 200 with an idle HEALTHY aggregate pass; `git diff --check` passes.
- Next: review Phase 3B.1.2 before any commit, pilot enablement, or deployment.

# Current task: Phase 3B.1.3 translation pilot feedback signal

- Added an internal process-local feedback service supporting `POSITIVE`, `TERMINOLOGY_ISSUE`, and `MEANING_ISSUE` with three integer counters only.
- Feedback is accepted only after a `TRANSLATED` or `CACHED` result; failed, unavailable, unsupported, rate-limited, same-language, and pre-translation states cannot increment counters.
- Translation execution and response behavior remain unchanged: no signal is inferred or recorded automatically, and this backend-only phase adds no HTTP submission route or frontend.
- Extended ADMIN metrics and audit report contracts with positive, terminology-issue, and meaning-issue aggregate counts.
- Added regression coverage for increments, unsuccessful-status rejection, counter-only storage, translation behavior stability, report aggregation, and numeric metrics projection.
- Backend ESLint, all 529 tests, production build, startup, health 200, and authenticated ADMIN metrics/report 200 with all three zeroed feedback counters pass; `git diff --check` passes.
- Next: review Phase 3B.1.3 before designing a capture endpoint, committing, enabling the pilot, or deploying.

# Current task: Phase 3B.2 translation pilot activation preparation

- Extended translation readiness with a seventh check proving the aggregate feedback metrics service is available and contains valid non-negative counters.
- Added a pure activation-checklist service distinguishing active feature/Google/pilot switches from complete safety readiness.
- Added ADMIN-only `GET /translation/pilot-status` with exactly six safe boolean/numeric fields: ready, active, allowlisted admin count, rate-limit validity, daily-budget validity, and feedback availability.
- Added regression coverage for disabled pilot, missing allowlist, invalid budget, fully ready pilot, ADMIN/VIEWER authorization, exact response shape, and secret/ID exclusion.
- Translation execution, persistence, provider behavior, and production flags remain unchanged; the checklist performs no provider or database calls and cannot activate the pilot.
- Backend ESLint, all 534 tests, the TypeScript production build, clean startup, health/readiness 200, unauthenticated pilot-status 401, and authenticated ADMIN pilot-status 200 pass. Disabled local defaults correctly report `ready: false` and `active: false`; no provider call occurred. The build reports only the pre-existing Prisma `package.json#prisma` deprecation warning.
- Next: review Phase 3B.2 before any commit, pilot activation, or deployment.

# Current task: Phase 3C.0 controlled translation pilot activation preparation

- Tightened pilot status so an empty environment allowlist is both inactive and not ready, while leaving the translation execution guard unchanged and fail-closed.
- Added production-shaped configuration coverage showing two environment-supplied ADMIN IDs produce readiness `true`, pilot status `active: true`, and allowlist count 2 when every required synthetic setting exists.
- Added runtime authorization coverage proving both configured administrators are accepted through the cache path and an unknown administrator is rejected before message lookup.
- Added a manual activation, verification, shutdown, and rollback runbook with no embedded production IDs or credentials.
- Backend ESLint, all 536 tests, the TypeScript production build, and clean startup pass. Under synthetic two-admin activation configuration, authenticated ADMIN readiness returned 200/`ready: true` and pilot status returned 200/`ready: true`, `active: true`, `allowlistedAdminCount: 2`; no translation endpoint or provider was called.
- The build reports only the pre-existing Prisma `package.json#prisma` deprecation warning.
- Next: review Phase 3C.0 before any commit, real credential provisioning, Railway variable change, pilot activation, or deployment.

# Current task: Phase 3C.1 translation pilot production preflight

- Added `npm run translation:pilot:preflight`, a standalone configuration-only CLI that checks the feature flag, Google selection, pilot switch, allowlist count, positive rate/budget limits, and Google credential shape.
- Production execution fails closed unless explicitly marked with `--verify-production`; the marker has no activation or mutation behavior.
- Output contains only readiness, seven booleans, allowlist cardinality, or a fixed sanitized error category. It never returns IDs, project metadata, credentials, or environment values.
- Added source-boundary tests proving the command imports no provider, Prisma, application module, webhook, conversation, or customer-message path.
- Focused tests and CLI smoke checks pass: unmarked production execution refuses safely, while a marked synthetic two-admin configuration reports ready without provider or database access.
- Backend ESLint, all 541 tests, the TypeScript production build, backend health/readiness 200, both CLI safety-path smoke checks, and `git diff --check` pass. The build reports only the pre-existing Prisma `package.json#prisma` deprecation warning; no provider or database access occurred from the preflight command.
- Next: review Phase 3C.1 before any commit, production verification, environment change, pilot activation, or deployment.

# Current task: consolidated translation pilot readiness check

- Added `npm run translation:pilot:check` as a safe composition of the existing configuration preflight, runtime readiness service, and process-local metrics availability check.
- The command imports no Google provider or Prisma code, performs no translation or database operation, and returns only overall/configuration/provider/runtime/metrics booleans.
- Production execution retains the existing explicit `--verify-production` safety marker.
- Backend ESLint, all 545 tests, the TypeScript production build, a synthetic ready CLI check, application startup, health 200, readiness 200, and `git diff --check` pass. The build reports only the pre-existing Prisma configuration deprecation warning; no provider or database operation was performed by the check command.

# Current task: Store Chats manual message translation MVP

- Added an ADMIN-only manual Translate action for inbound, non-empty TEXT messages in Store Chats.
- The action uses the existing authenticated API client to request English translation, exposes loading/success/error states, labels output as AI translation, and never runs from polling or effects.
- Successful results update only the current frontend chat-history copy so the returned translation remains consistent with the existing message model; backend behavior is unchanged.
- Frontend ESLint, all 197 tests, the production build, built-server startup, frontend health 200, Store Chats 200, and `git diff --check` pass. Browser screenshot QA was unavailable because no in-app browser was connected in this environment.

# Current task: translation feedback MVP

- Added an authenticated ADMIN-only feedback endpoint separate from translation generation, plus Store Chats Helpful and categorized Incorrect controls shown only after a successful manual translation.
- Added durable `MessageTranslationFeedback` records linked to the message and acting administrator, target language, rating, issue category, and a SHA-256 fingerprint of the exact stored translation. Translation text is not duplicated in feedback records.
- Feedback submission reads only an existing translated field and never calls the provider or changes translation generation. Identical feedback for the same admin/message/language/result is idempotent.
- Added `OTHER` to the process-local aggregate feedback counters while preserving existing positive, terminology, and meaning counters and API compatibility.
- Local migration `20260804173000_add_message_translation_feedback` applied successfully. Backend ESLint, all 550 tests, backend build, frontend ESLint, all 198 tests, frontend build, route startup, unauthenticated 401, authenticated validation 400/422, and health/readiness checks pass.

# Current task: translation quality analytics MVP

- Added `npm run translation:quality:report`, a read-only CLI over durable English/Chinese translation fields and translation feedback.
- The report returns stored translation totals, feedback count, helpful percentage, and meaning/terminology/other issue counts without importing or calling a provider.
- Until translation attempts are stored durably, total and successful translations intentionally share the persisted-success denominator rather than presenting process-local metrics as historical data.
- Backend ESLint, all 553 tests, the TypeScript production build, the live local-database CLI smoke test, and `git diff --check` pass. The smoke result was 16 durable translations and zero feedback; no provider was constructed or called and no database write path exists in the report.
- Next: review the read-only report before any commit, deployment, or frontend analytics work.

# Current task: persistent translation event tracking

- Added durable metadata-only `TranslationEvent` rows for every TranslationService outcome, including cached successes, provider successes, validation/configuration/rate-limit failures, and provider or persistence failures.
- Event recording reuses the existing audit-result boundary, never includes message or translation content, and is best-effort so an observability storage failure cannot alter the translation response or trigger another provider request.
- Updated the read-only quality report to derive total requests, successes, failures, success rate, and average duration from durable events while retaining feedback analytics.
- Added and applied local migration `20260804190000_add_translation_events`; events intentionally begin at migration time with no historical backfill.
- Backend ESLint, all 556 tests, the production build, local migration, quality-report CLI smoke test, health 200, readiness 200, and `git diff --check` pass. No Google request or frontend change was made.
- Next: review the durable event model and reporting semantics before commit or deployment.

# Current task: OPPO runtime translation glossary MVP

- Added an isolated provider decorator that protects OPPO, Reno16, ColorOS, SUPERVOOC, AI Eraser, AI Studio, and Find Series with neutral collision-checked sentinel placeholders before translation and restores canonical spellings afterward.
- Integrated the decorator at provider construction, leaving the Google adapter, TranslationService behavior, original message storage, feedback, and event analytics unchanged.
- The wrapper makes exactly one provider call, preserves provider metadata and the original source character count, and does not apply the broader benchmark retail-normalization rules at runtime.
- Backend ESLint, all 559 tests, the production build, health/readiness checks, and `git diff --check` pass. No real Google request, database migration, frontend change, commit, or deployment occurred.
- Next: review the glossary placeholder contract before any production benchmark or deployment.

# Current task: OPPO glossary production smoke test

- Added `npm run translation:glossary:smoke-test`, a standalone Prisma-free command using one frozen synthetic sentence and exactly one English Google Translation call.
- Output is restricted to provider-call count, seven-term count, preservation boolean, and overall success; credentials, source, translated output, and provider errors are never printed.
- The first real smoke exposed Google alteration of private-use Unicode markers. Replaced them with collision-checked neutral alphanumeric sentinels and added the failure as regression coverage.
- The corrected real Google smoke returned `providerCalls=1`, `termsTested=7`, `termsPreserved=true`, and `success=true` without storing messages or accessing the database.
- Backend ESLint, all 563 tests, the production build, corrected real-provider smoke, health/readiness checks, and `git diff --check` pass. No application message, database row, environment variable, frontend, or production runtime path was changed.
- Next: review the smoke command and sentinel compatibility evidence before commit or deployment.

# Current task: translation pilot release readiness automation

- Added `npm run translation:pilot:release-check`, composing existing configuration/provider/runtime readiness with current health/readiness, applied-migration, and seven-term glossary smoke-contract availability checks.
- Database validation is read-only: it runs the existing `SELECT 1` readiness probe and compares current migration directories with completed, non-rolled-back `_prisma_migrations` names.
- The release command imports no Google provider, performs no translation or message operation, and emits only release readiness plus configuration/runtime/database/glossary booleans.
- Backend ESLint and all 568 tests pass. Local disabled configuration correctly reports configuration/runtime false with database/glossary true; a synthetic ready configuration reports all checks true without a provider call.
- The production TypeScript build, backend health/readiness 200, and `git diff --check` also pass. No frontend, provider, message, database mutation, environment, commit, or deployment action occurred.
- Next: review the release-check contract before commit or production execution.

# Current task: two-way LINE OA customer reply composer

- Audited the existing Conversation/Customer/LineOfficialAccount/Message relations, AES-256-GCM credential service, inbound webhook persistence, global authentication guard, and BM reply summary/query flow.
- Added ADMIN-only `POST /conversations/:id/messages` for trimmed text up to LINE's 5,000 UTF-16-code-unit limit. It resolves the conversation's own active OA, decrypts only that OA's token server-side, and uses LINE push messaging rather than webhook reply tokens.
- Added `X-Line-Retry-Key` UUID idempotency. The same key is stored as the outbound Message external ID, LINE 409 accepted retries are treated as success, and persistence retries reconcile through the existing unique field without a new table or migration.
- LINE acceptance precedes one database transaction that persists the OUTBOUND TEXT message, updates the conversation to BM `REPLIED` and follow-up `COMPLETED`, and records a non-sensitive activity entry. LINE failures perform no conversation/status writes.
- Added the bounded Chat Detail composer outside the scrolling message history with Enter-to-send, Shift+Enter newline, disabled/VIEWER/sending states, retained text on error, immediate outbound bubble append, scroll-to-newest, and existing list/summary refresh for status counters and filtered-list reconciliation.
- Backend and frontend production builds pass. Focused backend lint passes; 19 focused conversation/LINE messaging tests pass. Frontend lint has zero errors and four pre-existing warnings. Full backend lint remains blocked by 112 pre-existing errors outside this feature. Local backend/runtime verification is blocked by the unavailable Docker/PostgreSQL daemon; in-app browser QA is unavailable in this session. No live LINE send was attempted because no recipient has yet been confirmed as safe.
- Next: review the final diff, commit only feature files, push main, deploy both Railway services, check production health/UI, and identify a confirmed test recipient before any live send.

# Current task: LINE OA Management CSV export

- Added an ADMIN-only `GET /line-official-accounts/export.csv` endpoint that reuses the complete, non-paginated safe LINE OA list projection and its batched Store/message-count queries.
- Export filtering mirrors the management page across the full dataset: account/store/account-name search, active or connection-issue route status, and optional archived records.
- CSV contains 17 explicit operational columns only, uses CRLF rows, RFC quote escaping, formula-injection protection, Bangkok timestamps, a Bangkok-dated filename, and a UTF-8 BOM for Thai/Chinese Excel compatibility.
- The response exposes only `Content-Disposition` and row-count headers to the credentialed production frontend. Channel secrets, access tokens, encrypted credential fields, encryption keys, and authentication data are not selected into CSV rows.
- Added an ADMIN-only management-page download control with loading/duplicate-click protection, error state, browser Blob download, and the server-provided filename.
- Focused backend lint, five LINE OA service tests, backend build, frontend build, and frontend lint with zero errors pass. The frontend retains four pre-existing warnings.
- Next: review diff, commit/push, deploy Railway, authenticate safely, and compare production database and CSV row counts without exposing CSV contents.

# Current task: Android notification token lifecycle

- Added an explicit authenticated FCM device-registration path after login and session restoration, with retry-safe in-flight coordination and logout ordering that deactivates the token after registration completes.
- Token acquisition and `/device-tokens` registration now emit only safe lifecycle/status diagnostics; registration failures remain non-blocking for inbox navigation. Token refresh registration remains authenticated-only.
- Added focused Flutter tests for authenticated registration, logged-out startup, null token handling, and retry after registration failure. Flutter analyze, all tests, production-configured APK build, exact APK installation, and `git diff --check` pass.
- Runtime login/production database verification remains pending because APK installation cleared the secure session and no BM credentials were available in this session; no token or push E2E result is claimed.

- A fresh production message after token activation was traced end-to-end: the outbox row reached SENT and Android received the FCM data message, but the Flutter background handler's local notification failed with `PlatformException(invalid_icon)` because `@mipmap/ic_launcher` did not exist.
- Replaced the missing icon with a checked-in notification drawable, added safe background/message/show diagnostics, and revalidated Flutter analyze, tests, diff check, APK build, and exact APK installation. A fresh login and background message are still required for post-fix visible-notification verification.

# Current task: Phase 5 chat-style Android notifications

- Replaced per-outbox Android notification identity with deterministic conversation identity and Android MessagingStyle presentation. Message-level PushNotification outbox uniqueness remains unchanged.
- Added a bounded SharedPreferences-backed per-conversation history (eight messages), with message-ID deduplication and image fallback text. It is cleared per conversation after a successful Chat load and globally on logout.
- Added only the customer name, message type, safe preview, and ISO timestamp to the existing data-only FCM payload; no Firebase notification envelope, media URL, token, credential, or database migration was added.
- Flutter analyze/tests, focused backend notification/webhook tests, changed-file backend ESLint, and backend build pass. Next: review scoped diff, build/install production APK, and run the required multi-conversation production E2E after the backend deploy.

# Current task: Flutter logout crash hardening

- Resolved an unresolved notification-service merge conflict before rebuilding; the final source now contains one coherent Phase 5 notification implementation.
- Logout now serializes notification initialization and token registration, guards duplicate logout calls, deactivates a non-empty token best-effort, skips unavailable local-notification cleanup safely, clears persisted notification history, and always clears the auth session.
- Added safe logout lifecycle diagnostics without tokens, credentials, customer data, or message contents, plus focused tests for normal logout, null token, unavailable cleanup, deactivation failure, double logout, and in-flight registration.
- Flutter analyze, all 17 Flutter tests, production-configured APK build, exact APK installation, and `git diff --check` pass. Manual production BM login/logout and DeviceToken database verification remain pending because the APK reinstall cleared the secure session and no credentials were available in this session.
- The auth root now derives authenticated rendering from a local `CurrentUser` snapshot, enters a neutral logout state before asynchronous cleanup, and removes the profile route before teardown. The final APK was rebuilt and installed with SHA-256 `0329ee2b1a9600db750579e80ba7fc69caab98c14d3b75e9290d006f5a849251`.
- The authenticated root no longer force-unwraps `_user` during rebuild; it renders from a checked local snapshot. Current emulator logcat shows no startup `Null check operator` exception. Authenticated logout remains a manual verification dependency because credentials are not available in this session.

# Current task: Phase 5 production E2E — Test B

- Verified explicit inbound `phase5-b1` persisted in a conversation distinct from Customer A, with one SENT PushNotification (attempt 1) addressed to the active tested BM/device.
- Android retained Customer A's stable notification `1740057898` with its three-message MessagingStyle and posted Customer B as independent notification `44971303` with only `phase5-b1`.
- App-private SharedPreferences history contains three A entries and one B entry with no cross-conversation contamination. No notification was tapped or cleared, and no rebuild/reinstall/logout/data clear occurred.
- Test B passed. Next: wait for operator approval/instructions before Test C (tap A and verify selective clearing).

# Current task: Phase 5 production E2E — Test C

- Tapped Customer A's notification and verified the emulator is on Conversation A, showing the A customer header and `phase5-a1`, `phase5-a2`, and `phase5-a3`; production detail requests for A returned HTTP 200.
- Android NotificationManager no longer contains A notification `1740057898`; B notification `44971303` remains as an independent MessagingStyle notification with only `phase5-b1`.
- App-private SharedPreferences history now contains only B's one-entry record; A's history is absent. The normal conversation-open callback uses per-conversation `cancel(id)` and history deletion; `cancelAll()` is only in logout cleanup.
- Test C passed. Next: wait for operator approval/instructions before Test D (manual open after a new A message).

# Current task: Phase 5 production E2E — Test D

- `phase5-a4` persisted for Conversation A and its PushNotification reached SENT on attempt 1.
- The required pre-open evidence was not preserved when Test D inspection began: the app was already foregrounded on Conversation A with A4 visible, while A notification `1740057898` and A's SharedPreferences history were already absent. Android's notification archive contained no retained record.
- Explicitly verified the manual interaction path afterward by navigating Back to Inbox and selecting Customer A's Inbox row. The A detail request returned HTTP 200; B notification `44971303` and B's one-entry history remained intact; no crash/red-frame diagnostics appeared and no global clear path ran.
- Test D is not accepted because “A notification existed before manual open” and “A history contained only A4 before manual open” cannot be evidenced. No code was changed and Test E was not started.

# Current task: mobile Inbox unread-state correction

- Confirmed production badge values were backend-derived per-user unread PushNotification counts (`readAt IS NULL`), not stale Flutter-only state: the tested BM had counts 28 and 3 for the two visible conversations.
- Added an authenticated, store-authorized, idempotent mobile conversation mark-read operation that updates only the current user's unread PushNotification rows. It does not modify conversation reply status or message data.
- Flutter now marks read only after conversation detail loads successfully, independently clears the Android conversation notification/history, and refreshes the Inbox from REST after returning from Chat.
- Focused backend tests, targeted ESLint, backend build, Flutter analyze, all 21 Flutter tests, and `git diff --check` pass.
- Backend commit `6abc0f2` was isolated to the three mobile conversation files, pushed to `main`, and deployed successfully on Railway. The runtime fingerprint matches the full commit, and health/readiness return 200.
- The production-configured debug APK was rebuilt and installed on `emulator-5554` (SHA-256 `28a4949a2ffe3325926cf359b791102d189d1a2065ecdfaf11b6b5302db120e1`). Flutter's first streamed install removed the prior package before failing; direct ADB installation succeeded, so the app is now at Login and production E2E requires a fresh BM login.
- Production unread Test 1 passed after fresh BM login. Conversation `9a82e1d0-ad2c-455c-baf9-3e4357bac05f` started unread 1 / NOT_REPLIED with Android notification `1479688050` and one local-history entry; detail GET and mark-read PATCH both returned 200.
- After opening, the tested BM's backend unread count was 0 while reply status remained NOT_REPLIED. Returning to Inbox removed the badge, the Android notification/history were absent, and control conversation `1ca5f4ac-00e3-408b-958a-90a9a7f3a8e9` remained unread 3 / NOT_REPLIED. No Flutter exception or red-frame evidence occurred.

# Current task: Phase 4C.2 image realtime UX polish

- Image media updates now compare processing status, MIME type, size, and URL before calling `setState`, preventing duplicate unchanged realtime events from rebuilding ChatPage state.
- Image bubbles reserve a stable 240x240 container across PENDING, READY/loading, and loaded states, removing the lifecycle height jump without changing the backend contract.
- Added a focused Flutter regression covering one IMAGE `message.created`, duplicate creation replay, repeated `message.media.updated`, one media load, and no conversation reload. Flutter analyze, all 25 Flutter tests, and `git diff --check` pass.

# Current task: Phase 4C.3 inbox true realtime

- Replaced Inbox full reloads for `connected`, `message.created`, `message.media.updated`, and `conversation.updated` with immutable summary patches. IMAGE media events are ignored by Inbox because ChatPage owns media state.
- `message.created` patches the matching loaded row and moves it to the top. Unread counts remain authoritative: because the current SSE contract has no per-user unread count, the client performs a targeted conversation detail reconciliation instead of incrementing locally.
- Returning from Chat now patches the opened row to unread zero without reloading page 1. Full `_load(reset: true)` remains only for initial load, pull-to-refresh, explicit retry, and pagination.
- Added `ConversationSummary.copyWith`, nullable detail metadata for targeted unread reconciliation, and pagination-safe cursor copying. Flutter analyze, all 25 Flutter tests, and `git diff --check` pass.

# Current task: Phase 4C.4 initial chat scroll stabilization

- Replaced the one-shot initial `jumpTo` with a bounded three-frame routine that waits for content dimensions and rechecks the current max extent before marking initial scrolling complete.
- IMAGE rows without a media relation now use the same fixed 240x240 placeholder as other image states, preventing a text-to-image height change during initial layout.
- Added a widget regression with long variable-height messages, pending media, and an IMAGE without media; the final scroll position reaches `maxScrollExtent`. Flutter analyze, all 26 Flutter tests, and `git diff --check` pass.

# Current task: Phase 4C.4.1 initial scroll pagination race

- Added an initial-landing lifecycle guard so older-message pagination remains disabled until content dimensions are available and the bounded initial scroll stabilization completes.
- Guarded programmatic initial and pagination-restoration jumps from triggering the older-message listener. Manual top scrolling still loads the next cursor page.
- Added a long-conversation regression with image rows and a pagination cursor proving no automatic older request during landing and successful manual pagination afterward.
- Flutter analyze, all 26 Flutter tests, debug APK build, and `git diff --check` pass.

# Current task: Phase 4C.4.2 cancellable scroll commands

- Added a scroll-generation token invalidated by user movement so stale initial and bottom-scroll callbacks cannot override manual reading position.
- Initial stabilization aborts cleanly when superseded, while pagination remains enabled when dimensions are available. Older-page offset restoration and realtime append behavior remain unchanged.
- Added regressions for interrupting initial stabilization and a queued realtime auto-scroll. Flutter analyze, all 28 Flutter tests, production-configured debug APK build, and `git diff --check` pass.

# Current task: Fix Executive Dashboard Follower KPI Accuracy and Consistency

- Root Cause: `DashboardAnalyticsService` previously called `findFirst({ orderBy: { snapshotDate: "desc" } })` to fetch a single arbitrary OA snapshot across the entire database, mapping `targetedReaches -> addedToday` (e.g. +1,027), `blocks -> blockedToday` (e.g. -47), and `netToday -> 980`. This incorrectly conflated targeted reaches with daily added friends and cumulative blocks with daily new blocks, completely ignoring the other 143 stores in the network.
- Extracted shared follower aggregation helper `backend/src/follower-insights/follower-aggregation.helper.ts` with pure calculation functions `calculateFollowerGrowthMetrics` and `calculateStoreFollowerRanking`.
- Total Followers is now strictly a stock metric computed by summing latest valid ready snapshots per active eligible LINE OA in the network scope.
- Growth metrics (New Followers, Blocked, Net Growth) are computed by delta comparison between target date and baseline date (`today - 1d` for today, `today - 7d` for 7d, `today - 30d` for 30d) for comparable accounts only (where both target and baseline ready snapshots exist). Accounts with missing baseline are safely excluded from deltas and never assumed to have 0 baseline.
- Fixed `FollowerInsightsService.getSummary` snapshot query to include previous-day baseline (`minDateUtc = toUtcDateForDb(getPreviousBangkokDateString(dates[0]))`) so 1-day queries correctly compute `dailyIncrease`.
- Updated frontend cards (`FollowerGrowthCard`, `ExecutiveHero`, `dashboard-transformers`) with dynamic period labeling and faithful metrics.
- Removed misleading "95% Retained" / "Retention" badges and phrasing. Follower acquisition breakdown clearly presents New Followers vs New Blocks / Net Growth Breakdown.
- Added frontend test suite `frontend/test/dashboard-follower-terminology.test.mts` (5 tests passing).
- Added comprehensive unit test suite `backend/src/dashboard-follower-growth.spec.ts` (5 tests passing). Verified 1095 backend tests, backend build, 248 frontend tests, and frontend build.

# Current task: Phase 6F.1 AI Quick Reply architecture design

- Defined a conversation-scoped `AiQuickReplyModule` boundary with a server-side feature gate, `StoreAccessService` authorization, bounded context builder, replaceable provider token, deterministic MVP provider, safety/grounding validator, and non-blocking audit/telemetry.
- Preserved the existing `POST /mobile/conversations/:id/messages` reply contract as the only send path; quick replies remain editable drafts and never send autonomously.
- Specified DTOs, provider lifecycle, context exclusions, audit actions, staged feature flags, deterministic fallback behavior, and an adapter path for a future LLM provider. No application code or schema was changed in this design phase.

# Current task: Phase 6F.2 Quick Reply data contract design

- Defined public generation/response DTOs and internal context/provider/safety contracts without adding a route implementation or migration.
- Contracts require conversation-scoped store authorization, server-derived context, transient suggestion identifiers, non-autonomous sending through the existing reply API, safe standardized errors, and server-only feature configuration.

# Current task: Phase 6F.3 Quick Reply context builder design

- Defined a read-only, conversation-scoped context retrieval flow that authorizes with `StoreAccessService` before loading messages, store facts, catalog signals, or customer-derived context.
- Set bounded message/fact limits, deterministic product-fact precedence, missing-data fallback behavior, context version hashing, and unit-test scenarios. No source code or schema changes were made.

# Current task: Phase 6F.4 deterministic Quick Reply backend implementation

- Added the feature-gated Nest `QuickReplyModule` and `POST /mobile/conversations/:id/quick-replies` route. Context is built from an authorization-checked conversation with bounded recent messages, persisted classification, active catalog models, and safe Store Master facts.
- Added deterministic Thai/English/Chinese draft generation, safety filtering with handoff fallback, transient suggestion IDs/expiry/context version, and best-effort `AuditLogService` lifecycle events. No LINE send logic, message mutation, LLM provider, or Prisma migration was added.
- Focused Quick Reply tests pass (8/8), full backend tests pass (1102/1102), changed-file ESLint passes, backend build passes, and `git diff --check` passes. Full repository lint still reports pre-existing errors outside this change. Local HTTP startup reached route registration but was blocked by the existing missing `MassMessageCampaign` table / unavailable local PostgreSQL; no unrelated migration was applied.

# Current task: Phase 6F.5 Quick Reply production hardening (2026-08-14)

- Added canonical context-version checks and transient generation records. Lifecycle events use `POST /mobile/conversations/:id/quick-replies/events`, require the issuing user/conversation/generation and context version, and fail closed with 409 when stale or expired.
- Added a database-backed per-user minute bucket using the existing `AuthRateLimitBucket` table, so generation limits remain atomic across backend instances without a new migration. Added process-local aggregate metric hooks and safe structured metric logs without suggestion/customer content.
- Hardened candidate safety checks for prompt injection, sensitive URLs/contact-like output, control characters, line/count limits, grounding, and catalog evidence. Added a small synthetic evaluation dataset and focused regressions for lifecycle, stale context, rate limiting, evaluation expectations, and safety fallback.
- Focused Quick Reply tests pass 12/12; full backend tests pass 1107/1107; Prisma validation, Quick Reply ESLint, backend build, and `git diff --check` pass. Full repository lint remains blocked by 153 pre-existing errors outside this change. No Prisma migration was added.
- Runtime HTTP verification remains blocked by the repository's existing local database/schema issue (`MassMessageCampaign` missing / PostgreSQL unavailable); no unrelated migration or data change was applied.

# Current task: Phase 6F.6 Flutter AI Quick Reply integration (2026-08-14)

- Added typed mobile Quick Reply generation/lifecycle contracts for the existing backend routes. ChatPage now loads suggestions without replacing conversation detail state, renders them through the existing ChatComposer/QuickReplyPanel seam, inserts a selected draft into the composer, and handles retry/error states without touching realtime, pagination, unread, or scroll ownership.
- SHOWN, SELECTED, and EDITED telemetry use the backend lifecycle endpoint. SENT is recorded as a local safe lifecycle signal because the deployed backend contract intentionally has no SENT event; the existing reply API remains the only send path.
- Added Flutter regressions for response parsing, suggestion display/selection/edit/send, and retry behavior. Flutter analyze, full Flutter tests (31), production-configured debug APK build, and `git diff --check` pass.

# Current task: Phase 6G.1 Chat UI transformation (2026-08-14)

- Restyled the extracted chat presentation widgets into an enterprise support workspace: customer/store/status header, differentiated inbound/outbound message bubbles, stable image states, premium quick-reply cards, and a modern composer with attachment and AI shortcut actions.
- Kept ChatPage ownership and all repository, API, SSE, pagination, scroll, send, unread, media, and notification behavior unchanged. Existing ActionChip/Retry semantics remain available for accessibility and regression coverage.
- Flutter analyze, full Flutter tests (31), production-configured debug APK build, and `git diff --check` pass. Emulator runtime verification was not available because `adb` is not installed in this environment.

# Current task: Phase 6G.1.1 runtime UX audit (2026-08-14)

- Installed the exact production-configured debug APK (`1.0.0+1`) on `emulator-5554` (Android 16/API 36); an authenticated session was available after launch. Verified Inbox-to-chat for a long production conversation with text, outbound history, image media, profile sheet, composer/keyboard, attachment picker, unread clearing, and notification clearing. Runtime screenshots were captured under `/private/tmp`.
- Image media settled without an apparent layout shift and the full-screen viewer opened. The production AI feature is disabled, so only its fallback/retry state was tested; suggestion selection was unavailable. No controlled inbound SSE event or outbound production reply was sent during this audit.
- `flutter analyze` and the full 31-test suite passed. No source code was changed during the audit and no production message was intentionally sent or selected.

# Current task: Phase 6G.1.2 Chat premium polish (2026-08-14)

- Upgraded the Quick Reply presentation into an explicit AI draft workspace with assistant identity, review-before-send guidance, premium suggestion cards, and responsive loading/error/empty/retry states. Selection still inserts editable text into the existing composer and never sends automatically.
- Improved the responsive conversation header, message/composer surface, and fixed-size image presentation. Successful mark-read now synchronizes the existing local conversation detail used by the customer profile sheet, without a new request or conversation reload.
- Added narrow-screen presentation coverage and a regression for the post-mark-read profile unread count. `flutter analyze`, all 33 Flutter tests, the debug APK build, and `git diff --check` pass. Realtime, scroll generation, pagination, notification, unread, reply API, and AI backend ownership remain unchanged.

# Current task: Phase 6G.2.1 Inbox UI transformation (2026-08-14)

- Added a presentation-only Inbox header, conversation overview metrics, AI-ready indicator, responsive conversation cards, clearer status mappings, improved search affordance, and icon-based filter chips. InboxPage remains the owner of loading, pagination, pull-to-refresh, SSE patches, unread reconciliation, and navigation callbacks.
- Added narrow-screen-safe Inbox presentation composition without changing repository/API contracts. `flutter analyze`, the full 33-test suite, the debug APK build, and `git diff --check` pass.

# Current task: Phase 7B manual conversation tagging V1 (2026-08-15)

- Added nullable `Conversation.sourceChannel` backed by the additive `ConversationSourceChannel` enum and a reviewed migration. Existing conversations remain unchanged.
- Added authorized mobile product discovery and partial tag updates. Mobile detail now returns manual source/product tags; manual updates replace only the MANUAL product row, preserve RULE classifications, validate active model-level products, and return authoritative detail.
- Added Flutter tag models, repository methods, and a presentation-only tag bar/sheet with source chips, bounded product search, replacement/clear behavior, and local detail patching.
- Product selector/service tests, tagging widget tests, Prisma validation/generation, backend build, full backend tests (1110), changed-file ESLint, Flutter analyze, and full Flutter tests pass. The full repository ESLint command remains blocked by pre-existing unrelated violations.

- Runtime follow-up: the tag editor bottom sheet was hardened for narrow Android layouts by giving it an explicit bounded width/height and replacing unbounded header/action flex rows with wrapping layouts. The latest Flutter analyze and full test suite pass. The production catalog currently has no active `OPPO Find N6` model row; `OPPO Find X9` was used only as an available replacement during QA, and the target conversation was cleared back to untagged state.

# Current task: Phase 7B.1 Product Master catalog synchronization (2026-08-15)

- Audited the authoritative Product Master Sheet (`Sheet1`): 104 variant rows, 34 unique canonical names, five categories, and no category conflicts. Production currently has 19 active series, 27 models, 86 aliases, 8 active model-level selector rows, and no duplicate normalized model names; 24 existing models are extra and will not be deleted.
- Added a deterministic, dry-run-first importer that deduplicates variants by normalized PRODUCT NAME, maps the five sheet categories to existing ProductGroup values and existing series, creates only missing ProductModel rows, safely reactivates authoritative inactive rows, preserves aliases and ConversationProduct relations, and never deletes absent products.
- The importer is ready for a production dry run. No catalog data has been mutated yet.

# Current task: Phase 7B.2 detailed manual conversation tagging (2026-08-15)

- Audited production source tags (5,959 NULL, 1 STORE, 0 ONLINE), 7 MANUAL product rows, and the 104-row Product Master variant source (100 unique configurations, including products without RAM/ROM).
- Added additive migration coverage for multi-select `sourceChannels`, `isInstallment`, `ProductVariant`, and an optional manual ConversationProduct variant relation. The migration preserves NULL as `[]`, STORE/ONLINE values, existing model IDs, aliases, rules, and conversation products; it contains no destructive deletes.
- Extended the mobile tags contract and Flutter sheet for multi-source selection, installment, bounded Product Master variant selection, replacement, and clear semantics. No automatic tagging or AI behavior was added.

- Production verification completed on the approved OBS-Sunx2 conversation: source multi-select, installment, Product Master model, synced variant selection, isolated variant/product clearing, persistence, and final Clear all state all passed. Production migration is applied, catalog sync is idempotent, and the installed production-configured APK showed no app crash or RenderFlex overflow.

# Current task: Phase 7B.2.1 variant selection UX (2026-08-15)

- Audited the tag sheet and confirmed the product result list remained rendered after model selection, pushing Configuration below the usable viewport. The existing repository/backend variant endpoint was already present and authoritative.
- Updated the presentation flow so selecting a product collapses search/results into a selected-product card with Change/Clear actions, then loads valid variants from `GET /mobile/products/:productId/variants`. RAM, ROM, and Color are rendered as constrained FilterChips; only dimensions present in the response are shown, and selected combinations are resolved from real variant IDs.
- Added loading, empty, retryable error, saved-variant restoration, valid-combination, clear-product, and API-call widget coverage. No backend, schema, reply, realtime, notification, or conversation-state code changed.
- `flutter analyze`, full Flutter tests (42), production-configured debug APK build, emulator installation, and `git diff --check` pass. Runtime verification on `emulator-5554` with authenticated OBS-Sunx2 confirmed Reno15 5G and Find N6 configuration controls, valid selections, persistence after reopen, and final Clear all cleanup. Production catalog contains both requested models; final OBS tags are empty.

# Current task: Phase 7B.3 chat overscroll behavior (2026-08-15)

- Audited ChatPage/MessageTimeline: the timeline used default ListView physics and inherited Material's Android overscroll indicator. Added a chat-scoped `ChatScrollBehavior` that removes the overscroll indicator and explicit `ClampingScrollPhysics`; controller ownership, scroll-generation guards, initial stabilization, pagination, offset restoration, realtime append, and auto-scroll code were unchanged.
- Added a focused widget regression asserting clamped physics and the local scroll behavior. `flutter analyze`, full Flutter tests (43), production-configured debug APK build, emulator installation, and `git diff --check` pass.
- Runtime verification on authenticated OBS-Sunx2 exercised top/bottom boundary drags, older-message pagination, offset return to latest, and a normal BM send. Screenshots during boundary drags showed no stretch/bounce/glow; no app exception, ANR, or RenderFlex overflow appeared in logcat.

# Current task: Phase 7B.3 app-wide overscroll policy (2026-08-15)

- Audited every Flutter scroll surface: Inbox, Chat, profile, auth/registration, admin approval, tag/product sheets, customer profile, and horizontal Inbox filters. Added one `AppScrollBehavior` at `MaterialApp` so all scrollables use clamped physics and no Android stretch/glow indicator.
- Removed the chat-only scroll behavior and retained `AlwaysScrollableScrollPhysics` only on Inbox/admin `RefreshIndicator` lists so short empty/error states remain pull-to-refreshable. No controller, pagination, realtime, unread, notification, or bottom-sheet drag logic changed.
- Added focused app policy and refresh regressions. `flutter analyze` and the full Flutter suite (45 tests) pass; production APK build/install and runtime boundary verification remain to be completed.
- Final validation: `flutter analyze`, full Flutter tests (47), production-configured debug APK build, install on `emulator-5554`, and `git diff --check` pass. The registration form's two dropdowns also received `isExpanded: true` after runtime QA exposed a pre-existing narrow-layout overflow marker.
- Runtime QA on the authenticated production-configured APK exercised Inbox boundaries, OBS-Sunx2 chat boundaries, and Profile scrolling; no stretch/glow/bounce, Flutter exception, ANR, or RenderFlex overflow remained in the final run. The final install timestamp was 2026-08-15 20:28:10.

# Current task: Phase 8D final authenticated runtime acceptance (2026-08-15)

- Authenticated the approved QA BM on the production-configured APK and verified Summary V2 in English, Thai, and Simplified Chinese, including activity metrics, response collection state, low tag coverage messaging, source/installment sections, comparison state, and scrolling.
- Railway HTTP logs show successful `GET /mobile/summary/monthly` responses; emulator logs show no Flutter exception or RenderFlex overflow during the runtime checks.
- Runtime QA exposed and fixed a Summary month-navigation off-by-one. August → July → August now works and is covered by a regression assertion; focused/full Flutter tests, analyzer, APK build/install, and diff check pass.

# Current task: Phase 8A bottom navigation, profile hub, and employee ID (2026-08-15)

- Added persistent authenticated Inbox / Summary / Profile bottom navigation with an IndexedStack so Inbox state remains mounted while switching tabs. Chat remains a pushed detail route and does not inherit the bottom navigation.
- Added a truthful Summary placeholder and a Profile hub with assigned-store context, structured settings rows, read-only Personal Information, legacy employee-ID fallback, and the existing logout/admin approval callbacks.
- Employee ID is now required for new registration requests, normalized server-side to uppercase, persisted on User and RegistrationRequest, exposed in current-user/admin approval responses, and guarded by a nullable unique User constraint so legacy null values remain valid.
- Prisma validation/generation, backend build, full backend tests, Flutter analyze, and full Flutter tests pass. The local database contains only legacy null employee IDs; the new migration is reviewed but local migration status still has seven pre-existing unapplied migrations, so no migration was applied.

# Current task: Phase 8B.1 analytics trust foundation and monthly summary (2026-08-15)

- Added the explicit additive `Conversation.isQa` marker and a non-destructive Prisma migration. Analytics queries exclude marked QA conversations without changing Inbox, Chat, unread, reply, notification, tagging, or realtime behavior.
- Added the authenticated, store-scoped `GET /mobile/summary/monthly` endpoint. It uses explicit Asia/Bangkok half-open month boundaries, authoritative message chronology, human outbound attribution only, a ten-cycle response-quality threshold, and neutral comparison/quality states when coverage is insufficient.
- Replaced the Flutter Summary placeholder with month navigation, activity metrics, operational Need Reply/Completed counts, truthful response-data availability states, retry/empty handling, and comparison messaging. The existing authenticated shell now injects the Summary repository.
- Focused backend analytics tests (23), full backend tests (1149), changed-file ESLint, Prisma validation/generation/build, Flutter analyze, full Flutter tests (61), focused Summary widget tests (10), production APK build, and diff checks pass. Production migration is applied, the exact `OBS-Sunx2` conversation is marked QA, the deployed service reports QA exclusion and response metrics withheld at sample size 7, and the three-run service timings were 291/176/180ms. Authenticated emulator Summary navigation remains blocked because APK reinstall removed the prior session and no QA credentials/token are available; no credentials were changed or invented.

# Current task: Phase 8C full app localization (2026-08-15)

- Added Flutter generated localization from ARB resources for Thai, English, and Simplified Chinese (`th`, `en`, `zh`, and `zh_CN` aliases), with English fallback for unsupported locales.
- Added persisted language selection through `SharedPreferences`, native-language labels in Profile settings, and immediate app-wide locale updates without changing authentication, backend, realtime, notification, or conversation state.
- Centralized visible auth, inbox, chat, tagging, profile, summary, status, error, loading, and notification fallback strings. Customer/store names, employee IDs, emails, product master values, and message content remain dynamic and untranslated.
- Added localization widget coverage for all three locales, dynamic-content preservation, persistence, and immediate switching. Analyzer and the full Flutter test suite pass; production APK build/install and emulator locale verification remain the final release checks.

# Current task: Phase 8D Summary V2 (2026-08-15)

- Extended the existing monthly summary with response deltas, explicit response-distribution semantics, and manual-tag analytics using `CURRENT_TAG_SNAPSHOT`; no historical tag claims or tag comparisons are presented.
- Added truthful coverage quality, mutually exclusive source buckets, installment denominators, manual ProductModel/ProductVariant top-five aggregates, and preserved QA exclusion, store authorization, and the ten answered-cycle response threshold.
- Added Thai, English, and Simplified Chinese Summary V2 copy with locale-aware counts, percentages, and response-duration formatting. No schema migration was needed because all analytics use existing persisted fields.
- Focused backend summary tests (26), full backend tests (1152), Prisma validation/generation, backend build, changed-file ESLint, Flutter analyze, full Flutter tests (66), Summary widget tests (12), and production-configured APK build pass. Deployment and authenticated runtime QA remain the final release checks.

# Current task: Phase 7A.1 core Chat/Inbox cleanup (2026-08-14)

- Removed persistent store context from the Chat header while retaining store data in conversation models, Inbox cards, and the customer profile sheet.
- Consolidated customer-facing reply state into `Need Reply` (`NOT_REPLIED` and `NOTIFIED_BM`) and `Completed` (`REPLIED`). Inbox overview and filters now use the same mapping and enforce Total = Need Reply + Completed.
- Added direction/type-aware latest-message previews and targeted post-chat reconciliation for preview, timestamp, unread count, and reply status without reloading or resetting the Inbox list.
- Backend audit confirmed the mobile list/detail and SSE payloads already expose authoritative latest-message direction, type, text, and timestamp; no backend change or deployment is required.
- Focused tests (21), full Flutter tests (35), `flutter analyze`, production-configured debug APK build, and `git diff --check` pass. Emulator runtime verification remains the next action.
- Installed the exact APK on `emulator-5554` with app data preserved (`lastUpdateTime=2026-08-14 17:59:20`). An approved signed inbound event through the normal LINE webhook moved OBS-Sunx2 from Completed to Need Reply and updated the Inbox preview/counts in realtime.
- Sent `BM preview runtime test` through the mobile reply API (HTTP 201). Production verification found exactly one persisted OUTBOUND message and `REPLIED`; returning to Inbox issued only the targeted detail GET, patched the card to `Completed`, rendered `You: BM preview runtime test` with the outbound timestamp, and changed overview counts from 16/11 to 15/12 without a full Inbox GET.
- Runtime filter verification confirmed OBS-Sunx2 is absent from Need Reply and present under Completed after reply. Reopening Chat showed the persisted message once, customer-only persistent header context, and no Flutter/RenderFlex exception.

# Current task: Phase 8D.1 customer tag semantic correction (2026-08-16)

- Kept `Conversation.isInstallment` and the existing mobile API contract; corrected its meaning to customer installment purchase status rather than installment interest.
- Grouped source/status/product/variant controls under Customer Tags, localized Customer Status and installment-customer analytics in English, Thai, and Simplified Chinese, and added focused semantic tests.
- Backend full tests (1152), Prisma validation/generation/build, changed-file ESLint, Flutter analyze, full Flutter tests (67), production APK build/install, runtime tag persistence, Summary wording, and diff check pass. Repository-wide backend lint remains blocked by pre-existing unrelated errors.
- Applied the requested English title-case copy (`Customer Tags`, `Customer Tag Coverage`, `Installment Customer Analytics`, `Installment Customers`), regenerated l10n, and reran Flutter analyze, all 67 Flutter tests, and the production-configured APK build successfully.

# Current task: Phase 9B.1 backend priority queue foundation (2026-08-16)

- Added a dynamic, operational priority calculator and isolated `PriorityService`. It derives waiting work from message chronology (latest inbound after the latest human outbound), applies the approved age/installment/manual-product/multiple-inbound weighting, and returns only public priority level, waiting age, timestamp, and reason codes.
- Enriched the existing `GET /mobile/conversations` response for the returned page without adding a route, table, migration, or client/UI changes. Priority context is loaded in one batched query and remains store-authorized through `StoreAccessService`.
- Added focused calculator, authorization, scoping, product-source, and score-cap tests. Full backend tests (1167), changed-file ESLint, Prisma validation/generation, backend build, and diff checks pass.

# Current task: Phase 9B.2 Flutter priority queue UI (2026-08-16)

- Added safe `ConversationPriority` decoding, an Inbox `Priority` tab, backend-authoritative level/waiting display, and level-then-oldest-waiting sorting. Completed conversations are excluded from the priority view; the existing filters, reconciliation, realtime, pagination, unread, notification, and reply flows remain intact.
- Added English, Thai, and Simplified Chinese priority labels, responsive priority badges/cards, and focused model/sorting/widget/localization/overflow tests. `flutter analyze`, the full Flutter suite (73), production-configured debug APK build, and `git diff --check` pass.

# Current task: Phase 9D.1 Purchase Information contract (2026-08-16)

- Added an additive backend conversation projection separating `purchaseInformation` (MANUAL records), `aiInsight` (RULE records), and `operationalState`. Existing `tags`, products, topics, status, and authorization behavior remain compatible.
- Added `PATCH /mobile/conversations/:id/purchase-information`; the legacy `/tags` route remains available. Store access is still resolved server-side through `StoreAccessService`.
- Updated Mobile parsing and conversation editor terminology from Customer Tags to Purchase Information without adding a confirmation workflow. Web Admin now has separate Customer Purchase and AI Insight sections when additive fields are available.
- No Prisma migration or historical data conversion was performed. Legacy MANUAL provenance remains unresolved; RULE data is never treated as purchase data.
- Focused backend contract/mobile tests, full backend tests (1171), backend build, Flutter analyze/tests, frontend build, and changed-file lint pass. Repository-wide lint still contains pre-existing unrelated errors.

# Current task: Phase 9D.2 purchase provenance and Web Admin parity (2026-08-16)

- Added additive purchase provenance on conversations (`purchaseRecordedById`, `purchaseRecordedAt`) and activity audit metadata/actor fields. Existing MANUAL/RULE product storage remains unchanged.
- Mobile purchase saves now persist the authenticated BM and timestamp and create `PURCHASE_INFORMATION_UPDATED` activity entries with old/new snapshots. Store authorization remains server-side through `StoreAccessService`.
- Mobile and Web Admin now display the same `recordedBy`/`recordedAt` contract. Historical records without provenance remain legacy unknown; no historical conversion was performed.
- Local additive migrations are applied and the schema is up to date. Backend tests (1173), build, Flutter analyze/tests, Flutter APK build, frontend tests/build, changed-file lint, and diff checks pass. No deployment was performed.

# Current task: Phase 9D.3 purchase intelligence and admin operation layer (2026-08-16)

- Added an authenticated `GET /admin/purchase-analytics` service/controller over the existing conversation purchase snapshot. It scopes active, non-archived stores through `StoreAccessService`, supports ISO date ranges and an optional authorized store filter, and treats provenance-backed records as verified.
- Analytics include verified-record totals, MANUAL-only product/variant/color rankings, channel/payment breakdowns, store ranking, and BM recording activity. RULE product rows are excluded at the Prisma relation filter and defensively at the service boundary; records without provenance remain outside the verified dataset.
- Added the Web Admin Purchase Intelligence dashboard with overview, products, variants, channels, payment, colors, store performance, and BM recording activity sections. BM users do not receive a global store selector; their API result is membership-scoped. No schema migration or historical conversion was needed.
- Focused purchase analytics tests (5), full backend tests (1178), Prisma validation, backend build, changed-file ESLint, Flutter analyze/tests, frontend tests (328), frontend changed-file ESLint, and frontend production build pass. No deployment was performed.

# Current task: Phase 9D purchase ownership and legacy-record semantics (2026-08-16)

- Added `purchaseInformation.recordState`: `VERIFIED` requires purchase provenance, `LEGACY_MANUAL` keeps historical MANUAL rows explicitly unverified, and `NONE` represents no manual purchase record. RULE products remain AI Insight only.
- Web Admin Customer Purchase is read-only and no longer exposes the legacy tag-edit action that could create unprovenanced purchase rows. Legacy records are labeled as unverified; verified purchase details remain separate from AI Insight.
- Flutter preserves the existing BM purchase editor, but legacy records are not rendered as verified purchase data. Saving through the BM purchase-information route continues to attach recorder and timestamp provenance.
- No migration or historical rewrite was performed. Backend tests (1179), backend build, Prisma validation, changed-file ESLint, frontend tests (328), frontend build, Flutter analyze/tests, APK build, and diff checks pass. Deployment/runtime QA remains pending.

# Current task: Web Admin purchase contract alignment (2026-08-16)

- Verified the existing Web and Mobile conversation services already return the additive `purchaseInformation`, `aiInsight`, and `operationalState` contract; no backend changes were needed.
- Web Customer Purchase now renders verified purchase data only, keeps RULE detection/confidence/intent/topics under AI Insight, labels legacy records safely, and exposes `Edit Purchase Information` through the existing authenticated mobile purchase-information contract rather than the legacy generic tag endpoint.
- Frontend API types and client methods now cover the purchase contract, product variants, and purchase-information update. Web tests (329, including an explicit Customer Purchase/AI Insight separation regression), frontend build, changed-file lint, and diff checks pass. Production runtime comparison remains pending.

# Current audit: production Web Admin semantic contract (2026-08-16)

- Railway backend and frontend are both running commit `9312961`; the semantic-alignment changes remain uncommitted locally and are therefore absent from production.
- Production OBS-Sunx2 still has legacy MANUAL purchase fields (`sourceChannels`, `isInstallment`, product/variant) but no provenance columns. The production Prisma client rejects `purchaseRecordedAt` as an unknown Conversation field, and `_prisma_migrations` does not contain the authored purchase-provenance migration.
- The deployed frontend commit still renders Product Insight from legacy product/classification fields. No browser-cache issue was established; deployment of the backend contract, prerequisite additive migration, and frontend bundle is required. Historical records must be re-saved through the purchase-information flow to become VERIFIED; no automatic conversion is planned.

# Current task: Phase 10B.3 backend forced password-change enforcement (2026-08-17)

- Added an authenticated-route gate in `AuthGuard`: users with `mustChangePassword=true` can only access `/auth/me`, `/auth/change-password`, and logout; protected conversation, store, dashboard, analytics, and admin routes return HTTP 403 with `PASSWORD_CHANGE_REQUIRED`.
- Preserved the existing mobile error envelope while allowing the password-change code through the mobile exception filter. Password reset, login, registration, and session architecture remain unchanged.
- Added guard, filter, and password-state regression tests. Full backend tests, Prisma validation, build, changed-file ESLint, and diff checks pass.

# Current task: Phase 10B.4 conversation summary authorization scope (2026-08-17)

- Scoped both conversation reply-status summary endpoints through the authenticated request and `StoreAccessService`; ADMIN receives global active-store scope and BM/STAFF receive only active assigned stores.
- The aggregation service now requires an explicit resolved scope, applies it to store rows, grouped conversation counts, and oldest-waiting queries, and preserves an empty scope as `IN []` rather than falling back to all stores. The mobile monthly summary was already scoped and was not changed.
- Added controller, query-scope, inactive-membership, and cross-store regression tests. Full backend tests (1200), Prisma validation, build, changed-file ESLint, and diff checks pass.

# Current task: Phase 10B.5 purchase write boundary hardening (2026-08-17)

- Legacy product writes through `/conversations/:id/tags` and purchase-field writes through `/mobile/conversations/:id/tags` now fail closed. Topic-only legacy tagging remains supported.
- Purchase edits continue through `/mobile/conversations/:id/purchase-information`; each successful update records the authenticated actor and timestamp and creates a `PURCHASE_INFORMATION_UPDATED` activity with old/new snapshots.
- MANUAL purchase rows remain separate from RULE classification rows; no schema migration or historical conversion was performed.

# Current task: Phase 10B.6 password policy alignment (2026-08-17)

- Added one shared backend policy requiring 12+ characters, uppercase, lowercase, number, and special character.
- Enforced it at BM registration, admin-generated temporary password validation, forced/normal password change, and first-admin setup validation. Existing password verification/login remains unchanged.
- Password violations return `PASSWORD_POLICY_VIOLATION` with safe requirement text; no plaintext password or schema change was introduced.
# Current task: Main LINE OA Workspace (2026-08-24)

- Audit found `LineOfficialAccount` is the OA credential/account model. It was required to belong to `Store`; `Conversation` redundantly required both `storeId` and `lineOfficialAccountId`. Webhooks already resolve a unique OA by `webhookKey`, preserve raw request bytes for signature verification, and isolate a user's conversations by OA ID.
- Added backward-compatible `LineAccountType` (`STORE` default, `HEAD_OFFICE` explicit), nullable store relationships for Main OA, database checks preventing STORE-without-store and HEAD_OFFICE-with-store, and explicit user capabilities for Main OA view/manage access.
- Store conversation/account/follower paths now query `STORE` scope; Main OA has dedicated capability-protected account, inbox, detail, message, reply-status, and send routes. The frontend has a dedicated `/main-oa` workspace and only shows its navigation entry when the session capability is present.
- Existing data remains `STORE` through the enum default. No Main OA or fake Store record was created, no credentials were connected, and no deployment was performed.
- Prisma validation, backend build, focused Main OA/store isolation tests, changed-file lint, all 377 frontend tests, and the frontend production build pass. The rolling-window follower fixture was subsequently made calendar-safe and the full backend suite now passes 1,258/1,258. Repository-wide backend lint still reports pre-existing unrelated errors.
- Initial Docker availability was transient; the local PostgreSQL container was started later in this audit and the committed migration was applied and verified in the closure section below.

# Current verification closure: Main LINE OA Workspace (2026-08-24)

- Started Docker Desktop and the local PostgreSQL 16 container; applied all 9 pending committed migrations, including `20260824093000_add_main_oa_workspace`. Prisma reports the database schema up to date.
- Baseline and post-cleanup counts match exactly: 7 LINE OA accounts, 6 stores, 156 Store Master rows, 23 conversations, 37 messages, and 6 users. Final invariants are clean: no STORE account without a store, no HEAD_OFFICE account with a store, no temporary account/customers, and both test users have `canAccessMainOa=false` and `canManageMainOa=false`.
- Database probes passed for valid STORE and HEAD_OFFICE rows and rejected both invalid account/store combinations. Both Main OA capability constraints are present; the migration record is finished and not rolled back.
- Runtime checks passed: backend health/readiness 200; unauthenticated Main OA 401; ADMIN Main OA account/list/detail/status paths authorized; VIEWER Main OA reads authorized but status writes return 403; store and analytics endpoints report no HEAD_OFFICE leakage; signed webhook events route separately to temporary HEAD_OFFICE and STORE accounts and were deleted after verification.
- Backend full tests pass 1,258/1,258. The rolling-window follower test now derives its fixture dates from `getAutoBackfillDates()` instead of a stale July 2026 literal. Main OA/date-fix ESLint, Prisma validation, backend build, frontend tests (377), frontend build, frontend Main OA ESLint, and `git diff --check` pass.
- Repository-wide backend lint still reports 320 existing violations outside this focused change set; repository-wide frontend lint still reports existing errors/warnings outside Main OA. No deployment or real LINE OA credential connection was performed.

# Current task: Production Deployment Stage 1 — Main LINE OA Workspace (2026-08-24)

- Deployed clean release commit `5dfe026` to the existing Railway production backend and frontend services. No GitHub push, new Railway project, environment-variable change, Main OA credential, webhook configuration, or HEAD_OFFICE account was created.
- Backend deployment `672ab1d9-a4a8-41a3-897c-be56072687c8` ran the configured `npx prisma migrate deploy` pre-deploy command successfully. Frontend deployment `4764ffcc-896b-4b42-a99a-3553be44dd5e` completed successfully. Prisma reports 66 migrations and schema up to date.
- Production baseline was 145 LINE OA accounts, 146 stores, 156 Store Master rows, 8,715 conversations, 29,196 messages, and 5 users. Final counts are 145, 146, 156, 8,716, 29,207, and 5; the conversation/message increases were live traffic during the rollout, not deployment writes.
- Final production invariants: 145 STORE accounts, 0 HEAD_OFFICE, 0 STORE accounts missing Store, 0 HEAD_OFFICE accounts with Store, 0 users with Main OA capabilities, 0 fake Main OA names, and 0 fake Store Master rows.
- Production health passed: backend `/health` and `/health/readiness` 200, frontend `/api/health` 200, homepage 200, frontend `/main-oa` 200, unauthenticated backend Main OA API 401. Temporary ADMIN/VIEWER sessions and capability grants were restored/deleted after smoke testing.
- Store smoke tests passed for account list, conversation list/detail/messages, stores, BM Reply Status, dashboard analytics, follower insights, and friend-source analytics. Seven existing STORE webhook events were processed successfully after deployment; no backend/frontend HTTP 5xx logs were observed.
- Stage 1 is complete. Stage 2 remains the next action: connect the real Main OA only after explicit authorization; do not perform it automatically.

# Current task: Production Connection Stage 2 — Main LINE OA (2026-08-24)

- Stage 2 is blocked before account activation because the approved production environment contains no real Main OA inputs. Read-only Railway inspection confirmed the encryption key, public webhook base, and webhook feature flag are present, but `MAIN_OA_CHANNEL_ID`, `MAIN_OA_CHANNEL_SECRET`, `MAIN_OA_CHANNEL_ACCESS_TOKEN`, `MAIN_OA_DISPLAY_NAME`, and `MAIN_OA_BASIC_ID` are absent; no substitute or fake values were used.
- The existing onboarding path was audited: Main OA metadata and encrypted credentials use `LineOfficialAccount` plus `CredentialEncryptionService` (AES-256-GCM); the account-specific persisted webhook key and raw-body signature route are reused; outbound selection reads the conversation's `lineOfficialAccountId`; Main OA routes and capabilities fail closed to `HEAD_OFFICE`/authorized users.
- Production read-only baseline at the stop point: 145 `STORE` accounts, 0 `HEAD_OFFICE`, 146 Stores, 156 Store Master rows, 8,716 conversations, 29,208 messages, 5 users, 0 invalid STORE/HEAD_OFFICE relationships, and 0 users with Main OA capabilities. Store BM status counts were `NOT_REPLIED=3,897`, `NOTIFIED_BM=5`, `REPLIED=4,814` at query time; these are live values.
- No production HEAD_OFFICE account, credential, webhook configuration, permission grant, inbound test, or outbound message was created/sent. Stage 2 must resume only after the real Main OA inputs and an approved internal LINE test user are available through the secure production process.

# Current task: Rebase Main OA work onto current Main Workspace (2026-08-24)

- Created the untouched safety branch `backup/main-oa-a754d59` at the pre-rebase local HEAD, then rebased the three local Main OA commits onto `origin/main` at `5debddd` without a merge commit or reset.
- Resolved the dashboard analytics signature conflict by retaining the current remote custom-range behavior and adding the local STORE-only analytics scope. Resolved the shell conflict by retaining the remote AppSidebar/top-navigation architecture and integrating Main OA as a separate capability-gated sidebar section.
- Main OA now uses the current AppShell/sidebar, remains absent from Store navigation and selectors, redirects unauthorized sessions, and retains dedicated HEAD_OFFICE APIs. Added regression coverage for the integration and updated an existing dashboard fixture to the current controller contract.
- Backend tests pass 1,258/1,258; Main OA isolation tests pass 3/3; backend build passes. Frontend Main OA tests pass 2/2; changed-file lint passes; frontend build passes; local built routes `/`, `/dashboard`, `/chats`, `/follower-insights`, and `/main-oa` return 200.
- The full frontend suite reports 343 passing and 27 stale/baseline failures from pre-existing route and legacy TopNavigation expectations that conflict with the current `origin/main` sidebar architecture. Repository-wide backend lint reports 319 pre-existing unrelated errors; changed-file lint passes. No deployment or push was performed.

# Current verification gate: origin/main frontend baseline (2026-08-24)

- Created a detached temporary worktree at `origin/main` (`5debddd`) and installed the frontend lockfile dependencies without modifying the current worktree or branch.
- The exact baseline frontend command produced 368 tests: 341 passed and 27 failed. HEAD initially produced the same 27 failures plus two passing Main OA tests, proving zero frontend regressions were introduced by the rebase/integration.
- Updated stale tests to validate the current Main Workspace/AppSidebar, responsive shell wrappers, `/home` login destination, current dashboard copy, current TikTok shell links, and responsive purchase/broadcast entrypoints. Added the missing `/classification-insights` route and its AppSidebar link because the route was referenced by the product but absent from the built route tree.
- Final frontend suite passes 378/378. Focused Main Workspace/navigation/Main OA tests pass 113/113; frontend build, changed-file lint, backend full suite (1,258/1,258), Main OA isolation tests (3/3), and backend build pass. Local runtime routes return 200; unauthenticated Main OA API returns 401. No production change, push, or deployment was performed.

# Current task: Remove Classification Insights from the frontend (2026-08-24)

- Removed the Classification Insights page, view, translations, sidebar item, mobile More-menu links, primary-section state, shell labels, workspace branch, API client method, and response type. Backend routes, product-classification data, Main Workspace, and Main OA were not changed.
- Updated route/navigation/design-system/auth tests to reflect that `/classification-insights` is not registered. The built route manifest omits it and the local production server returns 404 for that path.
- Frontend tests pass 373/373 and the production build passes. Required route smoke checks return 200 for `/`, `/dashboard`, `/chats`, `/follower-insights`, and `/main-oa`; backend health returns 200. `git diff --check` passes.
- Repository-wide ESLint still reports pre-existing unrelated errors/warnings (including React hook rules and explicit `any` findings); no unrelated lint cleanup was included.

# Current task: Approval notification emails via Resend (2026-08-24)

- Extended the existing backend email subsystem with a provider interface, a Resend provider, and an escaped responsive Thai approval template. The sender uses `EMAIL_FROM_NAME` and `EMAIL_FROM_ADDRESS` (with legacy `EMAIL_FROM` compatibility); `APP_LOGIN_URL` is not used.
- Approval now performs conditional pending-state updates inside the existing transaction, then sends the notification only after the transaction resolves. Delivery is best-effort: approval remains ACTIVE when Resend fails, the API returns `notification.status`, and sanitized delivery events/logs contain only a recipient hash.
- Added focused approval/provider/template/config tests. Backend focused tests pass 29/29, full backend tests pass 1,269/1,269, backend build passes, and changed backend source lint passes. Frontend tests pass 374/374 and frontend production build passes. Local homepage/admin registrations/Main OA routes return 200; backend health returns 200; unauthenticated approved-accounts API returns 401; `git diff --check` passes.
- No Resend resend button or schema migration was added. Existing `EmailDeliveryEvent` records delivery outcomes; persistent per-account idempotency/rate-limit state remains out of scope for this first version.

# Current task: BM/PC account lifecycle Phase 1 (2026-08-24)

- Reused the existing `UserStatus.SUSPENDED`, `MembershipStatus.SUSPENDED`, `User.isActive`, `Session`, and `DeviceToken` fields. Deactivation is an ADMIN-only transition that preserves users, registration requests, approvals, and history while suspending active Store memberships, deleting sessions, and invalidating device tokens.
- Reactivation restores only the selected current membership (primary, then newest approved/current record), never sends an approval email, and records explicit ADMIN lifecycle audit actions. Repeated transitions are no-ops without repeated revocation or audit side effects.
- Added `/admin/registrations/users/:id/deactivate` and `/reactivate`, approved-account status fields/filtering, desktop overflow/confirmation actions, and mobile status/actions. Main Workspace, Main OA, HEAD_OFFICE, Kaojao, LINE webhook, Prisma schema, and migrations were not changed.
- Focused lifecycle tests, full backend tests, backend build, changed-file lint, frontend tests, frontend build, and `git diff --check` are the required closure checks before the normal GitHub push.

# Current task: BM/PC account lifecycle Phase 2 permanent deletion (2026-08-24)

- Phase 0 dependency audit classified User relations before implementation. Sessions, OTP challenges, device tokens, and push notifications are safe authentication/runtime cleanup; memberships, registration/approval provenance, messages, conversation purchase/sales attribution, activity history, translation feedback, mass-message creators, and audit actor/target links must remain available. Physical User deletion is unsafe because mixed Cascade/SetNull/Restrict relations would either destroy history or fail on restrictive translation feedback.
- Chosen strategy is an explicit `UserStatus.DELETED` tombstone with `deletedAt`, PII/credential anonymization, preserved User and membership rows, and transactional cleanup of authentication/runtime material. A fresh registration can reuse the original email, employee ID, and phone because the tombstone and registration-request PII are scrubbed.
- Added the ADMIN-only inactive-account permanent-delete action, exact `DELETE` confirmation UI, safe deletion audit metadata, and regression tests. Main OA, HEAD_OFFICE, Kaojao, LINE webhook, Store analytics isolation, and Resend approval notification behavior remain untouched.
- Local migration `20260824150000_add_deleted_account_state` applied successfully and was verified in the local PostgreSQL container; no production database was touched. Backend full suite passes 1,281/1,281, frontend full suite passes 377/377, both production builds pass, changed-source lint passes, required route smoke checks return 200, and `git diff --check` passes.

# Current task: Web auth copy and password guidance (2026-08-25)

- Simplified the login registration CTA to “Create account” while retaining `/register` as its target.
- Expanded the Web registration password guidance under the Password field using the existing Mobile app conditions, without changing registration submission, validation, HQ/BM/PC selection, or either password visibility toggle.
- Frontend tests pass 382/382, scoped ESLint and the production build pass, `/login` and `/register` respond successfully, and rendered registration output contains all five password conditions.

# Current task: HQ mobile all-store inbox (2026-08-25)

- Extended the existing `/mobile/conversations` query with authorized `storeId`, `bmReplyStatus`, and search filters while preserving `StoreAccessService.accessibleStoreIds`; all-store HQ users remain unscoped until they select a store, matching Web `/chats` visibility.
- HQ users with all-store scope now see Inbox as the first mobile destination. HQ cards use the required store/time, customer/preview, and exact status hierarchy; store selection uses the existing Web store-scope summary endpoint. BM/PC inbox cards and legacy Need Reply behavior remain unchanged.
- Added the existing HQ approved-account endpoint to the mobile approvals page as an Approved/manage tab with active/inactive state and deactivate/reactivate actions; no schema, webhook, provider, or Main OA changes were made.
- Flutter analyze and all 108 Flutter tests pass. Backend build and all 1,302 backend tests pass. Focused mobile conversation service tests pass 20/20. Next action is review/commit the release-related diff only.

# Current task: HQ mobile conversation detail (2026-08-25)

- Created `feat/hq-mobile-conversation-detail` from `origin/main` at `2a7b46ebef55fc4c38ab31c950058e6085230594`. Extended the existing mobile conversation detail route with the canonical Web-compatible BM reply-status endpoint, store authorization, and explicit `canReply` enforcement; no schema, APK, frontend Web, Main OA, webhook, or provider changes were made.
- HQ detail now keeps store identity prominent in the header, shows customer and exact reply status, loads the existing full message/media history, supports reply and Notify BM/status actions through the existing conversation service, and returns to Inbox with the existing detail reconciliation path. BM/PC detail and store scope remain unchanged; read-only users receive a disabled composer and no write actions.
- Added Flutter and backend regression coverage for store context, all-store detail access, reply/status/read-only behavior, status persistence, unauthorized stores, and existing inbox behavior.
- Flutter analyze passes; full Flutter tests pass 111/111; focused detail/inbox tests pass 26/26. Backend build passes; focused mobile service tests pass 23/23; full backend tests pass 1,305/1,305. `git diff --check` passes. Next action is commit, push the feature branch, open the PR, and wait for CI.

# Current task: HQ mobile inbox operational polish (2026-08-25)

- Started `feat/hq-mobile-inbox-operational-polish` from `origin/main` at `363cd12ed50be74d0ce246d2f885d7184f20a710`; Android version and the signed APK were not touched.
- Reused `GET /mobile/notifications/unread-count` for the authenticated backend unread total, added HQ-only All/Not Replied/Notified BM/Replied/Unread filters, preserved existing store/status/search state in the inbox route, and made pull-to-refresh/detail/realtime paths reconcile the count and card data.
- Kept BM/PC filters/cards and StoreAccess authorization unchanged. Added localized Unread labels and regression coverage for HQ total/filter/store scope and refresh behavior; backend notification count coverage confirms the user-scoped all-store truth.
- Focused Flutter inbox/unread tests pass 24/24; full Flutter tests pass 114/114; Flutter analyze passes. Backend build passes, focused mobile tests pass 25/25, full backend tests pass 1,306/1,306, and changed-test lint passes. Commit `4d156a068b951e06e871a8ce4b3b1d63d581d862` is pushed on the feature branch; PR #50 is open and Android package, backend, frontend, and mobile CI checks all pass. No merge or deployment was performed.

# Current task: Android 1.0.15+16 production release (2026-08-26)

- Created `release/android-1.0.15` from `origin/main` at `699fe377ca56e5f48c4c68ab43df43fee868f0b` and updated the Flutter/workflow targets to version `1.0.15+16` with package `click.lineoppo.chat`.
- Local Flutter analyze and full tests pass. The signed APK and public download metadata remain pending until the existing permanent signing workflow completes and its certificate, package, version, API URL, and checksum are independently verified.
# Current task: Public OPPO Retail Insights landing page (2026-08-25)

- Replaced the root `/` dashboard redirect with a standalone public OPPO Retail Insights landing page containing the required product copy, TikTok connection CTA, administrator sign-in CTA, three-step explanation, and public policy links.
- Preserved the existing authenticated workspace implementation and all protected routes. Added regression coverage for the public root boundary, canonical links, public TikTok authorization entry, policies, and existing admin authentication behavior.
- Frontend tests pass 387/387 and the production build passes. Production-mode route checks confirm `/` is a cacheable 200 without an auth redirect; `/login`, `/dashboard`, `/chats`, `/follower-insights`, `/main-oa`, `/privacy`, and `/terms` respond, while `/tiktok` retains its unauthenticated redirect to `/login`.
- No commit, push, deployment, database change, environment-variable change, or webhook change was performed.

# Current task: TikTok OAuth callback production 404 (2026-08-25)

- Read-only Railway audit confirmed TikTok account `847a5d29-ea29-42de-9b19-e51c686549f2` exists as O-Central World, is connected and StoreMaster-bound, and is the only current TikTokAccount row. Internal sync returned HTTP 200; no persistence/ID mismatch or duplicate account exists.
- Railway HTTP logs established the failure chain: the callback observed an `oppo_session` cookie and redirected to the admin dashboard; the dashboard's backend account reads returned 401; the frontend API client collapsed 401 into null; the page therefore called `notFound()` and returned 404.
- The public `/tiktok/connect` callback now always routes successful authorization to `/tiktok/connect/success`, independent of `oppo_session`. OAuth state validation, internal sync authentication, StoreMaster matching, token encryption, and account/video/metric persistence are unchanged.
- Dashboard account reads now distinguish backend 401 from true missing/null responses. A 401 redirects to login; a backend 404 or null account still renders the expected 404; other backend HTTP failures propagate instead of masquerading as missing data.
- Focused frontend TikTok tests pass 44/44 and the full backend suite passes 1,300/1,300. Backend and frontend production builds, changed-file lint, and diff checks pass. The full frontend suite passes 387/388; its sole failure is the pre-existing Android download release mismatch (`latestAndroidRelease` 1.0.13 versus `android_app/pubspec.yaml` 1.0.14), which cannot be corrected truthfully without a matching 1.0.14 APK artifact.
- Local runtime checks pass: backend health/readiness and frontend health return 200; unauthenticated `/tiktok` redirects to login; an expired `oppo_session` on the affected dashboard URL now redirects to login instead of returning 404. Local `/tiktok/connect` reached its controlled OAuth configuration error because local TikTok credentials are absent; callback success behavior is covered by regression tests. No commit, push, or deployment was performed.
- First production verification after deployment showed a valid WEB session still redirected to login. Root cause: TikTok server-side reads forwarded the WEB cookie value as Bearer auth, while `AuthGuard` intentionally interprets Bearer credentials as MOBILE sessions. TikTok user-session sync/read calls now forward the canonical `oppo_session` cookie to the backend; the temporary verification session was removed immediately.
