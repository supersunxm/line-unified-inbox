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
      updateMany: async () => ({ count: 1 }),
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
      updateMany: async () => ({ count: 1 }),
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
      updateMany: async () => ({ count: 1 }),
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
      updateMany: async () => ({ count: 1 }),
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

void test("Multi-instance safety: two concurrent worker instances processing the same campaign send exactly 1 multicast", async () => {
  const sentMulticasts: any[] = [];
  const batchesInDb = new Map<string, any>();

  const mockCampaign = {
    id: "campaign-multi-instance",
    status: MassMessageCampaignStatus.RUNNING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Hello Concurrent" }] },
    storeDeliveries: [
      {
        id: "del-multi",
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

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      update: async () => mockCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [
        {
          status: MassMessageStoreDeliveryStatus.SUCCESS,
          recipientCount: 3,
          processedCount: 3,
          successCount: 3,
          failedCount: 0,
        },
      ],
    },
    massMessageBatch: {
      findMany: async () => Array.from(new Set(batchesInDb.values())),
      findUnique: async ({ where }: any) => batchesInDb.get(where.id),
      create: async (args: any) => {
        const key = `${args.data.storeDeliveryId}-${args.data.batchIndex}`;
        if (batchesInDb.has(key)) {
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const record = { id: `batch-1`, ...args.data };
        batchesInDb.set(key, record);
        batchesInDb.set(record.id, record);
        return record;
      },
      updateMany: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (!batch) return { count: 0 };
        if (args.where.OR) {
          const matched = args.where.OR.some((clause: any) => {
            if (clause.status && clause.status !== batch.status) return false;
            if (clause.startedAt?.lt && batch.startedAt) {
              return batch.startedAt < clause.startedAt.lt;
            }
            if (clause.startedAt === null && batch.startedAt !== null) return false;
            return true;
          });
          if (matched) {
            Object.assign(batch, args.data);
            return { count: 1 };
          }
          return { count: 0 };
        }
        if (batch && (args.where.status === batch.status || args.where.status?.in?.includes(batch.status))) {
          batch.status = args.data.status;
          return { count: 1 };
        }
        return { count: 0 };
      },
      update: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (batch) Object.assign(batch, args.data);
        return batch;
      },
    },
    $transaction: async (promises: any[]) => Promise.all(promises),
  } as any;

  const encryption = { decrypt: () => "token-multi" } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      sentMulticasts.push(input);
      return { requestId: "req-multi", acceptedRequestId: null, duplicateAccepted: false };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => ["U1", "U2", "U3"],
  } as any;

  // Create two separate processor instances (simulating 2 backend replicas)
  const worker1 = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);
  const worker2 = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);

  // Both workers process the campaign concurrently
  await Promise.all([
    worker1.processCampaign("campaign-multi-instance"),
    worker2.processCampaign("campaign-multi-instance"),
  ]);

  // CRITICAL INVARIANT: Exactly 1 multicast call is executed across both workers!
  assert.equal(sentMulticasts.length, 1);
  assert.equal(sentMulticasts[0].to.length, 3);
});

