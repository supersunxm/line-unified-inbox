import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type { OperationsService } from "../operations/operations.service";
import type { PrismaService } from "../prisma.service";
import { NICKNAME_PARSER_V4_0_RULE_VERSION, NICKNAME_PARSER_V4_RULE_VERSION } from "./nickname-parser-v4";
import { MODE_UPGRADE, nextRederiveStep, NicknameTagsV4Service } from "./nickname-tags-v4.service";
import { TagCoverageService } from "./tag-coverage.service";

// Runs against the dedicated, freshly migrated v2 database (CI: v2_monthly_ci). Synthetic names only.
const databaseUrl = process.env.V2_MONTHLY_TEST_DATABASE_URL;
const NOW = new Date("2026-10-07T03:00:00Z");

void test("scheduler order: full pass, then the v4.0 → v4.1 upgrade once, then incremental", () => {
  const v40 = { parserVersion: NICKNAME_PARSER_V4_0_RULE_VERSION, finishedAt: NOW };
  const v41 = { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, finishedAt: NOW };
  assert.equal(nextRederiveStep({ openFull: { ...v41, finishedAt: null }, lastFinishedFull: v40, latestUpgrade: null }), "continue-full");
  assert.equal(nextRederiveStep({ openFull: null, lastFinishedFull: null, latestUpgrade: null }), "start-full");
  assert.equal(nextRederiveStep({ openFull: null, lastFinishedFull: v40, latestUpgrade: null }), "upgrade", "production today: a v4.0 full pass, no upgrade yet");
  assert.equal(nextRederiveStep({ openFull: null, lastFinishedFull: v40, latestUpgrade: { ...v41, finishedAt: null } }), "upgrade", "resumes");
  assert.equal(nextRederiveStep({ openFull: null, lastFinishedFull: v40, latestUpgrade: v41 }), "incremental");
  assert.equal(nextRederiveStep({ openFull: null, lastFinishedFull: v41, latestUpgrade: null }), "incremental", "a fresh database needs no upgrade");
});

