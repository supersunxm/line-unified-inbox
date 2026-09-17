import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient } from "@prisma/client";

import {
  loadTargetTikTokAccounts,
  normalizeTikTokUsername,
} from "./sheet-reader.mjs";
import { extractAccountMetrics } from "./tokcounter-extractor.mjs";
import {
  getProductionPrismaClient,
  maskDatabaseUrl,
} from "../weekly-collector/db-credential-helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const LOCAL_DATA_DIR = path.resolve(BACKEND_DIR, "local-data");
const LOCK_FILE_PATH = path.join(LOCAL_DATA_DIR, "tiktok-public-daily.lock");
const STATE_FILE_PATH = path.join(LOCAL_DATA_DIR, "tiktok-public-daily-state.json");
const LOG_DIR_PATH = path.join(LOCAL_DATA_DIR, "tiktok-public-collector", "logs");

// Ensure directories exist
for (const dir of [LOCAL_DATA_DIR, LOG_DIR_PATH]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Structured logger writing to console and log file with credential scrubbing.
 */
class CollectorLogger {
  constructor(targetDate) {
    this.targetDate = targetDate || "general";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(LOG_DIR_PATH, `daily-collector-${this.targetDate}-${ts}.log`);
    this.stream = fs.createWriteStream(this.logFile, { flags: "a" });
  }

  scrub(message) {
    if (typeof message !== "string") {
      try {
        message = JSON.stringify(message);
      } catch {
        message = String(message);
      }
    }
    return message
      .replace(/postgresql:\/\/[^@\s]+@[^\s/]+/gi, (m) => maskDatabaseUrl(m))
      .replace(/(password|token|secret|cookie|key)=([^&\s]+)/gi, "$1=[REDACTED]");
  }

  log(...args) {
    const text = args.map((a) => this.scrub(a)).join(" ");
    const line = `[${new Date().toISOString()}] ${text}`;
    console.log(text);
    this.stream.write(line + "\n");
  }

  warn(...args) {
    const text = args.map((a) => this.scrub(a)).join(" ");
    const line = `[${new Date().toISOString()}] [WARN] ${text}`;
    console.warn(text);
    this.stream.write(line + "\n");
  }

  error(...args) {
    const text = args.map((a) => this.scrub(a)).join(" ");
    const line = `[${new Date().toISOString()}] [ERROR] ${text}`;
    console.error(text);
    this.stream.write(line + "\n");
  }

  close() {
    this.stream.end();
  }
}

/**
 * Process Lock Manager to prevent overlapping collector runs.
 * Detects and clears stale locks from dead PIDs.
 */
export class LockManager {
  static acquire(logger, targetDate) {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(LOCK_FILE_PATH, "utf8");
        const lockData = JSON.parse(raw);
        const pid = lockData.pid;

        let isAlive = false;
        try {
          process.kill(pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }

        if (isAlive) {
          logger.warn(
            `[LOCK] Active collector PID ${pid} running since ${lockData.startedAt}. Exiting cleanly without overlapping.`
          );
          return false;
        }

        logger.warn(`[LOCK] Clearing stale lock from dead PID ${pid} (startedAt: ${lockData.startedAt}).`);
        fs.unlinkSync(LOCK_FILE_PATH);
      } catch (err) {
        logger.warn(`[LOCK] Failed to inspect existing lock file: ${err.message}. Removing.`);
        try {
          fs.unlinkSync(LOCK_FILE_PATH);
        } catch {}
      }
    }

    const payload = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      targetDate,
    };
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(payload, null, 2), "utf8");
    return true;
  }

  static release(logger) {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        fs.unlinkSync(LOCK_FILE_PATH);
        logger.log("[LOCK] Lock released successfully.");
      } catch (err) {
        logger.error(`[LOCK] Failed to release lock: ${err.message}`);
      }
    }
  }
}

/**
 * Local durable state manager (tiktok-public-daily-state.json).
 */
