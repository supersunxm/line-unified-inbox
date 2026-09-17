import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "playwright";
const { chromium } = playwright;
import { GoogleReviewPeriodStatus } from "@prisma/client";

import {
  collectStoreContinuous,
  getTodayBangkokDate,
} from "./continuous-collector.mjs";
import {
  offsetBangkokDate,
  resolveWeekNumberFromDate,
  getWeekDateBoundaries,
} from "./date-classifier.mjs";
import {
  buildGoogleReviewLaunchOptions,
  resolveGoogleReviewProfileDir,
} from "./browser-runtime-config.mjs";
import {
  getProductionPrismaClient,
  maskDatabaseUrl,
  resolveProductionDatabaseUrl,
} from "./db-credential-helper.mjs";
import {
  upsertDailyByReviewDate,
  refreshWeeklyStoreTotal,
} from "./run-single-cycle.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../..");
const LOCAL_DATA_DIR = path.resolve(BACKEND_DIR, "local-data");
const LOCK_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily.lock");
const STATE_FILE_PATH = path.join(LOCAL_DATA_DIR, "google-review-daily-state.json");
const LOG_DIR_PATH = path.join(LOCAL_DATA_DIR, "google-review-collector", "logs");

// Ensure required local-data directories exist
for (const dir of [LOCAL_DATA_DIR, LOG_DIR_PATH]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Structured logger that writes to both console and a date-specific log file.
 * Automatically scrubs sensitive keywords and never prints credentials.
 */
class CollectorLogger {
  constructor(targetDate) {
    this.targetDate = targetDate;
    const dateStr = targetDate || "general";
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(LOG_DIR_PATH, `daily-collector-${dateStr}-${ts}.log`);
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
 * Atomic process lock manager to prevent concurrent collector runs.
 */
class LockManager {
  static acquire(logger, targetDate) {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(LOCK_FILE_PATH, "utf8");
        const lockData = JSON.parse(raw);
        const pid = lockData.pid;

        // Check if process is still running
        let isAlive = false;
        try {
          process.kill(pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }

        if (isAlive) {
          logger.warn(`[LOCK] Active collector process PID ${pid} running since ${lockData.startedAt}. Exiting cleanly without overlapping.`);
          process.exit(0);
        } else {
          logger.warn(`[LOCK] Removing stale lock file from inactive PID ${pid} (started: ${lockData.startedAt}).`);
          fs.unlinkSync(LOCK_FILE_PATH);
        }
      } catch (err) {
        logger.warn(`[LOCK] Corrupt lock file detected. Removing: ${err.message}`);
        try {
          fs.unlinkSync(LOCK_FILE_PATH);
        } catch {}
      }
    }

    const currentLock = {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      targetDate,
    };
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(currentLock, null, 2), "utf8");

    const cleanup = () => {
      try {
        if (fs.existsSync(LOCK_FILE_PATH)) {
          const raw = fs.readFileSync(LOCK_FILE_PATH, "utf8");
          const data = JSON.parse(raw);
          if (data.pid === process.pid) {
            fs.unlinkSync(LOCK_FILE_PATH);
          }
        }
      } catch {}
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => { cleanup(); process.exit(130); });
    process.on("SIGTERM", () => { cleanup(); process.exit(143); });
  }

  static release() {
    try {
      if (fs.existsSync(LOCK_FILE_PATH)) {
        const raw = fs.readFileSync(LOCK_FILE_PATH, "utf8");
        const data = JSON.parse(raw);
        if (data.pid === process.pid) {
          fs.unlinkSync(LOCK_FILE_PATH);
        }
      }
    } catch {}
  }
}

/**
 * Manages durable local success state outside git.
 */
export class StateManager {
  static load() {
    if (!fs.existsSync(STATE_FILE_PATH)) {
      return {
        lastSuccessfulReviewDate: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        status: "IDLE",
        storesAccounted: 0,
        qualifiedAdded: 0,
        fingerprintsAdded: 0,
        history: {},
      };
    }
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE_PATH, "utf8"));
    } catch {
      return {
        lastSuccessfulReviewDate: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        status: "IDLE",
        storesAccounted: 0,
        qualifiedAdded: 0,
        fingerprintsAdded: 0,
        history: {},
      };
    }
  }

  static recordSuccess({
    targetDate,
    startedAt,
    completedAt,
    storesAccounted,
    qualifiedAdded,
    fingerprintsAdded,
  }) {
    const state = StateManager.load();
    state.lastSuccessfulReviewDate = targetDate;
    state.lastRunStartedAt = startedAt;
    state.lastRunCompletedAt = completedAt;
    state.status = "SUCCESS";
    state.storesAccounted = storesAccounted;
    state.qualifiedAdded = qualifiedAdded;
    state.fingerprintsAdded = fingerprintsAdded;
    if (!state.history) state.history = {};
    state.history[targetDate] = {
      status: "SUCCESS",
      completedAt,
      storesAccounted,
      qualifiedAdded,
      fingerprintsAdded,
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
  }

  static isDateCompleted(targetDate) {
    const state = StateManager.load();
    return state.history?.[targetDate]?.status === "SUCCESS";
  }
}

