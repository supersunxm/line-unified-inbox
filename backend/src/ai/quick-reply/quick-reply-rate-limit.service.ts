import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

const WINDOW_MS = 60_000;

@Injectable()
export class QuickReplyRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(userId: string, limit: number) {
    const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);
    const key = `quick-reply:${userId}`;
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
    return { count: updated[0]?.count ?? 1, limit, windowStart };
  }
}
