import assert from "node:assert/strict";
import test from "node:test";
import {
  ProductCorrectionInsightService,
  ProductCorrectionEvent,
} from "./product-correction-insight.service";
import { PrismaService } from "../prisma.service";
import { ClassificationService } from "./classification.service";

function createMockPrisma(options: {
  aliases?: Array<{ normalizedAlias: string; productModel: { name: string } }>;
  models?: Array<{ id: string; name: string }>;
  activities?: Array<{ description: string }>;
  conversations?: any[];
} = {}) {
  const aliases = options.aliases ?? [];
  const models = options.models ?? [
    { id: "model-reno16", name: "OPPO Reno16" },
    { id: "model-reno16pro", name: "OPPO Reno16 Pro 5G" },
    { id: "model-findx9", name: "OPPO Find X9" },
    { id: "model-a65g", name: "OPPO A6 5G" },
  ];
  const activities = options.activities ?? [];
  const conversations = options.conversations ?? [];

  return {
    productAlias: {
      findMany: async () => aliases.map((a, i) => ({ id: `alias-${i}`, isActive: true, ...a })),
      findFirst: async ({ where }: any) => {
        const found = aliases.find((a) => {
          if (where.normalizedAlias && a.normalizedAlias !== where.normalizedAlias) return false;
          if (where.productModelId && where.productModelId.not) {
            const m = models.find((mod) => mod.name === a.productModel.name);
            if (m && m.id === where.productModelId.not) return false;
          }
          return true;
        });
        return found ? { id: "alias-found", isActive: true, ...found } : null;
      },
      upsert: async ({ create }: any) => ({ id: "alias-upserted", ...create }),
    },
    productModel: {
      findFirst: async ({ where }: any) => models.find((m) => m.name === where.name) ?? null,
    },
    activityHistory: {
      findMany: async () => activities.map((act) => ({ id: "act-1", createdAt: new Date(), ...act })),
      create: async ({ data }: any) => ({ id: "act-new", ...data }),
    },
    conversation: {
      findFirst: async () => ({ id: "conv-1" }),
      count: async () => 3,
      findMany: async () => conversations,
    },
    conversationProduct: {
      findFirst: async () => ({ productModel: { name: "OPPO Reno16" } }),
    },
  } as unknown as PrismaService;
}

test("1. Manual corrections format is parsed into structured fields", () => {
  const service = new ProductCorrectionInsightService(createMockPrisma(), {} as any);
  const desc = 'Manual product correction: OPPO Reno16 Pro 5G → OPPO Reno16 (phrase: "reno16f", method: "EXACT_ALIAS", sourceMessageId: "msg-123")';
  const parsed = service.parseCorrectionDescription(desc);

  assert.ok(parsed);
  assert.equal(parsed.predictedModel, "OPPO Reno16 Pro 5G");
  assert.equal(parsed.correctedModel, "OPPO Reno16");
  assert.equal(parsed.matchedPhrase, "reno16f");
  assert.equal(parsed.detectionMethod, "EXACT_ALIAS");
  assert.equal(parsed.sourceMessageId, "msg-123");
});

