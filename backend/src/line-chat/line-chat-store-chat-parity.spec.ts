import assert from "node:assert/strict";
import test from "node:test";
import { MessageDirection } from "@prisma/client";
import { resolveMessageSender } from "../conversations.service";

test("Store Chats exposes the LINE OA Manager responder label for Project B outbound messages", () => {
  assert.deepEqual(
    resolveMessageSender({
      direction: MessageDirection.OUTBOUND,
      senderUserId: null,
      senderDisplayName: "DOWN CX197",
      sender: null,
      rawPayload: {
        provider: "LINE_MANAGER",
        source: "LINE_MANAGER_MIRROR",
        responderIdentitySource: "LINE_MANAGER_OWNER_NAME",
      },
    }),
    { userId: null, displayName: "DOWN CX197" },
  );
});

test("Store Chats prefers the Manager responder label over a legacy internal user name", () => {
  assert.deepEqual(
    resolveMessageSender({
      direction: MessageDirection.OUTBOUND,
      senderUserId: "legacy-user",
      senderDisplayName: "28375 PC Pub",
      sender: { id: "legacy-user", displayName: "Legacy Black App Name" },
      rawPayload: {
        provider: "LINE_MANAGER",
        source: "LINE_MANAGER_MIRROR",
      },
    }),
    { userId: "legacy-user", displayName: "28375 PC Pub" },
  );
});

test("legacy outbound rows without an attributed user still remain unattributed", () => {
  assert.equal(
    resolveMessageSender({
      direction: MessageDirection.OUTBOUND,
      senderUserId: null,
      senderDisplayName: "Untrusted snapshot",
      sender: null,
      rawPayload: { provider: "LINE" },
    }),
    null,
  );
});
