import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanTikTokUsername,
  extractTikTokUsernameFromUrl,
  isValidManagerUrl,
  isValidTikTokProfileUrl,
  normalizeSearchText,
  parseStoreMasterCsv,
  regionFromProvince,
  similarity,
} from "./store-master.utils";

const csv = `STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,"Province\nจังหวัด","Region\nภูมิภาค",TikTok Username,TikTok Profile URL
22535,OBS Siam TV Lamphun By Siam TV,OPPO Siam TV Lumphun,https://lin.ee/xtljwpb,@516jwwri,https://manager.line.biz/account/22535,Lamphun,Northern,@oppo_siamtv,https://www.tiktok.com/@oppo_siamtv
22536,OPPO Central World,OPPO Central World,https://lin.ee/cw,@oppocw,https://manager.line.biz/account/22536,Bangkok,Central,oppo_centralworld,https://www.tiktok.com/@oppo_centralworld
xxx,Unknown,OPPO CT Northville,https://lin.ee/test,@test,https://manager.line.biz/account/xxx,Nonthaburi,Central,,`;

void test("imports bilingual headers and authoritative values including TikTok fields", () => {
  const [row1, row2] = parseStoreMasterCsv(csv);
  assert.deepEqual(
    {
      id: row1.externalStoreId,
      province: row1.province,
      region: row1.region,
      tiktokUsername: row1.tiktokUsername,
      tiktokProfileUrl: row1.tiktokProfileUrl,
    },
    {
      id: "22535",
      province: "Lamphun",
      region: "Northern",
      tiktokUsername: "oppo_siamtv",
      tiktokProfileUrl: "https://www.tiktok.com/@oppo_siamtv",
    }
  );

  // Verifies leading @ is stripped and username is preserved
  assert.equal(row1.tiktokUsername, "oppo_siamtv");
  assert.equal(row2.tiktokUsername, "oppo_centralworld");
});

void test("cleanTikTokUsername strips leading @ and handles empty or invalid inputs", () => {
  assert.equal(cleanTikTokUsername("@oppothailand"), "oppothailand");
  assert.equal(cleanTikTokUsername("@@oppo_store"), "oppo_store");
  assert.equal(cleanTikTokUsername("  @oppo_centralworld  "), "oppo_centralworld");
  assert.equal(cleanTikTokUsername("oppo_normal"), "oppo_normal");
  assert.equal(cleanTikTokUsername(""), null);
  assert.equal(cleanTikTokUsername("   "), null);
  assert.equal(cleanTikTokUsername("#REF!"), null);
  assert.equal(cleanTikTokUsername(null), null);
  assert.equal(cleanTikTokUsername(undefined), null);
});

void test("isValidTikTokProfileUrl validates official TikTok profile URL patterns", () => {
  assert.equal(isValidTikTokProfileUrl("https://www.tiktok.com/@oppo_thailand"), true);
  assert.equal(isValidTikTokProfileUrl("https://tiktok.com/@oppo_thailand"), true);
  assert.equal(isValidTikTokProfileUrl("https://vt.tiktok.com/ZSNxxx/"), true);
  assert.equal(isValidTikTokProfileUrl("http://www.tiktok.com/@insecure"), false);
  assert.equal(isValidTikTokProfileUrl("https://facebook.com/oppo"), false);
  assert.equal(isValidTikTokProfileUrl("not a url"), false);
  assert.equal(isValidTikTokProfileUrl(null), false);
});

void test("extractTikTokUsernameFromUrl extracts normalized handle from profile URL", () => {
  assert.equal(
    extractTikTokUsernameFromUrl("https://www.tiktok.com/@oppo_centralworld"),
    "oppo_centralworld"
  );
  assert.equal(
    extractTikTokUsernameFromUrl("https://tiktok.com/@OPPO_Rama9?lang=en"),
    "oppo_rama9"
  );
  assert.equal(extractTikTokUsernameFromUrl(null), null);
});

void test("normalization handles case, punctuation, spacing, and zero-width characters", () => {
  assert.equal(
    normalizeSearchText(" OPPO\u200b-Central Westville "),
    normalizeSearchText("oppocentralwestville")
  );
});

void test("Lumphun is a deterministic fuzzy suggestion for Lamphun", () => {
  assert.ok(
    similarity(
      normalizeSearchText("OPPO Siam TV Lamphun"),
      normalizeSearchText("OPPO Siam TV Lumphun")
    ) > 0.8
  );
});

void test("placeholder store IDs and manager URLs are rejected", () => {
  const row = parseStoreMasterCsv(csv)[2];
  assert.equal(row.externalStoreId, null);
  assert.equal(row.dataQualityStatus, "MISSING_STORE_ID");
  assert.equal(isValidManagerUrl(row.lineManagerUrl), false);
  assert.equal(row.tiktokUsername, null);
  assert.equal(row.tiktokProfileUrl, null);
});

void test("valid LINE Manager URL is accepted and province mapping is deterministic", () => {
  assert.equal(isValidManagerUrl("https://manager.line.biz/account/22535"), true);
  assert.equal(regionFromProvince("Lamphun"), "Northern");
});

void test("manager URL validation rejects credentials and malformed account URLs", () => {
  for (const value of [
    "https://user:password@manager.line.biz/account/22535",
    "https://manager.line.biz/account/22535?redirect=x",
    "https://manager.line.biz/account/22535#chat",
    "https://manager.line.biz/not-account/22535",
    "https://manager.line.biz/account/22535/chat",
  ]) {
    assert.equal(isValidManagerUrl(value), false);
  }
});
