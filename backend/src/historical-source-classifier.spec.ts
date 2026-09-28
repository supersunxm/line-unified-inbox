import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHistoricalSourceCandidate,
  historicalExternalMessageIds,
  isHistoricalSourceIdMatch,
  type HistoricalCanonicalSource,
  type HistoricalSourceCandidate,
} from "./historical-source-classifier";

const candidate = (overrides: Partial<HistoricalSourceCandidate> = {}): HistoricalSourceCandidate => ({
  storeId: "store-1",
  lineOfficialAccountId: "oa-1",
  lineChatUserId: "U-history",
  sourceEventId: "event-1",
  direction: "INBOUND",
  messageType: "TEXT",
  text: "historical text",
  sentAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

const canonical = (overrides: Partial<HistoricalCanonicalSource> = {}): HistoricalCanonicalSource => ({
  id: "message-1",
  conversationId: "conversation-1",
  externalMessageId: "event-1",
  storeId: "store-1",
  lineOfficialAccountId: "oa-1",
  lineChatUserId: "U-history",
  direction: "INBOUND",
  messageType: "TEXT",
  text: "historical text",
  sentAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

void test("source event identity accepts raw and Manager-prefixed canonical external IDs", () => {
  assert.deepEqual(historicalExternalMessageIds("event-1"), ["event-1", "line-chat-manager:event-1"]);
  assert.equal(isHistoricalSourceIdMatch("event-1", "event-1"), true);
  assert.equal(isHistoricalSourceIdMatch("event-1", "line-chat-manager:event-1"), true);
  assert.equal(isHistoricalSourceIdMatch("event-1", "different-event"), false);
  assert.equal(isHistoricalSourceIdMatch("event-1", null), false);
});

void test("exact source, payload, scope, and timestamp classifies canonical exact", () => {
  const result = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [canonical()], archiveApproved: true });
  assert.equal(result.classification, "CANONICAL_EXACT");
  assert.equal(result.canonicalConversationId, "conversation-1");
  assert.equal(result.timestampDriftMs, 0);
});

void test("source event identity proves equivalence across unbounded timestamp drift", () => {
  const result = classifyHistoricalSourceCandidate({
    candidate: candidate(),
    canonicalMatches: [canonical({ sentAt: new Date("2026-09-15T00:00:00.000Z") })],
    archiveApproved: true,
  });
  assert.equal(result.classification, "CANONICAL_EQUIVALENT_WITH_TIME_DRIFT");
  assert.equal(result.timestampDriftMs, 14 * 24 * 60 * 60 * 1_000);
});

void test("a different chat ID is equivalent only through the unique matching LINK_SAFE destination", () => {
  const historical = candidate();
  const result = classifyHistoricalSourceCandidate({
    candidate: historical,
    canonicalMatches: [canonical({ lineChatUserId: null })],
    safeCrosswalkConversationIds: ["conversation-1"],
    archiveApproved: true,
  });
  assert.equal(result.classification, "CANONICAL_EQUIVALENT_VIA_SAFE_CROSSWALK");
  assert.equal(result.canonicalConversationId, "conversation-1");
  assert.equal(historical.lineChatUserId, "U-history");
});

void test("a crosswalk destination that differs from the source anchor stays a scope conflict", () => {
  const result = classifyHistoricalSourceCandidate({
    candidate: candidate(),
    canonicalMatches: [canonical({ lineChatUserId: null })],
    safeCrosswalkConversationIds: ["another-conversation"],
    archiveApproved: true,
  });
  assert.equal(result.classification, "CANONICAL_SCOPE_CONFLICT");
});

void test("multiple source matches or destinations remain explicit ambiguity", () => {
  const duplicate = canonical({ id: "message-2" });
  const sourceMatches = classifyHistoricalSourceCandidate({
    candidate: candidate(),
    canonicalMatches: [canonical(), duplicate],
    archiveApproved: true,
  });
  const destinations = classifyHistoricalSourceCandidate({
    candidate: candidate(),
    canonicalMatches: [],
    safeCrosswalkConversationIds: ["conversation-1", "conversation-2"],
    archiveApproved: true,
  });
  assert.equal(sourceMatches.classification, "AMBIGUOUS_CANONICAL_MATCH");
  assert.equal(destinations.classification, "AMBIGUOUS_CANONICAL_MATCH");
});

void test("payload and Store/OA conflicts cannot be resolved by source ID or time", () => {
  const payload = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [canonical({ text: "different" })], archiveApproved: true });
  const scope = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [canonical({ storeId: "store-2" })], archiveApproved: true });
  assert.equal(payload.classification, "CANONICAL_PAYLOAD_CONFLICT");
  assert.equal(scope.classification, "CANONICAL_SCOPE_CONFLICT");
});

void test("unmatched approved events are Historical-only only with one proven destination", () => {
  const safe = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [], directConversationIds: ["conversation-1"], archiveApproved: true });
  const unknown = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [], archiveApproved: true });
  assert.equal(safe.classification, "SAFE_HISTORICAL_MISSING");
  assert.equal(unknown.classification, "NO_PROVABLE_DESTINATION");
});

void test("unapproved archive rows never enter a production classification", () => {
  const result = classifyHistoricalSourceCandidate({ candidate: candidate(), canonicalMatches: [], archiveApproved: false });
  assert.equal(result.classification, "ARCHIVE_NOT_APPROVED");
});
