import assert from "node:assert/strict";
import test from "node:test";
import { FirebasePushProvider } from "./firebase-push.provider";

const notification = { id: "notification-1", userId: "user-1", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: { conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" } };

void test("Firebase provider sends a minimal deep-link payload to active encrypted device tokens", async () => {
  let request: unknown;
  const prisma = { deviceToken: { findMany: async () => [{ id: "device-1", token: "encrypted-1" }], update: async () => ({}) } };
  const provider = new FirebasePushProvider(prisma as never, { decrypt: () => "fcm-token-1" } as never);
  (provider as unknown as { messaging: { sendEachForMulticast: (input: unknown) => Promise<unknown> } }).messaging = { sendEachForMulticast: async (input) => { request = input; return { responses: [{ success: true }] }; } };
  await provider.send(notification);
  assert.deepEqual(request, { tokens: ["fcm-token-1"], data: { title: "New customer message", body: "Tap to open the conversation", channelId: "line_oa_messages", conversationId: "conversation-1", messageId: "message-1", notificationId: "notification-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" }, android: { priority: "high" } });
});

void test("Firebase provider gives distinct messages unique notification identities without an FCM collapse key", async () => {
  const requests: Array<{ data: Record<string, string>; android: { priority: string }; notification?: unknown }> = [];
  const prisma = { deviceToken: { findMany: async () => [{ id: "device-1", token: "encrypted-1" }], update: async () => ({}) } };
  const provider = new FirebasePushProvider(prisma as never, { decrypt: () => "fcm-token-1" } as never);
  (provider as unknown as { messaging: { sendEachForMulticast: (input: unknown) => Promise<unknown> } }).messaging = {
    sendEachForMulticast: async (input) => { requests.push(input as typeof requests[number]); return { responses: [{ success: true }] }; },
  };

  await provider.send(notification);
  await provider.send({ ...notification, id: "notification-2", messageId: "message-2", payload: { conversationId: "conversation-1", messageId: "message-2", customerName: "Customer", messageType: "IMAGE", preview: "[Image]", sentAt: "2026-08-13T00:00:01.000Z" } });

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
  assert.equal(requests[0]?.notification, undefined);
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
