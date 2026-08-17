import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

const admin = { id: "admin-1", role: UserRole.ADMIN };
const bm = { id: "bm-1", role: UserRole.VIEWER };

function controllerFor(accessibleStoreIds: string[] | null | (() => Promise<never>), calls: unknown[], serviceOverride?: unknown) {
  const storeAccess = {
    accessibleStoreIds: async () => typeof accessibleStoreIds === "function" ? accessibleStoreIds() : accessibleStoreIds,
  };
  const service = serviceOverride ?? {
    getBmReplyStatusSummary: async (scope: string[] | null) => {
      calls.push(scope);
      return { stores: [], overview: { notReplied: 0, notifiedBm: 0, replied: 0 } };
    },
  };
  return new ConversationsController(service as never, null as never, null as never, null as never, storeAccess as never);
}

void test("summary controllers pass ADMIN global scope and BM assigned-store scope to the service", async () => {
  const adminCalls: unknown[] = [];
  const adminController = controllerFor(null, adminCalls);
  await adminController.bmReplyStatusSummary({ user: admin } as never);
  assert.deepEqual(adminCalls, [null]);

  const bmCalls: unknown[] = [];
  const bmController = controllerFor(["store-a"], bmCalls);
  await bmController.storePrioritySummary({ user: bm } as never);
  assert.deepEqual(bmCalls, [["store-a"]]);
});

void test("inactive or unauthorized membership cannot reach summary aggregation", async () => {
  let serviceCalled = false;
  const controller = controllerFor(async () => {
    throw new ForbiddenException("No active store membership");
  }, [], {
    getBmReplyStatusSummary: () => { serviceCalled = true; },
  });

  await assert.rejects(
    () => controller.bmReplyStatusSummary({ user: bm } as never),
    ForbiddenException,
  );
  assert.equal(serviceCalled, false);
});

void test("conversation summary queries retain an explicit store scope, including an empty scope", async () => {
  const storeWheres: unknown[] = [];
  const conversationWheres: unknown[] = [];
  const prisma = {
    store: {
      findMany: async ({ where }: { where: unknown }) => {
        storeWheres.push(where);
        return [{ id: "store-a", name: "Store A", storeMaster: { externalStoreId: null } }];
      },
    },
    conversation: {
      groupBy: async ({ where, _min }: { where: unknown; _min?: unknown }) => {
        conversationWheres.push(where);
        return _min ? [] : [{ storeId: "store-a", bmReplyStatus: "NOT_REPLIED", _count: { _all: 2 } }];
      },
    },
  };
  const operations = { getOperationalConversationFilter: async () => ({}) };
  const service = new ConversationsService(prisma as never, operations as never);

  await service.getBmReplyStatusSummary(["store-a"]);
  await service.getBmReplyStatusSummary([]);
  await assert.rejects(() => service.getBmReplyStatusSummary(undefined), ForbiddenException);

  assert.deepEqual((storeWheres[0] as { id: { in: string[] } }).id.in, ["store-a"]);
  assert.deepEqual((conversationWheres[0] as { store: { id: { in: string[] } } }).store.id.in, ["store-a"]);
  assert.deepEqual((storeWheres[1] as { id: { in: string[] } }).id.in, []);
  assert.deepEqual((conversationWheres[2] as { store: { id: { in: string[] } } }).store.id.in, []);
});
