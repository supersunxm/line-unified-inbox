import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { TranslationConfig } from "./translation.config";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationPilotSmokeTest, TRANSLATION_PILOT_SMOKE_TEXT } from "./translation-pilot-smoke-test";
import { TranslationProvider } from "./translation.provider";
import { TranslationReadinessService } from "./translation-readiness.service";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationFeedbackService } from "./translation-feedback";

function config(overrides: Partial<TranslationConfig> = {}): TranslationConfig {
  return {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: ["synthetic-admin"],
    rateLimitPerMinute: 20,
    dailyCharacterLimit: 50_000,
    provider: "google",
    google: { projectId: "synthetic-project", credentials: { client_email: "synthetic@example.test", private_key: "synthetic-key" } },
    ...overrides,
  };
}

function runner(provider: TranslationProvider, translationConfig = config()) {
  const metrics = new TranslationMetrics();
  const budget = new TranslationUsageBudget(translationConfig);
  return { smoke: new TranslationPilotSmokeTest(new TranslationReadinessService(translationConfig, new TranslationFeedbackService()), provider, metrics, budget), metrics, budget };
}

test("readiness failure stops execution before provider invocation", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; throw new Error("must not run"); } };
  const { smoke } = runner(provider, config({ enabled: false }));
  const result = await smoke.run();
  assert.equal(result.success, false);
  assert.equal(result.providerStatus, "NOT_INVOKED");
  assert.equal(providerCalls, 0);
});

test("provider failure is sanitized and recorded without candidate output", async () => {
  const provider: TranslationProvider = { async translate() { throw new Error("raw provider payload"); } };
  const { smoke, metrics } = runner(provider);
  const result = await smoke.run();
  assert.equal(result.success, false);
  assert.equal(result.providerStatus, "FAILED");
  assert.equal(metrics.snapshot().providerFailures, 1);
  assert.equal(JSON.stringify(result).includes("raw provider payload"), false);
});

test("budget rejection prevents provider invocation", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; return { translatedText: "unused", characterCount: 1, provider: "google" }; } };
  const { smoke, budget } = runner(provider, config({ dailyCharacterLimit: 1 }));
  const result = await smoke.run();
  assert.equal(result.success, false);
  assert.equal(result.providerStatus, "NOT_INVOKED");
  assert.equal(providerCalls, 0);
  assert.equal(budget.snapshot().budgetExceededRequests, 1);
});

test("synthetic translations invoke each target once and repeated execution uses cache", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = {
    async translate(text, targetLanguage) {
      providerCalls += 1;
      return { translatedText: targetLanguage === "en" ? "Synthetic English" : "合成中文", characterCount: Array.from(text).length, provider: "google" };
    },
  };
  const { smoke, metrics, budget } = runner(provider);
  const result = await smoke.run();
  assert.equal(result.success, true);
  assert.equal(providerCalls, 2);
  assert.equal(metrics.snapshot().successfulTranslations, 2);
  assert.equal(metrics.snapshot().cacheHitCount, 2);
  assert.equal(budget.snapshot().dailyCharacterUsage, Array.from(TRANSLATION_PILOT_SMOKE_TEXT).length * 2);
});

test("smoke-test sources import no Prisma, webhook, LINE, or application message dependencies", async () => {
  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/translation-pilot-smoke-test.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-pilot-smoke-test.ts"), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /prisma|webhook|line-official|conversation|message\.find/i);
  }
});
