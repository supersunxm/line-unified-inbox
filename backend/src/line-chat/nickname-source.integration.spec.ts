import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { StoreAccessService } from "../auth/store-access.service";
import { MobileConversationsService } from "../mobile/mobile-conversations.service";
import { NicknameSourceObserverService, type NicknameSnapshot } from "./nickname-source-observer.service";
import { NicknameSourceMappingService, canonicalManifestRows, validateManifest, type NicknameManifest } from "./nickname-source-mapping.service";
import { evidenceHash } from "./nickname-source-contract";
import type { LineChatSessionService } from "./line-chat-session.service";

const databaseUrl = process.env.NICKNAME_SOURCE_TEST_DATABASE_URL;
test("real database: append-only evidence, sales independence, exact scope, stale skip and idempotent manifest", { skip: !databaseUrl }, async () => {
  const db = new PrismaService({ datasources: { db: { url: databaseUrl } } });
  const oldCodes = process.env.LINE_CHAT_MIRROR_STORE_CODES;
  const prefix = randomUUID();
  const codes = Array.from({ length: 144 }, (_, i) => `${prefix}-${i}`);
  const stores = codes.map((code, i) => ({ id: `${prefix}-s-${i}`, name: `Synthetic source audit ${i}`, code }));
  const oas = stores.map((s, i) => ({ id: `${prefix}-oa-${i}`, storeId: s.id, name: s.name, basicId: `@${prefix}-${i}`, webhookKey: `${prefix}-webhook-${i}` }));
  const observer = new NicknameSourceObserverService(db, { isMirrorCycleActive: () => false } as unknown as LineChatSessionService);
  const mapping = new NicknameSourceMappingService(db);
  const chatId = `U${"a".repeat(32)}`;
  const now = Date.now();
  const first = new Date(now - 60000);
  const since = new Date(now - 120000);
  try {
    await db.store.createMany({ data: stores });
    await db.lineOfficialAccount.createMany({ data: oas });
    process.env.LINE_CHAT_MIRROR_STORE_CODES = codes.join(",");
    await db.lineChatMirrorStoreState.createMany({ data: oas.map((oa, i) => ({ lineOfficialAccountId: oa.id, storeId: stores[i].id, storeCode: codes[i], enabled: true, status: "SUCCESS", lastSuccessfulSyncAt: new Date() })) });
    const customer = await db.customer.create({ data: { displayName: "Same nickname display name" } });
    const conversation = await db.conversation.create({ data: { customerId: customer.id, storeId: stores[0].id,
      lineOfficialAccountId: oas[0].id, latestMessageAt: first, lineChatUserId: chatId,
      customerSalesStatus: "ONLINE", onlineSource: "TikTok" } });
    const other = await db.conversation.create({ data: { customerId: customer.id, storeId: stores[1].id,
      lineOfficialAccountId: oas[1].id, latestMessageAt: first, lineChatUserId: chatId } });
    assert.equal(await db.nicknameSourceState.count({ where: { conversationId: conversation.id } }), 0, "no backfill from onlineSource");
    const snapshot: NicknameSnapshot = { storeId: stores[0].id, lineOfficialAccountId: oas[0].id, observedAt: first,
      coverage: "BOUNDED_RECENT", chats: [{ chatUserId: chatId, managerNickname: "Facebook 09/26", managerNicknameReadStatus: "READ" }] };
    for (let i = 0; i < 144; i++) await observer.capture(i === 0 ? snapshot : { ...snapshot, storeId: stores[i].id, lineOfficialAccountId: oas[i].id, chats: [] });
    await observer.capture(snapshot);
    assert.equal(await db.nicknameSourceObservation.count({ where: { lineOfficialAccountId: oas[0].id } }), 1);
    assert.equal((await db.nicknameSourceState.findUniqueOrThrow({ where: { conversationId: conversation.id } })).tag, null, "capture never applies a Tag");
    const audit = await mapping.audit(since);
    assert.equal(audit.report.eligibleOas, 144); assert.equal(audit.report.scannedOas, 144); assert.equal(audit.report.unexplained, 0);
    assert.equal(audit.report.classifications.TAG_NEEDS_UPDATE, 1);
    assert.equal(audit.rows[0].conversationId, conversation.id);
    const manifest = await mapping.buildManifest(since);
    validateManifest(manifest);
    const corrupted: NicknameManifest = { ...manifest, rows: manifest.rows.map(r => ({ ...r, expectedTag: "TikTok" })) };
    assert.throws(() => validateManifest(corrupted), /INVALID_IMMUTABLE_MANIFEST/);
    assert.equal(manifest.rowSetSha256, evidenceHash(canonicalManifestRows(manifest.rows)));
    const digest = evidenceHash(JSON.stringify(manifest));
    assert.equal((await mapping.processManifest(manifest, digest, false)).counts.AWAITING_FRESH_OBSERVATION, 1);
    await delay(3);
    const freshAt = new Date();
    await observer.capture({ ...snapshot, observedAt: freshAt });
    assert.equal((await mapping.processManifest(manifest, digest, false)).counts.WOULD_APPLY, 1);
    assert.equal((await mapping.processManifest(manifest, digest, true)).counts.APPLIED, 1);
    assert.equal((await mapping.processManifest(manifest, digest, true)).counts.ALREADY_CORRECT, 1);
    const saved = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { nicknameSourceState: true } });
    assert.equal(saved.onlineSource, "TikTok"); assert.equal(saved.customerSalesStatus, "ONLINE");
    assert.equal(saved.nicknameSourceState?.tag, "Facebook");
    assert.equal(await db.nicknameSourceState.count({ where: { conversationId: other.id } }), 0, "same chat ID under another OA is untouched");

    const actor = await db.user.create({ data: { email: `${prefix}@example.test`, normalizedEmail: `${prefix}@example.test`, displayName: "Synthetic owner", role: "ADMIN" } });
    const mobile = new MobileConversationsService(db, new StoreAccessService(db), {} as never);
    await mobile.updateCustomerSalesInfo(actor, conversation.id, { status: "INTERESTED" });
    const changed = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { nicknameSourceState: true } });
    assert.equal(changed.onlineSource, null, "legacy onlineSource clearing is preserved");
    assert.equal(changed.nicknameSourceState?.tag, "Facebook", "source Tag survives sales transition");
    assert.equal(changed.bmReplyStatus, saved.bmReplyStatus); assert.equal(changed.followUpStatus, saved.followUpStatus);
    assert.equal(changed.ownerUserId, saved.ownerUserId);
    assert.equal((await mobile.get(actor, conversation.id)).nicknameSourceState?.tag, "Facebook");
    assert.equal((await mapping.audit(since)).report.classifications.TAG_MAPPED, 1);
    for (const change of [{ status: "FILM" as const, filmBrand: "OPPO" },
      { status: "ONLINE" as const, onlineSource: "Website" },
      { status: "PURCHASED" as const, paymentMethod: "CASH" as const },
      { status: null }]) {
      await mobile.updateCustomerSalesInfo(actor, conversation.id, change);
      const record = await db.conversation.findUniqueOrThrow({ where: { id: conversation.id }, include: { nicknameSourceState: true } });
      assert.equal(record.nicknameSourceState?.tag, "Facebook");
      assert.equal(record.onlineSource, change.status === "ONLINE" ? "Website" : null);
    }


    await observer.capture({ ...snapshot, observedAt: new Date(), chats: [{ chatUserId: chatId, managerNickname: "TikTok 09/26", managerNicknameReadStatus: "READ" }] });
    assert.equal((await mapping.processManifest(manifest, digest, true)).counts.STALE_OBSERVATION, 1);
    assert.equal((await db.nicknameSourceState.findUniqueOrThrow({ where: { conversationId: conversation.id } })).tag, "Facebook");
    const nextManifest = await mapping.buildManifest(since);
    await observer.capture({ ...snapshot, observedAt: new Date(), chats: [{ chatUserId: chatId, managerNickname: "Facebook/TikTok 09/26", managerNicknameReadStatus: "READ" }] });
    assert.equal((await mapping.processManifest(nextManifest, evidenceHash(JSON.stringify(nextManifest)), true)).counts.STALE_OBSERVATION, 1);
    assert.equal((await mapping.audit(since)).report.classifications.AMBIGUOUS, 1);
    await observer.capture({ ...snapshot, observedAt: new Date(), chats: [{ chatUserId: chatId, managerNickname: "สมชาย", managerNicknameReadStatus: "READ" }] });
    assert.equal((await mapping.audit(since)).report.classifications.NO_TAG_SIGNAL, 1);
    assert.equal((await db.nicknameSourceState.findUniqueOrThrow({ where: { conversationId: conversation.id } })).tag, "Facebook");


    await db.conversation.create({ data: { customerId: customer.id, storeId: stores[0].id,
      lineOfficialAccountId: oas[0].id, latestMessageAt: first, lineChatUserId: chatId } });
    assert.equal((await mapping.audit(since)).report.classifications.IDENTITY_CONFLICT, 1);
    assert.equal((await mapping.processManifest(manifest, digest, false)).counts.IDENTITY_CONFLICT, 1);
    await db.lineChatMirrorStoreState.update({ where: { lineOfficialAccountId: oas[0].id }, data: { status: "PARTIAL" } });
    await assert.rejects(mapping.processManifest(manifest, digest, true), /LIVE_MIRROR_HEALTH_GATE_FAILED/);
    const observation = await db.nicknameSourceObservation.findFirstOrThrow({ where: { lineOfficialAccountId: oas[0].id } });
    await assert.rejects(db.nicknameSourceObservation.update({ where: { id: observation.id }, data: { nickname: "Changed" } }));
    await assert.rejects(db.nicknameSourceObservation.delete({ where: { id: observation.id } }));
    const receipt = await db.nicknameSourceApplication.findFirstOrThrow({ where: { conversationId: conversation.id } });
    await assert.rejects(db.nicknameSourceApplication.update({ where: { id: receipt.id }, data: { resultingTag: "TikTok" } }));
    assert.equal(await db.lineChatNicknameSyncJob.count({ where: { conversationId: conversation.id } }), 0);
    assert.equal(await db.lineChatMessageSendJob.count({ where: { conversationId: conversation.id } }), 0);
  } finally {
    if (oldCodes === undefined) delete process.env.LINE_CHAT_MIRROR_STORE_CODES; else process.env.LINE_CHAT_MIRROR_STORE_CODES = oldCodes;
    await db.$disconnect();
  }
});
