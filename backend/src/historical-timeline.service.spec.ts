import assert from "node:assert/strict";
import test from "node:test";
import { MessageDeliveryStatus, MessageDirection, MessageType } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { PrismaService } from "./prisma.service";
import {
  buildHistoricalVirtualConversationId,
  classifyResponseDuration,
  HistoricalTimelineService,
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

test("24-hour reply classification includes the exact 24-hour boundary", () => {
  const inbound = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(classifyResponseDuration(inbound, new Date(inbound.getTime() + 24 * 60 * 60 * 1000)), "WITHIN_24H");
  assert.equal(classifyResponseDuration(inbound, new Date(inbound.getTime() + 24 * 60 * 60 * 1000 + 1)), "OVER_24H");
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
    historicalTimelineMessage: { findMany: async () => history },
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
