import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  MassMessageAudienceType,
  MassMessageCampaignStatus,
  UserRole,
} from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import {
  CreatePurchaseBroadcastDraftDto,
  PurchaseAudienceStatus,
} from "./purchase-broadcast-audience.dto";
import { PurchaseBroadcastAudienceService } from "./purchase-broadcast-audience.service";

const admin: AuthUser = {
  id: "admin-1",
  email: "admin@example.com",
  displayName: "Admin",
  role: UserRole.ADMIN,
  isActive: true,
};

const viewer: AuthUser = {
  ...admin,
  id: "viewer-1",
  role: UserRole.VIEWER,
};

const baseInput: CreatePurchaseBroadcastDraftDto = {
  campaignRequestId: "a0000000-0000-4000-8000-000000000001",
  statuses: [PurchaseAudienceStatus.PURCHASED],
  onlyMessageable: true,
};

const audience = {
  filters: { from: null, to: null, storeId: null },
  summary: { customers: 3, messageableCustomers: 2, excludedCustomers: 1 },
  messageabilityDefinition: "LINE_USER_ID_AND_ACTIVE_READY_OA",
  audience: [
    {
      customerId: "customer-1",
      customerName: "Customer One",
      lineUserId: "U1",
      preferredLanguage: "th",
      conversationId: "conversation-1",
      lineOaId: "oa-1",
      lineOaName: "OA One",
      lineOaBasicId: "@one",
      storeId: "store-1",
      storeName: "Store One",
      storeCode: "S1",
      customerStatus: "PURCHASED",
      purchaseChannels: ["STORE"],
      paymentMethods: ["CASH"],
      products: [],
      recordedById: "bm-1",
      recordedByName: "BM One",
      lastPurchaseAt: "2026-08-18T00:00:00.000Z",
      lastMessageAt: "2026-08-18T01:00:00.000Z",
      canMessage: true,
      excludeReason: null,
    },
    {
      customerId: "customer-2",
      customerName: "Customer Two",
      lineUserId: "U2",
      preferredLanguage: "en",
      conversationId: "conversation-2",
      lineOaId: "oa-2",
      lineOaName: "OA Two",
      lineOaBasicId: "@two",
      storeId: "store-2",
      storeName: "Store Two",
      storeCode: "S2",
      customerStatus: "INTERESTED",
      purchaseChannels: [],
      paymentMethods: [],
      products: [],
      recordedById: null,
      recordedByName: null,
      lastPurchaseAt: "2026-08-17T00:00:00.000Z",
      lastMessageAt: "2026-08-17T01:00:00.000Z",
      canMessage: true,
      excludeReason: null,
    },
    {
      customerId: "customer-3",
      customerName: "Customer Three",
      lineUserId: null,
      preferredLanguage: null,
      conversationId: "conversation-3",
      lineOaId: "oa-1",
      lineOaName: "OA One",
      lineOaBasicId: "@one",
      storeId: "store-1",
      storeName: "Store One",
      storeCode: "S1",
      customerStatus: "PURCHASED",
      purchaseChannels: ["ONLINE"],
      paymentMethods: ["INSTALLMENT"],
      products: [],
      recordedById: "bm-1",
      recordedByName: "BM One",
      lastPurchaseAt: "2026-08-16T00:00:00.000Z",
      lastMessageAt: "2026-08-16T01:00:00.000Z",
      canMessage: false,
      excludeReason: "MISSING_LINE_USER_ID",
    },
  ],
};

