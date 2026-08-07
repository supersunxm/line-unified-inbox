import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { RecommendationService } from "../recommendation.service";
import { ExecutiveBriefService } from "../executive-brief/executive-brief.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";
import { ActionExecutionService } from "./action-execution.service";
import { ActionAgentService } from "./action-agent.service";
import { ActionAgentController } from "./action-agent.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ActionAgentController],
  providers: [
    DashboardAnalyticsService,
    RootCauseService,
    RecommendationService,
    ExecutiveBriefService,
    AiTelemetryService,
    ActionExecutionService,
    ActionAgentService,
  ],
  exports: [ActionAgentService, ActionExecutionService],
})
export class ActionAgentModule {}
