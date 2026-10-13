import assert from "node:assert/strict";
import test from "node:test";
import { classifySunnInbound, senderHash } from "./sunn-secretary-inbound";
import { SunnSecretaryReadOnlyKpiService, type SunnSecretarySummaryReader } from "./sunn-secretary-kpi-execution.service";
import type { PrismaService } from "../../prisma.service";
import type { MonthlySummary } from "./sunn-secretary-monthly";

const OWNER = `U${"a".repeat(32)}`;
const BOT = `U${"b".repeat(32)}`;
const STORE_A = "11111111-1111-4111-8111-111111111111";
const STORE_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-13T01:00:00.000Z");
const OA_A = "oa-a";
const OA_B = "oa-b";

function command(text = "@เลขาซันน์ เดือนตุลาคม พ.ศ. 2569 LINE OA สาขาไหนยังค้างตอบลูกค้าบ้าง", userId = OWNER) {
  const event = {
    type: "message", webhookEventId: "phase54-test-event", timestamp: NOW.getTime(),
    source: { type: "group", groupId: `C${"c".repeat(32)}`, userId },
    message: { type: "text", text, mention: { mentionees: [{ type: "user", userId: BOT }] } },
  };
  return classifySunnInbound(event, BOT, [OWNER], NOW).plan;
}

function summary(overrides: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    overview: { total: 2, notReplied: 1 },
    stores: [
      { storeId: STORE_A, storeName: "ร้าน A", total: 2, notReplied: 1 },
      { storeId: "focus-seven-store-group", storeName: "Focus stores", total: 2, notReplied: 1 },
    ],
    dataQuality: {
      sourceConversationCount: 2, rowBudgetExceeded: false, unmappedStoreConversationCount: 0,
      lineOaStoreIdentityMismatchCount: 0, inactiveLineOaConversationCount: 0,
      replyProjectionConversationCount: 2, replyProjectionMissingCount: 0, replyProjectionStaleCount: 0,
      replyProjectionUnknownVersionCount: 0,
    },
    ...overrides,
  };
}

function withEnv<T>(callback: () => Promise<T>, options: { enabled?: string; users?: string; scopes?: string } = {}): Promise<T> {
  const keys = ["SUNN_SECRETARY_WEBHOOK_ENABLED", "SUNN_SECRETARY_ALLOWED_USER_IDS", "SUNN_SECRETARY_STORE_SCOPE_BY_USER"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = options.enabled ?? "true";
  process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = options.users ?? OWNER;
  process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = options.scopes ?? JSON.stringify({ [OWNER]: [STORE_A] });
  return callback().finally(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

function harness(options: {
  stores?: Array<{ id: string }>;
  oas?: Array<{ id: string; storeId: string | null }>;
  mirrorStates?: Array<{ lineOfficialAccountId: string; storeId: string | null; enabled: boolean; status: string; lastSuccessfulSyncAt: Date | null; lastErrorCode: string | null }>;
  source?: MonthlySummary;
  sourceError?: Error;
  transactionError?: Error & { code?: string };
  beforeTransaction?: () => void;
} = {}) {
  const stores = options.stores ?? [{ id: STORE_A }];
  const oas = options.oas ?? [{ id: OA_A, storeId: STORE_A }, { id: OA_B, storeId: STORE_A }];
  const syncAt = new Date(NOW.getTime() - 10 * 60_000);
  const mirrorStates = options.mirrorStates ?? oas.map((oa) => ({
    lineOfficialAccountId: oa.id, storeId: oa.storeId, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: syncAt, lastErrorCode: null,
  }));
  const calls = { transaction: 0, stores: 0, oas: 0, mirrors: 0, summary: 0, writes: 0, sql: [] as string[], queryOptions: undefined as unknown, storeQueryIds: [] as string[], oaQueryStoreIds: [] as string[], summaryStoreIds: [] as string[] };
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray) => { calls.sql.push(strings.join("?")); return 0; },
    store: { findMany: async (args: { where: { id: { in: string[] } } }) => { calls.stores += 1; calls.storeQueryIds = args.where.id.in; return stores; }, create: async () => { calls.writes += 1; throw new Error("write attempted"); } },
    lineOfficialAccount: { findMany: async (args: { where: { storeId: { in: string[] } } }) => { calls.oas += 1; calls.oaQueryStoreIds = args.where.storeId.in; return oas; }, create: async () => { calls.writes += 1; throw new Error("write attempted"); } },
    lineChatMirrorStoreState: { findMany: async () => { calls.mirrors += 1; return mirrorStates; }, create: async () => { calls.writes += 1; throw new Error("write attempted"); } },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>, queryOptions: unknown) => {
      calls.transaction += 1;
      calls.queryOptions = queryOptions;
      options.beforeTransaction?.();
      if (options.transactionError) throw options.transactionError;
      return callback(tx);
    },
  } as unknown as PrismaService;
  const source = options.source ?? summary();
  const reader: SunnSecretarySummaryReader = {
    read: async (storeIds, _month, client, maxRows) => {
      calls.summary += 1;
      calls.summaryStoreIds = storeIds;
      assert.equal(client, tx as never);
      assert.equal(maxRows, 10_000);
      if (options.sourceError) throw options.sourceError;
      return source;
    },
  };
  class FixedClockKpiService extends SunnSecretaryReadOnlyKpiService {
    protected currentTime(): Date { return NOW; }
  }
  return { service: new FixedClockKpiService(prisma, reader), calls, oas };
}

