import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { GoogleReviewKpiService } from "./google-review-kpi.service";
import { PrismaService } from "../prisma.service";

test("GoogleReviewKpiService.exportWeeklyLeaderboard generates valid XLSX export with freeze, bold headers, numeric percentage, and blank missing dates", async () => {
  const dummyPeriod = {
    id: "period-1",
    weekNumber: 2,
    year: 2026,
    startDate: new Date("2026-09-02T00:00:00.000+07:00"),
    endDate: new Date("2026-09-09T00:00:00.000+07:00"),
    label: "Week 2",
    status: "OPEN",
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
          effectiveFrom: new Date("2026-09-02T00:00:00.000Z"),
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
    // Daily records:
    // 02/09: 3 qualified reviews
    // 03/09: 0 qualified reviews (actual recorded zero)
    // 04/09 - 08/09: missing/future dates
    googleReviewDailyKpi: {
      findMany: async () => [
        {
          id: "d-1",
          storeCode: "25610",
          date: "2026-09-02",
          weekNumber: 2,
          storeRating: 4.9,
          reviewsChecked: 5,
          reviewsWithPhoto: 3,
          qualifiedReviews: 3,
          status: "CLOSED",
        },
        {
          id: "d-2",
          storeCode: "25610",
          date: "2026-09-03",
          weekNumber: 2,
          storeRating: 4.9,
          reviewsChecked: 0,
          reviewsWithPhoto: 0,
          qualifiedReviews: 0,
          status: "CLOSED",
        },
      ],
    },
    googleReviewWeeklyKpi: {
      findMany: async () => [
        {
          id: "w-1",
          weekPeriodId: "period-1",
          weekNumber: 2,
          storeCode: "25610",
          storeRating: 4.9,
          reviewsChecked: 5,
          reviewsWithPhoto: 3,
          reviewsOver15ThaiWords: 3,
          qualifiedReviews: 3,
          rank: 1,
          status: "OPEN",
        },
      ],
    },
  } as unknown as PrismaService;

  const service = new GoogleReviewKpiService(mockPrisma);
  const result = await service.exportWeeklyLeaderboard({
    weekNumber: 2,
    format: "xlsx",
  });

  assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(result.filename, "google-review-kpi-week-2_2026-09-02_to_2026-09-09.xlsx");
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.ok(result.buffer.length > 0);

  // Parse generated workbook with ExcelJS to verify structure and formatting
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);

  assert.equal(workbook.worksheets.length, 1);
  const worksheet = workbook.getWorksheet("Weekly KPI");
  assert.ok(worksheet, "Worksheet 'Weekly KPI' must exist");

  // 1. Verify frozen row 1
  const views = worksheet.views;
  assert.ok(views && views.length > 0);
  assert.equal(views[0].state, "frozen");
  assert.equal(views[0].ySplit, 1);

  // 2. Verify header row is bold
  const headerRow = worksheet.getRow(1);
  assert.equal(headerRow.font?.bold, true);

  // 3. Verify autofilter
  assert.ok(worksheet.autoFilter);

  // 4. Verify data row
  const row2 = worksheet.getRow(2);
  // Rank, Store Code, Store Name, Region, Province, Store Rating
  assert.equal(row2.getCell(1).value, 1); // Rank
  assert.equal(row2.getCell(2).value, "25610"); // Store Code
  assert.equal(row2.getCell(3).value, "OPPO CentralWorld"); // Store Name
  assert.equal(row2.getCell(4).value, "BKK"); // Region
  assert.equal(row2.getCell(5).value, "Bangkok"); // Province
  assert.equal(row2.getCell(6).value, 4.9); // Store Rating

  // 7 date columns: 02/09, 03/09, 04/09, 05/09, 06/09, 07/09, 08/09
  assert.equal(worksheet.getRow(1).getCell(7).value, "02/09");
  assert.equal(worksheet.getRow(1).getCell(8).value, "03/09");
  assert.equal(worksheet.getRow(1).getCell(9).value, "04/09");
  assert.equal(worksheet.getRow(1).getCell(10).value, "05/09");
  assert.equal(worksheet.getRow(1).getCell(11).value, "06/09");
  assert.equal(worksheet.getRow(1).getCell(12).value, "07/09");
  assert.equal(worksheet.getRow(1).getCell(13).value, "08/09");

  // Actual recorded values vs uncollected/future:
  assert.equal(row2.getCell(7).value, 3); // 02/09 actual recorded 3
  assert.equal(row2.getCell(8).value, 0); // 03/09 actual recorded 0 -> stays 0
  assert.equal(row2.getCell(9).value, null); // 04/09 missing/future -> null (blank cell)
  assert.equal(row2.getCell(10).value, null); // 05/09 missing/future -> null (blank cell)
  assert.equal(row2.getCell(11).value, null); // 06/09 missing/future -> null (blank cell)
  assert.equal(row2.getCell(12).value, null); // 07/09 missing/future -> null (blank cell)
  assert.equal(row2.getCell(13).value, null); // 08/09 missing/future -> null (blank cell)

  // Totals & Achievement
  assert.equal(row2.getCell(14).value, 3); // Weekly Total
  assert.equal(row2.getCell(15).value, 10); // Target
  // Achievement % should be numeric ratio (0.3) with numFmt = "0.0%"
  const achievementCell = row2.getCell(16);
  assert.equal(achievementCell.value, 0.3);
  assert.equal(achievementCell.numFmt, "0.0%");

  assert.equal(row2.getCell(17).value, "NOT_PASSED");
  assert.equal(row2.getCell(18).value, 2); // Week Number
  assert.equal(row2.getCell(19).value, "Week 2"); // Week Label
  assert.equal(row2.getCell(20).value, "2026-09-02"); // Period Start
  assert.equal(row2.getCell(21).value, "2026-09-09"); // Period End
  assert.equal(row2.getCell(22).value, "OPEN"); // Period Status
});

