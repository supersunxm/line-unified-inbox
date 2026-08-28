import test from "node:test";
import assert from "node:assert/strict";
import {
  GreetingExecutionStatus,
  GreetingSendPolicy,
  GreetingTemplateStatus,
  LineAccountType,
} from "@prisma/client";
import { GreetingExecutionService } from "./greeting-execution.service";

function createMockExecutionPrisma() {
  const executions: any[] = [];
  const assignments: any[] = [];
  const templates: any[] = [];
  const accounts: any[] = [];
  const customers: any[] = [];

  return {
    greetingExecution: {
      findFirst: async (args: any) => {
        return (
          executions.find((e) => {
            if (args.where.webhookEventId && e.webhookEventId === args.where.webhookEventId) {
              if (args.where.status && e.status !== args.where.status) return false;
              return true;
            }
            if (
              args.where.lineOfficialAccountId === e.lineOfficialAccountId &&
              args.where.lineUserIdHash === e.lineUserIdHash
            ) {
              if (args.where.status && e.status !== args.where.status) return false;
              return true;
            }
            return false;
          }) || null
        );
      },
      create: async (args: any) => {
        const item = {
          id: `exec-${executions.length + 1}`,
          ...args.data,
          createdAt: new Date(),
        };
        executions.push(item);
        return item;
      },
    },
    greetingStoreAssignment: {
      findUnique: async (args: { where: { lineOfficialAccountId: string } }) => {
        const asg = assignments.find(
          (a) => a.lineOfficialAccountId === args.where.lineOfficialAccountId,
        );
        if (!asg) return null;
        return {
          ...asg,
          template: templates.find((t) => t.id === asg.templateId) || null,
        };
      },
    },
    lineOfficialAccount: {
      findUnique: async (args: { where: { id: string } }) => {
        return accounts.find((a) => a.id === args.where.id) || null;
      },
    },
    customer: {
      findUnique: async (args: { where: { lineUserId: string } }) => {
        return customers.find((c) => c.lineUserId === args.where.lineUserId) || null;
      },
    },
    _raw: { executions, assignments, templates, accounts, customers },
  };
}

test("GreetingExecutionService: FIRST_TIME_ONLY vs ADD_AND_UNBLOCK policies", async () => {
  const prisma = createMockExecutionPrisma();

  // Setup template (ACTIVE, FIRST_TIME_ONLY)
  prisma._raw.templates.push({
    id: "tmpl-1",
    name: "Standard Welcome",
    status: GreetingTemplateStatus.ACTIVE,
    sendPolicy: GreetingSendPolicy.FIRST_TIME_ONLY,
    contentJson: {
      version: 1,
      messages: [
        { id: "1", type: "TEXT", textTemplate: "ยินดีต้อนรับสู่ {{store.storeName}}" },
      ],
    },
  });

  // Setup account & assignment
  prisma._raw.accounts.push({
    id: "oa-1",
    name: "OPPO Store Central",
    basicId: "@oppo_central",
    accountType: LineAccountType.STORE,
    isActive: true,
    archivedAt: null,
    encryptedChannelAccessToken: "enc-token",
    store: {
      id: "store-1",
      name: "Central World",
      storeMaster: { storeName: "OPPO Central World" },
    },
  });

  prisma._raw.assignments.push({
    id: "asg-1",
    templateId: "tmpl-1",
    lineOfficialAccountId: "oa-1",
  });

  const replyCalls: any[] = [];
  const mockLineMessaging = {
    replyMessages: async (accessToken: string, replyToken: string, messages: any[]) => {
      replyCalls.push({ accessToken, replyToken, messages });
      return { success: true, requestId: "req-1", externalMessageId: "msg-1" };
    },
  };

  const mockEncryption = {
    decrypt: (tok: string) => `decrypted-${tok}`,
  };

  const mockProfiles = {
    refresh: async () => ({ displayName: "Mock User" }),
  };

  const service = new GreetingExecutionService(
    prisma as any,
    mockEncryption as any,
    mockLineMessaging as any,
    mockProfiles as any,
  );

  // 1. FIRST_TIME_ONLY + new add (isUnblocked = false) -> Replies successfully
  const res1 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-123",
    replyToken: "reply-token-1",
    webhookEventId: "evt-1",
    isUnblocked: false,
  });

  assert.equal(res1.success, true);
  assert.equal(replyCalls.length, 1);
  assert.equal(replyCalls[0].replyToken, "reply-token-1");
  assert.deepEqual(replyCalls[0].messages, [
    { type: "text", text: "ยินดีต้อนรับสู่ OPPO Central World" },
  ]);

  // 2. FIRST_TIME_ONLY + unblock (isUnblocked = true) -> Skips
  const res2 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-456",
    replyToken: "reply-token-2",
    webhookEventId: "evt-2",
    isUnblocked: true,
  });

  assert.equal(res2.success, false);
  assert.equal(res2.reason, "FIRST_TIME_ONLY_UNBLOCK_SKIPPED");
  assert.equal(replyCalls.length, 1); // No new reply

  // 3. FIRST_TIME_ONLY + prior success for same user -> Skips
  const res3 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-123", // Same user that succeeded in step 1
    replyToken: "reply-token-3",
    webhookEventId: "evt-3",
    isUnblocked: false,
  });

  assert.equal(res3.success, false);
  assert.equal(res3.reason, "FIRST_TIME_ONLY_ALREADY_RECEIVED");
  assert.equal(replyCalls.length, 1); // No new reply

  // 4. Switch template to ADD_AND_UNBLOCK -> unblock now receives reply
  prisma._raw.templates[0].sendPolicy = GreetingSendPolicy.ADD_AND_UNBLOCK;

  const res4 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-789",
    replyToken: "reply-token-4",
    webhookEventId: "evt-4",
    isUnblocked: true,
  });

  assert.equal(res4.success, true);
  assert.equal(replyCalls.length, 2);
  assert.equal(replyCalls[1].replyToken, "reply-token-4");
});

