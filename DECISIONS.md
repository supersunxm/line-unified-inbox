# Rich Menu Phase 2B: Durable Multi-Store Bulk Publishing Architecture (2026-08-27)

- **Job-Attempt Hierarchy**: Bulk publishing creates a parent `RichMenuPublishJob` linked to $N$ individual `RichMenuPublishAttempt` rows. This maintains per-store granular audit history, rollback capabilities, and individual retry records while providing an aggregate lifecycle (`PENDING` $\to$ `RUNNING` $\to$ `COMPLETED` / `COMPLETED_WITH_ERRORS` / `CANCELLED` / `FAILED`).
- **Atomic Queue Claiming**: Queue processing utilizes a transactional `UPDATE ... WHERE status = 'PENDING'` claim pattern to ensure that distributed workers never double-claim or process overlapping jobs.
- **Worker Heartbeat & Capabilities Detection**: Background workers continuously record a heartbeat in `RichMenuWorkerHeartbeat`. The `/publish-capabilities` endpoint evaluates worker freshness ($< 60$ seconds) to inform the frontend if queue processing is operational.
- **Bounded Concurrency & Batch Limits**: Concurrency is strictly bounded at both the worker pool level (default 2, maximum 5 concurrent LINE API requests via `p-limit`) and batch submission level (default 5 stores per job, configurable up to 10), guarding against LINE Messaging API rate limiting (`429`) and connection saturation.
- **Exponential Backoff on Transient LINE Failures**: `LineRichMenuClientService.withRetry()` wraps HTTP calls with jittered exponential backoff for status codes 429 and 5xx, while immediately failing fast on 400 Bad Request client errors.
- **Dual-Checkbox Frontend State**: Store selection in `RichMenusView` is cleanly decoupled into two independent sets: `assignedOaIds` (stores bound to the template) and `publishSelectedOaIds` (explicit target subset for the upcoming publish job).
- **Graceful Cancellation & Granular Retry**: Cancelling a job immediately marks pending attempts as `CANCELLED` or `SKIPPED` while in-flight operations finish safely. A dedicated `retryFailed()` action spawns a scoped child job targeting only failed stores without re-publishing already successful stores.

# Rich Menu Phase 2A: Safe Single-Store Canary LINE Publishing Architecture (2026-08-27)

- **Single-Store Canary Scope Invariance**: Phase 2A strictly constrains real LINE publishing to exactly one store per publish request. Bulk or unattended publishing remains completely gated until Phase 2B.
- **Centralized LINE HTTP Client (`LineRichMenuClientService`)**: All LINE Messaging API calls (validation, create, content upload, get/set default, delete, unlink) are consolidated in `LineRichMenuClientService`, avoiding scattered network calls across services or controllers.
- **Pre-Publish Previous Default Detection**: Prior to linking a new default rich menu, the system queries `GET https://api.line.me/v2/bot/user/all/richmenu` and captures `previousDefaultSource` (`MESSAGING_API` with ID, `NONE` on 404, `OTHER_OR_MANAGER` on 403) to enable safe, complete rollback.
- **Stage Progression & Cleanup Guarantee**: Publishing follows `VALIDATING` $\to$ Detect previous default $\to$ `CREATING` $\to$ `IMAGE_UPLOADING` $\to$ `SETTING_DEFAULT` $\to$ `VERIFYING` $\to$ `PUBLISHED`. On image upload failure, the orphaned rich menu is automatically deleted on LINE.
- **Safe Rollback**: `POST /publish-attempts/:id/rollback` restores the previous default Messaging API rich menu or cleanly unlinks the default menu to reveal LINE Official Account Manager defaults.
- **Store Master Dynamic Resolution at Publish Time**: Variables such as `{{store.googleMapsUrl}}` and `{{store.storeName}}` are resolved freshly from the database at publish time. Any unresolved or invalid variable safely rejects before any LINE API mutation occurs.
- **Zero-Secret Logging**: Credentials and decrypted tokens are never logged, never included in database `resolvedConfigJson`, and never returned in API responses.

# Rich Menu Media Storage DI & Outbound Public URL Architecture (2026-08-27)

- **Required MediaStorageService Dependency**: `RichMenuService` requires `MediaStorageService` directly from `MediaModule` via NestJS DI container, avoiding silent `undefined` injections.
- **Canonical Outbound Public Media Endpoint**: Image uploads produce URLs via `createMediaPublicUrl(objectKey)` referencing `/messages/media/public?key=...&expires=...&signature=...` which is authenticated via HMAC signature matching the media subsystem architecture.
- **Dynamic Signed URL Refresh**: When reading templates (`listTemplates`, `getTemplate`, `preview`), `resolveTemplateImageUrl()` detects signed outbound URLs via `extractMediaObjectKey()` and issues refreshed signed URLs with renewed expiration, preventing stale or broken preview links while maintaining backward compatibility with plain image URLs.
- **Graceful Storage Errors**: S3 put failures are caught, safely logged without credentials or file bytes, and converted to actionable localized error messages.

# Rich Menu Image Upload Reliability & Signature Architecture (2026-08-27)

- **Pure JavaScript Dimension Parsing (`image-size`)**: Switched primary image dimension extraction from Sharp native decoding to pure-JS `image-size`, eliminating container runtime decoding failures while retaining Sharp as a fallback.
- **Strict Magic Bytes Validation**: Validate file signatures directly on raw buffers (`PNG: 89 50 4E 47 0D 0A 1A 0A`, `JPEG: FF D8 FF`), ensuring format accuracy independent of filename extension.
- **Multer Memory Storage**: Configured `FileInterceptor` with `memoryStorage()` and a 1 MB limit to prevent disk-temp dependencies in ephemeral cloud environments.
- **Aspect Ratio Alignment**: Validate that uploaded image aspect ratios correspond to the selected template geometry (Large vs Compact), providing descriptive localized error messages.
- **Zero-Loss Replacement**: Failed uploads preserve the current draft's existing image preview and URL without resetting to null.

# Canonical LINE Official Account Template Preset Geometry (2026-08-27)

- **12-Preset LINE OA Geometry System**: Implemented the complete official LINE OA template system consisting of 7 Large layouts (2500x1686 canonical canvas) and 5 Compact layouts (2500x843 canonical canvas).
- **Exact Tiling & Non-Overlap Invariance**: Every preset geometry partitions the exact canvas coordinate system without gaps or overlaps (`sum(area_w * area_h) == canvas_w * canvas_h`), while displaying equivalent LINE-supported resolutions (Large: 2500x1686, 1200x810, 800x540; Compact: 2500x843, 1200x405, 800x270).
- **Backward Compatibility**: Legacy preset names (`GRID_6`, `GRID_4`, `GRID_3`) and `CUSTOM` continue to load and render correctly without breaking existing database templates.

# Multilingual UI Architecture for /rich-menus (2026-08-27)

- **Dedicated Dictionary Module (`rich-menu-i18n.ts`)**: Structured the complete copy dictionary `RICH_MENU_I18N` in a standalone `.ts` file supporting `th`, `en`, and `zh`. This pattern ensures clean separation of concerns, zero bundle overhead from third-party i18n libraries, and full compatibility with Node test runner ESM strip-types.
- **Data & Enum Invariance**: All data attributes, API contracts, template variable placeholders (`{{store.storeName}}`, `{{store.googleMapsUrl}}`, `{{store.lineUrl}}`, `{{store.tiktokUrl}}`), and preset identifiers (`GRID_6`, `GRID_4`, `GRID_3`, `CUSTOM`) remain strictly identical across all language selections.

# Route-Level Vertical Scrolling Architecture for /rich-menus (2026-08-27)

- **Isolated Route-Level Scrolling**: To preserve the fixed single-screen layout and internal message timeline scrolling required for `/chats`, `/rich-menus` enables vertical scrolling on its own root wrapper (`w-full flex-1 min-h-0 overflow-y-auto`) rather than modifying the outer application shell.
- **Sticky Actions Header**: The page header with `[ Save Draft ]` and template state uses `sticky top-0 z-20` with a subtle backdrop blur to remain continuously accessible as users scroll through lengthy action lists and the Target Stores table.

# Rich Menu Workspace Redesign: Alignment with LINE OA Manager (2026-08-27)

- **2-Column Editor + Lower Target Stores Structure**: Aligned the `/rich-menus` workspace structure with LINE Official Account Manager's Rich Menu editor. The editor uses a 2-column layout (Preview Left ~36%, Editor Right ~64%) with Target Stores positioned full-width underneath rather than crowded beside the form.
- **LINE Color & Control Palette**: Adopted LINE's signature green (`#06C755`) for primary save actions and active area highlights, neutral white/light-gray backgrounds, thin borders, letter-based area tags (`A`, `B`, `C`, ...), and minimal card clutter.
- **Top Template Selector**: Consolidated template selection into a compact top dropdown `Template: [ Select Template ▼ ] [ + New ]` to keep focus on editing one menu at a time.
- **Non-Destructive Boundary**: Maintained 100% of Phase 1 backend architecture, database schema, variable resolution logic, store readiness evaluation, and no-op LINE publishing protection.

# Rich Menu Manager (Phase 1: Management + Template + Preview + Readiness) (2026-08-27)

- **1 Template → N Stores Architecture**: Rather than duplicating N distinct designs in LINE OA Manager, administrators manage single high-level templates with variable placeholders (e.g. `{{store.googleMapsUrl}}`, `{{store.storeName}}`, `{{store.lineUrl}}`, `{{store.tiktokUrl}}`) that resolve dynamically per store.
- **Phase 1 Publish Gate**: In Phase 1, live LINE Messaging API publishing is strictly prohibited and gated. `RichMenuPublishNoopAdapter` safely rejects any publishing calls, and the frontend publish button is permanently disabled with clear guidance (`"Publishing available in Phase 2"`).
- **Template-Specific Store Readiness**: Store readiness is evaluated per template based on actual variables used. A store lacking a Google Maps URL is marked `BLOCKED` only if that template references `{{store.googleMapsUrl}}`. Templates with only `MESSAGE` actions or non-maps variables mark all eligible store accounts as `READY`.
- **Canvas Presets & Coordinate Validation**: Standard presets (`GRID_6` 2500x1686, `GRID_3` 2500x843, `GRID_4` 2500x1686, and `CUSTOM`) are validated to ensure all bounding boxes reside strictly within the canvas boundaries.
- **Role Isolation & Main OA Protection**: `/rich-menus` is strictly accessible to `ADMIN` users on the Web (`hasBackendAdminAccess`), hidden from `VIEWER` or store staff, and completely isolated from the `/main-oa` workspace.

# Store Master Google Maps Readiness Visibility & Filtering (2026-08-27)

- **Derived Readiness Model**: Rather than persisting additional columns in PostgreSQL, `googleMapsStatus` (`CONFIGURED` | `MISSING` | `INVALID`) and `googleMapsStatusReason` are derived on the fly from `googleMapsUrl` via `getStoreGoogleMapsReadiness`. This keeps the database schema lean, avoids sync discrepancies, and guarantees consistent validation logic across frontend and backend.
- **Multiplicative Filtering**: Google Maps readiness filter buttons (`All`, `Configured`, `Missing`, `Invalid`) combine multiplicatively with existing store search, connection status, and archived filters.
- **Accurate Count Derivation**: Readiness counts displayed on filter buttons (`All (N)`, `Configured (N)`, `Missing (N)`, `Invalid (N)`) are derived dynamically from currently loaded store data.
- **Interactive Sync Summary Card**: Clicking on Missing, Invalid, or Configured metrics in the Store Master Sync summary panel immediately applies the corresponding Google Maps readiness filter to the store list.

# Store Master Production Sync Control (2026-08-27)

- **Role-Gated Sync Action**: The Store Master sync trigger is exclusively available to `ADMIN` users on the Web (`authUser.role === "ADMIN"`). Unauthorized users (`VIEWER` or store-level roles) are completely restricted from seeing or executing the sync control.
- **Immediate Data & Google Maps Refresh**: A successful sync automatically invokes `loadApplicationData(true)`, instantly pulling refreshed Store Master records and `googleMapsUrl` metadata into the Store Management view.
- **Accurate Metric Presentation**: The sync result summary panel surfaces only authentic counts provided by `POST /store-master/sync` (`total`, `complete`, `incomplete`, `updated`, `unchanged`, `missingStoreId`, `duplicateAccountNames`, `duplicateLineIds`, `missingGoogleMapsUrls`, `invalidGoogleMapsUrls`) without inventing synthetic metrics.

# Store Master Google Maps Column K Integration (2026-08-26)

- **Column K Header & Aliases**: Column K header `"Google Maps links"` is mapped into nullable `googleMapsUrl` in `StoreMaster`. Aliases accepted: `"Google Maps Link"`, `"Google Maps URL"`, `"googleMapsUrl"`.
- **URL Sanitation & Validation**: Blank / whitespace / `#REF!` values resolve to `null`. URL validator requires `https:` protocol and supports `maps.app.goo.gl`, `goo.gl/maps`, `maps.google.com`, `maps.google.co.th`, and `*.google.com/maps` paths, while preserving shortlink IDs and query parameters.
- **Import Summary Counters**: Added `invalidGoogleMapsUrls` and `missingGoogleMapsUrls` summary metrics to import validation routines. Missing URLs do not fail the import.
- **Template Variable Resolver**: Reusable resolver function supports `{{store.googleMapsUrl}}`. Variable validation outputs `READY` when the URL exists and is valid, and `BLOCKED` with reason `"Missing Google Maps URL"` when missing.
- **Store Management UI**: Exposes an "Open Google Maps" ↗ button when a URL is present and a disabled "Not configured" state when missing, in both desktop Store Management tables, synchronized Store Master modal cards, and mobile store views.

# Dominant Chat Timeline & Collapsible Details Drawer in /chats (2026-08-26)

