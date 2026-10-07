import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { resolveChatDateRange, resolveChatMonthRange } from "../chat-period";
import { ConversationsService } from "../conversations.service";
import { DashboardResponseBucketsController } from "../dashboard-response-buckets.controller";
import type { HistoricalTimelineService } from "../historical-timeline.service";
import type { OperationsService } from "../operations/operations.service";
import type { PrismaService } from "../prisma.service";

const lastDay = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

void test("from/to covering a whole month = month mode, for every month shape", () => {
  for (const month of ["2026-09", "2026-10", "2026-12", "2027-02", "2028-02"]) {
    assert.deepEqual(resolveChatDateRange(`${month}-01`, `${month}-${lastDay(month)}`), resolveChatMonthRange(month), month);
  }
  const range = resolveChatDateRange("2026-09-01", "2026-09-07");
  assert.equal(range?.gte.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(range?.lt.toISOString(), "2026-09-07T17:00:00.000Z");
});

void test("invalid ranges are refused", () => {
  assert.equal(resolveChatDateRange("2026-09-08", "2026-09-07"), null, "from after to");
  assert.equal(resolveChatDateRange("2026-02-31", "2026-03-01"), null, "impossible date");
  assert.equal(resolveChatDateRange("2026-01-01", "2026-06-30"), null, "longer than 92 days");
  assert.equal(resolveChatDateRange("2026-9-1", "2026-09-07"), null);
  assert.equal(resolveChatDateRange("2026-09-01", null), null);
});

type Where = { latestMessageAt?: unknown };

function capturingService(rows: Array<{ storeId: string; latestMessageAt: Date; bmReplyStatus: string; state: string | null }>) {
  const wheres: Where[] = [];
  const prisma = {
    store: { findMany: async () => [{ id: "s1", name: "Synthetic One", code: "S1", storeMaster: { externalStoreId: "1" } }] },
    conversation: {
      findMany: async ({ where }: { where: Where & { latestMessageAt?: { gte: Date; lt: Date } } }) => {
        wheres.push(where);
        const range = where.latestMessageAt;
        return rows
          .filter((row) => !range || (row.latestMessageAt >= range.gte && row.latestMessageAt < range.lt))
          .map((row) => ({ storeId: row.storeId, latestMessageAt: row.latestMessageAt, bmReplyStatus: row.bmReplyStatus, replyStateProjection: row.state ? { state: row.state } : null }));
      },
    },
  } as unknown as PrismaService;
  const operations = { getOperationalConversationFilter: async () => ({}) } as unknown as OperationsService;
  return { service: new ConversationsService(prisma, operations), wheres };
}

void test("summary: a whole-month from/to returns exactly the month-mode counts (same query, same bucketing)", async () => {
  const at = (iso: string) => new Date(iso);
  const rows = [
    { storeId: "s1", latestMessageAt: at("2026-08-31T17:00:00Z"), bmReplyStatus: "REPLIED", state: "REPLIED" },
    { storeId: "s1", latestMessageAt: at("2026-09-15T05:00:00Z"), bmReplyStatus: "NOT_REPLIED", state: "NOT_REPLIED" },
    { storeId: "s1", latestMessageAt: at("2026-09-30T16:59:59Z"), bmReplyStatus: "NOTIFIED_BM", state: null },
    { storeId: "s1", latestMessageAt: at("2026-09-30T17:00:00Z"), bmReplyStatus: "REPLIED", state: "REPLIED" },
  ];
  const { service, wheres } = capturingService(rows);
  const byMonth = await service.getBmReplyStatusSummary(null, "2026-09");
  const byRange = await service.getBmReplyStatusSummary(null, undefined, { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(byRange, byMonth);
  assert.deepEqual(wheres[1], wheres[0], "identical Prisma where");
  assert.deepEqual(byMonth.overview, { total: 3, notReplied: 2, notifiedBm: 0, replied: 1 });
  const firstWeek = await service.getBmReplyStatusSummary(null, undefined, { from: "2026-09-01", to: "2026-09-07" });
  assert.deepEqual(firstWeek.overview, { total: 1, notReplied: 0, notifiedBm: 0, replied: 1 });
  await assert.rejects(() => service.getBmReplyStatusSummary(null, "2026-09", { from: "2026-09-01", to: "2026-09-07" }), /either month or from\/to/);
  await assert.rejects(() => service.getBmReplyStatusSummary(null, undefined, { from: "2026-09-07", to: "2026-09-01" }), /from ≤ to/);
});

void test("24h summary passes an optional storeId through; replyAnalytics keeps its own scope check", async () => {
  const calls: unknown[] = [];
  const timeline = { replyAnalytics: async (_user: unknown, input: unknown) => { calls.push(input); return { dates: [] }; } } as unknown as HistoricalTimelineService;
  const controller = new DashboardResponseBucketsController(timeline);
  const req = { user: { id: "u1" } } as never;
  await controller.getStore24hResponseSummary("2026-10-01", "2026-10-07", undefined, req);
  await controller.getStore24hResponseSummary("2026-10-01", "2026-10-07", " s1 ", req);
  assert.deepEqual(calls, [{ dateFrom: "2026-10-01", dateTo: "2026-10-07" }, { dateFrom: "2026-10-01", dateTo: "2026-10-07", storeId: "s1" }]);
});

const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;

void test("database parity: month mode and a whole-month from/to agree on real rows", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = randomUUID().slice(0, 8);
  try {
    const store = await db.store.create({ data: { id: `${prefix}-store`, name: "Synthetic range store", code: `${prefix}-code` } });
    const oa = await db.lineOfficialAccount.create({ data: { name: "Synthetic OA", webhookKey: `${prefix}-hook`, storeId: store.id, accountType: "STORE" } as never });
    const times = ["2026-08-31T17:00:00Z", "2026-09-10T03:00:00Z", "2026-09-30T16:59:59Z", "2026-09-30T17:00:00Z"];
    for (const [index, iso] of times.entries()) {
      const customer = await db.customer.create({ data: { displayName: `ลูกค้าตัวอย่าง ${index}`, lineUserId: `${prefix}-u${index}` } as never });
      await db.conversation.create({ data: { storeId: store.id, lineOfficialAccountId: oa.id, customerId: customer.id, latestMessageAt: new Date(iso), bmReplyStatus: index % 2 ? "NOT_REPLIED" : "REPLIED" } as never });
    }
    const operations = { getOperationalConversationFilter: async () => ({}) } as unknown as OperationsService;
    const service = new ConversationsService(db as unknown as PrismaService, operations);
    const byMonth = await service.getBmReplyStatusSummary([store.id], "2026-09");
    const byRange = await service.getBmReplyStatusSummary([store.id], undefined, { from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual(byRange, byMonth);
    assert.equal(byMonth.overview.total, 3);
  } finally {
    await db.$disconnect();
  }
});
