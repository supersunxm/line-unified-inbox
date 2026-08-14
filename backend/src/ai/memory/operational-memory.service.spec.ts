import test from "node:test";
import assert from "node:assert/strict";
import { OperationalMemoryService } from "./operational-memory.service";

test("OperationalMemoryService test suite", async (t) => {
  const mockPrisma: any = {
    operationalMemoryCase: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ ...data, lastAppliedAt: new Date() }),
    },
  };

  const mockAnalytics: any = {
    getAnalytics: async () => ({
      period: "today",
      storeRanking: [{ storeName: "Robinson Chonburi" }],
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
    }),
  };

  const service = new OperationalMemoryService(
    mockPrisma,
    mockAnalytics,
  );

  await t.test("should retrieve operational memory summary with confidence scores", async () => {
    const summary = await service.getMemorySummary("today", "HEAD_OFFICE");
    assert.ok(summary);
    assert.ok(summary.totalStoredCases > 0);
    assert.ok(summary.avgConfidencePct >= 90);
    assert.ok(summary.topSlaLiftCase.includes("Robinson Chonburi"));
  });
});
