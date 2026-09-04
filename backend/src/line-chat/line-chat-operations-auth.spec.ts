import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { LineChatOperationsController } from "./line-chat-operations.controller";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatNicknameSyncJobStatus, LineChatSessionStatus, UserRole } from "@prisma/client";
import { AuthGuard, type AuthUser } from "../auth/auth.guard";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import type { ExecutionContext } from "@nestjs/common";

function createMockExecutionContext(authHeader?: string, user?: AuthUser): ExecutionContext {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    path: "/operations/line-chat-nickname/health",
    method: "GET",
    user,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
    getHandler: () => LineChatOperationsController.prototype.getHealth,
    getClass: () => LineChatOperationsController,
  } as unknown as ExecutionContext;
}

test("Operations Security: AuthGuard and Reflector enforce ADMIN-only access", async () => {
  const reflector = new Reflector();
  const requiredRoles = reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [
    LineChatOperationsController.prototype.getHealth,
    LineChatOperationsController,
  ]);

  assert.deepEqual(requiredRoles, [UserRole.ADMIN], "Controller must strictly declare required role ADMIN");

  const mockAuthService = {
    authenticate: async (token?: string) => {
      if (token === "admin-token") return { id: "u-admin", role: UserRole.ADMIN, isActive: true } as AuthUser;
      if (token === "viewer-token") return { id: "u-viewer", role: UserRole.VIEWER, isActive: true } as AuthUser;
      if (token === "bm-token") return { id: "u-bm", role: UserRole.BM, isActive: true } as AuthUser;
      if (token === "manager-token") return { id: "u-mgr", role: UserRole.STORE_MANAGER, isActive: true } as AuthUser;
      return null;
    },
  };

  const guard = new AuthGuard(reflector, mockAuthService as never);

  const adminContext = createMockExecutionContext("Bearer admin-token");
  const adminCanActivate = await guard.canActivate(adminContext);
  assert.equal(adminCanActivate, true, "ADMIN must be allowed");

  const viewerContext = createMockExecutionContext("Bearer viewer-token");
  await assert.rejects(
    async () => guard.canActivate(viewerContext),
    /Insufficient permissions|Viewer access is read-only/,
    "VIEWER must be rejected with ForbiddenException"
  );

  const bmContext = createMockExecutionContext("Bearer bm-token");
  await assert.rejects(
    async () => guard.canActivate(bmContext),
    /Insufficient permissions/,
    "BM user must be rejected with ForbiddenException"
  );

  const unauthContext = createMockExecutionContext();
  await assert.rejects(
    async () => guard.canActivate(unauthContext),
    /Authentication required/,
    "Unauthenticated request must be rejected with UnauthorizedException"
  );
});

test("Operations Security: Health summary output never exposes sensitive credentials or profile paths", async () => {
  const mockPrisma = {
    lineChatSession: {
      findMany: async () => [
        {
          id: "sess-1",
          sessionKey: "profile-a",
          displayName: "Profile A",
          profilePath: "/private/data/passwords/profile-a",
          status: LineChatSessionStatus.ACTIVE,
          lastAuthenticatedAt: new Date(),
          lastSuccessfulRequestAt: new Date(),
          lastAuthFailureAt: null,
          consecutiveAuthFailures: 0,
          lineOfficialAccounts: [{ id: "oa-1", lineChatNicknameSyncEnabled: true }],
        },
      ],
    },
    lineOfficialAccount: {
      findMany: async () => [
        {
          id: "oa-1",
          chatBotId: "U092441d025f688e389d25779dd8debf4",
          lineChatSessionId: "sess-1",
          lineChatNicknameSyncEnabled: true,
        },
      ],
    },
    lineChatNicknameSyncJob: {
      groupBy: async () => [
        { status: LineChatNicknameSyncJobStatus.SUCCESS, _count: { id: 10 } },
      ],
    },
  };

  const ops = new LineChatOperationsService(mockPrisma as never);
  const controller = new LineChatOperationsController(ops);
  const report = await controller.getHealth();

  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes("/private/data/passwords"), false, "Must never expose profilePath");
  assert.equal(serialized.includes("cookie"), false, "Must never expose cookies");
  assert.equal(serialized.includes("xsrf"), false, "Must never expose XSRF tokens");
  assert.equal(serialized.includes("password"), false, "Must never expose passwords");
  assert.equal(serialized.includes("token"), false, "Must never expose tokens");
});
