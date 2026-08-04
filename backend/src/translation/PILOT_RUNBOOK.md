# Translation Pilot Runbook

## 1. Purpose and scope

This runbook is the operator procedure for a controlled internal OPPO LINE OA translation pilot. The pilot provides manual Thai-to-English or Thai-to-Simplified-Chinese translation for eligible inbound text messages. It is restricted to explicitly allowlisted `ADMIN` users.

The pilot is manual only. It does not translate during webhook ingestion, polling, classification, or conversation loading. It never replaces `Message.originalText`. Production activation, rollback, credential provisioning, and allowlist changes are manual operator actions.

This runbook covers configuration, deployment, verification, monitoring, troubleshooting, and shutdown. It does not authorize expanding the allowlist or enabling automatic translation.

## 2. Architecture overview

The request path is:

```text
Store Chats ADMIN action
  -> POST /messages/:messageId/translations
  -> authentication, ADMIN role, pilot allowlist, message eligibility
  -> durable translation cache check
  -> rate limit and daily character budget
  -> OPPO glossary provider decorator
       -> protect seven approved terms with neutral sentinels
       -> exactly one Google Cloud Translation v3 request
       -> restore canonical terms
  -> persist translatedEnglish or translatedChinese
  -> write metadata-only TranslationEvent
  -> return the translated result
```

Feedback uses the separate ADMIN-only `POST /messages/:messageId/translations/feedback` route. It never calls Google. Feedback stores message/admin references, language, rating, issue category, and a translation fingerprint; it does not duplicate translated text.

Observability has two scopes:

- `TranslationEvent` and translation feedback are durable PostgreSQL records used by `npm run translation:quality:report`.
- `/translation/metrics` and `/translation/report` are process-local pilot telemetry. They reset on application restart and are not cross-instance aggregates.

The runtime glossary protects: `OPPO`, `Reno16`, `ColorOS`, `SUPERVOOC`, `AI Eraser`, `AI Studio`, and `Find Series`.

## 3. Enable and disable configuration

Translation is disabled unless all pilot controls are deliberately configured.

### Enable a controlled pilot

Configure these backend environment variables through the approved secrets/configuration system:

```text
MESSAGE_TRANSLATION_ENABLED=true
TRANSLATION_PROVIDER=google
TRANSLATION_PILOT_MODE=true
TRANSLATION_PILOT_ALLOWED_ADMIN_IDS=<user-id-1>,<user-id-2>
TRANSLATION_RATE_LIMIT_PER_MINUTE=<positive-integer>
TRANSLATION_DAILY_CHARACTER_LIMIT=<positive-integer>
GOOGLE_TRANSLATION_PROJECT_ID=<google-project-id>
GOOGLE_TRANSLATION_CREDENTIALS_JSON=<service-account-json-secret>
```

Allowlist entries must be authenticated `User.id` values for active ADMIN users, not display names, email addresses, or assumed usernames. Never print the credential JSON or store it in source control.

### Disable or roll back

For immediate pilot suspension, set:

```text
TRANSLATION_PILOT_MODE=false
```

For a complete shutdown, set:

```text
MESSAGE_TRANSLATION_ENABLED=false
TRANSLATION_PILOT_MODE=false
TRANSLATION_PROVIDER=none
```

After the backend restarts, readiness must be false and pilot status must be inactive. Existing translations, feedback, and events remain intact.

## 4. Pre-launch checklist

- [ ] The intended pilot users are active ADMIN users and their exact database user IDs were independently reviewed.
- [ ] The allowlist contains only the approved pilot administrators.
- [ ] The Google service account belongs to the intended project and has only the required Cloud Translation permission.
- [ ] Cloud Translation API v3 is enabled for the configured project.
- [ ] Credential JSON is stored only in the approved secrets manager/Railway variable.
- [ ] Rate limit and daily character budget are positive integers appropriate for the pilot.
- [ ] Backend lint, tests, and production build pass for the deployed revision.
- [ ] Translation feedback and TranslationEvent migrations are included and reviewed.
- [ ] Database backup/restore procedures are current; no translation-data backfill is planned.
- [ ] Rollback owner and observation window are assigned.
- [ ] The configuration-only production check returns `ready: true`:

  ```bash
  npm run translation:pilot:check -- --verify-production
  ```

The check must expose booleans only. Do not proceed if any check is false.

- [ ] The branch-level release check returns `releaseReady: true`:

  ```bash
  npm run translation:pilot:release-check -- --verify-production
  ```

  This additionally verifies database connectivity, every current migration is applied, the existing health/readiness contract succeeds, and the seven-term glossary smoke contract is available. It does not call Google or translate a message.