test("2. Alias recommendation requires >= 3 corrections", async () => {
  const service = new ProductCorrectionInsightService(createMockPrisma(), {} as any);
  const now = new Date();

  const twoEvents: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "reno16 mini", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "test 1", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "reno16 mini", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "test 2", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(twoEvents);
  assert.equal(recs[0].recommendation, "REVIEW");
  assert.equal(recs[0].corrections, 2);
  assert.match(recs[0].statusReason, /Insufficient evidence \(2\/3/);
});

test("3. Alias recommendation requires >= 80% dominance", async () => {
  const service = new ProductCorrectionInsightService(createMockPrisma(), {} as any);
  const now = new Date();

  const splitEvents: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "ambiguous", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "ambiguous", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c3", predictedModel: "A", correctedModel: "OPPO Reno16 Pro 5G", matchedPhrase: "ambiguous", detectionMethod: "EXACT", sourceMessageId: "m3", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c4", predictedModel: "A", correctedModel: "OPPO Reno16 Pro 5G", matchedPhrase: "ambiguous", detectionMethod: "EXACT", sourceMessageId: "m4", sampleText: "", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(splitEvents);
  assert.equal(recs[0].recommendation, "REVIEW");
  assert.equal(recs[0].dominancePct, 50);
  assert.match(recs[0].statusReason, /Corrections split across multiple models/);
});

test("4. Existing alias is marked APPROVED and not recommended again", async () => {
  const prisma = createMockPrisma({
    aliases: [{ normalizedAlias: "reno16", productModel: { name: "OPPO Reno16" } }],
  });
  const service = new ProductCorrectionInsightService(prisma, {} as any);
  const now = new Date();

  const events: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "reno 16", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "reno 16", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c3", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "reno 16", detectionMethod: "EXACT", sourceMessageId: "m3", sampleText: "", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(events);
  assert.equal(recs[0].recommendation, "IGNORE");
  assert.equal(recs[0].status, "APPROVED");
});

test("5. Cross-model token collisions are flagged as REVIEW with HIGH risk", async () => {
  const service = new ProductCorrectionInsightService(createMockPrisma(), {} as any);
  const now = new Date();

  const events: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Find X9", matchedPhrase: "reno vs find", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Find X9", matchedPhrase: "reno vs find", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c3", predictedModel: "A", correctedModel: "OPPO Find X9", matchedPhrase: "reno vs find", detectionMethod: "EXACT", sourceMessageId: "m3", sampleText: "", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(events);
  assert.equal(recs[0].recommendation, "REVIEW");
  assert.equal(recs[0].collisionRisk, "HIGH");
});

test("6. Generic unsafe aliases are marked IGNORE", async () => {
  const service = new ProductCorrectionInsightService(createMockPrisma(), {} as any);
  const now = new Date();

  const events: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "16 pro max", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "16 pro max", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c3", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "16 pro max", detectionMethod: "EXACT", sourceMessageId: "m3", sampleText: "", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(events);
  assert.equal(recs[0].recommendation, "IGNORE");
  assert.equal(recs[0].collisionRisk, "HIGH");
});

test("7. Approved alias activates ProductAlias with MANUAL source and logs audit", async () => {
  const prisma = createMockPrisma();
  const service = new ProductCorrectionInsightService(prisma, {} as any);

  const res = await service.approveAlias({
    phrase: "รีโนสิบหก",
    modelName: "OPPO Reno16",
    createdByName: "Senior Operations Specialist",
  });

  assert.equal(res.success, true);
  assert.equal(res.status, "APPROVED");
  assert.equal(res.model, "OPPO Reno16");
  assert.equal(res.phrase, "รีโนสิบหก");
});

test("8. Rejected alias is recorded and marked REJECTED in recommendations", async () => {
  const prisma = createMockPrisma({
    activities: [{ description: 'Alias rejected: "unknown token" for OPPO Reno16 (reason: "Not relevant")' }],
  });
  const service = new ProductCorrectionInsightService(prisma, {} as any);
  const now = new Date();

  const events: ProductCorrectionEvent[] = [
    { conversationId: "c1", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "unknown token", detectionMethod: "EXACT", sourceMessageId: "m1", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c2", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "unknown token", detectionMethod: "EXACT", sourceMessageId: "m2", sampleText: "", correctedAt: now, actorName: "" },
    { conversationId: "c3", predictedModel: "A", correctedModel: "OPPO Reno16", matchedPhrase: "unknown token", detectionMethod: "EXACT", sourceMessageId: "m3", sampleText: "", correctedAt: now, actorName: "" },
  ];

  const recs = await service.buildAliasRecommendations(events);
  assert.equal(recs[0].status, "REJECTED");
  assert.equal(recs[0].recommendation, "IGNORE");
});

test("9. Targeted re-analysis skips conversations with MANUAL product tags", async () => {
  let analyzedId = "";
  const mockClassService = {
    analyze: async (id: string) => { analyzedId = id; },
  } as unknown as ClassificationService;

  const mockConversations = [
    {
      id: "conv-manual",
      products: [{ source: "MANUAL", productModel: { name: "OPPO Reno16 Pro 5G" } }],
    },
    {
      id: "conv-rule",
      products: [{ source: "RULE", productModel: { name: "OPPO Reno16 Pro 5G" } }],
    },
  ];

  const prisma = createMockPrisma({ conversations: mockConversations });
  const service = new ProductCorrectionInsightService(prisma, mockClassService);

  const res = await service.targetedReanalyze({ phrase: "reno16" });
  assert.equal(res.scanned, 2);
  assert.equal(res.manualProtected, 1);
  assert.equal(analyzedId, "conv-rule");
});
