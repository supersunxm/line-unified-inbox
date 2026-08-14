import test from "node:test";
import assert from "node:assert/strict";
import { ImpactEngineService } from "./impact-engine.service";
import { ImpactCalculationService } from "./impact-calculation.service";

test("ImpactEngineService test suite", async (t) => {
  const mockPrisma: any = {
    actionImpactResult: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ ...data, evaluatedAt: new Date() }),
    },
  };

  const mockAnalytics: any = {
    getAnalytics: async () => ({
      period: "today",
      storeRanking: [{ storeName: "Robinson Chonburi" }],
    }),
  };

  const calculationService = new ImpactCalculationService();
  const service = new ImpactEngineService(
    mockPrisma,
    mockAnalytics,
    calculationService,
  );

  await t.test("should calculate impact score and classify effectiveness accurately", () => {
    const res = calculationService.calculateImpact(12, 87, 9, 1, 35, 8);
    assert.ok(res.impactScore >= 80);
    assert.equal(res.effectiveness, "SUCCESS");
    assert.equal(res.slaImprovementPct, 75);
  });

  await t.test("should generate Action Impact Summary with self-learning patterns", async () => {
    const summary = await service.getActionImpactSummary("today", "HEAD_OFFICE");
    assert.ok(summary);
    assert.ok(summary.totalEvaluated > 0);
    assert.ok(summary.successRatePct > 0);
    assert.ok(summary.learnedPatterns.length > 0);
  });
});
