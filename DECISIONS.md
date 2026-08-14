# Store Master ID Business Key Propagation (2026-08-14)

- **Strict Identity Architecture**:
  - `Store.id` remains the immutable internal system UUID for internal database relations and foreign keys.
  - `StoreMaster.externalStoreId` is the business Store ID imported from the master file.
  - All public API models, views, and exports expose `storeId` as the business Store ID (`StoreMaster.externalStoreId ?? null`) while preserving `id` UUID for component keys and mutation IDs.
  - Unlinked stores return `null` / empty string `""` in exports; under no circumstance is an internal UUID, auto-increment integer, or fallback store code substituted into the Store ID field.
- **Universal Export Standardization**:
  - All CSV and XLSX reports containing store data place `Store ID` in Column 1, followed by `Store Name`.
  - Applied across LINE OA Management CSV export, Follower Insights Store Breakdown CSV export, and Friend Source Links Excel workbook (both Store Distribution and Link Details worksheets).

# OTP generator dependency injection

- Function-typed constructor dependencies are never resolved by Nest through reflected runtime metadata. `OtpChallengeService` injects the explicit `OTP_CODE_GENERATOR` symbol, and AuthModule supplies the generator through a `useValue` provider. This keeps OTP generation testable without treating JavaScript's `Function` constructor as a provider.

# Smart Product Review Queue & Fast Human Operations (2026-08-09)

- **Deterministic Review Classification Hierarchy**: Conversations with inbound text are classified into 6 mutually-exclusive priority tiers without running ML models:
  - `P0 UNCLASSIFIED`: Inbound text present but 0 product tags.
  - `P1 AMBIGUOUS / CONFLICT`: Multiple product models attached to conversation.
  - `P2 LOW CONFIDENCE`: Single RULE product with confidence $< 0.85$ or `COMPACT_ALIAS` match.
  - `P3 SERIES ONLY`: Generic/family series tag (`OPPO Reno Series`, `OPPO Pad Series`, etc.).
  - `P4 RECENTLY REVIEWED`: Conversation verified by human (`MANUAL` tag or "No product confirmed" in `ActivityHistory`). Excluded from default review queue.
  - `P5 GOOD`: Specific high-confidence model prediction. Excluded from default review queue.
- **Three Fast Human Actions**:
  - **Confirm (C)**: Converts existing RULE prediction to `MANUAL` (permanently protected) and logs `Product tag confirmed: [model]` in `ActivityHistory`.
  - **Correct (E)**: Replaces tag with selected `ProductModel` (`source: MANUAL`) and logs structured correction metadata into `ActivityHistory` feeding `ProductCorrectionInsightService`.
  - **No Product (N)**: Removes all product tags and logs `No product confirmed` in `ActivityHistory` to distinguish deliberate no-product state from unclassified state.
- **Zero Database Migrations**: Derived entirely from existing `ConversationProduct`, `ActivityHistory`, `Conversation`, and `Message` tables.
- **Ultra-Fast Operations UX**: Single-item review time designed for 3–5 seconds using keyboard shortcuts (`C`, `E`, `N`), optimistic item removal, per-store filtering, and live counter updates without full page reloads.

# Product Feedback Loop & Human-in-the-Loop Learning (2026-08-09)

- **Zero Schema Change Correction Extraction**: Reconstructs complete structured correction events (`predictedModel`, `correctedModel`, `matchedPhrase`, `detectionMethod`, `sourceMessageId`, `sampleText`, `correctedAt`, `actorName`) entirely from existing `ActivityHistory`, `ConversationProduct`, `Message`, and `ProductModel` tables without adding new database tables.
- **Strict Multi-Gate Alias Recommendation Criteria**: Alias recommendations require: (1) `correctionCount >= 3`, (2) dominance $\ge 80\%$, (3) not already active in `ProductAlias` or `PRODUCT_CATALOG`, (4) not blocked or review-required generic phrases, and (5) zero keyword collisions across multiple model series.
- **Safe Human Approval Workflow**: The system strictly prepares recommendations as candidate payloads (`{ model, alias, language, safety: "SAFE_EXACT" }`) for human review and benchmark evaluation. Under no circumstance does the AI automatically mutate `PRODUCT_CATALOG` source code without explicit developer/admin approval.
- **Statistically Grounded Accuracy Reporting**: Implemented a minimum threshold (`minimumCorrectionsForReliability = 10`). When correction volume is below 10, the system explicitly returns `"Insufficient production correction data"` rather than displaying fabricated or statistically ungrounded accuracy metrics.

# Product Intelligence Stabilization & Production Validation (2026-08-09)

- **Independent Golden Benchmark & Zero Modification Rule**: Created `product-golden-evaluation-cases.ts` with 184 cases strictly reflecting real-world business meanings rather than matcher quirks. Evaluates exact product matching, suffix safety, phone-with-accessory prioritization, and 48 competitor/false-positive rejection cases without mutating expected answers to fit engine limitations.
- **Product vs. Accessory Intent Hierarchy**: When a customer inquiry references both a specific device model and an accessory (e.g. `"เคส Reno16 Pro"`, `"ฟิล์ม Find X9"`), the device model (`OPPO Reno16 Pro 5G`, `OPPO Find X9`) takes precedence as the primary ProductModel (score 300 > 250), while the accessory category (`Case`, `Film`) is independently detected by the Topic/Intent engine. Generic accessory models (`OPPO Case`, `OPPO Charger`) are matched only when no specific device model is mentioned.
- **Reproducible & Idempotent Catalog Bootstrapping**: `scripts/bootstrap-product-catalog.ts` provides a self-healing bootstrap mechanism from code alone (`PRODUCT_CATALOG`). It matches existing database aliases by normalized key and canonical owner, adopts approved `MANUAL` records to `CATALOG` source, creates missing models and aliases, preserves non-catalog/blocked manual aliases, and produces zero mutations on repeated executions.
- **Authoritative Manual Overrides & Feedback Loop**: `updateManualTags` enforces absolute priority of `MANUAL` tags over `RULE` predictions, cleans up superseded rule rows, and records `CLASSIFICATION_UPDATED` entries in `ActivityHistory`. Future bulk or single-conversation re-analyses strictly respect manual tags and never overwrite human corrections.

# Dashboard Executive Overview Architecture and Data Correctness (2026-08-08)

