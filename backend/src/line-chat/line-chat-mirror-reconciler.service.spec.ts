import assert from "node:assert/strict";
import test from "node:test";
import {
  BmReplyStatus, FollowUpStatus, LineChatMirrorDirection,
  LineChatMirrorReconcileStatus, MessageDeliveryStatus, MessageDirection,
  MessageType, Prisma,
} from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import {
  LineChatMirrorReconcilerService,
  type LineChatMirrorReconcileCycleResult,
  canonicalMessageTypeFromMirror,
  configuredLineChatMirrorReconcileDryRunStoreCodes,
  configuredLineChatMirrorReconcileStoreCodes,
  isLineChatMirrorReconcileApplyEnabled,
  isLineChatMirrorReconcileEnabled,
  lineChatMirrorReconcileBatchSize,
  lineChatMirrorReconcileEffectiveBatchSize,
  lineChatMirrorReconcileIntervalMs,
  lineChatMirrorReconcileSince,
  managerResponderDisplayName,
  mirrorCanonicalExternalId,
  mirrorCanonicalText,
  selectUniqueExactInboundConversationId,
} from "./line-chat-mirror-reconciler.service";

function withEnv(
  values: Record<string, string | undefined>,
  callback: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Project B canonical reconciler stays opt-in and apply is independently gated", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_ENABLED: undefined,
      LINE_CHAT_MIRROR_RECONCILE_APPLY: undefined,
    },
    () => {
      assert.equal(isLineChatMirrorReconcileEnabled(), false);
      assert.equal(isLineChatMirrorReconcileApplyEnabled(), false);
    },
  );
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_ENABLED: "true",
      LINE_CHAT_MIRROR_RECONCILE_APPLY: "false",
    },
    () => {
      assert.equal(isLineChatMirrorReconcileEnabled(), true);
      assert.equal(isLineChatMirrorReconcileApplyEnabled(), false);
    },
  );
});

test("Project B canonical reconciler always includes the full Live Mirror fleet", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_STORE_CODES: "28220, 28375;28220 3050",
      LINE_CHAT_MIRROR_RECONCILE_STORE_CODES: "25610,28375",
      LINE_CHAT_MIRROR_RECONCILE_SINCE: "2026-09-21T04:00:00.000Z",
    },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorReconcileStoreCodes(),
        ["28220", "28375", "3050", "25610"],
      );
      assert.equal(
        lineChatMirrorReconcileSince()?.toISOString(),
        "2026-09-21T04:00:00.000Z",
      );
    },
  );
  withEnv({ LINE_CHAT_MIRROR_RECONCILE_SINCE: "invalid" }, () => {
    assert.equal(lineChatMirrorReconcileSince(), null);
  });
});

test("Project B canonical reconciler keeps dry-run stores separate from the full apply scope", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_STORE_CODES: "28375,20789",
      LINE_CHAT_MIRROR_RECONCILE_STORE_CODES: "25610",
      LINE_CHAT_MIRROR_RECONCILE_DRY_RUN_STORE_CODES: "20789, 29039;28375 3791",
    },
    () => {
      assert.deepEqual(
        configuredLineChatMirrorReconcileStoreCodes(),
        ["28375", "20789", "25610"],
      );
      assert.deepEqual(
        configuredLineChatMirrorReconcileDryRunStoreCodes(),
        ["29039", "3791"],
      );
    },
  );
});

test("Project B canonical reconciler bounds interval and caps per-store work at full-fleet scale", () => {
  withEnv(
    {
      LINE_CHAT_MIRROR_RECONCILE_INTERVAL_MS: "1000",
      LINE_CHAT_MIRROR_RECONCILE_BATCH_SIZE: "5000",
    },
    () => {
      assert.equal(lineChatMirrorReconcileIntervalMs(), 30_000);
      assert.equal(lineChatMirrorReconcileBatchSize(), 1_000);
      assert.equal(lineChatMirrorReconcileEffectiveBatchSize(16), 1_000);
      assert.equal(lineChatMirrorReconcileEffectiveBatchSize(136), 100);
    },
  );
});

