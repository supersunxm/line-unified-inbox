# Railway backend and frontend deployment

This guide deploys the NestJS backend, PostgreSQL, and the Next.js frontend as separate Railway services. Do not put real credentials in Git or this document.

## Selected strategy

Use Railway’s **Root Directory = `backend`** setting. This is simpler than maintaining a repository-level Docker image and lets Railway run the backend’s existing npm and Prisma scripts directly.

## Before deployment

1. Run `npm run verify` and `npm run deploy:check` at the repository root.
2. Confirm both finish successfully. `READY WITH EXTERNAL STEPS` is expected until GitHub and Railway are configured.
3. Create a private GitHub repository. Review the files before committing; `.env`, `.env.local`, `.runtime`, logs, backups, CSV exports, dumps, and ngrok configuration must remain untracked.
4. Push only after confirming the repository is private and the secret scan is clean. Codex must not push without explicit permission.

## Create the Railway services

1. Create a Railway project and choose **Deploy from GitHub repo**.
2. Select the private repository and create the backend service.
3. Set the service **Root Directory** to `backend`.
4. Add Railway PostgreSQL to the same project.
5. Reference the PostgreSQL-provided `DATABASE_URL` from the backend service.
6. Configure these commands:
   - Build: `npm ci --include=dev && npm run build`
   - Pre-deploy migration: `npm run db:migrate:deploy`
   - Start: `npm run start:prod`
7. Configure the health-check path as `/health`.

## Deploy the frontend service

1. Add another service from the same private repository.
2. Set its **Root Directory** to `frontend`.
3. Configure the build command as `npm run build` and the start command as `npm run start`.
4. Set `NEXT_PUBLIC_API_BASE_URL=https://line-unified-inbox-production-544f.up.railway.app`.
5. Set `NEXT_PUBLIC_APP_ENV=production`. This enables production validation and requires an HTTPS API origin.
6. Generate a public Railway domain for the frontend and set its health-check path to `/api/health`.
7. Update the backend service's `FRONTEND_URL` to the frontend's exact HTTPS origin, without a trailing slash, and redeploy the backend. Credentialed CORS does not accept wildcard origins.
8. Redeploy the frontend after changing any `NEXT_PUBLIC_` value because Next.js embeds public variables during the production build.

Railway supplies `PORT`; `npm run start` binds Next.js to `0.0.0.0` and uses that port, defaulting to 3000 locally. The frontend service needs no database, encryption, LINE credential, or backend secret variables.

### Required frontend Railway variables

- `NEXT_PUBLIC_API_BASE_URL=https://line-unified-inbox-production-544f.up.railway.app`
- `NEXT_PUBLIC_APP_ENV=production`

Both values are intentionally public browser configuration. Never add `DATABASE_URL`, Channel Secret, Channel Access Token, encrypted credentials, or encryption keys to the frontend service or to a `NEXT_PUBLIC_` variable.

## Required Railway variables