/**
 * Resolves missing completed Bangkok dates for the current OPEN week and previous week boundary.
 */
export async function resolveMissingCompletedDates(prisma, referenceNow) {
  const todayBangkok = getTodayBangkokDate(referenceNow);
  const yesterdayBangkok = offsetBangkokDate(todayBangkok, -1);
  const currentWeekNumber = resolveWeekNumberFromDate(todayBangkok);
  const yesterdayWeekNumber = resolveWeekNumberFromDate(yesterdayBangkok);

  const missingDates = [];

  // 1. Check yesterdayBangkok first if it belongs to the immediately previous week (e.g. Week 3 when today is Week 4)
  if (yesterdayWeekNumber === currentWeekNumber - 1) {
    const isCompletedInState = StateManager.isDateCompleted(yesterdayBangkok);
    if (!isCompletedInState) {
      const prevWeekPeriod = await prisma.googleReviewWeeklyPeriod.findUnique({
        where: { weekNumber: yesterdayWeekNumber },
      });
      const dbCount = prevWeekPeriod
        ? await prisma.googleReviewDailyKpi.count({
            where: {
              date: yesterdayBangkok,
              weekPeriodId: prevWeekPeriod.id,
            },
          })
        : 0;

      if (dbCount > 0) {
        // Daily KPI row already exists in DB; reconcile local state
        StateManager.recordSuccess({
          targetDate: yesterdayBangkok,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          storesAccounted: 65,
          qualifiedAdded: 0,
          fingerprintsAdded: 0,
        });
      } else {
        missingDates.push(yesterdayBangkok);
      }
    }
  }

  // 2. Retrieve current open week period and candidate dates up to yesterdayBangkok
  const openPeriod = await prisma.googleReviewWeeklyPeriod.findUnique({
    where: { weekNumber: currentWeekNumber },
  });

  if (openPeriod && openPeriod.status === GoogleReviewPeriodStatus.OPEN) {
    const boundaries = getWeekDateBoundaries(currentWeekNumber);
    const startDate = boundaries.startDate;

    const candidateDates = [];
    let cur = startDate;
    while (cur <= yesterdayBangkok) {
      candidateDates.push(cur);
      cur = offsetBangkokDate(cur, 1);
    }

    if (candidateDates.length > 0) {
      const existingDailies = await prisma.googleReviewDailyKpi.groupBy({
        by: ["date"],
        _count: { storeCode: true },
        where: {
          date: { in: candidateDates },
          weekPeriodId: openPeriod.id,
        },
      });

      const dbDateCountMap = new Map();
      for (const d of existingDailies) {
        dbDateCountMap.set(d.date, d._count.storeCode);
      }

      for (const date of candidateDates) {
        const isCompletedInState = StateManager.isDateCompleted(date);
        const dbCount = dbDateCountMap.get(date) || 0;

        if (isCompletedInState) {
          continue;
        }

        if (dbCount > 0) {
          StateManager.recordSuccess({
            targetDate: date,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            storesAccounted: 65,
            qualifiedAdded: 0,
            fingerprintsAdded: 0,
          });
          continue;
        }

        missingDates.push(date);
      }
    }
  }

  // Deduplicate and return chronologically sorted (oldest -> newest)
  return Array.from(new Set(missingDates)).sort((a, b) => a.localeCompare(b));
}

