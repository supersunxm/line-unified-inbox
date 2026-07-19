import { PrismaClient } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";

const prisma = new PrismaClient();

async function main() {
  const webhookKey = process.env.WEBHOOK_KEY ?? process.argv[2];
  if (!webhookKey) throw new Error("Pass the persisted per-OA webhook key or set WEBHOOK_KEY");
  const oa = await prisma.lineOfficialAccount.findUnique({ where: { webhookKey } });
  if (!oa?.encryptedChannelSecret) throw new Error("The persisted webhook key has no stored Channel Secret");
  const encryption = new CredentialEncryptionService(); encryption.onModuleInit();
  const secret = encryption.decrypt(oa.encryptedChannelSecret);
  const apiUrl = process.env.LINE_TEST_API_URL ?? `http://localhost:${process.env.PORT ?? "3001"}`;
  const uniqueId = process.env.LINE_TEST_EVENT_ID ?? randomUUID();
  const payload = {
  destination: oa.destinationId || undefined,
  events: [{
    type: "message",
    message: { type: "text", id: `test-message-${uniqueId}`, text: `Local signed LINE webhook test ${new Date().toISOString()}` },
    webhookEventId: `test-webhook-${uniqueId}`,
    timestamp: Date.now(),
    source: { type: "user", userId: "local-line-webhook-test-user" },
    deliveryContext: { isRedelivery: false },
  }],
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
  const response = await fetch(`${apiUrl}/webhook/${encodeURIComponent(webhookKey)}`, { method: "POST", headers: { "content-type": "application/json", "x-line-signature": signature }, body: rawBody });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Webhook returned ${response.status}: ${responseText}`);
  console.log(`Webhook accepted (${response.status}): ${responseText}`);
}

void main().finally(() => prisma.$disconnect());