function makeService(existing: unknown = null) {
  let createdData: Record<string, unknown> | null = null;
  let audienceCalls = 0;
  const prisma = {
    massMessageCampaign: {
      findUnique: async () => existing,
      create: async (args: { data: Record<string, unknown> }) => {
        createdData = args.data;
        return {
          id: "draft-1",
          campaignRequestId: String(args.data.campaignRequestId),
          title: String(args.data.title),
          status: MassMessageCampaignStatus.DRAFT,
          createdAt: new Date("2026-08-19T07:00:00.000Z"),
        };
      },
    },
  };
  const analytics = {
    getAudience: async () => {
      audienceCalls += 1;
      return audience;
    },
  };
  return {
    service: new PurchaseBroadcastAudienceService(prisma as never, analytics as never),
    createdData: () => createdData,
    audienceCalls: () => audienceCalls,
  };
}

test("creates a DRAFT selected-user snapshot without LINE identifiers", async () => {
  const fake = makeService();
  const result = await fake.service.createDraft(baseInput, admin);

  assert.equal(result.status, "DRAFT");
  assert.equal(result.recipientCount, 1);
  assert.equal(result.storeCount, 1);
  assert.equal(result.lineOaCount, 1);
  assert.equal(result.duplicate, false);

  const data = fake.createdData();
  assert.equal(data?.status, MassMessageCampaignStatus.DRAFT);
  assert.equal(data?.audienceType, MassMessageAudienceType.SELECTED_USERS);
  assert.equal(data?.estimatedRecipientCount, 1);

  const serialized = JSON.stringify(data?.messagePayload);
  assert.match(serialized, /customer-1/);
  assert.match(serialized, /conversation-1/);
  assert.doesNotMatch(serialized, /Customer One/);
  assert.doesNotMatch(serialized, /"U1"/);
});

test("status selection excludes other messageable customer states", async () => {
  const fake = makeService();
  const result = await fake.service.createDraft(
    {
      ...baseInput,
      statuses: [PurchaseAudienceStatus.INTERESTED],
    },
    admin,
  );
  assert.equal(result.recipientCount, 1);
  assert.match(JSON.stringify(fake.createdData()?.messagePayload), /customer-2/);
  assert.doesNotMatch(JSON.stringify(fake.createdData()?.messagePayload), /customer-1/);
});

test("draft creation fails closed when messageable-only is disabled", async () => {
  const fake = makeService();
  await assert.rejects(
    () => fake.service.createDraft({ ...baseInput, onlyMessageable: false }, admin),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(fake.audienceCalls(), 0);
  assert.equal(fake.createdData(), null);
});

test("non-admin users cannot create broadcast audience drafts", async () => {
  const fake = makeService();
  await assert.rejects(
    () => fake.service.createDraft(baseInput, viewer),
    (error: unknown) => error instanceof ForbiddenException,
  );
  assert.equal(fake.audienceCalls(), 0);
});

test("same purchase draft request is idempotent and does not rebuild audience", async () => {
  const existing = {
    id: "draft-existing",
    campaignRequestId: baseInput.campaignRequestId,
    title: "Existing draft",
    status: MassMessageCampaignStatus.DRAFT,
    audienceType: MassMessageAudienceType.SELECTED_USERS,
    storeCount: 1,
    estimatedRecipientCount: 1,
    messagePayload: {
      messages: [],
      audienceSource: {
        type: "PURCHASE_INTELLIGENCE",
        recipientRefs: [
          {
            customerId: "customer-1",
            conversationId: "conversation-1",
            storeId: "store-1",
            lineOfficialAccountId: "oa-1",
          },
        ],
      },
    },
    createdAt: new Date("2026-08-19T06:00:00.000Z"),
  };
  const fake = makeService(existing);
  const result = await fake.service.createDraft(baseInput, admin);
  assert.equal(result.id, "draft-existing");
  assert.equal(result.duplicate, true);
  assert.equal(fake.audienceCalls(), 0);
  assert.equal(fake.createdData(), null);
});

test("empty selected messageable audience is rejected", async () => {
  const fake = makeService();
  await assert.rejects(
    () =>
      fake.service.createDraft(
        {
          ...baseInput,
          statuses: [PurchaseAudienceStatus.NOT_SPECIFIED],
        },
        admin,
      ),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(fake.createdData(), null);
});
