import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole, BmReplyStatus, FollowUpStatus } from "@prisma/client";
import { ConversationsService } from "./conversations.service";
import { PrismaService } from "./prisma.service";
import { OperationsService } from "./operations/operations.service";
import { StoreAccessService } from "./auth/store-access.service";
import { AuditLogService, AuditLogInput } from "./auth/audit-log.service";
import type { AuthUser } from "./auth/auth.guard";

const noopOperations = {
  getOperationalConversationFilter: async () => ({}),
  getLatestResetAt: async () => null,
} as unknown as OperationsService;

const adminUser: AuthUser = {
  id: "admin-1",
  email: "admin@oppo.com",
  displayName: "Admin Operator",
  role: UserRole.ADMIN,
  isActive: true,
};

const storeUser: AuthUser = {
  id: "bm-user-1",
  email: "bm@oppo.com",
  displayName: "Store BM",
  role: UserRole.STORE_MANAGER,
  isActive: true,
};

test("bulkMarkReplied: successfully marks conversations as REPLIED and creates activity and audit logs", async () => {
  const recordedAuditLogs: AuditLogInput[] = [];
  const recordedActivityHistory: any[] = [];
  let updatedConversationWhere: any;
  let updatedConversationData: any;

  const mockConversations = [
    {
      id: "conv-1",
      storeId: "store-central-world",
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      followUpStatus: FollowUpStatus.FOLLOW_UP,
      store: { id: "store-central-world", name: "OBS Central World" },
    },
    {
      id: "conv-2",
      storeId: "store-central-world",
      bmReplyStatus: BmReplyStatus.NOTIFIED_BM,
      followUpStatus: FollowUpStatus.FOLLOW_UP,
      store: { id: "store-central-world", name: "OBS Central World" },
    },
  ];

  const fakePrisma = {
    conversation: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        return mockConversations.filter((c) => where.id.in.includes(c.id));
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        conversation: {
          updateMany: async ({ where, data }: { where: any; data: any }) => {
            updatedConversationWhere = where;
            updatedConversationData = data;
            return { count: mockConversations.length };
          },
        },
        activityHistory: {
          create: async ({ data }: { data: any }) => {
            recordedActivityHistory.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  } as unknown as PrismaService;

  const fakeStoreAccess = {
    assertStoreAccess: async (_user: AuthUser, _storeId: string) => {
      // Authorized
    },
  } as unknown as StoreAccessService;

  const fakeAuditLog = {
    record: async (input: AuditLogInput) => {
      recordedAuditLogs.push(input);
    },
  } as unknown as AuditLogService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
    fakeAuditLog,
  );

  const result = await service.bulkMarkReplied(["conv-1", "conv-2"], adminUser);

  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 2);
  assert.equal(result.affectedCount, 2);
  assert.equal(result.storeId, "store-central-world");
  assert.equal(result.status, BmReplyStatus.REPLIED);

  // Verify conversation update
  assert.deepEqual(updatedConversationWhere, { id: { in: ["conv-1", "conv-2"] } });
  assert.equal(updatedConversationData.bmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(updatedConversationData.followUpStatus, FollowUpStatus.COMPLETED);
  assert.ok(updatedConversationData.updatedAt instanceof Date);

  // Verify activity history created for each conversation
  assert.equal(recordedActivityHistory.length, 2);
  assert.equal(recordedActivityHistory[0].conversationId, "conv-1");
  assert.equal(recordedActivityHistory[0].previousBmReplyStatus, BmReplyStatus.NOT_REPLIED);
  assert.equal(recordedActivityHistory[0].newBmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(recordedActivityHistory[0].metadata.actionType, "BULK_MARK_REPLIED");
  assert.equal(recordedActivityHistory[0].metadata.storeId, "store-central-world");
  assert.equal(recordedActivityHistory[0].createdByUserId, adminUser.id);

  // Verify audit log created
  assert.equal(recordedAuditLogs.length, 1);
  assert.equal(recordedAuditLogs[0].action, "BULK_MARK_REPLIED");
  assert.equal(recordedAuditLogs[0].actorUserId, adminUser.id);
  assert.equal((recordedAuditLogs[0].metadata as any).storeId, "store-central-world");
  assert.equal((recordedAuditLogs[0].metadata as any).storeName, "OBS Central World");
  assert.equal((recordedAuditLogs[0].metadata as any).affectedCount, 2);
});

test("bulkMarkReplied: blocks unauthorized store access with 403 ForbiddenException", async () => {
  const mockConversations = [
    {
      id: "conv-1",
      storeId: "store-unauthorized",
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      followUpStatus: FollowUpStatus.FOLLOW_UP,
      store: { id: "store-unauthorized", name: "Unauthorized Store" },
    },
  ];

  const fakePrisma = {
    conversation: {
      findMany: async () => mockConversations,
    },
  } as unknown as PrismaService;

  const fakeStoreAccess = {
    assertStoreAccess: async () => {
      throw new ForbiddenException("Store access is forbidden");
    },
  } as unknown as StoreAccessService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
  );

  await assert.rejects(
    () => service.bulkMarkReplied(["conv-1"], storeUser),
    (err: any) => err instanceof ForbiddenException && err.message.includes("Store access is forbidden"),
  );
});

test("bulkMarkReplied: rejects mixed-store conversation IDs with ForbiddenException", async () => {
  const mockConversations = [
    {
      id: "conv-store-a",
      storeId: "store-a",
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      followUpStatus: FollowUpStatus.FOLLOW_UP,
      store: { id: "store-a", name: "Store A" },
    },
    {
      id: "conv-store-b",
      storeId: "store-b",
      bmReplyStatus: BmReplyStatus.NOT_REPLIED,
      followUpStatus: FollowUpStatus.FOLLOW_UP,
      store: { id: "store-b", name: "Store B" },
    },
  ];

  const fakePrisma = {
    conversation: {
      findMany: async () => mockConversations,
    },
  } as unknown as PrismaService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
  );

  await assert.rejects(
    () => service.bulkMarkReplied(["conv-store-a", "conv-store-b"], adminUser),
    (err: any) => err instanceof ForbiddenException && err.message.includes("multiple stores"),
  );
});

