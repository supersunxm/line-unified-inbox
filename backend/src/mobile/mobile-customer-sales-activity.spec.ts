import assert from "node:assert/strict";
import test from "node:test";
import { MobileConversationsService } from "./mobile-conversations.service";

const user = {
  id: "user-1",
  email: "staff@example.com",
  displayName: "Staff",
  role: "VIEWER" as const,
  isActive: true,
};

void test("customer sales updates keep sales statuses in metadata instead of FollowUpStatus audit columns", async () => {
  const activityWrites: any[] = [];
  const tx = {
    conversation: {
      findUnique: async () => ({
        id: "conversation-1",
        customerSalesStatus: "INTERESTED",
        salesRecordedAt: new Date("2026-08-18T10:00:00.000Z"),
        interestLevel: "HOT",
        paymentMethod: null,
        sourceChannels: [],
        isInstallment: false,
        products: [],
        salesProducts: [],
      }),
      update: async () => ({}),
    },
    productModel: {
      findFirst: async () => ({ id: "model-1", name: "OPPO A Series" }),
    },
    productVariant: {
      findFirst: async () => ({ id: "variant-1", ram: "8GB", rom: "128GB", color: "Aurora Green" }),
    },
    conversationSalesProduct: {
      deleteMany: async () => ({}),
      createMany: async () => ({}),
    },
    conversationProduct: {
      deleteMany: async () => ({}),
      create: async () => ({}),
    },
    activityHistory: {
      create: async (args: any) => {
        activityWrites.push(args);
        assert.equal("previousStatus" in args.data, false);
        assert.equal("newStatus" in args.data, false);
        assert.equal(args.data.metadata.previousStatus, "INTERESTED");
        assert.equal(args.data.metadata.status, "PURCHASED");
        return {};
      },
    },
  };

  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const stores = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conversation-1" });

  const result = await service.updateCustomerSalesInfo(user, "conversation-1", {
    status: "PURCHASED",
    purchaseChannel: ["STORE"],
    paymentMethod: "INSTALLMENT",
    products: [
      {
        productModelId: "model-1",
        productVariantId: "variant-1",
        quantity: 1,
        status: "PURCHASED",
      },
    ],
  });

  assert.deepEqual(result, { id: "conversation-1" });
  assert.equal(activityWrites.length, 1);
  assert.equal(activityWrites[0]?.data.actionType, "PURCHASE_INFORMATION_UPDATED");
});

