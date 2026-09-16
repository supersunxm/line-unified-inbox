import assert from "node:assert/strict";
import test from "node:test";
import {
  MonthlyFollowerSummaryService,
  pickReliableFollowerDate,
} from "./monthly-follower-summary.service";

const snapshot = (
  lineOaId: string,
  date: string,
  followers: number | null,
  targetedReaches: number | null = null,
  blocks: number | null = null,
) => ({
  lineOaId,
  snapshotDate: new Date(`${date}T00:00:00.000Z`),
  followers,
  targetedReaches,
  blocks,
});

void test("reliable follower date prefers best account coverage before recency", () => {
  const selected = pickReliableFollowerDate(
    [
      snapshot("oa-1", "2026-08-30", 120),
      snapshot("oa-2", "2026-08-30", 230),
      snapshot("oa-1", "2026-08-31", 125),
    ],
    "2026-08-31",
    "2026-08-01",
  );
  assert.equal(selected, "2026-08-30");
});

void test("monthly follower summary is constrained to accessible stores and excludes head-office accounts", async () => {
  let accountWhere: unknown;
  let snapshotWhere: unknown;
  const prisma = {
    lineOfficialAccount: {
      findMany: async (args: { where: unknown }) => {
        accountWhere = args.where;
        return [{ id: "oa-1" }, { id: "oa-2" }];
      },
    },
    lineOaFollowerSnapshot: {
      findMany: async (args: { where: unknown }) => {
        snapshotWhere = args.where;
        return [
          snapshot("oa-1", "2026-07-31", 100, 80, 5),
          snapshot("oa-2", "2026-07-31", 200, 150, 10),
          snapshot("oa-1", "2026-08-30", 120, 90, 7),
          snapshot("oa-2", "2026-08-30", 230, 170, 12),
          snapshot("oa-1", "2026-08-31", 125, 95, 8),
        ];
      },
    },
  };
  const storeAccess = { accessibleStoreIds: async () => ["store-1"] };
  const service = new MonthlyFollowerSummaryService(prisma as never, storeAccess as never);

  const result = await service.get({ id: "hq" } as never, "2026-08");

  assert.deepEqual(accountWhere, {
    accountType: "STORE",
    storeId: { in: ["store-1"] },
    isActive: true,
    archivedAt: null,
    store: { isActive: true, archivedAt: null },
  });
  assert.deepEqual((snapshotWhere as { lineOaId: unknown }).lineOaId, { in: ["oa-1", "oa-2"] });
  assert.equal(result.available, true);
  assert.equal(result.totalFollowers, 350);
  assert.equal(result.monthlyGrowth, 50);
  assert.equal(result.growthRate, 50 / 300);
  assert.equal(result.targetedReaches, 260);
  assert.equal(result.blocks, 19);
  assert.equal(result.asOfDate, "2026-08-30");
  assert.equal(result.baselineDate, "2026-07-31");
  assert.equal(result.accountsExpected, 2);
  assert.equal(result.accountsWithData, 2);
  assert.equal(result.accountsCompared, 2);
  assert.equal(result.coverageRate, 1);
});

void test("HQ all-store follower scope still requests STORE accounts only", async () => {
  let accountWhere: unknown;
  const prisma = {
    lineOfficialAccount: {
      findMany: async (args: { where: unknown }) => {
        accountWhere = args.where;
        return [];
      },
    },
  };
  const service = new MonthlyFollowerSummaryService(
    prisma as never,
    { accessibleStoreIds: async () => null } as never,
  );

  const result = await service.get({ id: "hq" } as never, "2026-08");

  assert.deepEqual(accountWhere, {
    accountType: "STORE",
    storeId: { not: null },
    isActive: true,
    archivedAt: null,
    store: { isActive: true, archivedAt: null },
  });
  assert.equal(result.available, false);
  assert.equal(result.reason, "no_store_line_oa");
});

void test("missing follower snapshots return an explicit unavailable state", async () => {
  const prisma = {
    lineOfficialAccount: { findMany: async () => [{ id: "oa-1" }] },
    lineOaFollowerSnapshot: { findMany: async () => [] },
  };
  const service = new MonthlyFollowerSummaryService(
    prisma as never,
    { accessibleStoreIds: async () => ["store-1"] } as never,
  );

  const result = await service.get({ id: "staff" } as never, "2026-08");

  assert.equal(result.available, false);
  assert.equal(result.reason, "no_follower_snapshots");
  assert.equal(result.accountsExpected, 1);
  assert.equal(result.accountsWithData, 0);
  assert.equal(result.totalFollowers, null);
});
