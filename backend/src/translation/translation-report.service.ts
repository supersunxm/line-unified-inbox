import { Injectable } from "@nestjs/common";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationFeedbackService } from "./translation-feedback";

export type TranslationPilotReportStatus = "HEALTHY" | "WARNING" | "CRITICAL";

export type TranslationPilotReport = {
  period: { type: "process" };
  status: TranslationPilotReportStatus;
  metrics: {
    totalRequests: number;
    successfulTranslations: number;
    failedTranslations: number;
    cacheHits: number;
    providerFailures: number;
    rateLimitedRequests: number;
    budgetExceededRequests: number;
    dailyCharacterUsage: number;
    dailyCharacterLimit: number;
    positiveFeedbackCount: number;
    terminologyIssueCount: number;
    meaningIssueCount: number;
    otherIssueCount: number;
  };
  healthIndicators: {
    successRate: number;
    averageDurationMs: number;
    budgetUtilizationPercent: number;
  };
};

@Injectable()
export class TranslationReportService {
  constructor(
    private readonly translationMetrics: TranslationMetrics,
    private readonly usageBudget: TranslationUsageBudget,
    private readonly feedback: TranslationFeedbackService,
  ) {}

  createReport(): TranslationPilotReport {
    const metrics = this.translationMetrics.snapshot();
    const budget = this.usageBudget.snapshot();
    const feedback = this.feedback.snapshot();
    const completedRequests = metrics.successfulTranslations + metrics.cacheHitCount;
    const successRate = metrics.totalTranslationRequests ? (completedRequests / metrics.totalTranslationRequests) * 100 : 100;
    const budgetUtilizationPercent = budget.dailyCharacterLimit ? (budget.dailyCharacterUsage / budget.dailyCharacterLimit) * 100 : 100;
    const budgetExhausted = budget.dailyCharacterUsage >= budget.dailyCharacterLimit;
    const status: TranslationPilotReportStatus = successRate < 80 || budgetExhausted
      ? "CRITICAL"
      : successRate < 95 || budgetUtilizationPercent >= 80
        ? "WARNING"
        : "HEALTHY";

    return {
      period: { type: "process" },
      status,
      metrics: {
        totalRequests: metrics.totalTranslationRequests,
        successfulTranslations: metrics.successfulTranslations,
        failedTranslations: metrics.failedTranslations,
        cacheHits: metrics.cacheHitCount,
        providerFailures: metrics.providerFailures,
        rateLimitedRequests: metrics.rateLimitedRequests,
        budgetExceededRequests: budget.budgetExceededRequests,
        dailyCharacterUsage: budget.dailyCharacterUsage,
        dailyCharacterLimit: budget.dailyCharacterLimit,
        positiveFeedbackCount: feedback.positiveFeedbackCount,
        terminologyIssueCount: feedback.terminologyIssueCount,
        meaningIssueCount: feedback.meaningIssueCount,
        otherIssueCount: feedback.otherIssueCount,
      },
      healthIndicators: {
        successRate,
        averageDurationMs: metrics.averageDurationMs,
        budgetUtilizationPercent,
      },
    };
  }
}