- `NODE_ENV=production`
- `DATABASE_URL` — Railway PostgreSQL reference
- `FRONTEND_URL=https://<railway-frontend-domain>` after the frontend service is deployed; use `http://localhost:3000` only for local development
- `PUBLIC_WEBHOOK_BASE_URL=https://<railway-backend-domain>` after generating the domain
- `LINE_CREDENTIAL_ENCRYPTION_KEY` — the same stable 32-byte Base64 key used to encrypt existing OA credentials
- `LINE_WEBHOOK_ENABLED=true`
- `PILOT_MODE=true` or `false`
- `PILOT_ADMIN_BOOTSTRAP_ENABLED=false` by default. Set it to `true` only for the temporary first pilot login described below.
- `PILOT_ADMIN_USERNAME` and `PILOT_ADMIN_PASSWORD` when pilot bootstrap is enabled. Create these directly in Railway; never commit them. The password must be at least 12 characters and must not be a common password.
- `PILOT_ADMIN_DISPLAY_NAME=Pilot Admin` (optional)
- `EMAIL_PROVIDER=resend` for first-admin setup on a new database. Use `none` only when registration email is intentionally unavailable and an administrator already exists.
- `RESEND_API_KEY`, `EMAIL_FROM`, and optionally `EMAIL_FROM_NAME` when using Resend
- `DEV_ADMIN_ENABLED=false`
- `MEDIA_STORAGE_ENABLED=false` — recommended for the pilot when inbound image retention is not needed. Image events remain visible, but the backend does not download or store their content.
- When image retention is required, set `MEDIA_STORAGE_ENABLED=true` and `MEDIA_STORAGE_DRIVER=s3`. Railway filesystems are ephemeral, so local storage is rejected in production.
- With media enabled, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` are required Railway secrets. Missing or placeholder values fail startup together in a clear validation error.
- `S3_ENDPOINT` — required by non-AWS S3-compatible providers; omit it for AWS S3.
- `S3_PUBLIC_BASE_URL` — optional and not currently exposed to browsers; media is delivered through the authenticated backend endpoint.
- Cloudflare R2 is the recommended production media provider. Set `MEDIA_STORAGE_ENABLED=true`, `MEDIA_STORAGE_DRIVER=s3`, `S3_REGION=auto`, `S3_BUCKET=oppo-line-media`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, and the R2 access key and secret as Railway secrets.
- Keep `GOOGLE_DRIVE_ENABLED` unset or `false`; when it is `true`, the existing driver selection intentionally prioritizes Google Drive over S3.
- Verify R2 access with the admin `GET /health/storage` and `GET /health/storage/write-test` endpoints before sending test images. Media continues to stream through the authenticated backend endpoint.
- `MEDIA_MAX_FILE_SIZE_BYTES=10485760` and `MEDIA_DOWNLOAD_TIMEOUT_MS=10000` — optional limits shown with their defaults.

For local development, media is also disabled by default. To test downloads, set `MEDIA_STORAGE_ENABLED=true`, `MEDIA_STORAGE_DRIVER=local`, and `MEDIA_LOCAL_DIRECTORY=.media`. The directory is ignored by Git and its filesystem path is never returned by the API. Create production bucket credentials before enabling media on Railway; never use Railway's ephemeral service filesystem for durable images.

Railway supplies `PORT`; do not hard-code it. Sessions use cryptographically random opaque tokens stored hashed in PostgreSQL, so this application has no cookie-signing/session-secret variable. Never invent or expose one merely to satisfy configuration lists.

## Temporary pilot administrator bootstrap

Use this only to seed the first Railway pilot administrator without email OTP. It still uses the normal `/auth/login` endpoint, password hashing, database sessions, secure cookies, and authentication guards.

1. In the Railway backend service, confirm `NODE_ENV=production` and set `PILOT_MODE=true`.
2. Set `PILOT_ADMIN_BOOTSTRAP_ENABLED=true`.
3. Set `PILOT_ADMIN_USERNAME` to a new pilot-only username. It is trimmed and normalized to lowercase.
4. Generate a unique password of at least 12 characters and set it as the Railway secret `PILOT_ADMIN_PASSWORD`. Do not place it in Git, documentation, deployment logs, or screenshots.
5. Optionally set `PILOT_ADMIN_DISPLAY_NAME`; it defaults to `Pilot Admin`.
6. Set `EMAIL_PROVIDER=none` if email delivery is not otherwise needed for the pilot, then deploy the backend.
7. Confirm the deployment log contains `pilot_admin_bootstrap_created` or `pilot_admin_bootstrap_updated`. The password is never logged.
8. Open the frontend. `/auth/setup-status` now reports `firstAdminRequired=false` and `registrationAvailable=false`, so the normal login screen appears.
9. Sign in through the normal login form using `PILOT_ADMIN_USERNAME` and `PILOT_ADMIN_PASSWORD`.
10. Immediately after the successful login, set `PILOT_ADMIN_BOOTSTRAP_ENABLED=false` in Railway and redeploy. Leave the username/password variables stored as Railway secrets or remove them after bootstrap is disabled. The verified ADMIN database account and its password remain usable after disabling bootstrap.

Re-enabling bootstrap intentionally resets the configured account's password hash, display name, ADMIN role, active status, and verified status at startup. It does not delete or modify other administrators. If the internal pilot email is already owned by a different username, startup fails instead of overwriting that account.

## Generate the stable webhook URL

1. Generate a Railway public domain for the backend.
2. Set `PUBLIC_WEBHOOK_BASE_URL` to its HTTPS origin without a trailing path.
3. Redeploy and open `https://<domain>/health`; expect HTTP 200.
4. Log in from the configured frontend and use LINE OA Management. Every displayed URL must be `https://<domain>/webhook/<persistedWebhookKey>`.
5. Run the backend diagnostic locally or against an authorized environment using `npm run test:line-verify -- <lineOfficialAccountId>`.
6. Only after signed tests pass, copy the displayed URL to LINE Developers Console, click **Verify**, enable **Use webhook**, and send a real LINE customer message.

