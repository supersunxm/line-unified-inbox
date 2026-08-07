import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { RecommendationService } from "../recommendation.service";
import { ExecutiveBriefService } from "../executive-brief/executive-brief.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";
import { QueryAnalyzerService } from "./query-analyzer.service";
import { BiAssistantService } from "./bi-assistant.service";
import { BiAssistantController } from "./bi-assistant.controller";

@Module({
  imports: [PrismaModule],
  controllers: [BiAssistantController],
  providers: [DashboardAnalyticsService, RootCauseService, RecommendationService, ExecutiveBriefService, AiTelemetryService, QueryAnalyzerService, BiAssistantService],
  exports: [BiAssistantService],
})
export class BiAssistantModule {}
