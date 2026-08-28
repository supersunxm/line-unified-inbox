import assert from "node:assert/strict";
import test from "node:test";
import {
  AutoResponseExecutionOutcome,
  AutoResponseIntent,
  AutoResponseStatus,
  AutoResponseTriggerType,
  Prisma,
} from "@prisma/client";
import { AutoResponseExecutionService } from "./auto-response-execution.service";
import { PILOT_APPROVED_RESPONSE_TEMPLATES } from "./auto-response-pilot.config";

const originalMode = process.env.AUTO_REPLY_PILOT_MODE;

function setMode(mode: "OFF" | "SHADOW" | "LIVE") {
  process.env.AUTO_REPLY_PILOT_MODE = mode;
}

function restoreMode() {
  if (originalMode === undefined) delete process.env.AUTO_REPLY_PILOT_MODE;
  else process.env.AUTO_REPLY_PILOT_MODE = originalMode;
}

function buildHarness(overrides?: { storeCode?: string; externalStoreId?: string; accountType?: "STORE" | "HEAD_OFFICE"; duplicate?: boolean; template?: string; messageDirection?: "INBOUND" | "OUTBOUND"; messageType?: "TEXT" | "IMAGE" }) {
  let replyCount = 0;
  let createdData: any;
  let updatedData: any;
  const storeCode = overrides?.storeCode ?? "28375";
  const externalStoreId = overrides?.externalStoreId ?? "28375";
  const oa = {
    id: "oa-pilot",
    name: "Robinson Chonburi OA",
    accountType: overrides?.accountType ?? "STORE",
    isActive: true,
    archivedAt: null,
    encryptedChannelAccessToken: "encrypted-token",
    store: {
      id: "store-pilot",
      name: "OBS Robinson Chonburi By OPPO",
      code: storeCode,
      storeMaster: { externalStoreId, googleMapsUrl: null },
    },
  };
  const rule = {
    id: "rule-location",
    name: "Robinson location",
    status: AutoResponseStatus.ACTIVE,
    triggerType: AutoResponseTriggerType.INBOUND_TEXT,
    intent: AutoResponseIntent.STORE_LOCATION,
    scopeStoreId: "store-pilot",
    textTemplate: overrides?.template ?? PILOT_APPROVED_RESPONSE_TEMPLATES.STORE_LOCATION,
    contentJson: null,
    scopeStore: oa.store,
  };
  const prisma = {
    message: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        direction: overrides?.messageDirection ?? "INBOUND",
        messageType: overrides?.messageType ?? "TEXT",
        conversationId: where.id.replace(/^message/u, "conversation"),
        conversation: { lineOfficialAccountId: "oa-pilot", isQa: false },
      }),
    },
    lineOfficialAccount: { findUnique: async () => oa },
    autoResponseRule: {
      findMany: async () => [rule],
      count: async () => 1,
    },
    autoResponseExecution: {
      create: async ({ data }: any) => {
        if (overrides?.duplicate) {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" });
        }
        createdData = data;
        return { id: "execution-1", ...data };
      },
      update: async ({ data }: any) => {
        updatedData = data;
        return { id: "execution-1", ...data };
      },
      findUnique: async () => ({ id: "existing-execution" }),
    },
  } as any;
  const service = new AutoResponseExecutionService(
    prisma,
    { decrypt: () => "access-token" } as any,
    { replyMessages: async () => { replyCount += 1; return { success: true }; } } as any,
  );
  return { service, get replyCount() { return replyCount; }, get createdData() { return createdData; }, get updatedData() { return updatedData; } };
}

test("store 28375 SHADOW records a match without calling LINE", async () => {
  setMode("SHADOW");
  try {
    const harness = buildHarness();
    const result = await harness.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-1",
      conversationId: "conversation-1",
      lineOfficialAccountId: "oa-pilot",
      replyToken: "reply-token",
      webhookEventId: "event-1",
    });
    assert.equal(result.outcome, AutoResponseExecutionOutcome.MATCHED_SHADOW);
    assert.equal(harness.replyCount, 0);
    assert.equal(harness.createdData.mode, "SHADOW");
    assert.equal(harness.createdData.intent, AutoResponseIntent.STORE_LOCATION);
    assert.equal(harness.updatedData.outcome, AutoResponseExecutionOutcome.MATCHED_SHADOW);
  } finally {
    restoreMode();
  }
});

