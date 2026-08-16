import assert from "node:assert/strict";
import test from "node:test";
import { MobileConversationsService } from "./mobile-conversations.service";

void test("first provenance save is audited even when legacy values are unchanged", async () => {
  const activities: any[] = [];
  const legacy = { id: "conversation-1", sourceChannels: ["ONLINE"], isInstallment: true, purchaseRecordedById: null, purchaseRecordedAt: null, products: [{ productModelId: "model-1", productVariantId: "variant-1" }] };
  const tx = {
    conversation: {
      findUnique: async () => legacy,
      update: async () => ({}),
    },
    productModel: { findFirst: async () => ({ id: "model-1" }) },
    productVariant: { findFirst: async () => ({ id: "variant-1", productModelId: "model-1" }) },
    conversationProduct: { deleteMany: async () => ({}), create: async () => ({}), findFirst: async () => ({ productModelId: "model-1" }), update: async () => ({}) },
    activityHistory: { create: async (args: any) => { activities.push(args); return {}; } },
  };
  const detail = {
    id: "conversation-1", latestMessageAt: new Date(), bmReplyStatus: "REPLIED", followUpStatus: "FOLLOW_UP",
    sourceChannels: ["ONLINE"], isInstallment: true, purchaseRecordedBy: { id: "user-1", displayName: "Staff" }, purchaseRecordedAt: new Date(),
    customer: { id: "customer-1", displayName: "Customer" }, store: { id: "store-1", name: "Store", code: "S1" },
    products: [{ source: "MANUAL", productModel: { id: "model-1", name: "OPPO Find N6", productSeries: { name: "Find", productGroup: "SMARTPHONE" } }, productVariant: { id: "variant-1", ram: "16", rom: "512", color: "Titanium" } }],
    topics: [], messages: [], _count: { pushNotifications: 0 },
  };
  const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx), conversation: { findUnique: async () => detail } };
  const service = new MobileConversationsService(prisma as never, { assertConversationAccess: async () => "store-1" } as never, {} as never);

  await service.updatePurchaseInformation({ id: "user-1", email: "staff@example.com", displayName: "Staff", role: "VIEWER", isActive: true }, "conversation-1", {
    purchaseChannel: ["ONLINE"], paymentMethod: "INSTALLMENT", productModelId: "model-1", productVariantId: "variant-1",
  });

  assert.equal(activities.length, 1);
  assert.equal(activities[0].data.actionType, "PURCHASE_INFORMATION_UPDATED");
});