export class StateManager {
  static load() {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      return {
        lastSuccessfulMetricDate: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        status: null,
        totalUniqueAccounts: 0,
        successAccounts: 0,
        failedAccounts: 0,
        unresolvedUsernames: [],
      };
    }
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE_PATH, "utf8"));
    } catch {
      return {};
    }
  }

  static save(state) {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
  }
}

/**
 * Resolves current Bangkok date YYYY-MM-DD.
 */
export function getBangkokDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Adds or subtracts days in Bangkok timezone.
 */
export function offsetBangkokDate(dateStr, dayDelta) {
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + dayDelta));
  return date.toISOString().slice(0, 10);
}

/**
 * Determines default target metric date based on current Bangkok hour.
 * For early morning runs (e.g. 01:30), target is yesterday's completed date.
 * For afternoon/evening runs, target is today's date.
 */
export function resolveDefaultMetricDate(refDate = new Date()) {
  const bkkHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hourCycle: "h23",
    }).format(refDate),
    10
  );

  const todayBkk = getBangkokDate(refDate);
  if (bkkHour < 12) {
    return offsetBangkokDate(todayBkk, -1);
  }
  return todayBkk;
}

/**
 * Calculates conservative pacing delay with jitter between requests (default 8–15s).
 */
export function calculatePacingDelayMs(minMs = 8000, maxMs = 15000) {
  const min = Math.max(0, minMs);
  const max = Math.max(min, maxMs);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * CLI parser.
 */
function parseArgs(argv) {
  let headless = true;
  let metricDate = null;
  let dryRun = false;
  let limit = null;
  let filterUsername = null;
  let filterStoreId = null;
  let force = false;
  let minDelayMs = 8000;
  let maxDelayMs = 15000;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--headless" && argv[i + 1]) {
      headless = argv[i + 1].toLowerCase() !== "false";
      i++;
    } else if (arg === "--metricDate" && argv[i + 1]) {
      metricDate = argv[i + 1].trim();
      i++;
    } else if (arg === "--dryRun") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--limit" && argv[i + 1]) {
      limit = parseInt(argv[i + 1], 10);
      i++;
    } else if (arg === "--username" && argv[i + 1]) {
      filterUsername = normalizeTikTokUsername(argv[i + 1]);
      i++;
    } else if (arg === "--storeId" && argv[i + 1]) {
      filterStoreId = argv[i + 1].trim();
      i++;
    } else if (arg === "--minDelay" && argv[i + 1]) {
      minDelayMs = parseInt(argv[i + 1], 10);
      i++;
    } else if (arg === "--maxDelay" && argv[i + 1]) {
      maxDelayMs = parseInt(argv[i + 1], 10);
      i++;
    }
  }

  return { headless, metricDate, dryRun, force, limit, filterUsername, filterStoreId, minDelayMs, maxDelayMs };
}

/**
 * Main Daily Collector Execution
 */
