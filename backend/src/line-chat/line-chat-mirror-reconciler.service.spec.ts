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

import { liveMirrorIdentityCollisions } from "./fixtures/live-mirror-identity-collisions";

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
  fileName: string | null;
  conversation: { storeId: string | null; lineOfficialAccountId: string | null };
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
    senderUserId: null, senderDisplayName: null, rawPayload: {}, fileName: null,
    conversation: { storeId: "store-test", lineOfficialAccountId: "oa-test" },
  }];
  const conversation = {
    id: "conversation-test", latestMessageAt: inboundAt,
    bmReplyStatus: BmReplyStatus.NOT_REPLIED as BmReplyStatus,
    followUpStatus: FollowUpStatus.FOLLOW_UP as FollowUpStatus, ownerUserId: null,
  };
  const queries: Prisma.LineChatMirrorMessageFindManyArgs[] = [];
  const processed: string[] = [];
  const receipts: Array<{ id: string; data: Record<string, unknown> }> = [];
  let failReceiptOnce = false;
  const logs: string[] = [];
  const activities: unknown[] = [];
  let directMatches = 1;
  let directStoreId: string | null = "store-test";
  let contentMatches = 0;
  let failReplyStateObservation = false;
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
        if (failReceiptOnce) { failReceiptOnce = false; throw new Error("synthetic receipt failure"); }
        receipts.push({ id: input.where.id, data: input.data });
        processed.push(input.where.id);
        const row = rows.find((item) => item.id === input.where.id)!;
        row.reconcileStatus = input.data.reconcileStatus;
        row.updatedAt = new Date();
      },
    },
    conversation: {
      findMany: async (query: Prisma.ConversationFindManyArgs) => {
        if (query.where?.id && typeof query.where.id === "object" && "in" in query.where.id) {
          if (failReplyStateObservation) throw new Error("synthetic telemetry query failure");
          return (query.where.id.in as string[]).includes(conversation.id)
            ? [{ ...conversation }]
            : [];
        }
        return typeof query.where?.lineChatUserId === "string"
          ? Array.from({ length: directMatches }, (_, index) => ({ id: index === 0 ? conversation.id : "other-conversation", storeId: directStoreId }))
          : [];
      },
      findUnique: async () => ({ ...conversation }),
      update: async (input: { data: Partial<typeof conversation> }) => Object.assign(conversation, input.data),
    },
    message: {
      findMany: async (query: Prisma.MessageFindManyArgs) => {
        if (query.where?.OR) {
          return canonical.filter((message) => query.where!.OR!.some((filter) => {
            const external = filter.externalMessageId;
            if (typeof external === "object" && Array.isArray(external?.in)
              && external.in.includes(message.externalMessageId ?? "")) return true;
            if (!Array.isArray(filter.AND)) return false;
            const payload = message.rawPayload && typeof message.rawPayload === "object" && !Array.isArray(message.rawPayload)
              ? message.rawPayload : {};
            return filter.AND.every((part) => {
              if (part.conversation) return message.conversation.lineOfficialAccountId === "oa-test";
              const raw = part.rawPayload;
              if (raw && "path" in raw && Array.isArray(raw.path) && typeof raw.path[0] === "string") {
                return payload[raw.path[0]] === raw.equals;
              }
              return false;
            });
          }));
        }
        if (query.where?.sentAt && query.where.direction) {
          const time = query.where.sentAt as Prisma.DateTimeFilter;
          const near = canonical.filter((message) => message.conversationId === query.where!.conversationId
            && message.direction === query.where!.direction
            && message.deliveryStatus === MessageDeliveryStatus.DELIVERED
            && message.messageType === query.where!.messageType
            && message.originalText === query.where!.originalText
            && message.sentAt >= time.gte! && message.sentAt <= time.lte!);
          return [...near, ...Array.from({ length: contentMatches }, (_, index) => ({
            id: `content-duplicate-${index}`, externalMessageId: null, rawPayload: {},
          }))].slice(0, query.take);
        }
        return [...canonical].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
      },
      create: async (input: { data: Omit<TestCanonicalMessage, "id"> }) => {
        const message = { ...input.data, id: `canonical-${canonical.length}`,
          conversation: { storeId: "store-test", lineOfficialAccountId: "oa-test" } };
        canonical.push(message);
        return { id: message.id };
      },
    },
    user: { findMany: async () => [] },
    activityHistory: { create: async (input: unknown) => activities.push(input) },
  };
  const client = { ...prisma, $transaction: async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma) };
  const service = new LineChatMirrorReconcilerService(client as unknown as PrismaService);
  Object.defineProperty(service, "logger", {
    value: {
      log(message: string) { logs.push(message); },
      warn(message: string) { logs.push(message); },
      error() {},
    },
  });
  const reconcile = (batch: number, apply = true) => (service as unknown as {
    reconcileStore: (code: string, since: Date, apply: boolean, batch: number) => Promise<LineChatMirrorReconcileCycleResult>;
  }).reconcileStore("28220", new Date("2026-09-01"), apply, batch);
  return { service, reconcile, rows, canonical, conversation, queries, processed, receipts, activities, logs, prisma: client,
    failReceipt: () => { failReceiptOnce = true; },
    setContentMatches: (count: number) => { contentMatches = count; },
    setDirectMatches: (count: number) => { directMatches = count; },
    setDirectStoreId: (value: string | null) => { directStoreId = value; },
    failReplyStateObservation: () => { failReplyStateObservation = true; } };
}

