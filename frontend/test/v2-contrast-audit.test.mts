import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync(new URL("../scripts/contrast-audit.mjs", import.meta.url), "utf8");
const seed = readFileSync(new URL("../scripts/v2-seed-api.mjs", import.meta.url), "utf8");

test("contrast audit: manual npm script, dark by default, 3:1, every metrics view (v2 views now redirect), not the light-only report", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts["audit:contrast"], "node scripts/contrast-audit.mjs");
  assert.match(script, /const MIN_RATIO = Number\(process\.env\.MIN_RATIO \?\? 3\);/);
  assert.match(script, /const THEME = process\.env\.THEME \?\? "dark";/);
  // The v2 workspace was retired into Home, Dashboard and Store 360 (8 Oct 2026); its URLs redirect.
  for (const path of ['path: "/home"', 'path: "/dashboard"', 'path: "/store-360"', 'path: "/store-360?storeId=store-1"', 'path: "/store-360?storeId=store-nochat", waitFor: "[data-s360-no-chat-data]"', 'path: "/v2/admin/partners"']) {
    assert.ok(script.includes(path), path);
  }
  assert.doesNotMatch(script, /path: "\/v2\/report/);
});

test("contrast audit seed is synthetic: no real store or customer names", () => {
  assert.match(seed, /OBS Synthetic/);
  assert.match(seed, /ลูกค้าตัวอย่าง/);
  assert.doesNotMatch(seed, /Robinson|Big C|Lotus|Taweekit|The Mall/);
});
