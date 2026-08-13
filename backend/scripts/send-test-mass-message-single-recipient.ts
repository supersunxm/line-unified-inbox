import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";
import { LineMessagingService } from "../src/line-messaging/line-messaging.service";

const prisma = new PrismaClient();
const encryption = new CredentialEncryptionService();
const lineMessaging = new LineMessagingService();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: npx tsx scripts/send-test-mass-message-single-recipient.ts <storeId> <testLineUserId> [optional text] [optional imageUrl]");
    process.exit(1);
  }

  const [storeId, testLineUserId, customText, imageUrl] = args;

  if (!testLineUserId.startsWith("U")) {
    console.error("Error: testLineUserId must start with 'U' (valid LINE User ID)");
    process.exit(1);
  }

  console.log("=== SAFE CONTROLLED SINGLE-RECIPIENT TEST ===");
  console.log(`Store ID: ${storeId}`);
  console.log(`Test Recipient LINE User ID: ${testLineUserId}`);

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      lineOfficialAccounts: {
        where: { isActive: true, archivedAt: null },
        take: 1,
      },
    },
  });

  if (!store) {
    console.error(`Store ${storeId} not found!`);
    process.exit(1);
  }

  const oa = store.lineOfficialAccounts[0];
  if (!oa || !oa.encryptedChannelAccessToken) {
    console.error(`Store ${store.name} does not have an active LINE OA connection with a valid token.`);
    process.exit(1);
  }

  console.log(`Store Name: ${store.name}`);
  console.log(`LINE OA Name: ${oa.name}`);
  console.log(`LINE OA ID: ${oa.id}`);

  const accessToken = encryption.decrypt(oa.encryptedChannelAccessToken);

  const messages: Array<Record<string, unknown>> = [];
  const textContent = customText || "This is a controlled diagnostic test from OPPO LINE OA Hub. Please reply if received.";
  messages.push({
    type: "text",
    text: `[TEST - Mass Message Single Recipient]\n${textContent}`,
  });

  if (imageUrl) {
    messages.push({
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    });
  }

  const retryKey = randomUUID();
  console.log(`\nDispatching multicast to EXACTLY 1 recipient: ${testLineUserId}...`);
  console.log(`X-Line-Retry-Key: ${retryKey}`);

  const result = await lineMessaging.multicast({
    accessToken,
    to: [testLineUserId],
    messages,
    retryKey,
  });

  console.log("\n=== RESULT ===");
  console.log(`Status: SUCCESS (Accepted by LINE)`);
  console.log(`LINE Request ID (x-line-request-id): ${result.requestId || "none"}`);
  console.log(`Duplicate Accepted: ${result.duplicateAccepted}`);
  console.log(`Total Recipients Sent: 1`);
}

main()
  .catch((err) => {
    console.error("Test send failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
