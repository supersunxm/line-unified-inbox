import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BROWSER_BUSY_HELP_TEXT,
  BROWSER_STATUS_HELP_TEXT,
  getBrowserOperationLabel,
  getBrowserStateLabel,
  getBrowserStateTone,
  getOverallHealth,
} from "../src/app/operations/line-chat-health/line-chat-health-status.ts";

test("ACTIVE CONNECTED with seven failed jobs remains connected, including historical auth job failures", () => {
  const session = {
    id: "session",
    sessionKey: "account-1",
    displayName: "Account 1",
    status: "ACTIVE",
    healthStatus: "CONNECTED",
    healthFailureStage: null,
    activeProfileLeases: 0,
    activeLeaseOperation: null,
    browserState: "AVAILABLE" as const,
    browserOperationKind: null,
    browserBusyUntil: null,
    consecutiveAuthFailures: 0,
    mappedOaCount: 6,
    enabledOaCount: 6,
    lastAuthenticatedAt: null,
    lastSuccessfulRequestAt: null,
    lastAuthFailureAt: null,
    healthLastCheckedAt: null,
    healthLastHealthyAt: null,
    recentFailures: [],
    jobs: { pending: 0, processing: 0, success: 20, superseded: 2, total: 29, failed: 7, failedAuth: 0 },
  };
  assert.equal(getOverallHealth(session).label, "Connected with job failures");
  assert.equal(
    getOverallHealth({ ...session, jobs: { ...session.jobs, failedAuth: 1 } }).label,
    "Connected with job failures",
  );
});

test("browser availability is independent from connected session health", () => {
  const session = {
    id: "session-browser",
    sessionKey: "profile-browser",
    displayName: "Profile browser",
    status: "ACTIVE",
    healthStatus: "CONNECTED",
    healthFailureStage: null,
    activeProfileLeases: 1,
    activeLeaseOperation: "NICKNAME_UPDATE",
    browserState: "BUSY" as const,
    browserOperationKind: "NICKNAME_UPDATE",
    browserBusyUntil: "2026-09-16T10:00:00.000Z",
    consecutiveAuthFailures: 0,
    mappedOaCount: 0,
    enabledOaCount: 0,
    lastAuthenticatedAt: null,
    lastSuccessfulRequestAt: null,
    lastAuthFailureAt: null,
    healthLastCheckedAt: null,
    healthLastHealthyAt: null,
    recentFailures: [],
    jobs: { pending: 0, processing: 0, success: 1, superseded: 0, total: 1, failed: 0, failedAuth: 0 },
  };

  assert.equal(getOverallHealth(session).label, "Healthy");
  assert.equal(getBrowserStateLabel("AVAILABLE"), "พร้อมใช้งาน");
  assert.equal(getBrowserStateLabel("BUSY"), "กำลังใช้งาน");
  assert.equal(getBrowserStateTone("BUSY"), "warning");
  assert.equal(getBrowserOperationLabel("NICKNAME_UPDATE"), "เปลี่ยนชื่อลูกค้า");
  assert.equal(getBrowserOperationLabel("RECENT_RESOLUTION"), "จับคู่ลูกค้า");
  assert.equal(getBrowserOperationLabel("HEALTH_SESSION"), "ตรวจ Session");
  assert.equal(getBrowserOperationLabel("HEALTH_OA"), "ตรวจ OA");
  assert.equal(getBrowserOperationLabel("MANUAL_DIAGNOSTIC"), "ตรวจสอบ/เปิด Browser");
});

const statusSource = readFileSync(
  new URL("../src/app/operations/line-chat-health/line-chat-health-status.ts", import.meta.url),
  "utf8",
);
const viewSource = readFileSync(
  new URL("../src/app/operations/line-chat-health/line-chat-health-view.tsx", import.meta.url),
  "utf8",
);

test("LINE Chat health keeps connected session state separate from failed jobs", () => {
  assert.match(statusSource, /healthStatus !== "CONNECTED"/);
  assert.match(statusSource, /session\.jobs\.failed \+ session\.jobs\.failedAuth > 0/);
  assert.match(statusSource, /Connected with job failures/);
  assert.ok(
    statusSource.indexOf('healthStatus !== "CONNECTED"') <
      statusSource.indexOf("session.jobs.failed + session.jobs.failedAuth > 0"),
  );
  assert.doesNotMatch(statusSource, /healthStatus === "AUTH_REQUIRED"[^\n]+jobs\.failedAuth/);
});

