import assert from "node:assert/strict";
import test from "node:test";
import { HttpException, UnauthorizedException } from "@nestjs/common";
import { MobileOtpPurpose } from "@prisma/client";
import { OtpChallengeService } from "./otp-challenge.service";

function clientFor(challenge: Record<string, unknown> = {}) {
  const value: Record<string, any> = { id: "otp-1", codeHash: "", expiresAt: new Date(Date.now() + 60_000), attempts: 0, maxAttempts: 2, consumedAt: null, ...challenge };
  const client = { otpChallenge: {
    create: async () => value,
    update: async ({ data }: { data: Record<string, any> }) => { if (data.attempts?.increment) value.attempts += data.attempts.increment; else Object.assign(value, data); return value; },
  } } as any;
  return { client, value };
}

void test("stores only a hash and rejects invalid, expired, and exhausted OTP challenges", async () => {
  const otp = new OtpChallengeService(() => "123456");
  const { client, value } = clientFor();
  await otp.create(client, { normalizedPhone: "+66812345678", purpose: MobileOtpPurpose.BM_STAFF_REGISTRATION });
  assert.notEqual(value.codeHash, "123456");
  await assert.rejects(() => otp.verify(client, value as any, "000000"), UnauthorizedException);
  await assert.rejects(() => otp.verify(client, value as any, "000000"), UnauthorizedException);
  await assert.rejects(() => otp.verify(client, value as any, "123456"), HttpException);
  const expired = clientFor({ expiresAt: new Date(Date.now() - 1) });
  await otp.create(expired.client, { normalizedPhone: "+66812345678", purpose: MobileOtpPurpose.BM_STAFF_REGISTRATION });
  expired.value.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => otp.verify(expired.client, expired.value as any, "123456"), UnauthorizedException);
});