- **Primary Flexible Chat Region**: The message timeline (`data-chat-message-scroll`) is now the main flexible region (`flex-1 min-h-0 overflow-y-auto`) filling all available vertical space directly above the docked reply composer.
- **Collapsible Operational Metadata**: Secondary cards (AI Insight, Internal Note, and Activity History) are housed inside a collapsible side drawer (`data-chat-details-drawer`) accessible via a `Details` toggle button in the chat header.
- **Default Closed State**: By default, the details drawer is closed, allowing the conversation stream to occupy 100% of the detail pane width and height.
- **Side Panel & Overlay Behavior**: On desktop viewports, opening details renders a 320–352px side drawer side-by-side with the chat. On narrow viewports (< 900px), it smoothly overlays the chat with independent scrolling.

# Fixed Single-Screen /chats Workspace Layout (2026-08-26)

- **Root Viewport Constraint**: The outer application shell is locked to `100dvh` (`max-height: 100dvh; overflow: hidden`) across desktop and responsive viewports, ensuring the outer browser document never produces a vertical scrollbar.
- **Dedicated Internal Scrolling Boundaries**:
  - Store sidebar: Search and status filter buttons are fixed at top; store list container scrolls internally with `overflow-y-auto`.
  - Conversation list: Title, search count, and filter panel are fixed; conversation cards scroll internally with `overflow-y-auto`; pagination controls stay docked at the bottom.
  - Chat detail pane: Customer header is fixed; chat message timeline scrolls internally with responsive clamp `clamp(200px, 36vh, 440px)`; reply composer and manager notice are fixed; lower detail sections (AI Insight, Internal Note, Activity) scroll internally within the remaining height.
- **Page Container Versatility**: `PageContainer variant="full"` locks viewport height with `overflow-hidden` for `/chats`, while `variant="wide"` and `variant="readable"` retain `<main>` internal `overflow-y-auto` scrolling for standard dashboards and reports.

# /chats Workspace Layout & UX Optimization (2026-08-26)

- **Default Pane Proportions**:
  - Context sidebar increased from 240px to 280px default (min 220px, max 420px) to prevent aggressive truncation of store names and SLA metrics.
  - Conversation list increased from 340px to 380px default (min 320px, max 600px) providing ample room for customer name, message preview, store name, and BM tags.
  - Detail pane min width adjusted to 480px while expanding into the remaining flexible workspace.
- **Empty Detail Pane UX**: Replaced the previous generic blank state with a centered, subtle empty state indicator informing users to select a conversation to view messages and customer details.
- **Conversation Card Layout**: Polished vertical rhythm and hierarchy: 1. Customer name + action menu, 2. Message preview, 3. Store name · Relative time, 4. BM status and customer sales tags.
- **Pagination Footer**: Switched to a single-row flex wrap layout optimized for 360–420px container widths with compact select controls and navigation buttons.

# Removal of Customer Sales / Purchase Information Card from Web Chat Detail (2026-08-26)

- **Chat Detail Lower Pane Streamlining**: With BM-entered sales data now clearly displayed in the conversation list rows and chat detail header, the standalone Customer Sales Information / Purchase Information card in the chat detail lower section is removed.
- **Retained Lower Sections**: AI Insight (`data-product-intent-card`), Internal Note (`data-topics-note-card`), and Activity History (`data-activity-history`) remain prominent and functional.
- **Backend & Data Integrity**: Backend data contracts, `customerSalesInformation`, `purchaseInformation`, database columns, APIs, and Mobile App features remain completely unchanged.

# BM Mobile Customer Sales Tags as Source of Truth on Web (2026-08-26)

- **Source of Truth**: The tags displayed in the conversation list rows and chat detail header reflect BM staff entries in the Mobile App (`customerSalesInformation`) rather than Web-generated/manual AI tags.
- **Display Priority Order**:
  1. `salesStatus`: `INTERESTED` (blue) or `PURCHASED` (emerald)
  2. `interestLevel`: `HOT` (rose/red), `WARM` (amber), `COLD` (slate)
  3. `productModel`: Product model name (accent background)
  4. `productVariant`: Formatted RAM / ROM / color (subtle background)
  5. `purchaseChannel`: `STORE` or `ONLINE` (subtle background)
  6. `paymentMethod`: `CREDIT CARD`, `INSTALLMENT`, `CASH`, `OTHER` (subtle background)
- **Removal of Legacy Presentation**:
  - Removed from list area tags: Follow Up Store, Follow-up status, Priority, AI-generated topic tags, AI-generated product tags.
  - Removed from detail header chips: AI Customer Stage, Follow-up status, Priority.
  - Retained in detail header: Customer Name, Store Name, BM Customer Sales Tags, BM Reply Status dropdown, and Relative time.
  - Retained in list row: Customer Name, Store Name, BM Reply Status pill, Relative time, and `+N` overflow chip.
- **Empty State Behavior**: If BM staff have not entered customer sales information, zero tags are rendered; no fallback AI tags or artificial placeholders are displayed.
- **Underlying Field Preservation**: Priority, FollowUpStatus, topics, and customer stage remain fully preserved in backend models, search, filtering, and analytics.

# Brand Accent Modernization to OPPO Green (2026-08-20)

- **Semantic Separation of Brand Accent and Warning States**:
  - Global brand accent (`--app-accent`) is modernized from the legacy orange (`#ff6900`) to the official **OPPO Green** (`#00a651`).
  - Active navigation highlights, primary positive call-to-actions (e.g. Save, Sync, Apply, Confirm), focus outlines, user profile markers, and the application brand mark consume `--app-accent` and `--app-accent-soft` (`#e8f9ec` in light, `#0d281a` in dark).
  - Semantic warning states (`--app-warning: #ff9500`, `--app-warning-soft: #fff4e0` in light / `#2e1e05` in dark) remain completely distinct and uncollapsing, ensuring SLA risks, partial data notices, and attention badges retain unambiguous amber/orange warning semantics.
  - Multi-series chart distinct lines (such as Follower Insights multi-store comparison palette) retain distinct colors for proper data visualization.

# Site-Wide Dark Mode Normalization Architecture (2026-08-20)

- **Tailwind CSS v4 Dark Variant Selector Integration**:
  - In Tailwind CSS v4, utility variants `dark:...` default to media queries (`@media (prefers-color-scheme: dark)`). To ensure all Tailwind `dark:` classes respect manual runtime theme toggles (`html[data-theme="dark"]`), `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *, .dark, .dark *));` is defined globally in `globals.css`.
- **Elimination of Inline Light Spec Overrides**:
  - Internal dashboard views must never declare inline `style={{ "--dash-bg": "#F5F5F7", ... }}` on root containers. Instead, `--dash-*` aliases bind dynamically to `:root` and `html[data-theme="dark"]` definitions in `globals.css`, maintaining full design system consistency.
- **Component-Level Semantic Color Tokens**:
  - Sub-components across internal routes (tables, charts, paginations, badges, and modals) must consume semantic CSS variables (`--app-surface`, `--app-surface-subtle`, `--app-border`, `--app-text-primary`, `--app-text-secondary`, `--app-success-soft`, etc.) instead of hardcoded hex colors (`#E8F9EC`, `#FFF4E0`, `#FDE8E8`, `#F5F5F7`, `#FBFBFC`, `bg-white`).
- **Preservation of Light Mode & Independent Surfaces**:
  - Light mode hex tokens and visual styling remain 100% identical.
  - Public / standalone landing pages (e.g. download, terms, privacy, TikTok OAuth callback result) retain their designated standalone presentation.

# Phase 3 — Unified Chat Inbox (/chats) Workspace Modernization (2026-08-20)

- **Preservation of Dedicated Operational Density**: Unlike standard management pages that use roomy dashboard cards, the `/chats` workspace is an operational hub with dense real-time needs. The modernization retains high visual density with concise padding, compact avatars, crisp 1-pixel borders, and subtle contrast surfaces.
- **5-Track Resizable Grid Architecture**: Preserved the grid structure containing 5 direct logical children: `<ContextSidebar>`, `separator="sidebar"`, `data-chat-pane="conversations"`, `separator="conversations"`, and `data-chat-pane="detail"`. Pane sizing bounds (`CHAT_PANE_LIMITS`), user-resizing listeners, and pane width state persistence remain untouched.
- **Semantic State Mapping**:
  - `bmReplyStatus`: `NOT_REPLIED` (neutral/amber alert), `NOTIFIED_BM` (purple notification), `REPLIED` (green success).
  - Selected conversation row: `.is-selected` with semantic focus ring and background highlight (`--app-accent-soft`), preserving `data-selected` and `data-conversation-row` attributes.
- **Composer Safety & Idempotency**: Preserved composer behavior (`Enter` to submit, `Shift+Enter` for multiline), idempotency key management (`replyIdempotencyKeyRef`), and disabled states during network mutation or viewer role access.
- **Zero API/Schema Changes**: All backend APIs, event streams, real-time polling hooks, and query generation logic remain unchanged.

# Follower Insights Trend UX & Multi-Store Comparison Architecture (2026-08-20)

- **Default Comparison Mode**: Comparison mode defaults to `"available"` (`บัญชีทั้งหมดที่มีข้อมูล` / "All accounts with available data") to prioritize showing all available store metrics upon page load. `"comparable"` (`บัญชีที่เปรียบเทียบกันได้`) is an explicit choice for users requiring complete date-range historical coverage.
- **Store Selection Architecture**: Selected stores are tracked as an array of LINE OA IDs (`selectedLineOaIds: string[]`), defaulting to `[]` (`ทุกร้าน` / All stores).
- **Parallel Multi-Store Fetching**: When stores are selected, daily time series for each store are fetched in parallel via `api.followerInsightsSummary({ dateFrom, dateTo, lineOaId })` and mapped by `lineOaId` without mutating or overwriting the aggregate network `summaryData`.
- **Multi-Series Trend Visualization**: When 2 or more stores are selected, `TrendChart` plots one distinct line series per store with a dedicated 12-color high-contrast palette (`STORE_PALETTE`), displaying a multi-series store legend and multi-store hover tooltip. Selected stores are never aggregated into one total sum.
- **Partial Coverage & Resilient Empty State**: When some selected stores have data and others have gaps or missing snapshots, valid series are rendered normally and accompanied by a partial coverage badge (`storesWithDataCount(active, total)` in available mode; `comparableStoresCount(comp, total)` in comparable mode). The empty state is rendered strictly when zero usable data points exist across all selected series.
- **Localization Symmetry**: Full trilingual dictionary support across Thai (`th`), English (`en`), and Chinese (`zh`) for all new UI strings.

# Executive Dashboard v2 Data Integrity Boundary (2026-08-19)

- `/dashboard` is organized into five visual tiers so executive attention follows business priority rather than presenting every metric with equal weight.
- Store health Watchlist issues are combined per store into one row instead of maintaining separate reach/block/inactive lists that duplicate stores.
- Store follower health is calculated from real LINE OA follower snapshots; HTML/mockup values are never used as production analytics data.
- Partner attribution is derived from the existing store-name suffix pattern `By XXX`, avoiding a database migration solely for presentation grouping.
- Reach/block metrics may be null when a valid snapshot metric is unavailable. Missing data must not be silently converted to zero or classified as healthy/unhealthy.
- Reply-speed bucket percentages have an explicit no-denominator state. When total duration-backed replies are zero, percent is null and the UI must display “ไม่มีข้อมูล” rather than 0% or 100%.
- The redesign adds no customer/store data mutation and requires no Prisma migration.

# Purchase Intelligence Campaign Composer Boundary (Phase 2B) (2026-08-19)

- Phase 2B may edit only content on an existing Purchase Intelligence `DRAFT + SELECTED_USERS` campaign; it cannot create delivery execution state or change campaign status.
- The saved Phase 2A recipient snapshot is immutable from the composer. The browser cannot add, remove, or replace recipient IDs.
- Composer read models expose aggregate recipient/store/LINE OA information and store/OA breakdown only; customer IDs, conversation IDs, and LINE User IDs remain internal to the saved snapshot.
- Save Draft may update only campaign title and a validated message payload containing at most one text message and one image.
- Existing protected Mass Message image upload is reused rather than introducing a second media-storage path.
- Composer edits fail closed when the campaign is not DRAFT/SELECTED_USERS or when delivery records already exist.
- Legacy `SELECTED_USERS` preview/send remains blocked. Phase 2C must implement explicit recipient re-validation, authorization, quota checks, idempotent delivery creation, audit, and final confirmation before any LINE execution.
- Phase 2B itself creates no `MassMessageStoreDelivery`, starts no processor, calls no LINE send API, and consumes no message quota.

# Purchase Intelligence → Broadcast Audience Draft Boundary (Phase 2A) (2026-08-19)

- Phase 2A is a preparation boundary only: it may create `MassMessageCampaign` records with status `DRAFT`, but it must never dispatch LINE messages or start the Mass Message processor.
- The server recomputes Purchase Intelligence recipients using authenticated authorization and current filters. Client-provided recipient IDs are never accepted as the source of truth.
- Broadcast drafts require operationally messageable customers and snapshot exact membership using only internal customer, conversation, store, and LINE OA references.
- LINE User IDs and customer display names are not duplicated into the campaign snapshot; future delivery must re-resolve current authorized delivery identity from the stored internal references.
- `campaignRequestId` is the idempotency boundary for draft creation.
- `MassMessageAudienceType.SELECTED_USERS` is fail-closed on the legacy preview/create-and-send endpoints until a dedicated reviewed recipient execution path is implemented.
- Phase 2A creates no `MassMessageStoreDelivery` rows and performs no quota-consuming provider operation.
- The existing `MassMessageCampaign.messagePayload` JSON contract is reused, so no database migration is introduced for this phase.

# Purchase Intelligence Customer Audience Export (Phase 1) (2026-08-19)

