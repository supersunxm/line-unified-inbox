import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { MonthlySummaryQueryDto } from "./mobile-conversations.dto";
import { MonthlyFollowerSummaryService } from "./monthly-follower-summary.service";
import { MonthlySummaryService } from "./monthly-summary.service";

@Controller("mobile/summary")
export class MonthlySummaryController {
  constructor(
    private readonly summary: MonthlySummaryService,
    private readonly followers: MonthlyFollowerSummaryService,
  ) {}

  @Get("monthly")
  async get(@Req() request: AuthRequest, @Query() query: MonthlySummaryQueryDto) {
    const summary = await this.summary.get(request.user!, query.month);
    const followers = await this.followers.get(request.user!, query.month);
    return { ...summary, followers };
  }
}
