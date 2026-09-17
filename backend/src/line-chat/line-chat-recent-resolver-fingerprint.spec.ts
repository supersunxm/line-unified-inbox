import assert from "node:assert/strict";
import test from "node:test";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";

const BOT_ID = "U729972869a565723cb7fcf7ea28bbc43";
const CHAT_A = `U${"a".repeat(32)}`;
const CHAT_B = `U${"b".repeat(32)}`;
const CHAT_C = `U${"c".repeat(32)}`;
const ANCHOR_AT = new Date("2026-09-16T11:59:38.161Z");

function baseConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conversation-max",
    storeId: "store-28375",
    lineOfficialAccountId: "oa-rbs-chonburi",
    lineChatUserId: null,
    latestMessageAt: ANCHOR_AT,
    customer: { displayName: "Max" },
    messages: [
      { direction: "INBOUND", deliveryStatus: "DELIVERED", sentAt: ANCHOR_AT },
    ],
    store: { code: "28375", storeMaster: null },
    lineOfficialAccount: {
      name: "OPPO BS RBS Chonburi",
      storeId: "store-28375",
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      chatBotId: BOT_ID,
      lineChatSession: { sessionKey: "profile-b", status: "ACTIVE" },
    },
    ...overrides,
  };
}

function discovered(chatUserId: string, offsetMs: number, displayName = "Max") {
  return {
    chatUserId,
    displayName,
    lastMessageText: null,
    lastMessageAt: new Date(ANCHOR_AT.getTime() + offsetMs).toISOString(),
    lastMessageDirection: null,
  };
}

function realtimeFixture(options: {
  conversation?: ReturnType<typeof baseConversation>;
  chats?: ReturnType<typeof discovered>[];
} = {}) {
  const writes: Array<Record<string, unknown>> = [];
  const diagnostics: Record<string, unknown>[] = [];
  const target = options.conversation ?? baseConversation();
  const tx = {
    conversation: {
      findFirst: async () => null,
      updateMany: async (args: Record<string, unknown>) => {
        writes.push(args);
        return { count: 1 };
      },
      findUnique: async () => ({ lineOfficialAccountId: target.lineOfficialAccountId, lineChatUserId: null }),
    },
  };
  const prisma = {
    conversation: {
      findUnique: async () => target,
    },
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const session = {
    discoverRecentChats: async () => ({
      status: "READY",
      chats: options.chats ?? [discovered(CHAT_A, 0)],
      pagesFetched: 1,
      totalRawRecords: options.chats?.length ?? 1,
    }),
  };
  const service = new LineChatRecentResolverService(prisma as never, session as never);
  (service as unknown as { logger: { log: (message: string) => void } }).logger = {
    log: (message: string) => diagnostics.push(JSON.parse(message) as Record<string, unknown>),
  };
  return { service, writes, diagnostics };
}

const input = {
  conversationId: "conversation-max",
  lineOfficialAccountId: "oa-rbs-chonburi",
  botId: BOT_ID,
  sessionKey: "profile-b",
  profilePath: "/safe/profile-b",
};

test("duplicate display names resolve by the one matching reliable message timestamp", async () => {
  const value = realtimeFixture({
    chats: [
      discovered(CHAT_A, -3 * 60 * 60 * 1000),
      discovered(CHAT_B, 250),
      discovered(CHAT_C, 2 * 60 * 60 * 1000),
    ],
  });

  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVED", lineChatUserId: CHAT_B });
  assert.equal(value.writes.length, 1);
  assert.deepEqual((value.writes[0].data as Record<string, unknown>).lineChatUserId, CHAT_B);
  assert.equal(value.diagnostics[0].resolutionMethod, "MESSAGE_TIMESTAMP");
  assert.equal(value.diagnostics[0].anchorSource, "LATEST_INBOUND");
  assert.equal(value.diagnostics[0].exactNameMatchCount, 3);
  assert.equal(value.diagnostics[0].timestampCandidateCount, 1);
});

test("failed outbound is never used as identity evidence", async () => {
  const failedAt = new Date(ANCHOR_AT.getTime() + 21 * 60 * 60 * 1000);
  const value = realtimeFixture({
    conversation: baseConversation({
      latestMessageAt: failedAt,
      messages: [
        { direction: "OUTBOUND", deliveryStatus: "FAILED", sentAt: failedAt },
        { direction: "INBOUND", deliveryStatus: "DELIVERED", sentAt: ANCHOR_AT },
      ],
    }),
    chats: [
      discovered(CHAT_A, 0),
      discovered(CHAT_B, 2 * 60 * 60 * 1000),
    ],
  });

  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVED", lineChatUserId: CHAT_A });
  assert.equal(value.diagnostics[0].anchorSource, "LATEST_INBOUND");
  assert.equal(value.diagnostics[0].resolutionMethod, "MESSAGE_TIMESTAMP");
});

test("a reliable timestamp mismatch does not fall back to unsafe name-only mapping", async () => {
  const value = realtimeFixture({ chats: [discovered(CHAT_A, 3 * 60 * 60 * 1000)] });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
  assert.equal(value.writes.length, 0);
  assert.equal(value.diagnostics[0].resolutionMethod, "UNRESOLVED");
  assert.equal(value.diagnostics[0].timestampCandidateCount, 0);
});

test("unique name-only fallback remains available when no reliable message anchor exists", async () => {
  const value = realtimeFixture({
    conversation: baseConversation({
      messages: [{ sentAt: ANCHOR_AT }],
    }),
    chats: [discovered(CHAT_A, 4 * 60 * 60 * 1000)],
  });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVED", lineChatUserId: CHAT_A });
  assert.equal(value.diagnostics[0].resolutionMethod, "NAME_ONLY");
  assert.equal(value.diagnostics[0].anchorSource, "NONE");
});

test("two same-name chats inside the timestamp tolerance remain ambiguous", async () => {
  const value = realtimeFixture({
    chats: [
      discovered(CHAT_A, -10_000),
      discovered(CHAT_B, 10_000),
    ],
  });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_AMBIGUOUS" });
  assert.equal(value.writes.length, 0);
  assert.equal(value.diagnostics[0].timestampCandidateCount, 2);
});