- Audience export is a preparation boundary only; Phase 1 does not send LINE broadcasts or create campaign/send side effects.
- Purchase Intelligence date/store filters and `StoreAccessService` authorization are reused server-side so client filters never expand a user's store scope.
- Export identity is one row per `Customer.id`, preventing duplicate recipient rows when multiple qualifying purchase records exist. Aggregated purchase context is retained while latest purchase supplies the primary conversation/store/OA/BM context.
- Operational `canMessage` means the customer has `lineUserId` and the selected latest OA is active, non-archived, and `READY`/`CONNECTED`. It deliberately does not claim friend/block state because the current schema has no reliable per-customer friendship truth.
- Audience rows preserve recorded `ConversationSalesProduct` RAM/ROM/color before catalog variant fallback. Export logic must prefer the recorded sales snapshot over optional catalog linkage.
- CSV is generated in the authenticated frontend from the authorized audience API response, uses UTF-8 BOM and formula-injection-safe cells, and defaults to messageable recipients.
- Any future broadcast phase must consume an explicit reviewed audience and add its own preview/approval/quota/idempotency/audit controls rather than implicitly sending from the export action.

# Responsive Customer Sales Information Header (v1.0.12+13) (2026-08-19)

- Customer Sales Information header actions must not compete with the title for the same constrained horizontal space on narrow Android screens.
- Narrow layouts use two rows: Close + readable title first, then Clear all + Save right-aligned below. Wider layouts retain the compact single-row presentation.
- This is a presentation-only change. Customer Sales Info state ownership, persistence, backend contracts, nullable status, and tag behavior remain unchanged.
- Android release artifacts remain immutable by version/build and are distributed with an exact SHA-256 checksum.

# POS / CRM Draft Selection UX Flow Architecture (v1.0.6+7) (2026-08-18)

- **POS / CRM Draft Selection Paradigm (Select → Configure → Confirm → Save CRM)**: Replaced direct catalog addition with an isolated 4-step draft selection model in `ConversationTagsSheet`. Staff select a catalog product into an isolated draft container, configure RAM/ROM/color variants and quantities, explicitly tap `[ Confirm Selection ]` (`[ ยืนยันการเลือก ]` / `[ 确认选择 ]`) to commit to the customer's CRM list, and finally save the overall CRM sheet.
- **Strict State Decoupling & Immutability**:
  - `_selectedProducts`: strictly stores committed customer CRM products (`List<CustomerSalesProductItem>`).
  - `_draftProduct`: `ProductSelectorItem?` (temporary picker draft).
  - `_draftVariant`: `ProductVariantSelectorItem?` (temporary picker draft variant).
  - `_draftQuantity`: `int` (temporary picker quantity stepper, default 1).
  - The draft state is completely decoupled from existing CRM items. Opening the product picker always starts empty (`_draftProduct = null`, `_draftVariant = null`, `_draftQuantity = 1`) regardless of whether 0, 1, or 5 products already exist in the CRM list.
- **Conditional Confirmation Gate (`_canConfirmSelection`)**:
  - `[ Confirm Selection ]` is disabled (`onPressed: null`) while the draft product is unselected or while variant choices remain unselected for multi-variant products.
  - Tapping `[ Confirm Selection ]` atomically commits the item to `_selectedProducts`, resets all temporary draft variables, and closes the picker.
  - Canceling (`IconButton(Icons.close)` or `_cancelAddProduct()`) aborts the draft with zero side-effects on existing CRM items.
- **Full-Width Action Ergonomics**: The `[ Confirm Selection ]` button is placed as a full-width action at the bottom of the draft card with a checkmark icon, eliminating horizontal text clipping or overflow across English, Thai, and Chinese translations.

# In-App APK Update System Architecture (v1.0.5+6) (2026-08-18)

- **Decoupled Version Management Backend**: Implemented dedicated `AppVersionModule` with `AppRelease` PostgreSQL persistence and public version query API (`GET /app/version/android` and `GET /app/version/:platform`).
- **Integer-Based Build Number Progression**: Version comparison strictly utilizes monotonic integer `buildNumber` rather than fragile semantic string comparisons, preventing issues where `1.0.4+5` vs `1.0.5+6` could evaluate ambiguously.
- **Fail-Safe Dynamic Configuration & Resilience**: `AppVersionService` returns active PostgreSQL releases ordered by `buildNumber DESC`, backed by safe compile-time / environment defaults if the database query returns empty, guaranteeing 100% API availability.
- **Three-Tier User Experience Model**:
  - **Tier 1: Up to date (`currentBuildNumber >= latestBuildNumber`)**: Silent operation without modal interruption during launch/resume; explicit confirmation SnackBar on manual check in Profile Settings.
  - **Tier 2: Optional update (`currentBuildNumber < latestBuildNumber && !isForced`)**: Dismissible dialog showing release notes, version badge, "Update Now", and "Later".
  - **Tier 3: Forced update (`currentBuildNumber < minimumSupportedBuildNumber || forceUpdate: true`)**: Non-dismissible barrier dialog with `PopScope(canPop: false)`, blocking app usage until the critical update is applied.
- **Enterprise-Grade Intent-Based APK Installation**: In compliance with Android enterprise security policies and permission sandboxing, the app triggers verified HTTPS downloads via the Android system browser/download manager using `url_launcher` (`LaunchMode.externalApplication`), strictly rejecting silent background APK overwrites.
- **Automated Lifecycle Integration**: Update checks execute seamlessly on app initialization (`_restore()`) and on app resume (`didChangeAppLifecycleState: resumed`), plus on-demand in the Profile settings section.

# Customer Sales Information CRM Module & Conversion Workflow (v1.0.4+5) (2026-08-18)

- **Sales Lifecycle Decoupling (Leads vs Purchases)**: Redesigned the legacy single-purchase structure into a flexible CRM-style sales module. Customer conversations track `CustomerSalesStatus` (`INTERESTED` vs `PURCHASED`), recognizing that customers in LINE OA frequently inquire and show interest before purchasing.
- **Interested → Purchased Conversion Ergonomics**: Added 1-click `[ 🛍️ Convert to Purchased ]` workflow for existing Interested leads. When converting, all existing selected products and configured variants (RAM, ROM, Color, Quantity) are seamlessly preserved and transitioned to `PURCHASED`, requiring only 2-3 additional taps for Store/Online channel and Payment Method.
- **Conversion Duration & Audit Telemetry**: Backend automatically detects transition from `INTERESTED` to `PURCHASED`, calculating `conversionTimeMs` from the original lead creation date, and recording `isConversion: true`, `conversionTimeMs`, and `interestRecordedAt` in `ActivityHistory.metadata`. Both mobile bar and Web Monitor render conversion duration badges (`🎯 → 🛍️ (2d 4h)`).
- **Conditional Sales Data Model**:
  - `INTERESTED` (Leads): Captures products of interest alongside `CustomerInterestLevel` (`HOT`, `WARM`, `COLD`). Purchase channels and payment methods are hidden.
  - `PURCHASED` (Customers): Captures purchase channel (`STORE`, `ONLINE`), `PaymentMethodType` (`CASH`, `INSTALLMENT`, `CREDIT_CARD`, `OTHER`), and verified purchased products.
- **Multi-Product Relation (`ConversationSalesProduct`)**: Captures `productModelId`, `productVariantId` (RAM, ROM, color), `quantity` (default 1, positive int), `customProductName`, and item-level `status`.
- **Zero Data Loss Migration & Backward Compatibility**: Maintained dual-projection backward compatibility across API responses.
- **Mobile & Web UI Usability & Pilot Readiness**:
  - **Neutral Interest Level**: Defaults `interestLevel` to `null` (`Not specified` / `ยังไม่ระบุ`) with deselect toggle.
  - **Explicit Selection Visual States**: Unambiguous prefixes (`✓ Option` vs `○ Option`) with `showCheckmark: false` avoiding duplicate icons.
  - **Pre-Save Review & Confirmation Modal**: Clear breakdown before commit with dynamic action buttons (`Confirm Save` vs `Confirm Purchase`).
  - **Instant Save Feedback**: Non-blocking floating SnackBar (`✓ Customer sales information saved` / `✓ Customer converted to Purchased`).

# LINE Reply-First Delivery Strategy with Push API Fallback (2026-08-17)

- **Quota Consumption Optimization via Official LINE Reply API**: To dramatically reduce LINE Official Account monthly message quota usage (which charges exclusively on Push API calls while Reply API messages are 100% quota-free), outbound messages sent by branch managers (BM) through both web and mobile clients adopt a **Reply-First → Push Fallback** delivery pattern.
- **Encrypted Token Persistence & Lifecycle Tracking**: Inbound webhook message events extract and encrypt `replyToken` using `CredentialEncryptionService` (`AES-256-GCM`), storing it in `Message.encryptedLineReplyToken` alongside `lineReplyTokenReceivedAt = new Date()`. Reply token fields are never returned in public API payloads and are cleanly stripped by `safeMessage()`.
- **Unconstrained Newest-Token Selection (No Application-Defined Age Cutoff)**: Reply token eligibility no longer uses an application-defined age cutoff (such as 45s, 60s, or 5m). The backend always attempts the newest unused LINE replyToken for the conversation first and lets LINE determine token validity. Explicit token rejection falls back to Push API. Old timestamps are preserved for telemetry.
- **Atomic Concurrency Protection**: Multi-instance concurrency is safely guarded by atomic conditional DB update (`UPDATE "Message" SET "lineReplyTokenUsedAt" = $now WHERE id = $id AND "lineReplyTokenUsedAt" IS NULL`). Only the winner of the atomic claim dispatches to Reply API; concurrent racing sends cleanly fall back to Push API.
- **Fail-Safe Fallback & Duplicate Send Protection**: When LINE explicitly returns HTTP 400 with `"Invalid reply token"` (due to edge expiry or external manual reply in LINE OA app), `ConversationsService` seamlessly falls back to `LineMessagingService.pushText` / `pushImage` and marks the message as delivered with `fallbackReason: "INVALID_REPLY_TOKEN"`. Network timeouts or 5xx server errors on Reply API fail safely without duplicate push attempts.
- **Unified Observability & Empirical Age Bucketing**: Structured JSON telemetry logs `line_message_delivery` capturing `deliveryMethod` (`REPLY` vs `PUSH`), `replyTokenAgeMs`, `replyTokenAgeBucket` (`< 30 seconds`, `30-60 seconds`, `1-2 minutes`, `2-5 minutes`, `5-10 minutes`, `> 10 minutes`), `fallbackReason`, `statusCode`, and `x-line-request-id` with zero secret exposure.

# Bulk "Mark as Replied" Operational Override Workflow (2026-08-17)

- **Operational Transition Tool Without Status Mutation**: To support the pilot transition while retail staff gradually migrate from replying in external LINE OA to our application, an operational override (`POST /conversations/bulk-mark-replied`) allows marking conversations as `REPLIED` (`bmReplyStatus = 'REPLIED'`) in bulk without introducing artificial statuses. The existing enum (`NOT_REPLIED`, `NOTIFIED_BM`, `REPLIED`) remains unchanged.
- **Strict Store Scope & Cross-Store Protection**: `StoreAccessService.assertStoreAccess` verifies user authorization against the target store. Client-provided store IDs are never blindly trusted; store IDs are derived from the target conversations. Mixed-store conversation batches are explicitly rejected with 403 `ForbiddenException` to maintain strict tenant and store isolation.
- **Dual-Layer Audit & Traceability**: Each bulk action records an `ActivityHistory` row (`actionType: BM_REPLY_STATUS_CHANGED`, `metadata.actionType: BULK_MARK_REPLIED`) linked to individual conversations, and an `AuditLog` row (`action: BULK_MARK_REPLIED`) capturing the actor, store ID, store name, affected count, and conversation IDs.
- **Explicit Confirmation & In-Place Reconciliation**: The web admin interface prompts for confirmation with a clear modal (`ยืนยันเปลี่ยนสถานะ` / `คุณกำลังเปลี่ยน X บทสนทนาเป็น 'ตอบแล้ว'`) and triggers optimistic list/counter reconciliation on completion.

# Dedicated Public TikTok Store Authorization Flow with Internal Service Authentication (2026-08-17)

- **Decoupled Public Store Authorization (`/tiktok/connect` & `/tiktok/callback`)**: Retail store staff across ~150 stores need to authorize their store's TikTok account without administrative access to the OPPO LINE OA Monitor system. `/tiktok/connect` is a public Next.js route handler that generates a 32-byte cryptographic OAuth state stored in a secure HttpOnly cookie (`tiktok_oauth_state`, SameSite=Lax, 10 min maxAge) and immediately 302 redirects to TikTok OAuth with read-only scopes.
- **Dedicated Internal Backend Sync Endpoint (`POST /tiktok/internal/sync`) Protected by Shared Secret**: Unrestricted anonymous access to `POST /tiktok/sync` was reverted. Instead, a dedicated `POST /tiktok/internal/sync` endpoint is protected by `InternalTikTokSyncGuard`, requiring the `X-Internal-TikTok-Secret` header verified via constant-time `crypto.timingSafeEqual` against `TIKTOK_INTERNAL_SYNC_SECRET`. The Next.js server-side OAuth callback dispatches this internal request without exposing the secret to the browser.
- **Success Page Cookie-Based State Integrity**: Instead of relying on tamperable URL query parameters for connection proof, `/tiktok/callback` writes a short-lived (60s), HttpOnly, SameSite=Lax cookie `tiktok_connect_result` scoped to `/tiktok/connect/success`. The public success page verifies the cookie server-side to render store details, or renders a generic confirmation if unverified.
- **Strict StoreMaster Binding & Ambiguity Routing**: Normalized username matching (lowercase, whitespace trimmed, leading `@` stripped) binds incoming TikTok accounts directly to `StoreMaster`. If 0 stores match, the user is redirected to `/tiktok/connect/error?reason=store_not_found`. If duplicate store records exist in StoreMaster (>1 matches), the user is redirected to `/tiktok/connect/error?reason=duplicate_store_mapping`.
- **Public Mobile-First Success and Error Experience**: Standalone success (`/tiktok/connect/success`) and error (`/tiktok/connect/error`) pages feature Thai & English messaging, display verified store and account metadata, provide retry mechanisms, and strictly omit admin shells, sidebars, and navigation.
- **Preserved Admin Dashboard Flow**: Admin users navigating to `/tiktok/connect` while authenticated with `oppo_session` are redirected back to the admin dashboard (`/tiktok/dashboard/[accountId]`) upon completing OAuth.

