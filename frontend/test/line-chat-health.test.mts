import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const statusSource = readFileSync(new URL("../src/app/operations/line-chat-health/line-chat-health-status.ts", import.meta.url), "utf8");
const viewSource = readFileSync(new URL("../src/app/operations/line-chat-health/line-chat-health-view.tsx", import.meta.url), "utf8");

test("LINE Chat health keeps connected session state separate from failed jobs", () => {
  assert.match(statusSource, /healthStatus !== "CONNECTED"/);
  assert.match(statusSource, /session\.jobs\.failed \+ session\.jobs\.failedAuth > 0/);
  assert.match(statusSource, /Connected with job failures/);
  assert.ok(statusSource.indexOf('healthStatus !== "CONNECTED"') < statusSource.indexOf("session.jobs.failed + session.jobs.failedAuth > 0"));
  assert.doesNotMatch(statusSource, /healthStatus === "AUTH_REQUIRED"[^\n]+jobs\.failedAuth/);
});

test("LINE Chat health retry is confirmed and exposes only safe diagnostics", () => {
  assert.match(viewSource, /Retry failed jobs\?/);
  assert.match(viewSource, /failureCategory/);
  assert.doesNotMatch(viewSource, /profilePath|cookie|accessToken|channelSecret/i);
});

