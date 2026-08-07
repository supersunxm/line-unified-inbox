import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { RecommendationService } from "../recommendation.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";
import { ExecutiveBriefService } from "./executive-brief.service";
import { ExecutiveBriefController } from "./executive-brief.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ExecutiveBriefController],
  providers: [DashboardAnalyticsService, RootCauseService, RecommendationService, AiTelemetryService, ExecutiveBriefService],
  exports: [ExecutiveBriefService],
})
export class ExecutiveBriefModule {}
