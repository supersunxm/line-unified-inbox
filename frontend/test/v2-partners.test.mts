import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { buildMonthStoreRows, type MonthSummary } from "../src/lib/v2/monthly-model.ts";
import { partnerOrUnmatched, sortPartnerNames, UNMATCHED_PARTNER } from "../src/lib/v2/partners.ts";

test("partner comes from the Store ID mapping; no mapping → ไม่ระบุ partner", () => {
  assert.equal(partnerOrUnmatched("TG"), "TG");
  assert.equal(partnerOrUnmatched(" "), UNMATCHED_PARTNER);
  assert.equal(partnerOrUnmatched(null), UNMATCHED_PARTNER);
  // Synthetic: the name says "By TG" but the mapping says OPPO — the mapping wins.
  const summary: MonthSummary = { overview: { total: 2, notReplied: 0, notifiedBm: 0, replied: 2 }, stores: [
    { storeId: "a", storeName: "OBS A By TG", total: 1, notReplied: 0, notifiedBm: 0, replied: 1 },
    { storeId: "b", storeName: "OBS B By TG", total: 1, notReplied: 0, notifiedBm: 0, replied: 1 },
  ] };
  const rows = buildMonthStoreRows({
    stores: [
      { id: "a", name: "OBS A By TG", region: null, province: null, lineOaCount: 1, partner: "OPPO" },
      { id: "b", name: "OBS B By TG", region: null, province: null, lineOaCount: 1 },
    ],
    current: { data: summary }, previous: { data: null, collected: false }, rates: { data: null }, previousRates: { data: null },
  });
  assert.deepEqual(rows.map((row) => row.partner), ["OPPO", UNMATCHED_PARTNER]);
});

test("the frontend never parses store names for partners", () => {
  const dirs = ["../src/lib/v2/", "../src/components/v2/"];
  for (const dir of dirs) {
    for (const name of readdirSync(new URL(dir, import.meta.url))) {
      const source = readFileSync(new URL(`${dir}${name}`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /\\sby\\s|partnerFromStoreName|PARTNER_ALIASES/i, `${dir}${name}`);
    }
  }
  assert.match(readFileSync(new URL("../src/components/v2/v2-month-data.tsx", import.meta.url), "utf8"), /fetch\("\/api-backend\/v2\/store-partners"/);
});

test("partner names sort by name with the unmatched group last", () => {
  assert.deepEqual(sortPartnerNames(["TG", UNMATCHED_PARTNER, "Com7", "OPPO", "TG"]), ["Com7", "OPPO", "TG", UNMATCHED_PARTNER]);
});

test("admin page: ADMIN-only editing, an 'ยังไม่ระบุ' filter, change history; kept on its own after the v2 shell", () => {
  const admin = readFileSync(new URL("../src/components/v2/store-partners-admin.tsx", import.meta.url), "utf8");
  assert.match(admin, /const isAdmin = user\?\.role === "ADMIN";/);
  assert.match(admin, /\{isAdmin && row\.storeId \? \(/, "inputs only for ADMIN and only with a Store ID");
  assert.match(admin, /data-v2-partner-unset-filter/);
  assert.match(admin, /method: "PUT"/);
  assert.match(admin, /data-v2-partner-changes/);
  // The v2 shell (its only link) was retired on 8 Oct 2026; the page stays at /v2/admin/partners, gated,
  // in the standard internal shell, for the mapping /v2/report?partner= reads.
  assert.match(readFileSync(new URL("../src/app/v2/admin/partners/page.tsx", import.meta.url), "utf8"), /<StorePartnersAdminPage \/>/);
  assert.match(admin, /<AuthorizedSection section="dashboard">\n\s*<InternalPageShell section="dashboard">/);
});
