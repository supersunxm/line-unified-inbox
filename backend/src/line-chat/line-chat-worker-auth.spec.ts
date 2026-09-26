import assert from "node:assert/strict";
import test from "node:test";
import { matchesLineChatWorkerSecret } from "./line-chat-worker-auth";

test("internal worker authentication requires a matching non-empty secret", () => {
  assert.equal(matchesLineChatWorkerSecret("shared-secret", "shared-secret"), true);
  assert.equal(matchesLineChatWorkerSecret(undefined, "shared-secret"), false);
  assert.equal(matchesLineChatWorkerSecret("wrong", "shared-secret"), false);
  assert.equal(matchesLineChatWorkerSecret("", ""), false);
});
