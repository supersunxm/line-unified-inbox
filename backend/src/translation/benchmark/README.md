# Offline translation benchmark

This framework compares pre-generated Thai-to-English and Thai-to-Simplified-Chinese candidate translations. It never invokes a provider, reads production messages, or connects to the database.

Create a JSON submission matching `TranslationBenchmarkSubmission`, then run:

```sh
npm run translation:benchmark -- ./path/to/candidate-output.json
```

Optional execution-cost metadata belongs in the submission and is never treated as real billing data:

```json
{
  "provider": "provider-name",
  "providerVersion": "provider-version",
  "pricing": {
    "currency": "USD",
    "costPerMillionCharacters": 20
  }
}
```

The report estimates Unicode source characters for both target languages and calculates cost using that configurable rate. With no pricing metadata, character count is still reported and estimated cost is `null`.

Write a create-only, metadata-only regression snapshot with:

```sh
npm run translation:benchmark -- ./candidate-output.json --snapshot-output ./snapshot.json
```

Snapshots contain aggregate scores, cost metadata, provider/version, readiness, and issue counts. They exclude source messages, reference translations, candidate translations, and reviewer notes. Snapshot comparison helpers support later provider/version regression analysis.

Inspect the non-sensitive benchmark metadata with `npm run translation:benchmark -- --describe`.

After credentials are approved for a non-production environment, generate Google candidates separately from runtime translation with:

```sh
npm run translation:benchmark:generate-google
```

The generator is blocked when `NODE_ENV=production`, never uses Prisma or application messages, and writes candidate JSON to standard output only. It is not invoked by automated tests.

Each synthetic corpus case requires one `en` and one `zh` candidate. Human reviewers score adequacy, fluency, terminology, and safety from 1 to 5, may add reviewer notes, and use a non-sensitive reviewer alias.

Phase 2F accepts an optional top-level `reviews` array. Each entry contains `candidateKey` (`<caseId>:<language>`), `language`, `adequacyScore`, `fluencyScore`, `terminologyScore`, `safetyScore`, `reviewerAlias`, and optional `notes`. Review keys must be unique and match the candidate language; scores must be integer values from 1 to 5. Notes are excluded from scoring and metadata snapshots. Readiness requires valid reviews for every expected candidate, in addition to the structural and protected-term gates.

The OPPO retail glossary protects product and technology names verbatim and validates retail concepts against approved English and Simplified-Chinese equivalents. The report identifies every missing term by case and target language and flags possible down-payment or stock-intent loss.

The runtime MVP uses the same isolated glossary package through a provider decorator. It replaces only the configured protected source terms with collision-safe placeholders, invokes the configured provider exactly once, and restores canonical terminology before `TranslationService` persists the result. The Google adapter and stored original message are unchanged; broad retail normalization remains benchmark-only.

`npm run translation:glossary:smoke-test` performs one English Google Translation request with a frozen synthetic sentence containing all seven runtime-protected terms. It loads Google configuration from injected environment variables or local `.env`, imports no Prisma/application-message path, stores nothing, and returns only provider-call count, term count, preservation status, and overall success. Missing configuration and provider or preservation failures return the same sanitized aggregate shape with a failing exit code.

Diagnostic category scores use these weights:

- Product inquiry: 25%
- Promotion/payment: 25%
- Service/warranty: 20%
- Stock/pickup: 15%
- Casual/mixed: 15%

The weighted overall score and reference similarity assist reviewers; they never grant approval. Readiness requires all structural checks, all protected-term checks, and human review of every candidate. Intent warnings remain visible for human assessment.

Phase 2G converts a completed aggregate report into `APPROVED_FOR_PILOT`, `NEEDS_IMPROVEMENT`, or `REJECTED`. Approval requires structural and protected-term checks, zero intent mismatches, complete human review, and an overall human score of at least 4.0. Automatic integrity, terminology, or intent failures reject the candidate; incomplete or low-scoring human review requires improvement. This recommendation remains benchmark-only and does not enable runtime translation.

Runtime pilot safety is separate from benchmark approval. Translation remains unavailable unless both `MESSAGE_TRANSLATION_ENABLED=true` and `TRANSLATION_PILOT_MODE=true`; the endpoint remains ADMIN-only. Uncached provider requests have a configurable per-process, per-admin minute limit, and structured audit metadata is restricted to identifiers, target/provider, outcome, timing, character count, and sanitized error category.

Internal pilot monitoring uses an in-memory singleton that retains aggregate counters and averages only. It records active-pilot success, failure, provider failure, cache hit, and rate-limit outcomes without message identifiers, LINE identities, source text, or translated text. Metrics reset on process restart and are not yet exposed through an API.