- **Information Architecture & Executive Scanning**: Rebuilt the executive overview into a 4-level visual hierarchy allowing managerial situation awareness within 5–10 seconds: (1) 5-card KPI row (Messages Today, Pending, SLA Achievement, Stores Critical, Followers), (2) 60/40 Operational Trend (7-day volume trend + reconciled BM reply status donut), (3) Top 10 vs Bottom 10 store follower ranking, and (4) Follower distribution summary with ratio gap and proportional comparison bar.
- **Data Correctness & Unit Safety**: Health Score is strictly bounded in `[0, 100]` with unit normalization preventing 100x over-multiplication. Reply rate / SLA percentages guard against zero denominators with finite rounding. 7-Day Trend queries a dedicated 7-day conversation window (`gte: sevenDaysAgo`) regardless of active period ("today", "7d", "30d") to ensure complete 7 calendar-day buckets in Asia/Bangkok date alignment without missing past-day values.
- **Duplicated Hero Store List Removal**: Removed redundant store-by-store queue panels from dashboard presentation (`TodayActionCenter`, `AiRootCauseAnalysisPanel`, `AiActionCenterPanel`, `AiImpactDashboardPanel`, `AiOperationalMemoryPanel`, `AiExecutiveDailyBrief`, `AiBiAssistantPanel`, `OperationalInsightCard`) while retaining all underlying Phase 3 AI services, backend endpoints, and Prisma models intact.
- **Store Follower Ranking Provenance**: Follower rankings derive exclusively from real `LineOaFollowerSnapshot` records associated with active, non-archived stores, without placeholder or fabricated follower metrics.

# Classification Insights current-state boundary (2026-07-30)

- Phase 1.5 reports only the current persisted classification state. Coverage is based on active-store conversations with at least one inbound text message and is explicitly not an accuracy measurement.
- The read-only endpoint uses aggregate queries and a 25-row operational review queue. It excludes message content and customer identity while retaining store, LINE OA, intent, priority, topic, and conversation-link context.
- RULE, MANUAL, and mixed-source conversations are counted distinctly. Product ranking counts unique conversation/model rows, and empty denominators return null percentages or a zero coverage KPI.
- Historical quality, correction rate, failed classification attempts, and model drift remain out of scope until immutable classification-run and feedback events exist.

# ProductAlias provenance and reconciliation (2026-07-30)

- Alias provenance is explicit: version-controlled aliases use `ProductAliasSource.CATALOG`; operator/database aliases use `ProductAliasSource.MANUAL`.
- Existing rows migrate conservatively to `MANUAL`. Catalog synchronization never silently converts a manual row, and a same-normalized-key ownership conflict fails before catalog mutation.
- Reconciliation manages only `CATALOG` rows. Stale catalog aliases are deactivated rather than deleted, restored catalog aliases reactivate, and manual aliases remain untouched.
- Manual, unknown-source, and catalog-unknown aliases fail closed as `REVIEW_REQUIRED`. Every matcher call path must attach safety metadata; missing safety is never treated as exact-safe.
- Phase 1 ownership adoption is an explicit, reviewed operation over a version-controlled 75-row manifest. It validates immutable row identity, canonical owner, normalized key, active state, source, safety, and uniqueness before changing only provenance in one transaction.
- Broad family and generic accessory phrases remain manual and non-matching unless OPPO context is present. In particular, bare `สาย Type-C` and `คีย์บอร์ดแท็บเล็ต` are blocked; their reviewed production rows are excluded from adoption.
- Runtime-safe aliases may be excluded from persistence when synchronization would create an unapproved new production row. This keeps deterministic brand-qualified matching while constraining the first sync to the single approved `a6pro5g` creation.

## Frontend Global Application Shell & Navigation (Phase 1)

The frontend application uses a single global application shell (`AppShell`) wrapping every route. Primary top navigation (`TopNavigation`) manages all 5 top-level modules (`/dashboard`, `/chats`, `/stores`, `/follower-insights`, `/friend-source-links`) with neutral/blue active navigation selection (`aria-current="page"`) and semantic design tokens, eliminating green from primary selection states. Layouts are standardized into container primitives (`PageContainer`, `PageHeader`, `SectionHeader`) with 3 specific variants: `readable` (`max-w-7xl`) for reports and insights, `wide` (`max-w-[1440px]`) for Store Management, and `full` (`w-full h-full`) for the Conversations workspace. The contextual sidebar (`ContextSidebar`) is rendered exclusively on `/chats` for status filters and store filter selection, while permanent sidebars are removed from all other pages.

The chats workspace owns its five-track layout rather than placing chat-specific behavior in `PageContainer`: contextual sidebar, sidebar separator, conversation list, conversation separator, and conversation detail are direct children in that order. At the existing intermediate breakpoint the hidden separators leave three horizontal pane tracks; at the existing narrow breakpoint the identified detail pane spans the row. `SidebarView` is owned by the shell layer so shell components never import the application page module.

## Database-driven Multi-store LIFF Attribution Configuration

Attribution tracking uses a per-LINE-OA configuration model (`FriendAttributionConfig`) stored in PostgreSQL, allowing each store/OA to be configured independently with its own LINE Login Channel ID and LIFF ID without source code changes or environment redeployments. Public short link redirects query `FriendAttributionConfig` for the link's `lineOaId` to route customers to the correct store LIFF app (`https://liff.line.me/{liffId}/?token=...`), while falling back to direct LINE OA destination URLs (`https://line.me/R/ti/p/@...`) when attribution is unconfigured or disabled. `identifySession` strictly resolves the session's specific `lineOaId` configuration and validates that the LINE Login ID token audience (`aud`) matches that OA's registered Channel ID, rejecting cross-OA tokens with HTTP 401. To ensure smooth pilot transition, legacy environment variables (`FRIEND_ATTRIBUTION_PILOT_LINE_OA_ID`) act as an automatic fallback when database configuration is absent.

## LINE OA create webhook contract

The persisted webhook key is generated before LINE OA creation and written atomically with the OA. The create response derives its canonical URL from that freshly persisted key and validated `PUBLIC_WEBHOOK_BASE_URL`; the frontend treats this response as authoritative and does not issue a second webhook-info request. Unique-key collisions alone are retried, while invalid configuration or failed persistence aborts creation. Stable keys are never generated during reads or edits, and legacy null/blank records are repaired only through an explicit maintenance command.

## Inbound LINE media

Image bytes are never stored in PostgreSQL. An idempotent one-to-one `MessageMedia` row records processing metadata while a storage abstraction writes bytes to an ignored local directory in development or an S3-compatible bucket in production. Webhook message persistence and the PENDING media record are transactional; bounded LINE download and storage then update the row to READY or FAILED without converting media failures into webhook failures. Browsers fetch READY images only through an authenticated ADMIN endpoint, which streams private bytes without disclosing object keys or storage paths.

