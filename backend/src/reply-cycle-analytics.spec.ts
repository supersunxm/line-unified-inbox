import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReplyCycleAnalytics,
  type ReplyCycleAnalyticsConversationInput,
} from "./reply-cycle-analytics";
import type {
  CanonicalReplyMessage,
  HistoricalReplyMessage,
} from "./reply-state-resolver";

function canonical(
  id: string,
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM",
  sentAt: string,
  overrides: Partial<CanonicalReplyMessage> = {},
): CanonicalReplyMessage {
  return {
    id,
    externalMessageId: "evt-" + id,
    direction,
    deliveryStatus: "DELIVERED",
    originalText: id,
    sentAt: new Date(sentAt),
    senderUserId: direction === "OUTBOUND" ? "staff-1" : null,
    senderDisplayName: direction === "OUTBOUND" ? "BM One" : null,
    ...overrides,
  };
}

function historical(
  id: string,
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM",
  sentAt: string,
  overrides: Partial<HistoricalReplyMessage> = {},
): HistoricalReplyMessage {
  return {
    id,
    sourceEventId: "evt-" + id,
    sourceEventType: direction === "OUTBOUND" ? "messageSent" : "messageReceived",
    direction,
    text: id,
    sentAt: new Date(sentAt),
    senderBizId: direction === "OUTBOUND" ? "biz-staff" : null,
    ...overrides,
  };
}

function input(
  conversationId: string,
  canonicalMessages: CanonicalReplyMessage[] = [],
  historicalMessages: HistoricalReplyMessage[] = [],
): ReplyCycleAnalyticsConversationInput {
  return {
    conversationId,
    canonical: canonicalMessages,
    historical: historicalMessages,
  };
}

void test("consecutive customer messages remain one cycle", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-10T10:00:00Z"),
      canonical("2", "INBOUND", "2026-09-10T10:05:00Z"),
      canonical("3", "OUTBOUND", "2026-09-10T10:20:00Z"),
    ]),
  ]);

  assert.equal(result.ambiguousConversationCount, 0);
  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.startedAt.toISOString(), "2026-09-10T10:00:00.000Z");
  assert.equal(result.cycles[0]?.durationSeconds, 1200);
});

void test("manager mirror outbound closes a cycle without senderUserId", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-10T10:00:00Z"),
      canonical("2", "OUTBOUND", "2026-09-10T10:05:00Z", {
        senderUserId: null,
        rawPayload: { source: "LINE_MANAGER_MIRROR", provider: "LINE_MANAGER" },
      }),
    ]),
  ]);

  assert.equal(result.cycles[0]?.durationSeconds, 300);
});

void test("historical messageSent closes a canonical inbound cycle", () => {
  const result = buildReplyCycleAnalytics([
    input(
      "c1",
      [canonical("1", "INBOUND", "2026-09-10T10:00:00Z")],
      [historical("2", "OUTBOUND", "2026-09-10T10:08:00Z", { senderBizId: null })],
    ),
  ]);

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.durationSeconds, 480);
});

void test("historical inbound and historical staff reply form a cycle", () => {
  const result = buildReplyCycleAnalytics([
    input(
      "c1",
      [],
      [
        historical("1", "INBOUND", "2026-09-10T10:00:00Z"),
        historical("2", "OUTBOUND", "2026-09-10T10:15:00Z"),
      ],
    ),
  ]);

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.durationSeconds, 900);
});

void test("canonical and historical overlap is deduplicated before KPI cycles", () => {
  const result = buildReplyCycleAnalytics([
    input(
      "c1",
      [
        canonical("in", "INBOUND", "2026-09-10T10:00:00Z", {
          externalMessageId: "line-chat-manager:source-in",
          originalText: "hello",
        }),
        canonical("out", "OUTBOUND", "2026-09-10T10:10:00Z", {
          externalMessageId: "line-chat-manager:source-out",
          originalText: "reply",
          senderUserId: null,
          rawPayload: { source: "LINE_MANAGER_MIRROR" },
        }),
      ],
      [
        historical("hin", "INBOUND", "2026-09-10T10:00:00Z", {
          sourceEventId: "source-in",
          text: "hello",
        }),
        historical("hout", "OUTBOUND", "2026-09-10T10:10:00Z", {
          sourceEventId: "source-out",
          text: "reply",
        }),
      ],
    ),
  ]);

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.durationSeconds, 600);
});

void test("bot and failed or pending outbound do not close the cycle", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-10T10:00:00Z"),
      canonical("2", "OUTBOUND", "2026-09-10T10:01:00Z", {
        senderDisplayName: "Auto Reply Bot",
        rawPayload: { source: "AUTO_RESPONSE" },
      }),
      canonical("3", "OUTBOUND", "2026-09-10T10:02:00Z", {
        deliveryStatus: "FAILED",
      }),
      canonical("4", "OUTBOUND", "2026-09-10T10:03:00Z", {
        deliveryStatus: "PENDING",
      }),
    ]),
  ]);

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.answeredAt, null);
});

void test("unknown outbound actor excludes the ambiguous conversation from KPI cycles", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-10T10:00:00Z"),
      canonical("2", "OUTBOUND", "2026-09-10T10:05:00Z", {
        senderUserId: null,
        rawPayload: null,
      }),
    ]),
  ]);

  assert.equal(result.cycles.length, 0);
  assert.equal(result.ambiguousConversationCount, 1);
  assert.equal(result.ambiguityReasons.UNKNOWN_OUTBOUND_ACTOR, 1);
});

void test("same timestamp customer and staff reply is excluded as ordering conflict", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-10T10:00:00Z"),
      canonical("2", "OUTBOUND", "2026-09-10T10:00:00Z"),
    ]),
  ]);

  assert.equal(result.cycles.length, 0);
  assert.equal(result.ambiguityReasons.ORDERING_CONFLICT, 1);
});

void test("30 Sep Bangkok inbound and 1 Oct reply stays a September-started cycle", () => {
  const result = buildReplyCycleAnalytics([
    input("c1", [
      canonical("1", "INBOUND", "2026-09-30T16:55:00Z"),
      canonical("2", "OUTBOUND", "2026-09-30T17:10:00Z"),
    ]),
  ]);

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.startedAt.toISOString(), "2026-09-30T16:55:00.000Z");
  assert.equal(result.cycles[0]?.answeredAt?.toISOString(), "2026-09-30T17:10:00.000Z");
  assert.equal(result.cycles[0]?.durationSeconds, 900);
});
