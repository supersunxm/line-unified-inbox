import assert from "node:assert/strict";
import test from "node:test";
import { ClassificationService } from "../../classification/classification.service";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { LineProfileService } from "../../line-profile.service";
import { PrismaService } from "../../prisma.service";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineWebhookService } from "./line-webhook.service";
import { LineImageService } from "../../media/line-image.service";
import { Prisma } from "@prisma/client";
import { NotificationEnqueueService } from "../../notifications/notification-enqueue.service";

void test("inbound customer messages enqueue notifications only after the message is persisted", async () => {
  const sequence: string[] = [];
  const transactionClient = {
    conversation: { create: () => Promise.resolve({ id: "conversation-1", storeId: "store-1", followUpStatus: "FOLLOW_UP" }) },
    message: { create: () => { sequence.push("message"); return Promise.resolve({ id: "message-1" }); } },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1", name: "OPPO CentralWorld" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "customer-1", displayName: "LINE Customer" }) },
    conversation: { findFirst: () => Promise.resolve(null) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;
  const notifications = { enqueueInboundMessage: async (_tx: unknown, input: { storeId: string; storeName?: string; conversationId: string; messageId: string; customerName: string; messageType: string; preview: string; sentAt: string }) => { sequence.push("notification"); assert.deepEqual(input, { storeId: "store-1", storeName: "OPPO CentralWorld", conversationId: "conversation-1", messageId: "message-1", customerName: "LINE Customer", messageType: "TEXT", preview: "hello", sentAt: input.sentAt }); assert.match(input.sentAt, /^\d{4}-\d{2}-\d{2}T/); } } as unknown as NotificationEnqueueService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, { analyze: () => Promise.resolve({}) } as ClassificationService, { refresh: () => Promise.resolve({}) } as unknown as LineProfileService, {} as LineImageService, notifications);
  await service.accept({ events: [{ type: "message", webhookEventId: "event-notify", timestamp: Date.now(), source: { type: "user", userId: "line-user-1" }, message: { type: "text", id: "line-message-1", text: "hello" } }] }, "oa-1");
  assert.deepEqual(sequence, ["message", "notification"]);
});

void test("profile fetch rejection cannot block inbound customer text storage", async () => {
  let storedText: string | undefined;
  let profileAttempted = false;
  const transactionClient = {
    conversation: { create: () => Promise.resolve({ id: "conversation-1", followUpStatus: "FOLLOW_UP" }) },
    message: { create: ({ data }: { data: { originalText: string } }) => { storedText = data.originalText; return Promise.resolve({}); } },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: {
      findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1" } }),
      update: () => Promise.resolve({}),
    },
    customer: { upsert: () => Promise.resolve({ id: "customer-1" }) },
    conversation: { findFirst: () => Promise.resolve(null) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;
  const classification = { analyze: () => Promise.resolve({}) } as unknown as ClassificationService;
  const profiles = { refresh: () => { profileAttempted = true; return Promise.reject(new Error("simulated LINE profile failure")); } } as unknown as LineProfileService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, classification, profiles, {} as LineImageService);

  const result = await service.accept({ events: [{ type: "message", webhookEventId: "event-1", timestamp: Date.now(), source: { type: "user", userId: "line-user-1" }, message: { type: "text", id: "message-1", text: "สนใจ Reno16" } }] }, "oa-1");

  assert.deepEqual(result, { success: true });
  assert.equal(storedText, "สนใจ Reno16");
  assert.equal(profileAttempted, true);
});

void test("image webhook creates pending media and invokes image processing without failing acknowledgement", async () => {
  let mediaData: { messageId: string; providerMessageId: string; mediaType: string } | undefined;
  let processed: string[] | undefined;
  let imageProcessCount = 0;
  let eventCreates = 0;
  const transactionClient = {
    conversation: { create: () => Promise.resolve({ id: "conversation-1", followUpStatus: "FOLLOW_UP" }) },
    message: { create: () => Promise.resolve({ id: "stored-message-1" }) },
    messageMedia: { create: ({ data }: { data: typeof mediaData }) => { mediaData = data; return Promise.resolve({ id: "media-1" }); } },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    webhookEvent: { create: () => { eventCreates += 1; return eventCreates === 1 ? Promise.resolve({}) : Promise.reject(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "6.19.3" })); }, update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "customer-1" }) },
    conversation: { findFirst: () => Promise.resolve(null) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;
  const images = { process: (mediaId: string, oaId: string, messageId: string) => { imageProcessCount += 1; processed = [mediaId, oaId, messageId]; return Promise.resolve(); } } as unknown as LineImageService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, {} as ClassificationService, { refresh: () => Promise.resolve({}) } as unknown as LineProfileService, images);
  const result = await service.accept({ events: [{ type: "message", webhookEventId: "event-image", timestamp: Date.now(), source: { type: "user", userId: "line-user-1" }, message: { type: "image", id: "line-image-1" } }] }, "oa-1");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(mediaData, { messageId: "stored-message-1", providerMessageId: "line-image-1", mediaType: "IMAGE" });
  assert.deepEqual(processed, ["media-1", "oa-1", "line-image-1"]);
  assert.deepEqual(await service.accept({ events: [{ type: "message", webhookEventId: "event-image", timestamp: Date.now(), source: { type: "user", userId: "line-user-1" }, message: { type: "image", id: "line-image-1" } }] }, "oa-1"), { success: true });
  assert.equal(eventCreates, 2);
  assert.equal(imageProcessCount, 1);
  assert.deepEqual(processed, ["media-1", "oa-1", "line-image-1"]);
});