## 5. Deployment checklist

1. Deploy the reviewed backend revision with translation still disabled.
2. Apply pending Prisma migrations through the normal deployment process. Confirm migration status before enabling the pilot.
3. Confirm backend startup, health, and readiness while translation remains disabled.
4. Add the reviewed Google project, credential, limits, and ADMIN allowlist through the backend service configuration.
5. Set the feature and pilot switches in the same reviewed configuration change.
6. Allow the backend to restart normally. Do not manually redeploy unrelated frontend or worker services.
7. Run the production configuration check:

   ```bash
   npm run translation:pilot:check -- --verify-production
   ```

8. Verify the authenticated readiness and pilot-status endpoints.
9. Run the synthetic glossary smoke test once. Do not use a customer message for this check.
10. Translate one controlled inbound text message as an allowlisted ADMIN and confirm one response, one expected TranslationEvent, and no duplicate provider call.
11. Submit one controlled feedback response and confirm it appears in the durable quality report.
12. Observe metrics and logs through the agreed pilot window before expanding usage.

Stop and roll back if startup fails, readiness is false, the glossary smoke test fails, one action creates duplicate events/provider requests, or unrelated data changes.

## 6. Health verification commands

Set a task-specific backend origin without a trailing slash:

```bash
TRANSLATION_BACKEND_ORIGIN=https://line-unified-inbox-production-544f.up.railway.app
```

Check the public health endpoints:

```bash
curl -sS -i "$TRANSLATION_BACKEND_ORIGIN/health"
curl -sS -i "$TRANSLATION_BACKEND_ORIGIN/health/readiness"
```

Expected results:

- `/health`: HTTP 200 with `{"status":"ok",...}`.
- `/health/readiness`: HTTP 200 with `{"status":"ready"}`.

These endpoints confirm application/database health. They do not prove that translation is enabled or that Google credentials work.

## 7. Readiness verification commands

### Configuration-only CLI

Run inside the production backend environment:

```bash
npm run translation:pilot:check -- --verify-production
```

Expected safe shape:

```json
{
  "ready": true,
  "checks": {
    "configuration": true,
    "provider": true,
    "runtime": true,
    "metrics": true
  }
}
```

This check validates configuration shape only. It does not call Google, access messages, or connect to the database.

### Authenticated ADMIN endpoints

Using an existing authenticated ADMIN session cookie jar obtained through the normal login flow:

```bash
curl -sS -b "$TRANSLATION_ADMIN_COOKIE_JAR" "$TRANSLATION_BACKEND_ORIGIN/translation/readiness"
curl -sS -b "$TRANSLATION_ADMIN_COOKIE_JAR" "$TRANSLATION_BACKEND_ORIGIN/translation/pilot-status"
```

Required results:

- `/translation/readiness`: `ready: true`, with every boolean check true.
- `/translation/pilot-status`: `ready: true`, `active: true`, and the reviewed `allowlistedAdminCount`.
- Unauthenticated requests return HTTP 401.
- VIEWER requests return HTTP 403.

Do not print or share the cookie jar.

## 8. Glossary smoke test procedure

Run once from a reviewed environment containing the Google project and credential variables:

```bash
npm run translation:glossary:smoke-test
```

The command sends one frozen synthetic sentence containing all seven protected terms to Google for English translation. It does not start Nest, import Prisma, read messages, or write application data.

Expected output:

```json
{
  "providerCalls": 1,
  "termsTested": 7,
  "termsPreserved": true,
  "success": true
}
```

Safety rules:

- Run the command once per verification event; do not loop it.
- Do not replace the synthetic input with customer content.
- Do not add credential or provider-response logging.
- Stop if `providerCalls` differs from 1 or `termsPreserved` is false.
- A failing result uses the same sanitized shape and exits non-zero.

## 9. Monitoring metrics

### Process-local operational metrics

Authenticated ADMIN endpoints:

```bash
curl -sS -b "$TRANSLATION_ADMIN_COOKIE_JAR" "$TRANSLATION_BACKEND_ORIGIN/translation/metrics"
curl -sS -b "$TRANSLATION_ADMIN_COOKIE_JAR" "$TRANSLATION_BACKEND_ORIGIN/translation/report"
```

Monitor:

- total requests
- successful and failed translations
- provider failures
- rate-limited and budget-exceeded requests
- cache hits
- average duration and character count
- daily character usage and configured limit
- aggregate positive, terminology, meaning, and other feedback signals

The process report is:

- `HEALTHY` when success rate is at least 95% and budget use is below 80%.
- `WARNING` when success rate is 80%–under 95% or budget use reaches 80%.
- `CRITICAL` when success rate is below 80% or the daily budget is exhausted.

