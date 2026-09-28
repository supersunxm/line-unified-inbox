import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MonthlyOperationsReportController } from "./monthly-operations-report.controller";
import { MonthlyOperationsReportService } from "./monthly-operations-report.service";

@Module({
  imports: [AuthModule],
  controllers: [MonthlyOperationsReportController],
  providers: [MonthlyOperationsReportService],
})
export class MonthlyOperationsReportModule {}
