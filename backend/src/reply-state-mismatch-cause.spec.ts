import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeReplyStateMismatch,
  type StoredReplyStatus,
} from "./reply-state-mismatch-cause";
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
    sourceEventId: "hist-" + id,
    sourceEventType: direction === "OUTBOUND" ? "messageSent" : "messageReceived",
    direction,
    text: id,
    sentAt: new Date(sentAt),
    senderBizId: direction === "OUTBOUND" ? "biz-staff-1" : null,
    ...overrides,
  };
}

function analyze(
  storedStatus: StoredReplyStatus,
  canonicalMessages: CanonicalReplyMessage[],
  historicalMessages: HistoricalReplyMessage[] = [],
) {
  return analyzeReplyStateMismatch({
    storedStatus,
    canonical: canonicalMessages,
    historical: historicalMessages,
  });
}

void test("stored REPLIED becomes reopened after a later customer message", () => {
  const result = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
    canonical("3", "INBOUND", "2026-09-01T10:10:00Z"),
  ]);

  assert.equal(result.resolvedState, "NOT_REPLIED");
  assert.equal(result.mismatch, true);
  assert.equal(result.primaryCause, "STORED_REPLIED_REOPENED_AFTER_VALID_REPLY");
  assert.equal(result.answeredCycleCount, 1);
  assert.equal(result.openCycleStartedAt?.toISOString(), "2026-09-01T10:10:00.000Z");
});

void test("stored REPLIED with no valid staff reply is classified separately", () => {
  const result = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
  ]);

  assert.equal(result.resolvedState, "NOT_REPLIED");
  assert.equal(result.primaryCause, "STORED_REPLIED_NEVER_VALIDLY_REPLIED");
  assert.equal(result.answeredCycleCount, 0);
});

void test("stored NOT_REPLIED becomes stale when valid reply exists", () => {
  const result = analyze("NOT_REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
  ]);

  assert.equal(result.resolvedState, "REPLIED");
  assert.equal(result.mismatch, true);
  assert.equal(result.primaryCause, "STORED_NOT_REPLIED_VALID_REPLY_EXISTS");
});

void test("matching stored and resolved state is not a mismatch", () => {
  const result = analyze("NOT_REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
  ]);

  assert.equal(result.mismatch, false);
  assert.equal(result.primaryCause, "MATCH");
});

void test("historical reply can change canonical-only NOT_REPLIED to REPLIED", () => {
  const result = analyze(
    "NOT_REPLIED",
    [canonical("1", "INBOUND", "2026-09-01T10:00:00Z")],
    [historical("2", "OUTBOUND", "2026-09-01T10:05:00Z")],
  );

  assert.equal(result.canonicalState, "NOT_REPLIED");
  assert.equal(result.resolvedState, "REPLIED");
  assert.equal(result.historicalEffect, "CHANGED_FINAL_STATE");
});

void test("historical evidence that does not change state is recorded", () => {
  const result = analyze(
    "REPLIED",
    [
      canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
      canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
    ],
    [historical("h3", "INBOUND", "2026-09-01T09:00:00Z")],
  );

  assert.equal(result.resolvedState, "REPLIED");
  assert.equal(result.historicalEffect, "NO_STATE_CHANGE");
});

void test("auto response after the open cycle is surfaced without closing it", () => {
  const result = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", {
      senderUserId: "bot",
      senderDisplayName: "Auto Reply Bot",
      rawPayload: { source: "AUTO_RESPONSE" },
    }),
  ]);

  assert.equal(result.resolvedState, "NOT_REPLIED");
  assert.equal(result.automatedOutboundAfterOpen, true);
  assert.equal(result.primaryCause, "STORED_REPLIED_NEVER_VALIDLY_REPLIED");
});

void test("failed and pending outbound attempts are surfaced", () => {
  const failed = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:02:00Z", {
      deliveryStatus: "FAILED",
    }),
  ]);
  assert.equal(failed.failedOrPendingCanonicalOutboundAfterOpen, true);

  const pending = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:02:00Z", {
      deliveryStatus: "PENDING",
    }),
  ]);
  assert.equal(pending.failedOrPendingCanonicalOutboundAfterOpen, true);
});

void test("unknown outbound after an open cycle is surfaced and resolver remains ambiguous", () => {
  const result = analyze("REPLIED", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", {
      senderUserId: null,
    }),
  ]);

  assert.equal(result.resolvedState, "AMBIGUOUS");
  assert.equal(result.primaryCause, "AMBIGUOUS");
  assert.equal(result.unknownOutboundAfterOpen, false);
});

void test("NOTIFIED_BM remains a workflow status and maps only descriptively", () => {
  const replied = analyze("NOTIFIED_BM", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
  ]);
  assert.equal(replied.primaryCause, "STORED_NOTIFIED_BM_RESOLVED_REPLIED");

  const open = analyze("NOTIFIED_BM", [
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
  ]);
  assert.equal(open.primaryCause, "STORED_NOTIFIED_BM_RESOLVED_NOT_REPLIED");
});
