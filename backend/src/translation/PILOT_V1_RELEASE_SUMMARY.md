# Translation Pilot v1 Release Summary

## 1. Feature overview

Translation Pilot v1 adds controlled, manual message translation to Store Chats for internal OPPO LINE OA operations.

An authenticated, allowlisted ADMIN can translate an eligible inbound text message into English or Simplified Chinese. Translation is initiated only by an explicit user action. It does not run during LINE webhook ingestion, polling, classification, conversation loading, or any background process.

The pilot includes:

- Google Cloud Translation v3 through a backend-only provider abstraction.
- Durable English and Chinese translation caching on the existing `Message` record.
- OPPO terminology protection for `OPPO`, `Reno16`, `ColorOS`, `SUPERVOOC`, `AI Eraser`, `AI Studio`, and `Find Series`.
- ADMIN feedback controls for Helpful and Incorrect ratings.
- Durable translation-attempt and feedback analytics.
- Rate limiting, a daily character budget, an ADMIN allowlist, readiness checks, operational metrics, and fail-closed feature switches.
- Synthetic provider, glossary, quality, preflight, and release-readiness commands.

The original customer message is never overwritten.

## 2. Architecture changes

The runtime request flow is:

```text
Store Chats ADMIN action
  -> authenticated POST /messages/:messageId/translations
  -> ADMIN role and pilot allowlist
  -> inbound TEXT message validation
  -> durable translation cache lookup
  -> per-admin rate limit and daily character budget
  -> TranslationProvider abstraction
  -> OPPO glossary decorator
       -> protect approved terms
       -> one Google Translation v3 call
       -> restore canonical terms
  -> persist translatedEnglish or translatedChinese
  -> persist metadata-only TranslationEvent
  -> return translation to Store Chats
```

The Google adapter remains isolated from application and glossary policy. The glossary is a provider decorator, so one application translation request produces at most one provider call.

Observability is divided into two scopes:

- Process-local metrics and reports support immediate pilot monitoring and reset on backend restart.
- `TranslationEvent` and `MessageTranslationFeedback` provide durable quality analytics across restarts.

Translation feedback is a separate API flow and never triggers translation or another provider call.

## 3. Backend changes

### Translation API

- `POST /messages/:messageId/translations`
  - ADMIN-only.
  - Active-pilot allowlist required.
  - Accepts `targetLanguage: "en" | "zh"`.
  - Supports inbound, non-empty TEXT messages only.
  - Returns cached translations without calling Google.
  - Returns controlled unavailable, forbidden, validation, rate-limit, budget, and provider-failure responses.

- `POST /messages/:messageId/translations/feedback`
  - ADMIN-only.
  - Accepts `HELPFUL`, or `INCORRECT` with `meaning_issue`, `terminology_issue`, or `other`.
  - Requires a stored translation for the selected target language.
  - Is idempotent for the same administrator, message, language, and translation fingerprint.

### Pilot monitoring API

The following endpoints are authenticated and ADMIN-only:

- `GET /translation/readiness`
- `GET /translation/pilot-status`
- `GET /translation/metrics`
- `GET /translation/report`

They expose safe booleans and numeric aggregates only. They do not expose credentials, allowlisted IDs, message content, translated text, LINE identifiers, or customer data.

### Safety controls

- Translation feature switch, disabled by default.
- Separate pilot-mode switch, disabled by default.
- Google/none provider selection, defaulting to none.
- Comma-separated ADMIN user-ID allowlist.
- Per-admin process-local request rate limiting.
- Process-local daily character budget using the Asia/Bangkok calendar boundary.
- Metadata-only structured audit logging.
- Best-effort durable TranslationEvent recording that cannot change the translation response or trigger a retry.
- Backend-only credential loading through environment variables.

### Quality and provider validation

- Frozen synthetic Thai/English/Chinese benchmark corpus.
- OPPO retail terminology checks and weighted scoring.
- Human-review workflow and provider decision report.
- Google provider approved for pilot by the benchmark decision layer.
- Runtime OPPO glossary decorator and a one-call real-provider glossary smoke test.

## 4. Frontend changes

Store Chats now provides manual translation controls for eligible messages:

- Translate is visible only to ADMIN users on inbound text messages.
- Translation is never started automatically.
- The action exposes a `Translating...` loading state.
- A successful English result is displayed as an AI translation without replacing the original message.
- Provider or API failures display a friendly `Translation unavailable` state.
- After a successful translation, ADMIN users can submit Helpful or Incorrect feedback.
- Incorrect feedback supports meaning, terminology, and other issue categories.

Existing conversation polling, pagination, filters, selected-conversation behavior, Show Original behavior, authentication, and Friend Attribution routing remain independent of translation.

## 5. Database changes

### Existing Message cache fields

Pilot v1 uses the existing fields:

- `originalText`
- `originalLanguage`
- `translatedEnglish`
- `translatedChinese`

No automatic backfill was added. `originalText` remains immutable in the translation flow.

### MessageTranslationFeedback

Migration:

```text
20260804173000_add_message_translation_feedback
```

Durable feedback stores:

- message reference
- administrator reference
- target language
- rating
- optional issue category
- SHA-256 translation fingerprint
- creation timestamp

It does not duplicate message or translation content.

### TranslationEvent

Migration:

```text
20260804190000_add_translation_events
```