## Frontend relative time

Relative time is derived at render time from the original API timestamp and the browser clock, without fixed timezone offsets. One formatter owns Thai, English, and Chinese output and uses elapsed-duration thresholds: 60 seconds, 60 minutes, 24 hours, 30 days, and 365 days. Conversation mapping preserves timestamps instead of prematurely reducing them to minute counts, so every relative-time surface follows the same rules and invalid values can safely render as `-`.

## Store Master-backed LINE OA creation

The Connect LINE OA form keeps Store Master selection as a reference in the existing `CreateLineOaInput` (`storeMasterId` plus `storeId` when already linked) rather than copying master data into a new frontend or backend model. The backend remains responsible for reusing or linking the existing store and for credential encryption and webhook generation. Manual creation remains available when no result is selected. Every non-empty ACCOUNT NAME query is eligible for a 300 ms debounced search, and the UI only declares a no-match after that exact query completes successfully.

## Temporary Railway pilot administrator bootstrap

Pilot administrator seeding is an application-startup provider, not an HTTP endpoint, and requires all three gates: production, pilot mode, and explicit bootstrap enablement. It targets only the normalized configured username, hashes the environment-supplied password through the normal password service, and fails on an internal-email collision rather than adopting a different user. Disabling bootstrap stops all mutation while leaving the verified database account available through the unchanged login/session flow.

## Frontend theme resolution

The frontend stores the explicit `light`, `dark`, or `system` preference under `oppo-line-oa-theme`, while `html[data-theme]` is the only theme selector and always contains the resolved visual mode. Each change synchronously removes legacy root theme classes and the previous attribute before applying the new value. A small blocking script performs the same cleanup before body paint; the React provider owns persistence and one live operating-system listener. Core interactive surfaces use paired semantic light/dark tokens rather than depending on the absence of dark declarations.

## Frontend primary information architecture

Dashboard and Store Management have separate App Router URLs (`/dashboard` and `/stores`) while reusing the existing authenticated application component to avoid duplicating its data and session lifecycle. Dashboard owns monitoring, follow-up, activity, and operational views. Store Management owns LINE OA connection, store search, archived-store recovery, store-level actions, and the contextual connect action. Route-derived state overrides stale saved sidebar choices so refresh and browser navigation cannot expose store-management actions on Dashboard.

## Project-local runtime ownership

Development processes started by automation use PID files and logs under ignored `.runtime/`. Scripts validate both command identity and repository working directory before stopping a process. This prevents accidental termination of unrelated Node services.

## Fixed local ports

Backend and frontend use only ports 3001 and 3000. Port conflicts are reported rather than silently selecting another port, keeping tunnel and API configuration deterministic.

## Safe diagnostics

Diagnostic bundles contain status, versions, sanitized log tails, and diff summaries. Environment-file contents and credential-bearing values are excluded and common secret patterns are redacted.

## Conversation classification precedence

Automatic classification evaluates the accumulated inbound text after every inbound text message so intent can emerge across multiple messages. Rule-generated product/topic rows are replaced on re-analysis, while `MANUAL` rows and manual priority remain authoritative and unchanged. Explicit purchase language and combined stock/commercial questions raise purchase intent and suggested priority consistently across Thai, English, and Simplified Chinese.

## Canonical LINE webhook identity

LINE events are accepted only at `POST /webhook/:webhookKey`. The persisted unique OA key resolves the OA and its encrypted Channel Secret before exact raw-body signature verification. Destination-based and environment-secret fallbacks are intentionally unsupported because they can select the wrong OA or conceal stale LINE Developers URLs. Normal requests, edits, builds, and restarts never mutate the key; only the explicit regeneration action may replace it.

## Railway backend deployment

Railway uses `backend` as the service root rather than a repository-level Dockerfile. Builds install development build tooling, generate Prisma Client, and compile NestJS; pre-deploy uses `prisma migrate deploy`; runtime uses only compiled `dist/main.js`. Production startup validates database, origin, webhook, encryption, pilot, email, and development-admin settings before listening.

## Temporary cross-site authentication

Production session cookies are opaque random tokens stored hashed in PostgreSQL and use `HttpOnly`, `Secure`, and `SameSite=None` for the temporary localhost-to-Railway pilot. CORS accepts only `FRONTEND_URL`. Browser third-party-cookie restrictions can still make this topology unreliable, so deploying the frontend under HTTPS on the same site is the recommended next step; cookie security must not be weakened.
# Product classification catalog (2026-07-20)

- Reused ProductSeries as the product family and ProductModel/ProductAlias as canonical model/aliases; ProductGroup is metadata on ProductSeries. This avoids a competing taxonomy.
- Catalog synchronization is additive and idempotent. It updates catalog-owned records but never deletes conversations, manual classifications, or unrelated catalog data.
- Automatic analysis stores one primary match with confidence and evidence. Specific model matches outrank family/generic mentions regardless of recency, while recency breaks ties at the same specificity.
- Any MANUAL conversation product is authoritative. Re-analysis refreshes RULE records only and does not add an automatic product beside a manual choice.
# Optional inbound media storage (2026-07-20)

- Inbound media retention is opt-in through `MEDIA_STORAGE_ENABLED=true`; absence and `false` both mean disabled. This prevents an optional subsystem from blocking core text webhook processing.
- Image message metadata is always recorded. When retention is disabled, `MessageMedia.processingStatus=SKIPPED` documents the intentional outcome and no LINE content request or storage call occurs.
- Production still rejects local storage and incomplete or obvious placeholder S3 configuration whenever the feature is enabled.
# Conversation LINE OA Manager action (2026-07-20)

- The translation toggle remains local UI state and is not reused for navigation.
- Manager navigation accepts only HTTPS URLs whose exact hostname is `manager.line.biz`, preserves any stored supported path, and does not construct undocumented chat parameters.
- Because no reliable customer-specific chat URL exists in the current data model, the action opens the stored account-level URL and copies the selected customer's display name for manual search.
# Store Master refresh identity and sync (2026-07-20)

- `externalStoreId` is authoritative for imports when present; sheet row number remains the fallback only for incomplete records without a stable ID.
- Connected LINE OA credentials are not copied into or updated by Store Master synchronization. The command updates only Store name/region/province and its Store Master relation.
- Account name, LINE ID, public LINE URL, and manager URL remain normalized master-owned fields and are resolved through the relation, avoiding stale duplicate columns.
# Canonical LINE OA Manager URL resolution (2026-07-20)