# Multi-Account TikTok Store Routing & Account-Specific Isolation (2026-08-14)

- **Dedicated Dynamic Dashboard Route (`/tiktok/dashboard/[accountId]`)**: To support multi-account scaling across ~150 retail stores without conflating store metrics, individual account dashboards are decoupled to `/tiktok/dashboard/[accountId]`. The base `/tiktok/dashboard` route redirects to the primary account dashboard if accounts exist or renders an empty state if no stores are connected.
- **Multi-Account Store Overview (`/tiktok`)**: When 2 or more store accounts are connected, `/tiktok` renders a responsive card grid displaying each store's avatar, displayName, `@username`, StoreMaster store name, province, region, followers, status badge, and direct "Open Dashboard" button.
- **Account-Specific Backend Data Endpoints (`GET /tiktok/accounts/:id` & `GET /tiktok/accounts/:id/metrics`)**: Endpoints strictly scope queries by `tikTokAccountId`, preventing cross-store video leakage and cross-store follower metric leakage.
- **Duplicate & Binding Safety**: Reconnecting the same TikTok openId updates the existing account in-place without creating duplicate records. Connecting a distinct openId creates an independent second `TikTokAccount` without overwriting existing store accounts (e.g. O-Central World).

# Automatic Daily TikTok Metric Collection & Scheduled Worker Architecture (2026-08-14)

- **Lightweight Standalone Scheduled Worker (`backend/scripts/sync-tiktok-daily-metrics.ts`)**: Rather than running in-memory cron intervals or browser-triggered fetch loops inside web server containers, daily synchronization is decoupled into a standalone CLI script executable via Railway Cron (`0 18 * * *` UTC, mapping to 01:00 Asia/Bangkok).
- **Controlled Concurrency & Error Isolation**: Accounts are synchronized in controlled batches of 5 (up to 20 concurrency) using `Promise.allSettled`. A single account error (e.g. rate limit, deauthorization, or transient network blip) is isolated and recorded in the summary report without halting the remaining ~150 store synchronizations.
- **Server-Side Token Lifecycle & Rotation**: Refresh tokens are decrypted in memory solely when access tokens expire. Rotated refresh tokens returned by TikTok OAuth v2 are immediately encrypted and persisted to PostgreSQL. Accounts with invalid/revoked grants are gracefully marked `EXPIRED` or `ERROR` without logging credentials.
- **Zero-Dependency SVG Follower Trend Chart**: Created a lightweight, responsive SVG line chart with non-interpolated data points, area gradient shading, hover tooltips, and explicit empty state handling when fewer than 2 snapshots exist.

# TikTok Daily Account Metric Snapshots & Follower-Growth Semantics (2026-08-14)

- **Asia/Bangkok Calendar Boundary Normalization (`getBangkokCalendarDate`)**: To align with Thai retail operations and business reporting dates, snapshot `metricDate` values are normalized to the `00:00:00.000` UTC boundary corresponding to the `Asia/Bangkok` calendar date.
- **Unique Account-Day Constraint (`@@unique([tikTokAccountId, metricDate])`)**: Guarantees that at most one daily snapshot exists per TikTok account per calendar day. Multiple syncs on the same calendar day update the existing daily record to reflect the latest known metrics rather than creating duplicate rows.
- **Honest Growth Calculation Without Fabrication**: Historical growth metrics (`dailyFollowerGrowth`, `sevenDayFollowerGrowth`, `thirtyDayFollowerGrowth`) compare against actual persisted snapshot records at `T-1`, `T-7`, and `T-30` days. If a comparison snapshot is unavailable, the growth is reported as `null` rather than a misleading `0`. Negative follower deltas are preserved.
- **Dedicated Protected Metrics Endpoints**: `GET /tiktok/accounts/:id/metrics` and `GET /tiktok/latest/metrics` return historical daily snapshots alongside computed follower growth summaries without exposing tokens or credentials.

# Automatic TikTokAccount to StoreMaster Binding & Reconciliation (2026-08-14)

- **Normalized Username Matching (`TikTokAccount.username -> StoreMaster.tiktokUsername`)**: TikTok usernames are normalized with lowercase conversion, whitespace trimming, and leading `@` stripping on both sides. No fuzzy matching or display name heuristics are used.
- **Fail-Safe Ambiguity Handling**: If exactly 1 store matches, `storeMasterId` is linked. If 0 matches (`STORE_NOT_FOUND`) or multiple matches (`AMBIGUOUS_STORE_MATCH`), `storeMasterId` remains null and a diagnostic is returned without guessing.
- **Durable Post-Import Reconciliation**: `POST /tiktok/reconcile-stores` enables retroactively binding already-synced accounts (e.g. O-Central World) once StoreMaster data is imported/refreshed, removing any requirement for store managers to reauthorize TikTok OAuth.
- **Preservation of Existing Links**: Existing `storeMasterId` values are preserved upon subsequent account synchronization unless an explicit override is provided.

# TikTok Video Metric Enrichment & Display API Query Pipeline (2026-08-14)

- **Two-Stage Display API Video Enrichment (`/v2/video/list/` + `/v2/video/query/`)**: In TikTok Display API v2, `POST /v2/video/list/` provides basic pagination and item listing. To guarantee that fresh performance metrics (`like_count`, `comment_count`, `share_count`, `view_count`) and active CDN `cover_image_url` values are retrieved, video IDs obtained from `/video/list/` are queried against `POST /v2/video/query/?fields=...`.
- **Property Naming DTO Alignment**: Frontend and backend DTOs seamlessly map both camelCase (`viewCount`, `likeCount`, `coverImageUrl`) and snake_case (`view_count`, `like_count`, `cover_image_url`), ensuring seamless persistence without undefined coercion.
- **Dynamic Cover Image Refresh**: TikTok cover URLs expire periodically. The sync pipeline updates `coverImageUrl` on every video fetch without assuming permanent CDN URLs.
- **Safe Diagnostic Telemetry**: Logs `videoListCount`, `videoQueryCount`, `videosWithViewCount`, and `videosWithCoverImage` as counts and status codes, never logging access tokens or secrets.

# Next.js Same-Origin Auth Proxy & TikTok Route Authentication Boundary (2026-08-14)

- **Same-Origin Authentication Proxy (`/auth/* -> API_BASE_URL/auth/*`)**: To guarantee that `Set-Cookie: oppo_session` is set directly on the frontend domain (`lineoppo.click`) with `Path=/; HttpOnly; Secure`, Next.js rewrites `/auth/:path*` to the backend. Browser client calls in `api.ts` dispatch to same-origin `/auth/*`, making the session cookie available to Next.js Server Components and Route Handlers on `lineoppo.click`.
- **Enforced Authentication Boundary on TikTok Routes**: `/tiktok`, `/tiktok/dashboard`, `/tiktok/connect`, and `/tiktok/callback` now enforce active session validation via `cookies()`. Unauthenticated requests redirect to `/login` to reuse the existing application authentication UX rather than silently failing backend sync or rendering empty dashboard states.
- **Safe Cookie Scoping & Configuration**: Cookie remains `Path=/`, `HttpOnly: true`, `Secure: true` in production, `SameSite: "none"` (or `"lax"` for same-origin proxying), with optional `SESSION_COOKIE_DOMAIN` support without creating second sessions.

# Canonical Bearer Session Authentication for Server-to-Server TikTok Endpoints (2026-08-14)

- **Single Canonical Server-to-Server Auth (`Authorization: Bearer <sessionToken>`)**: When Next.js Route Handlers (`/tiktok/callback`) or Server Components (`/tiktok`, `/tiktok/dashboard`) call backend endpoints protected by `AuthGuard`, the authenticated `oppo_session` token is extracted from the request context and forwarded solely as an `Authorization: Bearer <token>` header. Raw incoming browser cookie headers and duplicate `Cookie: oppo_session=...` headers are strictly excluded.
- **Fail-Closed Missing Session Handling**: If `oppo_session` is absent from the incoming context, authenticated requests are rejected/short-circuited without dispatching unauthenticated empty-token requests to backend services.
- **Safe Diagnostic Telemetry**: Logs `sessionTokenPresent: boolean`, `backendSyncStatus`, and `backendReadStatus` as numeric/boolean signals, strictly preventing session token and credential material exposure.

# TikTok Module Route Restructuring & Performance Dashboard (2026-08-14)

- **Dedicated Module Route Hierarchy**: Separated `/tiktok` (Module Overview / Home) from `/tiktok/dashboard` (Performance Analytics Dashboard) and `/tiktok/connect` (OAuth Connection Entry). This establishes a clean multi-view navigation model for TikTok operations without conflating the main LINE OA `/dashboard`.
- **Server-Driven Overview & Dashboard Separation**: `/tiktok` focuses on account status, retail store binding attribution, and quick audience metrics with a primary CTA to open the dashboard. `/tiktok/dashboard` delivers in-depth performance analytics across the 6 core KPI dimensions, top-performing video highlights, total engagement aggregations, and individual video performance metrics.

# StoreMaster TikTok Account Mapping & Importer Pipeline (2026-08-14)

- **Master Directory Pre-Authorization Mapping**: To support accurate multi-account attribution across 150 retail stores before OAuth initiation, `StoreMaster` stores `tiktokUsername` and `tiktokProfileUrl`. The fields are indexed on `tiktokUsername` to enable fast store resolution by authorized TikTok handle.
- **Resilient Importer Sanitization**: Column I (`TikTok Username`) and Column J (`TikTok Profile URL`) in the master Google Sheet/CSV are parsed with automatic leading `@` stripping, whitespace trimming, and `#REF!` normalization to `null`. Missing TikTok entries do not fail the import.
- **Diagnostic Signal Independence**: Importer diagnostics track missing usernames, duplicate usernames, malformed profile URLs, and handle-URL mismatches as actionable data-quality metrics without impeding LINE OA metadata sync or database upserts.

# Canonical StoreMaster Ownership for TikTok Persistence (2026-08-14)

- **Single StoreMaster Canonical Relation**: `TikTokAccount` maintains `storeMasterId` as the single canonical foreign key relation (`onDelete: SetNull`) to `StoreMaster`, eliminating dual-FK drift from the previous schema.
- **AES-256-GCM Token Encryption**: Tokens are encrypted at rest with AES-256-GCM supporting `CREDENTIAL_ENCRYPTION_KEY || LINE_CREDENTIAL_ENCRYPTION_KEY` fallback for 100% backward compatibility.

# TikTok Server-Side Token Exchange & POC Store Architecture (2026-08-14)

- **Strict Server-Side Token Exchange**: The OAuth authorization code is exchanged for tokens exclusively on the server at `https://open.tiktokapis.com/v2/oauth/token/` via `POST application/x-www-form-urlencoded`. Authorization codes, client secrets, access tokens, and refresh tokens are strictly prevented from entering client component props, HTML, cookies, or browser storage.
- **Server Store for Single-Account POC**: For the Sandbox proof-of-concept, account profile data and video analytics are stored in a server-side in-memory module store without database schema mutations, allowing instant verification and rendering on the `/tiktok` account dashboard.

# Public Origin Redirect Resolution for Container Deployments (2026-08-14)

- **Sanitized Public Origin Enforcement**: In containerized hosting environments (such as Railway) where SSL is terminated at edge proxies and forwarded to internal loopback/container interfaces, server-side redirects must not resolve `request.url` or `request.nextUrl` directly. Instead, OAuth redirect endpoints (`/tiktok/callback`, `/api/tiktok/authorize`) resolve the public domain via `getPublicAppUrl()`, defaulting securely to `https://lineoppo.click` and rejecting internal host patterns (`0.0.0.0`, `localhost`).

# TikTok OAuth Route Handler Callback & Clean Result Architecture (2026-08-14)

- **Atomic Validation and Cookie Destruction**: The OAuth callback endpoint `/tiktok/callback` is implemented as a pure Route Handler (`GET /tiktok/callback/route.ts`). It performs timing-safe state validation, safe boolean diagnostic logging, immediately clears the `tiktok_oauth_state` HttpOnly cookie in the HTTP 302 redirect response, and forwards the browser to `/tiktok/callback/result?status=...`.
- **Elimination of Post-Render Side Effects**: Decoupling validation into a Route Handler eliminates client-side `useEffect` triggers and Server Action `POST` requests, preventing Next.js App Router post-action component re-renders that previously caused double-processing and state replay failures.

# Direct HTTP Redirect Authorization Endpoint for Cookie Reliability (2026-08-14)

- **Native HTTP 302 Redirect Initiation**: To guarantee `Set-Cookie` header persistence across browser engines before cross-origin navigation to TikTok, authorization is initiated via a dedicated Route Handler (`GET /api/tiktok/authorize`). This avoids Next.js Server Action redirect digest interception and ensure standard `Set-Cookie: tiktok_oauth_state=...; Path=/; HttpOnly; SameSite=Lax; Secure` application.
- **Safe Diagnostic Capability**: Server-side callback evaluation logs only boolean sanity flags (`callbackStatePresent`, `stateCookiePresent`, `stateLengthsMatch`, `stateMatched`, `hasCode`, `hasError`). Raw state values, codes, and tokens are strictly excluded from logging.

# TikTok OAuth State Validation and Cookie Consumption (2026-08-14)

