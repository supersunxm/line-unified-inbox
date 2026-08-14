import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const privacySource = readFileSync(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8");
const topNavSource = readFileSync(new URL("../src/components/shell/top-navigation.tsx", import.meta.url), "utf8");

test("Privacy Policy page file exists at src/app/privacy/page.tsx", () => {
  assert.ok(existsSync(new URL("../src/app/privacy/page.tsx", import.meta.url)));
});

test("Privacy Policy has appropriate metadata and page title", () => {
  assert.match(privacySource, /title:\s*"Privacy Policy \| OPPO Retail TikTok Monitor"/);
  assert.match(privacySource, /description:\s*"Privacy Policy for OPPO Retail TikTok Monitor/);
  assert.match(privacySource, /<h1[^>]*>\s*Privacy Policy\s*<\/h1>/);
});

test("Privacy Policy specifies product name as OPPO Retail TikTok Monitor", () => {
  assert.match(privacySource, /OPPO Retail TikTok Monitor/);
});

test("Privacy Policy includes all 11 required sections", () => {
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
      privacySource,
      new RegExp(section.replace(".", "\\.")),
      `Privacy Policy must contain section: ${section}`
    );
  }
});

test("Privacy Policy details collected information and technical token data", () => {
  assert.match(privacySource, /TikTok account identifiers/i);
  assert.match(privacySource, /TikTok profile information/i);
  assert.match(privacySource, /follower count/i);
  assert.match(privacySource, /following count/i);
  assert.match(privacySource, /total likes/i);
  assert.match(privacySource, /video count/i);
  assert.match(privacySource, /video views/i);
  assert.match(privacySource, /video likes/i);
  assert.match(privacySource, /comments/i);
  assert.match(privacySource, /shares/i);
  assert.match(privacySource, /tokens/i);
});

test("Privacy Policy specifies collection methods through Login Kit and APIs with permission", () => {
  assert.match(privacySource, /TikTok Login Kit/i);
  assert.match(privacySource, /authorized TikTok APIs/i);
  assert.match(privacySource, /permission/i);
});

test("Privacy Policy states data is not sold and not shared with advertisers", () => {
  assert.match(privacySource, /Data is not sold/i);
  assert.match(privacySource, /No advertiser sharing/i);
});

test("Privacy Policy specifies secure backend token storage and no frontend exposure", () => {
  assert.match(privacySource, /stored securely on backend/i);
  assert.match(privacySource, /never exposed to frontend/i);
});

test("Privacy Policy provides deletion and contact email obsthailand@gmail.com", () => {
  assert.match(privacySource, /obsthailand@gmail\.com/);
  assert.match(privacySource, /https:\/\/lineoppo\.click/);
});

test("Privacy Policy is NOT linked from existing TopNavigation", () => {
  assert.doesNotMatch(topNavSource, /href="\/privacy"/);
  assert.doesNotMatch(topNavSource, /TikTok/);
});