test("bulkMarkReplied: validates empty input and missing conversation IDs", async () => {
  const fakePrisma = {
    conversation: {
      findMany: async () => [],
    },
  } as unknown as PrismaService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
  );

  await assert.rejects(
    () => service.bulkMarkReplied([], adminUser),
    (err: any) => err instanceof BadRequestException,
  );

  await assert.rejects(
    () => service.bulkMarkReplied(["missing-1", "missing-2"], adminUser),
    (err: any) => err instanceof NotFoundException,
  );
});

test("bulkMarkRepliedByFilter: ADMIN marks all NOT_REPLIED across all stores (1,466 conversations)", async () => {
  const recordedAuditLogs: AuditLogInput[] = [];
  let updatedWhere: any;
  let updatedData: any;

  // Generate 1466 mock conversations across 10 different stores
  const mockAllConversations = Array.from({ length: 1466 }, (_, idx) => ({
    id: `conv-${idx + 1}`,
    storeId: `store-${(idx % 10) + 1}`,
    bmReplyStatus: BmReplyStatus.NOT_REPLIED,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
  }));

  const fakePrisma = {
    conversation: {
      findMany: async ({ where }: { where: any }) => {
        assert.equal(where.bmReplyStatus, BmReplyStatus.NOT_REPLIED);
        return mockAllConversations;
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        conversation: {
          updateMany: async ({ where, data }: { where: any; data: any }) => {
            updatedWhere = where;
            updatedData = data;
            return { count: mockAllConversations.length };
          },
        },
        activityHistory: {
          createMany: async () => ({ count: 100 }),
        },
      };
      return callback(tx);
    },
  } as unknown as PrismaService;

  const fakeStoreAccess = {
    accessibleStoreIds: async (user: AuthUser) => {
      return user.role === UserRole.ADMIN ? null : ["store-1"];
    },
    assertStoreAccess: async () => {},
  } as unknown as StoreAccessService;

  const fakeAuditLog = {
    record: async (input: AuditLogInput) => {
      recordedAuditLogs.push(input);
    },
  } as unknown as AuditLogService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
    fakeAuditLog,
  );

  const result = await service.bulkMarkRepliedByFilter({ bmReplyStatus: BmReplyStatus.NOT_REPLIED, storeId: "all" }, adminUser);

  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1466);
  assert.equal(result.affectedCount, 1466);
  assert.equal(result.status, BmReplyStatus.REPLIED);
  assert.equal(updatedData.bmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(updatedData.followUpStatus, FollowUpStatus.COMPLETED);
  assert.equal(recordedAuditLogs.length, 1);
  assert.equal(recordedAuditLogs[0].action, "BULK_MARK_REPLIED");
  assert.equal(recordedAuditLogs[0].actorUserId, adminUser.id);
  assert.equal((recordedAuditLogs[0].metadata as any).affectedCount, 1466);
});

