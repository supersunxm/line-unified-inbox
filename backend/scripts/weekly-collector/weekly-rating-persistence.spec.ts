import test from "node:test";
import assert from "node:assert/strict";
import { refreshWeeklyStoreTotal, upsertDailyByReviewDate } from "./run-single-cycle.mjs";

test("Google Review Weekly Store Rating Persistence", async (t) => {
  await t.test("Case A: store with 0 reviews in week still upserts weekly record with latest verified rating", async () => {
    let upsertArgs = null;
    const mockPrisma = {
      googleReviewDailyKpi: {
        findMany: async () => [],
      },
      googleReviewWeeklyKpi: {
        upsert: async (args) => {
          upsertArgs = args;
          return {};
        },
      },
    };

    const total = await refreshWeeklyStoreTotal({
      storeCode: "24365",
      storeId: "store-uuid-1",
      storeRating: 4.9,
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      prismaClient: mockPrisma,
    });

    assert.equal(total, 0, "Qualified total should be 0 when no dailies exist");
    assert.ok(upsertArgs, "upsert should have been called");
    assert.deepEqual(upsertArgs.where, {
      weekPeriodId_storeCode: {
        weekPeriodId: "week-period-3",
        storeCode: "24365",
      },
    });
    assert.equal(upsertArgs.create.storeRating, 4.9);
    assert.equal(upsertArgs.create.qualifiedReviews, 0);
    assert.equal(upsertArgs.create.reviewsChecked, 0);
    assert.equal(upsertArgs.update.storeRating, 4.9);
    assert.equal(upsertArgs.update.qualifiedReviews, 0);
  });

  await t.test("Case B: store with existing qualified reviews updates rating and aggregates dailies correctly", async () => {
    let upsertArgs = null;
    const mockPrisma = {
      googleReviewDailyKpi: {
        findMany: async () => [
          { qualifiedReviews: 2, reviewsChecked: 3, reviewsWithPhoto: 2, reviewsOver15ThaiWords: 2 },
          { qualifiedReviews: 1, reviewsChecked: 2, reviewsWithPhoto: 1, reviewsOver15ThaiWords: 1 },
        ],
      },
      googleReviewWeeklyKpi: {
        upsert: async (args) => {
          upsertArgs = args;
          return {};
        },
      },
    };

    const total = await refreshWeeklyStoreTotal({
      storeCode: "109",
      storeId: "store-uuid-2",
      storeRating: 5.0,
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      prismaClient: mockPrisma,
    });

    assert.equal(total, 3, "Qualified total should be sum of dailies (2 + 1 = 3)");
    assert.ok(upsertArgs);
    assert.equal(upsertArgs.create.storeRating, 5.0);
    assert.equal(upsertArgs.create.qualifiedReviews, 3);
    assert.equal(upsertArgs.create.reviewsChecked, 5);
    assert.equal(upsertArgs.update.storeRating, 5.0);
    assert.equal(upsertArgs.update.qualifiedReviews, 3);
  });

  await t.test("Case C: store with only unqualified reviews updates rating with 0 qualified reviews", async () => {
    let upsertArgs = null;
    const mockPrisma = {
      googleReviewDailyKpi: {
        findMany: async () => [
          { qualifiedReviews: 0, reviewsChecked: 4, reviewsWithPhoto: 1, reviewsOver15ThaiWords: 0 },
        ],
      },
      googleReviewWeeklyKpi: {
        upsert: async (args) => {
          upsertArgs = args;
          return {};
        },
      },
    };

    const total = await refreshWeeklyStoreTotal({
      storeCode: "18127",
      storeId: "store-uuid-3",
      storeRating: 4.8,
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      prismaClient: mockPrisma,
    });

    assert.equal(total, 0);
    assert.ok(upsertArgs);
    assert.equal(upsertArgs.create.storeRating, 4.8);
    assert.equal(upsertArgs.create.qualifiedReviews, 0);
    assert.equal(upsertArgs.create.reviewsChecked, 4);
    assert.equal(upsertArgs.update.storeRating, 4.8);
    assert.equal(upsertArgs.update.qualifiedReviews, 0);
  });

  await t.test("Case D: null storeRating in update preserves existing rating via undefined", async () => {
    let upsertArgs = null;
    const mockPrisma = {
      googleReviewDailyKpi: {
        findMany: async () => [],
      },
      googleReviewWeeklyKpi: {
        upsert: async (args) => {
          upsertArgs = args;
          return {};
        },
      },
    };

    const total = await refreshWeeklyStoreTotal({
      storeCode: "25417",
      storeId: null,
      storeRating: null,
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      prismaClient: mockPrisma,
    });

    assert.equal(total, 0);
    assert.ok(upsertArgs);
    assert.equal(upsertArgs.create.storeRating, null);
    assert.equal(upsertArgs.update.storeRating, undefined, "null rating must fall back to undefined in update to preserve existing rating");
  });

  await t.test("Case E: daily upsert correctly creates new daily record with rating or updates existing without clobbering", async () => {
    let createdArgs = null;
    let updatedArgs = null;

    const mockPrismaCreate = {
      googleReviewDailyKpi: {
        findUnique: async () => null,
        create: async (args) => {
          createdArgs = args;
          return {};
        },
      },
    };

    await upsertDailyByReviewDate({
      storeCode: "109",
      storeId: "store-uuid-109",
      storeRating: 4.95,
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      reviewDate: "2026-09-12",
      stats: {
        newQualifiedReviews: 1,
        reviewsChecked: 2,
        reviewsWithPhoto: 1,
        reviewsOver15ThaiWords: 1,
      },
      prismaClient: mockPrismaCreate,
    });

    assert.ok(createdArgs);
    assert.equal(createdArgs.data.storeRating, 4.95);
    assert.equal(createdArgs.data.qualifiedReviews, 1);

    const mockPrismaUpdate = {
      googleReviewDailyKpi: {
        findUnique: async () => ({ id: "daily-1", storeRating: 4.9 }),
        update: async (args) => {
          updatedArgs = args;
          return {};
        },
      },
    };

    await upsertDailyByReviewDate({
      storeCode: "109",
      storeId: "store-uuid-109",
      storeRating: null, // should preserve existing daily storeRating
      weekPeriodId: "week-period-3",
      weekNumber: 3,
      reviewDate: "2026-09-12",
      stats: {
        newQualifiedReviews: 2,
        reviewsChecked: 2,
        reviewsWithPhoto: 2,
        reviewsOver15ThaiWords: 2,
      },
      prismaClient: mockPrismaUpdate,
    });

    assert.ok(updatedArgs);
    assert.equal(updatedArgs.data.storeRating, 4.9);
  });
});
