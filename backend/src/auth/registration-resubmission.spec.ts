import assert from "node:assert/strict";
import test from "node:test";
import { RegistrationService } from "./registration.service";

function dto() {
  return {
    storeId: "correct-store",
    email: "pc@example.test",
    name: "PC Example",
    employeeId: "EMP-001",
    role: "STAFF" as const,
    password: "Strong-password-1234!",
  };
}

void test("a rejected user can resubmit with the same email for a different store", async () => {
  const userUpdates: any[] = [];
  const membershipCreates: any[] = [];
  const registrationQueries: any[] = [];

  const tx: any = {
    registrationRequest: {
      create: async ({ data }: any) => ({ id: "registration-2", ...data }),
      update: async ({ data }: any) => ({ id: "registration-2", ...data }),
    },
    user: {
      updateMany: async ({ data }: any) => {
        userUpdates.push(data);
        return { count: 1 };
      },
      create: async () => {
        throw new Error("rejected account should be reused, not recreated");
      },
    },
    userStoreMembership: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        membershipCreates.push(data);
        return { id: "membership-2", ...data };
      },
      updateMany: async () => {
        throw new Error("different store should create a new pending membership");
      },
    },
  };

  const prisma: any = {
    store: { findUnique: async () => ({ id: "correct-store", isActive: true, archivedAt: null }) },
    user: {
      findUnique: async () => ({ id: "user-1", status: "REJECTED", role: "VIEWER" }),
      findFirst: async ({ where }: any) => {
        assert.equal(where.id.not, "user-1");
        return null;
      },
    },
    registrationRequest: {
      findFirst: async ({ where }: any) => {
        registrationQueries.push(where);
        return null;
      },
    },
    $transaction: async (callback: any) => callback(tx),
  };

  const service = new RegistrationService(prisma, { hash: async () => "scrypt:hashed" } as any);
  const result = await service.request(dto());

  assert.deepEqual(result, { registrationId: "registration-2", userId: "user-1", status: "PENDING_APPROVAL" });
  assert.equal(registrationQueries[0].status.not, "REJECTED");
  assert.equal(userUpdates[0].status, "PENDING_APPROVAL");
  assert.equal(userUpdates[0].displayName, "PC Example");
  assert.equal(membershipCreates[0].userId, "user-1");
  assert.equal(membershipCreates[0].storeId, "correct-store");
  assert.equal(membershipCreates[0].status, "PENDING_APPROVAL");
});

void test("a rejected user can resubmit to the same store without violating the membership unique key", async () => {
  let membershipCreates = 0;
  const membershipUpdates: any[] = [];

  const tx: any = {
    registrationRequest: {
      create: async ({ data }: any) => ({ id: "registration-2", ...data }),
      update: async ({ data }: any) => ({ id: "registration-2", ...data }),
    },
    user: { updateMany: async () => ({ count: 1 }) },
    userStoreMembership: {
      findUnique: async () => ({ id: "membership-1", status: "REJECTED" }),
      create: async () => {
        membershipCreates += 1;
        return { id: "unexpected" };
      },
      updateMany: async ({ data }: any) => {
        membershipUpdates.push(data);
        return { count: 1 };
      },
    },
  };

  const prisma: any = {
    store: { findUnique: async () => ({ id: "correct-store", isActive: true, archivedAt: null }) },
    user: {
      findUnique: async () => ({ id: "user-1", status: "REJECTED", role: "VIEWER" }),
      findFirst: async () => null,
    },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback(tx),
  };

  const service = new RegistrationService(prisma, { hash: async () => "scrypt:hashed" } as any);
  const result = await service.request(dto());

  assert.equal(result.userId, "user-1");
  assert.equal(membershipCreates, 0);
  assert.equal(membershipUpdates[0].status, "PENDING_APPROVAL");
  assert.equal(membershipUpdates[0].approvedAt, null);
  assert.equal(membershipUpdates[0].approvedById, null);
});
