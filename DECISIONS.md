## Frontend Global Application Shell & Navigation (Phase 1)

The frontend application uses a single global application shell (`AppShell`) wrapping every route. Primary top navigation (`TopNavigation`) manages all 5 top-level modules (`/dashboard`, `/chats`, `/stores`, `/follower-insights`, `/friend-source-links`) with neutral/blue active navigation selection (`aria-current="page"`) and semantic design tokens, eliminating green from primary selection states. Layouts are standardized into container primitives (`PageContainer`, `PageHeader`, `SectionHeader`) with 3 specific variants: `readable` (`max-w-7xl`) for reports and insights, `wide` (`max-w-[1440px]`) for Store Management, and `full` (`w-full h-full`) for the Conversations workspace. The contextual sidebar (`ContextSidebar`) is rendered exclusively on `/chats` for status filters and store filter selection, while permanent sidebars are removed from all other pages.

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
