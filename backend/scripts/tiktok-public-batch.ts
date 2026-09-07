import { PrismaService } from "../src/prisma.service";
import {
  assertExactTikTokPublicProfile,
  TikTokPublicAnalyticsService,
} from "../src/tiktok/tiktok-public-analytics.service";
import { probeTikTokPublicProfile } from "../src/tiktok/tiktok-public-profile";

interface Options {
  apply: boolean;
  limit: number;
  offset: number;
  delayMs: number;
  storeIds: string[];
}

interface BatchRow {
  storeMasterId: string;
  storeName: string;
  usernameInput: string;
  finalUrl: string | null;
  status: "OK" | "FAILED";
  diagnosticCategory: string;
  statusCode: number | null;
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
const MIN_DELAY_MS = 4_000;
const DEFAULT_DELAY_MS = 5_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): Options {
  let apply = false;
  let limit = 1;
  let offset = 0;
  let delayMs = DEFAULT_DELAY_MS;
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
    if (arg === "--offset") {
      offset = parseNonNegativeInt(argv[index + 1], offset);
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
    offset: Math.max(offset, 0),
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
      skip: options.offset,
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
          rows.push({
            storeMasterId: store.id,
            storeName: store.storeName,
            usernameInput,
            finalUrl: result.diagnostics.finalUrl,
            status: "FAILED",
            diagnosticCategory: result.diagnostics.category,
            statusCode: result.diagnostics.statusCode,
            persisted: false,
            followerCount: null,
            followingCount: null,
            likesCount: null,
            videoCount: null,
            metricSource: null,
            metricPrecision: null,
            error: result.diagnostics.message ?? "TikTok public profile unavailable",
          });
          if (index < stores.length - 1) await sleep(options.delayMs);
          continue;
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
          finalUrl: result.diagnostics.finalUrl,
          status: "OK",
          diagnosticCategory: result.diagnostics.category,
          statusCode: result.diagnostics.statusCode ?? 0,
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
        const errorMsg = error instanceof Error ? error.message : "Unknown collector failure";
        let diagnosticCategory = "PARSE_FAILED";
        if (
          errorMsg.includes("Invalid TikTok username") ||
          errorMsg.includes("username is required") ||
          errorMsg.includes("profile username")
        ) {
          diagnosticCategory = "INVALID_USERNAME";
        } else if (errorMsg.includes("navigation") || errorMsg.includes("net::")) {
          diagnosticCategory = "NAVIGATION_FAILED";
        }

        rows.push({
          storeMasterId: store.id,
          storeName: store.storeName,
          usernameInput,
          finalUrl: null,
          status: "FAILED",
          diagnosticCategory,
          statusCode: null,
          persisted: false,
          followerCount: null,
          followingCount: null,
          likesCount: null,
          videoCount: null,
          metricSource: null,
          metricPrecision: null,
          error: errorMsg,
        });
      }

      if (index < stores.length - 1) await sleep(options.delayMs);
    }

    const summary = {
      mode: options.apply ? "APPLY" : "DRY_RUN",
      requestedLimit: options.limit,
      requestedOffset: options.offset,
      selectedStores: stores.length,
      delayMs: options.delayMs,
      successCount: rows.filter((row) => row.status === "OK").length,
      failedCount: rows.filter((row) => row.status === "FAILED").length,
      persistedCount: rows.filter((row) => row.persisted).length,
      categories: {
        okExact: rows.filter((row) => row.diagnosticCategory === "OK_EXACT").length,
        audienceControlled: rows.filter((row) => row.diagnosticCategory === "AUDIENCE_CONTROLLED").length,
        accountNotFound: rows.filter((row) => row.diagnosticCategory === "ACCOUNT_NOT_FOUND").length,
        invalidUsername: rows.filter((row) => row.diagnosticCategory === "INVALID_USERNAME").length,
        verificationRequired: rows.filter((row) => row.diagnosticCategory === "VERIFICATION_REQUIRED").length,
        blockedOrChanged: rows.filter((row) => row.diagnosticCategory === "BLOCKED_OR_CHANGED").length,
        parseFailed: rows.filter((row) => row.diagnosticCategory === "PARSE_FAILED").length,
        navigationFailed: rows.filter((row) => row.diagnosticCategory === "NAVIGATION_FAILED").length,
      },
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
