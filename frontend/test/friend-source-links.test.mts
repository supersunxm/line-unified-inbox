import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { friendSourceLinksTranslations, getFriendSourceLinksText } from "../src/app/friend-source-links/friend-source-links-translations.ts";
import {
  MAX_PILOT_STORES,
  buildFriendSourceLinksQueryParams,
  calculateAttributionKPIs,
  calculateSummaryKPIs,
  canRoleAccessFriendSourceLinks,
  evaluateApiError,
  filterEligibleAccounts,
  formatConversionRate,
  formatShortUrlForClipboard,
  isAccountEligible,
  isQrEndpointRequested,
  prepareGeneratePayload,
  prepareUpdatePayload,
  toggleAccountSelection,
} from "../src/app/friend-source-links/friend-source-links-utils.ts";
import {
  buildExportFilename,
  createExcelWorkbookBuffer,
  deduplicateLinks,
  formatDateForExcel,
  pivotLinksByStore,
  prepareLinkDetailsRows,
} from "../src/app/friend-source-links/friend-source-links-export.ts";
import type { FriendSourceLink, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "../src/types/api.ts";

// ──────────────────────────────────────────────────────────────────────
// Source file inspection helpers
// ──────────────────────────────────────────────────────────────────────
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiTs = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const apiTypes = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");
const primaryNav = readFileSync(new URL("../src/app/primary-navigation.ts", import.meta.url), "utf8");
const viewFile = readFileSync(new URL("../src/app/friend-source-links/friend-source-links-view.tsx", import.meta.url), "utf8");
const exportFile = readFileSync(new URL("../src/app/friend-source-links/friend-source-links-export.ts", import.meta.url), "utf8");

// Mock LINE OA helper for unit tests
function mockOa(overrides?: Partial<LineOfficialAccountResponse>): LineOfficialAccountResponse {
  return {
    id: "oa-1",
    name: "OPPO Chonburi OA",
    basicId: "@oppochonburi",
    channelId: "123456",
    maskedChannelId: "****3456",
    destinationId: "dest-1",
    store: {
      id: "store-1",
      name: "OPPO Store Chonburi",
      region: "East",
      area: "Chonburi",
      storeMasterId: "master-1",
      accountName: "@oppochonburi",
      externalStoreId: "EXT-1",
      province: "Chonburi",
      lineId: "@oppochonburi",
      lineOaLink: "https://line.me/R/ti/p/@oppochonburi",
      lineManagerUrl: "https://manager.line.biz/account/@oppochonburi",
      dataQualityStatus: "COMPLETE",
      dataSource: "MASTER",
    },
    connectionStatus: "CONNECTED",
    isActive: true,
    lastWebhookReceivedAt: "2026-07-24T00:00:00Z",
    lastConnectionTestAt: "2026-07-24T00:00:00Z",
    lastConnectionError: null,
    hasChannelSecret: true,
    hasChannelAccessToken: true,
    credentialsHealthy: true,
    conversationCount: 15,
    messagesReceivedToday: 42,
    archivedAt: null,
    webhookUrl: "https://example.com/line/webhook",
    webhookConfigured: true,
    resolvedLineOaManagerUrl: "https://manager.line.biz/account/@oppochonburi",
    ...overrides,
  };
}

// Mock Link helper
function mockLink(overrides?: Partial<FriendSourceLink>): FriendSourceLink {
  return {
    id: "link-1",
    storeId: "store-1",
    storeName: "OPPO Store Chonburi",
    storeCode: "CHONBURI-01",
    lineOaId: "oa-1",
    lineOaName: "OPPO Chonburi OA",
    source: "STORE_QR",
    shortCode: "qr12345",
    shortUrl: "https://pilot.oppo.th/f/qr12345",
    destinationUrl: "https://line.me/R/ti/p/@oppochonburi",
    isActive: true,
    clickCount: 12,
    createdAt: "2026-07-24T10:00:00.000Z",
    updatedAt: "2026-07-24T10:30:00.000Z",
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────
// 1. Role gating: ADMIN navigation visibility
// ──────────────────────────────────────────────────────────────────────
test("canRoleAccessFriendSourceLinks returns true for ADMIN role", () => {
  assert.equal(canRoleAccessFriendSourceLinks("ADMIN"), true);
  assert.match(page, /authUser\?\.role === "ADMIN"/);
  assert.match(page, /href="\/friend-source-links"/);
});

// ──────────────────────────────────────────────────────────────────────
// 2. Role gating: VIEWER navigation hidden and forbidden
// ──────────────────────────────────────────────────────────────────────
test("canRoleAccessFriendSourceLinks returns false for VIEWER role and null", () => {
  assert.equal(canRoleAccessFriendSourceLinks("VIEWER"), false);
  assert.equal(canRoleAccessFriendSourceLinks(null), false);
  assert.equal(canRoleAccessFriendSourceLinks(undefined), false);
});

// ──────────────────────────────────────────────────────────────────────
// 3. Selection limit: sixth account cannot be selected
// ──────────────────────────────────────────────────────────────────────
test("toggleAccountSelection rejects selection beyond MAX_PILOT_STORES (5 accounts)", () => {
  const fiveSelected = ["oa-1", "oa-2", "oa-3", "oa-4", "oa-5"];
  const res = toggleAccountSelection(fiveSelected, "oa-6", MAX_PILOT_STORES, "Maximum 5 LINE OAs allowed");
  assert.deepEqual(res.selected, fiveSelected, "6th account must not be added to selection");
  assert.equal(res.error, "Maximum 5 LINE OAs allowed");

  const deselected = toggleAccountSelection(fiveSelected, "oa-3");
  assert.deepEqual(deselected.selected, ["oa-1", "oa-2", "oa-4", "oa-5"]);
  assert.equal(deselected.error, null);
});

// ──────────────────────────────────────────────────────────────────────
// 4. Generate payload: sends distinct selected lineOaIds
// ──────────────────────────────────────────────────────────────────────
test("prepareGeneratePayload deduplicates selected IDs and enforces bounds", () => {
  const inputWithDuplicates = ["oa-1", " oa-1 ", "oa-2", "oa-2", "oa-3"];
  const prepared = prepareGeneratePayload(inputWithDuplicates);
  assert.deepEqual(prepared.lineOaIds, ["oa-1", "oa-2", "oa-3"], "Duplicates must be removed");
  assert.equal(prepared.error, null);

  const emptyPrepared = prepareGeneratePayload([]);
  assert.equal(emptyPrepared.error, "Select at least 1 LINE OA");

  const overPrepared = prepareGeneratePayload(["a", "b", "c", "d", "e", "f"]);
  assert.equal(overPrepared.error, "Maximum 5 LINE OAs allowed");
});

// ──────────────────────────────────────────────────────────────────────
// 5. Success result: generated counts are formatted correctly
// ──────────────────────────────────────────────────────────────────────
test("generated counts are shown after API success via generateSuccess formatter", () => {
  for (const lang of ["th", "en", "zh"] as const) {
    const t = getFriendSourceLinksText(lang);
    const text = t.generateSuccess(4, 1);
    assert.match(text, /4/);
    assert.match(text, /1/);
  }
});

// ──────────────────────────────────────────────────────────────────────
// 6. Copy short URL: returned shortUrl is passed to clipboard
// ──────────────────────────────────────────────────────────────────────
test("formatShortUrlForClipboard passes the exact returned shortUrl from API", () => {
  const apiShortUrl = "https://pilot.oppo.th/f/xK9mP2q1";
  const formatted = formatShortUrlForClipboard(apiShortUrl);
  assert.equal(formatted, "https://pilot.oppo.th/f/xK9mP2q1");
});

// ──────────────────────────────────────────────────────────────────────
// 7. Toggle PATCH payload: sends only { isActive: boolean }
// ──────────────────────────────────────────────────────────────────────
test("prepareUpdatePayload returns object containing only { isActive: boolean }", () => {
  const activePayload = prepareUpdatePayload(true);
  assert.deepEqual(activePayload, { isActive: true });

  const inactivePayload = prepareUpdatePayload(false);
  assert.deepEqual(inactivePayload, { isActive: false });
  assert.deepEqual(Object.keys(inactivePayload), ["isActive"], "Payload must contain ONLY isActive property");
});

// ──────────────────────────────────────────────────────────────────────
// 8. 403 Handling: produces dedicated forbidden state
// ──────────────────────────────────────────────────────────────────────
test("evaluateApiError identifies 403 Forbidden responses without retry", () => {
  const err403 = { status: 403, message: "Forbidden" };
  const res = evaluateApiError(err403);
  assert.equal(res.is403, true);
  assert.equal(res.canRetry, false);

  const err401 = { status: 401, message: "Unauthorized" };
  const res401 = evaluateApiError(err401);
  assert.equal(res401.is403, true);
});

// ──────────────────────────────────────────────────────────────────────
// 9. API Failure & Retry: non-403 error allows retry
// ──────────────────────────────────────────────────────────────────────
test("evaluateApiError identifies network/500 failures and allows retry", () => {
  const networkError = new Error("Failed to fetch");
  const res = evaluateApiError(networkError);
  assert.equal(res.is403, false);
  assert.equal(res.canRetry, true);
  assert.equal(res.message, "Failed to fetch");
});

// ──────────────────────────────────────────────────────────────────────
// 10. QR Endpoint safety: QR endpoint is never requested
// ──────────────────────────────────────────────────────────────────────
test("isQrEndpointRequested returns false for standard endpoints and catches accidental /qr calls", () => {
  const standardPaths = [
    "/friend-source-links",
    "/friend-source-links/generate",
    "/friend-source-links/summary",
    "/friend-source-links/link-123",
  ];
  assert.equal(isQrEndpointRequested(standardPaths), false);
  assert.equal(isQrEndpointRequested(["/friend-source-links/qr"]), true);
  assert.doesNotMatch(apiTs, /friend-source-links.*\/qr/);
  assert.doesNotMatch(viewFile, /api\..*[Qq][Rr]/);
});

// ──────────────────────────────────────────────────────────────────────
// 11. Excel Export 1: Four source rows are pivoted into one store row
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore pivots 4 source links of an account into 1 store row", () => {
  const links: FriendSourceLink[] = [
    mockLink({ id: "l1", source: "STORE_QR", shortUrl: "https://pilot.oppo.th/f/qr1", clickCount: 10, isActive: true }),
    mockLink({ id: "l2", source: "TIKTOK", shortUrl: "https://pilot.oppo.th/f/tk2", clickCount: 5, isActive: true }),
    mockLink({ id: "l3", source: "FACEBOOK", shortUrl: "https://pilot.oppo.th/f/fb3", clickCount: 8, isActive: true }),
    mockLink({ id: "l4", source: "INSTAGRAM", shortUrl: "https://pilot.oppo.th/f/ig4", clickCount: 2, isActive: false }),
  ];

  const rows = pivotLinksByStore(links);
  assert.equal(rows.length, 1, "4 source links for the same OA must pivot into 1 summary row");
  assert.equal(rows[0].storeName, "OPPO Store Chonburi");
  assert.equal(rows[0].lineOaName, "OPPO Chonburi OA");
  assert.equal(rows[0].basicId, "@CHONBURI-01");
});

// ──────────────────────────────────────────────────────────────────────
// 12. Excel Export 2: Correct shortUrl placed under each source column
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore places exact shortUrl under matching source column", () => {
  const links: FriendSourceLink[] = [
    mockLink({ id: "l1", source: "STORE_QR", shortUrl: "https://pilot.oppo.th/f/qr1" }),
    mockLink({ id: "l2", source: "TIKTOK", shortUrl: "https://pilot.oppo.th/f/tk2" }),
    mockLink({ id: "l3", source: "FACEBOOK", shortUrl: "https://pilot.oppo.th/f/fb3" }),
    mockLink({ id: "l4", source: "INSTAGRAM", shortUrl: "https://pilot.oppo.th/f/ig4" }),
  ];

  const row = pivotLinksByStore(links)[0];
  assert.equal(row.qrLink, "https://pilot.oppo.th/f/qr1");
  assert.equal(row.tiktokLink, "https://pilot.oppo.th/f/tk2");
  assert.equal(row.facebookLink, "https://pilot.oppo.th/f/fb3");
  assert.equal(row.instagramLink, "https://pilot.oppo.th/f/ig4");
});

