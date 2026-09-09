import assert from "node:assert/strict";
import test from "node:test";
import {
  LineChatProfileOperationCoordinator,
  PROFILE_OPERATION_LEASE_DURATION_MS,
} from "./line-chat-profile-operation-coordinator.service";

type Lease = { id: string; ownerToken: string; leaseUntil: Date };

function createFakePrisma() {
  const leases = new Map<string, Lease>();
  let sequence = 0;
  return {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join(" ");
      if (query.includes('INSERT INTO "LineChatProfileOperationLease"')) {
        const sessionId = String(values[1]);
        const ownerToken = String(values[2]);
        if (leases.has(sessionId)) return [];
        const lease = {
          id: `lease-${++sequence}`,
          ownerToken,
          leaseUntil: new Date(Date.now() + PROFILE_OPERATION_LEASE_DURATION_MS),
        };
        leases.set(sessionId, lease);
        return [lease];
      }
      if (query.includes('UPDATE "LineChatProfileOperationLease"')) {
        const sessionId = String(values[0]);
        const ownerToken = String(values[1]);
        const lease = leases.get(sessionId);
        if (!lease || lease.ownerToken !== ownerToken) return [];
        lease.leaseUntil = new Date(Date.now() + PROFILE_OPERATION_LEASE_DURATION_MS);
        return [{ id: lease.id }];
      }
      throw new Error(`Unexpected query: ${query}`);
    },
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const sessionId = String(values[0]);
      const ownerToken = String(values[1]);
      if (leases.get(sessionId)?.ownerToken === ownerToken) leases.delete(sessionId);
      return 1;
    },
  };
}

test("customer relay waits behind an active nickname job and runs next", async () => {
  const coordinator = new LineChatProfileOperationCoordinator(createFakePrisma() as never);
  let releaseNickname!: () => void;
  const nicknameHold = new Promise<void>((resolve) => { releaseNickname = resolve; });
  const order: string[] = [];

  const nickname = coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "NICKNAME_UPDATE" },
    async () => {
      order.push("nickname-start");
      await nicknameHold;
      order.push("nickname-end");
    },
  );

  await new Promise((resolve) => setImmediate(resolve));
  const relayPromise = coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "MANUAL_DIAGNOSTIC" },
    async () => {
      order.push("relay");
      return "sent";
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(order, ["nickname-start"]);
  releaseNickname();

  assert.equal((await nickname).acquired, true);
  const relay = await relayPromise;
  assert.equal(relay.acquired, true);
  if (relay.acquired) assert.equal(relay.value, "sent");
  assert.deepEqual(order, ["nickname-start", "nickname-end", "relay"]);
});

test("background nickname work still fails fast while a profile is busy", async () => {
  const coordinator = new LineChatProfileOperationCoordinator(createFakePrisma() as never);
  let releaseFirst!: () => void;
  const hold = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = coordinator.withProfileOperation(
    { sessionId: "account-1", operationKind: "NICKNAME_UPDATE" },
    async () => hold,
  );
  await new Promise((resolve) => setImmediate(resolve));

  const second = await coordinator.withProfileOperation(
    { sessionId: "account-1", operationKind: "NICKNAME_UPDATE" },
    async () => "should-not-run",
  );
  assert.equal(second.acquired, false);
  releaseFirst();
  assert.equal((await first).acquired, true);
});

test("recent resolution is treated as customer-facing priority work", async () => {
  const coordinator = new LineChatProfileOperationCoordinator(createFakePrisma() as never);
  let releaseNickname!: () => void;
  const hold = new Promise<void>((resolve) => { releaseNickname = resolve; });

  const nickname = coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "NICKNAME_UPDATE" },
    async () => hold,
  );
  await new Promise((resolve) => setImmediate(resolve));

  const resolutionPromise = coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "RECENT_RESOLUTION" },
    async () => "resolved",
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  releaseNickname();

  await nickname;
  const resolution = await resolutionPromise;
  assert.equal(resolution.acquired, true);
  if (resolution.acquired) assert.equal(resolution.value, "resolved");
});

test("background mapping defers immediately when a customer relay is active", async () => {
  const coordinator = new LineChatProfileOperationCoordinator(createFakePrisma() as never);
  let releaseRelay!: () => void;
  const relayHold = new Promise<void>((resolve) => { releaseRelay = resolve; });
  let backgroundRan = false;

  const relay = coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "MANUAL_DIAGNOSTIC" },
    async () => relayHold,
  );
  await new Promise((resolve) => setImmediate(resolve));

  const startedAt = Date.now();
  const background = await coordinator.withProfileOperation(
    { sessionId: "profile-b", operationKind: "RECENT_RESOLUTION" },
    async () => {
      backgroundRan = true;
      return "must-not-run";
    },
    { waitForLock: false },
  );
  assert.equal(background.acquired, false);
  assert.equal(backgroundRan, false);
  assert.ok(Date.now() - startedAt < 1_000);

  releaseRelay();
  assert.equal((await relay).acquired, true);
});

test("text and image relay operations receive the same priority over background work", async () => {
  for (const relayType of ["text", "image"] as const) {
    const coordinator = new LineChatProfileOperationCoordinator(createFakePrisma() as never);
    let releaseBackground!: () => void;
    const backgroundHold = new Promise<void>((resolve) => { releaseBackground = resolve; });
    const order: string[] = [];

    const background = coordinator.withProfileOperation(
      { sessionId: "profile-b", operationKind: "NICKNAME_UPDATE" },
      async () => {
        order.push("background-start");
        await backgroundHold;
        order.push("background-end");
      },
    );
    await new Promise((resolve) => setImmediate(resolve));
    const relay = coordinator.withProfileOperation(
      { sessionId: "profile-b", operationKind: "MANUAL_DIAGNOSTIC" },
      async () => {
        order.push(`${relayType}-relay`);
        return "sent";
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    releaseBackground();
    await background;
    const result = await relay;
    assert.equal(result.acquired, true);
    assert.deepEqual(order, ["background-start", "background-end", `${relayType}-relay`]);
  }
});