Phase 3A.3 exposes the current process snapshot at `GET /translation/metrics` for authenticated ADMIN users only. Its response is a fixed set of aggregate numeric fields. `resetMetrics()` remains an internal testing method with no HTTP route; metrics still reset naturally on process restart and are not durable or cross-instance.

Phase 3A.4 requires an active-pilot ADMIN to appear in the comma-separated `TRANSLATION_PILOT_ALLOWED_ADMIN_IDS` list before message lookup or provider access. Missing or empty configuration allows nobody. Pilot-off behavior remains the existing controlled unavailable response, and blocked access logs only acting user ID, a fixed reason category, and timestamp.

Phase 3A.5 adds `TRANSLATION_DAILY_CHARACTER_LIMIT`, defaulting to 50,000. A process-local guard reserves source characters only for active, allowlisted, uncached provider attempts and rejects over-budget work before provider invocation. Usage resets at the Asia/Bangkok calendar-date boundary and on process restart. The ADMIN metrics response adds current daily usage, configured limit, and exceeded-request count; no payload content is retained.

Phase 3B.0 adds `GET /translation/readiness` for authenticated ADMIN users. It returns only booleans confirming the feature flag, Google provider configuration, pilot mode, non-empty allowlist, rate limit, and daily budget are ready. It never returns environment values, allowlist IDs, project metadata, or credentials and does not contact the provider.

Phase 3B.1.1 adds `npm run translation:pilot:smoke-test`. It is blocked in production, uses one frozen synthetic Thai OPPO retail sentence, and runs only after every readiness check passes. English and Simplified-Chinese targets each execute once through the configured provider and once through an in-memory cache; the runner verifies metrics and character-budget deltas. Output is limited to readiness, provider status, targets, aggregate latency, character count, and success. It imports no Prisma, webhook, conversation, or application-message code.

Phase 3B.1.2 adds ADMIN-only `GET /translation/report`, a process-period operational summary derived from the existing in-memory metrics and budget. Success rate counts provider successes plus cache hits as completed outcomes; an empty process starts at 100%. Healthy requires at least 95% success and under 80% budget use, warning covers 80%–under-95% success or at least 80% budget use, and critical covers under 80% success or exhausted budget. The report contains aggregate numbers only.

Phase 3B.1.3 adds an internal feedback signal service for `POSITIVE`, `TERMINOLOGY_ISSUE`, and `MEANING_ISSUE`. Signals are accepted only after a `TRANSLATED` or `CACHED` result and retain three process-local counters only. No submission endpoint is introduced in this backend-only phase. Metrics and report responses include the three aggregate counts without message, translation, user, LINE, or customer dimensions.

Phase 3B.2 adds ADMIN-only `GET /translation/pilot-status`. It distinguishes active feature/provider/pilot switches from complete safety readiness and returns only readiness, active state, allowlist count, validated rate/budget booleans, and feedback availability. Readiness now includes feedback-counter availability. No admin IDs, limits, environment values, provider details, or credentials are exposed, and the checklist never enables translation.

Phase 3C.0 tightens `active` to require a non-empty environment-supplied ADMIN allowlist in addition to the enabled feature, configured Google provider, and pilot switch. The controlled production activation and rollback sequence is documented in `../PILOT_ACTIVATION.md`; it remains a manual operator procedure and does not change the disabled production defaults.

Phase 3C.1 adds `npm run translation:pilot:preflight`, a configuration-only command with no Nest application, Prisma, or provider imports. Production execution requires the explicit `--verify-production` marker. Output is limited to readiness booleans and allowlist cardinality; malformed configuration produces a fixed error category without echoing values.

The consolidated `npm run translation:pilot:check` command composes that configuration preflight with the existing runtime-readiness service and process-local metrics validation. It performs no provider request, message translation, database access, or mutation. Production execution retains the explicit `--verify-production` requirement, and output is limited to four readiness booleans plus the overall result.

`npm run translation:pilot:release-check` adds branch deployment readiness around the consolidated pilot check. It runs the existing health/readiness database probe, compares migration directories in the current branch with completed non-rolled-back `_prisma_migrations` rows, and validates availability of the frozen seven-term glossary smoke contract. It is read-only, makes no provider request, and returns four safe booleans plus overall release readiness.

Candidate files may contain translated message content and must remain outside source control unless they contain synthetic data only.

`npm run translation:quality:report` is a read-only database report over durable `TranslationEvent` and translation-feedback records. It reports total attempts, successful attempts, failures, success percentage, average duration, feedback coverage, helpful percentage, and meaning/terminology/other issue counts. The command does not construct or call a provider and performs no database writes. Events start accumulating after the TranslationEvent migration and are not synthesized retroactively from translated message fields.
