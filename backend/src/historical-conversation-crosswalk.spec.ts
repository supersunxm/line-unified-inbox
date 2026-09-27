import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyHistoricalConversationIdentity,
  isCanonicalSourceDuplicate,
  selectSafeHistoricalCrosswalkRows,
  type CanonicalCrosswalkMessage,
  type HistoricalCrosswalkIdentity,
  type HistoricalCrosswalkMessage,
} from "./historical-conversation-crosswalk";

const identity: HistoricalCrosswalkIdentity = { storeId: "store-1", lineOfficialAccountId: "oa-1", lineChatUserId: "U-history" };
const historicalMessage = (overrides: Partial<HistoricalCrosswalkMessage> = {}): HistoricalCrosswalkMessage => ({
  ...identity,
  sourceEventId: "event:message:one",
  direction: "INBOUND",
  messageType: "TEXT",
  text: "hello",
  sentAt: new Date("2026-09-11T05:00:00.000Z"),
  ...overrides,
});
const canonicalMessage = (overrides: Partial<CanonicalCrosswalkMessage> = {}): CanonicalCrosswalkMessage => ({
  id: "message-1",
  conversationId: "conversation-1",
  externalMessageId: "event:message:one",
  direction: "INBOUND",
  messageType: "TEXT",
  text: "hello",
  sentAt: new Date("2026-09-11T05:00:00.088Z"),
  storeId: "store-1",
  lineOfficialAccountId: "oa-1",
  ...overrides,
});

void test("source event ID links a Historical chat when payload, scope, and sub-second time agree", () => {
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage()] });
  assert.equal(result.classification, "LINK_SAFE");
  assert.equal(result.canonicalConversationId, "conversation-1");
  assert.equal(result.anchorCount, 1);
  assert.equal(result.maxDriftMs, 88);
});

void test("multiple source anchors to one canonical conversation remain safe", () => {
  const secondHistorical = historicalMessage({ sourceEventId: "event:message:two" });
  const secondCanonical = canonicalMessage({ id: "message-2", externalMessageId: "line-chat-manager:event:message:two" });
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage(), secondHistorical], canonicalMessages: [canonicalMessage(), secondCanonical] });
  assert.equal(result.classification, "LINK_SAFE");
  assert.equal(result.anchorCount, 2);
});

void test("one source event matching two canonical external IDs is ambiguous", () => {
  const prefixedCanonical = canonicalMessage({ id: "message-2", externalMessageId: "line-chat-manager:event:message:one" });
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage(), prefixedCanonical] });
  assert.equal(result.classification, "LINK_AMBIGUOUS");
  assert.equal(result.canonicalConversationId, null);
  assert.ok(result.reasons.includes("SOURCE_EVENT_ID_MATCHES_MULTIPLE_CANONICAL_MESSAGES"));
});

void test("only source-anchored LINK_SAFE identities are eligible for persistence", () => {
  const safe = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage()] });
  const noAnchor = classifyHistoricalConversationIdentity({ identity: { ...identity, lineChatUserId: "U-no-anchor" }, historicalMessages: [historicalMessage({ lineChatUserId: "U-no-anchor" })], canonicalMessages: [] });
  assert.deepEqual(selectSafeHistoricalCrosswalkRows([safe, noAnchor]), [safe]);
  assert.throws(() => selectSafeHistoricalCrosswalkRows([{ ...safe, canonicalConversationId: null }]), /SAFE_CROSSWALK_ROW_MISSING_SOURCE_EVIDENCE/);
});

void test("anchors to different canonical conversations are ambiguous and produce no link", () => {
  const secondHistorical = historicalMessage({ sourceEventId: "event:message:two" });
  const secondCanonical = canonicalMessage({ id: "message-2", conversationId: "conversation-2", externalMessageId: "event:message:two" });
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage(), secondHistorical], canonicalMessages: [canonicalMessage(), secondCanonical] });
  assert.equal(result.classification, "LINK_AMBIGUOUS");
  assert.equal(result.canonicalConversationId, null);
});

void test("source anchor Store mismatch is a conflict", () => {
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage({ storeId: "store-2" })] });
  assert.equal(result.classification, "LINK_CONFLICT");
  assert.ok(result.reasons.includes("STORE_MISMATCH"));
});

void test("source anchor OA mismatch is a conflict", () => {
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage({ lineOfficialAccountId: "oa-2" })] });
  assert.equal(result.classification, "LINK_CONFLICT");
  assert.ok(result.reasons.includes("OA_MISMATCH"));
});

void test("source anchor payload mismatch is a conflict", () => {
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage({ text: "different" })] });
  assert.equal(result.classification, "LINK_CONFLICT");
  assert.ok(result.reasons.includes("TEXT_MISMATCH"));
});

void test("one-second time bound accepts proven drift and rejects larger drift", () => {
  const accepted = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage({ sentAt: new Date("2026-09-11T05:00:01.000Z") })] });
  const rejected = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [canonicalMessage({ sentAt: new Date("2026-09-11T05:00:01.001Z") })] });
  assert.equal(accepted.classification, "LINK_SAFE");
  assert.equal(accepted.maxDriftMs, 1_000);
  assert.equal(rejected.classification, "LINK_CONFLICT");
});

void test("source IDs are the only dedupe key and support raw or Manager-prefixed external IDs", () => {
  assert.equal(isCanonicalSourceDuplicate("event:message:one", "event:message:one"), true);
  assert.equal(isCanonicalSourceDuplicate("event:message:one", "line-chat-manager:event:message:one"), true);
  assert.equal(isCanonicalSourceDuplicate("event:message:one", "different-id"), false);
  assert.equal(isCanonicalSourceDuplicate("event:message:one", null), false);
});

void test("unmatched Historical identities stay virtual-only and receive no canonical destination", () => {
  const result = classifyHistoricalConversationIdentity({ identity, historicalMessages: [historicalMessage()], canonicalMessages: [] });
  assert.equal(result.classification, "NO_CANONICAL_ANCHOR");
  assert.equal(result.canonicalConversationId, null);
});

void test("crosswalk migration is additive and prevents unsafe destinations", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const migration = await readFile(resolve(process.cwd(), "prisma/migrations/20260927120000_add_historical_conversation_crosswalk/migration.sql"), "utf8");
  assert.match(migration, /CREATE TABLE "HistoricalConversationCrosswalk"/);
  assert.match(migration, /CHECK \("classification" = 'LINK_SAFE'\)/);
  assert.match(migration, /HistoricalConversationCrosswalk_link_evidence_check[\s\S]*CHECK \("canonicalConversationId" IS NOT NULL/);
  assert.match(migration, /"canonicalConversationId" IS NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX "HistoricalConversationCrosswalk_identity_key"/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/iu);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/iu);
});
