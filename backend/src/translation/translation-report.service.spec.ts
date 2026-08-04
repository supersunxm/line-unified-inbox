import assert from "node:assert/strict";
import test from "node:test";
import { TranslationConfig } from "./translation.config";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationReportService } from "./translation-report.service";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationFeedbackService } from "./translation-feedback";

function reportFixture(limit = 100) {
  const metrics = new TranslationMetrics();
  const budget = new TranslationUsageBudget({ dailyCharacterLimit: limit } as TranslationConfig);
  const feedback = new TranslationFeedbackService();
  return { metrics, budget, feedback, report: new TranslationReportService(metrics, budget, feedback) };
}

test("report aggregates process metrics, feedback signals, and health indicators", () => {
  const { metrics, budget, feedback, report } = reportFixture();
  for (let index = 0; index < 8; index += 1) metrics.record({ outcome: "SUCCESS", durationMs: 100, characterCount: 5 });
  for (let index = 0; index < 2; index += 1) metrics.record({ outcome: "CACHED", durationMs: 0, characterCount: 5 });
  budget.consume(50);
  feedback.recordAfterSuccessfulTranslation("TRANSLATED", "POSITIVE");
  feedback.recordAfterSuccessfulTranslation("CACHED", "TERMINOLOGY_ISSUE");
  feedback.recordAfterSuccessfulTranslation("TRANSLATED", "MEANING_ISSUE");
  assert.deepEqual(report.createReport(), {
    period: { type: "process" },
    status: "HEALTHY",
    metrics: {
      totalRequests: 10,
      successfulTranslations: 8,
      failedTranslations: 0,
      cacheHits: 2,
      providerFailures: 0,
      rateLimitedRequests: 0,
      budgetExceededRequests: 0,
      dailyCharacterUsage: 50,
      dailyCharacterLimit: 100,
      positiveFeedbackCount: 1,
      terminologyIssueCount: 1,
      meaningIssueCount: 1,
    },
    healthIndicators: { successRate: 100, averageDurationMs: 80, budgetUtilizationPercent: 50 },
  });
});

test("status thresholds produce HEALTHY, WARNING, and CRITICAL with critical precedence", () => {
  const healthy = reportFixture();
  healthy.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  assert.equal(healthy.report.createReport().status, "HEALTHY");

  const healthyAtRateBoundary = reportFixture();
  for (let index = 0; index < 19; index += 1) healthyAtRateBoundary.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  healthyAtRateBoundary.metrics.record({ outcome: "FAILURE", durationMs: 1 });
  assert.equal(healthyAtRateBoundary.report.createReport().healthIndicators.successRate, 95);
  assert.equal(healthyAtRateBoundary.report.createReport().status, "HEALTHY");

  const warningByRate = reportFixture();
  for (let index = 0; index < 9; index += 1) warningByRate.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  warningByRate.metrics.record({ outcome: "FAILURE", durationMs: 1 });
  assert.equal(warningByRate.report.createReport().status, "WARNING");

  const warningAtRateBoundary = reportFixture();
  for (let index = 0; index < 4; index += 1) warningAtRateBoundary.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  warningAtRateBoundary.metrics.record({ outcome: "FAILURE", durationMs: 1 });
  assert.equal(warningAtRateBoundary.report.createReport().healthIndicators.successRate, 80);
  assert.equal(warningAtRateBoundary.report.createReport().status, "WARNING");

  const warningByBudget = reportFixture();
  warningByBudget.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  warningByBudget.budget.consume(80);
  assert.equal(warningByBudget.report.createReport().status, "WARNING");

  const criticalByRate = reportFixture();
  criticalByRate.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  criticalByRate.metrics.record({ outcome: "FAILURE", durationMs: 1 });
  assert.equal(criticalByRate.report.createReport().status, "CRITICAL");

  const criticalByBudget = reportFixture();
  criticalByBudget.metrics.record({ outcome: "SUCCESS", durationMs: 1 });
  criticalByBudget.budget.consume(100);
  assert.equal(criticalByBudget.report.createReport().status, "CRITICAL");
});

test("report contains aggregate numeric fields only and no sensitive dimensions", () => {
  const { report } = reportFixture();
  const response = report.createReport();
  assert.deepEqual(Object.keys(response), ["period", "status", "metrics", "healthIndicators"]);
  assert.ok(Object.values(response.metrics).every((value) => typeof value === "number"));
  assert.ok(Object.values(response.healthIndicators).every((value) => typeof value === "number"));
  const serialized = JSON.stringify(response).toLowerCase();
  for (const forbidden of ["message", "translationtext", "userid", "lineid", "credential", "token"]) assert.equal(serialized.includes(forbidden), false);
});
