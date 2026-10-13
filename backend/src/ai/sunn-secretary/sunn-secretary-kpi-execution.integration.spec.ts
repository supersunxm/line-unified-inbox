import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { ConversationsService } from "../../conversations.service";
import { OperationsService } from "../../operations/operations.service";
import type { PrismaService } from "../../prisma.service";
import { classifySunnInbound } from "./sunn-secretary-inbound";
import { SunnSecretaryReadOnlyKpiService, type SunnSecretarySummaryReader } from "./sunn-secretary-kpi-execution.service";
import { bangkokMonth } from "./sunn-secretary-intent";

const databaseUrl = process.env.SECRETARY_SETTINGS_TEST_DATABASE_URL;

function assertDisposableLoopbackUrl(value: string): void {
  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//u, "");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(parsed.hostname) || !/(?:^|[-_])(ci|test)(?:$|[-_])/iu.test(databaseName)) {
    throw new Error("Sunn KPI integration test requires an isolated loopback CI/test PostgreSQL database");
  }
}

test("real PostgreSQL execution uses the existing summary in a read-only snapshot and performs no writes", { skip: !databaseUrl }, async () => {
  assertDisposableLoopbackUrl(databaseUrl!);
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID();
  const storeId = randomUUID();
  const storeCode = `S54${suffix.slice(0, 8)}`;
  const owner = `U${suffix.replace(/-/gu, "").slice(0, 32)}`;
  const oaIds = [randomUUID()];
  const now = new Date();
  const month = bangkokMonth(now);
  const [year, monthNumber] = month.split("-").map(Number);
  const latestMessageAt = new Date(Date.UTC(year, monthNumber - 1, 1) - 7 * 60 * 60_000);
  const capturedEnv = {
    enabled: process.env.SUNN_SECRETARY_WEBHOOK_ENABLED,
    users: process.env.SUNN_SECRETARY_ALLOWED_USER_IDS,
    scopes: process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER,
  };
  let customerId: string | undefined;
  let conversationId: string | undefined;
  try {
    process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "true";
    process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = owner;
    process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = JSON.stringify({ [owner]: [storeId] });

    const store = await db.store.create({ data: { id: storeId, name: "Sunn KPI Disposable Store", code: storeCode } });
    const oas = await Promise.all(oaIds.map((id, index) => db.lineOfficialAccount.create({ data: {
      id, webhookKey: `sunn-kpi-${suffix}-${index}`, name: `Sunn KPI Disposable OA ${index + 1}`,
      accountType: "STORE", storeId: store.id, isActive: true,
    } })));
    await db.lineChatMirrorStoreState.createMany({ data: oas.map((oa) => ({
      lineOfficialAccountId: oa.id, storeId: store.id, storeCode, enabled: true, status: "SUCCESS",
      lastSuccessfulSyncAt: new Date(),
    })) });
    const customer = await db.customer.create({ data: { displayName: "Disposable customer", lineUserId: `U${suffix.replace(/-/gu, "").slice(0, 32)}` } });
    customerId = customer.id;
    const conversation = await db.conversation.create({ data: {
      storeId: store.id, lineOfficialAccountId: oas[0].id, customerId: customer.id,
      latestMessageAt, bmReplyStatus: "NOT_REPLIED",
    } });
    conversationId = conversation.id;
    await db.conversationReplyStateProjection.create({ data: {
      conversationId: conversation.id, state: "NOT_REPLIED", decidingEventKind: "CUSTOMER_INBOUND",
      decidingEventAt: latestMessageAt, evidenceBoundary: latestMessageAt, resolverVersion: "reply-state-v1",
      canonicalMessageCount: 1, historicalMessageCount: 0, computedAt: new Date(),
    } });

    const before = await Promise.all([
      db.conversation.count({ where: { id: conversation.id } }),
      db.message.count({ where: { conversationId: conversation.id } }),
      db.conversationReplyStateProjection.count({ where: { conversationId: conversation.id } }),
      db.auditLog.count(),
    ]);
    const operations = new OperationsService(db as unknown as PrismaService);
    const source = new ConversationsService(db as unknown as PrismaService, operations);
    const reader: SunnSecretarySummaryReader = {
      read: (storeIds, month, client, maxRows) => source.getBmReplyStatusSummary(storeIds, month, undefined, { client, maxRows }),
    };
    const kpi = new SunnSecretaryReadOnlyKpiService(db as unknown as PrismaService, reader);
    const event = {
      type: "message", webhookEventId: `sunn-kpi-${suffix}`, timestamp: now.getTime(),
      source: { type: "group", groupId: `C${suffix.replace(/-/gu, "").slice(0, 32)}`, userId: owner },
      message: { type: "text", text: `@เลขาซันน์ ${month} LINE OA สาขาไหนยังค้างตอบลูกค้าบ้าง`,
        mention: { mentionees: [{ type: "user", userId: `U${"b".repeat(32)}` }] } },
    };
    const plan = classifySunnInbound(event, `U${"b".repeat(32)}`, [owner], now).plan;
    const result = await kpi.executePrepared({ state: "PREPARED", plan });
    assert.equal(result.ok, true, result.ok ? undefined : result.reason);
    if (!result.ok) return;
    assert.equal(result.answer.totalUnansweredConversations, 1);
    assert.equal(result.answer.storesWithUnanswered, 1);
    assert.equal(result.answer.stores[0].storeId, store.id);
    assert.equal(result.answer.dataQuality?.historicalMessageCompleteness, "NOT_CERTIFIED_BY_RECENT_MIRROR_SYNC");

    const after = await Promise.all([
      db.conversation.count({ where: { id: conversation.id } }),
      db.message.count({ where: { conversationId: conversation.id } }),
      db.conversationReplyStateProjection.count({ where: { conversationId: conversation.id } }),
      db.auditLog.count(),
    ]);
    assert.deepEqual(after, before);

    await assert.rejects(() => db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.store.create({ data: { name: "Must not persist from a Sunn KPI read" } });
    }), /read.only|read-only|25006/iu);
    assert.equal(await db.store.count({ where: { name: "Must not persist from a Sunn KPI read" } }), 0);
  } finally {
    if (conversationId) await db.conversation.deleteMany({ where: { id: conversationId } });
    if (customerId) await db.customer.deleteMany({ where: { id: customerId } });
    await db.lineChatMirrorStoreState.deleteMany({ where: { lineOfficialAccountId: { in: oaIds } } });
    await db.lineOfficialAccount.deleteMany({ where: { id: { in: oaIds } } });
    await db.store.deleteMany({ where: { id: storeId, code: storeCode } });
    await db.$disconnect();
    if (capturedEnv.enabled === undefined) delete process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
    else process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = capturedEnv.enabled;
    if (capturedEnv.users === undefined) delete process.env.SUNN_SECRETARY_ALLOWED_USER_IDS;
    else process.env.SUNN_SECRETARY_ALLOWED_USER_IDS = capturedEnv.users;
    if (capturedEnv.scopes === undefined) delete process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER;
    else process.env.SUNN_SECRETARY_STORE_SCOPE_BY_USER = capturedEnv.scopes;
  }
});
