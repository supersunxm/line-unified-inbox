import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMessageSendQueueService } from "./line-chat-message-send-queue.service";
import {
  getLineChatMirrorOnlyStoreCodes,
  isLineChatMirrorOnlyStore,
} from "./line-chat-pilot.constants";

function withEnv(
  values: Record<string, string | undefined>,
  callback: () => void | Promise<void>,
): Promise<void> | void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const restore = () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };

  try {
    const result = callback();
    if (result instanceof Promise) return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test("mirror-only cutover allowlist is explicit, trimmed, and deduplicated", () => {
  const raw = "28375, 25610;27627 25391,24804,27789,3791,28375";
  assert.deepEqual(
    [...getLineChatMirrorOnlyStoreCodes(raw)],
    ["28375", "25610", "27627", "25391", "24804", "27789", "3791"],
  );
  assert.equal(isLineChatMirrorOnlyStore(" 25610 ", raw), true);
  assert.equal(isLineChatMirrorOnlyStore("99999", raw), false);
});

test("mirror-only cutover fails open for normal stores when env is unset", () => {
  assert.equal(isLineChatMirrorOnlyStore("28375", undefined), false);
  assert.equal(getLineChatMirrorOnlyStoreCodes(undefined).size, 0);
});

test("durable queue refuses a new black-app send for a mirror-only store", async () => {
  await withEnv(
    {
      LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED: "true",
      LINE_CHAT_MIRROR_ONLY_STORE_CODES: "25610",
    },
    async () => {
      const prisma = {
        conversation: {
          findUnique: async () => ({
            id: "conversation-1",
            storeId: "store-1",
            latestMessageAt: new Date(),
            lineChatUserId: "Ucustomer",
            store: {
              code: "25610",
              name: "OPPO Central World",
              storeMaster: { externalStoreId: "25610" },
            },
            lineOfficialAccount: {
              id: "oa-1",
              name: "OPPO Central World",
              storeId: "store-1",
              accountType: "STORE",
              isActive: true,
              archivedAt: null,
              chatBotId: "Ubot",
              lineChatSession: {
                id: "session-1",
                sessionKey: "account-1",
                status: "ACTIVE",
              },
            },
          }),
        },
      };

      const service = new LineChatMessageSendQueueService(prisma as never);
      await assert.rejects(
        service.enqueueText({
          conversationId: "conversation-1",
          text: "must not send",
          idempotencyKey: "idempotency-1",
          actor: { id: "staff-1", displayName: "Staff" },
        }),
        /ย้ายไปตอบผ่าน LINE OA Manager/,
      );
    },
  );
});
