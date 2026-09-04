import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatSessionHealthProbeService } from "./line-chat-session-health-probe.service";

@Controller("operations/line-chat-nickname")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class LineChatOperationsController {
  constructor(
    private readonly operationsService: LineChatOperationsService,
    private readonly sessionHealthProbeService: LineChatSessionHealthProbeService,
  ) {}

  @Get("health")
  async getHealth() {
    return this.operationsService.getHealthSummary();
  }

  @Post("health/session/:id/probe")
  async probeSessionHealth(@Param("id") sessionId: string) {
    return this.sessionHealthProbeService.probeSession(sessionId, "MANUAL");
  }

  @Post("retry-failed")
  async retryFailed(@Query("sessionKey") sessionKey?: string) {
    return this.operationsService.retryFailedJobs(sessionKey?.trim() || undefined);
  }

  @Patch("oa/:id/toggle")
  async toggleOaSync(
    @Param("id") oaId: string,
    @Body() body: { enabled: boolean }
  ) {
    return this.operationsService.toggleOaNicknameSync(oaId, Boolean(body.enabled));
  }
}
