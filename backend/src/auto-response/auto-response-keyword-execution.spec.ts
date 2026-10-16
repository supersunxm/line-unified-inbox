import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutoResponseStatus, AutoResponseTriggerType, AutoResponseExecutionOutcome } from "@prisma/client";
import { AutoResponseRichMessageExecutionService } from "./auto-response-rich-message-execution.service";

const oaId = "11111111-1111-1111-1111-111111111111";
const storeId = "22222222-2222-2222-2222-222222222222";
const rule = (blocks: unknown[] = [{ id: "text1", type: "TEXT", textTemplate: "OPPO {{store.storeName}}" }]) => ({
  id: "keyword-1", name: "Find X10", triggerType: AutoResponseTriggerType.KEYWORD,
  status: AutoResponseStatus.ACTIVE,
  triggerConfig: { matcherVersion: 1, matchMode: "CONTAINS", keywords: ["Find X10"],
    priority: 10, targetMode: "SELECTED", targetLineOaIds: [oaId], excludedLineOaIds: [] },
  contentJson: { version: 1, messages: blocks },
});
function fakeContext(blocks?: unknown[]) {
  const calls = { replies: [] as unknown[][], executions: [] as any[] };
  const prisma = {
    lineOfficialAccount: { findUnique: async () => ({
      id: oaId, name: "OPPO Pinklao", accountType: "STORE", isActive: true,
      archivedAt: null, connectionStatus: "READY",
      encryptedChannelAccessToken: "enc-token", encryptedChannelSecret: "enc-secret",
      store: { id: storeId, name: "Central Pinklao", code: "865", isActive: true, archivedAt: null,
        storeMaster: { externalStoreId: "865", googleMapsUrl: "https://maps.google.com/?q=Pinklao" } },
    }) },
    message: { findUnique: async () => ({ direction: "INBOUND", messageType: "TEXT",
      conversationId: "conv1", conversation: { lineOfficialAccountId: oaId, isQa: false } }) },
    autoResponseRule: { findMany: async () => [rule(blocks)] },
    autoResponseExecution: {
      create: async ({ data }: any) => { calls.executions.push({ id: "exec1", ...data }); return { id: "exec1" }; },
      update: async ({ data }: any) => { calls.executions.push(data); return { id: "exec1" }; },
    },
  } as any;
  const line = { replyMessages: async (_token: string, _reply: string, messages: unknown[]) => {
    calls.replies.push(messages);
  } } as any;
  const rich = {
    get: async () => ({ name: "Find X10", isActive: true }),
    buildLineImagemap: async () => ({ type: "imagemap", baseUrl: "https://example.com/rich", altText: "Find X10", baseSize: { width: 1040, height: 1040 }, actions: [] }),
  } as any;
  const instance = new AutoResponseRichMessageExecutionService(prisma, { decrypt: () => "token" } as any, line, rich);
  return { instance, calls };
}
const input = { text: "สนใจ Find X10 ครับ", messageId: "msg-1", conversationId: "conv1",
  lineOfficialAccountId: oaId, webhookEventId: "evt-1", replyToken: "reply-1" };

describe("Keyword webhook — safety", { concurrency: false }, () => {
  it("SHADOW matches but sends no LINE reply", async () => {
    const previous = process.env.AUTO_REPLY_KEYWORD_MODE;
    process.env.AUTO_REPLY_KEYWORD_MODE = "SHADOW";
    try {
      const { instance, calls } = fakeContext();
      const res = await instance.handleWebhookInboundText(input);
      assert.equal(res.outcome, AutoResponseExecutionOutcome.MATCHED_SHADOW);
      assert.equal(calls.replies.length, 0);
      assert.equal(calls.executions[0].status, "SKIPPED");
    } finally { if (previous === undefined) delete process.env.AUTO_REPLY_KEYWORD_MODE; else process.env.AUTO_REPLY_KEYWORD_MODE = previous; }
  });

  it("LIVE builds text + imagemap and sends one reply request", async () => {
    const previous = process.env.AUTO_REPLY_KEYWORD_MODE;
    process.env.AUTO_REPLY_KEYWORD_MODE = "LIVE";
    try {
      const blocks = [
        { id: "t1", type: "TEXT", textTemplate: "OPPO {{store.storeName}}" },
        { id: "rich1", type: "RICH_MESSAGE", richMessageId: "rich-message-1" },
      ];
      const { instance, calls } = fakeContext(blocks);
      const res = await instance.handleWebhookInboundText(input);
      assert.equal(res.outcome, AutoResponseExecutionOutcome.SENT);
      assert.equal(calls.replies.length, 1);
      assert.equal(calls.replies[0].length, 2);
      assert.deepEqual(calls.replies[0][0], { type: "text", text: "OPPO Central Pinklao" });
      assert.equal((calls.replies[0][1] as any).type, "imagemap");
    } finally { if (previous === undefined) delete process.env.AUTO_REPLY_KEYWORD_MODE; else process.env.AUTO_REPLY_KEYWORD_MODE = previous; }
  });

  it("LIVE missing reply token records failure without sending", async () => {
    const previous = process.env.AUTO_REPLY_KEYWORD_MODE;
    process.env.AUTO_REPLY_KEYWORD_MODE = "LIVE";
    try {
      const { instance, calls } = fakeContext();
      const res = await instance.handleWebhookInboundText({ ...input, replyToken: "" });
      assert.equal(res.outcome, AutoResponseExecutionOutcome.FAILED);
      assert.equal(calls.replies.length, 0);
    } finally { if (previous === undefined) delete process.env.AUTO_REPLY_KEYWORD_MODE; else process.env.AUTO_REPLY_KEYWORD_MODE = previous; }
  });
});
