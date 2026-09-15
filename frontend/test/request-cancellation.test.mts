import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const apiCode = read("../src/lib/api.ts");
const workspaceCode = read("../src/app/page.tsx");
const dashboardCode = read("../src/app/dashboard/executive-dashboard-base.tsx");
const peerCode = read("../src/app/dashboard/executive-store-peer-panel.tsx");
const responseSummaryCode = read("../src/app/dashboard/store-24h-response-panel.tsx");
const store360Code = read("../src/app/store-360/store-360-view.tsx");
const customerVoiceCode = read("../src/app/store-360/customer-voice/customer-voice-view.tsx");
const responseCode = read("../src/app/store-360/response/response-view.tsx");

test("shared API preserves abort errors and exposes read request signals", () => {
  assert.match(apiCode, /export type ApiRequestOptions = Pick<RequestInit, "signal">/);
  assert.match(apiCode, /export function isAbortError\(error: unknown\)/);
  assert.match(apiCode, /catch \(error\) \{\s*if \(isAbortError\(error\)\) throw error;/);
  assert.match(apiCode, /conversations: \(params\?.*options\?: ApiRequestOptions\)/);
  assert.match(apiCode, /storeInsightsSummary: \(storeId: string, params: .*options\?: ApiRequestOptions\)/);
});

test("ApplicationWorkspace cancels obsolete reads without changing polling cadence", () => {
  assert.match(workspaceCode, /conversationRequestController\.current\?\.abort\(\)/);
  assert.match(workspaceCode, /supportingRequestController\.current\?\.abort\(\)/);
  assert.match(workspaceCode, /api\.conversations\(query, \{ signal: controller\.signal \}\)/);
  assert.match(workspaceCode, /if \(refreshInProgress\.current\) return/);
  assert.match(workspaceCode, /if \(controller\.signal\.aborted \|\| isAbortError\(error\)\) return/);
  assert.match(workspaceCode, /loadPolledApplicationData\(\)[\s\S]*12_000/);
  assert.match(workspaceCode, /window\.setInterval\(\(\) => void load\(\), 12_000\)/);
});

test("dashboard and Store 360 route loaders cancel on supersede/unmount", () => {
  for (const source of [dashboardCode, peerCode, responseSummaryCode, store360Code, customerVoiceCode, responseCode]) {
    assert.match(source, /new AbortController\(\)/);
    assert.match(source, /signal: controller\.signal/);
    assert.match(source, /isAbortError\(/);
    assert.match(source, /abort\(\)/);
  }
});
