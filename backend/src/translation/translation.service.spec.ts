import assert from "node:assert/strict";
import test from "node:test";
import { BadGatewayException, ForbiddenException, ServiceUnavailableException, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard, AuthUser } from "../auth/auth.guard";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { readMessageTranslationConfig, readMessageTranslationEnabled, readTranslationProvider, TranslationConfig } from "./translation.config";
import { TranslationController } from "./translation.controller";
import { TranslationProvider, TranslationProviderError } from "./translation.provider";
import { TranslationService } from "./translation.service";

const eligibleMessage = {
  id: "message-1",
  direction: "INBOUND",
  messageType: "TEXT",
  originalText: "ข้อความลูกค้า",
  originalLanguage: "th",
  translatedEnglish: null,
  translatedChinese: null,
};

function serviceFor(message: typeof eligibleMessage | null, enabled = true, provider: TranslationProvider | null = null) {
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
  const config = { enabled } as TranslationConfig;
  return { service: new TranslationService(prisma, config, provider), findCount: () => findCount, updateCount: () => updateCount, updateData: () => updateData };
}

test("MESSAGE_TRANSLATION_ENABLED defaults false and accepts only explicit booleans", () => {
  assert.equal(readMessageTranslationEnabled({}), false);
  assert.equal(readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: "false" }), false);
  assert.equal(readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: " true " }), true);
  assert.throws(() => readMessageTranslationEnabled({ MESSAGE_TRANSLATION_ENABLED: "yes" }), /must be true or false/);
});

test("translation provider defaults none, accepts google without disabled credentials, and rejects invalid configuration", () => {
  assert.equal(readTranslationProvider({}), "none");
  assert.equal(readTranslationProvider({ TRANSLATION_PROVIDER: "none" }), "none");
  assert.equal(readTranslationProvider({ TRANSLATION_PROVIDER: "google" }), "google");
  assert.deepEqual(readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "false", TRANSLATION_PROVIDER: "google" }), { enabled: false, provider: "google", google: null });
  assert.deepEqual(readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "true", TRANSLATION_PROVIDER: "google" }), { enabled: true, provider: "google", google: null });
  assert.throws(() => readTranslationProvider({ TRANSLATION_PROVIDER: "other" }), /must be none or google/);
  assert.throws(() => readMessageTranslationConfig({ MESSAGE_TRANSLATION_ENABLED: "true", TRANSLATION_PROVIDER: "google", GOOGLE_TRANSLATION_PROJECT_ID: "project", GOOGLE_TRANSLATION_CREDENTIALS_JSON: "not-json" }), /must be valid JSON/);
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
  const { service } = serviceFor({ ...eligibleMessage, translatedEnglish: "Cached English" }, true, provider);
  assert.deepEqual(await service.translateMessage("message-1", "en", "admin-1"), {
    messageId: "message-1",
    targetLanguage: "en",
    status: "CACHED",
    translatedText: "Cached English",
    cached: true,
  });
  assert.equal(providerCalls, 0);
});

test("enabled uncached translation calls the abstraction and persists only the target cache", async () => {
  let providerCalls = 0;
  const provider: TranslationProvider = {
    async translate() {
      providerCalls += 1;
      return { translatedText: "Chinese translation", detectedLanguage: "th", characterCount: 16, provider: "google" };
    },
  };
  const { service, updateCount, updateData } = serviceFor(eligibleMessage, true, provider);
  assert.deepEqual(await service.translateMessage("message-1", "zh", "admin-1"), { messageId: "message-1", targetLanguage: "zh", status: "TRANSLATED", translatedText: "Chinese translation", cached: false });
  assert.equal(providerCalls, 1);
  assert.equal(updateCount(), 1);
  assert.deepEqual(updateData(), { translatedChinese: "Chinese translation" });
});

test("provider failure returns a sanitized error and does not write a translation", async () => {
  const provider: TranslationProvider = { async translate() { throw new TranslationProviderError("PROVIDER_REQUEST_FAILED"); } };
  const { service, updateCount } = serviceFor(eligibleMessage, true, provider);
  await assert.rejects(service.translateMessage("message-1", "en", "admin-1"), (error: unknown) => {
    assert.ok(error instanceof BadGatewayException);
    assert.equal(error.message, "Message translation failed");
    return true;
  });
  assert.equal(updateCount(), 0);
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
