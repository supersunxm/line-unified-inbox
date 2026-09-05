import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient, GoogleReviewPeriodStatus } from "@prisma/client";
import { collectStoreContinuous, getTodayBangkokDate } from "./continuous-collector.mjs";
import { offsetBangkokDate } from "./date-classifier.mjs";

import {
  buildGoogleReviewLaunchOptions,
  resolveGoogleReviewProfileDir,
} from "./browser-runtime-config.mjs";

const prisma = new PrismaClient();
const persistentProfileDir = resolveGoogleReviewProfileDir();

async function upsertDailyByReviewDate({
  storeCode,
  storeId,
  storeRating,
  weekPeriodId,
  reviewDate,
  stats,
}) {
  const existingDaily = await prisma.googleReviewDailyKpi.findUnique({
    where: {
      storeCode_date: {
        storeCode,
        date: reviewDate,
      },
    },
  });

  if (existingDaily) {
    await prisma.googleReviewDailyKpi.update({
      where: { id: existingDaily.id },
      data: {
        qualifiedReviews: { increment: stats.newQualifiedReviews },
        reviewsChecked: { increment: stats.reviewsChecked },
        reviewsWithPhoto: { increment: stats.reviewsWithPhoto },
        reviewsOver15ThaiWords: { increment: stats.reviewsOver15ThaiWords },
        storeRating: storeRating ?? existingDaily.storeRating,
      },
    });
    return;
  }

  await prisma.googleReviewDailyKpi.create({
    data: {
      storeCode,
      storeId,
      date: reviewDate,
      weekPeriodId,
      weekNumber: 2,
      storeRating,
      reviewsChecked: stats.reviewsChecked,
      reviewsWithPhoto: stats.reviewsWithPhoto,
      reviewsOver15ThaiWords: stats.reviewsOver15ThaiWords,
      qualifiedReviews: stats.newQualifiedReviews,
      status: GoogleReviewPeriodStatus.OPEN,
      frozenAt: null,
    },
  });
}

async function refreshWeeklyStoreTotal({ storeCode, storeId, storeRating, weekPeriodId }) {
  const allDailiesForStore = await prisma.googleReviewDailyKpi.findMany({
    where: {
      storeCode,
      weekNumber: 2,
    },
  });

  const totalStoreQualifiedWeek2 = allDailiesForStore.reduce((acc, d) => acc + d.qualifiedReviews, 0);
  const totalStoreCheckedWeek2 = allDailiesForStore.reduce((acc, d) => acc + d.reviewsChecked, 0);
  const totalStorePhotoWeek2 = allDailiesForStore.reduce((acc, d) => acc + d.reviewsWithPhoto, 0);
  const totalStoreWordsWeek2 = allDailiesForStore.reduce((acc, d) => acc + d.reviewsOver15ThaiWords, 0);

  await prisma.googleReviewWeeklyKpi.upsert({
    where: {
      weekPeriodId_storeCode: {
        weekPeriodId,
        storeCode,
      },
    },
    create: {
      weekPeriodId,
      weekNumber: 2,
      storeCode,
      storeId,
      storeRating,
      reviewsChecked: totalStoreCheckedWeek2,
      reviewsWithPhoto: totalStorePhotoWeek2,
      reviewsOver15ThaiWords: totalStoreWordsWeek2,
      qualifiedReviews: totalStoreQualifiedWeek2,
      status: GoogleReviewPeriodStatus.OPEN,
      frozenAt: null,
    },
    update: {
      storeRating: storeRating ?? undefined,
      reviewsChecked: totalStoreCheckedWeek2,
      reviewsWithPhoto: totalStorePhotoWeek2,
      reviewsOver15ThaiWords: totalStoreWordsWeek2,
      qualifiedReviews: totalStoreQualifiedWeek2,
      status: GoogleReviewPeriodStatus.OPEN,
    },
  });

  return totalStoreQualifiedWeek2;
}

