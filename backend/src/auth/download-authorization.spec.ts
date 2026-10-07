import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { AuthGuard, type AuthUser } from "./auth.guard";
import { DownloadGuard } from "./download.guard";
import { buildPermissionContext } from "./permission-context";
import { AdminRegistrationController } from "./admin-registration.controller";
import { StoreInsightsController } from "../store-insights/store-insights.controller";
import { MonthlyOperationsReportController } from "../monthly-operations-report/monthly-operations-report.controller";
import { GoogleReviewKpiController } from "../google-review-kpi/google-review-kpi.controller";
import { LineOfficialAccountsController } from "../line-official-accounts/line-official-accounts.controller";
import { FriendSourceLinksController } from "../friend-source-links/friend-source-links.controller";

function user(role: UserRole): AuthUser {
  return { id: "hq", email: "hq@example.test", displayName: "HQ", role, isActive: true,
    authorization: buildPermissionContext({ role, canAccessHq: true, canAccessAllStores: true,
      canReply: true, canAccessMainOa: true, canManageMainOa: true, canManageAccounts: true }) };
}

function context(handler: object, controller: object, identity: AuthUser | null, method = "GET") {
  const request = { user: identity, method, path: "/test", headers: { cookie: "oppo_session=test" } };
  return { getHandler: () => handler, getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }) } as never;
}

const exports = [
  [StoreInsightsController.prototype.export, StoreInsightsController, "POST"],
  [MonthlyOperationsReportController.prototype.export, MonthlyOperationsReportController, "GET"],
  [GoogleReviewKpiController.prototype.exportWeeklyLeaderboard, GoogleReviewKpiController, "GET"],
  [LineOfficialAccountsController.prototype.exportCsv, LineOfficialAccountsController, "GET"],
  [LineOfficialAccountsController.prototype.exportHandoverCsv, LineOfficialAccountsController, "GET"],
] as const;

for (const [handler, controller, method] of exports) {
  void test(`${controller.name}.${handler.name}: actual export route requires shared download guard`, async () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    assert.ok(guards.some((guard) => guard instanceof DownloadGuard));
    for (const role of [UserRole.ADMIN, UserRole.ASSISTANT, UserRole.VIEWER]) {
      const identity = user(role);
      const ctx = context(handler, controller, identity, method);
      const auth = new AuthGuard(new Reflector(), { authenticate: async () => identity } as never,
        { canWriteAsStoreUser: async () => true } as never);
      if (role === UserRole.ADMIN) {
        assert.equal(await auth.canActivate(ctx), true);
        assert.equal(new DownloadGuard().canActivate(ctx), true);
      } else {
        assert.throws(() => new DownloadGuard().canActivate(ctx), ForbiddenException);
      }
    }
    const auth = new AuthGuard(new Reflector(), { authenticate: async () => null } as never);
    await assert.rejects(() => auth.canActivate(context(handler, controller, null, method)), UnauthorizedException);
  });
}

void test("Assistant cannot read account administration or invoke any privileged mutation, including own role", async () => {
  const identity = user(UserRole.ASSISTANT);
  const auth = new AuthGuard(new Reflector(), { authenticate: async () => identity } as never,
    { canWriteAsStoreUser: async () => true } as never);
  for (const name of ["hqApproved", "pending", "changeHqRole", "deactivateHq", "reactivateHq", "resetHqPassword", "approveHq", "rejectHq", "approve", "reject", "resetPassword", "deactivate", "reactivate", "permanentlyDelete"] as const) {
    const method = name === "hqApproved" || name === "pending" ? "GET" : "PATCH";
    await assert.rejects(() => auth.canActivate(context(AdminRegistrationController.prototype[name], AdminRegistrationController, identity, method)), ForbiddenException, name);
  }
});

void test("Assistant grants preserve scope, platforms, Reply and Main OA but mask stale account-management flags", () => {
  const auth = user(UserRole.ASSISTANT).authorization!;
  assert.equal(auth.capabilities.downloadData, false);
  assert.equal(auth.capabilities.manageAccounts, false);
  assert.equal(auth.capabilities.reply, true);
  assert.equal(auth.capabilities.accessMainOa, true);
  assert.equal(auth.capabilities.manageMainOa, true);
  assert.deepEqual(auth.platforms, { web: true, mobile: true });
  assert.deepEqual(auth.scope, { allStores: true, storeIds: [] });
  const scoped = buildPermissionContext({ role: UserRole.ASSISTANT, memberships: [{ storeId: "a", role: "STAFF" }] });
  assert.deepEqual(scoped.scope, { allStores: false, storeIds: ["a"] });
});

void test("reviewed operational views allow all-store HQ Assistant but not privileged settings or writes", async () => {
  const identity = user(UserRole.ASSISTANT);
  const auth = new AuthGuard(new Reflector(), { authenticate: async () => identity } as never,
    { canWriteAsStoreUser: async () => true } as never);
  assert.equal(await auth.canActivate(context(FriendSourceLinksController.prototype.list, FriendSourceLinksController, identity)), true);
  await assert.rejects(() => auth.canActivate(context(FriendSourceLinksController.prototype.getAttributionConfigs, FriendSourceLinksController, identity)), ForbiddenException);
  await assert.rejects(() => auth.canActivate(context(FriendSourceLinksController.prototype.generate, FriendSourceLinksController, identity, "POST")), ForbiddenException);
  identity.authorization!.scope.allStores = false;
  await assert.rejects(() => auth.canActivate(context(FriendSourceLinksController.prototype.list, FriendSourceLinksController, identity)), ForbiddenException);
});
