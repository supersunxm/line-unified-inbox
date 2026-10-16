import { Injectable } from "@nestjs/common";
import { TranslationConfig } from "./translation.config";
import { TranslationFeedbackService } from "./translation-feedback";

export type TranslationReadinessChecks = {
  featureEnabled: boolean;
  providerConfigured: boolean;
  pilotModeEnabled: boolean;
  rateLimitConfigured: boolean;
  budgetConfigured: boolean;
  feedbackMetricsAvailable: boolean;
};

export type TranslationReadinessResponse = {
  ready: boolean;
  checks: TranslationReadinessChecks;
};

@Injectable()
export class TranslationReadinessService {
  constructor(private readonly config: TranslationConfig, private readonly feedback: TranslationFeedbackService) {}

  check(): TranslationReadinessResponse {
    const feedbackSnapshot = this.feedback.snapshot();
    const checks: TranslationReadinessChecks = {
      featureEnabled: this.config.enabled === true,
      providerConfigured: this.config.provider === "google" && this.config.google !== null,
      pilotModeEnabled: this.config.pilotMode === true,
      rateLimitConfigured: Number.isSafeInteger(this.config.rateLimitPerMinute) && this.config.rateLimitPerMinute > 0,
      budgetConfigured: Number.isSafeInteger(this.config.dailyCharacterLimit) && this.config.dailyCharacterLimit > 0,
      feedbackMetricsAvailable: Object.values(feedbackSnapshot).every((value) => Number.isSafeInteger(value) && value >= 0),
    };
    return { ready: Object.values(checks).every(Boolean), checks };
  }
}
