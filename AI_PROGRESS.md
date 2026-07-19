# AI progress

## Current task

Prepare and validate the NestJS backend and PostgreSQL deployment configuration for Railway without deploying.

## Completed work

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

- User creates the private GitHub repository and Railway services using `docs/RAILWAY_DEPLOYMENT.md`; do not push or deploy without explicit approval.
