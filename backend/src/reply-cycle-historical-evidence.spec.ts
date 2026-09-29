import assert from "node:assert/strict";
import test from "node:test";
import { loadSafeHistoricalReplyEvidence } from "./reply-cycle-historical-evidence";

void test("loads only LINK_SAFE SOURCE_EVENT_ID historical evidence", async () => {
  let crosswalkWhere: unknown;
  let historyWhere: unknown;
  const prisma = {
    historicalConversationCrosswalk: {
      findMany: async (args: { where: unknown }) => {
        crosswalkWhere = args.where;
        return [{
          storeId: "store-1",
          lineOfficialAccountId: "oa-1",
          historicalLineChatUserId: "chat-1",
          canonicalConversationId: "conversation-1",
        }];
      },
    },
    historicalTimelineMessage: {
      findMany: async (args: { where: unknown }) => {
        historyWhere = args.where;
        return [{
          id: "h-1",
          storeId: "store-1",
          lineOfficialAccountId: "oa-1",
          lineChatUserId: "chat-1",
          sourceEventId: "evt-1",
          sourceEventType: "messageSent",
          direction: "OUTBOUND",
          text: "reply",
          sentAt: new Date("2026-09-10T10:05:00Z"),
          senderBizId: null,
        }];
      },
    },
  };

  const result = await loadSafeHistoricalReplyEvidence(
    prisma as never,
    ["conversation-1"],
    new Date("2026-09-30T16:59:59.999Z"),
  );

  assert.equal(result.safeCrosswalkCount, 1);
  assert.equal(result.linkedConversationCount, 1);
  assert.equal(result.linkageConflictIdentityCount, 0);
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0]?.conversationId, "conversation-1");
  assert.equal(result.messages[0]?.sourceEventType, "messageSent");

  assert.deepEqual(crosswalkWhere, {
    canonicalConversationId: { in: ["conversation-1"] },
    classification: "LINK_SAFE",
    evidenceType: "SOURCE_EVENT_ID",
    anchorCount: { gt: 0 },
  });
  assert.deepEqual(historyWhere, {
    sentAt: { lte: new Date("2026-09-30T16:59:59.999Z") },
    OR: [{
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: "chat-1",
    }],
  });
});

void test("does not silently attach a historical identity mapped to multiple canonical conversations", async () => {
  let historyCalls = 0;
  const prisma = {
    historicalConversationCrosswalk: {
      findMany: async () => [
        {
          storeId: "store-1",
          lineOfficialAccountId: "oa-1",
          historicalLineChatUserId: "chat-1",
          canonicalConversationId: "conversation-1",
        },
        {
          storeId: "store-1",
          lineOfficialAccountId: "oa-1",
          historicalLineChatUserId: "chat-1",
          canonicalConversationId: "conversation-2",
        },
      ],
    },
    historicalTimelineMessage: {
      findMany: async () => {
        historyCalls += 1;
        return [];
      },
    },
  };

  const result = await loadSafeHistoricalReplyEvidence(
    prisma as never,
    ["conversation-1", "conversation-2"],
    new Date("2026-09-30T16:59:59.999Z"),
  );

  assert.equal(result.messages.length, 0);
  assert.equal(result.linkageConflictIdentityCount, 1);
  assert.equal(historyCalls, 0);
});

void test("returns empty evidence without querying history when no conversations are in scope", async () => {
  let crosswalkCalls = 0;
  let historyCalls = 0;
  const prisma = {
    historicalConversationCrosswalk: {
      findMany: async () => {
        crosswalkCalls += 1;
        return [];
      },
    },
    historicalTimelineMessage: {
      findMany: async () => {
        historyCalls += 1;
        return [];
      },
    },
  };

  const result = await loadSafeHistoricalReplyEvidence(
    prisma as never,
    [],
    new Date("2026-09-30T16:59:59.999Z"),
  );

  assert.deepEqual(result, {
    messages: [],
    safeCrosswalkCount: 0,
    linkedConversationCount: 0,
    linkageConflictIdentityCount: 0,
  });
  assert.equal(crosswalkCalls, 0);
  assert.equal(historyCalls, 0);
});
