import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "./auth/auth.guard";
import { PurchaseAnalyticsQueryDto } from "./purchase-analytics.dto";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";

/** Authenticated store-scoped purchase intelligence; ADMIN receives global scope. */
@Controller("admin/purchase-analytics")
export class PurchaseAnalyticsController {
  constructor(private readonly analytics: PurchaseAnalyticsService) {}

  @Get()
  get(@Req() request: AuthRequest, @Query() query: PurchaseAnalyticsQueryDto) {
    return this.analytics.get(request.user!, query);
  }

  @Get("audience")
  getAudience(@Req() request: AuthRequest, @Query() query: PurchaseAnalyticsQueryDto) {
    return this.analytics.getAudience(request.user!, query);
  }
}