If legacy records were created without a key, run `npm run line-oa:backfill-webhook-keys` once from the backend service environment. It repairs only null or blank keys, preserves every existing key, reports scanned/repaired counts, and never prints LINE credentials. Do not add this command to startup. The existing webhook-key migration already enforces a non-null unique column for newly created records.

## Cookies, sessions, and CORS

The backend allows only `FRONTEND_URL` and enables credentialed CORS; it never uses wildcard origins. Production sessions use a persistent, `HttpOnly`, `Secure`, `SameSite=None` cookie backed by PostgreSQL. The frontend sends credentialed requests, restores the administrator through `/auth/me` after refresh or browser restart, and redirects expired sessions to `/login`. Do not store passwords or session tokens in browser storage, and do not weaken cookie security if a browser policy blocks cross-site cookies.

## Rollback

1. In Railway, redeploy the last known-good backend deployment.
2. Do not run `prisma migrate dev`, `prisma db push`, database reset, or volume deletion in production.
3. Prisma migrations in this repository are forward-only. If a schema change needs reversal, create and review a corrective migration against a backup.
4. Keep `LINE_CREDENTIAL_ENCRYPTION_KEY` unchanged during rollback or stored OA credentials will become unreadable.
5. A rollback must not regenerate webhook keys; the stable LINE Developers URLs should continue resolving.

## Troubleshooting

- **Startup fails:** inspect Railway deployment logs for the explicit missing-variable error.
- **Pilot bootstrap fails:** confirm all three gates are exact strings (`NODE_ENV=production`, `PILOT_MODE=true`, and `PILOT_ADMIN_BOOTSTRAP_ENABLED=true`), then verify the username and password variables are present. Never paste the password into support logs.
- **Migration fails:** verify `DATABASE_URL`, PostgreSQL availability, and `npm run db:migrate:deploy`; never substitute `migrate dev`.
- **Health fails:** confirm Railway passed `PORT`, the process uses `npm run start:prod`, and `/health` is configured.
- **Webhook 404:** confirm the exact persisted key and canonical `/webhook/<key>` path.
- **Webhook 401:** verify that the OA’s encrypted Channel Secret is current; LINE signatures use the exact raw request bytes.
- **Frontend build fails:** confirm both public variables are set and that `NEXT_PUBLIC_API_BASE_URL` is an HTTPS origin without a path or trailing API route.
- **Frontend health fails:** confirm Root Directory is `frontend`, start command is `npm run start`, and Railway passed `PORT`; test `/api/health`.
- **Frontend login fails:** check the exact backend `FRONTEND_URL`, frontend `NEXT_PUBLIC_API_BASE_URL`, HTTPS/CORS response, and browser third-party-cookie policy rather than loosening cookie flags.
