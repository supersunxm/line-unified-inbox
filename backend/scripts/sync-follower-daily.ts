import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../src/prisma.service";
import { CredentialEncryptionService } from "../src/credentials/credential-encryption.service";
import { FollowerInsightsService } from "../src/follower-insights/follower-insights.service";
import {
  getPreviousBangkokDateString,
  getTodayBangkokDateString,
} from "../src/follower-insights/date-utils";

async function main() {
  const prisma = new PrismaClient();
  const encryption = new CredentialEncryptionService();
  encryption.onModuleInit();
  const followerInsights = new FollowerInsightsService(
    prisma as PrismaService,
    encryption,
  );

  const todayBangkok = getTodayBangkokDateString();
  const targetDate = getPreviousBangkokDateString(todayBangkok);

  try {
    process.stdout.write(
      `Starting daily LINE OA follower synchronization for ${targetDate} (D-1, Asia/Bangkok)...\n`,
    );

    const summary = await followerInsights.sync({ date: targetDate });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

    // Account-level failures are reported in the summary. A normal completed run exits 0
    // so Railway records the cron execution as completed; the existing reconciliation
    // worker remains the safety net for any missing/unready account-date snapshots.
    process.exitCode = 0;
  } catch (err: unknown) {
    console.error(
      err instanceof Error
        ? err.message
        : "Daily follower metrics sync job-level error",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