test("GreetingExecutionService: idempotency by webhookEventId prevents duplicate replies", async () => {
  const prisma = createMockExecutionPrisma();

  prisma._raw.templates.push({
    id: "tmpl-1",
    name: "Standard Welcome",
    status: GreetingTemplateStatus.ACTIVE,
    sendPolicy: GreetingSendPolicy.ADD_AND_UNBLOCK,
    contentJson: {
      version: 1,
      messages: [{ id: "1", type: "TEXT", textTemplate: "Hello!" }],
    },
  });

  prisma._raw.accounts.push({
    id: "oa-1",
    name: "OPPO Store",
    basicId: "@oppo",
    accountType: LineAccountType.STORE,
    isActive: true,
    archivedAt: null,
    encryptedChannelAccessToken: "enc-token",
    store: { id: "store-1", name: "Store" },
  });

  prisma._raw.assignments.push({
    id: "asg-1",
    templateId: "tmpl-1",
    lineOfficialAccountId: "oa-1",
  });

  const replyCalls: any[] = [];
  const mockLineMessaging = {
    replyMessages: async (accessToken: string, replyToken: string, messages: any[]) => {
      replyCalls.push({ accessToken, replyToken, messages });
      return { success: true, requestId: "req-1", externalMessageId: "msg-1" };
    },
  };

  const service = new GreetingExecutionService(
    prisma as any,
    { decrypt: (t: string) => t } as any,
    mockLineMessaging as any,
    { refresh: async () => null } as any,
  );

  // First delivery
  const res1 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-1",
    replyToken: "tok-1",
    webhookEventId: "duplicate-event-id",
  });
  assert.equal(res1.success, true);
  assert.equal(replyCalls.length, 1);

  // Redelivery of same webhookEventId
  const res2 = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-1",
    replyToken: "tok-2",
    webhookEventId: "duplicate-event-id",
  });
  assert.equal(res2.success, true);
  assert.equal(res2.reason, "DUPLICATE_EVENT_ALREADY_PROCESSED");
  assert.equal(replyCalls.length, 1); // Still exactly 1 reply
});

