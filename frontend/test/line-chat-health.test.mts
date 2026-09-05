import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getOverallHealth } from "../src/app/operations/line-chat-health/line-chat-health-status.ts";

test("ACTIVE CONNECTED with seven failed jobs remains connected, including historical auth job failures", () => {
  const session = { id: "session", sessionKey: "account-1", displayName: "Account 1", status: "ACTIVE", healthStatus: "CONNECTED", healthFailureStage: null, activeProfileLeases: 0, activeLeaseOperation: null, consecutiveAuthFailures: 0, mappedOaCount: 6, enabledOaCount: 6, lastAuthenticatedAt: null, lastSuccessfulRequestAt: null, lastAuthFailureAt: null, healthLastCheckedAt: null, healthLastHealthyAt: null, recentFailures: [], jobs: { pending: 0, processing: 0, success: 20, superseded: 2, total: 29, failed: 7, failedAuth: 0 } };
  assert.equal(getOverallHealth(session).label, "Connected with job failures");
  assert.equal(getOverallHealth({ ...session, jobs: { ...session.jobs, failedAuth: 1 } }).label, "Connected with job failures");
});

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
