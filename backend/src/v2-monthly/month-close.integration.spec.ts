import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { StoreAccessService } from "../auth/store-access.service";
import { ConversationsService } from "../conversations.service";
import type { OperationsService } from "../operations/operations.service";
import type { PrismaService } from "../prisma.service";
import { CLOSED_BY_ADMIN, CLOSED_BY_SYSTEM, MonthCloseService, readSnapshot } from "./month-close.service";

// Runs against the dedicated, freshly migrated v2 database (CI: v2_monthly_ci). Synthetic data only.
const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;

void test("month close: parity with live /chats counts, Sep backfill flag, idempotent, never auto-overwritten, audited re-close", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = randomUUID().slice(0, 8);
  const operations = { getOperationalConversationFilter: async () => ({}) } as unknown as OperationsService;
  const prisma = db as unknown as PrismaService;
  const service = new MonthCloseService(prisma, operations, new StoreAccessService(prisma));
  const live = new ConversationsService(prisma, operations);
  try {
    const store = await db.store.create({ data: { id: `${prefix}-store`, name: "Synthetic close store", code: `${prefix}-code` } });
    const oa = await db.lineOfficialAccount.create({ data: { name: "Synthetic close OA", webhookKey: `${prefix}-hook`, storeId: store.id, accountType: "STORE" } as never });
    const chat = async (index: number, iso: string, status: string) => {
      const customer = await db.customer.create({ data: { displayName: `ลูกค้าตัวอย่าง ${index}`, lineUserId: `${prefix}-u${index}` } });
      return db.conversation.create({ data: { storeId: store.id, lineOfficialAccountId: oa.id, customerId: customer.id, latestMessageAt: new Date(iso), bmReplyStatus: status } as never });
    };
    await chat(1, "2026-09-03T03:00:00Z", "REPLIED");
    await chat(2, "2026-09-12T03:00:00Z", "NOT_REPLIED");
    await chat(3, "2026-09-29T03:00:00Z", "REPLIED");
    await chat(4, "2026-10-02T03:00:00Z", "NOT_REPLIED");

    await assert.rejects(() => service.close("2026-10", { closedBy: CLOSED_BY_ADMIN, actorName: "Synthetic Admin" }, new Date("2026-10-07T06:00:00Z")), /only after it ends/);

    // Today (7 Oct): September is past due (2 Oct 00:00 Bangkok) → closed now, flagged as a backfill.
    const now = new Date("2026-10-07T06:00:00Z");
    const before = await live.getBmReplyStatusSummary(null, "2026-09");
    const outcomes = await service.closeDueMonths(now);
    const september = outcomes.find((outcome) => outcome.month === "2026-09");
    assert.ok(september && september.status === "closed");
    assert.equal(september.revision, 1);
    assert.equal(september.backfill, true, "ปิดย้อนหลัง");

    // Parity: the snapshot equals the live /chats counts for that month at close time.
    const snapshot = await readSnapshot(db, "2026-09", null);
    assert.ok(snapshot.close && snapshot.network);
    assert.equal(snapshot.close.closedBy, CLOSED_BY_SYSTEM);
    assert.deepEqual(
      { total: snapshot.network.chatsTotal, unreplied: snapshot.network.chatsUnreplied, replied: snapshot.network.chatsReplied },
      { total: before.overview.total, unreplied: before.overview.notReplied + before.overview.notifiedBm, replied: before.overview.replied },
    );
    const mine = snapshot.stores.find((row) => row.storeUuid === store.id);
    const liveMine = before.stores.find((row) => row.storeId === store.id);
    assert.ok(mine && liveMine);
    assert.deepEqual([mine.chatsTotal, mine.chatsUnreplied, mine.chatsReplied], [liveMine.total, liveMine.notReplied + liveMine.notifiedBm, liveMine.replied]);
    assert.deepEqual([mine.chatsTotal, mine.chatsUnreplied, mine.chatsReplied, mine.hasChatData, mine.replyStatusCovered], [3, 1, 2, true, true]);

    // Idempotent, and never overwritten automatically even when live data changes.
    await chat(5, "2026-09-20T03:00:00Z", "NOT_REPLIED");
    assert.deepEqual((await service.closeDueMonths(now)).filter((outcome) => outcome.month === "2026-09"), []);
    const direct = await service.close("2026-09", { closedBy: CLOSED_BY_SYSTEM, actorName: "system" }, now);
    assert.equal(direct.status, "already-closed");
    assert.equal((await readSnapshot(db, "2026-09", [store.id])).stores[0]?.chatsTotal, 3, "closed snapshot unchanged");

    // Re-close: admin only with a reason; a new revision; the earlier revision's rows are kept.
    await assert.rejects(() => service.close("2026-09", { closedBy: CLOSED_BY_ADMIN, actorId: null, actorName: "Synthetic Admin" }, now), /needs a reason/);
    const reclose = await service.close("2026-09", { closedBy: CLOSED_BY_ADMIN, actorId: null, actorName: "Synthetic Admin", reason: "late webhook replay" }, now);
    assert.ok(reclose.status === "closed");
    assert.equal(reclose.revision, 2);
    assert.equal(reclose.backfill, false);
    const closes = await service.closes("2026-09");
    assert.deepEqual(closes.map((close) => [close.revision, close.closedBy, close.actorName, close.reason]), [[2, CLOSED_BY_ADMIN, "Synthetic Admin", "late webhook replay"], [1, CLOSED_BY_SYSTEM, "system", null]]);
    assert.equal(await db.monthlyStoreKpiSnapshot.count({ where: { month: "2026-09", revision: 1, storeUuid: store.id } }), 1, "revision 1 kept");
    const current = await readSnapshot(db, "2026-09", [store.id]);
    assert.equal(current.close?.revision, 2);
    assert.equal(current.stores[0]?.chatsTotal, 4);
    assert.equal(current.network?.chatsTotal, 4, "scoped callers get the sum of their stores");

    // October closes on time (2 Nov 00:00 Bangkok): not a backfill.
    const october = (await service.closeDueMonths(new Date("2026-11-01T17:05:00Z"))).find((outcome) => outcome.month === "2026-10");
    assert.ok(october && october.status === "closed");
    assert.equal(october.backfill, false);
  } finally {
    await db.$disconnect();
  }
});
