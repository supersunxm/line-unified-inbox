import { Controller, Get, Query, Req } from "@nestjs/common";
import { AnalyticsPeriod, UserRolePermission } from "../../dashboard-analytics.service";
import { OperationalMemoryService } from "./operational-memory.service";

@Controller("dashboard/operational-memory")
export class OperationalMemoryController {
  constructor(private readonly memoryService: OperationalMemoryService) {}

  @Get()
  async getOperationalMemory(
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

    return this.memoryService.getMemorySummary(safePeriod, userRole, allowedStoreIds);
  }
}