void test("video webhook creates pending video media and invokes the backend processor", async () => {
  let mediaData: { messageId: string; providerMessageId: string; mediaType: string } | undefined;
  let processedType: string | undefined;
  const transactionClient = {
    conversation: { create: () => Promise.resolve({ id: "conversation-video", followUpStatus: "FOLLOW_UP" }) },
    message: { create: () => Promise.resolve({ id: "stored-video-message" }) },
    messageMedia: { create: ({ data }: { data: typeof mediaData }) => { mediaData = data; return Promise.resolve({ id: "video-media-1" }); } },
    activityHistory: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-video", storeId: "store-video", store: { id: "store-video" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "customer-video", displayName: "Video Customer" }) },
    conversation: { findFirst: () => Promise.resolve(null) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;
  const media = { process: (_mediaId: string, _oaId: string, _messageId: string, _occurredAt: Date, type: string) => { processedType = type; return Promise.resolve(); } } as unknown as LineImageService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, {} as ClassificationService, { refresh: () => Promise.resolve({}) } as unknown as LineProfileService, media);
  await service.accept({ events: [{ type: "message", webhookEventId: "event-video", timestamp: Date.now(), source: { type: "user", userId: "line-video-user" }, message: { type: "video", id: "line-video-1" } }] }, "oa-video");
  assert.deepEqual(mediaData, { messageId: "stored-video-message", providerMessageId: "line-video-1", mediaType: "VIDEO" });
  assert.equal(processedType, "VIDEO");
});

void test("inbound message on REPLIED conversation resets bmReplyStatus to NOT_REPLIED and records activity without touching followUpStatus logic", async () => {
  const { BmReplyStatus, FollowUpStatus, ActivityActionType } = await import("@prisma/client");

  let updatedData: Record<string, unknown> | undefined;
  const activityEntries: Array<Record<string, unknown>> = [];

  const existingConv = { id: "conv-10", customerId: "c-1", storeId: "s-1", lineOfficialAccountId: "oa-1", bmReplyStatus: BmReplyStatus.REPLIED, followUpStatus: FollowUpStatus.COMPLETED };
  const transactionClient = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: ({ data }: { data: Record<string, unknown> }) => { updatedData = data; return Promise.resolve({ ...existingConv, ...data }); },
    },
    message: { create: () => Promise.resolve({ id: "msg-1" }) },
    activityHistory: { create: ({ data }: { data: Record<string, unknown> }) => { activityEntries.push(data); return Promise.resolve({}); } },
  };

  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "c-1" }) },
    conversation: { findFirst: () => Promise.resolve(existingConv) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;

  const classification = { analyze: () => Promise.resolve({}) } as unknown as ClassificationService;
  const profiles = { refresh: () => Promise.resolve({}) } as unknown as LineProfileService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, classification, profiles, {} as LineImageService);

  await service.accept({ events: [{ type: "message", webhookEventId: "event-bm-1", timestamp: Date.now(), source: { type: "user", userId: "user-1" }, message: { type: "text", id: "msg-1", text: "hello" } }] }, "oa-1");

  assert.equal(updatedData?.bmReplyStatus, BmReplyStatus.NOT_REPLIED);
  assert.equal(updatedData?.followUpStatus, FollowUpStatus.FOLLOW_UP);
  const bmChangeActivity = activityEntries.find((a) => a.actionType === ActivityActionType.BM_REPLY_STATUS_CHANGED);
  assert.ok(bmChangeActivity);
  assert.equal(bmChangeActivity?.previousBmReplyStatus, BmReplyStatus.REPLIED);
  assert.equal(bmChangeActivity?.newBmReplyStatus, BmReplyStatus.NOT_REPLIED);
});

