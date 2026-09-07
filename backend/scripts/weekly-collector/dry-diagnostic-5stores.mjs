/**
 * Dry Diagnostic Runner for Google Review Maps DOM Recovery.
 * 
 * Verifies:
 * 1. 5 diverse focus stores (CentralWorld 25610, Rama 9 24365, Phuket 25417, Nong Khai 27626, Rama 3 26239)
 *    in headless mode with dedicated profile:
 *    - Maps loads without Limited View
 *    - Reviews pane opens
 *    - Newest sort is verified
 *    - Cards detected (> 0)
 * 2. Non-mutating collectStoreContinuous diagnostic on CentralWorld:
 *    - Full discovery cycle with dryRun: true
 *    - Stops at boundary or chronology stop
 *    - Zero DB writes
 */

import { chromium } from "playwright";
import {
  resolveGoogleReviewProfileDir,
  buildGoogleReviewLaunchOptions,
} from "./browser-runtime-config.mjs";
import {
  evaluatePlaceStatus,
  openReviewsPane,
  ensureNewestSort,
} from "./maps-dom-helper.mjs";
import { collectStoreContinuous } from "./continuous-collector.mjs";
import { PrismaClient } from "@prisma/client";

const STORES_TO_TEST = [
  {
    storeCode: "25610",
    storeName: "OBS Central World FL.4 By OPPO",
    googleMapsUrl: "https://maps.app.goo.gl/5zUiKjWLJzeA1WqH8?g_st=ac",
  },
  {
    storeCode: "24365",
    storeName: "OBS Central RAMA9 FL.B By OPPO",
    googleMapsUrl: "https://maps.app.goo.gl/HcmStEQkNLCkAPwSA",
  },
  {
    storeCode: "25417",
    storeName: "OBS Central Phuket By OPPO",
    googleMapsUrl: "https://maps.app.goo.gl/tqCFPiJJf2oxnSks9?g_st=ac",
  },
  {
    storeCode: "27626",
    storeName: "OBS Asawann Nongkhai By OPPO",
    googleMapsUrl: "https://maps.app.goo.gl/aZ2ARoWoGw3C3odL6",
  },
  {
    storeCode: "26239",
    storeName: "OBS Central Rama 3 FL.3 By OPPO",
    googleMapsUrl: "https://maps.app.goo.gl/NDoDnv26uC9ttHbh6",
  },
];

async function runDryDiagnostic() {
  const prisma = new PrismaClient();
  const profileDir = resolveGoogleReviewProfileDir();
  const launchOptions = buildGoogleReviewLaunchOptions(process.env, { headless: true });

  console.log("================================================================================");
  console.log("GOOGLE REVIEW MAPS DOM RECOVERY - DRY DIAGNOSTIC (5 STORES)");
  console.log(`Profile: ${profileDir}`);
  console.log(`Launch Options: Headless=${launchOptions.headless}, UserAgent=${launchOptions.userAgent}`);
  console.log("================================================================================\n");

  const initialFpCount = await prisma.googleReviewFingerprint.count();
  const initialDailyCount = await prisma.googleReviewDailyKpi.count();
  const initialWeeklyCount = await prisma.googleReviewWeeklyKpi.count();

  console.log(`Initial DB State: Fingerprints=${initialFpCount}, Daily=${initialDailyCount}, Weekly=${initialWeeklyCount}`);

  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages()[0] || (await context.newPage());

  const results = [];

  try {
    for (let i = 0; i < STORES_TO_TEST.length; i++) {
      const store = STORES_TO_TEST[i];
      console.log(`\n[${i + 1}/5] Testing Store ${store.storeCode}: ${store.storeName}...`);
      const storeStart = Date.now();

      await page.goto(store.googleMapsUrl, { waitUntil: "commit" });
      await page.waitForTimeout(3500);

      const status = await evaluatePlaceStatus(page);
      console.log(`  Place Status: LimitedView=${status.hasLimitedView}, Rating=${status.rating}, TotalReviews=${status.totalReviewsCount}`);

      const openResult = await openReviewsPane(page);
      console.log(`  Open Pane: success=${openResult.success}, reason=${openResult.reason}`);

      let sortResult = { success: false, reason: "NOT_ATTEMPTED" };
      let cardsCount = 0;

      if (openResult.success) {
        sortResult = await ensureNewestSort(page);
        console.log(`  Ensure Newest Sort: success=${sortResult.success}, reason=${sortResult.reason}`);

        cardsCount = await page.evaluate(
          () => document.querySelectorAll(".jftiEf, div[data-review-id]").length
        );
        console.log(`  Review Cards Count: ${cardsCount}`);
      }

      const durationMs = Date.now() - storeStart;
      const passed =
        !status.hasLimitedView &&
        openResult.success &&
        sortResult.success &&
        cardsCount > 0;

      results.push({
        storeCode: store.storeCode,
        storeName: store.storeName,
        hasLimitedView: status.hasLimitedView,
        paneOpened: openResult.success,
        openReason: openResult.reason,
        sortSuccess: sortResult.success,
        sortReason: sortResult.reason,
        cardsCount,
        durationMs,
        passed,
      });

      console.log(`  Store ${store.storeCode} Result: ${passed ? "PASS" : "FAIL"}`);
    }

    console.log("\n================================================================================");
    console.log("NON-MUTATING collectStoreContinuous DIAGNOSTIC ON CENTRALWORLD (25610)");
    console.log("================================================================================");

    const cwStore = STORES_TO_TEST[0];
    const cwResult = await collectStoreContinuous(page, cwStore, {
      dryRun: true,
      todayBangkok: "2026-09-07",
    });

    console.log("\nCentralWorld Continuous Collector Result:", JSON.stringify(cwResult, null, 2));

    const finalFpCount = await prisma.googleReviewFingerprint.count();
    const finalDailyCount = await prisma.googleReviewDailyKpi.count();
    const finalWeeklyCount = await prisma.googleReviewWeeklyKpi.count();

    const dbMutated =
      initialFpCount !== finalFpCount ||
      initialDailyCount !== finalDailyCount ||
      initialWeeklyCount !== finalWeeklyCount;

    console.log("\n================================================================================");
    console.log("DIAGNOSTIC SUMMARY REPORT");
    console.log("================================================================================");
    console.table(results);
    console.log(`\nDB Mutations Detected: ${dbMutated ? "YES (FAIL)" : "NO (VERIFIED ZERO MUTATIONS)"}`);
    console.log(`Initial DB: FP=${initialFpCount}, Daily=${initialDailyCount}, Weekly=${initialWeeklyCount}`);
    console.log(`Final DB:   FP=${finalFpCount}, Daily=${finalDailyCount}, Weekly=${finalWeeklyCount}`);

    const allPassed = results.every((r) => r.passed) && !dbMutated && cwResult.reviewsChecked > 0;
    console.log(`\nOVERALL STATUS: ${allPassed ? "SUCCESS (ALL CHECKS PASSED)" : "FAILED"}`);

    if (!allPassed) {
      process.exit(1);
    }
  } finally {
    await context.close();
    await prisma.$disconnect();
  }
}

runDryDiagnostic().catch((err) => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
