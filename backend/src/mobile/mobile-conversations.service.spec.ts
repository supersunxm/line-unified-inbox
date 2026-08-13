import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
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

void test("mark read clears every unread notification for the user and conversation", async () => {
  const updates: any[] = [];
  const prisma = { pushNotification: { updateMany: async (args: any) => { updates.push(args); return { count: 28 }; } } };
  const stores = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);

  assert.deepEqual(await service.markRead(user, "conversation-1"), { conversationId: "conversation-1", unreadCount: 0 });
  assert.deepEqual(updates[0]?.where, { userId: "user-1", conversationId: "conversation-1", readAt: null });
  assert.ok(updates[0]?.data.readAt instanceof Date);

  assert.deepEqual(await service.markRead(user, "conversation-1"), { conversationId: "conversation-1", unreadCount: 0 });
});

void test("mark read preserves reply status and rejects cross-store access", async () => {
  let conversationUpdated = false;
  const prisma = {
    conversation: { update: async () => { conversationUpdated = true; } },
    pushNotification: { updateMany: async () => ({ count: 0 }) },
  };
  const denied = { assertConversationAccess: async () => { throw new ForbiddenException("Store access is forbidden"); } };
  const service = new MobileConversationsService(prisma as never, denied as never, {} as never);

  await assert.rejects(() => service.markRead(user, "other-store-conversation"), ForbiddenException);
  assert.equal(conversationUpdated, false);
});

void test("mobile detail returns a stable cursor and prepends older pages without overlap", async () => {
  let captured: any;
  const messages = [0, 1, 2].map((index) => ({ id: `message-${index}`, direction: "INBOUND", messageType: "TEXT", originalText: `m${index}`, sentAt: new Date(`2026-08-13T00:0${index}:00.000Z`), senderUserId: null, senderDisplayName: null, media: null }));
  const prisma = { conversation: { findUnique: async (args: any) => { captured = args; const before = args.select.messages.where; return { id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: before ? messages.slice(0, 2) : messages, _count: { pushNotifications: 0 } }; } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const first = await service.get(user, "conversation-1", { limit: 2 });
  assert.equal(first.messages.length, 2);
  assert.ok(first.nextCursor);
  const second = await service.get(user, "conversation-1", { limit: 2, before: first.nextCursor });
  assert.equal(second.messages.length, 2);
  assert.ok(captured.select.messages.where);
});

void test("mobile detail cursor orders equal timestamps by id without overlap or gaps", async () => {
  const sentAt = new Date("2026-08-13T00:00:00.000Z");
  const messages = ["a", "b", "c"].map((id) => ({ id, direction: "INBOUND", messageType: "TEXT", originalText: id, sentAt, senderUserId: null, senderDisplayName: null, media: null }));
  const queries: any[] = [];
  const prisma = { conversation: { findUnique: async (args: any) => {
    queries.push(args);
    const cursorId = args.select.messages.where?.OR?.[1]?.id?.lt as string | undefined;
    const filtered = cursorId ? messages.filter((message) => message.id < cursorId) : messages;
    return { id: "conversation-1", latestMessageAt: sentAt, bmReplyStatus: "NOT_REPLIED", followUpStatus: "FOLLOW_UP", customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" }, messages: filtered.slice().sort((a, b) => b.id.localeCompare(a.id)).slice(0, args.select.messages.take), _count: { pushNotifications: 0 } };
  } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  const first = await service.get(user, "conversation-1", { limit: 2 });
  const second = await service.get(user, "conversation-1", { limit: 2, before: first.nextCursor });
  assert.deepEqual(first.messages.map((message) => message.id), ["b", "c"]);
  assert.deepEqual(second.messages.map((message) => message.id), ["a"]);
  assert.equal(first.messages.some((message) => second.messages.some((older) => older.id === message.id)), false);
  assert.equal(second.nextCursor, null);
  assert.deepEqual(queries[1].select.messages.where.OR[1], { sentAt, id: { lt: "b" } });
});

void test("mobile detail rejects an invalid cursor before querying messages", async () => {
  let queried = false;
  const prisma = { conversation: { findUnique: async () => { queried = true; return null; } } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  await assert.rejects(() => service.get(user, "conversation-1", { limit: 20, before: "not-a-cursor" }), NotFoundException);
  assert.equal(queried, false);
});
