import { Injectable } from "@nestjs/common";
import { TranslationConfig } from "./translation.config";
import { TranslationReadinessService } from "./translation-readiness.service";

export type TranslationPilotStatus = {
  ready: boolean;
  active: boolean;
  allowlistedAdminCount: number;
  rateLimitConfigured: boolean;
  dailyBudgetConfigured: boolean;
  feedbackEnabled: boolean;
};

@Injectable()
export class TranslationPilotStatusService {
  constructor(private readonly config: TranslationConfig, private readonly readiness: TranslationReadinessService) {}

  getStatus(): TranslationPilotStatus {
    const readiness = this.readiness.check();
    return {
      ready: readiness.ready,
      active: readiness.checks.featureEnabled && readiness.checks.providerConfigured && readiness.checks.pilotModeEnabled && readiness.checks.allowlistConfigured,
      allowlistedAdminCount: this.config.allowedAdminIds.length,
      rateLimitConfigured: readiness.checks.rateLimitConfigured,
      dailyBudgetConfigured: readiness.checks.budgetConfigured,
      feedbackEnabled: readiness.checks.feedbackMetricsAvailable,
    };
  }
}
