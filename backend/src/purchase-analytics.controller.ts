import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "./auth/auth.decorators";
import type { AuthRequest } from "./auth/auth.guard";
import { CreatePurchaseBroadcastDraftDto } from "./purchase-broadcast-audience.dto";
import { PurchaseBroadcastAudienceService } from "./purchase-broadcast-audience.service";
import { PurchaseAnalyticsQueryDto } from "./purchase-analytics.dto";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";

/** Authenticated store-scoped purchase intelligence; ADMIN receives global scope. */
@Controller("admin/purchase-analytics")
export class PurchaseAnalyticsController {
  constructor(
    private readonly analytics: PurchaseAnalyticsService,
    private readonly broadcastAudience: PurchaseBroadcastAudienceService,
  ) {}

  @Get()
  get(@Req() request: AuthRequest, @Query() query: PurchaseAnalyticsQueryDto) {
    return this.analytics.get(request.user!, query);
  }

  @Get("audience")
  getAudience(
    @Req() request: AuthRequest,
    @Query() query: PurchaseAnalyticsQueryDto,
  ) {
    return this.analytics.getAudience(request.user!, query);
  }

  @Post("audience/broadcast-draft")
  @Roles(UserRole.ADMIN)
  createBroadcastDraft(
    @Req() request: AuthRequest,
    @Body() body: CreatePurchaseBroadcastDraftDto,
  ) {
    return this.broadcastAudience.createDraft(body, request.user!);
  }
}