async function main() {
  const todayBangkok = getTodayBangkokDate();
  const previousBangkokDate = offsetBangkokDate(todayBangkok, -1);
  const writableReviewDates = new Set([todayBangkok, previousBangkokDate]);

  console.log("================================================================================");
  console.log(" DAILY CONTINUOUS TRACKING - WEEKLY GOOGLE REVIEW KPI (65 FOCUS STORES)");
  console.log(` Target Bangkok Date (Today): ${todayBangkok}`);
  console.log(` Previous Bangkok Date (late-arrival catch-up): ${previousBangkokDate}`);
  console.log(` Chrome Profile Directory: ${persistentProfileDir}`);
  console.log(" Fast Stop Rule: 5 consecutive previously-seen reviews stops store scan");
  console.log(" Review-date attribution: unseen Week 2 reviews are written to their resolved Bangkok review date.");
  console.log(" Write window: current Bangkok date + previous Bangkok date only; older historical days stay frozen.");
  console.log(" Invariant: Week 1 remains CLOSED (274). Existing fingerprints are never double-counted.");
  console.log(" Single Controlled Cycle: Executes 1 cycle across 65 stores, then halts.");
  console.log("================================================================================\n");

  const week2Period = await prisma.googleReviewWeeklyPeriod.findUnique({
    where: { weekNumber: 2 },
  });
  if (!week2Period) {
    throw new Error("Week 2 Period record not found in database!");
  }
  if (week2Period.status !== GoogleReviewPeriodStatus.OPEN) {
    throw new Error(`Week 2 Period status is ${week2Period.status}, expected OPEN!`);
  }

  const memberships = await prisma.googleReviewWeeklyStoreMembership.findMany({
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

  console.log(`Loaded ${memberships.length} Active Weekly Stores.`);
  if (memberships.length !== 65) {
    throw new Error(`Expected 65 weekly stores, found ${memberships.length}!`);
  }

  const launchOptions = buildGoogleReviewLaunchOptions();
  console.log(`Browser Launch Options: Headless=${launchOptions.headless}, Args=${JSON.stringify(launchOptions.args)}`);

  const context = await chromium.launchPersistentContext(persistentProfileDir, launchOptions);
  const page = context.pages()[0] || (await context.newPage());
  const cycleStartTime = Date.now();
  const summary = {
    totalStores: memberships.length,
    storesScanned: 0,
    totalNewReviewsDiscovered: 0,
    totalNewQualifiedReviews: 0,
    qualifiedByReviewDate: {},
    skippedFrozenQualifiedByReviewDate: {},
    storesWithNewReviews: 0,
    fastStopTriggeredStores: 0,
    errors: [],
  };

  for (let i = 0; i < memberships.length; i++) {
    const membership = memberships[i];
    const storeCode = membership.storeCode;
    const store = membership.store;
    const storeMaster = store?.storeMaster;
    const storeName = storeMaster?.storeName || store?.name || `Store ${storeCode}`;
    const googleMapsUrl = storeMaster?.googleMapsUrl?.trim();

    console.log(`\n>>> [${i + 1}/65] Collector Scanning Store: ${storeCode} (${storeName})`);

    if (!googleMapsUrl) {
      console.warn(`  [WARN] No Maps URL for store ${storeCode}. Skipping.`);
      continue;
    }

    const res = await collectStoreContinuous(page, {
      storeCode,
      storeId: store?.id || null,
      storeName,
      googleMapsUrl,
    }, { todayBangkok });

    summary.storesScanned++;
    summary.totalNewReviewsDiscovered += res.newReviewsDiscovered;
    summary.totalNewQualifiedReviews += res.newQualifiedReviews;

    if (res.newReviewsDiscovered > 0) {
      summary.storesWithNewReviews++;
    }
    if (res.stopReason === "CONSECUTIVE_SEEN_BOUNDARY_5") {
      summary.fastStopTriggeredStores++;
    }
    if (res.stopReason.startsWith("ERROR")) {
      summary.errors.push({ storeCode, error: res.stopReason });
    }

    const dateEntries = Object.entries(res.newReviewStatsByDate || {});
    let wroteQualifiedForStore = false;

    for (const [reviewDate, stats] of dateEntries) {
      if (stats.newQualifiedReviews <= 0) {
        continue;
      }

      if (!writableReviewDates.has(reviewDate)) {
        console.log(`  [FROZEN DATE SKIP] ${storeCode} review date ${reviewDate}: ${stats.newQualifiedReviews} qualified unseen review(s) fingerprinted but KPI not mutated.`);
        summary.skippedFrozenQualifiedByReviewDate[reviewDate] =
          (summary.skippedFrozenQualifiedByReviewDate[reviewDate] || 0) + stats.newQualifiedReviews;
        continue;
      }

      console.log(`  Updating daily record for ${storeCode} REVIEW DATE ${reviewDate} (+${stats.newQualifiedReviews} qualified)...`);
      await upsertDailyByReviewDate({
        storeCode,
        storeId: store?.id || null,
        storeRating: res.storeRating,
        weekPeriodId: week2Period.id,
        reviewDate,
        stats,
      });

      wroteQualifiedForStore = true;
      summary.qualifiedByReviewDate[reviewDate] = (summary.qualifiedByReviewDate[reviewDate] || 0) + stats.newQualifiedReviews;
    }

    if (wroteQualifiedForStore) {
      const totalStoreQualifiedWeek2 = await refreshWeeklyStoreTotal({
        storeCode,
        storeId: store?.id || null,
        storeRating: res.storeRating,
        weekPeriodId: week2Period.id,
      });
      console.log(`  Updated Week 2 total for ${storeCode} -> ${totalStoreQualifiedWeek2} qualified reviews.`);
    }

    await page.waitForTimeout(500);
  }

  console.log("\nRe-ranking all Week 2 stores...");
  const allWeekly2 = await prisma.googleReviewWeeklyKpi.findMany({
    where: { weekPeriodId: week2Period.id },
  });

  allWeekly2.sort((a, b) => {
    const aEligible = a.storeRating !== null ? a.storeRating > 4.8 : false;
    const bEligible = b.storeRating !== null ? b.storeRating > 4.8 : false;
    if (aEligible !== bEligible) return aEligible ? -1 : 1;
    if (b.qualifiedReviews !== a.qualifiedReviews) return b.qualifiedReviews - a.qualifiedReviews;
    return a.storeCode.localeCompare(b.storeCode);
  });

  for (let rank = 1; rank <= allWeekly2.length; rank++) {
    await prisma.googleReviewWeeklyKpi.update({
      where: { id: allWeekly2[rank - 1].id },
      data: { rank, status: GoogleReviewPeriodStatus.OPEN },
    });
  }

  await context.close();
  const totalDurationMin = ((Date.now() - cycleStartTime) / 60000).toFixed(1);

  console.log(`\n================================================================================`);
  console.log(`CONTROLLED LIVE CYCLE COMPLETED IN ${totalDurationMin} MINUTES!`);
  console.log(`Total Stores Scanned: ${summary.storesScanned}/${summary.totalStores}`);
  console.log(`Fast-Stop Triggered (5 seen boundary): ${summary.fastStopTriggeredStores} stores`);
  console.log(`Stores with New Reviews: ${summary.storesWithNewReviews}`);
  console.log(`Total New Reviews Discovered: ${summary.totalNewReviewsDiscovered}`);
  console.log(`Total New Qualified Reviews Discovered: ${summary.totalNewQualifiedReviews}`);
  console.log(`Qualified written by Review Date: ${JSON.stringify(summary.qualifiedByReviewDate)}`);
  console.log(`Qualified skipped on frozen dates: ${JSON.stringify(summary.skippedFrozenQualifiedByReviewDate)}`);
  console.log(`Errors: ${summary.errors.length}`);
  console.log(`================================================================================\n`);
}

main()
  .catch((err) => {
    console.error("Fatal error in Continuous Collector Cycle:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