/**
 * Runs collection and persistence for one target Bangkok date across all 65 stores.
 */
export async function runCollectionForDate({
  targetDate,
  referenceNow,
  prisma,
  logger,
  options = {},
}) {
  const startedAt = new Date().toISOString();
  const targetWeekNumber = resolveWeekNumberFromDate(targetDate);
  const boundaries = getWeekDateBoundaries(targetWeekNumber);

  const todayBangkok = getTodayBangkokDate(referenceNow);
  const yesterdayBangkok = offsetBangkokDate(todayBangkok, -1);
  const currentWeekNumber = resolveWeekNumberFromDate(todayBangkok);

  const isAllowedPrevWeek = Boolean(
    options.allowPreviousWeekFinalization &&
    targetDate === yesterdayBangkok &&
    targetWeekNumber === currentWeekNumber - 1
  );

  logger.log("================================================================================");
  logger.log(` LOCAL DAILY GOOGLE REVIEW COLLECTOR - TARGET DATE: ${targetDate} (WEEK ${targetWeekNumber})`);
  logger.log(` REFERENCE_NOW (FROZEN): ${referenceNow.toISOString()}`);
  logger.log(` Target Week Boundaries: [${boundaries.startDate}, ${boundaries.endDateExclusive})`);
  logger.log(` Profile Dir: ${resolveGoogleReviewProfileDir()}`);
  if (isAllowedPrevWeek) {
    logger.log(" [WEEK-BOUNDARY] Safe previous-week finalization authorized for yesterday's closed week.");
  }
  logger.log(" Invariant: Respect existing fingerprint.reviewDate authority; never double-count.");
  logger.log("================================================================================\n");

  const weekPeriod = await prisma.googleReviewWeeklyPeriod.findUnique({
    where: { weekNumber: targetWeekNumber },
  });
  if (!weekPeriod) {
    throw new Error(`Weekly Period for Week ${targetWeekNumber} not found!`);
  }
  if (!options.forceReconcile && !isAllowedPrevWeek && weekPeriod.status === GoogleReviewPeriodStatus.CLOSED) {
    throw new Error(`Cannot collect into CLOSED Week ${targetWeekNumber} period!`);
  }

  // Load active memberships (must be 65)
  let memberships = await prisma.googleReviewWeeklyStoreMembership.findMany({
    where: { isActive: true },
    orderBy: { storeCode: "asc" },
    include: {
      store: {
        include: {
          storeMaster: true,
        },
      },
    },
  });

  if (memberships.length !== 65) {
    throw new Error(`Expected exactly 65 active weekly stores, found ${memberships.length}!`);
  }

  // If sentinel-only mode requested, filter to CentralWorld 25610
  if (options.sentinelOnly) {
    logger.log("[SENTINEL MODE] Running ONLY CentralWorld (25610)...");
    memberships = memberships.filter((m) => m.storeCode === "25610");
  }

  // Launch Playwright with persistent Chrome profile
  const launchOptions = buildGoogleReviewLaunchOptions(process.env, {
    headless: options.headless !== undefined ? options.headless : undefined,
  });
  const persistentProfileDir = resolveGoogleReviewProfileDir();
  logger.log(`Launching Chromium (headless=${launchOptions.headless}) with profile: ${persistentProfileDir}`);

  const context = await chromium.launchPersistentContext(persistentProfileDir, launchOptions);
  const page = context.pages()[0] || (await context.newPage());

  const resultsByStore = new Map();
  const failedStores = [];
  let consecutiveSameError = { error: null, count: 0 };

  const scanStore = async (membership, isRetry = false) => {
    const storeCode = membership.storeCode;
    const store = membership.store;
    const storeMaster = store?.storeMaster;
    const storeName = storeMaster?.storeName || store?.name || `Store ${storeCode}`;
    const googleMapsUrl = storeMaster?.googleMapsUrl?.trim();

    if (!googleMapsUrl) {
      logger.warn(`  [WARN] Store ${storeCode} has no Maps URL. Skipping.`);
      return { storeCode, stopReason: "NO_MAPS_URL" };
    }

    const res = await collectStoreContinuous(
      page,
      {
        storeCode,
        storeId: store?.id || null,
        storeName,
        googleMapsUrl,
      },
      {
        referenceNow,
        todayBangkok: getTodayBangkokDate(referenceNow),
        targetWeekNumber,
        targetReviewDateOnly: targetDate,
        prismaClient: prisma,
        dryRun: options.dryRun || false,
      }
    );

    return res;
  };

  try {
    // Pass 1: Scan stores
    for (let i = 0; i < memberships.length; i++) {
      const membership = memberships[i];
      const storeCode = membership.storeCode;
      const storeName = membership.store?.storeMaster?.storeName || `Store ${storeCode}`;
      logger.log(`\n>>> [${i + 1}/${memberships.length}] Scanning: ${storeCode} (${storeName})`);

      const res = await scanStore(membership);
      resultsByStore.set(storeCode, { membership, res });

      const isError = res.stopReason?.startsWith("ERROR");
      if (isError) {
        failedStores.push(membership);
        logger.warn(`  [FAIL] Store ${storeCode} failed: ${res.stopReason}`);

        if (consecutiveSameError.error === res.stopReason) {
          consecutiveSameError.count++;
        } else {
          consecutiveSameError = { error: res.stopReason, count: 1 };
        }

        // Systemic Guard 1: 5 consecutive identical errors
        if (consecutiveSameError.count >= 5) {
          throw new Error(`[SYSTEMIC FAILURE] 5 consecutive stores failed with: ${consecutiveSameError.error}`);
        }

        // Systemic Guard 2: >= 20% overall failure rate after at least 10 stores
        const totalScanned = i + 1;
        const failRate = failedStores.length / totalScanned;
        if (totalScanned >= 10 && failRate >= 0.2) {
          throw new Error(`[SYSTEMIC FAILURE] Failure rate reached ${(failRate * 100).toFixed(1)}% (${failedStores.length}/${totalScanned} failed)`);
        }
      } else {
        consecutiveSameError = { error: null, count: 0 };
      }

      await page.waitForTimeout(400);
    }

    // Pass 2: Retry failed stores once if failure count is low (< 5)
    if (failedStores.length > 0 && failedStores.length < 5) {
      logger.log(`\n[RETRY PASS] Retrying ${failedStores.length} failed store(s)...`);
      const stillFailed = [];
      for (const membership of failedStores) {
        logger.log(`  Retrying store ${membership.storeCode}...`);
        await page.waitForTimeout(2000);
        const retryRes = await scanStore(membership, true);
        if (!retryRes.stopReason?.startsWith("ERROR")) {
          logger.log(`  [RETRY SUCCESS] Store ${membership.storeCode} recovered: ${retryRes.stopReason}`);
          resultsByStore.set(membership.storeCode, { membership, res: retryRes });
        } else {
          logger.warn(`  [RETRY FAIL] Store ${membership.storeCode} still failing: ${retryRes.stopReason}`);
          stillFailed.push(membership.storeCode);
        }
      }
      if (stillFailed.length > 0) {
        logger.warn(`[RETRY SUMMARY] Stores still failed after retry: ${stillFailed.join(", ")}`);
      }
    }
  } finally {
    await context.close();
  }

  // Tally scan outcomes
  let storesAccounted = 0;
  let totalNewQualifiedForTargetDate = 0;
  let totalFingerprintsAdded = 0;
  const unresolvedStores = [];

  for (const [storeCode, { res }] of resultsByStore.entries()) {
    if (res.stopReason?.startsWith("ERROR")) {
      unresolvedStores.push(storeCode);
    } else {
      storesAccounted++;
      const targetStats = res.newReviewStatsByDate?.[targetDate];
      if (targetStats) {
        totalNewQualifiedForTargetDate += targetStats.newQualifiedReviews || 0;
        totalFingerprintsAdded += targetStats.newReviewsDiscovered || 0;
      }
    }
  }

  logger.log(`\n--------------------------------------------------------------------------------`);
  logger.log(`Scan Results for ${targetDate}:`);
  logger.log(`  Stores Accounted: ${storesAccounted}/${memberships.length}`);
  logger.log(`  Unresolved Errors: ${unresolvedStores.length} (${unresolvedStores.join(", ") || "none"})`);
  logger.log(`  Target Date Qualified Discovered: ${totalNewQualifiedForTargetDate}`);
  logger.log(`--------------------------------------------------------------------------------\n`);

  // Guard: if not all stores accounted for and not in sentinel mode, fail closed
  if (!options.sentinelOnly && storesAccounted !== 65) {
    throw new Error(`Incomplete scan: only ${storesAccounted}/65 stores accounted for. Refusing to mark complete.`);
  }

  // Mutate Daily & Weekly KPIs in database
  if (!options.dryRun) {
    logger.log(`Persisting Daily KPI records for review date ${targetDate}...`);
    for (const [storeCode, { membership, res }] of resultsByStore.entries()) {
      const targetStats = res.newReviewStatsByDate?.[targetDate] || {
        reviewsChecked: 0,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        newReviewsDiscovered: 0,
        newQualifiedReviews: 0,
      };

      await upsertDailyByReviewDate({
        storeCode,
        storeId: membership.storeId,
        storeRating: res.storeRating,
        weekPeriodId: weekPeriod.id,
        weekNumber: targetWeekNumber,
        reviewDate: targetDate,
        stats: targetStats,
        prismaClient: prisma,
      });

      await refreshWeeklyStoreTotal({
        storeCode,
        storeId: membership.storeId,
        storeRating: res.storeRating,
        weekPeriodId: weekPeriod.id,
        weekNumber: targetWeekNumber,
        prismaClient: prisma,
      });
    }

    // Re-rank weekly stores
    logger.log(`Re-ranking stores for Week ${targetWeekNumber}...`);
    const allWeekly = await prisma.googleReviewWeeklyKpi.findMany({
      where: { weekPeriodId: weekPeriod.id },
    });

    allWeekly.sort((a, b) => {
      const aEligible = a.storeRating !== null ? a.storeRating > 4.8 : false;
      const bEligible = b.storeRating !== null ? b.storeRating > 4.8 : false;
      if (aEligible !== bEligible) return aEligible ? -1 : 1;
      if (b.qualifiedReviews !== a.qualifiedReviews) return b.qualifiedReviews - a.qualifiedReviews;
      return a.storeCode.localeCompare(b.storeCode);
    });

    for (let rank = 1; rank <= allWeekly.length; rank++) {
      await prisma.googleReviewWeeklyKpi.update({
        where: { id: allWeekly[rank - 1].id },
        data: { rank },
      });
    }
  }

  // Postflight verification
  logger.log("\nRunning Postflight Reconciliation & Invariant Checks...");
  const postflight = await runPostflightVerification(prisma, targetDate, targetWeekNumber);
  logger.log("Postflight Verification Results:", JSON.stringify(postflight, null, 2));

  if (!postflight.passed) {
    throw new Error(`Postflight check failed: ${JSON.stringify(postflight.failures)}`);
  }

  const completedAt = new Date().toISOString();
  if (!options.dryRun && !options.sentinelOnly) {
    StateManager.recordSuccess({
      targetDate,
      startedAt,
      completedAt,
      storesAccounted,
      qualifiedAdded: totalNewQualifiedForTargetDate,
      fingerprintsAdded: totalFingerprintsAdded,
    });
    logger.log(`[SUCCESS MARKER] Recorded SUCCESS for ${targetDate} in state file.`);
  }

  return {
    targetDate,
    storesAccounted,
    totalNewQualifiedForTargetDate,
    totalFingerprintsAdded,
    postflight,
  };
}

