import assert from "node:assert/strict";
import test from "node:test";
import { managerEventEligibility, managerEventDirection, managerMirrorRowEligibility, managerCanonicalMessageType, parseNormalManagerHistoryList } from "./line-chat-manager-event-contract";
import { classifyHistoricalPage, HistoricalBackfillStatus, parseManagerHistoryPage } from "./line-chat-historical-backfill";
import { mirrorDirectionForManagerEvent } from "./line-chat-mirror.service";
import { canonicalMessageTypeFromMirror } from "./line-chat-mirror-reconciler.service";
for (const type of ["text", "image", "video", "audio", "file", "location", "sticker"]) {
  test(`shared Manager contract agrees for inbound/outbound ${type}`, () => {
    for (const eventType of ["messageReceived", "messageSent", "message"]) {
      const result = managerEventEligibility({ eventType, messageType: type, managerEventId: "123456", normalMessageIdPresent: true, timestampValid: true });
      const at = Date.parse("2026-10-07T04:16:35.281Z");
      const parsed = parseManagerHistoryPage({ list: [{ type: eventType, timestamp: at, message: { id: "123456", type } }] });
      assert.equal(result.kind, "CUSTOMER_MESSAGE");
      assert.equal(result.normalRaw, "REQUIRED");
      assert.equal(result.historicalRaw, "REQUIRED");
      assert.equal(result.direction, mirrorDirectionForManagerEvent(eventType));
      assert.equal(result.direction, parsed.events[0].direction);
      assert.equal(parsed.events[0].sentAt.getTime(), at);
      assert.equal(managerCanonicalMessageType(type), canonicalMessageTypeFromMirror(type));
    }
  });
}
for (const type of ["chatRead", "follow", "unfollow"]) test(`metadata ${type} is not a missing customer message`, () => {
  const result = managerEventEligibility({ eventType: type, messageType: null, managerEventId: `event:${type}:fixture`, normalMessageIdPresent: false, timestampValid: true });
  assert.equal(result.kind, "METADATA_ONLY");
  assert.equal(result.normalRaw, "NOT_REQUIRED");
  assert.equal(result.canonical, "NOT_REQUIRED");
  assert.equal(result.historicalRaw, "REQUIRED");
});
test("unknown, withdrawn, notification and read-receipt types cannot certify customer completeness", () => {
  for (const eventType of ["unknown", "messageUnsent", "deleted", "system", "readReceipt", "notification"]) {
    assert.equal(managerEventEligibility({ eventType, messageType: "text", managerEventId: "123", normalMessageIdPresent: true, timestampValid: true }).kind, "UNKNOWN");
  }
  assert.equal(managerEventDirection(null), "UNKNOWN");
  assert.equal(managerEventEligibility({ eventType: "messageSent", messageType: "text", managerEventId: "123", normalMessageIdPresent: true, timestampValid: false }).reason, "HISTORY_TIMESTAMP_INVALID");
});
test("missing, synthetic and top-level-only message IDs hold NORMAL eligibility", () => {
  for (const id of [null, "", "event:message:fixture"]) assert.equal(managerEventEligibility({ eventType: "messageSent", messageType: "text", managerEventId: id, normalMessageIdPresent: false, timestampValid: true }).kind, "UNKNOWN");
  assert.equal(managerEventEligibility({ eventType: "messageSent", messageType: "text", managerEventId: "123", normalMessageIdPresent: false, timestampValid: true }).normalRaw, "UNPROVEN");
  assert.equal(managerEventEligibility({ eventType: "messageSent", messageType: "future", managerEventId: "123", normalMessageIdPresent: true, timestampValid: true }).kind, "UNKNOWN");
});

