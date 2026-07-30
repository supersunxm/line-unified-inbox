import assert from "node:assert/strict";
import test from "node:test";
import { IS_PUBLIC } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";
import { ClassificationInsightsController } from "./classification-insights.controller";
import { ClassificationInsightsService } from "./classification-insights.service";

function createPrismaMock(conversationCounts = [100, 80, 60, 50, 15, 5, 20, 4]) {
  const calls: { conversationCounts: unknown[]; reviewQuery?: unknown } = {
    conversationCounts: [],
  };
  const countQueue = [...conversationCounts];
  const productGroupQueue = [
    [{ productModelId: "model-a6", _count: { _all: 30 } }],
    [
      { productModelId: "model-a6", source: "RULE", _count: { _all: 25 } },
      { productModelId: "model-a6", source: "MANUAL", _count: { _all: 5 } },
    ],
    [{ productModelId: "model-a6", _count: { _all: 8 } }],
  ];
  const modelCountQueue = [9, 2, 1];
  const aliasCountQueue = [80, 5, 75, 10];
  const prisma = {
    conversation: {
      count: (args: unknown) => {
        calls.conversationCounts.push(args);
        return Promise.resolve(countQueue.shift() ?? 0);
      },
      groupBy: () => Promise.resolve([
        { purchaseIntent: "HIGH", _count: { _all: 4 } },
        { purchaseIntent: "MEDIUM", _count: { _all: 3 } },
      ]),
      findMany: (args: unknown) => {
        calls.reviewQuery = args;
        return Promise.resolve([{
        id: "conversation-review",
        latestMessageAt: new Date("2026-07-30T12:00:00.000Z"),
        priority: "HIGH",
        purchaseIntent: "HIGH",
        store: { id: "store-1", name: "Store One" },
        lineOfficialAccount: { id: "oa-1", name: "OA One" },
        topics: [{ topic: { name: "Price Inquiry", category: "SALES" } }],
        }]);
      },
    },
    conversationProduct: {
      groupBy: () => Promise.resolve(productGroupQueue.shift() ?? []),
      count: (() => {
        const values = [8, 50];
        return () => Promise.resolve(values.shift() ?? 0);
      })(),
    },
    productModel: {
      count: () => Promise.resolve(modelCountQueue.shift() ?? 0),
      findMany: () => Promise.resolve([{
        id: "model-a6",
        name: "OPPO A6 5G",
        productSeries: { name: "A Series", productGroup: "SMARTPHONE" },
      }]),
    },
    productAlias: {
      count: () => Promise.resolve(aliasCountQueue.shift() ?? 0),
    },
    $queryRaw: () => Promise.resolve([{
      matchedPhrase: "a6 5g",
      modelName: "OPPO A6 5G",
      count: 8,
      latestEvidenceAt: new Date("2026-07-30T11:00:00.000Z"),
    }]),
    $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  return { prisma: prisma as unknown as PrismaService, calls };
}

void test("classification insights calculates current coverage with distinct source buckets", async () => {
  const service = new ClassificationInsightsService(createPrismaMock().prisma);
  const result = await service.getInsights();

  assert.deepEqual(result.coverage, {
    totalConversations: 100,
    textEligibleConversations: 80,
    classifiedConversations: 60,
    coverageRate: 75,
    ruleClassified: 50,
    manualClassified: 15,
    mixedSource: 5,
    noProduct: 20,
    highIntentWithoutProduct: 4,
  });
  assert.deepEqual(result.productRanking[0], {
    productModelId: "model-a6",
    modelName: "OPPO A6 5G",
    familyName: "A Series",
    productGroup: "SMARTPHONE",
    conversationCount: 30,
    ruleCount: 25,
    manualCount: 5,
    compactCount: 8,
  });
  assert.equal(result.definitions.accuracyMeasured, false);
  assert.equal(result.compactMonitoring.totalCompactMatches, 8);
  assert.equal(result.compactMonitoring.percentageOfRuleMatches, 16);
});

void test("review queue is bounded metadata without message text or customer PII", async () => {
  const state = createPrismaMock();
  const service = new ClassificationInsightsService(state.prisma);
  const result = await service.getInsights();
  const serialized = JSON.stringify(result);

  assert.deepEqual(result.reviewQueue[0]?.reasonCodes, [
    "HIGH_PURCHASE_INTENT",
    "HIGH_PRIORITY",
    "COMMERCIAL_TOPIC",
  ]);
  assert.doesNotMatch(serialized, /originalText|displayName|lineUserId|rawPayload/i);
  assert.match(serialized, /conversation-review/);
  assert.match(JSON.stringify(state.calls.conversationCounts), /"archivedAt":null/);
  assert.match(JSON.stringify(state.calls.conversationCounts), /"direction":"INBOUND","messageType":"TEXT"/);
  assert.match(JSON.stringify(state.calls.reviewQuery), /"take":25/);
});

void test("empty eligible denominator returns zero coverage and null percentages", async () => {
  const service = new ClassificationInsightsService(createPrismaMock([0, 0, 0, 0, 0, 0, 0, 0]).prisma);
  const result = await service.getInsights();

  assert.equal(result.coverage.coverageRate, 0);
  assert.equal(result.funnel.every(({ percentageOfEligible }) => percentageOfEligible === null), true);
  assert.equal(Number.isNaN(result.coverage.coverageRate), false);
});

void test("catalog health and opportunity intent breakdown use current persisted state", async () => {
  const service = new ClassificationInsightsService(createPrismaMock().prisma);
  const result = await service.getInsights();

  assert.deepEqual(result.opportunityGap, {
    highIntentWithoutProduct: 4,
    byIntent: { HIGH: 4, MEDIUM: 3 },
  });
  assert.deepEqual({
    activeModels: result.catalogHealth.activeModels,
    inactiveModels: result.catalogHealth.inactiveModels,
    activeAliases: result.catalogHealth.activeAliases,
    inactiveAliases: result.catalogHealth.inactiveAliases,
    catalogAliases: result.catalogHealth.catalogAliases,
    manualAliases: result.catalogHealth.manualAliases,
    modelsWithoutActiveCatalogAliases: result.catalogHealth.modelsWithoutActiveCatalogAliases,
  }, {
    activeModels: 9,
    inactiveModels: 2,
    activeAliases: 80,
    inactiveAliases: 5,
    catalogAliases: 75,
    manualAliases: 10,
    modelsWithoutActiveCatalogAliases: 1,
  });
});

void test("GET /classification-insights inherits the global authentication guard", () => {
  assert.equal(Reflect.getMetadata("path", ClassificationInsightsController), "classification-insights");
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC, ClassificationInsightsController), true);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC, ClassificationInsightsController.prototype.getInsights), true);
});
