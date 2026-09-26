import assert from "node:assert/strict";
import test from "node:test";
import { withChromiumLaunchFailureDiagnostics } from "./line-chat-chromium-launch-diagnostics";

test("Chromium launch diagnostics preserve the first failure and extract spawn details safely", async () => {
  const profilePath = "/data/line-chat-profiles/account-1";
  const error = new Error([
    "browserType.launchPersistentContext: Target page, context or browser has been closed",
    "Browser logs:",
    '<launching> /ms-playwright/chromium-1234/chrome --user-data-dir="/data/line-chat-profiles/account-1" --token=launch-secret',
    "<launched> pid=47650",
    "[pid=47650][err] pthread_create failed: Resource temporarily unavailable Authorization: Bearer header-secret Cookie: sid=cookie-secret access_token=query-secret",
    "[pid=47650][out] Chromium startup output",
    "<process did exit: exitCode=133 signal=null>",
    "[pid=47650] <skipped force kill spawnedProcess.killed=false processClosed=true>",
    "[pid=47650] finished temporary directories cleanup",
    "Call log:",
    "- <launching> /ms-playwright/chromium-1234/chrome --user-data-dir=/data/line-chat-profiles/account-1",
    "- <launched> pid=47650",
  ].join("\n"));
  Object.assign(error, {
    code: "EAGAIN",
    errno: 11,
    syscall: "spawn",
    spawnedProcess: {
      pid: 47650,
      exitCode: 133,
      signalCode: null,
      killed: false,
      processClosed: true,
    },
  });

  let event = "";
  const originalError = error;
  await assert.rejects(
    () => withChromiumLaunchFailureDiagnostics(
      async () => { throw error; },
      profilePath,
      (line) => { event = line; },
      {
        launchId: "launch-safe-001",
        profileId: "profile-safe-001",
        operationKind: "MIRROR_SYNC",
        sessionId: "session-safe-001",
        storeCode: "29113",
        workerPid: 42,
      },
    ),
    (caught: unknown) => caught === originalError,
  );

  const diagnostic = JSON.parse(event) as Record<string, unknown>;
  assert.equal(diagnostic.event, "line_chat_chromium_launch_failed");
  assert.equal(diagnostic.launchId, "launch-safe-001");
  assert.equal(diagnostic.profileId, "profile-safe-001");
  assert.equal(diagnostic.operationKind, "MIRROR_SYNC");
  assert.equal(diagnostic.sessionId, "session-safe-001");
  assert.equal(diagnostic.storeCode, "29113");
  assert.equal(diagnostic.workerPid, 42);
  assert.equal(diagnostic.errorName, "Error");
  assert.equal(diagnostic.errorCode, "EAGAIN");
  assert.equal(diagnostic.errno, 11);
  assert.equal(diagnostic.syscall, "spawn");
  assert.equal(diagnostic.chromiumPid, 47650);
  assert.equal(diagnostic.browserSpawned, true);
  assert.equal(diagnostic.exitCode, 133);
  assert.equal(diagnostic.terminationSignal, null);
  assert.equal(diagnostic.processClosed, true);
  assert.equal(diagnostic.exitedByItself, true);
  assert.equal(diagnostic.forceKillRequired, false);
  assert.equal(diagnostic.cleanupCompleted, true);
  assert.match(String(diagnostic.errorMessage), /^browserType\.launchPersistentContext: Target page/u);
  assert.match(String(diagnostic.executablePath), /\/ms-playwright\/chromium-1234\/chrome/u);
  assert.match(String(diagnostic.chromiumStderr), /pthread_create failed: Resource temporarily unavailable/u);
  assert.match(String(diagnostic.chromiumStdout), /Chromium startup output/u);
  assert.match(String(diagnostic.playwrightCallLog), /<launched> pid=47650/u);
  assert.doesNotMatch(event, /account-1|launch-secret|header-secret|cookie-secret|query-secret|Bearer/u);
});

test("diagnostic JSON is strictly bounded and keeps the earliest error text", async () => {
  const error = Object.assign(new Error(`FIRST_EARLIEST_ERROR\n${"later detail ".repeat(20_000)}`), {
    stderr: `${"pthread_create failed; ".repeat(20_000)} Cookie: private-cookie-value`,
    stdout: "startup output ".repeat(20_000),
  });
  let event = "";

  await assert.rejects(
    () => withChromiumLaunchFailureDiagnostics(async () => { throw error; }, "/private/profile/session-key", (line) => { event = line; }),
    (caught: unknown) => caught === error,
  );

  assert.ok(Buffer.byteLength(event, "utf8") <= 8_192);
  const diagnostic = JSON.parse(event) as Record<string, unknown>;
  assert.match(String(diagnostic.errorMessage), /^FIRST_EARLIEST_ERROR/u);
  assert.match(String(diagnostic.chromiumStderr), /^pthread_create failed/u);
  assert.doesNotMatch(event, /session-key|private-cookie-value/u);
});

test("spawn EAGAIN records that Chromium did not spawn when no child PID exists", async () => {
  const error = Object.assign(new Error("spawn /ms-playwright/chromium/chrome EAGAIN"), {
    code: "EAGAIN",
    errno: 11,
    syscall: "spawn",
  });
  let event = "";

  await assert.rejects(
    () => withChromiumLaunchFailureDiagnostics(async () => { throw error; }, "/private/profile", (line) => { event = line; }),
    (caught: unknown) => caught === error,
  );

  const diagnostic = JSON.parse(event) as Record<string, unknown>;
  assert.equal(diagnostic.browserSpawned, false);
  assert.equal(diagnostic.chromiumPid, null);
  assert.equal(diagnostic.errorCode, "EAGAIN");
  assert.match(String(diagnostic.errorMessage), /EAGAIN/u);
});

test("successful launch invokes the launcher once and emits no diagnostics", async () => {
  const result = { context: "same-result" };
  let launchCount = 0;
  let logCount = 0;
  const actual = await withChromiumLaunchFailureDiagnostics(
    async () => {
      launchCount += 1;
      return result;
    },
    "/private/profile/session-key",
    () => { logCount += 1; },
  );

  assert.equal(actual, result);
  assert.equal(launchCount, 1);
  assert.equal(logCount, 0);
});

test("diagnostic extraction and logger failures cannot replace the original launch error", async () => {
  const error = new Error("original launch failure");
  const hostileError = new Proxy(error, {
    get(target, property, receiver) {
      if (property === "message" || property === "code") throw new Error("hostile getter");
      return Reflect.get(target, property, receiver);
    },
  });

  await assert.rejects(
    () => withChromiumLaunchFailureDiagnostics(
      async () => { throw hostileError; },
      "/private/profile/session-key",
      () => { throw new Error("logger failure"); },
    ),
    (caught: unknown) => caught === hostileError,
  );
});