Because these counters reset on restart, record the deployment/restart time when interpreting them.

### Durable quality analytics

Run inside the backend environment with database access:

```bash
npm run translation:quality:report
```

The report reads `TranslationEvent` and translation-feedback aggregates and returns total attempts, successes, failures, success rate, average duration, feedback count, helpful rate, and issue breakdown. It is read-only and makes no Google request.

Events begin at the TranslationEvent migration; earlier translated fields were not backfilled into synthetic events.

## 10. Common failure troubleshooting

### Invalid or malformed credentials

Symptoms:

- Pilot check reports `provider: false` or `configuration: false`.
- Readiness reports `providerConfigured: false`.
- Glossary smoke test returns `providerCalls: 0` or a failing result.

Actions:

1. Confirm `GOOGLE_TRANSLATION_CREDENTIALS_JSON` is present as the complete service-account JSON object, not a file path or shell-escaped fragment.
2. Confirm it contains non-empty `client_email` and `private_key` fields.
3. Re-enter the secret through the approved secrets manager; never print it for diagnosis.
4. Restart the backend and rerun the configuration check before the smoke test.

### Invalid project ID or location

Symptoms:

- Authentication succeeds but the provider request fails with an invalid project/location category.
- Glossary smoke reports one call and failure.

Actions:

1. Confirm `GOOGLE_TRANSLATION_PROJECT_ID` is the project that owns or authorizes the service account.
2. Confirm Cloud Translation API v3 is enabled in that project.
3. The adapter uses `projects/<project-id>/locations/global`; do not configure a display name, project number from another project, or a regional location.
4. Correct configuration and rerun exactly one synthetic smoke test.

### Provider unavailable or request failure

Symptoms:

- Translation endpoint returns controlled HTTP 503 when no provider is configured.
- Provider request failure returns controlled HTTP 502.
- Durable events show `FAILED` with a sanitized `errorCategory`.
- Provider-failure metrics increase.

Actions:

1. Stop user testing if failures are repeated.
2. Check health, readiness, pilot status, Google API status, project/API enablement, IAM, and quota without exposing credentials.
3. Confirm rate and daily budget failures are not being mistaken for provider failures.
4. Disable `TRANSLATION_PILOT_MODE` if reliability is uncertain.

### Glossary term mismatch

Symptoms:

- Smoke output reports `providerCalls: 1`, `termsPreserved: false`, `success: false`.
- A translated result changes an approved OPPO term.

Actions:

1. Stop the pilot; do not retry in a loop.
2. Preserve the sanitized smoke result and deployed revision. Do not log the provider response or customer content.
3. Reproduce with the frozen synthetic test and glossary unit tests only.
4. Review sentinel preservation and restoration logic outside the Google adapter.
5. Require a passing seven-of-seven real smoke before re-enabling the pilot.

### Translation feedback issues

Symptoms:

- Feedback returns 404/422, does not appear in the quality report, or issue counts look incorrect.

Actions:

1. Confirm the user is an authenticated ADMIN and the message has a stored translation for the submitted target language.
2. Confirm the request uses `HELPFUL` with no issue category, or `INCORRECT` with exactly one of `meaning_issue`, `terminology_issue`, or `other`.
3. Confirm the feedback migration is applied.
4. Remember identical feedback for the same admin/message/language/translation fingerprint is idempotent.
5. Use `npm run translation:quality:report` for durable feedback counts; do not use process-local metrics as historical evidence.

### Rate limit or daily budget exceeded

Symptoms:

- Translation returns HTTP 429.
- `rateLimitedRequests` or `budgetExceededRequests` increases.

Actions:

1. Do not immediately raise limits. Confirm the request pattern and rule out accidental repeated clicks.
2. Check daily usage and the Asia/Bangkok calendar boundary.
3. Cached translations do not consume the provider budget; confirm whether requests are unexpectedly missing cache.
4. Adjust limits only through a reviewed configuration change.

### Readiness is true but translation is denied

Symptoms:

- An ADMIN receives HTTP 403.

Actions:

1. Confirm the authenticated `User.id` is in `TRANSLATION_PILOT_ALLOWED_ADMIN_IDS`.
2. Confirm the user is active and has role ADMIN.
3. Do not expose the allowlist through logs or endpoints.

### Emergency rollback verification

After disabling the pilot, verify:

```bash
npm run translation:pilot:check -- --verify-production
```

The result should be not ready. Authenticated `/translation/pilot-status` should report `active: false`, while `/health` and `/health/readiness` remain HTTP 200. Existing Store Chats, feedback history, TranslationEvents, and original messages must remain available and unchanged.