test("executes only a prepared parsed Thai intent, read-only, with all OAs combined per authorized store", async () => withEnv(async () => {
  const instance = harness();
  const result = await instance.service.executePrepared({ state: "PREPARED", plan: command() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.answer.month, "2026-10");
  assert.equal(result.answer.totalUnansweredConversations, 1);
  assert.equal(result.answer.storesWithUnanswered, 1);
  assert.equal(result.answer.stores[0].storeId, STORE_A);
  assert.match(result.responseText, /ตุลาคม 2026/u);
  assert.match(result.responseText, /ประวัติแชทย้อนหลังครบถ้วน/u);
  assert.deepEqual(instance.calls.sql, ["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '5000ms'"]);
  assert.equal(instance.calls.writes, 0);
  assert.deepEqual(instance.calls.queryOptions, { isolationLevel: "RepeatableRead", maxWait: 1_000, timeout: 7_000 });
  assert.equal(instance.calls.oas, 1);
  assert.equal(instance.calls.mirrors, 1);
  assert.equal(instance.calls.summary, 1);
}));

test("receipt reservation alone is not executable and disabled mode performs no reads", async () => withEnv(async () => {
  const instance = harness();
  assert.deepEqual(await instance.service.executePrepared({ state: "RECEIVED", plan: command() }), { ok: false, reason: "COMMAND_NOT_PREPARED" });
  process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "false";
  assert.deepEqual(await instance.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "WEBHOOK_DISABLED" });
  assert.equal(instance.calls.transaction, 0);
}));

test("sender revocation before or at the read boundary fails before querying store or KPI data", async () => withEnv(async () => {
  const revoked = harness({ beforeTransaction: () => { process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = ""; } });
  const result = await revoked.service.executePrepared({ state: "PREPARED", plan: command() });
  assert.deepEqual(result, { ok: false, reason: "UNAUTHORIZED_SENDER" });
  assert.equal(revoked.calls.stores, 0);
  assert.equal(revoked.calls.summary, 0);
}, { users: OWNER }));

