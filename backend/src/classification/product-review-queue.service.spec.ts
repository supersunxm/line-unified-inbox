import assert from "node:assert/strict";
import test from "node:test";
import { ProductReviewQueueService } from "./product-review-queue.service";
import { PrismaService } from "../prisma.service";

test("ProductReviewQueueService: Deterministic classification logic", () => {
  const service = new ProductReviewQueueService({} as any);

  // 1. P0 UNCLASSIFIED: Inbound text, 0 products
  const p0 = service.classifyReviewNeed([], [], true);
  assert.equal(p0.reason, "UNCLASSIFIED");
  assert.equal(p0.priority, "P0");

  // 2. P1 AMBIGUOUS: Multiple products
  const p1 = service.classifyReviewNeed(
    [
      { productModelId: "1", productModel: { name: "OPPO Reno16" }, confidence: 0.9, source: "RULE", detectionMethod: "EXACT_ALIAS", matchedPhrase: "reno16" },
      { productModelId: "2", productModel: { name: "OPPO Find X9" }, confidence: 0.9, source: "RULE", detectionMethod: "EXACT_ALIAS", matchedPhrase: "find x9" },
    ],
    [],
    true,
  );
  assert.equal(p1.reason, "AMBIGUOUS");
  assert.equal(p1.priority, "P1");

  // 3. P2 LOW CONFIDENCE: Confidence < 0.85 or COMPACT_ALIAS
  const p2a = service.classifyReviewNeed(
    [{ productModelId: "1", productModel: { name: "OPPO Reno16" }, confidence: 0.75, source: "RULE", detectionMethod: "FUZZY", matchedPhrase: "reno" }],
    [],
    true,
  );
  assert.equal(p2a.reason, "LOW_CONFIDENCE");
  assert.equal(p2a.priority, "P2");

  const p2b = service.classifyReviewNeed(
    [{ productModelId: "1", productModel: { name: "OPPO Reno16" }, confidence: 0.95, source: "RULE", detectionMethod: "COMPACT_ALIAS", matchedPhrase: "reno16" }],
    [],
    true,
  );
  assert.equal(p2b.reason, "LOW_CONFIDENCE");
  assert.equal(p2b.priority, "P2");

  // 4. P3 SERIES ONLY: Series model
  const p3 = service.classifyReviewNeed(
    [{ productModelId: "1", productModel: { name: "OPPO Reno Series" }, confidence: 0.95, source: "RULE", detectionMethod: "SERIES_MATCH", matchedPhrase: "reno" }],
    [],
    true,
  );
  assert.equal(p3.reason, "SERIES_ONLY");
  assert.equal(p3.priority, "P3");

  // 5. P4 RECENTLY CORRECTED: Has MANUAL tag or No product confirmed
  const p4a = service.classifyReviewNeed(
    [{ productModelId: "1", productModel: { name: "OPPO Reno16" }, confidence: 1.0, source: "MANUAL", detectionMethod: null, matchedPhrase: null }],
    [],
    true,
  );
  assert.equal(p4a.reason, "RECENTLY_CORRECTED");
  assert.equal(p4a.priority, "P4");

  const p4b = service.classifyReviewNeed(
    [],
    [{ description: "No product confirmed: human verified no product mentioned" }],
    true,
  );
  assert.equal(p4b.reason, "RECENTLY_CORRECTED");
  assert.equal(p4b.priority, "P4");

  // 6. P5 GOOD: High confidence specific model
  const p5 = service.classifyReviewNeed(
    [{ productModelId: "1", productModel: { name: "OPPO Reno16" }, confidence: 0.98, source: "RULE", detectionMethod: "EXACT_ALIAS", matchedPhrase: "reno16" }],
    [],
    true,
  );
  assert.equal(p5.reason, "GOOD");
  assert.equal(p5.priority, "P5");

  // 7. No text at all -> P5 (not needing review)
  const noText = service.classifyReviewNeed([], [], false);
  assert.equal(noText.reason, "GOOD");
  assert.equal(noText.priority, "P5");
});

test("ProductReviewQueueService: Actions (Confirm, Correct, No Product)", async () => {
  let createdActivity: any = null;
  let updatedProducts: any = null;
  let deletedProducts = false;

  const mockPrisma = {
    conversation: {
      findUnique: async () => ({
        id: "conv-123",
        products: [
          {
            productModelId: "model-1",
            source: "RULE",
            confidence: 0.9,
            matchedPhrase: "reno 16",
            detectionMethod: "EXACT_ALIAS",
            sourceMessageId: "msg-1",
            productModel: { id: "model-1", name: "OPPO Reno16" },
          },
        ],
      }),
    },
    productModel: {
      findUnique: async () => ({ id: "model-2", name: "OPPO Reno16 Pro 5G" }),
    },
    conversationProduct: {
      updateMany: async (args: any) => { updatedProducts = args; },
      deleteMany: async () => { deletedProducts = true; },
      create: async (args: any) => ({ id: "cp-new", ...args.data }),
    },
    activityHistory: {
      create: async (args: any) => { createdActivity = args.data; },
    },
    $transaction: async (fn: any) => fn(mockPrisma),
  } as unknown as PrismaService;

  const service = new ProductReviewQueueService(mockPrisma);

  // Test Action A: Confirm
  const confirmRes = await service.confirmProduct({
    conversationId: "conv-123",
    createdByName: "Review Specialist",
  });
  assert.equal(confirmRes.success, true);
  assert.equal(confirmRes.action, "CONFIRM");
  assert.match(createdActivity.description, /Product tag confirmed: OPPO Reno16/);

  // Test Action B: Correct
  const correctRes = await service.correctProduct({
    conversationId: "conv-123",
    productModelId: "model-2",
    createdByName: "Review Specialist",
  });
  assert.equal(correctRes.success, true);
  assert.equal(correctRes.action, "CORRECT");
  assert.equal(correctRes.newModel, "OPPO Reno16 Pro 5G");
  assert.match(createdActivity.description, /Manual product correction: OPPO Reno16 → OPPO Reno16 Pro 5G/);

  // Test Action C: No Product
  const noProdRes = await service.confirmNoProduct({
    conversationId: "conv-123",
    createdByName: "Review Specialist",
  });
  assert.equal(noProdRes.success, true);
  assert.equal(noProdRes.action, "NO_PRODUCT");
  assert.match(createdActivity.description, /No product confirmed: human verified no product mentioned/);
});
