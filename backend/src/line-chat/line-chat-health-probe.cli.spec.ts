import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLineChatHealthProbeCliArgs,
  runLineChatHealthProbeCli,
} from "./line-chat-health-probe.cli";

test("manual health probe CLI parses only an explicit session key and read-only acknowledgement", () => {
  assert.deepEqual(
    parseLineChatHealthProbeCliArgs(["--session-key", " profile-b ", "--confirm-read-only"]),
    { sessionKey: "profile-b", confirmReadOnly: true },
  );
  assert.deepEqual(
    parseLineChatHealthProbeCliArgs(["--session-key=account-1", "--confirm-read-only"]),
    { sessionKey: "account-1", confirmReadOnly: true },
  );
  assert.throws(
    () => parseLineChatHealthProbeCliArgs(["--profile", "/private/path"]),
    /Unknown argument/,
  );
});

test("manual health probe CLI requires explicit read-only acknowledgement", async () => {
  await assert.rejects(
    runLineChatHealthProbeCli(["--session-key", "profile-b"]),
    /--confirm-read-only is required/,
  );
});

test("manual health probe CLI fails closed during maintenance", async () => {
  const previous = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  try {
    await assert.rejects(
      runLineChatHealthProbeCli(["--session-key", "profile-b", "--confirm-read-only"]),
      /HEALTH_PROBE_BLOCKED_MAINTENANCE/,
    );
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = previous;
  }
});

test("manual health probe CLI fails closed when worker is operationally disabled", async () => {
  const previousMaintenance = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  const previousDisable = process.env.DISABLE_NICKNAME_WORKER;
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "false";
  process.env.DISABLE_NICKNAME_WORKER = "true";
  try {
    await assert.rejects(
      runLineChatHealthProbeCli(["--session-key", "profile-b", "--confirm-read-only"]),
      /HEALTH_PROBE_BLOCKED_WORKER_DISABLED/,
    );
  } finally {
    if (previousMaintenance === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = previousMaintenance;
    if (previousDisable === undefined) delete process.env.DISABLE_NICKNAME_WORKER;
    else process.env.DISABLE_NICKNAME_WORKER = previousDisable;
  }
});
