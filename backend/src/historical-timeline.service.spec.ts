import assert from "node:assert/strict";
import test from "node:test";
import { MessageDeliveryStatus, MessageDirection, MessageType } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { PrismaService } from "./prisma.service";
import {
  buildHistoricalVirtualConversationId,
  calculateUnifiedReplyCycleAudit,
  calculateUnifiedReplyCycles,
  classifyResponseDuration,
  HistoricalTimelineService,
  isHistoricalReplyEvidence,
  isKnownHistoricalStaffResponder,
  mapHistoricalTimelineMessage,
} from "./historical-timeline.service";

test("Historical virtual conversation IDs are deterministic and scoped by OA and chat identity", () => {
  const id = buildHistoricalVirtualConversationId("oa-1", "chat-1");
  assert.equal(id, buildHistoricalVirtualConversationId("oa-1", "chat-1"));
  assert.notEqual(id, buildHistoricalVirtualConversationId("oa-2", "chat-1"));
  assert.notEqual(id, buildHistoricalVirtualConversationId("oa-1", "chat-2"));
  assert.ok(id.startsWith("historical:"));
});

test("virtual Historical discovery leaves only chats without direct, safe-link, or canonical source anchors", async () => {
  const queries: string[] = [];
  const prisma = {
    $queryRaw: async (query: { sql: string }) => {
      queries.push(query.sql);
      return queries.length === 1 ? [{ total: 0n }] : [];
    },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.listVirtualChats({ id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser, { storeId: "store-1" });

  assert.equal(result.total, 0);
  assert.equal(queries.length, 2);
  for (const query of queries) {
    assert.match(query, /HistoricalConversationCrosswalk/);
    assert.match(query, /LINK_SAFE/);
    assert.match(query, /canonicalConversationId/);
    assert.match(query, /HistoricalTimelineMessage.*JOIN public\."Message"/s);
    assert.match(query, /externalMessageId/);
  }
});

test("Historical messages remain text-only and expose no inferred staff name", () => {
  const base = {
    id: "hist-1",
    sourceEventId: "event:message:stable-id",
    sourceEventType: "messageSent",
    text: "Historical text",
    sentAt: new Date("2026-09-01T01:00:00.000Z"),
    direction: MessageDirection.OUTBOUND,
  };
  const staff = mapHistoricalTimelineMessage({ ...base, senderBizId: "biz-1" });
  const automatic = mapHistoricalTimelineMessage({ ...base, senderBizId: "__AUTO_RESPONSE" });

  assert.equal(staff.historical, true);
  assert.equal(staff.originalText, "Historical text");
  assert.equal(staff.sender?.displayName, "Store staff");
  assert.equal(staff.media, null);
  assert.equal(automatic.sender?.displayName, "Automated response");
});

test("Historical responder identity only accepts a source bizId that is not the auto-response marker", () => {
  assert.equal(isKnownHistoricalStaffResponder("biz-1"), true);
  assert.equal(isKnownHistoricalStaffResponder(null), false);
  assert.equal(isKnownHistoricalStaffResponder("  "), false);
  assert.equal(isKnownHistoricalStaffResponder("__AUTO_RESPONSE"), false);
});

test("Historical reply evidence accepts non-auto outbound even when responder identity is unknown", () => {
  assert.equal(isHistoricalReplyEvidence("biz-1"), true);
  assert.equal(isHistoricalReplyEvidence(null), true);
  assert.equal(isHistoricalReplyEvidence(""), true);
  assert.equal(isHistoricalReplyEvidence("__AUTO_RESPONSE"), false);
});

test("24-hour reply classification includes the exact 24-hour boundary", () => {
  const inbound = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(classifyResponseDuration(inbound, new Date(inbound.getTime() + 24 * 60 * 60 * 1000)), "WITHIN_24H");
  assert.equal(classifyResponseDuration(inbound, new Date(inbound.getTime() + 24 * 60 * 60 * 1000 + 1)), "OVER_24H");
});

test("response-cycle helper creates multiple SLA cases inside one chat", () => {
  const base = {
    messageType: MessageType.TEXT,
    source: "HISTORICAL" as const,
    sourceEventId: null,
    externalMessageId: null,
    senderUserId: null,
    senderDisplayName: null,
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
    rawPayload: null,
    text: "text",
  };
  const messages = [
    { ...base, id: "in-1", sourceEventType: "messageReceived", direction: MessageDirection.INBOUND, sentAt: new Date("2026-09-01T00:00:00.000Z"), senderBizId: null },
    { ...base, id: "in-2", sourceEventType: "messageReceived", direction: MessageDirection.INBOUND, sentAt: new Date("2026-09-01T00:05:00.000Z"), senderBizId: null },
    { ...base, id: "out-1", sourceEventType: "messageSent", direction: MessageDirection.OUTBOUND, sentAt: new Date("2026-09-01T00:30:00.000Z"), senderBizId: "biz-1" },
    { ...base, id: "in-3", sourceEventType: "messageReceived", direction: MessageDirection.INBOUND, sentAt: new Date("2026-09-01T03:00:00.000Z"), senderBizId: null },
    { ...base, id: "auto", sourceEventType: "messageSent", direction: MessageDirection.OUTBOUND, sentAt: new Date("2026-09-01T03:05:00.000Z"), senderBizId: "__AUTO_RESPONSE" },
    { ...base, id: "out-2", sourceEventType: "messageSent", direction: MessageDirection.OUTBOUND, sentAt: new Date("2026-09-01T03:20:00.000Z"), senderBizId: null },
  ];
  const cycles = calculateUnifiedReplyCycles(
    messages,
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
  );
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0]?.firstInbound.id, "in-1");
  assert.equal(cycles[0]?.humanReply?.id, "out-1");
  assert.equal(cycles[1]?.firstInbound.id, "in-3");
  assert.equal(cycles[1]?.humanReply?.id, "out-2");
});
test("historical messageSent without responder identity still closes the official KPI cycle", () => {
  const base = {
    messageType: MessageType.TEXT,
    source: "HISTORICAL" as const,
    sourceEventId: null,
    externalMessageId: null,
    senderUserId: null,
    senderDisplayName: null,
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
    rawPayload: null,
    text: "text",
  };
  const audit = calculateUnifiedReplyCycleAudit(
    [
      {
        ...base,
        id: "in",
        sourceEventType: "messageReceived",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
        senderBizId: null,
      },
      {
        ...base,
        id: "out",
        sourceEventType: "messageSent",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-01T00:10:00.000Z"),
        senderBizId: null,
      },
    ],
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
  );

  assert.equal(audit.status, "DETERMINISTIC");
  assert.equal(audit.cycles.length, 1);
  assert.equal(audit.cycles[0]?.humanReply?.id, "out");
});

