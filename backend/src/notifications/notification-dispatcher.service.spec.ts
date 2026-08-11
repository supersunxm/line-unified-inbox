import assert from "node:assert/strict";
import test from "node:test";
import { PushNotificationStatus } from "@prisma/client";
import { NotificationDispatcher } from "./notification-dispatcher.service";

const notification = { id: "notification-1", userId: "user-1", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: { conversationId: "conversation-1", messageId: "message-1" } };

void test("dispatcher transitions a notification from processing to sent", async () => {
  const updates: any[] = [];
  const dispatcher = new NotificationDispatcher({ pushNotification: { update: async (args: any) => { updates.push(args); return {}; } } } as any);
  await dispatcher.send(notification, { send: async () => undefined });
  assert.equal(updates[0].data.status, PushNotificationStatus.PROCESSING);
  assert.equal(updates[1].data.status, PushNotificationStatus.SENT);
});

void test("dispatcher records failed delivery without exposing provider details", async () => {
  const updates: any[] = [];
  const dispatcher = new NotificationDispatcher({ pushNotification: { update: async (args: any) => { updates.push(args); return {}; } } } as any);
  await assert.rejects(() => dispatcher.send(notification, { send: async () => { throw new Error("provider failed"); } }), /provider failed/);
  assert.equal(updates[1].data.status, PushNotificationStatus.FAILED);
  assert.equal(updates[1].data.lastError, "provider failed");
});
