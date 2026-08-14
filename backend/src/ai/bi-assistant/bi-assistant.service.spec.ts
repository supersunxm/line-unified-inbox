import test from "node:test";
import assert from "node:assert/strict";
import { BiAssistantService } from "./bi-assistant.service";
import { QueryAnalyzerService } from "./query-analyzer.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";
import { BIQueryIntent } from "./bi-assistant.types";

test("BiAssistantService test suite", async (t) => {
  const mockAnalytics: any = {
    getAnalytics: async () => ({
      period: "today",
      summaryCards: { messagesToday: 18420, messagesDiffPct: 28, pendingCount: 9, responseRate24h: 0.82 },
      operationHealth: { responseRate24h: 0.82, totalMessagesToday: 18420 },
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
      slaRiskPrediction: [{ storeName: "Robinson Chonburi" }],
      needActionQueue: [{ storeName: "Robinson Chonburi", pending: 9 }],
      topProducts: [{ name: "OPPO Reno 12 Pro" }],
    }),
  };

  const mockRootCause: any = {
    generateRootCauseInsights: async () => ({
      summary: "Peak hour message surge",
      confidence: 94,
      totalAffectedStores: 1,
      insights: [{ recommendation: "Assign float backup responder 18:00-22:00" }],
    }),
  };

  const mockBrief: any = {
    generateExecutiveBrief: async () => ({
      overallStatus: "ATTENTION",
    }),
  };

  const analyzer = new QueryAnalyzerService();
  const telemetryService = new AiTelemetryService(mockAnalytics);
  const service = new BiAssistantService(
    analyzer,
    mockAnalytics,
    mockRootCause,
    mockBrief,
    telemetryService,
  );

  await t.test("should classify SLA question intent accurately", () => {
    const res = analyzer.analyzeQuery("Why SLA dropped today?");
    assert.equal(res.intent, BIQueryIntent.SLA_ANALYSIS);
    assert.ok(res.confidence >= 0.9);
  });

  await t.test("should classify Store Risk question intent accurately", () => {
    const res = analyzer.analyzeQuery("Which store needs attention?");
    assert.equal(res.intent, BIQueryIntent.STORE_RISK);
  });

  await t.test("should synthesize evidence-backed BI answer", async () => {
    const answer = await service.answerQuery("Why SLA dropped today?", "today", "HEAD_OFFICE");

    assert.ok(answer);
    assert.equal(answer.intent, BIQueryIntent.SLA_ANALYSIS);
    assert.ok(answer.summary.includes("SLA"));
    assert.ok(answer.evidence.length > 0);
    assert.ok(answer.affectedStores.includes("Robinson Chonburi"));
    assert.ok(answer.confidence >= 90);
  });
});
