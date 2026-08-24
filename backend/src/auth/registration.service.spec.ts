import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { RegistrationService } from "./registration.service";

function dto() {
  return { storeId: "store-1", email: "bm@example.test", name: "Bee Manager", employeeId: "emp-001", role: "STORE_MANAGER" as const, password: "Strong-password-1234!" };
}

void test("creates a pending user and membership with a hashed password without OTP", async () => {
  const created: Record<string, any> = {};
  const tx: any = {
    registrationRequest: {
      create: async ({ data }: any) => Object.assign(created, { id: "registration-1" }, data),
      update: async ({ data }: any) => Object.assign(created, data),
    },
    user: { create: async ({ data }: any) => Object.assign(created, { id: "user-1", ...data }) },
    userStoreMembership: { create: async ({ data }: any) => ({ id: "membership-1", ...data }) },
  };
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: { findUnique: async () => null, findFirst: async () => null },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback(tx),
  };
  const service = new RegistrationService(prisma, { hash: async () => "scrypt:hashed" } as any);
  const result = await service.request(dto());
  assert.equal(result.status, "PENDING_APPROVAL");
  assert.equal(created.normalizedEmail, "bm@example.test");
  assert.equal(created.employeeId, "EMP-001");
  assert.equal(created.createdUserId, "user-1");
  assert.notEqual(created.passwordHash, dto().password);
});

void test("rejects unavailable stores and duplicate emails", async () => {
  const prisma: any = { store: { findUnique: async () => null }, user: { findUnique: async () => null } };
  const service = new RegistrationService(prisma, {} as any);
  await assert.rejects(() => service.request(dto()), NotFoundException);
  prisma.store.findUnique = async () => ({ id: "store-1", isActive: true, archivedAt: null });
  prisma.user.findUnique = async () => ({ id: "user-1" });
  await assert.rejects(() => service.request(dto()), ConflictException);
});

void test("rejects registration passwords that do not meet the shared policy", async () => {
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: { findUnique: async () => null, findFirst: async () => null },
    registrationRequest: { findFirst: async () => null },
  };
  const service = new RegistrationService(prisma, { hash: async () => "should-not-hash" } as any);
  await assert.rejects(
    () => service.request({ ...dto(), password: "weak-password-1" }),
    (error: unknown) => error instanceof BadRequestException && error.getResponse().code === "PASSWORD_POLICY_VIOLATION",
  );
});

void test("rejects a duplicate employee ID without exposing database details", async () => {
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: {
      findUnique: async () => null,
      findFirst: async () => ({ id: "existing-user" }),
    },
  };
  const service = new RegistrationService(prisma, {} as any);
  await assert.rejects(
    () => service.request(dto()),
    (error: unknown) => error instanceof ConflictException && error.message === "Employee ID is already registered",
  );
});

void test("normalizes employee IDs consistently for new registrations", async () => {
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: { findUnique: async () => null, findFirst: async () => null },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback({
      registrationRequest: { create: async ({ data }: any) => ({ id: "registration-1", ...data }), update: async () => undefined },
      user: { create: async ({ data }: any) => ({ id: "user-1", ...data }) },
      userStoreMembership: { create: async () => ({ id: "membership-1" }) },
    }),
  };
  const service = new RegistrationService(prisma, { hash: async () => "scrypt:hashed" } as any);
  const result = await service.request({ ...dto(), employeeId: "  emp-xyz  " });
  assert.equal(result.status, "PENDING_APPROVAL");
});

