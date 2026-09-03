import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GoogleReviewKpiService, getCurrentYearMonthBangkok } from "./google-review-kpi.service";
import { PrismaService } from "../prisma.service";

test("getCurrentYearMonthBangkok returns valid YYYY-MM format", () => {
  const ym = getCurrentYearMonthBangkok();
  assert.match(ym, /^\d{4}-(0[1-9]|1[0-2])$/);
});

test("GoogleReviewKpiService.recordCheckResult validates inputs strictly", async () => {
  const dummyPrisma = {} as unknown as PrismaService;
  const service = new GoogleReviewKpiService(dummyPrisma);

  // Invalid month format
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-8",
        reviewsChecked: 10,
        reviewsWithPhoto: 5,
        reviewsOver15ThaiWords: 5,
        qualifiedReviews: 3,
      }),
    BadRequestException,
  );

  // Negative reviewsChecked
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-08",
        reviewsChecked: -1,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        qualifiedReviews: 0,
      }),
    BadRequestException,
  );

  // qualifiedReviews > reviewsChecked
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-08",
        reviewsChecked: 10,
        reviewsWithPhoto: 10,
        reviewsOver15ThaiWords: 10,
        qualifiedReviews: 12,
      }),
    BadRequestException,
  );

  // reviewsWithPhoto > reviewsChecked
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-08",
        reviewsChecked: 10,
        reviewsWithPhoto: 15,
        reviewsOver15ThaiWords: 5,
        qualifiedReviews: 5,
      }),
    BadRequestException,
  );

  // qualifiedReviews > reviewsWithPhoto
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-08",
        reviewsChecked: 20,
        reviewsWithPhoto: 5,
        reviewsOver15ThaiWords: 10,
        qualifiedReviews: 8,
      }),
    BadRequestException,
  );

  // qualifiedReviews > reviewsOver15ThaiWords
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "store-1",
        month: "2026-08",
        reviewsChecked: 20,
        reviewsWithPhoto: 10,
        reviewsOver15ThaiWords: 4,
        qualifiedReviews: 6,
      }),
    BadRequestException,
  );
});

test("GoogleReviewKpiService.recordCheckResult upserts result for matched store", async () => {
  let upsertArg: unknown = null;
  const mockStore = {
    id: "uuid-store-1",
    name: "OPPO CentralWorld",
    code: "BKK001",
    storeMaster: {
      externalStoreId: "CW01",
      googleMapsUrl: "https://maps.app.goo.gl/centralworld",
      province: "Bangkok",
      region: "Central",
    },
  };

  const mockPrisma = {
    store: {
      findUnique: async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id === "uuid-store-1" || where.code === "BKK001") return mockStore;
        return null;
      },
    },
    storeMaster: {
      findFirst: async ({ where }: { where: { externalStoreId?: string } }) => {
        if (where.externalStoreId === "CW01") {
          return { ...mockStore.storeMaster, stores: [mockStore] };
        }
        return null;
      },
    },
    googleReviewKpiResult: {
      upsert: async (args: unknown) => {
        upsertArg = args;
        return {
          id: "kpi-res-1",
          storeId: "uuid-store-1",
          month: "2026-08",
          reviewsChecked: 37,
          reviewsWithPhoto: 20,
          reviewsOver15ThaiWords: 18,
          qualifiedReviews: 14,
          targetQualifiedReviews: 10,
          checkedAt: new Date("2026-09-02T10:00:00Z"),
          checkedByUserId: "admin-1",
          checkedByUser: { id: "admin-1", displayName: "Admin", email: "admin@oppo.th" },
        };
      },
    },
  } as unknown as PrismaService;

  const service = new GoogleReviewKpiService(mockPrisma);

  // 1. By store UUID
  const res1 = await service.recordCheckResult(
    {
      storeId: "uuid-store-1",
      month: "2026-08",
      reviewsChecked: 37,
      reviewsWithPhoto: 20,
      reviewsOver15ThaiWords: 18,
      qualifiedReviews: 14,
      targetQualifiedReviews: 10,
    },
    { id: "admin-1", displayName: "Admin", email: "admin@oppo.th", role: "ADMIN", isActive: true },
  );

  assert.equal(res1.success, true);
  assert.equal(res1.data.qualifiedReviews, 14);
  assert.equal(res1.data.store.name, "OPPO CentralWorld");

  // 2. By store code
  const res2 = await service.recordCheckResult(
    {
      storeId: "BKK001",
      month: "2026-08",
      reviewsChecked: 37,
      reviewsWithPhoto: 20,
      reviewsOver15ThaiWords: 18,
      qualifiedReviews: 14,
    },
    { id: "admin-1", displayName: "Admin", email: "admin@oppo.th", role: "ADMIN", isActive: true },
  );

  assert.equal(res2.success, true);

  // 3. Unknown store throws NotFoundException
  await assert.rejects(
    () =>
      service.recordCheckResult({
        storeId: "UNKNOWN_STORE",
        month: "2026-08",
        reviewsChecked: 10,
        reviewsWithPhoto: 5,
        reviewsOver15ThaiWords: 5,
        qualifiedReviews: 5,
      }),
    NotFoundException,
  );
});

