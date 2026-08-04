# Controlled translation pilot activation

Translation is disabled by default. Activation is a manual Railway environment operation and must be limited to reviewed internal ADMIN accounts.

## Pre-activation

1. Resolve the two intended administrators' authenticated `User.id` values and confirm both users are active with role `ADMIN`. Do not use display names or assume usernames are user IDs.
2. Provision a dedicated Google Cloud Translation project and service-account credential through Railway secrets. Never place the credential JSON in source control or logs.
3. Choose positive integer values for `TRANSLATION_RATE_LIMIT_PER_MINUTE` and `TRANSLATION_DAILY_CHARACTER_LIMIT`.
4. Set the following backend variables in one reviewed Railway change, substituting the real user IDs and secret values:

   ```text
   MESSAGE_TRANSLATION_ENABLED=true
   TRANSLATION_PROVIDER=google
   TRANSLATION_PILOT_MODE=true
   TRANSLATION_PILOT_ALLOWED_ADMIN_IDS=<first-user-id>,<second-user-id>
   TRANSLATION_RATE_LIMIT_PER_MINUTE=<positive-integer>
   TRANSLATION_DAILY_CHARACTER_LIMIT=<positive-integer>
   GOOGLE_TRANSLATION_PROJECT_ID=<project-id>
   GOOGLE_TRANSLATION_CREDENTIALS_JSON=<secret-json>
   ```

5. Before starting the application, run the configuration-only preflight in the backend environment:

   ```text
   npm run translation:pilot:preflight -- --verify-production
   ```

   `--verify-production` explicitly marks the command as a read-only production verification. Without it, the command refuses to run when `NODE_ENV=production`. A ready result reports safe booleans and the allowlist count only; it never initializes Prisma or the provider.
6. After the backend restarts successfully, authenticate as an ADMIN and verify `GET /translation/readiness` reports `ready: true` and `GET /translation/pilot-status` reports `ready: true`, `active: true`, and `allowlistedAdminCount: 2`. Neither endpoint returns configured values, IDs, or credentials.
7. Before translating any real message, run the separately controlled synthetic pilot smoke test in a reviewed non-production environment and observe metrics, budget, and audit output.

## Fail-closed and rollback behavior

- An empty allowlist makes the pilot inactive and not ready.
- A non-allowlisted ADMIN receives HTTP 403 before message lookup or provider invocation.
- Disable the pilot by setting `TRANSLATION_PILOT_MODE=false`; the translation endpoint then returns the controlled unavailable response before database or provider access.
- For a complete shutdown, also set `MESSAGE_TRANSLATION_ENABLED=false` and `TRANSLATION_PROVIDER=none`, then verify readiness and pilot status are both false/inactive.

Changing these variables is an operator action and is not performed automatically by application code or deployment.