test("generic historical outbound with unknown actor is excluded as ambiguous", () => {
  const base = {
    messageType: MessageType.TEXT,
    source: "HISTORICAL" as const,
    sourceEventId: null,
    externalMessageId: null,
    senderUserId: null,
    senderDisplayName: null,
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
    rawPayload: null,
    text: "text",
  };
  const audit = calculateUnifiedReplyCycleAudit(
    [
      {
        ...base,
        id: "in",
        sourceEventType: "messageReceived",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
        senderBizId: null,
      },
      {
        ...base,
        id: "out",
        sourceEventType: "message",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-01T00:10:00.000Z"),
        senderBizId: null,
      },
    ],
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
  );

  assert.equal(audit.status, "AMBIGUOUS");
  if (audit.status === "AMBIGUOUS") {
    assert.equal(audit.reason, "UNKNOWN_OUTBOUND_ACTOR");
  }
});

test("same-timestamp inbound and staff reply is excluded as ordering conflict", () => {
  const base = {
    messageType: MessageType.TEXT,
    source: "HISTORICAL" as const,
    sourceEventId: null,
    externalMessageId: null,
    senderUserId: null,
    senderDisplayName: null,
    deliveryStatus: MessageDeliveryStatus.DELIVERED,
    rawPayload: null,
    text: "text",
  };
  const audit = calculateUnifiedReplyCycleAudit(
    [
      {
        ...base,
        id: "in",
        sourceEventType: "messageReceived",
        direction: MessageDirection.INBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
        senderBizId: null,
      },
      {
        ...base,
        id: "out",
        sourceEventType: "messageSent",
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date("2026-09-01T00:00:00.000Z"),
        senderBizId: "biz-1",
      },
    ],
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-02T00:00:00.000Z"),
  );

  assert.equal(audit.status, "AMBIGUOUS");
  if (audit.status === "AMBIGUOUS") {
    assert.equal(audit.reason, "ORDERING_CONFLICT");
  }
});