void test("inbound message on NOTIFIED_BM conversation resets bmReplyStatus to NOT_REPLIED", async () => {
  const { BmReplyStatus, FollowUpStatus, ActivityActionType } = await import("@prisma/client");

  let updatedData: Record<string, unknown> | undefined;
  const activityEntries: Array<Record<string, unknown>> = [];

  const existingConv = { id: "conv-11", customerId: "c-1", storeId: "s-1", lineOfficialAccountId: "oa-1", bmReplyStatus: BmReplyStatus.NOTIFIED_BM, followUpStatus: FollowUpStatus.FOLLOW_UP };
  const transactionClient = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: ({ data }: { data: Record<string, unknown> }) => { updatedData = data; return Promise.resolve({ ...existingConv, ...data }); },
    },
    message: { create: () => Promise.resolve({ id: "msg-2" }) },
    activityHistory: { create: ({ data }: { data: Record<string, unknown> }) => { activityEntries.push(data); return Promise.resolve({}); } },
  };

  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "c-1" }) },
    conversation: { findFirst: () => Promise.resolve(existingConv) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;

  const classification = { analyze: () => Promise.resolve({}) } as unknown as ClassificationService;
  const profiles = { refresh: () => Promise.resolve({}) } as unknown as LineProfileService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, classification, profiles, {} as LineImageService);

  await service.accept({ events: [{ type: "message", webhookEventId: "event-bm-2", timestamp: Date.now(), source: { type: "user", userId: "user-1" }, message: { type: "text", id: "msg-2", text: "hello 2" } }] }, "oa-1");

  assert.equal(updatedData?.bmReplyStatus, BmReplyStatus.NOT_REPLIED);
  const bmChangeActivity = activityEntries.find((a) => a.actionType === ActivityActionType.BM_REPLY_STATUS_CHANGED);
  assert.ok(bmChangeActivity);
  assert.equal(bmChangeActivity?.previousBmReplyStatus, BmReplyStatus.NOTIFIED_BM);
  assert.equal(bmChangeActivity?.newBmReplyStatus, BmReplyStatus.NOT_REPLIED);
});

void test("inbound message on NOT_REPLIED conversation does NOT log redundant BM_REPLY_STATUS_CHANGED activity", async () => {
  const { BmReplyStatus, FollowUpStatus, ActivityActionType } = await import("@prisma/client");

  let updatedData: Record<string, unknown> | undefined;
  const activityEntries: Array<Record<string, unknown>> = [];

  const existingConv = { id: "conv-12", customerId: "c-1", storeId: "s-1", lineOfficialAccountId: "oa-1", bmReplyStatus: BmReplyStatus.NOT_REPLIED, followUpStatus: FollowUpStatus.FOLLOW_UP };
  const transactionClient = {
    conversation: {
      findUnique: () => Promise.resolve(existingConv),
      update: ({ data }: { data: Record<string, unknown> }) => { updatedData = data; return Promise.resolve({ ...existingConv, ...data }); },
    },
    message: { create: () => Promise.resolve({ id: "msg-3" }) },
    activityHistory: { create: ({ data }: { data: Record<string, unknown> }) => { activityEntries.push(data); return Promise.resolve({}); } },
  };

  const prisma = {
    webhookEvent: { create: () => Promise.resolve({}), update: () => Promise.resolve({}) },
    lineOfficialAccount: { findFirst: () => Promise.resolve({ id: "oa-1", storeId: "store-1", store: { id: "store-1" } }), update: () => Promise.resolve({}) },
    customer: { upsert: () => Promise.resolve({ id: "c-1" }) },
    conversation: { findFirst: () => Promise.resolve(existingConv) },
    $transaction: (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
  } as unknown as PrismaService;

  const classification = { analyze: () => Promise.resolve({}) } as unknown as ClassificationService;
  const profiles = { refresh: () => Promise.resolve({}) } as unknown as LineProfileService;
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, classification, profiles, {} as LineImageService);

  await service.accept({ events: [{ type: "message", webhookEventId: "event-bm-3", timestamp: Date.now(), source: { type: "user", userId: "user-1" }, message: { type: "text", id: "msg-3", text: "hello 3" } }] }, "oa-1");

  assert.equal("bmReplyStatus" in (updatedData ?? {}), false);
  const bmChangeActivity = activityEntries.find((a) => a.actionType === ActivityActionType.BM_REPLY_STATUS_CHANGED);
  assert.equal(bmChangeActivity, undefined);
});
