# AI progress

## Current task

Fix and validate repeated dark/light theme switching in the Next.js frontend.

## Completed work

- Made theme changes update `html[data-theme]` synchronously and exclusively, clearing stale root theme classes and attributes before every application.
- Replaced the provider's competing localStorage/effect resolution with one mounted system listener that reads the current preference and cleans up correctly.
- Added explicit paired light/dark tokens for backgrounds, surfaces, text, inputs, navigation selection, buttons, badges, disabled states, hover states, and borders.
- Applied semantic theme classes to the application shell, header, sidebar navigation, store list, filter panel, selects, filter chips, conversation selection, buttons, and empty state.
- Added regression coverage for light → dark → light root cleanup and representative semantic-token usage.

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

- Five focused frontend theme tests passed.
- Frontend lint and production build passed after the build was rerun with the required Turbopack worker permission.
- Final `npm run verify` exited 0 with `PASS`; backend/frontend builds, 70 backend tests, migrations, runtime health, protected routes, and signed webhook checks passed.

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

- Theme switching repair is complete; await user review. Do not push or deploy without explicit approval.
