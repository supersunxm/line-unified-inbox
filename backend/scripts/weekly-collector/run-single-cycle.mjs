import playwright from "playwright";
const { chromium } = playwright;
import { PrismaClient, GoogleReviewPeriodStatus } from "@prisma/client";
import { collectStoreContinuous, getTodayBangkokDate } from "./continuous-collector.mjs";
import { offsetBangkokDate, resolveWeekNumberFromDate } from "./date-classifier.mjs";

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
  weekNumber,
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
      weekNumber,
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

async function refreshWeeklyStoreTotal({ storeCode, storeId, storeRating, weekPeriodId, weekNumber }) {
  const allDailiesForStore = await prisma.googleReviewDailyKpi.findMany({
    where: {
      storeCode,
      weekPeriodId,
    },
  });

  const totalStoreQualified = allDailiesForStore.reduce((acc, d) => acc + d.qualifiedReviews, 0);
  const totalStoreChecked = allDailiesForStore.reduce((acc, d) => acc + d.reviewsChecked, 0);
  const totalStorePhoto = allDailiesForStore.reduce((acc, d) => acc + d.reviewsWithPhoto, 0);
  const totalStoreWords = allDailiesForStore.reduce((acc, d) => acc + d.reviewsOver15ThaiWords, 0);

  await prisma.googleReviewWeeklyKpi.upsert({
    where: {
      weekPeriodId_storeCode: {
        weekPeriodId,
        storeCode,
      },
    },
    create: {
      weekPeriodId,
      weekNumber,
      storeCode,
      storeId,
      storeRating,
      reviewsChecked: totalStoreChecked,
      reviewsWithPhoto: totalStorePhoto,
      reviewsOver15ThaiWords: totalStoreWords,
      qualifiedReviews: totalStoreQualified,
      status: GoogleReviewPeriodStatus.OPEN,
      frozenAt: null,
    },
    update: {
      storeRating: storeRating ?? undefined,
      reviewsChecked: totalStoreChecked,
      reviewsWithPhoto: totalStorePhoto,
      reviewsOver15ThaiWords: totalStoreWords,
      qualifiedReviews: totalStoreQualified,
      status: GoogleReviewPeriodStatus.OPEN,
    },
  });

  return totalStoreQualified;
}

