import { Controller, Get, Post, Param, Query, Req } from "@nestjs/common";
import { AnalyticsPeriod, UserRolePermission } from "../../dashboard-analytics.service";
import { ActionAgentService } from "./action-agent.service";

@Controller("dashboard/actions")
export class ActionAgentController {
  constructor(private readonly actionAgentService: ActionAgentService) {}

  @Get()
  async getActions(
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

    return this.actionAgentService.getActionTasks(safePeriod, userRole, allowedStoreIds);
  }

  @Post(":id/approve")
  async approveAction(@Param("id") id: string) {
    return this.actionAgentService.approveTask(id);
  }

  @Post(":id/complete")
  async completeAction(@Param("id") id: string) {
    return this.actionAgentService.completeTask(id);
  }
}
