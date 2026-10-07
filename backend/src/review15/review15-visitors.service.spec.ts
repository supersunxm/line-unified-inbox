import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import {
  hashReview15VisitorId,
  REVIEW15_VISITOR_PAGE_KEY,
  Review15VisitorsService,
} from "./review15-visitors.service";

test("Review15 visitor counter hashes browser IDs and upserts the same browser once", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    publicPageVisitor: {
      upsert: async (args: Record<string, unknown>) => {
        calls.push(args);
        return {};
      },
      count: async () => 37,
    },
  } as unknown as PrismaService;

  const service = new Review15VisitorsService(prisma);
  const visitorId = "123e4567-e89b-42d3-a456-426614174000";

  const result = await service.recordVisitor(visitorId);

  assert.deepEqual(result, {
    totalVisitors: 37,
    approximate: true,
  });
  assert.equal(calls.length, 1);

  const call = calls[0] as {
    where: { pageKey_visitorHash: { pageKey: string; visitorHash: string } };
    create: { pageKey: string; visitorHash: string };
  };

  assert.equal(call.create.pageKey, REVIEW15_VISITOR_PAGE_KEY);
  assert.equal(call.create.visitorHash, hashReview15VisitorId(visitorId));
  assert.equal(call.create.visitorHash.length, 64);
  assert.notEqual(call.create.visitorHash, visitorId);
  assert.deepEqual(call.where.pageKey_visitorHash, call.create);
});

test("Review15 visitor hashes are deterministic but isolated by the canonical page key", () => {
  const visitorId = "123e4567-e89b-42d3-a456-426614174000";
  const first = hashReview15VisitorId(visitorId);
  const second = hashReview15VisitorId(visitorId);
  const other = hashReview15VisitorId("123e4567-e89b-42d3-a456-426614174001");

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^[0-9a-f]{64}$/);
});
