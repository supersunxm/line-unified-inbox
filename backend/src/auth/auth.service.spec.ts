import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "./auth.service";
import { isPasswordPolicyCompliant } from "./password-policy";
import { PasswordService } from "./password.service";

void test("login rejects pending, rejected, and suspended users", async () => {
  for (const status of ["PENDING_APPROVAL", "REJECTED", "SUSPENDED"]) {
    const prisma: any = { user: { findFirst: async () => ({ id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", status, isActive: true, passwordHash: "hash", memberships: [{ id: "membership-1" }] }) } };
    const service = new AuthService(prisma, { verify: async () => true } as any);
    await assert.rejects(() => service.login("bm@example.test", "password"), (error: any) => error.response?.code === (status === "PENDING_APPROVAL" ? "ACCOUNT_PENDING_APPROVAL" : status === "REJECTED" ? "ACCOUNT_REJECTED" : "ACCOUNT_SUSPENDED"));
  }
});

void test("an inactive account cannot create a new web session", async () => {
  const prisma: any = { user: { findFirst: async () => ({ id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", status: "ACTIVE", isActive: false, passwordHash: "hash", memberships: [{ id: "membership-1" }] }) } };
  const service = new AuthService(prisma, { verify: async () => true } as any);
  await assert.rejects(() => service.login("bm@example.test", "password"), (error: any) => error.response?.code === "ACCOUNT_SUSPENDED");
});

void test("active user with an active membership can log in", async () => {
  const prisma: any = {
    user: { findFirst: async () => ({ id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", status: "ACTIVE", isActive: true, passwordHash: "hash", memberships: [{ id: "membership-1", storeId: "store-1", role: "STAFF", store: { id: "store-1", name: "Store 1", code: "S1" } }] }), update: async () => ({}) },
    session: { create: async () => ({}) },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  };
  const auditEntries: any[] = [];
  const result = await new AuthService(prisma, { verify: async () => true } as any, undefined, { record: async (entry: any) => auditEntries.push(entry) } as any).login("bm@example.test", "password");
  assert.equal(result.user.id, "user-1");
  assert.ok(result.token);
  assert.equal(auditEntries[0].action, "USER_LOGIN_SUCCESS");
});

void test("existing users with legacy passwords can still log in", async () => {
  const passwords = new PasswordService();
  const legacyHash = await passwords.hash("legacy-password");
  const prisma: any = {
    user: { findFirst: async () => ({ id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", status: "ACTIVE", isActive: true, passwordHash: legacyHash, memberships: [{ id: "membership-1", storeId: "store-1", role: "STAFF", store: { id: "store-1", name: "Store 1", code: "S1" } }] }), update: async () => ({}) },
    session: { create: async () => ({}) },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  };
  const result = await new AuthService(prisma, passwords).login("bm@example.test", "legacy-password");
  assert.equal(result.user.id, "user-1");
});

void test("failed login creates an audit record without exposing credentials", async () => {
  const auditEntries: any[] = [];
  const prisma: any = { user: { findFirst: async () => null } };
  const service = new AuthService(prisma, {} as any, undefined, { record: async (entry: any) => auditEntries.push(entry) } as any);
  await assert.rejects(() => service.login("missing@example.test", "secret-password"));
  assert.equal(auditEntries[0].action, "USER_LOGIN_FAILED");
  assert.equal("password" in auditEntries[0], false);
});

void test("status-based login rejection is audited with a safe reason", async () => {
  const auditEntries: any[] = [];
  const prisma: any = { user: { findFirst: async () => ({ id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", status: "SUSPENDED", isActive: true, passwordHash: "hash", memberships: [{ id: "membership-1" }] }) } };
  const service = new AuthService(prisma, { verify: async () => true } as any, undefined, { record: async (entry: any) => auditEntries.push(entry) } as any);
  await assert.rejects(() => service.login("bm@example.test", "password"));
  assert.deepEqual(auditEntries[0], { actorUserId: "user-1", action: "USER_LOGIN_REJECTED", metadata: { reason: "SUSPENDED" }, ipAddress: "unknown", userAgent: undefined });
});

void test("authenticated mobile profile includes stores, membership roles, and derived permissions", async () => {
  const rawToken = "mobile-token";
  const prisma = {
    session: {
      findUnique: async () => ({
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-1", email: "staff@example.test", displayName: "Staff", role: "VIEWER", isActive: true, status: "ACTIVE", phone: "+66812345678", firstName: "First", lastName: "Last", employeeId: "EMP-1", position: "PC",
          memberships: [{ id: "membership-1", storeId: "store-1", role: "STAFF", store: { id: "store-1", name: "Store 1", code: "S1" } }],
        },
      }),
    },
  };
  const result = await new AuthService(prisma as never, {} as never).authenticate(rawToken);
  assert.equal(result?.permissions?.canReply, true);
  assert.deepEqual(result?.permissions?.membershipRoles, ["STAFF"]);
  assert.deepEqual(result?.stores, [{ id: "store-1", name: "Store 1", code: "S1" }]);
  assert.deepEqual(result?.profile, { firstName: "First", lastName: "Last", employeeId: "EMP-1", position: "PC", phone: "+66812345678" });
});

void test("an existing session is rejected immediately after account deactivation", async () => {
  const prisma: any = {
    session: { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60_000), user: { id: "user-1", email: "bm@example.test", displayName: "BM", role: "VIEWER", isActive: false, status: "SUSPENDED", memberships: [] } }) },
  };
  const result = await new AuthService(prisma, {} as any).authenticate("existing-session-token");
  assert.equal(result, null);
});

void test("deleted credentials cannot create a session or authenticate an old session", async () => {
  const prisma: any = {
    user: { findFirst: async () => ({ id: "user-1", email: "deleted+user-1@deleted.lineoppo.invalid", displayName: "Deleted User", role: "VIEWER", isActive: false, status: "DELETED", passwordHash: null, memberships: [] }) },
    session: { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60_000), user: { id: "user-1", email: "deleted+user-1@deleted.lineoppo.invalid", displayName: "Deleted User", role: "VIEWER", isActive: false, status: "DELETED", memberships: [] } }) },
  };
  const service = new AuthService(prisma, { verify: async () => true } as any);
  await assert.rejects(() => service.login("deleted+user-1@deleted.lineoppo.invalid", "old-password"));
  assert.equal(await service.authenticate("old-session"), null);
});

void test("admin password reset stores only a hash, forces a change, expires sessions, and audits safely", async () => {
  const updates: any[] = [];
  const auditEntries: any[] = [];
  const tx: any = {
    user: {
      findFirst: async () => ({ id: "user-1" }),
      update: async ({ data }: any) => { updates.push(data); return data; },
    },
    session: { deleteMany: async ({ where }: any) => { updates.push({ sessionDelete: where }); return { count: 1 }; } },
  };
  const service = new AuthService({ $transaction: async (callback: any) => callback(tx) } as any, { hash: async (password: string) => `hash:${password}` } as any, undefined, { record: async (entry: any) => auditEntries.push(entry) } as any);
  const result = await service.resetPassword("user-1", "admin-1");
  assert.match(result.temporaryPassword, /[A-Z]/);
  assert.match(result.temporaryPassword, /[a-z]/);
  assert.match(result.temporaryPassword, /[0-9]/);
  assert.match(result.temporaryPassword, /[@#$%^&*]/);
  assert.ok(result.temporaryPassword.length >= 12);
  assert.equal(isPasswordPolicyCompliant(result.temporaryPassword), true);
  assert.equal(updates[0].mustChangePassword, true);
  assert.equal(updates[0].passwordHash.startsWith("hash:"), true);
  assert.equal(updates.some((entry) => entry.sessionDelete?.userId === "user-1"), true);
  assert.equal(auditEntries[0].action, "PASSWORD_RESET");
  assert.equal("temporaryPassword" in auditEntries[0], false);
});

void test("change password clears forced password-change state", async () => {
  const updates: any[] = [];
  const service = new AuthService(
    { user: {
      findUnique: async () => ({ id: "user-1", passwordHash: "old-hash" }),
      update: async ({ data }: any) => { updates.push(data); return data; },
    } } as any,
    { verify: async () => true, hash: async () => "new-hash" },
  );

  const result = await service.changePassword("user-1", "temporary-password", "NewPassword@123");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(updates, [{ passwordHash: "new-hash", mustChangePassword: false }]);
});

void test("change password rejects a weak replacement before hashing or updating", async () => {
  let hashed = false;
  let updated = false;
  const service = new AuthService(
    { user: {
      findUnique: async () => ({ id: "user-1", passwordHash: "old-hash" }),
      update: async () => { updated = true; },
    } } as any,
    { verify: async () => true, hash: async () => { hashed = true; return "new-hash"; } },
  );

  await assert.rejects(
    () => service.changePassword("user-1", "temporary-password", "weak-password-1"),
    (error: unknown) => (error as { response?: { code?: string } }).response?.code === "PASSWORD_POLICY_VIOLATION",
  );
  assert.equal(hashed, false);
  assert.equal(updated, false);
});
