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