void test("v4.1 upgrade: only chats with a v4.0 purchase month, bounded, v4.0 rows and raw observations kept", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const prisma = db as unknown as PrismaService;
  const prefix = randomUUID().slice(0, 8);
  try {
    const store = await db.store.create({ data: { id: `${prefix}-store`, name: "Synthetic upgrade store", code: `${prefix}-code` } });
    const oa = await db.lineOfficialAccount.create({ data: { name: "Synthetic upgrade OA", webhookKey: `${prefix}-hook`, storeId: store.id, accountType: "STORE" } as never });
    const batchId = `${prefix}-batch`;
    await db.nicknameSourceCapture.create({ data: { id: batchId, storeId: store.id, lineOfficialAccountId: oa.id, observedAt: new Date("2026-09-20T03:00:00Z"), chatCount: 4, coverage: "RECENT_WINDOW", durationMs: 1 } });
    // nickname, and what v4.0 stored for it (two-digit years always 20YY).
    const fixtures = [
      { nickname: "TestUser Online 09/69", v40: [2069, 9] },
      { nickname: "คุณเอ 10/26", v40: [2026, 10] },
      { nickname: "ลูกค้า 05/80", v40: [2080, 5] },
      { nickname: "TestUser Online 9/69 ติดฟิล์ม", v40: null },
    ] as const;
    const conversations = [];
    for (const [index, fixture] of fixtures.entries()) {
      const customer = await db.customer.create({ data: { displayName: `ลูกค้าตัวอย่าง ${index}`, lineUserId: `${prefix}-u${index}` } });
      const conversation = await db.conversation.create({ data: { storeId: store.id, lineOfficialAccountId: oa.id, customerId: customer.id, lineChatUserId: `${prefix}-chat${index}`, latestMessageAt: new Date("2026-09-10T03:00:00Z") } as never });
      const observation = await db.nicknameSourceObservation.create({ data: {
        id: `${batchId}-${index}`, batchId, storeId: store.id, lineOfficialAccountId: oa.id, lineChatUserId: `${prefix}-chat${index}`, conversationId: conversation.id,
        nickname: fixture.nickname, nicknameReadStatus: "READ", observedAt: new Date("2026-09-20T03:00:00Z"), ruleVersion: "manager-source-v2", classification: "NO_TAG_SIGNAL", reason: "synthetic",
      } });
      await db.nicknameTagV4.create({ data: {
        conversationId: conversation.id, parserVersion: NICKNAME_PARSER_V4_0_RULE_VERSION, storeId: store.id, sourceObservationId: observation.id, observedAt: observation.observedAt,
        decision: "TAGGED", customerType: "ONLINE", services: [], productModelIds: [], conflicts: [], ruleIds: [],
        periodYear: fixture.v40?.[0] ?? null, periodMonth: fixture.v40?.[1] ?? null,
      } });
      conversations.push(conversation);
    }
    const ids = conversations.map((conversation) => conversation.id);
    const rawBefore = await db.nicknameSourceObservation.findMany({ where: { batchId }, orderBy: { id: "asc" } });
    const v40Before = await db.nicknameTagV4.findMany({ where: { conversationId: { in: ids }, parserVersion: NICKNAME_PARSER_V4_0_RULE_VERSION }, orderBy: { conversationId: "asc" } });

    const service = new NicknameTagsV4Service(prisma);
    const run = await service.startUpgrade({ trigger: "ADMIN", actorName: "Synthetic Admin" });
    assert.equal(run.mode, MODE_UPGRADE);
    let state = await service.continueUpgrade(run.id, 1, NOW);
    for (let guard = 0; !state.finishedAt && guard < 1000; guard++) state = await service.continueUpgrade(run.id, 1, NOW);
    assert.ok(state.finishedAt, "finishes in bounded steps");

    const v41 = new Map((await db.nicknameTagV4.findMany({ where: { conversationId: { in: ids }, parserVersion: NICKNAME_PARSER_V4_RULE_VERSION } })).map((row) => [row.conversationId, row]));
    assert.deepEqual([v41.get(ids[0])?.periodYear, v41.get(ids[0])?.periodMonth], [2026, 9], "09/69 = BE 2569 = September 2026");
    assert.deepEqual([v41.get(ids[1])?.periodYear, v41.get(ids[1])?.periodMonth], [2026, 10], "CE unchanged");
    assert.equal(v41.get(ids[2])?.periodYear, null, "80 is outside both windows: no purchase month");
    assert.equal(v41.has(ids[3]), false, "a chat without a v4.0 purchase month is not re-derived");

    const counts = state.counts as { previousWithPeriod: number; periodChanged: number; periodRemoved: number; periodUnchanged: number };
    assert.ok(counts.previousWithPeriod >= 3 && counts.periodChanged >= 1 && counts.periodRemoved >= 1 && counts.periodUnchanged >= 1, JSON.stringify(counts));

    // v4.0 rows and the raw observations are untouched.
    assert.deepEqual(await db.nicknameTagV4.findMany({ where: { conversationId: { in: ids }, parserVersion: NICKNAME_PARSER_V4_0_RULE_VERSION }, orderBy: { conversationId: "asc" } }), v40Before);
    assert.deepEqual(await db.nicknameSourceObservation.findMany({ where: { batchId }, orderBy: { id: "asc" } }), rawBefore);

    // Coverage reads each chat's newest version: v4.1 where it exists, else v4.0.
    const operations = { getOperationalConversationFilter: async () => ({}) } as unknown as OperationsService;
    const coverage = await new TagCoverageService(prisma, operations).coverage("2026-09", [store.id]);
    const row = coverage.stores.find((item) => item.storeUuid === store.id)!;
    assert.deepEqual([row.total, row.read, row.withPeriod], [4, 4, 2]);

    // Done once: a second call does nothing.
    const again = await service.continueUpgrade(run.id, 20, NOW);
    assert.equal(again.batches, state.batches);
  } finally {
    await db.$disconnect();
  }
});
