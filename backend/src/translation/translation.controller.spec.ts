import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole, UserStatus } from "@prisma/client";
import { ALLOW_SCOPED_NON_REPLY_ACTION, REQUIRED_ROLES } from "../auth/auth.decorators";
import { AuthGuard, AuthRequest, AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { CreateTranslationFeedbackDto } from "./dto/create-translation-feedback.dto";
import { MessageTranslationFeedbackService } from "./message-translation-feedback.service";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";

const roles = [UserRole.ADMIN, UserRole.ASSISTANT, UserRole.VIEWER] as const;
const existingMessage = { conversationId: "conversation-store-a" };
type TranslationHandler = typeof TranslationController.prototype.translate | typeof TranslationController.prototype.submitFeedback;

function userFor(role: UserRole): AuthUser {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.test`,
    displayName: role,
    role,
    isActive: true,
    status: "ACTIVE",
  };
}

function requestFor(user: AuthUser): AuthRequest {
  return { user } as unknown as AuthRequest;
}

function controllerFor({
  message = existingMessage,
  accessError,
}: {
  message?: typeof existingMessage | null;
  accessError?: Error;
} = {}) {
  const lookups: string[] = [];
  const scopedConversations: Array<{ userId: string; conversationId: string }> = [];
  const translations: Array<{ messageId: string; targetLanguage: string; userId: string }> = [];
  const feedbackSubmissions: Array<{ messageId: string; dto: CreateTranslationFeedbackDto; userId: string }> = [];
  const prisma = {
    message: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        lookups.push(where.id);
        return message;
      },
    },
  } as unknown as PrismaService;
  const service = {
    translateMessage: async (messageId: string, targetLanguage: string, userId: string) => {
      translations.push({ messageId, targetLanguage, userId });
      return { messageId, targetLanguage, status: "TRANSLATED", translatedText: `result-${targetLanguage}`, cached: false };
    },
  } as unknown as TranslationService;
  const feedback = {
    submit: async (messageId: string, dto: CreateTranslationFeedbackDto, userId: string) => {
      feedbackSubmissions.push({ messageId, dto, userId });
      return { messageId, targetLanguage: dto.targetLanguage, rating: dto.rating, recorded: true };
    },
  } as unknown as MessageTranslationFeedbackService;
  const storeAccess = {
    assertConversationAccess: async (user: AuthUser, conversationId: string) => {
      scopedConversations.push({ userId: user.id, conversationId });
      if (accessError) throw accessError;
      return "store-a";
    },
  } as unknown as StoreAccessService;
  return {
    controller: new TranslationController(service, feedback, prisma, storeAccess),
    lookups,
    scopedConversations,
    translations,
    feedbackSubmissions,
  };
}

function guardContext(handler: TranslationHandler, user: AuthUser | null, token = "valid-session") {
  const request = {
    method: "POST",
    path: handler === TranslationController.prototype.translate
      ? "/messages/message-1/translations"
      : "/messages/message-1/translations/feedback",
    headers: token ? { cookie: `oppo_session=${token}` } : {},
  };
  return {
    getHandler: () => handler,
    getClass: () => TranslationController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

test("translation and feedback allow all three website roles without granting reply permission", async () => {
  const handlers: TranslationHandler[] = [TranslationController.prototype.translate, TranslationController.prototype.submitFeedback];
  let activeUser = userFor(UserRole.ADMIN);
  let replyChecks = 0;
  const guard = new AuthGuard(
    new Reflector(),
    { authenticate: async () => activeUser } as never,
    { canWriteAsStoreUser: async () => { replyChecks++; return false; } } as never,
  );

  for (const handler of handlers) {
    assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, handler), roles);
    assert.equal(Reflect.getMetadata(ALLOW_SCOPED_NON_REPLY_ACTION, handler), true);
    for (const role of roles) {
      activeUser = userFor(role);
      assert.equal(await guard.canActivate(guardContext(handler, activeUser)), true);
    }
  }
  assert.equal(replyChecks, 0);
});

test("translation verifies the message conversation scope before requesting English or Chinese", async () => {
  const fixture = controllerFor();
  for (const role of roles) {
    const user = userFor(role);
    for (const targetLanguage of ["en", "zh"] as const) {
      const dto: CreateMessageTranslationDto = { targetLanguage };
      const result = await fixture.controller.translate("message-1", dto, requestFor(user));
      assert.equal(result.targetLanguage, targetLanguage);
      assert.equal(result.translatedText, `result-${targetLanguage}`);
      assert.equal(fixture.lookups.at(-1), "message-1");
      assert.deepEqual(fixture.scopedConversations.at(-1), { userId: user.id, conversationId: existingMessage.conversationId });
    }
  }
  assert.equal(fixture.translations.length, roles.length * 2);
});

test("translation feedback preserves the selected language for all three roles", async () => {
  const fixture = controllerFor();
  for (const role of roles) {
    const user = userFor(role);
    for (const targetLanguage of ["en", "zh"] as const) {
      const dto: CreateTranslationFeedbackDto = { targetLanguage, rating: "HELPFUL" };
      const result = await fixture.controller.submitFeedback("message-1", dto, requestFor(user));
      assert.equal(result.targetLanguage, targetLanguage);
      assert.deepEqual(fixture.feedbackSubmissions.at(-1), { messageId: "message-1", dto, userId: user.id });
      assert.deepEqual(fixture.scopedConversations.at(-1), { userId: user.id, conversationId: existingMessage.conversationId });
    }
  }
  assert.equal(fixture.feedbackSubmissions.length, roles.length * 2);
});

test("invalid message IDs and inaccessible conversations stop before translation or feedback", async () => {
  const invalid = controllerFor({ message: null });
  const viewer = userFor(UserRole.VIEWER);
  await assert.rejects(invalid.controller.translate("invalid-id", { targetLanguage: "en" }, requestFor(viewer)), NotFoundException);
  await assert.rejects(invalid.controller.submitFeedback("invalid-id", { targetLanguage: "zh", rating: "HELPFUL" }, requestFor(viewer)), NotFoundException);
  assert.deepEqual(invalid.lookups, ["invalid-id", "invalid-id"]);
  assert.equal(invalid.scopedConversations.length, 0);
  assert.equal(invalid.translations.length, 0);
  assert.equal(invalid.feedbackSubmissions.length, 0);

  for (const accessError of [new ForbiddenException("Store access is forbidden"), new NotFoundException("Conversation not found")]) {
    const blocked = controllerFor({ accessError });
    const sameErrorType = (error: unknown) => error instanceof Error && error.constructor === accessError.constructor;
    await assert.rejects(blocked.controller.translate("message-1", { targetLanguage: "en" }, requestFor(viewer)), sameErrorType);
    await assert.rejects(blocked.controller.submitFeedback("message-1", { targetLanguage: "zh", rating: "HELPFUL" }, requestFor(viewer)), sameErrorType);
    assert.equal(blocked.scopedConversations.length, 2);
    assert.equal(blocked.translations.length, 0);
    assert.equal(blocked.feedbackSubmissions.length, 0);
  }
});

test("store access rejects cross-store and HEAD_OFFICE conversations for an authorized viewer", async () => {
  const conversations: Record<string, { storeId: string | null; lineOfficialAccount: { accountType: string } | null }> = {
    "conversation-store-a": { storeId: "store-a", lineOfficialAccount: { accountType: "STORE" } },
    "conversation-store-b": { storeId: "store-b", lineOfficialAccount: { accountType: "STORE" } },
    "conversation-hq": { storeId: "store-a", lineOfficialAccount: { accountType: "HEAD_OFFICE" } },
  };
  const prisma = {
    conversation: { findUnique: async ({ where }: { where: { id: string } }) => conversations[where.id] ?? null },
    user: {
      findUnique: async () => ({
        isActive: true,
        status: UserStatus.ACTIVE,
        canAccessAllStores: false,
        memberships: [{ storeId: "store-a", status: "ACTIVE", store: { isActive: true, archivedAt: null } }],
      }),
    },
  } as unknown as PrismaService;
  const access = new StoreAccessService(prisma);
  const viewer = userFor(UserRole.VIEWER);
  assert.equal(await access.assertConversationAccess(viewer, "conversation-store-a"), "store-a");
  await assert.rejects(access.assertConversationAccess(viewer, "conversation-store-b"), ForbiddenException);
  await assert.rejects(access.assertConversationAccess(viewer, "conversation-hq"), NotFoundException);
  await assert.rejects(access.assertConversationAccess(viewer, "missing-conversation"), NotFoundException);
});

test("invalid sessions and roles outside the policy remain blocked", async () => {
  let authenticatedUser: AuthUser | null = null;
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => authenticatedUser } as never);
  const handler = TranslationController.prototype.translate;
  await assert.rejects(guard.canActivate(guardContext(handler, null, "invalid-session")), UnauthorizedException);

  authenticatedUser = userFor(UserRole.ADMIN);
  const roleRestricted = { ...authenticatedUser, role: "UNKNOWN" as unknown as UserRole };
  const roleGuard = new AuthGuard(new Reflector(), { authenticate: async () => roleRestricted } as never);
  await assert.rejects(roleGuard.canActivate(guardContext(handler, roleRestricted)), ForbiddenException);
});

test("scoped translation exception does not bypass reply permission on unrelated POST routes", async () => {
  const viewer = userFor(UserRole.VIEWER);
  const handler = async () => undefined;
  const guard = new AuthGuard(
    new Reflector(),
    { authenticate: async () => viewer } as never,
    { canWriteAsStoreUser: async () => false } as never,
  );
  const request = { method: "POST", path: "/messages/other-action", headers: { cookie: "oppo_session=valid-session" } };
  const context = {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
  await assert.rejects(guard.canActivate(context), ForbiddenException);
});
