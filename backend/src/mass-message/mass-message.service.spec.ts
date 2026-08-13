import assert from "node:assert/strict";
import test from "node:test";
import {
  MassMessageAudienceType,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
  MassMessageStoreMode,
  UserRole,
} from "@prisma/client";
import { MassMessageService } from "./mass-message.service";
import type { AuthUser } from "../auth/auth.guard";

const adminUser: AuthUser = {
  id: "admin-uuid-1",
  email: "admin@oppo.th",
  displayName: "Admin User",
  role: UserRole.ADMIN,
  isActive: true,
};

void test("preview calculates dry-run scope and recipient estimates without persisting or sending", async () => {
  const scopes = [
    {
      storeId: "s-1",
      storeName: "Store 1",
      storeCode: "001",
      lineOfficialAccountId: "oa-1",
      lineOaName: "OA 1",
      encryptedChannelAccessToken: "tok",
      isEligible: true,
      skipReason: null,
      recipientUserIds: ["U1", "U2", "U3"],
    },
    {
      storeId: "s-2",
      storeName: "Store 2",
      storeCode: "002",
      lineOfficialAccountId: null,
      lineOaName: null,
      encryptedChannelAccessToken: null,
      isEligible: false,
      skipReason: "MISSING_TOKEN",
      recipientUserIds: [],
    },
  ];

  const scopeService = {
    resolveStoreScope: async () => scopes,
  } as any;

  const prisma = {} as any;
  const processor = {} as any;

  const service = new MassMessageService(prisma, scopeService, processor);

  const preview = await service.preview(
    {
      storeSelection: { mode: MassMessageStoreMode.ALL },
      audienceType: MassMessageAudienceType.ALL_KNOWN,
    },
    adminUser,
  );

  assert.equal(preview.storeCount, 2);
  assert.equal(preview.eligibleStoreCount, 1);
  assert.equal(preview.skippedStoreCount, 1);
  assert.equal(preview.estimatedRecipientCount, 3);
  assert.equal(preview.stores[0].status, "READY");
  assert.equal(preview.stores[0].recipientCount, 3);
  assert.equal(preview.stores[1].status, "SKIPPED");
  assert.equal(preview.stores[1].skipReason, "MISSING_TOKEN");
});

void test("createAndSend creates campaign and triggers processor", async () => {
  let createdCampaign: any = null;
  const createdDeliveries: any[] = [];
  let triggeredProcessorId = "";

  const scopes = [
    {
      storeId: "s-1",
      storeName: "Store 1",
      storeCode: "001",
      lineOfficialAccountId: "oa-1",
      lineOaName: "OA 1",
      encryptedChannelAccessToken: "tok",
      isEligible: true,
      skipReason: null,
      recipientUserIds: ["U1", "U2"],
    },
  ];

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => null, // No prior campaign for idempotency check
      create: async (args: any) => {
        createdCampaign = {
          id: "camp-uuid-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...args.data,
        };
        return createdCampaign;
      },
    },
    massMessageStoreDelivery: {
      create: async (args: any) => {
        createdDeliveries.push(args.data);
        return args.data;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  } as any;

  const scopeService = {
    resolveStoreScope: async () => scopes,
  } as any;

  const processor = {
    processCampaign: async (id: string) => {
      triggeredProcessorId = id;
    },
  } as any;

  const service = new MassMessageService(prisma, scopeService, processor);

  const result = await service.createAndSend(
    {
      campaignRequestId: "a0000000-0000-4000-8000-000000000001",
      title: "New Campaign",
      storeSelection: { mode: MassMessageStoreMode.ALL },
      audienceType: MassMessageAudienceType.ALL_KNOWN,
      messages: [{ type: "text", text: "Hello Customers" }],
    },
    adminUser,
  );

  assert.equal(result.id, "camp-uuid-1");
  assert.equal(result.duplicate, false);
  assert.equal(result.storeCount, 1);
  assert.equal(result.eligibleStoreCount, 1);
  assert.equal(result.estimatedRecipientCount, 2);
  assert.equal(createdDeliveries.length, 1);
  assert.equal(createdDeliveries[0].status, MassMessageStoreDeliveryStatus.PENDING);
  assert.equal(triggeredProcessorId, "camp-uuid-1");
});

