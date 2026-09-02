import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const privacyPageSource = readFileSync(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8");
const privacyContentSource = readFileSync(new URL("../src/app/privacy/privacy-content.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("Privacy Policy page file exists at src/app/privacy/page.tsx", () => {
  assert.ok(existsSync(new URL("../src/app/privacy/page.tsx", import.meta.url)));
  assert.ok(existsSync(new URL("../src/app/privacy/privacy-content.tsx", import.meta.url)));
});

test("Privacy Policy has appropriate metadata and localized page content", () => {
  assert.match(privacyPageSource, /title:\s*"Privacy Policy \| OPPO Retail TikTok Monitor"/);
  assert.match(privacyPageSource, /description:\s*"Privacy Policy for OPPO Retail TikTok Monitor/);
  assert.match(privacyPageSource, /<PrivacyContent\s*\/>/);
  assert.match(privacyContentSource, /documentLabel:\s*"Privacy Policy"/);
  assert.match(privacyContentSource, /documentLabel:\s*"นโยบายความเป็นส่วนตัว"/);
  assert.match(privacyContentSource, /documentLabel:\s*"隐私政策"/);
});

test("Privacy Policy specifies product name as OPPO Retail TikTok Monitor", () => {
  assert.match(privacyContentSource, /OPPO Retail TikTok Monitor/);
});

test("Privacy Policy includes all 11 required English policy sections", () => {
  const requiredSections = [
    "1. Information We Collect",
    "2. How We Collect Information",
    "3. How We Use Information",
    "4. Data Sharing",
    "5. Data Storage and Security",
    "6. Data Retention",
    "7. Account Disconnection and Data Deletion",
    "8. Third-Party Services",
    "9. User Rights and Requests",
    "10. Changes to This Privacy Policy",
    "11. Contact Information",
  ];

  for (const section of requiredSections) {
    assert.match(
      privacyContentSource,
      new RegExp(section.replace(".", "\\.")),
      `Privacy Policy must contain section: ${section}`
    );
  }
});

test("Privacy Policy details collected information and technical token data", () => {
  assert.match(privacyContentSource, /TikTok account identifiers/i);
  assert.match(privacyContentSource, /TikTok profile information/i);
  assert.match(privacyContentSource, /follower count/i);
  assert.match(privacyContentSource, /following count/i);
  assert.match(privacyContentSource, /total likes/i);
  assert.match(privacyContentSource, /video count/i);
  assert.match(privacyContentSource, /video views/i);
  assert.match(privacyContentSource, /video likes/i);
  assert.match(privacyContentSource, /comments/i);
  assert.match(privacyContentSource, /shares/i);
  assert.match(privacyContentSource, /tokens/i);
});

test("Privacy Policy specifies collection methods through Login Kit and APIs with permission", () => {
  assert.match(privacyContentSource, /TikTok Login Kit/i);
  assert.match(privacyContentSource, /authorized TikTok APIs/i);
  assert.match(privacyContentSource, /permission/i);
});

test("Privacy Policy states data is not sold and not shared with advertisers", () => {
  assert.match(privacyContentSource, /Data is not sold/i);
  assert.match(privacyContentSource, /No advertiser sharing/i);
});

test("Privacy Policy specifies secure backend token storage and no frontend exposure", () => {
  assert.match(privacyContentSource, /stored securely on backend/i);
  assert.match(privacyContentSource, /never exposed to frontend/i);
});

test("Privacy Policy provides deletion and contact email obsthailand@gmail.com", () => {
  assert.match(privacyContentSource, /obsthailand@gmail\.com/);
  assert.match(privacyContentSource, /https:\/\/lineoppo\.click/);
});

test("Privacy Policy is NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/privacy"/);
});
