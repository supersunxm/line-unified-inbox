import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "./auth/auth.decorators";
import type { AuthRequest } from "./auth/auth.guard";
import {
  CreatePurchaseBroadcastDraftDto,
  ExecutePurchaseBroadcastDto,
  UpdatePurchaseBroadcastDraftDto,
} from "./purchase-broadcast-audience.dto";
import { PurchaseBroadcastAudienceService } from "./purchase-broadcast-audience.service";
import { PurchaseBroadcastSafeSendService } from "./purchase-broadcast-safe-send.service";
import { PurchaseAnalyticsQueryDto } from "./purchase-analytics.dto";
import { PurchaseAnalyticsService } from "./purchase-analytics.service";

/** Authenticated store-scoped purchase intelligence; ADMIN receives global scope. */
@Controller("admin/purchase-analytics")
export class PurchaseAnalyticsController {
  constructor(
    private readonly analytics: PurchaseAnalyticsService,
    private readonly broadcastAudience: PurchaseBroadcastAudienceService,
    private readonly safeSend: PurchaseBroadcastSafeSendService,
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

  @Get("audience/broadcast-draft/:id/composer")
  @Roles(UserRole.ADMIN)
  getBroadcastDraftComposer(
    @Req() request: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.broadcastAudience.getComposer(id, request.user!);
  }

  @Patch("audience/broadcast-draft/:id/composer")
  @Roles(UserRole.ADMIN)
  updateBroadcastDraftComposer(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: UpdatePurchaseBroadcastDraftDto,
  ) {
    return this.broadcastAudience.updateComposer(id, body, request.user!);
  }

  @Post("audience/broadcast-draft/:id/review")
  @Roles(UserRole.ADMIN)
  reviewBroadcastDraft(
    @Req() request: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.safeSend.review(id, request.user!);
  }

  @Post("audience/broadcast-draft/:id/send")
  @Roles(UserRole.ADMIN)
  sendBroadcastDraft(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: ExecutePurchaseBroadcastDto,
  ) {
    return this.safeSend.execute(id, body, request.user!);
  }

  @Get("audience/broadcast-draft/:id/send-status")
  @Roles(UserRole.ADMIN)
  getBroadcastSendStatus(
    @Req() request: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.safeSend.getStatus(id, request.user!);
  }
}
