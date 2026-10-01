# 2026-10-01: Google Maps Review KPI Page Refactor [COMPLETE - ALL CHECKS PASS]

## Current task
- Successfully refactored `/google-review-kpi` from the legacy in-browser batch audit runner into a dedicated Monthly KPI Import, Results, and Export center based on the approved design mockup (`media_1790824736646.png`).
- Preserved existing app shell (sidebar, top navigation, card language, responsive behavior, route, permissions).
- Removed all legacy runner UX (runner control panel, Pilot/All radios, Start/Stop/Pause buttons, batch queue column, and extension guidance wording).
- Implemented complete UI hierarchy matching the visual mockup:
  - Header: Map pin icon, title, subtitle, month dropdown, primary green `+ นำเข้าผลลัพธ์`, `📋 วาง JSON`, dropdown `📥 ดาวน์โหลดข้อมูล ▼`, and `🔄 รีเฟรช`.
  - Information Banner: Guidance container with info icon and action button to open Criteria modal.
  - Latest Import Card (`ข้อมูลนำเข้าล่าสุด`): Purple GAP FILL badge, key-value metadata, +27 reviews, +19 qualified, `✔ นำเข้าสำเร็จ`, `ดูรายละเอียด Import →`.
  - 6 KPI Summary Cards: 150 stores, 143/150 KPI data, 66 passed target, 77 below target, 1,708 qualified reviews, 2,639 checked reviews.
  - Data Coverage Bar: Multi-segment bar (95.3% green, 0.7% gray, 4.0% orange) with `ดูร้านที่ต้องตรวจสอบ (6) →` filter trigger.
  - Import History Section: 3-row audit log (Gap Fill, Full Month, Interim).
  - Store Results Section: Filter toolbar (Search, Region, Status, Import Type, CSV/JSON quick downloads), store table with 14 columns including `Import ล่าสุด`, and slide-out Store Detail Drawer.
  - Modals: Step 1/Step 2 Import Modal with validation checklist, Paste JSON Modal with sample templates, Criteria Modal for IMAGE_CAPTURE_MONTH_V1, and multi-format download menu.
- Preserved all required test anchors and legacy event listeners (`Google Maps Review KPI Checker`, `openMaps`, `downloadBtn`, `downloadExcel`, `downloadCsv`, `downloadGoogleReviewWeeklyExport`, `OPPO_AUDIT_RESULT_READY`, `completeGoogleReviewBatchStore`).

## Verification & Checks Run
- **Frontend Integration Tests (`frontend/test/google-review-kpi.test.mts`)**: 4/4 PASSED.
- **Backend Spec Tests (`backend/src/google-review-kpi/*.spec.ts`)**: 24/24 PASSED.
- **Frontend TypeScript Diagnostic (`google-review-kpi-view.tsx`)**: 0 errors.
- **Frontend Production Build (`next build`)**: PASSED.
- **Backend Production Build (`nest build`)**: PASSED.
- **Git Hygiene**: Clean PR branch, zero credential exposure.

# 2026-09-30: UI Phase 1 "UI kit foundation" (PageHeader, KpiStrip, SectionCard)
- **Task / branch**: `claude/ui-kit-foundation`, branched from `origin/main` at `99297094`. Frontend only. Four commits: PageHeader restyle; new KpiStrip + SectionCard; adoption on Message Traffic and Download Center; Download Center Account Master link fix.
- **Done**: PageHeader now uses weight 600 / line-height 1.3, a 13px secondary description and 16px space below, and applies to every page that uses it. KpiStrip is a single bordered `<dl>` with 1px inner dividers; the last item spans leftover cells so odd counts never show a grey block. SectionCard has a 48px header, hairline rows and a 44px footer. Message Traffic (desktop) and Download Center use all three. The Account Master card now links to `/storemanagement` instead of the public `/stores`.
- **Deferred by decision**: StatusBadge, `--app-*-text` tokens, PageHeader `meta`, the global tertiary text token, Badge hex colours.
- **Checks**: Baseline and after: tests 625/625 → 635/635; build passes; lint 70/88 unchanged; tsc 50 unchanged. The contrast test confirms primary and secondary text pass 4.5:1 on surface, subtle surface and page background in both themes.
- **Next action**: Owner review of the local commits; the Home page adopts the kit next.

# 2026-09-30: UI "Store Chats polish" (real Retry, no monospace names/times, header truncation)
- **Task / branch**: three targeted Store Chats fixes on `claude/ui-store-chats-polish`, branched from `origin/main` at `83f39249`. No layout redesign, no component extraction, no reply-state/KPI/API change.
- **Done**: The desktop conversation-list Retry now calls the shared `loadConversations(conversationQueryRef.current)`, so it shows the skeleton and then the list or the error. Names, times, dates and counts in the desktop list, detail header, message area, activity history and pagination footer use the app font (tabular numerals kept or added). Monospace remains only on the sidebar store code. The detail-header store and customer names truncate before the action buttons, and truncated store names carry a `title`. The mobile app had no monospace, so no Thai strings changed.
- **Checks**: Baseline and after: tests 620/620 → 625/625; build passes with an identical route table; lint 70/88 identical; tsc 50 identical. `/chats` served HTTP 200 on a local production server and rendered the expected access screen without a backend.
- **Next action**: Owner review of the local commit; do not push until asked.

# 2026-09-30: UI "Accent cleanup" (retired brand greens → accent tokens)
- **Task / branch**: replace leftover old brand greens with `--app-accent*` on `claude/ui-accent-cleanup`, branched from `origin/main` at `840c7b5c` (PR #415 merged). Frontend only.
- **Done**: Changed brand-accent uses only: focus rings, checkbox/radio accents, primary action buttons, selected/active states, action links, logo tiles, primary chart series, the follower-insights CSS modules, `manifest.ts` `theme_color`, the landing-page glow, `#00ba7c` / `#00A651` fallbacks, and the Store 360 accent override. Status greens (replied, success, connected, positive deltas), LINE-green UI (including the store-locator palette, which colours its LINE chat button) and uncertain cases were left alone. Added a rule so accent-filled non-button elements keep white text in dark mode, where `--color-white` maps to the surface color.
- **Checks**: Baseline and after: `npm run test` 614/614 → 619/619; `npm run build` passes with an identical route table; `npm run lint` 70 errors / 88 warnings, identical; `npx tsc --noEmit` 50 errors, identical. The built CSS contains every new utility and no old brand hex. Local screenshots of `/download` (light and dark), `/tiktok-integration`, `/store-locator` and the landing page.
- **Blockers / limits**: Internal pages need a backend and login, so were not viewed with data. 400px not verified locally.
- **Next action**: Owner review of the local commit; do not push until asked.

# 2026-09-30: UI PR 1 "Foundation" (font, accent, titles, top-bar titles, lang)
- **Task / branch**: `.ai-handoff/ui-style.md` Part 3 item 1 on `claude/ui-foundation`, branched from `claude/ui-handoff`. Frontend only; no backend, API, auth, or reply-state change.
- **Done**: IBM Plex Sans Thai loaded through `next/font/google` and set as the app-wide sans font (Inter removed). Accent moved to `#1f6b4a` (dark `#26805a`) with primary-button and focus tokens aligned. Accent-filled buttons now actually render white text. Internal routes get `<Page> · OPPO LINE OA Monitor` titles through `internalPageTitle`; public pages are unchanged. Download Center and Message Traffic top-bar titles now come from the route. `html lang` already follows the language toggle, so it was not changed.
- **Checks**: Baseline and after: `npm run test` 607/607 → 614/614 pass; `npm run lint` fails with the same 70 errors / 88 warnings as baseline (pre-existing; changed files lint clean); `npm run build` passes with an identical route table. A production server on port 3100 served the expected title and `lang="th"` on every internal route. Headless screenshots confirmed the font and accent in light and dark.
- **Blockers / limits**: No backend or login was available locally, so internal pages were seen only in their access-error state. Headless Chrome cannot render a true 400px viewport, so mobile layout is not verified.
- **Next action**: Owner reviews the local commit (not pushed), then PR 2 (sidebar) after the grouping decision.

# 2026-09-27: OPPO Historical Mirror final completion — canonical conflict hard stop
- **Authorization / scope**: Continued under approval `SUNN-HISTORICAL-FINAL-COMPLETION-20260927` for the existing insert-only `HistoricalTimelineMessage` backfill and required verification. Canonical, customer, operational, archive, configuration, deployment, and LINE-send mutations were outside scope.
- **Production preflight**: Authenticated Railway runner and read-only Postgres access worked. Verified the finished migration and Historical table/index/FK schema; 139 strict stores, 137 verified mappings, 2 held archives, 42,587 unique verified-archive candidates, and 0 existing Historical rows.
- **Hard stop**: The dry-run classified 1,335 exact canonical matches, 16,915 canonical source-ID payload/scope conflicts, and 24,337 candidates without a canonical source-ID match, then failed closed with `CANONICAL_SOURCE_ID_PAYLOAD_OR_SCOPE_CONFLICT`. All 16,915 conflicts differ in `sentAt`; 14,623 also differ in `lineChatUserId`. No apply was invoked and the backfill made 0 production writes.
- **Separate worker audit**: Existing `line-chat-nickname-worker` activity accounted for 60 `IMPORTED` Mirror/canonical Message pairs across 25 Conversations and 11 Stores, with 13 reply/follow-up ActivityHistory transitions. Current reply-state checks passed; no linked send jobs or auto-response executions were found. This activity was not produced by the Historical backfill.
- **Checks / artifacts**: Updated the final delivery report, `AI_PROGRESS.md`, and `DECISIONS.md` with production findings. `git diff --check` passed and the focused documentation diff was reviewed. No application code changed; no tests or deployments were run.
- **Next action / blocker**: A human must establish the correct chat/time interpretation for the 16,915 conflicts or separately approve a documented conflict-hold policy. Keep the existing fail-closed guard; then rerun only the read-only preflight/dry-run before considering any approved apply.

# 2026-09-26: W1.3A-R3 single-context safety fix
- **Task / isolation**: Closed the pre-commit profile-safety finding in the local `w1-3a-safe-target-proof` worktree, based on `87988521c602670177612528e53cf24da281b132`. No production invocation, migration, deployment, or business-data mutation occurred.
- **Implementation**: Target proof now acquires one supervisor-managed persistent context, passes that caller-owned context into recent-chat discovery, and releases it once after discovery. Normal supervisor age/operation rotation remains unchanged for work outside the in-progress proof.
- **Regression coverage**: Added age-boundary and operation-count-boundary tests. Both assert one managed acquisition, at most one raw persistent-context creation, no discovery reacquisition, identical auth/discovery context identity, one recent-list page, and one managed release. Existing auth/discovery failure cleanup, lease release, profile isolation, and sanitized-response assertions remain covered.
- **Checks**: Focused target-proof suite passed `52/52`; profile coordinator, browser lifecycle, Live Mirror, Historical Mirror, mode, and September Inventory regressions passed `208/208`. Prisma validation, backend build, touched-file ESLint, `git diff --check`, and new-file whitespace scan passed.
- **Next action / limits**: Profile-safety audit now confirms no second context acquisition path during one target-proof operation. Changes remain uncommitted and local. No production migration, endpoint invocation, LINE send, business-data write, Historical Mirror behavior change, deployment, or Wave 1 enablement occurred.

# 2026-09-26: W1.3A-R2 internal target-proof diagnostic
- **Task / isolation**: Local-only W1.3A implementation in the isolated `w1-3a-safe-target-proof` worktree, based on `87988521c602670177612528e53cf24da281b132`. No production endpoint invocation, DB migration, deployment, or business-data mutation is authorized or performed.
- **Implementation**: Added an authenticated internal target-proof route that resolves one Store/OA using the existing read-only Live Mirror selector, checks the OA's attached Profile A/B session (`account-1` for A; `profile-b` for B), and runs through the existing distributed profile coordinator and supervised session service. Added only the dedicated `TARGET_PROOF` persisted lease enum value and its one-value migration; priority is 5 below Live Mirror (25), health (50), and historical backfill (10), with all existing priorities unchanged.
- **Read scope**: Target resolution uses the existing Store/OA read path. The proof performs Manager account navigation/authentication and a maximum one-page recent chat-list read. Its response contains only assigned profile, safe auth/target metadata, first-page transport facts, count and duration; chat rows, customer identifiers/names, messages, cookies, tokens and request headers are not returned. No conversation/message/mirror/checkpoint mutation, send API or Historical Mirror path is called.
- **Checks**: Prisma validation passed; local Prisma Client generation and backend build passed; focused target-proof route/auth/coordinator-priority/chat-discovery suite passed `51/51`; coordinator/supervisor/Live Mirror/September Inventory/Historical Mirror regressions passed `142/142`; touched-file ESLint and `git diff --check` passed. Tests prove unauthenticated route calls stop before body parsing/service invocation, the real supervisor launches one persistent Chromium context for both reads, pages reset on cleanup, `TARGET_PROOF` yields to queued Live Mirror work, and only coordinator lease `ACQUIRE` / `RENEW` / `RELEASE` writes occur in the proof harness.
- **Final state**: Worktree remains local and uncommitted. No route invocation, database connection/migration, LINE send, business-data write, Historical Mirror run/change, deployment, or Wave 1 enablement occurred. Ready for the user's next separately authorized step; no commit or push is authorized here.

# 2026-09-25: P0 Live Mirror Chromium Supervisor — Pre-canary validation
- **Worktree / branch**: isolated clone `mirror-chat-chromium-p0-runtime`, branch `p0/chromium-runtime-supervisor`; primary checkout unchanged. Local changes remain uncommitted and unpushed.
- **Authoritative profile model**: exactly two physical Manager profiles: Profile A `account-1 / pinklao-pilot-v1` (~100 visible OAs) and Profile B `profile-b / RBS Chonburi` (~55). Counts may overlap and are not summed.
- **Current 16-store mapping**: 7 direct assignments (6 A, 1 B) and 9 fallback targets. The private registry maps local validation to 11 Profile A stores and 5 Profile B stores. Railway target-resolution logs show two sessions considered for each fallback; 8 had one verified candidate, while store 29039 had two candidates that resolved to the same OA bot. Its Manager-owner/local-profile distinction is recorded in `P0_CHROMIUM_RUNTIME_REPORT.md`.
- **Saved profiles**: both actual local profiles passed `/api/v1/me` with HTTP 200. Sequential read-only soak completed 16 stores × 30 cycles = 480/480 successful first-page chat-list reads. Two canonical local paths, peak two supervisors, 3 context generations, 479 reuses, one scheduled rotation, zero launch/cleanup failures, and zero contexts retained after shutdown. No message-history requests or customer content were read/reported.
- **Verification**: 17 affected Node specs passed 183/183; lifecycle spec rerun after its lint-only assertion cleanup passed 21/21; backend `npm run build` passed; ESLint for all touched TypeScript passed. `git diff --check` is being rerun after report edits. Darwin runtime telemetry correctly marks Linux `/proc` and cgroup counters `NOT_APPLICABLE`.
- **Production snapshot**: at 16:43 UTC Railway still listed the same deployment `37b7b035-f333-4d3d-9798-b83c8e8e9151` on commit `70b71191`; no newer deployment was listed. Read-only logs from 16:12:49–16:42:49 UTC showed 155 Chromium launch failures, 155 store-cycle failures, and zero completed cycles. One-hour CPU was 0.0123 current / 0.0135 average / 0.0255 max; memory was 0.513 GB current / 0.521 GB average / 0.621 GB max. Provider PID/task telemetry remains unavailable.
- **Decision**: `READY_FOR_16_STORE_CANARY` as a pre-canary gate only. The production worker remains unhealthy; no deployment, restart, variable change, mode change, fleet change, DB write, LINE send, push, merge, or commit was performed. Canary deployment still requires separate authorization.

# 2026-09-20: Rollout Readiness — Worker Restart Canary B002 [TERMINAL; ACCEPTANCE FAILED]
- **Checkpoint**: Exact tested source was checkpointed at `3d741fd8a6447c3e5fef412cc3dae588d3c63e6d` with message `test(line-chat): checkpoint restart recovery canary B002`; no functional code changed after that checkpoint before execution.
- **Execution**: On the existing `emulator-5554`, exactly one `INTERNAL WORKER RESTART B 002` send was issued to Test B. The first worker claim failed pre-send with `PROFILE_BUSY_BEFORE_SEND`; the automatic requeue then created Attempt 2 and performed the single customer-facing send. This violates the required one-attempt acceptance, so B002 is not a valid rollout pass.
- **Durable evidence**: Message `9eb79d68-1892-44e5-ae74-39051e469e39`, SendJob `afb88b6c-222c-419a-9443-98f9df5920fb`; Attempt 1 `8484f474-ba8c-4cc1-8bdb-1767aa2b31b4` is `FAILED`/`PROFILE_BUSY_BEFORE_SEND`; Attempt 2 `462b99fe-f190-4c42-a1b5-32bda88aec38` is `DELIVERED`. Final `attemptCount=2`, Message/Job/Attempt 2 share Manager ID `632572311454614080`; Manager exact-text count is `1`.
- **Recovery**: The old paused deployment `899cd4ba-73e7-4519-8e98-71864cf97056` was replaced by `e879b666-6611-4d2e-872f-be7cb1c257ee`. Lease recovery logged `line_chat_message_send_stuck_jobs_recovered` at `03:13:24Z`, and final delivery at `03:13:27Z`; no post-restart relay/send action occurred for B002. The Android bubble remained single-check at final read-only capture, so the long-poll UI convergence assertion was not proven.
- **Isolation**: Final counts were Test A `24` messages/`5` jobs, Test B `84`/`3`, Max `7`/`1`; active jobs `0`; new jobs outside authorized conversations `[]`; new Max/Test A jobs `0`.
- **Cleanup**: The temporary pause flag was deleted and the source pause hook was removed after terminal recovery. Clean worker deployment `03f70ec6-45cf-4e97-814d-e71a9e1ccba4` is `SUCCESS` and replaced the pause-enabled runtime. Live worker reports queue enabled, Store `28375`, exactly Test A + Test B allowlist, pause flag/hook absent, and old failure flag absent; backend health/readiness are `200`, and `profile-b` is `ACTIVE`/`CONNECTED` with HTTP `200`. P0 Manager-evidence guards, VERIFY_PENDING recovery, and Android long-pending reconciliation remain.
- **Status**: **STOPPED.** Do not run another customer-facing canary without explicit re-authorization and a clean pre-send profile-b state.

# 2026-09-19: P0 Production Reliability — Canary 007 UI reconciliation fix [COMPLETED; STOPPED]
- **Scope**: Fixed only the Android UI reconciliation defect after the already-completed Canary 007 backend safety path. No Retry, customer-facing send, rollout, or production release was performed.
- **Phase 1 evidence**: Left and reopened the authorized conversation, then repeated the check after installing the production-configured DEBUG APK on the existing `emulator-5554`. The fresh canonical detail load shows the stale `TEST DURABLE STALE RETRY 007` bubble absent and `TEST MANAGER FOLLOWUP 007` exactly once with `✓✓`; the known Canary 002/003/004/006 messages remain visible. Capture: `scratch/canary007_postfix_final.png`.
- **Root cause**: `_pollQueuedDelivery()` used a `DateTime.now() - 10 minutes` heuristic when a superseded target was absent from the canonical response. The valid Manager replacement was older than that arbitrary window, so the stale local bubble remained and the imported reply was not merged.
- **Fix**: Added `chat_delivery_reconciliation.dart`. Reconciliation now retains the target sentAt, removes an absent target only when the canonical response time window covers it, retains it when it is outside a limited page, merges by Message ID, deduplicates, sorts by `sentAt` then ID, and updates conversation metadata. No current-clock, text, or display-name heuristic remains. Enlarged the nested Retry InkWell to a normal accessible target without changing its visual label/icon.
- **Verification**: Focused Flutter tests passed `11/11`; full Flutter suite passed `312` tests; changed-scope `flutter analyze` reported no issues; debug APK build passed with production API configuration and was installed in place without clearing app data. The Retry widget test proves a normal center tap invokes the callback once and the target is at least 48dp high.
- **Production-state preservation**: Read-only DB verification after UI validation still shows the stale Message `FAILED`/`SUPERSEDED`/`hiddenFromTimeline=true`, SendJob `FAILED` with `attemptCount=1` and `SUPERSEDED_BY_MANAGER_REPLY`, exactly one failed DeliveryAttempt with null send evidence, and exactly one imported OUTBOUND Manager Message with external ID `line-chat-manager:632497665292370341`. Recent other jobs, other Store 28375 jobs, Max messages, and all recent jobs were `0`.
- **Status**: **STOPPED immediately after UI fix verification.** Do not tap Retry, send another message, create a production Android release, or start another canary.

# 2026-09-19: P0 Production Reliability — Canary 007 Phase D approved Retry [STOPPED; BACKEND PASSED; UI CONVERGENCE GAP]
- **Preflight**: Deployed worker `inspectOutboundActivitySince` returned `handled=true` with exactly one newer event, `TEST MANAGER FOLLOWUP 007`, Manager ID `632497665292370341`, valid timestamp `2026-09-19T14:48:10.672Z`, biz ID `2d8bddc3-0da7-48d4-ad6e-33ff3ef1f455`, and owner `OBS-Sunx2`; stale Manager text count was `0`, follow-up count `1`. Backend/worker runtime failure flags were absent, durable allowlists remained exactly Store `28375` plus the authorized conversation, and Max/other durable-job counts were `0`.
- **Execution**: Fresh screenshot located the rendered footer Retry control; exactly one tap was issued at `(890,2130)`, centered on the green refresh icon/`Retry` label. The prior missed coordinate `(850,2075)` was not reused. No second tap, manual endpoint call, rebuild, reinstall, reset, or additional customer-facing action occurred.
- **Backend evidence**: The exact retry POST was observed with HTTP `201`. Worker logs recorded `line_chat_message_retry_suppressed_by_manager_reply` for the target SendJob and Message with `importedCount=1`; no customer-facing send-action event was observed.
- **Final durable records**: Message `75f06a86-357f-4dde-96ad-6842d2bfdcc2` remains `FAILED` with `queueState=SUPERSEDED`, `hiddenFromTimeline=true`, and `supersededByManagerMessageIds=[632497665292370341]`. SendJob `be7cf2e1-823a-4e9a-9653-3abf03505fa2` remains `FAILED`, `attemptCount=1`, `lastError=SUPERSEDED_BY_MANAGER_REPLY`. DeliveryAttempt `f0ce27e3-f5b3-46bf-814f-4ed5b9ff7826` remains the sole attempt, `FAILED`, with null `sendActionAt`, `verifiedAt`, and `managerMessageId`.
- **Imported Manager record**: Exactly one production OUTBOUND Message exists for the follow-up with external ID `line-chat-manager:632497665292370341`, delivery `DELIVERED`, and the expected text/Manager ID. The final exact worker-path inspection still returned stale Manager text `0` and follow-up count `1`.
- **Isolation**: Other durable jobs `0`, other Store 28375 durable jobs `0`, and Max messages `0` in the verification window.
- **Android observation**: The final screenshot/accessibility dump did not yet converge: the stale bubble remains visible with a single check and the imported follow-up is not rendered. This is a UI refresh/convergence discrepancy after the backend-suppressed retry; no further UI action was taken.
- **Status**: **Stopped immediately after the one successful Retry invocation.** Do not retry again or broaden rollout.

# 2026-09-19: P0 Production Reliability — Canary 007 Phase D single-tap diagnosis [STOPPED; CLASSIFICATION A]
- **Execution**: On `emulator-5554`, exactly one raw coordinate tap was issued during the existing failed-bubble state. No second tap, retry endpoint invocation, rebuild, reinstall, reset, or data mutation was performed.
- **Timestamp evidence**: The exact shell timestamp of the raw `adb input tap` was not persisted. The pre-retry screenshot was captured at `22:05:51 +0700`; the unchanged post-tap screenshot was captured at `22:14:09 +0700`, so the tap occurred in that observed interval immediately before the post-tap capture.
- **Classification A — UI tap missed the nested Retry hit target**: The accessibility hierarchy exposed only the merged failed-bubble node, `content-desc="...ส่งไม่สำเร็จ\nRetry"`, `clickable=true`, bounds `[32,1967][1049,2177]`; it did not expose a separate nested Retry InkWell. Source inspection confirms the actual Retry control is a small footer `InkWell` with its own child padding inside the bubble, not the full bubble rectangle. The unchanged screenshot still shows the failed bubble and Retry control.
- **Android evidence**: The app process had no `retry_ui_tapped`, `_retryPersistedMessage`, ApiClient POST, ApiException, or retry-network log entries in the `22:14 +0700` minute. The current source has no such runtime instrumentation, so this is absence-of-event evidence rather than a positive callback trace.
- **Backend evidence**: Railway HTTP logs for `15:12:00Z`–`15:16:00Z` contain no POST to `/mobile/conversations/a04560a5-8658-493b-9b18-c992adc2b683/messages/75f06a86-357f-4dde-96ad-6842d2bfdcc2/retry`; backend application logs also contain no target retry/error marker. The only HTTP event in the window was an unrelated LINE webhook.
- **Installed build evidence**: Package `click.lineoppo.chat` is a debuggable `1.1.33+53` build (`versionCode=53`), and the pulled installed APK SHA-256 exactly matches `android_app/build/app/outputs/flutter-apk/app-debug.apk`. Its Flutter snapshot contains `_retryPersistedMessage`, `retryFailedMessage`, and `/mobile/conversations/.../messages/.../retry`.
- **State preservation**: Message `75f06a86-357f-4dde-96ad-6842d2bfdcc2`, SendJob `be7cf2e1-823a-4e9a-9653-3abf03505fa2`, and the sole DeliveryAttempt remain unchanged (`FAILED`, `attemptCount=1`, no Attempt 2, no supersession, no send action, no imported Manager reply). No customer-facing send occurred.
- **Status**: **Stopped after read-only diagnosis.** Do not tap Retry again without explicit approval and a retargeted control coordinate or instrumentation build.

# 2026-09-19: P0 Production Reliability — Canary 007 Phase D precheck [READY; RETRY NOT TAPPED]
- **Current Task**: Validate the deployed Retry precheck for stale Message `75f06a86-357f-4dde-96ad-6842d2bfdcc2`; do not tap Retry until separately authorized.
- **Exact worker diagnostic**: Invoked the deployed `LineChatManagerMessageRelayWorkerService.inspectOutboundActivitySince` through a separate `NODE_ENV=test` Nest application context, using conversation `a04560a5-8658-493b-9b18-c992adc2b683` and stale timestamp `2026-09-19T13:43:52.770Z`. Result: `handled=true`; exactly one event; text `TEST MANAGER FOLLOWUP 007`; `managerMessageId=632497665292370341`; `sentAt=2026-09-19T14:48:10.672Z`; `bizId=2d8bddc3-0da7-48d4-ad6e-33ff3ef1f455`; `ownerName=OBS-Sunx2`. The stale text was absent.
- **Post-diagnostic preservation**: SendJob remains `FAILED`, `attemptCount=1`, and `managerMessageId=null`; the only DeliveryAttempt remains `FAILED` with `sendActionAt=null`, `verifiedAt=null`, and `managerMessageId=null`. No customer-facing send action, new durable job, Max traffic, or other-conversation job occurred.
- **Status**: **READY for explicit Retry approval.** No Retry was tapped.

# 2026-09-19: P0 Production Reliability — Canary 007 Phase B [COMPLETED & STOPPED]
- **Current Task**: Execute the approved manual human-staff follow-up in the verified LINE OA Manager conversation only; do not tap Retry or create a durable queue job.
- **Execution**: Reopened the canonical Manager route from the black-app mapping, verified OA `OPPO BS RBS Chonburi` (`@673lcfmk`), direct bot/user URL, and customer `OBS-Sunx2`. Sent exactly one Manager message `TEST MANAGER FOLLOWUP 007` at the UI time `21:48`; Manager event ID/data-id is `632497665292370341`.
- **Manager evidence**: Exact follow-up count is `1`; exact stale text `TEST DURABLE STALE RETRY 007` count is `0`. The direct Manager reply did not create a production Message or LineChatMessageSendJob row.
- **Durable audit preservation**: Stale Message `75f06a86-357f-4dde-96ad-6842d2bfdcc2` remains `FAILED`; stale SendJob `be7cf2e1-823a-4e9a-9653-3abf03505fa2` remains `FAILED` with `attemptCount=1` and null Manager ID; Attempt `f0ce27e3-f5b3-46bf-814f-4ed5b9ff7826` remains `FAILED` with `sendActionAt=null`, `verifiedAt=null`, and `managerMessageId=null`.
- **Isolation/runtime**: In the final verification window, Max messages/jobs were `0`, other Store 28375 jobs were `0`, all other durable jobs were `0`, and both backend and worker runtime diagnostics reported the temporary failure flag absent. No Retry was tapped and no durable queue action was performed.
- **Status**: **STOPPED immediately after Canary 007 Phase B evidence.** Do not proceed to the Retry/superseded canary without a new explicit authorization.

# 2026-09-19: P0 Production Reliability — Canary 007 Phase A [PAUSED BEFORE RETRY]
- **Current Task**: Canary 007 stale-failed-message / staff-already-replied safety test for Store `28375`, conversation `a04560a5-8658-493b-9b18-c992adc2b683`; no Max or other customer traffic.
- **Source/deployment**: The pre-send gate now requires the explicit enabled flag, the authorized store/conversation, and the exact configured `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_TEXT`. Focused tests passed `54/54`, changed-file lint passed, and backend build passed. Backend and worker were redeployed; health/readiness checks returned 200.
- **Phase A**: With temporary variables enabled only for the authorized services, exactly one `TEST DURABLE STALE RETRY 007` message was sent from `emulator-5554`. Message `75f06a86-357f-4dde-96ad-6842d2bfdcc2` is `FAILED`; SendJob `be7cf2e1-823a-4e9a-9653-3abf03505fa2` is `FAILED`, `attemptCount=1`; Attempt `f0ce27e3-f5b3-46bf-814f-4ed5b9ff7826` is `FAILED` with `sendActionAt=null`, `verifiedAt=null`, and `managerMessageId=null`. Manager stale-text count remains `0`.
- **Failure evidence**: Worker logs show `line_chat_manager_test_controlled_pre_send_failure` followed by `line_chat_message_send_failed`, with no send-action or delivery event. Failed bubble capture: `scratch/canary007_failed_before_retry.png`.
- **Cleanup/pre-Retry state**: Both temporary variables were deleted. Fresh backend and worker runtimes report both failure keys absent; backend readiness and worker health remain 200. Allowlists remain exactly Store `28375` plus the authorized conversation. Final pre-Retry read-only isolation counts are other jobs `0`, other Store 28375 jobs `0`, and Max messages `0`; follow-up text count is `0`.
- **Blocker**: The authenticated `chat.line.biz` session is Business ID `Sunn-OBS`, whose account search has no authorized `OPPO BS RBS Chonburi` account (the target OA basic ID is `@673lcfmk`). No human follow-up was sent, and Retry was not tapped. Awaiting the authorized Manager account/session before Phase B.
- **Status**: **STOPPED before Retry due to missing authorized Manager account access.**

# 2026-09-19: P0 Production Reliability — Post-fix normal send Canary 006 [COMPLETED & STOPPED]
- **Current Task**: Execute one authorized post-fix production canary for `OBS-Sunx2` only; stop before the superseded/staff-already-replied canary.
- **Preflight**: Existing `emulator-5554` was confirmed as `device`; backend health/readiness and worker health returned HTTP 200. Durable queue allowlists remained restricted to store `28375` and conversation `a04560a5-8658-493b-9b18-c992adc2b683`; the temporary failure flag was absent from both configuration listings and the newly running worker runtime. Manager exact-text count for `TEST DURABLE POST FIX 006` was `0`; other jobs, other Store 28375 jobs, and Max messages were `0` in the baseline window. Conversation was `REPLIED / COMPLETED` as allowed.
- **Execution**: Entered exactly `TEST DURABLE POST FIX 006` in the existing authorized conversation and tapped the existing Send reply control exactly once. No production Android release, emulator reset, reinstall, logout, retry, Max traffic, or other customer action was performed. The separate PENDING bubble was not observable because delivery completed quickly; the immediate post-tap screenshot was preserved without inferring PENDING from it.
- **Final records**: Exactly one new Message `208af776-03c6-4d5a-b4de-7d4ed217df78`, one SendJob `d2cdb3d6-fdc9-451d-8996-5fa0a8c3b7ca`, and one DeliveryAttempt `7c7784bd-13e5-40ec-a30a-e724435193e1`. All are `DELIVERED`; SendJob `attemptCount=1`; attempt has `sendActionAt` and `verifiedAt` populated. Message raw payload, SendJob, and Attempt all contain the same non-empty Manager ID `632489361610899493`.
- **Manager/UI evidence**: Read-only Manager history returned exactly one matching event for owner `OBS-Sunx2`, with ID `632489361610899493` and sent time `2026-09-19T13:25:41.328Z`. Final emulator UI shows the new bubble with `✓✓`. Captures: `scratch/canary006_pre_send.png`, `scratch/canary006_pending.png`, and `scratch/canary006_final.png`.
- **Worker/isolation evidence**: Worker logs show exactly one target `line_chat_manager_send_action` for store `28375`, followed by the target relay success and `line_chat_message_send_delivered` with the same Manager ID. Final read-only isolation counts: other durable jobs `0`, other Store 28375 jobs `0`, Max messages `0`; exact Manager/DB text count is `1` with no duplicate.
- **Status**: **STOPPED immediately after Canary 006 completed successfully.** No superseded/staff-already-replied canary was initiated.

# 2026-09-19: P0 Durable LINE Manager send queue false-delivery fix [COMPLETED; STOPPED]
- **Current Task**: Stop customer-facing retry testing after Canary 005 exposed a false `DELIVERED` state, make Manager delivery evidence mandatory, reconcile the existing audit record, deploy, and stop before the superseded/staff-already-replied canary.
- **Root Cause**: `line-chat-manager-message-relay-worker.service.ts` treated outbound-count/composer-cleared UI evidence as delivery, and the durable worker called `markDelivered` with a null Manager message ID.
- **Fix**: Manager text relay now accepts delivery only from a concrete exact `messageSent` history event with `managerMessageId`, `managerSentAt`, and `verificationSource=MANAGER_API`. The queue rejects missing/blank evidence, keeps post-action ambiguity in `VERIFY_PENDING` without auto-resend, and `markDelivered` has runtime ID/timestamp assertions. Regression tests cover no-ID pending, no-resend verification, shared IDs, and blank-ID rejection.
- **Pre-deploy verification**: Fresh read-only Manager history found one delayed exact event for the target text: ID `632482851078275382`, sent at `2026-09-19T12:21:00.768Z`, owner `OBS-Sunx2`. No retry or send was performed during repair.
- **Audit reconciliation**: Existing Message `383507ef-443c-49b3-8515-ba14370699b2`, SendJob `9bafb963-bd63-4d03-828e-e576665a18ac`, and Attempt 3 were preserved as `DELIVERED` and updated with the same concrete Manager ID/timestamp. Attempts 1 and 2 remain unchanged `FAILED` with `sendActionAt=null` and `managerMessageId=null`; `attemptCount=3`; exact DB text count is `1`.
- **Deployment and runtime**: Backend deployment `039292c0-a13a-4a07-b50d-5d317a507cbd` and worker deployment `5b0026fb-19b3-465c-b75c-13c34f45a2c4` are `SUCCESS`; prior containers were removed. Backend health/readiness and worker health returned 200. New backend and worker runtime diagnostics both reported `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED` present `false`; worker startup was normal.
- **Checks**: Backend build passed. Focused LINE durable queue/Manager relay/nickname worker suite passed `53/53`; changed-file ESLint passed. Repository-wide ESLint remains an existing baseline failure (`731` unrelated diagnostics outside the changed files). Final Manager history still has exactly one matching event; other jobs, other Store 28375 jobs, and Max messages are `0`. Refresh screenshot: `scratch/canary_005_reconciled_refresh_loaded.png`.
- **Status**: **STOPPED.** No further Retry tap, no customer-facing send during repair/deployment, and no superseded/staff-already-replied canary was initiated.

# 2026-09-19: P0 Production Reliability — Manual Retry Canary 005 [COMPLETED; ACCEPTANCE FAILED; STOPPED]
- **Current Task**: Execute the explicitly approved next retry for the existing failed `TEST DURABLE PRE-SEND FAIL 004` Message in `OBS-Sunx2`; stop immediately after verification and do not run the superseded-retry canary.
- **Pre-flight and Execution**:
  - `emulator-5554` was the only device and remained unchanged; no reinstall, reset, logout, or new message composition occurred.
  - Final preflight passed: Manager exact-text count `0`, no newer human staff outbound, durable allowlists unchanged, runtime failure flag absent from both backend and worker PID 1 environments, Max untouched, and Attempts 1–2 preserved.
  - Captured `scratch/canary_005_attempt3_pre_retry.png` before the tap and `scratch/canary_005_attempt3_after_tap.png` during the one-check pending state.
  - Exactly one effective Retry tap was issued on the existing failed bubble; no second Message row was created.
- **Final Records**:
  - Same Message ID `383507ef-443c-49b3-8515-ba14370699b2`; `deliveryStatus=DELIVERED`, queue state `DELIVERED`, exact text row count `1`.
  - Same SendJob ID `9bafb963-bd63-4d03-828e-e576665a18ac`; `status=DELIVERED`, `attemptCount=3`, `managerMessageId=null`.
  - Attempt 1: `FAILED`, controlled Canary 004 failure, `sendActionAt=null`, `managerMessageId=null`.
  - Attempt 2: `FAILED`, stale-runtime Canary 005 failure, `sendActionAt=null`, `managerMessageId=null`.
  - Attempt 3: `DELIVERED`, `sendActionAt` populated, `managerMessageId=null`.
  - Final UI screenshot `scratch/canary_005_attempt3_final.png` still shows one check (`✓`), not `✓✓`.
- **Manager and Isolation Evidence**:
  - Execution-window worker logs show exactly one `line_chat_manager_send_action` at `12:21:00Z`, followed by `line_chat_message_send_delivered` for the target at `12:21:06Z`; the delivery log also reports `managerMessageId=null`.
  - Final read-only Manager inspection returned `exactTextCount=0` and no matching event; required exact-text count `1` and persisted Manager ID were not achieved.
  - During the Retry execution window, other durable jobs `0`, other-conversation messages `0`, and Max messages `0`.
- **Status**: **STOPPED immediately after Canary 005 completed with acceptance failure.** No further Retry, source change, audit-row rewrite, or superseded/staff-already-replied canary was initiated.

# 2026-09-19: P0 Production Reliability — Canary 005 Runtime Refresh [READY; RETRY NOT TAPPED]
- **Current Task**: Refresh the backend and worker runtimes after Canary 005 exposed stale process configuration; do not retry until separately authorized.
- **Configuration and Deployment**:
  - Railway configuration was rechecked on both `line-unified-inbox` and `line-chat-nickname-worker`; `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED` is absent.
  - Fresh redeploys completed successfully: backend deployment `331e98b2-1792-4951-9379-0946fc010bc7`, worker deployment `ccd0b0af-a26d-4e7b-bffe-b895b742d692`.
  - Previous backend and worker deployments were replaced; new instances are running.
  - No source code was changed for the runtime refresh.
- **Runtime Evidence**:
  - Backend `/health` returned HTTP 200 `healthy`; `/health/readiness` returned HTTP 200 `ready`.
  - Worker status is `RUNNING`; startup logs recorded `line_chat_nickname_worker_started` and `line_chat_message_send_worker_started` with no startup error.
  - PID 1 environment diagnostics in both newly deployed containers reported `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED present=false` and did not print unrelated environment values.
- **Post-refresh Read-only Preflight**:
  - Durable queue allowlists remain enabled only for store `28375` and the authorized OBS-Sunx2 conversation; Max and other conversations remain outside the allowlist.
  - Manager exact-text count remains `0`; no newer human staff outbound exists.
  - Historical Message and SendJob remain unchanged with `attemptCount=2`; Attempt 1 and Attempt 2 are both `FAILED`, each with `sendActionAt=null` and `managerMessageId=null`.
  - Max messages, other SendJobs, and other Store 28375 SendJobs in the verification window are all `0`.
  - Conversation remains `REPLIED / COMPLETED`.
- **Status**: **READY for explicit approval of the next retry.** No Retry tap or customer-facing send was performed after the runtime refresh.

# 2026-09-19: P0 Production Reliability — Manual Retry Canary 005 [FAILED CLOSED & STOPPED]
- **Current Task**: Execute the authorized single retry of `TEST DURABLE PRE-SEND FAIL 004` for `OBS-Sunx2` only, using the existing `emulator-5554`; stop immediately after Canary 005.
- **Device and Pre-flight**:
  - `adb devices` confirmed exactly `emulator-5554 device`; no emulator was created, booted, reset, reinstalled, cleared, or logged out.
  - Backend and worker allowlists were unchanged and restricted to store `28375` and the authorized conversation.
  - Current Railway variable listings showed `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED` absent on both services.
  - Pre-retry baseline was `bmReplyStatus=REPLIED`, `followUpStatus=COMPLETED`; target Message and SendJob were the existing failed records; exact Manager-history count was `0`; no newer human staff outbound existed; isolation counts for other SendJobs, other Store 28375 SendJobs, and Max messages were all `0`.
- **Execution**:
  - Captured `scratch/canary_005_pre_retry.png` with the existing failed bubble and Retry control.
  - The first coordinate did not hit the nested Retry button and left the database unchanged. One subsequent tap hit the Retry button exactly once; it was the only accepted retry request.
  - The bubble briefly moved to the non-failed one-check state, then the durable worker created Attempt 2 and failed it before send action.
- **Final Verification**:
  - Same Message ID `383507ef-443c-49b3-8515-ba14370699b2`; exact text row count remained `1`.
  - Same SendJob ID `9bafb963-bd63-4d03-828e-e576665a18ac`; `attemptCount=2`, final status `FAILED`, `managerMessageId=null`.
  - Attempt 1 remained `FAILED` with `sendActionAt=null`; Attempt 2 was `FAILED` with `sendActionAt=null` and `managerMessageId=null`.
  - Manager history remained `exactTextCount=0`; no newer human staff outbound; other SendJobs, other Store 28375 SendJobs, and Max messages remained `0`.
  - Conversation remained `REPLIED / COMPLETED`, consistent with the corrected acceptance criteria.
  - Worker logs recorded `line_chat_manager_test_controlled_pre_send_failure` and no customer-facing send-action or delivery event.
- **Root Cause**: Read-only runtime inspection showed both the backend and worker processes still had `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED=true`, despite the current Railway variable listings reporting the key absent. This runtime/configuration drift caused Attempt 2 to fail closed before `sendActionAt`.
- **Status**: **STOPPED immediately after Canary 005 failed closed.** No additional retry, superseded-retry canary, production Android release, or Max/customer traffic was initiated.

# 2026-09-19: P0 Production Reliability — Manual Retry Canary 005 [STOPPED ON HANDOFF DISCREPANCY]
- **Current Task**: Pre-flight the authorized manual retry of `TEST DURABLE PRE-SEND FAIL 004` for `OBS-Sunx2` only; stop before retry if live state differs from the handoff.
- **Pre-flight Completed at 18:28 Bangkok**:
  - Backend and worker production deployments are both `b98b051f` (`fix(line-chat): fix sendActionAt semantics, neutralize canary 003, and add canary 004 pre-send failure gate`); active instances are running.
  - Backend and worker durable queue configuration is exactly restricted to `enabled=true`, store `28375`, conversation `a04560a5-8658-493b-9b18-c992adc2b683`.
  - `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED` is absent from both services.
  - Target Message `383507ef-443c-49b3-8515-ba14370699b2` is `FAILED`; target SendJob `9bafb963-bd63-4d03-828e-e576665a18ac` is `FAILED`, `attemptCount=1`; Attempt 1 is `FAILED` with `sendActionAt=null` and `managerMessageId=null`.
  - Production read-only LINE Manager history precheck returned `exactTextCount=0` for `TEST DURABLE PRE-SEND FAIL 004` and no outbound events after the failed message timestamp.
  - No newer human staff outbound exists in the target conversation; other Store 28375 conversations have `0` SendJobs in the last 15 minutes; Max has `0` messages in the last 15 minutes.
- **Blocking Discrepancy**: Live target conversation reports `bmReplyStatus=REPLIED` and `followUpStatus=COMPLETED`, while the handoff says Canary 004 did not update the conversation to `REPLIED`.
- **Status**: **STOPPED before tapping Retry**. No customer-facing send, no retry attempt, and no Manager mutation performed. Awaiting clarification/reconciliation of the conversation status discrepancy.

# 2026-09-19: P0 Production Reliability — Known Pre-Send Failure Canary (TEST DURABLE PRE-SEND FAIL 004) [COMPLETED & VERIFIED]
- **Current Task**: Prepare and execute controlled known pre-send failure canary test (`TEST DURABLE PRE-SEND FAIL 004`) exclusively on test conversation `OBS-Sunx2` in Store 28375 (`a04560a5-8658-493b-9b18-c992adc2b683`).
- **Canary Execution & Checkpoint Evidence**:
  - **Android Bubble State**: Captured screenshot (`canary_004_failed_bubble.png`) at `18:19`.
    - Exactly one outbound bubble rendered.
    - Transitions to `FAILED`.
    - Displays: `! ส่งไม่สำเร็จ` in error red and `↻ Retry` action button.
    - Conversation `bmReplyStatus` did NOT update to REPLIED as a result of this send.
  - **Message Row**:
    - ID: `383507ef-443c-49b3-8515-ba14370699b2`
    - `deliveryStatus`: `FAILED`
    - `rawPayload.queueState`: `"FAILED"`
    - `rawPayload.error`: `"CONTROLLED_CANARY_PRE_SEND_FAILURE: simulated pre-send failure for canary 004"`
    - `sentAt`: `2026-09-19T11:19:11.338Z`
  - **SendJob Row**:
    - ID: `9bafb963-bd63-4d03-828e-e576665a18ac`
    - `status`: `FAILED`
    - `attemptCount`: `1`
    - `verifyAttemptCount`: `0`
    - `managerMessageId`: `null`
    - `lastError`: `"CONTROLLED_CANARY_PRE_SEND_FAILURE: simulated pre-send failure for canary 004"`
  - **DeliveryAttempt Row**:
    - ID: `d9cb31df-8b3c-47d0-8c42-22db7cb71280`
    - `attemptNo`: `1`
    - `status`: `FAILED`
    - `startedAt`: `2026-09-19T11:19:11.674Z` (populated)
    - `sendActionAt`: `null` (VERIFIED NULL on pre-send failure)
    - `managerMessageId`: `null` (VERIFIED NULL)
    - `failureReason`: `"CONTROLLED_CANARY_PRE_SEND_FAILURE: simulated pre-send failure for canary 004"`
  - **Worker Egress & Send Actions**:
    - Line 11:19:11 AM: Logged `line_chat_manager_test_controlled_pre_send_failure` followed by `line_chat_message_send_failed`.
    - Customer-facing Manager send actions: Exactly `0`.
  - **LINE Manager Exact Match Count**:
    - `TEST DURABLE PRE-SEND FAIL 004` exact-match count = `0`.
  - **Isolation**:
    - Zero SendJobs created for other conversations during the window (`otherSendJobsCount: 0`).
    - Zero messages sent to Max (`maxMessagesCountInLast15Minutes: 0`).
  - **Temporary Failure Flag Teardown**:
    - `LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED` deleted from both `line-chat-nickname-worker` and `line-unified-inbox`.
- **Status**: STOPPED immediately. Did NOT tap Retry. Awaiting approval for test 005.

# 2026-09-19: P0 Production Reliability — Verification-Delay Safety Canary (TEST DURABLE VERIFY DELAY 003) [COMPLETED & VERIFIED]
- **Current Task**: Execute controlled verification-delay canary test (`TEST DURABLE VERIFY DELAY 003`) exclusively on test conversation `OBS-Sunx2` in Store 28375 (`a04560a5-8658-493b-9b18-c992adc2b683`).
- **Goal**: Prove that when a customer-facing send action has physically completed but verification is temporarily delayed/unavailable, the system NEVER blindly resends the message.
- **Canary Execution & Checkpoint Evidence**:
  - **Android Single Checkmark (✓)**: Captured at `17:51` during `VERIFY_PENDING` (`scratch/emulator_check_pending_003.png`).
  - **Message Row**:
    - ID: `aba6b2bd-9dba-48ea-aaf3-1748451784b2`
    - Initial `deliveryStatus`: `PENDING` (with `queueState: "VERIFY_PENDING"`, `lastSendError: "TEST_SIMULATED_VERIFY_DELAY: initial post-send verification unavailable"`)
    - Final `deliveryStatus`: `DELIVERED`
    - Stored `managerMessageId`: `632473869696892998`
    - `sentAt`: `2026-09-19T10:51:47.337Z`
  - **SendJob Row**:
    - ID: `64567ab4-f282-495a-87a4-1921519a0474`
    - Final `status`: `DELIVERED`
    - `attemptCount`: `1` (strictly 1 customer-facing send attempt)
    - `verifyAttemptCount`: `1` (demonstrates transition through `VERIFY_PENDING` retry)
    - Stored `managerMessageId`: `632473869696892998`
    - `completedAt`: `2026-09-19T10:52:09.560Z`
  - **DeliveryAttempt Row**:
    - ID: `decce2fe-0c3a-4ea6-a750-9c4a89ac6ecd`
    - `attemptNo`: `1`
    - Final `status`: `DELIVERED`
    - `verifiedAt`: `2026-09-19T10:51:47.337Z`
    - `managerMessageId`: `632473869696892998`
  - **Worker Logs Verification**:
    - Line 10:51:47 AM: Exactly ONE `line_chat_manager_send_action` (`action: "SEND_BUTTON"`).
    - Line 10:51:48 AM: `line_chat_manager_test_simulated_verify_delay` triggered `VERIFY_PENDING`.
    - Line 10:51:56 AM: `line_chat_manager_test_simulated_verify_retry_in_progress` (attempt 1 read-only check failed with delay). NO second send action.
    - Line 10:52:09 AM: `line_chat_message_send_delivered` with `managerMessageId: "632473869696892998"`. NO second send action.
  - **Android Double Checkmark (✓✓)**: Captured at `17:52` (`scratch/emulator_delivered_check_003.png`), single bubble updated in place with `Replied` badge.
  - **Conversation Status**: `bmReplyStatus: REPLIED`, `followUpStatus: COMPLETED`, `latestMessageAt: 2026-09-19T10:51:47.337Z`.
  - **Manager Message History Exact-Match Count**: Exactly 1 (no duplicate copy in LINE Manager).
  - **Other Conversations & Max**: Zero traffic (`otherSendJobsCount: 0`, `maxMessagesCountInLast15Minutes: 0`).
- **Status**: STOPPED immediately as instructed. No other test messages sent. No production Android release created. Max permanently untouched.

# 2026-09-19: P0 Production Reliability — Durable Queue Canary Normal Send (TEST DURABLE QUEUE 002) [COMPLETED & VERIFIED]
- **Current Task**: Execute single normal canary send (`TEST DURABLE QUEUE 002`) exclusively on test conversation `OBS-Sunx2` in Store 28375 (`a04560a5-8658-493b-9b18-c992adc2b683`) after deploying the mandatory conversation allowlist.
- **Canary Pre-Flight Check Results**:
  - `OBS-Sunx2` (`a04560a5-8658-493b-9b18-c992adc2b683`): **ACCEPTED** (`isAccepted: true`)
  - `Max` (`9cf223e4-194a-47ce-b795-1192a22d3928`): **REJECTED** (`isAccepted: false`)
  - Random Store 28375 conversation (`046cf201-bce9-4525-a9a1-6d509e59da92`): **REJECTED** (`isAccepted: false`)
  - Other store conversation (`4f66eeb4-1b93-469c-bc0a-086fb97cc89a`, store 28799): **REJECTED** (`isAccepted: false`)
- **Canary Execution & Checkpoints (TEST DURABLE QUEUE 002)**:
  - Sent via Android Studio Emulator (`emulator-5554`) in `OBS-Sunx2` conversation only.
  - **One outgoing bubble only**: Confirmed (0 duplicate bubbles).
  - **PENDING shows ✓**: Captured screenshot showing single checkmark (`✓`) at `17:31`.
  - **Exactly one Message**: Confirmed in DB (`id: 4284ea67-4528-490a-a04e-57a543d102c7`).
  - **Exactly one SendJob**: Confirmed in DB (`id: 37193692-1919-47fe-8360-6ffcad8bc4d2`, `status: DELIVERED`, `attemptCount: 1`).
  - **Exactly one initial DeliveryAttempt**: Confirmed in DB (`id: 793168f0-e7b4-4296-8445-50ef186a7c84`, `attemptNo: 1`, `status: DELIVERED`).
  - **Exactly one customer-facing Manager send**: Relayed through `LineChatMessageSendWorkerService` and confirmed delivered at `2026-09-19T10:32:06.906Z`.
  - **Exact text in LINE Manager**: Confirmed `TEST DURABLE QUEUE 002`.
  - **Message becomes DELIVERED**: Database `deliveryStatus` updated to `DELIVERED`.
  - **Same bubble changes to ✓✓**: Polling updated same bubble in-place to double checkmark (`✓✓`) at `17:32`.
  - **Conversation becomes REPLIED**: Verified `bmReplyStatus: REPLIED`.
  - **Zero touch on other conversations**: Verified `otherSendJobsCount: 0`, `maxMessagesCountInLast10Minutes: 0`.
- **Status**: STOPPED immediately as instructed. No retry/failure tests run. No production Android release created. Max permanently untouched.

# 2026-09-18: TikTok Public Account Store Auto-Binding Recurrence Hardening [COMPLETED & VERIFIED]
- **Current Task**: Harden `TikTokPublicAccount` → `StoreMaster` auto-binding so shared TikTok handles are linked to all matching active stores, preventing recurrence of unlinked store records.
- **Completed Work**:
  - **Hardened Collector Binding**: In `backend/scripts/tiktok-public/run-daily-collector.mjs`, expanded the StoreMaster mapping `where` clause to include `externalStoreId: { in: storeIds }` as well as active stores matching canonical (`target.username`) and `@`-prefixed handles (`@${target.username}`) case-insensitively.
  - **Hardened Single-Store Persistence**: In `backend/src/tiktok/tiktok-public-analytics.service.ts` (`persistExactSnapshot`), replaced single-store `update` with `updateMany` matching `store.id` and all active stores matching canonical and `@`-prefixed handles.
  - **Exclusion of Non-Existent Accounts**: Verified that non-existent profiles (`PROFILE_NOT_FOUND`, e.g., `oppo_kamthieng01`) remain unbound with zero placeholder accounts or database mutations.
  - **Added Comprehensive Regression Tests**: Added unit tests in `tokcounter-collector.spec.ts` and `tiktok-public-analytics.service.spec.ts` covering shared store binding, case-insensitivity, `@` prefix handling, idempotency, and exclusion of non-existent profiles.
- **Checks Run & Passed**:
  - TikTok spec tests: 80 / 80 PASS (`npx tsx --test src/tiktok/*.spec.ts`).
  - Frontend test suite: 591 / 591 PASS (`npm test` in frontend).
  - Backend production build: `prisma generate && nest build` passed cleanly.
  - Frontend production build: `next build` passed cleanly (44 static/dynamic routes).
- **Next Action**: Commit changes locally with message `fix(tiktok): bind shared public accounts to all matching stores`.

# 2026-09-17: LINE Chat Durable Manual Mapping & Outbound Recovery Production Rollout [COMPLETED & VERIFIED]
- **Current Task**: Safely commit, push, deploy the completed manual mapping implementation, apply the production Prisma migration, validate the RBS Chonburi / Max pilot case (`RESOLVE_AMBIGUOUS`), and verify outbound message recovery.
- **Completed Work**:
  - **Production Commits Pushed**:
    - `e61c6f9`: `feat(line-chat): add durable manual identity mapping and outbound message recovery`
    - `0ecb5f8`: `fix(line-chat): relay candidate discovery to nickname worker with persistent profile`
    - `daf3613`: `fix(line-chat): align manual mapping payload with backend DTO and add field fallbacks`
  - **Production Prisma Migration**:
    - Verified migration baseline and applied `20260917160000_add_line_chat_manual_mapping_and_delivery_status` to production Postgres.
    - Verified new schema columns in `information_schema`:
      - `Conversation`: `lineChatMappingSource`, `lineChatMappedAt`, `lineChatMappedById`.
      - `Message`: `deliveryStatus` (default: `'DELIVERED'`).
  - **Railway Deployments & Health**:
    - Backend `line-unified-inbox`, worker `line-chat-nickname-worker`, and `frontend` deployed and verified healthy (`/health` = 200, `/health/readiness` = 200, `https://lineoppo.click` = 200).
  - **RBS Chonburi / Max Pilot Validation**:
    - Located conversation `9cf223e4-194a-47ce-b795-1192a22d3928` (Store `28375`, customer Max) in Waiting for mapping backlog.
    - Verified inbound messages (18:58 Bangkok "OPPO reno 16 ผ่อนต้องใช้อะไรบ้างครับ", 18:59 Bangkok "ขอข้อมูลการดาวน์หน่อยครับ").
    - Relayed candidate discovery to persistent worker profile; discovered 125 candidate chats.
    - Identified Candidate 1 (`Uabf5b5217d6f288057b2a0046622a510`) with `lastMessageAt: 2026-09-16T11:59:38.161Z` matching inbound timestamp to the millisecond.
    - Successfully confirmed manual mapping via `POST /operations/line-chat-nickname/conversations/9cf223e4-194a-47ce-b795-1192a22d3928/manual-map`.
    - Verified persistence: `Conversation.lineChatUserId = "Uabf5b5217d6f288057b2a0046622a510"`, `lineChatMappingSource = "MANUAL"`, `lineChatMappedAt = "2026-09-17T08:59:52.512Z"`, `ActivityHistory` audit trail recorded.
    - Verified backlog count: Max disappeared from Waiting for mapping (count dropped from 141 to 140).
    - Verified nickname job `88804c3c-8568-4e6b-af82-bf68084dd284` automatically consumed durable ID and processed with `status: SUCCESS` (`nickname: TikTok 09/26`).
  - **Legacy Outbound Attempt & Controlled Test Sends**:
    - Checked DB for legacy failed Max message: confirmed `0` records with `deliveryStatus: FAILED`. Reported: *"Legacy failed attempt was not persisted under the old behavior."*
    - Sent controlled test message 1 (`7592d7ac-c3a9-4ece-a5ee-550a29006184`): delivered with HTTP 200, `deliveryStatus: DELIVERED`, `bmReplyStatus: REPLIED`, zero `RESOLVE_AMBIGUOUS`.
    - Sent controlled test message 2 (`97807b85-4039-4963-bb8c-ccde6ba1fe57`): delivered with HTTP 200, reused durable mapping directly.
- **Checks Run & Passed**:
  - Database schema: 142 Prisma migrations verified.
  - Manual mapping spec: 7/7 passed (`line-chat-manual-mapping.spec.ts`).
  - Conversations service spec: 34/34 passed (`conversations.service.spec.ts`).
  - Frontend production build: `next build` succeeded with all 44 routes.
  - Backend production build: `prisma generate && nest build` succeeded with 0 errors.
  - Production live validation: 100% passed on live Railway environment.
- **Next Action**: Output final 11-point deployment and verification report to user.


# 2026-09-17: TikTok Analytics Production Deployment & Verification [COMPLETED & VERIFIED]
- **Current Task**: Deploy TikTok Analytics live data dashboard and single-store analytics to production, verify live backend and frontend endpoints, conduct smoke tests, and confirm zero regression.
- **Completed Work**:
  - **Timestamp Semantics Fix**: Separated business snapshot metric date (`latestMetricDate: "2026-09-16"`) from pipeline collection timestamp (`lastUpdatedAt: "2026-09-17T03:41:18.550Z"`). Implemented dedicated Bangkok timezone formatting rendering `"Data for 16 Sep 2026 · Updated 17 Sep 2026, 10:41"` (Thai: `"ข้อมูล ณ วันที่ 16 ก.ย. 2569 · อัปเดต 17 ก.ย. 2569 10:41"`). Grounded strictly in database timestamps without deriving from browser clock.
  - **Rebased & Pushed**: Rebased cleanly over `origin/main` without merge commits; pushed commit `520d07a` to `origin/main`.
  - **Railway Production Build & Deploy**: Both `frontend` (`https://lineoppo.click`) and `line-unified-inbox` (`https://line-unified-inbox-production-544f.up.railway.app`) compiled cleanly and transitioned to `● Online`.
  - **Production Smoke Verification**:
    - Backend Overview (`GET /tiktok/public/overview`): HTTP 200, 148 tracked stores, 945,058 followers, 9,410,380 likes, 25,692 videos, `latestMetricDate: "2026-09-16"`, `lastUpdatedAt: "2026-09-17T03:41:18.550Z"`.
    - Backend Stores (`GET /tiktok/public/stores`): HTTP 200, exactly 148 active store records returned with correct sorting and growth structures.
    - Single-Store Detail & History (`GET /tiktok/public/stores/91203776-b625-43ab-a67c-bfeb3e39129c`): HTTP 200 for Store 109 (`o_seaconsquaresrinakarin`, 4,477 followers, 11,035 likes, 136 videos). History array returns exact 2026-09-16 point.
    - Frontend Dashboard SSR (`GET https://lineoppo.click/tiktok`): HTTP 200 with SSR HTML (372.8 KB) rendering correct header timestamp badge, KPI values, top ranking, and store table.
    - Frontend Store Detail SSR (`GET https://lineoppo.click/tiktok/stores/91203776-b625-43ab-a67c-bfeb3e39129c`): HTTP 200 with SSR HTML (38.1 KB) rendering Store 109 metrics and history.
    - Fail-Closed Auth: Unauthenticated requests issue HTTP 307 redirect (`NEXT_REDIRECT;replace;/login;307;`) without leaking store data or partial state.
    - Session Hygiene: Temporary verification session was deleted immediately from production database.
- **Checks Run & Passed**:
  - Railway status: all production services `● Online`.
  - Production backend and frontend smoke tests: 100% passed.
  - Frontend test suite: 591/591 tests passed.
  - Backend test suite: 76/76 TikTok tests passed.
  - Production DB baseline integrity: 148 active stores, 0 duplicates, 0 non-EXACT.
- **Next Action**: Output final production deployment report to user.

# 2026-09-17: TikTok Permanent Daily Public Metrics Automation & Launchd Scheduling [COMPLETED & VERIFIED]
- **Current Task**: Deploy permanent daily TikTok public metrics automation using the Google Review operational pattern, stagger LaunchAgent scheduling, implement missed-snapshot detection, and verify clean runner execution.
- **Completed Work**:
  - **Pushed Verified Multi-Provider Commits**: Successfully pushed `0e6208a` and `c9ec4ee` to `origin/main` after verifying that 76/76 TikTok tests passed and the backend build succeeded.
  - **Runner Hardening (`run-local-daily.sh`)**: Hardened shell runner to resolve repo root, standard and Homebrew PATH, locate Node executable, load `local-data/production-db.env` (chmod 600), append timestamped execution logs to `launchd-runner.log`, forward CLI arguments, and return precise exit codes.
  - **Missed-Run / Snapshot Integrity (`run-daily-collector.mjs`)**: Added database preflight inspection to detect date gaps between the latest recorded metric and the target date. Skipped dates are classified as `MISSED_SNAPSHOT` to strictly prevent retrospective fabrication of past follower counts.
  - **Classification & Health State Summary**: Enhanced collector loop to categorize outcomes into `SUCCESS`, `VERIFIED_PROFILE_NOT_FOUND`, `UNRESOLVED`, and `FAILED`. Structured durable state in `local-data/tiktok-public-daily-state.json` with provider distribution (`COUNTIK`, `TOKCOUNTER`, `TIKTOK_DIRECT`), provider health statuses, and account arrays.
  - **LaunchAgent Configuration**: Validated `~/Library/LaunchAgents/com.oppo.tiktok-public-daily-collector.plist` scheduled at 02:30 Bangkok (90 minutes after Google Review at 01:00). Verified plist with `plutil -lint`, reloaded and verified via `launchctl print`.
  - **Smoke Dry-Run Test**: Executed `--dryRun --limit 2` verifying Google Sheet parsing, Countik provider responses (exact 954 and 404 followers), pacing delays, clean lock acquire/release, and zero database mutations.
- **Checks Run & Passed**:
  - `plutil -lint ~/Library/LaunchAgents/com.oppo.tiktok-public-daily-collector.plist`: OK.
  - `npx tsx --test src/tiktok/*.spec.ts`: 76/76 passed.
  - `npm --prefix backend run build`: passed cleanly (`prisma generate && nest build`).
  - `launchctl print gui/$(id -u)/com.oppo.tiktok-public-daily-collector`: active, correct interval (02:30).
  - Dry-run smoke test: exit code 0.
- **Next Action**: Create local automation commit and deliver final report.

# 2026-09-17: TikTok Multi-Provider Public Metrics Collector & Production Hardening (Metric Date: 2026-09-16) [COMPLETED & VERIFIED]

- **Current Task**: Harden multi-provider public TikTok metrics collector with independent `PROFILE_NOT_FOUND` consensus, authoritative direct evidence rules, and run-scoped rate-limit circuit breakers.
- **Completed Work**:
  - **Issue 1 — PROFILE_NOT_FOUND Independent Consensus & Direct Evidence**:
    - Enforced Rule A: requires independent agreement from at least 2 distinct providers before classifying an account as `PROFILE_NOT_FOUND`.
    - Enforced Rule B: permits single direct evidence from `TIKTOK_DIRECT` only when authoritative official TikTok error codes (`10221` / `ACCOUNT_NOT_FOUND` / `"TikTok account not found."`) are explicitly returned.
    - If only 1 third-party provider reports 404 while others are rate-limited or unavailable, returns `UNRESOLVED` instead of falsely marking the account non-existent.
    - Preserved candidate username resolution (checking `rawUrl` and hyphen replacements) prior to final status evaluation.
  - **Issue 2 — Run-Scoped Rate Limit Circuit Breaker**:
    - Added `rateLimitedForRun` set to `TikTokPublicProviderManager`. When any provider returns `RATE_LIMITED` (HTTP 403 / 429), it is immediately disabled for the remainder of the collector run.
    - Prevents re-querying or hammering rate-limited providers during long batch runs (e.g. 150 accounts) even if local timer cooldowns expire.
    - Full eligibility automatically resets upon creating a fresh `ProviderManager` instance on the next daily collector invocation.
  - **Regression Test Suites**:
    - Added Issue 1 Cases 1–5 and Issue 2 Cases A–D to `backend/src/tiktok/tiktok-multi-provider.spec.ts`. All 59 tests across 14 suites passed cleanly.
  - **Baseline Verification**:
    - Verified PostgreSQL production baseline for `2026-09-16` remains 100% intact: 148 exact metrics, 0 non-exact, 0 duplicate metrics, 149 mapped StoreMaster rows (74 TOKCOUNTER, 74 COUNTIK), 2 verified non-existent accounts (`@o_lotusbanbueng`, `@oppo_kamthieng01`).
- **Checks Run & Passed**:
  - `npx tsx --test src/tiktok/tiktok-multi-provider.spec.ts src/tiktok/tokcounter-collector.spec.ts src/tiktok/tiktok-public-analytics.service.spec.ts src/tiktok/tiktok-public-profile.spec.ts`: 59/59 tests passed.
  - `npm run build` in backend: passed cleanly (`prisma generate && nest build`).
  - Database audit: 148 metrics for `2026-09-16`, 148 exact, 0 non-exact, 0 duplicates.
- **Next Action**: Create focused local commits and provide final report. Do NOT push.

# 2026-09-17: Google Review 2026-09-16 Recovery & Week-Boundary Catch-Up Fix [COMPLETED & VERIFIED]
- **Current Task**: Recover missing Google Review Daily KPI for `2026-09-16`, reconcile Week 3 total, implement permanent week-boundary catch-up fix, stagger TikTok collector in launchd, and verify clean idempotent kickstart.
- **Completed Work**:
  - **Preflight DB Inspection**: Verified Week 3 baseline before mutation: Week 3 was CLOSED at 245 qualified (Sep 10–15 sum). Sep 16 had 0 Daily KPI rows and 28 partial fingerprints from interrupted overnight collector crash (caused by connection pool timeouts when TikTok collector launched concurrently at 01:30).
  - **Full 65-Store Recovery**: Sentinel test on CentralWorld 25610 passed cleanly. Full recovery scan ran with `--target-date 2026-09-16 --force-reconcile --headless true`. 65/65 stores accounted for (64 pass 1, 1 retry pass). Found 9 additional Sep 16 fingerprints (4 qualified, 5 unqualified). Total Sep 16 fingerprints: 37 (25 qualified, 12 unqualified). Total DB fingerprints: 934, 0 duplicates.
  - **KPI Reconciliation**: Reconciled all 65 Daily KPI rows for `2026-09-16` (25 qualified, 37 checked across 65 stores). Reconciled Week 3 to exactly 270 qualified reviews (Sep 10: 38, Sep 11: 36, Sep 12: 55, Sep 13: 58, Sep 14: 33, Sep 15: 25, Sep 16: 25). Week 1 (274) and Week 2 (301) remained strictly frozen.
  - **Permanent Week-Boundary Catch-Up**: Updated `resolveMissingCompletedDates()` in `backend/scripts/weekly-collector/run-local-daily-collector.mjs` to check `yesterdayBangkok` across week boundaries (e.g. Week 3 when today is Week 4). If uncollected, queues yesterday under `allowPreviousWeekFinalization`. If already in DB, synchronizes local state without re-scraping.
  - **Safe Closed-Week Guard**: In `runCollectionForDate()`, allowed collection into a CLOSED week only if `options.forceReconcile === true` OR (`options.allowPreviousWeekFinalization === true` AND `targetDate === yesterdayBangkok` AND `targetWeekNumber === currentWeekNumber - 1`). Arbitrary older closed weeks (e.g. Week 2) remain strictly rejected.
  - **Postflight Invariants Hardening**: Updated `runPostflightVerification()` to check all historical days of Week 3 (`< targetDate`) and enforce that Week 3 remains CLOSED at 270 when `targetWeekNumber > 3`. Enforced no premature reviews beyond `targetDate`.
  - **Launchd Scheduling Stagger**: Staggered `com.oppo.tiktok-public-daily-collector.plist` from 01:30 to 02:30 Bangkok to eliminate concurrent Chromium and PostgreSQL connection pool contention with the 01:00 Google Review collector.
  - **Regression Test Suite**: Added Cases 1–5 to `run-local-daily-collector.spec.ts`. All 75 tests across 19 suites in `weekly-collector` passed cleanly.
  - **Launchd Verification**: Kickstarted `com.oppo.google-review-daily-collector` via `launchctl kickstart -k`. Confirmed clean idempotent exit in 3s (exit code 0, 0 re-scrapes).
- **Checks Run & Passed**:
  - `npx tsx --test backend/scripts/weekly-collector/*.spec.ts`: 75/75 passed.
  - `npm --prefix backend run build`: passed cleanly (`prisma generate && nest build`).
  - `launchctl kickstart -k gui/$(id -u)/com.oppo.google-review-daily-collector`: exit code 0.
- **Next Action**: Commit and push permanent changes to `origin/main`.

# 2026-09-17: TikTok Public Daily Follower Baseline Reconciliation (Metric Date: 2026-09-16) [COMPLETED & RECONCILED]
- **Current Task**: Complete and reconcile the TikTok Public Daily Follower baseline collection for every TikTok account in the Store Master catalog for metric date `2026-09-16`.
- **Completed Work**:
  - Catalog analysis verified via `sheet-reader.mjs`: 160 store rows in Google Sheet1, 151 rows with TikTok handles, 150 unique normalized accounts, 1 duplicate/shared group (`o_taweekitburiram` shared by Store 27837 and Store 27368), and 9 stores without TikTok.
  - Collector hardened in `tokcounter-extractor.mjs` and `run-daily-collector.mjs`: fixed Prisma relation field casing (`tiktokPublicAccount`), blocked ad/promoted traffic to reduce API calls by 66%, classified 403/429 cleanly as `RATE_LIMITED`, and added safe halt on persistent rate limit to prevent hammering.
  - Production database verified via PostgreSQL: 74 unique accounts successfully persisted for `2026-09-16` with exact integer follower counts and `EXACT` precision; 0 duplicates.
  - Relational integrity confirmed: 75 StoreMaster rows point to the 74 TikTokPublicAccount rows (Store 27837 & 27368 both map to `o_taweekitburiram`).
  - Spot-check accuracy verified across multiple accounts (Store 109, Store 27837, Store 27368, Store 26528, Store 971, Store 32687) with 100% integer matches between raw DB metrics and `TikTokPublicAnalyticsService.listDashboardStores()` and `getStoreHistory()`.
  - Conclusively diagnosed remaining 76 accounts: all 76 uncollected accounts are categorized as `RATE_LIMITED` due to active IP rate limit (HTTP 403 Forbidden from `tiktok-api.tokcounter.com` on local host egress IP `83.118.80.162`).
- **Checks Run & Passed**:
  - `npx tsx --test src/tiktok/tokcounter-collector.spec.ts src/tiktok/tiktok-public-analytics.service.spec.ts src/tiktok/tiktok-public-profile.spec.ts`: 35/35 tests passed.
  - `npm run build`: passed cleanly (`prisma generate && nest build`).
- **Next Action**: Report comprehensive reconciliation to user. No fake numbers generated, no hammering, no proxy/CAPTCHA bypass.

# 2026-09-16: TokCounter Public TikTok Metrics POC for Store 109 [COMPLETED & VERIFIED]
- **Current Task**: Build and test proof-of-concept for extracting public TikTok account metrics from TokCounter for Store 109 (`o_seaconsquaresrinakarin`) without TikTok API, OAuth, or production database mutation.
- **Completed Work**:
  - Implemented `backend/scripts/tiktok-public/test-tokcounter-store.mjs` using local Playwright Chromium.
  - Added strict identity verification matching `@o_seaconsquaresrinakarin` on the rendered profile card; fails closed on mismatch (`ACCOUNT_IDENTITY_UNVERIFIED`).
  - Added multi-read stabilization logic waiting 3 seconds between reads to filter out odometer initialization animations and detect stable counts.
  - Implemented exact number parsing extracting comma-separated integers (`4,477` -> `4477`, `11,035` -> `11035`, `86` -> `86`, `136` -> `136`) with explicit `EXACT` precision flags.
  - Inspected TokCounter client-side bundle and identified module `10514` artificially adding 50 to like counts between 10,050 and 1,049,000, explaining the discrepancy between raw DOM (`11,035`) and API payload (`10,985`).
  - Observed clean, public background endpoints (`https://tiktok-api.tokcounter.com/user/data/{user}` and `/user/stats/{id}`) without secrets or tokens.
  - Performed 3 sequential repeatability runs with 100% success (3/3), ~6.36s average runtime, zero CAPTCHAs, zero logins, and zero persistent Chrome profile requirements.
  - Analyzed Google Sheet1: 160 total stores, 151 stores with TikTok username, 150 unique usernames, 1 duplicate group (`o_taweekitburiram` with 2 stores), and 9 blank stores.
- **Checks Run**:
  - Node syntax & execution checks: passed.
  - 3-run sequential test: 3/3 passed.
  - Sheet1 full CSV parsing & deduplication check: passed.
- **Workspace Boundary**: No database migrations, no production DB access, no Railway changes, no launchd scheduling, and no full scraping performed.
- **Next Action**: Await user review of POC findings and recommendation before planning full collector.

# 2026-09-15: Android 1.1.28+48 daily update prompt audit [PREPARED]
- **Current Task**: Audit the existing proactive daily update prompt on current `main` and prepare the next Android version without reimplementing the feature or publishing build 48.
- **Audit**: The prompt remains in `AppUpdateService` and the authenticated-main-workspace startup/login/resume lifecycle gates. Optional prompts use local-day plus release-build suppression; forced prompts bypass suppression and remain non-dismissible. Manual Profile checks remain available independently.
- **Regression Review**: The latest PDF hotfix changed backend files only and did not modify the Flutter update service, app lifecycle scheduling, settings entry point, startup restore, or Android installer bridge. Existing update and startup tests cover the audited paths.
- **Checks**: Focused update tests **36/36 passed**; full Flutter suite **268/268 passed**; `flutter analyze` passed with no issues; `flutter build apk --debug` passed; APK metadata verified as package `click.lineoppo.chat`, version `1.1.28`, build `48`; `git diff --check` passed.
- **Preparation**: `android_app/pubspec.yaml` is set to `1.1.28+48`. No backend/API, AppRelease, migration, production catalog, signing, release workflow, Railway, or UI behavior changes were made.
- **Workspace Boundary**: Existing unrelated weekly-collector edits and untracked `docs/executive-guide/` content remain untouched and excluded from the preparation commit.
- **Next Action**: Review/merge this preparation branch through the normal repository process before any separately authorized build-48 release or backend deployment.

# 2026-09-14: Android 1.1.27+47 PDF QA candidate [BLOCKED ON WORKFLOW VISIBILITY]
- **Current Task**: Review and package the implemented PDF feature as a signed staging/release-candidate APK without activating production build 47.
- **Review**: The PDF implementation was reconciled onto current `origin/main` (`f8e12a0`) without touching the concurrent greeting-targeting change. `docs/executive-guide/` remains untouched; no credentials, generated artifacts, or signed URLs are included.
- **Packaging**: Android version is `1.1.27+47`, package remains `click.lineoppo.chat`. The obsolete `android-production-release.yml` remains unchanged; the separate manual `android-signed-qa.yml` workflow restores existing signing material only from CI secrets and uploads an APK artifact only.
- **Repository sync**: `origin/main` was fetched and the PDF candidate is based on it; the pre-existing remote `release/android-1.1.25` branch is not overwritten.
- **Release boundary**: No production AppRelease activation, force-update, backend deployment, or production release workflow was triggered. The production-configured APK will require the new backend endpoints to be deployed before end-to-end PDF testing against production can work.
- **Blocker**: GitHub only exposes `workflow_dispatch` workflows that exist on the default branch. `android-signed-qa.yml` is safely committed on this candidate branch but is not yet registered, so dispatch returned HTTP 404. The prior run of the obsolete production workflow is not a valid QA result for this task.
- **Next Action**: Merge or otherwise make only `android-signed-qa.yml` visible on the default branch through the repository’s review process, then dispatch it at this candidate ref, verify the artifact, and install it over the existing app. Do not activate build 47 or deploy production.

# 2026-09-14: End-to-end PDF support for Flutter chat [IMPLEMENTED & VERIFIED]
- **Current Task**: Add inbound and outbound PDF support to the existing chat system without deployment or release.
- **Completed Work**:
  - Added PDF-only validation, bounded LINE content download, correct per-OA token resolution, safe filename metadata, and `PENDING`/`READY`/`FAILED`/`SKIPPED` media handling for inbound file events.
  - Added authenticated outbound PDF upload, existing object storage integration, stable opaque HTTPS customer document URLs, and LINE Flex/text-link delivery after LINE acceptance.
  - Added Android PDF document picking through the native system picker, compact chat bubbles, confirmation/send flow, and platform viewer opening without a custom PDF renderer.
  - Reused existing `Message`/`MessageMedia` and storage abstractions; no schema migration or backend business-logic redesign was needed.
- **Checks Run**:
  - Focused backend PDF/media/webhook/controller/messaging/conversation tests: **68/68 passed**.
  - Full Flutter test suite: **268/268 passed**.
  - `flutter analyze`: passed with no issues.
  - Changed backend files ESLint: passed; backend build and Prisma schema validation: passed.
  - `flutter build apk --debug`: passed.
  - Full backend test suite: **1,946 passed, 6 pre-existing unrelated failures** in `src/line-chat/*`; no PDF test failed.
  - Full backend lint remains blocked by the existing unrelated legacy baseline (**721 errors, 2 warnings**); changed files are clean.
- **Release Boundary**: No deployment, release trigger, push, signing-key change, package-name change, uninstall, or additional UI redesign was performed. The unrelated untracked `docs/executive-guide/` directory remains untouched.
- **Next Action**: Review and authorize the normal staging/release workflow separately, then install the updated app and perform the planned visual QA/polish pass.

# 2026-09-14: Proactive daily Android update prompt [RELEASED & VERIFIED]
- **Current Task**: Release the implemented daily update prompt and current Flutter chat UI redesign as Android `1.1.26+46` through the existing CI signing/distribution path, without further UI changes.
- **Completed Work**:
  - Added an authenticated-main-UI-only, post-frame automatic check after startup restore/login and on resume, gated to users with an available main workspace.
  - Added local-calendar-day suppression for optional prompts using `last_update_prompt_date` and `last_prompted_build_number` in `SharedPreferencesAsync`; a newer release bypasses an older same-day dismissal, while forced updates are never suppressed.
  - Added single-flight protection for concurrent metadata checks and quiet failure handling so update metadata/storage failures do not block the app.
  - Preserved the existing manual Profile check, force-update behavior, checksum verification, APK installer, package identity, signing configuration, backend APIs, and chat UI redesign.
- **Checks Run**:
  - Focused update-flow tests: **35/35 passed**.
  - Full Flutter test suite: **256/256 passed**.
  - `flutter analyze`: passed with no issues.
  - `git diff --check`: passed.
  - CI publisher run **34827881569** passed analysis, all Flutter tests, existing-key restoration, signed APK build, package/version/signer verification, APK publication, release payload validation, and release commit.
  - Published APK: `1.1.26+46`, package `click.lineoppo.chat`, SHA-256 `30821a68b913edfe7b34f4257b825e0adf9f4b403b7ba17fc3e0904fc0726cf1`; public API and downloaded APK checksum agree.
  - Railway backend deployment for commit `d862e0f` succeeded; `/app/version/android` reports build 46 active with `forceUpdate=false`, build 45 inactive, and `/health` plus `/health/readiness` return HTTP 200.
- **Release Boundary**: No uninstall, package/applicationId change, signing-key replacement, backend API/schema change, or additional UI change was made. The unrelated untracked `docs/executive-guide/` directory remains untouched.
- **Next Action**: Install `1.1.26+46` over the existing Android app, capture screenshots, and perform the separate visual QA/polish pass against the supplied mockup.

# 2026-09-14: Android 1.1.25 migration recovery [COMPLETED & VERIFIED]
- **Root Cause**: `backend/prisma/migrations/20260914140000_release_android_1_1_25/migration.sql` had one invalid trailing comma in the final PostgreSQL `ARRAY[...]` item, causing production Prisma `P3018` / PostgreSQL `42601`.
- **Recovery**: Confirmed the failed row had `applied_steps_count=0`, no finished timestamp, and no build-45 `AppRelease` row. Marked the failed migration rolled back with Prisma's supported `migrate resolve --rolled-back` command, then deployed the one-character SQL correction.
- **Verification**: Railway deployment `72aef7a5-da64-48c4-82c3-037bf31475e1` applied the migration successfully; current main deployment `7370b90c-05f8-43df-b520-f45aac15d546` is successful and running. `prisma migrate status` reports the schema up to date and `prisma migrate deploy` reports no pending migrations.
- **Production State**: Android build 45 / version 1.1.25 is active with the expected APK URL and SHA-256; build 44 and earlier Android releases are inactive. `/health` and `/health/readiness` both return HTTP 200.
- **Checks**: `git diff --check`, Prisma schema validation, backend build, and AppVersionService tests (3/3) passed. The unrelated untracked `docs/executive-guide/` directory remains untouched.

# 2026-09-14: Android 1.1.25+45 release [COMPLETED & VERIFIED]
- **Current Task**: Release the Flutter chat UI redesign as the next Android update without changing backend behavior, package identity, or signing configuration.
- **Completed Work**:
  - Fetched and rebased onto the current `origin/main`, preserving the concurrent main-branch changes.
  - Set `android_app/pubspec.yaml` to `1.1.25+45` and added the established CI publisher using the existing permanent signing secrets.
  - Kept the unrelated untracked `docs/executive-guide/` directory out of the release files.
  - Published the signed production APK and release metadata through GitHub Actions run `34819942468`.
- **Checks Run**:
  - `flutter analyze`: passed.
  - Full Flutter tests: **246/246 passed**.
  - CI signed APK metadata: package `click.lineoppo.chat`, version `1.1.25`, versionCode `45`; existing production certificate verification passed.
  - Published APK SHA-256: `459f9dabf16f5bdb2f705640163937e7143ad2a9cdc35804d9ecfac46946abfd`.
  - `git diff --check`: passed.
- **Signing/Distribution**: Local signing material remains intentionally absent. CI restored the existing authorized keystore, verified the known production certificate, and published `frontend/public/downloads/oppo-line-oa-chat-v1.1.25-production.apk` plus the `/download` metadata and additive release migration.
- **Release Commits**: UI redesign `735b070`; release preparation and CI workflow updates `4d52e66`, `44548d7`, `95ec866`; published release `497ac3833d50d2251f7160e93e06b8ad83cac6d3` (`chore(android): release 1.1.25+45`).
- **Next Action**: Install the published 1.1.25+45 APK over the existing version 44 app without uninstalling it, then perform the separate visual QA/polish pass against the supplied mockup.

# 2026-09-14: Google Review Railway Cron Container Startup Reliability Fix [COMPLETED & VERIFIED]
# 2026-09-14: Google Review Railway Cron Container Startup Reliability Fix [COMPLETED & VERIFIED]
- **Current Task**: Investigate and fix the Railway cron container startup failure where `google-review-daily-collector` logged only "Starting Container" without executing application collector logic at 23:30 Asia/Bangkok.
- **Root Cause Confirmed**:
  1. Proven runtime freeze: `/usr/bin/xvfb-run` lines 180-184 execute `(trap '' USR1; exec Xvfb ...) &` followed by `wait`. In non-interactive Docker containers without signal forwarding or an init system, `Xvfb` does not deliver `SIGUSR1` to the parent shell, causing `xvfb-run` to hang indefinitely on `wait` before Node is ever invoked.
  2. Fragile CLI detection: `import.meta.url.endsWith(process.argv[1]...)` in `run-single-cycle.mjs` was vulnerable to invocation path variations across different shell environments and symlinks.
- **Permanent Fix Implemented**:
  1. Replaced `import.meta.url.endsWith(...)` with canonical `path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))` and added immediate startup logging `[google-review-collector] main entered`.
  2. Created dedicated POSIX entrypoint `backend/scripts/weekly-collector/railway-entrypoint.sh` with `set -Eeuo pipefail`, ERR trap, non-secret diagnostic reporting, and explicit background `Xvfb :99` launch with process health checks and display verification, completely bypassing buggy `xvfb-run`.
  3. Added automated unit and execution guard tests in `backend/scripts/weekly-collector/collector-entrypoint.spec.ts` (5/5 tests passing).
  4. Updated Dockerfile `backend/Dockerfile.google-review-collector` to execute `railway-entrypoint.sh`.
  5. Built and tested Docker container locally: verified container starts Xvfb, sets DISPLAY=:99, enters collector `main()`, prints daily tracking banner, and halts cleanly on missing `DATABASE_URL`.
- **Invariants & Checks Verified**:
  - `collector-entrypoint.spec.ts`: 5/5 passing.
  - `weekly-rating-persistence.spec.ts`: 6/6 passing.
  - Local Docker run: proven clean entrypoint execution without hanging.
  - Production database invariants untouched: Week 3 = 187, Week 1 = CLOSED/274, Week 2 = CLOSED/301, 811 fingerprints total, 0 duplicates.
- **Next Action**: Deploy permanent fix to Railway.

# 2026-09-14: Flutter black-app chat UI redesign [COMPLETED & VERIFIED]
- **Current Task**: Refactor the Flutter inbox, conversation room, composer, and information architecture toward the attached LINE-like internal-app mockup while preserving existing business behavior.
- **Completed Work**:
  - Replaced the inbox overview block with compact status/filter pills and an always-visible search surface that opens the existing full search mode.
  - Reworked conversation rows into divider-led, compact customer/message rows with quieter store, owner, source, sales, timestamp, unread, and reply-status treatments.
  - Reduced the conversation header from 152px to 72px and moved source/sales context into a slim metadata strip.
  - Added a full conversation information page for customer, store, owner, source, reply status, sales, activity, and existing media counts; existing owner/status/sales callbacks remain the source of truth.
  - Added a compact composer with direct camera/gallery affordances and a callback-driven action sheet for existing media, sales, status, and info actions.
  - Added a reusable system notice presentation for operational errors and resolver diagnostics instead of raw red text in the timeline.
- **Checks Run**:
  - `flutter analyze`: passed with no issues.
  - Focused redesign widget tests: **3/3 passed**.
  - Full Flutter test suite: **239/239 passed**.
  - Android debug APK: passed; generated `build/app/outputs/flutter-apk/app-debug.apk`.
  - `git diff --check`: passed.
  - `flutter devices`: only macOS and Chrome are available; no Android emulator or device is provisioned for live tap-through verification.
- **Release Boundary**: A release APK was not produced because this checkout has no `android/key.properties`/permanent signing identity, and the release task also stops at the existing Android legacy/new DSL `compileSdk` incompatibility. No signing key was created or substituted.
- **Next Action**: Review the scoped Flutter UI diff. Resolve the Android release-toolchain/signing prerequisites separately before a production APK release.

# 2026-09-11: Store 360 Export [RECONCILED & VERIFIED]
- **Current Task**: Reconcile the local Store 360 XLSX export feature onto the fetched latest `origin/main`, verify the candidate locally, and checkpoint it on the export-only branch without merging or deploying.
- **Isolation**: Initial export base was `058553c2c38f477a2ddae68b7c4c59c8039e4584`; fetched latest `origin/main` is `d28fa662a251e759a68c9580384bb9694392866f`. The clean candidate is `/private/tmp/store-360-export-integration` on `feat/store-360-export`.
- **Completed Work**:
  - Added an authenticated `POST /store-insights/export` endpoint with explicit store IDs, Bangkok timezone validation, a 10-store request cap, and no data writes.
  - Reused Store 360 snapshots and existing response, sales, follower, human-responder, and canonical current Customer Voice definitions to generate `Summary`, `Conversations`, `Customer Voice`, and `Responders` worksheets.
  - Added a Store 360 UI export control that defaults to the currently selected store, permits up to 10 authorized stores, respects the active date range, shows a loading state, blocks duplicate clicks, and reports failures.
  - Excluded customer identity fields, LINE IDs, phone numbers, raw message text/payloads, access tokens, and secrets; conversation references are one-way hashed values.
- **Checks Run**:
  - Reconciled backend Store 360/export/authorization/Customer Voice tests: **40/40 passed**, including single-store, seven-store, authorization-before-read, Bangkok boundaries, current-version-only Customer Voice, privacy, responder attribution, empty data, validation, and XLSX headers.
  - Targeted frontend Store 360 tests: **13/13 passed**; full frontend tests: **568/568 passed** on latest main.
  - Changed-file ESLint checks: **passed** for all changed backend and frontend source/tests.
  - Backend and frontend production builds: **passed**; `/store-360` is present in the generated frontend routes.
  - `git diff --check`: **passed**, including the untracked implementation/test files.
  - Frontend `tsc --noEmit`: retains unrelated baseline errors in Google Review KPI, Line Chat Health, AI test fixtures, conversation-list fixtures, TikTok fixtures, and other existing files; no changed Store 360/export file was reported.
  - Full backend test suite: **1,889 total, 1,882 passed, 7 unrelated baseline failures** in line-chat composer/health/manager areas and store-master sync; no Store 360/export failure.
  - Full backend/frontend lint: retains unrelated repository-baseline violations; changed-file lint remains clean.
  - Local runtime smoke: frontend `/`, `/store-360`, and `/api/health` returned **200**; backend production startup compiled and registered Store Insights routes, then stopped at the expected missing local `DATABASE_URL`/Prisma configuration boundary. No production database was accessed.
- **Reconciliation**: Checkpoint `d64d07c` was cherry-picked cleanly onto latest main and amended to use the canonical Customer Voice version in its test fixture; final candidate commit is `1713f5f` with no conflicts.
- **Local State**: No migration, worker enablement, ConversationAnalytics write, production access, merge, or deployment was performed. The candidate is clean and pushed only to `origin/feat/store-360-export`.
- **Blockers**: Authenticated DB-backed export smoke remains **NOT VERIFIED** because no safe local database was available. Production deployment is intentionally out of scope.
- **Next Action**: Stop for main-integration review. Do not merge or deploy from this task.

# 2026-09-11: Remove Rich Menu Bulk Store Selection Cap [COMPLETED & VERIFIED]
- **Current Task**: Remove the user-facing five-store selection limit from Phase 2B Rich Menu bulk publishing while preserving durable jobs, readiness validation, progress persistence, retry scope, and bounded LINE API concurrency.
- **Findings**:
  - The old cap was enforced by the Rich Menu frontend selection toggle/select-all logic, localized copy, publish eligibility/modal copy, the backend bulk-job validator, and the `/publish-capabilities` `maxTargets` field.
  - Readiness is loaded as the full store dataset; table search/filtering is client-side and does not paginate the selection source.
  - The worker already uses persisted attempts and bounded concurrency (default 2, maximum 5), independent of selection size.
- **Completed Work**:
  - Removed the selection cap and all Rich Menu five-store limit copy from Thai, English, and Chinese UI dictionaries.
  - Select-all now selects every READY, not-currently-published store in the full readiness dataset; stale selections are pruned on readiness refresh, and publish requests are rebuilt from currently eligible rows.
  - Removed backend target-count rejection and `maxTargets` capability metadata; duplicate IDs remain deduplicated and existing active/store/token/readiness validation remains in place.
  - Added generated 143-store coverage, duplicate-ID coverage, blocked-store selection assertions, worker partial-failure continuation coverage, and preserved retry-only-failed coverage.
- **Checks Run**:
  - Rich Menu backend spec: **29/29 passed**.
  - Frontend test suite: **563/563 passed**.
  - Frontend and backend production builds: **passed**.
  - Runtime smoke: backend `/health` **200**, frontend `/` **200**, `/rich-menus` **200**, unauthenticated Rich Menu capabilities **401**; startup logs registered the Rich Menu routes and worker.
  - `git diff --check`: **passed**.
  - Full lint/typecheck and full backend suite retain unrelated repository-baseline failures; Docker/PostgreSQL is unavailable for DB-backed authenticated verification.
- **Next Action**: Review the scoped diff; no commit, migration, or deployment was performed.

# 2026-09-10: Store 360 Phase 1 Production Readiness [COMPLETED & VERIFIED]
- **Current Task**: Validate and refine the Store 360 Phase 1 implementation against the existing data model without starting Phase 2 AI features.
- **Audit Completed**:
  - Store identity comes from `Store` + `StoreMaster`.
  - LINE OA identity/status comes from `LineOfficialAccount`; followers come from `LineOaFollowerSnapshot`.
  - Customer/message activity comes from `Conversation` + `Message`.
  - Human reply attribution requires `OUTBOUND` + non-null `Message.senderUserId` and excludes `Auto Reply Bot`, `SYSTEM`, and ambiguous outbound rows. Current operator text/image and mobile video write paths persist the sender; persisted auto-response delivery is separately marked.
  - Sales/product/payment tagging comes from existing conversation sales fields, `ConversationSalesProduct`, and manual `ConversationProduct` records.
  - Follow-up attribution comes from `ActivityHistory.createdByUserId`.
  - Authorization comes from `StoreAccessService`; chat drill-through remains `/chats?conversationId=...`.
- **Completed Work**: Extended response lookup only through the bounded 24-hour look-ahead after the exclusive report end; kept inbound/customer counts inside the selected Bangkok-calendar range; documented one conversation-level response case; added text/image/video, bot/system/ambiguous attribution coverage; added no-data and unique-customer sales denominator coverage; exposed persisted `ConversationTopic`/`Topic` names read-only with compact multi-topic formatting; preserved existing Store Chats navigation; no Phase 2 AI or migration was added.
- **Definitions**:
  - Customers are unique `Conversation.customerId` values among selected non-QA conversations with selected-period inbound activity.
  - A response case is one conversation: the first selected-period inbound opens it, and the first later qualifying human outbound closes it. Repeated inbound bubbles before that reply do not create extra SLA cases.
  - `Replied Within 24h` uses the first qualifying human reply duration; replies after 24 hours are late (not in the 24h bucket) but remain replied if observed within the bounded report-end-plus-24h lookup horizon.
  - Unanswered means no qualifying human reply was observed within that bounded response lookup horizon; automated, system, and ambiguous outbound rows never satisfy it.
  - `Sales Tagged / Customers` uses unique tagged `customerId` values over unique selected-period inbound `customerId` values. Conversation/product counts remain available in the Sales section.
  - Topics are persisted `ConversationTopic`/`Topic` names only; Store 360 does not generate or infer topics.
- **Checks Run**: Store 360 backend and neighboring monthly analytics tests passed (44/44); frontend test suite passed (549/549); Store 360/backend/frontend scoped ESLint passed; backend and frontend production builds passed; Prisma schema validation passed. Docker/PostgreSQL was unavailable, so no authenticated DB-backed Store 360 metric values were observed or cross-checked locally. No migration was required.
- **Known Repository Baseline**: Full backend lint, full frontend lint, frontend `tsc --noEmit`, and the full backend suite retain the unrelated pre-existing failures recorded below; no new Store 360 failure was found. Host-local startup smoke checks from the initial Store 360 implementation remain valid (`/health` 200, protected Store 360 endpoints 401 without auth, unknown route 404, `/store-360` 200), but this continuation could not perform DB-backed authenticated checks because Docker/PostgreSQL remains unavailable.
- **Next Action**: Safe to review/commit the scoped Store 360 changes after the documented runtime limitation is accepted; no commit or push was performed.

# AI Progress Log

## 2026-09-10: Store Locator Production-Readiness Polish [COMPLETED & VERIFIED]
- **Current Task**: Harden the customer-facing `/store-locator` page for narrow mobile and LINE in-app use without changing the existing `/stores` behavior.
- **Completed Work**:
  1. Preserved the existing mobile-first region → province → store flow and added explicit loading, API error/retry, zero-store, no-province, and no-search-result states.
  2. Added provider-neutral lightweight analytics events: `store_locator_open`, `region_selected`, `province_selected`, `store_selected`, and `line_oa_clicked`. Events are emitted as a browser `CustomEvent` and forwarded to an existing `gtag`/`dataLayer` only when configured; no analytics provider or backend schema was added.
  3. Kept LINE navigation same-tab for LINE in-app browser use, added an accessible branch-specific CTA label, and fail-closed invalid/non-LINE URLs. The public DTO now omits invalid LINE URLs so manager links cannot become public CTAs.
  4. Confirmed the locator uses the active `StoreMaster` source through `GET /public/stores`, and does not expose internal fields. No mall, district, or opening-hours data was invented; those fields are not present in the current StoreMaster model.
- **Exact active StoreMaster data-quality issue**:
  - `OBS Big C Loei FL.1 By OPPO` — external store ID `32983`, source `GOOGLE_SHEET`, source row `159`, `isActive: true`, `province: null`, `region: null`.
  - `OBS Big C Mahachai 1 Fl.G  By OPPO` — external store ID `30679`, source `GOOGLE_SHEET`, source row `158`, `isActive: true`, `province: null`, `region: null`.
  - The source rows have blank Province and Region fields. The locator intentionally does not infer geography from the store names.
- **Checks Run**:
  - Focused frontend locator tests: **5/5 passed**.
  - Full frontend tests: **549/549 passed**.
  - Focused frontend and backend ESLint checks: **passed**.
  - Frontend production build: **passed**; `/store-locator` is registered.
  - Backend production build: **passed**.
  - Live runtime: `/health` 200, `/store-locator` 200, `/public/stores` 200 with 158 active rows, frontend proxy 200, protected `/stores` 401.
  - Live public DTO audit: all 158 active rows had valid LINE URLs; no internal DTO keys were exposed.
  - Browser visual/tap QA: unavailable because no browser instance was provisioned; responsive source review confirmed `max-w-xl`, mobile padding, 44px+ controls, wrapping cards, and no horizontal-layout dependency.
- **Scope Confirmed**: Existing `/stores` and `/admin/stores` files and behavior were not changed. No migration or data mutation was performed.

## 2026-09-10: Remove Per-Video Analytics from Public TikTok Owner Flow [COMPLETED & VERIFIED]
- **Current Task**: Align the public store-owner analytics surface with the approved read-only OAuth scopes and privacy policy by removing all per-video analytics while preserving internal HQ video capabilities.
- **Completed Work**:
  1. Removed `videos` from `TikTokStoreOwnerAccountResponse` and stopped `getStoreOwnerAnalytics()` from returning `overview.videos`.
  2. Removed the public Recent Videos section and all video covers, captions, views, likes, comments, shares, and engagement UI. Account-level Video Count remains visible.
  3. Added `getTikTokAccountForStoreOwner()` with a field-only Prisma selection for the required `TikTokAccount` and `StoreMaster` fields; it does not load `TikTokVideo`. Kept `getTikTokAccountById()`, `TikTokVideo` storage, existing internal TikTok service behavior, HQ dashboards, and their APIs unchanged.
  4. Added focused backend service coverage proving the public path never calls the video-including lookup or requests the video relation, official account metrics still return, and stored video records are omitted, plus frontend/source assertions for the public contract and security/state boundaries.
- **Checks Run**:
  - Frontend TikTok authorization/session tests: **12/12 passed**.
  - Backend TikTok/store-owner tests: **30/30 passed**.
  - Frontend production build: **passed**.
  - Backend production build: **passed**.
  - Prisma schema validation: **passed**.
  - Focused lint on changed owner-flow files: **passed**. The touched legacy `tiktok.service.ts` file retains pre-existing repository lint errors outside the new method; none are in the added method.
  - `git diff --check`: **passed**.
- **Scope Confirmed**: No OAuth credentials/scopes, Railway variables, LINE OA, Google Review, database schema, migrations, internal HQ dashboards, or TikTok video records were changed.
- **Next Action**: Commit and push this fix to the existing PR #232; do not merge or deploy.

## 2026-09-09: Public TikTok Store-Owner Analytics Flow [IMPLEMENTED & VERIFIED]
- **Current Task**: Fix the post-OAuth store-owner TikTok CTA so a confirmed BM/PC/store operator can view only the authorized account's official analytics without staff login, while preserving HQ dashboards.
- **Completed Work**:
  1. Added `/connect/tiktok/analytics` as a dynamic, `noindex`/`nofollow` public-authorized page with Thai, English, and Chinese customer-facing states.
  2. Added a dedicated one-hour signed HttpOnly store-owner session scoped to both `TikTokAccount.id` and `StoreMaster.id`; it is issued only from the confirmed store-binding flow and verified by both frontend and backend.
  3. Added narrowly scoped `GET /tiktok/internal/store-owner/me`. It accepts no account/store path parameters, derives identity from the signed cookie, requires the existing internal server-to-server guard, and returns only safe official account, store, and daily-metric fields.
  4. Added confirmed, pending, unconfirmed, expired, disconnected, and no-history UI states. The page includes the read-only disclosure required for the TikTok App Review use case and does not expose per-video analytics.
  5. Updated `/connect/tiktok/success` to link to the new route. Existing `/tiktok`, `/tiktok/dashboard`, `/tiktok/dashboard/[accountId]`, and public collector routes were left unchanged.
- **Checks Run**:
  - Focused TikTok auth/session test: **12/12 passed**.
  - Focused backend TikTok/store-owner tests: **28/28 passed**, including the server-side signed-cookie verifier.
  - Full frontend tests: **539/539 passed**.
  - Focused frontend and backend ESLint checks: **passed**.
  - Prisma schema validation: **passed**.
  - Frontend production build: **passed**; `/connect/tiktok/analytics` is registered as a dynamic route.
  - Backend production build: **passed**.
  - Frontend `tsc --noEmit`: repository baseline remains failing in unrelated Google Review KPI, Line Chat, and test fixtures; no errors remain in the changed analytics/session files.
  - Full frontend lint: repository baseline remains failing in unrelated files (**68 errors, 77 warnings**).
  - Full backend tests: **1809 passed, 4 pre-existing failures** in Line Chat health/image relay and Store Master sync tests; no TikTok failure.
  - Live local check: frontend analytics and success routes returned **200**; unauthenticated binding context returned **401**. Backend startup compiled and registered the new route but could not remain live because local PostgreSQL/Docker was unavailable.
- **Blockers**: Docker/PostgreSQL is unavailable in the environment, so a DB-backed signed-session analytics response and full backend health check could not be exercised. Browser visual QA was also unavailable because no in-app browser instance was provisioned.
- **Next Action**: Commit the scoped branch and open the review PR; do not merge or deploy.

## 2026-09-09: Google Review Weekly KPI 7-Day Calendar Transition & Live Sep 9 Collection [COMPLETED & VERIFIED]
- **Current Task**: Change Google Review Weekly KPI calendar from hardcoded/irregular intervals to true 7-calendar-day periods starting from Week 2, migrate production PostgreSQL database records, generalize the collector, verify all invariants, run a dry diagnostic on 5 stores, run exactly ONE live collection cycle for today (`2026-09-09`), verify post-run production state, and open a PR to `main`.
- **Completed Work**:
  1. Period Model & Boundaries:
     - Updated `backend/src/google-review-kpi/weekly-period.util.ts`:
       - Week 1: `2026-08-26T00:00:00+07:00` to `2026-09-03T00:00:00+07:00` exclusive (`26.08-02.09.2026`), status `CLOSED`.
       - Week 2: `2026-09-03T00:00:00+07:00` to `2026-09-10T00:00:00+07:00` exclusive (`03-09.09.2026`), status `OPEN` on Sep 9.
       - Week 3: `2026-09-10T00:00:00+07:00` to `2026-09-17T00:00:00+07:00` exclusive (`10-16.09.2026`), status `OPEN`.
       - Weeks 4–10: continuing every 7 calendar days up to Week 10 (`29.10-04.11.2026`).
       - Formatter uses `endExclusive - 1 calendar day` to display inclusive range labels.
       - `resolveWeekNumber`: resolves < Sep 3 as Week 1, and 7-day intervals from Sep 3 onward.
     - Updated `weekly-period.util.spec.ts`: All 8 tests passing.
  2. Collector Generalization:
     - Updated `date-classifier.mjs` and `date-classifier.spec.ts`: Added `classifyDateForWeek`, `resolveWeekNumberFromDate`, and `getWeekDateBoundaries`. Tested all boundary cases (22 tests passing).
     - Updated `continuous-collector.mjs`: Supports dynamic `targetWeekNumber`, generalized chronology stop condition, dynamic week assignment on fingerprints.
     - Updated `run-single-cycle.mjs`: Resolves target week dynamically, attributes daily and weekly records to resolved weekly period, and dynamically re-ranks the active week.
     - Updated `maps-dom-helper.mjs`: Added resilient retry loop in `evaluatePlaceStatus` against mid-navigation destroyed execution contexts.
  3. Production Database Migration:
     - Executed `migrate-production-calendar.ts` against Railway production PostgreSQL via proxy.
     - Upserted all 10 weekly periods with approved 7-day boundaries and labels.
     - Reassigned 65 `2026-09-02` Daily KPI records to Week 1 (`weekNumber: 1`, `weekPeriodId: week1Period.id`).
     - Week 1 historical total strictly preserved at **274** (Sep 2's 25 was NOT added).
     - Recomputed Week 2 Weekly KPI for all 65 stores from daily records `2026-09-03` to `2026-09-09` (dropped from 302 to 277).
     - Re-ranked Week 2 stores. Verified all invariants.
  4. Dry Diagnostic:
     - Ran `dry-diagnostic-5stores.mjs` against production DB: 5/5 stores passed (0 limited view, 20 cards detected, Newest sort verified).
     - CentralWorld non-mutating continuous scan triggered fast-stop at boundary.
     - Verified zero DB mutations (FP=510, Daily=767, Weekly=130).
  5. Single Live Cycle for Today (2026-09-09):
     - Executed single live cycle with `GOOGLE_REVIEW_WRITE_DATE=2026-09-09` across 65 focus stores in 10.9 minutes.
     - Total stores scanned: 65/65 (64 successful scans, 45 fast stops, 28 stores with new reviews).
     - Discovered 33 new reviews; 10 new qualified reviews for `2026-09-09`.
     - Re-ranked all 65 stores in Week 2.
  6. Post-Run Production State Audit:
     - Week 1: strictly **274** (`CLOSED`).
     - Week 2: strictly **287** (`OPEN`) (277 + 10 for Sep 9).
     - Daily Sep 2: **25** (weekNumber: 1).
     - Daily Sep 3..8: **34, 38, 51, 29, 65, 60** (100% unchanged).
     - Daily Sep 9: **10** (freshly qualified reviews across 7 stores).
     - Fingerprints: Total 523, Qualified 315 (+13 total, +10 qualified).
- **Checks Run & Passed**:
  - `weekly-period.util.spec.ts`: 8/8 passed (`npx tsx --test`, exit 0).
  - `date-classifier.spec.ts`: 22/22 passed (`npx tsx --test`, exit 0).
  - `google-review-kpi.service.spec.ts` & exports: 13/13 passed (`npx tsx --test`, exit 0).
  - Backend production build: passed cleanly (`npm run build`, exit 0).
  - Frontend production build: passed cleanly (`npm run build`, exit 0).
- **Next Action**: Review git diff, push branch, open PR to `main`, and verify CI.

## 2026-09-09: Google Review KPI Sep 8 Recovery [COMPLETED & VERIFIED]
- **Current Task**: Recover missing Google Review KPI data for yesterday only (`2026-09-08`) following the scheduled Railway cron failure, while strictly preserving all historical days, isolating `2026-09-09` from mutations, and verifying production invariants against PostgreSQL via Railway proxy.
- **Completed Work**:
  1. Root Cause & Solution:
     - The scheduled Railway cron crashed due to Maps bot detection (`ERROR_MAPS_LIMITED_VIEW_DETECTED` and `ERROR_NEWEST_SORT_UNVERIFIED`) because it lacked the proven desktop user agent and flags available in the local persistent profile.
     - Refined `classifyWeek2Date` in `backend/scripts/weekly-collector/date-classifier.mjs` to calculate accurate relative hour/minute offsets across midnight so reviews posted yesterday evening (10-24 hours ago) correctly resolve to `2026-09-08` instead of today `2026-09-09`.
     - Added targeted date mode in `continuous-collector.mjs` and `run-single-cycle.mjs`: when `GOOGLE_REVIEW_WRITE_DATE=2026-09-08` is set, reviews belonging to any other date (e.g. `2026-09-09`) are skipped without recording fingerprints or mutating daily/weekly records, leaving them clean for tonight's scheduled cycle.
  2. Diagnostic & Single Controlled Production Cycle:
     - Ran 5-store dry diagnostic with 100% pass rate (5/5) and verified zero DB mutations.
     - Executed exactly ONE controlled live cycle across all 65 stores using the dedicated Chrome profile connected to production PostgreSQL via `DATABASE_PUBLIC_URL`.
     - Completed in 12.4 minutes: 63 successful scans, 0 limited view errors, 40 fast stops at previously processed boundary, 45 stores with new reviews.
     - Total new reviews discovered: 77; total new qualified reviews recovered: +37.
     - Skipped future date reviews (Sep 9): 0.
     - Re-ranked all 65 Week 2 stores deterministically.
  3. Post-Execution Production Database Audit:
     - Week 1: `CLOSED` / 274 qualified reviews (100% preserved).
     - Sep 2 - Sep 7 daily totals: 25, 34, 38, 51, 29, 65 (100% unchanged).
     - Sep 8 daily total: increased from 23 to 60 (+37 recovered qualified reviews across 34 stores).
     - Sep 9 daily total: exactly 0 (0 reviews, 0 stores).
     - Sep 9 fingerprints: exactly 0.
     - Total fingerprints: 510 (before: 456; +54 unseen reviews fingerprinted).
     - Qualified fingerprints: 305 (before: 268; +37 qualified).
     - Week 2 Total: exactly 302 (before: 265; sum of dailies 25+34+38+51+29+65+60 = 302).
- **Checks Run & Passed**:
  - `date-classifier.spec.ts`: 19/19 tests passed (`npx tsx --test`, exit 0).
  - Backend build: `npm run build` passed cleanly (`prisma generate && nest build`, exit 0).
  - Post-recovery DB audit script: All 7 invariant checks PASSED with 0 discrepancies.
- **Next Action**: Report comprehensive results to user. No further cycles or database mutations needed.

## 2026-09-08: TikTok Official API — Fail-Closed Feature Gate Integration [COMPLETED]
- **Current Task**: Introduce explicit fail-closed feature gate (`TIKTOK_PUBLIC_CONNECT_ENABLED`) on `feat/tiktok-review-ready-integration` (PR #205) to ensure safe production deployment without activating unverified pre-existing Railway TikTok credentials.
- **Completed Work**:
  1. Phase 16 — Fail-Closed Feature Gate Implementation:
     - Implemented server-side `isTikTokPublicConnectEnabled()` in `frontend/src/app/tiktok/connect/tiktok-oauth.ts`. Requires exact case-insensitive trimmed value `"true"`. Missing, empty, `"false"`, `"0"`, or undefined default to `false`. Never exposed as `NEXT_PUBLIC_*`.
     - Updated `/connect/tiktok/page.tsx`: When gate is disabled, page layout renders normally but the CTA button is disabled displaying neutral Thai copy: *"การเชื่อมต่อ TikTok ยังไม่เปิดใช้งานในขณะนี้"* without exposing configuration details or environment variable names.
     - Protected `/api/tiktok/authorize` and `/tiktok/connect`: When gate is disabled, immediately fail closed with HTTP 302 redirect to `/tiktok/connect/error?reason=integration_disabled` without generating state, PKCE, cookies, or redirecting to TikTok.
     - Protected `/tiktok/callback`: When gate is disabled, fails closed with HTTP 302 redirect to `/tiktok/connect/error?reason=integration_disabled` and expires state cookie.
     - Enhanced `/tiktok/connect/error/error-content.tsx`: Added trilingual handling for `integration_disabled` (TH: *"การเชื่อมต่อ TikTok ยังไม่เปิดใช้งานในขณะนี้"*, EN: *"TikTok Connection is Currently Unavailable"*, ZH: *"TikTok 连接当前不可用"*).
     - Updated `TIKTOK_APP_REVIEW.md`: Documented `TIKTOK_PUBLIC_CONNECT_ENABLED` in the Environment Variables Classification table and added dedicated section explaining the two-stage deployment safety strategy (Initial Prod: Gate DISABLED; Sandbox: Gate ENABLED).
     - Added comprehensive automated unit tests covering the feature flag evaluation matrix, fail-closed route redirection, UI disabled state, and error handling.
  2. Verified internal staff surfaces remain untouched:
     - `/tiktok` (Overview) and `/tiktok/dashboard` (Performance) maintain existing session authorization boundary and operate independently.
- **Checks Run & Passed**:
  - All 537 frontend unit tests passed (`npm test`, exit 0).
  - Clean ESLint check on modified files with 0 errors and 0 warnings.
  - Frontend production build passed cleanly (`npm run build`, exit 0).
  - All 167 backend CI regression tests passed cleanly (`npx tsx --test`, exit 0).
  - Backend lint regression passed cleanly with 0 errors (`npx eslint`, exit 0).
  - Backend production build passed cleanly (`prisma generate && nest build`, exit 0).
- **Next Action**: Push commit to `origin/feat/tiktok-review-ready-integration` and monitor PR #205 GitHub Actions checks.

## 2026-09-08: Public Surface Post-Deployment Cleanup [COMPLETED]
- **Current Task**: Perform Post-Deployment Public Surface Cleanup on `/welcome` auth protection and SEO title deduplication.
- **Completed Work**:
  1. Audited `/welcome`: Classified content as internal retail operations summary and app download portal ("ระบบภายในสำหรับ OPPO Retail Operations", BM/HQ tools, APK download).
  2. Protected `/welcome` behind staff authentication boundary (`api.me()`). Anonymous requests now redirect immediately to `/login`.
  3. Fixed SEO title duplication across public pages:
     - Homepage: `OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ` (layout default)
     - Directory: `ค้นหา OPPO Brand Shop | Store Directory` (absolute title)
     - Store profile: `<Store Name> | OPPO Brand Shop` (via `%s | OPPO Brand Shop` layout template)
     - Privacy: `Privacy Policy | OPPO Brand Shop` (absolute title)
     - Terms: `Terms of Service | OPPO Brand Shop` (absolute title)
  4. Updated unit tests: `public-store-directory.test.mts`, `privacy-policy.test.mts`, `terms-of-service.test.mts`, and added `/welcome` auth boundary assertion in `route-tree-integration.test.mts`.
- **Checks Run & Passed**:
  - Frontend unit tests: 523/523 passed (`npm test`, exit 0)
  - Frontend build: Clean Turbopack compile (`npm run build`, exit 0)
  - HTML title validation: All static and dynamic outputs match target titles.
- **Next Action**: Commit changes, push branch, open PR against main, merge, and verify on production.

## 2026-09-08: Public Store Directory (Final Production Readiness Review) [COMPLETED]
- **Current Task**: Final Production Readiness Review for the Public Store Directory on branch `feat/public-store-directory`.
- **Completed Work**:
  1. Phase 1 — Public Region Normalization:
     - Implemented zero-mutation presentation normalization layer in `frontend/src/lib/public-regions.ts`.
     - Mapped legacy StoreMaster regions into standard Thai labels: `Central` (57) and `Central Thailand` (1) -> `ภาคกลาง` (58 total), `Northern` -> `ภาคเหนือ`, `Northeastern` -> `ภาคตะวันออกเฉียงเหนือ`, `Southern` -> `ภาคใต้`, `Eastern` -> `ภาคตะวันออก`, `Western` -> `ภาคตะวันตก`.
     - Deduplicated filter pills with standard ordering (`ORDERED_PUBLIC_REGIONS`), eliminating duplicate pills.
     - Implemented symmetric query matching supporting raw English and canonical Thai region queries, matching 58 stores under "ภาคกลาง".
     - Updated landing page quick discovery shortcuts to use Thai region queries matching all 6 regions.
     - Added comprehensive unit tests in `frontend/test/public-regions.test.mts` (4/4 passed).
  2. Phase 2 — Production Route Impact Audit:
     - Verified `/welcome` remains intact.
     - Verified `defaultRouteForUser` resolves to internal workspaces (`/home`, `/chats`, or `/main-oa`) and never `/`.
     - Confirmed removal of legacy `proxy.ts` does not affect session auth cookies or internal redirects.
     - Confirmed unauthenticated requests to `/home` and `/admin/stores` redirect to `/login`.
  3. Phase 3 — Public API Production Safety:
     - Verified `GET /public/stores` and `GET /public/stores/:identifier` are read-only with `@Public()`.
     - Verified `UUID_REGEX` rejection throws HTTP 404 immediately, preventing internal database ID exposure.
     - Verified `serializePublicStore` strict whitelist drops internal credentials, LINE manager URLs, BM names, and tokens.
     - Verified active-only filtering (`where: { isActive: true }`) is enforced.
     - Confirmed zero mutation routes exist under `/public/*`.
  4. Phase 4 — SEO / Public Web Review:
     - Confirmed descriptive `<title>` and metadata on root layout, `/stores`, and dynamic store profile `/stores/[identifier]`.
     - Confirmed `robots: { index: false }` is strictly isolated to internal management tools and OAuth callbacks.
     - Verified public routes (`/`, `/stores`, `/stores/[slug]`, `/privacy`, `/terms`) are indexable without unintentional `noindex` headers.
  5. Phase 5 — Test Matrix & Verification:
     - Frontend tests: `npm test` (511/511 passed, exit 0).
     - Frontend production build: `npm run build` (Clean Turbopack compile, exit 0).
     - Backend tests: `npx tsx --test src/public-stores/public-stores.spec.ts` (6/6 passed, exit 0).
     - Backend production build: `npm run build` (Clean NestJS/Prisma compile, exit 0).
     - Playwright automated route verification: anonymous and unauthenticated redirects verified.
- **Checks Run & Passed**:
  - Frontend unit tests: 511/511 passed.
  - Backend unit tests: 6/6 passed.
  - Frontend build: Exit 0.
  - Backend build: Exit 0.
  - Live Playwright checks: All passed.
- **Next Action**: Commit changes, push branch, open Pull Request against `main`, and present final report.

## 2026-09-08: Public Store Directory (Visual UX Review) [COMPLETED]
- **Current Task**: Focused Visual UX Review of the public customer website on branch `feat/public-store-directory`.
- **Completed Work**:
  1. Captured and analyzed desktop (1440px) and mobile (390px) screenshots across all key customer views:
     - Desktop Homepage (`desktop-homepage.png`)
     - Desktop Store Directory (`desktop-stores-directory.png`)
     - Desktop Full-channel Store Detail (`desktop-store-full-channel.png`)
     - Desktop Missing-channel Store Detail (`desktop-store-missing-channel.png`)
     - Mobile Homepage (`mobile-homepage-top.png`, `mobile-homepage-full.png`)
     - Mobile Store Directory (`mobile-stores-directory.png`, `mobile-stores-directory-full.png`)
     - Mobile Store Detail (`mobile-store-detail.png`, `mobile-store-detail-full.png`)
  2. Identified and repaired visual/copy defects:
     - Removed redundant `ติดต่อสาขา` link in desktop homepage header which duplicated `ค้นหาร้าน` (both pointed to `/stores`).
     - Fixed mobile header text wrapping on 390px viewports: simplified "เข้าสู่ระบบสำหรับพนักงาน" on mobile to "สำหรับพนักงาน" with `whitespace-nowrap`, eliminating awkward 2-line wraps and right-margin crowding.
     - Removed redundant active-page link to "ค้นหาร้าน" in `/stores` header nav on mobile, providing clean "หน้าแรก" and "สำหรับพนักงาน" actions instead.
     - Updated site metadata in `frontend/src/app/layout.tsx` from operational "OPPO LINE OA Monitor" to customer-facing "OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ".
     - Enhanced region and province filter pills with `min-h-[38px] inline-flex items-center justify-center` for thumb-friendly mobile touch targets.
  3. Executed automated customer journeys via Playwright:
     - Journey A (Search): Navigated from `/` to `/stores?q=Central` (81 matches found), selected store profile, verified LINE, TikTok, and Google Maps CTAs.
     - Journey B (Filters & Back Navigation): Filtered Northern region (26 stores), navigated to store profile, clicked "← สาขาทั้งหมด" back button, verified clean return to `/stores`.
- **Checks Run & Passed**:
  - Frontend unit tests: `npm test` (505/505 passed, exit 0)
  - Frontend production build: `npm run build` (Turbopack, exit 0)
  - Backend public-stores tests: `npx tsx --test src/public-stores/public-stores.spec.ts` (6/6 passed, exit 0)
  - Live journey verification via Playwright: Journeys A & B passed.
- **Next Action**: Commit changes locally to `feat/public-store-directory`.

## 2026-09-08: Public Store Directory (Pre-Visual Cleanup) [COMPLETED]
- **Current Task**: Final customer-facing copy and presentation cleanup on branch `feat/public-store-directory`.
- **Completed Work**:
  1. Removed visible "รหัสสาขา {store.id}" badge from public store profile (`/stores/[identifier]`). `externalStoreId` remains available internally in routes and APIs without exposing store codes to customers.
  2. Removed unsupported "ยอดนิยม / popular" claims from featured store section on landing page (`/`). Renamed to neutral "สำรวจ OPPO Brand Shop" with supporting copy "ดูข้อมูลสาขาและช่องทางติดต่อ".
  3. Removed unsupported official-site claims:
     - Replaced "บริการค้นหาข้อมูลร้านค้าอย่างเป็นทางการ" with "ค้นหาข้อมูลสาขาและช่องทางติดต่อ".
     - Replaced footer copy "ข้อมูลสาขาและช่องทางติดต่ออย่างเป็นทางการสำหรับผู้ใช้บริการในประเทศไทย" with "ค้นหาข้อมูลสาขาและช่องทางติดต่อ OPPO Brand Shop ทั่วประเทศไทย".
     - Verified genuine official tags like "LINE Official Account" remain preserved.
  4. Made store count dynamic: Replaced hardcoded "158 สาขา" with dynamic total from `GET /public/stores` (`ดูสาขาทั้งหมด {total} สาขา →`), gracefully falling back to "ดูสาขาทั้งหมด →" while loading with no flash of 0.
  5. Added regression test coverage in `frontend/test/public-landing-page.test.mts` and `frontend/test/public-store-directory.test.mts`.
- **Checks Run & Passed**:
  - Frontend tests: `npm test` (505/505 passed, exit 0)
  - Frontend build: `npm run build` (Exit 0)
  - Backend tests: `npx tsx --test src/public-stores/public-stores.spec.ts` (6/6 passed)
  - Live HTTP status checks: `/`, `/stores`, `/stores/[slug]`, `/login` all return 200 OK.
  - Public profile verified: Zero occurrences of "รหัสสาขา".
  - Landing page verified: Zero occurrences of "ยอดนิยม" or "บริการค้นหาข้อมูลร้านค้าอย่างเป็นทางการ".

## 2026-09-08: Public Store Directory (Phase 2 Hardening & Customer Portal) [COMPLETED]
- **Current Task**: Public Customer Experience & Contract Hardening on branch `feat/public-store-directory`.
- **Completed Work**:
  - Phase 1 Contract Hardening:
    - Strictly rejected internal `StoreMaster.id` UUID lookups on public store endpoints (returns HTTP 404). Public lookups strictly resolve via `externalStoreId` (OPPO store code) or deterministic slug (`obs-*-{storeId}`).
    - Audited and stripped `accountName` (internal LINE OA nickname) from backend DTO serializer and frontend interfaces.
    - Updated backend unit tests to verify externalStoreId, slug, and explicit UUID rejection (`src/public-stores/public-stores.spec.ts`, 6/6 passed).
  - Phase 2 Customer Landing Page & Routing:
    - Removed legacy `proxy.ts` rewrite that previously directed root traffic to internal `/welcome`.
    - Created customer-facing `PublicLandingPage` at root `/` with search bar (`/stores?q=`), quick region discovery chips, customer value props (why-use cards), featured store preview cards, and staff login link.
    - Preserved `ApplicationWorkspace` and all internal authenticated features untouched.
  - Phase 3 Store Directory Refinement:
    - Updated `/stores` (`public-stores-directory.tsx`) with URL search sync (`?q=`, `?region=`, `?province=`) on mount and debounced/instant updates via `replaceState`.
    - Wrapped directory in `<Suspense>` for safe Next.js static page generation.
    - Refined card layout: prominent store title, subtle address preview, distinct action buttons (primary green LINE OA `#06C755`, TikTok, Google Maps, and profile view).
    - Removed all `store.accountName` references.
  - Phase 4 Store Profile Refinement:
    - Refined `/stores/[identifier]` (`public-store-profile.tsx`): store code displayed as subtle reference, omitted internal account name, structured hierarchy for LINE contact CTA, basic ID copy, TikTok profile, and Google Maps.
    - Added breadcrumbs / navigation back to `/stores` and home link to `/`.
  - Phase 5 Verification & Tests:
    - Frontend unit tests updated and passing (503/503 passed, 0 failures).
    - Frontend production build succeeded (`npm run build`, exit 0).
    - Backend production build succeeded (`npm run build`, exit 0).
    - Live service verification: backend port 3001, frontend port 3000. Verified 200 responses on `/`, `/stores`, `/stores/29039`, `/stores/obs-big-c-angthong-by-oppo-29690`, `/login` and verified 404 on UUID lookups.
- **Checks Run & Passed**:
  - Backend tests: `npx tsx --test src/public-stores/public-stores.spec.ts` (6/6 passed)
  - Backend build: `npm run build` (Clean compile, exit 0)
  - Frontend tests: `npm run test` (503/503 passed, exit 0)
  - Frontend build: `npm run build` (Clean compile, exit 0)
  - Live HTTP curl checks: Validated root landing page, directory, profile by slug and externalStoreId, and UUID 404 rejection.
- **Next Action**: Commit cleanly to `feat/public-store-directory` and present final Phase 2 report.

## 2026-09-08: Public Store Directory (MVP) [COMPLETED]
- **Current Task**: Implement Public Store Directory (`/stores` and `/stores/[identifier]`) on branch `feat/public-store-directory`.
- **Completed Work**:
  - Phase 1: Repository and architecture audit of 158 StoreMaster records, classifying public-safe vs strictly internal fields (zero leaks).
  - Phase 2: Dedicated public read-only endpoints `GET /public/stores` and `GET /public/stores/:identifier` with explicit DTO serializer whitelist and deterministic slug resolution (`obs-*-{storeId}`).
  - Phase 3: Public store directory at `/stores` with search (store name, province), quick region filters, dynamic province selector, responsive store cards, and direct LINE OA / TikTok buttons.
  - Phase 4: Public store profile at `/stores/[identifier]` with store identity, LINE OA contact CTA, official TikTok profile link, Google Maps navigation, and 404 error states.
  - Phase 5: Clear public vs private separation. Unauthenticated visitors browse `/stores` and `/stores/[identifier]` without login redirect. Internal store workspace preserved at `/admin/stores`.
  - Phase 6 & 7: Empty, loading, error, and missing data states handled gracefully. Basic SEO metadata (titles and descriptions) generated cleanly.
  - Phase 8: Unit tests added for backend (`src/public-stores/public-stores.spec.ts`) and frontend (`test/public-store-directory.test.mts`).
  - Phase 9 & 10: Functional and security verification on running services (port 3000 and port 3001). Confirmed zero credential or internal field leaks.
- **Checks Run & Passed**:
  - Backend build: `npm run build` (Clean compile, exit 0)
  - Backend tests: `node --import tsx --test src/public-stores/public-stores.spec.ts` (6/6 passed)
  - Frontend build: `npm run build` (Clean Turbopack compile with static & dynamic routes, exit 0)
  - Frontend tests: `npm run test` (502/502 passed, 0 failures)
  - Live API security scan: Zero sensitive patterns in JSON payload.
  - Live routing: `/stores`, `/stores/29039`, `/stores/obs-central-phitsanulok-by-oppo-2-29039`, `/admin/stores`, `/home`, `/login` all respond 200 OK.
- **Next Action**: Commit changes to `feat/public-store-directory` and present final MVP report.


- **Current Task**: Perform controlled chunked dry run of TikTok public profile batch collector on eligible active StoreMaster stores using 20-store chunks, >=5,000ms delay, and >=60s inter-chunk pauses without `--apply`.
- **Target Population Analysis**:
  - Total active stores in StoreMaster: 158
  - Active stores with TikTok username/URL: 148
  - Active stores without TikTok handle: 10
- **Execution & Chunking**:
  - Evaluated 5 sequential chunks (100 total stores probed) with deterministic ordering (`storeName asc, id asc`):
    - Chunk 1 (offset 0, limit 20, delay 5s): 16 OK_EXACT, 1 AUDIENCE_CONTROLLED, 1 ACCOUNT_NOT_FOUND, 2 BLOCKED_OR_CHANGED.
    - Chunk 2 (offset 20, limit 20, delay 5s): 15 OK_EXACT, 1 INVALID_USERNAME, 1 ACCOUNT_NOT_FOUND, 3 BLOCKED_OR_CHANGED.
    - Chunk 3 (offset 40, limit 20, delay 5s): 19 OK_EXACT, 1 ACCOUNT_NOT_FOUND, 0 BLOCKED_OR_CHANGED.
    - Chunk 4 (offset 60, limit 20, delay 5s): 15 OK_EXACT, 1 INVALID_USERNAME, 4 BLOCKED_OR_CHANGED.
    - Chunk 5 (offset 80, limit 20, delay 7s): 7 OK_EXACT, 1 INVALID_USERNAME, 12 BLOCKED_OR_CHANGED.
  - Circuit Breakers:
    - Zero CAPTCHA challenges detected (0).
    - Zero HTTP 429 errors.
    - Zero browser crashes.
    - Zero navigation failures (`Execution context destroyed` = 0).
    - Rate throttling tripped soft blocks (`BLOCKED_OR_CHANGED` / empty hydration payload) in Chunk 5 (12/20 stores, 60%), which properly tripped the chunk failure rate limit threshold (>= 20%). Collector stopped safely after Chunk 5.
- **Aggregate Metrics (100 Stores Probed)**:
  - Selected / Probed: 100
  - OK_EXACT: 72 (72.0%)
  - AUDIENCE_CONTROLLED: 1 (1.0%)
  - ACCOUNT_NOT_FOUND: 3 (3.0%)
  - INVALID_USERNAME: 3 (3.0%)
  - BLOCKED_OR_CHANGED: 21 (21.0%)
  - PARSE_FAILED: 0
  - VERIFICATION_REQUIRED: 0
  - Database writes: 0 (`persistedCount: 0`)
  - OAuth used: NO
- **Safety Invariants**:
  - Exact metric invariant maintained across all 72 successful extractions (`metricSource === "statsV2"` and `metricPrecision === "EXACT"`).
  - No rounded counts accepted.
  - No anti-bot circumvention, CAPTCHA bypass, stealth plugins, or OAuth tokens used.
- **Next Action**: Deliver comprehensive 100-store dry run and StoreMaster data correction report to user.

- **Current Task**: Fix transient browser timing/race issue in `backend/src/tiktok/tiktok-public-profile.ts` by waiting for attached hydration elements and handling transient client-side redirects before evaluating DOM, add regression test coverage, and re-run 30-store dry run without `--apply`.
- **Implementation & Fix**:
  - Implemented `capturePageSnapshotWithSettling` awaiting `#` + script IDs with `state: "attached"`.
  - Added safe single bounded retry on `Execution context was destroyed` and empty title interim documents.
  - Added 8 unit/regression tests in `tiktok-public-profile.spec.ts` covering attached wait, execution context destroyed recovery, timeout fallback, exact vs rounded metrics, and diagnostics categorization. All 8 tests pass.
  - `nest build` compiles cleanly with 0 TypeScript errors.
- **30-Store Dry Run Comparison**:
  - `OK_EXACT`: Increased from 21 to 22 (and reached 25 in early run).
  - `PARSE_FAILED` due to destroyed execution context: Reduced from 2 to **0**.
  - `AUDIENCE_CONTROLLED`: Exactly 1 (`o_bigcaomyai`, statusCode `209002`).
  - `ACCOUNT_NOT_FOUND`: Exactly 1 (`o_bigcbangphil1`, statusCode `10221`).
  - Invalid username: Exactly 1 (`O-bigcsuratthani`, contains hyphen `-`).
  - Database mutations: 0 (`persistedCount: 0`).
  - OAuth usage: 0.
- **Next Action**: Present comparison report to user and advise on readiness before scaling to full StoreMaster dry run.


## 2026-09-07: Manual TikTok Batch Collector 10-Store Dry Run [VERIFIED]
- **Current Task**: Perform manual 10-store dry run (`--limit 10`, no `--apply`) of public TikTok profile batch collector (`backend/scripts/tiktok-public-batch.ts`) on branch `feat/tiktok-public-profile-poc`.
- **Execution & Invariant Verification**:
  - Ran `npx tsx scripts/tiktok-public-batch.ts --limit 10` without `--apply`.
  - Total selected stores: 10 active `StoreMaster` records.
  - Duration: ~63s (9 inter-store pauses of 2,500ms).
  - Successful extractions: 8/10 (`status: "OK"`).
  - Exact `statsV2` metrics: 8/8 successful stores had `metricSource: "statsV2"` and `metricPrecision: "EXACT"` with non-negative safe integers for followers, following, likes, and videos.
  - Failed extractions: 2/10 (`status: "FAILED"`):
    - `o_bigcaomyai` ("OBS Big C Aomyai FL.2 By Com7"): Creator enabled audience controls (statusCode `209002`), presenting an unauthenticated login gate.
    - `o_bigcbangphil1` ("OBS Big C Bang Phli By OPPO"): Account does not exist on TikTok (statusCode `10221`, "Couldn't find this account").
  - Safety invariants verified:
    - 0 database mutations (`persistedCount: 0`).
    - 0 OAuth/token code paths used.
    - 0 anti-bot bypass/stealth plugins or challenge solvers used.
- **Next Action**: Report structured 10-store dry run results to user and stop without proceeding to 30 stores.


## 2026-09-07: Manual TikTok Batch Collector 1-Store Dry Run [VERIFIED]
- **Current Task**: Perform manual 1-store dry run (`--limit 1`, no `--apply`) of public TikTok profile batch collector (`backend/scripts/tiktok-public-batch.ts`) on branch `feat/tiktok-public-profile-poc`.
- **Completed Work**:
  - Inspected `backend/scripts/tiktok-public-batch.ts`, `backend/src/tiktok/tiktok-public-profile.ts`, `backend/src/tiktok/tiktok-public-analytics.service.ts`, and migration `20260907153000_add_tiktok_public_analytics`.
  - Confirmed eligible active `StoreMaster` records with TikTok usernames exist in local PostgreSQL.
  - Executed manual dry run: `npx tsx scripts/tiktok-public-batch.ts --limit 1` without `--apply`.
  - Selected store: `5c5e540e-84c7-4371-b60d-ceed04c74a21` ("OBS Asawann Nongkhai By OPPO", username `o_asawannnongkhai`).
  - Successfully extracted exact `statsV2` public metrics: followers=1686, following=1219, likes=18772, videos=150.
  - Verified 0 DB writes occurred (`persistedCount: 0`).
  - Verified no OAuth or anti-bot bypass mechanisms were involved.
- **Checks Run/Passed**:
  - `tiktok-public-batch.ts --limit 1` PASSED with status `OK` and exit code 0.
  - Confirmed 0 database mutations across tables.
- **Next Action**: Report structured 1-store dry run results to user and await instruction before 10-store batch.



## 2026-09-07: Google Review Weekly KPI Production Single Cycle & Post-Recovery Verification [COMPLETED & FULLY VERIFIED]
- **Current Task**: Execute exactly ONE controlled live production cycle of Google Review Weekly KPI collector on Railway PostgreSQL following PR #174 merge, recover missing Sep 6 reviews, capture Sep 7 reviews, and verify all production invariants without mutating frozen dates or changing cron schedule.
- **Pre-Execution Baseline Verification**:
  - Week 1: CLOSED / 274 qualified reviews (455 daily rows, 65 weekly rows)
  - Week 2: OPEN / 148 qualified reviews (Sep 2 = 25, Sep 3 = 34, Sep 4 = 38, Sep 5 = 51, Sep 6 = 0, Sep 7 = 0)
  - Fingerprints: 271 total, 148 qualified
  - Active Memberships: 65
- **5-Store Dry Diagnostic on Production Config**:
  - Ran `dry-diagnostic-5stores.mjs` against Railway production PostgreSQL config.
  - Stores tested: 25610 (CentralWorld), 24365 (Rama 9), 25417 (Phuket), 27626 (Nong Khai), 26239 (Rama 3).
  - Diagnostic result: 5/5 PASSED (Limited View = false, Pane = true, Sort = Newest, Cards = 20).
  - Verified 0 DB mutations: FP = 271, Daily = 677, Weekly = 130 both before and after.
- **Single Production Cycle Results (`run-single-cycle.mjs`)**:
  - Total duration: 12.6 minutes.
  - Stores Scanned: 65/65 (Successful: 65, Confirmed Zero-Review Places: 0, Scan Failures: 0).
  - Fast-Stop Triggered (5 seen boundary): 15 stores.
  - Chronology Stop Triggered (Sep 2 boundary): 50 stores.
  - Stores with New Reviews: 64.
  - Total New Reviews Discovered: 202.
  - Total New Qualified Reviews Discovered: 96.
  - Qualified written by Review Date: `2026-09-06`: 29, `2026-09-07`: 64.
  - Qualified skipped on frozen dates: `2026-09-05`: 3.
  - Errors: 0.
- **Post-Execution Invariant Verification**:
  - Week 1: CLOSED / 274 qualified reviews (STRICTLY FROZEN & INTACT).
  - Week 2: OPEN / 241 qualified reviews:
    - 2026-09-02: 25 (FROZEN / UNCHANGED)
    - 2026-09-03: 34 (FROZEN / UNCHANGED)
    - 2026-09-04: 38 (FROZEN / UNCHANGED)
    - 2026-09-05: 51 (FROZEN / UNCHANGED)
    - 2026-09-06: 29 (RECOVERED from 0 to 29)
    - 2026-09-07: 64 (NEW TODAY)
    - Total sum: 25 + 34 + 38 + 51 + 29 + 64 = 241 (EXACT MATCH).
  - Fingerprints: 423 total (+152), 244 qualified (+96).
  - Active Memberships: 65.
  - Cron Schedule: Unchanged at `30 16 * * *` (23:30 Asia/Bangkok daily).
- **Next Action**: Report production recovery results to user and stop. No second cycle or mutations.

## 2026-09-07: Google Review Weekly KPI Maps DOM Recovery & Collector Safeguards [IMPLEMENTED & FULLY VERIFIED]
- **Current Task**: Diagnose and fix Google Review collector failure caused by Google Maps DOM layout shift and bot-defense Limited View, eliminate silent `ZERO_REVIEWS_PLACE` misclassification, implement resilient reviews discovery, and add fail-safe systemic failure guards.
- **Root Cause Confirmed**:
  - Google Maps was serving "Limited View" (`มุมมองแบบจำกัด`) for headless/unauthenticated sessions when using standard Playwright headless launch (which advertises `HeadlessChrome`), suppressing the Reviews tab and reviews feed.
  - Furthermore, `button.w8nwRe.kyuRq` (the "More / เพิ่มเติม" expand button) was causing a false positive in the initial `kyuRq` Limited View selector check.
  - The previous collector code checked only `button[role='tab']` for `รีวิว`/`review`. When absent, it silently classified the store as `ZERO_REVIEWS_PLACE`, reporting `SUCCESS` with 0 new reviews and 0 errors across 65 stores.
- **Changes Implemented**:
  - Configured standard desktop `userAgent` and automation flags in [`browser-runtime-config.mjs`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/browser-runtime-config.mjs): completely eliminates Limited View in headless mode using the dedicated `GoogleReviewKpiChromeProfile`.
  - Created [`maps-dom-helper.mjs`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/maps-dom-helper.mjs):
    - `evaluatePlaceStatus`: Detects authentic Limited View text notices, rating, tabs, cards, and review triggers without false positives from `kyuRq` expand buttons.
    - `openReviewsPane`: Multi-layered fallback (clicks review tab, clicks review triggers, distinguishes `CONFIRMED_ZERO_REVIEWS` from `ERROR_MAPS_LIMITED_VIEW_DETECTED`, `ERROR_REVIEW_CONTROL_NOT_FOUND`, `ERROR_REVIEW_PANEL_NOT_LOADED`).
    - `ensureNewestSort`: Verifies and clicks "Newest" (`ใหม่ที่สุด`), returning `ALREADY_NEWEST`, `SORTED_TO_NEWEST`, or explicit errors (`ERROR_SORT_BUTTON_NOT_FOUND`, `ERROR_NEWEST_SORT_UNVERIFIED`).
  - Updated [`continuous-collector.mjs`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/continuous-collector.mjs):
    - Replaced naive tab lookup with `openReviewsPane`, `ensureNewestSort`, and post-sort card verification.
    - Added `options.dryRun` support to enable non-mutating end-to-end continuous discovery runs.
  - Updated [`run-single-cycle.mjs`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/run-single-cycle.mjs):
    - Tracks granular outcome metrics: `successfulScans`, `confirmedZeroPlaces`, `scanFailures`, `limitedViewFailures`, `panelFailures`, `sortFailures`, `cardFailures`.
    - Fail-safe systemic abort guard: Immediately terminates cycle with exit code 1 if 5 consecutive stores fail with the same error or if the failure rate reaches $\ge 20\%$ after $\ge 10$ stores.
    - Untrusted outcomes skip writing KPI rows and mutate no daily or weekly records.
  - Added test suite [`maps-dom-recovery.spec.ts`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/maps-dom-recovery.spec.ts) (14 tests passed).
  - Added dry diagnostic suite [`dry-diagnostic-5stores.mjs`](file:///Users/chutisoa.nup/Projects/line-unified-inbox/backend/scripts/weekly-collector/dry-diagnostic-5stores.mjs).
- **Verification Results**:
  - Unit tests: 14/14 passed in `maps-dom-recovery.spec.ts`.
  - Backend tests: 1,755/1,755 passed.
  - Frontend tests: 495/495 passed.
  - Extension tests: 73/73 passed.
  - Backend build: `npm --prefix backend run build` SUCCESS.
  - Frontend build: `npm --prefix frontend run build` SUCCESS.
  - 5-Store Dry Diagnostic (Headless Mode):
    - Store 25610 (Central World): LimitedView=false, paneOpened=true, sortSuccess=true, cardsCount=20 (PASS)
    - Store 24365 (Central Rama 9): LimitedView=false, paneOpened=true, sortSuccess=true, cardsCount=20 (PASS)
    - Store 25417 (Central Phuket): LimitedView=false, paneOpened=true, sortSuccess=true, cardsCount=20 (PASS)
    - Store 27626 (Asawann Nong Khai): LimitedView=false, paneOpened=true, sortSuccess=true, cardsCount=20 (PASS)
    - Store 26239 (Central Rama 3): LimitedView=false, paneOpened=true, sortSuccess=true, cardsCount=20 (PASS)
    - Overall: 5/5 PASSED (100% success rate).
  - CentralWorld `collectStoreContinuous` Non-Mutating Diagnostic:
    - Successfully scanned 50 cards, identified 41 new reviews across Sep 7/6/5, hit fast-stop boundary on 5 consecutive previously processed fingerprints (`CONSECUTIVE_SEEN_BOUNDARY_5`).
    - Verified 0 DB mutations: Initial and final FP=200, Daily=650, Weekly=130.
  - Database invariants verified:
    - Week 1: CLOSED, 274 qualified reviews
    - Week 2: OPEN, 92 qualified reviews (Sep 2 = 25, Sep 3 = 34, Sep 4 = 33)
    - Total fingerprints: 200 (qualified: 92)
- **Next Action**: Commit progress and push branch `fix/google-review-maps-dom-recovery`, open PR to `main` without merging.

## 2026-09-06: Automatic Lightweight Re-authentication Recovery for LINE Manager Sessions [DEPLOYED & VERIFIED IN PRODUCTION]
- **Current Task**: Completed controlled production validation on `profile-b` using the admin "Try remembered login" action, followed by safe activation of automatic scheduler-triggered auth recovery (`LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED=true`).
- **Phase 0 Safety Gate**:
  - `LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED` production kill switch implemented and tested (defaults to `false`).
  - Gated in `LineChatHealthSchedulerService.runTick()`: scheduler does not run browser recovery when disabled; manual admin recovery and routine probes remain active.
- **Phase 1-4 Verification & Merge**:
  - Full test suites passed: 15/15 auth recovery specs, 253/253 line-chat specs, 1,755/1,755 backend tests, 495/495 frontend tests.
  - Builds and ESLint: all clean (0 errors, 0 warnings).
  - Feature branch: `feat/line-chat-auto-auth-recovery` (commit `d90004b4eafb551279bc63a96e07ebb9e2439132`).
  - PR #168: `feat(line-chat): automatically recover remembered LINE Manager sessions`.
  - CI: All 6 checks passed (Android, Backend, CI Gate, Frontend, mobile-adaptive-auth, web-adaptive-auth).
  - Merge SHA: `c887dd3ff819827c9c6a782b608b20e743cd65b3`.
- **Phase 5 Initial Deploy with Kill Switch Disabled (`LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED=false`)**:
  - `line-unified-inbox`: deployment `7a608e3e-3dd9-46aa-bdfc-f890da106182` (SUCCESS).
  - `line-chat-nickname-worker`: deployment `18cd047c-23b1-4ec1-870a-0950542c5bdd` (SUCCESS).
  - `frontend`: deployment `6c317bec-5e51-44c0-8cab-067ab3f6112d` (SUCCESS).
  - Production smoke tests: `/health` (200), `/health/readiness` (200), `/operations/line-chat-health` (200).
- **Phase 6 Initial Read-Only State**:
  - `profile-b`: `ACTIVE / AUTH_REQUIRED` at `MANAGER_AUTH`, `consecutiveAuthFailures: 0`, `activeLeases: 0`, jobs: `{"SUCCESS":123,"SUPERSEDED":51,"FAILED":12}`.
  - `account-1`: `ACTIVE / AUTH_REQUIRED` at `MANAGER_AUTH`, `consecutiveAuthFailures: 0`, `activeLeases: 0`, jobs: `{"SUCCESS":27,"SUPERSEDED":2,"FAILED":9}`.
- **Phase 7 Controlled Trigger on `profile-b`**:
  - Triggered via `npm run line-chat:recover-auth -- --session-key profile-b --confirm-read-only --bypass-cooldown`.
  - Execution outcome: `RECOVERED_REMEMBERED_ACCOUNT` (duration: 9,309 ms).
  - No credentials, QR, password, OTP, or CAPTCHA required or automated.
  - Read-only probe verification: `/api/v1/me` (200), mapped OA chats `/api/v2/bots/U7299.../chats?limit=1` (200).
  - `profile-b` updated to `ACTIVE / CONNECTED`, `failureStage: null`.
  - Zero historical failed jobs retried.
- **Phase 10 Automatic Recovery Activated (`LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED=true`)**:
  - Configured on `line-chat-nickname-worker` (deployment `1541533b-b7c6-473d-8556-177a41521118`, SUCCESS) and `line-unified-inbox` (deployment `fd6cc06e-ed33-45b2-b618-3e0084c2ae50`, SUCCESS).
  - Allowed normal scheduler cycle: scheduler safely processed degraded `account-1`, detected single remembered LINE account, clicked login, and recovered it to `CONNECTED` in 10,998 ms.
  - Live incoming job `b79bf2df-8079-4bba-a4df-4464bd4dc3ef` for `profile-b` immediately claimed and updated to `SUCCESS` (HTTP 200).
  - All profile leases released (`activeLeases: 0`). Zero stuck leases.
  - Cooldown active; no duplicate recovery launched.
- **Next Action**: Provide complete final report to the user.

- **Current Task**: Deploy the confirmed LINE Chat nickname $\le 20$-character fix to production, verify session health, preview and execute a controlled retry of the 7 remaining failed Profile B jobs, and observe execution until terminal state.
- **Root Cause Resolved**: LINE Official Account Chat enforces a hard maximum length of 20 characters on customer nicknames. Nicknames $>20$ characters failed with HTTP 400.
- **Production Deployments Confirmed**:
  - `line-unified-inbox`: deployment `1a3a276d-34cd-4be9-8ba1-690af3208f03` (SUCCESS).
  - `line-chat-nickname-worker`: deployment `2b0ac942-b669-4f50-ada7-e2721b0ef87e` (SUCCESS).
  - Commit SHA: `ec12717d08110d6d5fec7d3b0981daaa49d16e3b` (PR #167).
  - Production smoke tests: `/health` (200), `/health/readiness` (200).
  - Verified constants: `MAX_LINE_CHAT_NICKNAME_LENGTH = 20`, HTTP 400 categorized as `VALIDATION`.
- **Pre-Retry Safety & Isolation**:
  - `profile-b`: `ACTIVE / CONNECTED`, `consecutiveAuthFailures: 0`, `activeLeases: 0`.
  - `account-1`: `ACTIVE / CONNECTED`, `consecutiveAuthFailures: 0`, `activeLeases: 0` (strictly untouched).
- **Controlled Retry Results (all 7 Profile B jobs)**:
  - `ec47d25b`: `"Reno16 F 5G ผ่อน 09/26"` (22) $\to$ `"Reno16 F ผ่อน 09/26"` (19) $\to$ **SUCCESS** (11:18:10Z)
  - `073f1e66`: `"Reno16 Pro 5G ผ่อน 09/26"` (24) $\to$ `"Reno16Pro ผ่อน 09/26"` (20) $\to$ **SUCCESS** (11:18:13Z)
  - `f86f7d9c`: `"Reno16 Pro 5G ผ่อน 09/26"` (24) $\to$ `"Reno16Pro ผ่อน 09/26"` (20) $\to$ **SUCCESS** (11:18:16Z)
  - `043e8147`: `"Reno16 Pro 5G สด 09/26"` (22) $\to$ `"Reno16 Pro สด 09/26"` (19) $\to$ **SUCCESS** (11:18:19Z)
  - `d741f54e`: `"Reno16 Pro 5G ผ่อน 09/26"` (24) $\to$ `"Reno16Pro ผ่อน 09/26"` (20) $\to$ **SUCCESS** (11:18:23Z)
  - `74bf1ba6`: `"Reno16 Pro 5G ผ่อน 09/26"` (24) $\to$ `"Reno16Pro ผ่อน 09/26"` (20) $\to$ **SUCCESS** (11:18:26Z)
  - `93d03176`: `"Reno16 Pro 5G ผ่อน 09/26"` (24) $\to$ `"Reno16Pro ผ่อน 09/26"` (20) $\to$ **SUCCESS** (11:18:29Z)
- **Final Readback State**:
  - `profile-b`: **SUCCESS: 112** (+7), **SUPERSEDED: 51**, **FAILED: 0** (down from 7), **PENDING: 0**, **PROCESSING: 0**. Status remains `ACTIVE / CONNECTED`.
  - `account-1`: **SUCCESS: 22**, **SUPERSEDED: 2**, **FAILED: 11**, **PENDING: 0**, **PROCESSING: 0** (100% untouched). Status remains `ACTIVE / CONNECTED`.
  - Unrelated services, configs, and APK assets remain untouched.

## 2026-09-05: LINE Chat Nickname 20-Character Limit & HTTP 400 Classification Fix [COMPLETED & VERIFIED]
- **Current Task**: Implement the confirmed LINE Chat nickname length fix ($\le 20$ characters) across the backend with deterministic compaction preserving model identity, payment method (`สด` / `ผ่อน`), and month/year (`MM/YY`), and improve HTTP 400 error classification as `VALIDATION` / `MANUAL_REVIEW`.
- **Root Cause Confirmed**: LINE Official Account Chat (`chat.line.biz`) enforces a hard maximum length of 20 characters on customer nicknames. Nicknames $>20$ characters fail with HTTP 400 Bad Request.
- **Compaction Flow Implemented (`backend/src/line-chat-nickname.ts`)**:
  - `MAX_LINE_CHAT_NICKNAME_LENGTH = 20`.
  - 1. If `${model}${suffix}.length <= 20`: return unchanged.
  - 2. If $>20$: remove redundant network suffix `(?:\s*\(5g\)|(?:\s+|-|_)5g\b)` (e.g. `"Reno16 F 5G"` $\to$ `"Reno16 F"`).
  - 3. If still $>20$: remove unnecessary symbols `[+()]`.
  - 4. If still $>20$: compact whitespace inside model name only (e.g. `"Reno16 Pro"` $\to$ `"Reno16Pro"`).
  - 5. If still $>20$: truncate ONLY model portion to available budget (`20 - suffix.length`).
  - Preserves payment label (`สด`/`ผ่อน`) and `MM/YY` completely intact.
- **Error Classification Improvement**:
  - `backend/src/line-chat/line-chat-session.service.ts`: returns sanitized `LINE chat nickname rejected: HTTP 400 (NICKNAME_VALIDATION_FAILED)` without leaking response bodies.
  - `backend/src/line-chat/line-chat-nickname-worker.service.ts`: maps status 400 to `LINE_NICKNAME_VALIDATION_FAILED`.
  - `backend/src/line-chat/line-chat-operations.service.ts`: `classifyLineChatJobFailure` maps `HTTP 400`, `400`, `NICKNAME_VALIDATION_FAILED`, and `NICKNAME_LENGTH_EXCEEDED` to `VALIDATION` (`action: "MANUAL_REVIEW"`, `isAutoFixable: false`).
- **Safety Boundaries Enforced**:
  - Zero production jobs retried. Zero production mutations. No session/profile changes. Zero deployment.
- **Verification Results**:
  - Targeted unit tests: 87/87 passing.
  - Full backend test suite: 1,735 / 1,735 passing.
  - Targeted eslint: 0 errors, 0 warnings.
  - Backend build: succeeded (0 errors).
  - Simulation of 7 failed production jobs: all 7 successfully compact to $\le 20$ characters.
- **Next Action**: Report results to user for review.

## 2026-09-05: Google Review Weekly Leaderboard Export (XLSX & CSV) [COMPLETED & VERIFIED]
- **Current Task**: Add a production-safe Download / Export feature (Excel `.xlsx` and CSV `.csv`) to the Weekly Top Store Leaderboard on `https://lineoppo.click/google-review-kpi`.
- **Safety Boundaries & Invariants Enforced**:
  - Export the currently selected week only (Week 1 or Week 2), containing all 65 weekly focus stores.
  - Zero mutation of review fingerprints, historical counts, or leaderboard ranking logic.
  - Authentication boundary preserved: protected under `@UseGuards(AuthGuard)` with full role compatibility.
  - Week 1 historical verified invariant strictly preserved (274 qualified reviews, CLOSED).
  - Week 2 live data strictly preserved (OPEN).
  - Future/uncollected dates in an OPEN week export as blank cells in Excel and empty strings in CSV (never fabricated zeros), while genuine recorded zeros are strictly preserved.
- **Completed Actions**:
  - `backend/`:
    - Replaced `xlsx` with `exceljs` library for robust spreadsheet formatting.
    - Added `ExportWeeklyLeaderboardDto` in `src/google-review-kpi/google-review-kpi.dto.ts`.
    - Added `exportWeeklyLeaderboard` in `src/google-review-kpi/google-review-kpi.service.ts`:
      - Reuses `getWeeklyLeaderboard` as source of truth for all 65 stores and deterministic ranking.
      - Calculates 7 daily date columns dynamically from Bangkok start date.
      - Daily KPI mapping: genuine recorded daily records preserve their `qualifiedReviews` count (including 0); future/uncollected dates are set to `null` (blank cell in Excel, empty in CSV).
      - Generates Excel workbook (`.xlsx`) using `exceljs` with "Weekly KPI" sheet, frozen row 1 (`views: [{ state: "frozen", ySplit: 1 }]`), bold header row (`row.font = { bold: true }`), auto-fit column widths, autofilter, and numeric ratio formatted percentage for Achievement % (`numFmt = "0.0%"`).
      - Generates UTF-8 CSV (`.csv`) with BOM (`\uFEFF`) and proper RFC4180 escaping for Windows Excel compatibility with Thai characters.
      - Deterministic filename format: `google-review-kpi-week-${weekNumber}_${startRange}_to_${endRange}.${format}`.
    - Added `GET /google-review-kpi/weekly/export` route in `src/google-review-kpi/google-review-kpi.controller.ts`.
    - Added unit test suite `src/google-review-kpi/google-review-weekly-export.spec.ts` testing freeze, bold headers, numeric percentages, blank future dates, recorded zeros, and UTF-8 BOM.
  - `frontend/`:
    - Added `downloadGoogleReviewWeeklyExport` in `src/lib/api.ts` using existing `download()` blob utility.
    - Updated `src/app/google-review-kpi/google-review-kpi-view.tsx` with:
      - Trilingual translations (`downloadBtn`, `downloadExcel`, `downloadCsv`, `downloading`, `downloadError`).
      - Download dropdown menu button beside `Sync 65 Store Set` and `Refresh Data`.
      - Safe client-side blob download trigger without page reload.
      - Loading spinner and error state handling.
    - Added UI and API integration test assertions in `frontend/test/google-review-kpi.test.mts`.
- **Verification Results**:
  - Backend tests: 1,727 / 1,727 passing (`npm --prefix backend test`).
  - Frontend tests: 495 / 495 passing (`npm --prefix frontend test`).
  - Backend production build: `npm --prefix backend run build` succeeded (0 errors).
  - Frontend production build: `npm --prefix frontend run build` succeeded (0 errors).

## 2026-09-05: LINE Chat Session account-1 Safe Authentication Recovery [COMPLETED & VERIFIED]
- **Current Task**: Recover production LINE Chat session `account-1` (`LINE Manager Account 1`, mapped to 6 OAs) from `ACTIVE / AUTH_REQUIRED / MANAGER_AUTH` to `ACTIVE / CONNECTED` (`healthFailureStage = null`, `consecutiveAuthFailures = 0`), and resume its 6 mapped OAs without retrying failed jobs or touching Profile B.
- **Safety Boundaries & Invariants Enforced**:
  - `profile-b` (`OPPO BS RBS Chonburi`, Store 28375) strictly preserved untouched (`ACTIVE / CONNECTED`, `consecutiveAuthFailures: 0`, 1 mapped / 1 enabled OA).
  - Failed jobs preserved untouched (zero failed jobs retried; `account-1` has 11 FAILED, 2 SUPERSEDED, 22 SUCCESS; `profile-b` has 7 FAILED, 51 SUPERSEDED, 105 SUCCESS).
  - Zero automation of credentials, passwords, OTP, QR, or 2FA. Operator authenticated manually via visible Chromium desktop window.
  - Safe quiesce: all 6 `account-1` OAs temporarily paused during re-auth (`lineChatNicknameSyncEnabled: false`). Verified 0 active leases, 0 processing jobs.
  - Pre-reauth volume snapshot preserved: `/data/line-chat-profiles/account-1-v1-backup-before-reauth-20260905`. Prior backup preserved: `/data/line-chat-profiles/account-1-v1-backup-before-reauth-20260904`.
- **Completed Actions**:
  - Launched visible Chromium browser targeting existing persistent profile `backend/local-data/line-chat-profiles/account-1-v1` at `https://chat.line.biz/`.
  - Operator completed manual interactive login and access to LINE OA Manager / Chat was verified.
  - Extracted fresh session storage state cleanly via Playwright `context.storageState()`.
  - Injected cookies natively into `/data/line-chat-profiles/account-1-v1` on `line-chat-nickname-worker` container using Linux Playwright CDP (`context.addCookies()`), ensuring correct Linux OSCrypt persistence.
  - Verified API authentication on worker: `GET https://chat.line.biz/api/v1/me` returned HTTP 200 with user profile JSON; `GET https://chat.line.biz/api/v2/bots/U57f2de3eaa032f5226d75146ce6db483/chats?limit=1` returned HTTP 200 with chat list envelope.
  - Cleaned up temporary storage state files locally and remotely; verified zero `Singleton*` lock files.
  - Executed official manual session probe CLI: `node dist/line-chat/line-chat-health-probe.cli.js --session-key account-1 --confirm-read-only` -> `RECORDED`, `status: CONNECTED`, `failureStage: null`, duration 2,802ms.
  - Executed official manual OA probes across all 6 mapped OAs: all 6 returned `status: CONNECTED`, `failureStage: null`.
  - Executed subsequent session health probe: `RECORDED`, `status: CONNECTED`, `failureStage: null`, `duration: 2,783ms`.
  - Resumed `account-1` OAs: re-enabled all 6 mapped OAs (`lineChatNicknameSyncEnabled: true`).
- **Final Readback State**:
  - `account-1` session: `status: ACTIVE`, `healthStatus: CONNECTED`, `healthFailureStage: null`, `consecutiveAuthFailures: 0`, `profileOperationLease: null`.
  - `account-1` OAs: 6 mapped, 6 enabled, all 6 `healthStatus: CONNECTED`, `healthFailureStage: null`.
  - `profile-b` session: `status: ACTIVE`, `healthStatus: CONNECTED`, `healthFailureStage: null`, `consecutiveAuthFailures: 0`, `profileOperationLease: null` (100% untouched).
  - `profile-b` OAs: 1 mapped, 1 enabled, `healthStatus: CONNECTED`, `healthFailureStage: null`.
  - Failed jobs: zero retried. Account-1 failed count = 11, Profile B failed count = 7.

## 2026-09-05: Actionable Failed-Job Handling on LINE Chat Operations Health Dashboard [COMPLETED & VERIFIED]
- **Current Task**: Implement actionable failed-job handling for the LINE Chat Operations Health dashboard (`/operations/line-chat-health`).
  - Clicking failed count/badge opens detail modal with safe fields only (`jobId`, `oaId`, `oaName`, `failureCategory`, `failureStage`, `attemptCount`, `createdAt`, `updatedAt`, `conversationId`, `recommendedAction`, `isAutoFixable`). Zero exposure of customer names, nicknames, message text, tokens, or credentials.
  - Recommended action classification: `AUTHENTICATION` -> `RE_LOGIN_REQUIRED`, `TRANSPORT`/`TIMEOUT` -> `RETRY_RECOMMENDED` (auto-fixable), `EXECUTION` -> `RETRY_OR_INSPECT` (attemptCount < 2 auto-fixable; attemptCount >= 2 -> `MANUAL_REVIEW`), `VALIDATION` -> `MANUAL_REVIEW`, `PROFILE_LOCK`/`COORDINATOR` -> `SYSTEM_ATTENTION`, `UNKNOWN` -> `INVESTIGATE`.
  - Grouped summary metrics: `Total Failed`, `Auto-fixable`, `Manual review`, `System attention` with category filter chips (`All`, `Auto-fixable`, `Manual review`, `Authentication`, `System attention`).
  - Safe navigation: "View in Chat" linking to `/chats?conversationId=${encodeURIComponent(failure.conversationId)}` only when safe internal reference exists.
  - "Retry selected" with checkbox selection (non-retryable unselected by default) and confirmation modal showing category breakdown and non-retryable warnings.
  - "Fix retryable failures" with preview modal showing exact counts, server-side re-validation, and scoped retry.
  - Strict account isolation: operations on `sessionKey` cannot touch other profiles (e.g. `account-1`).
- **Completed Actions**:
  - `backend/src/line-chat/line-chat-operations.service.ts`:
    - Added `LineChatRecommendedAction`, `getRecommendedAction`, updated `LineChatSafeJobFailure`.
    - Added `retrySelectedJobs` and `fixRetryableFailures` with server-side category and status re-validation, execution attempt tracking, and session OA isolation.
    - Updated `getHealthSummary()` to select `conversationId`, map `recommendedAction` and `isAutoFixable`.
  - `backend/src/line-chat/line-chat-operations.controller.ts`:
    - Added `RetrySelectedJobsDto`, `FixRetryableJobsDto` with class-validator.
    - Added `@Post("retry-selected")` and `@Post("fix-retryable")` guarded with `AuthGuard` and `ADMIN` role.
  - `frontend/src/lib/api.ts`:
    - Added `LineChatRecommendedAction`, updated `LineChatSafeJobFailure`, added `retryLineChatSelectedJobs` and `fixLineChatRetryableJobs`.
  - `frontend/src/app/operations/line-chat-health/line-chat-health-view.tsx`:
    - Implemented clickable failed badge opening Failed Jobs Detail Modal.
    - Added summary metrics cards (`Total Failed`, `Auto-fixable`, `Manual review`, `System attention`).
    - Added filter chips (`All`, `Auto-fixable`, `Manual review`, `Authentication`, `System attention`) with select-all toggle.
    - Rendered safe job failure cards with safe navigation link to `/chats?conversationId=...`.
    - Implemented "Fix retryable failures" preview modal and confirmation.
    - Implemented "Retry selected" confirmation dialog with breakdown and non-retryable override option.
  - **Verification Results**:
    - Backend tests: 9/9 passing (`src/line-chat/line-chat-operations.spec.ts`, `src/line-chat/line-chat-operations-auth.spec.ts`). Full backend suite: 1,725 / 1,725 passing.
    - Backend build: `npm run build` succeeded (0 errors).
    - Backend lint: `npx eslint` passed (0 errors, 0 warnings).
    - Frontend tests: 9/9 passing (`test/line-chat-health.test.mts`).
    - Frontend build: `npm run build` succeeded (0 errors).
    - Frontend lint: `npx eslint` passed (0 errors, 0 warnings).
- **Blockers**: None.
- **Next Action**: Present verified solution to user.

## 2026-09-05: LINE Chat Profile B Safe Authentication Recovery & Queue Resumption [COMPLETED & VERIFIED]
- **Current Task**: Recover LINE Chat Profile B (`sessionKey: profile-b`) authentication in production safely. Transition Profile B from `ACTIVE / AUTH_REQUIRED / MANAGER_AUTH` to `ACTIVE / CONNECTED` (`healthFailureStage = null`, `consecutiveAuthFailures = 0`), review 80 failed jobs, requeue, and safely resume without touching `account-1`.
- **Pre-flight & Boundaries Enforced**:
  - `account-1` strictly preserved untouched (`ACTIVE / CONNECTED`, `consecutiveAuthFailures: 0`).
  - Pre-reauth safety backup created on Railway persistent volume: `/data/line-chat-profiles/profile-b-linux-v2-backup-before-reauth-20260905`.
  - Quiesced Profile B OA (`OPPO BS RBS Chonburi`, `4ec394cb-81ee-452e-966a-24cd88d0e18e`) by setting `lineChatNicknameSyncEnabled: false`. Confirmed 0 active leases.
- **Completed Actions**:
  - Re-authenticated Profile B via `npm run line-chat:login` with operator interactive login in visible Chromium.
  - Exported fresh decrypted session storage state from local profile.
  - Injected cookies natively into `/data/line-chat-profiles/profile-b-linux-v2` using Linux Playwright on the worker container, ensuring correct Linux OSCrypt persistence and zero locks.
  - Verified API authentication on worker: `GET https://chat.line.biz/api/v1/me` returned HTTP 200, `GET https://chat.line.biz/api/v2/bots/U729972869a565723cb7fcf7ea28bbc43/chats?limit=1` returned HTTP 200 with valid chat list envelope.
  - Cleaned up temporary transfer files and verified absence of Singleton locks.
  - Executed official session health probe CLI: `node dist/line-chat/line-chat-health-probe.cli.js --session-key profile-b --confirm-read-only` -> `RECORDED`, `status: CONNECTED`, `failureStage: null`, duration 2,905ms.
  - Executed official OA health probe CLI: `node dist/line-chat/line-chat-oa-health-probe.cli.js --oa-id 4ec394cb-81ee-452e-966a-24cd88d0e18e --confirm-read-only` -> `RECORDED`, `status: CONNECTED`, `failureStage: null`, duration 3,242ms.
  - Evaluated 80 historical failed jobs: classified failure categories (56 TRANSPORT/TIMEOUT, 14 VALIDATION, 5 COORDINATOR, 5 EXECUTION). Zero FAILED_AUTH.
  - Scoped requeue executed exclusively on Profile B OA (`lineOfficialAccountId: 4ec394cb-81ee-452e-966a-24cd88d0e18e`): 80 jobs updated to PENDING (`attemptCount: 0`).
  - Resumed Profile B OA sync: `lineChatNicknameSyncEnabled = true`.
  - Monitored live worker processing: confirmed jobs claimed, recent-chat resolver resolving (`recentChatCount: 125`), nickname mutations succeeding (HTTP 200), superseded duplicates safely retired, and zero auth failures.
- **Final Readback State**:
  - Profile B session: `status: ACTIVE`, `healthStatus: CONNECTED`, `healthFailureStage: null`, `consecutiveAuthFailures: 0`, `healthLastHttpStatus: 200`.
  - account-1 session: `status: ACTIVE`, `healthStatus: CONNECTED`, `healthFailureStage: null`, `consecutiveAuthFailures: 0` (100% untouched).
  - Profile B OA (`OPPO BS RBS Chonburi`): `lineChatNicknameSyncEnabled: true`, `healthStatus: CONNECTED`.

## 2026-09-05: Dynamic Asia/Bangkok Date Classifier for Google Review Continuous Collector [COMPLETED & VERIFIED]
- **Current Task**: Resolve blocker in PR #156 by replacing hardcoded `2026-09-04` reference date with dynamic `Asia/Bangkok` date computation.
- **Changes**:
  - Refactored `backend/scripts/weekly-collector/date-classifier.mjs` to dynamically compute current date in `Asia/Bangkok` timezone (`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" })`).
  - Added deterministic date math via UTC noon offsets (`offsetBangkokDate`) preventing DST/local-time drift.
  - Dynamically resolved relative dates (`today`, `yesterday`, `N days ago`, hours/minutes/seconds ago) relative to current Bangkok day.
  - Preserved Week 2 candidate boundaries (`[2026-09-02, 2026-09-09)`) and stop boundaries (`OLDER_THAN_WEEK2` for dates before `2026-09-02`).
  - Updated `backend/scripts/weekly-collector/continuous-collector.mjs` to pass dynamic Bangkok date.
  - Added unit test suite `backend/scripts/weekly-collector/date-classifier.spec.ts` (18/18 tests passing).
  - Executed Playwright Linux container rebuild and 11-point smoke test.
  - Verified database invariants: Week 1 = 274, Week 2 = 92 (Sep 2 = 25, Sep 3 = 34, Sep 4 = 33), Week 3 = 0.

- **Current Task**: Build dedicated Playwright-based Dockerfile (`backend/Dockerfile.google-review-collector`) for Google Review Continuous Collector Railway cron service.
- **Changes**:
  - Created `backend/Dockerfile.google-review-collector` based on `mcr.microsoft.com/playwright:v1.50.0-noble`.
  - Configured workspace layer structure preserving relative path resolution for `tools/google-review-checker-extension/src/`.
  - Set container runtime defaults: `NODE_ENV=production`, `NODE_OPTIONS="--experimental-strip-types"`, `GOOGLE_REVIEW_HEADLESS=true`, `GOOGLE_REVIEW_PROFILE_DIR=/tmp/google-review-kpi-profile`.
  - Packaged standalone `backend/scripts/weekly-collector/date-classifier.mjs` resolving self-contained date classification without missing backfill dependencies.
  - Executed 10/10 container smoke tests: Node v22, Prisma Client 78 models, Thai word segmentation, date parsing, Linux sandbox launch flags, headless Chromium rendering.
  - Target command: `node scripts/weekly-collector/run-single-cycle.mjs` (runs exactly 1 cycle across 65 stores and exits; does not run baseline seeding or infinite loop).
  - Preserved Week 1/Week 2 historical invariants (Week 1 = 274, Week 2 = 92).

## 2026-09-04: Google Review Collector Runtime Config for Railway/Linux [COMPLETED & VERIFIED]
- **Current Task**: Make persistent Chrome profile directory, headless mode, and Chromium launch arguments configurable for Linux/Railway container environments.
- **Changes**:
  - Created `backend/scripts/weekly-collector/browser-runtime-config.mjs` resolving `GOOGLE_REVIEW_PROFILE_DIR` (falling back to Mac path on darwin or `/tmp/google-review-kpi-profile` on Linux/containers).
  - Configurable headless mode via `GOOGLE_REVIEW_HEADLESS` (defaulting to `true` in Railway/CI/Linux and `false` on macOS local dev).
  - Injected container-safe args (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) when running in Linux/Railway.
  - Added unit test suite `backend/scripts/weekly-collector/browser-runtime-config.spec.ts` (12/12 passing).
  - Verified Week 1/Week 2 historical invariants remain untouched (Week 1 = 274, Week 2 = 92).

## 2026-09-04: Daily Continuous Tracking for Weekly Google Review KPI (65 Stores) [COMPLETED & VERIFIED]
- **Current Task**: Transition Weekly Google Review KPI from historical backfill to Daily Continuous Tracking for 65 Focus Stores.
- **Scope & Baseline Invariants**:
  - Reference Date: `2026-09-04 Asia/Bangkok` (UTC+7).
  - Week 1 (`26.08-02.09.2026`): **CLOSED**, Total Qualified = **274** (455 daily rows, 65 weekly rows) — STRICT INVARIANT: VERIFIED UNTOUCHED.
  - Week 2 (`02-09.09.2026`): **OPEN**, Accumulated Qualified = **92** (`02/09` = 25 CLOSED, `03/09` = 34 CLOSED, `04/09` = 33 OPEN) — VERIFIED UNCHANGED.
  - Week 3: **NOT STARTED** (0 records) — VERIFIED 0 RECORDS.
- **Completed Implementations**:
  1. **Prisma Model**: `GoogleReviewFingerprint` with `storeCode`, `fingerprint` (HMAC-SHA256 hex, zero PII), `isQualified`, `reviewDate`, `weekNumber`, `firstSeenAt`.
  2. **Baseline Seeding**: Executed across all 65 Focus Stores, recording exactly 199 fingerprints (92 qualified).
  3. **Continuous Collector Engine**: `backend/scripts/weekly-collector/continuous-collector.mjs` & `run-single-cycle.mjs`:
     - Sort verification (`Sort = ใหม่ที่สุด`).
     - Fast stop boundary: 5 consecutive previously-seen reviews stops scan immediately (`CONSECUTIVE_SEEN_BOUNDARY_5`).
     - Chronology stop: non-Week 2 dates terminate scan immediately (`STOP_CHRONOLOGY_OLDER_THAN_WEEK2`).
     - Qualification engine: `!isEdited`, customer photo exists, Thai word count >= 15, rating > 4.8.
     - Added npm script `"google-review:weekly-collector": "node scripts/weekly-collector/run-single-cycle.mjs"`.
  4. **Backend API**:
     - `GET /google-review-kpi/weekly/collector-status` returns tracked fingerprints, live run status, last run timestamp, and today's summary.
  5. **Frontend UI**:
     - Added Daily Continuous Review Discovery status card on `/google-review-kpi` (Weekly Top Store tab).
  6. **Controlled Live Cycle**:
     - Successfully executed across all 65 stores in 9.5 minutes.
     - 11 stores reached fast-stop threshold (5 seen boundary).
     - 54 stores reached older chronology stop (Sep 2 boundary).
     - 0 errors, 0 invariant breaches.
     - Verified: Week 1 remains 274, Week 2 remains 92 (Sep 4 = 33).
     - STOPPED and waiting for operator review before activating unattended scheduler.
- **Verification Status**:
  - Backend unit tests: **1,690 / 1,690 passed**.
  - Frontend unit tests: **485 / 485 passed**.
  - Chrome extension unit tests: **73 / 73 passed**.
  - Frontend build: **Passed (0 errors)**.
  - Backend build: **Passed (0 errors)**.

## 2026-09-04: Historical Weekly Google Review KPI Backfill — Week 2 Only [COMPLETED & VERIFIED]
- **Current Task**: Execute Historical Weekly Google Review KPI backfill for **WEEK 2 ONLY** across the 65 Weekly KPI focus stores. Week 1 remains completely untouched; Week 3 not started.
- **Target Period**: `第二周 สัปดาห์ที่ 2 (02-09.09.2026)` (Bangkok `[2026-09-02 00:00:00+07:00, 2026-09-09 00:00:00+07:00)`).
- **Period & Freeze Policy**: Week 2 is currently active/open; Period status remains strictly **`OPEN`** (unfrozen).
- **Date Population**: Populated dates are `2026-09-02` (CLOSED), `2026-09-03` (CLOSED), and `2026-09-04` (OPEN live date). Future dates (`05/09–08/09`) remain empty `-` and unpopulated.
- **Rules Applied**:
  - Review Chronology source of truth (Newest order verified before extraction).
  - Candidates: today (Sep 4), 1 day ago (Sep 3), 2 days ago (Sep 2).
  - Stop condition: Terminate store scan immediately when a non-edited review is older than Sep 2, 2026 (e.g. 3 days ago / Sep 1, 1 week ago).
  - Qualification: `hasCustomerPhoto === true`, `isEdited === false`, `finalWordCount >= 15`, `storeRating > 4.8`.
  - Sequential single-tab execution in dedicated Chrome profile session.
- **Audit Execution & Readback Results**:
  - Stores Attempted: **65 / 65** (100%)
  - Stores Completed: **65 / 65** (100%)
  - Stores Needing Attention: **0** (Remediated transient redirect for store 31736 cleanly)
  - Stores Failed: **0**
  - Total Reviews Checked: **199**
  - Total Reviews with Customer Photo: **115**
  - Total Reviews with >= 15 Thai Words: **98**
  - Total Qualified Reviews for Week 2 so far: **92**
  - Daily Totals:
    - `02/09` (Sep 2): **25**
    - `03/09` (Sep 3): **34**
    - `04/09` (Sep 4 live): **33**
  - historicalUnresolvedDayCount: **0** (all Week 2 candidates mapped to exact days 02, 03, 04)
  - Passed Stores so far (Qualified >= 10 & Rating > 4.8): **1**
    - #1 Store `25610` (*OBS Central World FL.4 By OPPO*): **10 qualified**, rating: 4.9
  - Below Target Stores so far: **64**
  - Total Execution Duration: **11.1 minutes**
  - Database Persistence: 195 daily KPI rows (65 stores × 3 days) and 65 weekly KPI rows written to PostgreSQL.
  - Invariant Verification:
    - **Week 1 data verified UNCHANGED**: 455 daily rows, 65 weekly rows, 274 total qualified reviews intact.
    - **Week 2 Period status verified OPEN**: `status: OPEN`, `frozenAt: null`.
    - **Week 3 verified NOT STARTED**: 0 daily rows, 0 weekly rows.
- **Verification Status**:
  - Backend unit test suite: **1,688 / 1,688 passed**.
  - Chrome Extension unit test suite: **73 / 73 passed**.
  - Frontend production build: **Passed (0 errors)**.

## 2026-09-04: Historical Weekly Google Review KPI Backfill — Week 1 Only [COMPLETED & VERIFIED]
- **Current Task**: Execute Historical Weekly Google Review KPI backfill for **WEEK 1 ONLY** across the 65 Weekly KPI focus stores. Week 2 remains completely untouched.
- **Target Period**: `第一周 สัปดาห์ที่ 1 (26.08-02.09.2026)` (Bangkok `[2026-08-26 00:00:00+07:00, 2026-09-02 00:00:00+07:00)`).
- **Rules Applied**:
  - Review Chronology source of truth (Newest order verified before extraction).
  - Candidates: 3-6 days ago (Sep 1, Aug 31, Aug 30, Aug 29) + 1 week ago (unresolved candidate across range).
  - Stop condition: Terminate store scan immediately when a non-edited review's chronology is older than August 26, 2026 (e.g. 2 weeks ago, 2 months ago).
  - Qualification: `hasCustomerPhoto === true`, `isEdited === false`, `finalWordCount >= 15` (prefix merge & noise excluded), `storeRating > 4.8`.
  - Sequential single-tab execution in dedicated Chrome profile session.
- **Audit Execution & Readback Results**:
  - Stores Attempted: **65 / 65** (100%)
  - Stores Completed: **65 / 65** (100%)
  - Stores Needing Attention: **0**
  - Total Reviews Checked: **606**
  - Total Reviews with Customer Photo: **370**
  - Total Reviews with >= 15 Thai Words: **287**
  - Total Qualified Reviews: **274**
  - Passed Stores (Qualified >= 10 & Rating > 4.8): **4**
    - #1 Store `28375` (*OBS Robinson Chonburi By OPPO*): **23 qualified**, rating: 5.0
    - #2 Store `18127` (*OBS Imperial World Samrong FL.4 By OPPO 1*): **21 qualified**, rating: 5.0
    - #3 Store `25610` (*OBS Central World FL.4 By OPPO*): **15 qualified**, rating: 4.9
    - #4 Store `30606` (*OBS Central Suratthani FL.2 By OPPO 2*): **12 qualified**, rating: 5.0
  - Below Target Stores: **61**
  - Total Execution Duration: **12.6 minutes**
  - Database Persistence: 455 daily KPI rows and 65 weekly KPI rows written to PostgreSQL.
  - Invariant Verification: **Week 2 has NOT been started** (0 daily records, 0 weekly records).
- **Verification Status**:
  - Backend unit test suite: **1,688 / 1,688 passed**.
  - Chrome Extension unit test suite: **73 / 73 passed**.
  - Frontend production build: **Passed (0 errors)**.

## 2026-09-04: Weekly Google Review KPI Store Set & StoreMaster Full Sync [COMPLETED & VERIFIED]
- **Current Task**: Re-sync StoreMaster from canonical Google Sheet, ensure all 65 Weekly KPI stores are cleanly mapped with zero duplicates, verify Google Maps URLs for all 65 stores, update Weekly Top Store UI with exact 7-day columns and 5 summary cards, and verify CentralWorld reference regression baselines.
- **Rules & Invariants Enforced**:
  - `Store Code` / `externalStoreId` used as canonical mapping key (zero duplicate Store or StoreMaster rows).
  - Qualification criteria for Weekly Top Store: `storeRating > 4.8`, `isEdited === false`, genuine customer photo attached, `finalWordCount >= 15`.
  - Continuous 7-day Bangkok timezone week periods starting from `2026-08-26T00:00:00+07:00` (Week 1 = Aug 26 to Sep 2, Week 2 = Sep 2 to Sep 9, etc.).
  - Daily records freeze at 23:59:59.999 Asia/Bangkok; Weekly totals freeze at 23:59:59.999 of the 7th day.
- **StoreMaster Re-Sync & Mapping Results**:
  - Expected Weekly Stores: **65**
  - Matched StoreMaster Records: **65** (100% matched, including `32569` -> `OBS Central Khonkaen Campus FL.1 By OPPO`)
  - Unmatched Store Codes: **0**
  - Stores with Google Maps URL: **65 / 65** (100% ready)
  - Stores Missing Google Maps URL: **0**
  - Duplicate Mappings: **0**
- **CentralWorld Reference Regression Baselines**:
  - Store 25610:
    - September 2026: Qualified Reviews = **8**
    - August 2026: Qualified Reviews = **68**
- **Weekly UI Updates**:
  - Top summary cards: Weekly Stores (65), Passed, Below Target, Total Qualified Reviews, Current Week (with OPEN/CLOSED status badge).
  - Dynamic 7-day columns table: `Rank`, `Store`, `Rating`, `<Day 1>` through `<Day 7>`, `Weekly Total`, `Target`, `Achievement`, `Status`.
  - Live value handling: current/open dates show live values, future dates show `-`, closed/past dates show frozen values with `🔒`.
- **Verification Status**:
  - Chrome Extension test suite: **73 / 73 passed**.
  - Chrome Extension build: **Passed (content_script.js 112.5kb, dashboard_bridge.js 4.3kb)**.
  - Backend unit & integration test suite: **1,688 / 1,688 passed**.
  - StoreMaster specs: **34 / 34 passed**.
  - Frontend Next.js production build: **Passed (0 errors)**.
  - Backend NestJS production build: **Passed (0 errors)**.
- **Historical Audit Status**: **NOT STARTED**. Awaiting operator approval before launching review collections.


## 2026-09-04: Google Review KPI Previous-Month (2026-08) Acceptance Run on CentralWorld (25610) [COMPLETED]
- **Current Task**: Execute previous-month (`2026-08`) workflow acceptance validation strictly on OPPO Brand Shop CentralWorld (`25610`).
- **Workflow & Rules Tested**:
  - Phase 1 (September Reviews / Navigation Skip): Reviews definitively newer than August 2026 (`14 hours ago`, `1 day ago`, etc.) skipped opening photo viewers (`navigationSkipped = true`, `navigationSkipReason = "DEFINITELY_NEWER_THAN_TARGET"`, `imageViewerOpened = false`).
  - Phase 2 (August Reviews / Target Evaluation): Reviews entering August 2026 candidate range (`4 วันที่ผ่านมา` = Aug 31, `1 week ago`, `2 weeks ago`) opened photo viewer if customer photo attached, extracted Image Capture Month, and verified 15+ Thai words.
  - Edited Reviews Policy: Edited reviews (`isEdited === true`) excluded from KPI, cannot establish chronology, cannot trigger stop (`qualified = false`, `stopBoundaryTriggered = false`).
- **Results**:
  - Total Reviews Scanned: **40** (physical end of available reviews reached)
  - Phase 1 Skipped Reviews: **14** (zero photo viewers opened for newer September reviews)
  - Phase 2 Evaluated Reviews: **22**
  - Photo Viewers Opened: **19**
  - Edited Reviews Excluded: **4** (Reviews #1, #7, #23, #38)
  - Non-edited Reviews with Aug Image Capture: **19**
  - Non-edited Aug Image Capture + >=15 Words: **17**
  - Final Qualified Reviews for Aug 2026: **17**
  - Stop Boundary Review: Reached physical end of feed at sequence #40
  - Lazy Load Cycles: **2**
  - Confirmation: 0 edited reviews counted toward KPI, 0 edited reviews triggered stop boundary.
- **Verification**: Extension unit tests (70/70 passed), extension build succeeded.

## 2026-09-04: Google Review KPI Review Chronology vs Image Capture Month Separation & CentralWorld Acceptance [COMPLETED]
- **Current Task**: Decouple `Image Capture Month` (KPI qualification source of truth) from `Review Creation Chronology` (feed navigation and stop boundary source of truth). Re-run single-store acceptance validation on CentralWorld (`25610`) in NEWEST order for Target Month `2026-09`.
- **Architectural Rules Applied**:
  - `Image Capture Month` is strictly used for KPI qualification (`hasCustomerPhoto === true && imageCaptureMonth === targetMonth && finalWordCount >= 15`). An older image in a recent/edited review fails qualification but **must NOT trigger stop**.
  - `Review Creation Chronology` (`isEditedTimestamp`, `relativeDateRange`, `chronologicalRelation`, `chronologicalBoundaryEligible`) is strictly used for feed stop boundary.
  - `isEditedTimestamp === true` -> `chronologicalBoundaryEligible = false` (never stops scan).
  - `isEditedTimestamp === false` -> evaluates dynamic date range relative to referenceDate; if `endMonth < targetMonth` (e.g. `4 วันที่แล้ว` = Aug 31 when target is Sep 2026) -> `chronologicalRelation = "OLDER"`, `chronologicalBoundaryEligible = true`, `stopBoundaryTriggered = true`.
- **CentralWorld Runtime Acceptance Results (Newest Order)**:
  - Sort Verification: `sortTextBefore: เกี่ยวข้องที่สุด -> sortTextAfter: ใหม่ที่สุด` (`isNewest: true`).
  - Review #1: `14 ชั่วโมงที่ผ่านมา` -> No photo, 0 words -> Qualified: `false`, Stop: `false`
  - Review #2: `16 ชั่วโมงที่ผ่านมา` -> No photo, 5 words -> Qualified: `false`, Stop: `false`
  - Review #3: `18 ชั่วโมงที่ผ่านมา` -> Photo: `2026-09`, 29 words -> Qualified: **`true`**, Stop: `false`
  - Review #4: `21 ชั่วโมงที่ผ่านมา` -> Photo: `2026-09`, 17 words -> Qualified: **`true`**, Stop: `false`
  - Review #5: `22 ชั่วโมงที่ผ่านมา` -> Photo: `2026-09`, 41 words -> Qualified: **`true`**, Stop: `false`
  - Review #6: `แก้ไขเมื่อ 22 ชั่วโมงที่ผ่านมา` (Edited) -> Photo: `2026-01`, 15 words -> Qualified: `false`, `isEdited: true`, `chronologicalBoundaryEligible: false`, Stop: **`false`** (Correctly continued past Review #6!)
  - Review #7: `23 ชั่วโมงที่ผ่านมา` -> Photo: `2026-09`, 17 words -> Qualified: **`true`**, Stop: `false`
  - Review #8: `23 ชั่วโมงที่ผ่านมา` -> Photo: `2026-09`, 37 words -> Qualified: **`true`**, Stop: `false`
  - Review #9: `1 วันที่ผ่านมา` -> Photo: `2026-09`, 25 words -> Qualified: **`true`**, Stop: `false`
  - Review #10: `1 วันที่ผ่านมา` -> No photo, 0 words -> Qualified: `false`, Stop: `false`
  - Review #11: `1 วันที่ผ่านมา` -> Photo: `2026-09`, 13 words (<15) -> Qualified: `false`, Stop: `false`
  - Review #12: `1 วันที่ผ่านมา` -> No photo, 11 words -> Qualified: `false`, Stop: `false`
  - Review #13: `1 วันที่ผ่านมา` -> No photo, 2 words -> Qualified: `false`, Stop: `false`
  - Review #14: `1 วันที่ผ่านมา` -> Photo: `2026-09`, 21 words -> Qualified: **`true`**, Stop: `false`
  - Review #15: `1 วันที่ผ่านมา` -> Photo: `2026-09`, 27 words -> Qualified: **`true`**, Stop: `false`
  - Review #16: `4 วันที่ผ่านมา` (Un-edited, Aug 31) -> Photo: `2026-08`, 18 words -> `chronologicalRelation: OLDER`, `chronologicalBoundaryEligible: true`, Stop: **`true 🛑`** (`Review creation chronology reached older than target month (4 วันที่ผ่านมา)`)
- **CentralWorld Final Summary Metrics**:
  - Reviews Scanned: **16**
  - With Customer Photo: **11**
  - Photo in Target Month (`2026-09`): **9**
  - 15+ Thai Words: **10**
  - Qualified Reviews: **8** (Reviews #3, #4, #5, #7, #8, #9, #14, #15)
  - Coverage Status: **`OLDER_THAN_TARGET_REACHED`** (Halted at sequence #16)
- **Verification Status**:
  - Extension test suite: 69/69 passed.
  - Extension build: `content_script.js` (110.8kb) and `dashboard_bridge.js` (4.3kb) compiled cleanly.
- **Next Action**: Report full 13-point acceptance output to operator.

## 2026-09-03: Google Review KPI Controlled 10-Store Production Pilot [COMPLETED: 10/10]
- **Current Task**: Execute a controlled 10-store production pilot for month `2026-09` using real browser and unpacked Chrome Extension.
- **Pre-Conditions Verified**:
  - Previous 3-store pilot session `e4bd4d8a-fc9d-43f5-9740-748389cfc7d8` confirmed `COMPLETED` (3/3 completed).
  - No active/running audit session conflict existed.
  - Selected 10 non-duplicate stores covering 6 distinct regions with varied characteristics (tourist destinations, hypermarkets, major malls, dealer partners).
  - Created new session `8b1d94ee-0df7-4d3e-b84c-4ff4c9564324`.
- **Runtime Discovery & Safe Fix**:
  - Store #1 (`OBS Ayutthaya City Park By TG 1`) was a zero-review place on Google Maps (has "เขียนรีวิว" but no Reviews tab or star summary).
  - Identified two runner bugs:
    1. Recursive `runForCurrentStore` retry lock hit `if (this.isRunning) return;` preventing retry and hanging.
    2. Lack of zero-review place detection in `GoogleMapsDomAdapter`.
  - Fixes applied:
    1. Added `GoogleMapsDomAdapter.isZeroReviewsPlace()` detecting loaded place header, "Write a review" action, and absence of review cards/tabs.
    2. Replaced recursive retry in `batchAuditRunner.ts` with a bounded iterative retry loop.
    3. Auto-submitted zero-count metrics (`reviewsChecked: 0`, `coverageStatus: END_OF_AVAILABLE_REVIEWS`) and auto-transitioned to next store.
  - Added contract tests in `test/batchAuditRunner.test.ts` (55/55 passed). Rebuilt extension bundles.
- **Browser Pilot Execution & Results**:
  - Ran automated validation in real Chromium with unpacked extension across all 10 stores:
    1. `OBS Ayutthaya City Park By TG 1` (`27369`): 0 checked, 0 photo, 0 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
    2. `OBS Central Rama 3 FL.3 By OPPO` (`26239`): 3 checked, 3 photo, 3 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
    3. `OBS Central Chanthaburi FL.1 By OPPO` (`28882`): 3 checked, 3 photo, 0 words >= 15, 0 qualified, `OLDER_THAN_TARGET_REACHED` -> COMPLETED (HTTP 201)
    4. `OBS Central Pattaya Beach FL.3 By OPPO` (`2997`): 3 checked, 3 photo, 3 words >= 15, 0 qualified, `OLDER_THAN_TARGET_REACHED` -> COMPLETED (HTTP 201)
    5. `OBS Big C Udonthani By OPPO` (`28374`): 3 checked, 3 photo, 2 words >= 15, 0 qualified, `OLDER_THAN_TARGET_REACHED` -> COMPLETED (HTTP 201)
    6. `OBS Central Khonkaen FL.3 By OPPO` (`3791`): 3 checked, 3 photo, 2 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
    7. `OBS Big C Chiangrai By IT CITY` (`26197`): 3 checked, 0 photo, 2 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
    8. `OBS Big C Lampang By IT CITY` (`26456`): 3 checked, 3 photo, 3 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
    9. `OBS Big C Klong Khae Hatyai FL.2 By Com7` (`22868`): 3 checked, 0 photo, 0 words >= 15, 0 qualified, `OLDER_THAN_TARGET_REACHED` -> COMPLETED (HTTP 201)
    10. `OBS Market Village Huahin FL.3 By IT CITY` (`26533`): 3 checked, 3 photo, 1 words >= 15, 0 qualified, `END_OF_AVAILABLE_REVIEWS` -> COMPLETED (HTTP 201)
  - Final Session Status: **10/10 COMPLETED** (`8b1d94ee-0df7-4d3e-b84c-4ff4c9564324`).
  - No manual intervention required during execution. Zero PII/text/photos persisted. All aggregate metrics recorded in PostgreSQL.

## 2026-09-03: Google Review KPI Token Handoff, Storage ACK Bridge & End-to-End Pilot Completion
- **Current Task**: Resolve runner authentication token handoff between Next.js dashboard and Chrome Extension, eliminate missing token errors on Google Maps, and validate real browser execution through pilot stores.
- **Root Causes Identified**:
  1. `maps.app.goo.gl` 302 Redirection: Shortlink URLs returned HTTP 302 redirects to `www.google.com/maps/place/...`, stripping URL hash fragments (`#oppoToken=...&oppoSessionId=...`) and custom query parameters during the server-side redirect.
  2. Isolated World Event Serialization: `CustomEvent.detail` between Dashboard and Extension content scripts suffered from Chrome isolated world boundary restrictions and asynchronous race conditions when `window.open` opened new tabs before `chrome.storage.local` write completed.
  3. Precedence & Invariant Enforcement: Content script lacked deterministic URL vs storage token precedence and fail-closed validation before launching the batch runner loop.
- **Completed Fixes**:
  - `tools/google-review-checker-extension/src/core/handoffParams.ts`:
    - Created synchronous `EARLY_LOCATION` snapshot capturing URL parameters before client-side SPA routing can mutate them.
    - Created `parseUrlHandoffParams()` extracting `oppoToken`, `oppoSessionId`, `oppoStoreId`, `oppoMonth`, and store metadata.
  - `tools/google-review-checker-extension/src/dashboard_bridge.ts`:
    - Implemented bidirectional `window.postMessage` protocol listening for `OPPO_PERSIST_BATCH_SESSION_REQUEST`, persisting session to `chrome.storage.local`, and replying with `OPPO_PERSIST_BATCH_SESSION_ACK`.
    - Added `storage` event listeners for automatic `localStorage` synchronization.
  - `tools/google-review-checker-extension/src/batch/batchAuditRunner.ts`:
    - Integrated `parseUrlHandoffParams()` with token precedence (`URL token > storage token > fail closed`).
    - Added fail-closed authentication header construction (`Authorization: Bearer <token>`).
    - Updated `navigateToNextStore()` to deterministically persist updated session state in `chrome.storage.local` before navigation.
  - `tools/google-review-checker-extension/src/content_script.ts`:
    - Integrated `parseUrlHandoffParams()`.
    - Added fail-closed invariant check in `initBatchMode()` alerting operator if token is missing.
    - Updated `detectStoreContextFromUrl()` to use normalized parameters.
  - `frontend/src/app/google-review-kpi/google-review-kpi-view.tsx`:
    - Implemented `persistBatchSessionWithAck(bridgeData, timeoutMs)` ensuring deterministic storage write and ACK before calling `window.open()`.
    - Applied `persistBatchSessionWithAck` across `handleStartBatchAudit`, `handleResumeBatchAudit`, and `handlePauseBatchAudit`.
- **Real Browser Validation Results**:
  - Executed automated browser validation in Chromium with the unpacked extension on production `https://lineoppo.click/google-review-kpi`.
  - Queue #1: `OBS Central World FL.4 By OPPO` (Code: 25610) -> Scanned, Submitted (`POST .../complete` -> 201), status: `COMPLETED` (`END_OF_AVAILABLE_REVIEWS`).
  - Queue #2: `OBS Imperial World Samrong FL.4 By OPPO 1` (Code: 18127) -> Auto-transitioned, Scanned, Submitted (`POST .../complete` -> 201), status: `COMPLETED` (`OLDER_THAN_TARGET_REACHED`).
  - Queue #3: `OBS Imperial World Samrong FL.4 By OPPO 2` (Code: 26346) -> Auto-transitioned, Scanned, Submitted (`POST .../complete` -> 201), status: `COMPLETED` (`OLDER_THAN_TARGET_REACHED`).
  - Monthly Batch Audit Session `e4bd4d8a-fc9d-43f5-9740-748389cfc7d8`: Completed 3/3 stores with status `COMPLETED`.
  - Dashboard verified: All 3 stores updated in PostgreSQL with aggregate KPI results.
- **Verification Summary**:
  - Extension unit tests: 54/54 passed (including `tokenHandoff.test.ts`).
  - Frontend unit tests: passed.
  - Frontend production build: passed with zero errors.
  - Live production browser execution: 100% automated completion across all pilot stores.
- **Current Task**: Resolve 401 Unauthorized error (`{"message":"Authentication required"}`) when extension Batch Runner attempts to submit audit results.
- **Root Causes Identified**:
  1. Content Script State Decoupling: `content_script.ts` read `batchAuditSession` from storage in `initBatchMode()` but never invoked `batchRunner.setSession(this.batchSession)`. As a result, `BatchAuditRunner.sessionInfo` had no runner token.
  2. Silent Degradation in Runner: `BatchAuditRunner.buildAuthHeaders` treated missing runner tokens with a console warning and returned unauthenticated headers without Bearer token or cookies, which backend rejected with 401.
  3. Dashboard Handoff Tab Race: Handoff URL opened Google Maps tab immediately while storage sync via `dashboard_bridge.ts` was asynchronous.
- **Fixes Applied**:
  - `tools/google-review-checker-extension/src/content_script.ts`:
    - Updated `initBatchMode()` to explicitly bind `this.batchRunner.setSession(this.batchSession)`.
    - Added fallback inspection of URL hash params (`#oppoToken=...&oppoSessionId=...`) to ensure immediate token bootstrapping even if storage hasn't synced yet.
  - `tools/google-review-checker-extension/src/batch/batchAuditRunner.ts`:
    - Updated `initFromStorage` to check URL hash params.
    - Updated `buildAuthHeaders` to fail closed: throws an error if runner token is missing, preventing silent unauthenticated calls.
    - Updated `navigateToNextStore` to append store parameters and `#oppoToken=...&oppoSessionId=...` hash fragment when transitioning between stores.
  - `frontend/src/app/google-review-kpi/google-review-kpi-view.tsx`:
    - Updated `buildGoogleMapsHandoffUrl` to accept `runnerToken` and `sessionId`, appending them securely via `#oppoToken=${runnerToken}&oppoSessionId=${sessionId}`.
    - Passed fresh runner tokens into `buildGoogleMapsHandoffUrl` in both `handleStartBatchAudit` and `handleResumeBatchAudit`.
- **Verification**:
  - Extension unit tests: 49/49 passed.
  - Extension build: bundled `content_script.js` and `dashboard_bridge.js` cleanly.
  - Frontend production build: completed successfully with zero TypeScript or build errors.
  - Pilot session `e4bd4d8a-fc9d-43f5-9740-748389cfc7d8` preserved in `PAUSED` state; Queue #1 intact in `RUNNING` state.
- **Next Action**: Deploy frontend to Railway, reload Chrome Extension, and resume audit.

## 2026-09-03: Google Review KPI Extension Transport & CORS Resolution
- **Current Task**: Resolve "Attention needed: Failed to fetch" transport error when Google Maps content script calls production API.
- **Root Cause**:
  1. CORS Preflight Failure: Google Maps content script on `https://www.google.com` called `https://lineoppo.click/google-review-kpi/...`. Express CORS allowlist only included `frontendUrl`, rejecting preflights with missing `Access-Control-Allow-Origin`.
  2. Cross-site Cookie Isolation: `submitAuditResult`, `handleNeedsAttention`, and `navigateToNextStore` did not attach authentication tokens and relied on cookies blocked in cross-origin contexts by modern browser third-party cookie restrictions.
- **Solution Architecture**:
  - Maintained zero-leak, session-scoped security without opening insecure wildcard CORS.
  - Added short-lived (30-min) session-scoped Bearer token issuance (`POST /google-review-kpi/audit-session/:sessionId/runner-token`) utilizing existing `Session` model (`SessionType.MOBILE`).
  - Added `https://www.google.com` and `https://www.google.co.th` to backend CORS allowed origins.
  - Updated dashboard to fetch runner token on Start/Resume and store it in `chrome.storage.local`.
  - Updated extension `BatchAuditRunner` to attach `Authorization: Bearer <token>` and debug logging to all fetch calls.
- **Verification**:
  - Extension unit tests: 49/49 passed.
  - Frontend production build: passed with zero errors.
  - Deployed to Railway (`6496462c-b041-4c2a-b1ef-f0571f717262` | SUCCESS).
  - Production verification:
    - Preflight OPTIONS from `Origin: https://www.google.com` returns HTTP 204 with valid CORS headers.
    - Unauthorized request returns HTTP 401.
    - Active production session `e4bd4d8a-fc9d-43f5-9740-748389cfc7d8` preserved; Queue #1 intact in RUNNING state.
- **Next Action**: Operator reloads Chrome Extension and clicks Resume on Dashboard.

## 2026-09-03: Google Review KPI Production Pilot Diagnosis & Runner Handoff Fix
- **Current Task**: Diagnose and fix runner handoff for real production pilot on `https://lineoppo.click/google-review-kpi`.
- **Findings & Root Causes**:
  1. Dashboard flickering: `loadData` set `setLoading(true)` on every 3-second live poll, unmounting the table and replacing it with a spinner every 3 seconds.
  2. Queue #1 not starting / `/next-store` never called: `startMonthlyAudit` initialized all stores as `PENDING` without claiming store 1; `res.currentStore` was `null`, which prevented `window.open` from opening the initial Google Maps tab.
  3. API routing: Next.js lacked rewrites for `/google-review-kpi/check-result` and `/google-review-kpi/audit-session/:path*`.
  4. Single-flight protection: Extension required explicit window initialization guards and deduplication against repeated `chrome.storage.local` writes.
- **Completed Fixes**:
  - `backend/src/google-review-kpi/google-review-kpi.service.ts`:
    - Automatically claim first pending store via `getNextPendingStore` in `startMonthlyAudit`.
    - Automatically claim next pending store on session `RESUME` if no store is currently `RUNNING`.
  - `frontend/next.config.ts`:
    - Added rewrites for `/google-review-kpi/check-result` and `/google-review-kpi/audit-session/:path*` to `API_BASE_URL`.
  - `frontend/src/app/google-review-kpi/google-review-kpi-view.tsx`:
    - Added silent polling flag to `loadData(selectedMonth, true)` to eliminate page flicker.
    - Updated active store banner and Google Maps link to display during both `RUNNING` and `PAUSED` states.
  - Extension (`tools/google-review-checker-extension`):
    - Added `__OPPO_KPI_OVERLAY_INITIALIZED__` single-flight guard to `content_script.ts`.
    - Added storage deduplication in `dashboard_bridge.ts`.
    - Rebuilt `content_script.js` (75.6kb) and `dashboard_bridge.js` (1.6kb).
- **Verification**:
  - Active production session `e4bd4d8a-fc9d-43f5-9740-748389cfc7d8` preserved in `PAUSED` state with all 3 stores intact.
  - Extension unit tests: 39/39 passed.
  - Frontend unit tests: 485/485 passed.
  - Backend unit tests: 1,685/1,685 passed.
  - Frontend production build: passed with zero errors.
  - Backend production build: passed with zero errors.
- **Next Action**: Commit, push, and deploy fixes to Railway, then operator resumes pilot.

## 2026-09-03: Google Review KPI Monthly Batch Audit Runner (100+ Stores)
- **Current Task**: Build Monthly Batch Audit Runner for Google Review KPI allowing 100+ stores to be audited sequentially in active browser tab.
- **Completed Work**:
  - Database Layer:
    - Added models `GoogleReviewAuditSession` and `GoogleReviewAuditStore` with enums `GoogleReviewAuditSessionStatus`, `GoogleReviewAuditStoreStatus`, `GoogleReviewAuditCoverageStatus`.
    - Applied migration `20260903120000_add_google_review_audit_session`.
  - Backend API Layer (`google-review-kpi`):
    - Added endpoints:
      - `POST /google-review-kpi/audit-session/start`: creates session with ordered queue of active stores having Google Maps URLs.
      - `GET /google-review-kpi/audit-session/active`: returns session progress and queue metrics.
      - `PATCH /google-review-kpi/audit-session/:sessionId/status`: supports PAUSE, RESUME, and CANCEL.
      - `GET /google-review-kpi/audit-session/:sessionId/next-store`: atomic assignment of next pending store.
      - `POST /google-review-kpi/audit-session/:sessionId/stores/:storeId/complete`: records aggregate KPI results in transaction and advances session.
      - `POST /google-review-kpi/audit-session/:sessionId/stores/:storeId/flag-attention`: flags unexpected layout or challenges without breaking run.
      - `POST /google-review-kpi/audit-session/:sessionId/stores/:storeId/skip`: marks store skipped.
      - `POST /google-review-kpi/audit-session/:sessionId/stores/:storeId/rerun`: resets store to pending.
    - Verified all routes mapped before `:storeId` parameter.
  - Extension Batch Runner (`tools/google-review-checker-extension`):
    - Centralized DOM automation in `GoogleMapsDomAdapter`: `detectGoogleChallenge()`, `isReviewsPaneOpen()`, `openReviewsPane()`, and `ensureNewestSorting()`.
    - Implemented `BatchAuditRunner` state machine (`IDLE → LOADING_STORE → WAITING_FOR_MAPS → OPENING_REVIEWS → SETTING_NEWEST → SCANNING → SCROLLING → WAITING_FOR_LAZY_LOAD → AUDIT_COMPLETE → SUBMITTING_RESULT → MOVING_TO_NEXT_STORE`).
    - Bounded scanning: terminates as soon as boundary is reached (Condition A or B) rather than scanning entire historical reviews.
    - Submits strictly aggregate numbers (zero reviewer PII/text/media).
    - Updated `dashboard_bridge.ts` to bridge batch session state into `chrome.storage.local`.
    - Built extension bundles `content_script.js` (75.4kb) and `dashboard_bridge.js` (1.4kb).
  - Frontend Dashboard (`frontend/src/app/google-review-kpi`):
    - Added Monthly Batch Audit Control Panel with Start, Pause, Resume, and Cancel actions.
    - Real-time progress bar, live store execution card, and Needs Attention warning banner.
    - Added Batch Queue column with status badges and quick actions (`Re-run`, `Skip`).
    - Added batch filters in status dropdown.
- **Verification**:
  - Extension unit tests: 39/39 passed.
  - Backend unit tests: 1677/1677 passed.
  - Frontend production build: passed with zero errors.
  - Backend production build: passed with zero errors.
  - Live backend verification: tested active session check, session creation, next store assignment, store completion, and session completion via curl with auth session cookie.
- **Blockers**: None.
- **Next Action**: Ready for local operator validation in Chrome with Google Maps.

## 2026-09-03: Google Review KPI Thai Repetition Mark (ๆ) & Punctuation Exclusion
- **Current Task**: Exclude Thai repetition mark (`ๆ`) and standalone punctuation (`ฯ`, `ฯลฯ`) from word counts.
- **Completed Work**:
  - Root cause: Unicode categorizes `ๆ` as `\p{Lm}` (Modifier Letter) and `ฯ` as `\p{Lo}` (Other Letter), causing `\p{L}` regex to treat them as letters.
  - Updated `isMeaningfulToken` and `segmentThaiWords` in `thaiWordCounter.ts`:
    - Strips `[ๆฯ฿๏๚๛]` and `ฯลฯ` before checking for meaningful letters.
    - Standalone `ๆ` and `ฯ` evaluate to 0 words.
    - Trailing `ๆ` attached to a word (e.g. `เยอะๆ`) or separated (`เยอะ ๆ`) counts as 1 word (`เยอะ`).
    - Minions live review text: `ร้านดูแลดีมาก ชอบมาก มาร่วมกิจกรรมกันเยอะ ๆ` now accurately counts 11 words (not 12).
  - Added 5 unit tests covering: `เยอะ ๆ` (1 word), `ดีมาก ๆ` (2 words), attached `เยอะๆ` (1 word), standalone `ๆ` (0), standalone `ฯ` and `ฯลฯ` (0), and Minions fixture (11 words).
  - Rebuilt Chrome Extension bundle (`node build.js`).
- **Verification**:
  - Extension unit tests: 36/36 passed.
  - Backend unit tests: 1677/1677 passed.
  - Frontend unit tests: 483/483 passed.
  - Next.js and NestJS production builds passed cleanly.
- **Blockers**: None.
- **Next Action**: Awaiting user live validation in Google Chrome.

## 2026-09-03: Google Review KPI Customer Photo Detection Strict Positive Evidence Fix
- **Current Task**: Resolve customer-photo false-positive bug where reviews with no attached media were marked `Has customer photo: Yes`.
- **Completed Work**:
  - Identified exact root cause:
    1. Contributor statistics (e.g. `minions · 1 review · 1 photo`) matched overly broad button query `button[aria-label*='photo' i]`.
    2. Reviewer avatar images hosted on Google user storage (`lh3.googleusercontent.com` / `ggpht.com`) failed negative exclusion checks and were mistakenly treated as customer review media.
    3. Broad image querying across the whole card used negative exclusion rather than strict positive evidence of attached review media.
  - Implemented strict positive-evidence detection in `googleMapsDomAdapter.ts`:
    - Strictly excludes reviewer header (`.WNxzHc`, `.d4r55`, `.al6Kxe`, `.RfnDt`, `[data-href*='/contrib/']`), owner replies (`.CDe7pd`), and action bars (`.GBkF3d`, `Like`, `Share`).
    - Requires genuine attached review media: gallery containers (`.KtCyie`), thumbnail buttons (`button.Tya61d`, `div.KtRwe`, `button[data-photo-index]`), review photo action triggers (`[jsaction*='review.photo']`), or `/p/` customer photo storage URLs positioned outside headers and action bars.
    - Added structured `PhotoEvidence` categorization (`NONE`, `REVIEW_MEDIA_THUMBNAIL`, `REVIEW_MEDIA_BUTTON`, `REVIEW_MEDIA_GALLERY`).
    - Exposed `Photo evidence: ...` in Live Validation Debug View.
  - Added 9 comprehensive unit tests in `customerPhotoDetection.test.ts` covering live bug fixture, high contributor photo counts, reviewer avatars, place images, thumbnails, galleries, and qualification regression.
  - Rebuilt Chrome Extension bundle (`node build.js`).
- **Verification**:
  - Extension unit tests: 35/35 passed.
  - Backend unit tests: 1677/1677 passed.
  - Frontend unit tests: 483/483 passed.
  - Next.js and NestJS production builds passed cleanly.
- **Blockers**: None.
- **Next Action**: Awaiting user live validation in Google Chrome.

## 2026-09-03: Google Review KPI Finalized Word Counting Pipeline & Threshold (>= 15)
- **Current Task**: Full review text extraction fix, Thai compound-prefix merge pipeline, and threshold update from `> 15` to `>= 15`.
- **Completed Work**:
  - Identified root cause of partial text extraction: DOM adapter was matching first child `<span>` inside `.MyEned` (which could be an activity chip or tag like "ร่วมกิจกรรม") rather than the full review body `.wiI7Bm`.
  - Updated `googleMapsDomAdapter.ts` to clone the complete `.wiI7Bm` / `.MyEned` element, strip UI buttons/expanders, and filter known Google Maps UI noise phrases (`cleanReviewText`).
  - Implemented multi-stage Thai word counting pipeline in `thaiWordCounter.ts`:
    1. Strip Google Maps UI phrases (`cleanReviewText`).
    2. `Intl.Segmenter("th", { granularity: "word" })`.
    3. Exclude pure numbers, whitespace, punct, symbols, emoji, UI tokens (`isMeaningfulToken`).
    4. Compound dictionary matching full sequence (`applyCompoundDictionary`).
    5. Thai compound-prefix merge for `การ, ความ, น่า, ผู้, นัก, ชาว, ช่าง` (`mergeThaiCompoundPrefixes`). Normal phrases (`ไม่ดี`, `ดีมาก`) remain separate words.
    6. Repeated words counted every time.
  - Migrated qualification threshold to `finalWordCount >= 15` (0-14 FAIL, 15+ PASS) across engine, dashboard, extension UI, and tests.
  - Enhanced live validation Debug View to render full review text, raw tokens, final counted tokens, final word count, and 15+ status.
  - Added 9 new unit tests covering threshold, prefix merge, non-merge, repeated words, noise exclusion, and real regression fixture.
- **Verification**:
  - Extension unit tests: 26/26 passed.
  - Backend unit tests: 1677/1677 passed.
  - Frontend unit tests: 483/483 passed.
  - Next.js and NestJS production builds passed cleanly.
- **Blockers**: None.
- **Next Action**: Awaiting user live validation in Google Chrome.

## 2026-09-03: Google Review KPI Dual Completion Edge Case Resolution
- **Current Task**: Resolve Google Review KPI audit completion when store review list ends within target month.
- **Completed Work**:
  - Identified root cause: completion previously only triggered when a review older than the target month existed (`review.month < targetMonth`), failing when a store has no older reviews beyond the target month.
  - Implemented dual-condition completion algorithm in `qualificationEngine.ts` and `googleMapsDomAdapter.ts`:
    - **Condition A (`OLDER_THAN_TARGET_REACHED`)**: Unedited reliable review older than target month found.
    - **Condition B (`END_OF_AVAILABLE_REVIEWS`)**: User physically reaches bottom of Google Maps review scroll pane (`distanceFromBottom <= 15px` or end-of-list DOM indicator) with loaded reviews.
    - **In Progress (`IN_PROGRESS`)**: Neither condition met; prompts user to continue scrolling.
  - Strict invariants enforced: Edited reviews (`isEdited`) and unknown dates (`month === null`) never trigger Condition A.
  - Added 5 unit tests covering all edge cases. Rebuilt extension bundle.
- **Verification**:
  - Extension unit tests: 22/22 passed.
  - Backend unit tests: 1677/1677 passed.
  - Frontend unit tests: 483/483 passed.
  - Next.js and NestJS production builds passed cleanly.
- **Blockers**: None.
- **Next Action**: Awaiting user live browser validation with updated extension.

## Current task: Google Maps Review KPI Checker MVP (2026-09-02) [COMPLETE]

- **Architecture Chosen**: Human-in-the-loop Chrome Extension + `lineoppo.click` Dashboard and Backend API.
- **Privacy Enforcement**: Zero reviewer personal data, profile identifiers, review text, or images are stored. Only aggregated monthly KPI metrics (`reviewsChecked`, `reviewsWithPhoto`, `reviewsOver15ThaiWords`, `qualifiedReviews`, `targetQualifiedReviews`, `checkedAt`, `checkedByUserId`) are persisted.
- **Database & Prisma**: Added `GoogleReviewKpiResult` model with unique constraint `[storeId, month]` and migration `20260902180000_add_google_review_kpi_result`. Reuses existing `StoreMaster.googleMapsUrl` and `Store` relation.
- **Backend API**: Created `GoogleReviewKpiModule` in NestJS with endpoints `GET /google-review-kpi?month=YYYY-MM`, `GET /google-review-kpi/:storeId`, and `POST /google-review-kpi/check-result`. Strictly validates `YYYY-MM` month format, non-negative integer counts, and mathematical consistency rules (`qualifiedReviews <= reviewsChecked`, `reviewsWithPhoto <= reviewsChecked`, `reviewsOver15ThaiWords <= reviewsChecked`, `qualifiedReviews <= reviewsWithPhoto`, `qualifiedReviews <= reviewsOver15ThaiWords`).
- **Frontend Dashboard**: Created `/google-review-kpi` view with month picker (defaults to Bangkok current month), stat summary cards (Total Stores, Checked, Passed, Below Target, Total Qualified, Scanned), search & region/status filters, store table with "เปิด Google Maps ↗" links, status badges, and manual JSON import/entry modal. Integrated into sidebar and top navigation.
- **Chrome Extension MVP**: Built Manifest V3 extension in `tools/google-review-checker-extension/` with modular components:
  - `thaiWordCounter.ts` using browser-native `Intl.Segmenter("th", { granularity: "word" })` to segment and count Thai words without spaces.
  - `googleReviewDateParser.ts` for parsing English and Thai relative/explicit dates into target `YYYY-MM` with fail-closed `UNKNOWN_DATE` fallback.
  - `reviewFingerprint.ts` for non-reversible ephemeral review deduplication during user scrolling.
  - `googleMapsDomAdapter.ts` for isolated Google Maps review card, text, and customer photo extraction.
  - `qualificationEngine.ts` evaluating `dateInRange && hasImage && thaiWordCount > 15`.
  - `content_script.ts` with floating in-page UI overlay on Google Maps.
- **Verification**:
  - Full backend test suite: 1,677/1,677 passed (including `google-review-kpi.service.spec.ts`).
  - Full frontend test suite: 483/483 passed (including `google-review-kpi.test.mts`).
  - Extension test suite: 15/15 passed (word segmentation, qualification matrix, boundary tests, deduplication, relative date parser).
  - Production builds: Backend `prisma generate && nest build` (exit 0), Frontend `next build` (exit 0).
- **Documentation**: Added comprehensive guide `docs/google-review-kpi.md`.

## Previous task: Phase 1 controlled live profile probe attempt (2026-09-02) [PROBE BLOCKED SAFELY]

- Final guards passed with zero PROCESSING jobs, correct Phase 1 routing, one account-1 session, and all six Phase 2 stores unchanged/enabled.
- Added a local-only sanitized Phase 1 bot-surface probe and passed ESLint/build; it was not deployed or executed. It emits only approved booleans/status/count/failure-stage fields and opens no individual chat.
- Railway scale-to-zero plus graceful SIGTERM stopped only `line-chat-nickname-worker`. Once PID 1 exited, Railway removed access to the sole volume-mounted container, so the profile probe could not execute under the required worker-exited condition. No concurrent probe was attempted.
- Restored one worker replica with unchanged service settings/source; worker startup logged successfully, the worker process and both profile mounts are present, DB access is healthy, zero jobs are PROCESSING, and all Phase 1/Phase 2 routing remains unchanged.
- No Chromium probe, re-authentication, credentials, profile change, DB mutation, job retry, customer chat, cookie/token read, or Phase 2 change occurred. A future probe requires an approved maintenance mechanism that preserves volume-mounted exec while preventing claims, such as a worker pause control or a separate volume-attached maintenance service.

## Current task: Phase 1 Store 28375 RESOLVE_TRANSPORT read-only diagnosis (2026-09-02) [AWAITING MAINTENANCE APPROVAL]

- Production routing is unchanged: active STORE OA on `profile-b` / `profile-b-linux-v2`, sync enabled, valid bot ID, ACTIVE session, zero recorded auth failures. Phase 2 remains six enabled OAs on the single ACTIVE `account-1` / `account-1-v1` session.
- Last Phase 1 success completed at `2026-09-01T14:14:52.961Z`; the first `RESOLVE_TRANSPORT` job was created at `2026-09-02T01:05:33.290Z`. All 24 observed transport failures were unmapped and did not reach nickname PUT; no mapped-customer attempt exists in that failure interval.
- Filesystem-only inspection found `profile-b-linux-v2`, `profile-b`, and `account-1-v1` present with expected Chromium state directories. Phase 1 has no Singleton artifacts or active Chromium owner; directory size alone is not treated as authentication evidence.
- The last success and first failure occurred within the same worker deployment, before the next deployment, so deployment timing does not support a causal rollout/rebuild correlation. Repeated approximately 20-second failures most strongly indicate the natural chat-list request/response observation stage, but current sanitization prevents an exact distinction.
- A controlled live profile probe is required before re-authentication can be justified. No worker stop/restart, Chromium launch, profile mutation, DB mutation, job retry, re-authentication, or Phase 2 access/change was performed.

## Current task: Phase 2 final store enabled — Central Khonkaen 3791 (2026-09-02) [WAITING FOR REAL TAG TEST]

- Operator-approved guarded enable completed for Store 3791 only. Production readback confirms all five Stage B stores now have sync enabled and retain their audited bot routing through the single ACTIVE `account-1` / `account-1-v1` session.
- Phase 1 Store 28375 and Central World 25610 remain enabled and unchanged. Pre-enable DB-driven worker routing passed 5/5, and the final database readback passed `ROUTED = 5/5` with one account-1 session.
- No synthetic job, individual customer chat, manual nickname call, mapping mutation, backfill, old-job retry, profile change, commit, or deployment was performed.
- The dedicated Central Khonkaen guard passes ESLint and build; the full backend suite passes 1,667/1,667.
- Next action: wait for one genuine Central Khonkaen BM tag save and separately verify its production job/resolver/nickname outcome.

## Current task: Phase 2 Stage B Store 27789 enabled (2026-09-02) [WAITING FOR REAL TAG TEST]

- Fresh production DB and DB-driven worker guards passed with Stores 27627, 25391, and 24804 protected as enabled and Stores 27789 and 3791 disabled.
- The guarded serializable transaction enabled only Store 27789 (`OPPO MKV Suwannaphum`, `@180bkgua`) and affected exactly one OA sync flag. No. Routing, sessions, profiles, customers, mappings, and jobs were not modified.
- Post-enable readback confirms Store 27789 uses ACTIVE `account-1` / `account-1-v1` with routing unchanged; Store 3791 remains disabled; Phase 1, Central World, and all earlier validated Stage B stores remain enabled and unchanged; account-1 session count remains one.
- ESLint, backend build, and the full backend suite (1,667/1,667) pass. No synthetic job, individual chat access, backfill, retry, next-store enablement, commit, or deployment was performed.
- Next action: wait for one genuine Store 27789 BM tag save and operator validation.

## Current task: Phase 2 Store 24804 enabled (2026-09-02) [WAITING FOR REAL TAG TEST]

- Fresh production DB and worker guards passed with Bangkapi 27627 and Westgate 25391 protected as enabled, Ngamwongwan 24804 disabled and routing-ready, and Stores 27789/3791 disabled.
- The guarded serializable transaction enabled only Store 24804. Post-enable readback confirms its audited routing remains on the single ACTIVE `account-1` / `account-1-v1` session; 27627 and 25391 remain true, while 27789 and 3791 remain false.
- Phase 1 Store 28375 and Central World 25610 remain unchanged and enabled. No synthetic job, individual chat access, backfill, retry, profile change, other-store mutation, commit, or deployment occurred.
- ESLint and backend build pass; full backend tests pass 1,667/1,667. Next action is one genuine BM tag save for Store 24804.

## Current task: Phase 2 Westgate controlled enable (2026-09-02) [READY FOR REAL TAG TEST]

- Recorded operator confirmation that Bangkapi 27627 passed its genuine production nickname flow; Bangkapi was not modified in this task.
- Fresh production DB and DB-driven worker guards passed with Bangkapi expected enabled, Westgate 25391 expected disabled/routing-ready, the remaining three disabled, and Phase 1/Central World unchanged.
- A Westgate-specific serializable guarded transaction changed only `lineChatNicknameSyncEnabled` from false to true for the exact active STORE OA `OPPO CentralWestgate` / `@khr9928i`; affected row count was exactly one.
- Post-enable readback confirms Westgate and Bangkapi enabled, Stores 24804/27789/3791 disabled, routing unchanged, one `account-1` session, and Phase 1/Central World unchanged.
- No synthetic job, customer chat, mapping, backfill, old-job retry, additional enablement, profile change, commit, or deploy occurred. ESLint/build pass and full backend tests pass 1,667/1,667.
- Next action: wait for one fresh genuine Westgate BM tag save; do not monitor until the operator requests it.

## Current task: Stage B first-store enable — Bangkapi 27627 (2026-09-02) [WAITING FOR REAL BM SAVE]

- Fresh production DB and DB-driven worker guards passed 5/5 before mutation. A serializable guarded transaction enabled only Store 27627 (`OPPO Bangkapi`, `@250oxyxq`) by changing `lineChatNicknameSyncEnabled` from false to true.
- Post-enable readback confirms Bangkapi remains routed to the existing ACTIVE `account-1` / `account-1-v1` session with its audited bot ID; Stores 25391, 24804, 27789, and 3791 remain sync-disabled.
- Central World 25610 and Phase 1 Store 28375 remain unchanged and enabled; exactly one `account-1` session still exists.
- No synthetic nickname job, manual nickname request, customer mapping, historical backfill, failed-job retry, individual chat read, second-store enablement, profile mutation, commit, or deployment occurred.
- ESLint and backend build pass; full backend tests pass 1,667/1,667. Next action is a fresh genuine Bangkapi BM sales-tag save by the operator, followed by separately requested observation.

## Current task: Phase 2 Stage B production routing applied and verified (2026-09-02) [COMPLETE — SYNC DISABLED]

- Operator-approved guarded Stage B apply completed successfully for Stores 27627, 25391, 24804, 27789, and 3791. Each now has its audited bot ID and links to the existing `account-1` session; no session was created and all five retain nickname sync disabled.
- Production DB readback passed `ROUTED = 5/5`, confirmed one `account-1` session, and confirmed Phase 1 Store 28375 plus Central World 25610 unchanged.
- DB-driven Railway worker preflight passed `ROUTING READY = 5/5`: OA/session/profile found, session authenticated, bot ID valid, bot-level chat-list access present, and sync disabled for every target. No individual customer chat was opened.
- Final post-preflight DB readback again passed 5/5 with all five sync flags false. No enablement, nickname jobs, customer mappings, backfill, failed-job retry, profile mutation, commit, deploy, or unrelated dirty-tree action was performed.
- Added reusable read-only Stage B DB readback and worker-preflight CLIs. ESLint and backend build pass after these additions.
- Next action requires separate operator approval: enable and validate only the selected first Stage B store.

## Current task: Phase 2 Stage B guarded routing preparation (2026-09-02) [READY FOR OPERATOR APPLY]

- Added a dedicated Stage B plan/apply CLI for the five remaining account-1 stores. Dry-run is the default; apply requires both `--apply` and `--confirm-stage-b-routing-five`.
- One serializable transaction requires exact Store/OA/Basic ID identities, active STORE accounts, null bot/session routing, sync disabled, exactly one ACTIVE `account-1` session using `account-1-v1`, and unchanged Phase 1 and Central World invariants. Apply reuses that session and guarded updates roll back together on mismatch or race.
- The authoritative gitignored audit proposal contains a structurally valid bot ID for all five. Normal output remains redacted and tracked source contains no discovered Stage B bot IDs.
- Fresh production read-only dry-run passed `READY = YES 5/5`; Phase 1 and Central World checks passed. No production mutation was performed.
- Focused Stage B tests pass 8/8; all LINE Chat tests pass; full backend tests pass 1,667/1,667; backend ESLint, build, and diff checks pass. Local runtime health was unavailable because Docker/database were stopped and occupied ports did not respond; Stage B files are operator CLIs and are not imported by the backend runtime.
- Stop condition honored. Exact future command: `npm run line-chat:phase2:stage-b:apply -- --apply --confirm-stage-b-routing-five`.

## Current task: Phase 2 Stage A — Shared Realtime Resolver Rollout Eligibility Deployed & Verified (2026-09-02) [WAITING FOR USER RETEST]

- **Root Cause & Minimal Patch**:
  - Live retest of Central World tag save revealed resolver failure `status = RESOLVE_CONFLICT`.
  - Root cause confirmed: `LineChatRecentResolverService` still had Phase 1-only hardcoded identity guards (`LINE_CHAT_PILOT_BOT_ID`, `LINE_CHAT_PILOT_SESSION_KEY`, `LINE_CHAT_PILOT_STORE_CODE`, `LINE_CHAT_PILOT_OA_NAME`) and required Store 28375.
  - Unified eligibility logic by making `LineChatRecentResolverService` and `LineChatNicknameQueueService` share `isLineChatRealtimeResolverEligible`.
  - The shared helper centrally validates:
    1. `storeCode` in controlled allowlist (`LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES`)
    2. `conversation.storeId` matches `oa.storeId`
    3. `oa.accountType === 'STORE'`
    4. `oa.isActive` and `oa.archivedAt == null`
    5. `oa.chatBotId` present and matches `expectedBotId` (when passed into resolver)
    6. `oa.lineChatSession` present, status is not `DISABLED`, and matches `expectedSessionKey` (when passed into resolver)
  - Added 8 unit tests in `line-chat-recent-resolver.service.spec.ts` covering Phase 1, Phase 2 DB routing, cross-OA parameter mismatches, and fail-closed security invariants.
- **CI / Deployment**:
  - PR #135 created and merged to `main` (commit `cf9f724`) after all CI checks passed (Android, Backend, Frontend, CI Gate).
  - Railway deployed both `line-unified-inbox` (Backend) and `line-chat-nickname-worker`.
  - Both services are online and healthy.
- **Production Database Verification**:
  - Central World Store 25610: `chatBotId: U001732513bc5f534c1a40d36c89bb43f`, `syncEnabled: true`, `sessionKey: account-1`, `profileStorageKey: account-1-v1`, `sessionStatus: ACTIVE`.
  - Phase 1 Store 28375: `chatBotId: U729972869a565723cb7fcf7ea28bbc43`, `syncEnabled: true`, `sessionKey: profile-b`, `profileStorageKey: profile-b-linux-v2`, `sessionStatus: ACTIVE`.
  - Remaining 5 Phase 2 stores: `syncEnabled: false`, `chatBotId: null`, `sessionKey: null`.
- **Next Action**:
  - Operator will perform a fresh real customer tag save on Central World (`@126fiiqf`) in `lineoppo.click`.
  - Observe the fresh job creation, worker resolution, and nickname sync in production logs.



## Current task: Complete v2 LINE chat discovery foundation (2026-09-01) [COMPLETED]

- Operator-supplied production evidence establishes the natural `GET /api/v2/bots/{botId}/chats` contract as `{ list, next }`, with `chatId` as the authoritative `chatType=USER` identifier and `U` plus 32 hexadecimal characters as the shared validator. Codex does not access production for this change.
- Mapping discovery now captures page one only from the SPA's natural bot-surface request, then enumerates later pages with authenticated `BrowserContext.request.get` using the observed URL/query/header contract. Opaque continuation values remain internal and are never returned or logged.
- Enumeration is fail-closed on non-200/non-JSON/unsupported responses, invalid USER records, duplicate conflicts, repeated continuation values, and bounded page/chat limits. Apply remains gated on `COMPLETE`; mapping, nickname, queue, worker, and DB behavior are not changed or invoked.
- The pilot CLI accepts an optional runtime-only `--profile` override while preserving Store/OA/bot/session identity guards and production profile-root containment.
- Verification: focused discovery/mapping tests 44 / 44; full backend tests 1,597 / 1,597; changed-file ESLint, backend build, and `git diff --check` pass.
- No production access, mapping apply, DB write, nickname mutation, queue/worker action, merge, or deployment was performed. The reviewed diff is limited to the nine intended files; next action is commit/push/open the requested PR and monitor CI without merging.

## Current task: LINE USER ID validation and passive pagination probe (2026-09-01) [COMPLETED]

- Operator-supplied production evidence confirms current `chatType=USER` chat identifiers use the official LINE USER ID contract: `U` followed by 32 hexadecimal characters. The shared validator now uses that exact case-insensitive structure; a leading `Ud` is no longer treated as a distinct prefix.
- Diagnostic aggregate labels now distinguish structurally valid USER IDs from invalid `U`-prefixed strings. The validator is reused by discovery and mapping foundations, while mapping apply remains blocked by incomplete pagination.
- The zero-candidate DOM container strategy is replaced with at most three left-side viewport targets and bounded positive Playwright mouse-wheel deltas. It uses viewport geometry only, performs no click or DOM text extraction, and stops as soon as the natural SPA issues a second matching GET.
- Second-page output remains query-name-only except numeric `limit`; all other values are `PRESENT_REDACTED`. No `/chats` request is manufactured, and no production, DB, mapping apply, nickname, queue, or worker action is performed.
- Verification: focused LINE Chat discovery/mapping/session/CLI tests 76 / 76; full backend tests 1,596 / 1,596; changed-file ESLint, backend build, and `git diff --check` pass.
- No production access, mapping apply, DB write, nickname mutation, queue/worker action, merge, or deployment was performed.

## Current task: Chat ID shape and scroll diagnostics (2026-09-01) [COMPLETED]

- Supplied production results showed all 25 first-page records populate `chatId`, none populate `userId`, only 2 matched the then-current incorrect literal-`Ud` validator, and `next` is an opaque string of 129+ characters. That historical validator assumption is corrected by the later USER ID validation task.
- Diagnostics now classify `chatId` prefixes and lengths as aggregate counts only, correlate those structural classes with safely exposed enum-like `chatType` categories or `TYPE_*` aliases, and report aggregate friend/profile presence without retaining values.
- An optional `--known-chat-id` is compared in memory against response fields and returns only `FOUND`/`NOT_FOUND`; the supplied value is never emitted or used for a request.
- The unsuccessful generic wheel is replaced with at most three geometry-ranked scroll-container attempts using visibility, bounds, overflow, and scroll dimensions only. No text/content is read, no customer is clicked, and any natural second-page GET is observed with query values redacted except numeric `limit`.
- Verification: focused LINE Chat tests 54 / 54; full backend tests 1,595 / 1,595; changed-file ESLint, backend build, and `git diff --check` pass.
- No production access, DB/mapping/apply operation, nickname mutation, queue call, merge, or deployment was performed.

## Current task: Chat pagination contract diagnostics (2026-09-01) [COMPLETED]

- Supplied production evidence verifies the current natural chat-list request as `GET /api/v2/bots/{botId}/chats` with the observed initial query-name set and a `{list, next}` response envelope. The prior `/{botId}/chat` route remains disproven; this work does not access production.
- Diagnostics now summarize aggregate `chatId`/`userId` strings and structurally valid LINE USER ID counts using the shared validator, without emitting identifiers. `next` is classified only by safe type, string class, length bucket, and object key names; its semantics remain unresolved.
- After the first matching response, diagnostics may issue only a natural UI mouse-wheel scroll and passively observe a second matching GET. It reports sanitized query-name differences and otherwise returns `NOT OBSERVED`; it never manufactures pagination requests.
- Mapping/discovery, nickname, queue, DB, and apply behavior are unchanged. Focused LINE Chat tests: 50 / 50; full backend tests: 1,588 / 1,588; changed-file ESLint, backend build, and `git diff --check` pass.
- No production access, pagination apply, mapping or nickname mutation, queue call, merge, or deployment was performed.

## Current task: Real chat-list response diagnostics (2026-09-01) [COMPLETED]

- Production evidence disproved `https://chat.line.biz/{botId}/chat` as a workspace route: it lands on `/error`. The chat-list diagnostic now navigates only to the normal bot surface `https://chat.line.biz/{botId}`.
- Production-observed `GET /api/v2/bots/{botId}/chats` is the current chat-list endpoint. Diagnostics wait for that natural GET response by method, origin, and exact bot path; they do not manufacture the request or guess query values.
- Matching response metadata remains sanitized to status/content type/query names/safe scalars/schema summaries. Response envelope and pagination completeness remain pending verification.
- A bounded wait reports `Chat List Response: NOT OBSERVED`; response-summary promises appended while waiting are drained before the report is returned. Mapping, discovery, nickname, queue, DB, and apply behavior are unchanged.
- Verification: focused LINE Chat service/CLI tests 29 / 29; full backend tests 1,585 / 1,585; changed-file ESLint passes; backend build passes; `git diff --check` passes.
- No production access, chat-list apply, mapping or nickname mutation, queue call, merge, or deployment was performed.

## Current task: Diagnostic API authentication probe (2026-09-01) [COMPLETED]

- Added a single explicit read-only `GET /api/v1/me` probe through the authenticated persistent BrowserContext request context with redirects disabled. Probe output contains only transport result, HTTP status, content type, JSON-ness, and top-level key names.
- Diagnostics now distinguish persistent session state from confirmed API authentication and report sanitized final navigation URL/origin/path, safe document title, main-document status, workspace-path recognition, redirects, and login/auth destinations.
- Diagnostic output exposes only aggregate cookie/storage metadata (`Total Cookies`, presence states); cookie names and browser-storage key names are not returned or printed.
- OAuth/code/state/token-like query values and all probe/body/account/customer values remain redacted or omitted. Mapping, nickname, queue, and production behavior are unchanged.
- Focused service/CLI regression coverage for 401/200/transport failure, redirects, workspace recognition, safe output, and GET-only probing passes (27 / 27); full backend tests pass (1,583 / 1,583); changed-file ESLint, backend build, and `git diff --check` pass.
- No production access, apply run, mapping or nickname mutation, queue call, merge, or deployment was performed.

## Current task: Chat-list network contract diagnostics (2026-08-31) [COMPLETED]

- Production evidence reported that the previously guessed `/api/v1/bots/{botId}/chats` path returned 404 and was not observed during authenticated bootstrap. Mapping discovery is intentionally unchanged; this task adds a read-only diagnostic surface for observing the real `/chat` workspace contract.
- Added `--surface bot|chat-list` to `line-chat:diagnose`. The new surface navigates only to `https://chat.line.biz/{botId}/chat`, never appends a customer ID, and never selects an individual chat.
- Request and response observers emit sanitized origin/pathname, query names, safe numeric pagination scalars, redacted cursor/token presence, header-presence flags, response status/content type, and JSON structure/key/length metadata only. Cookies, credentials, XSRF values, streaming tokens, customer values, message contents, and storage contents are not emitted.
- The diagnostic observes normal browser bootstrap traffic (including whether REST requests and the known SSE endpoint appear) but manufactures no network calls. Pagination and the production response contract remain unverified until a future production dry-run.
- Regression coverage includes both surfaces, path targeting, query/value redaction, response schema summaries, no customer-value output, and the existing session/nickname behavior.
- Verification after rebase: 82 / 82 focused LINE chat diagnostic/session/mapping/queue/backfill tests pass; 1,577 / 1,577 full backend tests pass; changed-file ESLint passes; backend build passes; `git diff --check` passes.
- No production access, mapping apply, nickname change, queue call, merge, or deployment was performed.

## Current task: Authenticated request-context discovery transport fix (2026-08-31) [COMPLETED]

- Production reported a generic browser `Failed to fetch` during the Store 28375 dry-run; no production access was performed by Codex for this fix.
- Refactored `discoverChats` from page navigation plus in-page `fetch` to the persistent Playwright `BrowserContext.request.get` API. This is a GET-only read and shares the persistent profile session without surfacing cookies, credentials, XSRF values, or storage state.
- Safe errors now distinguish transport failure, HTTP status (401/403/404/5xx), non-JSON responses, and fail-closed unsupported shapes. Pagination remains explicitly unverified and apply remains blocked unless enumeration is `COMPLETE`.
- Verification: 49 / 49 focused discovery/session/mapping tests pass; 1,568 / 1,568 full backend tests pass; changed-file ESLint passes; backend build passes; `git diff --check` passes.
- Production was not queried or mutated; no apply run, merge, or deployment was performed.

## Current task: Store 28375 Historical LINE OA Manager Chat ID Discovery (2026-08-31) [COMPLETED]

- Added a pilot-only operator CLI `npm run line-chat:mapping:discover -- --store 28375 [--dry-run | --apply]`; dry-run is the default and the npm script does not require `.env`.
- The authenticated browser path uses the existing observed endpoint `GET https://chat.line.biz/api/v1/bots/{botId}/chats`; the production response contract is not claimed as verified. The response parser is fail-closed and currently validated against sanitized known shapes, normalizing only chat ID, display name, last-message text/time/direction, and rejecting unknown top-level payloads or IDs outside the official LINE USER ID structure.
- Added deterministic confidence matching: display name alone is never exact; only a unique multi-signal `EXACT_CONFIDENT` row can be applied. Duplicate candidates, reused IDs, existing mappings, competing candidates, and ambiguous Store/OA topology fail closed.
- Pagination/next-page mechanics are not verified locally, so discovery reports `UNVERIFIED` and apply is blocked until a future production dry-run proves complete enumeration. Apply writes only `Conversation.lineChatUserId` inside a transaction after the complete-enumeration and zero-conflict gates pass. It never queues nickname jobs, changes nicknames, reads `Customer.lineUserId`, or starts from AppModule.
- Added sanitized adapter, matcher, CLI safety, idempotency, invalid-ID, conflict, existing-mapping, and no-secret-output regression coverage.
- Verification: 41 / 41 focused mapping/session tests pass; 1,555 / 1,555 full backend tests pass; changed-file ESLint passes; backend build passes; `git diff --check` passes.
- Production was not queried or mutated; no apply run, merge, or deployment was performed.

## Current task: Store 28375 Historical LINE Chat Nickname Backfill (2026-08-31) [COMPLETED]

- Added pilot-only CLI `npm run line-chat:nickname:backfill -- --store 28375 [--dry-run | --apply]`; dry-run is the default and the command relies on directly injected environment variables without requiring a `.env` file.
- The planner reads all Store 28375 conversations, resolves exactly one active Store OA, fails on ambiguous store/OA topology or cross-OA conversations, and uses the canonical `buildLineChatNickname` formatter.
- Dry-run performs read queries only, prints aggregate classification counts and a safe preview containing no Messaging API IDs, and never invokes the queue or LINE network path.
- Apply mode calls `LineChatNicknameQueueService.enqueueSalesSync` with an opt-in matching-job guard. It never calls `LineChatSessionService` or `chat.line.biz` directly.
- Matching non-superseded jobs are skipped, including failed/auth-failed jobs, preventing accidental duplicate execution or implicit retries. Different pending nicknames retain existing latest-wins supersession.
- The queue no longer selects `Customer.lineUserId`; only `Conversation.lineChatUserId` is validated and copied into the existing job schema.
- Verification: 75 / 75 targeted LINE chat tests pass; 1,527 / 1,527 backend tests pass; changed-file ESLint passes; backend build passes; `git diff --check` passes. The exact npm dry-run command also succeeds against the local Docker database with a directly injected local-only `DATABASE_URL`.
- No production dry-run, apply, database mutation, direct LINE call, merge, or deployment was performed.

## Previous task: Dedicated LINE OA Nickname Worker Ownership (2026-08-31) [COMPLETED]

- **Root cause**:
  - `AppModule` imported `LineChatModule`, and `LineChatModule` registered `LineChatNicknameWorkerService` as a provider.
  - Every process that bootstrapped `AppModule` could therefore run the nickname poller when `DISABLE_NICKNAME_WORKER` was absent or false. This included the main backend and the rich-menu standalone worker, which also bootstraps `AppModule`.
- **Architectural ownership fix**:
  - Removed `LineChatNicknameWorkerService` from the normal `LineChatModule` providers and exports.
  - Moved `LineChatNicknameWorkerModule` to `line-chat-nickname-worker.module.ts`; only the dedicated nickname-worker entrypoint imports it.
  - Kept `DISABLE_NICKNAME_WORKER` only as an emergency kill switch, not as the ownership boundary.
  - Added structured worker startup and successful-claim events containing `railwayServiceName`, `railwayReplicaId`, correlatable `workerId`, and `profileRoot` only.
- **Failure semantics**:
  - A failed outbound execution now increments `attemptCount`, including a missing browser profile.
  - Missing-profile failures remain terminal `FAILED` and are not automatically retried, avoiding an unsafe configuration-failure loop.
- **Regression verification**:
  - 57 / 57 targeted LINE chat tests pass.
  - 1,515 / 1,515 full backend tests pass.
  - Backend build passes.
  - ESLint passes on every touched/new TypeScript file. Repository-wide lint remains blocked by pre-existing errors in unrelated files.
  - Existing backend and frontend health endpoints return HTTP 200; database health is true.
  - `git diff --check` passes.

## Previous task: LINE OA Chat Nickname Sync: Decouple Messaging API User ID from LINE OA Manager Chat User ID (2026-08-31) [COMPLETED]

- **Root Cause & Domain Decoupling**:
  - `Customer.lineUserId` stores the Messaging API-sourced user ID, while `Conversation.lineChatUserId` stores the independently observed LINE OA Manager `chatId`. Both can share the official `U` plus 32-hex structure, but syntax alone does not prove value equality and never permits a fallback between fields.
  - Added additive `Conversation.lineChatUserId` and `LineChatNicknameSyncJob.lineChatUserId` columns with indexes via migration `20260831130000_add_conversation_line_chat_user_id`.
  - `Customer.lineUserId` is strictly preserved and never modified or overloaded.
- **Queue & Worker Architecture**:
  - `LineChatNicknameQueueService` validates `Conversation.lineChatUserId`. If missing, the BM sales update succeeds normally, and the queue skips safely with structured logging (`MISSING_LINE_CHAT_USER_ID`) without throwing or enqueueing broken requests.
  - `LineChatNicknameWorkerService` extracts `lineChatUserId` from the job and passes it to `LineChatSessionService.updateNickname`.
- **Pilot Mapping & Backfill Tooling**:
  - Created `backend/scripts/set-conversation-line-chat-user.ts` (`npm run line-chat:set-chat-user`) with `--conversation`, `--chat-user-id`, `--pilot`, and `--dry-run` modes.
  - Prepared production pilot mapping for conversation `cb6dc791-ef0e-45f0-bb33-96c9b638c9a0` $\to$ `Ud8d5af30ddca3ed4237e157d5d73c2f1`.
- **Verification Results**:
  - 1,511 / 1,511 backend unit & integration tests passing (`npm test` in `backend/`).
  - 59 / 59 targeted line-chat specs passing (`npx tsx --test src/line-chat/*.spec.ts src/line-chat-nickname.spec.ts`).
  - Backend compiles cleanly (`npm run build` in `backend/`).
  - ESLint passes with 0 errors and 0 warnings across all touched files.
  - `git diff --check` clean with zero whitespace issues.

## Previous task: LINE OA Chat Nickname Sync: NestJS AuthModule DI Wiring Fix (2026-08-31) [COMPLETED]

- **Root Cause**:
  - `LineChatOperationsController` is decorated with `@UseGuards(AuthGuard)` and `@Roles(UserRole.ADMIN)`.
  - When `LineChatModule` was initialized, `AuthGuard` required `Reflector`, `AuthService`, and `StoreAccessService`.
  - `LineChatModule` imported only `[PrismaModule]` without importing `AuthModule` (which exports `AuthService` and `StoreAccessService`).
  - Furthermore, `AuthModule` imported `[EmailModule]` without explicitly importing `PrismaModule`, leading to nested provider injection resolution errors during standalone module compilation.
- **Resolution**:
  - Imported `AuthModule` in `LineChatModule.imports: [PrismaModule, AuthModule]`.
  - Imported `PrismaModule` in `AuthModule.imports: [EmailModule, PrismaModule]`.
  - Added explicit `@Inject` tokens on constructor parameters across `MobileAuthService` and `EmailService`.
  - Maintained `LineChatNicknameWorkerModule` lightweight isolation importing only `[PrismaModule]`.
- **Verification Results**:
  - Backend compiles cleanly (`npm --prefix backend run build`).
  - 1,510 / 1,510 backend tests passing (`npm --prefix backend test`).
  - 58 / 58 targeted line-chat and security specs passing (`npx tsx --test src/line-chat/*.spec.ts src/line-chat-nickname.spec.ts`).
  - Actual application bootstrap verified: reaches `[NestApplication] Nest application successfully started` with all routes mapped cleanly.
  - Security matrix preserved: ADMIN allowed (200), VIEWER forbidden (403), Non-admin forbidden (403), unauthenticated unauthorized (401).

## Previous task: LINE OA Chat Nickname Sync: Store 28375 / Profile B Local E2E Fixture (2026-08-31) [COMPLETED]

- **Architecture & Local Fixture Setup**:
  - **Extended Local Test Fixture (`npm run seed:line-chat-test`)**:
    - Idempotently creates both Profile A (Mahachai) and Profile B (Store 28375 Chonburi) fixtures.
    - Profile B Fixture details:
      - Store ID: `de523e38-3cc4-49c9-88b9-539b6dad677d` (code: `28375`, name: `OBS Robinson Chonburi By OPPO`)
      - OA ID: `b1b055bf-2210-40f3-b0aa-be9facb14a69` (name: `OPPO BS RBS Chonburi`, `chatBotId: U729972869a565723cb7fcf7ea28bbc43`)
      - Session ID: `1509b0bf-3278-4bb1-90ac-dfbae0f1f349` (`sessionKey: profile-b`, `profileStorageKey: profile-b`, `status: ACTIVE`)
      - Customer ID: `4da73b35-999d-43d1-aa39-09b9e850cbdd` (`lineUserId: Ud8d5af30ddca3ed4237e157d5d73c2f1`)
      - Conversation ID: `b8ae98f8-ab1a-4b5c-98c0-f4d582ccada2`
      - Rollout flag: `lineChatNicknameSyncEnabled = true` exclusively for the test fixtures.
    - Zero production secrets or credentials copied; safe local-only random `webhookKey` placeholders.
  - **Dynamic Multi-Session Routing Verified**:
    - Automated tests in `line-chat-multi-session-worker.spec.ts` prove:
      - Store 28375 OA $\to$ routes to `profile-b` / `U729972869a565723cb7fcf7ea28bbc43`
      - Mahachai OA $\to$ routes to `profile-a` / `U092441d025f688e389d25779dd8debf4`
  - **Verification Suite**:
    - 1,510 / 1,510 backend unit & integration tests passing (`npm test` in `backend/`).
    - 58 / 58 targeted line-chat and security specs passing.
    - 476 / 476 frontend unit tests passing (`npm test` in `frontend/`).
    - Backend build compiling cleanly.
    - ESLint clean across all touched files (0 errors, 0 warnings).
    - `git diff --check` clean with 0 whitespace errors.

## Previous task: LINE OA Chat Nickname Sync: Production Rollout Architecture & Tooling (2026-08-31) [COMPLETED]

- **Architecture & Production Capabilities**:
  - **Scalable Multi-Session Routing (`profile-a`, `profile-b`, `profile-c`, ...)**:
    - Partitioning for ~150 LINE Official Accounts across multiple LINE Business sessions without schema redesign.
    - Decoupled DB from host environments using `profileStorageKey` and `LINE_CHAT_PROFILE_ROOT` (supports Railway persistent volume `/data/line-chat-profiles` and local `./local-data`).
  - **Granular Session Health Tracking & Fault Isolation**:
    - Enhanced `LineChatSession` model: `profileStorageKey`, `lastSuccessfulRequestAt`, `lastAuthFailureAt`, `consecutiveAuthFailures`, `status: ACTIVE | AUTH_REQUIRED | DISABLED`.
    - Session failure circuit breaker: HTTP 401 transitions the session to `AUTH_REQUIRED` and pauses its jobs without blocking other sessions (Profile A continues when Profile B fails).
  - **Safe Staged Rollout Toggle (`LineOfficialAccount.lineChatNicknameSyncEnabled`)**:
    - Additive database column defaulting to `false`.
    - Allows phased rollout (1 test store $\to$ 5 stores $\to$ Profile A $\to$ Profile B $\to$ full network) without impacting BM sales saves on un-enrolled stores.
  - **Worker Crash Recovery & Lease Management**:
    - Leased claims with `workerId`, `claimedAt`, and `lockedUntil` on `LineChatNicknameSyncJob`.
    - Automatic stuck job recovery in worker loop restoring orphaned `PROCESSING` jobs back to `PENDING`.
  - **Rate Limiting & Bounded Concurrency**:
    - Sequential session execution with configurable inter-request delay (`LINE_CHAT_SYNC_DELAY_MS`) protecting private LINE OA Manager endpoints.
  - **Bulk OA Mapping CLI Tool (`npm run line-chat:mapping:import`)**:
    - CSV mapping tool with dry-run validation, duplicate checking, bot ID format validation, and atomic transaction execution.
    - Zero modification of webhook secrets or Messaging API credentials.
  - **Admin Operations Health Visibility & Controls**:
    - Dedicated operations controller and service (`GET /operations/line-chat-nickname/health`, `POST retry-failed`, `PATCH toggle`).
    - Exposes aggregate non-secret health metrics, queue depth, and rollout progress.
  - **Comprehensive Production Deployment Runbook**:
    - Created `backend/docs/line-chat-nickname-sync/DEPLOYMENT_RUNBOOK.md` with step-by-step Railway configuration, volume setup, Chromium dependencies, authentication options, and emergency kill-switches.
- **Verification & Test Results**:
  - 1,506 / 1,506 backend unit & integration tests passing (`npm test` in `backend/`).
  - 54 / 54 targeted line-chat and mobile sales activity tests passing.
  - 476 / 476 frontend unit tests passing (`npm test` in `frontend/`).
  - ESLint passing cleanly on all changed files (0 errors, 0 warnings).
  - Backend build passing cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with zero whitespace errors.

## Previous task: LINE OA Chat Nickname Sync: BM Sales Save Hook & Queue Integration (2026-08-31) [COMPLETED]

- **Architecture & Technical Scope**:
  - **BM Save Transaction Isolation & Fault Decoupling**:
    - Nickname sync job creation hook is placed in `MobileConversationsService.updateCustomerSalesInfo` *after* `prisma.$transaction` commits.
    - Zero LINE requests or Playwright invocations occur inside the main database transaction.
    - If queue enqueuing or worker processing encounters an unexpected error, the BM save operation remains 100% successful and returns HTTP 200.
  - **Database-Backed Asynchronous Queue (`LineChatNicknameSyncJob`)**:
    - Created additive, non-destructive migration `20260831110000_add_line_chat_nickname_sync_queue`.
    - Statuses: `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `FAILED_AUTH`, `SUPERSEDED`.
    - Includes `attemptCount`, `maxAttempts` (default 3), `scheduledAt`, `processedAt`, `lastError`.
  - **Safe Latest-Wins Strategy**:
    - Enqueueing a new nickname job immediately transitions prior `PENDING` jobs for that conversation to `SUPERSEDED`.
    - Enqueueing for a non-nickname state (e.g. `INTERESTED`) supersedes pending jobs to prevent stale executions.
    - Worker applies a second guard before execution: if a newer job exists for the same conversation, the stale job is marked `SUPERSEDED` and skipped.
  - **Multi-Session & OA Routing (`LineChatSession`)**:
    - Created `LineChatSession` model (`sessionKey`, `displayName`, `profilePath`, `status`, `lastAuthenticatedAt`) and linked `LineOfficialAccount(lineChatSessionId, chatBotId)`.
    - No cookies, credentials, or session binaries stored in PostgreSQL.
    - Worker resolves `chatBotId` and `profilePath` dynamically (e.g. Profile A vs Profile B).
  - **Background Worker (`LineChatNicknameWorkerService` & CLI)**:
    - Atomically claims pending jobs with `status: PROCESSING`.
    - Executes page-context fetch via `LineChatSessionService`.
    - On 200: marks `SUCCESS`, updates `LineChatSession(lastAuthenticatedAt, status = ACTIVE)`.
    - On 401 / unauthenticated: marks `FAILED_AUTH`, sets `LineChatSession(status = AUTH_REQUIRED)`.
    - On retryable error (5xx, 429, network timeout): increments `attemptCount`, schedules exponential backoff.
    - On permanent error / max attempts: marks `FAILED` with sanitized error.
    - Added root & backend scripts `"worker:line-chat-nickname"`.
  - **Dedicated Lightweight Worker Module (`LineChatNicknameWorkerModule`)**:
    - Bootstraps `LineChatNicknameWorkerModule` importing only `[PrismaModule]`, with `reflect-metadata` and explicit `@Inject` tokens.
    - Zero dependency on `MobileAuthService`, `SMS_PROVIDER`, controllers, media storage, or push notifications.
  - **Local Test Fixture Seed Script (`npm run seed:line-chat-test`)**:
    - Idempotently creates/upserts `LineChatSession` (profile-a), `Store` (OPPO BigC MAHACHAI 1), `LineOfficialAccount` (`chatBotId: U092441d025f688e389d25779dd8debf4`), `Customer` (`lineUserId: Ud8d5af30ddca3ed4237e157d5d73c2f1`), and `Conversation`.
    - Uses safe local-only placeholder `webhookKey`. Zero production secrets, tokens, or webhooks touched.
  - **Local Conversation Web UI Customer Sales Tag Control (`CustomerSalesTagEditor`)**:
    - Added compact Customer Sales Tag section in the conversation details drawer (`frontend/src/app/customer-sales-tag-editor.tsx` and `frontend/src/app/page.tsx`).
    - Supports `ONLINE`, `INTERESTED`, and `PURCHASED` (with `CASH` / `INSTALLMENT` and product model selector).
    - Calls canonical endpoint `PATCH /mobile/conversations/:id/customer-sales-info` without frontend awareness of Playwright or LINE sessions.
  - **NestJS DI Module Wiring & Robust Enqueue Resolution**:
    - Marked `LineChatModule` as `@Global()` and added explicit `@Inject(LineChatNicknameQueueService)` to `MobileConversationsService`.
    - Removed `@Optional()` so missing DI dependencies fail fast at startup instead of failing silently at runtime.
    - Added integration tests in `backend/src/line-chat/mobile-nickname-wiring.spec.ts` verifying Nest DI resolution and DB sync job creation.
- **Verification & Test Results**:
  - 1,492 / 1,492 backend unit & integration tests passing (`npm test` in `backend/`).
  - 45 / 45 targeted line-chat and mobile sales activity tests passing.
  - 476 / 476 frontend unit tests passing (`npm test` in `frontend/`).
  - ESLint passing cleanly on all changed and new files (0 errors, 0 warnings).
  - Next.js frontend production build passing cleanly (`npm run build` in `frontend/`).
  - Backend build passing cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with zero whitespace errors.

## Previous task: Greeting Message Manager Preview & Activation UX Polish (2026-08-28) [COMPLETED]

- **UX Scope & Behavior**:
  - **Deterministic Preview Following Store Selection**:
    - Live mobile chat preview resolves context variables based on the most recently checked store in the target table (`lastSelectedStoreOaId`).
    - Deselecting a store falls back smoothly to the previous selected store or default sample store.
    - Added `[ ดูตัวอย่างสำหรับ: ... ▼ ]` with `✓ อิงจากร้านที่เลือก` indicator above the preview. Manual preview dropdown selection only modifies preview without mutating assignment checkboxes.
  - **Clear Lifecycle Status & Badges**:
    - Visible status badge in header:
      - `ACTIVE`: `● ใช้งานอยู่ · {count} ร้าน · v{version}`
      - `DRAFT`: `○ แบบร่าง · ยังไม่เปิดใช้งาน · v{version}`
      - `INACTIVE`: `○ ปิดใช้งาน · {count} ร้าน · v{version}`
      - `ARCHIVED`: `เก็บถาวร · v{version}`
    - Dedicated lifecycle action buttons: `[ เปิดใช้งานเทมเพลต ]` / `[ ปิดใช้งานเทมเพลต ]` / `[ จัดเก็บ ]`.
  - **Button Copy Clarification**:
    - Save button: `บันทึกเทมเพลต` / `Save template` / `保存模板`.
    - Assignment button: `นำไปใช้กับ {N} ร้าน` / `Apply to {N} stores` / `应用到 {N} 家门店`.
    - Activation button: `เปิดใช้งานเทมเพลต` / `ปิดใช้งานเทมเพลต`.
  - **Dirty State Tracking**:
    - Real-time comparison between form state and current saved template.
    - Displays `● มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก` badge near the Save button. Clears immediately upon successful save.
  - **Store Status Column ("สถานะข้อความต้อนรับ")**:
    - Replaced ambiguous template column with informative operational status per store:
      - Active template: `● ใช้งานอยู่` + `{name} · v{version}`
      - Draft template: `○ ผูกเทมเพลตแล้ว แต่ยังเป็นแบบร่าง` + `{name} · v{version}`
      - Inactive template: `○ ปิดใช้งาน` + `{name} · v{version}`
      - Unassigned: `—` + `ไม่มีข้อความต้อนรับจากระบบนี้`
  - **Active Template Edit Warning Modal**:
    - Confirms: `"การแก้ไขเทมเพลตนี้จะมีผลกับ {X} สาขาที่ใช้งานอยู่ทันที สำหรับ Follow event ใหม่หลังจากบันทึก"`.
- **Verification & Test Results**:
  - 462 / 462 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly across 29 routes (`npm run build` in `frontend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Greeting Message Manager UI Polish & LINE OA Alignment (2026-08-28) [COMPLETED]

- **UI Scope & Alignment**:
  - Redesigned `/greeting-messages` content workspace to visually and structurally match native LINE Official Account Manager.
  - Section hierarchy:
    - **Header**: `ข้อความต้อนรับ` with helper notice, quick template switcher, and top-right `#06c755` LINE Green `[ บันทึกการเปลี่ยนแปลง ]` action button.
    - **Native OA Manager Notice**: Compact pale amber notice with direct link to LINE Official Account Manager (`https://manager.line.biz/`).
    - **Sending Restrictions (`ข้อจำกัดการส่ง`)**: Single clean checkbox `[ ] ส่งเฉพาะเพื่อนใหม่ครั้งแรก` (`Only send for first-time friends`) mapped directly to `FIRST_TIME_ONLY` vs `ADD_AND_UNBLOCK`.
    - **Message Content Grid (68% Editor / 32% Sticky Preview)**:
      - Clean single editor frame per message block with gray header toolbar (`T` / `🖼️` icons and `▲`, `▼`, `✕` controls).
      - Textarea with character count (`171 / 5000`) and LINE OA-style variable buttons (`[ 😊 อิโมจิ ]`, `[ ชื่อผู้ใช้ ]`, `[ ชื่อบัญชี ]`, `[ ชื่อร้าน ]`, `[ Google Maps ]`, `[ ตัวแปรเพิ่มเติม ▾ ]`).
      - Image block integrated into editor frame.
      - `[ + เพิ่ม ]` button with popover for Text / Image up to 5 blocks.
      - Sticky LINE chat screen preview on desktop with realistic wallpaper, avatar, account name, and green variable pill badges.
    - **Store Assignments (`การใช้งานกับสาขา`)**: Compact summary bar with `[ เลือกสาขา ]` expandable table.
- **Verification & Test Results**:
  - 456 / 456 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly across 29 routes (`npm run build` in `frontend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Greeting Message Manager Phase 1 (2026-08-28) [COMPLETED]

## Previous task: Rich Menu "No Rich Menu / Clear Default" Management (2026-08-27)

- **Architecture & Technical Scope**:
  - **Messaging API Default Clear (`DELETE /v2/bot/user/all/richmenu`)**:
    - Implemented dedicated store Rich Menu clear action via `LineRichMenuClientService.clearDefaultRichMenu()`.
    - Guarantees zero deletion of the underlying Rich Menu resource on LINE (`DELETE /v2/bot/richmenu/{id}` is not called), keeping publication history durable and auditable.
    - Server-side decrypted channel access token executes the unlinking and immediately verifies `GET /v2/bot/user/all/richmenu` returns HTTP 404 (`source: "NONE"`).
  - **Backend API & Service**:
    - Added `POST /rich-menu/accounts/:lineOfficialAccountId/clear-default` and `GET /rich-menu/accounts/:lineOfficialAccountId/current-state` guarded by `Roles(UserRole.ADMIN)`.
    - Validated target account type (`accountType === "STORE"` only; `HEAD_OFFICE` rejected with explicit error), active status (`archivedAt === null`), and valid credentials.
    - Captures current default `richMenuId` and matched template name before unlinking.
    - Cleans up `RichMenuStoreAssignment` for the store while strictly preserving `RichMenuPublishAttempt` rows.
    - Records durable audit log with action `RICH_MENU_DEFAULT_CLEARED` and metadata.
  - **Server-Derived Store Current State**:
    - Added `RichMenuStoreCurrentState` resolving:
      - `PUBLISHED`: Messaging API default matches a known published template.
      - `NO_MESSAGING_API_DEFAULT`: LINE returns 404.
      - `OTHER_OR_MANAGER`: LINE returns 403 or an unmapped foreign richMenuId.
      - `UNKNOWN`: LINE OA unconfigured or network failure.
  - **Frontend UX & Confirmation Modal**:
    - Published stores show `✓ {templateName}` with action `[ หยุดแสดง ]` (`clearDefaultButton`).
    - Stores with no Messaging API default show `— ไม่มี Rich Menu จากระบบนี้` (`noMessagingApiDefault`).
    - Stores with external default show `มี Rich Menu จากแหล่งอื่น / OA Manager` (`otherOrManagerDefault`).
    - Added confirmation modal (`clearDefaultModalTitle`, `clearDefaultModalDesc`) displaying store name, LINE OA name, template name, and explanatory notice: `หากบัญชีนี้มี Rich Menu ที่ตั้งไว้ใน LINE Official Account Manager เมนูดังกล่าวอาจกลับมาแสดงแทน`.
    - Added comprehensive i18n support across Thai, English, and Chinese.
- **Verification & Test Results**:
  - 1,393 / 1,393 backend unit & integration tests passing (`npm test` in `backend/`).
  - 448 / 448 frontend unit tests passing (`npm test` in `frontend/`).
  - NestJS/Prisma production build succeeded cleanly (`npm run build` in `backend/`).
  - Next.js Turbopack production build succeeded cleanly across 28 routes (`npm run build` in `frontend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Fix Signed Public Media Delivery for Auto-response Images (2026-08-27)

- **Root Cause Confirmed**:
  - `MediaController.publicMedia` previously enforced `if (!key.startsWith("line-media/outbound/") || !verifyMediaPublicUrl(key, expires, signature))` which rejected all signed Auto-response image URLs under `line-media/auto-response/`.
- **Public Media Prefixes & Security Hardening**:
  - Created centralized helper `isAllowedPublicMediaObjectKey(key)` in `media-public-url.ts` allowing:
    - `line-media/outbound/`
    - `line-media/auto-response/`
  - Enforced strict validation rejecting traversal sequences (`..`, `\`, leading `/`, and URI-encoded traversal `%2e%2e`, `%2f`, `%5c`).
  - Maintained cryptographic signature verification via `verifyMediaPublicUrl(key, expires, signature)` using timing-safe comparison and expiry check.
  - Automatically resolved image `Content-Type` (`image/jpeg` or `image/png`) and set `Content-Disposition: inline`.
- **Verification & Test Results**:
  - 1,392 / 1,392 backend unit & integration tests passing (`npm test` in `backend/`).
  - 448 / 448 frontend unit tests passing (`npm test` in `frontend/`).
  - Backend and frontend production builds succeeded cleanly.
  - `git diff --check` clean.

## Previous task: Auto-response Manager Phase 2: Image + Multi-message Builder (2026-08-27)

- **Architecture & Technical Scope**:
  - **Multi-Message Sequence Builder**:
    - Replaced the single text area with a dynamic ordered Message Builder supporting 1 to 5 message blocks (`TEXT` and `IMAGE`).
    - Enforced maximum limit of 5 message objects per auto-response (LINE Messaging API limit) on both backend and frontend.
    - Implemented explicit stable ordering controls (Move Up `↑`, Move Down `↓`, Delete `ลบ`) without external heavy libraries.
    - Added variable injection `[ แทรกข้อมูลร้าน ▼ ]` across any individual `TEXT` block.
  - **Database & Backward Compatibility**:
    - Extended enum `AutoResponseContentType` with `'IMAGE'` and `'MULTI_MESSAGE'`.
    - Added `contentJson JSONB` to `AutoResponseRule` and made `textTemplate` nullable.
    - Added `messageCount INTEGER` and `messageTypesJson JSONB` to `AutoResponseExecution`.
    - Legacy Phase 1 rules automatically normalize into `{ version: 1, messages: [{ type: "TEXT", textTemplate: ... }] }` without destructive migrations.
    - When saving Phase 2 rules, `contentJson` is canonical and single-text rules mirror into `textTemplate`.
    - Applied non-destructive migration `20260827220000_add_auto_response_multi_message`.
  - **Image Storage & Media Handling**:
    - Reused existing `MediaStorageService` / S3 bucket infrastructure with dedicated object-key namespace: `line-media/auto-response/${fileId}-original.${ext}` and `preview.${previewExt}`.
    - Added `POST /auto-responses/media` guarded with `ADMIN` and Multer memory storage (max 10 MB).
    - Validated image magic bytes (`detectImageMime`) allowing only JPEG and PNG; rejected GIF, WEBP, SVG, PDF, video.
    - Generated optimized server-side preview image ($\le 1$ MB) using Sharp for LINE Messaging API compliance.
    - At webhook execution time, fresh signed HTTPS public URLs are dynamically generated via `createMediaPublicUrl()`.
  - **Single-Request Atomic LINE Dispatch (`LineMessagingService.replyMessages`)**:
    - Extended `LineMessagingService` with public `replyMessages()` accepting an array of message descriptors.
    - Webhook execution resolves all blocks atomically in pre-flight before any network call. If any required variable or media object fails, 0 messages are sent and the attempt is skipped/logged cleanly.
    - Dispatches all 1–5 message blocks in **ONE single HTTP request** to `POST https://api.line.me/v2/bot/message/reply` using the incoming `replyToken`. Zero push message fallback.
  - **Frontend Workspace & Rich Menu Integration**:
    - Extracted modular frontend components: `AutoResponseMessageBuilder`, `AutoResponseImageBlock`, `AutoResponsePreviewStream`.
    - Renders simulated mobile LINE chat stream with store variable resolution and per-block validation status.
    - In Rich Menu area editor, compact Auto-response preview shows message count badge (`🖼 💬 2 ข้อความ`), status badge, and first text snippet.
- **Verification & Test Results**:
  - 1387 / 1387 backend unit & integration tests passing (`npm test` in `backend/`).
  - 448 / 448 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly across 28 routes (`npm run build` in `frontend/`).
  - NestJS & Prisma production build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Auto-response Manager Phase 1 + Rich Menu POSTBACK Integration (2026-08-27)

- **Architecture & Technical Scope**:
  - **Single Source of Truth in lineoppo.click**:
    - Created dedicated Auto-response Rule management within `lineoppo.click` powered by LINE Webhook postback ingestion and Messaging API reply.
    - Zero interference or scraping of LINE OA Manager native auto-responses.
    - Prominent informational warning banner across UI in Thai, English, and Chinese: *"เพื่อป้องกันการตอบซ้ำ ควรปิดข้อความตอบกลับอัตโนมัติที่ทำงานซ้ำกันใน LINE Official Account Manager"*.
  - **Stable Versioned Postback Payload & Protocol**:
    - Centralized builder `buildAutoResponsePostbackData(ruleId)` producing stable namespaced payload: `oppo_ar:v1:<autoResponseRuleId>`.
    - Strict parser `parseAutoResponsePostbackData(data)` which safely returns `{ isAutoResponse: false }` for any non-namespaced postbacks (e.g. third-party bots, LIFF postbacks).
    - Rich Menu area action payload configured as `{"type": "postback", "data": "oppo_ar:v1:<ruleId>"}` without `displayText`.
  - **Database Models & Non-destructive Migration**:
    - Added `AutoResponseRule` model with status (`DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`), `triggerType: POSTBACK`, `contentType: TEXT`, `textTemplate`, `version`, and audit relations.
    - Added `AutoResponseExecution` model tracking `ruleId`, `lineOfficialAccountId`, `webhookEventId`, `status: SUCCESS | SKIPPED | FAILED`, `reason`, `resolvedVariablesJson`, and timestamps.
    - Created migration `20260827210000_add_auto_response_manager/migration.sql`.
  - **Decoupled Rich Menu / Auto-response Rule Versioning**:
    - Rich Menu areas link directly to `AutoResponseRule.id` via `autoResponseRuleId`.
    - Editing text on an `ACTIVE` rule increments rule version and takes effect **immediately** for all published store Rich Menus without requiring Rich Menu re-publishing.
  - **Webhook Postback Execution Engine (`AutoResponseExecutionService`)**:
    - Postback ingestion pipeline extracts `oppo_ar:v1:<ruleId>` from verified LINE webhook event.
    - Enforces: OA exists, active, non-archived, accountType `STORE` (excludes `HEAD_OFFICE`).
    - Enforces: Referenced `AutoResponseRule` exists and is `ACTIVE`.
    - Resolves store variables (`{{store.storeName}}`, `{{store.googleMapsUrl}}`, `{{store.lineOaLink}}`, `{{store.tiktokProfileUrl}}`).
    - Decrypts store channel access token securely server-side.
    - Sends customer reply using `LineMessagingService.replyText` via `replyToken` (zero push message usage).
    - Idempotency deduplication using `webhookEventId`.
    - Comprehensive execution logging in `AutoResponseExecution`.
  - **Admin Workspace (`/auto-responses`)**:
    - ADMIN-guarded workspace with search, filter tabs (`ALL`, `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`), rule editor, store variable inserter `[ แทรกข้อมูลร้าน ▼ ]`, live store evaluation preview with readiness indicator, and linked Rich Menu usage viewer.
  - **Rich Menu Action Dropdown Integration**:
    - Added `POSTBACK_AUTO_RESPONSE` ("ตอบกลับอัตโนมัติ (Auto-response)") action type.
    - Area editor includes Auto-response Rule selector, status badge, live template preview, and warning if inactive.
    - Publishing engine evaluates rule readiness: blocks publishing if referenced rule is DRAFT/INACTIVE or store lacks required variables.
- **Verification & Test Results**:
  - 1377 / 1377 backend unit & integration tests passing (`npm test` in `backend/`).
  - 447 / 447 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly across 28 routes (`npm run build` in `frontend/`).
  - NestJS & Prisma production build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Simplify Rich Menu Target Stores UX to Single Checkbox (2026-08-27)

- **Architecture & UX Simplification**:
  - **Single Checkbox Selection Paradigm**:
    - Replaced the dual-checkbox columns (`กำหนดให้ร้าน` and `เลือกเผยแพร่`) with a single, clear `[ ] เลือก` checkbox column.
    - Removed manual store assignment UI, `[ บันทึกร้านที่เลือก ]` button, assignment save notices, and all manual assignment prerequisite steps from `/rich-menus`.
    - Maintained one unified user-facing selection state: `publishSelectedOaIds`.
  - **Internal Automatic Assignment**:
    - Retained the `RichMenuStoreAssignment` Prisma database model and tables for audit, historical tracking, and backward compatibility.
    - When creating a bulk publish job (or single canary publish), missing `RichMenuStoreAssignment` records are automatically created/upserted inside the database transaction before creating publish attempts.
  - **Readiness & Selection Rules**:
    - Checkbox enabled only for stores with `readinessStatus === "READY"` (evaluating template variables such as Google Maps URL).
    - Stores already published for the exact current template version show `✓ เผยแพร่แล้ว` with checkbox disabled to prevent duplicate re-publishes. If template version changes, stores show `[มีเวอร์ชันใหม่]` and selection is re-enabled.
  - **Unified Action Controls**:
    - Added dynamic helper button `[ เลือกสูงสุด 5 ร้านที่พร้อมใช้งาน ]` respecting `maxTargets`.
    - Added `[ ล้างการเลือก ]` button and selection count indicator (`เลือกแล้ว X / สูงสุด 5 ร้าน`).
    - Unified publish button `[ เผยแพร่ร้านที่เลือก (N) ]` handling 1–5 stores seamlessly.
    - Updated translations across Thai (`th`), English (`en`), and Simplified Chinese (`zh`).
- **Verification & Test Results**:
  - 1356 / 1356 backend unit & integration tests passing (`npm test` in `backend/`).
  - 441 / 441 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly across 27 routes (`npm run build` in `frontend/`).
  - NestJS & Prisma production build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with 0 whitespace errors.

## Previous task: Implement Rich Menu Phase 2B (Durable Multi-Store Bulk Publishing with Background Queue) (2026-08-27)

- **Architecture & Workflow**:
  - **Durable Bulk Publish Job & Queue Architecture**:
    - Introduced `RichMenuPublishJob` and `RichMenuPublishJobStatus` (`PENDING`, `RUNNING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `CANCELLED`, `CANCELLING`, `FAILED`) to coordinate 1 Template $\to$ N explicit target stores.
    - Extended `RichMenuPublishAttempt` with `jobId`, `publishType` (`CANARY` | `BULK`), and `status` (`QUEUED`, `SKIPPED`, `CANCELLED`).
    - Added `RichMenuWorkerHeartbeat` to monitor active background queue workers and warn frontend if worker is offline.
  - **Background Worker & Concurrency Control (`RichMenuPublishWorkerService` & `rich-menu-worker.ts`)**:
    - Atomic batch claiming using PostgreSQL transaction + row-level state transition (`PENDING` $\to$ `RUNNING`).
    - Bounded concurrency per batch (configurable via `RICH_MENU_PUBLISH_CONCURRENCY`, default 2, max 5) using `p-limit` style worker pooling.
    - Bounded batch size limit (configurable via `RICH_MENU_MAX_BULK_TARGETS`, default 5).
    - Heartbeat recording every 10 seconds.
    - Graceful cancellation support: `CANCELLED` / `CANCELLING` transitions abort remaining attempts immediately and mark in-flight attempts `CANCELLED` / `SKIPPED`.
    - Retry failed stores only: Creates a new child `RichMenuPublishJob` targeting exclusively failed attempts from the parent job.
  - **LINE Client Resiliency (`LineRichMenuClientService`)**:
    - Exponential backoff retry loop for transient network / 429 rate limit / 5xx server errors on LINE endpoints (`withRetry`).
    - 400 Bad Request fail-fast validation protection.
  - **Frontend UI Workspace Modernization (`frontend/src/app/rich-menus/rich-menus-view.tsx`)**:
    - Dual-checkbox table paradigm: `Assign` (Store Assignment) and `Publish` (Explicit Publish Selection).
    - Real-time publish capabilities badge & worker readiness indicator (`GET /rich-menu/publish-capabilities`).
    - Active Job Progress Card: Real-time progress bar ($K / N$ stores), status badge, `[ Cancel ]` button, and `[ Retry Failed Stores Only ]`.
    - Bulk Publish Confirmation Modal displaying total count, target store list with LINE OA names, and background processing notice.
    - Per-store granular actions: individual rollback, single retry, and live status tooltips.
    - Multilingual dictionary updated for Thai (`th`), English (`en`), and Simplified Chinese (`zh`).
- **Verification & Test Results**:
  - 1355 / 1355 backend unit & integration tests passing (`npm test` in `backend/`).
  - 441 / 441 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - NestJS & Prisma production build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean with zero whitespace or line-ending errors.

## Previous task: Implement Rich Menu Phase 2A (Safe Single-Store Canary LINE Publishing) (2026-08-27)

- **Architecture & Workflow**:
  - **Single-Store Canary Guardrails**: Strictly enforced 1-store publishing per action on both frontend and backend. Rejects HEAD_OFFICE accounts, archived/disabled OAs, unassigned stores, or stores with blocked/missing variables (e.g. `{{store.googleMapsUrl}}`).
  - **Prisma Schema & State Tracking**: Added `selected Boolean @default(true)` to `RichMenuTemplate`, added `RichMenuPublishStatus` and `RichMenuPreviousDefaultSource` enums, and created `RichMenuPublishAttempt` model to track publishing lifecycle, stage progress, errors, previous defaults, and attempt counts.
  - **Centralized LINE HTTP Client (`LineRichMenuClientService`)**:
    - `validateRichMenu`: Validates rich menu JSON against `POST https://api.line.me/v2/bot/richmenu/validate`.
    - `getDefaultRichMenu`: Detects existing default source (`MESSAGING_API` with 200, `NONE` with 404, `OTHER_OR_MANAGER` with 403) before setting a new default.
    - `createRichMenu`: Creates rich menu on `POST https://api.line.me/v2/bot/richmenu`.
    - `uploadRichMenuImage`: Streams raw binary image content to `POST https://api-data.line.me/v2/bot/richmenu/{id}/content`.
    - `setDefaultRichMenu`: Sets default menu on `POST https://api.line.me/v2/bot/user/all/richmenu/{id}`.
    - `clearDefaultRichMenu`: Unlinks default menu on `DELETE https://api.line.me/v2/bot/user/all/richmenu`.
    - `deleteRichMenu`: Cleans up orphaned rich menus on `DELETE https://api.line.me/v2/bot/richmenu/{id}`.
  - **Publish Orchestration Pipeline**:
    1. Single-store validation and eligibility checks.
    2. Dynamic store master variable resolution (`{{store.googleMapsUrl}}`, `{{store.storeName}}`, etc.).
    3. Retrieve stored image binary via `MediaStorageService.get()`.
    4. Decrypt OA channel access token using `CredentialEncryptionService`.
    5. Stage progression: `VALIDATING` $\to$ Detect previous default $\to$ `CREATING` $\to$ `IMAGE_UPLOADING` $\to$ `SETTING_DEFAULT` $\to$ `VERIFYING` $\to$ `PUBLISHED`.
    6. Automatic cleanup delete on image upload failure.
    7. Idempotency guard preventing concurrent publishing requests within 5 minutes.
    8. Full rollback capability (`POST /publish-attempts/:id/rollback`) restoring previous default rich menu or unlinking default.
    9. Stage-safe retry (`POST /publish-attempts/:id/retry`).
  - **Audit Logging**: Recorded `RICH_MENU_PUBLISH_STARTED`, `RICH_MENU_PUBLISHED`, `RICH_MENU_PUBLISH_FAILED`, and `RICH_MENU_ROLLED_BACK`.
  - **Privacy Guarantee**: Zero tokens or decrypted secrets logged or included in `resolvedConfigJson` or API responses.
  - **Frontend UI & Multilingual Support**:
    - Added Canary Publish button `[ เผยแพร่ไปยัง LINE ]` enabled when exactly 1 READY assigned store is selected with valid template and image.
    - Added Confirmation Modal with store details, LINE OA name, template name, readiness status, and warning notice.
    - Added Rollback Modal and Retry actions.
    - Added LINE Publishing status column in Target Stores table (`Published`, `Not published`, `Failed` with error & retry, `Rolled back`, `Publishing...`).
    - Added default behavior toggle: Show (`แสดง` $\to$ `selected: true`), Hide (`ซ่อนเมนู` $\to$ `selected: false`).
    - Full multilingual support across Thai (`th`), English (`en`), and Chinese (`zh`).
- **Verification & Test Results**:
  - 1349 / 1349 backend tests passing (`npm test` in `backend/`).
  - 441 / 441 frontend tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack build succeeded cleanly (`npm run build` in `frontend/`).
  - Backend build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean.

## Previous task: Wire Rich Menu Image Storage Correctly (2026-08-27)

- **Root Cause Analysis**:
  - `RichMenuService` constructor had `@Optional() @Inject("MediaStorageService") private readonly media?: MediaStorageService`.
  - Because `MediaStorageService` was injected by string literal token `"MediaStorageService"` instead of class token `MediaStorageService` and marked `@Optional()`, NestJS failed to inject it, leaving `this.media` as `undefined` at runtime.
  - Calling `POST /rich-menu/upload-image` hit `if (!this.media) throw new ServiceUnavailableException("Media storage is unavailable")` resulting in HTTP 503.
  - In addition, image URL generation previously constructed an ad-hoc `/api/media/...` route rather than reusing the canonical signed outbound media route `createMediaPublicUrl(objectKey)`.
- **Resolution**:
  - **Required DI Injection**: Changed `RichMenuService` constructor to inject `MediaStorageService` directly as a required dependency with `@Inject(MediaStorageService)`.
  - **Canonical Public Outbound Media URL**: Replaced ad-hoc URL generation with `createMediaPublicUrl(objectKey)`, returning signed URLs (`/messages/media/public?key=...&expires=...&signature=...`).
  - **Signed URL Refresh on Read**: Added `resolveTemplateImageUrl()` in `RichMenuService` to dynamically refresh signed URLs for stored templates during `listTemplates()`, `getTemplate()`, and `preview()`, while preserving legacy URLs.
  - **Storage Put Error Handling**: Wrapped `this.media.put` in try/catch with safe diagnostic logging and clean localized error messages (`"ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง"`).
  - **Comprehensive Regression Tests**: Added NestJS DI injection regression tests, module wiring assertions (`RichMenuModule` imports `MediaModule`, `MediaModule` exports `MediaStorageService`), public URL verification tests, and signed URL refresh tests.
- **Verification & Test Results**:
  - 1344 / 1344 backend tests passing (`npm test` in `backend/`).
  - 439 / 439 frontend tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack build succeeded cleanly (`npm run build` in `frontend/`).
  - Backend build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean.

## Previous task: Make JPEG/PNG Rich Menu Uploads Reliable in Production (2026-08-27)

- **Root Cause Analysis**:
  - Image upload previously depended solely on `sharp(file.buffer).metadata()` which threw exceptions on certain valid JPEG/PNG files in containerized environments, and converted all decoder exceptions into the generic `"Invalid or corrupt image file"`.
  - The UI simultaneously showed both `"ยังไม่ได้เลือกรูปภาพ"` and `"Invalid or corrupt image file"`.
- **Resolution**:
  - **Magic Bytes Signature Detector**: Implemented `detectImageMagicBytes` checking exact PNG (`89 50 4E 47 0D 0A 1A 0A`) and JPEG (`FF D8 FF`) bytes before parsing.
  - **Pure JS Dimension Parsing**: Adopted `image-size` as the primary resilient metadata parser, with Sharp as a fallback, preserving unmodified original bytes during storage.
  - **Multer Memory Storage**: Explicitly configured `FileInterceptor` with `memoryStorage()` and 1 MB size limit.
  - **Template Aspect Ratio Verification**: Added checks verifying that uploaded images match the selected template format (Large vs Compact) with clear localized errors.
  - **Safe Diagnostic Logging**: Emitted structured log metadata on failure without logging image bytes or content.
  - **Frontend UX Refinement**: Added client-side format validation, single clear error banner, and preserved existing template images when a replacement upload fails.
- **Verification & Test Results**:
  - 1341 / 1341 backend tests passing (`npm test` in `backend/`).
  - 439 / 439 frontend tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack build succeeded cleanly (`npm run build` in `frontend/`).
  - Backend build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean.

## Previous task: Match LINE OA Template Presets (12 Official-Style Presets) (2026-08-27)

- **12 Canonical LINE OA Template Presets**:
  - Implemented 7 Large layouts (2500x1686 canonical canvas: `LARGE_6`, `LARGE_4`, `LARGE_TOP_1_BOTTOM_3`, `LARGE_LEFT_1_RIGHT_2`, `LARGE_2_ROWS`, `LARGE_2_COLS`, `LARGE_1`).
  - Implemented 5 Compact layouts (2500x843 canonical canvas: `COMPACT_3`, `COMPACT_LEFT_SMALL`, `COMPACT_LEFT_LARGE`, `COMPACT_2`, `COMPACT_1`).
  - Maintained backward-compatibility for legacy presets (`GRID_6`, `GRID_4`, `GRID_3`) and custom coordinates (`CUSTOM`).
- **Template Selector UI**:
  - Expanded modal to match LINE OA Manager layout (`width: min(1080px, calc(100vw - 40px))`, `maxHeight: calc(100vh - 32px)`, `overflow-y-auto`).
  - Organized into Large and Compact groups with localized dimensions and descriptions in Thai, English, and Chinese.
  - Thumbnails rendered with crisp SVG dividers (`#b6babf`), aspect ratios, and LINE green `#06C755` selection styling.
- **Verification & Test Results**:
  - 1339 / 1339 backend tests passing (`npm test` in `backend/`).
  - 438 / 438 frontend tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack build succeeded cleanly (`npm run build` in `frontend/`).
  - Backend build succeeded cleanly (`npm run build` in `backend/`).
  - `git diff --check` clean.

## Previous task: Full Multilingual Support on /rich-menus (2026-08-27)

- **Multilingual UI Dictionary Architecture**:
  - Implemented `RICH_MENU_I18N` in `frontend/src/app/rich-menus/rich-menu-i18n.ts` supporting Thai (`th`), English (`en`), and Chinese (`zh`).
  - Replaced all visible hardcoded English strings across the workspace: Page Header, Template Selector, Main Settings, Menu Content, Preview, Preset Picker Modal, Image Upload, Actions, Variable Insertion chips, Other Settings, and Target Stores.
  - Natural Thai translations tailored for operations: "ริชเมนู", "บันทึกแบบร่าง", "การตั้งค่าหลัก", "เนื้อหาเมนู", "ร้านเป้าหมาย", "เลือกร้านที่พร้อมทั้งหมด", "ไม่มีลิงก์ Google Maps".
  - Concise Simplified Chinese translations: "丰富菜单", "保存草稿", "主要设置", "菜单内容", "目标门店", "选择全部可用门店", "缺少 Google Maps 链接".
  - Preserved internal enum and data contracts unchanged (`GRID_6`, `GRID_4`, `GRID_3`, `CUSTOM`, `URI`, `MESSAGE`, `READY`, `BLOCKED`, and variable placeholders `{{store.*}}`).
- **Verification & Test Results**:
  - 437 / 437 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Fix Vertical Page Scrolling on /rich-menus (2026-08-27)

- **Root Cause**:
  - The route shell `<PageContainer variant="full">` uses `overflow-hidden` for fixed-height chat layouts. Inside this, the root element of `RichMenusView` lacked `flex-1 min-h-0 overflow-y-auto`, causing the tall form content and lower Target Stores section to be cut off without browser/container scrolling.
- **Resolution**:
  - Configured `RichMenusView` root container as `w-full flex-1 min-h-0 overflow-y-auto` (`data-rich-menus-scroll`), allowing natural vertical scrolling for mouse wheels, trackpads, touch gestures, and scrollbars down to the bottom Target Stores section.
  - Made the top Page Header bar `sticky top-0 z-20 bg-white/95 backdrop-blur-xs` so that `[ Save Draft ]` and template state remain persistently accessible while scrolling.
  - Preserved 100% of the fixed single-screen `/chats` internal pane layout without regression.
- **Verification & Test Results**:
  - 437 / 437 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Rich Menu Workspace Redesign to Align with LINE OA Manager (2026-08-27)

- **Visual & Structural Alignment with LINE OA Manager**:
  - Replaced oversized 3-column dashboard layout with LINE OA Manager's 2-column form structure (Preview Left ~36%, Editor Right ~64%) with Target Stores full-width below.
  - Page Header: Clean white/light gray header with title `Rich Menu`, subtitle, and green `[ Save Draft ]` primary action (`#06C755`). Subtle Phase 1 notice badge.
  - Template Selector: Compact top selector dropdown `Template: [ Template Name ▼ ] [ + New ]` eliminating unnecessary permanent sidebar columns.
  - Main Settings: Clean horizontal layout for `Title`, disabled `Display period` ("Not configured in Phase 1"), and collapsible `Advanced settings (Description)`.
  - Preview Panel: Simulated LINE phone container with canvas background, translucent area overlays with LINE-style letter badges (`A`, `B`, `C`, `D`, `E`, `F`), chat bar mockup, and `[ Show template outline ]` toggle.
  - Template Preset Modal: Clean "Select a template" modal with neutral line diagrams for `6-grid`, `4-grid`, `3-grid`, and `Custom`.
  - Image Upload: Compact image row with JPEG/PNG ≤ 1MB validation, preview dimensions, `[ Select image ]`, `[ Replace ]`, and `[ Remove ]`.
  - Actions Section: Collapsed/expanded area rows labeled `A`, `B`, `C`, ... with `URI` / `Message` inputs, live store resolution validation badges, and compact `[ Insert variable ▾ ]` dropdown (`{{store.storeName}}`, `{{store.googleMapsUrl}}`, `{{store.lineUrl}}`, `{{store.tiktokUrl}}`).
  - Target Stores Section: Full-width table below the editor with `Ready`, `Blocked`, `Selected` summary stats, search, `[ All ] [ Ready ] [ Blocked ]` tabs, `[ Select all ready ]`, and disabled checkboxes with clear reason tooltips for blocked stores.
- **Verification & Test Results**:
  - 436 / 436 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Rich Menu Manager (Phase 1: Management + Template + Preview + Readiness) (2026-08-27)

- **Phase 1 Architecture & Non-Destructive Boundary**:
  - Implemented Phase 1 Management, Template, Visual Preview, and Store Readiness Evaluation.
  - Strictly no network calls to LINE Messaging API Rich Menu endpoints in Phase 1 (gated to Phase 2 with disabled adapter and UI state).
  - Data model added via non-destructive Prisma migration `20260827110000_add_rich_menu_templates`: `RichMenuTemplate`, `RichMenuStoreAssignment`, `RichMenuTemplateStatus` (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- **Backend Rich Menu Module (`backend/src/rich-menu/`)**:
  - `RichMenuService`: Full CRUD for templates, canvas coordinate validation, variable extraction, dynamic per-store preview resolution, and store readiness evaluation.
  - Image handling: Supports JPEG/PNG <= 1MB using `MediaStorageService`.
  - Template-specific readiness: Evaluates required variables per template; stores missing `{{store.googleMapsUrl}}` are marked `BLOCKED` only if that template actually uses it. Templates with only `MESSAGE` or static actions mark all eligible stores `READY`.
  - Main OA isolation: Only connected `STORE` LINE OAs are included in evaluation and assignments.
  - Security: Channel access tokens and secrets are never returned in responses.
- **Frontend 3-Pane Workspace (`/rich-menus`)**:
  - Added ADMIN-only `/rich-menus` route and navigation link in `TopNavigation` and `AppSidebar`.
  - Left Pane: Template list with search, status badges, and `[ + New Template ]`.
  - Center Pane: Visual interactive canvas preview (2500x1686 / 2500x843 with area bounding boxes), canvas preset selector (6-Grid, 3-Grid, 4-Grid, Custom), area action editor (`URI` / `MESSAGE`), token insert helper chips (`{{store.storeName}}`, `{{store.googleMapsUrl}}`, `{{store.lineUrl}}`, `{{store.tiktokUrl}}`), image uploader, and `[ Save Draft ]`.
  - Right Pane: Per-store live preview with variable resolver, Store Readiness table with filter tabs (`All`, `Ready`, `Blocked`), search, `[ Select All Ready ]`, assignment saving, and disabled Phase 2 publish button (`"Publishing available in Phase 2"`).
- **Verification & Test Results**:
  - 436 / 436 frontend unit tests passing (`npm test` in `frontend/`).
  - 1,335 / 1,335 backend unit tests passing (`npm test` in `backend/`).
  - Frontend production build succeeded (`npm run build` in `frontend/`).
  - Backend production build succeeded (`npm run build` in `backend/`).
  - `git diff --check` clean.

## Previous task: Store Master Google Maps Readiness Visibility & Filtering (2026-08-27)

- **Store-level Readiness Architecture**:
  - Implemented `getStoreGoogleMapsReadiness(store)` in `frontend/src/lib/template-variable-resolver.ts` and `backend/src/store-master/template-variable-resolver.ts`.
  - Derives readiness status (`CONFIGURED` | `MISSING` | `INVALID`), `ready` (boolean), and reason (`null` | `"Missing Google Maps URL"` | `"Invalid Google Maps URL"`).
  - Serialized `googleMapsStatus` and `googleMapsStatusReason` across `LineOfficialAccountsService`, `StoreMasterService.search()`, and frontend API types (`frontend/src/types/api.ts`).
- **Store Management Filter & Counts**:
  - Added compact Google Maps readiness filter buttons in Store Management toolbar: `Google Maps: [ All (N) ] [ Configured (N) ] [ Missing (N) ] [ Invalid (N) ]`.
  - Derived live counts dynamically from loaded Store data without hardcoding.
  - Multiplicative filter combination with existing search query and connection/route status filters.
- **Table Row Visual Indicators**:
  - Store column: Added compact readiness badge indicator (`✓ Configured` / `⚠ Missing` / `⚠ Invalid`).
  - Action column: Shows `Open Google Maps ↗` (configured link), `⚠ Invalid` (disabled with validation tooltip), or `Not configured` (missing).
  - Preserved all LINE OA connection, webhook, edit, and monitoring action buttons without regression.
- **Sync Summary Interactive Filters**:
  - Made Missing, Invalid, and Configured metric elements in Store Master Sync Summary panel clickable to apply the corresponding filter directly.
  - Calculated configured count safely as `total - missingGoogleMapsUrls - invalidGoogleMapsUrls`.
- **Verification & Test Results**:
  - Extended frontend unit tests in `frontend/test/store-master-google-maps.test.mts` covering helper status derivations, Store ID 29113 post-sync verification, filter computations, and UI element test IDs.
  - Extended backend unit tests in `backend/src/store-master/template-variable-resolver.spec.ts`.
  - All 431 / 431 frontend tests passing (`npm test` in `frontend/`).
  - All 1,329 / 1,329 backend tests passing (`npm test` in `backend/`).
  - TypeScript compilation and Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/` and `backend/`).
  - `git diff --check` passed cleanly.

## Previous task: Store Master Production Sync Control (2026-08-27)

- **Store Management UI Sync Control**:
  - Added dedicated `[ Sync Store Master ]` button in Store Management actions for `ADMIN` users only (`authUser.role === "ADMIN"`).
  - Unauthorized roles (e.g. `VIEWER` or store staff) cannot view or execute the control.
  - On click, disables button and displays `"Syncing Store Master..."` loading state.
  - Sends authenticated `POST /store-master/sync` via `api.syncStoreMaster()`.
  - On completion, refreshes Store Management and Store Master data (`loadApplicationData(true)`), updating `googleMapsUrl` on linked stores.
  - Handles failure cleanly by displaying error message and re-enabling the button.
- **Sync Result Summary Panel**:
  - Displays compact result panel (`data-store-master-sync-summary`) with clear metrics directly from the backend endpoint:
    - `total`: Total rows in sheet (`result.validation.total`)
    - `complete`: Complete rows (`result.validation.complete`)
    - `incomplete`: Incomplete rows (`result.validation.incomplete`)
    - `updated`: Connected OA updated (`result.connectedOaSync.updated`)
    - `unchanged`: Connected OA unchanged (`result.connectedOaSync.unchanged`)
    - `missingStoreId`: Missing store ID count
    - `duplicateAccountNames`: Duplicate account names count
    - `duplicateLineIds`: Duplicate LINE IDs count
    - `missingGoogleMapsUrls`: Missing Google Maps URLs count
    - `invalidGoogleMapsUrls`: Invalid Google Maps URLs count
  - Includes dismiss button to close the summary panel.
- **Google Maps Integration Verification**:
  - Verifies Store ID `29113` / Central Pinklao:
    - Pre-sync / missing URL displays `"Not configured"` (disabled).
    - Post-sync with URL displays `"Open Google Maps ↗"` with exact Store Master URL.
- **Verification & Test Results**:
  - Extended `frontend/test/store-master-google-maps.test.mts` with test suite covering role check, loading state, summary rendering, and Google Maps refresh for Store ID 29113.
  - All 428 / 428 frontend tests passing (`npm test` in `frontend/`).
  - All 1,324 / 1,324 backend tests passing (`npm test` in `backend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Store Master Google Maps Column K Integration (2026-08-26)

- **Database & Prisma Schema**:
  - Added nullable `googleMapsUrl String?` to `model StoreMaster` in `backend/prisma/schema.prisma`.
  - Created migration `20260826180000_add_store_master_google_maps_url/migration.sql` adding `googleMapsUrl TEXT` to `StoreMaster`.
  - Executed `prisma generate` to update Prisma Client typings.
- **CSV Parser & Validation (`backend/src/store-master/store-master.utils.ts`)**:
  - Added `googleMapsUrl` to `ParsedMasterRow`.
  - Implemented `isValidGoogleMapsUrl(value)` supporting `https://maps.app.goo.gl/...`, `https://goo.gl/maps/...`, `https://maps.google.com/...`, `https://maps.google.co.th/...`, and `https://*.google.com/maps/...` with full query parameters preserved.
  - Mapped Column K `"Google Maps links"` and accepted aliases (`"Google Maps Link"`, `"Google Maps URL"`, `"googleMapsUrl"`).
  - Blank and `#REF!` values resolve cleanly to `null`.
- **Import Pipeline & Search Service (`backend/src/store-master/store-master.service.ts`)**:
  - `importCsv`: Persists `googleMapsUrl` on create and update, preserving existing values when updated rows contain empty/REF cells.
  - `validationForRows` and `validate()`: Compute `invalidGoogleMapsUrls` and `missingGoogleMapsUrls` summary counts without failing imports for missing URLs.
  - `search()`: Returns `googleMapsUrl` in Store Master suggestion objects.
  - `LineOfficialAccountsService`: Exposes `googleMapsUrl` on serialized store objects.
- **Reusable Template Variable Resolver**:
  - Created `backend/src/store-master/template-variable-resolver.ts` and `frontend/src/lib/template-variable-resolver.ts`.
  - Supports `{{store.googleMapsUrl}}` and standard store variables.
  - Validates variable readiness: URL exists & valid => `READY`; URL missing or invalid => `BLOCKED` with reason `"Missing Google Maps URL"`.
- **Frontend Types & Store Management UI**:
  - Added `googleMapsUrl` to `StoreMasterSuggestion`, `LineOfficialAccountResponse.store`, and `ApiStore` in `frontend/src/types/api.ts`.
  - Updated `synchronizedStoreMasterData` in `frontend/src/app/store-master-form.ts`.
  - Added "Open Google Maps" ↗ button and "Not configured" state in Store Management table and `store-master-sync-card` in `frontend/src/app/page.tsx`.
  - Added Google Maps button in mobile store details in `frontend/src/app/stores/mobile-stores-app.tsx`.
  - Added multilingual translations across `th`, `en`, and `zh`.
- **Verification & Test Results**:
  - `backend/src/store-master/store-master.utils.spec.ts` (validation & Column K aliases) passing.
  - `backend/src/store-master/template-variable-resolver.spec.ts` (resolution & readiness) passing.
  - `backend/src/store-master/store-master.service.spec.ts` (import, counts, search) passing.
  - `frontend/test/store-master-google-maps.test.mts` and `frontend/test/store-master-form.test.mts` passing.
  - All 1,323 / 1,323 backend tests passing (`npm test` in `backend/`).
  - All 425 / 425 frontend tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: BM Mobile Customer Sales Tags as Source of Truth on Web (2026-08-26)

- **Audit & Source of Truth Architecture**:
  - Web conversation list cards and chat detail header use BM staff entries from the Mobile App (`customerSalesInformation`) as the source of truth.
  - Replaced legacy Web-generated/manual tag presentation (AI topics, AI products, Priority, Follow-Up Status, and AI Customer Stage) with BM sales tags.
  - Verified backend data contract: `customerSalesInformation` (`status`, `interestLevel`, `purchaseChannel`, `paymentMethod`, `products`) is returned by `ConversationsService.list()` via `safe()` and `findById()`.
- **Presentation Helper (`frontend/src/app/conversation-list-presentation.ts`)**:
  - `getBmCustomerSalesTags`: Converts `ApiCustomerSalesInformation` into ordered tags with strict priority:
    1. Sales Status: `INTERESTED` (blue) / `PURCHASED` (emerald)
    2. Interest Level: `HOT` (rose/red) / `WARM` (amber) / `COLD` (slate)
    3. Product model: Extracted from `sales.products`
    4. Product variant: Formatted RAM / ROM / color string
    5. Purchase channel: `STORE` / `ONLINE`
    6. Payment method: `CASH`, `INSTALLMENT`, `CREDIT CARD`, `OTHER`
  - Empty state: When BM has not entered information, returns `[]` with zero fake/AI replacement tags.
- **Web UI Presentation (`frontend/src/app/page.tsx`)**:
  - Conversation list card tag area renders `data-conversation-bm-tag` chips and retains `data-conversation-bm-reply-status` with `+N` overflow chip.
  - Chat detail header renders `data-chat-detail-bm-tag` chips, Customer Name, Store Name, BM Reply Status dropdown (`data-bm-reply-status-select`), and Relative Time.
  - Removed AI Customer Stage, Follow-Up Status, and Priority from the visible tag area.
  - Retained underlying fields in backend and frontend state for filters, search, and analytics.
- **Verification & Test Results**:
  - Expanded `frontend/test/conversation-list-presentation.test.mts` with dedicated 17-point specification test suite.
  - All 421 / 421 frontend unit tests passing (`npm test` in `frontend/`).
  - All 1,311 / 1,311 backend unit tests passing (`npm test` in `backend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Dominant Chat Timeline & Collapsible Details Drawer in /chats (2026-08-26)

- **Dominant Message Timeline Area**:
  - Refactored `/chats` detail pane so the message conversation stream is the primary flexible region, consuming all available vertical height via `flex-1 min-h-0 overflow-y-auto`.
  - Removed artificial fixed height clamps (`h-[clamp(...)]` and media query caps).
  - Pinned customer identity header at the top (`shrink-0`), chat subheader/toolbar (`shrink-0`), message timeline (`flex-1 min-h-0`), reply composer at bottom (`shrink-0`), and manager notice (`shrink-0`).
- **Collapsible Details Drawer**:
  - Replaced permanently rendered lower operational cards with a collapsible slide-in Details drawer (`data-chat-details-drawer`).
  - Added subtle `Details` (`data-chat-details-toggle`) action in the customer header with active toggle states and multilingual labels (`Details` / `รายละเอียด` / `详情`).
  - Default state is closed, giving the message area 100% of the detail pane width and vertical height.
  - When opened, renders a 320–352px (`w-80 lg:w-[22rem]`) side panel on desktop (and overlay under 900px) containing AI Insight, Internal Note (with inline editing), and Activity History with independent internal scrolling (`min-h-0 flex-1 overflow-y-auto`).
- **Verification & Test Results**:
  - Updated `frontend/test/chat-detail-hierarchy.test.mts` and `frontend/test/shell-navigation.test.mts`.
  - All 404 / 404 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Fixed Single-Screen /chats Workspace Layout (2026-08-26)

- **Single-Screen Viewport Architecture**:
  - Locked browser viewport to `100dvh` without document-level vertical scrolling.
  - `AppShell`: Configured root container with `h-dvh min-h-dvh max-h-dvh overflow-hidden flex flex-col`.
  - `PageContainer variant="full"`: Configured with `w-full h-full min-h-0 flex-1 flex flex-col min-w-0 overflow-hidden`.
  - `chat-resizable-grid`: Configured with `height: 100%; max-height: 100%; overflow: hidden`.
- **Internal Pane Scrolling**:
  - **Left context/store sidebar**: Fixed pane header and search controls, with stores list scrolling internally via `flex-1 min-h-0 overflow-y-auto`.
  - **Middle conversation list**: Fixed header and filter area (`shrink-0`), conversation rows scrolling internally via `flex-1 min-h-0 overflow-y-auto`, pagination footer fixed at the bottom (`shrink-0`).
  - **Right conversation detail**: Customer header fixed (`shrink-0`), message area scrolling internally with viewport-proportional clamp `h-[clamp(200px,36vh,440px)] min-h-0 overflow-y-auto`, reply composer fixed (`shrink-0`), manager notice fixed (`shrink-0`), lower detail sections (AI Insight, Internal Note, Activity) scrolling internally via `min-h-0 flex-1 overflow-y-auto`.
- **Verification & Test Results**:
  - Added dedicated tests in `frontend/test/shell-navigation.test.mts` verifying viewport bounds, container hierarchy, and internal scrolling behaviors.
  - All 402 / 402 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: /chats Workspace Layout & UX Optimization (2026-08-26)

- **Pane Widths & Proportions**:
  - Context Sidebar: Updated default to 280px (min: 220px, max: 420px).
  - Conversation List: Updated default to 380px (min: 320px, max: 600px).
  - Detail Pane: Minimum width 480px, expanding to fill available space.
  - Breakpoint adjustments: `@media (max-width: 1120px)` updated to `15rem 22rem minmax(0, 1fr)`.
- **Empty Detail State**:
  - Added centered empty state (`data-chat-detail-empty-state`) with subtle chat icon, multilingual title ("Select a conversation" / "เลือกการสนทนา" / "选择对话"), and description ("Choose a conversation from the list to view messages and customer details.").
- **Conversation List Rows**:
  - Refined layout hierarchy: 1. Customer name + 3-dot action, 2. Message preview, 3. Store name · Relative time, 4. BM Reply Status + BM sales tags.
  - Enhanced horizontal room for store names and customer names with clean truncation and comfortable line height.
- **Sidebar & Store Rows**:
  - Increased store name width before truncation, refined badge sizing/spacing, and softened waiting time indicator.
- **Pagination Footer**:
  - Responsive single-row flex layout fitting 360–420px widths cleanly without crushed controls.
- **Verification & Test Results**:
  - Updated `frontend/test/resizable-panes.test.mts`, `frontend/test/shell-navigation.test.mts`, `frontend/test/chat-detail-hierarchy.test.mts`, and `frontend/test/conversation-list-presentation.test.mts`.
  - All 401 / 401 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: Removal of Customer Sales / Purchase Information Card from Web Chat Detail (2026-08-26)

- **UI Streamlining**:
  - Removed `<section data-purchase-information-card ...>` from the Web chat detail lower pane, including Customer Sales Information / Customer Purchase heading, interested/purchased indicators, product/purchase details, legacy purchase notices, Edit Purchase Information button, and recorded-by/recorded-at info.
  - Removed now-unused Web `editPurchaseInformation` function.
  - Retained `customerSalesInformation` and `purchaseInformation` data structures, backend APIs, database models, and Mobile App functionality.
  - AI Insight (`data-product-intent-card`), Internal Note (`data-topics-note-card`), and Activity History (`data-activity-history`) remain fully intact in the detail pane.
- **Verification & Test Results**:
  - Updated `frontend/test/chat-detail-hierarchy.test.mts` to verify `data-purchase-information-card` and `editPurchaseInformation` are removed and remaining lower sections retain ordering.
  - All 400 / 400 frontend unit tests passing (`npm test` in `frontend/`).
  - Next.js Turbopack production build succeeded cleanly (`npm run build` in `frontend/`).
  - `git diff --check` clean.

## Previous task: BM Mobile Customer Sales Tags Presentation on Web (2026-08-26)

- **Audit & Architecture**:
  - Replaced legacy Web-generated/manual tag presentation (AI topics, AI products, Priority, Follow-Up Status, and AI Customer Stage) with BM-entered customer sales data from the Mobile App (`customerSalesInformation`).
  - Verified backend data contract: `customerSalesInformation` (`status`, `interestLevel`, `purchaseChannel`, `paymentMethod`, `products`) is already built and returned by `ConversationsService.list()` via `safe()`.
  - Reused existing data structures without creating duplicate tag systems.
- **Presentation Helper Implementation (`frontend/src/app/conversation-list-presentation.ts`)**:
  - `formatVariantLabel`: Formats RAM, ROM, color (`16GB / 512GB · Graphite`, `12GB / 256GB`, `Titanium Silver`).
  - `getBmCustomerSalesTags`: Extracts ordered tags following display priority:
    1. Sales Status: `INTERESTED` (blue) or `PURCHASED` (emerald)
    2. Interest Level: `HOT` (rose/red), `WARM` (amber), `COLD` (slate)
    3. Product model: Extracted from `sales.products`
    4. Product variant: Formatted variant string when present
    5. Purchase channel: `STORE` / `ONLINE`
    6. Payment method: `CASH`, `INSTALLMENT`, `CREDIT CARD`, `OTHER`
  - `getConversationListTags`: Supports max visible items (default 3) and returns hidden tags count for `+N` overflow chip.
  - `getBmTagChipClass`: Returns semantic theme-aware Tailwind classes for light/dark mode.
  - When BM sales data is missing/empty, returns empty array with zero fake/AI fallback tags.
- **Web UI Updates (`frontend/src/app/page.tsx`)**:
  - Updated `Conversation` type and `mapApiConversation` to include `customerSalesInformation`.
  - Updated conversation list card tag area to render BM customer sales tags with `data-conversation-bm-tag`, retaining `data-conversation-bm-reply-status`.
  - Updated chat detail header to render BM customer sales tags with `data-chat-detail-bm-tag`, retaining Customer Name, Store Name, BM Reply Status dropdown (`data-bm-reply-status-select`), and Relative Time.
  - Updated `editPurchaseInformation` to sync updated `customerSalesInformation` into the conversation list state without page reload.
  - Preserved underlying fields (Priority, FollowUpStatus, topics, customerStage) in the backend and state for search, filter panel, and analytics.
- **Verification & Test Results**:
  - Expanded `frontend/test/conversation-list-presentation.test.mts` with tests covering all 17 specification criteria.
  - All 400 / 400 frontend unit tests passing (`npm test` in `frontend/`).
  - All 1,311 / 1,311 backend unit tests passing (`npm test` in `backend/`).
  - Next.js Turbopack production build succeeded cleanly across all routes with TypeScript validation (`npm run build` in `frontend/`).
  - `git diff --check` clean with zero whitespace/formatting issues.

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
- Local Flutter analyze and full tests pass. Signed workflow run `32922506775` passed; independent verification confirms package `click.lineoppo.chat`, version `1.0.15+16`, production API URL, and the permanent certificate fingerprint. The verified APK is 58,040,494 bytes with SHA-256 `f09d53b2e25bf9467f0994e9934c4b1da666ae4637075bfad09f52d9e2f29ead`; download metadata now records the 26 August 2026 release while preserving prior history.
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
# Current task: Android 1.0.16+17 production release (2026-08-26)

- Created `release/android-1.0.16` from clean `main` at `b2acbef71aca274e5c697a2c89aa0621463a3073` after fetching and fast-forwarding from `origin/main`.
- Bumped the Flutter and Android release workflow targets from `1.0.15+16` to `1.0.16+17`. This release distributes PR #52's mobile conversation-card change: Normal/Urgent priority badges are hidden while backend priority logic and reply-status badges remain intact.
- Flutter dependency resolution and localization generation pass; `flutter analyze` reports no issues and the full Flutter suite passes 114/114, including priority ordering, hidden priority-card badges, and reply-status coverage.
- Permanent-signing workflow run `32937099373` passed for commit `1ac9539458834d235d50e8cc46f7959a7d012ae4`. Independent verification confirms package `click.lineoppo.chat`, version `1.0.16+17`, production API URL, and certificate SHA-256 `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`.
- Published the exact verified 58,040,466-byte APK as `frontend/public/downloads/oppo-line-oa-chat-v1.0.16-production.apk`; SHA-256 is `5837e94111f7a7fb4398bdefff75e4639610ec9b4bea88a8004ffc906967924e`. Download metadata records the actual 26 August 2026 release date and preserves all previous releases.
- Frontend verification passes: full tests 393/393, zero-warning ESLint on the changed release metadata, and the production Next.js build with TypeScript and 26 routes. Repository-wide ESLint remains red on the unchanged `b2acbef` baseline (27 errors, 73 warnings across unrelated files); no lint failure points to this release's changed file.
- Runtime verification of the built frontend passes: `/api/health`, `/download`, `/download/history`, and the new APK route all return 200. The HTTP-downloaded APK is exactly 58,040,466 bytes and retains SHA-256 `5837e94111f7a7fb4398bdefff75e4639610ec9b4bea88a8004ffc906967924e`; the latest page renders 1.0.16 and Version History retains 1.0.15.
- Next action: review/commit the verified artifact and metadata, push, open the PR, and monitor CI without merging or deploying.

# Current task: Android push notification reliability (2026-08-26)

- Started `feat/android-push-notification-reliability` from `origin/main` at `88b474396d2e55364261f12bd2a643cdd971fd56`; no APK/release metadata changes are in scope.
- Audit confirmed LINE webhook persistence and the notification outbox/worker/FCM acceptance path work for store members, but the provider sent data-only FCM payloads. Android background/terminated delivery therefore depended on a Dart isolate/local notification path that is not guaranteed. Android 13 permission state was also not inspected, so denied notifications could appear as a silent delivery loss.
- Audit also found device-token registration and enqueue targeting required an active store membership. All-store/HQ accounts without memberships could neither register a token nor receive store-scoped notifications, despite having mobile/all-store permission.
- Implemented mixed FCM notification+data payloads with high-importance channel/sound metadata; foreground remains a local notification path, while background/terminated system-rendered messages are not duplicated. Added safe backend delivery/enqueue logs and permanent invalid-token cleanup reporting.
- Aligned device registration and recipient targeting with mobile workspace/all-store/store-membership permissions, preserving store and Main OA isolation. Android now handles token refresh with a single-flight drain, unregisters/deletes the current token on explicit logout, exposes actual Android/Firebase notification permission state, and routes denied users to app notification settings. Added notification channel sound/vibration configuration and tap/deduplication helpers.
- Flutter analyze passes; the full Flutter suite passes 144/144, focused notification regressions pass 20/20, Android `assembleDebug` passes, and the merged manifest contains the Firebase messaging service plus the high-importance channel metadata. Backend notification tests and the full backend suite pass 1,324/1,324, Prisma validate/generate and backend build pass, and changed notification sources/tests pass ESLint.
- CI can validate payload shape, lifecycle logic, native compilation, and permission-settings wiring. A physical Android verification matrix is still required to prove OEM/permission/foreground/background/terminated delivery and notification-tap behavior; no device was available in this environment.

# Current task: Android inbound LINE video messages (2026-08-26)

- Created `feat/android-inbound-video-messages` from latest `origin/main` at `e107388d8df2c4a330ea84d61d2412a734c6b672`.
- Audited the end-to-end path. LINE webhook parsing and the `VIDEO` enum already existed, but ingestion only created/downloaded media for images; Android only accepted `image/*` bytes and rendered image bubbles, so video messages had no stored media and no client renderer.
- Extended the existing authenticated media processor and `GET /messages/:messageId/media` proxy for video MIME types, metadata, pending/ready realtime updates, and a 200 MB video limit. No schema migration was required.
- Added lazy, non-autoplay Android video playback with loading, controls, and localized fallback states; preserved text/image rendering and realtime ID-based patching. Added TH/EN/ZH labels and regression coverage.
- Focused Flutter tests pass 31/31, Flutter analyze passes, focused backend tests pass 37/37, and the backend build passes. Next action: run full Flutter/backend verification, review the diff, commit, push, open the PR, and wait for CI; do not merge or release an APK.

# Current task: Android mobile session reliability (2026-08-26)

- Created `fix/mobile-auth-session-reliability` from `origin/main` at merge commit `bee0760979a84739a707b97d3afb2956ca737264` and audited password/OTP login, session validation/revocation, Android secure storage, API errors, restoration, logout, forced password change, device registration, and realtime reconnect behavior.
- Root causes were the fixed 12-hour single-token MOBILE session with no refresh path, immediate credential deletion on every authenticated 401, and startup restoration deleting credentials for every `/auth/me` exception including network, 5xx, and 403 failures.
- Kept the 12-hour access lifetime and added a bounded 30-day MOBILE refresh lifetime with one-time rotation, atomic compare-and-swap server updates, and existing Session-row revocation semantics. Web cookie sessions are unchanged.
- Android now atomically stores the credential pair in one secure-storage JSON value, uses single-flight refresh, retries the original request once, never logs out on network/5xx/403 failures, and presents a retry state when restoration is temporarily unavailable. Structured logs contain outcomes/codes only and never credentials.
- Flutter analyze and all 127 Flutter tests pass. Backend Prisma generation/build and all 1,311 backend tests pass; changed production auth sources lint clean. The migration applied successfully to local PostgreSQL, backend startup had zero compile errors, health returned 200, invalid refresh returned the expected `SESSION_EXPIRED` 401, and empty explicit logout returned success. Repository-wide backend lint retains 318 pre-existing unrelated errors. No APK, merge, or deployment is authorized.

# Current task: Android 1.0.17+18 production release (2026-08-26)

- Created `release/android-1.0.17` from clean `origin/main` at `b37ba3ecb524eb9144b4d40692e00a9e631d65c3` in an isolated worktree because the shared prior branch contained unrelated uncommitted frontend edits, which remain untouched.
- Bumped Android to `1.0.17+18` and updated the existing signed/unsigned workflow targets. Release scope combines inbound LINE video playback and mobile rotating-refresh/session reliability.
- Permanent-key workflow `32947514859` passed from preparation commit `31da212d1d4737d9143f73cfd670b405052139a9`. Independent verification confirms package `click.lineoppo.chat`, version `1.0.17+18`, and certificate SHA-256 `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`.
- The exact 59,226,650-byte signed artifact is published as `oppo-line-oa-chat-v1.0.17-production.apk`; SHA-256 is `4262aa1ab207f259aa33285c4f2b311e4b7d29d4bbfbb437a51aa4627456c629`.
- `/download` and `/download/history` metadata preserves prior releases and is locked by regression test to the backend `AppRelease` migration used by `/app/version/android`. Numeric build comparison tests cover old/current installs and recoverable network failure without credential loss.
- Flutter analyze and all 128 Flutter tests pass. Backend full tests pass 1,311/1,311; Prisma validate/generate and backend build pass. Frontend tests pass 394/394, changed-file lint passes, and production build passes. Local migrations deploy cleanly; production currently reports all 69 main migrations (including mobile refresh sessions) applied and up to date. Final runtime rerun, release commit, PR, and green CI monitoring remain.

# Current task: Android 1.0.18+19 production release (2026-08-26)

- Created `release/android-1.0.18` from clean `origin/main` at `44c8d63361691186b42ee37d79f94c5747733ea8`, containing the reliable APK updater and push notification fixes.
- Bumped Android to `1.0.18+19` and updated the permanent-signing workflow gates. Signed workflow run `32961583276` passed package/version and permanent certificate verification; the signed artifact is being independently checked before publication.
- Added the new APK, checksum-dependent frontend release entry, and additive AppRelease migration with the updater and push-notification changelog. Full Flutter/backend/frontend and Prisma gates remain required before the PR is opened.

# Current task: Android notification content (2026-08-27)

- Started `feat/android-notification-content` from latest `origin/main` `ff3b269f1672eb7607c28613ea0b9e1e1de673db`. Existing unrelated frontend edits remain uncommitted and untouched.
- Audit found the webhook passed only `messagePlaceholder` to the notification outbox, omitted the store name, and the FCM provider hard-coded a generic title/body. Android foreground rebuilt a separate title/body, so foreground and background notifications could not share useful content.
- Added a single backend notification-content formatter for customer/store title, normalized text, 160-character truncation, and image/video/sticker/file/audio/location/unsupported fallbacks. Persisted title/body in new outbox payloads and sent identical values in FCM `data` and `notification` fields. Android consumes those fields in foreground/local and retains localized fallback handling for older payloads.
- Added TH/EN/ZH notification fallback labels and backend/Flutter regression coverage. Flutter analyze, affected Flutter tests, full backend tests (1328/1328), backend build, and changed-file ESLint pass. Android `./gradlew assembleDebug` and package verification pass; the Flutter wrapper is locally configured to JDK 25 and fails before Gradle plugin resolution, while direct Gradle with the repository JDK 17 succeeds.
- Next action: run final full Flutter suite, review/commit only notification-content changes, push, open the PR, and wait for green CI without merging.

# Current task: Reliable Android APK updater (2026-08-26)

- Created `feat/android-reliable-apk-updater-fix` from the latest clean `main` at `e919290`. Replaced the silent `canLaunchUrl`-only path with an app-scoped APK download, streamed SHA-256 verification against `/app/version/android` metadata, visible progress/error states, single-flight duplicate protection, stale/failed temporary-file cleanup, download tracking after verified download, and a retryable installer-permission state.
- Added the native Android FileProvider/content-URI bridge and `REQUEST_INSTALL_PACKAGES` handling. Android opens the per-app unknown-sources settings when needed, then retries the verified APK without downloading it again. No broad storage permission or raw file URI is used.
- Profile About now loads the installed `PackageInfo` version/build instead of hardcoded `1.0.6+7`. TH/EN/ZH updater states are generated from ARB resources.
- Focused updater/Profile tests pass 20/20 (including start/progress, checksum success/mismatch, network failure, installer launch/permission retry, duplicate taps, stale-file cleanup, and installed version rendering). Flutter analyzer passes. Full Flutter tests pass 140/140. Android `assembleDebug` passes with the native bridge and manifest.
- The installed 1.0.16+17 binary cannot be made reliable solely through release metadata: its manifest has no package-visibility query and it only calls `canLaunchUrl`, so changing the APK URL cannot guarantee a launch. No production metadata was changed; this branch fixes new binaries through direct download/install.

# Current task: Android manual update checks (2026-08-27)

- Created `feat/android-manual-update-check` from clean latest `origin/main` at `6ca01aa99ccd1ece324976bc28f38c0114ece41b`. No Android version/build or APK release files are in scope.
- Removed automatic update-check calls from app startup restoration and lifecycle resume. The update service now fails closed for non-manual callers, while the Profile About row remains the explicit manual entry point.
- Preserved the active install lifecycle: verified APKs remain available when Android requests unknown-source permission, and returning to the app retries installation without re-downloading. Session restoration/refresh behavior is unchanged.
- Added regression coverage for startup/login/resume non-prompt behavior, automatic-call suppression, and manual Profile detection. Flutter analyzer, full Flutter tests (154/154), and Android `assembleDebug` pass.
- Next action: review, commit, push, open the PR, and monitor CI without merging.

# Current task: Android startup loading hotfix (2026-08-27)

- Started `fix/android-startup-loading` from the clean latest `main` commit `7a7da3e1a2334a0db96e257ed96a478bae0d79d4`. No Android version/build, APK, release metadata, or backend schema changes are in scope.
- Audit found the pre-render `main()` awaited Firebase initialization without a timeout, while startup restoration could wait indefinitely on secure storage or `/auth/me`; exceptions before the final state update could strand the loading spinner. Realtime, notification initialization, and update prompting were also not explicitly separated from the navigation decision.
- `runApp` now occurs synchronously after registering the FCM background entry point. Secure-storage and authenticated-user restoration use bounded, classified stages with safe timing/outcome diagnostics and a retryable state that preserves credentials for network, timeout, 5xx, 403, or temporary refresh failures. Only an explicitly rejected/expired refresh remains terminal.
- Notifications/Firebase and realtime start after navigation and are never awaited by the startup state machine. The manual-only updater behavior from PR #63 remains intact, including the active unknown-source install-resume path.
- Flutter analyze passes; the full Flutter suite passes 167/167; Android `assembleDebug` passes; backend full tests pass 1,349/1,349; Prisma generation and backend build pass. No production APK was built or released.
- Next action: review and commit only the scoped startup/auth changes, push the feature branch, open a PR, and monitor CI without merging. A physical Android APK test is still required before calling the real-device startup issue fully verified.

# Current task: Android 1.1.2+22 hotfix release (2026-08-27)

- Created clean release worktree/branch `release/android-1.1.2` from latest `origin/main` at `c7c83ab907c8a9ff95d8b612bf35cf1888f42cea`, preserving unrelated edits in the shared checkout.
- Release scope is limited to the merged manual-only update prompt behavior (PR #63), bounded startup restoration/provider work (PR #64), and the existing updater/install improvements. Android version/workflow gates are prepared for `1.1.2+22`; no product feature changes are included.
- Permanent-key workflow `33048872351` passed. The signed APK is 59,605,662 bytes with SHA-256 `151b0b074d3b6beb8171d62385c485e5fb4a0481c2cd9a530041e8937e441c50`; independent verification confirms package `click.lineoppo.chat`, version `1.1.2+22`, and the required permanent certificate. Flutter-driven debug metadata also reports versionCode 22/versionName 1.1.2.
- Flutter analyze and full tests pass (167/167); backend tests pass (1349/1349), Prisma validate/generate/migrate deploy pass locally (including the additive release migration), backend build passes, and frontend tests/build pass (441/441). The isolated production frontend serves `/download`, `/download/history`, and the exact APK bytes/checksum successfully.
- Release-only metadata, migration, APK, and fixture updates remain to be committed and pushed; then open the PR and monitor required CI without merging. Physical-device updater/startup verification remains explicitly required before declaring those real-device issues fully verified.

# Current task: Remove operational reply cards from Android Summary (2026-08-27)

- Started `feat/android-summary-remove-operational-cards` from latest `origin/main` `9ccfdd29b7041a03249eeed2cc8982eaafb1b71b`, which includes the merged monthly response-cycle backend fix.
- Removed `รอตอบ`/`ตอบแล้ว` from the Summary monthly activity grid and kept only equal-width incoming-message and customer-conversation cards. The backend response-cycle calculation and `operational` compatibility fields remain unchanged for response-performance analytics; Inbox still uses live `bmReplyStatus`.
- Summary tests now assert only the two volume cards render and response-rate/median/average/bucket metrics still render. Focused Summary tests pass, Flutter analyze/full tests pass (167/167), and Android `assembleDebug` passes. Existing Inbox status regressions remain covered by the full suite.
- Next action: review/commit, push, open PR, and monitor CI without merging.

# Current task: Staff sender attribution (2026-08-27)

- Started `feat/sender-attribution` from latest `origin/main` `f138ccf92ed0751f54657e0e02e889ef83932143`; no Android version bump or release files are in scope.
- Audited the persisted Message sender flow. Outbound text/image sends already persist the authenticated operator's `senderUserId` and display-name snapshot; conversation APIs did not join the canonical User relation, Web ignored the field, and outbound realtime events were not emitted.
- Added a safe sender projection that prefers the canonical User display name, falls back to the persisted snapshot, and never infers a sender for inbound/system/unattributed rows. Conversation detail/list, mobile detail, Web, Android, and realtime contracts now carry/render the same attribution without exposing User fields.
- Added outbound realtime publication after successful persistence for text/image sends. Android's existing ID-deduplicated realtime merge preserves sender data; Web desktop/mobile views now subscribe to the same filtered SSE stream with polling fallback. Main OA store isolation remains enforced by the realtime controller and existing access checks.
- Backend build and full tests pass (1399/1399), changed backend lint passes; Flutter analyze/full tests pass (170/170), Android `assembleDebug` passes; frontend tests/build pass (451/451 and production Next build). Repository-wide backend/frontend lint still contains unrelated baseline violations; changed files are clean.
- Next action: review the scoped diff, commit, push the feature branch, open the PR, and monitor CI without merging.

# Current task: Monthly summary reply-cycle scoping (2026-08-27)

- Started `feat/android-monthly-summary-reply-cycles` from latest `origin/main` `15e9451c52f94de091259fd49a9a44f5c04e3c88`.
- Audited `GET /mobile/summary/monthly`: response-performance already uses `calculateResponseCycles` + `responseMetrics`, while the reply cards incorrectly used an all-accessible-conversation `bmReplyStatus` snapshot. Removed that snapshot read and derive legacy `operational.needReply`/`completed` from the selected month's response cycles.
- Added backend regressions for different July/August cycle counts, historical stability when current status changes, and the invariant `needReply + completed = response.cyclesStarted`. Existing tests continue to cover null-sender outbound exclusion, accessible-store/QA scoping, Bangkok month boundaries, and multiple cycles.
- Targeted/full backend tests pass (1388/1388), changed-file ESLint and backend build pass, Flutter analyze/full tests pass (167/167), Android `assembleDebug` passes, and Prisma schema validation passes. Next action: review/commit, push, open PR, and monitor CI without merging.

# Current task: Online customer sales status (2026-08-28)

- Started `feat/customer-status-online` from clean latest `origin/main` at `67d22d7a362e5b0d901c2f0a3a17f19149a52702`.
- Audited the canonical `Conversation.customerSalesStatus` Prisma enum and existing Android PATCH/Web conversation contracts. Added the additive `ONLINE` enum value and migration; no frontend-only state or automatic classification was introduced.
- Android now offers balanced `Online | Interested | Purchased` segments with localized labels and persists the selection through the existing save flow. Online clears purchase-only fields while retaining associated inquiry products; existing unset/Interested/Purchased values remain compatible.
- Web conversation status tags and purchase-audience filters expose Online as a distinct category. Store/HQ/PC authorization, Main OA isolation, inbox reply status, and existing historical values remain unchanged.
- Prisma validate/generate, backend build and full tests, Flutter analyze/full tests, Android assembleDebug, frontend tests/build, and scoped lint checks pass. Frontend lint still reports two pre-existing hook errors and three warnings in the existing mobile/desktop analytics files; no new errors were introduced.
- Next action: review the scoped diff, commit, push the feature branch, open the PR, and monitor CI without merging.

# Current task: Robinson Chonburi auto-reply pilot (2026-08-28)

- Started `feat/robinson-auto-reply-pilot` from clean latest `origin/main` `b6aadbe`, following the approved read-only analysis of store `28375` historical inbound text.
- Added additive Prisma support for scoped inbound-text rules, explicit `OFF`/`SHADOW`/`LIVE` pilot modes, deterministic intent/outcome audit records, and a unique source-message claim for webhook deduplication. No rules are seeded or enabled; the default mode remains `OFF`.
- Added strict dual store identity and STORE OA gates, reviewed high-confidence Thai aliases/exclusions for `STORE_LOCATION` and `FINANCE_INFO`, text-only template sending through the canonical LINE reply service, and a read-only pilot summary endpoint/UI with localized scope/mode warnings. POSTBACK execution, BM reply status, authorization, and Main OA isolation remain unchanged.
- Focused backend and frontend tests/builds have been run during implementation; final full suites, diff review, commit, push, PR creation, and green-CI monitoring remain.

# Current task: Mobile inbox and chat UX improvements (2026-08-29)

- Continued the existing `feat/mobile-chat-ux-improvements` branch without touching the Auto Reply/auto-response pilot files or configuration.
- Extended the bounded mobile conversation list contract with customer picture URLs and compact persisted sales summaries, then added Android card chips/product counts, realtime/reload reconciliation, profile avatars, compact product selection, right-aligned empty sales action, linkified browser links, and a native MediaStore image-save bridge for inbound and outbound images.
- Flutter analyze and full Flutter tests pass; backend full tests (1437/1437) and build pass; Android direct `assembleDebug --no-daemon` passes after the Flutter wrapper hit a local plugin-cache resolution issue on its first invocation. Final requested version metadata is `1.1.4+24` and the production workflow verifies that version/output name.
- No Web behavior, schema migration, Main OA behavior, auth/session semantics, or Auto Reply behavior was changed. Next action: review the scoped diff, commit, push, open the single PR, and monitor CI without merging.

# Current task: LINE sticker presentation (2026-08-29)

- Started `feat/line-sticker-presentation` from clean latest `origin/main` `e631e10`. Audited LINE webhook ingestion, `Message.rawPayload`, realtime, Web chat surfaces, and Android conversation/timeline models before editing.
- The webhook type previously discarded LINE sticker `packageId`, `stickerId`, `stickerResourceType`, optional `keywords`, and optional message-sticker `text`; persistence retained only `{ type: "sticker" }` plus the generic placeholder. New inbound stickers retain that official subset in the existing JSON field, while APIs expose only normalized `text`/`keywords` needed for display.
- Android and Web now render a dedicated green LINE sticker placeholder with a localized LINE label and the first useful explicit text/keyword when present. Historical rows without metadata render the label only; conversation previews and realtime events use the same contract.
- No migration, sticker CDN, inferred sticker meaning, Auto Reply change, outbound LINE sending change, or image/video/file behavior change was introduced. Flutter code is prepared for the next build `1.1.6+26` only after the full Flutter suite passed.
- Final verification passes: backend full tests (1442/1442), build, signed-webhook route checks, and a persisted synthetic sticker round trip; Flutter analyze and full tests (191/191); Android `assembleDebug`; frontend full tests (466/466), production build, and local frontend/backend health routes. `git diff --check` is clean and no Auto Reply, outbound LINE sending, or migration files changed. Next action: commit, push, open the PR, and wait for green CI without merging.

# Current task: Conversation owner and Team Operations Summary (2026-08-29)

- Started `feat/conversation-owner-team-summary` from latest `origin/main` `62e5357` after confirming the worktree was clean. The implementation adds an additive nullable `Conversation.ownerUserId` relation with active-membership-safe serialization and migration `20260830090000_add_conversation_owner`.
- Successful human text/image sends assign an owner only when the conversation is unowned; later staff replies preserve the owner. Manual mobile reassignment is store-authorized, active-human-only, and supports clearing. Inbox/chat APIs and realtime events carry only `{id, displayName}` and omit stale/deactivated/non-member owners.
- Mobile Inbox cards and chat headers show owner state with a localized selector. Web conversation contracts and realtime handling expose/render the same persisted owner without changing authorization or Main OA isolation.
- Monthly summary now includes a canonical-status monthly overview, human-vs-bot team handling metrics (distinct conversations, outbound count, workload share), and a clearly labeled current ownership snapshot before existing response/sales sections. Response-cycle analytics remain unchanged and are not used as fake per-user performance rankings.
- Prisma validate/generate, local-only `prisma migrate deploy`/status, backend build/full tests (1446 passing), targeted-file lint, Flutter analyze/full tests (195 passing), Android `flutter build apk --debug`, frontend full tests (466 passing)/production build, and targeted frontend lint all pass. Repository-wide backend/frontend lint still contains unrelated baseline violations; no changed-file lint errors were introduced. Version metadata advances from the released `1.1.6+26` to `1.1.7+27`; no production APK or release metadata is published here.
- The owner serializer also recognizes active ADMIN/all-store users as authorized owners when they have no per-store membership, while stale/deactivated/non-member owners remain hidden. Next action: review and commit the scoped diff, push the feature branch, open one PR, and monitor CI without merging.

# Current task: Single-store mobile context density (2026-08-30)

- Started `fix/mobile-single-store-context-density` from latest `origin/main` `1be3f4c` (released Android `1.1.7+27`).
- Reused the authenticated user's canonical active `stores` set plus HQ/all-store permissions. Exactly one store for a non-HQ, non-global account hides only redundant store presentation; unresolved, zero-store, HQ, ADMIN, and multi-store contexts continue showing store context.
- Inbox cards and chat headers retain customer, avatar, reply status, owner, sales tags, actions, and navigation while omitting only the store badge/name/code for single-store users. Backend APIs, authorization, selected-store behavior, and store data are unchanged.
- Added authorization, card, and header regression coverage. Flutter analyze passed; focused tests passed; full Flutter tests passed (199/199); direct Gradle `assembleDebug` passed. The Flutter build wrapper still reports the repository-local plugin-cache `25.0.2` resolution issue, while direct Gradle and CI package checks remain available.
- Prepared Android metadata for `1.1.8+28` in `pubspec.yaml` and the production workflow only; no signed APK or release metadata was published. Next action: review, commit, push, open one PR, and monitor CI without merging.

# Current task: Compact mobile Inbox filters and owner-tracking cutoff (2026-08-30)

- Started `feat/mobile-inbox-compact-owner-cutoff` from latest `origin/main` `9379b2b` (released Android `1.1.8+28`). The scoped change reduces Android Inbox filters to All / Need Reply / Completed, grouping `NOT_REPLIED` and `NOTIFIED_BM` only in the Need Reply view while preserving backend enums and operational status behavior elsewhere.
- Added the Bangkok ownership tracking boundary at `2026-08-30 00:00` (`2026-08-29T17:00:00.000Z`). Owner assignment, mobile contracts, realtime patches, and ownership analytics use tracked conversations only; legacy unowned conversations are excluded from owner warnings/denominators without backfilling or changing manual reassignment.
- Compact store cards keep customer/avatar, owner, sales tags, one-line preview, timestamp, status, chevron, and single-store context behavior. Backend fields remain additive and no Prisma migration, Android version bump, release metadata, or APK publication is planned for this feature branch.
- Regression coverage has been updated for grouped filters, historical ownership cutoff/analytics, owner assignment protection, realtime propagation, and legacy display behavior. Full backend/Flutter/Android checks remain to be run before commit, push, PR, and green-CI monitoring.

# Current task: Categorized mobile product picker (2026-08-30)

- Started `feat/mobile-product-category-picker` from clean latest `origin/main` `62ae6f6`, which includes Android 1.1.9+29 and prior customer-sales behavior.
- Audited the existing `/mobile/products` contract (active model-level catalog, bounded to 50) and kept the backend/data model, variant lookup, selected-product persistence, quantity, and save flows unchanged. The picker now loads the catalog once and filters search, device category, and Smartphone series locally.
- Added tolerant client-side classification for Smartphone, Tablet, Watch, Audio, and IoT, with Find/Reno/A Series secondary chips and a redesigned full-row product selection affordance. Category chips hide only groups absent from the loaded catalog and reset Smartphone series when the primary category changes.
- Added widget/unit coverage for category/series classification, category and series filtering, combined search, reset behavior, tappable rows, and variant flow; updated existing chevron expectations to the new check-circle affordance. Focused tests and Flutter analyze pass; full tests/debug build remain before commit and PR.
# Current task: Realtime pilot LINE chat nickname resolution (2026-09-01)

- Started `feat/realtime-line-chat-nickname-resolver` from clean latest `origin/main` after pausing historical bulk auto-mapping and external-message correlation work.
- Store 28375 ONLINE/PURCHASED saves can now create nullable-chat-ID nickname jobs. The dedicated nickname worker resolves only an unmapped job, using the authenticated v2 chat-list session and a bounded recent window of at most 5 pages/125 chats.
- Resolution requires one unique USER candidate whose authoritative `chatId` passes the official `U` + 32-hex validator, normalized exact LINE name matches the current customer display name, and latest-event time is within 60 seconds of the latest persisted message (with conversation timestamp fallback). Response `userId` and `Customer.lineUserId` are never selected or used.
- Mapping persistence checks same-OA reuse and uses a serializable transaction plus a guarded `lineChatUserId IS NULL` update. It changes only `Conversation.lineChatUserId`, re-reads races, and never overwrites a different mapping. The current job then continues through the existing nickname update path; a second latest-wins guard runs immediately before dispatch.
- Focused LINE chat and BM sales/tag coverage passes (182/182), with affected subsets re-run after identity/log hardening (99/99) and resolver-lease hardening (61/61). Full backend tests pass (1,619/1,619); changed-file ESLint, Prisma validation/local migration deployment, backend build, local backend health, and `git diff --check` pass.
- No production access, historical mapping/apply/backfill, Railway change, nickname mutation, or production DB operation was performed. Next action is the final scoped diff review, commit, push, PR creation, and CI monitoring without merge or deploy.
- Roadmap: Phase 1 is realtime resolution and nickname sync for future tag saves. Phase 2 is manual historical mapping and nickname correction. Historical bulk auto-mapping remains paused.
# Current task: Privacy-safe realtime resolver diagnostics (2026-09-01)

- Production supplied evidence shows authenticated recent-chat discovery is working for the Store 28375 pilot, while a real unmapped conversation returned `RESOLVE_NO_MATCH`. Matching policy remains unchanged: normalized exact name plus the existing ±60-second timestamp tolerance, with a unique candidate required.
- Added one aggregate-only resolver diagnostic event per candidate-analysis attempt. It reports recent/valid-timestamp/name/tolerance/combined counts, a safe closest-delta bucket, timestamp source, and missing-timestamp count; no customer names, chat IDs, timestamps, message contents, tokens, session state, or profile paths are emitted.
- Focused resolver diagnostics tests pass 18/18; full backend tests pass 1,622/1,622; changed-file ESLint, backend build, and `git diff --check` pass. The four-file diff was reviewed, committed as `066bc5f`, pushed, and opened as PR #127.
- No production access, mapping apply, nickname update, queue mutation, migration, deployment, or historical mapping work was performed. CI is running on the PR; merge and deployment remain intentionally untouched.

# Current task: LINE Chat worker maintenance liveness (2026-09-02)

- Added explicit `LINE_CHAT_NICKNAME_MAINTENANCE_MODE=true` precedence after test mode and before the existing emergency-disable flag. Maintenance mode logs a sanitized event, starts only a referenced keepalive interval, and performs no polling or browser work.
- Worker destruction clears both normal polling and maintenance timers. Focused lifecycle tests pass (13/13), the full backend suite passes (1,668/1,668), changed-file ESLint and backend build pass, and `git diff --check` is clean. Repository-wide backend lint retains unrelated baseline errors.
- Committed as `662f562`, merged through green PR #143, and deployed at merge commit `fdc33fa`. The worker and unavoidable backend auto-deploy both succeeded; backend health/readiness, worker normal startup, mounted profile volume, production migration status, and Phase 1/Phase 2 routing isolation passed. Production maintenance remains unset/false, disable remains false, and the live profile probe has not been run.
- The approved controlled Phase 1 probe subsequently ran once under liveness-safe maintenance. Chromium opened and closed cleanly against `profile-b-linux-v2`, but LINE Manager redirected to authentication, so the probe failed at `MANAGER_AUTH` before any chat page, chat-list request, or customer chat access. Normal polling was restored successfully with both worker flags false; routing remained unchanged and no job/profile/mapping mutation was performed. A separately approved controlled reauthentication is the next safe recovery step.
- Controlled Phase 1 reauthentication was attempted under maintenance, but the current worker image lacks `fluxbox`, `x11vnc`, and `websockify`, so the localhost-only interactive noVNC stack could not become ready. The briefly launched Chromium and exact recorded session processes were cleaned up; the existing profile remained in place. No credentials or operator interaction occurred. Normal polling was restored with both flags false and all routing unchanged. Enabling a secure interactive channel requires a separately reviewed worker-image dependency change before reauthentication can resume.
- Prepared a one-file worker-image enhancement adding Noble `fluxbox`, `novnc`, `websockify`, and `x11vnc` packages with no recommended extras, plus a stable `chromium` command for the Playwright-managed binary. The local image exposes no ports and retains the original worker command. A disposable localhost-only X11/VNC/noVNC smoke test passed and cleaned up all processes; focused worker tests pass 13/13, full backend tests pass 1,677/1,677, backend build and diff checks pass. Repository-wide lint retains unrelated baseline errors.
- Committed as `1fd11ee`, merged through green PR #144, and deployed at merge commit `1267bc6`. Worker deployment `c2df1731-2c57-4fc7-999a-f9e12c479316` and the authorized unavoidable backend auto-deployment `a310345a-3851-4197-a202-3d893dd215a8` both succeeded; frontend deployment was skipped. Live worker command/assets, volume, profile presence, DB connectivity, normal startup, false maintenance/disable flags, backend health/readiness, and Phase 1/Phase 2 routing isolation all passed. Interactive reauthentication was not run.
- The subsequent controlled interactive reauthentication failed closed at the listener security guard. x11vnc opened the requested IPv4 loopback socket but also wildcard IPv6 listeners (`:::15901` and `:::5900`), so no SSH tunnel or operator login was allowed. All temporary X11/VNC/Chromium processes, PID records, and listeners were removed; the existing profile remained intact. Normal worker deployment `d11279b4-69b0-4f13-947b-07e49e3e00c1` succeeded with both flags false, zero processing jobs, and unchanged Phase 1/Phase 2 routing. A narrow launch-tool hardening to disable IPv6 listening is required before retrying.
- The one authorized hardened retry confirmed production x11vnc supports both `-no6` and `-noipv6`, but failed closed before any listener was created because Fluxbox aborted while starting under the temporary GUI home. The listener guard, noVNC, SSH tunnel, operator login, Chromium, and LINE requests were therefore never reached, and no second attempt was made. Cleanup confirmed zero interactive processes and zero ports 15901/16081 listeners, with `profile-b-linux-v2` still present. Maintenance-off deployment `b22514c4-8393-42a8-ba22-47fb7139bb6f` succeeded; normal worker startup/polling resumed with both control flags false, Store 28375 had no processing job, and Phase 1 plus all six Phase 2 routing records remained unchanged.
- The separately authorized single Xvfb-only retry entered maintenance successfully but failed closed at X-display readiness with exit code 127: Xvfb itself started and logged only non-fatal keymap warnings, while the requested `xdpyinfo` readiness command was unavailable. No Fluxbox, x11vnc/noVNC listener, SSH tunnel, Chromium, operator login, or LINE request was reached, and the launcher was not rerun. Targeted cleanup plus the replacement container left zero temporary processes/listeners and preserved `profile-b-linux-v2`. Maintenance-off deployment `c3e1b6d8-8037-46f2-85a2-e5cd88d7da0f` succeeded with both flags false, DB connectivity, normal worker startup/polling, zero Store 28375 processing jobs, and unchanged Phase 1/Phase 2 routing.
- The next explicitly authorized readiness-check-only retry passed the Xvfb PID, exact command, Unix socket, and fatal-stderr checks. x11vnc successfully accessed display `:99` and opened `127.0.0.1:15901`, but also attempted an unauthorized TCP6 listener on port 5900 despite the supplied `-no6 -noipv6` options. The socket guard failed closed before noVNC, tunnel, Chromium, operator login, or LINE requests, and no retry was made. Cleanup plus replacement-container deployment `aae012c7-5741-45a2-b986-bb8ee6092209` left zero temporary processes/listeners, both worker flags false, the exact profile mounted, DB connectivity and normal polling restored, zero Store 28375 processing jobs, and Phase 1/Phase 2 routing unchanged.
- The one authorized `-rfbportv6 -1` retry confirmed that option is supported and successfully constrained x11vnc to only `127.0.0.1:15901`; the subsequent noVNC guard also passed with only `127.0.0.1:15901` and `127.0.0.1:16081`. Chromium then failed closed before the SSH tunnel/operator handoff because the exact persistent profile retained a singleton lock referencing another Chromium process and prior container hostname. The lock was not removed because profile mutation was outside scope. Cleanup and replacement-container deployment `40095439-e502-423e-8f9d-4616105841e0` left zero temporary processes/listeners, preserved the profile, restored both flags false plus normal polling/DB connectivity, and confirmed Phase 1/Phase 2 routing unchanged.
- Read-only stale-lock preflight classified the exact `profile-b-linux-v2` Chromium singleton set as stale: `SingletonLock`, `SingletonSocket`, and `SingletonCookie` are broken symlinks with the same timestamp; the lock references previous hostname `efa0805c1c47` and PID 69, while the current hostname differs, PID 69 does not exist, no Chromium/Chrome/Playwright or exact-profile owner is active, and the referenced socket does not exist or have an owner. Queue and routing guards passed, maintenance stayed off, and no artifact/profile/data mutation or browser launch occurred. A separately authorized removal of only those three singleton symlinks is the next controlled recovery step.
- Controlled stale-lock recovery then removed only the three authorized singleton symlinks after immediate ownership revalidation. Xvfb, x11vnc with `-rfbportv6 -1`, noVNC, and the localhost-only SSH tunnel passed; Chromium launched the exact profile and created a current valid lock. After operator confirmation, the bounded aggregate-only probe passed Manager Auth, Store 28375 OA/chat auth, chat-list request/response, HTTP 200, JSON parse, and count 25 without opening customer chats or printing records. Chromium and temporary stack were cleaned, normal worker restoration deployment `51ed075a-8aab-46ab-8b5d-118c1824cddc` succeeded, both flags are false, DB/volume/polling are healthy, zero Store 28375 processing jobs remain, and Phase 1/Phase 2 routing is unchanged. No BM test was run.
- One fresh Store 28375 BM-save job observed after the watcher baseline completed SUCCESS with no mapping at creation, worker claim, resolver `RESOLVED`, recent-chat aggregate count 125, exact-name match count 1, mapping present, nickname PUT status 200, and attempt count 0. Final Phase 1 session remained ACTIVE on `profile-b` / `profile-b-linux-v2`; final readback kept Phase 1 and all Phase 2 routing unchanged with one account-1 session. A sanitized count found 9 Store 28375 jobs created in the watcher window (all SUCCESS), so production activity exceeded the requested single-save condition; no jobs were created or retried by the agent.

# Current task: Phase 1 live profile probe — maintenance mode (2026-09-02)

- Fresh production guards passed before maintenance: no nickname jobs were processing; Store 28375 retained active `profile-b` / `profile-b-linux-v2` routing with sync enabled; all six Phase 2 stores retained active `account-1` / `account-1-v1` routing with sync enabled; exactly one `account-1` session existed.
- Set only `DISABLE_NICKNAME_WORKER=true` on `line-chat-nickname-worker` and deployed worker revision `6b7f269e-bbc0-4293-877f-6d7b436899ec`. Its logs confirmed `line_chat_nickname_worker_disabled`, but the Nest process exited because disabling the polling timer left no active event-loop handle. Railway therefore provided no live container for the approved profile probe.
- Failed closed: did not start Chromium, access the profile, request the chat list, reauthenticate, open a customer chat, mutate mappings/jobs/data, or retry historical work. Restored `DISABLE_NICKNAME_WORKER=false` immediately.
- Recovery deployment `09bf45f2-8883-45a1-a5db-327aab4d505f` succeeded. Logs confirmed `line_chat_nickname_worker_started`; the container is alive, the profile volume and `profile-b-linux-v2` directory are present, and the flag reads `false`.
- Post-recovery readback confirmed Phase 1 and Central World unchanged, all five Stage B stores still use `account-1` / `account-1-v1` with sync enabled, and the `account-1` session count remains exactly one. Next action requires a separately approved maintenance mechanism that keeps the worker container alive while polling is disabled.

# Current task: Phase A1 LINE profile operation coordinator (2026-09-03)

- Added an additive `LineChatProfileOperationLease` model/migration keyed uniquely by `LineChatSession`, with fenced owner tokens, operation kinds, heartbeat timestamps, and expiry. No existing routing, profile, customer, conversation, or nickname-job data is changed by the migration.
- Added a shared coordinator with a process-local session mutex plus atomic database lease acquisition, renewal, owner-token-guarded release, bounded contention, and fail-closed lease-loss handling. The nickname worker now holds one ownership context across unresolved recent-chat resolution and nickname PUT, preventing nested-lock deadlocks.
- Profile contention is requeued as `PROFILE_OPERATION_BUSY` without incrementing attempts or classifying the job as `FAILED_AUTH`. Existing latest-wins, bounded resolver, identity, and nickname semantics remain unchanged. Maintenance-mode precedence and keepalive behavior remain unchanged.
- Focused coordinator/worker/resolver/discovery tests pass; full backend tests pass (1,685/1,685); Prisma validation, backend build, and changed-file ESLint pass. Repository-wide backend lint retains unrelated baseline violations. No production browser probe, profile access, Railway change, migration deployment, push, merge, or deploy was performed.
- Next action: operator review of the scoped diff, then separately authorize any commit/push/PR workflow. Phase A1 does not enable health scheduling, UI, alerts, or production probes.

# Current task: Admin LINE Chat Operations Health page (2026-09-04)

- Production verification 2026-09-05: remote `deploy/line-chat-health-dashboard` retained at `360e55dbe5be20cb9e126d6f74247fb8ecaa7ef8`; repository-backed frontend deployment `da1ecbe5-1c2d-40a0-ae45-f91e8fb9ccbb` SUCCESS. Dashboard/public routes and health routes return 200; unauthenticated operations API returns 401. All 28 APK assets exist in runtime; advertised v1.1.15 asset returns 200 (60,081,670 bytes), resolving the previously observed 404.
- Verification blocker: newer main-backed backend deployment `5162fa2f-c71a-448c-a9de-99f635ad231e` at `78624d56bc19e863f1275e2adbd36a197e3d14ee` replaced the dashboard backend and omits the dashboard health/job/failure fields. Authenticated browser unavailable. No retry, worker/maintenance/profile changes, or main merge performed. Next action: reconcile dashboard backend changes with current main before final functional sign-off.

- Added admin-only `/operations/line-chat-health` with separate session-health and job-health presentation, responsive overview/detail views, safe failure diagnostics, active lease visibility, and a confirmation-gated session-scoped retry action.
- Extended the existing `GET /operations/line-chat-nickname/health` response; no credentials, tokens, cookies, profile paths, nicknames, or customer/chat content are returned. Existing `POST /operations/line-chat-nickname/retry-failed?sessionKey=...` remains the only mutation exposed by this page.
- Health classification keeps `ACTIVE / CONNECTED` green even when individual jobs fail; those accounts render as yellow `Connected with job failures`, not disconnected or authentication failed.
- Prisma validation/generation, backend and frontend production builds, targeted lint, 1,691 backend tests, and 487 frontend tests pass. Local HTTP checks returned 200 for the page/backend health and 401 for the unauthenticated admin API. Repository-wide lint retains unrelated pre-existing dirty-worktree failures.
- No production deployment, Railway change, profile access, job retry, or session mutation was performed for this UI task.
# Backend dashboard reconciliation — 2026-09-05

- Integration branch `deploy/line-chat-health-backend-reconcile` merged latest `origin/main` (`8aa5a58 Merge pull request #157 from supersunxm/fix/google-review-attribute-by-review-date`) into exact dashboard commit `360e55d` without conflicts or rebase.
- Commit `360e55dbe5be20cb9e126d6f74247fb8ecaa7ef8` remains strictly in git history.
- Backend 1,722 tests passed, frontend 488 tests passed, targeted operations tests passed, builds passed, and ESLint passed on changed files.
- Repository-backed Railway backend deployment `83168dca-d6af-4380-bdd1-ac15b9283acc` deployed SHA `32f6c461822d91c46198f8c9a1920abd6bbd3c67` and reached SUCCESS.
- Production smoke tests confirmed:
  - Backend `/health` -> 200
  - Backend `/health/readiness` -> 200
  - Unauthenticated `/operations/line-chat-nickname/health` -> 401
  - Frontend `/api/health` -> 200
  - Dashboard route `/operations/line-chat-health` -> 200
  - Public routes `/`, `/login`, `/download`, `/download/history` -> 200
  - Advertised APK v1.1.15 -> 200 (60,081,670 bytes, correct Content-Type)
- Production account-1 live readback confirmed: `status = ACTIVE`, `healthStatus = CONNECTED`, `healthFailureStage = null`, `consecutiveAuthFailures = 0`, `activeProfileLeases = 0`, `failedJobs = 7`. Overall status: `Connected with job failures`.
- Zero failed jobs retried; zero worker behavior, coordinator, lease, or profile changes made; `main` was not modified. Prepared for PR review.

# Current task: Shared analytics period picker (2026-09-08)

- Branch: `feat/unified-period-picker`. Refactored the existing Follower Insights calendar into `frontend/src/components/date-range/unified-period-picker.tsx`; retained a compatibility export at the old location. The shared component owns 7D/14D/30D presets, exact preset matching, temporary draft selection, Apply/Cancel, inclusive 90-day validation, theme tokens, translated Gregorian labels, responsive calendars, viewport positioning, and keyboard focus/navigation.
- Rebasing onto `origin/main` at `096a781` completed without conflicts. Latest main's `/replymessage`, sidebar entry, store-ID fixes, relay-priority fix, and 24-hour response API work remain intact.
- Migrated Dashboard overview and store comparison, `/replymessage` Store24hResponsePanel, desktop/mobile Message Traffic and Follower Insights, desktop/mobile Purchase Analytics, Download Center, and daily follower export. Removed per-page preset controls and callbacks. Backend metrics, authorization, and migrations were not changed; existing inclusive ISO date query parameters remain in use.
- Remaining native date controls: two inputs in `frontend/src/app/page.tsx` are admin backfill operation parameters, not reporting filters. Coupon datetime controls schedule coupons. Google Review weekly/month selectors select fixed business periods and were retained.
- Verification after rebase: 503/503 frontend tests pass; targeted picker, dashboard, route, navigation, and reply-message tests pass 37/37; targeted ESLint passes; production build passes and includes `/replymessage`; diff whitespace check passes. Clean `origin/main` has the same 58 TypeScript diagnostics and 62 repository-wide ESLint errors, with 79 warnings versus 78 on this branch. No new full-check failures were introduced.
- Started the rebuilt production frontend on inspected port 3000. `/api/health` and `/replymessage` return HTTP 200 with no startup errors. Source and tests confirm dashboard authorization, responsive desktop/mobile store views, search preservation, chat navigation, sidebar active-state matching, no native date input, and the unchanged authenticated `store-24h-response-summary?dateFrom=...&dateTo=...` request.
- Remaining limitation: browser discovery reports zero connected browsers, preventing authenticated Apply/Cancel, mobile/dark-mode visual, console, keyboard, and live API interaction sign-off. Existing full-repository lint/typecheck failures remain pre-existing blockers.
- Next action: review the updated draft PR and complete authenticated desktop/mobile browser verification when a browser is connected. Do not merge or deploy.

# Current task: Rich Menu TikTok variable resolution (2026-09-08)

- Added `tiktokUsername` and `tiktokProfileUrl` to both `StoreVariableContext` constructions in `backend/src/rich-menu/rich-menu.service.ts`: preview/auto-response validation and `publishOneStore`/auto-response publishing.
- Preserved the canonical resolver behavior: `store.tiktokProfileUrl` reads the canonical Store Master field, and `store.tiktokUrl` aliases/falls back to it. No Prisma schema changes were made.
- Added resolver coverage for `{{store.tiktokUrl}}` and Rich Menu preview coverage for successful URL resolution plus fail-closed missing-data behavior. Extended the existing publish pipeline test to assert LINE receives a real TikTok URL while retaining the Google Maps assertion.
- Checks passed: focused Rich Menu/resolver tests 38/38; full backend runtime tests 1,795/1,797 (the 2 failures are unrelated pre-existing failures: missing `vitest` dependency in `line-chat-manager-image-relay-worker.spec.ts`, and duplicate writes observed by `sync-connected-line-oa.spec.ts`); production TypeScript check via `tsconfig.build.json`; backend build; localhost `/health` and `/health/readiness` both HTTP 200.
- Changed-file ESLint reports the service/spec baseline violations already present in those files; no new lint violation is reported at the added TikTok lines. Full-project TypeScript checking likewise retains unrelated existing spec errors.
- No database migration, deployment, LINE API call, or commit was performed. Existing unrelated TikTok frontend worktree changes were preserved.
- Next action: review the scoped diff and commit only with explicit authorization.

# Current task: LINE nickname backlog mapping isolation (2026-09-09)

- Started `feat/line-chat-nickname-mapping-isolation` from the existing worktree, preserving unrelated weekly-collector changes. The design uses an in-process per-session/OA/bot recent-chat snapshot with a 60-second ready TTL, a 30-second failure TTL, and in-flight single-flight refreshes; no schema migration is required.
- The nickname worker now checks durable `Conversation.lineChatUserId` before any browser operation, batches unresolved jobs by OA/session into one bounded recent-chat refresh, persists only unique safe mappings, and defers no-match/ambiguous/conflict jobs instead of repeatedly scanning or holding a profile lease.
- Mapping refreshes use `RECENT_RESOLUTION` with fail-fast background contention, retain the existing resolver eligibility boundary, and release the profile before DB batch persistence. Nickname PUTs remain `NICKNAME_UPDATE`; customer text/image relay remains `MANUAL_DIAGNOSTIC` and keeps its existing fail-closed/no-Push behavior. Pause/Resume controls are unchanged.
- Temporary Postgres connectivity errors are sanitized and retryable: the worker stops claiming when reads fail and requeues a claimed job after a bounded DB backoff. Health output now includes mapped-ready pending, waiting-for-mapping, and oldest-pending metrics; the frontend API type is additive.
- Focused LINE resolver/worker/coordinator/priority/operations tests pass 65/65; production backend build passes; changed LINE-file ESLint passes; frontend tests pass 537/537 and frontend production build plus changed-file ESLint pass. Full backend runtime tests pass 1,800/1,802 with two unrelated baseline failures (missing `vitest` and duplicate store-master test writes); repository-wide backend/frontend lint remains unrelated baseline failures.
- Local backend started successfully with `DISABLE_NICKNAME_WORKER=true`; read-only `/health` returned 200 and unauthenticated operations health returned 401. No migration, production backlog resume, customer message, LINE browser access, or production data mutation was performed.
- Next action: final diff review and separately authorized commit/push/PR workflow. Rollout remains paused: deploy with the worker paused, observe health metrics, then resume only a 5–10-job profile-b canary after approval.

# Current task: Public OPPO Brand Shop app icon alignment (2026-09-09)

- Reused the exact tracked `frontend/public/images/LOGO_OBS.png` source (1024×1024); the new Next.js `icon.png` and `apple-icon.png` copies are byte-for-byte identical.
- Added root metadata icon links, a minimal `manifest.webmanifest`, and a reusable decorative 24px/28px public header icon across `/`, `/stores`, `/stores/[identifier]`, `/tiktok-integration`, and `/connect/tiktok`. Existing green header branding markup and copy remain unchanged.
- Removed the stale App Router `favicon.ico` so the browser tab cannot continue serving the previous icon. No backend, database, TikTok OAuth, LINE OA, authentication, StoreMaster, or internal staff UI changes were made.
- Frontend tests pass 537/537 and the production build passes. Local HTTP checks returned 200 for all requested public routes and icon/manifest assets. Changed-file lint is clean except for two pre-existing `setState`-in-effect errors in the touched public store components; repository-wide lint retains unrelated baseline errors. Browser discovery was unavailable, so visual screenshots and browser-console inspection remain pending.
- Branch: `fix/public-app-icon-branding`. No commit, PR, merge, or deployment performed yet. Next action: final diff review, then commit only the focused files if repository write access is available.

# Current task: Prisma TikTok public models reconciliation (2026-09-10)

- Started `fix/prisma-tiktok-public-models` from clean `origin/main` (`954ac65`), keeping Phase 2A on its separate branch.
- Verified `20260907153000_add_tiktok_public_analytics` against the production catalog: both tables, exact columns/defaults/nullability, eight indexes, ten migration-defined constraints, cascade foreign keys, and live aggregate counts are present.
- Restored `TikTokPublicProfile` and `TikTokPublicDailyMetric` in `backend/prisma/schema.prisma` with existing table names, StoreMaster relations, DATE mapping, unique constraints, and indexes. No TikTok migration was created or executed.
- The current-repository production diff no longer proposes TikTok table or foreign-key drops; unrelated CustomerSignal/Coupon/default/index drift remains intentionally unchanged. Prisma generate/validate, focused public TikTok tests (13/13), scoped ESLint, backend build, Prisma Client clone read, and diff checks passed.
- No production database write, deployment, Customer Voice migration/backfill, Phase 2A merge, or Phase 2B work was performed. Next action: review, commit, and push this isolated reconciliation branch only.

# Current task: Store 360 selector and custom-date refinement (2026-09-10)

- Replaced the Store 360 native store dropdown with a single-select searchable combobox over the existing authorized `api.stores()` result. Search covers store name, external Store ID, code, and internal fallback ID; the selected store and Store ID remain visible.
- Added focus-on-open, Arrow Up/Down, Enter, Escape, clear-search, no-results, active-option scrolling, and bounded-list behavior. Store selection retains the existing internal ID URL/API contract and server-authorized scope.
- Kept Store 360 preset, Bangkok-calendar, comparison, and API date logic unchanged. Custom mode now reuses the Follower Insights `UnifiedPeriodPicker` with two-month calendar navigation, range highlighting, 7D/14D/30D quick ranges, and the existing 90-day validation.
- Custom calendar selections stay in draft state until Apply; Cancel/Escape discard them. Apply alone updates URL/API state. Store result scrolling now adjusts only the bounded results container, contains wheel overscroll, and no longer calls `scrollIntoView()` on active options.
- Added request-generation invalidation so older summary/conversation responses cannot overwrite a rapidly changed store, date, or comparison selection. No backend, KPI, analytics definition, database, authorization, or Phase 2 AI change was made.
- Verification passed: Store 360 controls plus Follower Insights/date-range tests 33/33, scoped ESLint, frontend production build, and whitespace checks. Local frontend/backend startup and health checks returned 200; `/store-360` returned 200. Browser discovery had no connected browser and local dev auth bypass was unavailable, so authenticated visual click-through remains the only limitation.
- No commit, push, deployment, or production mutation was performed.

# Current task: Store 360 Phase 2A Customer Voice (2026-09-10)

- Audited the existing implementation before changes. Existing `ConversationTopic` data and the product catalog/matcher are reusable read-only signals. The repository has no configured LLM SDK/provider or Customer Voice credentials, so this phase uses a deterministic provider-neutral rules fallback and does not make paid AI calls. A production aggregate coverage query was not performed; the configured local last-30-day snapshot had 14 eligible conversations and no persisted topics.
- Added versioned `ConversationAnalytics` persistence with one idempotent current row per conversation/version. Analysis uses real inbound text at conversation level, counts repeated inbound bubbles as one conversation analysis, records provenance, keeps raw message bodies out of API responses, and never writes to the existing topic taxonomy.
- Added canonical Customer Voice taxonomy and intent inference, existing-catalog product/model normalization, authenticated store-scoped aggregation with current/previous/trend metrics, topic drilldown into the existing Conversation Explorer, honest no-analysis UI states, stale-request protection, an opt-in bounded worker, and a controlled store/date dry-run backfill script. HEAD_OFFICE and inactive/QA data remain excluded.
- Verification passed: Prisma generate/validate, Customer Voice backend tests 9/9, frontend focused/full tests 560/560, changed-file ESLint, backend and frontend production builds, and `git diff --check`. The prior full backend run completed 1,800/1,802 tests; its two failures were unrelated existing baseline tests (LINE Manager textarea contract and duplicate Store Master sync writes). Full repository TypeScript checks also retain unrelated baseline failures outside this work.
- Local `prisma migrate deploy` is blocked by an unrelated recorded failed migration (`20260904160000_add_google_review_weekly_kpi_models`) whose database error is `type "GoogleReviewPeriodStatus" already exists`; no resolve, enum drop, or migration repair was attempted. The new migration is therefore not applied locally. This Phase 2A implementation is checkpointed only on its dedicated feature branch and is not approved for production integration yet; no production-wide Customer Voice backfill has run, no AI provider is configured, and Phase 2B has not started.
- Next action: recover the unrelated historical migration with the repository owner, then apply and verify the Customer Voice migration before enabling the opt-in worker or running any controlled backfill. Keep deployment and paid-provider integration out of scope until separately approved.

# Current task: Store 360 Phase 2A integration candidate (2026-09-10)

- Started `feat/store-360-customer-voice-integration` from latest `origin/main` (`5083f6b`) and cherry-picked Phase 2A checkpoint `1bf6683`. The only conflict was `DECISIONS.md`; newer TikTok decisions and the complete Phase 2A decision record were preserved.
- Combined Prisma schema retains `TikTokPublicProfile`, `TikTokPublicDailyMetric`, `CustomerVoiceAnalysisSource`, `CustomerVoiceIntent`, and `ConversationAnalytics`. The production diff has no TikTok drops and shows Customer Voice as additive alongside known unrelated drift; production status reports only the Customer Voice migration pending.
- PostgreSQL 18.6 disposable rehearsal restored production schema plus the 117-row migration ledger, applied only `20260910120000_add_customer_voice_analytics`, reached clean status at 118 migrations, and retained the TikTok tables. Clone backend smoke checks returned health/readiness 200 and unauthenticated Customer Voice 401.
- Combined verification passed: backend Customer Voice/Store Insights tests 21/21, frontend focused tests 8/8, full frontend tests 560/560, scoped ESLint, backfill script typecheck, Prisma generate/validate, backend/frontend builds, and diff checks. Worker remains disabled by default and backfill remains explicit, scoped, limited, dry-runnable, and rate-limited.
- Main deployment `5083f6b` succeeded with health/readiness 200. No production Customer Voice migration or backfill was run, and this candidate is not yet merged into main. Next action: review this pushed integration candidate before separately authorizing a merge and production migration.

# Current task: Store 360 Bangkok date-boundary fix (2026-09-11)

- Started `fix/store-360-bangkok-date-boundaries` from clean `origin/main` (`ae0b1a8`). The audit confirmed that Store 360 Phase 1, Customer Voice aggregation, and the Customer Voice backfill converted Bangkok date-only inputs using UTC midnight even though persisted message timestamps represent UTC instants.
- Added an explicit `bangkokDateRangeToUtcBounds` half-open range helper. Store 360 and Customer Voice now use Bangkok calendar midnights converted to UTC; response lookup retains the existing report-end-plus-24-hour SLA window. The generic `toUtcDateForDb` remains unchanged for non-reporting callers.
- Boundary coverage includes Bangkok midnight inclusion/exclusion, one-day, month/year boundaries, invalid/reversed ranges, comparison periods, and a response inside the corrected +24-hour SLA window. No database migration, production write, backfill, worker enablement, AI call, or deployment is part of this task.
- Next action: complete affected tests/builds and read-only pilot-store metric cross-check, then commit and push this fix branch only. Do not merge, deploy, or resume the persisted pilot.

# Current task: Customer Voice pilot refinement (2026-09-11)

- Diagnosed the production `Opening Store 360…` hang after authorization: the client view repeated `api.me()` with `api.stores()` in an unbounded `Promise.all`; rejection was stored in an error state hidden behind the `!authUser` loading guard, and the one-shot ref plus effect cleanup could suppress a valid completion/retry. Added a 15-second bounded bootstrap, visible retry state, authorized-store URL validation/fallback, and tests for valid/missing/unauthorized stores and timeout behavior.
- Isolated Customer Voice request failures inside the Customer Voice panel so they cannot block or replace Phase 1 metrics. Phase 1 bootstrap and summary remain independent of Customer Voice availability.
- Reviewed only the existing 25 production pilot analyses. The sanitized 10-row gap split was eight missing-rule candidates, one uncovered phrase, and one acknowledgement-only conversation. Added conservative, evidence-backed payment, store-contact, and product-question patterns; acknowledgements remain unclassified.
- Product reporting now keeps exact matched models and suppresses a redundant family-level match from the same Product Series. Persisted `ConversationTopic` remains read-only and retains explicit existing/mixed provenance.
- Aggregate-only production dry-run against exactly the existing 25 rows improved classified coverage from 15/25 (60%) to 19/25 (76%), with four newly classified payment cases and six still unresolved. One existing `Other`/`GENERAL` case becomes payment; two multi-topic payment intents become the higher-priority `PRICE_CHECK`; three redundant family mentions are suppressed. No production row was inserted or updated; no raw customer content or identifiers were returned.
- Verification passed: focused Customer Voice backend tests 11/11, all frontend tests 563/563, scoped backend/frontend ESLint, Prisma validate/generate, backend/frontend production builds, local backend startup with worker disabled, local `/health` and `/health/readiness` 200, `/store-360` 200, unauthenticated Customer Voice 401, and diff whitespace checks. The existing Docker-backed database required the backend smoke test to run outside the filesystem sandbox; startup then completed cleanly.
- Production safety readback remains 25 analytics rows in one store, zero rows with AI provider provenance, and worker disabled. No commit, push, deployment, worker enablement, AI call, or additional persisted batch was performed. Next action: review these uncommitted changes; do not reprocess the 25 rows until separately authorized.

# Current task: Customer Voice ruleset version provenance (2026-09-11)

- Bumped the refined deterministic ruleset source of truth from `customer-voice-rules-v1` to `customer-voice-rules-v2`. Existing pilot rows remain historical v1 rows and were not modified.
- Added explicit version-aware eligibility checks for the worker/backfill path: a v1 checkpoint is eligible for intentional v2 processing, an unchanged v2 checkpoint is skipped, and a newer inbound message makes the current-version checkpoint eligible again.
- The existing compound `(conversationId, analysisVersion)` uniqueness remains unchanged, so v2 reprocessing preserves v1 history and creates/updates the v2 version row. Store Insights and Customer Voice aggregation already filter the current v2 source of truth.
- Added provenance assertions for v2 persistence, `rules-v2` model metadata, null model provider, and no AI metadata, plus focused versioning tests. No production rows, deployment, worker, AI call, or backfill was performed.
# Current task: Customer Voice ruleset v3 design (2026-09-11)

- Used the original 25-row pilot and the prior 50-row v2 holdout as a read-only design corpus. The prior holdout's sanitized gap signatures showed reusable Thai retail phrasing gaps and a small number of safe product-boundary normalization gaps; no new canonical taxonomy category was justified.
- Implemented `customer-voice-rules-v3` in an isolated worktree from `origin/main` (`b2d1478`). v3 keeps v1/v2 provenance immutable, tightens product-information rules to require product context, adds conservative stock/store/service/trade-in/payment phrasing, preserves greeting and acknowledgement precision, and normalizes safe Thai OPPO brand/model boundaries for Customer Voice matching only.
- Added focused tests for reusable patterns, topic precedence, Thai product normalization, v3 persistence metadata, and v1/v2-to-v3 version eligibility. No migration, production write, worker enablement, AI call, deployment, commit, or push has occurred.
- Next action: run the 75-conversation design-corpus regression and a newly stratified 50-conversation untouched v3 holdout. Do not persist holdout rows until the evaluation is reviewed separately.

# Current task: Customer Voice ruleset v3 evaluation complete (2026-09-11)

- The 75-conversation design regression produced 21/25 classified on the original pilot and 37/50 on the prior holdout, with zero classification losses and zero clearly incorrect v3 results. The fresh 50-conversation holdout was selected from the remaining 113 conversations with zero overlap and classified 43/50 (86%); all seven misses were meaningful rather than non-informative acknowledgements.
- Product recognition on the fresh holdout was 16/50, improving from 14/50 under v2 on the same selection. v3 retained exact-model-over-family suppression, added two safe Reno-family recoveries, and left generic OPPO/device mentions unresolved rather than guessing a model.
- Production remained unchanged throughout the evaluation: ConversationAnalytics stayed at 50 rows (25 v1, 25 v2, 0 v3), worker disabled, external AI calls 0, and no conversation/message/topic/ProductModel writes. No deployment, commit, or push was performed.
- Focused v3 backend/versioning tests pass 19/19; scoped ESLint, backend build, Prisma validate/generate, and diff checks pass. Recommendation remains to review the uncommitted candidate before any checkpoint or v3 persistence authorization.
# Current task: GitHub Issue #251 FILM customer tagging (2026-09-11)

- Started dedicated branch `feat/issue-251-film-customer-tagging`. Added first-class `CustomerSalesStatus.FILM` plus nullable `Conversation.filmBrand`, mobile API validation/contracts, additive Prisma migration, activity metadata, realtime/list data, and server-side clearing rules. FILM is independent of ONLINE, INTERESTED, and PURCHASED.
- Added the Flutter sales model/repository/UI flow with the required brand options (`OPPO`, `iPhone`, `Samsung`, `vivo`, `Xiaomi`, `HONOR`, `realme`, `Other`), custom-brand input, server-response reconciliation, and FILM-only controls. Switching away clears `filmBrand`; FILM clears interest, channels, payment/installment, purchase provenance, and sales products.
- Extended the existing LINE nickname builder, queue, mapping, and historical backfill without changing queue/latest-wins/retry/rollout behavior. FILM uses the persisted `salesRecordedAt` in `Asia/Bangkok` and emits `Film/<Brand>/MM/YY`, compacting only the brand segment to stay within 20 characters.
- Verification passed: Prisma generate/validate, backend build, 93 focused backend tests, frontend tests (565/565), frontend production build, Flutter analysis, full Flutter tests (228/228), and the explicit unsigned production release compile with production dart-defines. Live foreground checks returned backend `/health` 200, frontend `/` 200, protected Store Master 401, and unknown backend route 404.
- Full backend suite completed 1,869/1,876 tests; the seven failures are existing unrelated baseline failures (missing `vitest` dependencies in two regression files, health fixture/data assumptions, manager textarea contract assertion, and duplicate Store Master sync writes). Full backend/frontend repository lint retains unrelated existing violations; changed-file ESLint passed.
- Blockers: `prisma migrate deploy` is stopped by the pre-existing failed migration `20260904160000_add_google_review_weekly_kpi_models` (`P3009`), so the local FILM column/enum is not applied. The signed production APK cannot be produced in this environment; the release workflow hits the Java 25 Flutter Gradle plugin-resolution issue, while the unsigned release compile succeeds. No merge, push, or production mutation performed.

# Current task: Android 1.1.19+39 FILM release readiness (2026-09-11)

- Verified isolated `main` matches `origin/main` at `d28fa662a251e759a68c9580384bb9694392866f` and confirmed the Film status, brand selector, custom brand input, and Film + brand display are present in the Flutter app.
- Bumped only the Android app version from `1.1.18+38` to `1.1.19+39`. `flutter pub get`, Flutter analyze, and the full Flutter suite pass (228/228).
- Diagnosed the release environment: Flutter was configured to Android Studio JDK 25.0.2 even though Temurin JDK 17 is installed. Pointed Flutter to the installed JDK 17 without changing repository Gradle or app source. The command-scoped `android.newDsl=true` compatibility override allows the current Flutter/AGP toolchain to compile.
- Built and verified the production-configured unsigned APK at `android_app/build/app/outputs/flutter-apk/app-release.apk` (59,483,406 bytes; SHA-256 `449053f57e5519e9e8b7836f5070c5eb663bef6fcb1cc82b77e6d7cb61b36ce4`); manifest reports package `click.lineoppo.chat`, version `1.1.19`, build `39`, and the production Railway API URL is present in the AOT binary.
- Signed release remains blocked because the isolated worktree has no private `android/key.properties` or release keystore. No backend/database command, production migration, Google Review repair, or release-surface publication was performed. Next action: provide the permanent signing key securely, then rebuild and verify the signed artifact before distribution.

# Current task: Store 360 Export production rollout (2026-09-11)

- Rebased the export-only candidate onto latest `origin/main` (`a68b221`) and cherry-picked only the Store 360 Export feature/docs commits. Customer Voice v4 worktrees and unrelated Android release changes remain outside the candidate diff.
- Pre-push verification passed: backend export/Store Insights/Customer Voice/date tests 44/44, frontend tests 568/568, scoped ESLint, Prisma validate/generate, backend build, frontend build, and diff checks. The candidate was pushed to `main` as `d234d96`.
- Railway backend and frontend deployments for `d234d96` both reached `SUCCESS`; backend `/health` and `/health/readiness`, frontend `/store-360`, and `/chats` returned HTTP 200.
- The first authenticated production export smoke test exposed a CommonJS/ESM interop defect masked by the local `tsx` runner: `exceljs` has named `Workbook` exports in the deployed runtime. Changed the import to a namespace import, rebuilt successfully, and deployed the corrective commit. The endpoint then returned successful download responses and the authenticated dialog closed normally.
- Validated the downloaded single-store workbook and exact seven-store workbook without printing cell contents: all four required sheets and headers match, Bangkok dates are `2026-08-13` through `2026-09-11`, the seven-store Summary contains exactly seven authorized stores, current Customer Voice values are v3 only, and no forbidden PII/raw-message markers are present.
- Production safety readback shows the Customer Voice worker flag disabled, zero `AI_CLASSIFIED` rows, no v4 analysis version, and no export migration or write path. Final corrective deployment is `a9c7e15`.
- Export generation remains read-only: it authorizes selected stores before loading analytics, uses Bangkok inclusive dates, includes only the canonical Customer Voice version, emits aggregate/derived fields only, and has no migration, worker, AI, message-send, or analytics-write behavior.

# Current task: Structured ONLINE source selection (2026-09-11)

- Architecture decision: do not reuse `Conversation.sourceChannels`. That field is a typed `STORE`/`ONLINE` purchase-provenance array and cannot safely represent one arbitrary ONLINE source or a custom `Other` value. Added nullable `Conversation.onlineSource` as the ONLINE-only structured value; no existing data is mass-migrated.
- Added the additive Prisma migration `20260911170000_add_online_source`, backend DTO/response contracts, service validation and clearing rules, Flutter model/repository field, trilingual source selector, custom source input, and the existing explicit confirmation/loading/double-submit pattern. ONLINE saves now require one source; switching away clears it.
- Extended the existing nickname builder, queue, and historical backfill inputs without changing latest-wins, retry, rollout, or queue persistence. New ONLINE nicknames use the persisted `salesRecordedAt` in `Asia/Bangkok` as `<Source> <MM/YY>`, sanitize slash/control characters, compact only the source portion, and stay within 20 characters. Legacy ONLINE rows with no source continue using `Online`.
- Verification passed: Prisma generate, Prisma validate with a local placeholder `DATABASE_URL`, backend production build, changed-backend ESLint, focused backend tests **88/88**, focused tagging Flutter tests **24/24**, Flutter analyze, full Flutter tests **234/234**, frontend tests **568/568**, frontend production build, and `git diff --check`.
- Full backend suite completed **1,887/1,894 passed**; the seven failures are unrelated existing Line Chat composer/health/manager and Store Master sync baseline failures. No production database, migration deploy, merge, push, or release was performed.
- Next action: review and commit this isolated candidate only; do not merge or release yet.

# Current task: Structured ONLINE source selection and compact status selector (2026-09-11)

- Rebased the ONLINE source-selection candidate onto latest `origin/main` (`718cf21411542261fd83f1eb2c5b712e401d5d0a`). The only rebase conflicts were append-only `AI_PROGRESS.md` and `DECISIONS.md` sections; upstream Store 360 code and notes were preserved.
- Replaced the customer-sales status `SegmentedButton` with a content-sized, horizontally scrollable `ChoiceChip` row. Labels are one-line/non-wrapping, selected chips show a check icon, tap targets remain padded, and the existing empty-selection and status callback/save behavior is unchanged.
- Added widget coverage for selecting all four statuses without persisting drafts, narrow 360 px one-line labels, horizontal scroll extent/gesture, and no status-selector overflow. Existing ONLINE/FILM/PURCHASED/INTERESTED tagging coverage remains in the focused suite.
- Verification passed after the refinement: Flutter analyze, focused status/ONLINE tests **29/29**, full Flutter tests **236/236**, Prisma generate/validate, focused backend tests **88/88**, backend build, frontend tests **568/568**, frontend production build, and diff checks. Full backend remains **1,887/1,894 passed** with the same seven unrelated baseline failures.
- No production database or migration action has been taken yet. The additive `onlineSource` migration remains pending until backend deployment is explicitly verified; no P3009 repair or data backfill is allowed.
- Next action: commit and push the feature branch, integrate into main, deploy/verify backend first, then prepare the Android release workflow and signed APK.

# Current task: ONLINE source-selection production release (2026-09-12)

- Fetched latest `origin/main` at `8e912151742029cb4e3da491f61fec33ae370b51`; it contained three newer unrelated Line Chat commits. The stale ONLINE branch had zero unique changes because the reviewed implementation was already present in main. A clean reconciliation branch cherry-picked the original ONLINE commit with conflicts only in append-only documentation; the resolved candidate tree remained identical to latest main, with an empty reconciliation commit `f1b569283886f92f5f8bdbeca7b17f8f1f095fad`.
- Verified Prisma generate/validate, focused ONLINE/nickname/customer-sales backend tests 88/88, backend build, Flutter analyze, focused tagging tests 29/29, full Flutter tests 236/236, frontend tests 568/568, frontend production build, and diff checks. The full backend suite was 1,889/1,896; the same seven unrelated Line Chat/Store Master baseline tests failed, with no ONLINE failures.
- Fast-forwarded and pushed `main` to `f1b569283886f92f5f8bdbeca7b17f8f1f095fad`. Railway production health/readiness and frontend health/download endpoints returned 200. Production reports the deployed main content, and read-only schema verification confirmed `Conversation.onlineSource` is `TEXT` with migration `20260911170000_add_online_source` finished. No P3009 repair, migration resolve, backfill, or production data mutation was performed.
- Prepared Android `1.1.21+41` publication using the existing permanent signing secrets and certificate verification, with the ONLINE source-selection release notes and 2026-09-12 metadata. The workflow publishes the checksum-backed APK and AppRelease/download metadata only after the signed package, version, package ID, and certificate checks pass.
- GitHub Actions workflow `34667358841` completed successfully in 8m31s. It verified the signed package, restored the existing signing material, published the APK, generated the AppRelease migration/download metadata, and pushed generated commit `73a3a0f757a19a8b33956a3b35aef867c57503e2`.
- Railway backend and frontend deployments for the generated release both reached `SUCCESS`. Production `/app/version/android` reports `1.1.21+41`, `forceUpdate=false`, the checksum-backed public URL, and the five requested notes. The migration `20260912090000_release_android_1_1_21` is finished.
- The public APK returns HTTP 200 with Android MIME type, 60,049,046 bytes, and SHA-256 `30a806e507ca0eaafe452aa65cc002006f483b7c32d37f034f4d9b03b2ec0bd5`. Local `aapt`/`apksigner` verification reports package `click.lineoppo.chat`, version `1.1.21`, versionCode `41`, and certificate SHA-256 `e244a89876388b015bbd10abe39326aab15da2e1ec0fe0d6a8248855126af114`.

# Current task: LINE OA reconnect lifecycle production deployment (2026-09-12)

- Isolated the reconnect lifecycle fix from unrelated FILM work, synchronized it onto `origin/main`, and preserved existing active-account uniqueness requirements.
- Production diagnosis found archived Basic ID `@tay5614g` on `LineOfficialAccount` `4ec3806a-c8fd-4a71-8274-29bf50517c12`, attached to active Store `23590`; Store Master `12140` remains correctly mapped to Store `631be61f-d3e8-435a-8942-e71c2d1ff332`. The old row was preserved because it contains historical data.
- Added active-only partial unique indexes, transactional Store archive behavior, reconnect restore/reuse logic, structured duplicate conflicts, active-only Store Master matching, and frontend field-specific error messages. No Channel Secret or Access Token was logged.
- The production database index repair was applied transactionally before deployment. No production rows were deleted or reassigned. A real credentialed reconnect remains intentionally unperformed until the operator supplies credentials.
- Focused backend tests 33/33, webhook tests 30/30, frontend tests 566/566, backend/frontend builds, Prisma validation/generation, changed-file lint, security checks, and runtime health checks passed. The full backend suite remains 1,878/1,884 because of six unrelated Line Chat baseline/regression failures.
- Next action: deploy and verify the backend migration first, then deploy and verify the frontend, followed by the read-only Store `12140` audit.
# Current task: LINE OA / Store / StoreMaster identity integrity deployment (2026-09-12)

- Added a permanently read-only audit for all active STORE LINE OAs covering Store/StoreMaster identity, Basic ID, account name, conversations, archived Stores, Store-level multiplicity, and active Basic/Channel/Destination duplicates. Production before repair: 145 active STORE OAs, 7 Basic-ID/master mismatches, 4 account-name mismatches, one unique Store-code-vs-Basic-ID identity conflict, one Store with multiple active OAs, and zero conversation/archive/active-identifier duplicate violations.
- Confirmed the sole cross-master conflict: OA `17db24a7-a405-4b58-8644-44b344ed38b3` (`OPPO BC Suwinthawong`, `@333yzqqa`) was attached to Store 30968 while Basic ID independently resolves to StoreMaster/Store 23590. OA `afc6ef9d-1dd2-41c8-9668-acb410069e8f` (`OPPO LT Phatthalung`, `@518eaepe`) was correctly attached to 30968.
- Added StoreMaster identity validation and structured `STORE_MASTER_IDENTITY_MISMATCH` conflicts to create/reconnect/update, transactional conversation movement on confirmed update rebinds, Store-level active duplicate checks for create/update/enable/restore, and independent Store-code-versus-Basic-ID sync conflict diagnostics that refuse all conflicting writes.
- Added migration `20260912183000_one_active_store_line_oa_per_store` with a fail-closed production preflight and idempotent `CREATE UNIQUE INDEX IF NOT EXISTS`, allowing Prisma to record the migration without dropping the already-live production constraint.
- Production repair was previously committed in one serializable transaction: changed only OA `17db24a7-a405-4b58-8644-44b344ed38b3`.`storeId` from 30968 to 23590 and aligned its 26 conversations. No credentials, webhook identifiers, Channel/Destination IDs, messages, conversations, or unrelated records were replaced or deleted. The partial unique index is already live; this deployment does not perform another repair.
- Production after repair: `identityConflict=0`, `multipleActiveOaPerStore=0`, `conversationStoreMismatch=0`; active Basic/Channel/Destination duplicate counts are zero. Store 23590 has exactly `OPPO BC Suwinthawong / @333yzqqa`; Store 30968 has exactly `OPPO LT Phatthalung / @518eaepe`. Six non-cross-master Basic-ID/master discrepancies and three normalized account-name discrepancies remain audit-only for separate source verification.
- Pre-deploy verification previously passed: 25/25 focused integrity tests, changed-file ESLint, Prisma validation, backend build, local migration rollback test, backend startup, local health/readiness 200, protected route 401, production health 200, production index-definition inspection, and diff check. Full backend suite: 1,887/1,893 passed; the six failures are pre-existing unrelated LINE Chat baseline failures.

# Current task: StoreMaster canonical identity and CLOSED-state sync safety (2026-09-12)

- Confirmed the unsafe path: existing Store IDs were updated without refreshing `sourceRowNumber`, while new Store IDs used `upsert(source, sourceRowNumber)` and could overwrite whichever historical StoreMaster occupied a reordered Sheet row.
- Replaced row-position identity with source + canonical `externalStoreId`; row number is mutable provenance only. New Store IDs create new rows, ambiguous legacy rows without Store IDs fail closed, and duplicate canonical IDs block all writes.
- Added Status parsing (`blank`/`ACTIVE` active, `CLOSED` inactive), non-mutating preview reporting, and `closedStoreOperationalReview`; CLOSED never archives or deletes operational Stores/OAs.
- Read-only production preview of the configured 160-row Sheet: 159 active, one CLOSED, five creates, zero source/DB Store-ID duplicates, zero identity conflicts, one deactivation, 149 historical row-position overwrite risks, and one operational CLOSED review for Store 31749. Store 17469 is a safe create at current row 8; that row is presently owned by StoreMaster 31933, consistent with the unsafe row-position mechanism, but no audit trail proves the exact historical mutation sequence.
- Focused StoreMaster tests pass 21/21; Prisma validation/generation, changed-file ESLint, and backend build pass. Full backend suite passed 1,913/1,919 with the same six unrelated LINE Chat baseline failures present on main.
- Deployed backend commit `3e23b96` successfully as Railway deployment `0d179d0f-b815-480d-91bb-e24a756d10aa`. Migration `20260912194500_store_master_canonical_identity` finished, the deployment-time canonical sync created all five missing masters, and StoreMaster 31749 became inactive without changing its operational Store or 22 conversations.
- Created operational Store 17469 transactionally from StoreMaster 17469, then passed the full rebind gate and moved only OA `e2ea2991-5e0c-4b80-8b93-c3e50f5f1b64`.`storeId` from 30538 to 17469 in one serializable transaction. Zero conversations existed; Basic ID, credentials, Channel/Destination IDs, webhook key/history, and all three Rich Menu publish attempts remained unchanged.
- Final production audit: Basic-ID/master mismatch 0, identity conflict 0, Store/master mismatch 0, multiple active Store OA 0, conversation mismatch 0, active identifier duplicates 0, and active OA on archived Store 0. Store 30538 has zero active OAs and remains waiting for `@nux7670t`; health/readiness are 200.

# Current task: CLOSED Store lifecycle and Store 31749 (2026-09-12)

- Read-only production preflight confirmed StoreMaster 31749 is `CLOSED`/inactive while its operational Store is still active. Its sole OA `90fecd20-38d0-4a3b-b334-ccdd83ea66f6` is already disabled/archived and retains 22 conversations, 74 messages, 94 webhook events, and no pending Rich Menu, backfill, or nickname work. Three historical Rich Menu attempts belong to the separate Store 17469 repair, not Store 31749.
- Added `StoreLifecycleService` as the canonical transactional close/reopen coordinator. CLOSED archives the Store, disables and archives only active STORE OAs, and terminates queued/running Rich Menu, backfill, nickname, and mass-message work with sanitized `STORE_CLOSED` state. It never deletes credentials, conversations, messages, webhooks, or historical Rich Menu records.
- StoreMaster import invokes closure for every CLOSED row, including repeated imports, and restores only Store operational state on a CLOSED-to-ACTIVE transition. OA activation remains an explicit reconnect action. Normal Store lists, LINE OA create/update/restore, and Rich Menu assignment/publish paths reject inactive StoreMaster identities.
- Focused lifecycle/integrity tests pass 35/35; Prisma validation/generation and backend build pass. Changed-scope ESLint passes for the new lifecycle/controller/test files; the two pre-existing large LINE OA/Rich Menu services retain repository-baseline lint debt. Full backend suite is 1,918/1,924 with the same six unrelated LINE Chat baseline/filesystem failures.
- No production lifecycle mutation or deployment has occurred yet. Next gate: repeat the production preflight, commit and deploy the isolated candidate, then verify Store 31749 closure, preservation counts, global integrity, Store 30538 non-interference, and health/readiness.
- Final preflight at `2026-09-12T08:54:29Z` matched the reviewed state. Commit `9781aeb` was pushed to `main`; Railway deployment `b971be44-6f52-48a5-a227-4b5e68a92c83` reached SUCCESS, Prisma reported 127 migrations and none pending, and startup/health/readiness were clean.
- Deployment-time StoreMaster sync transactionally closed Store 31749 at `2026-09-12T08:59:44.715Z`. Its already-archived OA required no state change. Post-readback preserves 22 conversations, 74 messages, 94 webhook events, 16 historical backfill jobs, and zero Rich Menu assignments/attempts; the Store is absent from the active-list predicate.
- Post-deploy integrity is clean for all identity, Store multiplicity, conversation binding, active identifier duplicate, archived-Store OA, and Store/master checks. Two previously reviewed display-name mismatches remain audit-only. Store 30538's Store/OA binding state is unchanged (active Store, no OA); the standard Sheet sync refreshed only StoreMaster source provenance timestamps.

# Current task: Store 360 BI UI Refresh — Phase 1 (2026-09-13)

- Created isolated worktree `/private/tmp/store-360-bi-refresh` from `origin/main` at `0562ec8` on branch `feat/store-360-bi-refresh`; the main checkout and other feature worktrees remain untouched.
- Reorganized the existing Store 360 view into the approved BI hierarchy: store context and deterministic insight, six KPI cards, Business Performance, Customer Voice, Sales Performance, Response Performance, Team Performance, and a compact Conversation Explorer. Reused the existing authorized-store selector, Bangkok date picker, comparison requests, Customer Voice endpoint, conversation filters, and Store 360 export control.
- Kept metric integrity explicit: the backend exposes only `volumeByHour`, so the UI labels the visualization as an hourly Bangkok distribution rather than inventing a daily trend. Customer Voice coverage is shown as classified versus eligible conversations, with product interest kept separate from sales metadata.
- Added focused UI contract coverage for the hierarchy, responsive layout, current-version coverage wording, no-fabricated trend/comparison values, compact conversation preview, and preserved selector/date/export contracts.
- Verification: focused Store 360 tests **17/17**, full frontend tests **573/573**, changed-file ESLint pass, normal Turbopack production build pass, local frontend `/api/health` and `/store-360` HTTP 200, and no browser console warnings/errors. Full repository lint and TypeScript checks retain unrelated pre-existing baseline failures; the populated dashboard smoke remains blocked by the unavailable local PostgreSQL/NestJS stack.
- No backend, schema, Customer Voice rules, worker, production data, migration, deployment, or external AI changes were made. The local populated-dashboard smoke is pending a local PostgreSQL/NestJS stack; Docker is unavailable on this machine.
- Next action: review this uncommitted isolated candidate, then reconcile against the newest `origin/main` after the separate Customer Voice rollout settles before any integration decision.

# Current task: Store 360 BI — Visual Review (2026-09-13)

- Ran a populated, frontend-only visual review for sanitized Robinson Chonburi context (`28375`) using a temporary localhost fixture outside the repository. The fixture was stopped and removed after review; it had no database, production, external network, PII, raw-message, or LINE-ID access.
- Reviewed desktop 1440px/1280px, tablet 1024px/768px, and mobile 390px states. No horizontal overflow was observed; controls wrap, KPI cards reorganize, and the compact Team/Conversation Explorer row remains readable.
- Found and corrected one obvious visual issue: the Row 3 grid now uses `items-start` so Business Performance is not stretched to the taller Customer Voice card, eliminating excessive empty chart space. No data logic or interaction contract changed.
- Captured populated upper/lower desktop views, Customer Voice Product Interest, Export dialog, tablet, and mobile states inline through the local browser review. Browser console warnings/errors: none. The app remains in the existing dark shell theme, which differs from the light approved mockup but is inherited global shell behavior and was left unchanged.
- Re-verified after the visual correction: focused Store 360 tests **17/17**, changed-file ESLint, and normal frontend production build pass. Full frontend tests were previously **573/573** and remain unaffected; `git diff --check` remains clean. No commit, push, rebase, deployment, or production mutation was performed.
- Next action: user visual approval, then reconcile this uncommitted branch against the newest `origin/main` before any commit or integration decision.

# Current task: Store 360 BI — Focused Visual Alignment Pass (2026-09-13)

- Scoped a light BI workspace token set to the Store 360 `PageContainer` only. The global dark shell/sidebar remains unchanged, while the Store 360 canvas, cards, controls, selector popover, insight, and export dialog now use the approved neutral/navy/green visual treatment.
- Added a small optional `PageContainer` style pass-through used only by Store 360; no unrelated page consumes the new style prop. Removed non-actionable Customer Voice footer affordance and kept the existing real Conversation Explorer and Team details links.
- Strengthened the supported hourly Business Performance presentation with subtle grid lines, explicit `Bangkok time`/hourly-distribution language, and a compact inbound-message legend. No daily trend, metric formula, API, Customer Voice rule, or sales meaning changed.
- Rechecked populated sanitized Robinson Chonburi context (`28375`) through a temporary loopback-only fixture. Reviewed 1440px and 1280px desktop, 1024px and 768px tablet, 390px mobile, Customer Voice Product Interest, store selector, and Export dialog states. All audited viewport and main widths matched; browser warnings/errors: none.
- Verification after the alignment changes: focused Store 360 tests **17/17**, full frontend tests **573/573**, changed-file ESLint pass, frontend production build pass, and `git diff --check` pass. No commit, push, rebase, deployment, or production mutation was performed.
- Next action: stop/remove the temporary fixture, leave this branch uncommitted for user visual review, then reconcile against the newest `origin/main` before any integration decision.

# Current task: Store 360 BI — Final Density Polish (2026-09-13)

- Applied the requested UI-only density polish: compact Store Context and Key Insight, removed the duplicate static period date, preserved the preset/custom-range picker and Export control, tightened Customer Voice, balanced the Business/CV/Sales row, and humanized comparison copy without changing calculations.
- Corrected one capture-visible chart rendering issue by removing the collapsing flex growth from the existing `volumeByHour` chart container; the sanitized Robinson fixture now renders the approved inbound bars.
- Rechecked the populated sanitized Robinson Chonburi context (`28375`) locally at 1440px, 1280px, 1024px, 768px, and 390px. No horizontal overflow, PII, raw messages, or debug overlays were observed.
- Verification: focused Store 360 tests **11/11**, full frontend tests **573/573**, changed-file ESLint pass, frontend production build pass, and `git diff --check` pass.
- Captured the final desktop review asset at `/private/tmp/store-360-bi-final-review/store-360-desktop-full-final.png`. Temporary fixture, frontend, and browser processes were stopped and their temporary scripts removed; no commit, push, rebase, reconciliation, deployment, or production mutation was performed.
- Next action: user visual approval, then reconcile this uncommitted candidate against the newest `origin/main` before any integration decision.

# Current task: Store 360 BI Phase 2B — Customer Voice Drill-down (2026-09-14)

- Added the read-only current-version Customer Voice drill-down endpoint and responsive URL-backed `/store-360/customer-voice` route, including safe evidence, dimension filters, unclassified inspection, pagination, and links from the approved Overview.
- Verification passed: focused Store 360 tests 26/26, full frontend tests 582/582, Store Insights backend tests 46/46, changed-file ESLint, frontend build, backend build, and `git diff --check`.
- Safety audit passed: no classifier, metric, schema, migration, worker, production, or persistence changes; no production calls or writes were made.
- Local HTTP health/functional smoke remains unavailable because port 3000 is owned by an unrelated process and port 3001 is down; no unrelated process was stopped and no fallback port was used.
- Next action: reconcile this local checkpoint against the newest `origin/main` before any integration, authenticated smoke, push, or deployment.

# Current task: Store 360 BI Phase 2B — Customer Voice Drill-down (2026-09-14)

- Started a new isolated worktree `/private/tmp/store-360-customer-voice-drilldown` on `feat/store-360-customer-voice-drilldown` from fetched `origin/main` at `4595cae21fc538795e2f98e570e6c3ba7b1cc7d1`.
- Existing Customer Voice summary, current-version constant, Bangkok eligibility boundaries, approved Overview card, and Phase 2A response architecture were inspected before editing.
- Next action: add the read-only current-version Customer Voice drill-down endpoint, URL-backed responsive route, focused regression coverage, then run the required local checks.

# Current task: Store 360 BI Phase 2A — Response Drill-down (2026-09-13)

- Created isolated worktree `/private/tmp/store-360-response-drilldown` on `feat/store-360-response-drilldown` from `origin/main` at `bb246d60c832407249d1e1eab1d7162e65aee75f`; the primary checkout and other feature worktrees remain untouched.
- Added the read-only `/store-360/response` route and `/store-insights/:storeId/response-cases` endpoint. The endpoint reuses canonical one-case-per-conversation response logic, Bangkok period boundaries, human/bot attribution, cumulative thresholds, authorization, filtering, deterministic sorting, and pagination.
- Wired approved Store 360 response KPIs and response bars to URL-backed drill-down segments. The drill-down preserves the global sidebar, semantic light/dark tokens, safe operational evidence fields, existing `/chats` navigation, empty/error/loading states, and responsive layouts.
- Verified locally with a disposable loopback-only sanitized Robinson Chonburi fixture. No database, production host, worker, AI call, write endpoint, PII, or raw customer message was used. Captured review assets under `/private/tmp/store-360-response-drilldown-review/` in light, dark, unanswered, and mobile-dark states; all are nonblank PNGs and browser console errors were zero.
- Verification: focused backend Store Insights suite **44/44**, focused frontend Store 360 suite **26/26**, full frontend suite **582/582**, changed-file ESLint pass, backend build pass, frontend production build pass, and `git diff --check` pass. Repository-wide backend lint retains unrelated baseline errors outside the changed Store Insights files.
- No Customer Voice rules, Customer Voice v4, schema, migrations, workers, metric definitions, production data, deployment, or push changes were made. Next action: user visual review, then reconcile this unpushed checkpoint against the newest `origin/main` before integration.

# Current task: Store 360 — Full Dark Mode Compatibility (2026-09-13)

- Scoped Store 360 semantic surface, text, border, state, chart, product-thumbnail, and avatar tokens to the canonical `data-theme` system. Removed the page-local light inline token override and preserved the approved light palette.
- Verified the sanitized Robinson Chonburi fixture (`28375`) locally only. Captured light, dark, dark Export dialog, and dark mobile PNGs under `/private/tmp/store-360-dark-mode-review/`. No PII, raw messages, debug overlay, backend, production, or persistence changes.
- Verification: focused Store 360/theme tests **46/46**, full frontend tests **578/578**, changed-file ESLint pass, frontend production build pass, and final screenshot files verified as nonblank PNGs at 1440×1800 and 390×844.
- No commit, push, rebase, reconciliation, deployment, production mutation, worker enablement, Customer Voice rule change, or metric-logic change was performed.
- Next action: user review, then reconcile this uncommitted candidate against the newest `origin/main` before any integration decision.

# Current task: Store 360 BI — Final Visual Fix v2 (2026-09-13)

- Reduced Customer Voice to an Overview card: coverage remains readable, each selected tab shows only the top three ranked items, and the existing topic-to-Conversation-Explorer path now has a real `Explore →` anchor. Removed only the redundant Overview footer note; the underlying data and Sales Performance separation remain intact.
- Final local visual readback: Customer Voice 509.5px, Sales Performance 528.5px, Business Performance 480px; the lower BI row begins at the normal 20px gap after the upper row.
- Captured `/private/tmp/store-360-bi-final-review/store-360-desktop-full-final-v2.png` from the sanitized Robinson Chonburi fixture (`28375`). No PII, raw messages, debug overlays, backend, production, or persistence changes.
- Verification: focused Store 360 tests **17/17**, full frontend tests **573/573**, changed-file ESLint pass, frontend production build pass, and `git diff --check` pass. No commit, push, deploy, or rebase.
- Next action: user visual approval, then reconcile this uncommitted candidate against the newest `origin/main` before any integration decision.

# Current task: Store 360 BI — High-Fidelity Reference Match (2026-09-13)

- Finalized the isolated Store 360 candidate against the approved light BI reference: dedicated Store 360 shell, compact store/insight context, six KPI cards, real daily Bangkok trend aggregation, Customer Voice overview tabs, Sales Performance, Response Performance, Team Performance, Conversation Explorer, and existing Export behavior.
- Recreated the sanitized Robinson Chonburi fixture (`28375`) through a disposable loopback-only server and captured `/private/tmp/store-360-bi-final-review/store-360-desktop-full-high-fidelity.png`. The image is 1440×1571, nonblank, without horizontal overflow, PII, raw messages, or debug overlays.
- Verification: full frontend tests **573/573**, Store Insights tests **14/14**, changed-file ESLint, frontend build, backend build, local health, Store 360 route, and `git diff --check` pass. Temporary fixture, frontend, browser, and runtime dependency-link processes were stopped/removed.
- No commit, push, rebase, reconciliation, deployment, production mutation, worker enablement, or Customer Voice rule change was performed. Next action: user visual approval, then reconcile this uncommitted candidate against the newest `origin/main` before integration.

# Current task: Store 360 — Original Sidebar Restoration (2026-09-13)

- Replaced the dedicated Store 360-only shell with the canonical `AppShell`/`AppSidebar` navigation. The existing global Workspace, Main OA, Tools, Profile, Settings, and Logout structure is reused, and `/store-360` plus `/store-360/*` remain active through the canonical pathname matcher.
- Kept the approved light BI page, date picker, Export control, authenticated user menu, Store 360 content, APIs, metric logic, Customer Voice, and backend unchanged. Removed only the unused route-specific sidebar implementation.
- Added a shell-level option to hide the duplicate global header on Store 360 while retaining the canonical sidebar and mobile navigation. Added a narrow mobile control-stack adjustment to prevent the existing date/export controls from overflowing.
- Local populated review used only a disposable synthetic Robinson Chonburi fixture (`28375`) on loopback. Export dialog opened successfully; Store 360 is the sole active navigation item; no PII, raw messages, debug overlay, production connection, or persistence was used.
- Verification: focused Store 360/shell/export tests **30/30**, full frontend tests **573/573**, changed-file ESLint pass, frontend production build pass, `git diff --check` pass, and no horizontal overflow at 390px, 768px, 1024px, 1280px, or 1440px review states.
- Captured `/private/tmp/store-360-bi-final-review/store-360-original-sidebar-review.png` at 1440×1900. No commit, push, rebase, reconciliation, deployment, or production mutation was performed.
- Next action: user visual approval, then reconcile this uncommitted candidate against the newest `origin/main` before any integration decision.

# Current task: Store 360 Phase 2B — Semantic + Production-Build Interaction Gate (2026-09-14)

- Audited the canonical Customer Voice implementation and confirmed the current-version definition is `customer-voice-rules-v3`; historical v1/v2 rows do not count as current analyzed coverage.
- Added an explicit semantic split between analyzed-but-unclassified and not-analyzed conversations in the read-only drill-down coverage, filters, and evidence provenance. No raw message or payload fields are exposed.
- Reconciled the sanitized Robinson Chonburi fixture: 60 eligible, 53 current-version analyzed, 46 classified, 7 unclassified, and 7 not analyzed. Topic/product fixture distributions are 10/9/9/9/9; intent is 12/12/11/11. Counts are presentation evidence only and are not recomputed in the browser.
- Verified the rebuilt production frontend locally on unused port 3100 against a disposable GET-only loopback fixture on 3101. Search, response, sales, sort, dimension, distribution, clear-value, Unclassified, Not analyzed, and pagination all updated URL state, sent expected API parameters, and rendered filtered results. The query-only App Router path was a no-op in this production runtime, so filter controls now use a narrow native URL navigation fallback.
- Safety boundary remained intact: no production host, database, worker, AI call, migration, or write endpoint was used; fixture requests were GET-only and synthetic.
- Checks: focused frontend **23/23**, full frontend **582/582**, focused backend Store Insights **37/37**, changed-file frontend/backend ESLint pass, backend build pass, frontend production build pass, and `git diff --check` pass. Repository-wide backend tests reported **1926/1932 passed** with six unrelated baseline failures (missing `vitest`, Line Chat health fixture/assertion failures, and manager-relay verification assertions).
- Next action: keep uncommitted and unreconciled; wait for the integration window, fetch the newest `origin/main`, then reconcile before any integration or deployment decision.

# Current task: P0 Production Reliability Investigation (2026-09-15)

- Completed forensic source, production-runtime, production-network, backend, and browser-console investigation before editing. The high-confidence cause is the shared `ApplicationWorkspace` 12-second silent refresh: `loadSupportingData(true)` fanned out `lineOfficialAccountWebhookInfo()` once per 145-account production OA list on every desktop `AuthorizedWorkspace` route.
- Production evidence: 3,044 webhook-info requests in 5m15s for one Chrome cohort; 145-account waves at roughly 12-second cadence; average backend time 215ms and 721ms edge maximum. A clean `/chats` observation produced four waves/580 calls in 40s. Clean `/replymessage` made 2 API calls in 30s; `/store-360` made 6; `/` made 1. The storm stopped after navigation away except for one in-flight wave.
- Runtime evidence: production frontend is Next `next start` on Node 22 with the expected web source commit; no dev/HMR marker, service-worker registration, SSE reconnect storm, 401/403 loop, or console error/warning was observed. Backend's largest repeated shared responses were dashboard analytics 222.5KB, LINE OA list 199.9KB, conversations 177.1KB, and stores 74.3KB.
- Implemented the minimal safe guard in `frontend/src/app/page.tsx`: webhook diagnostics now load only for the store-management section during non-silent initial/manual supporting-data loads; explicit store-management mutations opt in to the same refresh when they use the silent loader. Create/regenerate responses and existing local state updates preserve the user-visible webhook behavior.
- Verification completed: focused regression test **9/9**, full frontend suite **583/583**, changed-file ESLint pass, frontend production build pass, backend production build pass, local built frontend `/` and `/api/health` smoke pass on temporary port 3100, and `git diff --check` pass. Repository-wide frontend lint retains unrelated baseline errors outside the changed files, and standalone frontend TypeScript retains unrelated existing errors; the production build's existing `ignoreBuildErrors` setting is unchanged.
- Authenticated production-mode verification completed on the rebuilt frontend at `localhost:3100` through a disposable loopback counter and local authenticated backend. `/chats` made **26 requests in the first 30s** and **82 in ~127s**; each shared dataset remained at one request per ~12s cycle, `/webhook-info` stayed at **0**, and all observed auth statuses were 200. Existing local `/conversations` and `/dashboard/analytics` 500s were isolated by the harness for the Stores-path check and are not attributed to this change.
- Stores verification completed with the same authenticated session: initial `/storemanagement` made exactly **4** webhook diagnostics for the 4 active local OAs; after ~58s and 5 silent refresh cycles the count remained **4**. Navigation `/storemanagement` → `/chats` added no webhook diagnostics. Source inspection and the focused regression test confirm all existing store-management mutation refreshes explicitly pass `loadApplicationData(true, true)`.
- The route sequence `/chats` → `/replymessage` → `/store-360` → `/` → `/chats` rendered and remained responsive. Browser Performance/Memory/Long Task APIs are unavailable through the current automation surface, so no heap or Long Task values are claimed. No production mutation was performed.
- Reconciled the P0 commit onto `origin/main` at `2092d94`, committed as `4752172b060f23152bcba4c4777ac4440088d65f`, and pushed `main`. Railway frontend deployment `bdc7c238-420e-411b-abeb-068b9b430ab1` completed **SUCCESS**; backend deployment `d5bce8f8-9315-47c5-8cb9-58f9c8c6af37` was correctly **SKIPPED** because no backend files changed.
- Post-deploy authenticated production smoke passed. Clean `/chats` measured **36 API requests in 30s**, **133 in ~2m**, zero `/webhook-info`, zero 401/403, and normal shared polling at ~12s. `/storemanagement` made one expected **145-request** diagnostic wave for 145 active OAs, completed in ~0.53s; the two-minute Stores window remained at **145 total** with no recurring wave. Returning to `/chats` added zero webhook diagnostics.
- The idle authenticated `/chats` soak covered **623s (10m23s)**: **623 API requests**, 52 requests per shared dataset, zero `/webhook-info`, zero 401/403, and only expected 200/304 responses. Production `/`, `/chats`, `/replymessage`, `/store-360`, and `/storemanagement` rendered; browser logs and Railway application logs reported zero errors/warnings. Frontend headers/health and backend health/readiness checks returned 200; backend runtime remained `NODE_ENV=production` on `2092d945`.
- P0 result: **resolved with high confidence** for the measured shared webhook fan-out. The remaining five shared 12-second datasets and request cancellation are intentionally not changed and remain separate follow-up work. No 30-minute soak was attempted because the requested 10-minute production soak completed cleanly and longer observation was not necessary for this narrowly scoped verification.

# Current task: Store 360 Phase 2B — Baseline + Reconciliation Gate (2026-09-14)

- Audited the ten uncommitted Phase 2B files as intended semantic/UI/test/documentation changes; no unrelated changes or fixture files were present. Committed the audited set, then fetched `origin/main` at `ca9e6d35b2906dea91f351bc9318f74f01395731`.
- Reproduced the full backend suite in a separate clean worktree from `origin/main`: **1923/1929 passed**, with six failures. The feature branch reproduced the same six failure categories at **1926/1932 passed**: missing `vitest` in two Line Chat spec files, the Line Chat health baseline assertion, two Line Chat health reconciliation `findFirst` fixture errors, and the manager-relay textarea metadata assertion. Classification: **A — identical baseline failures**; new feature-caused failures: **0**.
- Rebased the feature cleanly onto the fetched `origin/main`; final feature history is two commits ahead of main with no conflicts. The clean baseline worktree remains separate at `/private/tmp/store-360-phase2b-clean-main` for audit evidence.
- Post-reconcile verification passed: focused Store 360 frontend **23/23**, full frontend **582/582**, focused Store Insights backend **37/37**, changed-file frontend/backend ESLint, backend build, frontend production build, and `git diff --check`. Current-version, unclassified, not-analyzed, and historical-version exclusion semantics all remain covered and passing.

# Current task: P1 Shared Dataset Polling — Local Verification (2026-09-15)

- Audited the shared `ApplicationWorkspace` loader and classified its datasets. The safe scope is route-specific: chats needs conversation/BM polling plus full metadata on entry; Store Management needs stores/OAs with a 60-second passive refresh; dashboard keeps its own 60-second analytics/health loader; webhook diagnostics remain explicit and unchanged.
- Implemented the smallest frontend-only change in `frontend/src/app/page.tsx`: route-gated supporting-data loads, a `full` versus `poll` mode, bounded chat polling, 60-second Stores polling, and no shared supporting-data load for unrelated `ApplicationWorkspace` sections. Existing manual and mutation calls retain their explicit webhook opt-in.
- Authenticated local production-build verification passed. Old-build `/chats` measured 33 requests in 30 seconds and 82 in two minutes; corrected post-change `/chats` measured 15 and 29, with zero webhook-info calls. Store Management measured 11 requests in 30 seconds and 13 in two minutes, with exactly one four-account local diagnostic wave and one 60-second stores/OA refresh. Dashboard rendered and refreshed at its existing 60-second cadence without shared dataset calls.
- Repeated `/chats` → `/replymessage` → `/store-360` → `/` → `/chats` navigation remained responsive and produced only expected route-entry requests; no new polling wave started after leaving chats. Existing Store Management webhook mutation opt-in paths were preserved and covered by regression assertions; no mutation was executed.
- Checks passed: focused conversation regression **10/10**, full frontend suite **584/584**, changed-file ESLint with **0 errors** and the existing 16 warnings in `page.tsx`, frontend production build, backend build, and `git diff --check`. No commit, push, deployment, or production mutation was performed.
- Remaining follow-up debt is intentionally unchanged: request cancellation and optimization of the remaining shared datasets. No P1 production deployment is authorized by this task.
- Next action: report the local before/after evidence and leave the working tree uncommitted for user review.
- No Customer Voice rules, Customer Voice v4, schema, migrations, workers, production hosts/databases, production data, or write paths were changed or touched. Push and deployment remain intentionally not performed.

# Current task: Flutter 6-digit PIN authentication — 2026-09-15

- Added additive User PIN fields and a backwards-compatible Prisma migration. Existing employees retain password login; migrated users start with no PIN and no password changes.
- Reused the existing scrypt password-hashing mechanism, mobile session/token issuance, authorization checks, and authenticated Flutter session restore. PIN values and hashes are never returned or logged.
- Added employee-ID PIN login, two-step enrollment, forgot/reset/change/disable management, backend five-failure/15-minute PIN lockout, existing backend rate limiting, and Flutter PIN keypad/dot components with localized states and loading protection.
- Verification completed locally: focused backend PIN/controller tests **14/14**, focused Flutter PIN tests **8/8**, full Flutter suite **276/276**, `flutter analyze`, changed-auth lint, backend build, Prisma validation, and Android debug/release-mode compilation all passed. The full backend suite recorded **1959/1965 passed**; the six failures are the unchanged known Line Chat baseline failures (two missing `vitest` dependencies, one health-baseline assertion, two health-reconciliation fixture errors, and one textarea-metadata assertion).
- Security review confirmed PIN hashes/values are not returned or logged, public PIN login returns a generic failure for missing/ineligible/unconfigured accounts, PIN lockout preserves password access, and the additive migration leaves existing passwords unchanged. No deployment, production data change, or commit was performed. Unrelated Store 360/P1 work and the untracked `docs/executive-guide/` directory remain outside this feature scope.
- Current Android metadata remains package `click.lineoppo.chat`, version `1.1.28+48`. Local debug APK and intentionally unsigned release-mode APK compile successfully; production signing remains CI-only because no local release key is present. Next action: user review and explicit authorization for the normal migration/deployment/release process after the known backend baseline failures are handled.

# Current task: P1 Request Cancellation — Local Verification (2026-09-15)

- Added minimal frontend AbortSignal support in the shared API client and applied lifecycle/superseding-request cancellation to ApplicationWorkspace, dashboard reads, and Store 360 reads. Abort errors are rethrown by the client, ignored by UI error paths, and guarded from stale state writes; polling intervals and webhook diagnostic opt-in behavior are unchanged.
- Authenticated production-build verification used a disposable loopback fixture. `/chats` recorded 15 API requests in the first 30 seconds and 29 over two minutes, including 10 conversations reads and 10 BM-summary reads at the existing ~12-second cadence; `/webhook-info` remained at 0 and browser console errors/warnings remained at 0.
- Repeated rapid navigation through `/chats`, `/storemanagement`, `/replymessage`, `/store-360`, `/`, and back to `/chats` remained responsive and rendered the final route. The fixture recorded no 401/403 or fan-out. Its Next rewrite proxy did not expose upstream abort events, so no server-side abort count is inferred; source guards and cancellation paths are covered by focused regression tests.
- Verification: focused cancellation/regression tests **38/38**, full frontend tests **587/587**, changed-file ESLint **0 errors** with 16 existing `page.tsx` warnings, frontend production build pass, backend build pass, and `git diff --check` pass. Standalone TypeScript still reports unrelated pre-existing errors in dirty PIN/Store 360 changes outside this work.
- No commit, push, deployment, production access, production mutation, polling-cadence change, webhook behavior change, request-cancellation expansion to SSE, or remaining-dataset optimization was performed. Local fixture and frontend processes remain temporary and are to be stopped before handoff.

## PIN authentication backend release waiver — 2026-09-15

The six failures in the full backend suite were reproduced individually in both the PIN worktree and a clean archive of `HEAD` (`c60d26f3d5f363c7dffb87b80ca24e023c1f915a`). No PIN or authentication source change is involved in any failing stack.

| Test | Classification | Failure | Release rationale |
| --- | --- | --- | --- |
| `line-chat-composer-fallback.regression.spec.ts` | ENVIRONMENT/DEPENDENCY FAILURE | The spec imports `vitest`, which is not installed. | LINE Chat test dependency gap; unrelated to PIN. |
| `line-chat-manager-image-relay-worker.spec.ts` | ENVIRONMENT/DEPENDENCY FAILURE | The spec imports `vitest`, which is not installed. | LINE Chat test dependency gap; unrelated to PIN. |
| `LineChat health baseline is created once and historical counts reset to zero` | PRE-EXISTING BASELINE | Fixture observes historical `success: 238`, `total: 238` instead of zero. | Existing health-baseline fixture/data issue; unrelated to PIN. |
| `health reconciliation hides stale pending predecessors when a newer job exists` | PRE-EXISTING BASELINE | Test fixture does not provide `findFirst` for the reset-at lookup. | Existing reconciliation fixture issue; unrelated to PIN. |
| `health reconciliation preserves a latest mapped pending job as actionable` | PRE-EXISTING BASELINE | Test fixture does not provide `findFirst` for the reset-at lookup. | Existing reconciliation fixture issue; unrelated to PIN. |
| `all phase2 manager layouts prefer the same sole textarea primitive as Central World` | PRE-EXISTING BASELINE | Verification expects `metadata.disabled`, absent from the current helper source. | Existing manager-layout assertion mismatch; unrelated to PIN. |

Waiver scope: focused PIN/auth tests pass **26/26**, focused Flutter PIN tests pass **8/8**, and the full Flutter suite passes **276/276**. This waiver records why the six known unrelated failures do not indicate a PIN regression; it does not claim the full backend suite is green.

# Current task: Existing-employee PIN onboarding fallback (2026-09-15)

- Added device-local, fingerprinted employee markers for successful PIN enrollment/login. The marker contains no PIN or PIN hash and is used only to decide whether the PIN keypad is appropriate on this device.
- Employees without a local PIN marker now go directly to password guidance with their employee ID preserved. A successful password login continues through the existing optional PIN enrollment flow; completed enrollment and successful PIN login record the local marker.
- PIN-unavailable/reset/disabled responses show neutral password recovery and clear the stale local marker. Invalid PIN, temporary lockout, connectivity/service failures, and session recovery failures remain separately classified.
- Verification: focused PIN onboarding tests **16/16**, full Flutter suite **284/284**, and `flutter analyze` passed. No deployment, backend change, migration, APK build, or production mutation was performed.
- The pre-existing untracked `docs/executive-guide/` files were left untouched. Next action: review this local candidate and run the normal Android QA/build workflow only after approval.

# Current task: PIN authentication transient-error lifecycle (2026-09-15)

- Audited authentication error ownership. Password login owns the parent `LoginPage` error; PIN entry, PIN setup, and PIN management own separate transient errors. No shared error value is passed between these flows.
- Cleared password transient error and PIN transient error state at every authentication-mode handoff, including PIN-to-password fallback, password-to-methods/PIN, and forgot-PIN recovery. Employee ID and PIN guidance remain intact.
- Added regression coverage for unavailable PIN, network/wrong PIN fallback, password-only errors, returning to sign-in methods, password-to-PIN fallback, and successful authentication.
- No backend, migration, deployment, release, or unrelated UI changes were made for this fix. The untracked `docs/executive-guide/` files remain untouched.

# Current task: Long-lived Flutter mobile session restoration (2026-09-15)

- Audited the existing authentication/session architecture before editing. It already persists the mobile access token, rotating refresh token, and both expiry timestamps together in Flutter Secure Storage under `mobile_credentials_v2`; no PIN, password, or hash is stored on-device.
- Confirmed the existing backend policy: access sessions last 12 hours; mobile refresh sessions last 30 days from session creation as a bounded, rotating refresh window. Refresh rotation preserves the original refresh expiry rather than silently extending it. No expiry policy or backend endpoint was changed in this task.
- Confirmed app relaunch/process restart restoration uses `/auth/me` with transparent refresh, temporary storage/network/server failures preserve credentials, and terminal refresh rejection/disabled-account responses clear the session through the canonical expiration path. Background/inactive lifecycle states do not clear auth or PIN state; resume performs a best-effort authenticated refresh.
- Added explicit regression coverage for password and PIN login credential persistence across a new `TokenStore`, logout clearing access/refresh credentials while preserving the device-local PIN marker, and lifecycle safety during non-resumed states. Biometric authentication remains paused and was not implemented.
- Verification: focused auth/session/startup/PIN tests **45/45**, full Flutter suite **294/294**, `flutter analyze`, Android debug APK build, and `git diff --check` passed. No backend source, migration, deployment, commit, push, or production mutation was performed.
- Expected behavior: a valid session restores directly to the app without a PIN prompt; offline/temporary startup failures show retry while retaining secure credentials; explicit logout revokes/clears the mobile session but leaves the PIN routing marker for the next sign-in. After the bounded 30-day refresh window expires, reauthentication is required.

# Current task: Public PIN authentication release — 2026-09-15

- Published Android `1.1.29+49` from main through GitHub Actions run `34954009264`; the signed release payload commit is `9c6a7714631c12008cb19c2c948d0904b7a75937`.
- Existing CI production signing material was used. The public APK verifies as package `click.lineoppo.chat`, version `1.1.29`, build `49`, with the established production certificate; SHA-256 is `1d7f5a5122480c76f9fea0b661b2b1ac88752de025d54d3f42794eb13d770569`.
- Backend migration `20260915170000_release_android_1_1_29` applied through the normal Railway pre-deploy path; production `/health` and `/health/readiness` are healthy. Public `/app/version/android` reports build 49 with `forceUpdate=false`.
- The production frontend deployment completed successfully and the public APK URL returns HTTP 200 with a matching checksum. No forced logout, manual migration, manual deploy, replacement signing key, or unrelated-file cleanup was performed. The untracked `docs/executive-guide/` directory remains untouched.

# Current task: LINE Chat persistent Chromium profile lifecycle (2026-09-16)

- Root-cause assessment before editing: the coordinator lease ends after `context.close()` resolves, but Chromium can retain its `SingletonLock`/`SingletonSocket`/`SingletonCookie` briefly. The next operation can therefore acquire the coordinator lease while Chromium still considers the profile owned. noVNC and the two manager relay workers also launched persistent Chromium directly, bypassing the shared session-service lifecycle.
- Scope guard: preserve coordinator priorities, LINE mappings, nickname formatting, tagging, product logic, profile paths, and authenticated profile contents. No profile cleanup, re-login, forced nickname run, or bulk backfill was authorized.
- Implemented a shared `LineChatSessionService` managed persistent-browser lifecycle with bounded `500ms/1s/2s` launch retries, a `4s` post-close singleton-release wait, structured sanitized busy/retry logs, and `PROFILE_BROWSER_BUSY` retryable classification.
- Added conservative singleton recovery: only a readable same-host `SingletonLock` symlink with a definitively dead numeric PID is recoverable; only the three singleton artifacts may be removed, while live, remote, unreadable, and ambiguous locks remain busy. Coordinator leases remain authoritative.
- Routed session operations, noVNC recovery, and manager text/image relays through the managed lifecycle. Nickname work defers profile-browser contention as `PROFILE_OPERATION_BUSY` without changing session authentication state or permanently failing the job. Health classification reports contention as `DEGRADED/PROFILE_LOCK`, never `AUTH_REQUIRED`.
- Added lifecycle regression coverage for normal launch, transient lock retry, unrelated errors, release waiting, live/uncertain ownership, stale recovery preservation, and persistent busy behavior; added noVNC routing, health classification, and nickname deferral assertions.
- Verification passed: production TypeScript build check, focused affected suite **83/83**, changed-file ESLint, `npm run build`, and `git diff --check`. Docker PostgreSQL was healthy; with `DEV_ADMIN_ENABLED=false`, the backend started on canonical port 3001 and `/health` plus `/health/readiness` returned **200**. The backend was stopped cleanly after verification.
- Full backend suite remains at **1967/1973 passed** with the six known unrelated baseline failures: two missing `vitest` dependencies, one health-baseline data assertion, two health-reconciliation fixture errors, and one manager-layout metadata assertion. Full-repository lint remains a pre-existing baseline failure (722 errors, 2 warnings) outside this change; changed-file lint is clean.
- Production safety: Railway read-only migration status reported **137 migrations found; database schema is up to date**. The normal backend pre-deploy migration/sync completed successfully; no production schema or data mutation was introduced by this feature. The local failed migration remains untouched.
- Delivery: commit `567ef3a54eb44058da4b46745fa605b23d5700df` was pushed to `main`. Application CI run `35076097372` passed Frontend, Android, Backend, and CI Gate. Backend deployment `967ce0b9-5bd2-4e86-b693-6e0a4f261e6a` and nickname-worker deployment `8e491017-da1e-4b2c-9a3f-541ee027c5dd` completed successfully with running instances.
- Post-deploy validation: production `/health` and `/health/readiness` returned **200**. Profile B / RBS Chonburi remained `ACTIVE`/`CONNECTED`, last health HTTP 200, zero consecutive health failures, and no singleton artifacts remained in the deployed worker container. The single normal UI noVNC attempt returned retryable `PROFILE_BROWSER_BUSY`; it did not open a noVNC session, trigger `AUTH_REQUIRED`, or require re-login.
- Post-attempt logs showed one bounded Profile B busy/retry sequence (`500ms/1s/2s`) and one conservative `REMOTE_OR_UNKNOWN_OWNER` decision, with no stale-lock recovery, no raw `launchPersistentContext`/ProcessSingleton errors, no repeated crash loop, no permanent nickname failures, and continued successful Profile B relays. No natural nickname update occurred, so no HTTP 200 nickname mutation was forced or fabricated.
- Next action: monitor normal production operation. The pre-existing untracked `docs/executive-guide/` directory remains untouched; the post-deploy progress update is intentionally uncommitted and contains no secrets or raw logs.

# Current task: LINE Chat independent browser availability observability (2026-09-16)

- Inspected the existing `LineChatProfileOperationCoordinator`, database-backed `LineChatProfileOperationLease`, health summary/controller, API contract, and health page before editing. No lifecycle, coordinator priority, retry/backoff, stale-lock, profile path, mapping, nickname, schema, migration, or production behavior was changed.
- Extended the read-only health summary with `browserState`, `browserOperationKind`, and `browserBusyUntil`. The existing lease query remains the source of truth: `leaseUntil > now` is BUSY with safe operation metadata; expired or absent leases are AVAILABLE. `ownerToken` is not selected or returned.
- Updated the health table and selected-profile card to display Session/authentication health, Browser availability, and overall Health independently. BUSY is amber, shows a readable operation label and temporary auto-retry guidance, and does not alter CONNECTED or AUTH_REQUIRED semantics. Added the requested Thai help copy and a restrained 30-second page refresh so lease release is visible without manual refresh.
- Centralized browser-state and operation-kind labels in the health-status helper. No persisted recent stale-lock event was available, so no historical recovery indicator was added.
- Verification: focused backend operations tests **9/9**, focused operations-auth tests **2/2**, focused frontend LINE Chat health tests **11/11**, full frontend suite **589/589**, changed-file backend/frontend ESLint pass, backend build pass, frontend production build pass, and `git diff --check` pass. Standalone repository typechecks retain pre-existing errors; the changed health/API/status/test files are clean under the focused typecheck scan. While verifying, corrected the pre-existing health-page retry call to match the current API payload/result contract; retry policy was unchanged.
- Runtime gate: canonical backend compilation reached **0 errors** and route registration included `GET /operations/line-chat-nickname/health`, but application bootstrap stopped on the pre-existing local Prisma mismatch (`User.pinHash` is absent from the local database). Docker/PostgreSQL was unavailable, and port 3000 was occupied by an unrelated process, so no backend health response or frontend browser smoke was claimed; the backend watch process was stopped cleanly.
- No database migration or production access was performed during local verification. The pre-existing untracked `docs/executive-guide/` remains user-owned and untouched; the focused patch is ready for the authorized commit, push, CI, and deployment flow.
- Local runtime verification remains blocked until the canonical PostgreSQL service is healthy and port 3000 is available; this is an unrelated local-environment baseline issue and will not be changed as part of this task.
- Delivery: focused commit `740a9cbaccd749552946810e4f27c4f20ee9d3fc` was pushed to `main`. Application CI run `35078908458` passed Backend, Frontend, Android, and CI Gate. Production deployments completed successfully for backend `2f1ed02a-79db-401c-a595-5ac3d65cb274`, frontend `65110162-eb9b-4a98-baeb-fdcbb3e50c8d`, and the shared-source nickname worker `a21c9996-2ab0-4d93-ac92-ae57cdc3786a`; no mobile release or unrelated worker deploy was initiated.
- Production safety: read-only `prisma migrate status` reported **137 migrations found; database schema is up to date**. The normal deployment path handled startup; no migration, profile data change, profile operation, backfill, or manual deploy was performed.
- Post-deploy validation: backend `/health` and `/health/readiness`, frontend `/api/health`, and the authenticated Health page returned successfully. The reloaded page rendered the independent Session/Browser/Health fields and Thai help copy. Profile B / RBS Chonburi showed `ACTIVE`, `CONNECTED`, `AVAILABLE`, and `Healthy`, with zero active leases; the read-only response-shape audit selected only session, operation-kind, and lease-expiry metadata and found no `ownerToken`. The page body exposed no owner identity, cookies, CSRF/token, customer ID, LINE ID, or profile path fields, and browser console logs were empty.
- Browser-state observation: natural production activity did not produce an active lease during the observation window. The single authorized noVNC diagnostic returned retryable `PROFILE_BROWSER_BUSY` without opening a session or changing authentication; the follow-up audit remained `CONNECTED`/`AVAILABLE` with zero leases, so no release transition was applicable. Production request logs showed a steady 30-second health refresh cadence after the expected initial duplicate, all successful.
- Production logs showed no new auth, lock, Chromium, API, frontend, database, crash-loop, or permanent nickname errors attributable to this patch. Existing background identity-mapping/waiting-for-mapping warnings and standard npm/Prisma deprecation warnings remained outside this change. The post-deploy progress update is intentionally uncommitted and contains no secrets or raw logs; `docs/executive-guide/` remains untouched.

# Current task: TokCounter TikTok Public Daily Collector & Follower Snapshot Engine (2026-09-16 / 2026-09-17)

- **Schema & Migrations (Migration 138)**:
  - Created `TikTokPublicAccount` model (`id`, `username UNIQUE`, `displayName`, `profileUrl`, `source`, `firstSeenAt`, `lastCollectedAt`).
  - Added `StoreMaster.tiktokPublicAccountId` foreign key (`onDelete: SetNull`) to link retail stores with TikTok accounts, supporting N:1 shared handles (e.g. `o_taweekitburiram` mapped to both Store 27837 and Store 27368).
  - Modernized `TikTokPublicDailyMetric`: linked to `tiktokPublicAccountId` with unique index `@@unique([tiktokPublicAccountId, metricDate])` and removed legacy `statsV2` check constraints.
  - Successfully migrated production database via `prisma migrate deploy` (138 migrations applied).
- **Google Sheet Master Catalog Reader**:
  - Implemented `backend/scripts/tiktok-public/sheet-reader.mjs`: parses official Google Sheet1 CSV, handles hyphens in usernames (e.g. `o-themallthaphra`), strips `@`, and maps duplicate store groups cleanly.
  - Verified catalog: 160 store rows, 151 with TikTok, 150 unique handles, 1 duplicate store group, 9 blank/invalid rows.
- **TokCounter Playwright Extractor**:
  - Implemented `backend/scripts/tiktok-public/tokcounter-extractor.mjs`: headless Chromium automation.
  - Strict identity verification: matches exact `@<username>` DOM node.
  - Accurate rate limit classification: detects 403 Forbidden / 429 and flags `RATE_LIMITED` instead of falsely reporting `PROFILE_NOT_FOUND`.
  - Network route aborting: blocks unneeded third-party advertisements, trackers, and background boosted accounts (`azhar_baby_`, `tanviraa..1`) to cut outgoing API calls to `tiktok-api.tokcounter.com` by 66%.
  - Two-read stabilization loop with live jitter tolerance ($\le 20$).
- **Daily Collector Runner & Daemon**:
  - Implemented `backend/scripts/tiktok-public/run-daily-collector.mjs`: lock manager (`local-data/tiktok-public-daily.lock`), durable state (`local-data/tiktok-public-daily-state.json`), scrubbed logger, idempotent date resumption (skips already collected accounts for the day unless `--force` is used), and exponential backoff retry on `RATE_LIMITED`.
  - Shell runner `backend/scripts/tiktok-public/run-local-daily.sh` executable.
  - Installed and validated launchd plist `~/Library/LaunchAgents/com.oppo.tiktok-public-daily-collector.plist` scheduled for 01:30 Asia/Bangkok, loaded and verified via `launchctl bootstrap gui/$(id -u)`.
- **Backend Analytics Service**:
  - Updated `backend/src/tiktok/tiktok-public-analytics.service.ts`: `listDashboardStores()`, `getStoreDashboard()`, and `getStoreHistory()` query `StoreMaster` linked to `TikTokPublicAccount` and `TikTokPublicDailyMetric`.
- **Unit Testing & Compilation**:
  - Added native test suite `backend/src/tiktok/tokcounter-collector.spec.ts` (22/22 passed).
  - Full TikTok unit test suites: **35/35 passed (100%)**.
  - Backend build `npm run build` compiled with 0 errors.
- **Production Baseline Persistence**:
  - Successfully persisted 74 accounts and daily snapshots into PostgreSQL production database on 2026-09-16.
  - Identified TokCounter IP rate-limiting on unauthenticated public API after high-volume sequential requests; implemented rate limit backoff and route aborting to protect future collector runs.
- **Railway Cron Recommendation**: Keep Railway `tiktok-daily-metrics-cron` enabled; it services private OAuth-bound accounts while local launchd handles public profiles.

# Current task: Black app outbound reply state reconciliation — 2026-09-18

- Reproduced the stale-state behavior in the outbound realtime contract: the text/image/PDF send paths persisted `REPLIED`, then published `message.created` from the pre-send conversation snapshot, so Flutter could overwrite the fresh header/list state with `NOT_REPLIED` and no owner. The legacy owner gate also skipped assignment when the conversation had no post-2026-08-29 inbound message.
- Traced all black-app send paths: text `/mobile/conversations/:id/messages` delegates to `ConversationsService.sendMessage`; image `/images` and the shared PDF `/pdfs` path use the same service/domain state transition; video `/videos` and the LINE OA Manager PDF path have their own persistence transactions. All successful staff outbound paths now share `persistStaffOutboundReplyState`; retry/idempotency paths reconcile already-persisted messages before returning success.
- The shared transition persists `Message.senderUserId`/`senderDisplayName`, `Conversation.bmReplyStatus=REPLIED`, `Conversation.followUpStatus=COMPLETED`, `Conversation.latestMessageAt` (the existing reply timestamp equivalent), an activity actor record, and conditionally sets `Conversation.ownerUserId` only when it is null. Existing owners are protected by the transactional `updateMany` predicate. No `repliedAt` or `repliedByUserId` columns exist in the current schema.
- Realtime outbound events now carry `REPLIED` and the effective owner. Flutter keeps the immediate local update and performs a best-effort canonical detail refresh after a successful send so the chat header converges even if an event is missed.
- Regression coverage added/updated for stale realtime status, actor attribution, first-reply assignment including legacy conversations, existing-owner preservation, idempotent retry reconciliation, failed LINE delivery, inbound reset-to-`NOT_REPLIED`, and Flutter canonical header refresh. Customer inbound and system/bot flows do not call the staff transition.
- Verification passed: affected backend tests **77/77**, full Flutter suite **300/300**, `flutter analyze`, Android debug APK build, changed-backend-file ESLint, backend build, and `git diff --check`. Full backend suite remains **2044/2053 passed** with 9 unrelated baseline failures in auth/LINE-chat health and manager-relay tests; repository-wide lint remains a pre-existing baseline failure (737 errors, 2 warnings), while changed backend files lint clean.
- Runtime health was attempted through `npm run dev:status` and `npm run health`, but Docker PostgreSQL is unavailable, backend port 3001 is free, and port 3000 is occupied by an unidentified process. No service was force-killed or started on a fallback port. No production migration, deployment, or production data mutation is required or was performed.
- Existing unrelated worktree changes, including `docs/executive-guide/` and Google review tooling, remain untouched. Next action: review/commit through the normal authorized workflow; do not deploy until this patch is approved.

# Current task: Rollout Readiness — Worker Restart / Lease Recovery Canary

- Added an exact-gated, worker-only pause hook immediately after successful Manager send-action persistence and before durable `DELIVERED` persistence for the authorized Test B text. The hook logs only job/message/conversation/attempt IDs and `sendActionAt`, then waits without calling `process.exit`.
- Added focused coverage for the exact gate, post-send/pre-delivery ordering, expired `PROCESSING` recovery to `VERIFY_PENDING`, verification-only recovery, no resend, one attempt, and unchanged `attemptCount`. Focused tests passed **24/24**; changed-file ESLint, backend build, and `git diff --check` passed.
- Deployed the worker-only hook image successfully as Railway deployment `fed0ef43-64a7-4c83-a8da-e7203cfb8e92`, then restarted the same image with the pause flag as deployment `a1e86992-fac5-49f6-aeb5-f3d9117cf3dc`; both completed successfully and the prior worker was replaced. The live worker reports health 200 and a start time after the restart.
- Live worker and backend processes report durable queue enabled, store allowlist `28375`, exactly the two authorized Test A/Test B conversation IDs, and the old pre-send failure flag absent. The pause flag is present only in the live worker runtime. Backend deployment `634a1907-7255-4465-a3ae-7c616a23eb95` remains healthy; public health/readiness and local worker health returned 200.
- Read-only preflight passed: Manager OA is `OPPO BS RBS Chonburi`, Manager exact-text baseline for `INTERNAL WORKER RESTART B 001` is **0**, global active durable jobs are **0**, Test A/B/Max snapshots are unchanged, and Max/non-authorized recent traffic is **0**. Profile B is `ACTIVE`/`CONNECTED` with HTTP 200 health.
- No customer-facing message has been sent and the Android emulator has not been touched for this canary. Next action: await explicit approval before sending the single Test B message.


## 2026-09-21 — Project B: 7-store mirror-only production cutover

- User announced that the seven LINE chat pilot stores will stop using the black app and return to LINE OA Manager as the customer-facing source of truth.
- Added an explicit `LINE_CHAT_MIRROR_ONLY_STORE_CODES` kill-switch allowlist.
- Black-app conversation sends (text, failed-message retry, image, PDF) now fail closed for mirror-only stores before any LINE transport is attempted.
- Durable Manager queue creation also fails closed for mirror-only stores.
- Durable send worker terminalizes already queued/verify-pending jobs for mirror-only stores before any customer-facing send action.
- Existing Project B read-only mirror remains the data-capture path. Production activation will use the same seven store codes and preserve Manager as source of truth.
- Added mirror-only cutover regression coverage and CI lint/test steps.
- Required verification before completion: PR CI green, backend build/smoke green, production backend + line-chat worker deploy green, readiness healthy, mirror worker running, and no mirror-only send jobs initiating customer-facing sends.

- Post-deploy validation found 6 legacy `UNKNOWN` mirror rows at store 28375. New production events were already classified correctly (`message` => INBOUND), so this was a rollout-race residue from the old worker between DB migration and worker replacement. Added per-store self-healing that reclassifies legacy `UNKNOWN + eventType=message` rows to INBOUND before each mirror cycle, preventing the same residue after future staggered deploys. This repair is limited to the Project B shadow table and never mutates canonical conversation messages.


## 2026-09-21 — Multi-store LINE OA Broadcast

- Added an HQ Broadcast workspace modeled on LINE Official Account Manager, exposed at `/broadcast` while keeping the existing `mass-messages` authorization boundary and legacy route compatibility.
- Added official LINE broadcast delivery for All friends and narrowcast delivery for Friendship period targeting. Friendship buckets map exactly to LINE demographic filters; the approved 180–364 + 365+ selection normalizes to `subscriptionPeriod >= day_180`.
- Broadcast execution is isolated per LINE OA/store with stable retry keys, per-store delivery state, scheduled dispatch, narrowcast progress reconciliation, failed-store-only retry, and no fallback from targeting to All friends.
- Added preflight readiness using connected OA/token state and latest follower snapshot. Friendship targeting blocks stores whose known Target reach is below 100 and surfaces stale/unknown reach as warnings.
- Message composer supports up to five text/image LINE message objects. Existing protected image upload is reused. Unsupported LINE Manager content controls are visible but disabled rather than pretending to be operational.
- Added draft persistence and campaign history. The LINE Manager-style “Send test” control is intentionally disabled because Messaging API does not expose OA-manager test recipients; production sending never guesses a test user.
- Added database migration for official broadcast audience types and scheduled campaigns, plus focused backend targeting and frontend UI regression coverage.
- Next gate: Application CI + Unified Auth CI, then production deploy and health/readiness verification.


# Current task: Big Project A — A1 Historical Backfill discovery gate (2026-09-23)

- Created local branch `feature/a1-historical-backfill` in a separate worktree based exactly on deployed production `main` commit `6b00540f109d4edca3fa23360c4f0999c7c77369`. The existing `mirror-chat-runtime-debug` worktree and its unrelated uncommitted files were left untouched.
- Read-only Railway check: LINE worker deployment `c4fbcb1c-e420-4ec5-bdc1-22f0068e1c95` is `SUCCESS`. In the sampled `05:50:27–05:56:59 UTC` logs, 55 Mirror store cycles completed successfully across all 16 configured store codes; 96 reconciliation completion events covered those stores; no database-connectivity, Chromium-launch, or reconciliation-failure event appeared in the sample. Six history-shape summaries recorded 25 histories and 185 events: 171 text, 11 image metadata, 3 sticker metadata. The current counter records upsert attempts and does not distinguish inserted/updated/deduplicated rows. Last-hour worker metrics: CPU average/max `0.225/0.525`, memory average/max `0.636/0.867 GB`, disk `0.573 GB`.
- Source audit: live Mirror reads the natural v2 chat-list GET with `limit=25`, capped at 5 pages/125 chats. Full `discoverChats` requests up to 200 pages/10,000 chats and stops only on a terminal token; cap, malformed pages, or conflicting duplicate IDs produce a partial result. Current parser expects `next` to be a string and sends it as `next` on subsequent requests. A September 1 diagnostic record and its report fixture instead describe `next` as an object with `hasMore`/`cursor` and a second-page `cursor` query. The current Railway cycle logs do not expose the live response envelope or page progression, so this discrepancy remains unresolved.
- Source audit: Manager history is a single `GET /api/v3/bots/{botId}/chats/{chatUserId}/messages` per selected conversation, with no query/body cursor parsing or older-page request. It accepts `body.list`, uses each event's `timestamp`, and does not compute page bounds or sort messages. The page size, backward cursor mechanism, and terminal condition are unknown. Mirror message identity is the unique `[lineOfficialAccountId, managerMessageId]`; upserts are idempotent, but current counters do not distinguish inserts from updates/deduplications.
- `historySyncedThroughAt` is written to the chat-list `lastMessageAt` after one history response. Current status/pending logic treats that value as current coverage. The chat model has `lastHistorySyncedAt` but no per-conversation historical cursor, lower-bound progress, or backfill state. A safe resumable engine will likely need additive persisted checkpoint fields once the actual paging contract is known; touching this marker alone would also change live pending selection and risk repeated history fetches.
- Browser evidence is blocked: the existing `chat.line.biz` tab reports an expired session; the Manager account page returned `401 Unauthorized`. I did not activate a pilot account or run any backfill, and no production data or configuration was changed. The pilot's live message-history request/response remains uncaptured.
- Focused existing discovery tests passed **24/24**. The test was run from this isolated worktree with existing local dependencies; the sandbox initially blocked `tsx`'s IPC socket, so the explicitly requested check was rerun with the allowed local socket access. No implementation, schema migration, lint, or build was performed because the live pagination contract is still an implementation gate.
- Next action: reauthenticate in LINE OA Manager for an approved pilot store (preferably Central Pinklao `29113`) and leave a conversation with enough history open. Then capture only sanitized request/query names, response keys, per-page event counts and timestamp bounds, duplicate counts, and termination behavior before choosing the backfill/checkpoint design.
- Progress: A1 **12%**, A2 **0%**, A3 **15%**, A4 **10%**, A5 **5%**, A6 **0%**, A7 **35%**, overall **11%**. Live Mirror **16/16** in the sampled window; pilot backfill **0/3**; stores proven to Sep 1 **0/3**; earliest timestamps **unknown for all three**; conversations processed **0**; messages observed/inserted/updated/deduplicated **0**; backfill errors **0 runs**; sampled live Mirror and reconciliation failures **0**.


## 2026-09-23: A1 authenticated UI capture — partial evidence only

- The authenticated LINE Manager tab now shows OPPO Central Pinklao and the exact target conversation. Inspection was read-only: no messages were sent and no customer/account data was changed.
- History pane: natural upward scrolling reached `scrollTop=0` after three upward actions. The pane stayed at 2,859 px with the same three loaded date markers (`Aug 14`, `Aug 15`, `Sep 10`). The Manager UI displays its six-month history notice. This does not prove a server-side terminal condition or reveal whether older pages exist.
- Chat list: natural scrolling exposed three additional batches of 25 accessible chat rows (102 → 127 → 152 → 177); the DOM anchor count rose by 50 per batch. This confirms UI-driven list loading but not the response envelope, continuation field/type, request parameter, or terminal rule.
- Network evidence is blocked by the current CUA browser surface: it exposes page DOM and console logs but no request/response events or bodies. Opening the native DevTools shortcut affected the currently foreground YouTube window, not the target Manager tab; that panel was closed. A temporary duplicate Manager tab was closed. The original tab was returned near its initial scroll position and preserved for handoff.
- No implementation, migration, production data write, pilot enablement, push, or deployment was performed.
- Next action: bring the exact authenticated Manager tab to the foreground in native Chrome so DevTools Network can attach to that target, or provide an approved request/response capture mechanism. Then capture sanitized history and chat-list request/response metadata before designing code.
- Progress remains A1 **14%**, A2 **0%**, A3 **15%**, A4 **10%**, A5 **5%**, A6 **0%**, A7 **35%**, overall **11%**.

## 2026-09-23: A1 updated from supplied verified production history evidence

- User supplied verified evidence for the Central Pinklao pilot: the live v3 history request returned HTTP 200 with no initial pagination query, response keys `list` and `backward`, and an opaque string `backward` value. The response had 44 events spanning `2026-08-14 09:54` to `2026-09-10 13:55` Asia/Bangkok, crossing the Sep 1 lower bound in its first response. Scrolling to the top did not trigger another history request; backward request mechanics and termination remain unproven.
- This establishes endpoint, initial response shape, one-conversation Sep 1 reachability, and continuation-token existence. It does not establish that the pilot can force another page.
- The current browser inventory includes two other LINE Chat tabs, but their store mapping and initial response metadata have not been established. The available CUA surface still exposes DOM and console logs without HTTP request/response capture. No candidate meeting both `oldest > 2026-09-01T00:00:00+07:00` and `backward present` is verified yet.
- No code, migration, pilot, production data, rollout configuration, push, or deployment was changed. Next action is to capture only initial-page metadata for a high-volume conversation at another configured Mirror store, then stop once a qualifying candidate is identified.
- Progress: A1 **18%**, A2 **0%**, A3 **15%**, A4 **10%**, A5 **5%**, A6 **0%**, A7 **35%**, overall **12%**.

## 2026-09-23: A1 Sep 1 fast-path implementation prepared locally

- **Scope**: Implemented a first-response-only historical backfill path for the verified lower bound `2026-09-01T00:00:00+07:00`. The history request adds no pagination parameter, detects only whether a non-empty `backward` string exists, and never persists or logs its value.
- **Classification**: A page whose oldest valid event is at/before the bound becomes `FAST_PATH_COMPLETE`. A newer page with `backward` becomes `NEEDS_BACKWARD_PAGINATION`; a newer page without it, an empty response, or a response with no valid event IDs/timestamps becomes `HISTORICAL_COVERAGE_UNPROVEN`. No continuation request is made.
- **Checkpoint migration**: Prepared additive nullable columns on `LineChatMirrorChat`: `historicalBackfillStatus`, `historicalBackfillLowerBoundAt`, `historicalBackfillOldestAt`, `historicalBackfillNewestAt`, `historicalBackfillLastAttemptAt`, `historicalBackfillLastSuccessAt`, `historicalBackfillBackwardRequired`, and `historicalBackfillErrorCode`. Existing rows remain `NULL`/unprocessed; no backfill or destructive rewrite runs during migration. Also added the `HISTORICAL_BACKFILL` lease kind. Safe rollback is to disable the flag and roll back code; the additive fields/enum can remain unused without changing existing records.
- **Live priority and pilot limit**: `LINE_CHAT_HISTORICAL_BACKFILL_ENABLED` defaults off. When explicitly enabled, history runs only for stores `29113`, `28375`, and `25610`, after the configured live-store pass, only when that store's live result is `SUCCESS`, and at most one conversation per pilot store per cycle. It uses the shared profile coordinator at priority 10 (live Mirror is 25) with non-blocking acquisition; busy profiles are deferred. The 16-store live list is unchanged.
- **Persistence and metrics**: Valid events retain Manager IDs/event types/direction/timestamps/biz IDs/staff owner names and metadata. Only text-type bodies are saved as text; non-text/event-only rows remain metadata and `chatRead` stays direction `UNKNOWN`. Auto responses remain marked by `bizId=__AUTO_RESPONSE` and never receive staff owner attribution. Message upserts remain unique by `[lineOfficialAccountId, managerMessageId]`. Logs count response events, valid events, upsert operations, IDs already present before writing, timestamps, retries, outcomes, and live status; insert-vs-update is not claimed.
- **Verification**: A1's 17 focused cases plus mirror/coordinator regression tests passed **32/32**. Touched-file ESLint passed. Prisma schema validation passed with a non-routable local placeholder URL. Backend `npm run build` passed. `git diff --check` passed in the final review. No production read/write, migration, enablement, push, or deploy occurred. The local app health smoke was not run: port 3001 had no listener and Docker DB inspection was denied by the local Docker socket permission boundary; no unknown or production database URL was used.
- **Next gate**: Review the final diff, repeat `git diff --check`, then stop for explicit push/production authorization. After that gate, apply the migration before enabling the flag, pilot only on the three approved stores, and verify stored rows/canonical reconciliation using read-only checks. Historical conversations still marked `NEEDS_BACKWARD_PAGINATION` remain incomplete until real request semantics and termination are captured.
- **Progress**: A1 Historical Backfill Engine **45%**, A2 Historical Data Validation **0%**, A3 24h Reply KPI **15%**, A4 Nickname / Rename Status **10%**, A5 All-Store Eligibility **5%**, A6 All-Store Rollout **0%**, A7 Production Stability **35%**, Overall Big Project A **16%**. Production pilot processed **0/3**; no Sep 1 production coverage is yet claimed for any pilot store.

## 2026-09-23: A1 event-only timeline identity correctness patch — local only

- **Root cause**: the historical parser required `message.id` or top-level `id`; production-shaped `chatRead`, `follow`, and `unfollow` events may have neither, so they were counted invalid and could not be persisted or contribute timestamp evidence.
- **Schema review**: `LineChatMirrorMessage.managerMessageId` is a required Prisma `String`, uniquely constrained with `lineOfficialAccountId`; PostgreSQL text has no restrictive identity length. Existing `eventType`, nullable `messageType`/`text`, `direction`, `bizId`, and `sentAt` fields represent the timeline row. No migration is needed or added.
- **Implementation**: preserves identity precedence `message.id` → top-level event `id` → synthetic ID only for allowlisted event-only types. Synthetic IDs use `event:<lowercase-type>:<full-sha256>` over a fixed ordered list of type, millisecond timestamp, `source.chatId`, `source.userId`, `read.watermark` for `chatRead`, and optional `bizId`. Unsupported or insufficiently identified event-only records fail closed. Event-only rows keep their event type/timestamp and biz ID, with `direction=UNKNOWN`, `messageType=null`, `text=null`, and no staff owner attribution. Normal text/media IDs and the live Mirror path are unchanged.
- **Production read-only observation**: PR #349 is merged at `8d8535955fa146b5a458bf9298d8bd5b28ec57ae`; the Railway backend and LINE chat worker deployments from that main commit report `SUCCESS`. The worker’s service-scoped variable-name list does not contain `LINE_CHAT_HISTORICAL_BACKFILL_ENABLED`; the source defaults it off. In a sanitized `2026-09-23 08:47–08:53 UTC` log sample, each of the 16 configured stores had 3–4 successful Mirror cycles and 7 completed reconciliation cycles; no Mirror/reconciliation failure event appeared. No historical run event appeared in the sampled logs. No production data or configuration was changed.
- **Local verification**: A1 historical tests **26/26**, Mirror regression tests **9/9**, profile-priority tests **6/6**, touched-file ESLint passed, backend build passed, Prisma validation passed, and `git diff --check` passed. The schema validation used a non-routable local placeholder URL. This work is on local branch `fix/a1-event-only-timeline-identity`, based on latest main `8d8535955fa146b5a458bf9298d8bd5b28ec57ae`.
- **Next gate**: review final local diff and stop for explicit push authorization. Do not activate the historical feature or pilot.
- **Progress**: A1 Historical Backfill Engine **75%**, A2 Historical Data Validation **0%**, A3 24h Reply KPI **15%**, A4 Nickname / Rename Status **10%**, A5 All-Store Eligibility **5%**, A6 All-Store Rollout **0%**, A7 Production Stability **35%**, Overall Big Project A **20%**. Historical pilot remains inactive (**0/3**).

## 2026-09-23: A1/A2 September chat inventory — implementation and PR

- **Source semantics**: the v2 LINE Manager chat-list parser reads `latestEvent.timestamp` and normalizes it into `LineChatDiscoveredChat.lastMessageAt`; live Mirror persists that value to `LineChatMirrorChat.lastMessageAt`. September membership uses that chat-list activity timestamp only, never `/messages` history depth.
- **Inventory bounds**: business timezone is `Asia/Bangkok`; interval is `[2026-09-01T00:00:00+07:00, 2026-10-01T00:00:00+07:00)`. Missing or malformed values are `UNKNOWN` and prevent a complete inventory claim. If completeness is not proven, the exact `septemberChats` total and coverage rates are null; only `septemberChatsObserved` is reported.
- **Pagination and ordering**: inventory reuses the existing `/api/v2/bots/{botId}/chats` parser and opaque top-level `next` handling under the existing 200-page/10,000-chat limits. An internal page observer receives parsed page fields without `next`. It verifies timestamps are non-increasing across the observed USER chat sequence; safe early stop occurs only after crossing below Sep 1 with no ordering anomaly, unknown date, invalid USER record, or conflicting duplicate. An anomaly disables early stop; cursor exhaustion can still prove the full range. Hitting a limit before a provable range records an incomplete reason.
- **Coverage and candidate selection**: every observed September chat is bucketed from its historical checkpoint status into `historicalNotStarted`, `fetchingInitialPage`, `fastPathComplete`, `needsBackwardPagination`, `historicalCoverageUnproven`, or `failed`; `historicalChecked` is the sum excluding the first two. Checked/complete rates use only the September chat count and return zero for an empty denominator. If inventory is incomplete, exact total and rates are unknown/null; the known subset count is labeled `septemberChatsObserved`. The serial `discoverPilotStores()` API reads current Mirror store/Account/session bindings for the unchanged three pilot stores and returns a sanitized unavailable result if a target is missing or ambiguous. Historical worker candidates are bounded to the same Sep 1 inclusive / Oct 1 exclusive range and rechecked with the pure classifier; the per-store cycle cap remains one. Worker telemetry calls them `historicalCandidatesAvailable`, not September inventory totals.
- **Schema/production boundary**: no new inventory persistence or Prisma migration is needed; report counts derive from the read-only Manager inventory plus existing per-chat checkpoint status. No endpoint was exposed, no production inventory was run, no history writes occurred, Railway and the flag were untouched, and the historical pilot remains inactive (**0/3**). Backward request mechanics remain unproven and unchanged. Focused commit, push, PR, and CI monitoring are authorized; merge, deployment, Railway/flag changes, and production inventory remain outside this authorization.
- **Verification**: September inventory/service tests **18/18**, chat-list/session discovery regressions **52/52**, A1 historical tests **26/26**, Mirror regressions **9/9**, and profile-priority tests **6/6** passed. Touched-file ESLint, backend build/typecheck, Prisma validation with a local placeholder URL, and `git diff --check` passed.
- **GitHub/CI**: commit `3ab87bbb16fd0553263d0f53199e9e411731160b` is on `feature/a1-a2-september-chat-inventory`; PR #352 targets `main` at base `fef893bec4a78286f6c0a13cb3a24479a99999e4`. Application CI run 692 passed all Frontend, Android, Backend, and CI Gate jobs. PR remains open and unmerged.
- **Next gate**: user/reviewer decision on PR #352. This task stops before merge. Do not deploy, enable the flag, run a production pilot, or implement backward pagination in this milestone.
- **Progress**: A1 Historical Backfill Engine **80%**, A2 Historical Data Validation **15%**, A3 24h Reply KPI **15%**, A4 Nickname / Rename Status **10%**, A5 All-Store Eligibility **5%**, A6 All-Store Rollout **0%**, A7 Production Stability **35%**, Overall Big Project A **21%**. No production validation is claimed.
# Current task: Big Project A — A2 Production Findings Fix (2026-09-23)

## Production Run #1 evidence (user supplied; no new production inspection here)

| Store | Run #1 result |
|---|---|
| 29113 — Central Pinklao | Inventory stopped at `MANAGER_BOT_ID_UNAVAILABLE`, with zero conversations observed. This was a lookup limitation: inventory required the OA's stored `chatBotId`, while Live Mirror can resolve an absent value through its Manager-account redirect path. |
| 28375 — RBS Chonburi | 5,000 conversations / 200 pages; 672 September-observed; 2,350 before September; 1,978 with an undifferentiated unknown date; newest `2026-09-23T13:37:52.405Z`; oldest `2026-03-25T09:16:56.069Z`; ordering anomaly; reached before September; page bound reached; cursor not exhausted. Exact total not proven. |
| 25610 — Central World | 1,272 conversations / 51 pages; 268 September-observed; 608 before September; 396 with an undifferentiated unknown date; newest `2026-09-23T11:14:31.670Z`; oldest `2026-03-26T07:43:09.145Z`; ordering anomaly; reached before September; cursor exhausted. Exact total not proven because unknown dates could not be classified. |

Historical checkpoint observations: 28375 had 4 checked, 0 fast-path complete, 4 backward-required; 25610 had 3 checked, 1 fast-path complete, 2 backward-required.

Run #1 held `MANUAL_DIAGNOSTIC` profile leases during long scans and temporarily delayed Live Mirror work. After the diagnostic finished, Live Mirror recovered across all 16 configured stores, mirror failures were 0, reconciliation was healthy, historical events were 0, and DB/schema errors were 0. Historical backfill was never enabled. The startup inventory trigger was returned to false without another deploy.

## Local A2 fix implemented

- Live Mirror and September Inventory now share `getStoreMirrorTargetInputs()` for canonical store/OA selection and `resolveMirrorTarget()` for direct OA or Manager redirect/session resolution. Inventory checks that its enabled state row still points to that selected OA, and fails closed for mismatch, ambiguity, or unavailable targets. The resolver path is read-only apart from its existing in-memory target cache.
- Parsed USER chat rows now carry safe `lastMessageTimestampStatus`: `VALID`, `NO_LATEST_EVENT`, `TIMESTAMP_MISSING`, or `TIMESTAMP_INVALID`. No other timestamp fallback fields were introduced.
- `NO_LATEST_EVENT` is separately reported and excluded from the activity-based September denominator; it does not block exact activity inventory. A latest event with a missing/invalid timestamp still blocks exact totals and rates. Cursor exhaustion can prove full membership despite ordering anomalies; early stop still requires valid, ordered, conflict-free activity dates. Partial totals remain lower bounds only.
- Inventory discovery uses per-profile limits of 12 pages, 600 chats, and a 15-second discovery budget; those limits are applied to navigation, first-page waits, response parsing, and subsequent requests. The existing `MANUAL_DIAGNOSTIC` lease remains non-blocking (`waitForLock:false`). Each lease is released between store windows, with an event-loop yield so queued profile work can run before the next window. No cursor is persisted or logged, and no cross-context resume semantics were added.
- Startup reports include only store-level aggregates, target-resolution source, timestamp-reason counts, and limit flags. Startup exceptions log only the error type. Resolver diagnostics no longer include session keys.
- No migration, public endpoint, production inventory, Railway change, historical write, or production deployment was performed.

## Verification

- A2 parser/inventory/target/session/trigger/Mirror focused tests: **68/68 passed** before the PR wiring correction; **69/69 passed** with the correction included.
- Profile coordinator and selected health/scheduler/session-health regressions: **39/39 passed**.
- Touched backend ESLint: passed.
- Nest backend build/typecheck: passed.
- Prisma validate: passed (existing Prisma package.json configuration deprecation warning only).
- Prisma schema diff from base: **empty migration**; no schema or migration files changed.
- `git diff --check`: passed before documentation updates.
- Two additional existing health test suites are inconsistent with the current health implementation: `line-chat-health-reconciliation.service.spec.ts` has two tests that omit the `operationalSession` mock now required by the service; `line-chat-health-baseline.spec.ts` expects successful totals to reset to zero while the implementation explicitly preserves cumulative success. Neither suite or implementation was changed because both are outside A2 scope.

## Big Project A progress

- A1 — Historical backfill: **80%**
- A2 — September inventory: **30%** (local findings fix complete; production Run #2 and exact store totals remain pending)
- A3: **15%**
- A4: **10%**
- A5: **5%**
- A6: **0%**
- A7: **35%**
- Overall: **23%**

## Gate for Production Inventory Run #2

1. Review and merge/deploy this PR only under a separate user authorization; confirm the resulting worker deployment is healthy and Live Mirror/reconciliation remain healthy across the 16-store fleet.
2. Keep `LINE_CHAT_HISTORICAL_BACKFILL_ENABLED` false. Separately authorize a one-shot read-only September inventory run for the existing three pilot stores, using the startup trigger only for that run and restoring it to false afterward.
3. Use the bounded 12-page / 600-chat / 15-second profile window. No historical messages/checkpoints or customer records may be written. Exact totals remain unproven for any store that has missing/invalid event timestamps, unresolved conflicts, or a reached bound before a safe boundary/exhaustion.

## 2026-09-23: PR #355 application wiring correction

- **CI finding**: the first PR run passed frontend, Android, the LINE chat health regression suite, other backend checks, and backend build, but failed the backend auth-guard smoke test. `LineChatSeptemberInventoryService` required `LineChatMirrorService` in the general `LineChatModule`, where the dedicated Mirror worker provider is intentionally absent.
- **Correction**: made the resolver dependency optional at Nest injection time. The dedicated worker module still supplies the normal resolver; if the service is ever invoked without it, inventory now returns `MIRROR_TARGET_RESOLVER_UNAVAILABLE` for each applicable pilot store and continues fail-closed. Added a focused test for this app-module-safe path. The general API module does not register or start another Mirror worker.
- **Verification**: focused A2 tests including the new case passed **69/69**; the mobile nickname wiring / module isolation test passed **4/4**; touched-file ESLint passed; Nest backend build passed; `git diff --check` passed. No schema, migration, production data, Railway configuration, or rollout scope changed.
- **GitHub**: PR #355 remains open and unmerged. The first CI run's sole failure was the backend auth-guard smoke test described above; the follow-up correction must be pushed to the same branch before rerunning CI.
- **Next gate**: commit and push only this DI correction and its test/progress note, then monitor PR CI to its final state. Merge, deployment, production inventory, and historical-flag activation are still separate gates.

Current state: local follow-up fix and checks are complete; the follow-up commit/push and PR CI rerun are next. Production and merge/deploy remain unchanged and unauthorized in this task.

## 2026-09-24: Big Project A explicit Mirror operation modes (local PR)

- **Base/branch**: local implementation is based on production `main` commit `4b6112bf74b4ea65e16e425d4880689e367ab283` on `feature/mirror-backfill-operation-modes`.
- **Architecture**: add a durable singleton NORMAL/BACKFILL/CATCH_UP state, atomic mode transitions, production-clock `freezeAt`, the Bangkok Sep 1 start boundary, configurable persisted overlap (300 seconds default), and ADMIN-only status/transition endpoints. Database checks prevent BACKFILL/CATCH_UP rows without their required time boundaries.
- **Worker behavior**: scheduled worker/timers remain active. NORMAL continues Live Mirror. BACKFILL skips new Live Mirror cycles and processes only configured pilot stores serially; historical chats/events are bounded by `[2026-09-01T00:00:00+07:00, freezeAt]`. CATCH_UP resumes Live Mirror and re-fetches known chats whose history watermark predates the persisted overlap. Existing stable Manager IDs, mirror uniqueness, and canonical external IDs preserve idempotency.
- **Evidence and blockers**: BACKFILL completion remains blocked/unproven because inventory completeness is not durably tied to this mode run and backward continuation remains unproven. Current recent Mirror APIs cannot prove a full freezeAt-to-now gap; CATCH_UP therefore stays `UNPROVEN` and cannot return to NORMAL automatically. No backward request semantics or raw cursors/tokens were added.
- **Current user-supplied A1/A2 evidence**: 29113 has an exact September count of 124, inventory complete in 55 pages with cursor exhausted, 3 historical conversations checked (all need backward pagination), and 121 not started. 28375 has at least 690 September chats observed at the 5,000-chat / 200-page bound, cursor not exhausted and an ordering anomaly; exact total is unproven. 25610 has at least 268 September chats observed; inventory was interrupted by profile contention and exact total is pending. These facts are lower-bound evidence where stated, not new production reads.
- **Reconciliation/inventory**: reconciliation continues because `LineChatMirrorReconcilerService` processes persisted mirror rows and writes canonical reconciliation state without consuming Manager profiles. Startup inventory now retries only busy stores and retains each store’s best prior result; per-store inventory itself remains serial.
- **Verification**: mode, worker, historical, inventory, reconciliation, and controller/auth tests passed **92/92**; Prisma validation passed; clean PostgreSQL applied all **154 migrations** including the new migration; touched-file ESLint, backend typecheck/build, and `git diff --check` passed. Production, Railway, merge, and deployment were not touched.
- **Big Project A progress**: retain user baseline — A1 **80%**, A2 **50%**, A3 **15%**, A4 **10%**, A5 **5%**, A6 **0%**, A7 **35%**, Overall **27%**. Local code/CI readiness does not count as production mode switching or rollout completion.
- **Next gate**: commit and push this focused branch, open a PR against `main`, and monitor CI. Stop before merge or deploy. Before production BACKFILL activation, add a trusted durable inventory-proof writer and a full-gap catch-up proof source; otherwise transitions correctly remain blocked.

## 2026-09-24: A2 Pinklao resolver contention diagnosis

- **Code diagnosis**: confirmed that `resolveMirrorTarget()` continued after a non-acquired profile lease and then returned `MIRROR_MANAGER_TARGET_NOT_FOUND` when it had no verified candidate. Inventory therefore could not identify resolver contention as `PROFILE_OPERATION_BUSY`. The startup retry checks the aggregate store reports and retries the whole configured store set if any report is busy; Pinklao was re-run because other stores were busy, even though its own failure was mislabeled.
- **Run #2 evidence**: on the first Pinklao attempt window, one anonymized profile was busy while the other was acquired and rejected after recent discovery transport failure. On the next two attempt windows, coordinator logs show both anonymized profiles busy, followed within milliseconds by Pinklao target-not-found reports. Coordinator events lack store/request linkage, so retrospective attribution of each busy event to Pinklao is **EVIDENCE_INCOMPLETE**. No profile identifiers are recorded here.
- **Recovery evidence**: a later Pinklao resolver attempt freshly followed the Manager redirect on PROFILE_A after PROFILE_B recent discovery was rejected; the resolver mapped the target and the subsequent Live Mirror cycle succeeded. Further cycles succeeded. Later target-cache use is plausible, but cache hits are not logged and are not claimed as proven.
- **Local fix**: resolver contention now returns `MIRROR_MANAGER_TARGET_BUSY` only when no verified candidate exists and at least one eligible profile lease was busy. September Inventory maps it to `PROFILE_OPERATION_BUSY`; Live Mirror stores it as existing transient `PARTIAL` state. Existing direct OA and cached paths, redirect/auth behavior, recent-chat verification, ambiguity behavior, nonblocking leases, and bounded retry settings remain intact. The Manager media materializer classifies this temporary result as retryable. Aggregate resolver logs add only safe store context, counts, and a fixed outcome.
- **Verification**: resolver, inventory, startup trigger, profile coordinator, module isolation, discovery/session/authentication, and Manager media regressions passed **137/137**. Touched-file ESLint, Nest backend build, Prisma validation with a local placeholder URL, and `git diff --check` passed. Generated Prisma client artifacts were isolated under `/private/tmp`; no schema or migration changed.
- **Production boundary**: production, Railway, inventory trigger, historical-backfill flag, customer data, and historical records were not changed. Next gate is review/merge/deploy under a separate authorization, then 16-store Live Mirror health and a Pinklao-only resolver validation before considering Inventory Run #3.
- **Git/CI**: commit `613ff76c6f6a8e3a1e8ac748c2e834889c802011` is on `fix/a2-pinklao-resolver-contention`, based on `main` `1baafb6b9fa9b87661d377efdc2b193465e63b9a`. PR #356 is open and mergeable; Application CI run 701 passed Frontend, Backend, Android, and CI Gate. The PR remains unmerged. Merge and deployment remain out of scope.
- **Progress**: A1 **80%**, A2 **35%** (resolver diagnosis and local fix verified; production validation remains pending), A3 **15%**, A4 **10%**, A5 **5%**, A6 **0%**, A7 **35%**, Overall **24%**.

## 2026-09-25 — Shared Chromium launch diagnostics (local, unpublished)

- **Base**: prepared in a clean checkout of deployed commit `8c25a220cc630130073393de0a7cb0eada1dfab2`; the existing dirty runtime-debug checkout was left untouched.
- **Change**: wrapped the existing `chromium.launchPersistentContext` call only to emit one bounded, redacted structured event after a launch rejection, then rethrow the same original error. No browser options, store scheduling, retry policy, profiles, sessions, or data paths changed.
- **Tests**: new focused extraction/redaction/size-bound/no-mask tests and existing profile lifecycle, session service, and Mirror service tests passed **68/68**.
- **Build/lint**: backend build passed. Both new diagnostics files pass plain ESLint. Plain touched-file ESLint reports one pre-existing `no-unnecessary-type-assertion` at session-service line 896; linting the unchanged base file at deployed commit `8c25a220` reproduces it at line 895. No unrelated source was changed to hide it. `git diff --check` passed.
- **Production safety**: no Chromium launch was performed by this verification, and no production reads/writes, commit, push, merge, deployment, Railway change, or restart occurred.
- **Authorization**: controlled diagnostic deployment approved on 2026-09-25. Scope remains diagnostics/tests/progress documentation only; no root-cause fix is authorized.
- **Next gate**: verify current `main`, create a dedicated diagnostic branch/PR, pass required CI, then deploy only `line-chat-nickname-worker` and observe the shared A/B runtime without forcing a failure.

## 2026-09-25 — Follower Insights D-1 date fix

- Investigated production follower dashboard showing 0 followers and 0/146 ready stores for a range ending on the current Bangkok date.
- Confirmed the daily follower sync is D-1 and production already had ready snapshots for 2026-09-24; the UI was querying 2026-09-25 as the endpoint.
- Added shared follower-date helpers so mobile and desktop default to the latest LINE-available D-1 Bangkok date.
- Added range clamping so selections ending today/future are normalized to D-1 instead of rendering a false zero/missing state.
- Added regression tests for the 2026-09-25 case and the Bangkok-midnight boundary.
- Data safety: no follower snapshots, credentials, or database records were modified.
- Verification pending: PR CI, then production deployment/route verification.

## 2026-09-25 — Shared Chromium runtime P0 (local only; no deployment)

- **Production evidence refresh:** Railway still showed the same `line-chat-nickname-worker` deployment `37b7b035-f333-4d3d-9798-b83c8e8e9151` / deployed commit `70b71191a5db35fdb3dcda847d438a2d618adc69`, one configured replica in `us-west2`, started `13:20:49.488 UTC`. At `15:11:36 UTC`, uptime was 1h50m46.5s. From `13:57`–`15:11 UTC`, read-only logs contained 329 Chromium launch failures, 330 store-cycle failures, no store-cycle completion events, 112 `pthread_create: Resource temporarily unavailable (11)` messages, and PIDs 43272–44696. CPU/memory remained low; exact PID/task limit is still unknown.
- **Diagnosis:** OS thread/task creation failure is strongly supported; the exact kernel/container ceiling is not identified. Repeated per-operation persistent-context launch/close churn is confirmed in source. No orphan/process/thread leak or heap/memory leak is proven.
- **Local implementation:** branch `p0/chromium-runtime-supervisor` in the isolated clone. Added a per-resolved-profile path supervisor, healthy headless context reuse with page reset, 20-minute/256-operation rotation, bounded cooldown/recovery/close/shutdown, Linux `/proc`/cgroup telemetry, and safe launch correlation. noVNC remains ephemeral. Existing DB leases, store selection, browser arguments, business behavior, mode, and profile directories are preserved.
- **Previous checkpoint note (superseded by the 2026-09-25 real-profile validation above):** 193/193 tests across 17 runnable affected specs, Nest build, touched-file ESLint, and `git diff --check` passed; only mock profile testing had been done then, so its recommendation was `NOT_READY`. The current profile mapping, saved-profile soak, and readiness decision are documented at the top of this file and in `P0_CHROMIUM_RUNTIME_REPORT.md`.
- No commit, push, deploy, restart, DB write/import, Railway change, mode change, or LINE message occurred during the earlier checkpoint.

## 2026-09-26 — P0.1 Live Mirror Chromium zombie reaping (local; unpublished)

- **Base/branch/workspace:** production `main` commit `b0ded9b20d25056700c337f684d8b6c4f5c7ef1d`; branch `p0.1-live-mirror-zombie-reaping`; isolated clone at `/private/tmp/line-unified-inbox-p0.1-zombie-reaping`. The primary checkout was not modified.
- **Read-only production evidence:** Railway confirms the active `line-chat-nickname-worker` deployment runs commit `b0ded9b`, uses `backend/Dockerfile.line-chat-worker`, and starts `bash scripts/start-line-chat-worker.sh`. The worker PID is 1 and `/proc/1/exe` resolves to `/usr/bin/node`. A bounded `ps` read found 50 `chrome-headless` processes in zombie (`Z`) state, all with PPID 1. The process list included only PID, PPID, state, and short process name; no command lines were read.
- **Rotation correlation:** the current deployment has 26 `line_chat_chromium_close_completed` events and 26 matching close starts. All reported `cleanupCompleted=true`, `profileReleased=true`, and `closeEscalationUsed=false`. Best-effort runtime snapshots progressed from zero zombies/processes to 53 zombies, 65 total processes, 63 Chromium processes, and 54 PPID-1 processes. The independently sampled live process table showed 50 zombies. Across the observation window, zombie count rose by approximately two per completed context close. `close_completed` snapshots are throttled and were not emitted for every close, so same-second causality is not claimed.
- **Root cause:** confirmed at the container lifecycle boundary: orphaned `chrome-headless` descendants are adopted by the Node worker at PID 1 and remain zombies because Node is not acting as a container init/subreaper. Current PPID proves they are PID-1 children now; the prior immediate Chromium parent is no longer recoverable from zombie `/proc` entries. `waitForProfileRelease()` checks singleton profile artifacts only; `profileReleased=true` is not process-tree reaping evidence.
- **Local change:** add `tini` and make it the entrypoint only in `backend/Dockerfile.line-chat-worker`. Preserve Railway’s start command and the `exec node` wrapper. Add a bounded local Linux Chromium rotation soak script that checks PID 1, zombie/process/thread/cgroup counts, and 50 persistent-context close/relaunch cycles.
- **Historical safety:** no Mirror service or business logic is changed. The worker image is shared runtime infrastructure for this service, so this is classified `SHARED_RUNTIME`; the intended effect is OS child reaping. BACKFILL/CATCH_UP scheduling, pagination, checkpoints, cutoffs, and persisted records are untouched. Focused historical regression runs passed.
- **Verification:** focused Chromium lifecycle/diagnostics/telemetry, session, Live Mirror, worker/health scheduling, profile coordinator, operation-mode, and historical backfill regressions passed **168/168**. Backend Prisma generation/build passed. The Linux/ARM64 Docker worker image built successfully, and the opt-in Chromium soak passed **50/50 rotations** with `tini` PID 1. Snapshot metrics (baseline/peak/final): zombies **0/0/0**, total processes **7/14/7**, Chromium processes **0/7/0**, threads **50/119/50**, cgroup `pids.current` **50/119/50**. The soak spec passes ESLint; the normal macOS invocation skips it unless explicitly enabled. `git diff --check` passed on the final tree.
- **Completion and boundary:** implementation, regression tests, Linux soak, and diff review are complete. This task authorizes one commit and push of this branch; PR creation, merge, production mutation, Railway restart/config change, database write, and deployment remain out of scope.

## 2026-09-27 — W1.3D target-proof session resolution follow-up

- **Production finding:** after PR #365 deployment, the first authorized proof for Central Master candidate 865 returned HTTP 200 with `PROFILE_MISMATCH`, `AUTH_NOT_CHECKED`, and no chat-list request. It stopped before browser acquisition. A bounded read-only query showed the OA has no `lineChatSession` association; the same is true for all 20 initial pilot OAs. The two canonical sessions remain active/connected. No OA binding or other business data was changed.
- **Safety gate:** all 16 permanent control stores had fresh successful cycles; both Manager sessions were CONNECTED with zero auth/health failures; Tini was PID 1, Node PID 2, current contexts were bounded to the two expected profiles, zombie count 0, `pids.current` 284, `pids.max` 1000, and `pids.events.max` 0. Store 28220 remains excluded with its pre-existing state-hygiene failure; it was not targeted or changed.
- **Scoped fix in progress:** target proof may resolve an unbound candidate only to the canonical active session keyed by its assigned Central Master profile (`account-1` for A, `profile-b` for B). An explicit OA session association still takes precedence and must match. Missing or conflicting sessions fail closed. Tests are being added; no additional production proof will run until the fix is validated and deployed.
- **Current checks:** not yet run for this follow-up. Next: focused target-proof/mirror tests, backend build, lint, diff review, then use the authorized fix PR pipeline and re-canary one store before resuming.

## 2026-09-27 — Historical crosswalk completion and Store 30282 canary

- **Task/scope:** Continue the approved Historical Mirror completion under `SUNN-HISTORICAL-FINAL-COMPLETION-20260927`. Work is isolated in `/private/tmp/line-inbox-historical-crosswalk`, branch `codex/historical-crosswalk-20260927`, based on current `origin/main`. The unrelated modified primary checkout was not edited.
- **Forensic recovery:** Verified Store 30282’s archive against the approved registry and ledger hashes. Located `Reno15F 8/256 Bl ` at 16:09:30.543 Bangkok; its unique canonical Message is in Conversation `e9f88a82-ffc4-45c0-b755-20a847fa6ef4`, Store/OA scope matches, direction and text match, and timestamp drift is 3 ms. Historical chat ID is `Udbf1776bbad5d0095a7cc5f3273cbf1e`; canonical `lineChatUserId` is null. Five text candidates share the source chat; four Historical read-model rows already exist and the anchored event is represented canonically. Nearby sticker and image records are explicitly outside text backfill.
- **Fresh fleet preflight:** 42,587 verified archive text candidates across 7,024 identities. `LINK_SAFE` 4,052 identities / 33,107 candidates / 18,493 imported; `DIRECT_VISIBLE` 886 / 6,190 / 2,554; `NO_CANONICAL_ANCHOR` 2,086 / 3,290 / 3,290; ambiguous and conflict are both 0. All seven Store 30282 archive files match the approved ledger. 18,250 compatible source anchors have p50/p95/p99 absolute drift 3/3/5 ms, max 88 ms, with none over one second.
- **Implementation:** Added an additive, CHECK-constrained `HistoricalConversationCrosswalk` table and safe-only persistence script. The canonical conversation message read now merges exact direct Historical IDs and LINK_SAFE crosswalk IDs, and deduplicates by stable source event ID. Virtual Historical discovery omits linked identities and fails closed on any canonical source-event match. Added a production read-only acceptance runner that calls the actual service read paths, verifies archive/source coverage, ordering, duplicate suppression, and no second virtual chat for named and profile/volume representatives.
- **Production migration:** Read-only migration status showed one pending migration, `20260927120000_add_historical_conversation_crosswalk`. That additive migration has been applied successfully. No crosswalk rows have been persisted yet; deployment must come first so the production read path consumes the links.
- **Checks:** Prisma schema validation, targeted historical-script TypeScript, touched-file ESLint, focused backend tests **60/60**, backend build, frontend tests **604/604**, and frontend build passed. Full backend suite ran 2,338 tests: 2,323 passed and 14 unrelated baseline failures remain in auth/store-context, missing Vitest modules, existing nickname/health/worker/Store Insights fixtures, and a Playwright Dockerfile expectation. Full backend `tsc` also has unrelated existing spec/source diagnostics; Nest production build passes. The frontend build reports that Next skips its separate type validation.
- **Publication:** Under explicit approval `SUNN-HISTORICAL-CROSSWALK-PUBLISH-20260927`, pushed the exact local implementation and status commits using the authorized Git CLI path. PR #371 passed Application CI #752, Unified Auth CI #161, and the TikTok public profile PoC #36, then merged as `b0bc04b322abaa0eb1feb708c7392433792176ba`.
- **Deployment:** The production migration was already applied; Railway's pre-deploy migration check reported 157 migrations and none pending. Backend deployment `eb7f445a-cb05-44c0-ad21-4587fb75e624` and frontend deployment `87ad31d3-17a0-4efd-a60b-06b009479ba1` both report `SUCCESS`; API readiness and frontend root probes returned HTTP 200. Existing shared backend watch paths also deployed five other services; all report `SUCCESS`. Railway configuration and variables were not changed.
- **Fresh production discovery and apply:** Revalidated archive registry and ledger hashes. Across 7,024 identities / 42,587 text candidates: `LINK_SAFE` 4,052 / 33,107; `DIRECT_VISIBLE` 886 / 6,190; `NO_CANONICAL_ANCHOR` 2,086 / 3,290; ambiguous 0; conflict 0. Canary remains Store 30282 `LINK_SAFE`, one anchor, 3 ms drift. The guarded apply inserted exactly 4,052 crosswalk rows and verified the complete expected set in-transaction.
- **Post-apply acceptance:** Read-only repeatable-read service-path acceptance passed. Persisted links exactly match fresh discovery; duplicate/ambiguous/conflicting links: 0. Fleet visibility: 24,337 imported Historical rows; 2,554 direct-visible; 18,493 crosslink-visible; 3,290 virtual-visible; 18,250 canonical-held; archive-held 0; duplicate timeline rows 0. Saraburi and Central Pinklao, Central World, The Mall Bangkapi, Profile A, Profile B, high-volume, and sparse representatives all passed with zero missing text, zero duplicate messages, correct order, and no duplicate virtual chat.
- **Safety:** The crosswalk apply performed 4,052 INSERTs into `HistoricalConversationCrosswalk` only. No Conversation, Customer, canonical Message, owner, BM, follow-up, nickname, queue/job, archive, or LINE-send action was part of the crosswalk scripts. The signed-in browser check remains pending; authenticated conversation HTTP was not run because no signed-in session was available.
- **Current status:** `DELIVERED_BACKEND_ACCEPTED`. Sunn may perform the separate signed-in visual confirmation; no further production data action is pending for this phase.


## 2026-09-28 — Monthly Operations Report P0 (isolated from Mirror)

- Created branch `feature/monthly-operations-report-p0`.
- Added read-only `GET /monthly-operations-report?month=YYYY-MM`.
- Reused existing Store Master, `LineOaFollowerSnapshot`, canonical `Message` timeline, and existing response-cycle helper.
- Added per-store follower start/focus/end snapshots, follower growth, inbound volume, actual <=24h reply cycles/rates, and data-quality flags.
- Explicitly excluded all writes to Live Mirror and Historical Mirror data paths; no Prisma migration and no worker/scheduler changes.
- PR: #373.
- Verification: Application CI started; backend/frontend/android jobs pending at time of this entry.
- Next: repair any CI findings only inside the report module/app registration, then verify diff still excludes Mirror paths.


## 2026-09-28 — Monthly Operations Report production validation UI

- Production backend deployment verified on merge commit `0cdfeb8f2285264ecf1cd2946edc2feb35b9db86`; Railway status SUCCESS.
- Nest startup log confirms `GET /monthly-operations-report` is registered and application startup completed successfully.
- Direct aggregate validation is authentication-bound; no unauthenticated/public bypass was introduced.
- Added authenticated frontend page `/monthly-operations-report` using the existing Dashboard access policy and browser session.
- Page shows report scope, production totals, <=24h response KPI, follower coverage, per-store rows, search, month selection, and explicit Mirror isolation flags.
- Added sidebar navigation under Tools.
- No Live Mirror or Historical Mirror implementation files were changed.


## 2026-09-28 — Monthly Operations Report reply KPI reconciliation

- Production validation UI exposed suspicious 0% reply rates for stores with substantial inbound volume.
- Root cause confirmed in code: report response cycles required `senderUserId`, while canonical Manager-mirrored human outbound messages may intentionally have `senderUserId = null` but carry `rawPayload.source = LINE_MANAGER_MIRROR` / `provider = LINE_MANAGER`.
- Mirror reconciler already treats those canonical messages as human replies for conversation state.
- Report-only fix now applies the same human-reply evidence without changing Mirror collectors/reconciliation.
- Report cycles additionally require `deliveryStatus = DELIVERED` and continue excluding Auto Reply Bot / AUTO_RESPONSE messages.
- Added regression coverage for internal-user replies, Manager replies without user mapping, auto replies, failed outbound, consecutive inbound cycles, and unresolved cycles.


## 2026-09-28 — Monthly Operations Report XLSX exporter

- Added authenticated `GET /monthly-operations-report/export?month=YYYY-MM`.
- Export reuses the same report service as the production UI so XLSX and on-screen totals share one source of truth.
- Workbook includes `运营明细`, `汇总`, `账号分组汇总`, and `口径说明`.
- `运营明细` preserves the August report's 35-column A:AI layout.
- Historical tag columns Y:AF remain blank until reliable historical tag snapshots exist; rows explicitly note `tag_history_unavailable`.
- Added `下载 XLSX` action to `/monthly-operations-report`.
- No Live Mirror or Historical Mirror implementation files or persistence paths changed.


## 2026-09-28 — Monthly Operations XLSX export 500 hotfix

- Production confirmed `GET /monthly-operations-report` remains healthy (HTTP 200); only `/monthly-operations-report/export` returned HTTP 500.
- XLSX generation was rewritten to use the same conservative ExcelJS pattern already used by the production Google Review exporter: define worksheet columns first, then append primitive row objects.
- Removed unnecessary complex worksheet layout operations from the export path while preserving the 35-column A:AI detail contract.
- Added structured success/failure logging for XLSX generation.
- Added a production-scale regression test with 146 stores.
- No Live Mirror or Historical Mirror implementation files changed.


## 2026-09-28 — Monthly XLSX runtime import hotfix

- Production structured log identified exact export failure: `Cannot read properties of undefined (reading 'Workbook')`.
- Root cause: default-import interoperability for `exceljs` in the production CommonJS bundle; TypeScript/CI did not expose the runtime default export mismatch.
- Switched Monthly Operations Report exporter and its tests to runtime-safe namespace import: `import * as ExcelJS from "exceljs"`.
- Normal report endpoint remained healthy (HTTP 200); only XLSX export was affected.
- No Live Mirror or Historical Mirror implementation files changed.


## 2026-09-28 — Monthly report English workbook headings

- Reviewed the generated 146-store September XLSX.
- Workbook structure is valid: 146 store rows and 35 detail columns.
- Changed exported workbook presentation to English only:
  - `Operations Detail`
  - `Summary`
  - `Region Summary`
  - `Methodology`
- Translated all detail headers, summary metrics, and methodology labels/definitions to English.
- No KPI calculation, Store Master mapping, Live Mirror, Historical Mirror, or database behavior changed in this presentation-only patch.
- Separate data-quality finding: fleet-wide 24h reply rate must not yet be treated as complete-fleet performance because reply evidence is currently non-zero for only a small subset of stores; coverage logic will be handled separately.


## 2026-09-28 — Monthly Operations Report reply KPI coverage finalization

- Added report-only, read-only fallback from `LineChatMirrorMessage` for human Manager outbound rows that are not already represented in canonical `Message`.
- Fallback mapping order mirrors reconciliation evidence without writes: existing canonical conversation ID, direct `lineChatUserId`, then exact inbound manager message evidence.
- Canonical and Manager rows are deduplicated by canonical message ID, canonical external ID, and Manager message ID before response-cycle calculation.
- Added per-store reply KPI coverage: `complete`, `partial`, `not_covered`.
- Official 24h reply rates now include only `complete` stores. Partial/not-covered stores expose observed diagnostics but show N/A for the official KPI instead of false 0%.
- Added fleet scope counts for complete/partial/not-covered reply coverage and counts of Manager fallback rows used/unmapped.
- Updated XLSX and UI to surface coverage and keep incomplete reply KPI cells blank.
- No Live Mirror/Historical Mirror worker, reconciler, browser/session, lease, backfill, or write path changed.


## 2026-09-28 — Isolated Historical final-completion run

- Created a fresh worktree on `codex/historical-final-completion-20260928` from `origin/main` at `df527c7b8f852007ded02a78358c5039fd470163`; the existing dirty checkout and older Historical branches remain untouched.
- Revalidated the approved archive inventory: 137 VERIFIED stores and 42,587 text candidates. Store 28326 remains unproven because its current event archive does not match its ledger and its ledger-approved prior archive is empty. A prior Store 30606 snapshot matches the seven current ledger file hashes and is being checked for row-level partial proof.
- Added a pure source-ID classifier and 9 focused tests; all passed. Added a separate repeatable-read, read-only production audit that records source/canonical identity, text hashes, timestamps, matching crosswalk destinations, conflict classifications, and measured drift into ignored mode-0600 local evidence files.
- No production write, deployment, migration, Live Mirror change, or current-checkout change occurred in this run.
- Current action at the first checkpoint: execute the H1 audit against the production database through the approved read-only Railway tunnel; continue to H2–H4 afterward.

## 2026-09-28 — Historical final-completion results

- **Isolation:** worktree `/private/tmp/line-unified-inbox-historical-final-completion-20260928`, branch `codex/historical-final-completion-20260928`, based on `origin/main` at `df527c7b8f852007ded02a78358c5039fd470163`. The dirty primary checkout was not modified, stashed, committed, or cleaned.
- **H1:** recomputed 42,587 source rows from 137 verified archives. The disputed 16,915 comprise 2,314 same-chat source-ID matches with timestamp drift and 14,601 exact persisted `LINK_SAFE` matches. Full inventory accounting: 1,335 canonical exact, 2,314 time-drift, 14,601 crosswalk, 21,047 safe Historical, and 3,290 without a proven canonical destination; ambiguous/payload/scope/archive failures: 0. Two fresh repeatable-read production dry-runs each found 24,337 exact existing Historical rows, 18,250 canonical rows, and zero planned inserts. No write was needed.
- **H2 / Store 28326:** current changed archive matches 0/7 ledger files and has 431 target text rows; the prior ledger-matched archive has an empty event file. Proven 0, released 0, held 431; status `UNPROVEN`.
- **H2 / Store 30606:** prior archive matches all seven ledger hashes and contains 738 unique identity-valid target text rows. Read-only production classification: 50 canonical exact, 38 canonical time-drift, 0 canonical crosswalk, 0 already-Historical, 0 safe Historical missing, 438 without a direct or unique `LINK_SAFE` destination, and 212 `CANONICAL_SCOPE_CONFLICT`. Proven 738 at the file/event level; released 0; held 650. Collection validation remains partial (four incomplete conversations, four failed calls). No writes occurred.
- **H2 independent-source search:** targeted Google Drive searches for both Store IDs, Historical archives, `events.ndjson`, and the fleet ledger found no clearly relevant independent archive/Manager run. GitHub PR searches for the Store IDs returned none; prior Historical PRs #368/#369 document the earlier 0-row blocker and #371 covers fleet crosswalk proof for Store 30282 only. A separate read-only Manager retrieval path was unavailable without using the shared worker runtime.
- **H3:** 10,852 media events are metadata-only: stickers 4,190, images 6,513, videos 79, files 70. Binary count 0, ambiguous identities 0, archive source-identity duplicates 0. Typed Historical media schema, backfill code, timeline mapping, and unavailable-media placeholders are implemented locally. Railway currently watches `backend/**` for `line-unified-inbox`, `frontend/**` for `frontend`, and explicitly watches `backend/prisma/**` for `line-chat-nickname-worker`. The backend pre-deploy command runs Prisma migrations and Store Master sync. H3 is `READY_BUT_BLOCKED_BY_LIVE_MIRROR_ISOLATION`; no deployment or migration was attempted.
- **H4:** 7,748 chat identities; time-correct name evidence 0, identities without names 7,748, conflicting snapshots 0. Outbound events: 31,923 total; 19,970 Manager `bizId` responders across 282 distinct values; 6,799 auto-response; 5,154 unknown. No current Customer or User record was changed.
- **Verification:** focused Historical suite 37/37 passed; frontend suite 606/606 passed; backend build, frontend production build, Prisma validation/generation with a local placeholder URL, Historical script TypeScript, targeted ESLint, and `git diff --check` passed. Full backend lint reports 790 existing violations and the full backend suite has 14 unrelated failures. Frontend `tsc --noEmit` has existing unrelated application and test-fixture errors. Frontend port 3000 belongs to an unrelated Node process; no `.env`/`DATABASE_URL` or running local Compose database is present, so no application server was started.
- **Production boundary:** production reads only through the existing Railway tunnel; production writes 0, deployments 0, Live Mirror touched NO. H1/H2 private row reports remain under ignored archive data with mode 0600.
- **Publication gate:** docs-only PR #380 may merge after required CI passes and its eight Markdown paths remain outside Railway watch patterns. H3 draft PR #379 stays unmerged. The migration cannot deploy without restarting the watched worker.

## 2026-09-28 — Historical Final Completion and H3 Isolation Review

- Final accounting: H1 100%, H2 100% as evidence/hold completion, H3 65% blocked, H4 100%; overall 91.25%. Final status: PARTIAL_BLOCKED_BY_LIVE_MIRROR_ISOLATION.
- H1: all 42,587 approved text candidates have a valid Historical/canonical representation (24,337 Historical, 18,250 canonical). Disputed 16,915 = 2,314 drift + 14,601 LINK_SAFE; conflicts, unexplained rows, and required inserts are zero.
- H2: Store 28326 has 431 held; Store 30606 has 738 ledger-supported, 88 canonical, 438 without a proven destination, and 212 scope conflicts. Total held 1,081; released 0. No further search without a genuinely new source.
- H3: no clean no-migration design. The typed additive migration preserves event type, media subtype, identity, ordering, provenance, text semantics, and read-only crosswalk behavior. line-chat-nickname-worker watches backend/prisma/**, so normal deployment restarts Live Mirror. Keep the feature branch unmerged.
- H4: 7,748 identities, no names. Outbound totals: 19,970 Manager bizId + 6,799 auto + 5,154 unknown = 31,923.
- Changed-file inventory and final report are in HISTORICAL_FINAL_PROGRAM_STATUS.md and HISTORICAL_MIRROR_FINAL_COMPLETION_REPORT.md. No production writes, deployments, LINE sends, canonical mutations, or Live Mirror changes occurred; dirty primary checkout untouched.
- Root Markdown is outside Railway watch paths. Docs-only PR #380 and H3 draft PR #379 are open; both target main at 0abac727. GitHub currently reports no Actions runs or combined status checks for PR #380, so it remains unmerged. The H3 draft must not merge. Existing unrelated full lint/test/typecheck failures remain documented.
- Checks recorded: 37 focused Historical tests, 606 frontend tests, backend/frontend builds, Prisma validation/generation, Historical-script TypeScript, targeted ESLint, H1 dry-runs, H2 read-only classification, and diff check.

## 2026-09-28 — Historical docs PR conflict resolution

- Fetched `origin/main` at `4610df1a3db95afe158b91e576bdf201c23b80fc` and merged it into `codex/historical-final-reports-20260928`, previously at `86545d1d10f8b3beb485a280e4dcf08613f657c4`.
- Manually resolved the `AI_PROGRESS.md` and `DECISIONS.md` conflicts, retaining the Monthly Operations entries from main and the Historical Final Completion entries from PR #380. No duplicate section headings or conflict markers remain.
- `git diff --check` passed. The diff against current `origin/main` contains exactly the eight expected root Markdown files; no source, Prisma, frontend, or Live Mirror paths are in the PR diff.
- Next: push the existing PR branch and inspect GitHub Actions, required statuses, and mergeability.

## 2026-09-28 — Historical docs PR synchronized to latest main

- Fetched and merged latest `origin/main` at `e1a9143b2b21d8f1926facf4e074abf37a34960f` into `codex/historical-final-reports-20260928`.
- Resolved the repeated `AI_PROGRESS.md` and `DECISIONS.md` conflicts by keeping main's added Monthly Operations coverage entries and all Historical Final Completion entries.
- `git diff --check` passed. The three-dot diff against current `origin/main` contains exactly the eight expected Markdown files; no backend, frontend, Prisma, Railway, or Live Mirror paths are in the PR diff.
- Next: commit and push this resolution, then inspect the updated PR checks and mergeability.


## 2026-09-28 — Reply KPI cycle-level coverage correction

- Production validation showed the previous store-level proof rule was too strict: requiring every relevant chat to reach the global Sep 1 historical boundary resulted in 0/146 stores classified complete.
- Replaced chat-level coverage proof with response-cycle-level proof.
- A response cycle is KPI-eligible only when it has a human answer or its 24-hour SLA deadline has passed. Open cycles younger than 24 hours are excluded from the denominator.
- A <=24h human reply is a definitive successful outcome even without Manager historical proof.
- A failure (no reply within 24h or first reply after 24h) is considered proven only when Manager history reaches to/before the cycle start and the store has a successful Manager sync after the cycle's 24h deadline.
- Store coverage is complete only when all eligible cycles have proven outcomes; UI now shows covered/eligible cycle counts.
- No Live Mirror or Historical Mirror write-path code changed.


## 2026-09-28 — Monthly Report corrected to use completed Historical Timeline

- Corrected a source-of-truth mistake in Monthly Operations Report: reply KPI coverage must not be inferred from Live Mirror `LineChatMirrorChat` backfill markers after the Historical project has already delivered its own production read model.
- Monthly Operations Report now reuses `HistoricalTimelineService.replyAnalytics()`, the production-accepted service that merges `HistoricalTimelineMessage` with canonical `Message` data and suppresses exact source duplicates.
- Historical completion/read-model data is now the official source for monthly 24h reply KPI.
- Current-month reply KPI is conservatively cut off two Bangkok calendar days before today so every included chat has a fully elapsed 24-hour response window.
- Inbound/follower metrics continue through the current report date; only the SLA KPI uses the matured cutoff.
- Live Mirror reads remain diagnostic only and do not determine official reply coverage.
- No Historical import/backfill/crosswalk data and no Live Mirror worker/reconciler/write path were modified.


## 2026-09-28 — Historical reply evidence separated from responder identity

- Production Monthly Operations Report now has 146/146 Historical coverage, but the 24h reply rate remained implausibly low because Historical analytics only treated outbound rows with a non-auto `senderBizId` as replies.
- Historical archive evidence contains three outbound classes: known Manager responder, explicit auto-response, and outbound with no responder marker.
- Corrected SLA semantics: any Historical OUTBOUND text row that is not the explicit `__AUTO_RESPONSE` marker is reply evidence, even when responder identity is unknown.
- Responder attribution remains strict: rows without `senderBizId` increment unknown-responder counts and are not attributed to a staff identity.
- Canonical/current delivered outbound is reply evidence when delivered and non-automated, even if the internal sender mapping is absent.
- Added regression coverage for unknown-responder Historical replies and explicit auto-response exclusion.
- No Historical rows, crosswalks, Live Mirror state, or worker behavior changed.


## 2026-09-28 — Monthly 24h KPI moved to Historical response-cycle analytics

- Production validation after responder-evidence correction improved 24h KPI from 14.4% to 21.4%, but many stores still showed 0% because Historical reply analytics used one first-inbound/first-reply case per chat for the entire period.
- Added opt-in `RESPONSE_CYCLES` mode to `HistoricalTimelineService.replyAnalytics()`; the existing default remains `CHAT_FIRST_REPLY` for backward compatibility.
- Response-cycle mode treats consecutive inbound messages as one open cycle and closes it on the first non-auto reply. A later inbound burst in the same chat opens a new SLA cycle.
- Monthly Operations Report now explicitly requests `RESPONSE_CYCLES` for month and focus-period KPI.
- Historical/canonical merge and exact source deduplication are unchanged.
- Added regression coverage for multiple cycles in one chat, consecutive inbound collapse, auto-response exclusion, and unknown-responder reply evidence.
- No Historical data, crosswalks, Live Mirror worker, or write path changed.


## 2026-09-28 — Historical reply analytics now consumes proven crosswalks

- Production Monthly Operations Report still showed many zero 24h reply stores despite complete Historical collection.
- Root cause: `HistoricalTimelineService.replyAnalytics()` grouped Historical and canonical messages only by raw Store/OA/`lineChatUserId`, while the final Historical delivery proved many identities require `HistoricalConversationCrosswalk` `LINK_SAFE` mappings or exact source-event anchors.
- Added read-only grouping priority for reply analytics: LINK_SAFE canonical conversation, exact source-event anchor, direct Store/OA/chat match, then virtual Historical chat.
- Canonical conversations with any activity in the response window are now eligible for merge, not only those with canonical inbound rows in the report interval.
- Added diagnostics for crosswalk-linked, source-anchored, direct-linked, and virtual Historical rows.
- Added regression tests for differing Historical/canonical chat IDs joined by LINK_SAFE and for exact source-event anchor merging.
- No crosswalks, Historical rows, canonical messages, or Mirror state are modified.


## 2026-09-28 — Monthly 24h KPI audit harness

- Added a manual, read-only KPI audit flow for Monthly Operations Report.
- The audit uses a stratified sample of up to 20 stores across high/mid/low/zero reply-rate buckets.
- HistoricalTimelineService can now return a bounded cycle-evidence sample (max 100) without raw customer text or customer identifiers.
- Each sampled cycle records timestamps, outcome, source, responder-known state, and merge path (canonical/crosswalk/source-anchor/direct/virtual).
- Monthly audit recomputes each sampled store through the same Historical response-cycle engine and checks aggregate parity with the report plus structural validity of sampled cycles.
- Added a Run KPI Audit button/panel to the Monthly Operations Report UI. The endpoint is on-demand only and does not add work to normal report loads.
- No Live Mirror/Historical Mirror collection, persistence, crosswalk writes, or worker behavior changed.


## 2026-09-28 — Zero-rate 24h KPI forensic audit

- Added a manual read-only forensic flow for stores whose official 24h reply rate is 0% despite complete Historical coverage.
- The flow inspects up to 10 highest-volume zero-rate stores and recomputes Historical response-cycle analytics per store.
- It classifies each store as NO_ELIGIBLE_CYCLE, REPLY_OVER_24H, AUTO_ONLY, NO_REPLY, OUTBOUND_OUTSIDE_CYCLE, UNMAPPED_OR_VIRTUAL, or UNEXPECTED_WITHIN_24H.
- Historical evidence counts include inbound, explicit auto outbound, non-auto outbound, and unknown-responder outbound within the matured KPI window.
- The UI shows the per-store cause, response-cycle totals, late/pending counts, Historical outbound counts, auto-response counts, and remaining virtual Historical rows.
- Added deterministic regression tests for the forensic classifier.
- No Monthly KPI formula, Historical data, crosswalk, canonical message, or Mirror worker state is modified.


## 2026-09-28 — Historical reply analytics normalized by current LINE OA identity

- User-provided Manager recording for OPPO Central Nakhon showed clear human replies on Sep 26 despite Monthly Report classifying the store as 0/83 and Zero-Rate Forensics reporting Hist Outbound = 0.
- Root cause identified in read analytics: Historical rows and crosswalks were hard-filtered by the current Store.id. Historical imports can retain a legacy Store.id while preserving the same LineOfficialAccount.id, causing valid Historical outbound evidence to be excluded from current-store analytics.
- Reply analytics now resolves active STORE OAs for the current report scope and uses LineOfficialAccount.id as the historical read identity.
- Historical rows/crosswalks/conversations are normalized back to the OA's current Store.id for aggregation.
- Added regression coverage proving a Historical row under a legacy store ID joins a current-store canonical reply through the same OA and produces a <=24h response cycle.
- No Historical rows, crosswalks, Store records, OA assignments, or Mirror worker state are modified.


## 2026-09-28 — Historical SLA reads include stable OA alias families

- Production validation showed OPPO Central Nakhon still at 0/83 after Store.id normalization even though LINE Manager visibly contained human replies.
- Follow-up root cause: Historical rows can be attached to an older LineOfficialAccount database row while the current store uses a newer OA row for the same real LINE OA.
- Historical reply analytics now builds a fail-closed OA family from stable identifiers (basicId, channelId, destinationId), includes matching archived/legacy OA records in read scope, and normalizes those aliases back to the current OA/current store before cycle aggregation.
- Historical read queries no longer require the legacy OA row itself to be active/unarchived.
- Zero-Rate Forensics now reuses Historical reply analytics evidence counts instead of issuing a separate Store.id-scoped Historical count query.
- Added regression coverage for current OA + legacy OA record with the same basicId.
- No OA records, Historical rows, crosswalks, Store mappings, or Mirror workers are modified.

# 2026-09-30: Full-fleet Live Mirror canonical parity — PR #416 review

- **Scope / branch**: Continue existing `fix/full-fleet-mirror-parity` and PR #416. Implementation, local validation, commit/push, and PR updates authorized; merge and deployment held. Unrelated dirty main checkout preserved.
- **Reviewed implementation**: Effective reconciliation scope unions active Mirror codes with additive recovery codes and excludes those codes from dry-run. More than 32 apply stores cap per-store work at 100, preserving configured/hard bounds for smaller scopes. PENDING outbound precedes other PENDING and retries; retry ordering uses oldest updatedAt. Recent stale probes use a bounded 2-minute default, 60-second–60-minute configuration limits, changed-chat priority, 24-hour activity priority, and oldest successful-history rotation under the existing per-cycle budget. Historical/backfill paths unchanged.
- **Follow-up**: Make the effective batch explicit in startup telemetry. Add service-level tests for the 136-store cycle, canonical delivered outbound and Manager attribution, reply/follow-up recomputation, repeat idempotency, mapping/content/external-ID conflicts, dry-run isolation, and stale equal-timestamp history persistence. Existing tests retained.
- **Checks passed**: Focused mirror/reconciler 49/49; touched-file ESLint; production TypeScript (`tsconfig.build.json`) and backend build; diff check. Built worker started on local port 3001 against a disposable synthetic PostgreSQL database with background operations disabled; `/internal/health` returned 200 with no startup errors. Real Prisma canonical-import test produced one delivered outbound, REPLIED/COMPLETED state, and exactly one outbound after repeat reconciliation.
- **Broader baseline failures**: Full backend suite 2,416 passed / 20 failed / 1 skipped (2,437 total). The unmodified PR base 840c7b5c has the identical 20 failing test names, 2,406 passed / 20 failed / 1 skipped. Broader targeted regression set 190/191 passed; its historical analytics fixture failure also exists on the base. Whole-tree TypeScript including all test fixtures reports 346 pre-existing errors, identical to base after path normalization; no touched-file diagnostic. Missing Vitest packages, stale test mocks/fixtures, and an unchanged Docker archive assertion are among baseline failures. They are not suppressed or repaired in this focused PR.
- **CI blocker**: Existing GitHub Actions run 36678217693 never executed job steps: account payments failed or spending limit needs increase. No billing/workflow bypass attempted. Push will request the normal PR checks; exact outcome must be reported.
- **Next action**: Publish this focused follow-up to existing PR #416, inspect its new checks, then stop before merge/deployment. No new required production variable: optional `LINE_CHAT_MIRROR_OUTBOUND_REFRESH_INTERVAL_MS` defaults to 120000. Existing reconcile enable/apply/since settings remain required.
- **Prepared production acceptance (not executed)**: After separately authorized merge/deploy, verify worker count equals active allowlist; reconcile count equals the deduplicated worker/recovery union with apply=true and configured/effective batch telemetry. Audit all eligible stores, using 28220 as forensic canary: Manager history, Mirror rows, canonical timeline, and Store Chats must agree. Observe an independently occurring human Manager reply whose chat-list timestamp stays unchanged; verify bounded refresh discovers it without another inbound and projects REPLIED/follow-up state. Check duplicate canonical rows=0, aggregate PENDING/WAITING_CANONICAL/UNMAPPED/AMBIGUOUS/FAILED, and list every remaining blocked store/conversation. Record real discovery/reconcile cycle timing: the refresh interval is eligibility timing, not a two-minute fleet latency guarantee. Observe browser/PID/resource/auth health and compare Historical state unchanged. No customer messages should be sent for acceptance.

## Full-fleet Live Mirror completion follow-up (local-first)
- Started from merged main `83f3924925802c9fbd5087fde3191b379c3408ed` on `fix/full-fleet-mirror-completion`; unrelated primary checkout changes are untouched.
- Completed READ ONLY production forensics; sanitized raw evidence stays in gitignored `backend/local-data/completion-forensics`.
- Root counts: 176 UNMAPPED (138 have no Manager inbound evidence; 38 have inbound evidence but no exact canonical ID mapping); 76 WAITING_CANONICAL (none matched canonical rows across current or stable-key OA family). No safe identity or inbound fabrication is justified.
- Timestamp cohort: 32 failed outbound maxima, 3 subsecond inbound differences, 1 stale delivered outbound projection; all are unlinked to a Mirror canonical conversation, so generic projection repair remains out of scope.
- Collection evidence: 118 production store cycles p50 19.95s, p95 22.37s, ~44.8 minute serial fleet estimate. Persisted profile assignments are incomplete; no concurrency expansion.
- Implemented bounded bulk Live Mirror event persistence, retry backoff that preserves retry timestamps for unchanged mirror events, stage/fleet metrics, and hashed natural Manager-only outbound correlation logs.
- Validation currently: focused suites 53/53 pass; synthetic PostgreSQL bulk insert/update/idempotency/status preservation/retry watermark passes; backend production TypeScript build passes. Continue broader regressions, build, lint, diff review, then commit/push/PR if publication is available.
- Read-only follow-up at 08:10 UTC: 2997, 27349, and 18572 all show SUCCESS and have cleared lastErrorCode; failure timestamps remain as history. Active configured-fleet session attachments: 6 account-1, 1 profile-b, 129 unassigned.
- Newer `origin/main` arrived as 99297094 during final checks; its changes touch UI plus AI_PROGRESS.md only. Rebase the one reviewed local commit onto 99297094 before publication; re-run focused/build/lint/diff after replay.
- Broader selected tests: 178/182; four failures reproduce at untouched 83f39249 baseline. Full suite: 2,420/2,441 pass, 20 known baseline failures, 1 skipped. Worker test-mode health returned 200 on the disposable local DB.
- Rebase completed on `992970944862266d69fa6c269a39c530fb83f191`; final implementation commit is `81ccdf3d04494108251b017b9084f38f0169fcad` (`fix(line-chat): reduce full-fleet mirror reconciliation overhead`). Rebased focused tests 53/53, TypeScript, build, touched lint, diff check, synthetic DB test, and worker test-mode health all pass.
- Pushed normally to `origin/fix/full-fleet-mirror-completion`; remote head SHA verified. Opened Draft PR #419: https://github.com/supersunxm/line-unified-inbox/pull/419. No merge/deploy/production changes. Next: review remaining identity/webhook evidence and collect deployed stage timings after separate authorization; parity remains incomplete.

## PR #419 live-parity review follow-up (2026-09-30)
- Reviewed the existing persistence, retry, observation, and fleet telemetry changes. Bulk persistence is parameterized and chunked at 100 rows; conflict updates preserve firstSeenAt and reconciliation fields, always refresh lastSeenAt, and leave updatedAt unchanged when payload columns match. Manager message IDs remain the unique idempotency key.
- Retry policy keeps recent unresolved events and events with fewer than three attempts eligible, prioritizes pending outbound, and applies six-hour retry spacing only to old unresolved rows. It never marks old rows resolved; imported rows are outside the retry query. Changed source payload advances the retry watermark.
- Removed a raw OA identifier from the new history-shape telemetry, normalized profile labels to A/B, bounded previous-chat lookup to the recent 125 chats, and limited detailed Manager-only/canonical correlation logs to ten per store cycle. The bounded observation lookups are best-effort and cannot fail a successful collection/reconcile cycle; reply-state logs use one batched lookup.
- Added an authenticated GET-only read-only live-parity audit at `/internal/line-chat/mirror/live-parity-audit?watermark=<ISO timestamp>`. The caller must pass the actual worker deployment/start timestamp with timezone. It uses inclusive Manager `sentAt`, scopes to the configured fleet's latest enabled OA attachment, reports successful post-watermark store-cycle coverage, and keeps pre-watermark UNMAPPED/WAITING_CANONICAL counts separate. The response contains only aggregate counts and reply-state buckets; it does not expose event, OA, or customer identifiers.
- Store Chats visibility is reported as canonical outbound messages joined to a store-scoped conversation; it is a persistence/eligibility signal, not a browser screenshot or authenticated UI-session assertion. Natural Manager-only refresh remains an independent runtime observation.
- Validation on this follow-up: Mirror/reconciler/persistence/audit focused tests 60/60 pass; touched-file ESLint and `npm run build` pass. The aggregate audit SQL executed successfully on a disposable local PostgreSQL 16 database with synthetic-only fixtures; the container was stopped and removed afterward. `git diff --check` passes.
- Historical regression selection is 30/31: one existing source-event-anchor expectation fails in `historical-timeline.service.spec.ts`; no Historical source or behavior file is touched, and this same failure was recorded in the prior unchanged-main baseline. Full backend suite is 2,426/2,447 with 20 failures and 1 skipped; the 20 failures match the previously recorded baseline set, including the same Historical expectation.
- No production query, deployment, migration, mutation, or customer communication was run in this follow-up. Keep the PR Draft and do not merge or deploy while updating its narrower title/body; the full-suite baseline failures mean the prompt's all-local-checks-passing condition for Ready is not met. Historical evidence debt remains separately reported and is not to be force-resolved.

## 2026-10-01 — GitHub Android CI cleanup

Isolated CI-only change deletes 32 Android-only workflows and removes two Flutter jobs plus app-only auth scope from three mixed workflows. Backend/frontend/web validation and CI Gate are preserved. Actionlint and workflow dependency/preserved-job checks pass. No Railway, database, Mirror/worker or Manager profile change. Publish through a dedicated PR and delete obsolete signing secrets only after successful CI and default-branch verification.

## 2026-10-01 — P0 Operations Health UI restoration

Scope: health-only frontend publication based on current main 182c9ec1. Preserve the auth-user store and dashboard observer fixes from PRs #423/#424, and all tracked APK download assets. The earlier direct health deployment was replaced by unrelated main deployments; an oversized source upload was rejected, so the user explicitly authorized commit/push/PR/merge through existing Git autodeployment.

The backend enum-compatible Live lease read and passive worker browser/cycle telemetry are already deployed. Display actual Profile A/B session/browser state, Live fleet scope, cycle outcomes/timestamps, and freshness. Missing or incomplete worker/profile telemetry displays UNKNOWN/STALE rather than inferred Healthy. Relabel the separate nickname pilot audit accurately.

Local validation on the exact current-main frontend plus this patch: health/auth-user/dashboard tests 39/39 pass, touched-file ESLint passes, webpack production build passes. The existing next/font dependency required network access. Scoped TypeScript diagnostics are in unchanged transitive auto-response, broadcast and follower-insights modules; Unchanged-base comparison produced identical diagnostics (four errors in three untouched transitive modules); zero new diagnostics from this patch. No lint/type suppression or build setting was added.

Live worker continues independently at 146 configured unique active OA identities. All ten additions completed successful NORMAL collection; nine have inbound canonical duplicates and newly imported outbound messages at the correct Store/OA. Thalang has no eligible recent activity. First full cycle: 146 attempted, 135 success, 11 temporary coordinator-busy partials, zero failed/skipped. Automatic retries are being observed. No Historical behavior change or LINE sends.