void test("Crash Recovery: PENDING -> claimed RUNNING -> simulated hard crash -> stale RUNNING -> second processor reclaims it -> same retryKey reused -> exactly 1 logical LINE send", async () => {
  const sentMulticasts: any[] = [];
  const batchesInDb = new Map<string, any>();

  // Establish initial batch in RUNNING status with an expired lease (stale 10 minutes ago)
  const establishedBatch = {
    id: "batch-crashed-1",
    storeDeliveryId: "del-crash-1",
    batchIndex: 0,
    retryKey: "original-stable-retry-uuid-12345",
    recipientCount: 50,
    status: MassMessageBatchStatus.RUNNING,
    startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago (stale!)
    completedAt: null,
  };
  batchesInDb.set("del-crash-1-0", establishedBatch);
  batchesInDb.set("batch-crashed-1", establishedBatch);

  const mockCampaign = {
    id: "campaign-crash-recovery",
    status: MassMessageCampaignStatus.RUNNING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Resumed post crash" }] },
    storeDeliveries: [
      {
        id: "del-crash-1",
        storeId: "store-crash-1",
        lineOfficialAccountId: "oa-crash-1",
        status: MassMessageStoreDeliveryStatus.RUNNING,
        skipReason: null,
        lineOfficialAccount: {
          id: "oa-crash-1",
          name: "OA Crash Test",
          encryptedChannelAccessToken: "enc-tok-crash",
          isActive: true,
          archivedAt: null,
        },
      },
    ],
  };

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      findMany: async () => [{ id: "campaign-crash-recovery" }],
      update: async () => mockCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [
        {
          status: MassMessageStoreDeliveryStatus.SUCCESS,
          recipientCount: 50,
          processedCount: 50,
          successCount: 50,
          failedCount: 0,
        },
      ],
    },
    massMessageBatch: {
      findMany: async () => [establishedBatch],
      findUnique: async ({ where }: any) => batchesInDb.get(where.id),
      updateMany: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (!batch) return { count: 0 };
        if (args.where.OR) {
          const matched = args.where.OR.some((clause: any) => {
            if (clause.status && clause.status !== batch.status) return false;
            if (clause.startedAt?.lt && batch.startedAt) {
              return batch.startedAt < clause.startedAt.lt;
            }
            if (clause.startedAt === null && batch.startedAt !== null) return false;
            return true;
          });
          if (matched) {
            Object.assign(batch, args.data);
            return { count: 1 };
          }
          return { count: 0 };
        }
        return { count: 0 };
      },
      update: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (batch) Object.assign(batch, args.data);
        return batch;
      },
    },
  } as any;

  const encryption = { decrypt: () => "tok-crash-recovery" } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      sentMulticasts.push(input);
      return {
        requestId: "line-req-resumed",
        acceptedRequestId: null,
        duplicateAccepted: false,
      };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => Array.from({ length: 50 }, (_, i) => `U_${i}`),
  } as any;

  // New worker starting up after previous worker crash
  const worker2 = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);
  // Default lease timeout is 5 mins; batch was started 10 mins ago -> stale & reclaimable!
  worker2.batchClaimTimeoutMs = 5 * 60 * 1000;

  await worker2.processCampaign("campaign-crash-recovery");

  // Verify:
  // 1. Batch was reclaimed and successfully processed
  assert.equal(establishedBatch.status, MassMessageBatchStatus.SUCCESS);
  // 2. Exactly 1 multicast call was executed
  assert.equal(sentMulticasts.length, 1);
  assert.equal(sentMulticasts[0].to.length, 50);
  // 3. The SAME persisted retryKey was reused!
  assert.equal(sentMulticasts[0].retryKey, "original-stable-retry-uuid-12345");
  assert.equal(sentMulticasts[0].accessToken, "tok-crash-recovery");
});

