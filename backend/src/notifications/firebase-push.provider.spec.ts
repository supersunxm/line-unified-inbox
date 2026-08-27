import assert from "node:assert/strict";
import test from "node:test";
import { FirebasePushProvider } from "./firebase-push.provider";

const notification = { id: "notification-1", userId: "user-1", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: { conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", storeName: "OPPO CentralWorld", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" } };

void test("Firebase provider sends useful title/body and deep-link data to active encrypted device tokens", async () => {
  let request: unknown;
  const prisma = { deviceToken: { findMany: async () => [{ id: "device-1", token: "encrypted-1" }], update: async () => ({}) } };
  const provider = new FirebasePushProvider(prisma as never, { decrypt: () => "fcm-token-1" } as never);
  (provider as unknown as { messaging: { sendEachForMulticast: (input: unknown) => Promise<unknown> } }).messaging = { sendEachForMulticast: async (input) => { request = input; return { responses: [{ success: true }] }; } };
  await provider.send(notification);
  assert.deepEqual(request, { tokens: ["fcm-token-1"], data: { title: "Customer • OPPO CentralWorld", body: "hello", channelId: "line_oa_messages", conversationId: "conversation-1", messageId: "message-1", notificationId: "notification-1", customerName: "Customer", storeName: "OPPO CentralWorld", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" }, notification: { title: "Customer • OPPO CentralWorld", body: "hello" }, android: { priority: "high", notification: { channelId: "line_oa_messages", sound: "default" } } });
});

void test("Firebase provider gives distinct messages unique notification identities without an FCM collapse key", async () => {
  const requests: Array<{ data: Record<string, string>; android: { priority: string; notification: unknown }; notification?: unknown }> = [];
  const prisma = { deviceToken: { findMany: async () => [{ id: "device-1", token: "encrypted-1" }], update: async () => ({}) } };
  const provider = new FirebasePushProvider(prisma as never, { decrypt: () => "fcm-token-1" } as never);
  (provider as unknown as { messaging: { sendEachForMulticast: (input: unknown) => Promise<unknown> } }).messaging = {
    sendEachForMulticast: async (input) => { requests.push(input as typeof requests[number]); return { responses: [{ success: true }] }; },
  };

  await provider.send(notification);
  await provider.send({ ...notification, id: "notification-2", messageId: "message-2", payload: { conversationId: "conversation-1", messageId: "message-2", customerName: "Customer", storeName: "OPPO CentralWorld", messageType: "IMAGE", preview: "[Image]", sentAt: "2026-08-13T00:00:01.000Z" } });

  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.data.conversationId, "conversation-1");
  assert.equal(requests[1]?.data.conversationId, "conversation-1");
  assert.equal(requests[0]?.data.messageId, "message-1");
  assert.equal(requests[1]?.data.messageId, "message-2");
  assert.equal(requests[0]?.data.notificationId, "notification-1");
  assert.equal(requests[1]?.data.notificationId, "notification-2");
  assert.equal(requests[0]?.data.channelId, "line_oa_messages");
  assert.equal(requests[1]?.data.messageType, "IMAGE");
  assert.equal(requests[1]?.data.sentAt, "2026-08-13T00:00:01.000Z");
  assert.equal(requests[0]?.android.priority, "high");
  assert.deepEqual(requests[0]?.notification, { title: "Customer • OPPO CentralWorld", body: "hello" });
  assert.deepEqual(requests[0]?.android.notification, { channelId: "line_oa_messages", sound: "default" });
  assert.equal("collapseKey" in (requests[0] ?? {}), false);
});

void test("Firebase provider deactivates invalid registration tokens", async () => {
  const updates: unknown[] = [];
  const prisma = { deviceToken: { findMany: async () => [{ id: "device-1", token: "encrypted-1" }], update: async (input: unknown) => { updates.push(input); return {}; } } };
  const provider = new FirebasePushProvider(prisma as never, { decrypt: () => "fcm-token-1" } as never);
  (provider as unknown as { messaging: { sendEachForMulticast: () => Promise<unknown> } }).messaging = { sendEachForMulticast: async () => ({ responses: [{ success: false, error: { code: "messaging/registration-token-not-registered" } }] }) };
  await assert.rejects(() => provider.send(notification), /did not accept/);
  const update = updates[0] as { where: { id: string }; data: { isActive: boolean; lastSeenAt: Date } };
  assert.deepEqual(update.where, { id: "device-1" });
  assert.equal(update.data.isActive, false);
  assert.ok(update.data.lastSeenAt instanceof Date);
});
