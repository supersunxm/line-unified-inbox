import { Module } from "@nestjs/common";
import { TranslationConfig } from "./translation.config";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";
import { GoogleTranslationProvider } from "./providers/google-translation.provider";
import { TRANSLATION_PROVIDER, TranslationProvider } from "./translation.provider";
import { TranslationAuditLogger } from "./translation-audit.logger";
import { InMemoryTranslationRateLimiter, TRANSLATION_RATE_LIMITER } from "./translation-rate-limiter";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationMetricsController } from "./translation-metrics.controller";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationReadinessService } from "./translation-readiness.service";
import { TranslationReportService } from "./translation-report.service";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationPilotStatusService } from "./translation-pilot-status.service";

@Module({
  controllers: [TranslationController, TranslationMetricsController],
  providers: [
    TranslationConfig,
    {
      provide: TRANSLATION_PROVIDER,
      inject: [TranslationConfig],
      useFactory: (config: TranslationConfig): TranslationProvider | null => config.provider === "google" && config.google ? new GoogleTranslationProvider(config.google) : null,
    },
    TranslationAuditLogger,
    InMemoryTranslationRateLimiter,
    { provide: TRANSLATION_RATE_LIMITER, useExisting: InMemoryTranslationRateLimiter },
    TranslationMetrics,
    { provide: TranslationUsageBudget, inject: [TranslationConfig], useFactory: (config: TranslationConfig) => new TranslationUsageBudget(config) },
    TranslationReadinessService,
    TranslationReportService,
    TranslationFeedbackService,
    TranslationPilotStatusService,
    TranslationService,
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
