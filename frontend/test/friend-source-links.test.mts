import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { friendSourceLinksTranslations, getFriendSourceLinksText } from "../src/app/friend-source-links/friend-source-links-translations.ts";
import {
  ALL_SOURCES,
  MAX_PILOT_STORES,
  buildFriendSourceLinksQueryParams,
  calculateSummaryKPIs,
  canRoleAccessFriendSourceLinks,
  evaluateApiError,
  filterEligibleAccounts,
  formatShortUrlForClipboard,
  isAccountEligible,
  isQrEndpointRequested,
  prepareGeneratePayload,
  prepareUpdatePayload,
  toggleAccountSelection,
} from "../src/app/friend-source-links/friend-source-links-utils.ts";
import type { FriendSourceLink, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "../src/types/api.ts";

// ──────────────────────────────────────────────────────────────────────
// Source file inspection helpers
// ──────────────────────────────────────────────────────────────────────
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiTs = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const apiTypes = readFileSync(new URL("../src/types/api.ts", import.meta.url), "utf8");
const primaryNav = readFileSync(new URL("../src/app/primary-navigation.ts", import.meta.url), "utf8");
const viewFile = readFileSync(new URL("../src/app/friend-source-links/friend-source-links-view.tsx", import.meta.url), "utf8");

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

  // Deselecting an existing item works without error
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

  // Empty selection
  const emptyPrepared = prepareGeneratePayload([]);
  assert.equal(emptyPrepared.error, "Select at least 1 LINE OA");

  // Over 5 distinct IDs
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
// 11. Eligibility criteria validation
// ──────────────────────────────────────────────────────────────────────
test("isAccountEligible strictly validates connectionStatus, active flag, basicId, and store presence", () => {
  assert.equal(isAccountEligible(mockOa()), true);

  // Inactive OA
  assert.equal(isAccountEligible(mockOa({ isActive: false })), false);

  // Error connection status
  assert.equal(isAccountEligible(mockOa({ connectionStatus: "ERROR" })), false);

  // Missing basicId
  assert.equal(isAccountEligible(mockOa({ basicId: null })), false);
  assert.equal(isAccountEligible(mockOa({ basicId: "   " })), false);

  // Archived OA
  assert.equal(isAccountEligible(mockOa({ archivedAt: "2026-07-24T00:00:00Z" })), false);
});

// ──────────────────────────────────────────────────────────────────────
// 12. Account search filtering
// ──────────────────────────────────────────────────────────────────────
test("filterEligibleAccounts filters by search query across store name, OA name, and basicId", () => {
  const accounts = [
    mockOa({ id: "1", name: "Alpha OA", basicId: "@alpha", store: { id: "s1", name: "Chonburi Store", region: null, area: null, storeMasterId: null, accountName: null, externalStoreId: null, province: null, lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: null, dataSource: "MANUAL" } }),
    mockOa({ id: "2", name: "Beta OA", basicId: "@beta", store: { id: "s2", name: "Bangkok Central", region: null, area: null, storeMasterId: null, accountName: null, externalStoreId: null, province: null, lineId: null, lineOaLink: null, lineManagerUrl: null, dataQualityStatus: null, dataSource: "MANUAL" } }),
    mockOa({ id: "3", isActive: false }), // Ineligible
  ];

  assert.equal(filterEligibleAccounts(accounts, "").length, 2);
  assert.equal(filterEligibleAccounts(accounts, "Chonburi").length, 1);
  assert.equal(filterEligibleAccounts(accounts, "@beta").length, 1);
  assert.equal(filterEligibleAccounts(accounts, "nonexistent").length, 0);
});

// ──────────────────────────────────────────────────────────────────────
// 13. Query parameters builder
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
// 14. KPI calculation
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
// 15. All four sources defined across TH, EN, ZH
// ──────────────────────────────────────────────────────────────────────
test("all four sources STORE_QR, TIKTOK, FACEBOOK, INSTAGRAM are defined across TH, EN, and ZH", () => {
  for (const lang of ["th", "en", "zh"] as const) {
    const t = getFriendSourceLinksText(lang);
    const labels = [t.sourceStoreQr, t.sourceTikTok, t.sourceFacebook, t.sourceInstagram];
    assert.equal(new Set(labels).size, 4, `All 4 source labels must be distinct in ${lang}`);
  }
  assert.equal(ALL_SOURCES.length, 4);
});

// ──────────────────────────────────────────────────────────────────────
// 16. Translation key parity
// ──────────────────────────────────────────────────────────────────────
test("Thai, English, and Chinese translation objects have identical keys", () => {
  const thKeys = Object.keys(friendSourceLinksTranslations.th).sort();
  const enKeys = Object.keys(friendSourceLinksTranslations.en).sort();
  const zhKeys = Object.keys(friendSourceLinksTranslations.zh).sort();
  assert.deepEqual(thKeys, enKeys);
  assert.deepEqual(enKeys, zhKeys);
});

// ──────────────────────────────────────────────────────────────────────
// 17. Primary navigation registration
// ──────────────────────────────────────────────────────────────────────
test("primary navigation includes friend-source-links in PrimarySection type and state builder", () => {
  assert.match(primaryNav, /friend-source-links/);
  assert.match(primaryNav, /friendSourceLinksActive/);
});

// ──────────────────────────────────────────────────────────────────────
// 18. API types completeness
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

// ──────────────────────────────────────────────────────────────────────
// 19. Open link security
// ──────────────────────────────────────────────────────────────────────
test("openLink uses window.open with noopener,noreferrer target", () => {
  assert.match(viewFile, /noopener,noreferrer/);
  assert.match(viewFile, /_blank/);
});

// ──────────────────────────────────────────────────────────────────────
// 20. Deactivation confirmation modal requirement
// ──────────────────────────────────────────────────────────────────────
test("deactivation requires confirmation modal before invoking update API", () => {
  assert.match(viewFile, /confirmDeactivate/);
  assert.match(viewFile, /setConfirmDeactivate\(link\)/);
  const en = getFriendSourceLinksText("en");
  const msg = en.confirmDeactivate("https://example.com/f/abc12345");
  assert.match(msg, /abc12345/);
});

// Unused type helper to ensure compilation
void (null as unknown as FriendSourceLink);