void test("approval activates both user and membership atomically", async () => {
  const updates: Array<{ table: string; data: unknown }> = [];
  const request = { id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" };
  const tx: any = {
    registrationRequest: { findUnique: async () => request, updateMany: async ({ data }: any) => { updates.push({ table: "request", data }); return { count: 1 }; } },
    userStoreMembership: { findUnique: async () => ({ id: "membership-1", status: "PENDING_APPROVAL", role: "STORE_MANAGER", user: { email: "bm@example.test", displayName: "Bee Manager" }, store: { name: "Central World" } }), updateMany: async ({ data }: any) => { updates.push({ table: "membership", data }); return { count: 1 }; } },
    user: { updateMany: async ({ data }: any) => { updates.push({ table: "user", data }); return { count: 1 }; } },
  };
  const auditEntries: any[] = [];
  const service = new RegistrationService({ $transaction: async (callback: any) => callback(tx) } as any, {} as any, undefined, { record: async (entry: any) => auditEntries.push(entry) } as any);
  await service.approve("registration-1", "admin-1");
  assert.deepEqual(updates.map((entry) => entry.table), ["membership", "user", "request"]);
  assert.equal((updates[1].data as any).status, "ACTIVE");
  const requestUpdate = updates.find((entry) => entry.table === "request");
  assert.equal((requestUpdate?.data as any).status, "APPROVED");
  assert.equal(auditEntries[0].action, "ADMIN_APPROVE_REGISTRATION");
});

void test("successful approval sends exactly one notification after the transaction commits", async () => {
  const calls: string[] = [];
  const transaction = async (callback: any) => callback({
    registrationRequest: {
      findUnique: async () => ({ id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" }),
      updateMany: async () => { calls.push("request"); return { count: 1 }; },
    },
    userStoreMembership: {
      findUnique: async () => ({ id: "membership-1", status: "PENDING_APPROVAL", role: "STAFF", user: { email: "pc@example.test", displayName: "Ploy <PC>" }, store: { name: "Central <World>" } }),
      updateMany: async () => { calls.push("membership"); return { count: 1 }; },
    },
    user: { updateMany: async () => { calls.push("user"); return { count: 1 }; } },
  });
  const sent: unknown[] = [];
  const service = new RegistrationService({ $transaction: transaction } as any, {} as any, undefined, undefined, { sendAccountApproved: async (input: unknown) => { calls.push("email"); sent.push(input); } } as any);
  const result = await service.approve("registration-1", "admin-1");
  assert.deepEqual(calls, ["membership", "user", "request", "email"]);
  assert.deepEqual(result.notification, { status: "sent" });
  assert.deepEqual(sent, [{ to: "pc@example.test", displayName: "Ploy <PC>", storeName: "Central <World>", role: "STAFF" }]);
});

void test("approval notification failure leaves the approved result active", async () => {
  const service = new RegistrationService({ $transaction: async (callback: any) => callback({
    registrationRequest: { findUnique: async () => ({ id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" }), updateMany: async () => ({ count: 1 }) },
    userStoreMembership: { findUnique: async () => ({ id: "membership-1", status: "PENDING_APPROVAL", role: "STORE_MANAGER", user: { email: "bm@example.test", displayName: "Bee Manager" }, store: { name: "Central World" } }), updateMany: async () => ({ count: 1 }) },
    user: { updateMany: async () => ({ count: 1 }) },
  }) } as any, {} as any, undefined, undefined, { sendAccountApproved: async () => { throw new Error("provider unavailable"); } } as any);
  const result = await service.approve("registration-1", "admin-1");
  assert.equal(result.status, "ACTIVE");
  assert.deepEqual(result.notification, { status: "failed" });
});

void test("rejecting a registration never sends an approval email", async () => {
  let sent = 0;
  const service = new RegistrationService({ $transaction: async (callback: any) => callback({
    registrationRequest: { findUnique: async () => ({ id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" }), updateMany: async () => ({ count: 1 }) },
    userStoreMembership: { findUnique: async () => ({ id: "membership-1", status: "PENDING_APPROVAL", role: "STAFF", user: { email: "pc@example.test", displayName: "PC" }, store: { name: "Store" } }), updateMany: async () => ({ count: 1 }) },
    user: { updateMany: async () => ({ count: 1 }) },
  }) } as any, {} as any, undefined, undefined, { sendAccountApproved: async () => { sent += 1; } } as any);
  const result = await service.reject("registration-1", "admin-1");
  assert.equal(result.status, "REJECTED");
  assert.equal(sent, 0);
  assert.equal("notification" in result, false);
});

void test("a repeated approval request is rejected before notification dispatch", async () => {
  let sent = 0;
  const service = new RegistrationService({ $transaction: async (callback: any) => callback({
    registrationRequest: { findUnique: async () => ({ id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "APPROVED" }) },
  }) } as any, {} as any, undefined, undefined, { sendAccountApproved: async () => { sent += 1; } } as any);
  await assert.rejects(() => service.approve("registration-1", "admin-1"), NotFoundException);
  assert.equal(sent, 0);
});

void test("approved accounts include employee, store, role, and approver provenance", async () => {
  const service = new RegistrationService({
    userStoreMembership: {
      findMany: async () => [{
        id: "membership-1",
        userId: "user-1",
        role: "STORE_MANAGER",
        approvedAt: new Date("2026-08-17T00:00:00.000Z"),
        approvedBy: { id: "admin-1", displayName: "OPPO Admin", email: "admin@example.test" },
        user: { id: "user-1", displayName: "Somchai ABC", employeeId: "OP00123", email: "somchai@example.test" },
        store: { id: "store-1", name: "Central World", code: "CW" },
      }],
    },
  } as any, {} as any);
  const [account] = await service.approved();
  assert.equal(account.role, "STORE_MANAGER");
  assert.equal(account.employeeId, "OP00123");
  assert.equal(account.approvedBy?.displayName, "OPPO Admin");
  assert.equal(account.store.name, "Central World");
});
