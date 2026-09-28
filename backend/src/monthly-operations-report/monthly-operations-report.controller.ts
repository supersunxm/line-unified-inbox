import { Controller, Get, Query, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.guard";
import { MonthlyOperationsReportService } from "./monthly-operations-report.service";

@Controller("monthly-operations-report")
export class MonthlyOperationsReportController {
  constructor(private readonly report: MonthlyOperationsReportService) {}

  @Get("export")
  async export(@Req() request: AuthRequest, @Res() response: Response, @Query("month") month?: string) {
    const file = await this.report.exportXlsx(request.user!, month);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    response.send(file.buffer);
  }

  @Get("zero-rate-forensics")
  async zeroRateForensics(
    @Req() request: AuthRequest,
    @Query("month") month?: string,
    @Query("sample") sample = "10",
  ) {
    return this.report.zeroRateForensics(request.user!, month, Number(sample));
  }

  @Get("audit")
  async audit(
    @Req() request: AuthRequest,
    @Query("month") month?: string,
    @Query("sample") sample = "20",
  ) {
    return this.report.auditReplyKpi(request.user!, month, Number(sample));
  }

  @Get()
  async get(@Req() request: AuthRequest, @Query("month") month?: string) {
    return this.report.get(request.user!, month);
  }
}
