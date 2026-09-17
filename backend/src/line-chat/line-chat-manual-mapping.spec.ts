import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LineChatManualMappingService } from "./line-chat-manual-mapping.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatNicknameSyncJobStatus } from "@prisma/client";
import { LineChatOperationsController } from "./line-chat-operations.controller";

function createMockPrisma() {
  const conversations = new Map<string, any>();
  const jobs = new Map<string, any>();
  const activityHistory: any[] = [];
  const auditLogs: any[] = [];

  const prisma: any = {
    conversation: {
      findUnique: async ({ where }: any) => conversations.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        let list = Array.from(conversations.values());
        if (where?.id?.in) list = list.filter((c) => where.id.in.includes(c.id));
        if (where?.lineOfficialAccountId) list = list.filter((c) => c.lineOfficialAccountId === where.lineOfficialAccountId);
        if (where?.lineChatUserId?.in) list = list.filter((c) => where.lineChatUserId.in.includes(c.lineChatUserId));
        return list;
      },
      findFirst: async ({ where }: any) => {
        let list = Array.from(conversations.values());
        if (where?.lineOfficialAccountId) list = list.filter((c) => c.lineOfficialAccountId === where.lineOfficialAccountId);
        if (where?.lineChatUserId) list = list.filter((c) => c.lineChatUserId === where.lineChatUserId);
        if (where?.id?.not) list = list.filter((c) => c.id !== where.id.not);
        return list[0] ?? null;
      },
      update: async ({ where, data }: any) => {
        const existing = conversations.get(where.id);
        if (!existing) throw new Error("Conversation not found");
        const updated = { ...existing, ...data };
        conversations.set(where.id, updated);
        return updated;
      },
    },
    lineChatNicknameSyncJob: {
      findMany: async ({ where }: any) => {
        let list = Array.from(jobs.values());
        if (where?.status) list = list.filter((j) => j.status === where.status);
        if (where?.lineChatUserId === null) list = list.filter((j) => !j.lineChatUserId);
        if (where?.conversation?.lineChatUserId === null) list = list.filter((j) => !conversations.get(j.conversationId)?.lineChatUserId);
        return list.map((j) => ({
          ...j,
          conversation: conversations.get(j.conversationId),
        }));
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, j] of jobs.entries()) {
          if (where.conversationId && j.conversationId !== where.conversationId) continue;
          if (where.status && j.status !== where.status) continue;
          jobs.set(id, { ...j, ...data });
          count++;
        }
        return { count };
      },
    },
    activityHistory: {
      create: async ({ data }: any) => {
        activityHistory.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
  };

  return { prisma, conversations, jobs, activityHistory, auditLogs };
}

void test("Manual Mapping - saves valid same-OA identity with MANUAL source and metadata", async () => {
  const { prisma, conversations, jobs, activityHistory, auditLogs } = createMockPrisma();
  const resolver = {} as LineChatRecentResolverService;
  const sessionService = {} as LineChatSessionService;
  const service = new LineChatManualMappingService(prisma, resolver, sessionService);

  const convId = "conv-chonburi-1";
  const oaId = "oa-chonburi";
  conversations.set(convId, {
    id: convId,
    lineOfficialAccountId: oaId,
    lineChatUserId: null,
    customer: { displayName: "Max" },
  });

  jobs.set("job-1", {
    id: "job-1",
    conversationId: convId,
    lineOfficialAccountId: oaId,
    status: LineChatNicknameSyncJobStatus.PENDING,
    lineChatUserId: null,
    lastError: "RESOLVE_AMBIGUOUS",
  });

  const result = await service.bindManualMapping({
    conversationId: convId,
    lineOfficialAccountId: oaId,
    lineChatUserId: "Uchat_max_real",
    operatorId: "admin-1",
    operatorDisplayName: "Store Manager",
  });

  assert.equal(result.success, true);
  assert.equal(result.lineChatUserId, "Uchat_max_real");

  const updatedConv = conversations.get(convId);
  assert.equal(updatedConv.lineChatUserId, "Uchat_max_real");
  assert.equal(updatedConv.lineChatMappingSource, "MANUAL");
  assert.equal(updatedConv.lineChatMappedById, "admin-1");
  assert.ok(updatedConv.lineChatMappedAt instanceof Date);

  // Nickname sync job is unblocked
  const updatedJob = jobs.get("job-1");
  assert.equal(updatedJob.lineChatUserId, "Uchat_max_real");
  assert.equal(updatedJob.lastError, null);

  // Audit logs created
  assert.equal(activityHistory.length, 1);
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, "LINE_CHAT_MANUAL_MAPPING");
});

