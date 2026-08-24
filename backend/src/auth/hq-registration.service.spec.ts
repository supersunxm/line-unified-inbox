import assert from "node:assert/strict";
import test from "node:test";
import { UserRole, UserStatus } from "@prisma/client";
import { HqRegistrationService } from "./hq-registration.service";

void test("HQ registration creates one pending full-access user without store membership", async () => {
  let created: any;
  const prisma: any = {
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => { created = data; return { id: "hq-1" }; },
    },
  };
  const service = new HqRegistrationService(prisma, { hash: async () => "hash" } as any);

  const result = await service.request({
    name: "HQ User",
    employeeId: "hq001",
    email: "hq@example.test",
    password: "Strong-password-1234!",
  });

  assert.equal(result.accountType, "HQ");
  assert.equal(created.role, UserRole.ADMIN);
  assert.equal(created.status, UserStatus.PENDING_APPROVAL);
  assert.equal(created.canAccessWeb, true);
  assert.equal(created.canAccessMobile, true);
  assert.equal(created.canAccessHq, true);
  assert.equal(created.canAccessAllStores, true);
  assert.equal(created.canManageAccounts, true);
  assert.equal(created.canReply, true);
  assert.equal(created.canAccessMainOa, true);
  assert.equal(created.canManageMainOa, true);
  assert.equal("storeId" in created, false);
});

void test("approving HQ reasserts every full-access grant", async () => {
  let updateData: any;
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => where.id === "admin-1" ? {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        isActive: true,
        canManageAccounts: true,
      } : null,
      findFirst: async () => ({ id: "hq-1" }),
      update: async ({ data }: any) => { updateData = data; return {}; },
    },
  };
  const service = new HqRegistrationService(prisma, {} as any);

  const result = await service.approve("hq-1", "admin-1");

  assert.equal(result.fullAccess, true);
  assert.equal(updateData.status, UserStatus.ACTIVE);
  assert.equal(updateData.role, UserRole.ADMIN);
  assert.equal(updateData.canAccessWeb, true);
  assert.equal(updateData.canAccessMobile, true);
  assert.equal(updateData.canAccessHq, true);
  assert.equal(updateData.canAccessAllStores, true);
  assert.equal(updateData.canManageAccounts, true);
  assert.equal(updateData.canReply, true);
  assert.equal(updateData.canAccessMainOa, true);
  assert.equal(updateData.canManageMainOa, true);
});
