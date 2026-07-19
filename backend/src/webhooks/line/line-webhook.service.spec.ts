import assert from "node:assert/strict";
import test from "node:test";
import { ClassificationService } from "../../classification/classification.service";
import { CredentialEncryptionService } from "../../credentials/credential-encryption.service";
import { LineProfileService } from "../../line-profile.service";
import { PrismaService } from "../../prisma.service";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineWebhookService } from "./line-webhook.service";

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
  const service = new LineWebhookService(prisma, { enabled: true } as LineWebhookConfig, {} as CredentialEncryptionService, classification, profiles);

  const result = await service.accept({ events: [{ type: "message", webhookEventId: "event-1", timestamp: Date.now(), source: { type: "user", userId: "line-user-1" }, message: { type: "text", id: "message-1", text: "สนใจ Reno16" } }] }, "oa-1");

  assert.deepEqual(result, { success: true });
  assert.equal(storedText, "สนใจ Reno16");
  assert.equal(profileAttempted, true);
});
