import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { StoreInsightsQueryDto } from "./store-insights.types";
import { CustomerVoiceService } from "./customer-voice.service";
import { StoreInsightsService } from "./store-insights.service";

@Controller("store-insights")
export class StoreInsightsController {
  constructor(private readonly storeInsights: StoreInsightsService, private readonly customerVoice: CustomerVoiceService) {}

  @Get(":storeId/summary")
  summary(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.storeInsights.getSummary(request.user!, storeId, query);
  }

  @Get(":storeId/response-performance")
  responsePerformance(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.storeInsights.getResponsePerformance(request.user!, storeId, query);
  }

  @Get(":storeId/responders")
  responders(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.storeInsights.getResponders(request.user!, storeId, query);
  }

  @Get(":storeId/sales")
  sales(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.storeInsights.getSales(request.user!, storeId, query);
  }

  @Get(":storeId/conversations")
  conversations(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.storeInsights.getConversations(request.user!, storeId, query);
  }

  @Get(":storeId/customer-voice")
  customerVoiceSummary(@Req() request: AuthRequest, @Param("storeId") storeId: string, @Query() query: StoreInsightsQueryDto) {
    return this.customerVoice.getCustomerVoice(request.user!, storeId, query);
  }
}