test("reconciler imports Manager outbound first, updates canonical reply state, and remains idempotent", async () => {
  const h = createReconcileHarness();
  const first = await h.reconcile(3);
  assert.deepEqual(h.processed, ["reply-test", "inbound-test", "retry-old"]);
  assert.deepEqual(h.queries.map((query) => query.take), [3, 2, 1]);
  assert.deepEqual(h.queries[2].orderBy, [{ updatedAt: "asc" }, { sentAt: "desc" }, { id: "desc" }]);
  const retryEligibility = h.queries[2].where?.OR ?? [];
  const hasFilterProperty = (value: unknown, property: string): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && property in value;
  assert.equal(retryEligibility.some((filter) =>
    hasFilterProperty(filter.reconcileAttempts, "lt") && filter.reconcileAttempts.lt === 3), true);
  assert.equal(retryEligibility.some((filter) =>
    hasFilterProperty(filter.updatedAt, "lte") && filter.updatedAt.lte instanceof Date), true);
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

test("outbound reply-state telemetry failure cannot fail a successful reconcile cycle", async () => {
  const h = createReconcileHarness();
  h.failReplyStateObservation();

  const result = await h.reconcile(3);

  assert.equal(result.importedOutbound, 1);
  assert.equal(result.conversationsRecomputed, 1);
  assert.equal(h.conversation.bmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(h.logs.some((message) => message.includes("line_chat_mirror_manager_outbound_reply_state_observation_failed")), true);
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


test("unproven content/time near-matches are held and conflicting exact IDs cannot link", async () => {
  const duplicate = createReconcileHarness();
  duplicate.setContentMatches(1);
  assert.equal((await duplicate.reconcile(1)).ambiguous, 1);
  assert.equal(duplicate.receipts[0].data.reconcileSource, "CONTENT_TIME_IDENTITY_UNPROVEN");
  assert.equal(duplicate.receipts[0].data.canonicalMessageId, undefined);
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
  const prisma = {
    store: {
      findMany: async () => storeCodes.map((storeCode) => ({
        id: `store-${storeCode}`,
        code: storeCode,
        isActive: true,
        archivedAt: null,
        storeMaster: {
          externalStoreId: storeCode,
          accountName: `Store ${storeCode}`,
          normalizedAccountName: `store ${storeCode}`,
          lineId: `@${storeCode}`,
        },
        lineOfficialAccounts: [{
          id: `oa-${storeCode}`,
          name: `OA ${storeCode}`,
          basicId: `@${storeCode}`,
          isActive: true,
          archivedAt: null,
        }],
      })),
    },
  } as unknown as PrismaService;
  const service = new LineChatMirrorReconcilerService(prisma);
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
    assert.equal(calls.length, 136);
    assert.deepEqual(calls.filter((call) => call.apply).map((call) => call.code), storeCodes);
    assert.ok(calls.every((call) => call.batch === 100));
    assert.ok(calls.every((call) => call.code !== "dry-test"));
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

function identityHarness() {
  const h = createReconcileHarness();
  const template = { ...h.canonical[0] };
  h.canonical.length = 0;
  h.rows.splice(1);
  h.rows[0].text = "sanitized repeated message";
  const candidate = (managerId: string, overrides: Partial<TestCanonicalMessage> = {}): TestCanonicalMessage => ({
    ...template, conversation: { ...template.conversation },
    id: `canonical-${managerId}`, externalMessageId: mirrorCanonicalExternalId(managerId),
    direction: MessageDirection.OUTBOUND, originalText: h.rows[0].text, sentAt: h.rows[0].sentAt,
    rawPayload: { managerMessageId: managerId }, ...overrides,
  });
  return { ...h, candidate };
}

for (const fixture of liveMirrorIdentityCollisions) {
  test(`production pair ${fixture.storeCode}/${fixture.managerId} remains distinct and replay-safe`, async () => {
    const h = identityHarness();
    h.rows[0].managerMessageId = fixture.managerId;
    h.rows[0].sentAt = new Date(fixture.sourceAt);
    h.rows[0].bizId = fixture.canonicalSource === "AUTO_RESPONSE" ? "__AUTO_RESPONSE" : "owner-test";
    h.canonical.push(h.candidate(fixture.otherManagerId, { sentAt: new Date(fixture.otherAt),
      rawPayload: { managerMessageId: fixture.otherManagerId, source: fixture.canonicalSource } }));
    const result = await h.reconcile(1);
    assert.equal(result.importedOutbound, 1);
    assert.equal(result.contentTimeDuplicates, 0);
    assert.equal(h.canonical.length, 2);
    assert.equal(new Set(h.canonical.map((message) => message.externalMessageId)).size, 2);
    assert.equal(h.receipts[0].data.canonicalMessageId, h.canonical[1].id);
    h.rows[0].reconcileStatus = LineChatMirrorReconcileStatus.PENDING;
    assert.equal((await h.reconcile(1)).exactDuplicates, 1);
    assert.equal(h.canonical.length, 2);
  });
}

test("six identical texts within one second preserve six distinct Manager IDs", async () => {
  const h = identityHarness();
  h.rows[0].managerMessageId = "635000000000000001";
  for (let index = 1; index <= 5; index += 1) {
    h.rows.push({ ...h.rows[0], id: `raw-${index}`, managerMessageId: `63500000000000000${index + 1}`,
      sentAt: new Date(h.rows[0].sentAt.getTime() + index * 100) });
  }
  assert.equal((await h.reconcile(10)).importedOutbound, 6);
  assert.equal(h.canonical.length, 6);
  assert.equal(new Set(h.canonical.map((message) => message.externalMessageId)).size, 6);
});

test("verified webhook/Manager identity correlates despite out-of-order timestamps", async () => {
  const h = identityHarness();
  h.rows[0].direction = LineChatMirrorDirection.INBOUND;
  h.rows[0].managerMessageId = "635000000000000001";
  h.canonical.push(h.candidate(h.rows[0].managerMessageId, { externalMessageId: h.rows[0].managerMessageId,
    direction: MessageDirection.INBOUND, sentAt: new Date(h.rows[0].sentAt.getTime() - 20_000), rawPayload: {} }));
  assert.equal((await h.reconcile(1)).exactDuplicates, 1);
  assert.equal(h.receipts[0].data.canonicalMessageId, h.canonical[0].id);
  assert.equal(h.canonical.length, 1);
});

test("similar distinct inbound webhook/Manager events wait for exact webhook evidence", async () => {
  const h = identityHarness();
  h.rows[0].direction = LineChatMirrorDirection.INBOUND;
  h.canonical.push(h.candidate("635000000000000002", { externalMessageId: "635000000000000002",
    direction: MessageDirection.INBOUND, rawPayload: {} }));
  const result = await h.reconcile(1);
  assert.equal(result.waitingInboundCanonical, 1);
  assert.equal(result.contentTimeDuplicates, 0);
  assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
});

test("persisted provider alias correlates an application event without overwriting its client ID", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate("application", { externalMessageId: "client-delivery-id",
    rawPayload: { providerMessageId: h.rows[0].managerMessageId } }));
  assert.equal((await h.reconcile(1)).exactDuplicates, 1);
  assert.equal(h.canonical.length, 1);
  assert.equal(h.canonical[0].externalMessageId, "client-delivery-id");
});

test("identical content in another conversation cannot suppress an outbound import", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate("635000000000000002", { conversationId: "other-conversation" }));
  assert.equal((await h.reconcile(1)).importedOutbound, 1);
  assert.equal(h.canonical[1].conversationId, "conversation-test");
});

for (const conflict of ["direction", "store", "oa", "conversation", "payload"] as const) {
  test(`exact source with conflicting ${conflict} evidence remains unlinked`, async () => {
    const h = identityHarness();
    const message = h.candidate(h.rows[0].managerMessageId);
    if (conflict === "direction") message.direction = MessageDirection.INBOUND;
    if (conflict === "store") message.conversation.storeId = "other-store";
    if (conflict === "oa") message.conversation.lineOfficialAccountId = "other-oa";
    if (conflict === "conversation") message.conversationId = "other-conversation";
    if (conflict === "payload") message.rawPayload = { managerMessageId: "different-source" };
    h.canonical.push(message);
    assert.equal((await h.reconcile(1)).failed, 1);
    assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
    assert.equal(h.canonical.length, 1);
  });
}

test("opposite directions with different IDs remain distinct", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate("635000000000000002", { direction: MessageDirection.INBOUND }));
  assert.equal((await h.reconcile(1)).importedOutbound, 1);
  assert.equal(h.canonical[1].direction, MessageDirection.OUTBOUND);
});

for (const missing of ["", "   ", "event:synthetic"] as const) {
  test(`unproven source ${JSON.stringify(missing)} cannot merge or import`, async () => {
    const h = identityHarness();
    h.rows[0].managerMessageId = missing;
    h.canonical.push(h.candidate("635000000000000002"));
    assert.equal((await h.reconcile(1)).ambiguous, 1);
    assert.equal(h.receipts[0].data.reconcileSource, "SOURCE_IDENTITY_UNPROVEN");
    assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
    assert.equal(h.canonical.length, 1);
  });
}

test("ID-less auto reply stays held without merging or blindly importing a duplicate", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate("execution", { id: "auto-reply:execution", externalMessageId: null,
    rawPayload: { source: "AUTO_RESPONSE" } }));
  assert.equal((await h.reconcile(1)).ambiguous, 1);
  assert.equal(h.receipts[0].data.reconcileSource, "CONTENT_TIME_IDENTITY_UNPROVEN");
  assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
  assert.equal(h.canonical.length, 1);
});

