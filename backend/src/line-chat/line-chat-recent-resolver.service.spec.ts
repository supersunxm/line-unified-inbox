import assert from "node:assert/strict";
import test from "node:test";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";

const CHAT_ID = `U${"a".repeat(32)}`;
const CHAT_ID_2 = `U${"b".repeat(32)}`;
const CHAT_ID_3 = `U${"c".repeat(32)}`;
const BOT_ID = "U729972869a565723cb7fcf7ea28bbc43";
const MESSAGE_AT = new Date("2026-09-16T11:59:38.161Z");

function message(
  sentAt = MESSAGE_AT,
  direction: "INBOUND" | "OUTBOUND" | "SYSTEM" = "INBOUND",
  deliveryStatus: "DELIVERED" | "FAILED" = "DELIVERED",
) {
  return { sentAt, direction, deliveryStatus };
}

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conversation-1",
    storeId: "store-28375",
    lineOfficialAccountId: "oa-1",
    lineChatUserId: null,
    latestMessageAt: MESSAGE_AT,
    customer: { displayName: "Max" },
    messages: [message()],
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

function chat(
  id = CHAT_ID,
  name = "Max",
  offsetMs = 0,
  lastMessageAt?: string | null,
) {
  return {
    chatUserId: id,
    displayName: name,
    lastMessageAt: lastMessageAt === undefined
      ? new Date(MESSAGE_AT.getTime() + offsetMs).toISOString()
      : lastMessageAt,
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
  const diagnostics: string[] = [];
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
  const service = new LineChatRecentResolverService(prisma as never, session as never);
  (service as unknown as { logger: { log: (value: string) => void } }).logger = {
    log: (value: string) => diagnostics.push(value),
  };
  return {
    service,
    writes,
    discoveryInputs,
    diagnostics,
    selectedMessages: () => ((findUniqueArgs?.select as Record<string, unknown>)?.messages as Record<string, unknown> | undefined),
  };
}

const input = {
  conversationId: "conversation-1",
  lineOfficialAccountId: "oa-1",
  botId: BOT_ID,
  sessionKey: "profile-b",
  profilePath: "/safe/profile",
};

test("duplicate display names resolve by the unique confirmed-message timestamp", async () => {
  const value = fixture({
    chats: [
      chat(CHAT_ID, "Max", -86_400_000),
      chat(CHAT_ID_2, "Max", 0),
      chat(CHAT_ID_3, "Max", 86_400_000),
    ],
  });

  assert.deepEqual(await value.service.resolve(input), {
    status: "RESOLVED",
    lineChatUserId: CHAT_ID_2,
  });
  assert.deepEqual(value.writes[0], {
    where: { id: "conversation-1", lineOfficialAccountId: "oa-1", lineChatUserId: null },
    data: { lineChatUserId: CHAT_ID_2 },
  });

  const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
  assert.equal(diagnostic.resolutionMethod, "TIMESTAMP_FINGERPRINT");
  assert.equal(diagnostic.nameCandidateCount, 3);
  assert.equal(diagnostic.fingerprintMatchCount, 1);
  assert.equal(diagnostic.anchorDirection, "INBOUND");
  assert.equal(diagnostic.targetTimestampSource, "MESSAGE_SENT_AT");
});

test("a confirmed timestamp mismatch never falls back to unsafe name-only mapping", async () => {
  const value = fixture({ chats: [chat(CHAT_ID, "Max", 3 * 60 * 60 * 1000)] });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
  assert.equal(value.writes.length, 0);
  const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
  assert.equal(diagnostic.resolutionMethod, "UNRESOLVED");
  assert.equal(diagnostic.exactNameMatchCount, 1);
  assert.equal(diagnostic.fingerprintMatchCount, 0);
});

test("two same-name candidates inside timestamp tolerance remain ambiguous", async () => {
  const value = fixture({
    chats: [
      chat(CHAT_ID, "Max", -10_000),
      chat(CHAT_ID_2, "Max", 10_000),
    ],
  });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_AMBIGUOUS" });
  assert.equal(value.writes.length, 0);
  const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
  assert.equal(diagnostic.fingerprintMatchCount, 2);
});

test("failed outbound messages are never used as identity anchors", async () => {
  const failedAt = new Date(MESSAGE_AT.getTime() + 10 * 60_000);
  const value = fixture({
    conversation: conversation({
      latestMessageAt: failedAt,
      messages: [
        message(failedAt, "OUTBOUND", "FAILED"),
        message(MESSAGE_AT, "INBOUND", "DELIVERED"),
      ],
    }),
    chats: [
      chat(CHAT_ID, "Max", 10 * 60_000),
      chat(CHAT_ID_2, "Max", 0),
    ],
  });

  assert.deepEqual(await value.service.resolve(input), {
    status: "RESOLVED",
    lineChatUserId: CHAT_ID_2,
  });
  const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
  assert.equal(diagnostic.anchorDirection, "INBOUND");

  const selectedMessages = value.selectedMessages();
  const where = selectedMessages?.where as { OR?: Array<Record<string, unknown>> } | undefined;
  assert.ok(where?.OR?.some((entry) => entry.direction === "INBOUND"));
  assert.ok(where?.OR?.some((entry) => entry.direction === "OUTBOUND" && entry.deliveryStatus === "DELIVERED"));
});

test("latest delivered outbound can safely anchor resolution when no inbound is available", async () => {
  const outboundAt = new Date(MESSAGE_AT.getTime() + 120_000);
  const value = fixture({
    conversation: conversation({
      messages: [message(outboundAt, "OUTBOUND", "DELIVERED")],
      latestMessageAt: outboundAt,
    }),
    chats: [
      chat(CHAT_ID, "Max", 0),
      chat(CHAT_ID_2, "Max", 120_000),
    ],
  });
  assert.deepEqual(await value.service.resolve(input), {
    status: "RESOLVED",
    lineChatUserId: CHAT_ID_2,
  });
  const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
  assert.equal(diagnostic.anchorDirection, "OUTBOUND");
  assert.equal(diagnostic.resolutionMethod, "TIMESTAMP_FINGERPRINT");
});

test("name-only fallback is retained only when no usable message anchor exists", async (t) => {
  await t.test("unique name resolves", async () => {
    const value = fixture({
      conversation: conversation({
        messages: [message(MESSAGE_AT, "OUTBOUND", "FAILED")],
      }),
      chats: [chat(CHAT_ID, "Max", 3 * 60 * 60 * 1000)],
    });
    assert.deepEqual(await value.service.resolve(input), {
      status: "RESOLVED",
      lineChatUserId: CHAT_ID,
    });
    const diagnostic = JSON.parse(value.diagnostics[0]) as Record<string, unknown>;
    assert.equal(diagnostic.resolutionMethod, "NAME_ONLY");
    assert.equal(diagnostic.targetTimestampSource, "NONE");
    assert.equal(diagnostic.anchorDirection, "NONE");
  });

  await t.test("duplicate names remain ambiguous", async () => {
    const value = fixture({
      conversation: conversation({ messages: [] }),
      chats: [
        chat(CHAT_ID, "Max", 0),
        chat(CHAT_ID_2, "Max", 60_000),
      ],
    });
    assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_AMBIGUOUS" });
    assert.equal(value.writes.length, 0);
  });
});

test("timestamp-only candidate with a different display name never resolves", async () => {
  const value = fixture({ chats: [chat(CHAT_ID, "Different Person", 0)] });
  assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
  assert.equal(value.writes.length, 0);
});

test("missing or invalid candidate timestamps fail closed when a confirmed anchor exists", async (t) => {
  for (const lastMessageAt of [null, "not-a-timestamp"] as const) {
    await t.test(String(lastMessageAt), async () => {
      const value = fixture({ chats: [chat(CHAT_ID, "Max", 0, lastMessageAt)] });
      assert.deepEqual(await value.service.resolve(input), { status: "RESOLVE_NO_MATCH" });
      assert.equal(value.writes.length, 0);
    });
  }
});

test("durable lineChatUserId always wins without browser discovery", async () => {
  const value = fixture({ conversation: conversation({ lineChatUserId: CHAT_ID_3 }) });
  assert.deepEqual(await value.service.resolve(input), {
    status: "RESOLVED",
    lineChatUserId: CHAT_ID_3,
  });
  assert.equal(value.discoveryInputs.length, 0);
  assert.equal(value.writes.length, 0);
});

test("diagnostic payload contains no customer names, LINE IDs, timestamps, or secrets", async () => {
  const value = fixture({
    chats: [
      chat(CHAT_ID, "Max", -86_400_000),
      chat(CHAT_ID_2, "Max", 0),
    ],
  });
  await value.service.resolve(input);
  const payload = value.diagnostics[0];
  for (const forbidden of [
    CHAT_ID,
    CHAT_ID_2,
    "Max",
    MESSAGE_AT.toISOString(),
    "lineUserId",
    "token",
    "cookie",
    "secret",
  ]) {
    assert.equal(payload.includes(forbidden), false, `diagnostic leaked ${forbidden}`);
  }
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

test("guarded-update race proceeds only when stored mapping equals candidate", async (t) => {
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

test("Phase 2 Central World still resolves with DB routing and timestamp evidence", async () => {
  const cwConversation = conversation({
    id: "conversation-cw-1",
    storeId: "store-cw",
    lineOfficialAccountId: "oa-cw",
    store: { code: "25610", storeMaster: null },
    lineOfficialAccount: {
      name: "OPPO Central World",
      storeId: "store-cw",
      accountType: "STORE",
      isActive: true,
      archivedAt: null,
      chatBotId: "U001732513bc5f534c1a40d36c89bb43f",
      lineChatSession: { sessionKey: "account-1", status: "ACTIVE" },
    },
  });
  const cwInput = {
    conversationId: "conversation-cw-1",
    lineOfficialAccountId: "oa-cw",
    botId: "U001732513bc5f534c1a40d36c89bb43f",
    sessionKey: "account-1",
    profilePath: "/safe/profiles/account-1-v1",
  };

  const value = fixture({ conversation: cwConversation });
  assert.deepEqual(await value.service.resolve(cwInput), { status: "RESOLVED", lineChatUserId: CHAT_ID });
  assert.equal(value.writes.length, 1);
});

test("one in-flight mapping refresh is reused", async () => {
  let discoveryCalls = 0;
  const prisma = {
    conversation: {
      findMany: async () => [],
      findUnique: async () => null,
    },
  };
  const session = {
    discoverRecentChats: async () => {
      discoveryCalls++;
      await new Promise((resolve) => setImmediate(resolve));
      return {
        status: "READY" as const,
        chats: [chat()],
        pagesFetched: 1,
        totalRawRecords: 1,
      };
    },
  };
  const service = new LineChatRecentResolverService(prisma as never, session as never);
  const refreshInput = {
    lineOfficialAccountId: "oa-1",
    botId: BOT_ID,
    sessionKey: "profile-b",
    profilePath: "/safe/profile",
  };
  const [first, second] = await Promise.all([
    service.refreshSnapshot(refreshInput),
    service.refreshSnapshot(refreshInput),
  ]);
  assert.equal(first, second);
  assert.equal(discoveryCalls, 1);
});

test("batch backlog maps duplicate-name conversations to distinct LINE chats by timestamp", async () => {
  const rows = [
    {
      id: "conversation-a",
      storeId: "store-28375",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: null,
      customer: { displayName: "Max" },
      messages: [message(new Date(MESSAGE_AT.getTime() - 120_000))],
      store: { code: "28375", storeMaster: null },
    },
    {
      id: "conversation-b",
      storeId: "store-28375",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: null,
      customer: { displayName: "Max" },
      messages: [message(MESSAGE_AT)],
      store: { code: "28375", storeMaster: null },
    },
    {
      id: "conversation-c",
      storeId: "store-28375",
      lineOfficialAccountId: "oa-1",
      lineChatUserId: null,
      customer: { displayName: "Max" },
      messages: [message(new Date(MESSAGE_AT.getTime() + 120_000))],
      store: { code: "28375", storeMaster: null },
    },
  ];
  const writes: Array<Record<string, unknown>> = [];
  const diagnostics: string[] = [];
  const tx = {
    conversation: {
      findFirst: async () => null,
      updateMany: async (args: Record<string, unknown>) => {
        writes.push(args);
        return { count: 1 };
      },
      findUnique: async () => ({ lineOfficialAccountId: "oa-1", lineChatUserId: null }),
    },
  };
  const prisma = {
    conversation: {
      findMany: async (args: { where?: { id?: { in?: string[] }; lineChatUserId?: unknown } }) => {
        if (args.where?.id?.in) return rows;
        return [];
      },
      findUnique: async () => null,
    },
    $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new LineChatRecentResolverService(prisma as never, {} as never);
  (service as unknown as { logger: { log: (value: string) => void } }).logger = {
    log: (value: string) => diagnostics.push(value),
  };

  const snapshot = {
    key: "profile-b::oa-1::bot",
    status: "READY" as const,
    chats: [
      chat(CHAT_ID, "Max", -120_000),
      chat(CHAT_ID_2, "Max", 0),
      chat(CHAT_ID_3, "Max", 120_000),
    ],
    refreshedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    pagesFetched: 1,
    totalRawRecords: 3,
  };

  const result = await service.applySnapshotMappings({
    lineOfficialAccountId: "oa-1",
    conversationIds: rows.map((row) => row.id),
    snapshot,
    eligibility: {
      oaStoreId: "store-28375",
      oaAccountType: "STORE",
      oaIsActive: true,
      oaArchivedAt: null,
      oaChatBotId: BOT_ID,
      oaSessionKey: "profile-b",
      oaSessionStatus: "ACTIVE",
      expectedBotId: BOT_ID,
      expectedSessionKey: "profile-b",
    },
  });

  assert.equal(result.mappedCount, 3);
  assert.equal(result.ambiguousCount, 0);
  assert.equal(result.noMatchCount, 0);
  assert.deepEqual(writes.map((write) => (write.data as { lineChatUserId: string }).lineChatUserId), [
    CHAT_ID,
    CHAT_ID_2,
    CHAT_ID_3,
  ]);
  assert.equal(diagnostics.length, 3);
  assert.ok(diagnostics.every((value) => JSON.parse(value).resolutionMethod === "TIMESTAMP_FINGERPRINT"));
});

test("batch backlog remains ambiguous when duplicate names share the same timestamp window", async () => {
  const rows = [{
    id: "conversation-a",
    storeId: "store-28375",
    lineOfficialAccountId: "oa-1",
    lineChatUserId: null,
    customer: { displayName: "Max" },
    messages: [message(MESSAGE_AT)],
    store: { code: "28375", storeMaster: null },
  }];
  const prisma = {
    conversation: {
      findMany: async (args: { where?: { id?: { in?: string[] } } }) => args.where?.id?.in ? rows : [],
      findUnique: async () => null,
    },
  };
  const service = new LineChatRecentResolverService(prisma as never, {} as never);
  (service as unknown as { logger: { log: () => void } }).logger = { log: () => undefined };

  const result = await service.applySnapshotMappings({
    lineOfficialAccountId: "oa-1",
    conversationIds: ["conversation-a"],
    snapshot: {
      key: "profile-b::oa-1::bot",
      status: "READY",
      chats: [
        chat(CHAT_ID, "Max", -10_000),
        chat(CHAT_ID_2, "Max", 10_000),
      ],
      refreshedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      pagesFetched: 1,
      totalRawRecords: 2,
    },
    eligibility: {
      oaStoreId: "store-28375",
      oaAccountType: "STORE",
      oaIsActive: true,
      oaArchivedAt: null,
      oaChatBotId: BOT_ID,
      oaSessionKey: "profile-b",
      oaSessionStatus: "ACTIVE",
      expectedBotId: BOT_ID,
      expectedSessionKey: "profile-b",
    },
  });

  assert.equal(result.mappedCount, 0);
  assert.equal(result.ambiguousCount, 1);
  assert.equal(result.unresolvedReasons.get("conversation-a"), "RESOLVE_AMBIGUOUS");
});
