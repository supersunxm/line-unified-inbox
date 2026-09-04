import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLineChatOaHealthProbeCliArgs,
  runLineChatOaHealthProbeCli,
} from "./line-chat-oa-health-probe.cli";

test("manual OA health probe CLI parses exactly one safe OA selector", () => {
  assert.deepEqual(
    parseLineChatOaHealthProbeCliArgs(["--oa-id", " oa-1 ", "--confirm-read-only"]),
    { oaId: "oa-1", basicId: "", confirmReadOnly: true },
  );
  assert.deepEqual(
    parseLineChatOaHealthProbeCliArgs(["--basic-id=@673lcfmk", "--confirm-read-only"]),
    { oaId: "", basicId: "@673lcfmk", confirmReadOnly: true },
  );
  assert.throws(
    () => parseLineChatOaHealthProbeCliArgs(["--profile", "/private/path"]),
    /Unknown argument/,
  );
});

test("manual OA health probe CLI requires exactly one selector", async () => {
  await assert.rejects(
    runLineChatOaHealthProbeCli(["--confirm-read-only"]),
    /Exactly one of --oa-id or --basic-id is required/,
  );
  await assert.rejects(
    runLineChatOaHealthProbeCli(["--oa-id", "oa-1", "--basic-id", "@673lcfmk", "--confirm-read-only"]),
    /Exactly one of --oa-id or --basic-id is required/,
  );
});

test("manual OA health probe CLI requires explicit read-only acknowledgement", async () => {
  await assert.rejects(
    runLineChatOaHealthProbeCli(["--oa-id", "oa-1"]),
    /--confirm-read-only is required/,
  );
});

test("manual OA health probe CLI fails closed during maintenance", async () => {
  const previous = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  try {
    await assert.rejects(
      runLineChatOaHealthProbeCli(["--oa-id", "oa-1", "--confirm-read-only"]),
      /OA_HEALTH_PROBE_BLOCKED_MAINTENANCE/,
    );
  } finally {
    if (previous === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = previous;
  }
});

test("manual OA health probe CLI fails closed when worker is operationally disabled", async () => {
  const previousMaintenance = process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
  const previousDisable = process.env.DISABLE_NICKNAME_WORKER;
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "false";
  process.env.DISABLE_NICKNAME_WORKER = "true";
  try {
    await assert.rejects(
      runLineChatOaHealthProbeCli(["--oa-id", "oa-1", "--confirm-read-only"]),
      /OA_HEALTH_PROBE_BLOCKED_WORKER_DISABLED/,
    );
  } finally {
    if (previousMaintenance === undefined) delete process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE;
    else process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = previousMaintenance;
    if (previousDisable === undefined) delete process.env.DISABLE_NICKNAME_WORKER;
    else process.env.DISABLE_NICKNAME_WORKER = previousDisable;
  }
});
