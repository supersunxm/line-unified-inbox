import { Controller, Post, Body, Query, Req } from "@nestjs/common";
import { AnalyticsPeriod, UserRolePermission } from "../../dashboard-analytics.service";
import { BiAssistantService } from "./bi-assistant.service";
import type { BIQueryRequestDto } from "./bi-assistant.types";

@Controller("dashboard/bi-assistant")
export class BiAssistantController {
  constructor(private readonly biAssistantService: BiAssistantService) {}

  @Post("query")
  async queryBiAssistant(
    @Body() dto: BIQueryRequestDto,
    @Query("period") period?: AnalyticsPeriod,
    @Query("role") role?: UserRolePermission,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: any,
  ) {
    const safePeriod: AnalyticsPeriod = period === "7d" || period === "30d" ? period : "today";
    const userRole: UserRolePermission = role || req?.user?.role || "HEAD_OFFICE";

    const allowedStoreIds = allowedStoreIdsRaw
      ? allowedStoreIdsRaw.split(",").map((s) => s.trim())
      : req?.user?.allowedStoreIds ?? undefined;

    return this.biAssistantService.answerQuery(dto.question, safePeriod, userRole, allowedStoreIds);
  }
}