test("reply analytics merges an exact live duplicate with Historical text and uses a proven Manager responder key", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:inbound",
      sourceEventType: "messageReceived",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-outbound",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:outbound",
      sourceEventType: "messageSent",
      direction: MessageDirection.OUTBOUND,
      text: "Staff response",
      sentAt: new Date(inboundAt.getTime() + 30 * 60_000),
      senderBizId: "biz-1",
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: {
      findMany: async () => [{
        id: "conversation-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "chat-1",
        messages: [{
          id: "current-inbound",
          externalMessageId: "line-chat-manager:event:inbound",
          direction: MessageDirection.INBOUND,
          messageType: MessageType.TEXT,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          originalText: "Customer message",
          sentAt: inboundAt,
          senderUserId: null,
          senderDisplayName: null,
          rawPayload: null,
        }],
      }],
    },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics({ id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser, {
    dateFrom: "2026-09-01",
    dateTo: "2026-09-01",
  });

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.within24h, 1);
  assert.equal(result.sources.exactDuplicatesSuppressed, 1);
  assert.equal(result.sources.historicalTextMessages, 1);
  assert.equal(result.responderCoverage.knownHistoricalReplyCycles, 1);
  assert.equal(result.responders[0]?.source, "LINE_MANAGER_BIZ_ID");
  assert.equal(result.responders[0]?.total, 1);
  assert.notEqual(result.responders[0]?.responderKey, "biz-1");
});

test("reply bucket details include Historical-only chats and ignore automatic replies", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:inbound",
      direction: MessageDirection.INBOUND,
      text: "Historical customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-auto-reply",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:auto",
      direction: MessageDirection.OUTBOUND,
      text: "Automatic response",
      sentAt: new Date(inboundAt.getTime() + 10 * 60_000),
      senderBizId: "__AUTO_RESPONSE",
    },
    {
      id: "historical-human-reply",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:staff",
      direction: MessageDirection.OUTBOUND,
      text: "Staff response",
      sentAt: new Date(inboundAt.getTime() + 30 * 60_000),
      senderBizId: "biz-1",
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    customer: { findMany: async () => [] },
    conversation: { findMany: async () => [] },
    historicalTimelineMessage: { findMany: async () => history },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.responseBucketDetails({ id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser, {
    bucket: "under4h",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-01",
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.conversationId, buildHistoricalVirtualConversationId("oa-1", "chat-1"));
  assert.equal(result.items[0]?.customerName, "Historical LINE chat");
  assert.equal(result.items[0]?.inboundText, "Historical customer message");
  assert.equal(result.items[0]?.responseMinutes, 30);
});

test("reply bucket details merge Historical replies into a canonical conversation by OA and chat identity", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:inbound",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-reply",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:outbound",
      direction: MessageDirection.OUTBOUND,
      text: "Historical staff response",
      sentAt: new Date(inboundAt.getTime() + 30 * 60_000),
      senderBizId: "biz-1",
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    customer: { findMany: async () => [] },
    conversation: {
      findMany: async () => [{
        id: "conversation-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: "chat-1",
        customer: { displayName: "Customer One" },
        store: { name: "Store One" },
        messages: [{
          id: "current-inbound",
          externalMessageId: "line-chat-manager:event:inbound",
          direction: MessageDirection.INBOUND,
          messageType: MessageType.TEXT,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          originalText: "Customer message",
          sentAt: inboundAt,
          senderUserId: null,
          senderDisplayName: null,
          rawPayload: null,
        }],
      }],
    },
    historicalTimelineMessage: { findMany: async () => history },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.responseBucketDetails({ id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser, {
    bucket: "under4h",
    dateFrom: "2026-09-01",
    dateTo: "2026-09-01",
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.conversationId, "conversation-1");
  assert.equal(result.items[0]?.customerName, "Customer One");
  assert.equal(result.items[0]?.responseMinutes, 30);
});


test("reply analytics counts Historical outbound without responder identity as a reply", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound-unknown-responder",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:inbound-unknown",
      sourceEventType: "messageReceived",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-outbound-unknown-responder",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:outbound-unknown",
      sourceEventType: "messageSent",
      direction: MessageDirection.OUTBOUND,
      text: "Store response",
      sentAt: new Date(inboundAt.getTime() + 45 * 60_000),
      senderBizId: null,
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: { findMany: async () => [] },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-01", dateTo: "2026-09-01" },
  );

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.responded, 1);
  assert.equal(result.overview.within24h, 1);
  assert.equal(result.overview.pending, 0);
  assert.equal(result.overview.knownResponderReplies, 0);
  assert.equal(result.overview.unknownResponderReplies, 1);
  assert.equal(result.responders.length, 0);
});

