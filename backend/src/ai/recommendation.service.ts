import { Injectable } from "@nestjs/common";
import type { RootCauseCategory } from "./root-cause.types";
import { formatRecommendationText, formatExpectedImpactText } from "./prompts/root-cause.prompt";

@Injectable()
export class RecommendationService {
  getRecommendation(category: RootCauseCategory, storeName: string, peakWindow: string): string {
    return formatRecommendationText(category, storeName, peakWindow);
  }

  getExpectedImpact(category: RootCauseCategory): string {
    return formatExpectedImpactText(category);
  }
}
