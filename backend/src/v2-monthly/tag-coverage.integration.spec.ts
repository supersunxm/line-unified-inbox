import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { ConversationsService } from "../conversations.service";
import type { OperationsService } from "../operations/operations.service";
import type { PrismaService } from "../prisma.service";
import { NicknameTagsV4Service } from "./nickname-tags-v4.service";
import { TagCoverageService } from "./tag-coverage.service";

// Runs against the dedicated, freshly migrated v2 database (CI: v2_monthly_ci). Synthetic names only.
const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;

void test("tag coverage: same chats as the /chats month summary; unread names are told apart from untagged", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prisma = db as unknown as PrismaService;
  const operations = { getOperationalConversationFilter: async () => ({}) } as unknown as OperationsService;
  const prefix = randomUUID().slice(0, 8);
  try {
    const store = await db.store.create({ data: { id: `${prefix}-store`, name: "Synthetic coverage store", code: `${prefix}-code` } });
    const empty = await db.store.create({ data: { id: `${prefix}-empty`, name: "Synthetic unread store", code: `${prefix}-code2` } });
    const oa = await db.lineOfficialAccount.create({ data: { name: "Synthetic coverage OA", webhookKey: `${prefix}-hook`, storeId: store.id, accountType: "STORE" } as never });
    const oa2 = await db.lineOfficialAccount.create({ data: { name: "Synthetic unread OA", webhookKey: `${prefix}-hook2`, storeId: empty.id, accountType: "STORE" } as never });
    const chat = async (index: number, storeId: string, oaId: string, latest: string) => {
      const customer = await db.customer.create({ data: { displayName: `ลูกค้าตัวอย่าง ${index}`, lineUserId: `${prefix}-u${index}` } });
      return db.conversation.create({ data: { storeId, lineOfficialAccountId: oaId, customerId: customer.id, lineChatUserId: `${prefix}-chat${index}`, latestMessageAt: new Date(latest) } as never });
    };
    const c1 = await chat(1, store.id, oa.id, "2026-09-05T03:00:00Z");
    const c2 = await chat(2, store.id, oa.id, "2026-09-06T03:00:00Z");
    await chat(3, store.id, oa.id, "2026-09-07T03:00:00Z");
    await chat(4, store.id, oa.id, "2026-10-01T03:00:00Z");
    await chat(5, empty.id, oa2.id, "2026-09-08T03:00:00Z");
    const batchId = `${prefix}-batch`;
    await db.nicknameSourceCapture.create({ data: { id: batchId, storeId: store.id, lineOfficialAccountId: oa.id, observedAt: new Date("2026-09-20T03:00:00Z"), chatCount: 2, coverage: "RECENT_WINDOW", durationMs: 1 } });
    for (const [index, conversation, nickname] of [[1, c1, "TestUser Online ติดฟิล์ม 09/26 เพิ่มเติม"], [2, c2, "คุณเอ"]] as const) {
      await db.nicknameSourceObservation.create({ data: {
        id: `${batchId}-${index}`, batchId, storeId: store.id, lineOfficialAccountId: oa.id, lineChatUserId: `${prefix}-chat${index}`, conversationId: conversation.id,
        nickname, nicknameReadStatus: "READ", observedAt: new Date("2026-09-20T03:00:00Z"), ruleVersion: "manager-source-v2", classification: "NO_TAG_SIGNAL", reason: "synthetic",
      } });
    }
    const tags = new NicknameTagsV4Service(prisma);
    const run = await tags.startFull({ trigger: "ADMIN", actorName: "Synthetic Admin" });
    let state = await tags.continueFull(run.id);
    for (let guard = 0; !state.finishedAt && guard < 1000; guard++) state = await tags.continueFull(run.id);

    const coverage = await new TagCoverageService(prisma, operations).coverage("2026-09", [store.id, empty.id]);
    const summary = await new ConversationsService(prisma, operations).getBmReplyStatusSummary([store.id, empty.id], "2026-09");
    assert.equal(coverage.network.total, summary.overview.total, "same chats as /chats");
    const mine = coverage.stores.find((row) => row.storeUuid === store.id)!;
    assert.deepEqual(
      { total: mine.total, read: mine.read, tagged: mine.tagged, withPeriod: mine.withPeriod, online: mine.byType.online, film: mine.byType.film, period: mine.byType.period, product: mine.byType.product },
      { total: 3, read: 2, tagged: 1, withPeriod: 1, online: 1, film: 1, period: 1, product: 0 },
    );
    const unread = coverage.stores.find((row) => row.storeUuid === empty.id)!;
    assert.deepEqual([unread.total, unread.read, unread.tagged], [1, 0, 0], "no name read: v2 shows ยังไม่ได้อ่านชื่อ, not 0%");
    assert.equal(coverage.rederiveComplete, true);
    assert.ok(coverage.updatedAt);
    await assert.rejects(() => new TagCoverageService(prisma, operations).coverage("2026-9", null), /YYYY-MM/);
  } finally {
    await db.$disconnect();
  }
});