test("Project B canonical external IDs are namespaced away from webhook inbound IDs", () => {
  assert.equal(
    mirrorCanonicalExternalId("123456789"),
    "line-chat-manager:123456789",
  );
});

test("Manager mirror message types normalize to canonical types", () => {
  assert.equal(canonicalMessageTypeFromMirror("text"), MessageType.TEXT);
  assert.equal(canonicalMessageTypeFromMirror("image"), MessageType.IMAGE);
  assert.equal(canonicalMessageTypeFromMirror("file"), MessageType.FILE);
  assert.equal(canonicalMessageTypeFromMirror("future-type"), MessageType.UNSUPPORTED);
});

test("Manager mirror canonical text preserves text and supplies media placeholders", () => {
  assert.equal(
    mirrorCanonicalText({ messageType: "text", text: "hello", fileName: null }),
    "hello",
  );
  assert.equal(
    mirrorCanonicalText({ messageType: "file", text: null, fileName: "quote.pdf" }),
    "quote.pdf",
  );
  assert.equal(
    mirrorCanonicalText({ messageType: "image", text: null, fileName: null }),
    "[Image]",
  );
});


test("exact inbound Manager-message evidence maps only when every match points to one canonical conversation", () => {
  assert.deepEqual(selectUniqueExactInboundConversationId([]), { status: "NONE" });
  assert.deepEqual(
    selectUniqueExactInboundConversationId(["conversation-a", "conversation-a"]),
    { status: "UNIQUE", conversationId: "conversation-a" },
  );
  assert.deepEqual(
    selectUniqueExactInboundConversationId(["conversation-a", "conversation-b"]),
    { status: "AMBIGUOUS" },
  );
});


test("Project B statistics identity keeps the LINE OA Manager-visible responder name", () => {
  assert.equal(managerResponderDisplayName("  OBS-Sunx2  "), "OBS-Sunx2");
  assert.equal(managerResponderDisplayName("28375 PC Pub"), "28375 PC Pub");
  assert.equal(managerResponderDisplayName(null), "LINE OA Manager Staff");
});


type TestCanonicalMessage = {
  id: string;
  conversationId: string;
  externalMessageId: string | null;
  direction: MessageDirection;
  deliveryStatus: MessageDeliveryStatus;
  messageType: MessageType;
  originalText: string | null;
  sentAt: Date;
  senderUserId: string | null;
  senderDisplayName: string | null;
  rawPayload: Prisma.JsonValue;
};

