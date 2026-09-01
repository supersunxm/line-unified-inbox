import assert from "node:assert/strict";
import test from "node:test";
import { parseLoginArgs } from "./line-chat-login.cli";
import { parseNicknameArgs, formatNicknameResult, runNicknameCli } from "./line-chat-nickname.cli";
import { parseDiagnosticsArgs, formatDiagnosticsResult } from "./line-chat-diagnose.cli";
import { LineChatSessionService } from "./line-chat-session.service";
import type { DiagnosticsResult } from "./line-chat.types";

void test("parseLoginArgs correctly extracts CLI flags", () => {
  assert.deepEqual(
    parseLoginArgs(["--profile", "./local-data/line-chat-profile-a"]),
    { profilePath: "./local-data/line-chat-profile-a", url: undefined }
  );

  assert.deepEqual(
    parseLoginArgs(["-p", "./local-data/line-chat-profile-b", "--url", "https://chat.line.biz/custom"]),
    { profilePath: "./local-data/line-chat-profile-b", url: "https://chat.line.biz/custom" }
  );

  assert.deepEqual(
    parseLoginArgs(["--profile=./local-data/p1", "--url=https://chat.line.biz/"]),
    { profilePath: "./local-data/p1", url: "https://chat.line.biz/" }
  );
});

void test("parseNicknameArgs correctly parses all arguments and defaults", () => {
  const args = parseNicknameArgs([
    "--profile", "./local-data/profile-a",
    "--bot", "Ubot123",
    "--user", "Uuser456",
    "--nickname", "Find X9 สด 08/26",
    "--dry-run",
  ]);

  assert.deepEqual(args, {
    profilePath: "./local-data/profile-a",
    botId: "Ubot123",
    lineUserId: "Uuser456",
    nickname: "Find X9 สด 08/26",
    dryRun: true,
    headless: true,
  });

  const argsShort = parseNicknameArgs([
    "-p", "./p-b",
    "-b", "Ubot-b",
    "-u", "Uuser-b",
    "-n", "Online",
    "--no-headless",
  ]);

  assert.deepEqual(argsShort, {
    profilePath: "./p-b",
    botId: "Ubot-b",
    lineUserId: "Uuser-b",
    nickname: "Online",
    dryRun: false,
    headless: false,
  });
});

void test("formatNicknameResult formats clean human-readable output with token source", () => {
  const dryRunFormatted = formatNicknameResult({
    success: true,
    dryRun: true,
    botId: "Ubot123",
    lineUserId: "Uuser456",
    nickname: "Find X9 สด 08/26",
    profilePath: "/path/to/profile",
    message: "[DRY-RUN] Target verified: Bot ID = Ubot123, User ID = Uuser456, Nickname = \"Find X9 สด 08/26\". No request sent.",
  });

  assert.ok(dryRunFormatted.includes("LINE Chat Customer Nickname Sync [DRY-RUN]"));
  assert.ok(dryRunFormatted.includes("Ubot123"));
  assert.ok(dryRunFormatted.includes("Uuser456"));
  assert.ok(dryRunFormatted.includes("Find X9 สด 08/26"));
  assert.ok(dryRunFormatted.includes("✓ Result"));

  const liveFormatted = formatNicknameResult({
    success: true,
    dryRun: false,
    botId: "Ubot123",
    lineUserId: "Uuser456",
    nickname: "Find X9 สด 08/26",
    profilePath: "/path/to/profile",
    status: 200,
    message: "Successfully updated customer nickname.",
    xsrfTokenFound: true,
    tokenSource: "network",
    clientVersionFound: true,
  });

  assert.ok(liveFormatted.includes("HTTP Status : 200"));
  assert.ok(liveFormatted.includes("XSRF Token  : Found (source: network)"));
  assert.ok(liveFormatted.includes("Client Ver  : Found in runtime"));
  assert.ok(liveFormatted.includes("✓ Result"));

  const errorFormatted = formatNicknameResult({
    success: false,
    dryRun: false,
    botId: "Ubot123",
    lineUserId: "Uuser456",
    nickname: "Find X9 สด 08/26",
    profilePath: "/path/to/profile",
    status: 403,
    error: "LINE chat request was forbidden (HTTP 403). Run diagnostics to inspect session.",
    xsrfTokenFound: false,
  });

  assert.ok(errorFormatted.includes("HTTP Status : 403"));
  assert.ok(errorFormatted.includes("XSRF Token  : Not detected"));
  assert.ok(errorFormatted.includes("✗ Error"));
  assert.ok(errorFormatted.includes("LINE chat request was forbidden (HTTP 403)"));
});