- **Timing-Safe State Validation**: The callback route `/tiktok/callback` validates the returned `state` parameter against the HttpOnly `tiktok_oauth_state` cookie using Node's `crypto.timingSafeEqual` to prevent side-channel timing attacks.
- **State Consumption and Anti-Replay**: The `tiktok_oauth_state` cookie is consumed and deleted upon callback invocation via `consumeTikTokOAuthStateAction`, preventing state reuse or replay attacks.
- **Security Messaging Invariant**: If state validation fails (missing state, missing cookie, or mismatched state), the callback displays a generic, safe error message (*"Unable to verify the TikTok authorization request. Please start the connection again."*) without exposing either state value in the response or logs.

# TikTok OAuth Connect Entry Architecture and Scoped Authorization (2026-08-14)

- **Server-Side Authorization Construction**: The TikTok OAuth initiation flow is orchestrated via a Next.js Server Action (`initiateTikTokOAuthAction`) at `/tiktok/connect`. All authorization URL parameters (`client_key`, `redirect_uri`, `scope`, `response_type=code`, `state`) are constructed server-side to prevent client-side parameter tampering.
- **Cryptographic State Protection**: OAuth `state` is generated using a 32-byte cryptographic random generator and persisted in an HttpOnly, secure, SameSite=Lax cookie (`tiktok_oauth_state`) for CSRF validation during callback processing.
- **Scoped Read-Only Transparency**: Scopes are strictly limited to read-only monitoring (`user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`). Publishing or modifying capabilities are deliberately excluded.

# TikTok OAuth Callback Foundation and Security Isolation (2026-08-14)

- **Public Callback Isolation**: The TikTok OAuth callback route is implemented as a standalone public route at `/tiktok/callback` (`frontend/src/app/tiktok/callback/page.tsx`). It safely processes incoming query parameters (`code`, `state`, `error`, `error_description`) via React Suspense and client hooks.
- **Strict Credential & Code Non-Exposure**: Authorization codes, client secrets, and access tokens are never rendered to the DOM, exposed in client bundles, or logged to the browser console. Token exchange logic is deferred exclusively to server-side backend routines when backend TikTok integration is activated.
- **Search Engine Indexing Prevention**: The route explicitly specifies `robots: { index: false, follow: false }` to prevent indexing of authorization callbacks.

# Public Privacy Policy Architecture for Developer App Compliance (2026-08-14)

- **Public Route Isolation**: The Privacy Policy page is implemented as an unauthenticated static Next.js App Router route (`/privacy`) at `frontend/src/app/privacy/page.tsx`. It provides official data privacy, storage, and retention documentation required for third-party platform developer app reviews (e.g. TikTok Developer App review).
- **Navigation Independence**: The route is completely decoupled from the internal application navigation shell (`TopNavigation`) and authentication lifecycle (`ApplicationWorkspace`), ensuring zero side effects on internal LINE OA monitoring flows, navigation layout, or session state.

# Public Terms of Service Architecture for Developer App Compliance (2026-08-14)

- **Public Route Isolation**: The Terms of Service page is implemented as an unauthenticated static Next.js App Router route (`/terms`) at `frontend/src/app/terms/page.tsx`. It provides official legal and operational documentation required for third-party platform developer app reviews (e.g. TikTok Developer App review).
- **Navigation Independence**: The route is completely decoupled from the internal application navigation shell (`TopNavigation`) and authentication lifecycle (`ApplicationWorkspace`), ensuring zero side effects on internal LINE OA monitoring flows, navigation layout, or session state.

# Top Navigation Layout Ownership and Click Target Resolution (2026-08-14)

- **Layout Ownership Invariant**: The right-side controls (`app-header-controls`) and the search wrapper (`ResponsiveSearch`) must only occupy their intrinsic interactive width (`shrink-0` and `ml-auto`) rather than using unbounded flex expansion (`lg:flex-1`). This ensures no transparent or invisible flex containers overlap sibling navigation links in the stacking context.
- **Responsive Navigation Integrity**: Primary navigation links render directly as native Next.js `<Link>` elements. At 2xl breakpoints ($\ge 1536\text{px}$), secondary links render inline; below 2xl, they collapse into the "More" dropdown. Spacing, link padding, and search clamping are balanced so that all navigation targets remain fully unobstructed, clickable, and keyboard-accessible across all viewport sizes without z-index escalation.

# Phase 6A design system foundation (2026-08-14)

- Centralize presentation tokens and Material 3 theme configuration before screen redesign so visual changes do not alter authentication, realtime, notification, pagination, or message state behavior.
- Keep reusable widgets presentation-only and callback-driven. Feature pages remain responsible for their existing state and repository interactions until later UX phases extract them incrementally.

# Phase 6B modern Inbox presentation (2026-08-14)

- Keep Inbox data ownership and realtime behavior in `InboxPage`; extract only visual conversation cards, previews, filter/search presentation, and connection status indicators.
- Filter chips and search are intentionally visual-only in this phase. They do not alter repository queries or conversation state until a later interaction/API phase.

# Phase 6C.1 chat presentation components (2026-08-14)

- Extract only stateless rendering from `ChatPage`: `ConversationHeader` owns the existing app-bar presentation and `MessageBubble` owns bubble layout, timestamp, sender, footer, and retry presentation.
- Keep ChatPage as the owner of message state, realtime events, pagination, scroll commands, optimistic sends, media loading, notification cleanup, and unread handling. The extracted widgets receive data and callbacks only.

# Phase 6C.2 image presentation component (2026-08-14)

- `ImageBubble` owns only image visual states and the fixed 240×240 container. It receives the current media snapshot and bytes from ChatPage and invokes a callback for viewer navigation.
- Media fetching, byte caching, processing-state ownership, media.updated handling, and viewer route ownership remain in ChatPage.

# Phase 6C.3 chat composer presentation component (2026-08-14)

- `ChatComposer` owns only the safe-area layout and controls for text entry, image attachment, and sending. It receives the existing `TextEditingController` and callback functions from ChatPage and never disposes or mutates the controller.
- Optional disabled/loading flags are presentation-only. ChatPage remains the owner of send/image methods, retries, idempotency, optimistic messages, repository calls, and all state transitions.

# Phase 6C.4 message timeline presentation component (2026-08-14)

- `MessageTimeline` owns only list layout, date separators, pending placement, image/message presentation, and the top-scroll notification bridge. It receives the existing controller and delegates pagination, user-scroll invalidation, media loading, retry, and image-opening callbacks.
- ChatPage remains the owner of ScrollController lifecycle, `_scrollGeneration`, `_programmaticScroll`, initial landing, `_loadOlder`, SSE handling, message state, media bytes/cache, and all mutations.

# Phase 6C.5 conversation header enhancement (2026-08-14)

- Keep `ConversationHeader` stateless and callback-driven while enriching its presentation with the existing customer/store/status data. The More actions control is intentionally a placeholder until a product action is defined.
- Existing back/profile navigation callbacks and ChatPage read/notification behavior remain untouched.

# Phase 6C.6 quick reply presentation component (2026-08-14)

- `QuickReplyPanel` is presentation-only: it renders loading, empty, and selectable suggestion states and reports selection through a callback.
- ChatComposer exposes the panel only through optional disabled-by-default inputs. No AI service, repository, backend endpoint, or message-send behavior is introduced in this phase.

# Phase 6D app shell/profile audit (2026-08-14)

- Keep `LineOaApp` responsible for authentication restore/session expiry, Firebase/bootstrap, realtime and notification service lifecycle, and logout cleanup during the first shell migration.
- Extract an `AuthenticatedShell` only around the authenticated Inbox/Chat/Profile route composition. Keep repositories and lifecycle callbacks injected from the app coordinator; do not duplicate connections or move authorization into presentation navigation.
- Split Profile presentation into account, memberships, settings, and admin-tools sections incrementally while retaining backend role enforcement and existing approval/logout callbacks.

# Phase 6D.1 AuthenticatedShell extraction (2026-08-14)

- `AuthenticatedShell` owns authenticated page composition and route pushes while continuing to use the existing root Navigator and `MaterialPageRoute` architecture.
- `LineOaApp` remains the sole owner of auth/session state, repositories, realtime and notification services, logout cleanup, session expiry, and the notification callback that delegates conversation opening to the shell.

# Phase 6D.2 profile presentation sections (2026-08-14)

- ProfilePage remains the callback/data coordinator while stateless widgets own account, membership, settings placeholder, header, and admin-tool presentation.
- Settings has no persistence or side effects in this phase. Admin tool visibility remains convenience UI only; backend authorization remains authoritative.

# Phase 6E customer profile boundary (2026-08-14)

- Keep `Customer` as the owner of LINE identity/profile data, `Conversation` as the owner of store-scoped status and context, and `Message` as the owner of communication history. A mobile CustomerProfileSheet should initially consume the existing conversation payload and avoid duplicating CRM state.
- Rich fields (`pictureUrl`, status message, language, profile fetch state), name history, events, and intelligence exist in web/customer APIs but are not part of the mobile detail contract. Any mobile expansion must add a store-authorized, minimal profile endpoint rather than calling the current customer endpoints directly.
- Do not expose raw LINE user IDs, webhook payloads, credentials, or profile fetch errors to the mobile UI. Treat customer CRM attributes (contact details, consent, lifecycle, tags, ownership, purchase history) as a later bounded schema/API phase.

# Phase 6E.1 customer profile sheet (2026-08-14)

- Keep the first mobile customer context surface local to the loaded `ConversationDetail`. The sheet uses only display name, store context, reply status, unread count, loaded message count, and latest message time.
- Open the sheet from the existing header profile callback. It has no repository, API, read-state, notification, or chat-state responsibilities.

# Phase 6F AI Quick Reply boundary (2026-08-14)

- Treat the existing AI modules as deterministic analytics/classification and operational recommendation capabilities. They are not a generative reply engine and do not provide RAG or vector retrieval.
- Quick replies must be generated server-side from an authorized, bounded conversation context and grounded product/store knowledge. Flutter only renders suggestions and inserts a selected draft into the existing composer; it never sends automatically.
- Customer messages are untrusted prompt data. Enforce store authorization, provider isolation, structured-output validation, rate/cost limits, audit telemetry, and explicit BM approval before using the existing outbound message API.

# AI Quick Reply product specification (2026-08-14)

- Position Quick Reply as a BM copilot that drafts grounded responses; it never becomes an autonomous customer-facing agent in the MVP.
- Optimize first for faster, safer first responses in a small set of retail intents. Unknown, stale, transactional, or policy-sensitive questions must produce a cautious clarification or human-escalation draft rather than an asserted answer.
- Treat approved product/store/policy sources as authoritative and preserve the existing outbound send path, UUID idempotency, authorization, and audit requirements.

# Phase 4C.4.2 cancellable scroll commands (2026-08-14)

- Scroll commands carry a generation token. User-directed movement invalidates pending initial or bottom auto-scroll callbacks, preventing stale post-frame work from overriding the reading position.
- Pagination restoration remains separately guarded as programmatic work and continues to preserve the pre-fetch offset.

# Phase 4C.4.1 initial scroll pagination guard (2026-08-14)

- Older-message pagination is disabled during initial conversation landing and enabled only after content dimensions and the bounded initial scroll routine complete.
- Programmatic scroll jumps are marked so the pagination listener cannot mistake initial positioning or viewport restoration for a user request to load older messages.
- Manual scrolling remains the only trigger for the first older-page fetch, preserving realtime append behavior and pagination viewport stability.

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
# Phase 4C.4 initial chat scroll

- Initial ChatPage scrolling uses bounded post-frame stabilization rather than a single first-frame jump. It waits for content dimensions and repeats the jump across three frames; realtime append scrolling remains unchanged. All IMAGE states, including missing media metadata, reserve the same fixed viewport.

# Follower KPI Alignment and Shared Calculation (2026-08-14)

- Shared Follower Aggregation Helper: Extracted pure calculation functions (`calculateFollowerGrowthMetrics`, `calculateStoreFollowerRanking`, and `getPeriodDates`) in `backend/src/follower-insights/follower-aggregation.helper.ts`.
- Executive Dashboard and Follower Insights now share identical calculation semantics for follower metrics:
  1. Total Followers is a stock metric computed by summing the latest valid ready snapshot per unique eligible active OA in the permission scope.
  2. Growth Metrics (New Followers, Blocked, Net Growth) are computed via delta comparison between target date and baseline date (`today - 1d` for today, `today - 7d` for 7d, `today - 30d` for 30d) strictly for comparable accounts where both target and baseline ready snapshots exist.
  3. Accounts with missing baseline snapshots are excluded from growth deltas (never assumed to have 0 baseline or 0 delta) while remaining included in total stock.
  4. Follower Insights `getSummary` range query now includes the preceding day baseline to guarantee valid `dailyIncrease` for single-day and range start dates.

# AI Quick Reply architecture (2026-08-14)

- Quick Reply is a conversation-scoped, on-demand draft capability. It never sends autonomously; BM edits/selects a suggestion and the existing authorized mobile reply endpoint performs the send and idempotency handling.
- Authorization is resolved server-side with `StoreAccessService.assertConversationAccess`; client-supplied store IDs and LINE OA IDs are not accepted as scope inputs. ADMIN has global access, while active BM/STAFF memberships are limited to active assigned stores.
- Providers are hidden behind an injection token/interface. The deterministic provider is the production-safe MVP and mandatory fallback; a future LLM adapter may be selected by server-side configuration without changing context, DTO, safety, or send boundaries.
- Context is bounded and grounded in authorized recent messages, classification/product catalog data, and approved store facts. Raw webhook payloads, credentials, tokens, full unbounded history, and unmasked LINE identifiers are excluded.
- Existing `AuditLog` is reused for Quick Reply lifecycle actions. Audit writes are best effort and metadata contains IDs, provider/version, source types, latency, risk flags, and outcomes—not prompts, customer text, secrets, or full suggestion bodies.

# AI Quick Reply data contracts (2026-08-14)

