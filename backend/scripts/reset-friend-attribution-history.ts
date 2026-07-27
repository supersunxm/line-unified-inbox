import { PrismaClient } from "@prisma/client";

export const CONFIRMATION_FLAG = "--confirm-reset-all-attribution-history";

export interface ResetSummary {
  preservedStores: number;
  preservedLineAccounts: number;
  preservedSourceLinks: number;
  preservedLiffConfigs: number;
  clicksDeleted: number;
  attributionsDeleted: number;
  sessionsDeleted: number;
  unmatchedFollowsDeleted: number;
  isDryRun: boolean;
}

export async function executeAttributionReset(prisma: PrismaClient, args: string[]): Promise<ResetSummary> {
  const isConfirmed = args.includes(CONFIRMATION_FLAG);
  const isDryRun = !isConfirmed;

  // Preserved structural entities count
  const preservedStores = await prisma.store.count();
  const preservedLineAccounts = await prisma.lineOfficialAccount.count();
  const preservedSourceLinks = await prisma.friendSourceLink.count();
  const preservedLiffConfigs = await prisma.friendAttributionConfig.count();

  // Targets for reset/deletion
  const clicksCount = await prisma.friendSourceClick.count();
  const attributionsCount = await prisma.friendSourceAttribution.count();
  const sessionsCount = await prisma.friendAttributionSession.count();
  const unmatchedFollowsCount = await prisma.friendAttributionUnmatchedFollow.count();

  if (isDryRun) {
    return {
      preservedStores,
      preservedLineAccounts,
      preservedSourceLinks,
      preservedLiffConfigs,
      clicksDeleted: clicksCount,
      attributionsDeleted: attributionsCount,
      sessionsDeleted: sessionsCount,
      unmatchedFollowsDeleted: unmatchedFollowsCount,
      isDryRun: true,
    };
  }

  // Real Reset: Execute within a single database transaction
  let clicksDeleted = 0;
  let attributionsDeleted = 0;
  let sessionsDeleted = 0;
  let unmatchedFollowsDeleted = 0;

  await prisma.$transaction(async (tx) => {
    const resClicks = await tx.friendSourceClick.deleteMany({});
    clicksDeleted = resClicks.count;

    const resAttr = await tx.friendSourceAttribution.deleteMany({});
    attributionsDeleted = resAttr.count;

    const resSess = await tx.friendAttributionSession.deleteMany({});
    sessionsDeleted = resSess.count;

    const resUnmatched = await tx.friendAttributionUnmatchedFollow.deleteMany({});
    unmatchedFollowsDeleted = resUnmatched.count;
  });

  return {
    preservedStores,
    preservedLineAccounts,
    preservedSourceLinks,
    preservedLiffConfigs,
    clicksDeleted,
    attributionsDeleted,
    sessionsDeleted,
    unmatchedFollowsDeleted,
    isDryRun: false,
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const args = process.argv.slice(2);
    const summary = await executeAttributionReset(prisma, args);

    console.log("==================================================================");
    console.log(`FRIEND ATTRIBUTION DATA RESET (${summary.isDryRun ? "DRY-RUN MODE" : "REAL EXECUTION MODE"})`);
    console.log("==================================================================");
    console.log(`[PRESERVED STRUCTURE]`);
    console.log(`  - Stores Preserved:              ${summary.preservedStores}`);
    console.log(`  - LINE OA Accounts Preserved:    ${summary.preservedLineAccounts}`);
    console.log(`  - Friend Source Links Preserved: ${summary.preservedSourceLinks}`);
    console.log(`  - LIFF Configurations Preserved: ${summary.preservedLiffConfigs}`);
    console.log(`------------------------------------------------------------------`);
    console.log(`[ATTRIBUTION HISTORY DELETION ${summary.isDryRun ? "(WOULD BE DELETED)" : "(DELETED)"}]`);
    console.log(`  - FriendSourceClick rows:        ${summary.clicksDeleted}`);
    console.log(`  - FriendSourceAttribution rows:  ${summary.attributionsDeleted}`);
    console.log(`  - FriendAttributionSession rows: ${summary.sessionsDeleted}`);
    console.log(`  - FriendAttributionUnmatched:   ${summary.unmatchedFollowsDeleted}`);
    console.log(`------------------------------------------------------------------`);
    console.log(`[EXPECTED POST-RESET DASHBOARD METRICS]`);
    console.log(`  - Total Clicks:      0`);
    console.log(`  - Identified Visits: 0`);
    console.log(`  - Confirmed Adds:    0`);
    console.log(`  - Conversion Rate:   0.00%`);
    console.log("==================================================================");

    if (summary.isDryRun) {
      console.log("\nNOTE: This was a DRY-RUN. Zero database records were modified.");
      console.log(`To execute the real deletion, run with:`);
      console.log(`  npx ts-node scripts/reset-friend-attribution-history.ts ${CONFIRMATION_FLAG}\n`);
    } else {
      console.log("\nSUCCESS: Production friend attribution test history reset complete.\n");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((err) => {
    console.error("FATAL: Reset script failed and rolled back:", err);
    process.exit(1);
  });
}