function createReconcileHarness() {
  const inboundAt = new Date("2026-09-30T05:00:00Z");
  const replyAt = new Date("2026-09-30T05:01:00Z");
  const makeRow = (id: string, direction: LineChatMirrorDirection,
    reconcileStatus: LineChatMirrorReconcileStatus, updatedAt: Date) => ({
    id, direction, reconcileStatus, updatedAt,
    lineOfficialAccountId: "oa-test", lineChatUserId: "chat-test",
    managerMessageId: id, eventType: direction === "OUTBOUND" ? "messageSent" : "messageReceived",
    messageType: "text", text: id, fileName: null,
    bizId: "owner-test", ownerName: "Manager Test Staff", sentAt: replyAt,
  });
  const rows = [
    makeRow("reply-test", LineChatMirrorDirection.OUTBOUND, LineChatMirrorReconcileStatus.PENDING, replyAt),
    makeRow("inbound-test", LineChatMirrorDirection.INBOUND, LineChatMirrorReconcileStatus.PENDING, replyAt),
    makeRow("retry-new", LineChatMirrorDirection.INBOUND, LineChatMirrorReconcileStatus.WAITING_CANONICAL, replyAt),
    makeRow("retry-old", LineChatMirrorDirection.INBOUND, LineChatMirrorReconcileStatus.UNMAPPED, inboundAt),
  ];
  const canonical: TestCanonicalMessage[] = [{
    id: "canonical-inbound", conversationId: "conversation-test", externalMessageId: "webhook-test",
    direction: MessageDirection.INBOUND, deliveryStatus: MessageDeliveryStatus.DELIVERED,
    messageType: MessageType.TEXT, originalText: "synthetic question", sentAt: inboundAt,
    senderUserId: null, senderDisplayName: null, rawPayload: {},
  }];
  const conversation = {
    id: "conversation-test", latestMessageAt: inboundAt,
    bmReplyStatus: BmReplyStatus.NOT_REPLIED as BmReplyStatus,
    followUpStatus: FollowUpStatus.FOLLOW_UP as FollowUpStatus, ownerUserId: null,
  };
  const queries: Prisma.LineChatMirrorMessageFindManyArgs[] = [];
  const processed: string[] = [];
  const logs: string[] = [];
  const activities: unknown[] = [];
  let directMatches = 1;
  let contentMatches = 0;
  const prisma = {
    store: { findFirst: async () => ({
      id: "store-test", code: "28220", storeMaster: null,
      lineOfficialAccounts: [{ id: "oa-test", name: "Synthetic OA", basicId: "@synthetic" }],
    }) },
    lineChatMirrorMessage: {
      findMany: async (query: Prisma.LineChatMirrorMessageFindManyArgs) => {
        queries.push(query);
        const where = query.where!;
        // Exact inbound mapping evidence has no reconcile status constraint.
        if (!where.reconcileStatus) return [];
        const status = where.reconcileStatus;
        const statuses = typeof status === "string" ? [status] : status.in as LineChatMirrorReconcileStatus[];
        const direction = where.direction;
        const selected = rows.filter((row) => statuses.includes(row.reconcileStatus)
          && (direction === "OUTBOUND" ? row.direction === "OUTBOUND"
            : typeof direction === "object" ? row.direction !== "OUTBOUND" : true));
        if (typeof status !== "string") selected.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
        return selected.slice(0, query.take);
      },
      update: async (input: { where: { id: string }; data: { reconcileStatus: LineChatMirrorReconcileStatus } }) => {
        processed.push(input.where.id);
        const row = rows.find((item) => item.id === input.where.id)!;
        row.reconcileStatus = input.data.reconcileStatus;
        row.updatedAt = new Date();
      },
    },
    conversation: {
      findMany: async (query: Prisma.ConversationFindManyArgs) => typeof query.where?.lineChatUserId === "string"
        ? Array.from({ length: directMatches }, (_, index) => ({ id: index === 0 ? conversation.id : "other-conversation" })) : [],
      findUnique: async () => ({ ...conversation }),
      update: async (input: { data: Partial<typeof conversation> }) => Object.assign(conversation, input.data),
    },
    message: {
      findFirst: async (query: { where: { externalMessageId: { in: string[] } } }) =>
        canonical.find((message) => message.externalMessageId && query.where.externalMessageId.in.includes(message.externalMessageId)) ?? null,
      findMany: async (query: Prisma.MessageFindManyArgs) => {
        if (query.where?.direction) return Array.from({ length: contentMatches }, (_, index) => ({ id: `content-duplicate-${index}` }));
        return [...canonical].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      },
      create: async (input: { data: Omit<TestCanonicalMessage, "id"> }) => {
        const message = { ...input.data, id: `canonical-${canonical.length}` };
        canonical.push(message);
        return { id: message.id };
      },
    },
    user: { findMany: async () => [] },
    activityHistory: { create: async (input: unknown) => activities.push(input) },
  };
  const client = { ...prisma, $transaction: async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma) };
  const service = new LineChatMirrorReconcilerService(client as unknown as PrismaService);
  Object.defineProperty(service, "logger", { value: { log(message: string) { logs.push(message); }, error() {} } });
  const reconcile = (batch: number, apply = true) => (service as unknown as {
    reconcileStore: (code: string, since: Date, apply: boolean, batch: number) => Promise<LineChatMirrorReconcileCycleResult>;
  }).reconcileStore("28220", new Date("2026-09-01"), apply, batch);
  return { service, reconcile, rows, canonical, conversation, queries, processed, activities, logs,
    setContentMatches: (count: number) => { contentMatches = count; },
    setDirectMatches: (count: number) => { directMatches = count; } };
}

