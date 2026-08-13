import assert from "node:assert/strict";
import test from "node:test";
import {
  MassMessageBatchStatus,
  MassMessageCampaignStatus,
  MassMessageStoreDeliveryStatus,
} from "@prisma/client";
import { MassMessageProcessorService } from "./mass-message-processor.service";

void test("processCampaign splits 1001 users into 3 batches (500 + 500 + 1) and executes multicast", async () => {
  const sentBatches: any[] = [];
  const createdBatches: any[] = [];
  const updatedDeliveries: any[] = [];
  const updatedCampaigns: any[] = [];

  const recipient1001 = Array.from({ length: 1001 }, (_, i) => `U_${i}`);

  const mockCampaign = {
    id: "campaign-1",
    status: MassMessageCampaignStatus.PENDING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Hello Promo" }] },
    storeDeliveries: [
      {
        id: "del-1",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        status: MassMessageStoreDeliveryStatus.PENDING,
        skipReason: null,
        lineOfficialAccount: {
          id: "oa-1",
          name: "OA 1",
          encryptedChannelAccessToken: "enc-tok-1",
          isActive: true,
          archivedAt: null,
        },
      },
    ],
  };

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      update: async (args: any) => {
        updatedCampaigns.push(args);
        return { ...mockCampaign, ...args.data };
      },
    },
    massMessageStoreDelivery: {
      update: async (args: any) => {
        updatedDeliveries.push(args);
        return args;
      },
      findMany: async () => [{ status: MassMessageStoreDeliveryStatus.SUCCESS }],
    },
    massMessageBatch: {
      findMany: async () => [],
      create: async (args: any) => {
        const record = { id: `batch-${createdBatches.length + 1}`, ...args.data };
        createdBatches.push(record);
        return record;
      },
      update: async (args: any) => args,
    },
    $transaction: async (promises: any[]) => Promise.all(promises),
  } as any;

  const encryption = {
    decrypt: (val: string) => `decrypted-${val}`,
  } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      sentBatches.push(input);
      return {
        requestId: `req-${sentBatches.length}`,
        acceptedRequestId: null,
        duplicateAccepted: false,
      };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => recipient1001,
  } as any;

  const processor = new MassMessageProcessorService(
    prisma,
    encryption,
    lineMessaging,
    scopeService,
  );

  await processor.processCampaign("campaign-1");

  // Verify batches created
  assert.equal(createdBatches.length, 3);
  assert.equal(createdBatches[0].recipientCount, 500);
  assert.equal(createdBatches[1].recipientCount, 500);
  assert.equal(createdBatches[2].recipientCount, 1);

  // Verify multicast calls
  assert.equal(sentBatches.length, 3);
  assert.equal(sentBatches[0].to.length, 500);
  assert.equal(sentBatches[1].to.length, 500);
  assert.equal(sentBatches[2].to.length, 1);
  assert.equal(sentBatches[0].accessToken, "decrypted-enc-tok-1");

  // Verify retryKeys are distinct across batches
  assert.notEqual(createdBatches[0].retryKey, createdBatches[1].retryKey);
  assert.notEqual(createdBatches[1].retryKey, createdBatches[2].retryKey);
});

void test("processCampaign reuses the same retryKey during retries for a transient failure", async () => {
  const retryKeysUsed: string[] = [];
  let callCount = 0;

  const mockCampaign = {
    id: "campaign-retry",
    status: MassMessageCampaignStatus.PENDING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Hello" }] },
    storeDeliveries: [
      {
        id: "del-retry",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        status: MassMessageStoreDeliveryStatus.PENDING,
        skipReason: null,
        lineOfficialAccount: {
          id: "oa-1",
          name: "OA 1",
          encryptedChannelAccessToken: "enc-tok-1",
          isActive: true,
          archivedAt: null,
        },
      },
    ],
  };

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      update: async () => mockCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [{ status: MassMessageStoreDeliveryStatus.SUCCESS }],
    },
    massMessageBatch: {
      findMany: async () => [],
      create: async (args: any) => ({ id: "batch-1", ...args.data }),
      update: async () => ({}),
    },
    $transaction: async (promises: any[]) => Promise.all(promises),
  } as any;

  const encryption = { decrypt: () => "token" } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      callCount++;
      retryKeysUsed.push(input.retryKey);
      if (callCount === 1) {
        // Transient error (500) on first attempt
        const err: any = new Error("LINE 503 Service Unavailable");
        err.status = 503;
        throw err;
      }
      return { requestId: "req-ok", acceptedRequestId: null, duplicateAccepted: false };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => ["U1", "U2"],
  } as any;

  const processor = new MassMessageProcessorService(
    prisma,
    encryption,
    lineMessaging,
    scopeService,
  );

  await processor.processCampaign("campaign-retry");

  assert.equal(callCount, 2);
  assert.equal(retryKeysUsed.length, 2);
  // CRITICAL INVARIANT: The retry attempt MUST reuse the exact same retryKey
  assert.equal(retryKeysUsed[0], retryKeysUsed[1]);
});

