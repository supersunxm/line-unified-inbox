import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import { LineChatMirrorReconcilerService, type LineChatMirrorReconcileCycleResult } from "./line-chat-mirror-reconciler.service";
import { liveMirrorIdentityCollisions } from "./fixtures/live-mirror-identity-collisions";

const databaseUrl = process.env.MIRROR_IDENTITY_TEST_DATABASE_URL;
test("PostgreSQL: seven exact identity pairs, unique-key races and restart replay", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "local-only test database required");
  assert.ok(url.pathname.startsWith("/live_mirror_identity_")
    || (process.env.CI === "true" && url.pathname === "/ci"), "dedicated local/CI test database required");
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  const prefix = randomUUID();
  const customer = await db.customer.create({ data: { displayName: "Sanitized identity fixture" } });
  const store = await db.store.create({ data: { name: "Identity regression", code: prefix } });
  const oa = await db.lineOfficialAccount.create({ data: { name: "Identity regression", storeId: store.id, webhookKey: prefix } });
  const conversationIds: string[] = [];
  let conflictingStoreId: string | null = null;
  const service = () => new LineChatMirrorReconcilerService(db as unknown as PrismaService);
  const reconcile = (worker: LineChatMirrorReconcilerService) => (worker as unknown as {
    reconcileStore: (code: string, since: Date, apply: boolean, batch: number) => Promise<LineChatMirrorReconcileCycleResult>;
  }).reconcileStore(prefix, new Date("2026-10-01"), true, 100);
  try {
    for (const [index, fixture] of liveMirrorIdentityCollisions.entries()) {
      const chat = `U${(index + 1).toString(16).padStart(32, "0")}`;
      const conversation = await db.conversation.create({ data: { customerId: customer.id, storeId: store.id,
        lineOfficialAccountId: oa.id, lineChatUserId: chat, latestMessageAt: new Date(fixture.sourceAt) } });
      conversationIds.push(conversation.id);
      await db.message.create({ data: { conversationId: conversation.id,
        externalMessageId: `line-chat-manager:${fixture.otherManagerId}`, direction: "OUTBOUND",
        originalText: "Sanitized repeated text", sentAt: new Date(fixture.otherAt),
        rawPayload: { managerMessageId: fixture.otherManagerId, source: fixture.canonicalSource } } });
      await db.lineChatMirrorMessage.create({ data: { lineOfficialAccountId: oa.id, lineChatUserId: chat,
        managerMessageId: fixture.managerId, eventType: "messageSent", direction: "OUTBOUND", messageType: "text",
        text: "Sanitized repeated text", sentAt: new Date(fixture.sourceAt),
        bizId: fixture.canonicalSource === "AUTO_RESPONSE" ? "__AUTO_RESPONSE" : null } });
    }
    assert.equal((await reconcile(service())).importedOutbound, 7);
    assert.equal(await db.message.count({ where: { conversationId: { in: conversationIds } } }), 14);
    for (const fixture of liveMirrorIdentityCollisions) {
      const raw = await db.lineChatMirrorMessage.findUniqueOrThrow({ where: {
        lineOfficialAccountId_managerMessageId: { lineOfficialAccountId: oa.id, managerMessageId: fixture.managerId },
      } });
      const canonical = await db.message.findUniqueOrThrow({ where: { id: raw.canonicalMessageId! } });
      assert.equal(canonical.externalMessageId, `line-chat-manager:${fixture.managerId}`);
      assert.equal(canonical.conversationId, raw.canonicalConversationId);
      assert.equal(canonical.direction, "OUTBOUND");
    }
    // Simulate a lost Raw receipt after durable Canonical writes, then two
    // restarted workers polling the same events. Global external-ID uniqueness
    // prevents duplication; exact lookups recover all seven receipts.
    await db.lineChatMirrorMessage.updateMany({ where: { lineOfficialAccountId: oa.id },
      data: { reconcileStatus: "PENDING", canonicalMessageId: null, reconciledAt: null } });
    const replays = await Promise.all([reconcile(service()), reconcile(service())]);
    assert.ok(replays.every((result) => result.failed === 0 && result.importedOutbound === 0));
    assert.equal(await db.message.count({ where: { conversationId: { in: conversationIds } } }), 14);



    // A persisted OA/chat mapping is not proof of the Store attribution when
    // the Conversation's Store conflicts with the OA's owning Store.
    const foreign = await db.store.create({ data: { name: "Sanitized conflicting Store", code: `${prefix}-foreign` } });
    conflictingStoreId = foreign.id;
    const conflictingChat = `U${"8".padStart(32, "0")}`;
    const wrongConversation = await db.conversation.create({ data: { customerId: customer.id,
      storeId: foreign.id, lineOfficialAccountId: oa.id, lineChatUserId: conflictingChat, latestMessageAt: new Date() } });
    conversationIds.push(wrongConversation.id);
    const conflictingRaw = await db.lineChatMirrorMessage.create({ data: { lineOfficialAccountId: oa.id,
      lineChatUserId: conflictingChat, managerMessageId: `${prefix}-store-conflict`, eventType: "messageSent",
      direction: "OUTBOUND", messageType: "text", text: "Sanitized scope conflict", sentAt: new Date() } });
    const held = await reconcile(service());
    assert.equal(held.importedOutbound, 0);
    const heldRaw = await db.lineChatMirrorMessage.findUniqueOrThrow({ where: { id: conflictingRaw.id } });
    assert.equal(heldRaw.reconcileStatus, "AMBIGUOUS");
    assert.equal(heldRaw.reconcileError, "DIRECT_CONVERSATION_STORE_SCOPE_CONFLICT");
    assert.equal(heldRaw.canonicalMessageId, null);
    assert.equal(await db.message.count({ where: { conversationId: wrongConversation.id } }), 0);
    await db.lineChatMirrorMessage.delete({ where: { id: conflictingRaw.id } });

    // Verify the real OA-scoped JSON alias lookup, not only its unit-test mock.
    const aliasId = `${prefix}-provider-alias`;
    const application = await db.message.create({ data: { conversationId: conversationIds[0],
      externalMessageId: `outbound:${prefix}-client`, direction: "OUTBOUND",
      originalText: "Sanitized provider alias", sentAt: new Date(), rawPayload: { providerMessageId: aliasId } } });
    const aliasRaw = await db.lineChatMirrorMessage.create({ data: { lineOfficialAccountId: oa.id,
      lineChatUserId: `U${"1".padStart(32, "0")}`, managerMessageId: aliasId,
      eventType: "messageSent", direction: "OUTBOUND", messageType: "text",
      text: "Sanitized provider alias", sentAt: application.sentAt } });
    const aliasResult = await reconcile(service());
    assert.equal(aliasResult.exactDuplicates, 1);
    assert.equal(aliasResult.importedOutbound, 0);
    assert.equal((await db.lineChatMirrorMessage.findUniqueOrThrow({ where: { id: aliasRaw.id } })).canonicalMessageId, application.id);

    // Exercise actual concurrent INSERT/P2002 rather than just mocking a race.
    const row = await db.lineChatMirrorMessage.findFirstOrThrow({ where: { lineOfficialAccountId: oa.id } });
    const importRace = (worker: LineChatMirrorReconcilerService) => (worker as unknown as {
      importOutbound: (input: { conversationId: string; row: typeof row; attributedUser: null; automated: boolean }) => Promise<{ created: boolean; messageId: string }>;
    }).importOutbound({ conversationId: conversationIds[0], row: { ...row, managerMessageId: `${prefix}-race` }, attributedUser: null, automated: false });
    const race = await Promise.all([importRace(service()), importRace(service())]);
    assert.equal(race.filter((result) => result.created).length, 1);
    assert.equal(race[0].messageId, race[1].messageId);
    assert.equal(await db.message.count({ where: { externalMessageId: `line-chat-manager:${prefix}-race` } }), 1);
    await db.message.create({ data: { conversationId: conversationIds[0],
      externalMessageId: `line-chat-manager:${prefix}-direction-conflict`, direction: "INBOUND",
      originalText: "Sanitized conflict", sentAt: row.sentAt } });
    await assert.rejects(() => (service() as unknown as {
      importOutbound: (input: { conversationId: string; row: typeof row; attributedUser: null; automated: boolean }) => Promise<unknown>;
    }).importOutbound({ conversationId: conversationIds[0],
      row: { ...row, managerMessageId: `${prefix}-direction-conflict` }, attributedUser: null, automated: false }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "P2002");

  } finally {
    await db.lineChatMirrorMessage.deleteMany({ where: { lineOfficialAccountId: oa.id } });
    await db.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    await db.lineOfficialAccount.delete({ where: { id: oa.id } });
    await db.store.delete({ where: { id: store.id } });
    if (conflictingStoreId) await db.store.delete({ where: { id: conflictingStoreId } });
    await db.customer.delete({ where: { id: customer.id } });
    await db.$disconnect();
  }
});
