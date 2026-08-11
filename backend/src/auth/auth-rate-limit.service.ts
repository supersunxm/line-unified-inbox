import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLoginAllowed(ip: string, email: string) {
    await this.assertAllowed(`login:${ip}:${email.trim().toLowerCase()}`, 5, 15 * 60_000);
  }

  async recordLoginFailure(ip: string, email: string) {
    await this.consume(`login:${ip}:${email.trim().toLowerCase()}`, 5, 15 * 60_000);
  }

  async consumeRegistration(ip: string) {
    await this.consume(`registration:${ip}`, 10, 60 * 60_000);
  }

  private async assertAllowed(key: string, limit: number, windowMs: number) {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const bucket = await this.prisma.authRateLimitBucket.findUnique({ where: { key_windowStart: { key, windowStart } } });
    if (bucket && bucket.count >= limit) throw new HttpException("Too many requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
  }

  private async consume(key: string, limit: number, windowMs: number) {
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const updated = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "AuthRateLimitBucket" ("id", "key", "windowStart", "count", "updatedAt")
      VALUES (gen_random_uuid(), ${key}, ${windowStart}, 1, NOW())
      ON CONFLICT ("key", "windowStart") DO UPDATE
      SET "count" = "AuthRateLimitBucket"."count" + 1,
          "updatedAt" = NOW()
      WHERE "AuthRateLimitBucket"."count" < ${limit}
      RETURNING "count";
    `;
    if (!updated.length) throw new HttpException("Too many requests. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
  }
}
