import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeterministicResponseCycles,
  normalizeCanonicalReplyMessage,
  normalizeHistoricalReplyMessage,
  normalizeReplyTimeline,
  resolveReplyState,
  type CanonicalReplyMessage,
  type HistoricalReplyMessage,
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
    sourceEventType: "message",
    direction,
    text: id,
    sentAt: new Date(sentAt),
    senderBizId: direction === "OUTBOUND" ? "biz-staff-1" : null,
    ...overrides,
  };
}

function resolve(
  canonicalMessages: CanonicalReplyMessage[] = [],
  historicalMessages: HistoricalReplyMessage[] = [],
) {
  return resolveReplyState(normalizeReplyTimeline({ canonical: canonicalMessages, historical: historicalMessages }));
}

void test("customer inbound resolves NOT_REPLIED", () => {
  assert.equal(resolve([canonical("1", "INBOUND", "2026-09-01T00:00:00Z")]).state, "NOT_REPLIED");
});

void test("customer then delivered human staff resolves REPLIED", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T00:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T00:05:00Z"),
  ]);
  assert.equal(result.state, "REPLIED");
});

void test("customer then staff then new customer reopens NOT_REPLIED", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T00:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T00:05:00Z"),
    canonical("3", "INBOUND", "2026-09-01T00:10:00Z"),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("multi-inbound burst forms one response cycle from the first inbound", () => {
  const timeline = normalizeReplyTimeline({
    canonical: [
      canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
      canonical("2", "INBOUND", "2026-09-01T10:01:00Z"),
      canonical("3", "INBOUND", "2026-09-01T10:03:00Z"),
      canonical("4", "OUTBOUND", "2026-09-01T10:10:00Z"),
    ],
  });
  assert.equal(resolveReplyState(timeline).state, "REPLIED");
  const cycles = buildDeterministicResponseCycles(timeline);
  assert.equal(cycles.status, "DETERMINISTIC");
  if (cycles.status === "DETERMINISTIC") {
    assert.equal(cycles.cycles.length, 1);
    assert.equal(cycles.cycles[0]?.startedAt.toISOString(), "2026-09-01T10:00:00.000Z");
    assert.equal(cycles.cycles[0]?.durationSeconds, 600);
  }
});

void test("staff before customer does not answer the later customer", () => {
  const result = resolve([
    canonical("1", "OUTBOUND", "2026-09-01T09:00:00Z"),
    canonical("2", "INBOUND", "2026-09-01T10:00:00Z"),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("system and historical event-only records do not affect a reply cycle", () => {
  const result = resolve(
    [
      canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
      canonical("2", "SYSTEM", "2026-09-01T10:01:00Z"),
      canonical("3", "OUTBOUND", "2026-09-01T10:05:00Z"),
    ],
    [
      historical("read", "SYSTEM", "2026-09-01T10:02:00Z", {
        sourceEventType: "chatRead",
        sourceEventId: "read-1",
      }),
    ],
  );
  assert.equal(result.state, "REPLIED");
});

void test("stored conversation status is not an input to resolver behavior", () => {
  const result = resolve([canonical("1", "INBOUND", "2026-09-01T10:00:00Z")]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("timeline human reply resolves REPLIED independent of a stored NOT_REPLIED value", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
  ]);
  assert.equal(result.state, "REPLIED");
});

void test("failed outbound does not close an open customer cycle", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { deliveryStatus: "FAILED" }),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("pending outbound does not close an open customer cycle", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { deliveryStatus: "PENDING" }),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("auto response does not close an open customer cycle", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", {
      senderUserId: "bot-user",
      senderDisplayName: "Auto Reply Bot",
      rawPayload: { source: "AUTO_RESPONSE" },
    }),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("unknown delivered outbound actor is AMBIGUOUS when it changes the possible final state", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { senderUserId: null }),
  ]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "UNKNOWN_OUTBOUND_ACTOR");
});

void test("canonical LINE Manager mirror outbound counts as staff reply without internal user attribution", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", {
      senderUserId: null,
      rawPayload: { provider: "LINE_MANAGER", source: "LINE_MANAGER_MIRROR" },
    }),
  ]);
  assert.equal(result.state, "REPLIED");
});

void test("later inbound converges an earlier unknown outbound to deterministic NOT_REPLIED", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { senderUserId: null }),
    canonical("3", "INBOUND", "2026-09-01T10:10:00Z"),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("canonical and historical durable source identities deduplicate", () => {
  const timeline = normalizeReplyTimeline({
    canonical: [
      canonical("1", "INBOUND", "2026-09-01T10:00:00Z", {
        externalMessageId: "line-chat-manager:source-1",
        originalText: "hello",
      }),
    ],
    historical: [
      historical("h1", "INBOUND", "2026-09-01T10:00:00Z", {
        sourceEventId: "source-1",
        text: "hello",
      }),
    ],
  });
  assert.equal(timeline.length, 1);
});

void test("unique exact text and timestamp fallback deduplicates cross-source overlap", () => {
  const timeline = normalizeReplyTimeline({
    canonical: [
      canonical("1", "INBOUND", "2026-09-01T10:00:00Z", {
        externalMessageId: null,
        originalText: "same text",
      }),
    ],
    historical: [
      historical("h1", "INBOUND", "2026-09-01T10:00:00Z", {
        sourceEventId: "different-source",
        text: "same text",
      }),
    ],
  });
  assert.equal(timeline.length, 1);
});

