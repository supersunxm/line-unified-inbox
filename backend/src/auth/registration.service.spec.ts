import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { OtpChallengeService } from "./otp-challenge.service";
import { RegistrationService } from "./registration.service";

function requestDto() {
  return { storeId: "store-1", email: "bm@example.test", phone: "0812345678", firstName: "Bee", lastName: "Manager", employeeId: "OP1", position: "BM", requestedRole: "STORE_MANAGER" as const };
}

void test("creates a valid registration request and rejects unavailable stores or duplicate phones", async () => {
  const created: Record<string, any> = {};
  const prisma: any = {
    store: { findUnique: async () => ({ id: "store-1", isActive: true, archivedAt: null }) },
    user: { findUnique: async () => null },
    registrationRequest: { findFirst: async () => null },
    $transaction: async (callback: any) => callback({
      registrationRequest: { create: async ({ data }: any) => Object.assign(created, { id: "registration-1" }, data) },
      otpChallenge: { create: async () => ({ id: "otp-1" }), update: async ({ data }: any) => ({ id: "otp-1", ...data, expiresAt: new Date() }) },
    }),
  };
  const service = new RegistrationService(prisma, new OtpChallengeService(() => "123456"));
  const result = await service.request(requestDto());
  assert.equal(result.registrationId, "registration-1");
  assert.equal(created.phone, "+66812345678");

  prisma.store.findUnique = async () => null;
  await assert.rejects(() => service.request(requestDto()), NotFoundException);
  prisma.store.findUnique = async () => ({ id: "store-1", isActive: true, archivedAt: null });
  prisma.user.findUnique = async () => ({ id: "user-1", isActive: true, status: "ACTIVE" });
  await assert.rejects(() => service.request(requestDto()), ConflictException);
});

void test("completes OTP verification once and returns the existing result on retry", async () => {
  const now = new Date(Date.now() + 60_000);
  const challenge: any = { id: "otp-1", codeHash: "", expiresAt: now, attempts: 0, maxAttempts: 5, consumedAt: null, createdAt: new Date() };
  const request: any = { id: "registration-1", status: "OTP_PENDING", phone: "+66812345678", email: "bm@example.test", normalizedEmail: "bm@example.test", firstName: "Bee", lastName: "Manager", employeeId: "OP1", position: "BM", requestedRole: "STORE_MANAGER", storeId: "store-1", expiresAt: now, createdUserId: null };
  const memberships: any[] = [];
  const otp = new OtpChallengeService(() => "123456");
  const client: any = {
    otpChallenge: { create: async () => challenge, update: async ({ data }: any) => { if (data.attempts?.increment) challenge.attempts += data.attempts.increment; else Object.assign(challenge, data); return challenge; }, findFirst: async () => challenge },
    registrationRequest: { findUnique: async () => request, update: async ({ data }: any) => Object.assign(request, data) },
    user: { findUnique: async () => request.createdUserId ? { id: request.createdUserId } : null, create: async () => ({ id: "user-1" }) },
    userStoreMembership: { create: async ({ data }: any) => { memberships.push({ id: "membership-1", ...data }); return memberships[0]; }, findFirst: async () => memberships[0] ?? null },
  };
  await otp.create(client, { registrationId: request.id, normalizedPhone: request.phone, purpose: "BM_STAFF_REGISTRATION" });
  const service = new RegistrationService({ $transaction: async (callback: any) => callback(client) } as any, otp);
  const completed = await service.verify(request.id, "123456");
  assert.equal(completed.userId, "user-1");
  assert.equal(memberships[0].status, "PENDING_APPROVAL");
  const retry = await service.verify(request.id, "123456");
  assert.equal(retry.userId, "user-1");
  assert.equal(memberships.length, 1);
});