test("GoogleReviewKpiService.exportWeeklyLeaderboard generates valid CSV export with UTF-8 BOM, empty future dates, and recorded zeros", async () => {
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
    // Daily records:
    // 26/08: 12 qualified reviews
    // 27/08: 0 qualified reviews (actual recorded zero)
    // 28/08 to 01/09: not recorded (empty)
    googleReviewDailyKpi: {
      findMany: async () => [
        {
          id: "d-1",
          storeCode: "25610",
          date: "2026-08-26",
          weekNumber: 1,
          storeRating: 5.0,
          reviewsChecked: 12,
          reviewsWithPhoto: 12,
          qualifiedReviews: 12,
          status: "CLOSED",
        },
        {
          id: "d-2",
          storeCode: "25610",
          date: "2026-08-27",
          weekNumber: 1,
          storeRating: 5.0,
          reviewsChecked: 0,
          reviewsWithPhoto: 0,
          qualifiedReviews: 0,
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
  const lines = csvContent.replace(/^\uFEFF/, "").split("\r\n");
  assert.equal(lines.length >= 2, true);

  const headerCols = lines[0].split(",");
  const dataCols = lines[1].split(",");

  // Header checks
  assert.ok(headerCols.includes("Rank"));
  assert.ok(headerCols.includes("Store Name"));
  assert.ok(headerCols.includes("26/08"));
  assert.ok(headerCols.includes("27/08"));
  assert.ok(headerCols.includes("28/08"));

  // Check actual values
  // Thai characters preserved
  assert.ok(lines[1].includes("OPPO เซ็นทรัลเวิลด์"));
  assert.ok(lines[1].includes("กรุงเทพมหานคร"));
  assert.ok(lines[1].includes("PASSED"));
  assert.ok(lines[1].includes("120%"));

  // Find index of 26/08, 27/08, 28/08
  const idx26 = headerCols.indexOf("26/08");
  const idx27 = headerCols.indexOf("27/08");
  const idx28 = headerCols.indexOf("28/08");

  assert.equal(dataCols[idx26], "12"); // actual recorded 12
  assert.equal(dataCols[idx27], "0");  // actual recorded 0 stays "0"
  assert.equal(dataCols[idx28], "");   // missing/uncollected is empty ""
});
