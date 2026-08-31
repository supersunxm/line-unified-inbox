import assert from "node:assert/strict";
import test from "node:test";
import { parseLoginArgs } from "./line-chat-login.cli";
import { parseNicknameArgs, formatNicknameResult, runNicknameCli } from "./line-chat-nickname.cli";
import { parseDiagnosticsArgs, formatDiagnosticsResult } from "./line-chat-diagnose.cli";
import { LineChatSessionService } from "./line-chat-session.service";

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
  });

  const argsDefault = parseDiagnosticsArgs(["-p", "./local-data/p2"]);
  assert.deepEqual(argsDefault, {
    profilePath: "./local-data/p2",
    botId: undefined,
    lineUserId: undefined,
    headless: false,
  });
});

void test("formatDiagnosticsResult produces structured report without printing secret values", () => {
  const report = formatDiagnosticsResult({
    profilePath: "/local-data/profile-a",
    targetUrl: "https://chat.line.biz/Ubot/chat/Uuser",
    authenticated: true,
    cookiesCount: 3,
    cookieNames: ["SES", "_ga", "XSRF-TOKEN"],
    localStorageKeys: ["theme", "userSettings"],
    sessionStorageKeys: ["activeChat"],
    metaTags: ["viewport", "csrf-token"],
    xsrfTokenFound: true,
    tokenSource: "network",
    clientVersionFound: true,
    observedRequests: [
      {
        method: "GET",
        url: "https://chat.line.biz/api/v1/bots/Ubot/chats",
        hasXsrfHeader: true,
        hasClientVersionHeader: true,
        hasOriginHeader: true,
        hasRefererHeader: true,
        headerNames: ["x-xsrf-token", "x-oa-chat-client-version", "cookie", "referer"],
        timestamp: "2026-08-31T09:00:00.000Z",
      },
    ],
  });

  assert.ok(report.includes("LINE Chat Session Diagnostic Report"));
  assert.ok(report.includes("Authenticated  : YES"));
  assert.ok(report.includes("Cookie Names   : SES, _ga, XSRF-TOKEN"));
  assert.ok(report.includes("LocalStorage   : theme, userSettings"));
  assert.ok(report.includes("XSRF Token     : FOUND"));
  assert.ok(report.includes("Token Source   : NETWORK"));
  assert.ok(report.includes("Client Version : FOUND"));
  assert.ok(report.includes("https://chat.line.biz/api/v1/bots/Ubot/chats"));
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
