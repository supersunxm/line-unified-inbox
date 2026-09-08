import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const storesPageCode = readFileSync(new URL("../src/app/stores/page.tsx", import.meta.url), "utf8");
const directoryCode = readFileSync(new URL("../src/app/stores/public-stores-directory.tsx", import.meta.url), "utf8");
const profilePageCode = readFileSync(new URL("../src/app/stores/[identifier]/page.tsx", import.meta.url), "utf8");
const profileViewCode = readFileSync(new URL("../src/app/stores/[identifier]/public-store-profile.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/public-stores-api.ts", import.meta.url), "utf8");

test("1. /stores page is public and sets external SEO metadata", () => {
  assert.match(storesPageCode, /title:\s*"OPPO Brand Shop Store Directory"/);
  assert.match(storesPageCode, /description:\s*"ค้นหา OPPO Brand Shop และช่องทางติดต่อของสาขา"/);
  assert.match(storesPageCode, /PublicStoresDirectory/);
  // Guarantee no internal authorization wrapper is used
  assert.doesNotMatch(storesPageCode, /AuthorizedSection/);
  assert.doesNotMatch(storesPageCode, /AuthorizedWorkspace/);
  assert.doesNotMatch(storesPageCode, /redirect\("\/login"\)/);
});

test("2. /stores/[identifier] page sets dynamic SEO metadata with store name", () => {
  assert.match(profilePageCode, /generateMetadata/);
  assert.match(profilePageCode, /\$\{store\.name\}\s*\|\s*OPPO Brand Shop/);
  assert.match(profilePageCode, /PublicStoreProfile/);
  assert.doesNotMatch(profilePageCode, /AuthorizedSection/);
  assert.doesNotMatch(profilePageCode, /AuthorizedWorkspace/);
});

test("3. PublicStoresDirectory renders search hero, filters, and store cards", () => {
  assert.match(directoryCode, /ค้นหา OPPO Brand Shop/);
  assert.match(directoryCode, /ค้นหาร้านและช่องทางติดต่อของสาขาใกล้คุณ/);
  assert.match(directoryCode, /searchQuery/);
  assert.match(directoryCode, /selectedRegion/);
  assert.match(directoryCode, /selectedProvince/);
  assert.match(directoryCode, /ดูรายละเอียดร้าน/);
  assert.match(directoryCode, /ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา/);
});

test("4. Missing social channels are handled gracefully without empty buttons", () => {
  // Directory card checks for line.url, tiktok.profileUrl, mapsUrl
  assert.match(directoryCode, /store\.line\?\.url/);
  assert.match(directoryCode, /store\.tiktok\?\.profileUrl/);
  assert.match(directoryCode, /store\.location\.mapsUrl/);

  // Profile view checks and displays friendly fallback when missing
  assert.match(profileViewCode, /store\.line\?\.url\s*\?/);
  assert.match(profileViewCode, /ยังไม่มีช่องทาง LINE ในขณะนี้/);
  assert.match(profileViewCode, /store\.tiktok\?\.profileUrl\s*\?/);
  assert.match(profileViewCode, /ยังไม่มีช่องทาง TikTok ในขณะนี้/);
});

test("5. Public store API client calls public unauthenticated endpoint", () => {
  assert.match(apiCode, /\/public\/stores/);
  assert.doesNotMatch(apiCode, /oppo_session/);
  assert.doesNotMatch(apiCode, /Authorization:\s*`Bearer/);
});

test("6. Security Audit: No internal sensitive fields leak into public frontend templates", () => {
  const forbiddenKeywords = [
    "accountName",
    "lineManagerUrl",
    "bmName",
    "dashboardTier",
    "kpiPlan",
    "dashboardArea",
    "channelSecret",
    "channelAccessToken",
    "encryptedAccessToken",
  ];

  for (const keyword of forbiddenKeywords) {
    assert.doesNotMatch(directoryCode, new RegExp(keyword), `Public directory must not contain ${keyword}`);
    assert.doesNotMatch(profileViewCode, new RegExp(keyword), `Public profile must not contain ${keyword}`);
    assert.doesNotMatch(apiCode, new RegExp(keyword), `Public API client must not contain ${keyword}`);
  }
});

test("7. Public directory synchronizes search/filter state to URL and uses deterministic slugs", () => {
  assert.match(directoryCode, /useSearchParams/);
  assert.match(directoryCode, /replaceState/);
  assert.match(directoryCode, /store\.slug\s*\|\|\s*store\.id/);
});

test("8. Store code is not visibly displayed on public store profile", () => {
  assert.doesNotMatch(profileViewCode, /รหัสสาขา/);
});

test("9. Public directory uses deduplicated region normalization layer", () => {
  assert.match(directoryCode, /getDeduplicatedPublicRegions/);
  assert.match(directoryCode, /matchesPublicRegion/);
  assert.match(directoryCode, /formatPublicRegion/);
});

test("10. Public store profile formats region with formatPublicRegion", () => {
  assert.match(profileViewCode, /formatPublicRegion/);
});
