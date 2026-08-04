import assert from "node:assert/strict";
import test from "node:test";
import { MessageTranslationConfig, readMessageTranslationConfig, TranslationConfig } from "./translation.config";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationPilotStatusService } from "./translation-pilot-status.service";
import { TranslationReadinessService } from "./translation-readiness.service";

function statusFor(overrides: Partial<MessageTranslationConfig> = {}) {
  const config = {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: ["admin-1"],
    rateLimitPerMinute: 20,
    dailyCharacterLimit: 50_000,
    provider: "google",
    google: { projectId: "project", credentials: { client_email: "service@example.test", private_key: "secret" } },
    ...overrides,
  } as TranslationConfig;
  const feedback = new TranslationFeedbackService();
  return new TranslationPilotStatusService(config, new TranslationReadinessService(config, feedback)).getStatus();
}

test("disabled pilot is inactive and not ready", () => {
  const status = statusFor({ enabled: false, pilotMode: false, google: null });
  assert.equal(status.active, false);
  assert.equal(status.ready, false);
});

test("pilot without an allowlist is inactive and not ready", () => {
  const status = statusFor({ allowedAdminIds: [] });
  assert.equal(status.active, false);
  assert.equal(status.ready, false);
  assert.equal(status.allowlistedAdminCount, 0);
});

test("production-shaped environment configuration prepares exactly two allowlisted admins", () => {
  const config = readMessageTranslationConfig({
    MESSAGE_TRANSLATION_ENABLED: "true",
    TRANSLATION_PROVIDER: "google",
    TRANSLATION_PILOT_MODE: "true",
    TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: "admin,admin2",
    TRANSLATION_RATE_LIMIT_PER_MINUTE: "20",
    TRANSLATION_DAILY_CHARACTER_LIMIT: "50000",
    GOOGLE_TRANSLATION_PROJECT_ID: "synthetic-project",
    GOOGLE_TRANSLATION_CREDENTIALS_JSON: JSON.stringify({ client_email: "synthetic@example.test", private_key: "synthetic-key" }),
  }) as TranslationConfig;
  const feedback = new TranslationFeedbackService();
  const readiness = new TranslationReadinessService(config, feedback);

  assert.equal(readiness.check().ready, true);
  assert.deepEqual(new TranslationPilotStatusService(config, readiness).getStatus(), {
    ready: true,
    active: true,
    allowlistedAdminCount: 2,
    rateLimitConfigured: true,
    dailyBudgetConfigured: true,
    feedbackEnabled: true,
  });
});

test("invalid daily budget is reported safely", () => {
  const status = statusFor({ dailyCharacterLimit: 0 });
  assert.equal(status.dailyBudgetConfigured, false);
  assert.equal(status.ready, false);
});

test("fully configured pilot is active and ready", () => {
  assert.deepEqual(statusFor(), {
    ready: true,
    active: true,
    allowlistedAdminCount: 1,
    rateLimitConfigured: true,
    dailyBudgetConfigured: true,
    feedbackEnabled: true,
  });
});
