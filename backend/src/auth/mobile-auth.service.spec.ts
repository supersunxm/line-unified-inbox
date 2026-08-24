import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { MobileOtpPurpose, SessionType } from "@prisma/client";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MobileAuthService } from "./mobile-auth.service";

function mobileUser(overrides: Record<string, unknown> = {}) {
  return { id: "user-1", isActive: true, status: "ACTIVE", memberships: [{ id: "membership-1" }], ...overrides };
}

void test("active BM creates a MOBILE session after valid OTP verification", async () => {
  const challenge = { id: "otp-1", userId: "user-1", purpose: MobileOtpPurpose.BM_STAFF_LOGIN, codeHash: "hash", expiresAt: new Date(Date.now() + 60_000), attempts: 0, maxAttempts: 5, consumedAt: null };
  let sessionType: SessionType | undefined;
  const tx: any = {
    otpChallenge: { findUnique: async () => challenge },
    user: { findUnique: async () => mobileUser() },
  };
  const prisma: any = { $transaction: async (callback: any) => callback(tx) };
  const otp: any = { verify: async () => undefined };
  const auth: any = { createSession: async (_userId: string, type: SessionType) => { sessionType = type; return { token: "mobile-token", expiresAt: new Date("2026-08-12T00:00:00Z") }; } };
  const service = new MobileAuthService(prisma, otp, auth, { sendSms: async () => ({ status: "SENT" as const }) });
  const result = await service.verifyOtp("otp-1", "123456");
  assert.equal(result.accessToken, "mobile-token");
  assert.equal(sessionType, SessionType.MOBILE);
});

void test("pending, rejected, and suspended users cannot complete mobile login", async () => {
  for (const user of [
    mobileUser({ memberships: [] }),
    mobileUser({ status: "REJECTED" }),
    mobileUser({ isActive: false }),
  ]) {
    const challenge = { id: "otp-1", userId: "user-1", purpose: MobileOtpPurpose.BM_STAFF_LOGIN, codeHash: "hash", expiresAt: new Date(Date.now() + 60_000), attempts: 0, maxAttempts: 5, consumedAt: null };
    const prisma: any = { $transaction: async (callback: any) => callback({ otpChallenge: { findUnique: async () => challenge }, user: { findUnique: async () => user } }) };
    const service = new MobileAuthService(prisma, { verify: async () => undefined } as any, { createSession: async () => { throw new Error("must not create session"); } } as any, { sendSms: async () => ({ status: "SENT" as const }) });
    await assert.rejects(() => service.verifyOtp("otp-1", "123456"), UnauthorizedException);
  }
});

void test("an inactive account cannot start a new mobile login challenge", async () => {
  let challengeInput: any;
  const prisma: any = {
    user: { findUnique: async () => mobileUser({ isActive: false }) },
    $transaction: async (callback: any) => callback({
      otpChallenge: { create: async () => ({ id: "challenge-1", expiresAt: new Date(Date.now() + 60_000) }) },
    }),
  };
  const otp: any = { create: async (_tx: unknown, input: any) => { challengeInput = input; return { challenge: { id: "challenge-1", expiresAt: new Date(Date.now() + 60_000) }, code: "123456" }; } };
  const service = new MobileAuthService(prisma, otp, {} as any, { sendSms: async () => ({ status: "SENT" as const }) });
  await service.sendOtp("0812345678");
  assert.equal(challengeInput.userId, undefined);
});

void test("wrong or expired OTP and duplicate verification do not create additional sessions", async () => {
  let sessionCount = 0;
  const challenge = { id: "otp-1", userId: "user-1", purpose: MobileOtpPurpose.BM_STAFF_LOGIN, codeHash: "hash", expiresAt: new Date(Date.now() + 60_000), attempts: 0, maxAttempts: 5, consumedAt: null };
  const prisma: any = { $transaction: async (callback: any) => callback({ otpChallenge: { findUnique: async () => challenge }, user: { findUnique: async () => mobileUser() } }) };
  const otp: any = { verify: async () => { if (challenge.consumedAt) throw new UnauthorizedException("Verification code is invalid or expired"); challenge.consumedAt = new Date(); } };
  const service = new MobileAuthService(prisma, otp, { createSession: async () => ({ token: `token-${++sessionCount}`, expiresAt: new Date() }) } as any, { sendSms: async () => ({ status: "SENT" as const }) });
  await service.verifyOtp("otp-1", "123456");
  await assert.rejects(() => service.verifyOtp("otp-1", "123456"), UnauthorizedException);
  assert.equal(sessionCount, 1);
  otp.verify = async () => { throw new UnauthorizedException("Verification code is invalid or expired"); };
  await assert.rejects(() => service.verifyOtp("otp-1", "000000"), UnauthorizedException);
});

void test("/auth/me returns the authenticated mobile profile and mobile logout deletes only MOBILE sessions", async () => {
  const profile = { id: "user-1", role: "VIEWER", memberships: [{ role: "STORE_MANAGER", store: { id: "store-1", name: "Store", code: "S1" } }] };
  const controller = new AuthController({ logoutMobile: async () => undefined } as any, {} as any, {} as any);
  assert.deepEqual(controller.me({ user: profile } as any), profile);

  let where: unknown;
  const auth = new AuthService({ session: { findUnique: async () => ({ userId: "user-1", sessionType: SessionType.MOBILE }), deleteMany: async ({ where: input }: { where: unknown }) => { where = input; return { count: 1 }; } } } as any, {} as any);
  await auth.logoutMobile("raw-mobile-token");
  assert.deepEqual(where, { tokenHash: "9cc397051db4237fd137a88ccd967f118ffed74f8361d1b7ecd98bfc0bcefd86", sessionType: SessionType.MOBILE });
});
