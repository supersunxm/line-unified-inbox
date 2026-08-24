import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composerCode = readFileSync(
  new URL("../src/app/mass-messages/purchase-broadcast-composer.tsx", import.meta.url),
  "utf8",
);
const bannerCode = readFileSync(
  new URL("../src/app/mass-messages/purchase-broadcast-draft-banner.tsx", import.meta.url),
  "utf8",
);
const routeCode = readFileSync(
  new URL("../src/app/mass-messages/drafts/[campaignId]/draft-responsive.tsx", import.meta.url),
  "utf8",
);

test("Mass Message surfaces Purchase Intelligence SELECTED_USERS drafts", () => {
  assert.match(bannerCode, /item\.status === "DRAFT"/);
  assert.match(bannerCode, /item\.audienceType === "SELECTED_USERS"/);
  assert.match(bannerCode, /\/mass-messages\/drafts\//);
  assert.match(bannerCode, /No message sent/);
  assert.match(routeCode, /PurchaseBroadcastComposer/);
});

test("composer loads and saves through the dedicated draft-only endpoint", () => {
  assert.match(
    composerCode,
    /\/admin\/purchase-analytics\/audience\/broadcast-draft\/\$\{encodeURIComponent\(campaignId\)\}\/composer/,
  );
  assert.match(composerCode, /method: "PATCH"/);
  assert.match(composerCode, /Save Draft/);
  assert.match(composerCode, /DRAFT ONLY/);
});

test("composer supports text and existing protected image upload without send execution", () => {
  assert.match(composerCode, /api\.uploadMassMessageImage\(file\)/);
  assert.match(composerCode, /maxLength=\{5000\}/);
  assert.match(composerCode, /Attach image/);
  assert.doesNotMatch(composerCode, /api\.createMassMessage/);
  assert.doesNotMatch(composerCode, /processCampaign/);
});

test("Phase 2B keeps Review and Send explicitly locked", () => {
  assert.match(composerCode, /Send is locked in Phase 2B/);
  assert.match(composerCode, /Review &amp; Send — Locked/);
  assert.match(composerCode, /<button type="button" disabled/);
  assert.match(composerCode, /creates no delivery rows/);
});
