import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyOaHealth,
  classifySessionHealth,
} from "./line-chat-health-classifier";
import {
  deriveEffectiveOaHealthStatus,
  effectiveSessionHealthStatus,
  LINE_CHAT_OA_HEALTH_GREEN_FRESHNESS_MS,
  LINE_CHAT_SESSION_HEALTH_GREEN_FRESHNESS_MS,
} from "./line-chat-health-freshness";
import { LineChatHealthService } from "./line-chat-health.service";

const NOW = new Date("2026-09-03T12:00:00.000Z");

test("explicit Manager 401/403 and login redirect are the only auth signals", () => {
  assert.deepEqual(classifySessionHealth({ endpoint: "MANAGER", httpStatus: 401 }), { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" });
  assert.deepEqual(classifySessionHealth({ endpoint: "MANAGER", httpStatus: 403 }), { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" });
  assert.deepEqual(classifySessionHealth({ endpoint: "SESSION", loginRedirect: true }), { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" });
  assert.deepEqual(classifyOaHealth({ endpoint: "MANAGER", managerAuth: "EXPLICIT_REQUIRED" }), { status: "AUTH_REQUIRED", failureStage: "MANAGER_AUTH" });
});

test("transport and profile failures never become AUTH_REQUIRED", () => {
  for (const evidence of [
    { endpoint: "SESSION" as const, failure: "TIMEOUT" as const },
    { endpoint: "SESSION" as const, httpStatus: 429 },
    { endpoint: "SESSION" as const, httpStatus: 500 },
    { endpoint: "SESSION" as const, httpStatus: 503 },
    { endpoint: "SESSION" as const, failure: "PROFILE_LOCK" as const },
    { endpoint: "SESSION" as const, failure: "CHROMIUM_LAUNCH" as const },
    { endpoint: "SESSION" as const, failure: "UNEXPECTED" as const },
  ]) {
    assert.notEqual(classifySessionHealth(evidence).status, "AUTH_REQUIRED");
    assert.equal(classifySessionHealth(evidence).status, "DEGRADED");
  }
  assert.deepEqual(classifySessionHealth({ profileState: "MISSING" }), { status: "CONFIG_ERROR", failureStage: "PROFILE_MISSING" });
  assert.deepEqual(classifySessionHealth({ profileState: "INVALID" }), { status: "CONFIG_ERROR", failureStage: "PROFILE_PATH_INVALID" });
});

test("OA access failures are distinct when Manager auth is known good", () => {
  assert.deepEqual(classifyOaHealth({ endpoint: "OA", managerAuth: "CONFIRMED", oaAccess: "DENIED" }), { status: "OA_ACCESS_LOST", failureStage: "OA_ACCESS" });
  assert.deepEqual(classifyOaHealth({ endpoint: "CHAT_LIST", managerAuth: "CONFIRMED", httpStatus: 401 }), { status: "OA_ACCESS_LOST", failureStage: "CHAT_AUTH" });
  assert.deepEqual(classifyOaHealth({ endpoint: "CHAT_LIST", managerAuth: "CONFIRMED", httpStatus: 403, chatAccess: "DENIED" }), { status: "OA_ACCESS_LOST", failureStage: "CHAT_AUTH" });
  assert.deepEqual(classifyOaHealth({ endpoint: "CHAT_LIST", httpStatus: 200, responseShape: "MALFORMED" }), { status: "DEGRADED", failureStage: "CHAT_LIST_PARSE" });
});

test("sibling OA classifications are independent", () => {
  const failed = classifyOaHealth({ endpoint: "OA", managerAuth: "CONFIRMED", oaAccess: "DENIED" });
  const healthy = classifyOaHealth({ endpoint: "OA", managerAuth: "CONFIRMED", oaAccess: "GRANTED", httpStatus: 200 });
  assert.equal(failed.status, "OA_ACCESS_LOST");
  assert.equal(healthy.status, "CONNECTED");
});

test("freshness gates only stale CONNECTED observations", () => {
  assert.equal(effectiveSessionHealthStatus({ status: "CONNECTED", lastCheckedAt: new Date(NOW.getTime() - 10 * 60_000), now: NOW }), "CONNECTED");
  assert.equal(effectiveSessionHealthStatus({ status: "CONNECTED", lastCheckedAt: new Date(NOW.getTime() - LINE_CHAT_SESSION_HEALTH_GREEN_FRESHNESS_MS - 1), now: NOW }), "UNKNOWN");
  assert.equal(effectiveSessionHealthStatus({ status: "DEGRADED", lastCheckedAt: new Date(0), now: NOW }), "DEGRADED");
});

test("OA freshness uses the six-hour green threshold", () => {
  assert.equal(deriveEffectiveOaHealthStatus({
    now: NOW,
    session: { status: "CONNECTED", lastCheckedAt: NOW, now: NOW },
    oa: { status: "CONNECTED", lastCheckedAt: new Date(NOW.getTime() - 5 * 60 * 60_000), now: NOW },
  }), "CONNECTED");
  assert.equal(deriveEffectiveOaHealthStatus({
    now: NOW,
    session: { status: "CONNECTED", lastCheckedAt: NOW, now: NOW },
    oa: { status: "CONNECTED", lastCheckedAt: new Date(NOW.getTime() - LINE_CHAT_OA_HEALTH_GREEN_FRESHNESS_MS - 1), now: NOW },
  }), "UNKNOWN");
});

test("parent session state gates effective OA state without mutating the OA snapshot", () => {
  const oa = { status: "CONNECTED" as const, lastCheckedAt: NOW, now: NOW };
  assert.equal(deriveEffectiveOaHealthStatus({ session: { status: "AUTH_REQUIRED", lastCheckedAt: NOW, now: NOW }, oa }), "AUTH_REQUIRED");
  assert.equal(deriveEffectiveOaHealthStatus({ session: { status: "DEGRADED", lastCheckedAt: NOW, now: NOW }, oa }), "DEGRADED");
  assert.equal(deriveEffectiveOaHealthStatus({ session: { status: "CONNECTED", lastCheckedAt: new Date(NOW.getTime() - 31 * 60_000), now: NOW }, oa }), "UNKNOWN");
  assert.equal(deriveEffectiveOaHealthStatus({ session: { status: "CONNECTED", lastCheckedAt: NOW, now: NOW }, oa: { ...oa, lastCheckedAt: new Date(NOW.getTime() - 7 * 60 * 60_000) } }), "UNKNOWN");
});

type HealthState = {
  healthStatus: string;
  healthFailureStage: string | null;
  healthLastFailureAt: Date | null;
  healthLastHealthyAt: Date | null;
  healthNextCheckAt: Date | null;
  healthSessionSnapshotAt?: Date | null;
  healthConsecutiveFailures: number;
};

function createHealthServiceFixture() {
  const session: HealthState = {
    healthStatus: "UNKNOWN",
    healthFailureStage: null,
    healthLastFailureAt: null,
    healthLastHealthyAt: null,
    healthNextCheckAt: null,
    healthConsecutiveFailures: 0,
  };
  const oa: HealthState = { ...session };
  const events: Record<string, unknown>[] = [];
  let transactionCalls = 0;
  const tx = {
    lineChatSession: {
      findUnique: async () => session,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const nextFailures = typeof data.healthConsecutiveFailures === "object"
          ? session.healthConsecutiveFailures + 1
          : Number(data.healthConsecutiveFailures);
        Object.assign(session, data);
        session.healthConsecutiveFailures = nextFailures;
        return session;
      },
    },
    lineOfficialAccount: {
      findUnique: async () => oa,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const nextFailures = typeof data.healthConsecutiveFailures === "object"
          ? oa.healthConsecutiveFailures + 1
          : Number(data.healthConsecutiveFailures);
        Object.assign(oa, data);
        oa.healthConsecutiveFailures = nextFailures;
        return oa;
      },
    },
    lineChatHealthEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
      transactionCalls += 1;
      return callback(tx);
    },
  };
  return { service: new LineChatHealthService(prisma as never), session, oa, events, transactionCalls: () => transactionCalls };
}

test("snapshot and transition event are written in one transaction and do not spam success", async () => {
  const fixture = createHealthServiceFixture();
  const first = await fixture.service.recordSessionHealthResult({ sessionId: "session-1", status: "CONNECTED", checkedAt: NOW, httpStatus: 200, durationMs: 42, source: "SCHEDULED" });
  const second = await fixture.service.recordSessionHealthResult({ sessionId: "session-1", status: "CONNECTED", checkedAt: new Date(NOW.getTime() + 1_000), httpStatus: 200, durationMs: 40, source: "SCHEDULED" });
  assert.equal(first.transitionEventCreated, true);
  assert.equal(second.transitionEventCreated, false);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.transactionCalls(), 2);
  assert.equal(fixture.events[0].entityType, "SESSION");
});

test("failure increments consecutive count and preserves lastHealthyAt", async () => {
  const fixture = createHealthServiceFixture();
  await fixture.service.recordSessionHealthResult({ sessionId: "session-1", status: "CONNECTED", checkedAt: NOW });
  const healthyAt = fixture.session.healthLastHealthyAt;
  await fixture.service.recordSessionHealthResult({ sessionId: "session-1", status: "DEGRADED", failureStage: "TIMEOUT", checkedAt: new Date(NOW.getTime() + 1_000), httpStatus: 504 });
  assert.equal(fixture.session.healthLastHealthyAt, healthyAt);
  assert.equal(fixture.session.healthConsecutiveFailures, 1);
  assert.equal(fixture.session.healthFailureStage, "TIMEOUT");
  assert.equal(fixture.events.length, 2);
});

test("OA result updates only the OA snapshot and keeps event metadata bounded", async () => {
  const fixture = createHealthServiceFixture();
  const unsafe = {
    lineOfficialAccountId: "oa-1",
    status: "CONNECTED" as const,
    checkedAt: NOW,
    httpStatus: 200,
    responseBody: "raw body must not persist",
    cookies: ["secret"],
    lineChatUserId: "Usecret",
  } as unknown as Parameters<typeof fixture.service.recordOaHealthResult>[0];
  await fixture.service.recordOaHealthResult(unsafe);
  assert.equal(fixture.oa.healthStatus, "CONNECTED");
  assert.equal(fixture.events.length, 1);
  assert.equal("responseBody" in fixture.events[0], false);
  assert.equal("cookies" in fixture.events[0], false);
  assert.equal("lineChatUserId" in fixture.events[0], false);
});
