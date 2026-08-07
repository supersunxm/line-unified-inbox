import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { ImpactCalculationService } from "./impact-calculation.service";
import { ImpactEngineService } from "./impact-engine.service";
import { ImpactEngineController } from "./impact-engine.controller";

@Module({
  imports: [PrismaModule],
  controllers: [ImpactEngineController],
  providers: [
    DashboardAnalyticsService,
    ImpactCalculationService,
    ImpactEngineService,
  ],
  exports: [ImpactEngineService, ImpactCalculationService],
})
export class ImpactEngineModule {}
