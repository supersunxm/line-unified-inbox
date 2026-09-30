import assert from "node:assert/strict";
import test from "node:test";
import type { LineChatMirrorLiveParityAuditService } from "./line-chat-mirror-live-parity-audit.service";
import {
  handleLineChatMirrorLiveParityAuditRoute,
  LINE_CHAT_MIRROR_LIVE_PARITY_AUDIT_PATH,
} from "./line-chat-mirror-live-parity-audit-route";

const watermarkValue = "2026-09-30T00:00:00.000Z";
const reportFixture = { watermark: watermarkValue, legacyEvidenceDebt: { unmapped: 0, waitingCanonical: 0 } };
const routeDefaults: Parameters<typeof handleLineChatMirrorLiveParityAuditRoute>[0] = {
  method: "GET",
  pathname: LINE_CHAT_MIRROR_LIVE_PARITY_AUDIT_PATH,
  watermarkValue,
  receivedSecret: "internal-secret",
  expectedSecret: "internal-secret",
  service: { getReport: async () => reportFixture } as unknown as Pick<LineChatMirrorLiveParityAuditService, "getReport">,
};

test("live-parity audit route authenticates before querying and only handles its GET path", async () => {
  let serviceCalls = 0;
  const service = { getReport: async () => { serviceCalls += 1; return reportFixture; } } as unknown as Pick<LineChatMirrorLiveParityAuditService, "getReport">;

  assert.equal(await handleLineChatMirrorLiveParityAuditRoute({ ...routeDefaults, method: "POST", service }), null);
  assert.equal(await handleLineChatMirrorLiveParityAuditRoute({ ...routeDefaults, pathname: "/other", service }), null);
  const denied = await handleLineChatMirrorLiveParityAuditRoute({ ...routeDefaults, receivedSecret: "wrong", service });
  assert.deepEqual(denied, { statusCode: 401, body: { success: false, error: "UNAUTHORIZED" } });
  assert.equal(serviceCalls, 0);
});

test("live-parity audit route requires a timestamp with timezone and rejects future watermarks", async () => {
  const missing = await handleLineChatMirrorLiveParityAuditRoute({ ...routeDefaults, watermarkValue: null });
  assert.deepEqual(missing, { statusCode: 400, body: { success: false, error: "INVALID_WATERMARK" } });
  const ambiguous = await handleLineChatMirrorLiveParityAuditRoute({ ...routeDefaults, watermarkValue: "2026-09-30" });
  assert.deepEqual(ambiguous, { statusCode: 400, body: { success: false, error: "INVALID_WATERMARK" } });
  const future = await handleLineChatMirrorLiveParityAuditRoute({
    ...routeDefaults,
    watermarkValue: new Date(Date.now() + 60_000).toISOString(),
  });
  assert.deepEqual(future, { statusCode: 400, body: { success: false, error: "INVALID_WATERMARK" } });
});

test("live-parity audit route returns the read-only report and sanitizes query failures", async () => {
  let requestedWatermark: Date | undefined;
  const success = await handleLineChatMirrorLiveParityAuditRoute({
    ...routeDefaults,
    service: {
      getReport: async (watermark: Date) => { requestedWatermark = watermark; return reportFixture; },
    } as unknown as Pick<LineChatMirrorLiveParityAuditService, "getReport">,
  });
  assert.deepEqual(success, { statusCode: 200, body: { success: true, report: reportFixture } });
  assert.equal(requestedWatermark?.toISOString(), watermarkValue);

  let loggedError: unknown;
  const failed = await handleLineChatMirrorLiveParityAuditRoute({
    ...routeDefaults,
    service: { getReport: async () => { throw new Error("database details"); } },
    onError: (error) => { loggedError = error; },
  });
  assert.deepEqual(failed, { statusCode: 503, body: { success: false, error: "LIVE_PARITY_AUDIT_FAILED" } });
  assert.ok(loggedError instanceof Error);
  assert.doesNotMatch(JSON.stringify(failed), /database details/u);
});
