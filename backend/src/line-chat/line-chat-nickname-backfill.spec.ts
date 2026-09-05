import assert from "node:assert/strict";
import test from "node:test";
import {
  CustomerSalesStatus,
  LineChatNicknameSyncJobStatus,
  PaymentMethodType,
  PrismaClient,
} from "@prisma/client";
import {
  applyPilotBackfill,
  assertPilotStore,
  classifyBackfillConversation,
  formatPilotBackfillReport,
  loadPilotBackfillPlan,
  summarizeBackfill,
  type BackfillConversationInput,
  type NicknameQueue,
  type PilotBackfillPlan,
} from "./line-chat-nickname-backfill";
import { LineChatNicknameQueueService } from "./line-chat-nickname-queue.service";
import { parseBackfillArgs, runBackfillCli } from "../../scripts/backfill-line-chat-nicknames";

function conversation(
  overrides: Partial<BackfillConversationInput> = {},
): BackfillConversationInput {
  return {
    id: "conversation-1",
    displayName: "Test Customer",
    customerSalesStatus: CustomerSalesStatus.ONLINE,
    paymentMethod: null,
    salesRecordedAt: null,
    lineChatUserId: "Uchat_user_1",
    salesProducts: [],
    ...overrides,
  };
}

function planWithRows(rows: PilotBackfillPlan["rows"]): PilotBackfillPlan {
  return {
    store: { id: "store-28375", code: "28375", name: "OBS Robinson Chonburi By OPPO" },
    lineOfficialAccount: { id: "oa-28375", name: "OPPO BS RBS Chonburi" },
    rows,
    summary: summarizeBackfill(rows),
  };
}

function readOnlyPrisma(conversations: readonly BackfillConversationInput[]): PrismaClient {
  const queryResult = conversations.map((item) => ({
    id: item.id,
    lineOfficialAccountId: "oa-28375",
    customerSalesStatus: item.customerSalesStatus,
    paymentMethod: item.paymentMethod,
    salesRecordedAt: item.salesRecordedAt,
    lineChatUserId: item.lineChatUserId,
    customer: { displayName: item.displayName },
    salesProducts: item.salesProducts,
  }));

  return {
    store: {
      findMany: async () => [{
        id: "store-28375",
        code: "28375",
        name: "OBS Robinson Chonburi By OPPO",
        storeMaster: { externalStoreId: "28375" },
        lineOfficialAccounts: [{ id: "oa-28375", name: "OPPO BS RBS Chonburi" }],
      }],
    },
    conversation: {
      findMany: async () => queryResult,
    },
  } as unknown as PrismaClient;
}

test("historical ONLINE classification targets Online", () => {
  const row = classifyBackfillConversation(conversation());
  assert.equal(row.classification, "WOULD_ENQUEUE_ONLINE");
  assert.equal(row.targetNickname, "Online");
});

test("historical PURCHASED CASH strips OPPO and uses Bangkok MM/YY", () => {
  const row = classifyBackfillConversation(conversation({
    customerSalesStatus: CustomerSalesStatus.PURCHASED,
    paymentMethod: PaymentMethodType.CASH,
    salesRecordedAt: new Date("2026-08-31T17:30:00.000Z"),
    salesProducts: [{ customProductName: null, productModel: { name: "OPPO Find X9" } }],
  }));

  assert.equal(row.classification, "WOULD_ENQUEUE_PURCHASED");
  assert.equal(row.targetNickname, "Find X9 สด 09/26");
});

test("historical PURCHASED INSTALLMENT targets model plus Thai payment label", () => {
  const row = classifyBackfillConversation(conversation({
    customerSalesStatus: CustomerSalesStatus.PURCHASED,
    paymentMethod: PaymentMethodType.INSTALLMENT,
    salesRecordedAt: new Date("2026-08-15T02:00:00.000Z"),
    salesProducts: [{ customProductName: "Reno14 Pro", productModel: { name: "OPPO Reno14 Pro 5G" } }],
  }));

  assert.equal(row.classification, "WOULD_ENQUEUE_PURCHASED");
  assert.equal(row.targetNickname, "Reno14Pro ผ่อน 08/26");
});

