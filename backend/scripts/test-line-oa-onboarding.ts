import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes } from "node:crypto";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";

const prisma = new PrismaClient();
const apiUrl = process.env.LINE_TEST_API_URL ?? `http://localhost:${process.env.PORT ?? "3001"}`;

function signed(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

async function postWebhook(url: string, rawBody: string, secret: string) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-line-signature": signed(rawBody, secret) }, body: rawBody });
}

async function main() {
  const suffix = randomBytes(8).toString("hex");
  const originalSecret = `onboarding-secret-${suffix}`;
  const replacementSecret = `replacement-secret-${suffix}`;
  const accessToken = `onboarding-token-${suffix}`;
  let accountId: string | undefined;
  let storeId: string | undefined;
  try {
    const createResponse = await fetch(`${apiUrl}/line-official-accounts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `Onboarding Test ${suffix}`, channelSecret: originalSecret, channelAccessToken: accessToken, isActive: true }) });
    if (!createResponse.ok) throw new Error(`Three-field create failed with HTTP ${createResponse.status}`);
    const publicAccount = await createResponse.json() as { id: string; store: { id: string } };
    accountId = publicAccount.id; storeId = publicAccount.store.id;
    const publicJson = JSON.stringify(publicAccount);
    if (publicJson.includes(originalSecret) || publicJson.includes(accessToken) || publicJson.includes("encryptedChannel")) throw new Error("Credential data appeared in the create response");

    const stored = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: accountId } });
    const allKeys = await prisma.lineOfficialAccount.findMany({ select: { webhookKey: true } });
    if (stored.webhookKey.length < 22 || new Set(allKeys.map(({ webhookKey }) => webhookKey)).size !== allKeys.length) throw new Error("Webhook keys are not sufficiently random and unique");
    const infoResponse = await fetch(`${apiUrl}/line-official-accounts/${accountId}/webhook-info`);
    const info = await infoResponse.json() as { webhookUrl: string };
    if (!info.webhookUrl.endsWith(`/webhook/${stored.webhookKey}`)) throw new Error("Generated webhook URL is incorrect");

    const emptyBody = JSON.stringify({ events: [] });
    if ((await postWebhook(info.webhookUrl, emptyBody, originalSecret)).status !== 200) throw new Error("Valid empty-events verification failed");
    if ((await postWebhook(info.webhookUrl, emptyBody, "wrong-oa-secret")).status !== 401) throw new Error("Wrong OA secret was not rejected");
    if ((await postWebhook(`${apiUrl}/webhook/not-a-valid-webhook-key`, emptyBody, originalSecret)).status !== 404) throw new Error("Invalid webhook key was not rejected");

    const eventId = `onboarding-event-${suffix}`;
    const messageId = `onboarding-message-${suffix}`;
    const messageBody = JSON.stringify({ events: [{ type: "message", webhookEventId: eventId, timestamp: Date.now(), source: { type: "user", userId: `onboarding-user-${suffix}` }, deliveryContext: { isRedelivery: false }, message: { type: "text", id: messageId, text: "Onboarding integration test" } }] });
    if ((await postWebhook(info.webhookUrl, messageBody, originalSecret)).status !== 200 || (await postWebhook(info.webhookUrl, messageBody, originalSecret)).status !== 200) throw new Error("Real or duplicate message webhook failed");
    if (await prisma.message.count({ where: { externalMessageId: messageId } }) !== 1) throw new Error("Message webhook was not stored exactly once");

    const beforeBlankEdit = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: accountId } });
    await fetch(`${apiUrl}/line-official-accounts/${accountId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelSecret: "", channelAccessToken: "" }) });
    const afterBlankEdit = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: accountId } });
    if (beforeBlankEdit.encryptedChannelSecret !== afterBlankEdit.encryptedChannelSecret || beforeBlankEdit.encryptedChannelAccessToken !== afterBlankEdit.encryptedChannelAccessToken) throw new Error("Blank edit did not preserve credentials");

    await prisma.lineOfficialAccount.update({ where: { id: accountId }, data: { encryptedChannelSecret: "corrupted-value" } });
    const replaceResponse = await fetch(`${apiUrl}/line-official-accounts/${accountId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelSecret: replacementSecret }) });
    if (!replaceResponse.ok) throw new Error("Replacing an undecryptable credential failed");
    const replaced = await prisma.lineOfficialAccount.findUniqueOrThrow({ where: { id: accountId } });
    const encryption = new CredentialEncryptionService(); encryption.onModuleInit();
    if (!replaced.encryptedChannelSecret || encryption.decrypt(replaced.encryptedChannelSecret) !== replacementSecret) throw new Error("Replacement credential was not encrypted correctly");

    const oldUrl = info.webhookUrl;
    const regenerateResponse = await fetch(`${apiUrl}/line-official-accounts/${accountId}/regenerate-webhook`, { method: "POST" });
    const regenerated = await regenerateResponse.json() as { webhookUrl: string };
    if (regenerated.webhookUrl === oldUrl) throw new Error("Webhook regeneration did not change the URL");
    if ((await postWebhook(oldUrl, emptyBody, replacementSecret)).status !== 404) throw new Error("Old webhook URL remained valid after regeneration");
    if ((await postWebhook(regenerated.webhookUrl, emptyBody, replacementSecret)).status !== 200) throw new Error("Regenerated webhook URL failed verification");

    console.log(JSON.stringify({ success: true, threeFieldCreate: true, uniqueWebhookKey: true, credentialsHidden: true, emptyEventsStatus: 200, wrongSecretStatus: 401, invalidKeyStatus: 404, realMessageStoredOnce: true, blankEditPreservedCredentials: true, credentialReplacement: true, regenerationInvalidatedOldUrl: true }));
  } finally {
    if (accountId) {
      const conversations = await prisma.conversation.findMany({ where: { lineOfficialAccountId: accountId }, select: { id: true, customerId: true } });
      const conversationIds = conversations.map(({ id }) => id);
      if (conversationIds.length > 0) await prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      await prisma.customer.deleteMany({ where: { id: { in: conversations.map(({ customerId }) => customerId) }, conversations: { none: {} } } });
      await prisma.webhookEvent.deleteMany({ where: { externalWebhookEventId: { startsWith: "onboarding-event-" } } });
      await prisma.lineOfficialAccount.deleteMany({ where: { id: accountId } });
    }
    if (storeId) await prisma.store.deleteMany({ where: { id: storeId, conversations: { none: {} }, lineOfficialAccounts: { none: {} } } });
    await prisma.$disconnect();
  }
}

void main();
