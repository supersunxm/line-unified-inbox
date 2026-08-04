import assert from "node:assert/strict";
import test from "node:test";
import { BadGatewayException, BadRequestException, ForbiddenException, HttpException, ServiceUnavailableException, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard, AuthUser } from "../auth/auth.guard";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { readMessageTranslationConfig, readMessageTranslationEnabled, readTranslationDailyCharacterLimit, readTranslationPilotAllowedAdminIds, readTranslationPilotMode, readTranslationProvider, readTranslationRateLimitPerMinute, TranslationConfig } from "./translation.config";
import { TranslationController } from "./translation.controller";
import { TranslationProvider, TranslationProviderError } from "./translation.provider";
import { TranslationService } from "./translation.service";
import { TranslationAuditEntry, TranslationAuditLogger, TranslationPilotAccessAuditEntry } from "./translation-audit.logger";
import { InMemoryTranslationRateLimiter, TranslationRateLimiter } from "./translation-rate-limiter";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationEventInput, TranslationEventService } from "./translation-event.service";

const eligibleMessage = {
  id: "message-1",
  direction: "INBOUND",
  messageType: "TEXT",
  originalText: "ข้อความลูกค้า",
  originalLanguage: "th",
  translatedEnglish: null,
  translatedChinese: null,
};

function serviceFor(message: typeof eligibleMessage | null, enabled = true, provider: TranslationProvider | null = null, options: { pilotMode?: boolean; allowedAdminIds?: string[]; rateLimiter?: TranslationRateLimiter; dailyCharacterLimit?: number; usageBudget?: TranslationUsageBudget } = {}) {
  let findCount = 0;
  let updateCount = 0;
  let updateData: unknown;
  const prisma = {
    message: {
      findUnique: async () => {
        findCount += 1;
        return message;
      },
      update: async (args: { data: unknown }) => {
        updateCount += 1;
        updateData = args.data;
        return { id: message?.id };
      },
    },
  } as unknown as PrismaService;
  const config = { enabled, pilotMode: options.pilotMode ?? true, allowedAdminIds: options.allowedAdminIds ?? ["admin-1"], dailyCharacterLimit: options.dailyCharacterLimit ?? 50_000, provider: provider ? "google" : "none", rateLimitPerMinute: 20 } as TranslationConfig;
  const rateLimiter = options.rateLimiter ?? { consume: () => true };
  const auditEntries: TranslationAuditEntry[] = [];
  const blockedAuditEntries: TranslationPilotAccessAuditEntry[] = [];
  const auditLogger = {
    record: (entry: TranslationAuditEntry) => auditEntries.push(entry),
    recordPilotAccessBlocked: (actingUserId: string) => blockedAuditEntries.push({ actingUserId, reasonCategory: "ADMIN_NOT_ALLOWLISTED", timestamp: new Date().toISOString() }),
  } as TranslationAuditLogger;
  const metrics = new TranslationMetrics();
  const usageBudget = options.usageBudget ?? new TranslationUsageBudget(config);
  const feedback = new TranslationFeedbackService();
  const eventEntries: TranslationEventInput[] = [];
  const events = { record: async (entry: TranslationEventInput) => { eventEntries.push(entry); } } as TranslationEventService;
  return { service: new TranslationService(prisma, config, provider, rateLimiter, auditLogger, metrics, usageBudget, feedback, events), findCount: () => findCount, updateCount: () => updateCount, updateData: () => updateData, auditEntries, blockedAuditEntries, metrics, usageBudget, feedback, eventEntries };
}

test("MESSAGE_TRANSLATION_ENABLED defaults false and accepts only explicit booleans", () => {
  assert.equal(readMessageTranslationEnabled({}), false);
  assert.equal(readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: "false" }), false);
  assert.equal(readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: " true " }), true);
  assert.throws(() => readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: "yes" }), /must be true or false/);
});

test("translation pilot mode defaults false and rate limit configuration is fail-closed", () => {
  assert.equal(readTranslationPilotMode({}), false);
  assert.equal(readTranslationPilotMode({ TRANSLATION_PILOT_MODE: "true" }), true);
  assert.throws(() => readTranslationPilotMode({ TRANSLATION_PILOT_MODE: "pilot" }), /must be true or false/);
  assert.equal(readTranslationRateLimitPerMinute({}), 20);
  assert.equal(readTranslationRateLimitPerMinute({ TRANSLATION_RATE_LIMIT_PER_MINUTE: "5" }), 5);
  assert.throws(() => readTranslationRateLimitPerMinute({ TRANSLATION_RATE_LIMIT_PER_MINUTE: "0" }), /positive integer/);
  assert.deepEqual(readTranslationPilotAllowedAdminIds({}), []);
  assert.deepEqual(readTranslationPilotAllowedAdminIds({ TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: " admin-1,admin-2,admin-1, " }), ["admin-1", "admin-2"]);
  assert.equal(readTranslationDailyCharacterLimit({}), 50_000);
});

