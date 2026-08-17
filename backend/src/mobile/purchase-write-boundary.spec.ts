import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ConversationsService } from "../conversations.service";
import { MobileConversationsService } from "./mobile-conversations.service";

const user = { id: "user-1", role: "VIEWER", status: "ACTIVE", isActive: true } as never;

test("legacy mobile tag writes reject verified purchase fields", async () => {
  let transactionCalled = false;
  const service = new MobileConversationsService(
    { $transaction: async () => { transactionCalled = true; } } as never,
    { assertConversationAccess: async () => "store-1" } as never,
    {} as never,
  );

  await assert.rejects(
    () => service.updateTags(user, "conversation-1", { sourceChannels: ["STORE"], isInstallment: true, productId: "model-1" }),
    (error: unknown) => error instanceof BadRequestException && error.message.includes("purchase-information"),
  );
  assert.equal(transactionCalled, false);
});

test("legacy conversation tag updates remain available for topics only", async () => {
  const writes: unknown[] = [];
  const tx = {
    conversationTopic: {
      deleteMany: async (args: unknown) => { writes.push({ type: "delete", args }); },
      upsert: async (args: unknown) => { writes.push({ type: "upsert", args }); },
    },
    conversationProduct: {
      deleteMany: async () => { throw new Error("purchase products must not be touched"); },
      upsert: async () => { throw new Error("purchase products must not be touched"); },
    },
  };
  const service = new ConversationsService(
    { conversation: { findUnique: async () => ({ id: "conversation-1" }) }, $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as never,
    {} as never,
  );
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conversation-1" });
  const result = await service.updateManualTags("conversation-1", [], ["topic-1"]);
  assert.equal((result as { id: string }).id, "conversation-1");
  assert.equal(writes.length, 2);
});
