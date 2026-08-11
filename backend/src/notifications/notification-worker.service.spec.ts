import assert from "node:assert/strict";
import test from "node:test";
import { PushNotificationStatus } from "@prisma/client";
import { NotificationWorker } from "./notification-worker.service";

const notification = { id: "notification-1", userId: "user-1", conversationId: "conversation-1", messageId: "message-1", type: "INBOUND_MESSAGE", payload: {} };

void test("worker claims pending notifications and dispatches them through the dispatcher", async () => {
  const claims: unknown[] = [];
  let dispatched = false;
  const prisma = { pushNotification: { findMany: async () => [notification], updateMany: async (input: unknown) => { claims.push(input); return { count: 1 }; } } };
  const dispatcher = { send: async (input: unknown, provider: unknown, alreadyClaimed: boolean) => { dispatched = true; assert.equal(input, notification); assert.ok(provider); assert.equal(alreadyClaimed, true); } };
  const worker = new NotificationWorker(prisma as never, dispatcher as never, { configured: () => false } as never);
  assert.equal(await worker.processPending(), 1);
  assert.equal(dispatched, true);
  assert.deepEqual(claims[0], { where: { id: "notification-1", status: PushNotificationStatus.PENDING }, data: { status: PushNotificationStatus.PROCESSING, attemptCount: { increment: 1 }, lastError: null } });
});

void test("failed notifications can be claimed for retry", async () => {
  let queriedWhere: { status: PushNotificationStatus; attemptCount?: { lt: number } } | undefined;
  const prisma = { pushNotification: { findMany: async ({ where }: { where: { status: PushNotificationStatus; attemptCount?: { lt: number } } }) => { queriedWhere = where; return [notification]; }, updateMany: async () => ({ count: 1 }) } };
  const worker = new NotificationWorker(prisma as never, { send: async () => undefined } as never, { configured: () => false } as never);
  assert.equal(await worker.retryFailed(), 1);
  assert.deepEqual(queriedWhere, { status: PushNotificationStatus.FAILED, attemptCount: { lt: 3 } });
});
