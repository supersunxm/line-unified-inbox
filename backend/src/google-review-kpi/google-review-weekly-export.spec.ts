import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { GoogleReviewKpiService } from "./google-review-kpi.service";
import { PrismaService } from "../prisma.service";

test("GoogleReviewKpiService.exportWeeklyLeaderboard generates valid XLSX export", async () => {
  const dummyPeriod = {
    id: "period-1",
    weekNumber: 1,
    year: 2026,
    startDate: new Date("2026-08-26T00:00:00.000+07:00"),
    endDate: new Date("2026-09-02T00:00:00.000+07:00"),
    label: "Week 1",
    status: "CLOSED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyStore = {
    storeCode: "25610",
    storeName: "OPPO CentralWorld",
    storeId: "store-1",
    region: "BKK",
    province: "Bangkok",
    googleMapsUrl: "https://maps.google.com/?cid=123",
  };

  const mockPrisma = {
    googleReviewWeeklyPeriod: {
      findMany: async () => [dummyPeriod],
      upsert: async () => dummyPeriod,
    },
    googleReviewWeeklyStoreMembership: {
      count: async () => 1,
      findMany: async () => [
        {
          id: "m-1",
          storeCode: dummyStore.storeCode,
          storeId: dummyStore.storeId,
          storeNameSnapshot: dummyStore.storeName,
          regionSnapshot: dummyStore.region,
          provinceSnapshot: dummyStore.province,
          googleMapsUrlSnapshot: dummyStore.googleMapsUrl,
          isActive: true,
          effectiveFrom: new Date("2026-08-26T00:00:00.000Z"),
          effectiveTo: null,
          store: null,
        },
      ],
    },
    storeMaster: {
      findMany: async () => [
        {
          externalStoreId: dummyStore.storeCode,
          storeName: dummyStore.storeName,
          region: dummyStore.region,
          province: dummyStore.province,
          googleMapsUrl: dummyStore.googleMapsUrl,
        },
      ],
    },
    googleReviewDailyKpi: {
      findMany: async () => [
        {
          id: "d-1",
          storeCode: "25610",
          date: "2026-08-26",
          weekNumber: 1,
          storeRating: 4.9,
          reviewsChecked: 5,
          reviewsWithPhoto: 3,
          qualifiedReviews: 3,
          status: "CLOSED",
        },
      ],
    },
    googleReviewWeeklyKpi: {
      findMany: async () => [
        {
          id: "w-1",
          weekPeriodId: "period-1",
          weekNumber: 1,
          storeCode: "25610",
          storeRating: 4.9,
          reviewsChecked: 5,
          reviewsWithPhoto: 3,
          reviewsOver15ThaiWords: 3,
          qualifiedReviews: 3,
          rank: 1,
          status: "CLOSED",
        },
      ],
    },
  } as unknown as PrismaService;

  const service = new GoogleReviewKpiService(mockPrisma);
  const result = await service.exportWeeklyLeaderboard({
    weekNumber: 1,
    format: "xlsx",
  });

  assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(result.filename, "google-review-kpi-week-1_2026-08-26_to_2026-09-02.xlsx");
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.ok(result.buffer.length > 0);

  // Parse generated workbook to verify contents
  const workbook = XLSX.read(result.buffer, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["Weekly KPI"]);

  const sheet = workbook.Sheets["Weekly KPI"];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);
  assert.equal(rows.length, 1);

  const row = rows[0];
  assert.equal(row["Rank"], 1);
  assert.equal(row["Store Code"], "25610");
  assert.equal(row["Store Name"], "OPPO CentralWorld");
  assert.equal(row["Region"], "BKK");
  assert.equal(row["Province"], "Bangkok");
  assert.equal(row["Store Rating"], 4.9);
  assert.equal(row["26/08"], 3);
  assert.equal(row["27/08"], 0);
  assert.equal(row["Weekly Total"], 3);
  assert.equal(row["Target"], 10);
  assert.equal(row["Achievement %"], 30);
  assert.equal(row["Status"], "NOT_PASSED");
  assert.equal(row["Week Number"], 1);
  assert.equal(row["Period Start"], "2026-08-26");
  assert.equal(row["Period End"], "2026-09-02");
  assert.equal(row["Period Status"], "CLOSED");
});

test("GoogleReviewKpiService.exportWeeklyLeaderboard generates valid CSV export with UTF-8 BOM", async () => {
  const dummyPeriod = {
    id: "period-1",
    weekNumber: 1,
    year: 2026,
    startDate: new Date("2026-08-26T00:00:00.000+07:00"),
    endDate: new Date("2026-09-02T00:00:00.000+07:00"),
    label: "Week 1",
    status: "CLOSED",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dummyStore = {
    storeCode: "25610",
    storeName: "OPPO เซ็นทรัลเวิลด์",
    storeId: "store-1",
    region: "BKK",
    province: "กรุงเทพมหานคร",
    googleMapsUrl: "https://maps.google.com/?cid=123",
  };

  const mockPrisma = {
    googleReviewWeeklyPeriod: {
      findMany: async () => [dummyPeriod],
      upsert: async () => dummyPeriod,
    },
    googleReviewWeeklyStoreMembership: {
      count: async () => 1,
      findMany: async () => [
        {
          id: "m-1",
          storeCode: dummyStore.storeCode,
          storeId: dummyStore.storeId,
          storeNameSnapshot: dummyStore.storeName,
          regionSnapshot: dummyStore.region,
          provinceSnapshot: dummyStore.province,
          googleMapsUrlSnapshot: dummyStore.googleMapsUrl,
          isActive: true,
          effectiveFrom: new Date("2026-08-26T00:00:00.000Z"),
          effectiveTo: null,
          store: null,
        },
      ],
    },
    storeMaster: {
      findMany: async () => [
        {
          externalStoreId: dummyStore.storeCode,
          storeName: dummyStore.storeName,
          region: dummyStore.region,
          province: dummyStore.province,
          googleMapsUrl: dummyStore.googleMapsUrl,
        },
      ],
    },
    googleReviewDailyKpi: {
      findMany: async () => [],
    },
    googleReviewWeeklyKpi: {
      findMany: async () => [
        {
          id: "w-1",
          weekPeriodId: "period-1",
          weekNumber: 1,
          storeCode: "25610",
          storeRating: 5.0,
          reviewsChecked: 12,
          reviewsWithPhoto: 12,
          reviewsOver15ThaiWords: 12,
          qualifiedReviews: 12,
          rank: 1,
          status: "CLOSED",
        },
      ],
    },
  } as unknown as PrismaService;

  const service = new GoogleReviewKpiService(mockPrisma);
  const result = await service.exportWeeklyLeaderboard({
    weekNumber: 1,
    format: "csv",
  });

  assert.equal(result.contentType, "text/csv; charset=utf-8");
  assert.equal(result.filename, "google-review-kpi-week-1_2026-08-26_to_2026-09-02.csv");
  assert.ok(Buffer.isBuffer(result.buffer));

  // Check UTF-8 BOM (\uFEFF)
  assert.equal(result.buffer[0], 0xef);
  assert.equal(result.buffer[1], 0xbb);
  assert.equal(result.buffer[2], 0xbf);

  const csvContent = result.buffer.toString("utf8");
  assert.ok(csvContent.includes("Rank,Store Code,Store Name,Region,Province,Store Rating"));
  assert.ok(csvContent.includes("OPPO เซ็นทรัลเวิลด์"));
  assert.ok(csvContent.includes("กรุงเทพมหานคร"));
  assert.ok(csvContent.includes("PASSED"));
  assert.ok(csvContent.includes("120%"));
});
