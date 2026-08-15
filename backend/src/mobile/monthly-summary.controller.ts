import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { MonthlySummaryQueryDto } from "./mobile-conversations.dto";
import { MonthlySummaryService } from "./monthly-summary.service";

@Controller("mobile/summary")
export class MonthlySummaryController {
  constructor(private readonly summary: MonthlySummaryService) {}

  @Get("monthly")
  get(@Req() request: AuthRequest, @Query() query: MonthlySummaryQueryDto) {
    return this.summary.get(request.user!, query.month);
  }
}
