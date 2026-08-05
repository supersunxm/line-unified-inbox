import test from "node:test";
import assert from "node:assert/strict";
import { ConversationsService } from "./conversations.service";

test("getBmReplyStatusSummary merges operational filter into groupBy where", async () => {
  const calls: any[] = [];
  const fakePrisma: any = {
    store: { findMany: async () => [{ id: "s1", name: "Store 1" }] },
    conversation: {
      groupBy: async (opts: any) => { calls.push(opts); return []; },
      // used later for _min grouping
    },
    conversationProduct: { groupBy: async () => [] },
    conversationTopic: { groupBy: async () => [] },
    activityHistory: { findMany: async () => [] },
  };
  const resetAt = new Date("2026-08-05T16:00:00Z");
  const fakeOperations: any = { getOperationalConversationFilter: async () => ({ latestMessageAt: { gte: resetAt } }) };
  const svc = new ConversationsService(fakePrisma, fakeOperations);
  // Call the method under test
  const result = await svc.getBmReplyStatusSummary();
  // Ensure groupBy was called and where includes latestMessageAt.gte
  assert.ok(calls.length >= 1, "expected at least one groupBy call");
  const where = calls[0].where;
  // @ts-expect-error mock shape: latestMessageAt.gte is a Date in the fake prisma
  assert.ok(where.latestMessageAt && where.latestMessageAt.gte instanceof Date && where.latestMessageAt.gte.toISOString() === resetAt.toISOString());
});

import { ConversationsController } from "./conversations.controller";

test("historical conversation fetch returns conversation regardless of reset", async () => {
  const expected = { id: "c-old", latestMessageAt: new Date("2020-01-01T00:00:00Z") };
  const fakeService: any = { get: async (id: string) => expected };
  const controller = new ConversationsController(fakeService, null as any, null as any, null as any);
  const got = await controller.get("c-old");
  assert.deepEqual(got, expected);
});