- Both store-management and conversation APIs use the same server-side resolver: newest active Store Master URL by stable `Store.code`, connected Store Master relation as fallback, otherwise null.
- Only validated HTTPS `manager.line.biz` account URLs leave the backend. The frontend consumes the resolved field and does not independently reconstruct links.
# Safe conversation response projection (2026-07-20)

- Conversation APIs never serialize a full Prisma `LineOfficialAccount`. They return an allowlisted metadata object containing only ID, name, Basic ID, connection status, active state, and last webhook receipt time.
- Webhook keys and encrypted/plain credential fields are excluded at the backend serialization boundary, not merely ignored by frontend types.
- `resolvedLineOaManagerUrl` is a top-level conversation field produced by the shared canonical resolver for both list and detail responses.
# LINE OA navigation rollback (2026-07-20)

- Conversation navigation uses only the canonical validated `resolvedLineOaManagerUrl`: latest Store Master URL first, connected Store Master relation second, otherwise null.
- Automatic bot-info and `chat.line.biz` navigation are disabled. The additive `lineChatWorkspaceUrl` database field and migration remain in place but are intentionally unused so the experiment can be revisited without destructive schema changes.

# Primary application workspaces (2026-07-20)

- Dashboard, Store Chats, and Store Management are distinct routes backed by one authenticated application workspace component. This preserves established fetching, auth, translation, theme, and mutation behavior without duplicating stateful business logic.
- `/chats` query parameters are the shareable source for operational filters and selected conversation; local preferences continue to preserve language and non-route UI preferences.
- `/` redirects to `/dashboard`. Dashboard cards and store actions deep-link to filtered `/chats` or `/stores` routes instead of switching hidden views inside the current page.

# Bounded conversation query architecture (2026-07-21)

- Conversation list serialization is database-free. Stable store codes are deduplicated and resolved by one Store Master batch query, then every row uses an in-memory map with the connected relation as fallback.
- List responses intentionally include only one latest message, note, and activity entry per conversation; full message history remains on the paginated conversation messages/detail flow.
- PrismaService is provided once by a global PrismaModule. Feature modules must inject that shared client rather than declaring new PrismaService providers and additional connection pools.

# Resizable Store Chats workspace (2026-07-21)

- Persist only the sidebar and conversation-list widths under `oppo-line-oa-chat-layout-v1`; the detail pane always consumes the remaining width and retains a 520px minimum.
- The first separator redistributes the fixed combined width of the first two panes, while the second changes the conversation-list width subject to the available detail width. This keeps dragging predictable without changing application filters or conversation selection.
- Saved widths are restored after hydration and accepted only when both values satisfy current bounds. Invalid or malformed values fall back to 240px and 340px defaults.
- Resizing is disabled below 1120px in favor of deterministic tablet/mobile layouts, avoiding unusable narrow panes and horizontal page overflow.

# Railway frontend runtime configuration (2026-07-21)

- `NEXT_PUBLIC_API_BASE_URL` is the single browser API origin. When `NEXT_PUBLIC_APP_ENV=production`, it is required, must be HTTPS, and cannot contain credentials, paths, queries, or fragments.
- Authentication remains an opaque backend session in a persistent secure HttpOnly cookie. The frontend restores it through `/auth/me`; it does not persist passwords, access tokens, or a parallel authentication flag.
- Any API 401 emits one application-level expiry event that clears in-memory identity and routes to `/login`. Network and server errors stay in controlled setup/error-banner states instead of becoming unhandled render errors.
- Railway runs Next.js from the self-contained `frontend` root, binds to `0.0.0.0:$PORT`, and exposes `/api/health` without returning configuration or secrets.

# Follower Insights Backfill Worker Architecture & Multi-Instance Safety (2026-07-23)

- **Opt-in environment flags**: `FOLLOWER_BACKFILL_WORKER_ENABLED` and `FOLLOWER_BACKFILL_RECONCILIATION_ENABLED` default to `false`. Web instances keep workers and reconciliation disabled. Dedicated worker processes run with `FOLLOWER_BACKFILL_WORKER_ENABLED=true` and `FOLLOWER_BACKFILL_RECONCILIATION_ENABLED=true`.
- **Durable starvation-free reconciliation**: Account ordering uses `lastBackfillReconciledAt ASC NULLS FIRST` and `id ASC` on `LineOfficialAccount`. Inspected accounts update `lastBackfillReconciledAt` durably in PostgreSQL after each batch, ensuring restarts, deployments, and multi-instance workers cycle fairly through all 150+ accounts without starvation or memory state dependency.
- **Strict single-job concurrency per worker instance**: Per-instance worker loops enforce single-job execution via `isWorkerProcessing` lock. Total system concurrency scales horizontally by running additional dedicated worker service instances on Railway.
- **Unknown job contract**: `GET /follower-insights/backfill/jobs/:lineOaId` throws `NotFoundException` (HTTP 404) when no backfill job exists for the requested LINE OA account ID.
- **Railway Deployment Topology**:
  - **Backend Web Service**:
    - `FOLLOWER_BACKFILL_WORKER_ENABLED=false`
    - `FOLLOWER_BACKFILL_RECONCILIATION_ENABLED=false`
  - **Dedicated Backfill Worker Service**:
    - `FOLLOWER_BACKFILL_WORKER_ENABLED=true`
    - `FOLLOWER_BACKFILL_RECONCILIATION_ENABLED=true`
    - `FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS=300000`
    - `FOLLOWER_BACKFILL_RECONCILIATION_BATCH_SIZE=10`
    - `FOLLOWER_BACKFILL_MAX_ENQUEUE_PER_CYCLE=10`
    - `FOLLOWER_BACKFILL_POLL_INTERVAL_MS=5000`
    - `FOLLOWER_BACKFILL_API_DELAY_MS=200`

# Friend Attribution custom-domain routing (2026-08-02)

- `lineoppo.click/f/:shortCode` uses a Next.js external rewrite to the existing backend route, while the browser-facing entry URL remains on the frontend domain.
- The rewrite consumes the existing validated `API_BASE_URL`; it does not introduce another backend-origin setting or duplicate backend redirect/tracking logic.
- The Railway backend public domain remains active for previously distributed links. Forwarded client IP, referrer, user agent, upstream status, and `Location` require deployment-mode smoke verification and are not assumed from configuration alone.

# Desktop header control ownership (2026-08-03)