async function main() {
  const targetReviewDateOverride = process.env.GOOGLE_REVIEW_WRITE_DATE?.trim() || null;
  const todayBangkok = getTodayBangkokDate();
  const targetWeekNumber = targetReviewDateOverride
    ? resolveWeekNumberFromDate(targetReviewDateOverride)
    : resolveWeekNumberFromDate(todayBangkok);

  const previousBangkokDate = offsetBangkokDate(todayBangkok, -1);
  const writableReviewDates = targetReviewDateOverride
    ? new Set([targetReviewDateOverride])
    : new Set([todayBangkok, previousBangkokDate]);

  console.log("================================================================================");
  console.log(` DAILY CONTINUOUS TRACKING - WEEKLY GOOGLE REVIEW KPI (65 FOCUS STORES) - WEEK ${targetWeekNumber}`);
  console.log(` Target Bangkok Date (Today): ${todayBangkok}`);
  if (targetReviewDateOverride) {
    console.log(` [TARGET DATE RECOVERY MODE ACTIVE]: Writing ONLY review date: ${targetReviewDateOverride}`);
  } else {
    console.log(` Previous Bangkok Date (late-arrival catch-up): ${previousBangkokDate}`);
  }
  console.log(` Chrome Profile Directory: ${persistentProfileDir}`);
  console.log(" Fast Stop Rule: 5 consecutive previously-seen reviews stops store scan");
  console.log(` Review-date attribution: unseen Week ${targetWeekNumber} reviews are written to their resolved Bangkok review date.`);
  console.log(" Write window: current Bangkok date + previous Bangkok date only; older historical days stay frozen.");
  console.log(" Invariant: Week 1 remains CLOSED (274). Existing fingerprints are never double-counted.");
  console.log(" Single Controlled Cycle: Executes 1 cycle across 65 stores, then halts.");
  console.log("================================================================================\n");

  const targetWeekPeriod = await prisma.googleReviewWeeklyPeriod.findUnique({
    where: { weekNumber: targetWeekNumber },
  });
  if (!targetWeekPeriod) {
    throw new Error(`Week ${targetWeekNumber} Period record not found in database!`);
  }
  if (!targetReviewDateOverride && targetWeekPeriod.status !== GoogleReviewPeriodStatus.OPEN) {
    throw new Error(`Week ${targetWeekNumber} Period status is ${targetWeekPeriod.status}, expected OPEN!`);
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
    successfulScans: 0,
    confirmedZeroPlaces: 0,
    scanFailures: 0,
    sortFailures: 0,
    panelFailures: 0,
    cardFailures: 0,
    limitedViewFailures: 0,
    totalNewReviewsDiscovered: 0,
    totalNewQualifiedReviews: 0,
    qualifiedByReviewDate: {},
    skippedFrozenQualifiedByReviewDate: {},
    storesWithNewReviews: 0,
    fastStopTriggeredStores: 0,
    skippedFutureDateReviews: 0,
    errors: [],
  };

  let consecutiveSameError = { error: null, count: 0 };

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
    }, {
      todayBangkok,
      targetWeekNumber,
      targetReviewDateOnly: targetReviewDateOverride,
    });

    summary.storesScanned++;

    const isError = res.stopReason.startsWith("ERROR");
    if (isError) {
      summary.scanFailures++;
      summary.errors.push({ storeCode, error: res.stopReason });

      if (res.stopReason.includes("LIMITED_VIEW")) {
        summary.limitedViewFailures++;
      } else if (res.stopReason.includes("SORT")) {
        summary.sortFailures++;
      } else if (res.stopReason.includes("CARD")) {
        summary.cardFailures++;
      } else {
        summary.panelFailures++;
      }

      // Track consecutive identical error
      if (consecutiveSameError.error === res.stopReason) {
        consecutiveSameError.count++;
      } else {
        consecutiveSameError = { error: res.stopReason, count: 1 };
      }

      // Check Systemic Guard 1: 5 consecutive identical errors
      if (consecutiveSameError.count >= 5) {
        console.error(`\n[SYSTEMIC FAILURE] 5 consecutive stores failed with the same error: ${consecutiveSameError.error}`);
        console.error(`Halting cycle immediately to protect data integrity.`);
        await context.close();
        process.exit(1);
      }

      // Check Systemic Guard 2: >= 20% overall failure rate after at least 10 stores
      const failureRate = summary.scanFailures / summary.storesScanned;
      if (summary.storesScanned >= 10 && failureRate >= 0.2) {
        console.error(`\n[SYSTEMIC FAILURE] Failure rate reached ${(failureRate * 100).toFixed(1)}% (${summary.scanFailures}/${summary.storesScanned} stores failed). Threshold is 20%.`);
        console.error(`Halting cycle immediately to protect data integrity.`);
        await context.close();
        process.exit(1);
      }

      // Untrusted outcome: skip writing KPI data for this store
      console.warn(`  [UNTRUSTED OUTCOME] Store ${storeCode} failed with ${res.stopReason}. Skipping daily/weekly KPI mutations.`);
      await page.waitForTimeout(500);
      continue;
    } else {
      consecutiveSameError = { error: null, count: 0 };
    }

    if (res.stopReason === "CONFIRMED_ZERO_REVIEWS") {
      summary.confirmedZeroPlaces++;
    } else {
      summary.successfulScans++;
    }

    summary.totalNewReviewsDiscovered += res.newReviewsDiscovered;
    summary.totalNewQualifiedReviews += res.newQualifiedReviews;
    summary.skippedFutureDateReviews += (res.skippedFutureDateReviews || 0);

    if (res.newReviewsDiscovered > 0) {
      summary.storesWithNewReviews++;
    }
    if (res.stopReason === "CONSECUTIVE_SEEN_BOUNDARY_5") {
      summary.fastStopTriggeredStores++;
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

      const reviewWeekNumber = resolveWeekNumberFromDate(reviewDate);
      const periodForDate = reviewWeekNumber === targetWeekNumber
        ? targetWeekPeriod
        : await prisma.googleReviewWeeklyPeriod.findUnique({ where: { weekNumber: reviewWeekNumber } });

      if (!periodForDate) {
        console.warn(`  [WARN] No period found for week ${reviewWeekNumber}. Skipping KPI write for date ${reviewDate}.`);
        continue;
      }

      console.log(`  Updating daily record for ${storeCode} REVIEW DATE ${reviewDate} (Week ${reviewWeekNumber}) (+${stats.newQualifiedReviews} qualified)...`);
      await upsertDailyByReviewDate({
        storeCode,
        storeId: store?.id || null,
        storeRating: res.storeRating,
        weekPeriodId: periodForDate.id,
        weekNumber: reviewWeekNumber,
        reviewDate,
        stats,
      });

      wroteQualifiedForStore = true;
      summary.qualifiedByReviewDate[reviewDate] = (summary.qualifiedByReviewDate[reviewDate] || 0) + stats.newQualifiedReviews;
    }

    if (wroteQualifiedForStore) {
      const totalStoreQualified = await refreshWeeklyStoreTotal({
        storeCode,
        storeId: store?.id || null,
        storeRating: res.storeRating,
        weekPeriodId: targetWeekPeriod.id,
        weekNumber: targetWeekNumber,
      });
      console.log(`  Updated Week ${targetWeekNumber} total for ${storeCode} -> ${totalStoreQualified} qualified reviews.`);
    }

    await page.waitForTimeout(500);
  }

  console.log(`\nRe-ranking all Week ${targetWeekNumber} stores...`);
  const allWeekly = await prisma.googleReviewWeeklyKpi.findMany({
    where: { weekPeriodId: targetWeekPeriod.id },
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
      data: { rank, status: GoogleReviewPeriodStatus.OPEN },
    });
  }

  await context.close();
  const totalDurationMin = ((Date.now() - cycleStartTime) / 60000).toFixed(1);

  console.log(`\n================================================================================`);
  console.log(`CONTROLLED LIVE CYCLE COMPLETED IN ${totalDurationMin} MINUTES!`);
  console.log(`Total Stores Scanned: ${summary.storesScanned}/${summary.totalStores}`);
  console.log(`  - Successful Scans: ${summary.successfulScans}`);
  console.log(`  - Confirmed Zero-Review Places: ${summary.confirmedZeroPlaces}`);
  console.log(`  - Scan Failures: ${summary.scanFailures}`);
  if (summary.scanFailures > 0) {
    console.log(`    * Limited View: ${summary.limitedViewFailures}`);
    console.log(`    * Panel Failures: ${summary.panelFailures}`);
    console.log(`    * Sort Failures: ${summary.sortFailures}`);
    console.log(`    * Card Failures: ${summary.cardFailures}`);
  }
  console.log(`Fast-Stop Triggered (5 seen boundary): ${summary.fastStopTriggeredStores} stores`);
  console.log(`Stores with New Reviews: ${summary.storesWithNewReviews}`);
  console.log(`Total New Reviews Discovered: ${summary.totalNewReviewsDiscovered}`);
  console.log(`Total New Qualified Reviews Discovered: ${summary.totalNewQualifiedReviews}`);
  console.log(`Total Skipped Future Date Reviews (e.g. Sep 9): ${summary.skippedFutureDateReviews}`);
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
