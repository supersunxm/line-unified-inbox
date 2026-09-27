import assert from "node:assert/strict";
import test from "node:test";
import type { LineChatTargetProofResult } from "./line-chat-target-proof.service";
import {
  handleLineChatTargetProofRoute,
  LINE_CHAT_TARGET_PROOF_PATH,
} from "./line-chat-target-proof-route";

const proofFixture: LineChatTargetProofResult = {
  assignedProfile: "A",
  authStatus: "AUTHENTICATED",
  managerBotId: "U0123456789abcdef0123456789abcdef",
  managerStableOaId: "U0123456789abcdef0123456789abcdef",
  targetResolution: "UNIQUE_VERIFIED",
  targetResolutionSource: "MASTER_LINE_ID",
  recentChatHttpStatus: 200,
  chatListRequestObserved: true,
  responseStructureValid: true,
  latestEventPresent: true,
  itemCount: 1,
  discoveryDurationMs: 1,
};

const routeDefaults: Parameters<typeof handleLineChatTargetProofRoute>[0] = {
  method: "POST",
  pathname: LINE_CHAT_TARGET_PROOF_PATH,
  receivedSecret: "internal-secret",
  expectedSecret: "internal-secret",
  readBody: async () => ({ assignedProfile: "A" }),
  service: { prove: async () => proofFixture },
};

test("target-proof route rejects unauthenticated calls before parsing or invoking the service", async () => {
  let bodyReads = 0;
  let serviceCalls = 0;
  const response = await handleLineChatTargetProofRoute({
    ...routeDefaults,
    receivedSecret: "wrong-secret",
    readBody: async () => { bodyReads += 1; return {}; },
    service: { prove: async () => { serviceCalls += 1; return null; } },
  });

  assert.deepEqual(response, { statusCode: 401, body: { success: false, error: "UNAUTHORIZED" } });
  assert.equal(bodyReads, 0);
  assert.equal(serviceCalls, 0);
});

test("target-proof route accepts only its authenticated POST path", async () => {
  assert.equal(await handleLineChatTargetProofRoute({ ...routeDefaults, method: "GET" }), null);
  assert.equal(await handleLineChatTargetProofRoute({ ...routeDefaults, pathname: "/internal/line-chat/other" }), null);
});

test("target-proof route validates JSON shape and sanitizes service failures", async () => {
  const invalidBody = await handleLineChatTargetProofRoute({ ...routeDefaults, readBody: async () => [] });
  assert.deepEqual(invalidBody, { statusCode: 400, body: { success: false, error: "INVALID_REQUEST" } });

  const invalidJson = await handleLineChatTargetProofRoute({
    ...routeDefaults,
    readBody: async () => { throw new SyntaxError("bad-json"); },
  });
  assert.deepEqual(invalidJson, { statusCode: 400, body: { success: false, error: "INVALID_REQUEST" } });

  const tooLarge = await handleLineChatTargetProofRoute({
    ...routeDefaults,
    readBody: async () => { throw new Error("REQUEST_TOO_LARGE"); },
  });
  assert.deepEqual(tooLarge, { statusCode: 413, body: { success: false, error: "REQUEST_TOO_LARGE" } });

  const failed = await handleLineChatTargetProofRoute({
    ...routeDefaults,
    service: { prove: async () => { throw new Error("private failure detail"); } },
  });
  assert.deepEqual(failed, { statusCode: 503, body: { success: false, error: "TARGET_PROOF_FAILED" } });
  assert.doesNotMatch(JSON.stringify(failed), /private failure detail/u);
});

test("target-proof route returns the sanitized proof on success", async () => {
  const proof = proofFixture;
  const response = await handleLineChatTargetProofRoute({
    ...routeDefaults,
    service: { prove: async () => proof },
  });
  assert.deepEqual(response, { statusCode: 200, body: { success: true, proof } });
});
