import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoreLocatorProvinces,
  getStoreLocatorRegion,
  getStoreLocatorRegionCount,
  getSafeStoreLocatorLineUrl,
  matchesStoreLocatorQuery,
  STORE_LOCATOR_REGION_ORDER,
} from "../src/app/store-locator/store-locator-utils.ts";
import type { PublicStoreDto } from "../src/lib/public-stores-api.ts";
import {
  createStoreLocatorAnalyticsPayload,
  STORE_LOCATOR_EVENT_NAMES,
} from "../src/app/store-locator/store-locator-analytics.ts";

function store(overrides: Partial<PublicStoreDto> = {}): PublicStoreDto {
  return {
    id: "1",
    slug: "store-1",
    name: "OPPO Brand Shop Central Chiangmai",
    province: "เชียงใหม่",
    region: "Northern",
    location: { addressPreview: "OPPO Brand Shop Central Chiangmai, เชียงใหม่, Northern", mapsUrl: null },
    line: { url: "https://lin.ee/example", basicId: null },
    tiktok: null,
    ...overrides,
  };
}

test("store locator exposes the requested Thai region order and normalizes raw Store Master labels", () => {
  assert.deepEqual(STORE_LOCATOR_REGION_ORDER, [
    "ภาคเหนือ",
    "ภาคกลาง",
    "ภาคตะวันออกเฉียงเหนือ",
    "ภาคตะวันออก",
    "ภาคตะวันตก",
    "ภาคใต้",
  ]);
  assert.equal(getStoreLocatorRegion("Northern"), "ภาคเหนือ");
  assert.equal(getStoreLocatorRegion("Central Thailand"), "ภาคกลาง");
  assert.equal(getStoreLocatorRegion("North"), "ภาคเหนือ");
  assert.equal(getStoreLocatorRegion("not-a-region"), null);
});

test("store locator province list contains only active API rows in the selected region", () => {
  const stores = [
    store({ id: "1", province: "เชียงใหม่", region: "Northern" }),
    store({ id: "2", province: "ลำพูน", region: "ภาคเหนือ" }),
    store({ id: "3", province: "กรุงเทพมหานคร", region: "Central" }),
    store({ id: "4", province: null, region: "Northern" }),
  ];

  assert.deepEqual(getStoreLocatorProvinces(stores, "ภาคเหนือ"), ["เชียงใหม่", "ลำพูน"]);
  assert.equal(getStoreLocatorRegionCount(stores, "ภาคเหนือ"), 3);
});

test("store locator search covers province, store name, and mall/location text", () => {
  const centralWorld = store({
    name: "OPPO Brand Shop CentralWorld",
    province: "กรุงเทพมหานคร",
    region: "Central",
    location: { addressPreview: "OPPO Brand Shop CentralWorld, กรุงเทพมหานคร", mapsUrl: null },
  });

  assert.equal(matchesStoreLocatorQuery(centralWorld, "กรุงเทพ"), true);
  assert.equal(matchesStoreLocatorQuery(centralWorld, "CentralWorld"), true);
  assert.equal(matchesStoreLocatorQuery(centralWorld, "เชียงใหม่"), false);
  assert.equal(matchesStoreLocatorQuery(centralWorld, ""), true);
});

test("store locator only turns the existing LINE mapping into a CTA for allowed HTTPS LINE hosts", () => {
  assert.equal(getSafeStoreLocatorLineUrl("https://lin.ee/example"), "https://lin.ee/example");
  assert.equal(getSafeStoreLocatorLineUrl("https://line.me/R/ti/p/@example"), "https://line.me/R/ti/p/@example");
  assert.equal(getSafeStoreLocatorLineUrl("https://manager.line.biz/account/@example"), null);
  assert.equal(getSafeStoreLocatorLineUrl("javascript:alert(1)"), null);
  assert.equal(getSafeStoreLocatorLineUrl("https://user:password@line.me/R/ti/p/@example"), null);
});

test("store locator analytics exposes the required event names without internal identifiers", () => {
  assert.deepEqual(STORE_LOCATOR_EVENT_NAMES, [
    "store_locator_open",
    "region_selected",
    "province_selected",
    "store_selected",
    "line_oa_clicked",
  ]);
  assert.deepEqual(
    createStoreLocatorAnalyticsPayload("line_oa_clicked", {
      region: "ภาคเหนือ",
      province: "เชียงใหม่",
      storeName: "OPPO Brand Shop Airport",
    }),
    {
      event: "line_oa_clicked",
      region: "ภาคเหนือ",
      province: "เชียงใหม่",
      storeName: "OPPO Brand Shop Airport",
    },
  );
});