test("translation provider defaults none, accepts google without disabled credentials, and rejects invalid configuration", () => {
  assert.equal(readTranslationProvider({}), "none");
  assert.equal(readTranslationProvider({ TRANSLATION_PROVIDER: "none" }), "none");
  assert.equal(readTranslationProvider({ TRANSLATION_PROVIDER: "google" }), "google");
  assert.deepEqual(readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "false", TRANSLATION_PROVIDER: "google" }), { enabled: false, pilotMode: false, allowedAdminIds: [], dailyCharacterLimit: 50_000, rateLimitPerMinute: 20, provider: "google", google: null });
  assert.deepEqual(readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "true", TRANSLATION_PROVIDER: "google" }), { enabled: true, pilotMode: false, allowedAdminIds: [], dailyCharacterLimit: 50_000, rateLimitPerMinute: 20, provider: "google", google: null });
  assert.throws(() => readTranslationProvider({ TRANSLATION_PROVIDER: "other" }), /must be none or google/);
  assert.throws(() => readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "true", TRANSLATION_PILOT_MODE: "true", TRANSLATION_PROVIDER: "google", GOOGLE_TRANSLATION_PROJECT_ID: "project", GOOGLE_TRANSLATION_CREDENTIALS_JSON: "not-json" }), /must be valid JSON/);
});

test("pilot mode disabled ignores the allowlist and preserves the unavailable response", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; return { translatedText: "unused", characterCount: 16, provider: "google" }; } };
  const { service, findCount, auditEntries, blockedAuditEntries } = serviceFor(eligibleMessage, true, provider, { pilotMode: false, allowedAdminIds: [] });
  await assert.rejects(service.translateMessage("message-1", "en", "not-allowed"), ServiceUnavailableException);
  assert.equal(findCount(), 0);
  assert.equal(providerCalls, 0);
  assert.equal(auditEntries[0]?.errorCategory, "PILOT_DISABLED");
  assert.equal(blockedAuditEntries.length, 0);
});

test("pilot mode rejects a non-allowlisted ADMIN before database or provider access", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; return { translatedText: "unused", characterCount: 16, provider: "google" }; } };
  const { service, findCount, updateCount, blockedAuditEntries } = serviceFor(eligibleMessage, true, provider, { allowedAdminIds: ["admin-1"] });
  await assert.rejects(service.translateMessage("message-1", "en", "admin-2"), (error: unknown) => {
    assert.ok(error instanceof ForbiddenException);
    assert.equal(error.message, "Message translation pilot access denied");
    return true;
  });
  assert.equal(findCount(), 0);
  assert.equal(updateCount(), 0);
  assert.equal(providerCalls, 0);
  assert.deepEqual(Object.keys(blockedAuditEntries[0]).sort(), ["actingUserId", "reasonCategory", "timestamp"]);
  assert.equal(blockedAuditEntries[0]?.actingUserId, "admin-2");
  assert.equal(blockedAuditEntries[0]?.reasonCategory, "ADMIN_NOT_ALLOWLISTED");
});

test("pilot allowlist accepts admin and admin2 while rejecting an unknown admin", async () => {
  const allowedAdminIds = readTranslationPilotAllowedAdminIds({ TRANSLATION_PILOT_ALLOWED_ADMIN_IDS: "admin,admin2" });
  for (const actingUserId of ["admin", "admin2"]) {
    const { service, findCount } = serviceFor({ ...eligibleMessage, translatedEnglish: "Cached English" }, true, null, { allowedAdminIds });
    const result = await service.translateMessage("message-1", "en", actingUserId);
    assert.equal(result.status, "CACHED");
    assert.equal(findCount(), 1);
  }

  const blocked = serviceFor(eligibleMessage, true, null, { allowedAdminIds });
  await assert.rejects(blocked.service.translateMessage("message-1", "en", "unknown-admin"), ForbiddenException);
  assert.equal(blocked.findCount(), 0);
});

test("missing pilot allowlist configuration safely denies every ADMIN", async () => {
  const { service, findCount } = serviceFor(eligibleMessage, true, null, { allowedAdminIds: [] });
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), ForbiddenException);
  assert.equal(findCount(), 0);
});

