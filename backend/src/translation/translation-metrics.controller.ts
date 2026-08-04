import { Controller, Get } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationReadinessResponse, TranslationReadinessService } from "./translation-readiness.service";
import { TranslationPilotReport, TranslationReportService } from "./translation-report.service";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationPilotStatus, TranslationPilotStatusService } from "./translation-pilot-status.service";

export type TranslationMetricsResponse = {
  totalRequests: number;
  successfulTranslations: number;
  failedTranslations: number;
  providerFailures: number;
  rateLimitedRequests: number;
  cacheHits: number;
  averageDurationMs: number;
  averageCharacterCount: number;
  dailyCharacterUsage: number;
  dailyCharacterLimit: number;
  budgetExceededRequests: number;
  positiveFeedbackCount: number;
  terminologyIssueCount: number;
  meaningIssueCount: number;
};

@Controller("translation")
export class TranslationMetricsController {
  constructor(
    private readonly metrics: TranslationMetrics,
    private readonly usageBudget: TranslationUsageBudget,
    private readonly readiness: TranslationReadinessService,
    private readonly report: TranslationReportService,
    private readonly feedback: TranslationFeedbackService,
    private readonly pilotStatus: TranslationPilotStatusService,
  ) {}

  @Get("metrics")
  @Roles("ADMIN")
  getMetrics(): TranslationMetricsResponse {
    const snapshot = this.metrics.snapshot();
    const budget = this.usageBudget.snapshot();
    const feedback = this.feedback.snapshot();
    return {
      totalRequests: snapshot.totalTranslationRequests,
      successfulTranslations: snapshot.successfulTranslations,
      failedTranslations: snapshot.failedTranslations,
      providerFailures: snapshot.providerFailures,
      rateLimitedRequests: snapshot.rateLimitedRequests,
      cacheHits: snapshot.cacheHitCount,
      averageDurationMs: snapshot.averageDurationMs,
      averageCharacterCount: snapshot.averageCharacterCount,
      dailyCharacterUsage: budget.dailyCharacterUsage,
      dailyCharacterLimit: budget.dailyCharacterLimit,
      budgetExceededRequests: budget.budgetExceededRequests,
      positiveFeedbackCount: feedback.positiveFeedbackCount,
      terminologyIssueCount: feedback.terminologyIssueCount,
      meaningIssueCount: feedback.meaningIssueCount,
    };
  }

  @Get("readiness")
  @Roles("ADMIN")
  getReadiness(): TranslationReadinessResponse {
    return this.readiness.check();
  }

  @Get("report")
  @Roles("ADMIN")
  getReport(): TranslationPilotReport {
    return this.report.createReport();
  }

  @Get("pilot-status")
  @Roles("ADMIN")
  getPilotStatus(): TranslationPilotStatus {
    return this.pilotStatus.getStatus();
  }
}
