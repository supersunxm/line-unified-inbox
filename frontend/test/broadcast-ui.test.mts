import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const viewCode = readFileSync(
  new URL("../src/app/broadcast/broadcast-view.tsx", import.meta.url),
  "utf8",
);
const routeCode = readFileSync(
  new URL("../src/app/broadcast/page.tsx", import.meta.url),
  "utf8",
);
const sidebarCode = readFileSync(
  new URL("../src/components/shell/app-sidebar.tsx", import.meta.url),
  "utf8",
);

test("Broadcast route uses the existing authorized mass-message workspace", () => {
  assert.match(routeCode, /AuthorizedWorkspace section="broadcast"/);
  assert.match(sidebarCode, /href: "\/broadcast"/);
});

test("Broadcast UI exposes LINE-like targeting, timing, composer, and multi-store selection", () => {
  assert.match(viewCode, /All friends/);
  assert.match(viewCode, /Friendship period/);
  assert.match(viewCode, /D180_364/);
  assert.match(viewCode, /D365_PLUS/);
  assert.match(viewCode, /Schedule for later/);
  assert.match(viewCode, /Allow partial broadcast/);
  assert.match(viewCode, /Select stores/);
  assert.match(viewCode, /Select all/);
  assert.match(viewCode, /(สูงสุด|maximum|max).*5 message objects/i);
});

test("Broadcast UI uses official broadcast API client and preserves blocked-store targeting", () => {
  assert.match(viewCode, /api\.previewBroadcast/);
  assert.match(viewCode, /api\.createBroadcast/);
  assert.match(viewCode, /api\.retryFailedBroadcast/);
  assert.match(viewCode, /will never be widened automatically/);
});
