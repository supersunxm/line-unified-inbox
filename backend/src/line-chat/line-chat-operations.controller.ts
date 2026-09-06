import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { LineChatOperationsService } from "./line-chat-operations.service";

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

@Controller("operations/line-chat-nickname")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class LineChatOperationsController {
  constructor(private readonly operationsService: LineChatOperationsService) {}

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
}