// ──────────────────────────────────────────────────────────────────────
// 13. Excel Export 3: Missing source produces blank cell
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore leaves missing source column as blank string", () => {
  const partialLinks: FriendSourceLink[] = [
    mockLink({ id: "l1", source: "STORE_QR", shortUrl: "https://pilot.oppo.th/f/qr1" }),
    mockLink({ id: "l2", source: "TIKTOK", shortUrl: "https://pilot.oppo.th/f/tk2" }),
  ];

  const row = pivotLinksByStore(partialLinks)[0];
  assert.equal(row.qrLink, "https://pilot.oppo.th/f/qr1");
  assert.equal(row.tiktokLink, "https://pilot.oppo.th/f/tk2");
  assert.equal(row.facebookLink, "", "Missing Facebook source link must be empty string");
  assert.equal(row.instagramLink, "", "Missing Instagram source link must be empty string");
});

// ──────────────────────────────────────────────────────────────────────
// 14. Excel Export 4: Total clicks are summed correctly
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore sums total clicks across all generated sources for an account", () => {
  const links: FriendSourceLink[] = [
    mockLink({ id: "l1", source: "STORE_QR", clickCount: 15 }),
    mockLink({ id: "l2", source: "TIKTOK", clickCount: 25 }),
    mockLink({ id: "l3", source: "FACEBOOK", clickCount: 10 }),
    mockLink({ id: "l4", source: "INSTAGRAM", clickCount: 0 }),
  ];

  const row = pivotLinksByStore(links)[0];
  assert.equal(row.totalClicks, 50, "Total clicks must equal 15 + 25 + 10 + 0 = 50");
});