test("reply analytics still excludes Historical auto-response evidence", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound-auto",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:inbound-auto",
      sourceEventType: "messageReceived",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-auto-only",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
      sourceEventId: "event:auto-only",
      sourceEventType: "messageSent",
      direction: MessageDirection.OUTBOUND,
      text: "Automatic response",
      sentAt: new Date(inboundAt.getTime() + 5 * 60_000),
      senderBizId: "__AUTO_RESPONSE",
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: { findMany: async () => [] },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-01", dateTo: "2026-09-01" },
  );

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.responded, 0);
  assert.equal(result.overview.within24h, 0);
  assert.equal(result.overview.pending, 1);
  assert.equal(result.overview.knownResponderReplies, 0);
  assert.equal(result.overview.unknownResponderReplies, 0);
});

test("reply analytics RESPONSE_CYCLES mode counts repeated customer-contact episodes", async () => {
  const history = [
    {
      id: "in-1", storeId: "store-1", lineOfficialAccountId: "oa-1", lineChatUserId: "chat-1",
      sourceEventId: "event:in-1", sourceEventType: "messageReceived", direction: MessageDirection.INBOUND,
      text: "First question", sentAt: new Date("2026-09-01T01:00:00.000Z"), senderBizId: null,
    },
    {
      id: "out-1", storeId: "store-1", lineOfficialAccountId: "oa-1", lineChatUserId: "chat-1",
      sourceEventId: "event:out-1", sourceEventType: "messageSent", direction: MessageDirection.OUTBOUND,
      text: "First answer", sentAt: new Date("2026-09-01T01:30:00.000Z"), senderBizId: "biz-1",
    },
    {
      id: "in-2", storeId: "store-1", lineOfficialAccountId: "oa-1", lineChatUserId: "chat-1",
      sourceEventId: "event:in-2", sourceEventType: "messageReceived", direction: MessageDirection.INBOUND,
      text: "Second question", sentAt: new Date("2026-09-01T05:00:00.000Z"), senderBizId: null,
    },
    {
      id: "out-2", storeId: "store-1", lineOfficialAccountId: "oa-1", lineChatUserId: "chat-1",
      sourceEventId: "event:out-2", sourceEventType: "messageSent", direction: MessageDirection.OUTBOUND,
      text: "Second answer", sentAt: new Date("2026-09-01T06:00:00.000Z"), senderBizId: null,
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: { findMany: async () => [] },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-01", dateTo: "2026-09-01", mode: "RESPONSE_CYCLES" },
  );
  assert.equal(result.mode, "RESPONSE_CYCLES");
  assert.equal(result.overview.total, 2);
  assert.equal(result.overview.responded, 2);
  assert.equal(result.overview.within24h, 2);
  assert.equal(result.overview.knownResponderReplies, 1);
  assert.equal(result.overview.unknownResponderReplies, 1);
});

test("reply analytics merges Historical rows through LINK_SAFE crosswalk when chat IDs differ", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound-crosswalk",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "historical-chat-id",
      sourceEventId: "event:historical-inbound",
      sourceEventType: "messageReceived",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: {
      findMany: async () => [{
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        historicalLineChatUserId: "historical-chat-id",
        canonicalConversationId: "conversation-1",
      }],
    },
    conversation: {
      findMany: async () => [{
        id: "conversation-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: null,
        messages: [{
          id: "canonical-outbound-crosswalk",
          externalMessageId: "canonical-outbound-1",
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.TEXT,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          originalText: "Store response",
          sentAt: new Date(inboundAt.getTime() + 30 * 60_000),
          senderUserId: "staff-1",
          senderDisplayName: "Staff One",
          rawPayload: null,
        }],
      }],
    },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-01", dateTo: "2026-09-01", mode: "RESPONSE_CYCLES" },
  );

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.responded, 1);
  assert.equal(result.overview.within24h, 1);
  assert.equal(result.sources.crosswalkLinkedHistoricalRows, 1);
  assert.equal(result.sources.virtualHistoricalRows, 0);
});

