import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { FollowerInsightsService } from "./follower-insights.service";
import {
  BackfillBatchResult,
  BackfillFollowerInsightsDto,
  ByStoreAccountRow,
  ByStoreQueryDto,
  SummaryDailyRow,
  SummaryQueryDto,
  SyncBatchResult,
  SyncFollowerInsightsDto,
} from "./follower-insights.types";

@Controller("follower-insights")
export class FollowerInsightsController {
  constructor(private readonly followerInsightsService: FollowerInsightsService) {}

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async sync(@Body() dto: SyncFollowerInsightsDto): Promise<SyncBatchResult> {
    return this.followerInsightsService.sync(dto);
  }

  @Post("backfill")
  @HttpCode(HttpStatus.OK)
  async backfill(@Body() dto: BackfillFollowerInsightsDto): Promise<BackfillBatchResult> {
    return this.followerInsightsService.backfill(dto);
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
