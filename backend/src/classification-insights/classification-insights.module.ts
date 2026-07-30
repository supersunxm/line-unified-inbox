import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { ClassificationInsightsController } from "./classification-insights.controller";
import { ClassificationInsightsService } from "./classification-insights.service";

@Module({
  imports: [PrismaModule],
  controllers: [ClassificationInsightsController],
  providers: [ClassificationInsightsService],
})
export class ClassificationInsightsModule {}
