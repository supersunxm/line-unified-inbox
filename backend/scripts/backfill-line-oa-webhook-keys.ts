import { PrismaClient } from "@prisma/client";
import { backfillWebhookKeys } from "../src/line-official-accounts/webhook-key-backfill";

const prisma = new PrismaClient();
try {
  const result = await backfillWebhookKeys(prisma);
  console.log(`LINE OA webhook key backfill complete: scanned=${result.scanned} repaired=${result.repaired}`);
} finally {
  await prisma.$disconnect();
}
