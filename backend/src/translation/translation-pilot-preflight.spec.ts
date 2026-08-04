import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runTranslationPilotPreflight, TranslationPilotPreflightError } from "./translation-pilot-preflight";

const completeEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  MESSAGE_TRANSLATION_ENABLED: "true",
  TRANSLATION_PROVIDER: "google",
  TRANSLATION_PILOT_MODE: "true",
  TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: "admin,admin2",
  TRANSLATION_RATE_LIMIT_PER_MINUTE: "20",
  TRANSLATION_DAILY_CHARACTER_LIMIT: "50000",
  GOOGLE_TRANSLATION_PROJECT_ID: "synthetic-project",
  GOOGLE_TRANSLATION_CREDENTIALS_JSON: JSON.stringify({ client_email: "synthetic@example.test", private_key: "synthetic-private-key" }),
};

test("preflight reports complete two-admin configuration without exposing values", () => {
  const result = runTranslationPilotPreflight(completeEnvironment);
  assert.deepEqual(result, {
    ready: true,
    allowlistedAdminCount: 2,
    checks: {
      featureEnabled: true,
      googleProvider: true,
      pilotMode: true,
      allowlistConfigured: true,
      rateLimitConfigured: true,
      budgetConfigured: true,
      credentialsConfigured: true,
    },
  });
  const serialized = JSON.stringify(result);
  for (const secret of ["admin", "admin2", "synthetic-project", "synthetic@example.test", "synthetic-private-key"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("incomplete configuration reports false checks without provider or database work", () => {
  const result = runTranslationPilotPreflight({ NODE_ENV: "test" });
  assert.equal(result.ready, false);
  assert.equal(result.allowlistedAdminCount, 0);
  assert.equal(result.checks.featureEnabled, false);
  assert.equal(result.checks.googleProvider, false);
  assert.equal(result.checks.pilotMode, false);
  assert.equal(result.checks.allowlistConfigured, false);
  assert.equal(result.checks.credentialsConfigured, false);
  assert.equal(result.checks.rateLimitConfigured, true);
  assert.equal(result.checks.budgetConfigured, true);
});

test("production execution requires the explicit verification argument", () => {
  assert.throws(
    () => runTranslationPilotPreflight({ ...completeEnvironment, NODE_ENV: "production" }),
    (error: unknown) => error instanceof TranslationPilotPreflightError && error.category === "PRODUCTION_VERIFICATION_MARKER_REQUIRED",
  );
  assert.equal(runTranslationPilotPreflight({ ...completeEnvironment, NODE_ENV: "production" }, ["--verify-production"]).ready, true);
});

test("malformed credentials fail with a sanitized configuration category", () => {
  assert.throws(
    () => runTranslationPilotPreflight({ ...completeEnvironment, GOOGLE_TRANSLATION_CREDENTIALS_JSON: "private malformed payload" }),
    (error: unknown) => error instanceof TranslationPilotPreflightError && error.category === "INVALID_CONFIGURATION" && !error.message.includes("private malformed payload"),
  );
});

test("preflight sources import no provider, Prisma, application module, or customer data path", async () => {
  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/translation-pilot-preflight.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-pilot-preflight.ts"), "utf8"),
  ]);
  for (const source of sources) assert.doesNotMatch(source, /google-translation\.provider|prisma|app\.module|conversation|webhook|message\.find/i);
});
