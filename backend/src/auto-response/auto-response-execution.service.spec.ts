import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutoResponseExecutionStatus, AutoResponseStatus } from "@prisma/client";
import { AutoResponseExecutionService } from "./auto-response-execution.service";

describe("AutoResponseExecutionService", () => {
  it("executes active auto-response with multi-message sequence (IMAGE + TEXT) in exact order via replyMessages", async () => {
    let sentMessages: any = null;
    let recordedExecution: any = null;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          recordedExecution = data;
          return { id: "exec-1", ...data };
        },
      },
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-seq",
          name: "Image + Promo Sequence",
          status: AutoResponseStatus.ACTIVE,
          contentJson: {
            version: 1,
            messages: [
              { id: "img-1", type: "IMAGE", mediaObjectKey: "line-media/promo.jpg", previewObjectKey: "line-media/promo-prev.jpg" },
              { id: "txt-1", type: "TEXT", textTemplate: "Promotion at {{store.storeName}}! Maps: {{store.googleMapsUrl}}" },
            ],
          },
        }),
        count: async () => 1,
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-1",
          name: "OPPO Central Bangna",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "enc-token",
          store: {
            id: "store-1",
            name: "OBS Central Bangna",
            storeMaster: {
              externalStoreId: "865",
              googleMapsUrl: "https://maps.app.goo.gl/bangna",
            },
          },
        }),
      },
    } as any;

    const mockEncryption = {
      decrypt: (val: string) => `decrypted-${val}`,
    } as any;

    const mockLineMessaging = {
      replyMessages: async (_token: string, _replyTok: string, msgs: any[]) => {
        sentMessages = msgs;
        return { success: true, requestId: "req-1" };
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      mockEncryption,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-seq",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-123",
      webhookEventId: "evt-001",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, true);
    assert.equal(sentMessages.length, 2);
    assert.equal(sentMessages[0].type, "image");
    assert.match(sentMessages[0].originalContentUrl, /line-media(%2F|\/)promo\.jpg/);
    assert.equal(sentMessages[1].type, "text");
    assert.equal(
      sentMessages[1].text,
      "Promotion at OBS Central Bangna! Maps: https://maps.app.goo.gl/bangna",
    );
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.SUCCESS);
    assert.equal(recordedExecution.messageCount, 2);
    assert.deepEqual(recordedExecution.messageTypesJson, ["IMAGE", "TEXT"]);
  });

  it("executes legacy Phase 1 TEXT rule cleanly through single-request replyMessages", async () => {
    let sentMessages: any = null;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: "exec-1", ...data }),
      },
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-legacy",
          name: "Legacy Text",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Hello from {{store.storeName}}",
          contentJson: null,
        }),
        count: async () => 1,
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-1",
          name: "OPPO Bangna",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "enc-token",
          store: {
            id: "store-1",
            name: "OBS Central Bangna",
            storeMaster: { externalStoreId: "865" },
          },
        }),
      },
    } as any;

    const mockLineMessaging = {
      replyMessages: async (_tok: string, _rep: string, msgs: any[]) => {
        sentMessages = msgs;
        return { success: true };
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      { decrypt: (v: string) => v } as any,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-legacy",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-legacy",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, true);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].type, "text");
    assert.equal(sentMessages[0].text, "Hello from OBS Central Bangna");
  });

  it("atomic pre-flight: fails entirely and sends 0 messages if ANY block has missing variable", async () => {
    let replyCount = 0;
    let recordedExecution: any = null;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          recordedExecution = data;
          return { id: "exec-fail", ...data };
        },
      },
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-atomic",
          name: "Sequence with missing maps",
          status: AutoResponseStatus.ACTIVE,
          contentJson: {
            version: 1,
            messages: [
              { id: "img-1", type: "IMAGE", mediaObjectKey: "line-media/banner.jpg" },
              { id: "txt-1", type: "TEXT", textTemplate: "Location: {{store.googleMapsUrl}}" },
            ],
          },
        }),
        count: async () => 1,
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-1",
          name: "OPPO Test",
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
          encryptedChannelAccessToken: "enc-token",
          store: {
            id: "store-1",
            name: "Test Store",
            storeMaster: { googleMapsUrl: null }, // Missing Google Maps
          },
        }),
      },
    } as any;

    const mockLineMessaging = {
      replyMessages: async () => {
        replyCount++;
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      { decrypt: (v: string) => v } as any,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-atomic",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-1",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, false);
    assert.equal(replyCount, 0, "Zero LINE messages must be sent on atomic failure");
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.FAILED);
    assert.match(recordedExecution.reason, /GOOGLE_MAPS_NOT_READY|UNRESOLVED_VARIABLE/);
  });

  it("deduplicates identical webhookEventId without sending second reply", async () => {
    let sentCount = 0;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => ({
          id: "exec-existing",
          webhookEventId: "evt-dup-1",
          status: AutoResponseExecutionStatus.SUCCESS,
        }),
      },
    } as any;

    const mockLineMessaging = {
      replyMessages: async () => {
        sentCount++;
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      {} as any,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-1",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-dup",
      webhookEventId: "evt-dup-1",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, true);
    assert.equal(result.reason, "DUPLICATE_EVENT_ALREADY_PROCESSED");
    assert.equal(sentCount, 0);
  });

  it("ignores postback data from other namespaces without error or reply", async () => {
    let replyCalled = false;

    const mockLineMessaging = {
      replyMessages: async () => {
        replyCalled = true;
      },
    } as any;

    const service = new AutoResponseExecutionService(
      {} as any,
      {} as any,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "coupon:redeem:123",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-1",
    });

    assert.equal(result.handled, false);
    assert.equal(result.success, false);
    assert.equal(replyCalled, false);
  });

  it("skips execution safely without reply when rule is INACTIVE or DRAFT", async () => {
    let recordedExecution: any = null;
    let replyCalled = false;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          recordedExecution = data;
          return { id: "exec-skip", ...data };
        },
      },
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-draft",
          name: "Draft Promo",
          status: AutoResponseStatus.DRAFT,
          textTemplate: "Draft text",
        }),
        count: async () => 1,
      },
    } as any;

    const mockLineMessaging = {
      replyMessages: async () => {
        replyCalled = true;
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      {} as any,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-draft",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-1",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, false);
    assert.equal(result.reason, "RULE_DRAFT");
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.SKIPPED);
    assert.equal(replyCalled, false);
  });

  it("skips execution for HEAD_OFFICE account type", async () => {
    let recordedExecution: any = null;
    let replyCalled = false;

    const mockPrisma = {
      autoResponseExecution: {
        findFirst: async () => null,
        create: async ({ data }: any) => {
          recordedExecution = data;
          return { id: "exec-ho", ...data };
        },
      },
      autoResponseRule: {
        findUnique: async () => ({
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Text",
        }),
        count: async () => 1,
      },
      lineOfficialAccount: {
        findUnique: async () => ({
          id: "oa-ho",
          name: "OPPO Head Office",
          accountType: "HEAD_OFFICE",
          isActive: true,
          archivedAt: null,
        }),
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      {} as any,
      { replyMessages: async () => (replyCalled = true) } as any,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-1",
      lineOfficialAccountId: "oa-ho",
      replyToken: "reply-tok-1",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, false);
    assert.equal(result.reason, "HEAD_OFFICE_NOT_SUPPORTED");
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.SKIPPED);
    assert.equal(replyCalled, false);
  });
});
