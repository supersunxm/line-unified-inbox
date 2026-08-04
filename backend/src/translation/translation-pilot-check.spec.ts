import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { TranslationPilotPreflightError } from "./translation-pilot-preflight";
import { runTranslationPilotCheck } from "./translation-pilot-check";

const completeEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  MESSAGE_TRANSLATION_ENABLED: "true",
  TRANSLATION_PROVIDER: "google",
  TRANSLATION_PILOT_MODE: "true",
  TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: "admin-1,admin-2",
  TRANSLATION_RATE_LIMIT_PER_MINUTE: "20",
  TRANSLATION_DAILY_CHARACTER_LIMIT: "50000",
  GOOGLE_TRANSLATION_PROJECT_ID: "synthetic-project",
  GOOGLE_TRANSLATION_CREDENTIALS_JSON: JSON.stringify({
    client_email: "synthetic@example.test",
    private_key: "synthetic-private-key",
  }),
};

test("consolidated pilot check reports complete readiness", () => {
  assert.deepEqual(runTranslationPilotCheck(completeEnvironment), {
    ready: true,
    checks: {
      configuration: true,
      provider: true,
      runtime: true,
      metrics: true,
    },
  });
});

test("consolidated pilot check fails closed for incomplete configuration", () => {
  assert.deepEqual(runTranslationPilotCheck({ NODE_ENV: "test" }), {
    ready: false,
    checks: {
      configuration: false,
      provider: false,
      runtime: false,
      metrics: true,
    },
  });
});

test("consolidated pilot check preserves production verification marker", () => {
  assert.throws(
    () => runTranslationPilotCheck({ ...completeEnvironment, NODE_ENV: "production" }),
    (error: unknown) => error instanceof TranslationPilotPreflightError
      && error.category === "PRODUCTION_VERIFICATION_MARKER_REQUIRED",
  );
  assert.equal(
    runTranslationPilotCheck(
      { ...completeEnvironment, NODE_ENV: "production" },
      ["--verify-production"],
    ).ready,
    true,
  );
});

test("consolidated pilot check output and imports expose no secrets or production dependencies", async () => {
  const result = JSON.stringify(runTranslationPilotCheck(completeEnvironment));
  for (const secret of [
    "admin-1",
    "admin-2",
    "synthetic-project",
    "synthetic@example.test",
    "synthetic-private-key",
  ]) {
    assert.equal(result.includes(secret), false);
  }

  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/translation-pilot-check.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-pilot-check.ts"), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /google-translation\.provider|prisma|app\.module|conversation|webhook|message\.find/i);
  }
});
