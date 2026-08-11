import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuthGuard, AuthUser } from "./auth.guard";
import { StoreAccessService } from "./store-access.service";

const admin: AuthUser = { id: "admin", email: "admin@example.test", displayName: "Admin", role: UserRole.ADMIN, isActive: true };
const manager: AuthUser = { id: "manager", email: "manager@example.test", displayName: "Manager", role: UserRole.VIEWER, isActive: true };
const staff: AuthUser = { id: "staff", email: "staff@example.test", displayName: "Staff", role: UserRole.VIEWER, isActive: true };

function serviceFor(account: unknown, conversations: Record<string, string> = {}) {
  const prisma = {
    user: { findUnique: async () => account },
    conversation: { findUnique: async ({ where }: { where: { id: string } }) => conversations[where.id] ? { storeId: conversations[where.id] } : null },
  } as unknown as PrismaService;
  return new StoreAccessService(prisma);
}

function activeMembership(storeId: string, role: "STORE_MANAGER" | "STAFF" = "STORE_MANAGER") {
  return { isActive: true, status: "ACTIVE", memberships: [{ storeId, role, status: "ACTIVE", store: { isActive: true, archivedAt: null } }] };
}

void test("ADMIN can access every store", async () => {
  const service = serviceFor(null);
  assert.equal(await service.accessibleStoreIds(admin), null);
  await service.assertStoreAccess(admin, "any-store");
});

void test("STORE_MANAGER and STAFF can access only their active store", async () => {
  const managerService = serviceFor(activeMembership("store-a"), { same: "store-a", other: "store-b" });
  assert.deepEqual(await managerService.accessibleStoreIds(manager), ["store-a"]);
  await managerService.assertConversationAccess(manager, "same");
  await assert.rejects(() => managerService.assertConversationAccess(manager, "other"), ForbiddenException);

  const staffService = serviceFor(activeMembership("store-a", "STAFF"), { same: "store-a", other: "store-b" });
  await staffService.assertConversationAccess(staff, "same");
  await assert.rejects(() => staffService.assertConversationAccess(staff, "other"), ForbiddenException);
});

void test("inactive users, pending or rejected memberships, and inactive stores are forbidden", async () => {
  await assert.rejects(() => serviceFor({ isActive: false, status: "ACTIVE", memberships: [] }).accessibleStoreIds(manager), ForbiddenException);
  await assert.rejects(() => serviceFor({ isActive: true, status: "ACTIVE", memberships: [{ storeId: "store-a", status: "PENDING_APPROVAL", store: { isActive: true, archivedAt: null } }] }).accessibleStoreIds(manager), ForbiddenException);
  await assert.rejects(() => serviceFor({ isActive: true, status: "ACTIVE", memberships: [{ storeId: "store-a", status: "SUSPENDED", store: { isActive: true, archivedAt: null } }] }).accessibleStoreIds(manager), ForbiddenException);
  await assert.rejects(() => serviceFor({ isActive: true, status: "ACTIVE", memberships: [{ storeId: "store-a", status: "REJECTED", store: { isActive: true, archivedAt: null } }] }).accessibleStoreIds(manager), ForbiddenException);
  await assert.rejects(() => serviceFor({ isActive: true, status: "ACTIVE", memberships: [{ storeId: "store-a", status: "ACTIVE", store: { isActive: false, archivedAt: null } }] }).accessibleStoreIds(manager), ForbiddenException);
});

void test("legacy VIEWER accounts preserve read-only scope and unauthenticated requests return 401", async () => {
  const legacyViewer = serviceFor({ isActive: true, status: "ACTIVE", memberships: [] });
  assert.equal(await legacyViewer.accessibleStoreIds(manager), null);
  assert.equal(await legacyViewer.canWriteAsStoreUser(manager), false);

  const guard = new AuthGuard(new Reflector(), { authenticate: async () => null } as never);
  const request = { method: "GET", path: "/conversations", headers: {} };
  const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => request }) };
  await assert.rejects(() => guard.canActivate(context as never), UnauthorizedException);
});
