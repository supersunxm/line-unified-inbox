import { PrismaClient } from "@prisma/client";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";
import { TikTokService } from "../src/tiktok/tiktok.service";

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (url && url.includes("postgres.railway.internal:5432")) {
    url = url.replace("postgres.railway.internal:5432", "tokaido.proxy.rlwy.net:38745");
  }
  return url;
}

async function main() {
  const args = process.argv.slice(2);
  let username = "o_centralworld";
  let isDryRun = false;
  let isConfirmed = false;

  for (const arg of args) {
    if (arg.startsWith("--username=")) {
      username = arg.split("=")[1];
    } else if (arg === "--dry-run") {
      isDryRun = true;
    } else if (arg === "--confirm") {
      isConfirmed = true;
    }
  }

  if (!isConfirmed && !isDryRun) {
    console.log(`[TikTok Reset Notice] Running in DRY-RUN mode by default. Pass --confirm to execute live revocation and deletion.`);
    isDryRun = true;
  }

  console.log(`=======================================================`);
  console.log(`  TikTok Sandbox Account Reset Utility`);
  console.log(`  Target Username: ${username}`);
  console.log(`  Mode: ${isDryRun ? "DRY-RUN (Simulated)" : "CONFIRMED (Live Revoke & Delete)"}`);
  console.log(`=======================================================`);

  const dbUrl = getDatabaseUrl();
  const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
  const encryption = new CredentialEncryptionService();
  encryption.onModuleInit();
  const tiktokService = new TikTokService(prisma, encryption);

  try {
    const result = await tiktokService.resetTikTokSandboxAccountByUsername(username, {
      dryRun: isDryRun,
    });

    if (!result.success) {
      console.log(`[TikTok Reset] Status: NO_ACTION`);
      console.log(`  Message: ${result.revokeResult}`);
      return;
    }

    console.log(`[TikTok Reset] Status: ${isDryRun ? "DRY_RUN_COMPLETED" : "RESET_COMPLETED_SUCCESSFULLY"}`);
    console.log(`  Deleted Account ID: ${result.deletedAccountId}`);
    console.log(`  Username: @${result.username}`);
    console.log(`  Display Name: ${result.displayName}`);
    console.log(`  Linked Store: ${result.storeMasterName ?? "None"}`);
    console.log(`  Deleted Videos: ${result.deletedVideosCount}`);
    console.log(`  Deleted Daily Metrics: ${result.deletedDailyMetricsCount}`);
    console.log(`  Revoke Status: ${result.revokeResult}`);
    console.log(`=======================================================`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[TikTok Reset Error]`, err.message);
  process.exit(1);
});