test("scope is server-resolved, deduplicated, explicit and never global", async () => {
  await withEnv(async () => {
    const duplicateScope = harness();
    process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = JSON.stringify({ [OWNER]: [STORE_A, STORE_A] });
    const allowed = await duplicateScope.service.executePrepared({ state: "PREPARED", plan: command() });
    assert.equal(allowed.ok, true);
  });
  for (const scopes of ["{}", "not-json", JSON.stringify({ [OWNER]: [] }), JSON.stringify({ [OWNER]: ["*"] })]) {
    await withEnv(async () => {
      const instance = harness();
      process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = scopes;
      assert.deepEqual(await instance.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "BLOCKED_STORE_SCOPE" });
      assert.equal(instance.calls.transaction, 0);
    });
  }
});

test("active non-archived stores must exactly match the server-authorized scope", async () => withEnv(async () => {
  const missing = harness({ stores: [] });
  assert.deepEqual(await missing.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "INACTIVE_OR_UNRESOLVED_STORE_SCOPE" });
  assert.equal(missing.calls.summary, 0);
}));

test("multiple-store owner scope is the only store set passed to the read adapter", async () => withEnv(async () => {
  process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = JSON.stringify({ [OWNER]: [STORE_A, STORE_B] });
  const source = summary({
    overview: { total: 3, notReplied: 2 },
    stores: [
      { storeId: STORE_A, storeName: "ร้าน A", total: 2, notReplied: 1 },
      { storeId: STORE_B, storeName: "ร้าน B", total: 1, notReplied: 1 },
      { storeId: "focus-seven-store-group", storeName: "Focus stores", total: 3, notReplied: 2 },
    ],
    dataQuality: { ...summary().dataQuality, sourceConversationCount: 3, replyProjectionConversationCount: 3 },
  });
  const instance = harness({
    stores: [{ id: STORE_A }, { id: STORE_B }],
    oas: [{ id: OA_A, storeId: STORE_A }, { id: OA_B, storeId: STORE_B }],
    source,
  });
  const result = await instance.service.executePrepared({ state: "PREPARED", plan: command() });
  assert.equal(result.ok, true);
  assert.deepEqual(instance.calls.storeQueryIds, [STORE_A, STORE_B]);
  assert.deepEqual(instance.calls.oaQueryStoreIds, [STORE_A, STORE_B]);
  assert.deepEqual(instance.calls.summaryStoreIds, [STORE_A, STORE_B]);
}));

test("every active OA must be mapped to the scoped store and have fresh, clean Mirror state", async () => withEnv(async () => {
  const wrongStore = harness({ mirrorStates: [
    { lineOfficialAccountId: OA_A, storeId: STORE_B, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date(NOW.getTime() - 1_000), lastErrorCode: null },
    { lineOfficialAccountId: OA_B, storeId: STORE_A, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date(NOW.getTime() - 1_000), lastErrorCode: null },
  ] });
  assert.deepEqual(await wrongStore.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "MIRROR_DATA_STALE_OR_PARTIAL" });
  assert.equal(wrongStore.calls.summary, 0);

  const stale = harness({ mirrorStates: [
    { lineOfficialAccountId: OA_A, storeId: STORE_A, enabled: true, status: "PARTIAL", lastSuccessfulSyncAt: new Date(NOW.getTime() - 3 * 60 * 60_000), lastErrorCode: "PARTIAL" },
    { lineOfficialAccountId: OA_B, storeId: STORE_A, enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date(NOW.getTime() - 1_000), lastErrorCode: null },
  ] });
  assert.deepEqual(await stale.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "MIRROR_DATA_STALE_OR_PARTIAL" });
  assert.equal(stale.calls.summary, 0);
}));