test("INTERESTED and no sales status are skipped without nickname changes", () => {
  const interested = classifyBackfillConversation(conversation({
    customerSalesStatus: CustomerSalesStatus.INTERESTED,
  }));
  const noStatus = classifyBackfillConversation(conversation({ customerSalesStatus: null }));

  assert.equal(interested.classification, "SKIP_INTERESTED");
  assert.equal(interested.targetNickname, null);
  assert.equal(noStatus.classification, "SKIP_NO_NICKNAME_NEEDED");
});

test("eligible historical sales state without lineChatUserId is skipped", () => {
  const row = classifyBackfillConversation(conversation({ lineChatUserId: "  " }));
  assert.equal(row.classification, "SKIP_MISSING_LINE_CHAT_USER_ID");
  assert.equal(row.targetNickname, "Online");
});

test("PURCHASED with missing model, payment, or salesRecordedAt is skipped", () => {
  const base = {
    customerSalesStatus: CustomerSalesStatus.PURCHASED,
    paymentMethod: PaymentMethodType.CASH,
    salesRecordedAt: new Date("2026-08-15T02:00:00.000Z"),
    salesProducts: [{ customProductName: null, productModel: { name: "OPPO Find X9" } }],
  } satisfies Partial<BackfillConversationInput>;

  const rows = [
    classifyBackfillConversation(conversation({ ...base, salesProducts: [] })),
    classifyBackfillConversation(conversation({ ...base, paymentMethod: null })),
    classifyBackfillConversation(conversation({ ...base, salesRecordedAt: null })),
  ];
  assert.ok(rows.every((row) => row.classification === "SKIP_INCOMPLETE_PURCHASE_DATA"));
});

test("summary and preview contain safe fields without Messaging API IDs", () => {
  const rows = [
    classifyBackfillConversation(conversation()),
    classifyBackfillConversation(conversation({
      id: "conversation-2",
      customerSalesStatus: CustomerSalesStatus.INTERESTED,
      lineChatUserId: null,
    })),
  ];
  const plan = planWithRows(rows);
  const report = formatPilotBackfillReport(plan, false);

  assert.equal(plan.summary.totalConversations, 2);
  assert.equal(plan.summary.wouldEnqueueCount, 1);
  assert.equal(plan.summary.skippedByReason.SKIP_INTERESTED, 1);
  assert.match(report, /conversation-1 \| Test Customer \| ONLINE \| Online \| yes/);
  assert.match(report, /SKIP_MISSING_LINE_CHAT_USER_ID/);
  assert.doesNotMatch(report, /SKIP_MISSING_CHAT_ID/);
  assert.doesNotMatch(report, /lineUserId/i);
  assert.match(report, /lineChatUserId/);
});

test("dry-run is default and performs zero writes or queue calls", async () => {
  let queueCalls = 0;
  const output: string[] = [];
  const prisma = readOnlyPrisma([conversation()]);
  const queue: NicknameQueue = {
    enqueueSalesSync: async () => {
      queueCalls++;
      throw new Error("dry-run must not reach queue");
    },
  };

  await runBackfillCli(["--store", "28375"], {
    prisma,
    queue,
    output: (message) => output.push(message),
  });

  assert.equal(parseBackfillArgs(["--store", "28375"]).apply, false);
  assert.equal(queueCalls, 0);
  assert.match(output.join("\n"), /zero database mutations and zero network calls/i);
});

test("apply routes eligible rows through queue architecture with idempotency enabled", async () => {
  const calls: Array<{ conversationId: string; skipIfMatchingJobExists?: boolean }> = [];
  const rows = [
    classifyBackfillConversation(conversation({ id: "conversation-online" })),
    classifyBackfillConversation(conversation({
      id: "conversation-interested",
      customerSalesStatus: CustomerSalesStatus.INTERESTED,
    })),
  ];
  const queue: NicknameQueue = {
    enqueueSalesSync: async (conversationId, options) => {
      calls.push({ conversationId, skipIfMatchingJobExists: options?.skipIfMatchingJobExists });
      return { enqueued: true, jobId: "job-1", supersededCount: 2 };
    },
  };

  const summary = await applyPilotBackfill(planWithRows(rows), queue);

  assert.deepEqual(calls, [{ conversationId: "conversation-online", skipIfMatchingJobExists: true }]);
  assert.equal(summary.createdCount, 1);
  assert.equal(summary.supersededCount, 2);
  assert.equal(summary.skippedCount, 0);
  assert.equal(summary.failedCount, 0);
});

