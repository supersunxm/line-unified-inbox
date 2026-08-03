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

The OPPO retail glossary protects product and technology names verbatim and validates retail concepts against approved English and Simplified-Chinese equivalents. The report identifies every missing term by case and target language and flags possible down-payment or stock-intent loss.

Diagnostic category scores use these weights:

- Product inquiry: 25%
- Promotion/payment: 25%
- Service/warranty: 20%
- Stock/pickup: 15%
- Casual/mixed: 15%

The weighted overall score and reference similarity assist reviewers; they never grant approval. Readiness requires all structural checks, all protected-term checks, and human review of every candidate. Intent warnings remain visible for human assessment.

Candidate files may contain translated message content and must remain outside source control unless they contain synthetic data only.
