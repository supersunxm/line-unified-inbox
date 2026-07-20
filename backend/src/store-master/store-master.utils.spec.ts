import assert from "node:assert/strict";
import test from "node:test";
import { isValidManagerUrl, normalizeSearchText, parseStoreMasterCsv, regionFromProvince, similarity } from "./store-master.utils";

const csv = `STORE ID,STORE NAME,ACCOUNT NAME,Line OA Link,Line ID,URLS,"Province\nจังหวัด","Region\nภูมิภาค"
22535,OBS Siam TV Lamphun By Siam TV,OPPO Siam TV Lumphun,https://lin.ee/xtljwpb,@516jwwri,https://manager.line.biz/account/22535,Lamphun,Northern
xxx,Unknown,OPPO CT Northville,https://lin.ee/test,@test,https://manager.line.biz/account/xxx,Nonthaburi,Central`;

void test("imports bilingual headers and authoritative values", () => {
  const [row] = parseStoreMasterCsv(csv);
  assert.deepEqual({ id: row.externalStoreId, province: row.province, region: row.region }, { id: "22535", province: "Lamphun", region: "Northern" });
});

void test("normalization handles case, punctuation, spacing, and zero-width characters", () => {
  assert.equal(normalizeSearchText(" OPPO\u200b-Central Westville "), normalizeSearchText("oppocentralwestville"));
});

void test("Lumphun is a deterministic fuzzy suggestion for Lamphun", () => {
  assert.ok(similarity(normalizeSearchText("OPPO Siam TV Lamphun"), normalizeSearchText("OPPO Siam TV Lumphun")) > 0.8);
});

void test("placeholder store IDs and manager URLs are rejected", () => {
  const row = parseStoreMasterCsv(csv)[1];
  assert.equal(row.externalStoreId, null); assert.equal(row.dataQualityStatus, "MISSING_STORE_ID");
  assert.equal(isValidManagerUrl(row.lineManagerUrl), false);
});

void test("valid LINE Manager URL is accepted and province mapping is deterministic", () => {
  assert.equal(isValidManagerUrl("https://manager.line.biz/account/22535"), true);
  assert.equal(regionFromProvince("Lamphun"), "Northern");
});

void test("manager URL validation rejects credentials and malformed account URLs", () => {
  for (const value of ["https://user:password@manager.line.biz/account/22535", "https://manager.line.biz/account/22535?redirect=x", "https://manager.line.biz/account/22535#chat", "https://manager.line.biz/not-account/22535", "https://manager.line.biz/account/22535/chat"]) assert.equal(isValidManagerUrl(value), false);
});
