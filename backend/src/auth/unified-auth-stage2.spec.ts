import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { MobileOtpPurpose, SessionType, UserRole, UserStatus } from "@prisma/client";
import { AuthService } from "./auth.service";
import { MobileAuthService } from "./mobile-auth.service";
import { buildPermissionContext, hasWorkspaceAccess } from "./permission-context";
import { RegistrationService } from "./registration.service";
import { StoreAccessService } from "./store-access.service";

void test("persisted platform grants override Stage 1 compatibility defaults", () => {
  const context = buildPermissionContext({
    role: UserRole.VIEWER,
    canAccessWeb: false,
    canAccessMobile: true,
    memberships: [{ storeId: "store-1", role: "STAFF" }],
  });

  assert.equal(context.version, 2);
  assert.deepEqual(context.platforms, { web: false, mobile: true });
  assert.equal(context.workspaces.store, true);
});

void test("HQ viewer can have a workspace without a Store membership", () => {
  const context = buildPermissionContext({
    role: UserRole.VIEWER,
    canAccessHq: true,
    canAccessWeb: true,
    canAccessMobile: true,
  });

  assert.equal(context.workspaces.hq, true);
  assert.equal(context.workspaces.store, false);
  assert.equal(hasWorkspaceAccess(context), true);
});

void test("correct Web credentials return WEB_ACCESS_NOT_GRANTED when Web access is disabled", async () => {
  const prisma: any = {
    user: {
      findFirst: async () => ({
        id: "user-1",
        email: "hq@example.test",
        displayName: "HQ",
        role: "VIEWER",
        status: "ACTIVE",
        isActive: true,
        passwordHash: "hash",
        canAccessWeb: false,
        canAccessMobile: true,
        canAccessHq: true,
        memberships: [],
      }),
    },
  };
  const service = new AuthService(prisma, { verify: async () => true } as any);

  await assert.rejects(
    () => service.login("hq@example.test", "correct-password", SessionType.WEB),
    (error: unknown) => error instanceof ForbiddenException && (error.getResponse() as any).code === "WEB_ACCESS_NOT_GRANTED",
  );
});

void test("one User can create separate Web and Mobile sessions with the same credentials", async () => {
  const sessionTypes: SessionType[] = [];
  const user = {
    id: "user-1",
    email: "both@example.test",
    displayName: "Both",
    role: "VIEWER",
    status: "ACTIVE",
    isActive: true,
    passwordHash: "hash",
    canAccessWeb: true,
    canAccessMobile: true,
    memberships: [{ id: "membership-1", storeId: "store-1", role: "STORE_MANAGER", store: { id: "store-1", name: "Store 1", code: "S1" } }],
  };
  const prisma: any = {
    user: {
      findFirst: async () => user,
      update: async () => ({}),
    },
    session: {
      create: async ({ data }: any) => { sessionTypes.push(data.sessionType); return {}; },
    },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  };
  const service = new AuthService(prisma, { verify: async () => true } as any);

  const web = await service.login(user.email, "same-password", SessionType.WEB);
  const mobile = await service.login(user.email, "same-password", SessionType.MOBILE);

  assert.equal(web.user.id, mobile.user.id);
  assert.deepEqual(sessionTypes, [SessionType.WEB, SessionType.MOBILE]);
});

void test("existing Mobile session stops authenticating after Mobile access is revoked", async () => {
  const prisma: any = {
    session: {
      findUnique: async () => ({
        sessionType: SessionType.MOBILE,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-1",
          email: "hq@example.test",
          displayName: "HQ",
          role: "VIEWER",
          status: "ACTIVE",
          isActive: true,
          canAccessWeb: true,
          canAccessMobile: false,
          canAccessHq: true,
          memberships: [],
        },
      }),
    },
  };
  const service = new AuthService(prisma, {} as any);

  assert.equal(await service.authenticate("mobile-token", SessionType.MOBILE), null);
});

void test("HQ user without Store membership can complete Mobile OTP when Mobile access is granted", async () => {
  const challenge = {
    id: "otp-1",
    userId: "hq-1",
    purpose: MobileOtpPurpose.BM_STAFF_LOGIN,
    codeHash: "hash",
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
  };
  let createdSessionType: SessionType | undefined;
  const tx: any = {
    otpChallenge: { findUnique: async () => challenge },
    user: {
      findUnique: async () => ({
        id: "hq-1",
        role: UserRole.VIEWER,
        isActive: true,
        status: UserStatus.ACTIVE,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        memberships: [],
      }),
    },
  };
  const prisma: any = { $transaction: async (callback: any) => callback(tx) };
  const service = new MobileAuthService(
    prisma,
    { verify: async () => undefined } as any,
    { createSession: async (_id: string, type: SessionType) => { createdSessionType = type; return { token: "token", expiresAt: new Date() }; } } as any,
    { sendSms: async () => ({ status: "SENT" as const }) },
  );

  const result = await service.verifyOtp("otp-1", "123456");
  assert.equal(result.accessToken, "token");
  assert.equal(createdSessionType, SessionType.MOBILE);
});

void test("all-store scope is independent from ADMIN role and reply capability controls writes", async () => {
  const allStoreUser: any = {
    id: "hq-viewer",
    email: "hq@example.test",
    displayName: "HQ Viewer",
    role: UserRole.VIEWER,
    isActive: true,
    authorization: buildPermissionContext({
      role: UserRole.VIEWER,
      canAccessHq: true,
      canAccessAllStores: true,
      canReply: false,
    }),
  };
  const service = new StoreAccessService({} as any);

  assert.equal(await service.accessibleStoreIds(allStoreUser), null);
  assert.equal(await service.canWriteAsStoreUser(allStoreUser), false);
});

void test("Store registration creates one cross-platform pending User and approval enables reply", async () => {
  const userCreates: any[] = [];
  const userUpdates: any[] = [];
  const request = { id: "registration-1", storeId: "store-1", createdUserId: "user-1", status: "PENDING_APPROVAL" };
  const tx: any = {
    registrationRequest: {
      create: async ({ data }: any) => ({ id: "registration-1", ...data }),
      update: async () => undefined,
      findUnique: async () => request,
      updateMany: async () => ({ count: 1 }),
    },
    user: {
      create: async ({ data }: any) => { userCreates.push(data); return { id: "user-1", ...data }; },
      updateMany: async ({ data }: any) => { userUpdates.push(data); return { count: 1 }; },
    },
    userStoreMembership: {
      create: async () => ({ id: "membership-1" }),
      findUnique: async () => ({
        id: "membership-1",
        status: "PENDING_APPROVAL",
        role: "STAFF",
        user: { email: "pc@example.test", displayName: "PC" },
        store: { name: "Store 1" },
      }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: { findUnique: async () => null, findFirst: async () => null },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback(tx),
  };
  const service = new RegistrationService(prisma, { hash: async () => "hash" } as any, undefined, undefined, { sendAccountApproved: async () => undefined } as any);

  await service.request({ storeId: "store-1", email: "pc@example.test", name: "PC", employeeId: "EMP-1", role: "STAFF", password: "Strong-password-1234!" });
  await service.approve("registration-1", "admin-1");

  assert.equal(userCreates[0].canAccessWeb, true);
  assert.equal(userCreates[0].canAccessMobile, true);
  assert.equal(userCreates[0].canReply, false);
  assert.equal(userUpdates[0].canReply, true);
});