void test("multiple cycles use the latest cycle for the current state", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:05:00Z"),
    canonical("3", "INBOUND", "2026-09-01T10:10:00Z"),
    canonical("4", "OUTBOUND", "2026-09-01T10:15:00Z"),
  ]);
  assert.equal(result.state, "REPLIED");
  if (result.state === "REPLIED") {
    assert.equal(result.latestCycle?.startedAt.toISOString(), "2026-09-01T10:10:00.000Z");
  }
});

void test("30 Sep inbound and 1 Oct reply remain one 15 minute cycle", () => {
  const timeline = normalizeReplyTimeline({
    canonical: [
      canonical("1", "INBOUND", "2026-09-30T16:55:00Z"),
      canonical("2", "OUTBOUND", "2026-09-30T17:10:00Z"),
    ],
  });
  const cycles = buildDeterministicResponseCycles(timeline);
  assert.equal(cycles.status, "DETERMINISTIC");
  if (cycles.status === "DETERMINISTIC") {
    assert.equal(cycles.cycles[0]?.startedAt.toISOString(), "2026-09-30T16:55:00.000Z");
    assert.equal(cycles.cycles[0]?.answeredAt?.toISOString(), "2026-09-30T17:10:00.000Z");
    assert.equal(cycles.cycles[0]?.durationSeconds, 900);
  }
});

void test("equal timestamp inbounds remain deterministic", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "INBOUND", "2026-09-01T10:00:00Z"),
  ]);
  assert.equal(result.state, "NOT_REPLIED");
});

void test("equal timestamp inbound and human reply are AMBIGUOUS when ordering changes final state", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:00:00Z"),
  ]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "ORDERING_CONFLICT");
});

void test("equal timestamp inbound and unknown outbound are AMBIGUOUS because order can change the result", () => {
  const result = resolve([
    canonical("1", "INBOUND", "2026-09-01T10:00:00Z"),
    canonical("2", "OUTBOUND", "2026-09-01T10:00:00Z", { senderUserId: null }),
  ]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "ORDERING_CONFLICT");
});

void test("historical unknown event classification is AMBIGUOUS when it could open a cycle", () => {
  const event = normalizeHistoricalReplyMessage(
    historical("1", "INBOUND", "2026-09-01T10:00:00Z", { sourceEventType: "mystery" }),
  );
  const result = resolveReplyState([event]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "UNKNOWN_EVENT_CLASSIFICATION");
});

void test("historical attributed human outbound can close a canonical customer cycle", () => {
  const result = resolve(
    [canonical("1", "INBOUND", "2026-09-01T10:00:00Z")],
    [historical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { senderBizId: "biz-staff-9" })],
  );
  assert.equal(result.state, "REPLIED");
});

void test("persisted Manager messageReceived and messageSent event types are treated as messages", () => {
  const result = resolve(
    [],
    [
      historical("1", "INBOUND", "2026-09-01T10:00:00Z", { sourceEventType: "messageReceived", senderBizId: null }),
      historical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { sourceEventType: "messageSent", senderBizId: "biz-staff-9" }),
    ],
  );
  assert.equal(result.state, "REPLIED");
});

void test("historical messageSent is reply evidence even when responder identity is missing", () => {
  const result = resolve(
    [],
    [
      historical("1", "INBOUND", "2026-09-01T10:00:00Z", { sourceEventType: "messageReceived", senderBizId: null }),
      historical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { sourceEventType: "messageSent", senderBizId: null }),
    ],
  );
  assert.equal(result.state, "REPLIED");
});

void test("historical generic outbound with no sender evidence stays AMBIGUOUS", () => {
  const result = resolve(
    [],
    [
      historical("1", "INBOUND", "2026-09-01T10:00:00Z", { sourceEventType: "message", senderBizId: null }),
      historical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { sourceEventType: "message", senderBizId: null }),
    ],
  );
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "UNKNOWN_OUTBOUND_ACTOR");
});

void test("historical auto response does not close a customer cycle", () => {
  const result = resolve(
    [canonical("1", "INBOUND", "2026-09-01T10:00:00Z")],
    [historical("2", "OUTBOUND", "2026-09-01T10:05:00Z", { senderBizId: "__AUTO_RESPONSE" })],
  );
  assert.equal(result.state, "NOT_REPLIED");
});

void test("no customer message evidence stays internal AMBIGUOUS instead of guessing", () => {
  const result = resolveReplyState([
    normalizeCanonicalReplyMessage(canonical("1", "OUTBOUND", "2026-09-01T10:00:00Z")),
  ]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "NO_MESSAGE_EVIDENCE");
});

void test("event-only historical evidence alone is NO_MESSAGE_EVIDENCE", () => {
  const event = normalizeHistoricalReplyMessage(
    historical("1", "SYSTEM", "2026-09-01T10:00:00Z", { sourceEventType: "follow" }),
  );
  const result = resolveReplyState([event]);
  assert.equal(result.state, "AMBIGUOUS");
  if (result.state === "AMBIGUOUS") assert.equal(result.reason, "NO_MESSAGE_EVIDENCE");
});