- The global header owns only cross-workspace controls: branding, primary navigation, global search, update status, and the profile/settings menu. Page-specific actions must remain in their workspace; Store Chats pane reset therefore lives in the Store Chats overflow menu while retaining the existing callback.
- Identity, role, Pilot state, language, appearance, logout, and avatar form one profile dropdown. Theme and language state remain owned by their existing providers/workspace state, so consolidation changes presentation rather than behavior.
- Dashboard, Store Chats, and Store Management remain directly visible at desktop widths. Lower-priority insights links collapse into a More menu below the widest breakpoint, and search becomes icon-triggered below 1024px to avoid horizontal overflow without compressing labels.
- The compact last-updated control is informational and exposes the complete localized timestamp through its accessible label and tooltip. It does not introduce a new refresh path because the previous header timestamp had no refresh action.

# Store Chats authoritative conversation query (2026-08-03)

- Conversation-list state has one owner: a query snapshot containing every backend-supported filter plus page and page size. Initial loading, filter changes, pagination, retries/manual refreshes, and polling must use the same loader and current snapshot.
- Supporting-data polling may refresh stores, product/topic metadata, dashboard data, and LINE OA metadata, but must never replace conversation rows, totals, per-row state, notes, or selection.
- A monotonically increasing request generation plus query-key comparison prevents slower requests from an older filter or store from updating state. Out-of-range responses update the real page state and are refetched at that valid page.
- Product series, product model, and topic UI values remain human-readable names for URL/local-preference compatibility, while metadata resolves them to stable backend IDs in the authoritative request.
- Store badges remain global lifetime totals from the existing stores contract. Queue badges remain derived from the loaded page and are not represented as authoritative filtered aggregates; changing badge semantics requires a separate backend aggregation decision.

# Store Chats conversation-detail hierarchy (2026-08-03)

- The detail pane is one bounded vertical workspace: customer identity and primary LINE OA action at the top, a dominant scrollable message history, consolidated Insights/Internal Note/Activity content, and a persistent follow-up footer outside the content scroller.
- All five follow-up actions remain directly visible because they are frequent operational controls; their existing handlers and status values are unchanged.
- Detail responsiveness is based on the detail pane's own container width rather than viewport width, so user-resized sidebar and list panes cannot make the lower workspace unreadable.
- The externally supplied assistant/mascot is not owned by repository source. The follow-up footer reserves a small lower-right safe area at applicable widths and uses an opaque elevated surface; no selector or behavior is coupled to unknown injected markup.

# Message translation foundation (2026-08-03)

- Manual message translation is isolated in a backend TranslationModule and is disabled unless `MESSAGE_TRANSLATION_ENABLED=true`; absent or false configuration fails closed without querying messages or invoking a provider.
- The initial endpoint is ADMIN-only and accepts only English or Chinese targets. Existing authentication roles are reused; no new permission or store-access model is introduced.
- Existing `translatedEnglish` and `translatedChinese` fields are durable cache. A successful manual provider call writes only the requested target column; `originalText`, ingestion behavior, and unrelated message fields remain unchanged.
- The provider boundary accepts only message text and target language. Google credentials are environment-only, and runtime provider construction requires the feature flag, `TRANSLATION_PROVIDER=google`, project ID, and valid service-account JSON.

# Translation provider benchmark (2026-08-03)

- Provider evaluation remains separate from application runtime: the evaluator and automated runner tests are offline and provider-neutral, while the explicit Google generator is blocked in production and is never run by automated tests. No benchmark path imports Prisma or reads application messages.
- The initial corpus contains synthetic Thai operational examples for English and Simplified Chinese. Product and technology names are protected by deterministic terminology checks.
- Reference similarity is diagnostic rather than a quality verdict. Provider readiness requires complete blind human review across adequacy, fluency, terminology, and safety in addition to structural gates.
- Candidate output files may contain translated content and stay outside source control unless they contain synthetic data only; the CLI emits aggregate scores and case-language keys, not message text.
- OPPO product and technology glossary terms require verbatim preservation, while retail concepts accept curated target-language equivalents. Missing preservation is reported per case and language rather than silently folded into similarity.
- Overall automated score is the weighted sum of category-level reference similarity: product inquiry 25%, promotion/payment 25%, service/warranty 20%, stock/pickup 15%, and casual/mixed 15%. It is diagnostic only and is not a readiness gate.
- Readiness requires structural checks, protected-term checks, and complete human review. Retail-intent mismatch detection is advisory because valid translations may express the same concept outside a finite phrase list.
- Benchmark cost is an estimate derived from frozen source Unicode character counts for both targets and submission-supplied price-per-million metadata. It has no billing-system or environment-variable integration; missing pricing produces no monetary estimate.
- Regression snapshots are metadata-only, versioned artifacts with deterministic identifiers derived from provider metadata and one-way candidate digests. They exclude source, reference, candidate translation, and reviewer-note content and can be compared without production data.
- OPPO terminology rules and placeholder-based normalization live in a reusable translation glossary package, but Phase 2E integrates them only as a benchmark post-processing step between candidate generation and evaluation. It operates on an in-memory copy and does not change Google provider responses, runtime message translation, stored candidates, or application data.
- Phase 2F human review is supplied as benchmark-file metadata keyed by `<caseId>:<language>`. Reviews are validated and aggregated offline; reviewer aliases and optional notes are not application identities, notes never affect scores, and neither aliases nor notes are persisted in metadata-only snapshots. Provider-decision readiness requires complete review coverage in addition to structural and terminology gates.
- Phase 2G provider recommendations are derived only from aggregate benchmark results. Structural, protected-term, or intent failures are rejection conditions; incomplete review or an overall human score below 4.0 requires improvement. `APPROVED_FOR_PILOT` is a benchmark recommendation and never enables runtime translation or changes production configuration.

# Translation pilot safety boundary (2026-08-04)

- A benchmark `APPROVED_FOR_PILOT` decision does not enable application behavior. Runtime translation requires both the existing feature flag and the separate pilot flag, while authorization remains ADMIN-only.
- Pilot audit events use an explicit metadata whitelist and never accept message text, translated text, LINE identifiers, or customer attributes.
- The initial limiter is deliberately dependency-free and applies per backend process and acting administrator to uncached provider work. It is sufficient for a tightly controlled pilot but is not a distributed quota; wider rollout requires a shared limiter before horizontal scaling can provide a global limit.

# Translation pilot monitoring (2026-08-04)

- Phase 3A.2 metrics are process-local aggregate telemetry with no database persistence and no per-message or per-user dimensions. This prevents the monitoring layer from becoming a second store of customer or LINE data.
- Total requests and duration cover active-pilot terminal outcomes. Character averages include only outcomes for which eligible source length is known; cache hits include stored target translations and same-language reuse.
- Provider failures and persistence failures are distinct. Both count as failed translations, but only failures from the provider invocation increment the provider-failure counter.
- Metrics reset on restart and are not exposed by an HTTP endpoint in this phase. Durable, distributed, or externally scraped monitoring requires a separately reviewed observability design.