void test("Lease safety: fresh RUNNING batches are NOT stolen by another processor and SUCCESS batches are never reclaimed", async () => {
  const sentMulticasts: any[] = [];
  const batchesInDb = new Map<string, any>();

  // Batch 0 is already SUCCESS
  const successBatch = {
    id: "batch-success-0",
    storeDeliveryId: "del-lease-1",
    batchIndex: 0,
    retryKey: "retry-key-success-0",
    recipientCount: 50,
    status: MassMessageBatchStatus.SUCCESS,
    startedAt: new Date(Date.now() - 30 * 1000),
    completedAt: new Date(Date.now() - 28 * 1000),
  };

  // Batch 1 is fresh RUNNING (claimed only 5 seconds ago by Worker 1)
  const freshRunningBatch = {
    id: "batch-running-1",
    storeDeliveryId: "del-lease-1",
    batchIndex: 1,
    retryKey: "retry-key-running-1",
    recipientCount: 50,
    status: MassMessageBatchStatus.RUNNING,
    startedAt: new Date(Date.now() - 5 * 1000), // Fresh (5 seconds ago)!
    completedAt: null,
  };

  batchesInDb.set("batch-success-0", successBatch);
  batchesInDb.set("batch-running-1", freshRunningBatch);

  const mockCampaign = {
    id: "campaign-lease-safety",
    status: MassMessageCampaignStatus.RUNNING,
    audienceType: "ALL_KNOWN",
    messagePayload: { messages: [{ type: "text", text: "Lease test" }] },
    storeDeliveries: [
      {
        id: "del-lease-1",
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

  const prisma = {
    massMessageCampaign: {
      findUnique: async () => mockCampaign,
      update: async () => mockCampaign,
    },
    massMessageStoreDelivery: {
      update: async () => ({}),
      findMany: async () => [
        {
          status: MassMessageStoreDeliveryStatus.RUNNING,
          recipientCount: 100,
          processedCount: 50,
          successCount: 50,
          failedCount: 0,
        },
      ],
    },
    massMessageBatch: {
      findMany: async () => [successBatch, freshRunningBatch],
      findUnique: async ({ where }: any) => batchesInDb.get(where.id),
      updateMany: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (!batch) return { count: 0 };
        if (args.where.OR) {
          const matched = args.where.OR.some((clause: any) => {
            if (clause.status && clause.status !== batch.status) return false;
            if (clause.startedAt?.lt && batch.startedAt) {
              return batch.startedAt < clause.startedAt.lt;
            }
            if (clause.startedAt === null && batch.startedAt !== null) return false;
            return true;
          });
          if (matched) {
            Object.assign(batch, args.data);
            return { count: 1 };
          }
          return { count: 0 };
        }
        return { count: 0 };
      },
      update: async (args: any) => {
        const batch = batchesInDb.get(args.where.id);
        if (batch) Object.assign(batch, args.data);
        return batch;
      },
    },
  } as any;

  const encryption = { decrypt: () => "tok-lease" } as any;

  const lineMessaging = {
    multicast: async (input: any) => {
      sentMulticasts.push(input);
      return { requestId: "req-id", acceptedRequestId: null, duplicateAccepted: false };
    },
  } as any;

  const scopeService = {
    resolveRecipientsForOa: async () => Array.from({ length: 100 }, (_, i) => `U_${i}`),
  } as any;

  // Worker 2 attempts to process the campaign
  const worker2 = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);
  worker2.batchClaimTimeoutMs = 5 * 60 * 1000; // 5 min timeout

  await worker2.processCampaign("campaign-lease-safety");

  // Worker 2 must NOT steal the fresh RUNNING batch or re-execute the SUCCESS batch:
  assert.equal(sentMulticasts.length, 0, "Worker 2 must send 0 multicasts (no batches stolen or duplicated)");
  assert.equal(successBatch.status, MassMessageBatchStatus.SUCCESS, "SUCCESS batch status remains unchanged");
  assert.equal(freshRunningBatch.status, MassMessageBatchStatus.RUNNING, "Fresh RUNNING batch remains owned by Worker 1");
});

void test("processCampaign non-retryable errors (LINE 400 and LINE 403) fail on attempt 1 without retrying", async () => {
  const { LineMessagingApiError } = await import("../line-messaging/line-messaging.service");

  for (const status of [400, 403]) {
    let callCount = 0;
    const mockCampaign = {
      id: `campaign-err-${status}`,
      status: MassMessageCampaignStatus.PENDING,
      audienceType: "ALL_KNOWN",
      messagePayload: { messages: [{ type: "text", text: "Hello" }] },
      storeDeliveries: [
        {
          id: `del-${status}`,
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
        create: async (args: any) => ({ id: `batch-${status}`, ...args.data }),
        updateMany: async () => ({ count: 1 }),
        update: async () => ({}),
      },
      $transaction: async (promises: any[]) => Promise.all(promises),
    } as any;

    const encryption = { decrypt: () => "token" } as any;
    const lineMessaging = {
      multicast: async () => {
        callCount++;
        throw new LineMessagingApiError({
          lineStatus: status,
          lineRequestId: `req-${status}`,
          lineErrorMessage: `Error ${status}`,
          userMessage: `Error ${status}`,
        });
      },
    } as any;

    const scopeService = {
      resolveRecipientsForOa: async () => ["U1"],
    } as any;

    const processor = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);
    await processor.processCampaign(`campaign-err-${status}`);

    assert.equal(callCount, 1, `Status ${status} must fail on attempt 1 without retrying`);
  }
});

void test("processCampaign retryable errors (LINE 429, 500, network error) perform retries", async () => {
  const { LineMessagingApiError } = await import("../line-messaging/line-messaging.service");

  for (const status of [429, 500, 0]) {
    let callCount = 0;
    const mockCampaign = {
      id: `campaign-retry-${status}`,
      status: MassMessageCampaignStatus.PENDING,
      audienceType: "ALL_KNOWN",
      messagePayload: { messages: [{ type: "text", text: "Hello" }] },
      storeDeliveries: [
        {
          id: `del-retry-${status}`,
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
        create: async (args: any) => ({ id: `batch-retry-${status}`, ...args.data }),
        updateMany: async () => ({ count: 1 }),
        update: async () => ({}),
      },
      $transaction: async (promises: any[]) => Promise.all(promises),
    } as any;

    const encryption = { decrypt: () => "token" } as any;
    const lineMessaging = {
      multicast: async () => {
        callCount++;
        if (callCount === 1) {
          throw new LineMessagingApiError({
            lineStatus: status,
            lineRequestId: `req-${status}`,
            lineErrorMessage: `Transient ${status}`,
            userMessage: `Transient ${status}`,
          });
        }
        return { requestId: "req-ok", acceptedRequestId: null, duplicateAccepted: false };
      },
    } as any;

    const scopeService = {
      resolveRecipientsForOa: async () => ["U1"],
    } as any;

    const processor = new MassMessageProcessorService(prisma, encryption, lineMessaging, scopeService);
    await processor.processCampaign(`campaign-retry-${status}`);

    assert.equal(callCount, 2, `Status ${status} must retry and succeed on attempt 2`);
  }
});

