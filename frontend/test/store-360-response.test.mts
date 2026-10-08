import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { responseDrilldownHref, responseSegmentLabel } from "../src/app/store-360/response-utils.ts";

const viewCode = readFileSync(new URL("../src/app/store-360/store-360-monthly.tsx", import.meta.url), "utf8");
const routeCode = readFileSync(new URL("../src/app/store-360/response/response-view.tsx", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/store-360/response/page.tsx", import.meta.url), "utf8");
const utilsCode = readFileSync(new URL("../src/app/store-360/response-utils.ts", import.meta.url), "utf8");

test("response drill-down URLs preserve store and Bangkok reporting context", () => {
  assert.equal(responseDrilldownHref("store-1", "2026-08-15", "2026-09-13", "unanswered"), "/store-360/response?storeId=store-1&from=2026-08-15&to=2026-09-13&segment=unanswered");
  assert.equal(responseSegmentLabel("within-24h"), "Within 24 hours");
  assert.match(routeCode, /useSearchParams\(\)/);
  assert.match(routeCode, /from = searchParams\.get\("from"\)/);
  assert.match(routeCode, /to = searchParams\.get\("to"\)/);
  assert.match(routeCode, /segment = validSegment/);
  assert.match(routeCode, /router\.replace\("\/store-360\/response\?/);
  assert.match(routeCode, /router\.push\("\/chats\?storeId=/);
});

// Owner decision 8 Oct 2026: the old response-analytics block and first-response-time tiles left the
// Store 360 overview; /store-360/response keeps working, unlinked.
test("the Store 360 overview no longer links the old response analytics", () => {
  assert.doesNotMatch(viewCode, /responseDrilldownHref|Median response time|within-15m/);
});

test("response drill-down is a global-sidebar BI layer with restrained filters and evidence states", () => {
  assert.match(pageCode, /ResponseDrilldownView/);
  assert.match(routeCode, /<AppShell currentSection="store-360"/);
  assert.match(routeCode, /<PageContainer variant="wide" className="store360-workspace/);
  for (const label of ["Response Performance", "Response distribution", "Conversation evidence", "Unanswered", "Within 15 minutes", "Within 1 hour", "Within 24 hours", "After 24 hours"]) {
    assert.match(routeCode, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(utilsCode, /All response cases/);
  for (const token of ["var(--app-bg)", "var(--app-surface)", "var(--app-surface-subtle)", "var(--app-border)", "var(--app-text-primary)", "var(--app-text-secondary)", "var(--app-accent)", "var(--app-warning)"]) {
    assert.match(routeCode, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(routeCode, /loading \? /);
  assert.match(routeCode, /No response cases match these filters/);
  assert.match(routeCode, /Response evidence is temporarily unavailable/);
  assert.match(routeCode, /onClick=\{retry\}/);
  assert.match(routeCode, /hasNextPage/);
  assert.match(routeCode, /Response segment filter/);
  assert.match(routeCode, /Responder filter/);
  assert.match(routeCode, /Sales tag filter/);
  assert.match(routeCode, /Response evidence sort/);
});

test("response evidence exposes safe operational fields and the existing chat destination", () => {
  for (const field of ["customer.displayName", "firstInboundAt", "firstResponseAt", "firstResponseSeconds", "responseBand", "responder?.displayName", "salesTagged", "lastActivity"]) {
    assert.match(routeCode, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(routeCode, /open the existing conversation experience/);
  assert.doesNotMatch(routeCode, /rawPayload|lineUserId|accessToken|Bearer /);
  assert.match(routeCode, /Within 15 minutes ⊂ within 1 hour ⊂ within 24 hours/);
});