test("multiple Canonical claims for one exact identity stay held", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate(h.rows[0].managerMessageId));
  h.canonical.push(h.candidate("alias", { externalMessageId: "client-id",
    rawPayload: { providerMessageId: h.rows[0].managerMessageId } }));
  assert.equal((await h.reconcile(1)).ambiguous, 1);
  assert.equal(h.receipts[0].data.reconcileSource, "EXACT_SOURCE_IDENTITY_AMBIGUOUS");
  assert.equal(h.canonical.length, 2);
});

test("restart after Canonical insert before Raw receipt and repeated polling remain idempotent", async () => {
  const h = identityHarness();
  h.failReceipt();
  assert.equal((await h.reconcile(1)).failed, 1);
  assert.equal(h.canonical.length, 1);
  const restarted = new LineChatMirrorReconcilerService(h.prisma as unknown as PrismaService);
  Object.defineProperty(restarted, "logger", { value: { log() {}, warn() {}, error() {} } });
  const reconcile = () => (restarted as unknown as {
    reconcileStore: (code: string, since: Date, apply: boolean, batch: number) => Promise<LineChatMirrorReconcileCycleResult>;
  }).reconcileStore("28220", new Date("2026-09-01"), true, 1);
  assert.equal((await reconcile()).exactDuplicates, 1);
  h.rows[0].reconcileStatus = LineChatMirrorReconcileStatus.PENDING;
  assert.equal((await reconcile()).exactDuplicates, 1);
  assert.equal(h.canonical.length, 1);
});

test("a capped near-match set stays held and cannot hide an unknown identity", async () => {
  const h = identityHarness();
  for (let index = 0; index < 100; index += 1) h.canonical.push(h.candidate(`known-${index}`));
  assert.equal((await h.reconcile(1)).ambiguous, 1);
  assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
  assert.equal(h.canonical.length, 100);
});

test("a numeric outbound client key without a provider alias is not identity proof", async () => {
  const h = identityHarness();
  h.canonical.push(h.candidate("client", { externalMessageId: "635000000000000002", rawPayload: {} }));
  assert.equal((await h.reconcile(1)).ambiguous, 1);
  assert.equal(h.canonical.length, 1);
});


for (const storeId of ["other-store", null]) {
  test(`direct OA/chat mapping with conflicting Store ${String(storeId)} stays held`, async () => {
    const h = identityHarness();
    h.setDirectStoreId(storeId);
    assert.equal((await h.reconcile(1)).ambiguous, 1);
    assert.equal(h.receipts[0].data.reconcileError, "DIRECT_CONVERSATION_STORE_SCOPE_CONFLICT");
    assert.equal(h.receipts[0].data.canonicalMessageId, undefined);
    assert.equal(h.canonical.length, 0);
  });
}
