import { PrismaService } from "../src/prisma.service";
import {
  assertExactTikTokPublicProfile,
  TikTokPublicAnalyticsService,
} from "../src/tiktok/tiktok-public-analytics.service";
import { probeTikTokPublicProfile } from "../src/tiktok/tiktok-public-profile";

interface Options {
  apply: boolean;
  limit: number;
  delayMs: number;
  storeIds: string[];
}

interface BatchRow {
  storeMasterId: string;
  storeName: string;
  usernameInput: string;
  status: "OK" | "FAILED";
  persisted: boolean;
  followerCount: number | null;
  followingCount: number | null;
  likesCount: number | null;
  videoCount: number | null;
  metricSource: string | null;
  metricPrecision: string | null;
  error: string | null;
}

const MAX_LIMIT = 30;
const MIN_DELAY_MS = 1_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): Options {
  let apply = false;
  let limit = 1;
  let delayMs = 2_500;
  const storeIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--limit") {
      limit = parsePositiveInt(argv[index + 1], limit);
      index += 1;
      continue;
    }
    if (arg === "--delay-ms") {
      delayMs = parsePositiveInt(argv[index + 1], delayMs);
      index += 1;
      continue;
    }
    if (arg === "--store-id") {
      const id = argv[index + 1]?.trim();
      if (id) storeIds.push(id);
      index += 1;
    }
  }

  return {
    apply,
    limit: Math.min(Math.max(limit, 1), MAX_LIMIT),
    delayMs: Math.max(delayMs, MIN_DELAY_MS),
    storeIds: [...new Set(storeIds)],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaService();
  const analytics = new TikTokPublicAnalyticsService(prisma);

  await prisma.$connect();

  try {
    const stores = await prisma.storeMaster.findMany({
      where: {
        isActive: true,
        ...(options.storeIds.length > 0 ? { id: { in: options.storeIds } } : {}),
        OR: [
          { tiktokUsername: { not: null } },
          { tiktokProfileUrl: { not: null } },
        ],
      },
      select: {
        id: true,
        storeName: true,
        tiktokUsername: true,
        tiktokProfileUrl: true,
      },
      orderBy: [{ storeName: "asc" }, { id: "asc" }],
      take: options.limit,
    });

    const rows: BatchRow[] = [];

    for (let index = 0; index < stores.length; index += 1) {
      const store = stores[index];
      const usernameInput = store.tiktokUsername ?? store.tiktokProfileUrl;
      if (!usernameInput) continue;

      try {
        const result = await probeTikTokPublicProfile(usernameInput);
        if (result.status !== "OK" || !result.profile) {
          throw new Error(result.diagnostics.message ?? "TikTok public profile unavailable");
        }

        assertExactTikTokPublicProfile(result.profile);

        if (options.apply) {
          await analytics.persistExactSnapshot(
            {
              id: store.id,
              tiktokUsername: store.tiktokUsername,
              tiktokProfileUrl: store.tiktokProfileUrl,
            },
            result,
          );
        }

        rows.push({
          storeMasterId: store.id,
          storeName: store.storeName,
          usernameInput,
          status: "OK",
          persisted: options.apply,
          followerCount: result.profile.followerCount,
          followingCount: result.profile.followingCount,
          likesCount: result.profile.likesCount,
          videoCount: result.profile.videoCount,
          metricSource: result.profile.metricSource,
          metricPrecision: result.profile.metricPrecision,
          error: null,
        });
      } catch (error: unknown) {
        rows.push({
          storeMasterId: store.id,
          storeName: store.storeName,
          usernameInput,
          status: "FAILED",
          persisted: false,
          followerCount: null,
          followingCount: null,
          likesCount: null,
          videoCount: null,
          metricSource: null,
          metricPrecision: null,
          error: error instanceof Error ? error.message : "Unknown collector failure",
        });
      }

      if (index < stores.length - 1) await sleep(options.delayMs);
    }

    const summary = {
      mode: options.apply ? "APPLY" : "DRY_RUN",
      requestedLimit: options.limit,
      selectedStores: stores.length,
      delayMs: options.delayMs,
      successCount: rows.filter((row) => row.status === "OK").length,
      failedCount: rows.filter((row) => row.status === "FAILED").length,
      persistedCount: rows.filter((row) => row.persisted).length,
      rows,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (summary.failedCount > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "TikTok public batch collector failed");
  process.exitCode = 1;
});
