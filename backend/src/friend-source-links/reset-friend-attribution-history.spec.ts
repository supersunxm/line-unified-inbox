import assert from "node:assert/strict";
import test from "node:test";
import { CONFIRMATION_FLAG, executeAttributionReset } from "../../scripts/reset-friend-attribution-history";

test("executeAttributionReset: Dry-run performs zero deletions and counts preserved structures", async () => {
  let deleteManyCalled = false;

  const mockPrisma = {
    store: { count: async () => 5 },
    lineOfficialAccount: { count: async () => 3 },
    friendSourceLink: { count: async () => 12 },
    friendAttributionConfig: { count: async () => 3 },
    friendSourceClick: {
      count: async () => 25,
      deleteMany: async () => { deleteManyCalled = true; return { count: 0 }; }
    },
    friendSourceAttribution: {
      count: async () => 10,
      deleteMany: async () => { deleteManyCalled = true; return { count: 0 }; }
    },
    friendAttributionSession: {
      count: async () => 15,
      deleteMany: async () => { deleteManyCalled = true; return { count: 0 }; }
    },
    friendAttributionUnmatchedFollow: {
      count: async () => 2,
      deleteMany: async () => { deleteManyCalled = true; return { count: 0 }; }
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)
  } as unknown;

  const summary = await executeAttributionReset(mockPrisma as any, []);

  assert.equal(summary.isDryRun, true, "Execution without confirmation flag must be dry-run");
  assert.equal(deleteManyCalled, false, "Dry-run MUST NOT invoke deleteMany or mutate database");
  assert.equal(summary.preservedStores, 5);
  assert.equal(summary.preservedLineAccounts, 3);
  assert.equal(summary.preservedSourceLinks, 12);
  assert.equal(summary.preservedLiffConfigs, 3);
  assert.equal(summary.clicksDeleted, 25);
  assert.equal(summary.attributionsDeleted, 10);
  assert.equal(summary.sessionsDeleted, 15);
  assert.equal(summary.unmatchedFollowsDeleted, 2);
});

test("executeAttributionReset: Real reset with confirmation flag deletes all attribution history within transaction", async () => {
  let transactionExecuted = false;

  const txMock = {
    friendSourceClick: { deleteMany: async () => ({ count: 25 }) },
    friendSourceAttribution: { deleteMany: async () => ({ count: 10 }) },
    friendAttributionSession: { deleteMany: async () => ({ count: 15 }) },
    friendAttributionUnmatchedFollow: { deleteMany: async () => ({ count: 2 }) },
  };

  const mockPrisma = {
    store: { count: async () => 5 },
    lineOfficialAccount: { count: async () => 3 },
    friendSourceLink: { count: async () => 12 },
    friendAttributionConfig: { count: async () => 3 },
    friendSourceClick: { count: async () => 25 },
    friendSourceAttribution: { count: async () => 10 },
    friendAttributionSession: { count: async () => 15 },
    friendAttributionUnmatchedFollow: { count: async () => 2 },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      transactionExecuted = true;
      return cb(txMock);
    }
  } as unknown;

  const summary = await executeAttributionReset(mockPrisma as any, [CONFIRMATION_FLAG]);

  assert.equal(summary.isDryRun, false, "Execution with confirmation flag must be real execution mode");
  assert.equal(transactionExecuted, true, "Real reset MUST execute inside a database transaction");
  assert.equal(summary.clicksDeleted, 25);
  assert.equal(summary.attributionsDeleted, 10);
  assert.equal(summary.sessionsDeleted, 15);
  assert.equal(summary.unmatchedFollowsDeleted, 2);
});

test("executeAttributionReset: Transaction failure rolls back completely", async () => {
  const mockPrisma = {
    store: { count: async () => 5 },
    lineOfficialAccount: { count: async () => 3 },
    friendSourceLink: { count: async () => 12 },
    friendAttributionConfig: { count: async () => 3 },
    friendSourceClick: { count: async () => 25 },
    friendSourceAttribution: { count: async () => 10 },
    friendAttributionSession: { count: async () => 15 },
    friendAttributionUnmatchedFollow: { count: async () => 2 },
    $transaction: async () => {
      throw new Error("Database transaction connection dropped");
    }
  } as unknown;

  await assert.rejects(
    async () => executeAttributionReset(mockPrisma as any, [CONFIRMATION_FLAG]),
    /Database transaction connection dropped/,
    "Transaction failure MUST throw and abort completely"
  );
});
