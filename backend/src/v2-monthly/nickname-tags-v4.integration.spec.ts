import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import { NICKNAME_PARSER_V4_RULE_VERSION } from "./nickname-parser-v4";
import { MODE_INCREMENTAL, NicknameTagsV4Service } from "./nickname-tags-v4.service";

// Runs against the dedicated, freshly migrated v2 database (CI: v2_monthly_ci). Synthetic names only.
const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;

void test("Parser v4 re-derive: bounded full pass, idempotent, incremental, raw observations and v3 rows untouched", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prefix = randomUUID().slice(0, 8);
  const service = new NicknameTagsV4Service(db as unknown as PrismaService);
  try {
    const series = await db.productSeries.upsert({ where: { name: "Reno Series" }, create: { name: "Reno Series" }, update: {} });
    const reno = await db.productModel.upsert({ where: { name: "OPPO Reno16 Pro 5G" }, create: { name: "OPPO Reno16 Pro 5G", productSeriesId: series.id }, update: { isActive: true } });
    const store = await db.store.create({ data: { id: `${prefix}-store`, name: "Synthetic tag store", code: `${prefix}-code` } });
    const oa = await db.lineOfficialAccount.create({ data: { name: "Synthetic tag OA", webhookKey: `${prefix}-hook`, storeId: store.id, accountType: "STORE" } as never });
    const conversation = async (index: number) => {
      const customer = await db.customer.create({ data: { displayName: `ลูกค้าตัวอย่าง ${index}`, lineUserId: `${prefix}-u${index}` } });
      return db.conversation.create({ data: { storeId: store.id, lineOfficialAccountId: oa.id, customerId: customer.id, lineChatUserId: `${prefix}-chat${index}`, latestMessageAt: new Date("2026-09-10T03:00:00Z") } as never });
    };
    const [c1, c2, c3, c4] = [await conversation(1), await conversation(2), await conversation(3), await conversation(4)];
    const capture = async (observedAt: string, rows: Array<{ chat: string; nickname: string | null; status: string; conversationId: string }>) => {
      const batchId = `${prefix}-${observedAt}`;
      await db.nicknameSourceCapture.create({ data: { id: batchId, storeId: store.id, lineOfficialAccountId: oa.id, observedAt: new Date(observedAt), chatCount: rows.length, coverage: "RECENT_WINDOW", durationMs: 1 } });
      for (const row of rows) {
        await db.nicknameSourceObservation.create({ data: {
          id: `${batchId}-${row.chat}`, batchId, storeId: store.id, lineOfficialAccountId: oa.id, lineChatUserId: row.chat, conversationId: row.conversationId,
          nickname: row.nickname, nicknameReadStatus: row.status, observedAt: new Date(observedAt), ruleVersion: "manager-source-v2", classification: "NO_TAG_SIGNAL", reason: "synthetic",
        } });
      }
    };
    await capture("2026-09-20T03:00:00Z", [
      { chat: `${prefix}-chat1`, conversationId: c1.id, nickname: "คุณเอ Online Reno16 Pro ติดฟิล์ม ผ่อน SG 09/26 รับที่สาขา", status: "READ" },
      { chat: `${prefix}-chat2`, conversationId: c2.id, nickname: "TestUser", status: "READ" },
      { chat: `${prefix}-chat3`, conversationId: c3.id, nickname: null, status: "MISSING" },
    ]);
    // A v3 state row on c2, to check the v3 rows are never modified and the comparison counts.
    await db.nicknameDerivedMetadataState.create({ data: { conversationId: c2.id, sourceObservationId: `${prefix}-2026-09-20T03:00:00Z-${prefix}-chat2`, parserVersion: "nickname-parser-v3.0.1", observedAt: new Date("2026-09-20T03:00:00Z"), customerType: "ONLINE" } });
    const rawBefore = await db.nicknameSourceObservation.findMany({ where: { storeId: store.id }, orderBy: { id: "asc" } });
    const v3Before = await db.nicknameDerivedMetadataState.findMany({ where: { conversationId: { in: [c1.id, c2.id, c3.id, c4.id] } } });

    const run = await service.startFull({ trigger: "ADMIN", actorName: "Synthetic Admin", reason: "parser v4" });
    let full = await service.continueFull(run.id, 1);
    for (let guard = 0; !full.finishedAt && guard < 1000; guard++) full = await service.continueFull(run.id, 1);
    assert.ok(full.finishedAt, "the full pass finishes in bounded steps");
    const tags = await db.nicknameTagV4.findMany({ where: { storeId: store.id }, orderBy: { conversationId: "asc" } });
    const byConversation = new Map(tags.map((row) => [row.conversationId, row]));
    assert.equal(byConversation.size, 2, "only conversations with a READ nickname get a row");
    const first = byConversation.get(c1.id)!;
    assert.equal(first.parserVersion, NICKNAME_PARSER_V4_RULE_VERSION);
    assert.deepEqual(
      { decision: first.decision, customerType: first.customerType, paymentMethod: first.paymentMethod, financeProvider: first.financeProvider, services: first.services, productModelIds: first.productModelIds, period: [first.periodYear, first.periodMonth], hasFreeText: first.hasFreeText },
      { decision: "TAGGED", customerType: "ONLINE", paymentMethod: "INSTALLMENT", financeProvider: "SG_FINANCE", services: ["FILM_INSTALLATION"], productModelIds: [reno.id], period: [2026, 9], hasFreeText: true },
    );
    assert.equal(byConversation.get(c2.id)?.decision, "NO_SIGNAL");
    assert.ok(!("nickname" in first), "the nickname is never copied");
    const counts = full.counts as { conversations: number; withReadNickname: number; tagged: number; gainedVsV3: number; lostVsV3: number };
    assert.ok(counts.conversations >= 4 && counts.withReadNickname >= 2 && counts.tagged >= 1 && counts.gainedVsV3 >= 1 && counts.lostVsV3 >= 1);

    // A second full pass writes nothing new for unchanged observations.
    const again = await service.startFull({ trigger: "ADMIN", actorName: "Synthetic Admin" });
    let second = await service.continueFull(again.id);
    for (let guard = 0; !second.finishedAt && guard < 1000; guard++) second = await service.continueFull(again.id);
    assert.deepEqual((await db.nicknameTagV4.findMany({ where: { storeId: store.id }, orderBy: { conversationId: "asc" } })).map((row) => row.derivedAt.getTime()), tags.map((row) => row.derivedAt.getTime()));

    // Incremental: a newer READ nickname for c2 is picked up by the next step.
    // Captured after the full pass started (observedAt is the capture time).
    await capture(new Date().toISOString(), [{ chat: `${prefix}-chat2`, conversationId: c2.id, nickname: "TestUser ฟิมล์ 10/26", status: "READ" }]);
    const incremental = await service.step();
    assert.equal(incremental?.mode, MODE_INCREMENTAL);
    const updated = await db.nicknameTagV4.findUniqueOrThrow({ where: { conversationId_parserVersion: { conversationId: c2.id, parserVersion: NICKNAME_PARSER_V4_RULE_VERSION } } });
    assert.deepEqual([updated.decision, updated.services, updated.periodYear, updated.periodMonth], ["TAGGED", ["FILM_INSTALLATION"], 2026, 10]);

    // Raw observations and v3 rows are unchanged.
    const rawAfter = await db.nicknameSourceObservation.findMany({ where: { id: { in: rawBefore.map((row) => row.id) } }, orderBy: { id: "asc" } });
    assert.deepEqual(rawAfter, rawBefore);
    assert.deepEqual(await db.nicknameDerivedMetadataState.findMany({ where: { conversationId: { in: [c1.id, c2.id, c3.id, c4.id] } } }), v3Before);
    assert.equal(await db.nicknameDerivedMetadataApplication.count({ where: { conversationId: { in: [c1.id, c2.id, c3.id, c4.id] } } }), 0);
  } finally {
    await db.$disconnect();
  }
});
