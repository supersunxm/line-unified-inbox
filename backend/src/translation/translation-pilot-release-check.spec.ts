import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { isGlossarySmokeValidationAvailable, runTranslationPilotReleaseCheck, TranslationPilotReleaseCheckDependencies } from "./translation-pilot-release-check";

const readyEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  MESSAGE_TRANSLATION_ENABLED: "true",
  TRANSLATION_PROVIDER: "google",
  TRANSLATION_PILOT_MODE: "true",
  TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: "admin-1,admin-2",
  TRANSLATION_RATE_LIMIT_PER_MINUTE: "20",
  TRANSLATION_DAILY_CHARACTER_LIMIT: "50000",
  GOOGLE_TRANSLATION_PROJECT_ID: "synthetic-project",
  GOOGLE_TRANSLATION_CREDENTIALS_JSON: JSON.stringify({ client_email: "synthetic@example.test", private_key: "synthetic-key" }),
};

function dependencies(overrides: Partial<TranslationPilotReleaseCheckDependencies> = {}): TranslationPilotReleaseCheckDependencies {
  return {
    healthReady: async () => true,
    currentMigrationNames: async () => ["migration-1", "migration-2"],
    appliedMigrationNames: async () => ["migration-1", "migration-2"],
    glossaryAvailable: () => true,
    ...overrides,
  };
}

test("release check reports a fully ready branch", async () => {
  assert.deepEqual(await runTranslationPilotReleaseCheck(readyEnvironment, [], dependencies()), {
    releaseReady: true,
    checks: { configuration: true, runtime: true, database: true, glossary: true },
  });
});

test("release check fails when configuration or runtime readiness is incomplete", async () => {
  const result = await runTranslationPilotReleaseCheck({ NODE_ENV: "test" }, [], dependencies({ healthReady: async () => false }));
  assert.deepEqual(result, {
    releaseReady: false,
    checks: { configuration: false, runtime: false, database: false, glossary: true },
  });
});

test("release check detects a pending current-branch migration", async () => {
  const result = await runTranslationPilotReleaseCheck(
    readyEnvironment,
    [],
    dependencies({ appliedMigrationNames: async () => ["migration-1"] }),
  );
  assert.equal(result.releaseReady, false);
  assert.equal(result.checks.database, false);
});

test("release check fails when glossary smoke validation is unavailable", async () => {
  const result = await runTranslationPilotReleaseCheck(
    readyEnvironment,
    [],
    dependencies({ glossaryAvailable: () => false }),
  );
  assert.equal(result.releaseReady, false);
  assert.equal(result.checks.glossary, false);
  assert.equal(isGlossarySmokeValidationAvailable(), true);
});

test("release check sources are read-only and never import or call a provider", async () => {
  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/translation-pilot-release-check.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-pilot-release-check.ts"), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /google-translation\.provider|\.translate\(|message\.(find|create|update)|\.(create|update|upsert|delete|deleteMany|updateMany)\(/i);
    for (const secret of ["private_key", "client_email", "admin-1", "synthetic-project"]) assert.equal(source.includes(secret), false);
  }
});
