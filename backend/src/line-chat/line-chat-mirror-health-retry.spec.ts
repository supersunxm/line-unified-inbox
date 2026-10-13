import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../prisma.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { runMirrorFleetWithHealthRetry } from "./line-chat-mirror-health-retry";

function clock(cycleBudgetMs = 1000, retryBudgetMs = 100, backoffMs = 5) {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => { time += ms; },
    advance: (ms: number) => { time += ms; },
    cycleBudgetMs, retryBudgetMs, backoffMs,
  };
}
function result(storeCode: string, status = "SUCCESS", healthSessionContention = false) {
  return { storeCode, status, healthSessionContention };
}

test("healthy stores finish before one deferred retry per contended store", async () => {
  const calls: string[] = [];
  const seen = new Set<string>();
  const pass = await runMirrorFleetWithHealthRetry({
    storeCodes: ["a", "b", "healthy", "a"], cycleStartedAt: 0, retryHealthContention: true,
    shouldStop: () => false, onError: () => assert.fail("unexpected failure"),
    attempt: async (id) => {
      calls.push(id);
      if (id !== "healthy" && !seen.has(id)) { seen.add(id); return result(id, "PARTIAL", true); }
      return result(id);
    },
  }, clock());
  assert.deepEqual(calls, ["a", "b", "healthy", "a", "b"]);
  assert.equal(pass.retryRecovered, 2);
  assert.equal(pass.storesAttempted, 3);
  assert.equal(pass.results.length, 3);
  assert.ok(pass.results.every((x) => x.status === "SUCCESS"));
});

test("persistent contention is attempted twice at most, with backoff and no tight skip burst", async () => {
  const time = clock();
  const calls: number[] = [];
  const pass = await runMirrorFleetWithHealthRetry({
    storeCodes: ["a", "b"], cycleStartedAt: 0, retryHealthContention: true,
    shouldStop: () => false, onError: () => assert.fail("unexpected failure"),
    attempt: async (id) => { calls.push(time.now()); return result(id, "PARTIAL", true); },
  }, time);
  assert.deepEqual(calls, [0, 0, 5, 10]);
  assert.equal(pass.retryAttempts, 2);
  assert.equal(pass.retryRecovered, 0);
});

test("retry deadline clips backoff and admits no attempt after expiry", async () => {
  const time = clock(100, 3, 5);
  const pass = await runMirrorFleetWithHealthRetry({
    storeCodes: ["a"], cycleStartedAt: 0, retryHealthContention: true,
    shouldStop: () => false, onError: () => {}, attempt: async (id) => result(id, "PARTIAL", true),
  }, time);
  assert.equal(time.now(), 3);
  assert.equal(pass.retryAttempts, 0);
  assert.equal(pass.retryBudgetExhausted, true);
});

test("cycle admission budget stops new stores and retries without abandoning in-flight ownership", async () => {
  const time = clock(10);
  const pass = await runMirrorFleetWithHealthRetry({
    storeCodes: ["a", "b"], cycleStartedAt: 0, retryHealthContention: true,
    shouldStop: () => false, onError: () => {},
    attempt: async (id) => { time.advance(10); return result(id); },
  }, time);
  assert.equal(pass.storesAttempted, 1);
  assert.equal(pass.cycleBudgetExhausted, true);
});

test("404/auth/history/non-health failures and Catch Up are never retried", async () => {
  for (const enabled of [true, false]) {
    const calls: string[] = [];
    const pass = await runMirrorFleetWithHealthRetry({
      storeCodes: ["404", "auth", "history", "other-lock"], cycleStartedAt: 0,
      retryHealthContention: enabled, shouldStop: () => false, onError: () => {},
      attempt: async (id) => { calls.push(id); return result(id, id === "404" || id === "auth" ? "FAILED" : "PARTIAL"); },
    }, clock());
    assert.equal(pass.retryAttempts, 0);
    assert.equal(calls.length, 4);
  }
  const pass = await runMirrorFleetWithHealthRetry({ storeCodes: ["a"], cycleStartedAt: 0,
    retryHealthContention: false, shouldStop: () => false, onError: () => {},
    attempt: async (id) => result(id, "PARTIAL", true) }, clock());
  assert.equal(pass.retryAttempts, 0);
});

