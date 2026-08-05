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