Each attempted translation records metadata including:

- message ID
- administrator ID
- target language
- provider
- `SUCCESS` or `FAILED` status
- duration
- character count
- optional sanitized error category
- creation timestamp

Events begin prospectively after the migration. Earlier translated messages were not converted into synthetic historical events.

## 6. Operational commands

Run commands from the backend directory.

### Configuration and readiness

```bash
npm run translation:pilot:preflight -- --verify-production
npm run translation:pilot:check -- --verify-production
npm run translation:pilot:release-check -- --verify-production
```

- Preflight validates production configuration shape.
- Pilot check composes configuration, provider, runtime, and metrics readiness.
- Release check additionally validates health/readiness, applied migrations, and glossary smoke-contract availability.
- None of these commands calls Google or translates a message.

### Synthetic provider validation

```bash
npm run translation:pilot:smoke-test
npm run translation:glossary:smoke-test
```

- The pilot smoke test is non-production synthetic provider verification.
- The glossary smoke test makes exactly one real Google call using a frozen synthetic sentence and stores no application data.

Expected glossary result:

```json
{
  "providerCalls": 1,
  "termsTested": 7,
  "termsPreserved": true,
  "success": true
}
```

### Durable quality analytics

```bash
npm run translation:quality:report
```

This read-only command reports durable attempts, successes, failures, success rate, average duration, feedback coverage, helpful rate, and issue breakdown. It does not call Google.

## 7. Deployment checklist

1. Confirm the complete intended diff contains no credentials, `.env` files, generated benchmark candidates, customer data, logs, or temporary verification scripts.
2. Run backend ESLint, the full backend test suite, the production TypeScript build, and `git diff --check`.
3. Deploy the reviewed backend revision with translation switches still disabled.
4. Apply and verify the feedback and TranslationEvent Prisma migrations.
5. Confirm backend startup and public `/health` and `/health/readiness` HTTP 200 responses.
6. Resolve and independently review the exact active ADMIN `User.id` values for the pilot allowlist.
7. Configure the reviewed Google project, service-account secret, rate limit, daily budget, and allowlist through the approved production configuration system.
8. Enable the feature and pilot switches in one reviewed backend configuration change.
9. Run:

   ```bash
   npm run translation:pilot:release-check -- --verify-production
   ```

10. Verify authenticated `/translation/readiness` reports ready and `/translation/pilot-status` reports ready and active with the expected allowlist count.
11. Run the glossary smoke test exactly once and require seven-of-seven term preservation.
12. Translate one controlled inbound text message from an allowlisted ADMIN account.
13. Confirm one expected result, no duplicate provider call, one appropriate TranslationEvent, and correct cached behavior on a repeated translation request.
14. Submit one controlled feedback response and confirm it appears in the durable quality report.
15. Observe process metrics, durable events, feedback, provider failures, latency, rate limits, and budget usage through the agreed pilot window.

Stop if readiness is false, the glossary smoke fails, migrations are pending, one user action produces duplicate provider work, or unrelated data changes.

The detailed operator procedure is in `PILOT_RUNBOOK.md`.

## 8. Rollback procedure

For immediate suspension:

```text
TRANSLATION_PILOT_MODE=false
```

For complete shutdown:

```text
MESSAGE_TRANSLATION_ENABLED=false
TRANSLATION_PILOT_MODE=false
TRANSLATION_PROVIDER=none
```

Then:

1. Allow the backend to restart normally.
2. Confirm `/health` and `/health/readiness` remain HTTP 200.
3. Confirm `/translation/pilot-status` reports `active: false`.
4. Confirm an authenticated translation request returns the controlled unavailable response without a provider call.
5. Preserve existing translated fields, feedback, and TranslationEvents for audit and analysis.
6. Do not roll back database migrations merely to disable the feature.
7. Record the rollback time, deployed revision, triggering symptom, and safe aggregate metrics.

Rollback does not require frontend, database-data, DNS, domain, webhook, or Friend Attribution changes.

## 9. Known limitations

- Pilot access is ADMIN-only and controlled by an environment-based allowlist; there is no dedicated translation permission model or allowlist UI.
- The current Store Chats MVP exposes the manual English translation action. The backend supports Simplified Chinese, but complete frontend target-language selection and conversation-level translation are future work.
- Translation is message-level only. Translate-all-conversation behavior is not implemented.
- Process-local metrics, rate limits, daily budget, and feedback signal counters reset on backend restart and are not coordinated across multiple backend instances.
- Durable TranslationEvents begin at the migration date and do not represent earlier translations.
- TranslationEvent recording is fail-open to preserve translation behavior if observability persistence fails; a fixed safe error is logged instead.
- The daily character budget is process-local rather than a billing guarantee or cross-instance quota.
- Google availability, IAM, quota, latency, and pricing remain external dependencies.
- The glossary protects seven approved runtime terms. Additional products, spelling variants, or retail terminology require review and regression tests before runtime inclusion.
- The glossary smoke test proves the current frozen synthetic sentence and provider behavior; it does not guarantee every possible customer sentence.
- Translation quality still requires human feedback and periodic review. Automated benchmark approval does not replace operational review.
- No automatic translation occurs during ingestion or polling.
- No manual correction workflow or translation-version history is included in v1.
- The frontend does not yet provide a translation analytics dashboard; operators use ADMIN endpoints and CLI reports.
