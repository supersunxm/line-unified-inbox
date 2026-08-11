import assert from "node:assert/strict";
import test from "node:test";
import { DevelopmentSmsProvider } from "./development-sms.provider";
import { MobileAuthService } from "./mobile-auth.service";

void test("mobile OTP calls the SMS provider after challenge creation", async () => {
  const events: string[] = [];
  const prisma: any = {
    user: { findUnique: async () => ({ id: "user-1", isActive: true, status: "ACTIVE", memberships: [{ id: "membership-1" }] }) },
    $transaction: async (callback: any) => callback({}),
  };
  const otp = { create: async () => { events.push("challenge"); return { challenge: { id: "otp-1", expiresAt: new Date() }, code: "123456" }; } } as any;
  const sms = { sendSms: async () => { events.push("sms"); return { status: "SENT" as const }; } };
  const service = new MobileAuthService(prisma, otp, {} as any, sms);
  const result = await service.sendOtp("0812345678");
  assert.equal(result.delivery, "SENT");
  assert.deepEqual(events, ["challenge", "sms"]);
});

void test("mobile OTP converts provider errors into a failed delivery status", async () => {
  const prisma: any = {
    user: { findUnique: async () => ({ id: "user-1", isActive: true, status: "ACTIVE", memberships: [{ id: "membership-1" }] }) },
    $transaction: async (callback: any) => callback({}),
  };
  const otp = { create: async () => ({ challenge: { id: "otp-1", expiresAt: new Date() }, code: "123456" }) } as any;
  const sms = { sendSms: async () => { throw new Error("provider timeout"); } };
  const service = new MobileAuthService(prisma, otp, {} as any, sms);
  const result = await service.sendOtp("0812345678");
  assert.equal(result.delivery, "FAILED");
});

void test("development SMS provider never logs OTP in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDebug = process.env.OTP_DEBUG;
  const previousLog = console.log;
  const logs: unknown[] = [];
  process.env.NODE_ENV = "production";
  process.env.OTP_DEBUG = "true";
  console.log = (...args: unknown[]) => logs.push(args);
  try {
    const result = await new DevelopmentSmsProvider().sendSms("+66812345678", "OTP 123456");
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(logs.length, 0);
  } finally {
    console.log = previousLog;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDebug === undefined) delete process.env.OTP_DEBUG; else process.env.OTP_DEBUG = previousDebug;
  }
});