void test("createAndSend enforces idempotency by returning existing campaign on duplicate campaignRequestId", async () => {
  const existingCampaign = {
    id: "existing-campaign-id",
    campaignRequestId: "a0000000-0000-4000-8000-000000000002",
    title: "Prior Campaign",
    audienceType: MassMessageAudienceType.ALL_KNOWN,
    storeMode: MassMessageStoreMode.ALL,
    selectedStoreIds: [],
    status: MassMessageCampaignStatus.COMPLETED,
    createdById: "admin-1",
    createdBy: { displayName: "Admin User" },
    storeCount: 1,
    eligibleStoreCount: 1,
    skippedStoreCount: 0,
    estimatedRecipientCount: 50,
    processedRecipientCount: 50,
    successRecipientCount: 50,
    failedRecipientCount: 0,
    messagePayload: { messages: [{ type: "text", text: "Prior Message" }] },
    errorMessage: null,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    storeDeliveries: [],
  };

  let processorCalled = false;

  const prisma = {
    massMessageCampaign: {
      findUnique: async ({ where }: any) => {
        if (where.campaignRequestId === existingCampaign.campaignRequestId) {
          return existingCampaign;
        }
        return null;
      },
    },
  } as any;

  const scopeService = {} as any;
  const processor = {
    processCampaign: async () => {
      processorCalled = true;
    },
  } as any;

  const service = new MassMessageService(prisma, scopeService, processor);

  const result = await service.createAndSend(
    {
      campaignRequestId: existingCampaign.campaignRequestId,
      storeSelection: { mode: MassMessageStoreMode.ALL },
      audienceType: MassMessageAudienceType.ALL_KNOWN,
      messages: [{ type: "text", text: "Prior Message" }],
    },
    adminUser,
  );

  assert.equal(result.id, "existing-campaign-id");
  assert.equal(result.duplicate, true);
  assert.equal(processorCalled, false); // Must NOT re-trigger execution
});

void test("createAndSend rejects invalid UUID or invalid messages array", async () => {
  const service = new MassMessageService({} as any, {} as any, {} as any);

  // Invalid UUID
  await assert.rejects(
    () =>
      service.createAndSend(
        {
          campaignRequestId: "not-a-uuid",
          storeSelection: { mode: MassMessageStoreMode.ALL },
          messages: [{ type: "text", text: "hi" }],
        },
        adminUser,
      ),
    /campaignRequestId must be a valid UUID/,
  );

  // Empty messages
  await assert.rejects(
    () =>
      service.createAndSend(
        {
          campaignRequestId: "a0000000-0000-4000-8000-000000000003",
          storeSelection: { mode: MassMessageStoreMode.ALL },
          messages: [],
        },
        adminUser,
      ),
    /messages must be a non-empty array of message objects/,
  );

  // More than 5 messages
  const sixMessages = Array.from({ length: 6 }, () => ({ type: "text", text: "msg" }));
  await assert.rejects(
    () =>
      service.createAndSend(
        {
          campaignRequestId: "a0000000-0000-4000-8000-000000000004",
          storeSelection: { mode: MassMessageStoreMode.ALL },
          messages: sixMessages,
        },
        adminUser,
      ),
    /LINE allows at most 5 message objects per multicast request/,
  );
});

void test("createAndSend race condition: simultaneous requests with same campaignRequestId result in only 1 campaign", async () => {
  const { Prisma } = await import("@prisma/client");
  const campaignsInDb = new Map<string, any>();
  const deliveriesInDb: any[] = [];
  let processorCalls = 0;

  const prisma = {
    massMessageCampaign: {
      findUnique: async ({ where }: any) => {
        return campaignsInDb.get(where.campaignRequestId) ?? null;
      },
      create: async (args: any) => {
        if (campaignsInDb.has(args.data.campaignRequestId)) {
          const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "6.0.0",
          });
          throw err;
        }
        const rec = {
          id: "race-camp-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: { displayName: "Admin User" },
          storeDeliveries: [],
          ...args.data,
        };
        campaignsInDb.set(args.data.campaignRequestId, rec);
        return rec;
      },
    },
    massMessageStoreDelivery: {
      create: async (args: any) => {
        deliveriesInDb.push(args.data);
        return args.data;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  } as any;

  const scopeService = {
    resolveStoreScope: async () => [
      {
        storeId: "s-1",
        storeName: "Store 1",
        storeCode: "001",
        lineOfficialAccountId: "oa-1",
        lineOaName: "OA 1",
        encryptedChannelAccessToken: "tok",
        isEligible: true,
        skipReason: null,
        recipientUserIds: ["U1"],
      },
    ],
  } as any;

  const processor = {
    processCampaign: async () => {
      processorCalls++;
    },
  } as any;

  const service = new MassMessageService(prisma, scopeService, processor);

  const payload = {
    campaignRequestId: "a0000000-0000-4000-8000-000000000099",
    storeSelection: { mode: MassMessageStoreMode.ALL },
    audienceType: MassMessageAudienceType.ALL_KNOWN,
    messages: [{ type: "text", text: "Race message" }],
  };

  // Run two requests simultaneously
  const [res1, res2] = await Promise.all([
    service.createAndSend(payload, adminUser),
    service.createAndSend(payload, adminUser),
  ]);

  assert.equal(campaignsInDb.size, 1);
  assert.equal(res1.id, "race-camp-1");
  assert.equal(res2.id, "race-camp-1");
  // One must be duplicate: false, the other must be duplicate: true
  const duplicates = [res1.duplicate, res2.duplicate].sort();
  assert.deepEqual(duplicates, [false, true]);
  assert.equal(processorCalls, 1); // Processor dispatched only once
});