test("GreetingExecutionService: multi-block TEXT + IMAGE dispatches in ONE single reply call", async () => {
  const prisma = createMockExecutionPrisma();

  prisma._raw.templates.push({
    id: "tmpl-multi",
    name: "Multi block",
    status: GreetingTemplateStatus.ACTIVE,
    sendPolicy: GreetingSendPolicy.FIRST_TIME_ONLY,
    contentJson: {
      version: 1,
      messages: [
        { id: "1", type: "TEXT", textTemplate: "ยินดีต้อนรับคุณ {{user.displayName}}" },
        { id: "2", type: "IMAGE", mediaObjectKey: "line-media/greeting/banner.jpg" },
      ],
    },
  });

  prisma._raw.accounts.push({
    id: "oa-1",
    name: "OPPO Store",
    accountType: LineAccountType.STORE,
    isActive: true,
    archivedAt: null,
    encryptedChannelAccessToken: "enc-token",
    store: { id: "store-1", name: "Store" },
  });

  prisma._raw.assignments.push({
    id: "asg-1",
    templateId: "tmpl-multi",
    lineOfficialAccountId: "oa-1",
  });

  prisma._raw.customers.push({
    id: "cust-1",
    lineUserId: "user-line-1",
    displayName: "คุณสมชาย",
  });

  const replyCalls: any[] = [];
  const mockLineMessaging = {
    replyMessages: async (accessToken: string, replyToken: string, messages: any[]) => {
      replyCalls.push({ accessToken, replyToken, messages });
      return { success: true, requestId: "req-1", externalMessageId: "msg-1" };
    },
  };

  let profileFetchCount = 0;
  const mockProfiles = {
    refresh: async () => {
      profileFetchCount++;
      return { displayName: "คุณสมชาย" };
    },
  };

  const service = new GreetingExecutionService(
    prisma as any,
    { decrypt: (t: string) => t } as any,
    mockLineMessaging as any,
    mockProfiles as any,
  );

  const res = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-1",
    lineUserId: "user-line-1",
    replyToken: "reply-multi",
    webhookEventId: "evt-multi",
  });

  assert.equal(res.success, true);
  assert.equal(replyCalls.length, 1);
  assert.equal(replyCalls[0].messages.length, 2);
  assert.equal(replyCalls[0].messages[0].type, "text");
  assert.equal(replyCalls[0].messages[0].text, "ยินดีต้อนรับคุณ คุณสมชาย");
  assert.equal(replyCalls[0].messages[1].type, "image");
  assert.match(
    replyCalls[0].messages[1].originalContentUrl,
    /line-media(%2F|\/)greeting(%2F|\/)banner\.jpg/,
  );
});

test("GreetingExecutionService: missing store variable skips execution with zero send", async () => {
  const prisma = createMockExecutionPrisma();

  prisma._raw.templates.push({
    id: "tmpl-map",
    name: "Map required",
    status: GreetingTemplateStatus.ACTIVE,
    sendPolicy: GreetingSendPolicy.FIRST_TIME_ONLY,
    contentJson: {
      version: 1,
      messages: [
        { id: "1", type: "TEXT", textTemplate: "แผนที่ร้าน: {{store.googleMapsUrl}}" },
      ],
    },
  });

  prisma._raw.accounts.push({
    id: "oa-missing-map",
    name: "OPPO Store No Map",
    accountType: LineAccountType.STORE,
    isActive: true,
    archivedAt: null,
    encryptedChannelAccessToken: "enc-token",
    store: {
      id: "store-1",
      name: "Store No Map",
      storeMaster: { googleMapsUrl: null }, // Missing Maps
    },
  });

  prisma._raw.assignments.push({
    id: "asg-1",
    templateId: "tmpl-map",
    lineOfficialAccountId: "oa-missing-map",
  });

  const replyCalls: any[] = [];
  const mockLineMessaging = {
    replyMessages: async () => {
      replyCalls.push(1);
    },
  };

  const service = new GreetingExecutionService(
    prisma as any,
    { decrypt: (t: string) => t } as any,
    mockLineMessaging as any,
    { refresh: async () => null } as any,
  );

  const res = await service.handleFollowEvent({
    lineOfficialAccountId: "oa-missing-map",
    lineUserId: "user-1",
    replyToken: "reply-tok",
  });

  assert.equal(res.success, false);
  assert.match(res.reason!, /MISSING_STORE_VARIABLES/);
  assert.equal(replyCalls.length, 0); // ZERO LINE SEND
});