void test("Manual Mapping - strictly rejects cross-OA or cross-store mapping attempt", async () => {
  const { prisma, conversations } = createMockPrisma();
  const service = new LineChatManualMappingService(prisma, {} as any, {} as any);

  conversations.set("conv-chonburi-1", {
    id: "conv-chonburi-1",
    lineOfficialAccountId: "oa-chonburi",
    lineChatUserId: null,
    customer: { displayName: "Max" },
  });

  await assert.rejects(
    () =>
      service.bindManualMapping({
        conversationId: "conv-chonburi-1",
        lineOfficialAccountId: "oa-centralworld", // Cross-OA mismatch!
        lineChatUserId: "Uchat_max",
        operatorId: "admin-1",
      }),
    BadRequestException,
  );
});

void test("Manual Mapping - requires explicit override when target LINE Chat ID is already mapped", async () => {
  const { prisma, conversations } = createMockPrisma();
  const service = new LineChatManualMappingService(prisma, {} as any, {} as any);

  const oaId = "oa-chonburi";
  conversations.set("conv-existing", {
    id: "conv-existing",
    lineOfficialAccountId: oaId,
    lineChatUserId: "Uchat_conflict",
    customer: { displayName: "Old Customer" },
  });

  conversations.set("conv-new", {
    id: "conv-new",
    lineOfficialAccountId: oaId,
    lineChatUserId: null,
    customer: { displayName: "Max" },
  });

  // 1. Without override -> throws ConflictException
  await assert.rejects(
    () =>
      service.bindManualMapping({
        conversationId: "conv-new",
        lineOfficialAccountId: oaId,
        lineChatUserId: "Uchat_conflict",
        operatorId: "admin-1",
        overrideConflict: false,
      }),
    ConflictException,
  );

  // 2. With override -> reassigns cleanly
  const res = await service.bindManualMapping({
    conversationId: "conv-new",
    lineOfficialAccountId: oaId,
    lineChatUserId: "Uchat_conflict",
    operatorId: "admin-1",
    overrideConflict: true,
  });

  assert.equal(res.success, true);
  assert.equal(conversations.get("conv-new").lineChatUserId, "Uchat_conflict");
  assert.equal(conversations.get("conv-existing").lineChatUserId, null);
});

void test("Manual Mapping - getUnresolvedBacklog returns items with mapping reasons", async () => {
  const { prisma, conversations, jobs } = createMockPrisma();
  const service = new LineChatManualMappingService(prisma, {} as any, {} as any);

  const convId = "conv-1";
  conversations.set(convId, {
    id: convId,
    customerSalesStatus: "PURCHASED",
    paymentMethod: "CASH",
    salesRecordedAt: new Date("2026-09-17T10:00:00Z"),
    latestMessageAt: new Date("2026-09-17T11:00:00Z"),
    customer: { displayName: "Max" },
    store: { id: "store-1", name: "OPPO BS RBS Chonburi", code: "28375" },
    lineOfficialAccount: { id: "oa-1", name: "OPPO BS RBS Chonburi" },
    messages: [{ originalText: "ขอข้อมูลการดาวน์หน่อยครับ", sentAt: new Date("2026-09-17T11:00:00Z") }],
  });

  jobs.set("job-1", {
    id: "job-1",
    conversationId: convId,
    status: LineChatNicknameSyncJobStatus.PENDING,
    nickname: "Reno 16 สด 09/26",
    lastError: "RESOLVE_AMBIGUOUS",
    createdAt: new Date(),
  });

  const backlog = await service.getUnresolvedBacklog();
  assert.equal(backlog.length, 1);
  assert.equal(backlog[0].customerDisplayName, "Max");
  assert.equal(backlog[0].mappingReason, "RESOLVE_AMBIGUOUS");
  assert.equal(backlog[0].storeCode, "28375");
  assert.equal(backlog[0].latestInboundMessage?.text, "ขอข้อมูลการดาวน์หน่อยครับ");
  assert.equal(backlog[0].nicknameTarget, "Reno 16 สด 09/26");
});