- The public API returns only bounded draft suggestions and a `contextMessageId`; the full authorized `QuickReplyContext` is an internal provider contract and is never accepted from the client.
- Suggestions are transient, server-issued IDs with an expiry and are always drafts. Sending continues through the existing mobile conversation reply endpoint, preserving its authorization and idempotency behavior.
- Provider output passes through a safety contract that can filter candidates or invoke deterministic fallback. The feature configuration is server-owned, disabled by default, and clamps client-requested locale/count values.
- Quick Reply audit events map to the existing `AuditLog` action/metadata shape for MVP. Metadata excludes raw prompts, customer text, suggestion bodies, tokens, and credentials; a dedicated event table is deferred until query volume justifies a migration.

# AI Quick Reply context builder (2026-08-14)

- Context is assembled only after `StoreAccessService.assertConversationAccess` resolves the conversation's store. The builder is read-only and does not trust client store, LINE OA, customer, or message identifiers.
- Message context is bounded and newest-focused, with a small recent window plus the triggering inbound message. Images and other non-text messages contribute type/status metadata, not storage URLs or raw payloads.
- Product and policy facts follow a strict precedence: approved store/policy data, verified catalog data, then classification signals. Missing or stale facts produce clarification/handoff drafts instead of guessed claims.
- A canonical context version is derived from conversation/message IDs, timestamps, locale, source versions, and fact versions. It supports cache keys and stale-suggestion rejection without hashing or storing raw customer content.

# AI Quick Reply deterministic MVP implementation (2026-08-14)

- The endpoint is disabled unless `AI_QUICK_REPLY_ENABLED=true`; server configuration clamps locale/count/TTL values and no client flag can enable it.
- `QuickReplyContextBuilder` performs conversation access authorization before bounded Prisma reads. It does not call the mutating full-history classifier or broad customer-intelligence analysis on request.
- `DeterministicQuickReplyProvider` returns editable drafts only. Product drafts require persisted active catalog matches; otherwise a safe human-handoff draft is returned. `QuickReplySafetyService` rejects empty, ungrounded, malformed, or high-risk candidates.
- Suggestions never call LINE or mutate messages. BM delivery continues through the existing mobile reply endpoint. Audit events reuse `AuditLogService`; no migration is required.

# AI Quick Reply production hardening (2026-08-14)

- Generation responses carry a SHA-256 context version derived from bounded authorized context inputs. Lifecycle telemetry is accepted only for a still-valid process-local generation owned by the authenticated user and conversation, with a fresh context-version comparison; stale or expired events return 409 and are not audited as accepted.
- Quick Reply generation uses the existing `AuthRateLimitBucket` atomic upsert with a per-user one-minute key. This avoids a schema change and works across replicas as long as the existing rate-limit migration is deployed.
- Safety validation rejects prompt-injection text, URLs/contact-like output, control characters, excessive lines/length, ungrounded claims, and unsupported catalog claims. A deterministic human-handoff fallback remains mandatory; suggestions are never sent automatically.
- Metrics are intentionally process-local counters plus safe structured logs for this MVP. A durable metrics backend and shared generation store (Redis or a dedicated table) remain future work for multi-replica lifecycle analytics; a restarted replica safely rejects old lifecycle events instead of accepting stale data.

# Flutter AI Quick Reply integration (2026-08-14)

- Quick Reply is enabled at the authenticated shell boundary but remains server-gated by `AI_QUICK_REPLY_ENABLED`; a disabled backend returns an actionable composer error with retry rather than affecting chat loading.
- ChatPage keeps ownership of all conversation/realtime/pagination/scroll/send state. Quick Reply state is additive composer state only; selecting a suggestion replaces the text-field draft and never invokes the send API.
- Backend lifecycle events are sent for SHOWN, SELECTED, and EDITED. SENT is logged locally as a non-sensitive client signal because adding a new backend lifecycle enum would violate this phase's no-backend-change constraint; successful delivery still goes through the existing reply endpoint.

# Chat UI transformation (2026-08-14)

- Chat UX redesign stays inside the existing stateless presentation seams. Conversation state, repository calls, SSE handling, pagination, scroll generation, optimistic sends, unread marking, media loading, and notification cleanup remain owned by ChatPage and its existing services.
- The composer keeps attachment and send callbacks unchanged. The AI shortcut invokes the existing quick-reply refresh callback only; suggestions remain editable drafts and never send autonomously.
- Image bubbles retain a fixed 240x240 viewport across processing states. Message bubbles retain the existing 300px maximum width to preserve established scroll/pagination geometry while the visual styling changes.

# Core Chat/Inbox status and preview semantics (2026-08-14)

- Mobile user-facing reply states are intentionally reduced to two operational concepts: `NOT_REPLIED` and `NOTIFIED_BM` both render as `Need Reply`; `REPLIED` renders as `Completed`. Backend enum values remain unchanged for compatibility.
- Inbox overview and filter derivation use the same shared status mapping. Any non-`REPLIED` legacy value is treated as actionable so the invariant Total = Need Reply + Completed cannot drift.
- Latest-message preview is direction-aware: outbound text is prefixed with `You:`, and image previews use `Sent an image` with the same outbound prefix. The backend remains the authoritative source for message direction/type/timestamp.
- Returning from Chat performs a targeted detail reconciliation and patches the existing Inbox item in place; it must not reload the full list, reset pagination, or disturb scroll state.
- Persistent Chat header prioritizes customer identity and reply state. Store context remains available in Inbox and the customer profile sheet rather than occupying the always-visible header.

# Manual conversation tagging V1 (2026-08-15)

- Customer source is a nullable conversation-level enum (`STORE` or `ONLINE`); no client-supplied store or LINE account scope is accepted.
- A conversation may have one optional manual model tag selected from active model-level catalog rows. The mobile endpoint deletes/replaces only `MANUAL` rows, so automatic `RULE` classifications remain available internally.
- Tag updates are authorized by `StoreAccessService` and use partial PATCH semantics: omitted fields are preserved and explicit null clears a field. No automatic tagging, AI, Inbox filters, or new ProductMaster model is introduced in V1.

- The mobile tag editor uses bounded modal dimensions and wrapping action/header layouts instead of `Expanded`/`Spacer` inside an intrinsic bottom sheet. This prevents Android unbounded-width render failures while preserving the existing tag state and save callbacks. Product QA must report the missing active `OPPO Find N6` catalog row separately from the tagging implementation.

# Product Master synchronization (2026-08-15)

- Product Master imports are canonical model-only data: RAM/ROM/COLOR variant rows collapse to one `ProductModel`, and existing ProductSeries/ProductGroup records are reused. Sheet categories map deterministically to SMARTPHONE, TABLET, AUDIO, WEARABLE, and ACCESSORIES.
- The importer is a separate maintenance command with a mandatory dry-run mode. It updates/reactivates only authoritative canonical models, preserves ProductAlias and ConversationProduct rows, and never deletes products absent from the sheet. Ambiguous categories, series, or duplicate normalized names fail before any transaction starts.

# Detailed manual conversation tagging (2026-08-15)

- Customer source is migrated from one nullable enum to a PostgreSQL enum array with `NULL -> []`, `STORE -> [STORE]`, and `ONLINE -> [ONLINE]`; encoded strings are not used. `isInstallment` is a separate explicit boolean.
- Product variants are canonical rows keyed by `(productModelId, variantKey)` from normalized RAM/ROM/COLOR values. Variant selection remains optional and is validated server-side against the selected manual ProductModel; changing or clearing the model clears the variant.
- Product Master synchronization remains dry-run-first, idempotent, non-destructive, and model-ID preserving while adding variants. Missing variants are not automatically deleted in this phase.

- Mobile tag actions are placed in the bounded sheet header using a wrapping layout. This keeps Clear all and Save reachable on narrow Android screens without changing tag state ownership or API behavior.

# Variant selection UX (2026-08-15)

- Product selection is a two-stage presentation: before selection, the sheet shows bounded product search/results; after selection, results are hidden and a selected model card plus Configuration controls are shown. This prevents the results list from pushing RAM/ROM/Color controls off-screen.
- Variant dimensions are derived only from active server-returned `ProductVariant` rows. Selecting a dimension resolves to an existing variant ID, so the client cannot construct arbitrary RAM/ROM/Color combinations. Missing dimensions are omitted; a model with no variants remains selectable and saveable.
- Variant loading is isolated from product errors, has a retry state, and uses generation guards so stale product changes cannot overwrite current configuration state. Saved variants are restored by ID when the endpoint response includes them. No new API or migration was needed.

# Chat overscroll behavior (2026-08-15)

- Overscroll suppression is scoped to `MessageTimeline`: `ClampingScrollPhysics` prevents elastic movement and `ChatScrollBehavior.buildOverscrollIndicator` returns the child unchanged, removing Android stretch/glow without changing app-wide scrolling.
- Pagination continues to observe normal scroll notifications and remains owned by ChatPage/MessageTimeline. No scroll controller, generation token, initial landing, offset restoration, realtime, or notification behavior was changed.

# App-wide overscroll policy (2026-08-15)

- Use a single `AppScrollBehavior` on `MaterialApp` rather than per-screen wrappers. It returns `ClampingScrollPhysics` and suppresses Material's Android overscroll indicator, covering vertical, horizontal, sheet, and modal scrollables consistently.
- Explicit `AlwaysScrollableScrollPhysics` remains only on lists wrapped by `RefreshIndicator`; Flutter composes it with the app's clamped parent, preserving pull-to-refresh without restoring stretch/glow.
- Chat's previous local behavior was removed after the global policy was installed. Scroll controller ownership, initial landing, pagination/offset restoration, realtime append, unread, and notification lifecycles remain unchanged.
- Runtime QA found a narrow registration dropdown layout overflow unrelated to scrolling; setting both existing dropdowns to `isExpanded` was the smallest presentation-only correction and does not alter registration state or API behavior.

# Phase 8A navigation and employee identity (2026-08-15)

- Authenticated top-level destinations use a persistent `IndexedStack` with Inbox, a truthful Summary placeholder, and Profile. Conversation detail remains a root Navigator push, so the bottom navigation is not shown over Chat and existing Inbox state stays mounted across tab switches.
- Personal Information is read-only in V1. It displays the authoritative `/auth/me` fields and gracefully renders `Not set` for legacy users without an employee ID; setting rows without an implemented backend contract are explicit non-actionable `Coming soon` surfaces.
- Employee IDs belong to User, not Store. New registration validates and canonicalizes `trim().toUpperCase()`, while the database field remains nullable for legacy users and gains a unique index. Admin and authenticated-user responses expose only the safe employee ID field.

# Analytics trust foundation and monthly summary (2026-08-15)

- QA exclusion is an explicit persistent `Conversation.isQa` boolean, controlled by safe ADMIN/data-maintenance operations. Analytics never infers QA from display names, message text, or sender heuristics; operational conversation behavior remains unchanged.
- Monthly reporting is query-based at current scale. It filters active, non-archived stores through `StoreAccessService`, uses explicit Asia/Bangkok UTC boundaries, and computes response cycles from chronological inbound messages plus persisted outbound messages with a non-null `senderUserId`. Ambiguous outbound rows and SYSTEM messages are excluded.
- Response SLA values remain withheld until at least ten answered cycles are available. The API returns safe internal counts and an explicit availability flag; Flutter shows collection progress instead of fabricated percentages or durations. Previous-period comparisons are hidden when historical coverage is insufficient.
- No analytics warehouse, Redis cache, materialized table, or persisted response-cycle model is introduced in V1. The message volume is measured at roughly 20k rows and can be revisited only after production query timing demonstrates a need.

# Full app localization (2026-08-15)

- Flutter `gen_l10n` with ARB resources is the localization boundary. Supported locales are Thai (`th`), English (`en`), and Simplified Chinese (`zh`/`zh_CN`); Traditional Chinese is intentionally unsupported.
- Language preference is persisted locally and applied immediately at the root `MaterialApp`. Startup precedence is saved preference, then supported system locale, then English. No backend field, session change, or logout is involved.
- Only product-owned UI copy is translated. Customer names, store names, employee IDs, emails, Product Master names/colors, and customer/BM message text remain authoritative dynamic content. Status mapping is explicit: `NOT_REPLIED` and `NOTIFIED_BM` render as Need Reply; `REPLIED` renders as Completed.

# Summary V2 analytics semantics (2026-08-15)

- Manual tags have no change-history model, so Summary V2 reports current manual tag state for conversations with inbound activity in the selected period and labels the mode `CURRENT_TAG_SNAPSHOT`. Tag month-over-month comparison is intentionally suppressed.
- Response-cycle semantics and the ten verified answered-cycle threshold are unchanged. Duration comparisons use a human semantic delta (faster/slower), while distribution comparisons use percentage points; unavailable comparison data remains neutral.
- Customer source analytics use mutually exclusive `storeOnly`, `onlineOnly`, `storeAndOnline`, and `untagged` buckets. Product analytics include only `MANUAL` ConversationProduct rows, aggregate one model row per conversation, and retain variant dimensions together to avoid cross-model color claims.
- The query-based implementation reuses existing authorized conversation/message/tag data and adds no migration, cache, warehouse, or background aggregation until measured production latency demonstrates a need.

# Phase 8D.1 customer tag semantics (2026-08-16)

- `Conversation.isInstallment` remains the storage/API field and is interpreted as a customer attribute: the customer has installment purchase history. No schema migration or API rename is needed.
- Source channels remain a mutually exclusive analytics bucket only when aggregated (`STORE`, `ONLINE`, or both); the mobile editor continues to allow both source chips plus the independent installment status chip.
- Product and variant tags stay manual and are presented alongside source/status under one Customer Tags surface. Summary wording uses “Installment customers” and explicitly describes percentages as tagged-customer status, never customer intent.

# Phase 8D runtime correction (2026-08-15)

