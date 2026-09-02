import assert from "node:assert/strict";
import test from "node:test";

import {
  FOCUS_STORE_GROUP_ID,
  FOCUS_STORE_GROUP_ROUTE_PARAM,
  FOCUS_STORE_GROUP_ROUTE_VALUE,
  FOCUS_STORE_GROUP_SIZE,
  getFocusStoreGroupCopy,
} from "../src/lib/focus-store-group.ts";

test("focus store group uses a virtual id and a desktop-only route marker", () => {
  assert.equal(FOCUS_STORE_GROUP_ID, "focus-seven-store-group");
  assert.equal(FOCUS_STORE_GROUP_ROUTE_PARAM, "focusGroup");
  assert.equal(FOCUS_STORE_GROUP_ROUTE_VALUE, "priority-seven");
  assert.equal(FOCUS_STORE_GROUP_SIZE, 7);
});

test("focus store group copy is available in all desktop languages", () => {
  assert.match(getFocusStoreGroupCopy("th").label, /7 ร้าน/);
  assert.match(getFocusStoreGroupCopy("en").label, /7 stores/);
  assert.match(getFocusStoreGroupCopy("zh").label, /7 家门店/);
});
