import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(
  new URL("../src/app/admin/purchase-analytics/purchase-analytics-desktop.tsx", import.meta.url),
  "utf8",
);

test("Purchase Intelligence exposes a draft-only Broadcast Audience action", () => {
  assert.match(pageCode, /Create Broadcast Audience/);
  assert.match(
    pageCode,
    /\/api-backend\/admin\/purchase-analytics\/audience\/broadcast-draft/,
  );
  assert.match(pageCode, /method: "POST"/);
  assert.match(pageCode, /crypto\.randomUUID\(\)/);
  assert.match(pageCode, /campaignRequestId/);
});

test("Broadcast Audience creation reuses selected statuses and requires messageable customers", () => {
  assert.match(pageCode, /statuses: \[\.\.\.selectedStatuses\]\.sort\(\)/);
  assert.match(pageCode, /onlyMessageable: true/);
  assert.match(pageCode, /!onlyMessageable/);
  assert.match(pageCode, /Only messageable users/);
  assert.match(pageCode, /selectedStatuses\.size === 0/);
});

test("Purchase Intelligence keeps Online as its own customer-status category", () => {
  assert.match(pageCode, /"ONLINE"/);
  assert.match(pageCode, /status === "ONLINE"/);
});

test("draft success explicitly states that no message was sent", () => {
  assert.match(pageCode, /Status: DRAFT\. No message has been sent\./);
  assert.match(pageCode, /does not create store deliveries/);
  assert.match(pageCode, /does not[\s\S]*send anything to LINE/);
  assert.match(pageCode, /Open Mass Message/);
});

test("Purchase Intelligence draft action never calls Mass Message send API", () => {
  assert.doesNotMatch(pageCode, /createAndSendMassMessage|sendMassMessage|api\.createMassMessage/);
});
