import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageCampaignStatus,
  UserRole,
} from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { PurchaseBroadcastAudienceService } from "./purchase-broadcast-audience.service";

const admin: AuthUser = {
  id: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  role: UserRole.ADMIN,
  isActive: true,
};

const audienceSource = {
  type: "PURCHASE_INTELLIGENCE",
  version: 1,
  filters: { from: "2026-08-01", to: "2026-08-19", storeId: null },
  statuses: ["PURCHASED"],
  onlyMessageable: true,
  messageabilityDefinition: "LINE_USER_ID_AND_ACTIVE_READY_OA",
  recipientRefs: [
    {
      customerId: "secret-customer-1",
      conversationId: "secret-conversation-1",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
    },
    {
      customerId: "secret-customer-2",
      conversationId: "secret-conversation-2",
      storeId: "store-1",
      lineOfficialAccountId: "oa-1",
    },
    {
      customerId: "secret-customer-3",
      conversationId: "secret-conversation-3",
      storeId: "store-2",
      lineOfficialAccountId: "oa-2",
    },
  ],
};

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft-1",
    campaignRequestId: "a0000000-0000-4000-8000-000000000001",
    title: "Purchase audience",
    status: MassMessageCampaignStatus.DRAFT,
    audienceType: MassMessageAudienceType.SELECTED_USERS,
    messagePayload: { messages: [], audienceSource },
    createdAt: new Date("2026-08-19T07:00:00.000Z"),
    updatedAt: new Date("2026-08-19T07:05:00.000Z"),
    ...overrides,
  };
}

function makeService(options?: { deliveryCount?: number; campaignOverride?: Record<string, unknown> }) {
  let updatedData: Record<string, unknown> | null = null;
  let deliveryCreateCalls = 0;
  const current = campaign(options?.campaignOverride);
  const prisma = {
    massMessageCampaign: {
      findUnique: async () => current,
      update: async (args: { data: Record<string, unknown> }) => {
        updatedData = args.data;
        Object.assign(current, args.data, { updatedAt: new Date("2026-08-19T08:00:00.000Z") });
        return current;
      },
    },
    massMessageStoreDelivery: {
      count: async () => options?.deliveryCount ?? 0,
      create: async () => {
        deliveryCreateCalls += 1;
      },
    },
    store: {
      findMany: async () => [
        { id: "store-1", name: "Store One", code: "S1", storeMaster: { externalStoreId: "001" } },
        { id: "store-2", name: "Store Two", code: "S2", storeMaster: { externalStoreId: "002" } },
      ],
    },
    lineOfficialAccount: {
      findMany: async () => [
        { id: "oa-1", name: "OA One" },
        { id: "oa-2", name: "OA Two" },
      ],
    },
  };

  return {
    service: new PurchaseBroadcastAudienceService(prisma as never, {} as never),
    updatedData: () => updatedData,
    deliveryCreateCalls: () => deliveryCreateCalls,
  };
}

test("composer returns aggregate audience breakdown without customer recipient references", async () => {
  const fake = makeService();
  const result = await fake.service.getComposer("draft-1", admin);

  assert.equal(result.status, "DRAFT");
  assert.equal(result.audienceType, "SELECTED_USERS");
  assert.equal(result.audience.recipientCount, 3);
  assert.equal(result.audience.storeCount, 2);
  assert.equal(result.audience.lineOaCount, 2);
  assert.deepEqual(
    result.audience.stores.map((row) => [row.storeName, row.recipientCount]),
    [["Store One", 2], ["Store Two", 1]],
  );

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /secret-customer/);
  assert.doesNotMatch(serialized, /secret-conversation/);
  assert.doesNotMatch(serialized, /recipientRefs/);
});

test("saving composer content preserves the exact audience snapshot and remains DRAFT", async () => {
  const fake = makeService();
  const result = await fake.service.updateComposer(
    "draft-1",
    {
      title: "Reno upgrade",
      messages: [
        { type: "text", text: "  Special offer for you  " },
        {
          type: "image",
          originalContentUrl: "https://lineoppo.click/media/original.jpg",
          previewImageUrl: "https://lineoppo.click/media/preview.jpg",
        },
      ],
    },
    admin,
  );

  assert.equal(result.status, "DRAFT");
  assert.equal(result.title, "Reno upgrade");
  assert.deepEqual(result.messages[0], { type: "text", text: "Special offer for you" });
  assert.equal(fake.deliveryCreateCalls(), 0);

  const update = fake.updatedData();
  assert.equal(update?.title, "Reno upgrade");
  assert.equal("status" in (update ?? {}), false);
  const payload = update?.messagePayload as { audienceSource?: unknown } | undefined;
  assert.deepEqual(payload?.audienceSource, audienceSource);
});

test("composer editing fails closed when delivery records already exist", async () => {
  const fake = makeService({ deliveryCount: 1 });
  await assert.rejects(
    () => fake.service.updateComposer("draft-1", { messages: [] }, admin),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.equal(fake.updatedData(), null);
});

test("composer rejects campaigns outside DRAFT SELECTED_USERS boundary", async () => {
  const fake = makeService({
    campaignOverride: { status: MassMessageCampaignStatus.PENDING },
  });
  await assert.rejects(
    () => fake.service.getComposer("draft-1", admin),
    (error: unknown) => error instanceof ConflictException,
  );
});
