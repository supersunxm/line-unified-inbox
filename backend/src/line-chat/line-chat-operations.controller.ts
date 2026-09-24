import {
  Body,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { LineChatOperationsService } from "./line-chat-operations.service";
import { LineChatNovncRecoveryService } from "./line-chat-novnc-recovery.service";
import { LineChatPendingControlService } from "./line-chat-pending-control.service";
import { LineChatHealthReconciliationService } from "./line-chat-health-reconciliation.service";
import { LineChatManualMappingService } from "./line-chat-manual-mapping.service";
import { LineChatMirrorStatusService } from "./line-chat-mirror-status.service";
import { MirrorOperationModeService } from "./mirror-operation-mode.service";
import type { AuthRequest } from "../auth/auth.guard";
import { Req } from "@nestjs/common";

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

export class EmergencyResumeMirrorModeDto {
  @IsBoolean()
  acknowledgeUnprovenGap!: boolean;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RunProgressDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  jobIds!: string[];
}

export class BindManualMappingDto {
  @IsString()
  @IsNotEmpty()
  lineOfficialAccountId!: string;

  @IsString()
  @IsNotEmpty()
  lineChatUserId!: string;

  @IsOptional()
  @IsBoolean()
  overrideConflict?: boolean;
}

@Controller("operations/line-chat-nickname")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class LineChatOperationsController {
  constructor(
    private readonly operationsService: LineChatOperationsService,
    private readonly novncRecovery: LineChatNovncRecoveryService,
    private readonly pendingControl: LineChatPendingControlService,
    private readonly healthReconciliation: LineChatHealthReconciliationService,
    private readonly manualMappingService: LineChatManualMappingService,
    private readonly mirrorStatusService: LineChatMirrorStatusService,
    @Optional()
    @Inject(MirrorOperationModeService)
    private readonly mirrorOperationModeService?: MirrorOperationModeService,
  ) {}

  private getMirrorOperationModeService(): MirrorOperationModeService {
    if (!this.mirrorOperationModeService) {
      throw new InternalServerErrorException("MIRROR_OPERATION_MODE_SERVICE_UNAVAILABLE");
    }
    return this.mirrorOperationModeService;
  }

  @Get("unresolved-backlog")
  async getUnresolvedBacklog() {
    return this.manualMappingService.getUnresolvedBacklog();
  }

  @Get("conversations/:id/mapping-candidates")
  async getMappingCandidates(
    @Param("id") conversationId: string,
    @Query("search") search?: string,
  ) {
    return this.manualMappingService.getMappingCandidates(conversationId, search?.trim() || undefined);
  }

  @Post("conversations/:id/manual-map")
  async bindManualMapping(
    @Param("id") conversationId: string,
    @Body() body: BindManualMappingDto,
    @Req() req: AuthRequest,
  ) {
    return this.manualMappingService.bindManualMapping({
      conversationId,
      lineOfficialAccountId: body.lineOfficialAccountId,
      lineChatUserId: body.lineChatUserId,
      operatorId: req.user?.id,
      operatorDisplayName: req.user?.displayName,
      overrideConflict: Boolean(body.overrideConflict),
    });
  }

  @Get("health")
  async getHealth() {
    const report = await this.operationsService.getHealthSummary();
    return this.healthReconciliation.reconcile(report);
  }

  @Get("fleet-readiness")
  async getFleetReadiness() {
    return this.operationsService.getFleetReadiness();
  }

  @Get("mirror-status")
  async getMirrorStatus() {
    return this.mirrorStatusService.getStatus();
  }

  @Get("mirror-operation-mode")
  async getMirrorOperationMode() {
    return this.getMirrorOperationModeService().getStatus();
  }

  @Post("mirror-operation-mode/backfill")
  async startMirrorBackfill() {
    return this.getMirrorOperationModeService().transition("BACKFILL");
  }

  @Post("mirror-operation-mode/catch-up")
  async startMirrorCatchUp() {
    return this.getMirrorOperationModeService().transition("CATCH_UP");
  }

  @Post("mirror-operation-mode/normal")
  async returnMirrorToNormal() {
    return this.getMirrorOperationModeService().transition("NORMAL");
  }

  @Post("mirror-operation-mode/emergency-resume")
  async emergencyResumeMirror(
    @Body() body: EmergencyResumeMirrorModeDto,
  ) {
    return this.getMirrorOperationModeService().emergencyResume({
      acknowledgeUnprovenGap: body.acknowledgeUnprovenGap,
      reason: body.reason,
    });
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
