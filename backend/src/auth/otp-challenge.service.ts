import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { MobileOtpPurpose, Prisma } from "@prisma/client";

type OtpClient = Pick<Prisma.TransactionClient, "otpChallenge">;
export const OTP_CODE_GENERATOR = Symbol("OTP_CODE_GENERATOR");

@Injectable()
export class OtpChallengeService {
  constructor(@Inject(OTP_CODE_GENERATOR) private readonly codeGenerator: () => string) {}

  private hash(id: string, code: string) {
    const key = process.env.OTP_HASH_SECRET || process.env.LINE_CREDENTIAL_ENCRYPTION_KEY || "development-otp-hash-secret";
    return createHmac("sha256", key).update(`${id}:${code}`).digest("base64");
  }

  async create(client: OtpClient, input: { registrationId?: string; userId?: string; normalizedPhone: string; purpose: MobileOtpPurpose }) {
    const now = Date.now();
    const code = this.codeGenerator();
    const challenge = await client.otpChallenge.create({
      data: {
        registrationId: input.registrationId,
        userId: input.userId,
        normalizedPhone: input.normalizedPhone,
        purpose: input.purpose,
        codeHash: "pending",
        expiresAt: new Date(now + 10 * 60_000),
        resendAvailableAt: new Date(now + 60_000),
      },
    });
    const savedChallenge = await client.otpChallenge.update({ where: { id: challenge.id }, data: { codeHash: this.hash(challenge.id, code) } });
    const otpDebugEnabled = process.env.NODE_ENV !== "production" && process.env.RAILWAY_ENVIRONMENT_NAME !== "production" && process.env.RAILWAY_ENVIRONMENT !== "production" && process.env.OTP_DEBUG === "true";
    if (otpDebugEnabled) {
      console.log("[OTP_DEBUG]", { phone: input.normalizedPhone, challengeId: savedChallenge.id, otp: code, expiresAt: savedChallenge.expiresAt.toISOString(), purpose: input.purpose });
    }
    return { challenge: savedChallenge, code };
  }

  async verify(client: OtpClient, challenge: { id: string; codeHash: string; expiresAt: Date; attempts: number; maxAttempts: number; consumedAt: Date | null }, code: string) {
    if (challenge.consumedAt || challenge.expiresAt <= new Date()) throw new UnauthorizedException("Verification code is invalid or expired");
    if (challenge.attempts >= challenge.maxAttempts) throw new HttpException("Verification challenge is locked", HttpStatus.TOO_MANY_REQUESTS);
    const received = Buffer.from(this.hash(challenge.id, code));
    const expected = Buffer.from(challenge.codeHash);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      await client.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("Verification code is invalid or expired");
    }
    return client.otpChallenge.update({ where: { id: challenge.id }, data: { verifiedAt: new Date(), consumedAt: new Date() } });
  }
}
