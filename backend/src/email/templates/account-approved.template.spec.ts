import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_APPROVED_SUBJECT, accountApprovedEmail } from "./account-approved.template";

void test("approval template includes the recipient, store, role, and no authentication material", () => {
  const message = accountApprovedEmail({ to: "pc@example.test", displayName: "Ploy <PC>", storeName: "Central & World", role: "STAFF" });
  assert.equal(message.to, "pc@example.test");
  assert.equal(message.subject, ACCOUNT_APPROVED_SUBJECT);
  assert.match(message.text, /Ploy <PC>/);
  assert.match(message.text, /Central & World/);
  assert.match(message.text, /สิทธิ์การใช้งาน: PC/);
  assert.match(message.html ?? "", /Ploy &lt;PC&gt;/);
  assert.match(message.html ?? "", /Central &amp; World/);
  assert.doesNotMatch(`${message.text}\n${message.html}`, /password|token|magic link|login url|https?:\/\//i);
});

void test("approval template maps store manager role to BM", () => {
  const message = accountApprovedEmail({ to: "bm@example.test", displayName: "Bee", storeName: "Central World", role: "STORE_MANAGER" });
  assert.match(message.text, /สิทธิ์การใช้งาน: BM/);
});
