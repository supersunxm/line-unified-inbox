import { PrismaClient } from "@prisma/client";
import { normalizeTikTokUsernameForMatching } from "../src/tiktok/tiktok.service";

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  if (url && url.includes("postgres.railway.internal:5432")) {
    url = url.replace("postgres.railway.internal:5432", "tokaido.proxy.rlwy.net:38745");
  }
  return url;
}

async function main() {
  const dbUrl = getDatabaseUrl();
  const prisma = new PrismaClient(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
  try {
    const targetUsernameInput = process.argv[2] || "o_centralworld";
    const targetNormalized = normalizeTikTokUsernameForMatching(targetUsernameInput);

    console.log(`[Audit] Searching for TikTokAccount with normalized username: "${targetNormalized}"`);

    const allAccounts = await prisma.tikTokAccount.findMany({
      include: {
        storeMaster: {
          select: {
            id: true,
            storeName: true,
            accountName: true,
            tiktokUsername: true,
            province: true,
            region: true,
          },
        },
        _count: {
          select: {
            videos: true,
            dailyMetrics: true,
          },
        },
      },
    });

    console.log(`[Audit] Total TikTokAccount rows in database: ${allAccounts.length}`);

    const matchingAccounts = allAccounts.filter((acc) => {
      const normalized = normalizeTikTokUsernameForMatching(acc.username);
      return normalized === targetNormalized;
    });

    console.log(`[Audit] Matching TikTokAccount rows found: ${matchingAccounts.length}`);

    for (const acc of matchingAccounts) {
      console.log(`[Audit] Account Details:`);
      console.log(`  - TikTokAccount.id: ${acc.id}`);
      console.log(`  - openId: ${acc.openId}`);
      console.log(`  - username: ${acc.username}`);
      console.log(`  - displayName: ${acc.displayName}`);
      console.log(`  - connectionStatus: ${acc.connectionStatus}`);
      console.log(`  - storeMasterId: ${acc.storeMasterId}`);
      console.log(`  - StoreMaster.storeName: ${acc.storeMaster?.storeName ?? "NONE"}`);
      console.log(`  - StoreMaster.accountName: ${acc.storeMaster?.accountName ?? "NONE"}`);
      console.log(`  - StoreMaster.tiktokUsername: ${acc.storeMaster?.tiktokUsername ?? "NONE"}`);
      console.log(`  - Related TikTokVideo count: ${acc._count.videos}`);
      console.log(`  - Related TikTokAccountDailyMetric count: ${acc._count.dailyMetrics}`);
      console.log(`  - Has Encrypted Access Token: ${!!acc.encryptedAccessToken}`);
      console.log(`  - Has Encrypted Refresh Token: ${!!acc.encryptedRefreshToken}`);
    }

    const otherAccounts = allAccounts.filter((acc) => {
      const normalized = normalizeTikTokUsernameForMatching(acc.username);
      return normalized !== targetNormalized;
    });
    console.log(`[Audit] Other non-matching TikTokAccount rows: ${otherAccounts.length}`);
    for (const other of otherAccounts) {
      console.log(`  - Other Account id: ${other.id}, displayName: ${other.displayName}, username: ${other.username}`);
    }

    const matchingStoreMasters = await prisma.storeMaster.findMany({
      where: {
        OR: [
          { tiktokUsername: targetUsernameInput },
          { tiktokUsername: targetNormalized },
          { accountName: { contains: "Central World", mode: "insensitive" } },
          { storeName: { contains: "Central World", mode: "insensitive" } },
        ],
      },
    });
    console.log(`[Audit] StoreMaster rows matching "${targetUsernameInput}": ${matchingStoreMasters.length}`);
    for (const sm of matchingStoreMasters) {
      console.log(`  - StoreMaster id: ${sm.id}`);
      console.log(`    storeName: ${sm.storeName}`);
      console.log(`    accountName: ${sm.accountName}`);
      console.log(`    tiktokUsername: ${sm.tiktokUsername}`);
      console.log(`    province: ${sm.province}`);
      console.log(`    region: ${sm.region}`);
    }
    const totalVideos = await prisma.tikTokVideo.count();
    const totalDailyMetrics = await prisma.tikTokAccountDailyMetric.count();
    console.log(`[Audit] Total TikTokVideo rows in DB: ${totalVideos}`);
    console.log(`[Audit] Total TikTokAccountDailyMetric rows in DB: ${totalDailyMetrics}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[Audit Error]", err.message);
  process.exit(1);
});