test("reconciler imports Manager outbound first, updates canonical reply state, and remains idempotent", async () => {
  const h = createReconcileHarness();
  const first = await h.reconcile(3);
  assert.deepEqual(h.processed, ["reply-test", "inbound-test", "retry-old"]);
  assert.deepEqual(h.queries.map((query) => query.take), [3, 2, 1]);
  assert.deepEqual(h.queries[2].orderBy, [{ updatedAt: "asc" }, { sentAt: "desc" }, { id: "desc" }]);
  const retryEligibility = h.queries[2].where?.OR ?? [];
  assert.equal(retryEligibility.some((filter) => filter.reconcileAttempts?.lt === 3), true);
  assert.equal(retryEligibility.some((filter) => filter.updatedAt?.lte instanceof Date), true);
  assert.equal(first.importedOutbound, 1);
  assert.equal(first.conversationsRecomputed, 1);
  const reply = h.canonical.find((message) => message.direction === "OUTBOUND")!;
  assert.equal(reply.externalMessageId, "line-chat-manager:reply-test");
  assert.equal(reply.deliveryStatus, MessageDeliveryStatus.DELIVERED);
  assert.equal(reply.senderDisplayName, "Manager Test Staff");
  assert.deepEqual(JSON.parse(JSON.stringify(reply.rawPayload)).provider, "LINE_MANAGER");
  const canonicalized = h.logs.map((message) => JSON.parse(message) as Record<string, unknown>)
    .find((message) => message.event === "line_chat_mirror_manager_outbound_canonicalized");
  assert.equal(typeof canonicalized?.conversationKey, "string");
  assert.equal(canonicalized?.canonicalImportAt !== undefined, true);
  assert.equal(canonicalized?.resultingReplyState, BmReplyStatus.REPLIED);
  assert.equal(JSON.stringify(canonicalized).includes("synthetic question"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(reply.rawPayload)).source, "LINE_MANAGER_MIRROR");
  assert.equal(h.conversation.bmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(h.conversation.followUpStatus, FollowUpStatus.COMPLETED);
  assert.equal(h.conversation.latestMessageAt.toISOString(), "2026-09-30T05:01:00.000Z");
  assert.equal(h.activities.length, 1);

  h.rows[0].reconcileStatus = LineChatMirrorReconcileStatus.PENDING;
  const second = await h.reconcile(1);
  assert.equal(second.exactDuplicates, 1);
  assert.equal(second.importedOutbound, 0);
  assert.equal(h.canonical.length, 2);
  assert.equal(h.activities.length, 1);
  assert.equal(h.queries.at(-1)?.take, 1); // A full outbound batch skips lower priority queries.
});

test("reconciler leaves ambiguous Manager mappings closed without canonical writes", async () => {
  const h = createReconcileHarness();
  h.setDirectMatches(2);
  const result = await h.reconcile(1);
  assert.equal(result.ambiguous, 1);
  assert.equal(result.importedOutbound, 0);
  assert.equal(h.canonical.length, 1);
  assert.equal(h.conversation.bmReplyStatus, BmReplyStatus.NOT_REPLIED);
});

test("reconciler dry-run reports Manager replies without changing canonical or mirror state", async () => {
  const h = createReconcileHarness();
  const result = await h.reconcile(1, false);
  assert.equal(result.wouldImportOutbound, 1);
  assert.equal(result.importedOutbound, 0);
  assert.equal(h.processed.length, 0);
  assert.equal(h.canonical.length, 1);
  assert.equal(h.conversation.bmReplyStatus, BmReplyStatus.NOT_REPLIED);
});


test("content/time duplicates and conflicting exact IDs cannot create another canonical reply", async () => {
  const duplicate = createReconcileHarness();
  duplicate.setContentMatches(1);
  assert.equal((await duplicate.reconcile(1)).contentTimeDuplicates, 1);
  assert.equal(duplicate.canonical.length, 1);

  const ambiguous = createReconcileHarness();
  ambiguous.setContentMatches(2);
  assert.equal((await ambiguous.reconcile(1)).ambiguous, 1);
  assert.equal(ambiguous.canonical.length, 1);

  const conflict = createReconcileHarness();
  conflict.canonical[0].externalMessageId = "line-chat-manager:reply-test";
  conflict.canonical[0].conversationId = "other-conversation";
  assert.equal((await conflict.reconcile(1)).failed, 1);
  assert.equal(conflict.canonical.length, 1);
});

test("full-fleet cycle passes the bounded batch to every effective apply store and logs both sizes", async () => {
  const keys = ["LINE_CHAT_MIRROR_STORE_CODES", "LINE_CHAT_MIRROR_RECONCILE_STORE_CODES",
    "LINE_CHAT_MIRROR_RECONCILE_DRY_RUN_STORE_CODES", "LINE_CHAT_MIRROR_RECONCILE_ENABLED",
    "LINE_CHAT_MIRROR_RECONCILE_APPLY", "LINE_CHAT_MIRROR_RECONCILE_SINCE", "LINE_CHAT_MIRROR_RECONCILE_BATCH_SIZE"];
  const previous = keys.map((key) => process.env[key]);
  const storeCodes = Array.from({ length: 136 }, (_, index) => String(10_000 + index));
  const calls: Array<{ code: string; apply: boolean; batch: number }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const service = new LineChatMirrorReconcilerService({} as PrismaService);
  Object.defineProperty(service, "logger", { value: { log: (value: string) => logs.push(JSON.parse(value) as Record<string, unknown>) } });
  Object.defineProperty(service, "reconcileStore", { value: async (code: string, _since: Date, apply: boolean, batch: number) => {
    calls.push({ code, apply, batch });
    return {} as LineChatMirrorReconcileCycleResult;
  } });
  try {
    process.env.LINE_CHAT_MIRROR_STORE_CODES = storeCodes.join(",");
    process.env.LINE_CHAT_MIRROR_RECONCILE_STORE_CODES = storeCodes[0];
    process.env.LINE_CHAT_MIRROR_RECONCILE_DRY_RUN_STORE_CODES = `${storeCodes[1]},dry-test`;
    process.env.LINE_CHAT_MIRROR_RECONCILE_ENABLED = "true";
    process.env.LINE_CHAT_MIRROR_RECONCILE_APPLY = "true";
    process.env.LINE_CHAT_MIRROR_RECONCILE_SINCE = "2026-09-01";
    process.env.LINE_CHAT_MIRROR_RECONCILE_BATCH_SIZE = "1000";
    service.onModuleInit();
    await service.runCycle();
    assert.equal(calls.length, 137);
    assert.deepEqual(calls.filter((call) => call.apply).map((call) => call.code), storeCodes);
    assert.ok(calls.every((call) => call.batch === 100));
    assert.deepEqual(calls.at(-1), { code: "dry-test", apply: false, batch: 100 });
    const startup = logs.find((log) => log.event === "line_chat_mirror_reconciler_started")!;
    assert.equal(startup.storeCount, 136);
    assert.equal(startup.apply, true);
    assert.equal(startup.configuredBatchSize, 1000);
    assert.equal(startup.effectiveBatchSize, 100);
  } finally {
    service.onModuleDestroy();
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