export async function runDailyCollector(cliOptions = {}) {
  const referenceNow = new Date();
  const targetMetricDate = cliOptions.metricDate || resolveDefaultMetricDate(referenceNow);
  const logger = new CollectorLogger(targetMetricDate);

  logger.log("==================================================");
  logger.log(`TikTok Public Daily Collector starting...`);
  logger.log(`Reference timestamp: ${referenceNow.toISOString()}`);
  logger.log(`Target metric date:   ${targetMetricDate}`);
  logger.log(`Dry run mode:         ${cliOptions.dryRun ? "YES" : "NO"}`);
  logger.log("==================================================");

  // Acquire Lock
  const lockAcquired = LockManager.acquire(logger, targetMetricDate);
  if (!lockAcquired) {
    logger.close();
    return { status: "LOCKED", success: false };
  }

  let prisma = null;
  let browser = null;
  const startTime = Date.now();

  try {
    // 1. Fetch Target Accounts from Google Sheet
    logger.log("Fetching account catalog from Google Sheet...");
    const sheetData = await loadTargetTikTokAccounts();
    logger.log(
      `Sheet parsed: ${sheetData.totalStoreRows} store rows, ${sheetData.rowsWithTiktok} with TikTok, ${sheetData.uniqueAccountsCount} unique accounts, ${sheetData.duplicateGroupsCount} duplicate groups, ${sheetData.blankOrInvalid} blank/invalid.`
    );

    let targets = sheetData.uniqueAccounts;

    // Apply CLI filters if requested
    if (cliOptions.filterUsername) {
      targets = targets.filter((t) => t.username === cliOptions.filterUsername);
      logger.log(`Filtered to single username: ${cliOptions.filterUsername}`);
    } else if (cliOptions.filterStoreId) {
      targets = targets.filter((t) => t.stores.some((s) => s.storeId === cliOptions.filterStoreId));
      logger.log(`Filtered to single storeId: ${cliOptions.filterStoreId}`);
    }

    if (cliOptions.limit && cliOptions.limit > 0) {
      targets = targets.slice(0, cliOptions.limit);
      logger.log(`Limited execution to ${targets.length} accounts.`);
    }

    if (!cliOptions.dryRun) {
      prisma = getProductionPrismaClient();
      await prisma.$connect();
      logger.log("Connected to PostgreSQL production database.");
    }

    // Check already collected accounts for targetMetricDate to enable graceful resume
    const alreadyCollectedUsernames = new Set();
    if (!cliOptions.dryRun && prisma && !cliOptions.force) {
      try {
        const metricDateObj = new Date(`${targetMetricDate}T00:00:00.000Z`);
        const existingMetrics = await prisma.tikTokPublicDailyMetric.findMany({
          where: { metricDate: metricDateObj },
          select: {
            tiktokPublicAccount: { select: { username: true } },
          },
        });
        for (const m of existingMetrics) {
          if (m.tiktokPublicAccount?.username) {
            alreadyCollectedUsernames.add(m.tiktokPublicAccount.username);
          }
        }
        if (alreadyCollectedUsernames.size > 0) {
          logger.log(
            `Found ${alreadyCollectedUsernames.size} accounts already collected for ${targetMetricDate}; will skip them (use --force to re-collect).`
          );
        }
      } catch (err) {
        logger.warn(`Could not check existing metrics: ${err.message}`);
      }
    }

    // 2. Launch single Playwright Chromium browser instance
    logger.log("Launching local Playwright Chromium instance...");
    browser = await chromium.launch({
      headless: cliOptions.headless ?? true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    const page = await context.newPage();

    const results = [];
    const successfulAccounts = [];
    const failedAccounts = [];

    // 3. Sequential Collection Loop
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];
      const progressLabel = `[${index + 1}/${targets.length}]`;
      logger.log(`${progressLabel} Collecting @${target.username} (stores: ${target.stores.map((s) => s.storeId).join(", ")})...`);

      // Skip if already collected for targetMetricDate
      if (alreadyCollectedUsernames.has(target.username)) {
        logger.log(`${progressLabel} Skipping @${target.username} (already collected for ${targetMetricDate}).`);
        successfulAccounts.push({
          username: target.username,
          stores: target.stores,
          followers: null,
          precision: "EXACT",
          durationMs: 0,
        });
        continue;
      }

      let extraction = await extractAccountMetrics(page, target.username, { timeoutMs: 25000 });

      // Handle Rate Limit with cooldown backoff and retry
      if (extraction.status === "RATE_LIMITED") {
        logger.warn(
          `  -> RATE LIMITED by TokCounter! Pausing collector for 60s cooldown before retrying @${target.username}...`
        );
        await new Promise((resolve) => setTimeout(resolve, 60000));
        logger.log(`  -> Retrying @${target.username} after cooldown...`);
        const retryExtraction = await extractAccountMetrics(page, target.username, { timeoutMs: 25000 });
        if (retryExtraction.status === "SUCCESS") {
          extraction = retryExtraction;
        } else {
          logger.warn(
            `  -> TokCounter rate limit remains active after cooldown. Halting current run to prevent hammering.`
          );
          failedAccounts.push({
            username: target.username,
            stores: target.stores,
            status: "RATE_LIMITED",
            error: extraction.error || "TokCounter API returned 403 Forbidden / Rate Limit",
            durationMs: extraction.durationMs,
          });
          results.push({ target, extraction });

          // Mark remaining targets as RATE_LIMITED without sending futile requests
          for (let remIdx = index + 1; remIdx < targets.length; remIdx++) {
            const remTarget = targets[remIdx];
            if (!alreadyCollectedUsernames.has(remTarget.username)) {
              failedAccounts.push({
                username: remTarget.username,
                stores: remTarget.stores,
                status: "RATE_LIMITED",
                error: "Run halted due to active TokCounter IP rate limit",
                durationMs: 0,
              });
              results.push({
                target: remTarget,
                extraction: {
                  status: "RATE_LIMITED",
                  username: remTarget.username,
                  error: "Run halted due to active TokCounter IP rate limit",
                  durationMs: 0,
                },
              });
            } else {
              successfulAccounts.push({
                username: remTarget.username,
                stores: remTarget.stores,
                followers: null,
                precision: "EXACT",
                durationMs: 0,
              });
            }
          }
          break; // Stop loop cleanly
        }
      }

      if (extraction.status === "SUCCESS") {
        logger.log(
          `  -> SUCCESS: ${extraction.followerCount} followers (${extraction.precision}), ${extraction.followingCount} following, ${extraction.likesCount} likes (DOM), ${extraction.videoCount} videos (${extraction.durationMs}ms)`
        );

        // Database persistence
        if (!cliOptions.dryRun && prisma) {
          try {
            // Upsert TikTokPublicAccount
            const publicAccount = await prisma.tikTokPublicAccount.upsert({
              where: { username: target.username },
              create: {
                username: target.username,
                displayName: extraction.displayName || null,
                profileUrl: target.profileUrl,
                source: "TOKCOUNTER",
                firstSeenAt: referenceNow,
                lastCollectedAt: referenceNow,
              },
              update: {
                displayName: extraction.displayName || undefined,
                profileUrl: target.profileUrl,
                lastCollectedAt: referenceNow,
              },
            });

            // Map associated StoreMaster rows
            const storeIds = target.stores.map((s) => s.storeId).filter(Boolean);
            if (storeIds.length > 0) {
              await prisma.storeMaster.updateMany({
                where: { externalStoreId: { in: storeIds } },
                data: {
                  tiktokPublicAccountId: publicAccount.id,
                  tiktokUsername: target.username,
                  tiktokProfileUrl: target.profileUrl,
                },
              });
            }

            // Upsert TikTokPublicDailyMetric (unique on accountId + metricDate)
            const metricDateObj = new Date(`${targetMetricDate}T00:00:00.000Z`);
            await prisma.tikTokPublicDailyMetric.upsert({
              where: {
                tiktokPublicAccountId_metricDate: {
                  tiktokPublicAccountId: publicAccount.id,
                  metricDate: metricDateObj,
                },
              },
              create: {
                tiktokPublicAccountId: publicAccount.id,
                metricDate: metricDateObj,
                followerCount: extraction.followerCount,
                followingCount: extraction.followingCount,
                likesCount: extraction.likesCount,
                videoCount: extraction.videoCount,
                followersRaw: extraction.followersRaw,
                followingRaw: extraction.followingRaw,
                likesRaw: extraction.likesRaw,
                videosRaw: extraction.videosRaw,
                precision: extraction.precision,
                source: "TOKCOUNTER",
                collectedAt: referenceNow,
              },
              update: {
                followerCount: extraction.followerCount,
                followingCount: extraction.followingCount,
                likesCount: extraction.likesCount,
                videoCount: extraction.videoCount,
                followersRaw: extraction.followersRaw,
                followingRaw: extraction.followingRaw,
                likesRaw: extraction.likesRaw,
                videosRaw: extraction.videosRaw,
                precision: extraction.precision,
                source: "TOKCOUNTER",
                collectedAt: referenceNow,
              },
            });
          } catch (dbErr) {
            logger.error(`  -> DB PERSISTENCE ERROR for @${target.username}: ${dbErr.message}`);
          }
        }

        successfulAccounts.push({
          username: target.username,
          stores: target.stores,
          followers: extraction.followerCount,
          precision: extraction.precision,
          durationMs: extraction.durationMs,
        });
      } else {
        logger.warn(
          `  -> FAILED: status=${extraction.status}, error=${extraction.error || "unknown"} (${extraction.durationMs}ms)`
        );
        failedAccounts.push({
          username: target.username,
          stores: target.stores,
          status: extraction.status,
          error: extraction.error,
          durationMs: extraction.durationMs,
        });
      }

      results.push({
        target,
        extraction,
      });

      // Conservative pacing between sequential account navigations (8–15s jitter)
      if (index < targets.length - 1) {
        const delayMs = calculatePacingDelayMs(cliOptions.minDelayMs || 8000, cliOptions.maxDelayMs || 15000);
        logger.log(`  -> Conservative pause: waiting ${(delayMs / 1000).toFixed(1)}s before next account...`);
        await page.waitForTimeout(delayMs);
      }
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const overallStatus =
      failedAccounts.length === 0
        ? "SUCCESS"
        : successfulAccounts.length > 0
        ? "PARTIAL_SUCCESS"
        : "FAILED";

    logger.log("==================================================");
    logger.log(`COLLECTOR RUN SUMMARY [${overallStatus}]`);
    logger.log(`Total Target Accounts: ${targets.length}`);
    logger.log(`Successful Accounts:   ${successfulAccounts.length}`);
    logger.log(`Failed Accounts:       ${failedAccounts.length}`);
    logger.log(`Elapsed Time:          ${elapsedSeconds}s (avg ${(elapsedSeconds / targets.length).toFixed(2)}s/account)`);
    logger.log("==================================================");

    if (failedAccounts.length > 0) {
      logger.warn("Failed accounts breakdown:");
      for (const f of failedAccounts) {
        logger.warn(`  - @${f.username} (stores: ${f.stores.map((s) => s.storeId).join(",")}): ${f.status} (${f.error})`);
      }
    }

    // 4. Update Durable State
    if (!cliOptions.dryRun) {
      const state = {
        lastSuccessfulMetricDate:
          overallStatus === "SUCCESS" || overallStatus === "PARTIAL_SUCCESS"
            ? targetMetricDate
            : StateManager.load().lastSuccessfulMetricDate,
        lastRunStartedAt: referenceNow.toISOString(),
        lastRunCompletedAt: new Date().toISOString(),
        status: overallStatus,
        totalUniqueAccounts: targets.length,
        successAccounts: successfulAccounts.length,
        failedAccounts: failedAccounts.length,
        unresolvedUsernames: failedAccounts.map((f) => f.username),
      };
      StateManager.save(state);
      logger.log(`Saved state to ${STATE_FILE_PATH}`);
    }

    return {
      status: overallStatus,
      success: overallStatus === "SUCCESS" || overallStatus === "PARTIAL_SUCCESS",
      metricDate: targetMetricDate,
      totalTargets: targets.length,
      successCount: successfulAccounts.length,
      failedCount: failedAccounts.length,
      elapsedSeconds,
      successfulAccounts,
      failedAccounts,
    };
  } catch (err) {
    logger.error(`Fatal collector error: ${err.message}\n${err.stack}`);
    return {
      status: "FATAL_ERROR",
      success: false,
      error: err.message,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {}
    }
    LockManager.release(logger);
    logger.close();
  }
}

// Direct CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith("run-daily-collector.mjs")) {
  const options = parseArgs(process.argv.slice(2));
  runDailyCollector(options)
    .then((summary) => {
      if (!summary.success) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("Execution error:", err);
      process.exitCode = 1;
    });
}
