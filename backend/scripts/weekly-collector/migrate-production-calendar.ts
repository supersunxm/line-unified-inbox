import { PrismaClient, GoogleReviewPeriodStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { generateWeeklyPeriods } from "../../src/google-review-kpi/weekly-period.util.js";

const prisma = new PrismaClient();

async function runMigration() {
  console.log("================================================================================");
  console.log(" GOOGLE REVIEW KPI - PRODUCTION CALENDAR MIGRATION (7-DAY CADENCE)");
  console.log("================================================================================\n");

  // 1. Audit Pre-migration Baseline
  console.log(">>> Phase 1: Checking Pre-migration Database State...");

  const preWeek1Kpis = await prisma.googleReviewWeeklyKpi.findMany({ where: { weekNumber: 1 } });
  const preWeek1Sum = preWeek1Kpis.reduce((acc, k) => acc + k.qualifiedReviews, 0);

  const preWeek2Kpis = await prisma.googleReviewWeeklyKpi.findMany({ where: { weekNumber: 2 } });
  const preWeek2Sum = preWeek2Kpis.reduce((acc, k) => acc + k.qualifiedReviews, 0);

  const preFpTotal = await prisma.googleReviewFingerprint.count();
  const preFpQualified = await prisma.googleReviewFingerprint.count({ where: { isQualified: true } });

  const datesToCheck = ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"];
  const preDailySums: Record<string, number> = {};

  for (const d of datesToCheck) {
    const dailies = await prisma.googleReviewDailyKpi.findMany({ where: { date: d } });
    preDailySums[d] = dailies.reduce((acc, row) => acc + row.qualifiedReviews, 0);
  }

  console.log(`Pre-migration Week 1 Qualified Sum: ${preWeek1Sum} (Expected: 274)`);
  console.log(`Pre-migration Week 2 Qualified Sum: ${preWeek2Sum} (Expected: 302)`);
  console.log(`Pre-migration Daily Sums:`, JSON.stringify(preDailySums, null, 2));
  console.log(`Pre-migration Fingerprints: Total=${preFpTotal} (Expected: 510), Qualified=${preFpQualified} (Expected: 305)`);

  assert.equal(preWeek1Sum, 274, "Invariant violation: Pre-migration Week 1 sum must be 274");
  assert.equal(preDailySums["2026-09-02"], 25, "Invariant violation: Pre-migration Sep 2 daily sum must be 25");
  assert.equal(preWeek2Sum, 302, "Invariant violation: Pre-migration Week 2 sum must be 302");
  assert.equal(preFpTotal, 510, "Invariant violation: Pre-migration Fingerprint total must be 510");
  assert.equal(preFpQualified, 305, "Invariant violation: Pre-migration Qualified Fingerprint count must be 305");

  // 2. Step A: Upsert Periods 1 through 10
  console.log("\n>>> Phase 2: Upserting Weekly Periods 1..10 with Approved 7-Day Boundaries...");
  const refBangkok = new Date("2026-09-09T12:00:00+07:00");
  const periodDefs = generateWeeklyPeriods(10, refBangkok);

  for (const def of periodDefs) {
    const status = def.weekNumber === 1 ? GoogleReviewPeriodStatus.CLOSED : GoogleReviewPeriodStatus.OPEN;
    const upserted = await prisma.googleReviewWeeklyPeriod.upsert({
      where: { weekNumber: def.weekNumber },
      create: {
        weekNumber: def.weekNumber,
        labelZh: def.labelZh,
        labelTh: def.labelTh,
        label: def.label,
        startDate: def.startDate,
        endDate: def.endDate,
        status,
        frozenAt: def.weekNumber === 1 ? def.endDate : null,
      },
      update: {
        labelZh: def.labelZh,
        labelTh: def.labelTh,
        label: def.label,
        startDate: def.startDate,
        endDate: def.endDate,
        status,
        frozenAt: def.weekNumber === 1 ? def.endDate : null,
      },
    });
    console.log(`  Week ${upserted.weekNumber}: "${upserted.label}" | ${upserted.startDate.toISOString()} -> ${upserted.endDate.toISOString()} | Status: ${upserted.status}`);
  }

  const week1Period = await prisma.googleReviewWeeklyPeriod.findUniqueOrThrow({ where: { weekNumber: 1 } });
  const week2Period = await prisma.googleReviewWeeklyPeriod.findUniqueOrThrow({ where: { weekNumber: 2 } });

  // 3. Step B: Reassign Sep 2 Daily KPI records to Week 1
  console.log("\n>>> Phase 3: Reassigning 2026-09-02 Daily KPI records to Week 1...");
  const updateSep2Result = await prisma.googleReviewDailyKpi.updateMany({
    where: { date: "2026-09-02" },
    data: {
      weekNumber: 1,
      weekPeriodId: week1Period.id,
    },
  });
  console.log(`  Updated ${updateSep2Result.count} Daily KPI rows for 2026-09-02 -> weekNumber=1, weekPeriodId=${week1Period.id}`);

  // 4. Step C: Recompute Week 2 Weekly KPI strictly from Sep 3..Sep 9
  console.log("\n>>> Phase 4: Recomputing Week 2 Weekly KPI for all 65 Focus Stores...");
  const memberships = await prisma.googleReviewWeeklyStoreMembership.findMany({
    where: { isActive: true },
    orderBy: { storeCode: "asc" },
  });
  console.log(`  Found ${memberships.length} active store memberships.`);

  for (const member of memberships) {
    const storeCode = member.storeCode;

    // Sum all dailies belonging to Week 2 (date >= 2026-09-03 and date <= 2026-09-09)
    const dailiesForStore = await prisma.googleReviewDailyKpi.findMany({
      where: {
        storeCode,
        date: {
          gte: "2026-09-03",
          lte: "2026-09-09",
        },
      },
    });

    const reviewsChecked = dailiesForStore.reduce((acc, d) => acc + d.reviewsChecked, 0);
    const reviewsWithPhoto = dailiesForStore.reduce((acc, d) => acc + d.reviewsWithPhoto, 0);
    const reviewsOver15ThaiWords = dailiesForStore.reduce((acc, d) => acc + d.reviewsOver15ThaiWords, 0);
    const qualifiedReviews = dailiesForStore.reduce((acc, d) => acc + d.qualifiedReviews, 0);
    const latestRating = dailiesForStore.find((d) => d.storeRating !== null)?.storeRating ?? null;

    await prisma.googleReviewWeeklyKpi.upsert({
      where: {
        weekPeriodId_storeCode: {
          weekPeriodId: week2Period.id,
          storeCode,
        },
      },
      create: {
        weekPeriodId: week2Period.id,
        weekNumber: 2,
        storeCode,
        storeId: member.storeId,
        storeRating: latestRating,
        reviewsChecked,
        reviewsWithPhoto,
        reviewsOver15ThaiWords,
        qualifiedReviews,
        status: GoogleReviewPeriodStatus.OPEN,
        frozenAt: null,
      },
      update: {
        reviewsChecked,
        reviewsWithPhoto,
        reviewsOver15ThaiWords,
        qualifiedReviews,
        storeRating: latestRating ?? undefined,
        status: GoogleReviewPeriodStatus.OPEN,
      },
    });
  }

  // Re-rank Week 2 stores
  console.log("\n>>> Phase 5: Re-ranking all Week 2 stores...");
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
  console.log(`  Re-ranked ${allWeekly2.length} stores in Week 2.`);

  // 5. Post-migration Verification & Assertions
  console.log("\n>>> Phase 6: Post-Migration Invariant Assertions...");

  const postWeek1Kpis = await prisma.googleReviewWeeklyKpi.findMany({ where: { weekNumber: 1 } });
  const postWeek1Sum = postWeek1Kpis.reduce((acc, k) => acc + k.qualifiedReviews, 0);

  const postWeek2Kpis = await prisma.googleReviewWeeklyKpi.findMany({ where: { weekNumber: 2 } });
  const postWeek2Sum = postWeek2Kpis.reduce((acc, k) => acc + k.qualifiedReviews, 0);

  const postFpTotal = await prisma.googleReviewFingerprint.count();
  const postFpQualified = await prisma.googleReviewFingerprint.count({ where: { isQualified: true } });

  const postDailySums: Record<string, number> = {};
  for (const d of datesToCheck) {
    const dailies = await prisma.googleReviewDailyKpi.findMany({ where: { date: d } });
    postDailySums[d] = dailies.reduce((acc, row) => acc + row.qualifiedReviews, 0);
  }

  console.log(`Post-migration Week 1 Qualified Sum: ${postWeek1Sum} (Expected: 274)`);
  console.log(`Post-migration Week 2 Qualified Sum: ${postWeek2Sum} (Expected: 277)`);
  console.log(`Post-migration Daily Sums:`, JSON.stringify(postDailySums, null, 2));
  console.log(`Post-migration Fingerprints: Total=${postFpTotal} (Expected: 510), Qualified=${postFpQualified} (Expected: 305)`);

  // STRICT INVARIANTS:
  assert.equal(postWeek1Sum, 274, "CRITICAL: Week 1 historical sum must remain exactly 274!");
  assert.equal(postWeek2Sum, 277, "CRITICAL: Week 2 sum must be exactly 277 (302 - 25 from Sep 2)!");
  assert.equal(postDailySums["2026-09-02"], 25, "Sep 2 daily total must remain 25!");
  assert.equal(postDailySums["2026-09-03"], 34, "Sep 3 daily total must remain 34!");
  assert.equal(postDailySums["2026-09-04"], 38, "Sep 4 daily total must remain 38!");
  assert.equal(postDailySums["2026-09-05"], 51, "Sep 5 daily total must remain 51!");
  assert.equal(postDailySums["2026-09-06"], 29, "Sep 6 daily total must remain 29!");
  assert.equal(postDailySums["2026-09-07"], 65, "Sep 7 daily total must remain 65!");
  assert.equal(postDailySums["2026-09-08"], 60, "Sep 8 daily total must remain 60!");
  assert.equal(postDailySums["2026-09-09"], 0, "Sep 9 daily total must remain 0 before live run!");
  assert.equal(postFpTotal, 510, "Total fingerprints must remain exactly 510!");
  assert.equal(postFpQualified, 305, "Qualified fingerprints must remain exactly 305!");

  console.log("\n================================================================================");
  console.log(" SUCCESS: PRODUCTION CALENDAR MIGRATION COMPLETED CLEANLY WITH ALL INVARIANTS VERIFIED!");
  console.log("================================================================================\n");
}

runMigration()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