test("disabled translation returns a controlled unavailable response before database or provider access", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = {
    async translate() {
      providerCalls += 1;
      return { translatedText: "translation", detectedLanguage: "th", characterCount: 16, provider: "google" };
    },
  };
  const { service, findCount } = serviceFor(eligibleMessage, false, provider);
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), (error: unknown) => {
    assert.ok(error instanceof ServiceUnavailableException);
    assert.equal(error.message, "Message translation is unavailable");
    return true;
  });
  assert.equal(findCount(), 0);
  assert.equal(providerCalls, 0);
});

test("DTO accepts en and zh and rejects an invalid target language", async () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });
  for (const targetLanguage of ["en", "zh"]) {
    const result = await pipe.transform({ targetLanguage }, { type: "body", metatype: CreateMessageTranslationDto });
    assert.equal(result.targetLanguage, targetLanguage);
  }
  await assert.rejects(pipe.transform({ targetLanguage: "th" }, { type: "body", metatype: CreateMessageTranslationDto }));
});

test("service rejects unsupported message types and empty original text", async () => {
  for (const message of [
    { ...eligibleMessage, messageType: "STICKER" },
    { ...eligibleMessage, originalText: "   " },
    { ...eligibleMessage, direction: "SYSTEM" },
  ]) {
    const { service } = serviceFor(message);
    await assert.rejects(service.translateMessage(message.id, "en", "admin-1"), UnprocessableEntityException);
  }
});

test("existing translations are returned as durable cache without a provider call", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = {
    async translate() {
      providerCalls += 1;
      return { translatedText: "unused", detectedLanguage: "th", characterCount: 16, provider: "google" };
    },
  };
  const { service, metrics, usageBudget } = serviceFor({ ...eligibleMessage, translatedEnglish: "Cached English" }, true, provider);
  assert.deepEqual(await service.translateMessage("message-1", "en", "admin-1"), {
    messageId: "message-1",
    targetLanguage: "en",
    status: "CACHED",
    translatedText: "Cached English",
    cached: true,
  });
  assert.equal(providerCalls, 0);
  assert.equal(metrics.snapshot().cacheHitCount, 1);
  assert.equal(usageBudget.snapshot().dailyCharacterUsage, 0);
});

test("pilot mode allows an allowlisted ADMIN through the provider abstraction", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = {
    async translate() {
      providerCalls += 1;
      return { translatedText: "Chinese translation", detectedLanguage: "th", characterCount: 16, provider: "google" };
    },
  };
  const { service, updateCount, updateData, metrics, usageBudget } = serviceFor(eligibleMessage, true, provider);
  assert.deepEqual(await service.translateMessage("message-1", "zh", "admin-1"), { messageId: "message-1", targetLanguage: "zh", status: "TRANSLATED", translatedText: "Chinese translation", cached: false });
  assert.equal(providerCalls, 1);
  assert.equal(updateCount(), 1);
  assert.deepEqual(updateData(), { translatedChinese: "Chinese translation" });
  assert.equal(metrics.snapshot().successfulTranslations, 1);
  assert.equal(usageBudget.snapshot().dailyCharacterUsage, Array.from(eligibleMessage.originalText).length);
});

test("translation audit metadata excludes original and translated content", async () => {
  const provider: TranslationProvider = { async translate() { return { translatedText: "Sensitive translated text", detectedLanguage: "th", characterCount: 16, provider: "google" }; } };
  const { service, auditEntries } = serviceFor(eligibleMessage, true, provider);
  await service.translateMessage("message-1", "en", "admin-1");
  assert.deepEqual(Object.keys(auditEntries[0]).sort(), ["actingUserId", "characterCount", "durationMs", "messageId", "provider", "status", "targetLanguage"]);
  const serialized = JSON.stringify(auditEntries);
  assert.equal(serialized.includes(eligibleMessage.originalText), false);
  assert.equal(serialized.includes("Sensitive translated text"), false);
});

test("translation feedback integrates only after a successful translation status", async () => {
  const provider: TranslationProvider = { async translate() { return { translatedText: "English translation", characterCount: 16, provider: "google" }; } };
  const { service, feedback } = serviceFor(eligibleMessage, true, provider);
  const result = await service.translateMessage("message-1", "en", "admin-1");
  assert.deepEqual(feedback.snapshot(), { positiveFeedbackCount: 0, terminologyIssueCount: 0, meaningIssueCount: 0, otherIssueCount: 0 });
  service.recordFeedbackAfterSuccess(result.status, "POSITIVE");
  assert.equal(feedback.snapshot().positiveFeedbackCount, 1);
  assert.throws(() => service.recordFeedbackAfterSuccess("SAME_LANGUAGE", "MEANING_ISSUE"), BadRequestException);
});

