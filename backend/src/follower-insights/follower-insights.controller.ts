import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { FollowerInsightsService } from "./follower-insights.service";
import { Roles } from "../auth/auth.decorators";
import {
  BackfillBatchResult,
  BackfillFollowerInsightsDto,
  ByStoreAccountRow,
  ByStoreQueryDto,
  QueueSummaryDto,
  SummaryDailyRow,
  SummaryQueryDto,
  SyncBatchResult,
  SyncFollowerInsightsDto,
} from "./follower-insights.types";

/**
 * Authorization architecture:
 *
 * AuthGuard is registered as APP_GUARD in AuthModule, applying to every route.
 * AuthGuard reads @Roles("ADMIN") metadata via Reflector and throws:
 *   - 401 UnauthorizedException  if no valid session cookie
 *   - 403 ForbiddenException     if user role does not match @Roles requirement
 *
 * Routes decorated with @Roles("ADMIN") require an authenticated ADMIN session.
 * Routes without @Roles still require authentication (non-ADMIN users can read).
 */
@Controller("follower-insights")
export class FollowerInsightsController {
  constructor(private readonly followerInsightsService: FollowerInsightsService) {}

  /** Trigger ad-hoc sync for a date – ADMIN only */
  @Roles("ADMIN")
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async sync(@Body() dto: SyncFollowerInsightsDto): Promise<SyncBatchResult> {
    return this.followerInsightsService.sync(dto);
  }

  /** Trigger manual bulk backfill – ADMIN only */
  @Roles("ADMIN")
  @Post("backfill")
  @HttpCode(HttpStatus.OK)
  async backfill(@Body() dto: BackfillFollowerInsightsDto): Promise<BackfillBatchResult> {
    return this.followerInsightsService.backfill(dto);
  }

  /**
   * Get latest backfill job status for a LINE OA account – ADMIN only.
   * Throws 404 NotFoundException when no job exists for this account.
   */
  @Roles("ADMIN")
  @Get("backfill/jobs/:lineOaId")
  async getJobStatus(@Param("lineOaId") lineOaId: string): Promise<any> {
    return this.followerInsightsService.getJobStatus(lineOaId);
  }

  /**
   * Retry or enqueue a new backfill job – ADMIN only.
   * Returns 409 Conflict (existing active job) if one is already running.
   */
  @Roles("ADMIN")
  @Post("backfill/retry")
  @HttpCode(HttpStatus.OK)
  async retryJob(@Body() body: { lineOaId: string }): Promise<any> {
    return this.followerInsightsService.retryBackfillJob(body.lineOaId);
  }

  /** Admin-visible queue summary – ADMIN only */
  @Roles("ADMIN")
  @Get("backfill/queue-summary")
  async getQueueSummary(): Promise<QueueSummaryDto> {
    return this.followerInsightsService.getQueueSummary();
  }

  @Get("summary")
  async getSummary(@Query() query: SummaryQueryDto): Promise<SummaryDailyRow[]> {
    return this.followerInsightsService.getSummary(query);
  }

  @Get("by-store")
  async getByStore(@Query() query: ByStoreQueryDto): Promise<ByStoreAccountRow[]> {
    return this.followerInsightsService.getByStore(query);
  }
}
