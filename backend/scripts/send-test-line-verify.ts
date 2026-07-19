import { PrismaClient } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";

const prisma = new PrismaClient();
const exactPayload = '{"events":[]}';

function identifierArgument() {
  const namedIndex = process.argv.findIndex((value) => value === "--webhook-key" || value === "--webhookKey");
  return { value: process.env.WEBHOOK_KEY ?? (namedIndex >= 0 ? process.argv[namedIndex + 1] : process.argv[2]), isWebhookKey: Boolean(process.env.WEBHOOK_KEY || namedIndex >= 0) };
}

async function post(url: string, body: string, signature: string) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-line-signature": signature }, body });
}

async function main() {
  const identifier = identifierArgument();
  if (!identifier.value) throw new Error("Pass a LINE Official Account ID, or set WEBHOOK_KEY for automation");
  const oa = identifier.isWebhookKey ? await prisma.lineOfficialAccount.findUnique({ where: { webhookKey: identifier.value } }) : await prisma.lineOfficialAccount.findUnique({ where: { id: identifier.value } });
  if (!oa?.encryptedChannelSecret) throw new Error("The selected webhook key has no stored Channel Secret");
  const webhookKey = oa.webhookKey;

  const encryption = new CredentialEncryptionService();
  encryption.onModuleInit();
  const secret = encryption.decrypt(oa.encryptedChannelSecret);
  const apiUrl = process.env.LINE_TEST_API_URL ?? `http://localhost:${process.env.PORT ?? "3001"}`;
  const endpoint = `${apiUrl}/webhook/${encodeURIComponent(webhookKey)}`;
  const signature = createHmac("sha256", secret).update(exactPayload).digest("base64");
  const wrongSignature = createHmac("sha256", "deliberately-wrong-secret").update(exactPayload).digest("base64");

  const valid = await post(endpoint, exactPayload, signature);
  const wrongSecret = await post(endpoint, exactPayload, wrongSignature);
  const changedBody = await post(endpoint, `${exactPayload} `, signature);
  const invalidKey = await post(`${apiUrl}/webhook/invalid-webhook-key`, exactPayload, signature);
  const statuses = { valid: valid.status, wrongSecret: wrongSecret.status, changedBody: changedBody.status, invalidWebhookKey: invalidKey.status };
  if (valid.status !== 200 || wrongSecret.status !== 401 || changedBody.status !== 401 || invalidKey.status !== 404) {
    throw new Error(`LINE verification checks failed: ${JSON.stringify(statuses)}`);
  }

  const testId = randomUUID();
  const externalMessageId = `agent-message-${testId}`;
  const externalWebhookEventId = `agent-event-${testId}`;
  const lineUserId = `agent-user-${testId}`;
  const customerText = "พร้อมซื้อ OPPO Reno16 ราคาเท่าไหร่";
  const messagePayload = JSON.stringify({ events: [{ type: "message", message: { type: "text", id: externalMessageId, text: customerText }, webhookEventId: externalWebhookEventId, timestamp: Date.now(), source: { type: "user", userId: lineUserId }, deliveryContext: { isRedelivery: false } }] });
  const messageSignature = createHmac("sha256", secret).update(messagePayload).digest("base64");
  let profileOutcome = "NOT_ATTEMPTED";
  let messageStatus = 0;
  try {
    const messageResponse = await post(endpoint, messagePayload, messageSignature); messageStatus = messageResponse.status;
    if (messageResponse.status !== 200) throw new Error(`Signed customer text returned ${messageResponse.status}`);
    const stored = await prisma.message.findUnique({ where: { externalMessageId }, include: { conversation: { include: { customer: true } } } });
    if (!stored || stored.originalText !== customerText || stored.direction !== "INBOUND" || stored.conversation.lineOfficialAccountId !== oa.id) throw new Error("Signed customer text was not stored correctly");
    const persistedAfterRequests = await prisma.lineOfficialAccount.findUnique({ where: { id: oa.id }, select: { webhookKey: true } });
    if (persistedAfterRequests?.webhookKey !== webhookKey) throw new Error("Webhook key changed during request processing");
    profileOutcome = stored.conversation.customer.profileFetchStatus;
  } finally {
    await prisma.$transaction([
      prisma.webhookEvent.deleteMany({ where: { externalWebhookEventId } }),
      prisma.conversation.deleteMany({ where: { customer: { lineUserId } } }),
      prisma.customer.deleteMany({ where: { lineUserId } }),
    ]);
  }
  console.log(JSON.stringify({ success: true, oaId: oa.id, webhookKeyConfigured: true, webhookKeyStable: true, rawBodyBytes: Buffer.byteLength(exactPayload), customerTextStored: true, profileOutcome, statuses: { ...statuses, customerText: messageStatus } }));
}

void main().finally(() => prisma.$disconnect());