test("idempotent queue option does not retry a matching failed job", async () => {
  let updateCalls = 0;
  let createCalls = 0;
  const prisma = {
    conversation: {
      findUnique: async () => ({
        id: "conversation-1",
        lineOfficialAccountId: "oa-28375",
        lineChatUserId: "Uchat_user_1",
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: null,
        lineOfficialAccount: {
          id: "oa-28375",
          chatBotId: "Ubot_28375",
          lineChatSessionId: "session-profile-b",
          lineChatNicknameSyncEnabled: true,
          lineChatSession: { id: "session-profile-b", sessionKey: "profile-b", status: "ACTIVE" },
        },
        salesProducts: [],
      }),
    },
    lineChatNicknameSyncJob: {
      findFirst: async () => ({ id: "existing-job", status: LineChatNicknameSyncJobStatus.FAILED }),
      updateMany: async () => {
        updateCalls++;
        return { count: 0 };
      },
      create: async () => {
        createCalls++;
        return { id: "unexpected" };
      },
    },
  };
  const queue = new LineChatNicknameQueueService(prisma as never);

  const result = await queue.enqueueSalesSync("conversation-1", { skipIfMatchingJobExists: true });

  assert.equal(result.enqueued, false);
  assert.equal(result.reason, "MATCHING_JOB_EXISTS");
  assert.equal(result.existingJobStatus, LineChatNicknameSyncJobStatus.FAILED);
  assert.equal(updateCalls, 0);
  assert.equal(createCalls, 0);
});

test("pilot guard rejects every store except 28375 before data access", async () => {
  assert.doesNotThrow(() => assertPilotStore("28375"));
  assert.throws(() => assertPilotStore("99999"), /Only store 28375 is allowed/);
  assert.throws(() => parseBackfillArgs(["--store", "99999", "--apply"]), /Pilot guard rejected/);

  let storeQueries = 0;
  const prisma = {
    store: { findMany: async () => { storeQueries++; return []; } },
  } as unknown as PrismaClient;
  await assert.rejects(() => loadPilotBackfillPlan(prisma, "99999"), /Pilot guard rejected/);
  assert.equal(storeQueries, 0);
});

test("ambiguous Store/OA and cross-OA topology fail closed", async () => {
  const ambiguousStorePrisma = {
    store: { findMany: async () => [{ id: "a" }, { id: "b" }] },
  } as unknown as PrismaClient;
  await assert.rejects(
    () => loadPilotBackfillPlan(ambiguousStorePrisma, "28375"),
    /multiple Store records/,
  );

  const storeRecord = {
    id: "store-28375",
    code: "28375",
    name: "OBS Robinson Chonburi By OPPO",
    storeMaster: { externalStoreId: "28375" },
  };
  const ambiguousOaPrisma = {
    store: {
      findMany: async () => [{
        ...storeRecord,
        lineOfficialAccounts: [
          { id: "oa-1", name: "OA 1" },
          { id: "oa-2", name: "OA 2" },
        ],
      }],
    },
  } as unknown as PrismaClient;
  await assert.rejects(
    () => loadPilotBackfillPlan(ambiguousOaPrisma, "28375"),
    /exactly one active Store LINE OA/,
  );

  const crossOaPrisma = {
    store: {
      findMany: async () => [{
        ...storeRecord,
        lineOfficialAccounts: [{ id: "oa-28375", name: "Pilot OA" }],
      }],
    },
    conversation: {
      findMany: async () => [{
        id: "conversation-other-oa",
        lineOfficialAccountId: "oa-other",
        customerSalesStatus: CustomerSalesStatus.ONLINE,
        paymentMethod: null,
        salesRecordedAt: null,
        lineChatUserId: "Uchat_user_1",
        customer: { displayName: "Test Customer" },
        salesProducts: [],
      }],
    },
  } as unknown as PrismaClient;
  await assert.rejects(
    () => loadPilotBackfillPlan(crossOaPrisma, "28375"),
    /linked to a different OA/,
  );
});