- Summary month navigation uses the one-based month accepted by Dart's `DateTime.utc` constructor. The prior `month - 1 + delta` calculation skipped a month and made forward navigation a no-op; the minimal correction is `month + delta`, covered by a widget regression assertion.

# Operational priority queue foundation (2026-08-16)

- Operational priority is intentionally separate from `Conversation.priority`, which remains the existing classification/manual field. The new calculation is dynamic and chronology-based, so a new inbound message after a completed reply is actionable even when the persisted reply status has not yet changed.
- The mobile list receives an additive `priority` object for its already-authorized page. Internal score is never exposed; no persistence, index, migration, auto-reply, AI, webhook, SSE, unread, or notification behavior is introduced in this phase.

# Flutter priority queue UI (2026-08-16)

- Priority remains backend-authoritative: Flutter decodes level, waiting duration, waiting timestamp, and reason codes but never calculates or displays the internal score/formula. The Priority tab filters actionable non-completed conversations and sorts urgent/high/normal, then oldest waiting first.
- Reply/realtime reconciliation preserves existing state ownership. A successful reply clears the local priority presentation when the authoritative detail status is `REPLIED`; no new refresh, SSE, notification, unread, or persistence path was added.

# Phase 9D.1 Purchase Information contract (2026-08-16)

- Preserve existing Prisma storage and expose semantic API sections: MANUAL `ConversationProduct` rows are purchase information; RULE rows and classification fields are AI insight; reply/unread/priority remain operational state.
- Additive `purchaseInformation` and `aiInsight` fields preserve legacy response fields. A semantic `PATCH /mobile/conversations/:id/purchase-information` route is added while `/tags` remains backward compatible.
- Historical MANUAL records are not auto-verified and RULE records are never converted into purchases. Customer-level purchase history remains deferred until repeat-purchase requirements are approved.

# Phase 9D.2 purchase provenance (2026-08-16)

- Store provenance at conversation level because the current purchase editor saves one coherent purchase-information snapshot: `purchaseRecordedById` and `purchaseRecordedAt` are additive and nullable for legacy rows.
- Extend existing `ActivityHistory` with `createdByUserId` and JSON `metadata`; purchase updates use `PURCHASE_INFORMATION_UPDATED` and record old/new semantic snapshots without storing credentials or customer LINE identifiers.
- The API exposes the recorder display name and ISO timestamp while retaining the stable MANUAL/RULE separation. No historical MANUAL row is automatically promoted to verified purchase data.

# Purchase intelligence and admin operation layer (2026-08-16)

- Verified purchase analytics are query-time projections over provenance-backed `Conversation` snapshots; no CustomerPurchaseHistory or aggregate table is introduced. A record is eligible only when `purchaseRecordedAt` exists and the selected relation rows are `MANUAL`.
- `GET /admin/purchase-analytics` reuses `StoreAccessService`: ADMIN has global scope, store members are constrained to active assigned stores, and an explicit `storeId` is rejected when it falls outside that scope. Active/non-archived store filtering remains server-side.
- Web Admin separates Recorded Purchase Information from AI Insight and uses neutral “Verified Purchase Records” terminology. RULE classifications, scores, and internal reason codes are never counted or displayed as purchases.

# Purchase ownership and legacy provenance (2026-08-16)

- `ConversationProduct.source = MANUAL` is necessary but not sufficient for verified purchase information. The additive `purchaseInformation.recordState` marks rows as `VERIFIED` only when the BM purchase save has provenance, `LEGACY_MANUAL` when historical manual fields lack provenance, and `NONE` otherwise.
- Existing MANUAL/RULE rows are preserved. Legacy MANUAL data is not shown as a verified purchase and is not included in provenance-backed analytics; RULE data remains AI Insight only.
- The Web Admin purchase section is verified-only for display. Its older generic tag-edit action was removed from the UI; explicit edits use the purchase-information contract so only provenance-backed saves are shown as verified purchase records. The legacy endpoint remains for compatibility and produces no verified provenance by itself.

# Web purchase editing contract (2026-08-16)

- Web Admin now uses the existing authenticated `/mobile/conversations/:id/purchase-information` contract for explicit purchase edits, including product model, variant, channel, and installment fields. It no longer calls the generic `/conversations/:id/tags` endpoint from the purchase section.
- The backend contract remains unchanged: the authenticated actor and store scope are resolved server-side, and every successful edit records provenance and activity history through the existing mobile service.

# Production semantic-contract deployment finding (2026-08-16)

- Railway backend and frontend are both still deployed from `9312961`, so local uncommitted semantic-alignment code is not in production.
- The production database is also missing the already-authored additive purchase-provenance migration. Legacy MANUAL records remain unverified by design; deployment must apply the migration, and a BM must explicitly re-save a record to establish provenance.

# Forced password-change authorization (2026-08-17)

- `mustChangePassword` is enforced centrally in `AuthGuard`, not only by Flutter navigation. During the forced-change state, only profile inspection, password change, and logout routes are allowlisted; every other authenticated route fails closed with HTTP 403 and `PASSWORD_CHANGE_REQUIRED`.
- The mobile exception filter preserves this one explicit state code while retaining existing `SESSION_EXPIRED`, `ACCESS_DENIED`, and `RESOURCE_NOT_FOUND` behavior for all other mobile errors. No schema or migration change is required because the flag already exists on `User`.

# Conversation summary authorization scope (2026-08-17)

- Conversation reply-status and priority summaries resolve store scope in the controller from the authenticated user via `StoreAccessService`; client filters are not accepted as authorization input.
- The summary service requires the resolved scope explicitly. `null` means ADMIN/global active-store scope, while a list means assigned stores; an empty list remains empty and can never become an all-store query. No database migration is required.

# Purchase write boundary (2026-08-17)

- Verified purchase fields are writeable only through the provenance-aware purchase-information service. The legacy mobile tag route rejects source, installment, product, and variant fields before opening a transaction.
- The generic conversation tag route remains compatible for MANUAL topic tagging but rejects non-empty product IDs; it cannot delete or create purchase rows. RULE classification rows are never mutated by tagging.
- Purchase saves always persist the authenticated recorder/timestamp and append an activity snapshot, including same-value saves, so every purchase update remains attributable without exposing credentials or customer identifiers.

# Password policy boundary (2026-08-17)

- Password policy is centralized in `auth/password-policy.ts` and reused by request DTOs and service methods. Hashing remains a separate concern, so existing stored passwords continue to verify normally.
- New passwords are rejected before hashing when they lack the required length, character classes, or special character. Admin reset passwords are generated with all required classes and validated before storage.
- No password migration is performed; users are required to satisfy the stronger policy only when creating or changing a password.
# Main OA tenant and authorization boundary (2026-08-24)

- `LineOfficialAccount.accountType` is the authoritative workspace discriminator. Names, Store Master codes, and frontend filtering are never authorization or tenancy inputs.
- `Conversation.lineOfficialAccountId` remains the message tenant boundary. `Conversation.storeId` and `LineOfficialAccount.storeId` are nullable only for `HEAD_OFFICE`; a database check enforces the valid combinations so Main OA needs no fake Store or Store Master.
- Existing store endpoints fail closed to `STORE`, while `/main-oa/*` fails closed to `HEAD_OFFICE`. Detail operations verify the conversation's OA type before returning data.
- Main OA access is capability-based (`canAccessMainOa`, `canManageMainOa`) and defaults false for every existing user, including ADMIN. Manage implies access through a database constraint.
- The existing per-OA webhook key/signature flow is reused. Store push notifications remain store-only; shared conversation persistence and LINE reply/push delivery are reused for Main OA.

# Main OA local verification boundary (2026-08-24)

- Runtime verification uses only the local PostgreSQL container, an encrypted dummy temporary HEAD_OFFICE fixture, and signed synthetic webhook payloads. No real LINE credential, external webhook, deployment, or production data mutation is part of this audit.
- Temporary capability grants and fixtures are created and removed in the same verification run; final database counts and invariants must match the pre-test baseline before reporting completion.
- Rolling-window tests derive fixture dates from the service's public date helper so the test remains deterministic as the calendar advances; production date behavior is unchanged.

# Main OA production Stage 1 boundary (2026-08-24)

- Deploy the clean, locally verified release commit through Railway's existing backend/frontend services using local uploads; do not push unrelated work or create a new project/database.
- Let the existing backend pre-deploy command own production migration execution (`npx prisma migrate deploy`), then verify the migration record and account-type constraints before application smoke tests.
- Use only temporary existing-user sessions and minimum capability grants for authorization smoke testing. Restore flags and delete sessions before completion; never create a production HEAD_OFFICE account or add credentials in Stage 1.
- Treat changes in dynamic conversation/message totals during the deployment window as live traffic unless database evidence shows a deployment write or data loss. Store account/follower/friend-source scope counts are the regression invariants.

# Main OA production Stage 2 safety boundary (2026-08-24)

- Do not create or activate the production `HEAD_OFFICE` account until the approved secure environment provides all real Main OA inputs (Channel ID, channel secret, channel access token, display name, and Basic ID). Missing credentials are a hard stop; generic/local LINE variables are not assumed to identify the Main OA.
- Stage 2 remains incremental: create exactly one null-Store/null-Store-Master account only after the credential audit and baseline, verify LINE identity read-only, then configure the existing account-specific webhook before controlled internal inbound/outbound tests. Never print, log, or persist plaintext credentials outside the existing encrypted columns.
- The current audit stopped before any external write. The recorded production baseline and missing-input evidence are the rollback-safe handoff for the next Stage 2 attempt.

# Main Workspace/Main OA rebase boundary (2026-08-24)

- `origin/main` remains the source of truth for the existing Main Workspace, AppSidebar, top navigation, homepage, and navigation structure. Main OA is integrated into that shell rather than restoring the older top-navigation-only layout.
- Main OA remains a distinct `HEAD_OFFICE` capability-gated workspace. Its sidebar entry is rendered only for `canAccessMainOa` users, it never enters Store selection, and its page/API paths continue to enforce the same capability and account-type boundaries.
- The rebase preserved the three local Main OA commits and added only follow-up integration/test-fixture changes. The backup branch is intentionally untouched. No push, deployment, database mutation, credential change, or webhook configuration was performed.

# Frontend verification-gate baseline (2026-08-24)

- The detached `origin/main` baseline reproduced every one of the original 27 frontend failures; none was introduced by the Main OA rebase. The failures were stale assertions around the `/home` entry route, AppSidebar replacing primary TopNavigation, responsive wrapper entrypoints, current dashboard copy, and current TikTok/purchase route composition.
- Tests were updated to assert the current architecture rather than restoring obsolete UI behavior. The missing Classification Insights route was treated as a real product gap because it was referenced by the workspace and route tests; a minimal authenticated `ApplicationWorkspace` entrypoint and matching sidebar link were added.
- The resulting frontend suite is green at 378/378 while preserving AppSidebar, Main Workspace, Store/Main OA separation, and Main OA capability gating.

# Classification Insights frontend visibility boundary (2026-08-24)

- Classification Insights is intentionally not a current frontend workspace. Its page/view/translation modules, navigation entries, route state, and frontend API surface are removed so users cannot discover or enter the unsupported UI.
- The backend classification/product-intelligence implementation is left untouched; removing the frontend exposure does not alter stored classification data or backend authorization boundaries.
- The route tree test asserts that no `/classification-insights` page is registered, while Main Workspace, Store Operations, and capability-gated Main OA navigation remain unchanged.

# Approval notification email boundary (2026-08-24)

- Registration approval remains the source of truth: the existing transaction transitions the registration, user, and membership first; the approval email is dispatched only after that transaction resolves. Provider failure cannot roll back or invalidate the approval.
- Email delivery is provider-independent through `EmailProvider`; the current `ResendEmailProvider` sends only a plain notification/template message. The approval email contains display name, store, BM/PC role, and support guidance, and never contains credentials, tokens, URLs, or internal identifiers.
- Duplicate approval email dispatch is prevented by conditional pending-state updates and the existing pending-only transition guard. No Resend button or new delivery-state schema was introduced; existing hashed-recipient `EmailDeliveryEvent` rows provide sanitized operational outcomes for this first version.

# BM/PC account lifecycle boundary (2026-08-24)

- Phase 1 uses the existing suspension states rather than adding a new enum or migration: `UserStatus.SUSPENDED` plus `isActive=false` marks an inactive account, and active Store memberships become `MembershipStatus.SUSPENDED`. This keeps approval provenance and historical rows intact while making every existing auth path fail closed.
- Deactivation invalidates all web/mobile sessions and active device tokens in the same transaction. Device-token rows are retained with `isActive=false` for recoverability and auditability; no plaintext token is exposed.
- Reactivation restores exactly one intended membership, ordered by primary status and approval recency, instead of enabling every historical membership. It is an administrative state transition only and does not re-send registration approval email.
- Permanent deletion remains out of scope for Phase 1. Before any future delete capability, relationship-by-relationship impact and retention requirements must be audited; no delete endpoint or schema relationship was introduced here.

# BM/PC permanent deletion boundary (2026-08-24)

- Permanent deletion uses a tombstone, not `prisma.user.delete`. The new `DELETED` status and `deletedAt` preserve the User row so membership approval history, message sender references, conversation purchase/sales attribution, activity history, translation feedback, mass-message creator references, and audit actor/target references remain valid.
- The transaction deletes sessions, device tokens, push notifications, and OTP challenges; suspends any remaining active memberships; scrubs registration-request PII; and replaces account PII with a non-routable unique `deleted+<userId>@deleted.lineoppo.invalid` identity. No deletion or approval email is sent.
- Only active ADMIN actors can delete inactive approved VIEWER BM/PC accounts. ACTIVE accounts, ADMIN accounts, Main OA-capable identities, self-delete, and deleted accounts are rejected or safely idempotent. Reactivation explicitly rejects tombstones.
- Deletion audit metadata contains only safe status/timestamp/membership-history fields. Original email, phone, employee ID, password, tokens, and other PII are excluded. The explicit destructive UI requires exact `DELETE` text and never exposes the action for ACTIVE rows.

