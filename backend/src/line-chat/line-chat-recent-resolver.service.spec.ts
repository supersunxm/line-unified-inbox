import assert from "node:assert/strict";
import test from "node:test";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";

const CHAT_ID = `U${"a".repeat(32)}`;
const CHAT_ID_2 = `U${"b".repeat(32)}`;
const MESSAGE_AT = new Date("2026-09-01T05:00:00.000Z");

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conversation-1",
    storeId: "store-28375",
    lineOfficialAccountId: "oa-1",
    lineChatUserId: null,
    latestMessageAt: MESSAGE_AT,
    customer: { displayName: "สมชาย Oppo" },
    messages: [{ sentAt: MESSAGE_AT }],
    store: { code: "28375", storeMaster: null },
    lineOfficialAccount: {
      name: "OPPO BS RBS Chonburi",
      storeId: "store-28375",
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      lineChatSession: { sessionKey: "profile-b" },
    },
    ...overrides,
  };
}

function chat(id = CHAT_ID, name = "  สมชาย   OPPO ", offsetMs = 30_000) {
  return {
    chatUserId: id,
    displayName: name,
    lastMessageAt: new Date(MESSAGE_AT.getTime() + offsetMs).toISOString(),
    lastMessageText: null,
    lastMessageDirection: null,
  };
}

function fixture(options: {
  conversation?: ReturnType<typeof conversation>;
  chats?: ReturnType<typeof chat>[];
  discoveryStatus?: "READY" | "FAILED";
  failureReason?: "SESSION_AUTH" | "TRANSPORT";
  conflict?: boolean;
  writeCount?: number;
  racedMapping?: string | null;
} = {}) {
  const writes: Array<Record<string, unknown>> = [];
  const discoveryInputs: Array<Record<string, unknown>> = [];
  let findUniqueArgs: Record<string, unknown> | undefined;
  const target = options.conversation ?? conversation();
  const tx = {
    conversation: {
      findFirst: async () => options.conflict ? { id: "other-conversation" } : null,
      updateMany: async (args: Record<string, unknown>) => {
        writes.push(args);
        return { count: options.writeCount ?? 1 };
      },
      findUnique: async () => ({
        lineOfficialAccountId: target.lineOfficialAccountId,
        lineChatUserId: options.racedMapping ?? null,
      }),
    },
  };
  const prisma = {
    conversation: {
      findUnique: async (args: Record<string, unknown>) => {
        findUniqueArgs = args;
        return target;
      },
    },
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const session = {
    discoverRecentChats: async (input: Record<string, unknown>) => {
      discoveryInputs.push(input);
      return options.discoveryStatus === "FAILED"
        ? { status: "FAILED", chats: [], pagesFetched: 0, totalRawRecords: 0, failureReason: options.failureReason }
        : { status: "READY", chats: options.chats ?? [chat()], pagesFetched: 5, totalRawRecords: 125 };
    },
  };
  return {
    service: new LineChatRecentResolverService(prisma as never, session as never),
    writes,
    discoveryInputs,
    selectedCustomerFields: () => ((findUniqueArgs?.select as Record<string, unknown>)?.customer as { select?: unknown })?.select,
  };
}

const input = {
  conversationId: "conversation-1",
  lineOfficialAccountId: "oa-1",
  botId: "U729972869a565723cb7fcf7ea28bbc43",
  sessionKey: "profile-b",
  profilePath: "/safe/profile",
};

test("unique normalized exact name and timestamp within 60 seconds resolves with a guarded write", async () => {
  const value = fixture();
  const result = await value.service.resolve(input);
  assert.deepEqual(result, { status: "RESOLVED", lineChatUserId: CHAT_ID });
  assert.equal(value.discoveryInputs.length, 1);
  assert.equal(value.discoveryInputs[0].maxPages, 5);
  assert.equal(value.discoveryInputs[0].maxChats, 125);
  assert.deepEqual(value.selectedCustomerFields(), { displayName: true });
  assert.deepEqual(value.writes[0], {
    where: { id: "conversation-1", lineOfficialAccountId: "oa-1", lineChatUserId: null },
    data: { lineChatUserId: CHAT_ID },
  });
});

test("name-only and timestamp-only candidates fail closed", async (t) => {
  await t.test("name only", async () => {
    const value = fixture({ chats: [chat(CHAT_ID, "สมชาย Oppo", 60_001)] });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
    assert.equal(value.writes.length, 0);
  });
  await t.test("timestamp only", async () => {
    const value = fixture({ chats: [chat(CHAT_ID, "different name", 0)] });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
    assert.equal(value.writes.length, 0);
  });
});

test("multiple qualifying candidates are ambiguous and never written", async () => {
  const value = fixture({ chats: [chat(), chat(CHAT_ID_2)] });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_AMBIGUOUS" });
  assert.equal(value.writes.length, 0);
});

test("same-OA reuse is a conflict and an existing mapping is never overwritten", async (t) => {
  await t.test("candidate used by another conversation", async () => {
    const value = fixture({ conflict: true });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_CONFLICT" });
    assert.equal(value.writes.length, 0);
  });
  await t.test("target already mapped", async () => {
    const value = fixture({ conversation: conversation({ lineChatUserId: CHAT_ID_2 }) });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVED", lineChatUserId: CHAT_ID_2 });
    assert.equal(value.discoveryInputs.length, 0);
    assert.equal(value.writes.length, 0);
  });
});

test("guarded-update race proceeds only when the stored mapping equals the candidate", async (t) => {
  await t.test("same mapping", async () => {
    const value = fixture({ writeCount: 0, racedMapping: CHAT_ID });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVED", lineChatUserId: CHAT_ID });
  });
  await t.test("different mapping", async () => {
    const value = fixture({ writeCount: 0, racedMapping: CHAT_ID_2 });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_CONFLICT" });
  });
});

test("session auth and transport failures are sanitized and make no mapping write", async (t) => {
  for (const [failureReason, status] of [["SESSION_AUTH", "RESOLVE_SESSION_AUTH"], ["TRANSPORT", "RESOLVE_TRANSPORT"]] as const) {
    await t.test(failureReason, async () => {
      const value = fixture({ discoveryStatus: "FAILED", failureReason });
      assert.deepEqual(await value.service.resolve(input), { status });
      assert.equal(value.writes.length, 0);
    });
  }
});

test("non-pilot or mismatched OA identity fails before browser discovery", async () => {
  const value = fixture({ conversation: conversation({ store: { code: "99999", storeMaster: null } }) });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_CONFLICT" });
  assert.equal(value.discoveryInputs.length, 0);
});