void test("processCampaign fails immediately on non-retryable 401 unauthorized without retrying", async () => {
  let callCount = 0;

  const mockCampaign = {
    id: "campaign-auth-err",
    status: MassMessageCampaignStatus.PENDING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Hello" }] },
    storeDeliveries: [
      {
        id: "del-auth",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        status: MassMessageStoreDeliveryStatus.PENDING,
        skipReason: null,
        lineOfficialAccount: {
          id: "oa-1",
          name: "OA 1",
          encryptedChannelAccessToken: "enc-tok-1",
          isActive: true,
          archivedAt: null,
        },
      },
    ],
  };

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      update: async () => mockCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [{ status: MassMessageStoreDeliveryStatus.FAILED }],
    },
    massMessageBatch: {
      findMany: async () => [],
      create: async (args: any) => ({ id: "batch-1", ...args.data }),
      update: async () => ({}),
    },
    $transaction: async (promises: any[]) => Promise.all(promises),
  } as any;

  const encryption = { decrypt: () => "token" } as any;

  const lineMessaging = {
    multicast: async () => {
      callCount++;
      const err: any = new Error("Invalid Channel Access Token");
      err.status = 401;
      throw err;
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => ["U1"],
  } as any;

  const processor = new MassMessageProcessorService(
    prisma,
    encryption,
    lineMessaging,
    scopeService,
  );

  await processor.processCampaign("campaign-auth-err");

  // Non-retryable 401 must fail on the 1st attempt and NOT retry
  assert.equal(callCount, 1);
});

void test("recoverUnfinishedCampaigns discovers PENDING/RUNNING campaigns and resumes them without re-sending SUCCESS batches", async () => {
  const sentBatches: any[] = [];

  const existingBatches = [
    {
      id: "batch-already-done",
      storeDeliveryId: "del-rec",
      batchIndex: 0,
      retryKey: "stable-retry-key-0",
      recipientCount: 500,
      status: MassMessageBatchStatus.SUCCESS,
      lineRequestId: "req-prior-success",
    },
    {
      id: "batch-interrupted",
      storeDeliveryId: "del-rec",
      batchIndex: 1,
      retryKey: "stable-retry-key-1",
      recipientCount: 15,
      status: MassMessageBatchStatus.PENDING,
      lineRequestId: null,
    },
  ];

  const mockRunningCampaign = {
    id: "campaign-running-crashed",
    status: MassMessageCampaignStatus.RUNNING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Resume Message" }] },
    storeDeliveries: [
      {
        id: "del-rec",
        storeId: "store-1",
        lineOfficialAccountId: "oa-1",
        status: MassMessageStoreDeliveryStatus.RUNNING,
        skipReason: null,
        lineOfficialAccount: {
          id: "oa-1",
          name: "OA 1",
          encryptedChannelAccessToken: "enc-tok-1",
          isActive: true,
          archivedAt: null,
        },
      },
    ],
  };

  const recipient515 = Array.from({ length: 515 }, (_, i) => `U_${i}`);

  const prisma = {
    massMessageCampaign: {
      findMany: async () => [{ id: "campaign-running-crashed" }],
      findUnique: async () => mockRunningCampaign,
      update: async () => mockRunningCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [
        {
          status: MassMessageStoreDeliveryStatus.SUCCESS,
          recipientCount: 515,
          processedCount: 515,
          successCount: 515,
          failedCount: 0,
        },
      ],
    },
    massMessageBatch: {
      findMany: async () => existingBatches,
      update: async (args: any) => args,
    },
  } as any;

  const encryption = { decrypt: () => "tok-resumed" } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      sentBatches.push(input);
      return { requestId: "resumed-req-id", acceptedRequestId: null, duplicateAccepted: false };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => recipient515,
  } as any;

  const processor = new MassMessageProcessorService(
    prisma,
    encryption,
    lineMessaging,
    scopeService,
  );

  const count = await processor.recoverUnfinishedCampaigns();
  assert.equal(count, 1);

  // Wait for async processing to finish
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Batch 0 was already SUCCESS -> MUST NOT BE RE-SENT!
  // Only Batch 1 (15 recipients) should be sent!
  assert.equal(sentBatches.length, 1);
  assert.equal(sentBatches[0].to.length, 15);
  // Must use the existing persisted retryKey from Batch 1
  assert.equal(sentBatches[0].retryKey, "stable-retry-key-1");
  assert.equal(sentBatches[0].accessToken, "tok-resumed");
});