test("a verified operational zero differs from missing OA or Mirror data", async () => withEnv(async () => {
  const zero = summary({
    overview: { total: 0, notReplied: 0 },
    stores: [{ storeId: STORE_A, storeName: "ร้าน A", total: 0, notReplied: 0 }],
    dataQuality: { sourceConversationCount: 0, rowBudgetExceeded: false, unmappedStoreConversationCount: 0,
      lineOaStoreIdentityMismatchCount: 0, inactiveLineOaConversationCount: 0,
      replyProjectionConversationCount: 0, replyProjectionMissingCount: 0, replyProjectionStaleCount: 0, replyProjectionUnknownVersionCount: 0 },
  });
  const verified = harness({ source: zero });
  const result = await verified.service.executePrepared({ state: "PREPARED", plan: command() });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.answer.totalUnansweredConversations, 0);
  const missing = harness({ mirrorStates: [] });
  assert.deepEqual(await missing.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "MIRROR_DATA_STALE_OR_PARTIAL" });
}));

test("source identity duplicates, count mismatch, focus duplication and projection gaps fail closed", async () => withEnv(async () => {
  const cases = [
    summary({ stores: [
      { storeId: STORE_A, storeName: "A", total: 1, notReplied: 1 },
      { storeId: STORE_A, storeName: "A duplicate", total: 1, notReplied: 0 },
    ] }),
    summary({ overview: { total: 3, notReplied: 1 } }),
    summary({ dataQuality: { ...summary().dataQuality, replyProjectionStaleCount: 1 } }),
    summary({ dataQuality: { ...summary().dataQuality, replyProjectionUnknownVersionCount: 1 } }),
    summary({ dataQuality: { ...summary().dataQuality, rowBudgetExceeded: true } }),
  ];
  for (const source of cases) {
    const instance = harness({ source });
    const result = await instance.service.executePrepared({ state: "PREPARED", plan: command() });
    assert.deepEqual(result, { ok: false, reason: "SUMMARY_INCONSISTENT_OR_INCOMPLETE" });
  }
}));

test("uncovered historical and future months are rejected before KPI reads", async () => withEnv(async () => {
  const instance = harness();
  const august = command("@เลขาซันน์ เดือนสิงหาคม พ.ศ. 2569 LINE OA สาขาไหนยังค้างตอบลูกค้าบ้าง");
  assert.deepEqual(await instance.service.executePrepared({ state: "PREPARED", plan: august }), { ok: false, reason: "HISTORICAL_COVERAGE_UNSUPPORTED" });
  const future = command("@เลขาซันน์ เดือนพฤศจิกายน พ.ศ. 2569 LINE OA สาขาไหนยังค้างตอบลูกค้าบ้าง");
  assert.deepEqual(await instance.service.executePrepared({ state: "PREPARED", plan: future }), { ok: false, reason: "FUTURE_MONTH_UNAVAILABLE" });
  assert.equal(instance.calls.transaction, 0);
}));

test("database timeout and failures return redacted structured results without writes or outbound APIs", async () => withEnv(async () => {
  const timeout = harness({ transactionError: Object.assign(new Error("private database detail"), { code: "P2028" }) });
  assert.deepEqual(await timeout.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "READ_QUERY_TIMEOUT" });
  const statementTimeout = harness({ transactionError: Object.assign(new Error("private database detail"), { code: "P2010", meta: { code: "57014" } }) });
  assert.deepEqual(await statementTimeout.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "READ_QUERY_TIMEOUT" });
  const failure = harness({ sourceError: new Error("private SQL and credentials must not escape") });
  assert.deepEqual(await failure.service.executePrepared({ state: "PREPARED", plan: command() }), { ok: false, reason: "DATA_SOURCE_UNAVAILABLE" });
  assert.equal(failure.calls.writes, 0);
  assert.equal(failure.calls.sql[0], "SET TRANSACTION READ ONLY");
}));

test("invalid persisted plan is rejected and no arbitrary scope or command text is consumed", async () => withEnv(async () => {
  const instance = harness();
  assert.deepEqual(await instance.service.executePrepared({ state: "PREPARED", plan: { version: 1, classification: "AUTHORIZED", senderHash: senderHash(OWNER), intent: { kind: "RAW_SQL", sql: "select 1" }, attempts: 0 } }), { ok: false, reason: "INVALID_INTENT" });
  assert.equal(instance.calls.transaction, 0);
}));