# Translation pilot monitoring access (2026-08-04)

- The process-local metrics snapshot is exposed read-only at `GET /translation/metrics` through the existing authenticated ADMIN boundary. It has no message/store/customer dimensions and returns a fixed numeric aggregate contract.
- Metrics reset is intentionally internal-only. An HTTP reset route would introduce avoidable operational mutation and requires separate authorization and audit design if ever needed.
- The endpoint observes only its current backend process. Aggregation across Railway replicas or retention across restarts remains out of scope for the internal pilot.

# Translation pilot user allowlist (2026-08-04)

- Active pilot translation uses defense in depth: global authentication, ADMIN role metadata, both runtime feature flags, and exact user-ID membership in `TRANSLATION_PILOT_ALLOWED_ADMIN_IDS`.
- A missing or empty allowlist is valid fail-closed configuration that permits no pilot users. It does not fail application startup because operators must still be able to observe health and metrics while pilot access is closed.
- Allowlist rejection precedes message lookup, metrics, rate limiting, and provider invocation. The denial audit intentionally omits message ID and records only acting user ID, fixed reason, and timestamp.

# Translation pilot daily usage budget (2026-08-04)

- Daily budget usage is process-local and counts Unicode source characters reserved for active-pilot, allowlisted, uncached provider attempts. Cache hits, same-language results, unavailable providers, blocked users, and minute-rate-limit rejections consume no budget.
- A provider attempt retains its budget reservation even if the provider later fails, because those characters crossed the provider boundary and may represent billable usage. Budget rejection occurs before that boundary and returns HTTP 429.
- The budget resets by Asia/Bangkok calendar date and on process restart. It is a controlled-pilot guard, not a durable or replica-global billing ledger.
- The ADMIN metrics endpoint combines translation aggregates with current-process daily usage, configured limit, and exceeded-request count; it still exposes numeric metadata only.

# Translation pilot readiness contract (2026-08-04)

- `GET /translation/readiness` is an authenticated ADMIN-only preflight that projects validated runtime configuration into booleans. It performs no provider request, Prisma access, mutation, or credential parsing beyond startup configuration.
- A ready result requires the feature and pilot flags, Google provider options, a non-empty allowlist, and positive validated rate and daily-budget limits. Readiness does not itself enable translation or authorize a user.
- The endpoint never echoes environment values, allowlist membership, provider project details, or credentials. Invalid raw configuration continues to fail startup; valid but incomplete configuration starts safely and reports `ready: false`.

# Translation pilot synthetic smoke test (2026-08-04)

- The pilot smoke test is a non-production CLI, not an application endpoint. It uses a frozen synthetic OPPO retail sentence and directly exercises the provider abstraction without Prisma, webhook, LINE, conversation, or customer-message dependencies.
- Readiness must pass before provider construction or invocation. Each English and Chinese target has one provider attempt followed by one in-memory cache read, allowing metrics, budget, normalization, and cache behavior to be checked without persistence.
- Smoke cache is intentionally scoped to one CLI execution and holds synthetic output only. It neither tests nor modifies the application Message cache.
- Output excludes translated text and errors, credentials, tokens, IDs, and configuration values; only boolean readiness, provider status, targets, latency, character count, and success are printed.

# Translation pilot audit report (2026-08-04)

- `GET /translation/report` is an authenticated ADMIN-only read model over the current process's existing metrics and daily budget. It introduces no new collection, storage, reset, or translation behavior.
- Operational success includes provider successes and cache hits because both complete the user request. Rate-limited and failed outcomes remain in the total denominator; an idle process reports 100% to avoid a false critical state before pilot traffic.
- Threshold precedence is deterministic: under 80% success or exhausted budget is CRITICAL; otherwise under 95% success or at least 80% budget use is WARNING; otherwise status is HEALTHY. Exactly 95% is healthy and exactly 80% is warning.
- The report contract contains fixed labels and aggregate numeric values only, with no message, translation, user, LINE, provider-secret, or customer dimensions.

# Translation pilot feedback signals (2026-08-04)

- Pilot feedback is an internal aggregate service with exactly three supported signals and no per-event records. Its state consists only of positive, terminology-issue, and meaning-issue counters and resets with the process.
- Recording requires a completed `TRANSLATED` or `CACHED` status. Translation execution never infers sentiment or quality, and unsuccessful or same-language outcomes cannot produce feedback.
- Phase 3B.1.3 intentionally adds no HTTP submission endpoint or frontend. A future capture surface must preserve the aggregate-only contract and prove post-success association without storing message, translation, user, LINE, or customer dimensions.
- Existing ADMIN metrics and report endpoints expose the three counters as numeric aggregates; feedback does not affect success rate or HEALTHY/WARNING/CRITICAL status in this phase.

# Translation pilot activation checklist (2026-08-04)

- `GET /translation/pilot-status` is an authenticated ADMIN-only operational projection and has no activation side effect. It separates `active` runtime switches from `ready` completion of every safety check.
- `active` requires the feature flag, configured Google provider, and pilot flag. `ready` additionally requires a non-empty allowlist, valid rate limit, valid daily budget, and available feedback counters.
- The checklist returns only booleans plus allowlist cardinality. It never returns admin IDs, configured numeric limits, environment values, provider project metadata, or credentials.
- Invalid raw rate/budget configuration remains a startup validation failure; service-level checklist tests also preserve a false readiness projection for invalid constructed configuration.

# Controlled translation pilot activation preparation (2026-08-04)

- Pilot `active` status requires a non-empty environment-derived ADMIN allowlist as well as the feature flag, configured Google provider, and pilot flag. This makes missing allowlist configuration visibly inactive rather than merely unready.
- Allowlist entries remain opaque authenticated user IDs sourced only from `TRANSLATION_PILOT_ALLOWED_ADMIN_IDS`; source code contains no production membership list. Runtime authorization compares the authenticated `User.id` exactly and still rejects before message lookup.
- Activation and rollback are explicit operator procedures. Application startup and status endpoints validate and report safe state but never write Railway configuration or enable translation automatically.

# Translation pilot production preflight (2026-08-04)

- The Phase 3C.1 preflight is a standalone configuration parser rather than a Nest command. This structurally prevents database initialization and provider construction while checking production activation state.
- Running under `NODE_ENV=production` requires the exact `--verify-production` argument. The marker grants permission only to inspect configuration; it does not enable translation, mutate variables, contact Google, or start the application.
- Preflight output is a fixed safe projection: readiness, seven boolean checks, and allowlist cardinality. Parsing failures collapse to a fixed category so malformed credential or environment content cannot leak through CLI errors.