test("manual recovery during backoff prevents browser admission", async () => {
  let stop = false;
  const timing = clock();
  timing.sleep = async () => { stop = true; };
  const pass = await runMirrorFleetWithHealthRetry({ storeCodes: ["a"], cycleStartedAt: 0,
    retryHealthContention: true, shouldStop: () => stop, onError: () => {},
    attempt: async (id) => result(id, "PARTIAL", true) }, timing);
  assert.equal(pass.retryAttempts, 0);
});

test("retry exceptions retain partial state and explicit failure telemetry", async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const pass = await runMirrorFleetWithHealthRetry({ storeCodes: ["a"], cycleStartedAt: 0,
    retryHealthContention: true, shouldStop: () => false, onError: (_id, error) => errors.push(error),
    attempt: async (id) => { if (++calls === 2) throw new Error("database unavailable"); return result(id, "PARTIAL", true); } }, clock());
  assert.equal(pass.results[0].status, "PARTIAL");
  assert.equal(pass.retryExceptions, 1);
  assert.equal(errors.length, 1);
});

// Real coordinator with synthetic database leases; never a real browser or LINE API.
function coordinatorFixture() {
  const leases = new Map<string, { id: string; ownerToken: string; acquiredAt: Date; leaseUntil: Date }>();
  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(" ");
      if (sql.includes('INSERT INTO "LineChatProfileOperationLease"')) {
        const id = String(values[1]);
        if (leases.has(id)) return [];
        const lease = { id, ownerToken: String(values[2]), acquiredAt: new Date(), leaseUntil: new Date(Date.now() + 90_000) };
        leases.set(id, lease); return [lease];
      }
      if (sql.includes('UPDATE "LineChatProfileOperationLease"')) return [{ id: String(values[0]) }];
      throw new Error("Unexpected lease query");
    },
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const id = String(values[0]);
      if (leases.get(id)?.ownerToken === values[1]) leases.delete(id);
      return 1;
    },
  } as unknown as PrismaService;
  return { coordinator: new LineChatProfileOperationCoordinator(prisma), leases };
}

test("temporary HEALTH_SESSION lock releases; deferred Mirror succeeds exclusively without duplicate ingestion or health starvation", async () => {
  const { coordinator, leases } = coordinatorFixture();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  let active = 0;
  let healthRuns = 0;
  let browserLaunches = 0;
  const ingested = new Set<string>();
  const health = coordinator.withProfileOperation({ sessionId: "profile", operationKind: "HEALTH_SESSION" }, async () => {
    assert.equal(++active, 1); healthRuns += 1;
    try { await hold; } finally { active -= 1; }
  });
  await new Promise((resolve) => setImmediate(resolve));
  const timing = clock();
  timing.sleep = async (ms) => {
    timing.advance(ms); release(); await health;
    await coordinator.withProfileOperation({ sessionId: "profile", operationKind: "HEALTH_SESSION" }, async () => {
      assert.equal(++active, 1); healthRuns += 1; active -= 1;
    });
  };
  const pass = await runMirrorFleetWithHealthRetry({ storeCodes: ["a", "b"], cycleStartedAt: 0,
    retryHealthContention: true, shouldStop: () => false, onError: () => assert.fail("unexpected error"),
    attempt: async (id) => {
      const operation = await coordinator.withProfileOperation({ sessionId: "profile", operationKind: "MIRROR_SYNC" }, async () => {
        assert.equal(++active, 1); browserLaunches += 1;
        try { assert.ok(!ingested.has(id)); ingested.add(id); return result(id); }
        finally { active -= 1; }
      }, { waitForLock: false });
      return operation.acquired ? operation.value : result(id, "PARTIAL", operation.holderOperationKind === "HEALTH_SESSION");
    } }, timing);
  assert.equal(pass.retryRecovered, 2);
  assert.equal(browserLaunches, 2);
  assert.equal(ingested.size, 2);
  assert.equal(healthRuns, 2);
  assert.equal(active, 0);
  assert.equal(leases.size, 0);
});

test("coordinator releases both locks after callback failure; later health work acquires", async () => {
  const { coordinator, leases } = coordinatorFixture();
  await assert.rejects(coordinator.withProfileOperation({ sessionId: "profile", operationKind: "MIRROR_SYNC" }, async () => { throw new Error("failure"); }));
  assert.equal(leases.size, 0);
  const next = await coordinator.withProfileOperation({ sessionId: "profile", operationKind: "HEALTH_SESSION" }, async () => "healthy");
  assert.equal(next.acquired, true);
  assert.equal(leases.size, 0);
});
