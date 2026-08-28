import assert from "node:assert/strict";
import test from "node:test";
import { MobileConversationsController } from "./mobile-conversations.controller";

const user = { id: "user-1" } as any;
const request = { user } as any;
const query = { page: 1, pageSize: 30 } as any;

function buildController(senderDisplayName: string | null) {
  const conversations = {
    list: async () => ({
      items: [
        {
          id: "conversation-1",
          lastMessage: {
            id: "message-1",
            direction: "OUTBOUND",
            messageType: "TEXT",
            preview: "hello",
            sentAt: new Date("2026-08-28T09:30:00.000Z"),
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 30,
    }),
  } as any;
  const prisma = {
    message: {
      findMany: async () =>
        senderDisplayName === "Auto Reply Bot" ? [{ id: "message-1" }] : [],
    },
  } as any;
  return new MobileConversationsController(conversations, prisma);
}

test("mobile inbox labels persisted auto replies as Bot", async () => {
  const controller = buildController("Auto Reply Bot");
  const result = await controller.list(request, query);
  assert.equal(result.items[0].lastMessage?.direction, "SYSTEM");
  assert.equal(result.items[0].lastMessage?.preview, "Bot: hello");
});

test("mobile inbox keeps human outbound previews unchanged", async () => {
  const controller = buildController("Store Staff");
  const result = await controller.list(request, query);
  assert.equal(result.items[0].lastMessage?.direction, "OUTBOUND");
  assert.equal(result.items[0].lastMessage?.preview, "hello");
});
