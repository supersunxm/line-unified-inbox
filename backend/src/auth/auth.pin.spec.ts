import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import { SessionType } from "@prisma/client";
import { AuthService } from "./auth.service";
import { MobilePinLoginDto } from "./mobile-auth.dto";
import { PasswordService } from "./password.service";
import { validate } from "class-validator";

const passwordService = new PasswordService();

async function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "staff@example.test",
    normalizedEmail: "staff@example.test",
    username: "staff",
    displayName: "Staff",
    role: "VIEWER",
    isActive: true,
    status: "ACTIVE",
    canAccessMobile: true,
    canAccessWeb: true,
    canAccessHq: false,
    canAccessAllStores: false,
    canManageAccounts: false,
    canReply: true,
    canAccessMainOa: false,
    canManageMainOa: false,
    employeeId: "12345678",
    passwordHash: await passwordService.hash("Password@123"),
    pinHash: await passwordService.hash("123456"),
    pinEnabled: true,
    pinFailedAttempts: 0,
    pinLockedUntil: null,
    pinUpdatedAt: null,
    memberships: [{ id: "membership-1", storeId: "store-1", role: "STAFF", store: { id: "store-1", name: "Store 1", code: "S1" } }],
    ...overrides,
  };
}

function makePrisma(user: any) {
  const sessionTypes: string[] = [];
  const updates: Record<string, unknown>[] = [];
  const prisma: any = {
    user: {
      findFirst: async () => user,
      findUnique: async () => user,
      update: async ({ data }: any) => {
        Object.assign(user, data);
        updates.push(data);
        return user;
      },
      updateMany: async ({ where, data }: any) => {
        if (where.id !== user.id || where.pinFailedAttempts !== user.pinFailedAttempts || where.pinLockedUntil !== user.pinLockedUntil) return { count: 0 };
        Object.assign(user, data);
        updates.push(data);
        return { count: 1 };
      },
    },
    session: {
      create: async ({ data }: any) => {
        sessionTypes.push(data.sessionType);
        return data;
      },
    },
    $transaction: async (writes: Promise<unknown>[]) => Promise.all(writes),
  };
  return { prisma, sessionTypes, updates };
}

function responseCode(error: unknown) {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();
  return typeof response === "string" ? response : (response as { code?: string }).code;
}

test("PIN migration leaves existing users disabled and without a hash", () => {
  const migration = readFileSync(new URL("../../prisma/migrations/20260915110000_add_user_pin_auth/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN "pinHash" TEXT/);
  assert.match(migration, /"pinEnabled" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /"pinFailedAttempts" INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /"pinLockedUntil" TIMESTAMP\(3\)/);
});

test("PIN DTO validation accepts only exactly six numeric digits", async () => {
  const valid = Object.assign(new MobilePinLoginDto(), { employeeId: "12345678", pin: "246810" });
  const invalid = Object.assign(new MobilePinLoginDto(), { employeeId: "12345678", pin: "24681a" });
  assert.deepEqual(await validate(valid), []);
  assert.ok((await validate(invalid)).length > 0);
});

test("PIN setup hashes the PIN and never returns the hash", async () => {
  const user = await makeUser({ pinHash: null, pinEnabled: false });
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);
  const result = await service.setupPin(user.id, "246810", "246810");

  assert.deepEqual(result, { success: true, pinEnabled: true });
  assert.equal(user.pinEnabled, true);
  assert.notEqual(user.pinHash, "246810");
  assert.equal(await passwordService.verify("246810", user.pinHash), true);
  assert.equal("pinHash" in result, false);
});

test("PIN confirmation mismatch does not write a credential", async () => {
  const user = await makeUser({ pinHash: null, pinEnabled: false });
  const { prisma, updates } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  await assert.rejects(() => service.setupPin(user.id, "246810", "246811"), (error) => responseCode(error) === "PIN_MISMATCH");
  assert.equal(updates.length, 0);
  assert.equal(user.pinHash, null);
});

test("correct employee-ID PIN login issues the canonical mobile session", async () => {
  const user = await makeUser();
  const { prisma, sessionTypes } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);
  const result = await service.loginWithPin("12345678", "123456");

  assert.ok(result.accessToken);
  assert.ok(result.refreshToken);
  assert.deepEqual(sessionTypes, ["MOBILE"]);
});

test("five incorrect PIN attempts lock PIN login, then expiry permits retry", async () => {
  const user = await makeUser();
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(() => service.loginWithPin("12345678", "000000"), (error) => responseCode(error) === "INVALID_PIN");
  }
  await assert.rejects(() => service.loginWithPin("12345678", "000000"), (error) => responseCode(error) === "PIN_LOCKED");
  assert.equal(user.pinFailedAttempts, 5);
  assert.ok(user.pinLockedUntil instanceof Date && user.pinLockedUntil > new Date());

  user.pinLockedUntil = new Date(Date.now() - 1_000);
  await assert.rejects(() => service.loginWithPin("12345678", "000000"), (error) => responseCode(error) === "INVALID_PIN");
  assert.equal(user.pinFailedAttempts, 1);
});

test("password login remains available during PIN lockout and clears PIN failures", async () => {
  const user = await makeUser({ pinFailedAttempts: 5, pinLockedUntil: new Date(Date.now() + 60_000) });
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);
  const result = await service.login("12345678", "Password@123", SessionType.MOBILE);

  assert.ok(result.token);
  assert.equal(user.pinFailedAttempts, 0);
  assert.equal(user.pinLockedUntil, null);
});

test("disabled employees cannot use PIN login", async () => {
  const user = await makeUser({ isActive: false });
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  await assert.rejects(() => service.loginWithPin("12345678", "123456"), (error) => error instanceof UnauthorizedException && responseCode(error) === "INVALID_PIN_CREDENTIALS");
});

test("users without a PIN receive the same generic credential failure", async () => {
  const user = await makeUser({ pinHash: null, pinEnabled: false });
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  await assert.rejects(() => service.loginWithPin("12345678", "123456"), (error) => responseCode(error) === "INVALID_PIN_CREDENTIALS");
});

test("change and reset invalidate the previous PIN", async () => {
  const user = await makeUser();
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  await service.changePin(user.id, "123456", undefined, "654321", "654321");
  await assert.rejects(() => service.loginWithPin("12345678", "123456"), (error) => responseCode(error) === "INVALID_PIN");
  await service.loginWithPin("12345678", "654321");

  await service.resetPin(user.id, "Password@123", "112233", "112233");
  await assert.rejects(() => service.loginWithPin("12345678", "654321"), (error) => responseCode(error) === "INVALID_PIN");
  await service.loginWithPin("12345678", "112233");
});

test("disabling PIN requires the password and clears the hash", async () => {
  const user = await makeUser();
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);

  await assert.rejects(() => service.disablePin(user.id, "wrong-password"), (error) => responseCode(error) === "INVALID_CREDENTIALS");
  await service.disablePin(user.id, "Password@123");
  assert.equal(user.pinHash, null);
  assert.equal(user.pinEnabled, false);
});

test("safe authenticated user data exposes PIN status but never pinHash", async () => {
  const user = await makeUser();
  const { prisma } = makePrisma(user);
  const service = new AuthService(prisma, passwordService);
  const result = await service.login("staff@example.test", "Password@123", SessionType.MOBILE);

  assert.equal(result.user.pinEnabled, true);
  assert.equal("pinHash" in result.user, false);
});
