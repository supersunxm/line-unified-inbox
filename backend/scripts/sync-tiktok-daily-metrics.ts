import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma.service";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";
import { TikTokService } from "../src/tiktok/tiktok.service";

async function main() {
  const prisma = new PrismaClient();
  const encryption = new CredentialEncryptionService();
  encryption.onModuleInit();
  const tiktokService = new TikTokService(prisma as PrismaService, encryption);

  try {
    process.stdout.write("Starting daily TikTok account metrics synchronization...\n");
    const summary = await tiktokService.syncDailyTikTokMetrics();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    // Individual account errors are captured within summary.
    // Script exits cleanly with code 0 for normal job completion.
    process.exitCode = 0;
  } catch (err: unknown) {
    // Only job-level unhandled/bootstrap errors cause non-zero exit
    console.error(err instanceof Error ? err.message : "Daily TikTok metrics sync job-level error");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
