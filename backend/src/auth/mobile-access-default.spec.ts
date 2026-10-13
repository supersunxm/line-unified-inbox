import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, UserRole } from "@prisma/client";
import { buildPermissionContext } from "./permission-context";

void test("Prisma denies omitted mobile access without changing other user defaults", () => {
  const user = Prisma.dmmf.datamodel.models.find((model) => model.name === "User");
  assert.equal(user?.fields.find((field) => field.name === "canAccessMobile")?.default, false);
  assert.equal(user?.fields.find((field) => field.name === "canAccessWeb")?.default, true);
});

void test("stored mobile denial applies to administrators while preserving web and HQ access", () => {
  const permissions = buildPermissionContext({ role: UserRole.ADMIN, canAccessMobile: false });
  assert.equal(permissions.platforms.mobile, false);
  assert.equal(permissions.platforms.web, true);
  assert.equal(permissions.workspaces.hq, true);
  assert.equal(permissions.capabilities.manageAccounts, true);
});

void test("explicit existing mobile grants and store scope remain unchanged", () => {
  const permissions = buildPermissionContext({
    role: UserRole.VIEWER,
    canAccessMobile: true,
    memberships: [{ storeId: "test-store", role: "STAFF" }],
  });
  assert.equal(permissions.platforms.mobile, true);
  assert.deepEqual(permissions.scope.storeIds, ["test-store"]);
  assert.equal(permissions.scope.allStores, false);
  assert.equal(permissions.capabilities.manageAccounts, false);
});