void test("customer sales info can be cleared back to an unclassified empty state", async () => {
  let conversationUpdate: Record<string, unknown> | undefined;
  let salesDeleteCount = 0;
  let manualDeleteCount = 0;

  const tx = {
    conversation: {
      findUnique: async () => ({
        id: "conversation-1",
        customerSalesStatus: "PURCHASED",
        salesRecordedAt: new Date("2026-08-19T02:00:00.000Z"),
        interestLevel: null,
        paymentMethod: "INSTALLMENT",
        sourceChannels: ["ONLINE"],
        isInstallment: true,
        products: [{ productModelId: "model-1", productVariantId: "variant-1" }],
        salesProducts: [
          {
            id: "sales-product-1",
            productModelId: "model-1",
            productVariantId: "variant-1",
            quantity: 1,
            status: "PURCHASED",
          },
        ],
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        conversationUpdate = args.data;
        return {};
      },
    },
    productModel: { findFirst: async () => null },
    productVariant: { findFirst: async () => null },
    conversationSalesProduct: {
      deleteMany: async () => {
        salesDeleteCount++;
        return {};
      },
      createMany: async () => ({}),
    },
    conversationProduct: {
      deleteMany: async () => {
        manualDeleteCount++;
        return {};
      },
      create: async () => ({}),
    },
    activityHistory: { create: async () => ({}) },
  };

  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const stores = { assertConversationAccess: async () => "store-1" };
  const service = new MobileConversationsService(prisma as never, stores as never, {} as never);
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conversation-1" });

  const result = await service.updateCustomerSalesInfo(user, "conversation-1", {
    status: null,
    interestLevel: null,
    purchaseChannel: [],
    paymentMethod: null,
    products: [],
  });

  assert.deepEqual(result, { id: "conversation-1" });
  assert.equal(conversationUpdate?.customerSalesStatus, null);
  assert.equal(conversationUpdate?.interestLevel, null);
  assert.deepEqual(conversationUpdate?.sourceChannels, []);
  assert.equal(conversationUpdate?.paymentMethod, null);
  assert.equal(conversationUpdate?.isInstallment, false);
  assert.equal(salesDeleteCount, 1);
  assert.equal(manualDeleteCount, 1);
});

void test("customer sales info persists Online and clears purchase-only fields", async () => {
  let conversationUpdate: Record<string, unknown> | undefined;
  const tx = {
    conversation: {
      findUnique: async () => ({
        id: "conversation-online",
        customerSalesStatus: "PURCHASED",
        salesRecordedAt: new Date("2026-08-19T02:00:00.000Z"),
        interestLevel: "HOT",
        paymentMethod: "INSTALLMENT",
        sourceChannels: ["STORE"],
        isInstallment: true,
        products: [],
        salesProducts: [],
      }),
      update: async (args: { data: Record<string, unknown> }) => {
        conversationUpdate = args.data;
        return {};
      },
    },
    activityHistory: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conversation-online" });

  await service.updateCustomerSalesInfo(user, "conversation-online", { status: "ONLINE" });

  assert.equal(conversationUpdate?.customerSalesStatus, "ONLINE");
  assert.equal(conversationUpdate?.interestLevel, null);
  assert.deepEqual(conversationUpdate?.sourceChannels, []);
  assert.equal(conversationUpdate?.paymentMethod, null);
  assert.equal(conversationUpdate?.isInstallment, false);
});

void test("updateCustomerSalesInfo calls nicknameQueue.enqueueSalesSync after transaction succeeds", async () => {
  let enqueuedConversationId: string | undefined;
  const tx = {
    conversation: {
      findUnique: async () => ({
        id: "conv-queue-test",
        customerSalesStatus: "ONLINE",
        salesRecordedAt: new Date("2026-08-31T10:00:00.000Z"),
        interestLevel: null,
        paymentMethod: null,
        sourceChannels: [],
        isInstallment: false,
        products: [],
        salesProducts: [],
      }),
      update: async () => ({}),
    },
    activityHistory: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const mockNicknameQueue = {
    enqueueSalesSync: async (id: string) => {
      enqueuedConversationId = id;
      return { enqueued: true, jobId: "job-1", nickname: "Online" };
    },
  };

  const service = new MobileConversationsService(
    prisma as never,
    { assertConversationAccess: async () => "store-1" } as never,
    {} as never,
    undefined as never,
    undefined,
    mockNicknameQueue as never,
  );
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conv-queue-test" });

  const result = await service.updateCustomerSalesInfo(user, "conv-queue-test", { status: "ONLINE" });

  assert.equal(result.id, "conv-queue-test");
  assert.equal(enqueuedConversationId, "conv-queue-test");
});

void test("updateCustomerSalesInfo succeeds even if nicknameQueue throws an unexpected error", async () => {
  const tx = {
    conversation: {
      findUnique: async () => ({
        id: "conv-queue-err-test",
        customerSalesStatus: "ONLINE",
        salesRecordedAt: new Date("2026-08-31T10:00:00.000Z"),
        interestLevel: null,
        paymentMethod: null,
        sourceChannels: [],
        isInstallment: false,
        products: [],
        salesProducts: [],
      }),
      update: async () => ({}),
    },
    activityHistory: { create: async () => ({}) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const mockFailingNicknameQueue = {
    enqueueSalesSync: async () => {
      throw new Error("Redis or queue fatal error");
    },
  };

  const service = new MobileConversationsService(
    prisma as never,
    { assertConversationAccess: async () => "store-1" } as never,
    {} as never,
    undefined as never,
    undefined,
    mockFailingNicknameQueue as never,
  );
  (service as unknown as { get: () => Promise<unknown> }).get = async () => ({ id: "conv-queue-err-test" });

  const result = await service.updateCustomerSalesInfo(user, "conv-queue-err-test", { status: "ONLINE" });

  assert.equal(result.id, "conv-queue-err-test");
});
