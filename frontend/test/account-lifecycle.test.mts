import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const desktopCode = readFileSync(new URL("../src/app/admin/registrations/admin-registrations-desktop.tsx", import.meta.url), "utf8");
const mobileCode = readFileSync(new URL("../src/app/admin/registrations/mobile-admin-registrations-app.tsx", import.meta.url), "utf8");

void test("BM/PC lifecycle API exposes deactivate and reactivate without a delete action", () => {
  assert.match(apiCode, /deactivateAccount:.*\/deactivate/);
  assert.match(apiCode, /reactivateAccount:.*\/reactivate/);
  assert.doesNotMatch(apiCode, /deleteAccount|deleteUser|permanent-delete/i);
});

void test("BM/PC lifecycle UI shows status, confirmation, and preserves reset-password actions", () => {
  for (const source of [desktopCode, mobileCode]) {
    assert.match(source, /accountStatus/);
    assert.match(source, /Reactivate/);
    assert.match(source, /Deactivate/);
    assert.match(source, /Account history is preserved/);
    assert.match(source, /Reset Password/);
    assert.doesNotMatch(source, /Delete account|Delete user|Permanent delete/i);
  }
  assert.match(desktopCode, /Confirm Deactivate/);
  assert.match(desktopCode, /Confirm Reactivate/);
});
