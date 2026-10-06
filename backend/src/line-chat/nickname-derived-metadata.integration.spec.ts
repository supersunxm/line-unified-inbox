import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { NICKNAME_PARSER_V3_RULE_VERSION } from "./nickname-parser-v3.contract";
import { NicknameDerivedMetadataService } from "./nickname-derived-metadata.service";

// Set only against a disposable PostgreSQL database; receipts are intentionally immutable.
const databaseUrl = process.env.NICKNAME_DERIVED_TEST_DATABASE_URL;

test("isolated database: exact identity, independent state, stale refusal, conflicts, idempotency and immutable receipts", { skip: !databaseUrl }, async () => {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const service = new NicknameDerivedMetadataService(db);
  const prefix = randomUUID();
  const userId = `U${randomUUID().replaceAll("-", "")}`;
  const observedBase = Date.now();
  const stores = await Promise.all([0, 1].map((index) => db.store.create({ data: {
    id: `${prefix}-store-${index}`, name: `Nickname metadata fixture ${index}`, code: `${prefix}-${index}`,
  } })));
  const oas = await Promise.all(stores.map((store, index) => db.lineOfficialAccount.create({ data: {
    id: `${prefix}-oa-${index}`, webhookKey: `${prefix}-webhook-${index}`, name: `Fixture OA ${index}`, storeId: store.id,
  } })));
  const customer = await db.customer.create({ data: { displayName: "Nickname metadata fixture" } });
  const conversations = await Promise.all(oas.map((oa, index) => db.conversation.create({ data: {
    id: `${prefix}-conversation-${index}`, customerId: customer.id, storeId: stores[index].id,
    lineOfficialAccountId: oa.id, lineChatUserId: userId, latestMessageAt: new Date(observedBase),
    customerSalesStatus: index === 0 ? "ONLINE" : null,
    onlineSource: index === 0 ? "Website" : null,
    paymentMethod: index === 0 ? "INSTALLMENT" : null,
  } })));
  assert.equal(await db.nicknameDerivedMetadataState.count({
    where: { conversationId: { in: conversations.map((conversation) => conversation.id) } },
  }), 0, "existing sales fields do not backfill nickname-derived state");
  const series = await db.productSeries.create({ data: { name: `Nickname fixture series ${prefix}` } });
  const product = await db.productModel.create({ data: { name: `OPPO Reno16 ${prefix.slice(0, 8)}`, productSeriesId: series.id } });
  const nicknames = new Map<string, string>();

  const addObservation = async (index: number, nickname: string, observedAt: Date) => {
    const batchId = `${prefix}-capture-${index}`;
    const observationId = `${prefix}-observation-${index}`;
    const oa = oas[index === 1 ? 1 : 0];
    const store = stores[index === 1 ? 1 : 0];
    const chatId = userId;
    await db.nicknameSourceCapture.create({ data: {
      id: batchId, storeId: store.id, lineOfficialAccountId: oa.id, observedAt,
      chatCount: 1, coverage: "TEST_ONLY", ruleVersion: "manager-source-v2", profileKey: index % 2 === 0 ? "A" : "B", durationMs: 0,
    } });
    await db.nicknameSourceObservation.create({ data: {
      id: observationId, batchId, storeId: store.id, lineOfficialAccountId: oa.id, lineChatUserId: chatId,
      nickname, nicknameReadStatus: "READ", observedAt, parsedTag: null, ruleVersion: "manager-source-v2",
      classification: "NO_TAG_SIGNAL", reason: "TEST_FIXTURE",
    } });
    nicknames.set(observationId, nickname);
    return observationId;
  };

  try {
    const firstObservation = await addObservation(0, `${product.name} SG สด 09/26`, new Date(observedBase + 1000));
    const otherOaObservation = await addObservation(1, "Online", new Date(observedBase + 1100));
    const initial = await service.buildManifest();
    assert.equal(initial.report.unexplained, 0);
    const firstRow = initial.manifest.rows.find((row) => row.conversationId === conversations[0].id);
    const otherOaRow = initial.manifest.rows.find((row) => row.conversationId === conversations[1].id);
    assert.ok(firstRow);
    assert.ok(otherOaRow);
    assert.equal(firstRow.sourceObservationId, firstObservation);
    assert.equal(otherOaRow.sourceObservationId, otherOaObservation);
    assert.notEqual(firstRow.lineOfficialAccountId, otherOaRow.lineOfficialAccountId);

    await assert.rejects(service.applyBatch([{ ...firstRow, conversationId: conversations[1].id }], initial.manifest.sha256), /DESTINATION_OR_SALES_STATE_CHANGED/);
    assert.equal(await db.nicknameDerivedMetadataState.count({
      where: { conversationId: { in: conversations.map((conversation) => conversation.id) } },
    }), 0, "mismatched destination performed no write for either fixture conversation");

    assert.deepEqual(await service.dryRunRows([firstRow], initial.manifest.sha256), { WOULD_APPLY: 1, ALREADY_CORRECT: 0, STALE_OBSERVATION: 0 });
    assert.deepEqual((await service.applyBatch([firstRow], initial.manifest.sha256)).counts, { APPLIED: 1, ALREADY_CORRECT: 0, STALE_OBSERVATION: 0 });
    const firstState = await db.nicknameDerivedMetadataState.findUniqueOrThrow({ where: { conversationId: conversations[0].id }, include: { productModel: true } });
    assert.equal(firstState.sourceObservationId, firstObservation);
    assert.equal(firstState.productModel?.id, product.id);
    assert.equal(firstState.financeProvider, "SG_FINANCE");
    assert.equal(firstState.paymentMethod, "CASH");
    assert.equal(firstState.periodYear, 2026);
    assert.equal(firstState.periodMonth, 9);
    const originalSalesFields = await db.conversation.findUniqueOrThrow({
      where: { id: conversations[0].id }, select: { onlineSource: true, paymentMethod: true, customerSalesStatus: true },
    });
    assert.deepEqual(originalSalesFields, { onlineSource: "Website", paymentMethod: "INSTALLMENT", customerSalesStatus: "ONLINE" });
    assert.equal(await db.nicknameSourceState.count({ where: { conversationId: conversations[0].id } }), 0);
    assert.deepEqual(await service.dryRunRows([firstRow], initial.manifest.sha256), { WOULD_APPLY: 0, ALREADY_CORRECT: 1, STALE_OBSERVATION: 0 });
    assert.deepEqual((await service.applyBatch([firstRow], initial.manifest.sha256)).counts, { APPLIED: 0, ALREADY_CORRECT: 1, STALE_OBSERVATION: 0 });
    assert.equal(await db.nicknameDerivedMetadataApplication.count({ where: { conversationId: conversations[0].id } }), 1);

    await db.conversation.update({ where: { id: conversations[0].id }, data: { customerSalesStatus: "INTERESTED", onlineSource: null, paymentMethod: "UFUND" } });
    const afterSalesChange = await db.nicknameDerivedMetadataState.findUniqueOrThrow({ where: { conversationId: conversations[0].id } });
    assert.equal(afterSalesChange.paymentMethod, "CASH", "nickname-derived payment stays independent of operational payment");
    assert.equal(afterSalesChange.financeProvider, "SG_FINANCE");

    const newerObservation = await addObservation(2, `${product.name} Ufund 09/26`, new Date(observedBase + 2000));
    const newer = await service.buildManifest();
    const newerRow = newer.manifest.rows.find((row) => row.conversationId === conversations[0].id);
    assert.ok(newerRow);
    assert.equal(newerRow.expectedCurrentState?.sourceObservationId, firstObservation);
    assert.equal(newerRow.values.financeProvider, "UFUND");
    assert.deepEqual((await service.applyBatch([newerRow], newer.manifest.sha256)).counts, { APPLIED: 1, ALREADY_CORRECT: 0, STALE_OBSERVATION: 0 });
    const updated = await db.nicknameDerivedMetadataState.findUniqueOrThrow({ where: { conversationId: conversations[0].id }, include: { productModel: true } });
    assert.equal(updated.sourceObservationId, newerObservation);
    assert.equal(updated.financeProvider, "UFUND");
    assert.equal(updated.paymentMethod, null);
    assert.equal(updated.productModel?.id, product.id);
    assert.equal(await db.nicknameDerivedMetadataApplication.count({ where: { conversationId: conversations[0].id } }), 2);
    const independentConversation = await db.conversation.findUniqueOrThrow({ where: { id: conversations[0].id } });
    assert.equal(independentConversation.onlineSource, null);
    assert.equal(independentConversation.paymentMethod, "UFUND");

    const nextObservation = await addObservation(3, "Online", new Date(observedBase + 3000));
    assert.ok(nextObservation);
    assert.deepEqual(await service.dryRunRows([newerRow], newer.manifest.sha256), { WOULD_APPLY: 0, ALREADY_CORRECT: 0, STALE_OBSERVATION: 1 });
    assert.deepEqual((await service.applyBatch([newerRow], newer.manifest.sha256)).counts, { APPLIED: 0, ALREADY_CORRECT: 0, STALE_OBSERVATION: 1 });
    assert.equal((await db.nicknameDerivedMetadataState.findUniqueOrThrow({ where: { conversationId: conversations[0].id } })).financeProvider, "UFUND");

    const conflictConversation = await db.conversation.create({ data: {
      id: `${prefix}-conflict-conversation`, customerId: customer.id, storeId: stores[0].id,
      lineOfficialAccountId: oas[0].id, lineChatUserId: `U${randomUUID().replaceAll("-", "")}`,
      latestMessageAt: new Date(observedBase + 4000),
    } });
    const conflictCaptureId = `${prefix}-conflict-capture`;
    const conflictObservationId = `${prefix}-conflict-observation`;
    const conflictChatId = conflictConversation.lineChatUserId!;
    await db.nicknameSourceCapture.create({ data: {
      id: conflictCaptureId, storeId: stores[0].id, lineOfficialAccountId: oas[0].id,
      observedAt: new Date(observedBase + 4000), chatCount: 1, coverage: "TEST_ONLY", ruleVersion: "manager-source-v2", durationMs: 0,
    } });
    await db.nicknameSourceObservation.create({ data: {
      id: conflictObservationId, batchId: conflictCaptureId, storeId: stores[0].id, lineOfficialAccountId: oas[0].id,
      lineChatUserId: conflictChatId, nickname: "Online", nicknameReadStatus: "READ", observedAt: new Date(observedBase + 4000),
      parsedTag: null, ruleVersion: "manager-source-v2", classification: "NO_TAG_SIGNAL", reason: "TEST_FIXTURE",
    } });
    const priorStateConflictCount = (await service.buildManifest()).report.stateConflict;
    await db.nicknameDerivedMetadataState.create({ data: {
      conversationId: conflictConversation.id, sourceObservationId: conflictObservationId,
      parserVersion: NICKNAME_PARSER_V3_RULE_VERSION, observedAt: new Date(observedBase + 4000),
      customerType: null, financeProvider: "SG_FINANCE",
    } });
    const conflicted = await service.buildManifest();
    assert.equal(conflicted.report.stateConflict, priorStateConflictCount + 1);
    assert.equal(conflicted.manifest.rows.some((row) => row.conversationId === conflictConversation.id), false);

    const partialState = await service.applyBatch([otherOaRow], initial.manifest.sha256);
    assert.equal(partialState.counts.APPLIED, 1);
    const partial = await db.nicknameDerivedMetadataState.findUniqueOrThrow({ where: { conversationId: conversations[1].id } });
    assert.equal(partial.customerType, "ONLINE");
    assert.equal(partial.productModelId, null);
    assert.equal(partial.financeProvider, null);

    await assert.rejects(db.nicknameDerivedMetadataApplication.updateMany({ where: { conversationId: conversations[0].id }, data: { outcome: "MUTATED" } }));
    await assert.rejects(db.nicknameDerivedMetadataApplication.deleteMany({ where: { conversationId: conversations[0].id } }));
    assert.equal(await db.nicknameDerivedMetadataApplication.count({ where: { conversationId: conversations[0].id } }), 2);
  } finally {
    void nicknames;
    await db.$disconnect();
  }
});
