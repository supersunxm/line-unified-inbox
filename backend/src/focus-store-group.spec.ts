import assert from "node:assert/strict";
import test from "node:test";

import { FOCUS_STORE_CODES, FOCUS_STORE_GROUP_ID, isFocusStoreReference } from "./focus-store-group";

test("focus group keeps the requested seven store identifiers", () => {
  assert.equal(FOCUS_STORE_GROUP_ID, "focus-seven-store-group");
  assert.deepEqual([...FOCUS_STORE_CODES], ["28375", "25610", "27627", "25391", "24804", "27789", "3791"]);
});

test("focus store matching accepts Store code, Store Master id, and known names", () => {
  assert.equal(isFocusStoreReference({ name: "Robinson Chonburi", code: "28375" }), true);
  assert.equal(isFocusStoreReference({ name: "OBS Central World", storeMaster: { externalStoreId: "25610" } }), true);
  assert.equal(isFocusStoreReference({ name: "OBS MKV Suwannaphum" }), true);
  assert.equal(isFocusStoreReference({ name: "OBS Harbor Mall Laemchabang", code: "99999" }), false);
});