test("GoogleReviewKpiService.listMonthlyKpis aggregates store statistics correctly", async () => {
  const stores = [
    {
      id: "s1",
      name: "OPPO CentralWorld",
      code: "BKK001",
      region: "Central",
      area: "Bangkok",
      storeMaster: {
        externalStoreId: "CW01",
        googleMapsUrl: "https://maps.app.goo.gl/centralworld",
        province: "Bangkok",
        region: "Central",
      },
      googleReviewKpiResults: [
        {
          id: "k1",
          month: "2026-08",
          reviewsChecked: 37,
          reviewsWithPhoto: 20,
          reviewsOver15ThaiWords: 18,
          qualifiedReviews: 14,
          targetQualifiedReviews: 10,
          checkedAt: new Date("2026-09-02T10:00:00Z"),
          checkedByUser: { id: "u1", displayName: "Staff", email: "staff@oppo.th" },
        },
      ],
    },
    {
      id: "s2",
      name: "OPPO Pinklao",
      code: "BKK002",
      region: "Central",
      area: "Bangkok",
      storeMaster: {
        externalStoreId: "PK02",
        googleMapsUrl: "https://maps.app.goo.gl/pinklao",
        province: "Bangkok",
        region: "Central",
      },
      googleReviewKpiResults: [
        {
          id: "k2",
          month: "2026-08",
          reviewsChecked: 15,
          reviewsWithPhoto: 8,
          reviewsOver15ThaiWords: 6,
          qualifiedReviews: 5,
          targetQualifiedReviews: 10,
          checkedAt: new Date("2026-09-02T11:00:00Z"),
          checkedByUser: null,
        },
      ],
    },
    {
      id: "s3",
      name: "OPPO Mega Bangna",
      code: "BKK003",
      region: "Central",
      area: "Samut Prakan",
      storeMaster: null,
      googleReviewKpiResults: [],
    },
  ];

  const mockPrisma = {
    store: {
      findMany: async () => stores,
    },
  } as unknown as PrismaService;

  const service = new GoogleReviewKpiService(mockPrisma);
  const summary = await service.listMonthlyKpis({ month: "2026-08" });

  assert.equal(summary.month, "2026-08");
  assert.equal(summary.totalStores, 3);
  assert.equal(summary.storesWithGoogleMaps, 2);
  assert.equal(summary.checkedStores, 2);
  assert.equal(summary.uncheckedStores, 1);
  assert.equal(summary.passedStores, 1); // s1 has 14 >= 10
  assert.equal(summary.belowTargetStores, 1); // s2 has 5 < 10
  assert.equal(summary.totalQualifiedReviews, 19); // 14 + 5
  assert.equal(summary.totalReviewsChecked, 52); // 37 + 15

  const s1Item = summary.stores.find((s) => s.id === "s1");
  assert.ok(s1Item);
  assert.equal(s1Item?.hasGoogleMaps, true);
  assert.equal(s1Item?.kpiResult?.isPassed, true);
  assert.equal(s1Item?.kpiResult?.qualifiedReviews, 14);

  const s3Item = summary.stores.find((s) => s.id === "s3");
  assert.ok(s3Item);
  assert.equal(s3Item?.hasGoogleMaps, false);
  assert.equal(s3Item?.kpiResult, null);
});
