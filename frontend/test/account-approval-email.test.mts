import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const desktopCode = readFileSync(new URL("../src/app/admin/registrations/admin-registrations-desktop.tsx", import.meta.url), "utf8");
const mobileCode = readFileSync(new URL("../src/app/admin/registrations/mobile-admin-registrations-app.tsx", import.meta.url), "utf8");

void test("approval UI consumes notification delivery status without exposing email provider secrets or links", () => {
  assert.match(apiCode, /RegistrationApprovalResult/);
  assert.match(apiCode, /notification\?: \{ status: "sent" \| "failed" \}/);
  assert.match(desktopCode, /notification\?\.status === "failed"/);
  assert.match(mobileCode, /notification\?\.status === "failed"/);
  for (const source of [apiCode, desktopCode, mobileCode]) {
    assert.doesNotMatch(source, /RESEND_API_KEY|APP_LOGIN_URL|magic link|verification link|password reset link/i);
  }
});