test("provider failure returns a sanitized error and does not write a translation", async () => {
  const provider: TranslationProvider = { async translate() { throw new TranslationProviderError("PROVIDER_REQUEST_FAILED"); } };
  const { service, updateCount, metrics } = serviceFor(eligibleMessage, true, provider);
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), (error: unknown) => {
    assert.ok(error instanceof BadGatewayException);
    assert.equal(error.message, "Message translation failed");
    return true;
  });
  assert.equal(updateCount(), 0);
  assert.equal(metrics.snapshot().failedTranslations, 1);
  assert.equal(metrics.snapshot().providerFailures, 1);
});

test("translation attempts persist safe success and failure event metadata", async () => {
  const provider: TranslationProvider = { async translate() { return { translatedText: "English translation", characterCount: 16, provider: "google" }; } };
  const successful = serviceFor(eligibleMessage, true, provider);
  await successful.service.translateMessage("message-1", "en", "admin-1");
  assert.deepEqual(successful.eventEntries[0], {
    messageId: "message-1",
    adminId: "admin-1",
    targetLanguage: "en",
    provider: "google",
    status: "SUCCESS",
    durationMs: successful.eventEntries[0]?.durationMs,
    characterCount: 16,
  });

  const failed = serviceFor(eligibleMessage, true, { async translate() { throw new TranslationProviderError("PROVIDER_REQUEST_FAILED"); } });
  await assert.rejects(failed.service.translateMessage("message-1", "zh", "admin-1"), BadGatewayException);
  assert.equal(failed.eventEntries.length, 1);
  assert.equal(failed.eventEntries[0]?.status, "FAILED");
  assert.equal(failed.eventEntries[0]?.errorCategory, "PROVIDER_REQUEST_FAILED");
});

test("rate limiter returns controlled 429 without provider call or persistence", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; return { translatedText: "unused", characterCount: 16, provider: "google" }; } };
  const { service, updateCount, auditEntries, metrics } = serviceFor(eligibleMessage, true, provider, { rateLimiter: { consume: () => false } });
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 429);
    assert.equal(error.message, "Message translation rate limit exceeded");
    return true;
  });
  assert.equal(providerCalls, 0);
  assert.equal(updateCount(), 0);
  assert.equal(auditEntries[0]?.errorCategory, "RATE_LIMIT_EXCEEDED");
  assert.equal(metrics.snapshot().rateLimitedRequests, 1);
});

test("daily character budget returns controlled 429 before provider call or persistence", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = { async translate() { providerCalls += 1; return { translatedText: "unused", characterCount: 16, provider: "google" }; } };
  const { service, updateCount, metrics, usageBudget } = serviceFor(eligibleMessage, true, provider, { dailyCharacterLimit: 1 });
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), 429);
    assert.equal(error.message, "Message translation daily budget exceeded");
    return true;
  });
  assert.equal(providerCalls, 0);
  assert.equal(updateCount(), 0);
  assert.equal(metrics.snapshot().successfulTranslations, 0);
  assert.equal(usageBudget.snapshot().dailyCharacterUsage, 0);
  assert.equal(usageBudget.snapshot().budgetExceededRequests, 1);
});

test("in-memory rate limiter enforces the configured per-user minute budget", () => {
  const limiter = new InMemoryTranslationRateLimiter({ rateLimitPerMinute: 2 } as TranslationConfig);
  assert.equal(limiter.consume("admin-1"), true);
  assert.equal(limiter.consume("admin-1"), true);
  assert.equal(limiter.consume("admin-1"), false);
  assert.equal(limiter.consume("admin-2"), true);
});

function authContext(user: AuthUser) {
  const request = { method: "POST", path: "/messages/message-1/translations", headers: {} };
  return {
    getHandler: () => TranslationController.prototype.translate,
    getClass: () => TranslationController,
    switchToHttp: () => ({ getRequest: () => request }),
    request,
    user,
  };
}

test("translation endpoint is ADMIN-only: ADMIN passes and VIEWER is rejected", async () => {
  const roles = Reflect.getMetadata(REQUIRED_ROLES, TranslationController.prototype.translate) as string[];
  assert.deepEqual(roles, ["ADMIN"]);

  const admin = { id: "admin-1", email: "admin@example.test", displayName: "Admin", role: "ADMIN", isActive: true } as AuthUser;
  const adminContext = authContext(admin);
  const adminGuard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await adminGuard.canActivate(adminContext as never), true);

  const viewer = { ...admin, id: "viewer-1", role: "VIEWER" } as AuthUser;
  const viewerContext = authContext(viewer);
  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(viewerGuard.canActivate(viewerContext as never), ForbiddenException);
});
