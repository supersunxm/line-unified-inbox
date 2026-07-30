# AI progress

## Current task

Completed a focused conversation-list information hierarchy refinement without changing filters, pagination, selection behavior, routing, pane resizing, APIs, authentication, or backend logic. The sole active `/chats` branch uses the dynamic list title, localized additional-filter label, customer/message/store-time hierarchy, and three-tag cap with accessible overflow while omitting normal priority. Selected conversation rows now use a pane-scoped stronger semantic background and four-pixel blue inset accent.

Runtime tracing confirmed `/chats` directly renders `ApplicationWorkspace` from `page.tsx`, there is no duplicate conversation-list branch, and PID 89210 serves port 3000 from this repository's frontend directory. An isolated authenticated headless Chrome session verified the actual rendered DOM rather than inferred source: Incoming, Follow-up, and Reminded each render their matching Thai headings; Incoming renders `กรองเพิ่มเติม`; the visible normal-priority count is zero; high priority remains visible; and the selected row exposes its selected marker and scoped styling class.

Verification passed: frontend TypeScript, zero-warning ESLint, 169/169 tests, and production build. Focused tests cover title selection, exact active-header wiring, exact active-row priority rendering, stable semantic attributes, result-count wiring, three-tag overflow, selected-row state, scoped accent styling, and pagination containment.

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
