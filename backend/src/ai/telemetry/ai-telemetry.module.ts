import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { AiTelemetryService } from "./ai-telemetry.service";

@Module({
  imports: [PrismaModule],
  providers: [DashboardAnalyticsService, AiTelemetryService],
  exports: [AiTelemetryService],
})
export class AiTelemetryModule {}