test("LINE Chat health renders independent Session and Browser states with temporary BUSY guidance", () => {
  assert.match(viewSource, /<TableHead>Session<\/TableHead>/);
  assert.match(viewSource, /<TableHead>Browser<\/TableHead>/);
  assert.match(viewSource, /<BrowserStatus session=\{session\} \/>/);
  assert.match(viewSource, /browserState/);
  assert.match(viewSource, /สถานะ Session แสดงการเชื่อมต่อ LINE/);
  assert.equal(
    BROWSER_STATUS_HELP_TEXT,
    "สถานะ Session แสดงการเชื่อมต่อ LINE\nสถานะ Browser แสดงว่า Chromium Profile พร้อมรับงานใหม่หรือกำลังถูกใช้งาน",
  );
  assert.match(statusSource, new RegExp(BROWSER_BUSY_HELP_TEXT));
});

test("LINE Chat health retry is confirmed and exposes only safe diagnostics", () => {
  assert.match(viewSource, /Retry failed jobs\?/);
  assert.match(viewSource, /failureCategory/);
  assert.doesNotMatch(viewSource, /profilePath|cookie|accessToken|channelSecret/i);
});

test("Actionable failed-job detail modal and summary metrics are present", () => {
  // Verifies Phase 1 detail modal, Phase 2 recommended action classification, and Phase 3 summary metrics
  assert.match(viewSource, /Failed Jobs —/);
  assert.match(viewSource, /Total Failed/);
  assert.match(viewSource, /Auto-fixable/);
  assert.match(viewSource, /Manual review/);
  assert.match(viewSource, /System attention/);
  assert.match(viewSource, /Fix retryable failures/);
  assert.match(viewSource, /Retry selected/);
});

test("Filter tabs support All, Auto-fixable, Manual review, Authentication, and System attention", () => {
  assert.match(viewSource, /All \(/);
  assert.match(viewSource, /Auto-fixable \(/);
  assert.match(viewSource, /Manual review \(/);
  assert.match(viewSource, /Authentication \(/);
  assert.match(viewSource, /System attention \(/);
});

test("Safe fields only: exposes jobId, oaName, oaId, failureCategory, failureStage, attemptCount, updatedAt without customer PII", () => {
  assert.match(viewSource, /failure\.jobId/);
  assert.match(viewSource, /failure\.oaName/);
  assert.match(viewSource, /failure\.oaId/);
  assert.match(viewSource, /failure\.failureCategory/);
  assert.match(viewSource, /failure\.failureStage/);
  assert.match(viewSource, /failure\.attemptCount/);
  assert.match(viewSource, /failure\.updatedAt/);
  // Zero exposure of customer names, nicknames, message content, tokens, or credentials
  assert.doesNotMatch(viewSource, /customerName|customerNickname|messageContent|rawMessage|lineUserId|userToken|passwordHash/i);
});

test("Safe navigation: View in Chat links only with internal conversationId and encodes URI", () => {
  assert.match(viewSource, /href=\{`\/chats\?conversationId=\$\{encodeURIComponent\(failure\.conversationId\)\}`\}/);
  assert.match(viewSource, /View in Chat &rarr;/);
});

test("Retry selected confirmation modal breaks down retryable vs non-retryable and warns on non-retryable", () => {
  assert.match(viewSource, /Retry Selected Jobs/);
  assert.match(viewSource, /Retryable \/ Auto-fixable:/);
  assert.match(viewSource, /Non-retryable \/ Manual review:/);
  assert.match(viewSource, /Categories breakdown:/);
  assert.match(viewSource, /Force retry non-retryable jobs/);
  assert.match(viewSource, /api\.retryLineChatSelectedJobs/);
});

test("Smart auto-fix flow provides preview dialog and invokes fixLineChatRetryableJobs", () => {
  assert.match(viewSource, /Fix Retryable Failures/);
  assert.match(viewSource, /Safe to auto-fix \(transport, timeout, initial execution\):/);
  assert.match(viewSource, /Require manual review \(repeated failures, validation\):/);
  assert.match(viewSource, /Require system attention \/ re-login:/);
  assert.match(viewSource, /api\.fixLineChatRetryableJobs/);
});