test("store 28375 LIVE sends exactly one approved text reply and does not touch conversation status", async () => {
  setMode("LIVE");
  try {
    const harness = buildHarness();
    const result = await harness.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-live",
      conversationId: "conversation-live",
      lineOfficialAccountId: "oa-pilot",
      replyToken: "reply-token",
      webhookEventId: "event-live",
    });
    assert.equal(result.outcome, AutoResponseExecutionOutcome.SENT);
    assert.equal(harness.replyCount, 1);
    assert.equal(harness.updatedData.status, "SUCCESS");
    assert.equal(harness.updatedData.outcome, AutoResponseExecutionOutcome.SENT);
  } finally {
    restoreMode();
  }
});

test("LIVE blocks a rule whose response drifts from the approved template", async () => {
  setMode("LIVE");
  try {
    const harness = buildHarness({ template: "Unreviewed response" });
    const result = await harness.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-unapproved",
      conversationId: "conversation-unapproved",
      lineOfficialAccountId: "oa-pilot",
      replyToken: "reply-token",
    });
    assert.equal(result.outcome, AutoResponseExecutionOutcome.FAILED);
    assert.equal(harness.replyCount, 0);
    assert.equal(harness.updatedData.outcome, AutoResponseExecutionOutcome.FAILED);
  } finally {
    restoreMode();
  }
});

test("wrong store and HEAD_OFFICE are hard-isolated", async () => {
  setMode("LIVE");
  try {
    const wrongStore = buildHarness({ storeCode: "999", externalStoreId: "999" });
    const wrongStoreResult = await wrongStore.service.handleWebhookInboundText({ text: "ร้านอยู่ที่ไหนครับ", messageId: "message-other", conversationId: "conversation-other", lineOfficialAccountId: "oa-pilot", replyToken: "reply" });
    assert.equal(wrongStoreResult.reason, "PILOT_SCOPE_MISMATCH");
    assert.equal(wrongStore.replyCount, 0);

    const headOffice = buildHarness({ accountType: "HEAD_OFFICE" });
    const headOfficeResult = await headOffice.service.handleWebhookInboundText({ text: "ร้านอยู่ที่ไหนครับ", messageId: "message-hq", conversationId: "conversation-hq", lineOfficialAccountId: "oa-pilot", replyToken: "reply" });
    assert.equal(headOfficeResult.reason, "PILOT_SCOPE_MISMATCH");
    assert.equal(headOffice.replyCount, 0);
  } finally {
    restoreMode();
  }
});

test("pilot requires a persisted inbound text source message", async () => {
  setMode("SHADOW");
  try {
    const outbound = buildHarness({ messageDirection: "OUTBOUND" });
    const result = await outbound.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-outbound",
      conversationId: "conversation-outbound",
      lineOfficialAccountId: "oa-pilot",
      replyToken: "reply-token",
    });
    assert.equal(result.reason, "SOURCE_MESSAGE_NOT_ELIGIBLE");
    assert.equal(outbound.replyCount, 0);

    const image = buildHarness({ messageType: "IMAGE" });
    const imageResult = await image.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-image",
      conversationId: "conversation-image",
      lineOfficialAccountId: "oa-pilot",
      replyToken: "reply-token",
    });
    assert.equal(imageResult.reason, "SOURCE_MESSAGE_NOT_ELIGIBLE");
    assert.equal(image.replyCount, 0);
  } finally {
    restoreMode();
  }
});

test("missing LINE reply token is excluded before matcher or send", async () => {
  setMode("SHADOW");
  try {
    const harness = buildHarness();
    const result = await harness.service.handleWebhookInboundText({
      text: "ร้านอยู่ที่ไหนครับ",
      messageId: "message-no-token",
      conversationId: "conversation-no-token",
      lineOfficialAccountId: "oa-pilot",
    });
    assert.equal(result.outcome, AutoResponseExecutionOutcome.EXCLUDED);
    assert.equal(result.reason, "MISSING_REPLY_TOKEN");
    assert.equal(harness.replyCount, 0);
    assert.equal(harness.createdData.outcome, AutoResponseExecutionOutcome.EXCLUDED);
  } finally {
    restoreMode();
  }
});

test("duplicate source message is claimed once and never sends a second reply", async () => {
  setMode("LIVE");
  try {
    const harness = buildHarness({ duplicate: true });
    const result = await harness.service.handleWebhookInboundText({ text: "ร้านอยู่ที่ไหนครับ", messageId: "message-duplicate", conversationId: "conversation-duplicate", lineOfficialAccountId: "oa-pilot", replyToken: "reply" });
    assert.equal(result.outcome, AutoResponseExecutionOutcome.DUPLICATE);
    assert.equal(harness.replyCount, 0);
  } finally {
    restoreMode();
  }
});