// ──────────────────────────────────────────────────────────────────────
// 15. Excel Export 5: Active source count is correct
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore counts active sources correctly", () => {
  const links: FriendSourceLink[] = [
    mockLink({ id: "l1", source: "STORE_QR", isActive: true }),
    mockLink({ id: "l2", source: "TIKTOK", isActive: true }),
    mockLink({ id: "l3", source: "FACEBOOK", isActive: true }),
    mockLink({ id: "l4", source: "INSTAGRAM", isActive: false }),
  ];

  const row = pivotLinksByStore(links)[0];
  assert.equal(row.activeSourcesCount, 3, "3 active out of 4 generated must produce activeSourcesCount 3");
});

// ──────────────────────────────────────────────────────────────────────
// 16. Excel Export 6: Duplicate records are removed
// ──────────────────────────────────────────────────────────────────────
test("deduplicateLinks removes duplicate link records by ID", () => {
  const duplicated: FriendSourceLink[] = [
    mockLink({ id: "link-dup", shortCode: "code1", clickCount: 10 }),
    mockLink({ id: "link-dup", shortCode: "code1", clickCount: 10 }), // Duplicate
    mockLink({ id: "link-unique", shortCode: "code2", clickCount: 5 }),
  ];

  const clean = deduplicateLinks(duplicated);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].id, "link-dup");
  assert.equal(clean[1].id, "link-unique");
});