# Consolidated translation pilot readiness check (2026-08-04)

- The consolidated CLI composes existing preflight and runtime-readiness logic instead of creating a second readiness contract. Its provider check is configuration presence only and deliberately does not instantiate or call Google.
- Metrics readiness is limited to validating the shape of a fresh process-local aggregate snapshot. The command never starts Nest, connects Prisma, reads messages, or mutates application state.
- The CLI inherits the production verification marker from the existing preflight and exposes only fixed boolean fields or a sanitized error category.

# Store Chats manual translation MVP (2026-08-04)

- Translation remains an explicit per-message ADMIN action limited to inbound TEXT messages. The frontend does not request translation during ingestion, message loading, polling, or conversation selection.
- The existing credentialed API client owns session handling. Returned English text is displayed in a clearly labeled AI-translation block without replacing the customer message or changing the global original/translated view behavior.
- Request state is local to each rendered message; successful text is also merged into the current in-memory message record while durable caching remains backend-owned.

# Translation feedback MVP (2026-08-04)

- Feedback is a separate ADMIN-only write after translation success. It does not share the translation endpoint, provider abstraction, rate limit, character budget, or generation flow, so feedback can never trigger another provider request.
- Durable feedback references the message, administrator, target language, rating, and issue category. A SHA-256 translation fingerprint binds it to the exact stored result without duplicating customer or translated text.
- The uniqueness boundary includes message, language, admin, and translation fingerprint. Repeat submission for the same result is idempotent, while a future changed translation can receive a new review.
- Helpful feedback has no issue category; Incorrect requires exactly one of meaning, terminology, or other. The existing process-local counters remain operational telemetry, while PostgreSQL is the durable review source.

# Translation quality analytics MVP (2026-08-04)

- Historical quality reporting reads PostgreSQL rather than process-local pilot metrics, which reset on restart and cannot truthfully represent a standalone CLI period.
- Each non-null English or Chinese translated field counts as one durable successful translation. Failed and rate-limited attempts remain unavailable historically, so `totalTranslations` equals `successfulTranslations` for this MVP instead of inventing an attempt count.
- Helpful rate is the percentage of all durable feedback rows rated Helpful, rounded to two decimal places; a zero-feedback population reports zero. The CLI is read-only and has no Google provider dependency.

# Persistent translation event tracking (2026-08-04)

- Translation attempts are stored as metadata-only events with a stable `SUCCESS` or `FAILED` outcome. Cached and same-language responses count as successful requests; unavailable, ineligible, denied, limited, provider-failed, and persistence-failed outcomes count as failures.
- Message and administrator identifiers are stored as scalar audit dimensions rather than foreign keys so an attempt can still be represented when a supplied message is missing and historical operational evidence is not cascade-deleted with application records.
- Event persistence is awaited but fail-open: inability to write observability metadata is logged with a fixed category and never changes translation generation, persistence, provider-call count, or the client response.
- Quality analytics switches to events prospectively. Existing translated fields are not backfilled into synthetic events, avoiding invented timing, administrator, provider, or attempt-status metadata.

# OPPO runtime translation glossary MVP (2026-08-04)

- Glossary enforcement is a decorator over `TranslationProvider`, not logic inside Google Cloud Translation or `TranslationService`. This keeps provider-specific transport isolated and makes the one-provider-call boundary testable.
- Only seven explicitly approved source terms are protected at runtime. Neutral collision-checked alphanumeric sentinels are restored case-insensitively to canonical spelling after the response; unrelated source and translated text are not normalized. Private-use Unicode markers were rejected after Google altered them in the production smoke test.
- The broader English/Chinese benchmark glossary remains an evaluation tool and is not automatically applied to runtime retail language, avoiding unreviewed changes to customer meaning.
- Original message text is never rewritten. The wrapper reports source character count from the original string rather than the placeholder-expanded request.

# OPPO glossary production smoke boundary (2026-08-04)

- The glossary smoke command exercises the raw Google adapter through the same glossary decorator used at runtime, but it does not start Nest or import Prisma. One invocation has exactly one provider attempt and no retry behavior.
- The fixed synthetic sentence is safe to send externally and covers every runtime-protected term in one request. Output deliberately excludes both source and translated text, even on failure.
- Automated tests use injected fake providers only. A real provider call is an explicit operator action using environment-only credentials and creates no message, feedback, event, or other application record.

# Translation pilot release readiness automation (2026-08-04)

- Release readiness composes the existing pilot preflight/readiness contract rather than reinterpreting environment values. Production execution therefore retains the explicit `--verify-production` marker.
- Database readiness requires the existing health-controller query and every migration directory in the current branch to have a successfully finished, non-rolled-back `_prisma_migrations` row. Extra historical applied migrations do not fail the check.
- Glossary readiness means the checked-in seven-term synthetic validation contract and decorator path are available; the release check deliberately does not execute the real Google smoke test. That remains a separate explicit operator action.

# Two-way LINE OA outbound messaging (2026-08-09)

- Operator replies use `POST /v2/bot/message/push`, never webhook `replyToken`, because inbox replies can occur after reply-token expiry and must resolve the Channel Access Token belonging to the conversation's `lineOfficialAccountId`.
- Outbound text reuses the existing `Message` model and `OUTBOUND` direction. The application retry UUID is sent as `X-Line-Retry-Key` and stored as the unique outbound external-message key, allowing a retry after timeout or post-LINE database failure to reconcile without a duplicate customer message or a new idempotency table.
- A LINE 409 containing `x-line-accepted-request-id` is accepted as successful redelivery evidence, consistent with LINE's 24-hour retry-key contract. The frontend retains the same UUID after failure and replaces it only when the operator edits the draft or a send succeeds.
- LINE acceptance is the ordering boundary: message persistence, BM `REPLIED`, follow-up `COMPLETED`, and activity history occur together afterward in one transaction. Any definite LINE rejection writes nothing. A persistence failure explicitly tells the client to retry the same request.
- The existing activity enum has no outbound-message action and adding one would require an unnecessary migration. `STATUS_CHANGED` is reused with an explicit outbound LINE description, operator name, store ID, and OA ID; credentials and message text are excluded from audit metadata.
- Only `ADMIN` can send. This preserves the global guard's established read-only `VIEWER` policy; there is no separate user-to-store authorization model in the current schema to extend.

# LINE OA Management CSV export (2026-08-09)

