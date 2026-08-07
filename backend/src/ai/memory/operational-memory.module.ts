import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { OperationalMemoryService } from "./operational-memory.service";
import { OperationalMemoryController } from "./operational-memory.controller";

@Module({
  imports: [PrismaModule],
  controllers: [OperationalMemoryController],
  providers: [DashboardAnalyticsService, OperationalMemoryService],
  exports: [OperationalMemoryService],
})
export class OperationalMemoryModule {}
