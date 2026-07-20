import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidCanonicalWebhookUrl } from "../src/app/webhook-url.ts";

test("only canonical HTTPS webhook URLs are accepted for creation success", () => {
  assert.equal(isValidCanonicalWebhookUrl("https://backend.example.com/webhook/stable-key"), true);
  assert.equal(isValidCanonicalWebhookUrl("http://backend.example.com/webhook/key"), false);
  assert.equal(isValidCanonicalWebhookUrl("https://backend.example.com/not-webhook/key"), false);
  assert.equal(isValidCanonicalWebhookUrl("https://backend.example.com/webhook/"), false);
  assert.equal(isValidCanonicalWebhookUrl(null), false);
});

test("create flow uses the returned URL and does not make a second webhook-info request", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const createFlow = page.slice(page.indexOf("async function submitLineOa"), page.indexOf("async function toggleLineOa"));
  assert.match(createFlow, /api\.createLineOfficialAccount\(submission\)/);
  assert.match(createFlow, /isValidCanonicalWebhookUrl\(account\.webhookUrl\)/);
  assert.match(createFlow, /setCreatedLineOa\(\{ account, webhookUrl: account\.webhookUrl \}\)/);
  assert.doesNotMatch(createFlow, /lineOfficialAccountWebhookInfo/);
});

test("submit flow has a synchronous duplicate-submission lock and disabled button", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(lineOaSubmissionInFlight\.current\) return/);
  assert.match(page, /lineOaSubmissionInFlight\.current = true/);
  assert.match(page, /disabled=\{lineOaSubmitting\}[\s\S]*saveConnection/);
});