/**
 * Strict postflight database invariant verifier.
 */
export async function runPostflightVerification(prisma, targetDate, targetWeekNumber) {
  const failures = [];

  // Invariant 1: Duplicate fingerprints count must be exactly 0
  const duplicates = await prisma.$queryRaw`
    SELECT fingerprint, COUNT(*) as c
    FROM "GoogleReviewFingerprint"
    GROUP BY fingerprint
    HAVING COUNT(*) > 1
  `;
  const dupCount = Array.isArray(duplicates) ? duplicates.length : 0;
  if (dupCount !== 0) {
    failures.push(`Duplicate fingerprints detected in database: count=${dupCount}`);
  }

  // Invariant 2: Week 1 must remain CLOSED at 274
  const w1 = await prisma.googleReviewWeeklyPeriod.findUnique({ where: { weekNumber: 1 } });
  const w1Total = await prisma.googleReviewWeeklyKpi.aggregate({
    where: { weekPeriodId: w1?.id },
    _sum: { qualifiedReviews: true },
  });
  if (w1?.status !== GoogleReviewPeriodStatus.CLOSED || w1Total._sum.qualifiedReviews !== 274) {
    failures.push(`Week 1 invariant violated: status=${w1?.status}, qualified=${w1Total._sum.qualifiedReviews} (expected CLOSED / 274)`);
  }

  // Invariant 3: Week 2 must remain CLOSED at 301
  const w2 = await prisma.googleReviewWeeklyPeriod.findUnique({ where: { weekNumber: 2 } });
  const w2Total = await prisma.googleReviewWeeklyKpi.aggregate({
    where: { weekPeriodId: w2?.id },
    _sum: { qualifiedReviews: true },
  });
  if (w2?.status !== GoogleReviewPeriodStatus.CLOSED || w2Total._sum.qualifiedReviews !== 301) {
    failures.push(`Week 2 invariant violated: status=${w2?.status}, qualified=${w2Total._sum.qualifiedReviews} (expected CLOSED / 301)`);
  }

  // Invariant 4: Historical days for Week 3 before targetDate must remain unchanged
  const expectedHistorical = {
    "2026-09-10": 38,
    "2026-09-11": 36,
    "2026-09-12": 55,
    "2026-09-13": 58,
    "2026-09-14": 33,
    "2026-09-15": 25,
    "2026-09-16": 25,
  };
  const datesToCheck = Object.keys(expectedHistorical).filter((d) => d < targetDate);
  if (datesToCheck.length > 0) {
    const historicalDailies = await prisma.googleReviewDailyKpi.groupBy({
      by: ["date"],
      _sum: { qualifiedReviews: true },
      where: {
        date: { in: datesToCheck },
      },
      orderBy: { date: "asc" },
    });
    for (const row of historicalDailies) {
      if (expectedHistorical[row.date] !== undefined) {
        if (row._sum.qualifiedReviews !== expectedHistorical[row.date]) {
          failures.push(`Historical daily ${row.date} changed: was ${expectedHistorical[row.date]}, now ${row._sum.qualifiedReviews}`);
        }
      }
    }
  }

  // Invariant 5: Active memberships must be 65
  const activeMemberships = await prisma.googleReviewWeeklyStoreMembership.count({
    where: { isActive: true },
  });
  if (activeMemberships !== 65) {
    failures.push(`Active weekly store memberships count is ${activeMemberships}, expected 65`);
  }

  // Invariant 6: Week 3 store ratings count must be 65
  const w3 = await prisma.googleReviewWeeklyPeriod.findUnique({ where: { weekNumber: 3 } });
  if (w3) {
    const ratedStoresCount = await prisma.googleReviewWeeklyKpi.count({
      where: {
        weekPeriodId: w3.id,
        storeRating: { not: null },
      },
    });
    if (ratedStoresCount !== 65) {
      failures.push(`Week 3 rated stores count is ${ratedStoresCount}, expected 65`);
    }

    // When targetWeekNumber > 3, Week 3 must remain CLOSED at 270 qualified
    if (targetWeekNumber > 3) {
      const w3Total = await prisma.googleReviewWeeklyKpi.aggregate({
        where: { weekPeriodId: w3.id },
        _sum: { qualifiedReviews: true },
      });
      if (w3.status !== GoogleReviewPeriodStatus.CLOSED || w3Total._sum.qualifiedReviews !== 270) {
        failures.push(`Week 3 invariant violated: status=${w3.status}, qualified=${w3Total._sum.qualifiedReviews} (expected CLOSED / 270)`);
      }
    }
  }

  // Invariant 7: No future date fingerprints created beyond targetDate
  const todayBangkok = getBangkokDateString(new Date());
  const yesterdayBangkok = offsetBangkokDate(todayBangkok, -1);
  if (targetDate >= yesterdayBangkok) {
    const futureFpCount = await prisma.googleReviewFingerprint.count({
      where: { reviewDate: { gt: targetDate } },
    });
    if (futureFpCount > 0) {
      failures.push(`Future date fingerprints detected beyond targetDate ${targetDate}: count=${futureFpCount}`);
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    dupCount,
    activeMemberships,
    w1Qualified: w1Total._sum.qualifiedReviews,
    w2Qualified: w2Total._sum.qualifiedReviews,
  };
}

/**
 * Main entry point for local daily runner.
 */
async function main() {
  const args = process.argv.slice(2);
  const targetDateArg = args.find((a, i) => args[i - 1] === "--target-date");
  const sentinelOnly = args.includes("--sentinel-only");
  const dryRun = args.includes("--dry-run");
  const forceReconcile = args.includes("--force-reconcile");
  const headlessArg = args.find((a, i) => args[i - 1] === "--headless");
  const headless = headlessArg ? headlessArg === "true" : undefined;

  const referenceNow = new Date();
  const todayBangkok = getTodayBangkokDate(referenceNow);
  const defaultTargetDate = offsetBangkokDate(todayBangkok, -1);

  const initialTargetDate = targetDateArg || defaultTargetDate;
  const logger = new CollectorLogger(initialTargetDate);

  LockManager.acquire(logger, initialTargetDate);

  logger.log(">>> Permanent Local Daily Collector Starting...");
  logger.log(`Current Bangkok Date: ${todayBangkok}, Default Target Date (Yesterday): ${defaultTargetDate}`);
  logger.log(`Flags: sentinelOnly=${sentinelOnly}, dryRun=${dryRun}, forceReconcile=${forceReconcile}`);

  const prisma = getProductionPrismaClient();

  try {
    let datesToProcess = [];

    if (targetDateArg) {
      datesToProcess = [targetDateArg];
    } else {
      // Automatic Catch-Up: identify missing completed dates
      const missing = await resolveMissingCompletedDates(prisma, referenceNow);
      if (missing.length > 0) {
        logger.log(`[CATCH-UP] Missing completed dates detected: ${missing.join(", ")}`);
        datesToProcess = missing;
      } else {
        logger.log(`[CATCH-UP] No missing dates detected. Default target date: ${defaultTargetDate}`);
        if (!forceReconcile && StateManager.isDateCompleted(defaultTargetDate)) {
          logger.log(`[IDEMPOTENT] Target date ${defaultTargetDate} already completed in state file. Exiting.`);
          process.exit(0);
        }
        datesToProcess = [defaultTargetDate];
      }
    }

    logger.log(`Processing date queue sequentially: [${datesToProcess.join(", ")}]`);

    const currentWeekNumber = resolveWeekNumberFromDate(todayBangkok);

    for (const date of datesToProcess) {
      if (!forceReconcile && !targetDateArg && StateManager.isDateCompleted(date)) {
        logger.log(`Date ${date} already marked SUCCESS in state file. Skipping.`);
        continue;
      }

      const dateWeekNumber = resolveWeekNumberFromDate(date);
      const isAllowedPrevWeek =
        date === defaultTargetDate && dateWeekNumber === currentWeekNumber - 1;

      await runCollectionForDate({
        targetDate: date,
        referenceNow,
        prisma,
        logger,
        options: {
          sentinelOnly,
          dryRun,
          forceReconcile,
          headless,
          allowPreviousWeekFinalization: isAllowedPrevWeek,
        },
      });
    }

    logger.log("\n>>> ALL SCHEDULED COLLECTIONS COMPLETED SUCCESSFULLY.");
  } catch (err) {
    logger.error("FATAL ERROR in local daily collector:", err.stack || err.message);
    process.exit(1);
  } finally {
    LockManager.release();
    await prisma.$disconnect();
    logger.close();
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isDirectExecution) {
  main();
}
