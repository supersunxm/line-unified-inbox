import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { MobileConversationsService } from "./mobile-conversations.service";

const user = { id: "user-1", email: "staff@example.com", displayName: "Staff", role: "VIEWER" as const, isActive: true };

void test("mobile list is restricted to the authenticated user's accessible stores", async () => {
  let where: unknown;
  const prisma = {
    conversation: {
      findMany: async (input: { where: unknown }) => { where = input.where; return [{ id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: [{ id: "message-1", direction: "INBOUND", messageType: "TEXT", originalText: "Hello", sentAt: new Date() }], _count: { pushNotifications: 2 } }]; },
      count: async () => 1,
    },
    $transaction: async <T>(operations: Promise<T>[]) => Promise.all(operations),
  };
  const stores = { accessibleStoreIds: async () => ["store-1"] };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);
  const result = await service.list(user, { page: 1, pageSize: 30 });
  assert.deepEqual(where, { store: { isActive: true, archivedAt: null }, storeId: { in: ["store-1"] } });
  assert.equal(result.items[0]?.unreadCount, 2);
});

void test("mobile detail permits the assigned store and rejects a different store", async () => {
  const conversation = { id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: [], _count: { pushNotifications: 0 } };
  const prisma = { conversation: { findUnique: async () => conversation } };
  const allowed = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, allowed as never, {} as never);
  assert.equal((await service.get(user, "conversation-1")).id, "conversation-1");

  const denied = { assertConversationAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } };
  const deniedService = new MobileConversationsService(prisma as never, denied as never, {} as never);
  await assert.rejects(() => deniedService.get(user, "conversation-2"), ForbiddenException);
});

void test("mobile reply delegates only after store ownership is verified", async () => {
  let sent = false;
  const stores = { assertConversationAccess: async () => "store-1" };
  const conversations = { sendMessage: async (id: string, dto: unknown, actor: unknown) => { sent = true; assert.equal(id, "conversation-1"); assert.equal(actor, user); assert.deepEqual(dto, { text: "Reply", idempotencyKey: "key-1" }); return { message: { id: "outbound-1" } }; } };
  const service = new MobileConversationsService({} as never, stores as never, conversations as never);
  await service.send(user, "conversation-1", { text: "Reply", idempotencyKey: "key-1" });
  assert.equal(sent, true);

  const denied = new MobileConversationsService({} as never, { assertConversationAccess: async () => { throw new ForbiddenException(); } } as never, conversations as never);
  await assert.rejects(() => denied.send(user, "conversation-2", { text: "Reply", idempotencyKey: "key-2" }), ForbiddenException);
});
