import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { RegistrationService } from "./registration.service";

function dto() {
  return { storeId: "store-1", email: "bm@example.test", name: "Bee Manager", role: "STORE_MANAGER" as const, password: "strong-password-1234" };
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
    user: { findUnique: async () => null },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback(tx),
  };
  const service = new RegistrationService(prisma, { hash: async () => "scrypt:hashed" } as any);
  const result = await service.request(dto());
  assert.equal(result.status, "PENDING_APPROVAL");
  assert.equal(created.normalizedEmail, "bm@example.test");
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

void test("approval activates both user and membership atomically", async () => {
  const updates: Array<{ table: string; data: unknown }> = [];
  const request = { id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" };
  const tx: any = {
    registrationRequest: { findUnique: async () => request, update: async ({ data }: any) => { updates.push({ table: "request", data }); return data; } },
    userStoreMembership: { findUnique: async () => ({ id: "membership-1", status: "PENDING_APPROVAL" }), update: async ({ data }: any) => { updates.push({ table: "membership", data }); return data; } },
    user: { update: async ({ data }: any) => { updates.push({ table: "user", data }); return data; } },
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
