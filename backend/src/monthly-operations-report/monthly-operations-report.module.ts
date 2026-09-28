import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { HistoricalTimelineService } from "../historical-timeline.service";
import { MonthlyOperationsReportController } from "./monthly-operations-report.controller";
import { MonthlyOperationsReportService } from "./monthly-operations-report.service";

@Module({
  imports: [AuthModule],
  controllers: [MonthlyOperationsReportController],
  providers: [HistoricalTimelineService, MonthlyOperationsReportService],
})
export class MonthlyOperationsReportModule {}
