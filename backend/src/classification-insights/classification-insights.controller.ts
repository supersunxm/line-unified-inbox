import { Controller, Get } from "@nestjs/common";
import { ClassificationInsightsService } from "./classification-insights.service";
import { ClassificationInsightsResponse } from "./classification-insights.types";

@Controller("classification-insights")
export class ClassificationInsightsController {
  constructor(private readonly classificationInsights: ClassificationInsightsService) {}

  @Get()
  getInsights(): Promise<ClassificationInsightsResponse> {
    return this.classificationInsights.getInsights();
  }
}
