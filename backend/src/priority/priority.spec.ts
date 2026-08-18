import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { calculatePriority } from "./priority-calculator";
import { PriorityService } from "./priority.service";
import type { PriorityContext, PriorityMessage } from "./priority.types";

const now = new Date("2026-08-16T12:00:00.000Z");

function context(messages: PriorityMessage[], overrides: Partial<PriorityContext> = {}): PriorityContext {
  return { bmReplyStatus: "NOT_REPLIED", isInstallment: false, hasManualProductTag: false, messages, ...overrides };
}

function inbound(hoursAgo: number, id = `in-${hoursAgo}`, baseTime?: Date): PriorityMessage {
  const ref = baseTime || now;
  return { id, direction: "INBOUND", sentAt: new Date(ref.getTime() - hoursAgo * 60 * 60 * 1000), senderUserId: null };
}

function outbound(hoursAgo: number, senderUserId: string | null = "bm-1", baseTime?: Date): PriorityMessage {
  const ref = baseTime || now;
  return { id: `out-${hoursAgo}`, direction: "OUTBOUND", sentAt: new Date(ref.getTime() - hoursAgo * 60 * 60 * 1000), senderUserId };
}

void test("no messages produces NONE", () => {
  assert.deepEqual(calculatePriority(context([]), now), { score: 0, level: "NONE", waitingSeconds: 0, waitingSince: null, reasons: [] });
});

void test("only outbound messages produce NONE", () => {
  const result = calculatePriority(context([outbound(1)]), now);
  assert.equal(result.level, "NONE");
  assert.equal(result.score, 0);
});

void test("unanswered inbound under four hours is NORMAL", () => {
  const result = calculatePriority(context([inbound(2)]), now);
  assert.equal(result.score, 50);
  assert.equal(result.level, "NORMAL");
  assert.deepEqual(result.reasons, ["NEEDS_REPLY"]);
});

void test("waiting age adds the 4, 12, and 24 hour bands", () => {
  assert.equal(calculatePriority(context([inbound(5)]), now).score, 65);
  assert.equal(calculatePriority(context([inbound(13)]), now).score, 80);
  assert.equal(calculatePriority(context([inbound(25)]), now).score, 100);
  assert.equal(calculatePriority(context([inbound(25)]), now).level, "URGENT");
});

void test("installment keyword adds 20 points and reason", () => {
  const result = calculatePriority(context([inbound(2)], { isInstallment: true }), now);
  assert.equal(result.score, 70);
  assert.deepEqual(result.reasons, ["NEEDS_REPLY", "INSTALLMENT_CUSTOMER"]);
});

void test("manual product adds 10 points and reason", () => {
  const result = calculatePriority(context([inbound(2)], { hasManualProductTag: true }), now);
  assert.equal(result.score, 60);
  assert.deepEqual(result.reasons, ["NEEDS_REPLY", "MANUAL_PRODUCT_TAG"]);
});

void test("replied status with human outbound clears waiting score and produces NONE", () => {
  const result = calculatePriority(
    context([inbound(2), outbound(1)], { isInstallment: true, hasManualProductTag: true }),
    now
  );
  assert.equal(result.score, 0);
  assert.equal(result.level, "NONE");
});

void test("unanswered inbound after staff reply calculates waiting from latest inbound", () => {
  const result = calculatePriority(context([inbound(5, "old"), outbound(4), inbound(1, "new")]), now);
  assert.equal(result.score, 50);
  assert.equal(result.level, "NORMAL");
  assert.equal(result.waitingSeconds, 3600);
});

void test("priority score is capped at 140", () => {
  const result = calculatePriority(
    context([inbound(26, "in-1"), inbound(25, "in-2")], { isInstallment: true, hasManualProductTag: true }),
    now
  );
  assert.equal(result.score, 140);
  assert.equal(result.level, "URGENT");
});

void test("multiple unanswered inbound messages count as one case with a bonus", () => {
  const result = calculatePriority(context([inbound(3, "in-1"), inbound(2, "in-2")]), now);
  assert.equal(result.score, 60);
  assert.ok(result.reasons.includes("MULTIPLE_UNANSWERED_INBOUND"));
});

void test("priority service scopes ADMIN and assigned BM queries", async () => {
  const captured: unknown[] = [];
  const testNow = new Date();
  const prisma = {
    conversation: {
      findMany: async (args: unknown) => {
        captured.push(args);
        return [
          {
            id: "conversation-1",
            bmReplyStatus: "NOT_REPLIED",
            isInstallment: false,
            products: [],
            messages: [inbound(2, "in-2", testNow)],
          },
        ];
      },
    },
  };
  const stores = { accessibleStoreIds: async () => ["store-1"] };
  const service = new PriorityService(prisma as never, stores as never);
  const result = await service.forConversationIds(
    { id: "bm-1", email: "bm@example.com", displayName: "BM", role: "VIEWER", isActive: true },
    ["conversation-1"]
  );
  assert.equal(result.get("conversation-1")?.level, "NORMAL");
  assert.deepEqual((captured[0] as { where: Record<string, unknown> }).where.storeId, { in: ["store-1"] });

  const adminStores = { accessibleStoreIds: async () => null };
  const adminService = new PriorityService(prisma as never, adminStores as never);
  await adminService.forConversationIds(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN", isActive: true },
    ["conversation-1"]
  );
  assert.equal("storeId" in (captured[1] as { where: Record<string, unknown> }).where, false);
});

void test("priority service rejects cross-store direct access", async () => {
  const service = new PriorityService(
    {} as never,
    {
      assertConversationAccess: async () => {
        throw new ForbiddenException("Store access is forbidden");
      },
    } as never
  );
  await assert.rejects(
    () => service.forConversation({ id: "bm-1", email: "bm@example.com", displayName: "BM", role: "VIEWER", isActive: true }, "other-store"),
    ForbiddenException
  );
});

void test("priority service only considers MANUAL products", async () => {
  let captured: unknown;
  const testNow = new Date();
  const prisma = {
    conversation: {
      findMany: async (args: unknown) => {
        captured = args;
        return [
          {
            id: "conversation-1",
            bmReplyStatus: "NOT_REPLIED",
            isInstallment: false,
            products: [{ productModelId: "manual" }],
            messages: [inbound(2, "in-2", testNow)],
          },
        ];
      },
    },
  };
  const service = new PriorityService(prisma as never, { accessibleStoreIds: async () => ["store-1"] } as never);
  const priority = await service.forConversationIds(
    { id: "bm-1", email: "bm@example.com", displayName: "BM", role: "VIEWER", isActive: true },
    ["conversation-1"]
  );
  assert.ok(priority.get("conversation-1")?.reasons.includes("MANUAL_PRODUCT_TAG"));
  assert.deepEqual((captured as { select: { products: { where: unknown } } }).select.products.where, { source: "MANUAL" });
});
