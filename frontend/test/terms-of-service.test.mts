import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const termsPageSource = readFileSync(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8");
const termsContentSource = readFileSync(new URL("../src/app/terms/terms-content.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("Terms of Service page file exists at src/app/terms/page.tsx", () => {
  assert.ok(existsSync(new URL("../src/app/terms/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/terms/terms-content.tsx", import.meta.url)));
});

test("Terms of Service has appropriate metadata and localized page content", () => {
  assert.match(termsPageSource, /title:\s*"Terms of Service \| OPPO Retail TikTok Monitor"/);
  assert.match(termsPageSource, /description:\s*"Terms of Service for OPPO Retail TikTok Monitor/);
  assert.match(termsPageSource, /<TermsContent\s*\/>/);
  assert.match(termsContentSource, /documentLabel:\s*"Terms of Service"/);
  assert.match(termsContentSource, /documentLabel:\s*"ข้อกำหนดการให้บริการ"/);
  assert.match(termsContentSource, /documentLabel:\s*"服务条款"/);
});

test("Terms of Service specifies product name as OPPO Retail TikTok Monitor", () => {
  assert.match(termsContentSource, /OPPO Retail TikTok Monitor/);
});

test("Terms of Service includes all 9 required English policy sections", () => {
  const requiredSections = [
    "1. Purpose of Service",
    "2. Authorized Use",
    "3. TikTok Account Authorization",
    "4. Data Usage",
    "5. User Responsibilities",
    "6. Service Availability",
    "7. Limitation of Liability",
    "8. Changes to These Terms",
    "9. Contact",
  ];

  for (const section of requiredSections) {
    assert.match(
      termsContentSource,
      new RegExp(section.replace(".", "\\.")),
      `Terms of Service must contain section: ${section}`
    );
  }
});

test("Terms of Service is suitable for TikTok Developer App review", () => {
  assert.match(termsContentSource, /retail operations/i);
  assert.match(termsContentSource, /authorized/i);
  assert.match(termsContentSource, /OAuth/i);
  assert.match(termsContentSource, /obsthailand@gmail\.com/);
  assert.match(termsContentSource, /https:\/\/lineoppo\.click/);
});

test("Terms of Service is NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/terms"/);
});
