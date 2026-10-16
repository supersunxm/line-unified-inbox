import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutoResponseExecutionOutcome, AutoResponseStatus, AutoResponseTriggerType, Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma.service";
import type { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import type { LineMessagingService } from "../line-messaging/line-messaging.service";
import type { RichMessageService } from "../rich-message/rich-message.service";
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
type MessageSource = {
  direction: string;
  messageType: string;
  conversationId: string;
  conversation: { lineOfficialAccountId: string; isQa: boolean };
};

type FakeContextOptions = {
  blocks?: unknown[];
  source?: Partial<MessageSource>;
  claim?: (data: Record<string, unknown>) => Promise<{ id: string }>;
};

const uniqueExecutionError = () => new Prisma.PrismaClientKnownRequestError(
  "Unique constraint failed on the fields: (`sourceMessageId`)",
  { code: "P2002", clientVersion: "keyword-execution-test", meta: { target: ["sourceMessageId"] } },
);

function fakeContext(options: FakeContextOptions = {}) {
  const calls = { replies: [] as unknown[][], executions: [] as Array<Record<string, unknown>> };
  const source: MessageSource = {
    direction: "INBOUND",
    messageType: "TEXT",
    conversationId: "conv1",
    conversation: { lineOfficialAccountId: oaId, isQa: false },
    ...options.source,
  };
  const prisma = {
    lineOfficialAccount: { findUnique: async () => ({
      id: oaId, name: "OPPO Pinklao", accountType: "STORE", isActive: true,
      archivedAt: null, connectionStatus: "READY",
      encryptedChannelAccessToken: "enc-token", encryptedChannelSecret: "enc-secret",
      store: { id: storeId, name: "Central Pinklao", code: "865", isActive: true, archivedAt: null,
        storeMaster: { externalStoreId: "865", googleMapsUrl: "https://maps.google.com/?q=Pinklao" } },
    }) },
    message: { findUnique: async () => source },
    autoResponseRule: { findMany: async () => [rule(options.blocks)] },
    autoResponseExecution: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.claim) return options.claim(data);
        calls.executions.push({ id: "exec1", ...data });
        return { id: "exec1" };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.executions.push(data);
        return { id: "exec1" };
      },
    },
  } as unknown as PrismaService;
  const line = { replyMessages: async (_token: string, _reply: string, messages: unknown[]) => {
    calls.replies.push(messages);
  } } as unknown as LineMessagingService;
  const rich = {
    get: async () => ({ name: "Find X10", isActive: true }),
    buildLineImagemap: async () => ({ type: "imagemap", baseUrl: "https://example.com/rich", altText: "Find X10", baseSize: { width: 1040, height: 1040 }, actions: [] }),
  } as unknown as RichMessageService;
  const encryption = { decrypt: () => "token" } as unknown as CredentialEncryptionService;
  const instance = new AutoResponseRichMessageExecutionService(prisma, encryption, line, rich);
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
      const { instance, calls } = fakeContext({ blocks });
      const res = await instance.handleWebhookInboundText(input);
      assert.equal(res.outcome, AutoResponseExecutionOutcome.SENT);
      assert.equal(calls.replies.length, 1);
      assert.equal(calls.replies[0].length, 2);
      assert.deepEqual(calls.replies[0][0], { type: "text", text: "OPPO Central Pinklao" });
      assert.equal((calls.replies[0][1] as { type: string }).type, "imagemap");
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

  it("checks persisted source identity before evaluating a keyword", async () => {
    const previous = process.env.AUTO_REPLY_KEYWORD_MODE;
    process.env.AUTO_REPLY_KEYWORD_MODE = "LIVE";
    try {
      const { instance, calls } = fakeContext({ source: { conversation: { lineOfficialAccountId: "other-oa", isQa: false } } });
      const res = await instance.handleWebhookInboundText(input);
      assert.equal(res.reason, "KEYWORD_SOURCE_NOT_ELIGIBLE");
      assert.equal(calls.executions.length, 0);
      assert.equal(calls.replies.length, 0);
    } finally { if (previous === undefined) delete process.env.AUTO_REPLY_KEYWORD_MODE; else process.env.AUTO_REPLY_KEYWORD_MODE = previous; }
  });

  it("allows one concurrent sender for a source message", async () => {
    const previous = process.env.AUTO_REPLY_KEYWORD_MODE;
    process.env.AUTO_REPLY_KEYWORD_MODE = "LIVE";
    let claimed = false;
    try {
      const { instance, calls } = fakeContext({ claim: async (data) => {
        if (claimed) throw uniqueExecutionError();
        claimed = true;
        calls.executions.push({ id: "exec1", ...data });
        return { id: "exec1" };
      } });
      const results = await Promise.all([
        instance.handleWebhookInboundText(input),
        instance.handleWebhookInboundText(input),
      ]);
      assert.equal(results.filter((result) => result.outcome === AutoResponseExecutionOutcome.SENT).length, 1);
      assert.equal(results.filter((result) => result.outcome === AutoResponseExecutionOutcome.DUPLICATE).length, 1);
      assert.equal(calls.replies.length, 1);
    } finally { if (previous === undefined) delete process.env.AUTO_REPLY_KEYWORD_MODE; else process.env.AUTO_REPLY_KEYWORD_MODE = previous; }
  });
});
