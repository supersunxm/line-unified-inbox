import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { buildPermissionContext } from "./permission-context";

void test("admin compatibility context exposes HQ, all-store, and account-management access", () => {
  const context = buildPermissionContext({ role: UserRole.ADMIN });

  assert.deepEqual(context.platforms, { web: true, mobile: true });
  assert.deepEqual(context.workspaces, { hq: true, store: false, mainOa: false });
  assert.deepEqual(context.scope, { allStores: true, storeIds: [] });
  assert.equal(context.capabilities.manageAccounts, true);
  assert.equal(context.capabilities.reply, true);
});

void test("store user compatibility context is membership scoped", () => {
  const context = buildPermissionContext({
    role: UserRole.VIEWER,
    memberships: [
      { storeId: "store-a", role: "STORE_MANAGER" },
      { storeId: "store-b", role: "STAFF" },
      { storeId: "store-a", role: "STORE_MANAGER" },
    ],
  });

  assert.deepEqual(context.platforms, { web: true, mobile: true });
  assert.deepEqual(context.workspaces, { hq: false, store: true, mainOa: false });
  assert.deepEqual(context.scope, { allStores: false, storeIds: ["store-a", "store-b"] });
  assert.deepEqual(context.identity.membershipRoles, ["STORE_MANAGER", "STAFF"]);
  assert.equal(context.capabilities.manageAccounts, false);
  assert.equal(context.capabilities.reply, true);
});

void test("Main OA capability is independent from store membership", () => {
  const context = buildPermissionContext({
    role: UserRole.VIEWER,
    canAccessMainOa: true,
    canManageMainOa: true,
  });

  assert.deepEqual(context.workspaces, { hq: false, store: false, mainOa: true });
  assert.deepEqual(context.scope, { allStores: false, storeIds: [] });
  assert.equal(context.capabilities.accessMainOa, true);
  assert.equal(context.capabilities.manageMainOa, true);
  assert.equal(context.capabilities.manageAccounts, false);
});

void test("Stage 2 platform grants are explicit when provided", () => {
  const context = buildPermissionContext({
    role: UserRole.VIEWER,
    canAccessWeb: false,
    canAccessMobile: true,
    memberships: [{ storeId: "store-a", role: "STAFF" }],
  });

  assert.equal(context.version, 2);
  assert.equal(context.platforms.web, false);
  assert.equal(context.platforms.mobile, true);
});