- CSV generation is a dedicated ADMIN-only backend endpoint rather than frontend pagination. It reuses the existing safe LINE OA projection, so the export and management table share calculated status, canonical webhook URL, Store Master URLs, and batched message counts.
- Search and status filtering occur server-side after one complete safe projection because connection status is partly calculated from credential/configuration health. The current population is small and database access remains batched without per-OA queries.
- The schema is an explicit 17-column allowlist. Secret-bearing fields cannot enter the CSV through generic object serialization; even fields beginning with spreadsheet formula characters are neutralized before RFC quoting.
- CSV uses UTF-8 BOM and CRLF for Microsoft Excel compatibility, while all timestamps and the filename date use `Asia/Bangkok`. `Content-Disposition` and `X-Export-Row-Count` are CORS-exposed so the cross-origin frontend can preserve the server filename and operationally verify counts.
# Android production resilience

- Client diagnostics are limited to lifecycle events and HTTP status/code categories; they never include OTPs, bearer tokens, message text, or customer identifiers.
- Outbound retries reuse their idempotency key so an uncertain network failure cannot intentionally create duplicate LINE replies.
- Inbox pagination uses the available page/total API; chat exposes a nullable cursor hook pending a backend cursor contract rather than issuing unsupported queries.

# Android client foundation

- The Android MVP is a standalone Flutter project so it cannot affect the existing Next.js web inbox build or deployment.
- Access tokens use platform secure storage only; OTP values remain widget-memory input and are never persisted.
- The backend origin is supplied at build time with `API_BASE_URL`; FCM client configuration uses ignored Firebase project files. No backend service-account credentials exist in the Android repository.

# Android API contract

- `/mobile/config` is public and exposes only app-version and maintenance information. Operational/configuration credentials are excluded.
- `/auth/me` is extended rather than replaced to retain web compatibility while giving Android a single profile, store, role, and permission bootstrap response.
- Standardized error codes apply only to `/mobile/*` and `/auth/mobile/*`, avoiding an incompatible error-shape change for existing web clients.

# FCM provider and outbox delivery

- FCM service-account configuration stays in environment variables only. The provider sends a generic notification body plus conversation/message/notification IDs; no customer message content is included.
- Delivery is outbox-worker based, not webhook synchronous. Rows are atomically claimed before dispatch and failed deliveries retry up to three total attempts.
- FCM reports of invalid or unregistered device tokens deactivate only the corresponding device row.

# Mobile conversation API boundary

- Mobile conversation endpoints never accept a store ID or LINE OA ID. Store access is resolved through `StoreAccessService`, and outbound replies use the pre-existing conversation-derived LINE OA service.
- Notification delivery status and user read/open state are independent. Badge counts are calculated only from the authenticated user's notifications with `readAt = NULL`.

# Mobile conversation unread state (2026-08-13)

- Mobile unread state remains per-user and is derived from that user's PushNotification outbox rows whose `readAt` is null; no conversation-global unread field or new read-receipt model is introduced.
- Opening an authorized conversation marks all matching unread rows for that user/conversation as read only after detail loading succeeds. This is idempotent and deliberately independent from `bmReplyStatus`, which changes only through the existing reply flow.
- The Android notification/history cleanup is a separate best-effort operation. Either backend mark-read or local cleanup may fail without making Chat unusable, and the Inbox REST refresh remains the authoritative reconciliation path.

# Mobile push foundation

- Push tokens are encrypted with the existing backend credential-encryption service and addressed by a SHA-256 lookup hash; neither token values nor payload content are returned by the API.
- LINE webhook processing writes a durable, minimal-ID notification outbox record in the same database transaction after the inbound message is persisted. It never performs provider delivery synchronously.
- Notification eligibility is membership/store/device based at enqueue time. A unique `(userId, messageId)` constraint makes provider webhook retries idempotent.

# Android notification token lifecycle (2026-08-13)

- Device registration is explicitly gated on an existing authenticated mobile session and runs after login or successful session restoration. The client never associates a refreshed FCM token while logged out.
- Registration is idempotent through the existing backend token hash/upsert contract; a single in-flight registration is shared and logout waits for it before deactivation to avoid reactivating a token after logout.
- Diagnostics expose only lifecycle event names and HTTP status/error categories. FCM token values, bearer tokens, credentials, and customer data are never logged.

# Android notification icon (2026-08-13)

- The first post-registration background FCM delivery reached Android and invoked the Flutter background isolate, but local notification `show()` failed because the configured `@mipmap/ic_launcher` resource was absent.
- Notifications use the dedicated checked-in `ic_stat_line_oa` drawable for both initialization and `AndroidNotificationDetails`. The data-only FCM payload and channel contract remain unchanged.

# Chat-style Android notifications (2026-08-13)

- FCM remains one message-level outbox delivery per inbound Message with no notification envelope or collapse key. Android maps the stable Conversation UUID through deterministic FNV-1a 31-bit identity, so later messages update that conversation's single notification while different conversations remain independent.
- Android MessagingStyle uses only locally persisted, bounded customer-message previews. The history stores conversation ID, display name, message ID, sanitized preview, and timestamp; it never stores media, tokens, credentials, or full backend payloads. Images always render as `Sent an image`.
- SharedPreferencesAsync is used because background notification handlers can run in a separate isolate and need non-cached persistence. History is cleared on successful manual or notification-driven conversation opening and entirely on logout, preventing cross-user leakage on a shared device.

# Flutter logout hardening (2026-08-13)

- Logout treats notification cleanup and DeviceToken deactivation as best-effort side effects. Auth session clearing and return to the login route are guaranteed even when FCM, local notifications, or the network fail.
- Notification initialization is serialized with logout, and a logout-in-progress guard prevents token refresh or registration callbacks from reactivating a device after logout. Cleanup is skipped when local notifications were never initialized.
- Notification history storage is lazy outside background handling so app startup and unit tests do not require a platform SharedPreferences implementation. No backend API, Prisma schema, or notification delivery architecture changed.
# Phase 4C.2 image realtime UX

- Chat image bubbles reserve a fixed 240x240 viewport while media transitions from PENDING through download to READY. Realtime media patches are idempotent by comparing all rendered media fields before rebuilding; backend events and message identity remain unchanged.
# Phase 4C.3 inbox true realtime

- Inbox realtime updates patch the existing immutable conversation summary rather than reloading page 1. Since unread counts are per-user and absent from the shared SSE event, a targeted authorized conversation detail request reconciles unread state; local increments are intentionally avoided. Full refresh remains available for explicit user refresh, retry, and initial load.
