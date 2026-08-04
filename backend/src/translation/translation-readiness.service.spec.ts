import assert from "node:assert/strict";
import test from "node:test";
import { MessageTranslationConfig, TranslationConfig } from "./translation.config";
import { TranslationReadinessService } from "./translation-readiness.service";
import { TranslationFeedbackService } from "./translation-feedback";

function readinessFor(overrides: Partial<MessageTranslationConfig> = {}) {
  const config = {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: ["admin-1"],
    rateLimitPerMinute: 20,
    dailyCharacterLimit: 50_000,
    provider: "google",
    google: { projectId: "project-id", credentials: { client_email: "service@example.test", private_key: "private-secret" } },
    ...overrides,
  } as TranslationConfig;
  return new TranslationReadinessService(config, new TranslationFeedbackService()).check();
}

test("complete validated pilot configuration is ready", () => {
  assert.deepEqual(readinessFor(), {
    ready: true,
    checks: {
      featureEnabled: true,
      providerConfigured: true,
      pilotModeEnabled: true,
      allowlistConfigured: true,
      rateLimitConfigured: true,
      budgetConfigured: true,
      feedbackMetricsAvailable: true,
    },
  });
});

test("missing Google credentials makes readiness false without exposing configuration", () => {
  const response = readinessFor({ google: null });
  assert.equal(response.ready, false);
  assert.equal(response.checks.providerConfigured, false);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("project-id"), false);
  assert.equal(serialized.includes("service@example.test"), false);
  assert.equal(serialized.includes("private-secret"), false);
});

test("pilot mode without an allowlist is not ready", () => {
  const response = readinessFor({ allowedAdminIds: [] });
  assert.equal(response.ready, false);
  assert.equal(response.checks.allowlistConfigured, false);
});