test("NORMAL parser preserves eligible event IDs, direction and millisecond timestamps", () => {
  const at = Date.parse("2026-10-07T04:16:35.281Z");
  const parsed = parseNormalManagerHistoryList([{ type: "messageSent", timestamp: at, bizId: "staff-fixture", message: { id: "id-fixture", type: "text", text: "fixture body" } }]);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].managerMessageId, "id-fixture");
  assert.equal(parsed.events[0].direction, "OUTBOUND");
  assert.equal(parsed.events[0].sentAt.getTime(), at);
  assert.equal(parsed.issues.HISTORY_INVALID_SHAPE, undefined);
});
test("NORMAL parser ignores known metadata but retains unknown message-like events with a partial diagnostic", () => {
  const parsed = parseNormalManagerHistoryList([
    { type: "chatRead", timestamp: 1_797_500_000_000, source: { chatId: "fixture" } },
    { type: "messageSent", timestamp: 1_797_500_000_001, message: { id: "unknown-type-id", type: "future-type" } },
    { type: "futureEvent", timestamp: 1_797_500_000_002, message: { id: "unknown-event-id", type: "text" } },
  ]);
  assert.deepEqual(parsed.events.map((event) => event.managerMessageId), ["unknown-type-id", "unknown-event-id"]);
  assert.equal(parsed.events[0].direction, "OUTBOUND");
  assert.equal(parsed.events[1].direction, "UNKNOWN");
  assert.equal(parsed.issues.UNSUPPORTED_MANAGER_MESSAGE_TYPE, 1);
  assert.equal(parsed.issues.UNKNOWN_MANAGER_EVENT_TYPE, 1);
});

test("historical parsing preserves unknown message-like rows but refuses completeness certification", () => {
  const at = Date.parse("2026-09-04T10:00:00+07:00");
  const parsed = parseManagerHistoryPage({ list: [
    { type: "messageReceived", timestamp: at, message: { id: "eligible", type: "text" } },
    { type: "futureEvent", timestamp: at - 1, message: { id: "unknown-event", type: "text" } },
  ] });
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.events[1].direction, "UNKNOWN");
  assert.equal(parsed.invalidEventCount, 1);
  const classification = classifyHistoricalPage(parsed);
  assert.equal(classification.status, HistoricalBackfillStatus.HISTORICAL_COVERAGE_UNPROVEN);
  assert.equal(classification.errorCode, "HISTORY_INVALID_EVENTS");
});

test("reconciliation uses shared eligibility and holds direction conflicts", () => {
  const base = {
    eventType: "messageSent",
    messageType: "text",
    managerEventId: "manager-event-1",
    normalMessageIdPresent: true,
    timestampValid: true,
  };
  assert.equal(managerMirrorRowEligibility({ ...base, storedDirection: "OUTBOUND" }).kind, "CUSTOMER_MESSAGE");
  const conflict = managerMirrorRowEligibility({ ...base, storedDirection: "INBOUND" });
  assert.equal(conflict.kind, "UNKNOWN");
  assert.equal(conflict.reason, "MIRROR_DIRECTION_CONFLICT");
  const unsupported = managerMirrorRowEligibility({ ...base, messageType: "future-type", storedDirection: "OUTBOUND" });
  assert.equal(unsupported.kind, "UNKNOWN");
  assert.equal(unsupported.canonical, "UNPROVEN");
});
test("NORMAL parser fails closed for missing IDs, bad timestamps, duplicate conflicts and malformed envelopes", () => {
  const parsed = parseNormalManagerHistoryList([
    { type: "messageReceived", timestamp: 1_797_500_000_000, message: { type: "text" } },
    { type: "messageReceived", timestamp: "invalid", message: { id: "bad-time", type: "text" } },
    { type: "messageReceived", timestamp: 1_797_500_000_000, message: { id: "same-id", type: "text" } },
    { type: "messageReceived", timestamp: 1_797_500_000_001, message: { id: "same-id", type: "text" } },
    null,
  ]);
  assert.equal(parsed.events.some((event) => event.managerMessageId === "same-id"), false);
  assert.equal(parsed.issues.MESSAGE_IDENTITY_UNPROVEN, 1);
  assert.equal(parsed.issues.HISTORY_TIMESTAMP_INVALID, 1);
  assert.equal(parsed.issues.HISTORY_DUPLICATE_ID_CONFLICT, 1);
  assert.equal(parsed.issues.HISTORY_TIMELINE_RECORD_INVALID, 1);
  assert.equal(parseNormalManagerHistoryList({}).issues.HISTORY_INVALID_SHAPE, 1);
});
