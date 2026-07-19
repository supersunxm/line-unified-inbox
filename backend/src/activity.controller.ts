import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("activity")
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("recent") recent(@Query("limit") limit?: string) {
    return this.prisma.activityHistory.findMany({ take: Math.min(Math.max(Number(limit) || 10, 1), 100), orderBy: { createdAt: "desc" }, include: { conversation: { include: { customer: true, store: true } } } });
  }
}