// ──────────────────────────────────────────────────────────────────────
// 17. Excel Export 7: Destination URL and internal IDs are not exported
// ──────────────────────────────────────────────────────────────────────
test("pivotLinksByStore and LinkDetails omit destinationUrl, storeId, lineOaId, and internal IDs", () => {
  const links: FriendSourceLink[] = [mockLink()];
  const pivoted = pivotLinksByStore(links)[0];
  const keys = Object.keys(pivoted);

  assert.equal(keys.includes("destinationUrl"), false, "destinationUrl must not be in export row");
  assert.equal(keys.includes("storeId"), false, "storeId must not be in export row");
  assert.equal(keys.includes("lineOaId"), false, "lineOaId must not be in export row");
  assert.equal(keys.includes("shortCode"), false, "shortCode must not be in export row");
  assert.equal(keys.includes("channelSecret"), false);
  assert.equal(keys.includes("accessToken"), false);

  const detailsRow = prepareLinkDetailsRows(links, "en")[0];
  const detailKeys = Object.keys(detailsRow);
  assert.equal(detailKeys.includes("destinationUrl"), false);
  assert.equal(detailKeys.includes("storeId"), false);
  assert.equal(detailKeys.includes("lineOaId"), false);
});

// ──────────────────────────────────────────────────────────────────────
// 18. Excel Export 8 & 9: Export All vs Export Current mode data behavior
// ──────────────────────────────────────────────────────────────────────
test("Export All mode queries without filters while Export Current uses active filters", () => {
  assert.match(viewFile, /handleExportExcel = async/);
  assert.match(viewFile, /api\.friendSourceLinks\(\)/);
  assert.match(viewFile, /api\.friendSourceLinks\(Object\.keys\(filters\)/);
});

// ──────────────────────────────────────────────────────────────────────
// 19. Excel Export 10: Empty data disables export button
// ──────────────────────────────────────────────────────────────────────
test("Export button is disabled when data is loading, exporting, or empty", () => {
  assert.match(viewFile, /disabled=\{loading \|\| exporting \|\| \(links\.length === 0 && kpis\.totalLinks === 0\)\}/);
});

// ──────────────────────────────────────────────────────────────────────
// 20. Excel Export 11: Filename contains current date
// ──────────────────────────────────────────────────────────────────────
test("buildExportFilename generates friend-source-links-YYYY-MM-DD.xlsx with supplied or current date", () => {
  const fn1 = buildExportFilename("2026-07-24");
  assert.equal(fn1, "friend-source-links-2026-07-24.xlsx");

  const fnDefault = buildExportFilename();
  assert.match(fnDefault, /^friend-source-links-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

// ──────────────────────────────────────────────────────────────────────
// 21. Excel Export 12: Thai, English, and Chinese labels exist for Excel Export
// ──────────────────────────────────────────────────────────────────────
test("Export labels exist across all three languages (th, en, zh)", () => {
  const th = getFriendSourceLinksText("th");
  assert.equal(th.exportExcel, "ดาวน์โหลด Excel");
  assert.equal(th.exportAll, "ส่งออกทุกร้านค้า");
  assert.equal(th.exportCurrent, "ส่งออกผลลัพธ์ปัจจุบัน");

  const en = getFriendSourceLinksText("en");
  assert.equal(en.exportExcel, "Export Excel");
  assert.equal(en.exportAll, "Export all stores");
  assert.equal(en.exportCurrent, "Export current results");

  const zh = getFriendSourceLinksText("zh");
  assert.equal(zh.exportExcel, "导出 Excel");
  assert.equal(zh.exportAll, "导出所有门店");
  assert.equal(zh.exportCurrent, "导出当前筛选结果");
});

// ──────────────────────────────────────────────────────────────────────
// 22. Excel Export 13: Workbook contains exactly 3 required sheets
// ──────────────────────────────────────────────────────────────────────
test("createExcelWorkbookBuffer generates workbook with Store Distribution, Link Details, and Instructions sheets", async () => {
  const links: FriendSourceLink[] = [mockLink()];
  const buffer = await createExcelWorkbookBuffer(links, "en");

  assert.ok(buffer instanceof Uint8Array);
  assert.ok(buffer.length > 0, "Generated Excel XLSX buffer must be non-empty");

  assert.match(exportFile, /workbook\.addWorksheet\("Store Distribution"/);
  assert.match(exportFile, /workbook\.addWorksheet\("Link Details"/);
  assert.match(exportFile, /workbook\.addWorksheet\("Instructions"/);
});

// ──────────────────────────────────────────────────────────────────────
// 23. Date formatting helper for Excel
// ──────────────────────────────────────────────────────────────────────
test("formatDateForExcel formats ISO dates into yyyy-mm-dd hh:mm cleanly", () => {
  const formatted = formatDateForExcel("2026-07-24T10:30:00.000Z");
  assert.match(formatted, /^2026-07-24 \d{2}:30$/);
  assert.equal(formatDateForExcel(null), "");
  assert.equal(formatDateForExcel(undefined), "");
});

// ──────────────────────────────────────────────────────────────────────
// 24. Eligibility & account search validation
// ──────────────────────────────────────────────────────────────────────
test("isAccountEligible strictly validates connectionStatus, active flag, basicId, and store presence", () => {
  assert.equal(isAccountEligible(mockOa()), true);
  assert.equal(isAccountEligible(mockOa({ isActive: false })), false);
  assert.equal(isAccountEligible(mockOa({ connectionStatus: "ERROR" })), false);
  assert.equal(isAccountEligible(mockOa({ basicId: null })), false);
  assert.equal(isAccountEligible(mockOa({ basicId: "   " })), false);
  assert.equal(isAccountEligible(mockOa({ archivedAt: "2026-07-24T00:00:00Z" })), false);
});

// ──────────────────────────────────────────────────────────────────────
// 25. Account search filtering
// ──────────────────────────────────────────────────────────────────────
test("filterEligibleAccounts filters by search query across store name, OA name, and basicId", () => {
  const accounts = [
    mockOa({ id: "1", name: "Alpha OA", basicId: "@alpha", store: { id: "s1", name: "Chonburi Store", region: null, area: null, storeMasterId: null, accountName: null, externalStoreId: null, province: null, lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: null, dataSource: "MANUAL" } }),
    mockOa({ id: "2", name: "Beta OA", basicId: "@beta", store: { id: "s2", name: "Bangkok Central", region: null, area: null, storeMasterId: null, accountName: null, externalStoreId: null, province: null, lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: null, dataSource: "MANUAL" } }),
    mockOa({ id: "3", isActive: false }),
  ];

  assert.equal(filterEligibleAccounts(accounts, "").length, 2);
  assert.equal(filterEligibleAccounts(accounts, "Chonburi").length, 1);
  assert.equal(filterEligibleAccounts(accounts, "@beta").length, 1);
  assert.equal(filterEligibleAccounts(accounts, "nonexistent").length, 0);
});

// ──────────────────────────────────────────────────────────────────────
// 26. Query parameters builder
// ──────────────────────────────────────────────────────────────────────
test("buildFriendSourceLinksQueryParams constructs URLSearchParams omitting empty values", () => {
  const emptyQs = buildFriendSourceLinksQueryParams({});
  assert.equal(emptyQs, "");

  const fullQs = buildFriendSourceLinksQueryParams({
    storeId: "store-1",
    source: "STORE_QR",
    isActive: "true",
    search: "chonburi",
  });
  assert.equal(fullQs, "?storeId=store-1&source=STORE_QR&isActive=true&search=chonburi");
});

// ──────────────────────────────────────────────────────────────────────
// 27. KPI calculation
// ──────────────────────────────────────────────────────────────────────
test("calculateSummaryKPIs aggregates total links, active links, total clicks, and unique stores", () => {
  const summary: FriendSourceLinksSummaryItem[] = [
    { storeId: "store-1", storeName: "Store 1", storeCode: "S1", source: "STORE_QR", totalLinks: 2, activeLinks: 2, clicks: 10 },
    { storeId: "store-1", storeName: "Store 1", storeCode: "S1", source: "TIKTOK", totalLinks: 2, activeLinks: 1, clicks: 5 },
    { storeId: "store-2", storeName: "Store 2", storeCode: "S2", source: "FACEBOOK", totalLinks: 4, activeLinks: 4, clicks: 25 },
  ];

  const kpis = calculateSummaryKPIs(summary);
  assert.equal(kpis.totalLinks, 8);
  assert.equal(kpis.activeLinks, 7);
  assert.equal(kpis.totalClicks, 40);
  assert.equal(kpis.storesConfigured, 2);
});

// ──────────────────────────────────────────────────────────────────────
// 28. Translation key parity
// ──────────────────────────────────────────────────────────────────────
test("Thai, English, and Chinese translation objects have identical keys", () => {
  const thKeys = Object.keys(friendSourceLinksTranslations.th).sort();
  const enKeys = Object.keys(friendSourceLinksTranslations.en).sort();
  const zhKeys = Object.keys(friendSourceLinksTranslations.zh).sort();
  assert.deepEqual(thKeys, enKeys);
  assert.deepEqual(enKeys, zhKeys);
});

// ──────────────────────────────────────────────────────────────────────
// 29. Primary navigation registration
// ──────────────────────────────────────────────────────────────────────
test("primary navigation includes friend-source-links in PrimarySection type and state builder", () => {
  assert.match(primaryNav, /friend-source-links/);
  assert.match(primaryNav, /friendSourceLinksActive/);
});

// ──────────────────────────────────────────────────────────────────────
// 30. API types completeness
// ──────────────────────────────────────────────────────────────────────
test("FriendSourceLink type includes exact backend formatLinkResponse fields", () => {
  assert.match(apiTypes, /FriendSourceLink/);
  assert.match(apiTypes, /shortUrl: string/);
  assert.match(apiTypes, /clickCount: number/);
  assert.match(apiTypes, /storeId: string/);
  assert.match(apiTypes, /lineOaId: string/);
  assert.match(apiTypes, /source: FriendSource/);
  assert.match(apiTypes, /destinationUrl: string/);
  assert.match(apiTypes, /isActive: boolean/);
});

// Unused type helper to ensure compilation
void (null as unknown as FriendSourceLink);

// ──────────────────────────────────────────────────────────────────────
// 31. Attribution Metrics & Percentage Formatting Tests
// ──────────────────────────────────────────────────────────────────────
test("Attribution metric formatting: 0.0667 displays as 6.67% and zero as 0.00%", () => {
  assert.equal(formatConversionRate(0.0667), "6.67%");
  assert.equal(formatConversionRate(0), "0.00%");
  assert.equal(formatConversionRate(null), "0.00%");
  assert.equal(formatConversionRate(NaN), "0.00%");
});

test("Attribution KPIs: totals use filtered rows, overall conversion uses confirmed adds / clicks, and distinct from identified visits", () => {
  const filteredLinks: FriendSourceLink[] = [
    {
      id: "link-1",
      storeId: "store-1",
      storeName: "Store 1",
      storeCode: "S1",
      lineOaId: "oa-1",
      lineOaName: "OA 1",
      source: "STORE_QR",
      shortCode: "sc1",
      shortUrl: "https://x.co/sc1",
      destinationUrl: "https://line.me",
      isActive: true,
      clickCount: 100,
      identifiedVisits: 85,
      confirmedAdds: 40,
      conversionRate: 0.4,
      createdAt: "2026-07-24T00:00:00Z",
      updatedAt: "2026-07-24T00:00:00Z",
    },
    {
      id: "link-2",
      storeId: "store-1",
      storeName: "Store 1",
      storeCode: "S1",
      lineOaId: "oa-1",
      lineOaName: "OA 1",
      source: "TIKTOK",
      shortCode: "sc2",
      shortUrl: "https://x.co/sc2",
      destinationUrl: "https://line.me",
      isActive: true,
      clickCount: 50,
      identifiedVisits: 30,
      confirmedAdds: 10,
      conversionRate: 0.2,
      createdAt: "2026-07-24T00:00:00Z",
      updatedAt: "2026-07-24T00:00:00Z",
    },
  ];

  const attrKpis = calculateAttributionKPIs(filteredLinks);
  assert.equal(attrKpis.totalClicks, 150);
  assert.equal(attrKpis.identifiedVisits, 115);
  assert.equal(attrKpis.confirmedAdds, 50);
  // overall conversion = 50 / 150 = 33.33%
  assert.equal(attrKpis.overallConversionRate, "33.33%");

  // Identified visits (115) != Confirmed adds (50)
  assert.notEqual(attrKpis.identifiedVisits, attrKpis.confirmedAdds);
});

test("Attribution translation keys exist in th, en, and zh", () => {
  const th = friendSourceLinksTranslations.th;
  const en = friendSourceLinksTranslations.en;
  const zh = friendSourceLinksTranslations.zh;

  assert.equal(th.tableClicks, "คลิก");
  assert.equal(th.tableIdentifiedVisits, "ยืนยันตัวตน");
  assert.equal(th.tableConfirmedAdds, "เพิ่มเพื่อนสำเร็จ");
  assert.equal(th.tableConversionRate, "Conversion");

  assert.equal(en.tableClicks, "Clicks");
  assert.equal(en.tableIdentifiedVisits, "Identified");
  assert.equal(en.tableConfirmedAdds, "Confirmed Adds");
  assert.equal(en.tableConversionRate, "Conversion");

  assert.equal(zh.tableClicks, "点击");
  assert.equal(zh.tableIdentifiedVisits, "已识别");
  assert.equal(zh.tableConfirmedAdds, "成功加好友");
  assert.equal(zh.tableConversionRate, "转化率");
});

test("Responsive table has overflow-x-auto wrapper and tooltips", () => {
  assert.match(viewFile, /overflow-x-auto/);
  assert.match(viewFile, /tooltipIdentified/);
  assert.match(viewFile, /tooltipConfirmed/);
  assert.match(viewFile, /tooltipConversion/);
});

test("Excel export includes Identified Visits, Confirmed Adds, and formatted percentage output (6.67%)", () => {
  const testLinks: FriendSourceLink[] = [
    {
      id: "link-1",
      storeId: "store-1",
      storeName: "Test Store",
      storeCode: "TS1",
      lineOaId: "oa-1",
      lineOaName: "Test OA",
      source: "STORE_QR",
      shortCode: "sc1",
      shortUrl: "https://x.co/sc1",
      destinationUrl: "https://line.me",
      isActive: true,
      clickCount: 150,
      identifiedVisits: 100,
      confirmedAdds: 10,
      conversionRate: 0.0667,
      createdAt: "2026-07-24T00:00:00Z",
      updatedAt: "2026-07-24T00:00:00Z",
    },
  ];

  const pivot = pivotLinksByStore(testLinks);
  assert.equal(pivot[0].identifiedVisits, 100);
  assert.equal(pivot[0].confirmedAdds, 10);
  assert.equal(pivot[0].conversionRate, "6.67%");

  const details = prepareLinkDetailsRows(testLinks, "en");
  assert.equal(details[0].identifiedVisits, 100);
  assert.equal(details[0].confirmedAdds, 10);
  assert.equal(details[0].conversionRate, "6.67%");
});