void test("Ambiguous resolver result remains blocked before manual mapping, manual mapping takes precedence after confirmation", async () => {
  const { prisma, conversations, jobs } = createMockPrisma();
  const service = new LineChatManualMappingService(prisma, {} as any, {} as any);

  const convId = "conv-ambiguous";
  const oaId = "oa-chonburi";
  conversations.set(convId, {
    id: convId,
    lineOfficialAccountId: oaId,
    lineChatUserId: null,
    customer: { displayName: "Max" },
  });

  jobs.set("job-ambig", {
    id: "job-ambig",
    conversationId: convId,
    lineOfficialAccountId: oaId,
    status: LineChatNicknameSyncJobStatus.PENDING,
    lineChatUserId: null,
    lastError: "RESOLVE_AMBIGUOUS",
  });

  // 1. Before manual mapping: unmapped, job has null lineChatUserId and lastError RESOLVE_AMBIGUOUS
  assert.equal(conversations.get(convId).lineChatUserId, null);
  assert.equal(jobs.get("job-ambig").lineChatUserId, null);

  // 2. Perform manual mapping
  await service.bindManualMapping({
    conversationId: convId,
    lineOfficialAccountId: oaId,
    lineChatUserId: "Uchat_max_selected",
    operatorId: "admin-1",
  });

  // 3. After confirmation: durable mapping is stored directly on conversation
  const mappedConv = conversations.get(convId);
  assert.equal(mappedConv.lineChatUserId, "Uchat_max_selected");
  assert.equal(mappedConv.lineChatMappingSource, "MANUAL");

  // 4. Job is unblocked with durable lineChatUserId and error cleared
  const mappedJob = jobs.get("job-ambig");
  assert.equal(mappedJob.lineChatUserId, "Uchat_max_selected");
  assert.equal(mappedJob.lastError, null);

  // 5. Backlog no longer lists this conversation as waiting for mapping
  const backlog = await service.getUnresolvedBacklog();
  assert.equal(backlog.some((item) => item.conversationId === convId), false);
});

void test("Manual Mapping - candidates query returns candidates and recent internal messages", async () => {
  const { prisma, conversations } = createMockPrisma();
  const mockResolver: any = {
    refreshSnapshot: async () => ({
      chats: [
        { chatUserId: "Uchat_1", displayName: "Max", lastMessageAt: "18:59", lastMessageText: "ขอข้อมูลการดาวน์หน่อยครับ" },
        { chatUserId: "Uchat_2", displayName: "Max Power", lastMessageAt: "14:20", lastMessageText: "hello" },
      ],
    }),
  };
  const mockSessionService: any = {
    resolveProfilePath: () => "/dummy/path",
  };

  const service = new LineChatManualMappingService(prisma, mockResolver, mockSessionService);

  const convId = "conv-candidates-test";
  conversations.set(convId, {
    id: convId,
    lineOfficialAccountId: "oa-chonburi",
    lineChatUserId: null,
    customer: { displayName: "Max" },
    store: { name: "OPPO BS RBS Chonburi" },
    lineOfficialAccount: {
      name: "OPPO BS RBS Chonburi",
      chatBotId: "bot-123",
      lineChatSession: { sessionKey: "profile-b" },
    },
    messages: [
      { id: "m1", direction: "INBOUND", originalText: "ขอข้อมูลการดาวน์หน่อยครับ", sentAt: new Date("2026-09-17T11:59:00Z") },
    ],
  });

  const res = await service.getMappingCandidates(convId);
  assert.equal(res.conversation.id, convId);
  assert.equal(res.conversation.customerDisplayName, "Max");
  assert.equal(res.candidates.length, 2);
  assert.equal(res.candidates[0].chatUserId, "Uchat_1");
  assert.equal(res.candidates[0].lastMessageText, "ขอข้อมูลการดาวน์หน่อยครับ");
  assert.equal(res.conversation.recentMessages.length, 1);
  assert.equal(res.conversation.recentMessages[0].text, "ขอข้อมูลการดาวน์หน่อยครับ");
});

import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { UserRole } from "@prisma/client";

void test("Manual Mapping - ADMIN authorization is enforced on manual mapping endpoints", async () => {
  const rolesGuardMeta = Reflect.getMetadata(REQUIRED_ROLES, LineChatOperationsController);
  assert.deepEqual(rolesGuardMeta, [UserRole.ADMIN]);
});