test("bulkMarkRepliedByFilter: BM marks own store conversations successfully", async () => {
  const mockStoreConversations = Array.from({ length: 45 }, (_, idx) => ({
    id: `conv-store-1-${idx + 1}`,
    storeId: "store-1",
    bmReplyStatus: BmReplyStatus.NOT_REPLIED,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
  }));

  const fakePrisma = {
    store: {
      findUnique: async () => ({ id: "store-1", name: "OBS Central World" }),
    },
    conversation: {
      findMany: async ({ where }: { where: any }) => {
        assert.equal(where.storeId, "store-1");
        return mockStoreConversations;
      },
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        conversation: {
          updateMany: async () => ({ count: 45 }),
        },
        activityHistory: {
          createMany: async () => ({ count: 45 }),
        },
      };
      return callback(tx);
    },
  } as unknown as PrismaService;

  const fakeStoreAccess = {
    accessibleStoreIds: async () => ["store-1"],
    assertStoreAccess: async (_user: AuthUser, storeId: string) => {
      assert.equal(storeId, "store-1");
    },
  } as unknown as StoreAccessService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
  );

  const result = await service.bulkMarkRepliedByFilter({ bmReplyStatus: BmReplyStatus.NOT_REPLIED, storeId: "store-1" }, storeUser);

  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 45);
  assert.equal(result.affectedCount, 45);
});

test("bulkMarkRepliedByFilter: BM trying to mark all stores is rejected with 403 ForbiddenException", async () => {
  const fakeStoreAccess = {
    accessibleStoreIds: async () => ["store-1"],
  } as unknown as StoreAccessService;

  const service = new ConversationsService(
    {} as any,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
  );

  await assert.rejects(
    () => service.bulkMarkRepliedByFilter({ bmReplyStatus: BmReplyStatus.NOT_REPLIED, storeId: "all" }, storeUser),
    (err: any) => err instanceof ForbiddenException && err.message.includes("restricted to ADMIN"),
  );
});

test("bulkMarkRepliedByFilter: pagination independence — updates database records without depending on loaded page limit", async () => {
  const totalDatabaseConversations = 850;
  const mockDbConversations = Array.from({ length: totalDatabaseConversations }, (_, idx) => ({
    id: `conv-${idx + 1}`,
    storeId: "store-central",
    bmReplyStatus: BmReplyStatus.NOT_REPLIED,
    followUpStatus: FollowUpStatus.FOLLOW_UP,
  }));

  const fakePrisma = {
    store: {
      findUnique: async () => ({ id: "store-central", name: "OBS Central" }),
    },
    conversation: {
      findMany: async () => mockDbConversations,
    },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const tx = {
        conversation: {
          updateMany: async () => ({ count: totalDatabaseConversations }),
        },
        activityHistory: {
          createMany: async () => ({ count: totalDatabaseConversations }),
        },
      };
      return callback(tx);
    },
  } as unknown as PrismaService;

  const fakeStoreAccess = {
    accessibleStoreIds: async () => ["store-central"],
    assertStoreAccess: async () => {},
  } as unknown as StoreAccessService;

  const service = new ConversationsService(
    fakePrisma,
    noopOperations,
    undefined as any,
    undefined as any,
    undefined as any,
    fakeStoreAccess,
  );

  // Even if frontend only displays 50 rows per page, bulkMarkRepliedByFilter updates all 850
  const result = await service.bulkMarkRepliedByFilter({ bmReplyStatus: BmReplyStatus.NOT_REPLIED, storeId: "store-central" }, adminUser);
  assert.equal(result.updatedCount, 850);
});

