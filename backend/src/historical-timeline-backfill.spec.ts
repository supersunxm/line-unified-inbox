import assert from "node:assert/strict";
import test from "node:test";
import { MessageDirection, MessageType } from "@prisma/client";
import {
  canonicalId,
  exactCanonicalMatch,
  exactHistoricalMatch,
  isTextMessage,
  stableUniqueIdentity,
} from "../scripts/historical-timeline-backfill";

const candidate = {
  id: "",
  storeId: "store-1",
  lineOfficialAccountId: "oa-1",
  lineChatUserId: "chat-1",
  sourceEventId: "event:message:abc",
  sourceEventType: "messageReceived",
  direction: MessageDirection.INBOUND,
  text: "archive text",
  sentAt: new Date("2026-09-01T01:00:00.000Z"),
  senderBizId: null,
  sourceArchiveKey: "store-1",
  sourceArchiveSha256: "a".repeat(64),
  sourcePageIdentity: "page-1",
};

test("Historical timeline row ID and uniqueness scope use stable source identity", () => {
  const id = canonicalId(candidate);
  assert.equal(id, canonicalId(candidate));
  assert.match(id, /^historical:[a-f0-9]{64}$/u);
  assert.equal(stableUniqueIdentity(candidate), "oa-1\u0000chat-1\u0000event:message:abc");
  assert.notEqual(id, canonicalId({ ...candidate, storeId: "store-2" }));
});

test("only nonempty, supported text messages enter the read model", () => {
  const valid = {
    storeId: candidate.storeId,
    conversationId: "U0123456789abcdef0123456789abcdef",
    sourceEventId: candidate.sourceEventId,
    deterministicIdentity: `line-chat-manager:${candidate.sourceEventId}`,
    timestamp: candidate.sentAt.toISOString(),
    type: "messageReceived",
    direction: "INBOUND",
    messageType: "text",
    text: "message",
    rawMetadata: {},
  };
  assert.equal(isTextMessage(valid), true);
  assert.equal(isTextMessage({ ...valid, messageType: "image" }), false);
  assert.equal(isTextMessage({ ...valid, text: "  " }), false);
  assert.equal(isTextMessage({ ...valid, type: "chatRead" }), false);
});

test("read-model duplicate checks compare full source identity and payload", () => {
  const row = { ...candidate, id: canonicalId(candidate) };
  assert.equal(exactHistoricalMatch(row, { ...candidate, id: row.id }), true);
  assert.equal(exactHistoricalMatch(row, { ...candidate, id: row.id, text: "different" }), false);
  const canonical = {
    externalMessageId: `line-chat-manager:${candidate.sourceEventId}`,
    direction: candidate.direction,
    messageType: MessageType.TEXT,
    originalText: candidate.text,
    sentAt: candidate.sentAt,
    conversation: {
      storeId: candidate.storeId,
      lineOfficialAccountId: candidate.lineOfficialAccountId,
      lineChatUserId: candidate.lineChatUserId,
    },
  };
  assert.equal(exactCanonicalMatch(canonical, candidate), true);
  assert.equal(exactCanonicalMatch({ ...canonical, messageType: MessageType.IMAGE }, candidate), false);
  assert.equal(exactCanonicalMatch({ ...canonical, conversation: { ...canonical.conversation, storeId: "other" } }, candidate), false);
});
