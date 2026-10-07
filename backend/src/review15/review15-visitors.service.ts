import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";

export const REVIEW15_VISITOR_PAGE_KEY = "review15";

export type Review15VisitorCount = {
  totalVisitors: number;
  approximate: true;
};

export function hashReview15VisitorId(visitorId: string): string {
  return createHash("sha256")
    .update(REVIEW15_VISITOR_PAGE_KEY + ":" + visitorId)
    .digest("hex");
}

@Injectable()
export class Review15VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordVisitor(visitorId: string): Promise<Review15VisitorCount> {
    const visitorHash = hashReview15VisitorId(visitorId);

    await this.prisma.publicPageVisitor.upsert({
      where: {
        pageKey_visitorHash: {
          pageKey: REVIEW15_VISITOR_PAGE_KEY,
          visitorHash,
        },
      },
      create: {
        pageKey: REVIEW15_VISITOR_PAGE_KEY,
        visitorHash,
      },
      update: {
        lastSeenAt: new Date(),
      },
    });

    const totalVisitors = await this.prisma.publicPageVisitor.count({
      where: {
        pageKey: REVIEW15_VISITOR_PAGE_KEY,
      },
    });

    return {
      totalVisitors,
      approximate: true,
    };
  }
}
