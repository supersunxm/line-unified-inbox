import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AutoResponseExecutionStatus, AutoResponseStatus } from "@prisma/client";
import { AutoResponseExecutionService } from "./auto-response-execution.service";

describe("AutoResponseExecutionService", () => {
  it("executes active auto-response, resolves variables, replies via LINE, and records success", async () => {
    let sentReply: any = null;
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
          id: "rule-1",
          name: "Promotion Rule",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Promotion at {{store.storeName}}! Visit us: {{store.googleMapsUrl}}",
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
      replyText: async (payload: any) => {
        sentReply = payload;
        return { success: true, requestId: "req-1" };
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      mockEncryption,
      mockLineMessaging,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-1",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-123",
      webhookEventId: "evt-001",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, true);
    assert.equal(sentReply.accessToken, "decrypted-enc-token");
    assert.equal(sentReply.replyToken, "reply-tok-123");
    assert.equal(
      sentReply.text,
      "Promotion at OBS Central Bangna! Visit us: https://maps.app.goo.gl/bangna",
    );
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.SUCCESS);
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
      replyText: async () => {
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
      replyText: async () => {
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
      replyText: async () => {
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
      { replyText: async () => (replyCalled = true) } as any,
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

  it("fails safely without reply when template variable fails to resolve", async () => {
    let recordedExecution: any = null;
    let replyCalled = false;

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
          id: "rule-1",
          name: "Promo",
          status: AutoResponseStatus.ACTIVE,
          textTemplate: "Location: {{store.googleMapsUrl}}",
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
            storeMaster: {
              googleMapsUrl: null, // missing!
            },
          },
        }),
      },
    } as any;

    const service = new AutoResponseExecutionService(
      mockPrisma,
      {} as any,
      { replyText: async () => (replyCalled = true) } as any,
    );

    const result = await service.handleWebhookPostback({
      postbackData: "oppo_ar:v1:rule-1",
      lineOfficialAccountId: "oa-1",
      replyToken: "reply-tok-1",
    });

    assert.equal(result.handled, true);
    assert.equal(result.success, false);
    assert.match(recordedExecution.reason, /GOOGLE_MAPS_NOT_READY|UNRESOLVED_VARIABLE/);
    assert.equal(recordedExecution.status, AutoResponseExecutionStatus.FAILED);
    assert.equal(replyCalled, false);
  });
});
