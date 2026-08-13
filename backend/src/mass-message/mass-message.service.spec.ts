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

  // More than 2 messages (V1.1 limit: 1 text + 1 image)
  const threeMessages = Array.from({ length: 3 }, () => ({ type: "text", text: "msg" }));
  await assert.rejects(
    () =>
      service.createAndSend(
        {
          campaignRequestId: "a0000000-0000-4000-8000-000000000004",
          storeSelection: { mode: MassMessageStoreMode.ALL },
          messages: threeMessages,
        },
        adminUser,
      ),
    /Mass Message allows at most 2 message objects/,
  );
});

void test("uploadImage validates file size, magic bytes, and stores to media storage", async () => {
  let storedKey = "";
  let storedContentType = "";
  const mediaStorage = {
    put: async (key: string, body: Buffer, mime: string) => {
      storedKey = key;
      storedContentType = mime;
      return { provider: "s3", fileId: key, mimeType: mime, size: body.length };
    },
  } as any;

  const service = new MassMessageService({} as any, {} as any, {} as any, mediaStorage);

  // 1. Valid JPEG
  const jpegBuffer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const jpegResult = await service.uploadImage({ buffer: jpegBuffer, mimetype: "image/jpeg" }, adminUser);
  assert.equal(jpegResult.mimeType, "image/jpeg");
  assert.equal(jpegResult.fileSize, jpegBuffer.length);
  assert.match(jpegResult.url, /^https?:\/\//);
  assert.match(storedKey, /^line-media\/outbound\/mass-message\/.*\.jpg$/);

  // 2. Valid PNG
  const pngBuffer = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(100)]);
  const pngResult = await service.uploadImage({ buffer: pngBuffer, mimetype: "image/png" }, adminUser);
  assert.equal(pngResult.mimeType, "image/png");
  assert.match(storedKey, /^line-media\/outbound\/mass-message\/.*\.png$/);

  // 3. Valid WebP
  const webpBuffer = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP"),
    Buffer.alloc(20),
  ]);
  const webpResult = await service.uploadImage({ buffer: webpBuffer, mimetype: "image/webp" }, adminUser);
  assert.equal(webpResult.mimeType, "image/webp");
  assert.match(storedKey, /^line-media\/outbound\/mass-message\/.*\.webp$/);

  // 4. Oversized image (>10MB)
  const oversizedBuffer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(11 * 1024 * 1024)]);
  await assert.rejects(
    () => service.uploadImage({ buffer: oversizedBuffer, mimetype: "image/jpeg" }, adminUser),
    /Image exceeds the 10 MB limit/,
  );

  // 5. Unsupported file type (PDF)
  const pdfBuffer = Buffer.from("%PDF-1.7 header");
  await assert.rejects(
    () => service.uploadImage({ buffer: pdfBuffer, mimetype: "application/pdf" }, adminUser),
    /Unsupported image format/,
  );

  // 6. Mismatched declared MIME vs content
  await assert.rejects(
    () => service.uploadImage({ buffer: pngBuffer, mimetype: "image/jpeg" }, adminUser),
    /Image content does not match its declared MIME type/,
  );
});

void test("validateMessages enforces text-only, image-only, text+image combinations", () => {
  const service = new MassMessageService({} as any, {} as any, {} as any);

  // Text only -> valid
  const textOnly = service.validateMessages([{ type: "text", text: "Hello customer" }]);
  assert.deepEqual(textOnly, [{ type: "text", text: "Hello customer" }]);

  // Image only -> valid
  const imageOnly = service.validateMessages([
    {
      type: "image",
      originalContentUrl: "https://example.com/img.jpg",
      previewImageUrl: "https://example.com/preview.jpg",
    },
  ]);
  assert.deepEqual(imageOnly, [
    {
      type: "image",
      originalContentUrl: "https://example.com/img.jpg",
      previewImageUrl: "https://example.com/preview.jpg",
    },
  ]);

  // Text + Image -> valid
  const textAndImage = service.validateMessages([
    { type: "text", text: "Promo banner" },
    {
      type: "image",
      originalContentUrl: "https://example.com/promo.png",
      previewImageUrl: "https://example.com/promo.png",
    },
  ]);
  assert.equal(textAndImage.length, 2);

  // Multiple texts (>1) -> rejected
  assert.throws(
    () =>
      service.validateMessages([
        { type: "text", text: "First" },
        { type: "text", text: "Second" },
      ]),
    /Mass Message allows at most 1 text message/,
  );

  // Multiple images (>1) -> rejected
  assert.throws(
    () =>
      service.validateMessages([
        {
          type: "image",
          originalContentUrl: "https://example.com/1.jpg",
          previewImageUrl: "https://example.com/1.jpg",
        },
        {
          type: "image",
          originalContentUrl: "https://example.com/2.jpg",
          previewImageUrl: "https://example.com/2.jpg",
        },
      ]),
    /Mass Message allows at most 1 image message/,
  );

  // Non-HTTPS image URL -> rejected
  assert.throws(
    () =>
      service.validateMessages([
        {
          type: "image",
          originalContentUrl: "http://insecure.com/1.jpg",
          previewImageUrl: "https://insecure.com/1.jpg",
        },
      ]),
    /Image originalContentUrl must be a valid HTTPS URL/,
  );

  // Empty text -> rejected
  assert.throws(
    () => service.validateMessages([{ type: "text", text: "   " }]),
    /Text message content cannot be empty/,
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

