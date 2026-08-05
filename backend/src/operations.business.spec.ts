import test from "node:test";
import assert from "node:assert/strict";
import { ConversationsService } from "./conversations.service";
import { ConversationsController } from "./conversations.controller";

test("business: sidebar operational count scenario and historical preservation", async () => {
  const resetDate = new Date("2026-08-05T16:00:00Z");
  // fake prisma that returns different groupBy results depending on whether a reset filter is present
  const fakePrisma: any = {
    store: { findMany: async () => [{ id: "storeA", name: "Store A" }] },
    conversation: {
      groupBy: async (opts: any) => {
        const where = opts.where || {};
        // If operational filter present (latestMessageAt.gte), return only 1 not-replied
        if (where.latestMessageAt && where.latestMessageAt.gte) {
          return [ { storeId: "storeA", bmReplyStatus: "NOT_REPLIED", _count: { _all: 1 } } ];
        }
        // before reset: 100 not replied
        return [ { storeId: "storeA", bmReplyStatus: "NOT_REPLIED", _count: { _all: 100 } } ];
      },
      // used for oldestUnanswered grouping
      groupBy_min: async () => [],
    },
    activityHistory: { findMany: async () => [] },
    conversationProduct: { groupBy: async () => [] },
    conversationTopic: { groupBy: async () => [] },
    productModel: { findMany: async () => [] },
    topic: { findMany: async () => [] },
  };

  // fake operations service that can toggle resetAt
  let currentReset: Date | null = null;
  const fakeOperations: any = {
    getOperationalConversationFilter: async () => (currentReset ? { latestMessageAt: { gte: currentReset } } : {}),
    getLatestResetAt: async () => currentReset,
  };

  const svc = new ConversationsService(fakePrisma, fakeOperations);
  const controller = new ConversationsController(svc, null as any, null as any, null as any);

  // Before reset: expect 100 notReplied
  currentReset = null;
  const before = await svc.getBmReplyStatusSummary();
  assert.equal(before.overview.notReplied, 100, "expected 100 notReplied before reset");

  // Create reset at 16:00
  currentReset = resetDate;
  const after = await svc.getBmReplyStatusSummary();
  assert.equal(after.overview.notReplied, 1, "expected 1 notReplied after reset");

  // Historical fetch: conversation A (15:59) should still be retrievable via controller.get
  const historicalConv = { id: "conv-A", latestMessageAt: new Date("2026-08-05T15:59:00Z"), bmReplyStatus: "NOT_REPLIED" };
  const fakeServiceForController: any = { get: async (id: string) => historicalConv };
  const controller2 = new ConversationsController(fakeServiceForController, null as any, null as any, null as any);
  const fetched = await controller2.get("conv-A");
  assert.equal((fetched as any).id, "conv-A", "historical conversation should still be fetchable");
});

test("business: store-priority-summary consistency across sidebar, dashboard, and priority ranking", async () => {
  // We'll simulate that store A had 100 before reset and 2 after reset
  const resetDate = new Date("2026-08-05T16:00:00Z");
  const fakePrisma: any = {
    store: { findMany: async () => [{ id: "storeA", name: "Store A" }] },
    conversation: {
      groupBy: async (opts: any) => {
        const where = opts.where || {};
        if (where.latestMessageAt && where.latestMessageAt.gte) return [ { storeId: "storeA", bmReplyStatus: "NOT_REPLIED", _count: { _all: 2 } } ];
        return [ { storeId: "storeA", bmReplyStatus: "NOT_REPLIED", _count: { _all: 100 } } ];
      },
    },
    conversationProduct: { groupBy: async () => [] },
    conversationTopic: { groupBy: async () => [] },
    activityHistory: { findMany: async () => [] },
  };
  let currentReset: Date | null = null;
  const fakeOperations: any = { getOperationalConversationFilter: async () => (currentReset ? { latestMessageAt: { gte: currentReset } } : {}) };
  const svc = new ConversationsService(fakePrisma, fakeOperations);
  const controller = new ConversationsController(svc, null as any, null as any, null as any);

  currentReset = null;
  const before = await svc.getBmReplyStatusSummary();
  const sidebarBefore = before.stores.find((s: any) => s.storeId === "storeA");
  assert.equal(sidebarBefore.notReplied, 100);

  currentReset = resetDate;
  const after = await svc.getBmReplyStatusSummary();
  const sidebarAfter = after.stores.find((s: any) => s.storeId === "storeA");
  assert.equal(sidebarAfter.notReplied, 2);

  // store-priority-summary endpoint uses getBmReplyStatusSummary internally — call controller
  const priority = await controller.storePrioritySummary();
  const priorityStore = priority.stores.find((s: any) => s.id === "storeA");
  assert.equal(priorityStore.notReplied, 2, "priority summary should match sidebar/dashboard operational counts after reset");
});
