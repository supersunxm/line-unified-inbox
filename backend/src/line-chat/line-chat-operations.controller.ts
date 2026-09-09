import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatNovncRecoveryService } from "./line-chat-novnc-recovery.service";
import { LineChatPendingControlService } from "./line-chat-pending-control.service";

export class RetrySelectedJobsDto {
  @IsString()
  @IsNotEmpty()
  sessionKey!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  jobIds!: string[];

  @IsOptional()
  @IsBoolean()
  overrideNonRetryable?: boolean;
}

export class FixRetryableJobsDto {
  @IsString()
  @IsNotEmpty()
  sessionKey!: string;
}

export class RunProgressDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  jobIds!: string[];
}

@Controller("operations/line-chat-nickname")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class LineChatOperationsController {
  constructor(
    private readonly operationsService: LineChatOperationsService,
    private readonly novncRecovery: LineChatNovncRecoveryService,
    private readonly pendingControl: LineChatPendingControlService,
  ) {}

  @Get("health")
  async getHealth() {
    return this.operationsService.getHealthSummary();
  }

  @Post("retry-failed")
  async retryFailed(@Query("sessionKey") sessionKey?: string) {
    return this.operationsService.retryFailedJobs(sessionKey?.trim() || undefined);
  }

  @Post("retry-selected")
  async retrySelected(@Body() body: RetrySelectedJobsDto) {
    return this.operationsService.retrySelectedJobs({
      sessionKey: body.sessionKey.trim(),
      jobIds: body.jobIds,
      overrideNonRetryable: Boolean(body.overrideNonRetryable),
    });
  }

  @Post("fix-retryable")
  async fixRetryable(@Body() body: FixRetryableJobsDto) {
    return this.operationsService.fixRetryableFailures(body.sessionKey.trim());
  }

  @Patch("oa/:id/toggle")
  async toggleOaSync(
    @Param("id") oaId: string,
    @Body() body: { enabled: boolean }
  ) {
    return this.operationsService.toggleOaNicknameSync(oaId, Boolean(body.enabled));
  }

  @Post("sessions/:sessionKey/try-remembered-login")
  async tryRememberedLogin(@Param("sessionKey") sessionKey: string) {
    return this.operationsService.tryRememberedLogin(sessionKey.trim());
  }

  @Get("sessions/:sessionKey/pending-control")
  async getPendingControl(@Param("sessionKey") sessionKey: string) {
    return this.pendingControl.status(sessionKey.trim());
  }

  @Post("sessions/:sessionKey/pending-control/pause")
  async pausePending(@Param("sessionKey") sessionKey: string) {
    return this.pendingControl.pause(sessionKey.trim());
  }

  @Post("sessions/:sessionKey/pending-control/resume")
  async resumePending(@Param("sessionKey") sessionKey: string) {
    return this.pendingControl.resume(sessionKey.trim());
  }

  @Post("sessions/:sessionKey/pending-control/run-progress")
  async getRunProgress(@Param("sessionKey") sessionKey: string, @Body() body: RunProgressDto) {
    return this.pendingControl.runProgress(sessionKey.trim(), body.jobIds);
  }

  @Get("sessions/:sessionKey/manual-recovery")
  async getManualRecovery(@Param("sessionKey") sessionKey: string) {
    return this.novncRecovery.status(sessionKey.trim());
  }

  @Post("sessions/:sessionKey/manual-recovery/start")
  async startManualRecovery(@Param("sessionKey") sessionKey: string) {
    return this.novncRecovery.start(sessionKey.trim());
  }

  @Post("sessions/:sessionKey/manual-recovery/stop")
  async stopManualRecovery(@Param("sessionKey") sessionKey: string) {
    return this.novncRecovery.stop(sessionKey.trim());
  }
}
