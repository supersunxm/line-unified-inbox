import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { MonthlyOperationsReportService } from "./monthly-operations-report.service";

@Controller("monthly-operations-report")
export class MonthlyOperationsReportController {
  constructor(private readonly report: MonthlyOperationsReportService) {}

  @Get()
  async get(@Req() request: AuthRequest, @Query("month") month?: string) {
    return this.report.get(request.user!, month);
  }
}
