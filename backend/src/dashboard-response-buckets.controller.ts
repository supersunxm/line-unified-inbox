import { BadRequestException, Controller, ForbiddenException, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "./auth/auth.guard";
import { HistoricalTimelineService } from "./historical-timeline.service";

type ResponseBucket = "under4h" | "between4and12h" | "between12and24h" | "over24h";

const RESPONSE_BUCKETS = new Set<ResponseBucket>([
  "under4h",
  "between4and12h",
  "between12and24h",
  "over24h",
]);

@Controller("dashboard")
export class DashboardResponseBucketsController {
  constructor(
    private readonly historicalTimeline: HistoricalTimelineService,
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

    return this.historicalTimeline.responseBucketDetails(user, {
      bucket: rawBucket as ResponseBucket,
      dateFrom,
      dateTo,
      limit: Number.parseInt(rawLimit ?? "100", 10) || 100,
    });
  }

  @Get("store-24h-response-summary")
  async getStore24hResponseSummary(
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Req() req?: AuthRequest,
  ) {
    const user = req?.user;
    if (!user) throw new ForbiddenException("Authentication required");
    return this.historicalTimeline.replyAnalytics(user, { dateFrom, dateTo });
  }
}
