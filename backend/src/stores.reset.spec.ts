import test from "node:test";
import assert from "node:assert/strict";
import { StoresController } from "./stores.controller";
import { REQUIRED_ROLES } from "./auth/auth.decorators";

test("StoresController.list returns operationalConversationCount (total) and operationalNotRepliedCount (waiting badge)", async () => {
  const resetAt = new Date("2026-08-05T12:00:00Z");
  const fakeOperations: any = {
    getOperationalConversationFilter: async () => ({ latestMessageAt: { gte: resetAt } }),
  };

  const fakePrisma: any = {
    store: {
      findMany: async () => [
        {
          id: "s-1",
          name: "OBS Central World",
          archivedAt: null,
          _count: { conversations: 40, lineOfficialAccounts: 2 },
        },
      ],
    },
    conversation: {
      groupBy: async (opts: any) => {
        assert.deepEqual(opts.where.latestMessageAt, { gte: resetAt });
        // Given: NOT_REPLIED = 5, NOTIFIED_BM = 3, REPLIED = 10
        return [
          { storeId: "s-1", bmReplyStatus: "NOT_REPLIED", _count: { _all: 5 } },
          { storeId: "s-1", bmReplyStatus: "NOTIFIED_BM", _count: { _all: 3 } },
          { storeId: "s-1", bmReplyStatus: "REPLIED", _count: { _all: 10 } },
        ];
      },
    },
  };

  const storeAccess = { accessibleStoreIds: async () => null } as never;
  const controller = new StoresController(fakePrisma, fakeOperations, storeAccess);
  const result = await controller.list(undefined, { user: { role: "ADMIN" } } as never);

  assert.equal(result.length, 1);
  assert.equal(result[0]._count.conversations, 40); // Historical total preserved
  assert.equal(result[0]._count.operationalNotRepliedCount, 5); // Waiting badge = NOT_REPLIED = 5
  assert.equal(result[0]._count.operationalConversationCount, 18); // Total operational conversations = 5 + 3 + 10 = 18
});

test("StoresController.summary uses bmReplyStatus and excludes pre-reset conversations", async () => {
  const resetAt = new Date("2026-08-05T12:00:00Z");
  const fakeOperations: any = {
    getOperationalConversationFilter: async () => ({ latestMessageAt: { gte: resetAt } }),
  };

  const fakePrisma: any = {
    store: {
      findUnique: async () => ({ id: "s-1", name: "OBS Central World", lineOfficialAccounts: [] }),
    },
    conversation: {
      groupBy: async (opts: any) => {
        assert.equal(opts.where.storeId, "s-1");
        assert.deepEqual(opts.where.latestMessageAt, { gte: resetAt });
        return [
          { bmReplyStatus: "NOT_REPLIED", _count: { _all: 5 } },
          { bmReplyStatus: "NOTIFIED_BM", _count: { _all: 3 } },
          { bmReplyStatus: "REPLIED", _count: { _all: 10 } },
        ];
      },
    },
  };

  const storeAccess = { assertStoreAccess: async () => undefined } as never;
  const controller = new StoresController(fakePrisma, fakeOperations, storeAccess);
  const summary = await controller.summary("s-1", { user: { role: "ADMIN" } } as never);

  assert.equal(summary.notReplied, 5);
  assert.equal(summary.notifiedBm, 3);
  assert.equal(summary.replied, 10);
  assert.equal(summary.total, 18);
  assert.deepEqual(summary.byStatus, {
    NOT_REPLIED: 5,
    NOTIFIED_BM: 3,
    REPLIED: 10,
  });
});

test("StoresController.list scopes store reads to the authenticated user's active stores", async () => {
  let capturedWhere: unknown;
  let capturedConversationWhere: any;
  const fakeOperations: any = { getOperationalConversationFilter: async () => ({}) };
  const fakePrisma: any = {
    store: { findMany: async (options: { where: unknown }) => { capturedWhere = options.where; return []; } },
    conversation: { groupBy: async (options: { where: unknown }) => { capturedConversationWhere = options.where; return []; } },
  };
  const storeAccess = { accessibleStoreIds: async () => ["s-1"] } as never;
  const controller = new StoresController(fakePrisma, fakeOperations, storeAccess);

  await controller.list(undefined, { user: { role: "VIEWER" } } as never);

  assert.deepEqual(capturedWhere, { id: { in: ["s-1"] }, archivedAt: null });
  assert.deepEqual(capturedConversationWhere.store, { archivedAt: null, id: { in: ["s-1"] } });
});

test("store mutations require ADMIN role metadata", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, StoresController.prototype.archive), ["ADMIN"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, StoresController.prototype.restore), ["ADMIN"]);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, StoresController.prototype.remove), ["ADMIN"]);
});