# Public landing-page boundary (2026-08-25)

- `/` is an unconditional public product page for authenticated and unauthenticated visitors. Authentication remains explicit through `/login`; the landing route does not inspect sessions or render the administrative AppShell.
- `/tiktok/connect` remains the public account-authorization entry. Administrative TikTok routes and the existing workspace routes retain their current session and capability boundaries.
- The shared `ApplicationWorkspace` remains in its existing client module to avoid a broad, unrelated extraction. Optional route metadata was not added because native head tags in that client module duplicate the layout metadata; a future workspace extraction can introduce canonical route-level metadata safely.

# Deterministic public TikTok authorization destination (2026-08-25)

- `/tiktok/connect` is a public Store Authorization entry, so its successful OAuth callback always returns to `/tiktok/connect/success` regardless of an existing `oppo_session` cookie.
- Cookie presence is not trusted routing or authorization intent. If an admin-specific connect flow is introduced later, it must use an explicit short-lived server-created signed/HttpOnly marker; no unsigned query parameter will control the destination.
- TikTok dashboard account lookup treats backend 401 as an authentication failure and redirects to login. Only a genuine backend 404 or a successful null payload represents an absent account and triggers the Next.js not-found page.
- Server-side TikTok admin API calls forward WEB sessions through the backend's canonical `oppo_session` cookie. They do not relabel a WEB session as Bearer auth because backend Bearer credentials are intentionally reserved for MOBILE sessions.

# HQ mobile inbox alignment (2026-08-25)

- Reuse the mobile conversation endpoint's existing StoreAccessService scope rather than creating an HQ-only inbox. The optional store/status/search query fields are applied to the same authorized store conversation query, so an all-store HQ account sees every active store conversation and a selected store is re-authorized server-side.
- Keep BM/PC presentation and historical Need Reply filtering intact. The new exact Not Replied / Notified BM labels and the three-row Store/Time → Customer/Preview → Status hierarchy are enabled only for HQ cards, avoiding a mobile regression for existing store users while satisfying HQ's explicit information hierarchy.
- Use `/conversations/store-priority-summary` for mobile store options because it already exposes the authenticated Web chat store scope; no duplicate store-list authorization or schema path was introduced.
- Extend the existing HQ approvals page with its already-supported `hq-approved` and deactivate/reactivate API actions instead of adding a new account-management backend or data model.

# HQ mobile conversation detail boundary (2026-08-25)

- Conversation detail remains a presentation layer over `/mobile/conversations/:id`, the existing message/media repository, and `ConversationsService.sendMessage`/`updateBmReplyStatus`. Mobile status changes therefore persist to the same `bmReplyStatus`, follow-up completion, and activity-history state used by Web `/chats`.
- Store identity is rendered from the authorized conversation detail response in a dedicated header context. The client never chooses the sending store; `StoreAccessService.assertConversationAccess` authorizes the conversation and the canonical service resolves the store's OA credentials for delivery.
- `canReply` is enforced at both presentation and mobile service boundaries. Read-only users cannot open the composer or detail write controls, and backend calls fail closed even if a client bypasses the UI. No new notification state or database model was introduced; `NOTIFIED_BM` remains the existing BM notification status.

# HQ mobile inbox operational polish boundary (2026-08-25)

- The HQ unread total comes from the existing authenticated mobile notification count endpoint. It is not derived from the currently loaded page, so all authorized stores remain represented without a new schema or parallel inbox API.
- `Unread` is a client-side view over each conversation's existing unread count; All/Not Replied/Notified BM/Replied continue to use the canonical `bmReplyStatus` values. Store, status, and search state remains owned by the authenticated inbox route and is not persisted through logout.
- Pull-to-refresh, detail return, and realtime patches all trigger backend reconciliation. The existing StoreAccessService and mobile conversation endpoint remain the authorization source of truth; BM/PC behavior is intentionally unchanged.

# Android 1.0.15 release boundary (2026-08-26)

- Release `1.0.15+16` is isolated on `release/android-1.0.15` from the latest `origin/main`. Only the Flutter version, Android release artifact naming, and public Android release metadata are in scope; no database, Main OA, webhook/provider, or Railway changes are authorized.
- Signing must reuse the existing permanent certificate (`E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`) through GitHub Actions secrets. The APK is not published to `frontend/public/downloads` until independent package/version/certificate/API URL/checksum verification passes.

# Android 1.0.14 permanent signing verification (2026-08-25)

- Reused only the existing production key whose certificate SHA-256 is `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14`; no replacement key was generated.
- Store the keystore and credentials only in GitHub Actions repository secrets for CI use; do not commit or upload signing material as repository artifacts.
- Normalize `apksigner` certificate output to a lowercase compact SHA-256 digest before exact comparison because current build tools emit compact lowercase digests rather than colon-delimited uppercase fingerprints.
- Keep the release isolated on `release/android-1.0.14`; publishing the APK metadata does not authorize merging PR #47 or manually deploying Railway.
# Android 1.0.16 release boundary (2026-08-26)

- Release `1.0.16+17` is isolated on `release/android-1.0.16` from `main` commit `b2acbef71aca274e5c697a2c89aa0621463a3073`. Its user-facing scope is PR #52: remove Normal/Urgent badges from mobile conversation cards while preserving backend priority behavior and reply-status badges.
- The signed production APK must be produced only by the existing GitHub Actions permanent signing identity and independently verified against package `click.lineoppo.chat` and certificate SHA-256 `E2:44:A8:98:76:38:8B:01:5B:BD:10:AB:E3:93:26:AA:B1:5D:A2:E1:EC:0F:E0:D6:A8:24:88:55:12:6A:F1:14` before publication. No new or substitute key is authorized.
- Prior APKs and release entries remain immutable in Version History; the new artifact and metadata are additive.

# Android inbound LINE video media boundary (2026-08-26)

- Reuse the existing `LineImageService` media-download/storage implementation (class name retained for compatibility) and authenticated `GET /messages/:messageId/media`; the backend, not Android, retrieves temporary LINE content URLs. Existing Prisma `MessageType.VIDEO` and `MessageMedia` support make a migration unnecessary.
- The mobile detail contract returns `media.processingStatus`, `mimeType`, `fileSize`, and the authenticated proxy `url` only when READY. Realtime media events carry the same metadata so a pending placeholder patches the existing message by ID instead of creating a duplicate.
- Android uses `video_player` lazily after the user taps play, writes backend-proxy bytes to a temporary file for playback, and never autoplays or initializes every timeline video. Existing image/text paths and reply-status/priority logic remain unchanged.

# Android mobile session reliability boundary (2026-08-26)

- Retain the existing 12-hour opaque access-session lifetime. MOBILE sessions additionally receive a 30-day absolute refresh expiry; refreshing rotates both opaque credentials but does not slide or extend that absolute boundary.
- Store only SHA-256 credential hashes server-side. A refresh uses a conditional update against the previous refresh hash, so replay and simultaneous rotation attempts fail closed. The existing Session row remains the revocation unit for logout, account disable/delete, mobile-access removal, and security-sensitive password reset. WEB cookie sessions are unchanged.
- Persist the Android access/refresh pair and both expiries as one secure-storage JSON value. This makes credential rotation atomic from the client's perspective and retains a legacy access-token read path for already-installed builds.
- Only a backend 401/`SESSION_EXPIRED` response from the refresh endpoint is terminal. Network/configuration/5xx and all 403 responses preserve credentials; startup restoration shows a retry state rather than Login. One authenticated 401 initiates a single shared refresh flight, and each failed request retries at most once with the new access token.
- Diagnostic events record restoration, refresh, and forced-logout outcomes without raw tokens, passwords, request bodies, or secrets.

# Android 1.0.17 release and update-metadata boundary (2026-08-26)

- Release `1.0.17+18` contains the already-merged inbound LINE video and mobile session-refresh changes only. Signing reuses the permanent GitHub Actions identity; no local, generated, or substitute signing key is permitted.
- The backend `AppRelease` row is the Android app's canonical update-check contract and `/download/releases.ts` is the Web download contract. Release regression tests require their version, build, APK filename, size, SHA-256, and notes to match, preventing silent drift between in-app and Web distribution surfaces.
- Update availability is determined by integer build number (`17 < 18`), not version-string ordering. Update metadata fetches remain unauthenticated and recoverable failures cannot clear mobile credentials or change login state.
- Migration `20260826163000_release_android_1_0_17` is additive/idempotent: it upserts build 18 and marks older Android releases inactive without deleting release history or application data. The previously merged mobile refresh migration adds nullable columns and a nullable unique index; production migration status confirms it is already applied.

# Reliable Android updater boundary (2026-08-26)

- The canonical `/app/version/android` response remains the only update source. The client resolves its `apkUrl`, downloads into `getTemporaryDirectory()`, streams SHA-256, and refuses installation unless the metadata contains a valid matching 64-character digest. Download tracking occurs only after verified bytes are present.
- Installation is delegated through a narrow Flutter method channel to Android `FileProvider`. The native bridge validates that the path is inside `cacheDir`/`filesDir`, grants a content URI to `ACTION_VIEW`, and opens `ACTION_MANAGE_UNKNOWN_APP_SOURCES` when Android requires per-app install permission. No raw `file://` URI or broad storage permission is introduced.
- A verified APK is retained only while the installer reports permission required, enabling retry without a duplicate download. Other failures delete the temporary file; concurrent Update Now calls share one in-flight operation. The dialog remains visible and renders localized preparing/downloading/verifying/ready/error states so failures cannot disappear silently.
- Server-side compatibility for 1.0.16+17 was investigated but not changed. That binary cannot download itself and its `canLaunchUrl` result is constrained by its already-installed manifest; a different release URL cannot safely correct that client behavior. Production release metadata remains untouched until a new fixed APK is released.

# Android 1.0.18 release boundary (2026-08-26)

- Release `1.0.18+19` is additive over the merged updater and push-notification fixes. The permanent GitHub Actions signing identity remains the only authorized signing path; no key is generated or substituted.
- The APK checksum, size, filename, and Thai release notes are copied into both the Web release history and the additive `AppRelease` migration so `/download` and `/app/version/android` cannot drift. Existing releases and download counters remain preserved.
- This release does not alter Main OA behavior, auth/session semantics, Firebase project/package identity, or production data. Real-device FCM and updater checks remain a post-install requirement; CI only validates build, static wiring, and automated behavior.

# Android push notification delivery boundary (2026-08-26)

- Use a mixed FCM notification+data payload. Android system rendering is the reliable background/terminated path; the Flutter `onMessage` listener renders foreground alerts, and the background isolate renders only data-only fallback messages so a notification envelope can never double-alert.
- Notification recipients are selected from active mobile-eligible users who have an active token and either all-store scope or an active membership for the inbound conversation's store. Main OA/HEAD_OFFICE isolation is preserved because enqueueing remains keyed to the persisted store conversation.
- Device registration uses the same permission projection as mobile auth, allowing all-store/HQ accounts without memberships to register while still preventing inactive, suspended, or mobile-disabled accounts. Explicit logout deactivates the backend token and best-effort deletes the Firebase token; session refresh never unregisters it.
- Android treats notification permission as runtime state, not a one-time request. It reports disabled/denied status in Profile settings and opens the per-app notification settings screen; channel importance remains HIGH with default sound and vibration. No broad storage permission or secret/config replacement is introduced.
- Safe logs carry notification/message IDs, recipient/device counts, accepted/rejected counts, receive path, and permission outcomes only. Message contents, tokens, credentials, and secrets remain excluded.

# Android notification content boundary (2026-08-27)

- The backend notification outbox is the content source of truth: it derives the title/body once from the persisted customer display name, authorized conversation store name, message type, and inbound preview. FCM `data` and `notification` fields carry the same strings so foreground local notifications and background/terminated system notifications are equivalent.
- Customer names use the existing `LINE Customer` fallback; blank store names are omitted rather than replaced with IDs or null text. Customer text is whitespace-normalized and bounded to 160 characters. Media uses readable safe labels (`📷`, `🎥`, sticker, file, audio, location, or localized unsupported fallback) and never includes temporary URLs or internal metadata.
- Recipient targeting remains unchanged: enqueue is still scoped to a stored store conversation and uses the existing active mobile/all-store/membership authorization filters. Main OA remains excluded because it has no store conversation target.
- Android uses backend title/body whenever present and only computes localized fallbacks for legacy/data-only payloads. Existing HIGH channel, sound/vibration, deep-link, deduplication, token lifecycle, and auth/session behavior are unchanged.

# Android manual update prompt boundary (2026-08-27)

- Version detection and presentation are user initiated only: startup restoration and app-resume lifecycle hooks no longer call the updater, and `AppUpdateService.checkForUpdates` returns immediately for non-manual callers as defense in depth.
- Keep install-resume lifecycle separate from version prompting. The update dialog's lifecycle observer still retries a verified APK after the user returns from Android's unknown-source settings, without downloading it again; no auth/session state is touched by updater failures.

# Android startup loading boundary (2026-08-27)

- Render the Flutter shell before provider/network work: `main()` registers the FCM background callback synchronously and calls `runApp` without awaiting Firebase. Notification/Firebase setup and the long-lived realtime connection begin only after a session has selected Login, retry, or Home.
- Startup restoration is an explicit two-stage state machine. Secure-storage access and `/auth/me` each have a 15-second coordinator timeout; temporary failures produce a retryable state while retaining credentials, and only `SESSION_EXPIRED`/a rejected refresh can select Login. API request, refresh, connectivity, and secure-storage operations are bounded at 20 seconds and recovery failures are classified so a temporary refresh outage cannot be rethrown as a terminal 401.
- Safe diagnostics record stage, outcome, and elapsed time only. No token, password, message body, or secret is emitted. The updater remains manual-only; the separate active-install resume lifecycle is unchanged.
