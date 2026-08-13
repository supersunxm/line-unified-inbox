import assert from "node:assert/strict";
import test from "node:test";
import { PushNotificationStatus, UserStatus } from "@prisma/client";
import { NotificationEnqueueService } from "./notification-enqueue.service";

void test("inbound messages enqueue one pending notification per eligible store user", async () => {
  let where: unknown;
  let createArgs: any;
  const tx: any = {
    userStoreMembership: {
      findMany: async (args: any) => { where = args.where; return [{ userId: "staff-1" }, { userId: "staff-2" }]; },
    },
    pushNotification: { createMany: async (args: any) => { createArgs = args; return { count: 2 }; } },
  };
  const input = { storeId: "store-1", conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" };
  const result = await new NotificationEnqueueService().enqueueInboundMessage(tx, input);
  assert.deepEqual(result, { count: 2 });
  assert.deepEqual(where, {
    storeId: "store-1",
    status: "ACTIVE",
    user: { isActive: true, status: UserStatus.ACTIVE, deviceTokens: { some: { isActive: true } } },
  });
  assert.equal(createArgs.skipDuplicates, true);
  assert.deepEqual(createArgs.data, [
    { userId: "staff-1", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: { conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" }, status: PushNotificationStatus.PENDING },
    { userId: "staff-2", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: { conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" }, status: PushNotificationStatus.PENDING },
  ]);
});

void test("inactive memberships, suspended users, and inactive devices are ignored by database eligibility filters", async () => {
  let createCalled = false;
  const tx: any = {
    userStoreMembership: { findMany: async () => [] },
    pushNotification: { createMany: async () => { createCalled = true; return { count: 0 }; } },
  };
  const result = await new NotificationEnqueueService().enqueueInboundMessage(tx, { storeId: "store-1", conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" });
  assert.deepEqual(result, { count: 0 });
  assert.equal(createCalled, false);
});

void test("duplicate webhook delivery does not create duplicate notifications", async () => {
  let skipDuplicates = false;
  const tx: any = {
    userStoreMembership: { findMany: async () => [{ userId: "staff-1" }] },
    pushNotification: { createMany: async (args: any) => { skipDuplicates = args.skipDuplicates; return { count: 0 }; } },
  };
  const result = await new NotificationEnqueueService().enqueueInboundMessage(tx, { storeId: "store-1", conversationId: "conversation-1", messageId: "message-1", customerName: "Customer", messageType: "TEXT", preview: "hello", sentAt: "2026-08-13T00:00:00.000Z" });
  assert.equal(skipDuplicates, true);
  assert.deepEqual(result, { count: 0 });
});
