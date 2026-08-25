import assert from "node:assert/strict";
import test from "node:test";
import { MobileNotificationsService } from "./mobile-notifications.service";

void test("read and opened updates are scoped to the authenticated user and update the unread badge", async () => {
  const updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const service = new MobileNotificationsService({
    pushNotification: {
      count: async ({ where }: { where: { userId: string; readAt: null } }) => where.userId === "user-1" ? 3 : 0,
      updateMany: async (input: { where: Record<string, unknown>; data: Record<string, unknown> }) => { updates.push(input); return { count: 1 }; },
    },
  } as never);
  assert.deepEqual(await service.markRead("user-1", "notification-1"), { unreadCount: 3 });
  assert.deepEqual(updates[0]?.where, { id: "notification-1", userId: "user-1", readAt: null });
  assert.deepEqual(await service.markOpened("user-1", "notification-1"), { unreadCount: 3 });
  assert.equal(updates[1]?.where.userId, "user-1");
  assert.ok(updates[1]?.data.readAt instanceof Date);
  assert.ok(updates[1]?.data.openedAt instanceof Date);
});

void test("unread total is the authenticated user's all-store notification truth", async () => {
  const service = new MobileNotificationsService({
    pushNotification: {
      count: async ({ where }: { where: { userId: string; readAt: null } }) => {
        assert.deepEqual(where, { userId: "hq-user", readAt: null });
        return 128;
      },
    },
  } as never);

  assert.deepEqual(await service.unreadCount("hq-user"), { unreadCount: 128 });
});