void test("parseDiagnosticsArgs correctly parses CLI flags", () => {
  const args = parseDiagnosticsArgs([
    "--profile", "./local-data/profile-a",
    "--bot", "Ubot123",
    "--user", "Uuser456",
    "--headless",
  ]);

  assert.deepEqual(args, {
    profilePath: "./local-data/profile-a",
    botId: "Ubot123",
    lineUserId: "Uuser456",
    headless: true,
    surface: "bot",
  });

  const argsDefault = parseDiagnosticsArgs(["-p", "./local-data/p2"]);
  assert.deepEqual(argsDefault, {
    profilePath: "./local-data/p2",
    botId: undefined,
    lineUserId: undefined,
    headless: false,
    surface: "bot",
  });

  assert.deepEqual(
    parseDiagnosticsArgs(["--profile", "./local-data/p3", "--bot", "Ubot789", "--surface", "chat-list"]),
    {
      profilePath: "./local-data/p3",
      botId: "Ubot789",
      lineUserId: undefined,
      headless: false,
      surface: "chat-list",
    },
  );
  assert.throws(() => parseDiagnosticsArgs(["--surface", "unknown"]), /Invalid --surface/);
});

void test("formatDiagnosticsResult produces structured report without printing secret values", () => {
  const fixture: DiagnosticsResult = {
    profilePath: "/local-data/profile-a",
    surface: "bot",
    targetUrl: "https://chat.line.biz/Ubot/chat/<customer-id-redacted>",
    finalPageUrl: "https://chat.line.biz/Ubot/chat/<customer-id-redacted>",
    finalOrigin: "https://chat.line.biz",
    finalPath: "/Ubot/chat/<customer-id-redacted>",
    documentTitle: "LINE Official Account Manager",
    mainDocumentStatus: 200,
    finalOriginIsChatLine: true,
    finalPathMatchesWorkspace: true,
    authDestinationDetected: false,
    redirected: false,
    navigationSucceeded: true,
    authenticated: true,
    sessionStatePresent: true,
    cookieStatePresent: true,
    localStoragePresent: true,
    sessionStoragePresent: true,
    apiAuthenticated: "YES",
    apiAuthProbe: {
      endpoint: "/api/v1/me",
      transport: "SUCCEEDED",
      status: 200,
      contentType: "application/json",
      responseWasJson: true,
      topLevelKeyNames: ["ok"],
      authenticated: "YES",
    },
    cookiesCount: 3,
    metaTags: ["viewport", "csrf-token"],
    xsrfTokenFound: true,
    tokenSource: "network",
    clientVersionFound: true,
    observedRequests: [
      {
        method: "GET",
        url: "https://chat.line.biz/api/v1/bots/Ubot/chats",
        query: {
          parameterNames: ["limit", "cursor"],
          safeScalars: { limit: "20" },
          redactedParameters: ["cursor=PRESENT_REDACTED"],
        },
        hasXsrfHeader: true,
        hasClientVersionHeader: true,
        hasOriginHeader: true,
        hasRefererHeader: true,
        headerNames: ["x-xsrf-token", "x-oa-chat-client-version", "cookie", "referer"],
        timestamp: "2026-08-31T09:00:00.000Z",
      },
    ],
    observedResponses: [{
      status: 200,
      contentType: "application/json",
      url: "https://chat.line.biz/api/v1/bots/Ubot/chats",
      query: {
        parameterNames: ["limit", "cursor"],
        safeScalars: { limit: "20" },
        redactedParameters: ["cursor=PRESENT_REDACTED"],
      },
      schema: {
        parseStatus: "JSON",
        topLevelType: "object",
        topLevelKeyNames: ["items", "nextCursor"],
        nestedKeyNames: ["displayName", "id"],
        arrayLengths: [{ path: "$.items", length: 20 }],
        paginationKeyNames: ["nextCursor"],
        candidateFieldNames: ["displayName", "id"],
      },
      timestamp: "2026-08-31T09:00:00.000Z",
    }],
    chatListResponseObserved: false,
    restApiRequestsObserved: 1,
    streamingSseObserved: true,
  };
  const report = formatDiagnosticsResult(fixture);

  assert.ok(report.includes("LINE Chat Session Diagnostic Report"));
  assert.ok(report.includes("Requested URL  : https://chat.line.biz/Ubot/chat/<customer-id-redacted>"));
  assert.ok(report.includes("Final Origin   : https://chat.line.biz"));
  assert.ok(report.includes("Workspace Path : YES"));
  assert.ok(report.includes("API Auth Probe:"));
  assert.ok(report.includes("Endpoint     : /api/v1/me"));
  assert.ok(report.includes("Status       : 200"));
  assert.ok(report.includes("Authenticated: YES"));
  assert.ok(report.includes("Authenticated  : YES"));
  assert.ok(report.includes("Total Cookies  : 3"));
  assert.ok(report.includes("Cookie State   : PRESENT"));
  assert.ok(report.includes("LocalStorage   : PRESENT"));
  assert.ok(report.includes("SessionStorage : PRESENT"));
  assert.doesNotMatch(report, /SES|_ga|XSRF-TOKEN|theme|userSettings|activeChat|Cookie Names/);
  assert.ok(report.includes("XSRF Token     : FOUND"));
  assert.ok(report.includes("Token Source   : NETWORK"));
  assert.ok(report.includes("Client Version : FOUND"));
  assert.ok(report.includes("https://chat.line.biz/api/v1/bots/Ubot/chats"));
  assert.ok(report.includes("limit=20"));
  assert.ok(report.includes("cursor=PRESENT_REDACTED"));
  assert.ok(!report.includes("Uuser"));
  assert.ok(report.includes("Streaming SSE   : OBSERVED"));
  assert.ok(report.includes("items:20"));
  assert.ok(!report.includes("customer-name"));
  assert.doesNotMatch(report, /secret|Uuser/);

  const notObservedReport = formatDiagnosticsResult({
    ...fixture,
    surface: "chat-list",
    targetUrl: "https://chat.line.biz/Ubot",
    finalPageUrl: "https://chat.line.biz/error",
    finalPath: "/error",
    finalPathMatchesWorkspace: false,
    chatListResponseObserved: false,
  });
  assert.ok(notObservedReport.includes("Chat List Response: NOT OBSERVED"));
  assert.doesNotMatch(notObservedReport, /SES|_ga|XSRF-TOKEN|theme|userSettings|activeChat/);
});

void test("runNicknameCli executes dry-run cleanly without errors", async () => {
  const service = new LineChatSessionService();
  const result = await runNicknameCli(
    [
      "--profile", "./local-data/test-profile",
      "--bot", "Ubot-test",
      "--user", "Uuser-test",
      "--nickname", "Find X9 สด 08/26",
      "--dry-run",
    ],
    service
  );

  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.botId, "Ubot-test");
  assert.equal(result.lineUserId, "Uuser-test");
  assert.equal(result.nickname, "Find X9 สด 08/26");
});