test("reply analytics uses exact source-event anchor when no crosswalk exists", async () => {
  const inboundAt = new Date("2026-09-01T02:00:00.000Z");
  const history = [
    {
      id: "historical-inbound-anchor",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "historical-chat-id",
      sourceEventId: "event:shared-inbound",
      sourceEventType: "messageReceived",
      direction: MessageDirection.INBOUND,
      text: "Customer message",
      sentAt: inboundAt,
      senderBizId: null,
    },
    {
      id: "historical-outbound-anchor",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "historical-chat-id",
      sourceEventId: "event:historical-outbound",
      sourceEventType: "messageSent",
      direction: MessageDirection.OUTBOUND,
      text: "Historical response",
      sentAt: new Date(inboundAt.getTime() + 20 * 60_000),
      senderBizId: "biz-1",
    },
  ];
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1", storeId: "store-1" }] },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: {
      findMany: async () => [{
        id: "conversation-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        lineChatUserId: null,
        messages: [{
          id: "current-inbound-anchor",
          externalMessageId: "line-chat-manager:event:shared-inbound",
          direction: MessageDirection.INBOUND,
          messageType: MessageType.TEXT,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          originalText: "Customer message",
          sentAt: inboundAt,
          senderUserId: null,
          senderDisplayName: null,
          rawPayload: null,
        }],
      }],
    },
  } as unknown as PrismaService;
  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-01", dateTo: "2026-09-01", mode: "RESPONSE_CYCLES" },
  );

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.within24h, 1);
  assert.equal(result.sources.sourceAnchoredHistoricalRows, 1);
});


test("reply analytics remaps legacy Historical OA alias through stable current OA identity", async () => {
  const inboundAt = new Date("2026-09-26T09:06:00.000Z");
  const history = [{
    id: "historical-inbound-legacy-oa",
    storeId: "legacy-store-id",
    lineOfficialAccountId: "oa-legacy",
    lineChatUserId: "manager-chat-1",
    sourceEventId: "event:legacy-inbound",
    sourceEventType: "messageReceived",
    direction: MessageDirection.INBOUND,
    text: "Customer message",
    sentAt: inboundAt,
    senderBizId: null,
  }];

  let oaLookupCount = 0;
  const prisma = {
    store: { findMany: async () => [{ id: "store-1", name: "Store One" }] },
    lineOfficialAccount: {
      findMany: async () => {
        oaLookupCount += 1;
        if (oaLookupCount === 1) {
          return [{
            id: "oa-current",
            storeId: "store-1",
            basicId: "@sameoa",
            channelId: "channel-current",
            destinationId: "destination-current",
          }];
        }
        return [
          {
            id: "oa-current",
            storeId: "store-1",
            basicId: "@sameoa",
            channelId: "channel-current",
            destinationId: "destination-current",
          },
          {
            id: "oa-legacy",
            storeId: "legacy-store-id",
            basicId: "@sameoa",
            channelId: null,
            destinationId: null,
          },
        ];
      },
    },
    historicalTimelineMessage: { findMany: async () => history },
    historicalConversationCrosswalk: { findMany: async () => [] },
    conversation: {
      findMany: async () => [{
        id: "conversation-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-current",
        lineChatUserId: "manager-chat-1",
        messages: [{
          id: "canonical-outbound-current-oa",
          externalMessageId: "event:reply",
          direction: MessageDirection.OUTBOUND,
          messageType: MessageType.TEXT,
          deliveryStatus: MessageDeliveryStatus.DELIVERED,
          originalText: "Human reply",
          sentAt: new Date(inboundAt.getTime() + 54 * 60_000),
          senderUserId: "staff-1",
          senderDisplayName: "Staff One",
          rawPayload: null,
        }],
      }],
    },
  } as unknown as PrismaService;

  const storeAccess = { accessibleStoreIds: async () => null } as unknown as StoreAccessService;
  const service = new HistoricalTimelineService(prisma, storeAccess);
  const result = await service.replyAnalytics(
    { id: "admin-1", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } as AuthUser,
    { dateFrom: "2026-09-26", dateTo: "2026-09-26", mode: "RESPONSE_CYCLES" },
  );

  assert.equal(result.overview.total, 1);
  assert.equal(result.overview.responded, 1);
  assert.equal(result.overview.within24h, 1);
  assert.equal(result.stores[0]?.storeId, "store-1");
  assert.equal(result.sources.oaFamilySize, 2);
  assert.equal(result.sources.historicalInboundMessages, 1);
});
