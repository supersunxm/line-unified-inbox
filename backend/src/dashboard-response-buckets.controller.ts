import { BadRequestException, Controller, ForbiddenException, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { PrismaService } from "./prisma.service";

type ResponseBucket = "under4h" | "between4and12h" | "between12and24h" | "over24h";

const RESPONSE_BUCKETS = new Set<ResponseBucket>([
  "under4h",
  "between4and12h",
  "between12and24h",
  "over24h",
]);

function parseIsoDate(value: string, field: string): [number, number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return [year, month, day];
}

function bangkokMidnightUtc(value: string): Date {
  const [year, month, day] = parseIsoDate(value, "date");
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function matchesBucket(durationMinutes: number, bucket: ResponseBucket): boolean {
  if (bucket === "under4h") return durationMinutes < 240;
  if (bucket === "between4and12h") return durationMinutes >= 240 && durationMinutes < 720;
  if (bucket === "between12and24h") return durationMinutes >= 720 && durationMinutes < 1440;
  return durationMinutes >= 1440;
}

@Controller("dashboard")
export class DashboardResponseBucketsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  @Get("response-bucket-details")
  async getResponseBucketDetails(
    @Query("bucket") rawBucket?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("limit") rawLimit?: string,
    @Req() req?: AuthRequest,
  ) {
    const user = req?.user;
    if (!user) throw new ForbiddenException("Authentication required");
    if (!rawBucket || !RESPONSE_BUCKETS.has(rawBucket as ResponseBucket)) {
      throw new BadRequestException("bucket must be one of under4h, between4and12h, between12and24h, over24h");
    }
    if (!dateFrom || !dateTo) {
      throw new BadRequestException("dateFrom and dateTo are required");
    }

    const fromParts = parseIsoDate(dateFrom, "dateFrom");
    const toParts = parseIsoDate(dateTo, "dateTo");
    const fromCalendar = Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2]);
    const toCalendar = Date.UTC(toParts[0], toParts[1] - 1, toParts[2]);
    if (fromCalendar > toCalendar) throw new BadRequestException("dateFrom must not be after dateTo");
    const days = Math.floor((toCalendar - fromCalendar) / 86_400_000) + 1;
    if (days > 90) throw new BadRequestException("Dashboard date range cannot exceed 90 days");

    const startDate = bangkokMidnightUtc(dateFrom);
    const endDateExclusive = bangkokMidnightUtc(dateTo);
    endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const storeFilter = accessibleStoreIds === null ? undefined : { in: accessibleStoreIds };
    const limit = Math.min(200, Math.max(1, Number.parseInt(rawLimit ?? "100", 10) || 100));
    const bucket = rawBucket as ResponseBucket;

    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...(storeFilter ? { storeId: storeFilter } : {}),
        lineOfficialAccount: { accountType: "STORE" },
        createdAt: { gte: startDate, lt: endDateExclusive },
      },
      select: {
        id: true,
        storeId: true,
        createdAt: true,
        customer: { select: { displayName: true } },
        store: { select: { name: true } },
        messages: {
          select: {
            direction: true,
            originalText: true,
            sentAt: true,
          },
          orderBy: { sentAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const matched = conversations.flatMap((conversation) => {
      const firstInbound = conversation.messages.find((message) => message.direction === "INBOUND");
      const firstOutbound = conversation.messages.find((message) => message.direction === "OUTBOUND");
      const startTime = firstInbound ? new Date(firstInbound.sentAt).getTime() : new Date(conversation.createdAt).getTime();
      if (!firstOutbound) return [];
      const endTime = new Date(firstOutbound.sentAt).getTime();
      if (endTime < startTime) return [];
      const responseMinutes = Math.floor((endTime - startTime) / 60_000);
      if (!matchesBucket(responseMinutes, bucket)) return [];

      return [{
        conversationId: conversation.id,
        storeId: conversation.storeId,
        storeName: conversation.store?.name ?? "ไม่ระบุร้าน",
        customerName: conversation.customer.displayName || "ลูกค้า LINE",
        inboundText: firstInbound?.originalText?.trim() || "(ไม่มีข้อความตัวอักษร)",
        firstInboundAt: firstInbound?.sentAt?.toISOString() ?? conversation.createdAt.toISOString(),
        firstOutboundAt: firstOutbound.sentAt.toISOString(),
        responseMinutes,
      }];
    });

    return {
      bucket,
      dateFrom,
      dateTo,
      total: matched.length,
      shown: Math.min(limit, matched.length),
      items: matched.slice(0, limit),
    };
  }
}
