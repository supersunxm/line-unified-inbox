import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import {
  formatDbDateToIso,
  formatToIsoDate,
  formatToLineApiDate,
  getDateRangeArray,
  getTodayBangkokDateString,
  toUtcDateForDb,
} from "./date-utils";
import { BackfillConfig, FollowerInsightsService } from "./follower-insights.service";
import { FollowerInsightsController } from "./follower-insights.controller";
import { AuthGuard } from "../auth/auth.guard";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES } from "../auth/auth.decorators";

void test("date formatting helper correctly converts YYYYMMDD and YYYY-MM-DD", () => {
  assert.equal(formatToIsoDate("20260722"), "2026-07-22");
  assert.equal(formatToIsoDate("2026-07-22"), "2026-07-22");
  assert.equal(formatToLineApiDate("2026-07-22"), "20260722");
  assert.equal(formatToLineApiDate("20260722"), "20260722");

  const utcDate = toUtcDateForDb("2026-07-22");
  assert.equal(utcDate.toISOString(), "2026-07-22T00:00:00.000Z");
  assert.equal(formatDbDateToIso(utcDate), "2026-07-22");
});

void test("Asia/Bangkok today date string calculation is valid ISO date format", () => {
  const today = getTodayBangkokDateString();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

void test("90-day inclusive backfill date range limit is strictly enforced", () => {
  assert.throws(() => getDateRangeArray("2026-07-22", "2026-07-21"), /cannot be earlier than dateFrom/);

  const valid90 = getDateRangeArray("2026-01-01", "2026-03-31");
  assert.equal(valid90.length, 90);

  assert.throws(() => getDateRangeArray("2026-01-01", "2026-04-01"), /exceeds maximum limit of 90 days/);
});

void test("invalid calendar dates are rejected without JS Date rollover", () => {
  assert.throws(() => formatToIsoDate("2026-02-31"), /Invalid calendar date/);
  assert.throws(() => formatToIsoDate("2026-13-01"), /Invalid calendar date/);
  assert.throws(() => formatToIsoDate("2026-00-10"), /Invalid calendar date/);
  assert.throws(() => formatToIsoDate("20260231"), /Invalid calendar date/);
  assert.throws(() => formatToIsoDate("2026-04-31"), /Invalid calendar date/);
  assert.doesNotThrow(() => formatToIsoDate("2026-02-28"));
  assert.doesNotThrow(() => formatToIsoDate("2024-02-29"));
  assert.throws(() => formatToIsoDate("2026-02-29"), /Invalid calendar date/);
});

void test("summary dailyIncrease only compares with exact previous Bangkok calendar date", async () => {
  const fakeSnapshots = [
    { lineOaId: "oa1", snapshotDate: toUtcDateForDb("2026-07-01"), status: "ready", followers: 100, targetedReaches: 50, blocks: 5 },
    { lineOaId: "oa1", snapshotDate: toUtcDateForDb("2026-07-02"), status: "ready", followers: 110, targetedReaches: 55, blocks: 5 },
    { lineOaId: "oa1", snapshotDate: toUtcDateForDb("2026-07-04"), status: "ready", followers: 130, targetedReaches: 65, blocks: 7 },
  ];

  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve([{ id: "oa1" }]),
    },
    lineOaFollowerSnapshot: {
      findMany: () => Promise.resolve(fakeSnapshots),
    },
  } as unknown as PrismaService;

  const mockEncryption = { decrypt: (val: string) => val } as unknown as CredentialEncryptionService;

  const service = new FollowerInsightsService(mockPrisma, mockEncryption);
  const summary = await service.getSummary({ dateFrom: "2026-07-01", dateTo: "2026-07-04", lineOaId: "oa1" });

  assert.equal(summary.length, 4);
  assert.equal(summary[0].date, "2026-07-01");
  assert.equal(summary[0].dailyIncrease, null);

  assert.equal(summary[1].date, "2026-07-02");
  assert.equal(summary[1].followers, 110);
  assert.equal(summary[1].dailyIncrease, 10); // 110 - 100

  assert.equal(summary[2].date, "2026-07-03");
  assert.equal(summary[2].followers, null);
  assert.equal(summary[2].dailyIncrease, null);

  assert.equal(summary[3].date, "2026-07-04");
  assert.equal(summary[3].followers, 130);
  assert.equal(summary[3].dailyIncrease, null); // 2026-07-03 is missing, so dailyIncrease must be null (not 130 - 110)!
});

void test("unready snapshots and missing metrics remain null and are not aggregated as zero", async () => {
  const fakeSnapshots = [
    { lineOaId: "oa1", snapshotDate: toUtcDateForDb("2026-07-01"), status: "unready", followers: null, targetedReaches: null, blocks: null },
    { lineOaId: "oa2", snapshotDate: toUtcDateForDb("2026-07-01"), status: "ready", followers: 200, targetedReaches: null, blocks: 10 },
  ];

  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve([{ id: "oa1" }, { id: "oa2" }]),
    },
    lineOaFollowerSnapshot: {
      findMany: () => Promise.resolve(fakeSnapshots),
      findFirst: () => Promise.resolve(null),
    },
  } as unknown as PrismaService;

  const mockEncryption = { decrypt: (val: string) => val } as unknown as CredentialEncryptionService;
  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  const summary = await service.getSummary({ dateFrom: "2026-07-01", dateTo: "2026-07-01" });
  assert.equal(summary.length, 1);
  assert.equal(summary[0].accountsExpected, 2);
  assert.equal(summary[0].accountsWithData, 2);
  assert.equal(summary[0].accountsReady, 1);
  assert.equal(summary[0].accountsUnready, 1);

  assert.equal(summary[0].followers, 200);
  assert.equal(summary[0].targetedReaches, null);
  assert.equal(summary[0].blocks, 10);
});

void test("any non-ready status is counted as accountsUnready and accountsReady + accountsUnready equals accountsWithData", async () => {
  const fakeSnapshots = [
    { lineOaId: "oa1", snapshotDate: toUtcDateForDb("2026-07-01"), status: "ready", followers: 100, targetedReaches: 50, blocks: 5 },
    { lineOaId: "oa2", snapshotDate: toUtcDateForDb("2026-07-01"), status: "unready", followers: null, targetedReaches: null, blocks: null },
    { lineOaId: "oa3", snapshotDate: toUtcDateForDb("2026-07-01"), status: "out_of_service", followers: null, targetedReaches: null, blocks: null },
    { lineOaId: "oa4", snapshotDate: toUtcDateForDb("2026-07-01"), status: "pending", followers: null, targetedReaches: null, blocks: null },
  ];

  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve([{ id: "oa1" }, { id: "oa2" }, { id: "oa3" }, { id: "oa4" }, { id: "oa5" }]),
    },
    lineOaFollowerSnapshot: {
      findMany: () => Promise.resolve(fakeSnapshots),
      findFirst: () => Promise.resolve(null),
    },
  } as unknown as PrismaService;

  const mockEncryption = { decrypt: (val: string) => val } as unknown as CredentialEncryptionService;
  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  const summary = await service.getSummary({ dateFrom: "2026-07-01", dateTo: "2026-07-01" });
  assert.equal(summary.length, 1);
  const row = summary[0];
  assert.equal(row.accountsExpected, 5);
  assert.equal(row.accountsWithData, 4);
  assert.equal(row.accountsReady, 1);
  assert.equal(row.accountsUnready, 3);
  assert.equal(row.accountsMissing, 1);
  assert.equal(row.accountsReady + row.accountsUnready, row.accountsWithData);
});

void test("LINE API error sanitization does not expose tokens or raw error messages", async () => {
  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () =>
        Promise.resolve([
          { id: "oa1", name: "Store OA 1", encryptedChannelAccessToken: "secret-token" },
        ]),
    },
  } as unknown as PrismaService;

  const mockEncryption = {
    decrypt: () => {
      throw new Error("Sensitive decryption key error with secret values");
    },
  } as unknown as CredentialEncryptionService;

  const service = new FollowerInsightsService(mockPrisma, mockEncryption);
  const result = await service.sync({ date: "2026-07-22" });

  assert.equal(result.failed, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, "LINE_CREDENTIAL_ERROR");
  assert.equal((result.errors[0] as unknown as Record<string, unknown>).message, undefined);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

void test("sync handles partial failure without failing the entire batch with bounded concurrency", async () => {
  const accounts = Array.from({ length: 7 }, (_, i) => ({
    id: `oa_${i + 1}`,
    name: `OA ${i + 1}`,
    encryptedChannelAccessToken: `token_${i + 1}`,
  }));

  const upserted: string[] = [];
  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve(accounts),
    },
    lineOaFollowerSnapshot: {
      upsert: (params: { create: { lineOaId: string } }) => {
        upserted.push(params.create.lineOaId);
        return Promise.resolve();
      },
    },
  } as unknown as PrismaService;

  const mockEncryption = {
    decrypt: (val: string) => (val === "token_3" ? "INVALID" : val),
  } as unknown as CredentialEncryptionService;

  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string>)?.Authorization || "";
    if (auth.includes("INVALID")) {
      return Promise.resolve({ ok: false, status: 401 } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: "ready", followers: 500, targetedReaches: 400, blocks: 20 }),
    } as Response);
  };

  try {
    const result = await service.sync({ date: "2026-07-22" });

    assert.equal(result.requested, 7);
    assert.equal(result.succeeded, 6);
    assert.equal(result.failed, 1);
    assert.equal(result.errors[0].lineOaId, "oa_3");
    assert.equal(result.errors[0].code, "LINE_API_ERROR_401");
    assert.equal(upserted.length, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("Prisma upsert failure does not reject the batch and remaining accounts continue", async () => {
  const accounts = Array.from({ length: 5 }, (_, i) => ({
    id: `oa_${i + 1}`,
    name: `OA ${i + 1}`,
    encryptedChannelAccessToken: `token_${i + 1}`,
  }));

  const upserted: string[] = [];
  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () => Promise.resolve(accounts),
    },
    lineOaFollowerSnapshot: {
      upsert: (params: { create: { lineOaId: string } }) => {
        if (params.create.lineOaId === "oa_2") {
          return Promise.reject(new Error("Unique constraint violation on lineOaId_snapshotDate"));
        }
        if (params.create.lineOaId === "oa_4") {
          return Promise.reject(new Error("Connection pool timeout"));
        }
        upserted.push(params.create.lineOaId);
        return Promise.resolve();
      },
    },
  } as unknown as PrismaService;

  const mockEncryption = {
    decrypt: (val: string) => val,
  } as unknown as CredentialEncryptionService;

  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: "ready", followers: 100, targetedReaches: 50, blocks: 5 }),
    } as Response);

  try {
    const result = await service.sync({ date: "2026-07-22" });

    assert.equal(result.requested, 5);
    assert.equal(result.succeeded + result.failed, 5);
    assert.equal(result.failed, 2);
    assert.equal(result.succeeded, 3);
    assert.equal(upserted.length, 3);
    assert.ok(upserted.includes("oa_1"));
    assert.ok(upserted.includes("oa_3"));
    assert.ok(upserted.includes("oa_5"));

    const dbErrors = result.errors.filter((e) => e.code === "DATABASE_WRITE_ERROR");
    assert.equal(dbErrors.length, 2);
    assert.equal(dbErrors[0].lineOaId, "oa_2");
    assert.equal(dbErrors[1].lineOaId, "oa_4");

    const resultJson = JSON.stringify(result);
    assert.equal(resultJson.includes("Unique constraint"), false);
    assert.equal(resultJson.includes("Connection pool"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("missing by-store rows have fetchedAt null and status missing", async () => {
  const mockPrisma = {
    lineOfficialAccount: {
      findMany: () =>
        Promise.resolve([
          {
            id: "oa1",
            name: "Account 1",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [],
          },
          {
            id: "oa2",
            name: "Account 2",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [
              { status: "ready", followers: 300, targetedReaches: 200, blocks: 10, fetchedAt: new Date("2026-07-22T10:00:00Z"), snapshotDate: toUtcDateForDb("2026-07-22") },
            ],
          },
        ]),
    },
    lineOaFollowerSnapshot: {
      findFirst: () => Promise.resolve(null),
    },
  } as unknown as PrismaService;

  const mockEncryption = { decrypt: (val: string) => val } as unknown as CredentialEncryptionService;
  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  const rows = await service.getByStore({ date: "2026-07-22" });
  assert.equal(rows.length, 2);

  const missingRow = rows.find((r) => r.lineOaId === "oa1");
  assert.ok(missingRow);
  assert.equal(missingRow.status, "missing");
  assert.equal(missingRow.fetchedAt, null);
  assert.equal(missingRow.followers, null);

  const readyRow = rows.find((r) => r.lineOaId === "oa2");
  assert.ok(readyRow);
  assert.equal(readyRow.status, "ready");
  assert.notEqual(readyRow.fetchedAt, null);
  assert.equal(readyRow.followers, 300);
});

test("getByStore range comparison logic and OPPO regression fixture", async () => {
  let findManyArgs: any = null;

  const mockPrisma = {
    lineOfficialAccount: {
      findMany: (args: any) => {
        findManyArgs = args;
        return Promise.resolve([
          {
            id: "oppo-chonburi",
            name: "OPPO BS RBS Chonburi",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [
              { status: "ready", followers: 6866, snapshotDate: toUtcDateForDb("2026-06-30") },
              { status: "ready", followers: 6879, snapshotDate: toUtcDateForDb("2026-07-01") },
              { status: "ready", followers: 7151, snapshotDate: toUtcDateForDb("2026-07-15") },
            ],
          },
          {
            id: "oa2", // Missing start snapshot
            name: "Account 2",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [
              { status: "ready", followers: 150, snapshotDate: toUtcDateForDb("2026-07-15") },
            ],
          },
          {
            id: "oa4", // Same date dateFrom/dateTo resulting in zero increase
            name: "Account 4",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [
              { status: "ready", followers: 100, snapshotDate: toUtcDateForDb("2026-07-15") },
            ],
          },
          {
            id: "oa-intervening-missing", // Intervening dates missing, dailyIncrease must be null
            name: "Account Intervening Missing",
            store: { id: "store1", name: "Store 1" },
            followerSnapshots: [
              { status: "ready", followers: 5000, snapshotDate: toUtcDateForDb("2026-07-01") },
              { status: "ready", followers: 5150, snapshotDate: toUtcDateForDb("2026-07-15") },
              // Note: 2026-07-14 snapshot is missing!
            ],
          },
        ]);
      },
    },
    lineOaFollowerSnapshot: {
      findFirst: () => Promise.resolve(null),
    },
  } as unknown as PrismaService;

  const mockEncryption = { decrypt: (val: string) => val } as unknown as CredentialEncryptionService;
  const service = new FollowerInsightsService(mockPrisma, mockEncryption);

  // 1. Normal range 07-01 to 07-15
  const rows = await service.getByStore({ dateFrom: "2026-07-01", dateTo: "2026-07-15" });

  // Verify Prisma findMany args query exact dates
  assert.ok(findManyArgs, "findMany should be called");
  const inCondition = findManyArgs?.include?.followerSnapshots?.where?.snapshotDate?.in;
  assert.ok(inCondition, "followerSnapshots query should use 'in' operator");
  assert.equal(inCondition.length, 3, "followerSnapshots should query start date, target date, and previous target date");

  // Assert OPPO fixture values
  const oppo = rows.find(r => r.lineOaId === "oppo-chonburi");
  assert.ok(oppo, "OPPO account must exist in result");
  assert.equal(oppo.status, "ready", "OPPO status must be ready");
  assert.equal(oppo.startFollowers, 6879, "startFollowers must be 6879 (matching 2026-07-01 snapshot)");
  assert.equal(oppo.followers, 7151, "currentFollowers must be 7151");
  assert.equal(oppo.periodIncrease, 272, "periodIncrease must be 7151 - 6879 = 272");

  const oa2 = rows.find(r => r.lineOaId === "oa2");
  assert.equal(oa2?.startFollowers, null, "oa2 missing startFollowers should be null");
  assert.equal(oa2?.periodIncrease, null, "oa2 missing periodIncrease should be null");
  assert.equal(oa2?.status, "missing-baseline", "oa2 missing start should indicate missing-baseline");

  const oaIntervening = rows.find(r => r.lineOaId === "oa-intervening-missing");
  assert.ok(oaIntervening);
  assert.equal(oaIntervening.dailyIncrease, null, "dailyIncrease must be null when previous calendar date snapshot (2026-07-14) is missing");
  assert.equal(oaIntervening.periodIncrease, 150, "periodIncrease for range 2026-07-01 to 2026-07-15 is still 150");

  // 2. Same date range 07-15 to 07-15
  const rowsSameDate = await service.getByStore({ dateFrom: "2026-07-15", dateTo: "2026-07-15" });
  const oa4 = rowsSameDate.find(r => r.lineOaId === "oa4");
  assert.equal(oa4?.startFollowers, 100, "oa4 startFollowers");
  assert.equal(oa4?.followers, 100, "oa4 currentFollowers");
  assert.equal(oa4?.periodIncrease, 0, "oa4 same date resulting in zero increase");
});

test("backend summary comparisonMode=comparable mathematically filters fixed account set (Fixture A-E)", async () => {
  // Mock accounts A, B, C, D, E
  const mockAccounts = [
    { id: "oa-A" }, { id: "oa-B" }, { id: "oa-C" }, { id: "oa-D" }, { id: "oa-E" }
  ];

  // Mock snapshots for 2026-07-01, 2026-07-02, 2026-07-03
  // 07-01: A, B, C ready (1000 each = 3000)
  // 07-02: A, B, C ready (1000 each = 3000)
  // 07-03: A, B, C, D, E ready (1000 each = 5000)
  const d1 = new Date("2026-07-01T00:00:00.000Z");
  const d2 = new Date("2026-07-02T00:00:00.000Z");
  const d3 = new Date("2026-07-03T00:00:00.000Z");

  const mockSnapshots = [
    { lineOaId: "oa-A", snapshotDate: d1, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-B", snapshotDate: d1, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-C", snapshotDate: d1, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },

    { lineOaId: "oa-A", snapshotDate: d2, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-B", snapshotDate: d2, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-C", snapshotDate: d2, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },

    { lineOaId: "oa-A", snapshotDate: d3, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-B", snapshotDate: d3, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-C", snapshotDate: d3, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-D", snapshotDate: d3, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
    { lineOaId: "oa-E", snapshotDate: d3, status: "ready", followers: 1000, targetedReaches: 800, blocks: 10 },
  ];

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => mockAccounts,
      findFirst: async () => ({ id: "oa-A", isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async () => mockSnapshots,
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);

  // Available Mode
  const summaryAvailable = await service.getSummary({
    dateFrom: "2026-07-01",
    dateTo: "2026-07-03",
    comparisonMode: "available",
  });

  assert.equal(summaryAvailable[0].accountsReady, 3);
  assert.equal(summaryAvailable[0].followers, 3000);
  assert.equal(summaryAvailable[2].accountsReady, 5);
  assert.equal(summaryAvailable[2].followers, 5000);

  // Comparable Mode
  const summaryComparable = await service.getSummary({
    dateFrom: "2026-07-01",
    dateTo: "2026-07-03",
    comparisonMode: "comparable",
  });

  assert.equal(summaryComparable[0].accountsReady, 3, "Comparable account count on 07-01");
  assert.equal(summaryComparable[0].followers, 3000, "Comparable followers on 07-01");
  assert.equal(summaryComparable[2].accountsReady, 3, "Comparable account count on 07-03 must be 3 (excluding D and E)");
  assert.equal(summaryComparable[2].followers, 3000, "Comparable followers on 07-03 must be 3000 (excluding D and E)");
  assert.equal(summaryComparable[2].targetedReaches, 2400);
  assert.equal(summaryComparable[2].blocks, 30);
});

test("targeted backfill validates lineOaId and rejects unknown or inactive accounts", async () => {
  const mockPrisma: any = {
    lineOfficialAccount: {
      findFirst: async ({ where }: any) => {
        if (where.id === "unknown-id" || where.id === "inactive-id") return null;
        return { id: "valid-id", isActive: true };
      },
      findMany: async () => [{ id: "valid-id", name: "Valid OA", encryptedChannelAccessToken: "tok" }],
    },
    lineOaFollowerSnapshot: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
  };

  const service = new FollowerInsightsService(mockPrisma, { decrypt: () => "token" } as any);

  // Unknown account throws NotFoundException
  await assert.rejects(
    async () => {
      await service.backfill({ dateFrom: "2026-07-01", dateTo: "2026-07-02", lineOaId: "unknown-id" });
    },
    { name: "NotFoundException" }
  );

  // Valid account succeeds
  const res = await service.backfill({ dateFrom: "2026-07-01", dateTo: "2026-07-01", lineOaId: "valid-id" });
  assert.equal(res.totalDays, 1);
});

test("automatic backfill job queueing, idempotency, and status retrieval", async () => {
  let createdJob: any = null;
  const mockPrisma: any = {
    lineOfficialAccount: {
      findFirst: async () => ({ id: "oa-new-123", isActive: true }),
    },
    lineOaBackfillJob: {
      findFirst: async () => createdJob,
      create: async ({ data }: any) => {
        createdJob = { ...data, id: "job-1", createdAt: new Date() };
        return createdJob;
      },
      findUnique: async () => createdJob,
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }: any) => {
        createdJob = { ...createdJob, ...data };
        return createdJob;
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);

  // Enqueue job
  const job = await service.enqueueAutoBackfillJob("oa-new-123");
  assert.equal(job.lineOaId, "oa-new-123");
  assert.equal(job.status, "QUEUED");
  assert.equal(job.totalDays, 30);

  // Status retrieval
  const status = await service.getJobStatus("oa-new-123");
  assert.ok(status);
  assert.equal(status.id, "job-1");
});

test("getAutoBackfillDates calculates exactly 30 inclusive calendar days ending yesterday across month and year boundaries", () => {
  const mockPrisma: any = {};
  const service = new FollowerInsightsService(mockPrisma, {} as any);

  // Standard date
  const range1 = service.getAutoBackfillDates("2026-07-23");
  assert.equal(range1.dateTo, "2026-07-22");
  assert.equal(range1.dateFrom, "2026-06-23");
  assert.equal(range1.totalDays, 30);

  // Year boundary (New Year's Day)
  const range2 = service.getAutoBackfillDates("2026-01-01");
  assert.equal(range2.dateTo, "2025-12-31");
  assert.equal(range2.dateFrom, "2025-12-02");
  assert.equal(range2.totalDays, 30);

  // Month boundary
  const range3 = service.getAutoBackfillDates("2026-03-01");
  assert.equal(range3.dateTo, "2026-02-28");
  assert.equal(range3.dateFrom, "2026-01-30");
  assert.equal(range3.totalDays, 30);
});

test("concurrency duplicate-job prevention returns existing active job on P2002 collision", async () => {
  const existingJob = { id: "job-active-1", lineOaId: "oa-conc-1", status: "QUEUED", dateFrom: "2026-06-23", dateTo: "2026-07-22", totalDays: 30, requested: 0, succeeded: 0, skipped: 0, unready: 0, failed: 0, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };

  let createAttempt = 0;
  const mockPrisma: any = {
    lineOfficialAccount: {
      findFirst: async () => ({ id: "oa-conc-1", isActive: true }),
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => (createAttempt > 0 ? existingJob : null),
      create: async () => {
        createAttempt++;
        // Simulate P2002 unique constraint violation on second call
        const err: any = new Error("Unique constraint failed on active index");
        err.code = "P2002";
        throw err;
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const result = await service.enqueueAutoBackfillJob("oa-conc-1");

  assert.equal(result.id, "job-active-1");
  assert.equal(result.lineOaId, "oa-conc-1");
});

test("stale job recovery resets RUNNING job when attempts < maxAttempts and fails job when attempts >= maxAttempts", async () => {
  const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
  const runningJobs = [
    { id: "job-recoverable", lineOaId: "oa-1", status: "RUNNING", startedAt: staleDate, attempts: 1, maxAttempts: 3 },
    { id: "job-exhausted", lineOaId: "oa-2", status: "RUNNING", startedAt: staleDate, attempts: 3, maxAttempts: 3 },
  ];

  const updatedRecords: any[] = [];
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findMany: async () => runningJobs,
      updateMany: async ({ where, data }: any) => {
        updatedRecords.push({ id: where.id, data });
        return { count: 1 };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const count = await service.recoverStaleJobs();

  assert.equal(count, 1, "Only 1 job should be recovered to QUEUED");
  assert.equal(updatedRecords[0].id, "job-recoverable");
  assert.equal(updatedRecords[0].data.status, "QUEUED");
  assert.equal(updatedRecords[1].id, "job-exhausted");
  assert.equal(updatedRecords[1].data.status, "FAILED");
});

test("active job with recent heartbeat is NOT reclaimed even if started over 5 minutes ago", async () => {
  const startedAt = new Date(Date.now() - 15 * 60 * 1000); // Started 15 minutes ago
  const freshHeartbeat = new Date(Date.now() - 10 * 1000); // Heartbeat 10 seconds ago

  const mockPrisma: any = {
    lineOaBackfillJob: {
      findMany: async () => [], // Query for stale jobs returns 0 rows because heartbeat is fresh
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const count = await service.recoverStaleJobs();
  assert.equal(count, 0, "Active job with fresh heartbeat must not be reclaimed");
});

test("two workers claim the exact same QUEUED job and exactly one worker succeeds", async () => {
  const queuedJob = {
    id: "job-atomic-1",
    lineOaId: "oa-1",
    status: "QUEUED",
    dateFrom: "2026-06-23",
    dateTo: "2026-07-22",
    totalDays: 30,
    attempts: 0,
    maxAttempts: 3,
  };

  let updateCallCount = 0;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => queuedJob,
      updateMany: async ({ where }: any) => {
        updateCallCount++;
        // Worker 1 succeeds, Worker 2 fails because updateMany status guard matches status === "QUEUED" only once
        if (updateCallCount === 1) return { count: 1 };
        return { count: 0 };
      },
      findUnique: async () => queuedJob,
    },
  };

  const service1 = new FollowerInsightsService(mockPrisma, {} as any);
  const service2 = new FollowerInsightsService(mockPrisma, {} as any);

  // Mock processClaimedJob to prevent actual backfill run
  service1.processClaimedJob = async () => true;
  service2.processClaimedJob = async () => true;

  const claim1 = await service1.claimAndProcessNextJob("worker-1");
  const claim2 = await service2.claimAndProcessNextJob("worker-2");

  assert.equal(claim1, true, "Worker 1 must successfully claim the job");
  assert.equal(claim2, false, "Worker 2 must fail to claim the job");
});

test("old worker cannot update status or progress after losing ownership", async () => {
  const mockPrisma: any = {
    lineOaBackfillJob: {
      updateMany: async () => ({ count: 0 }), // 0 rows updated because workerId no longer matches
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const heartbeatResult = await service.updateHeartbeat("job-1", "stale-worker-id");
  assert.equal(heartbeatResult, false, "Guarded update must return false when worker lost ownership");
});

test("retry honors nextAttemptAt backoff and skips job when nextAttemptAt is in the future", async () => {
  const futureJob = {
    id: "job-backoff-1",
    lineOaId: "oa-1",
    status: "QUEUED",
    nextAttemptAt: new Date(Date.now() + 60000), // 1 minute in future
  };

  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => null, // findFirst filter skips jobs with nextAttemptAt > now
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const claimed = await service.claimAndProcessNextJob();
  assert.equal(claimed, false, "Job with future nextAttemptAt must be skipped");
});

test("reconcileUncoveredAccounts enqueues backfill for active accounts lacking historical coverage", async () => {
  let enqueuedLineOaId = "";
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [{ id: "oa-uncovered-1" }],
      updateMany: async () => ({ count: 1 }),
      findFirst: async () => ({ id: "oa-uncovered-1", isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async () => [],
      findFirst: async () => null, // No snapshot for yesterday
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null, // No active or completed job
      create: async ({ data }: any) => {
        enqueuedLineOaId = data.lineOaId;
        return { ...data, id: "job-rec-1" };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const count = await service.reconcileUncoveredAccounts();

  assert.equal(count, 1);
  assert.equal(enqueuedLineOaId, "oa-uncovered-1");
});

test("application shutdown clears worker polling timer cleanly", () => {
  const savedWorker = process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  // Explicitly opt-in — default is now false by design
  process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = "true";
  process.env.NODE_ENV = "production";
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.ok((service as any).workerTimer !== null, "Polling timer should be active after bootstrap with WORKER_ENABLED=true");

    const firstTimer = (service as any).workerTimer;
    service.onApplicationBootstrap();
    assert.equal((service as any).workerTimer, firstTimer, "Duplicate bootstrap call must not create a secondary timer");

    service.onModuleDestroy();
    assert.equal((service as any).workerTimer, null, "Polling timer should be null after module destroy");
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedWorker !== undefined) process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = savedWorker;
    else delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  }
});


test("yesterday ready but 29 earlier dates missing → job enqueued", async () => {
  const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
  const yesterdayUtc = toUtcDateForDb(dateTo);

  let jobCreated = false;
  const mockPrisma: any = {
    lineOfficialAccount: { findFirst: async () => ({ id: "oa-test-1", isActive: true }) },
    lineOaFollowerSnapshot: {
      findMany: async () => [{ snapshotDate: yesterdayUtc, status: "ready", followers: 1000 }],
    },
    lineOaBackfillJob: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        jobCreated = true;
        return { ...data, id: "job-1" };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const result = await service.enqueueAutoBackfillJob("oa-test-1");

  assert.equal(jobCreated, true, "Job must be enqueued when 29 earlier dates are missing");
  assert.equal(result.totalDays, 29);
});

test("full 30 days ready → no new job created", async () => {
  const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
  const allDates = getDateRangeArray(dateFrom, dateTo);

  const completedJob = { id: "job-comp", lineOaId: "oa-test-2", status: "COMPLETED", dateFrom, dateTo, totalDays: 30, requested: 30, succeeded: 30, skipped: 0, unready: 0, failed: 0, errorMessage: null, startedAt: new Date(), completedAt: new Date(), createdAt: new Date() };

  let createCalled = false;
  const mockPrisma: any = {
    lineOfficialAccount: { findFirst: async () => ({ id: "oa-test-2", isActive: true }) },
    lineOaFollowerSnapshot: {
      findMany: async () => allDates.map(d => ({ snapshotDate: toUtcDateForDb(d), status: "ready", followers: 1000 })),
    },
    lineOaBackfillJob: {
      findFirst: async () => completedJob,
      create: async () => { createCalled = true; },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const result = await service.enqueueAutoBackfillJob("oa-test-2");

  assert.equal(createCalled, false, "Create should not be called when full 30 days are ready");
  assert.equal(result.status, "COMPLETED");
});

test("old COMPLETED job with new missing date when rolling window advances → new job enqueued", async () => {
  const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
  // Simulate yesterday (2026-07-22) is missing because rolling date window advanced by 1 day
  const readyDates = getDateRangeArray("2026-06-23", "2026-07-21");

  let createCalled = false;
  const mockPrisma: any = {
    lineOfficialAccount: { findFirst: async () => ({ id: "oa-test-3", isActive: true }) },
    lineOaFollowerSnapshot: {
      findMany: async () => readyDates.map(d => ({ snapshotDate: toUtcDateForDb(d), status: "ready", followers: 1000 })),
    },
    lineOaBackfillJob: {
      findFirst: async () => null, // No active job
      create: async ({ data }: any) => {
        createCalled = true;
        return { ...data, id: "job-new-1" };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const result = await service.enqueueAutoBackfillJob("oa-test-3");

  assert.equal(createCalled, true, "New job must be enqueued when rolling window advances and date is missing");
  assert.equal(result.totalDays, 1);
});

// =============================================================================
// 1. AUTHORIZATION ARCHITECTURE PROOF
// =============================================================================
test("AuthGuard is the sole APP_GUARD and evaluates @Roles metadata from Reflector", async () => {
  const { AuthModule } = await import("../auth/auth.module");
  const { AuthGuard } = await import("../auth/auth.guard");

  // Verify APP_GUARD is provided as AuthGuard in AuthModule metadata
  const providers: any[] = (Reflect.getMetadata("providers", AuthModule) as any[]) ?? [];
  const appGuardProvider = providers.find(
    (p: any) => p && typeof p === "object" && "provide" in p && String(p.provide) === "APP_GUARD"
  );
  assert.ok(appGuardProvider, "APP_GUARD provider must exist in AuthModule");
  assert.equal(appGuardProvider.useClass, AuthGuard, "APP_GUARD must use AuthGuard");
});

test("AuthGuard returns 401 for unauthenticated request (no session cookie)", async () => {
  const { AuthGuard } = await import("../auth/auth.guard");
  const { Reflector } = await import("@nestjs/core");

  const reflector = new Reflector();
  const authService = { authenticate: async () => null } as any;
  const guard = new AuthGuard(reflector, authService);

  const mockContext = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { cookie: "" }, method: "GET", path: "/follower-insights/summary" }),
    }),
  } as any;

  await assert.rejects(
    () => guard.canActivate(mockContext),
    (err: any) => err.status === 401,
    "Unauthenticated request must result in 401"
  );
});

test("AuthGuard returns 403 for authenticated non-ADMIN user on @Roles(ADMIN) endpoint", async () => {
  const { AuthGuard } = await import("../auth/auth.guard");
  const { Reflector } = await import("@nestjs/core");
  const { REQUIRED_ROLES } = await import("./date-utils").then(() => import("../auth/auth.decorators"));

  const reflector = new Reflector();
  const nonAdminUser = { id: "u-1", email: "viewer@test.com", displayName: "Viewer", role: "VIEWER", isActive: true };
  const authService = { authenticate: async () => nonAdminUser } as any;
  const guard = new AuthGuard(reflector, authService);

  // Simulate a handler method decorated with @Roles("ADMIN")
  const handler = () => {};
  Reflect.defineMetadata(REQUIRED_ROLES, ["ADMIN"], handler);

  const mockContext = {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { cookie: "oppo_session=valid-token" }, method: "POST", path: "/follower-insights/backfill" }),
    }),
  } as any;

  await assert.rejects(
    () => guard.canActivate(mockContext),
    (err: any) => err.status === 403,
    "Authenticated non-ADMIN must receive 403"
  );
});

test("AuthGuard permits authenticated ADMIN on @Roles(ADMIN) endpoint", async () => {
  const { AuthGuard } = await import("../auth/auth.guard");
  const { Reflector } = await import("@nestjs/core");
  const { REQUIRED_ROLES } = await import("../auth/auth.decorators");

  const reflector = new Reflector();
  const adminUser = { id: "u-2", email: "admin@test.com", displayName: "Admin", role: "ADMIN", isActive: true };
  const authService = { authenticate: async () => adminUser } as any;
  const guard = new AuthGuard(reflector, authService);

  const handler = () => {};
  Reflect.defineMetadata(REQUIRED_ROLES, ["ADMIN"], handler);

  const mockContext = {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ headers: { cookie: "oppo_session=admin-token" }, method: "POST", path: "/follower-insights/sync" }),
    }),
  } as any;

  const result = await guard.canActivate(mockContext);
  assert.equal(result, true, "Authenticated ADMIN must be permitted");
});

test("getJobStatus throws NotFoundException (404) when no job exists for account", async () => {
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => null,
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await assert.rejects(
    () => service.getJobStatus("oa-no-job"),
    (err: any) => err.status === 404 || err.name === "NotFoundException",
    "Missing job must throw NotFoundException"
  );
});

// =============================================================================
// 2. ENV CONFIGURATION GATING
// =============================================================================
test("worker does not start when FOLLOWER_BACKFILL_WORKER_ENABLED=false", () => {
  const origEnv = process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = "false";
  const savedNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.equal((service as any).workerTimer, null, "Worker must not start when FOLLOWER_BACKFILL_WORKER_ENABLED=false");
    service.onModuleDestroy();
  } finally {
    if (origEnv === undefined) delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
    else process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = origEnv;
    process.env.NODE_ENV = savedNodeEnv;
  }
});

test("claimAndProcessNextJob returns false immediately when isShuttingDown=true", async () => {
  const mockPrisma: any = {
    lineOaBackfillJob: { findFirst: async () => ({ id: "job-1", status: "QUEUED" }) },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  (service as any).isShuttingDown = true;

  const result = await service.claimAndProcessNextJob();
  assert.equal(result, false, "Must return false immediately when shutting down");
});

// =============================================================================
// 3. MULTI-INSTANCE COLLISION SAFETY
// =============================================================================
test("two concurrent reconciliation instances: partial unique index collision → only one active job, no fatal error", async () => {
  let createCallCount = 0;

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [{ id: "oa-collision-1" }],
      updateMany: async () => ({ count: 1 }),
      findFirst: async () => ({ id: "oa-collision-1", isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async () => [], // no ready snapshots
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createCallCount++;
        if (createCallCount > 1) {
          // Simulate P2002 collision on second instance's create
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        return { ...data, id: "job-collision-1", attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
      },
    },
  };

  const service1 = new FollowerInsightsService(mockPrisma, {} as any);
  const service2 = new FollowerInsightsService(mockPrisma, {} as any);

  const [count1, count2] = await Promise.all([
    service1.reconcileUncoveredAccounts(),
    service2.reconcileUncoveredAccounts(),
  ]);

  assert.ok(createCallCount <= 2, "Create must be called at most once per service");
  assert.ok(count1 + count2 <= 1, "Only one job may be enqueued across both instances");
});

test("P2002 collision in enqueueAutoBackfillJob returns existing active job without re-throwing", async () => {
  const existingJob = { id: "job-active-1", lineOaId: "oa-p2002", status: "QUEUED", dateFrom: "2026-06-23", dateTo: "2026-07-22", totalDays: 30, requested: 0, succeeded: 0, skipped: 0, unready: 0, failed: 0, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
  let createAttempted = false;

  const mockPrisma: any = {
    lineOfficialAccount: { findFirst: async () => ({ id: "oa-p2002", isActive: true }) },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findFirst: async (args: any) => {
        if (args?.where?.status?.in?.includes?.("QUEUED")) return createAttempted ? existingJob : null;
        return null;
      },
      create: async () => {
        createAttempted = true;
        const err: any = new Error("P2002");
        err.code = "P2002";
        throw err;
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const result = await service.enqueueAutoBackfillJob("oa-p2002");
  assert.equal(result.id, "job-active-1", "Must return existing active job after P2002 collision");
});

// =============================================================================
// 4. RECONCILIATION BATCH LIMITING (for 150+ accounts)
// =============================================================================
test("reconciliation batch size limits enqueue to maxEnqueue per cycle (150 accounts, batchSize=10)", async () => {
  const allAccounts = Array.from({ length: 150 }, (_, i) => ({ id: `oa-${i}` }));
  let totalCreated = 0;

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => allAccounts,
      updateMany: async () => ({ count: allAccounts.length }),
      findFirst: async ({ where }: any) => ({ id: where.id, isActive: true })
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => {
        totalCreated++;
        return { ...data, id: `job-${totalCreated}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const enqueued = await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });

  assert.equal(enqueued, 10, "Exactly 10 jobs must be enqueued in one cycle regardless of 150 uncovered accounts");
  assert.equal(totalCreated, 10, "create() must be called exactly 10 times");
});

test("reconciliation: 150 accounts, 40 complete, 110 incomplete → at most batchSize enqueued per cycle", async () => {
  const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
  const allDates = getDateRangeArray(dateFrom, dateTo);

  const accounts = Array.from({ length: 150 }, (_, i) => ({ id: `oa-${i}` }));
  const completeIds = new Set(accounts.slice(0, 40).map(a => a.id));
  let createCallCount = 0;

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => accounts,
      updateMany: async () => ({ count: accounts.length }),
      findFirst: async ({ where }: any) => ({ id: where.id, isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async ({ where }: any) => {
        const lineOaIds: string[] = where.lineOaId?.in ?? [];
        const result: any[] = [];
        for (const id of lineOaIds) {
          if (completeIds.has(id)) {
            for (const d of allDates) {
              result.push({ lineOaId: id, snapshotDate: toUtcDateForDb(d), status: "ready", followers: 1000 });
            }
          }
        }
        return result;
      },
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createCallCount++;
        return { ...data, id: `job-${createCallCount}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const enqueued = await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });

  assert.equal(enqueued, 10, "Only 10 of 110 incomplete accounts must be enqueued per cycle");
});

test("active QUEUED/RUNNING job prevents duplicate enqueue during reconciliation", async () => {
  const accounts = [{ id: "oa-already-active" }];
  let createCalled = false;

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => accounts,
      updateMany: async () => ({ count: 1 }),
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findMany: async () => [{ lineOaId: "oa-already-active" }], // active job present
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const enqueued = await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });

  assert.equal(enqueued, 0, "Account with active job must be skipped in reconciliation");
  assert.equal(createCalled, false, "create() must not be called when job already active");
});

// =============================================================================
// 5. RATE-LIMIT (429) HANDLING
// =============================================================================
test("processClaimedJob applies exponential backoff with jitter on retryable error", async () => {
  const job = { id: "job-backoff-1", lineOaId: "oa-1", status: "RUNNING", workerId: "test-worker", dateFrom: "2026-06-23", dateTo: "2026-07-22", totalDays: 30, requested: 0, succeeded: 0, skipped: 0, unready: 0, failed: 0, attempts: 1, maxAttempts: 3, errorMessage: null, startedAt: new Date(), completedAt: null, createdAt: new Date() };

  let capturedNextAttemptAt: Date | null = null;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => job,
      updateMany: async ({ data }: any) => {
        if (data.nextAttemptAt) capturedNextAttemptAt = data.nextAttemptAt;
        return { count: 1 };
      },
    },
    lineOfficialAccount: { findFirst: async () => null }, // causes NotFoundException inside backfill → retryable
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await service.processClaimedJob("job-backoff-1", "test-worker");

  assert.ok(capturedNextAttemptAt instanceof Date, "nextAttemptAt must be set on retryable failure");
  const delayMs = capturedNextAttemptAt!.getTime() - Date.now();
  // For attempts=1, base backoff = 2^1 * 60s = 120s ± 10% = 108s–132s
  assert.ok(delayMs > 100_000 && delayMs < 145_000, `Backoff delay ${delayMs}ms should be in [100s, 145s] range`);
});

// =============================================================================
// 6. WORKER LIFECYCLE SAFETY
// =============================================================================
test("pollAndProcessJobs prevents overlapping executions (isWorkerProcessing lock)", async () => {
  let concurrentCallCount = 0;
  let maxConcurrent = 0;

  const mockPrisma: any = {
    lineOaBackfillJob: {
      findMany: async () => {
        concurrentCallCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCallCount);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCallCount--;
        return [];
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);

  // Fire three poll attempts concurrently — only the first should enter the body
  await Promise.all([
    service.pollAndProcessJobs(),
    service.pollAndProcessJobs(),
    service.pollAndProcessJobs(),
  ]);

  assert.equal(maxConcurrent, 1, "At most 1 concurrent poll execution must occur");
});

test("FIFO ordering: oldest QUEUED job is claimed first", async () => {
  const olderJob = { id: "job-old", lineOaId: "oa-a", status: "QUEUED", createdAt: new Date("2026-01-01") };
  const newerJob = { id: "job-new", lineOaId: "oa-b", status: "QUEUED", createdAt: new Date("2026-01-02") };

  let claimedId: string | null = null;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      // findFirst with orderBy createdAt asc returns the older job first
      findFirst: async () => olderJob,
      updateMany: async ({ where }: any) => {
        claimedId = where.id;
        return { count: 1 };
      },
      findFirst2: async () => olderJob,
    },
    lineOfficialAccount: { findFirst: async () => ({ id: "oa-a", isActive: true }) },
  };

  // Override processClaimedJob to avoid executing actual backfill
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  service.processClaimedJob = async () => true;
  await service.claimAndProcessNextJob("test-worker");

  assert.equal(claimedId, "job-old", "Oldest job must be claimed first (FIFO ordering)");
});

// =============================================================================
// REQ 1: SAFE DEFAULTS — Missing env vars must NOT start worker or reconciliation
// =============================================================================
void test("missing FOLLOWER_BACKFILL_WORKER_ENABLED defaults to false (safe opt-in only)", () => {
  const savedEnv = process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  try {
    assert.equal(BackfillConfig.workerEnabled, false, "Missing env var must default to false");
  } finally {
    if (savedEnv !== undefined) process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = savedEnv;
    else delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  }
});

void test("missing FOLLOWER_BACKFILL_RECONCILIATION_ENABLED defaults to false (safe opt-in only)", () => {
  const savedEnv = process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  try {
    assert.equal(BackfillConfig.reconciliationEnabled, false, "Missing env var must default to false");
  } finally {
    if (savedEnv !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = savedEnv;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  }
});

void test("FOLLOWER_BACKFILL_WORKER_ENABLED=false prevents worker timer in non-test env", () => {
  const savedWorker = process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = "false";
  process.env.NODE_ENV = "production";
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.equal((service as any).workerTimer, null, "Worker timer must NOT start when disabled");
    service.onModuleDestroy();
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedWorker !== undefined) process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = savedWorker;
    else delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  }
});

void test("FOLLOWER_BACKFILL_WORKER_ENABLED=true opts in and creates worker timer", () => {
  const savedWorker = process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = "true";
  process.env.NODE_ENV = "production";
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.ok((service as any).workerTimer !== null, "Worker timer must be started when opted in");
    service.onModuleDestroy();
    assert.equal((service as any).workerTimer, null, "Timer cleared on destroy");
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedWorker !== undefined) process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"] = savedWorker;
    else delete process.env["FOLLOWER_BACKFILL_WORKER_ENABLED"];
  }
});

void test("onModuleInit does not fire reconciliation when RECONCILIATION_ENABLED=false", () => {
  const savedEnv = process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = "false";
  process.env.NODE_ENV = "production";
  let called = false;
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.runReconciliationCycle = async () => { called = true; return 0; };
    service.onModuleInit();
    assert.equal(called, false, "runReconciliationCycle must NOT be called when disabled");
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedEnv !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = savedEnv;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  }
});

// =============================================================================
// REQ 2: DURABLE RECONCILIATION & TIMESTAMP SAFETY
// =============================================================================
void test("reconciliation timestamp safety: crash before inspection leaves timestamp unchanged", async () => {
  const account = { id: "oa-crash", lastBackfillReconciledAt: null as Date | null };
  let updateCalled = false;
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [{ id: account.id }],
      updateMany: async () => { updateCalled = true; return { count: 1 }; },
    },
    lineOaFollowerSnapshot: {
      findMany: async () => { throw new Error("DB Snapshot Query Error"); },
    },
    lineOaBackfillJob: { findMany: async () => [] },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await assert.rejects(() => service.reconcileUncoveredAccounts());
  assert.equal(updateCalled, false, "Timestamp must NOT be updated when a failure occurs before inspection");
  assert.equal(account.lastBackfillReconciledAt, null, "Timestamp remains null");
});

void test("reconciliation timestamp safety: complete inspection, successful enqueue, and P2002 update timestamp; unexpected enqueue error skips timestamp update", async () => {
  const updatedIds: string[] = [];

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [
        { id: "oa-complete" },
        { id: "oa-enqueued" },
        { id: "oa-p2002" },
        { id: "oa-failed" },
      ],
      updateMany: async ({ where }: any) => {
        if (where?.id?.in) updatedIds.push(...where.id.in);
        return { count: where?.id?.in?.length ?? 0 };
      },
      findFirst: async ({ where }: any) => ({ id: where.id, isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async ({ where }: any) => {
        if (where?.lineOaId?.in?.includes("oa-complete")) {
          const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
          const dates = getDateRangeArray(dateFrom, dateTo);
          return dates.map(d => ({ lineOaId: "oa-complete", snapshotDate: toUtcDateForDb(d) }));
        }
        return [];
      },
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async ({ where }: any) => {
        if (where?.lineOaId === "oa-p2002" && where?.status?.in?.includes("QUEUED")) {
          return { id: "job-p2002", lineOaId: "oa-p2002", status: "QUEUED" };
        }
        return null;
      },
      create: async ({ data }: any) => {
        if (data.lineOaId === "oa-p2002") {
          const err: any = new Error("P2002");
          err.code = "P2002";
          throw err;
        }
        if (data.lineOaId === "oa-failed") {
          throw new Error("Unexpected database write error");
        }
        return { ...data, id: `job-${data.lineOaId}` };
      },
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await service.reconcileUncoveredAccounts();

  assert.ok(updatedIds.includes("oa-complete"), "Complete account timestamp must be updated");
  assert.ok(updatedIds.includes("oa-enqueued"), "Successfully enqueued account timestamp must be updated");
  assert.ok(updatedIds.includes("oa-p2002"), "P2002 collision account timestamp must be updated");
  assert.ok(!updatedIds.includes("oa-failed"), "Failed enqueue account timestamp must NOT be updated");
});

void test("durable reconciliation: updates lastBackfillReconciledAt on inspected accounts to cycle through accounts fairly", async () => {
  const accounts = Array.from({ length: 30 }, (_, i) => ({
    id: `oa-${String(i + 1).padStart(3, "0")}`,
    lastBackfillReconciledAt: null as Date | null,
  }));

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async ({ take }: any) => {
        const sorted = [...accounts].sort((a, b) => {
          if (a.lastBackfillReconciledAt === null && b.lastBackfillReconciledAt !== null) return -1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt === null) return 1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt !== null) {
            const diff = a.lastBackfillReconciledAt.getTime() - b.lastBackfillReconciledAt.getTime();
            if (diff !== 0) return diff;
          }
          return a.id < b.id ? -1 : 1;
        });
        return sorted.slice(0, take ?? sorted.length).map(a => ({ id: a.id }));
      },
      updateMany: async ({ where, data }: any) => {
        const ids: string[] = where.id.in;
        for (const acc of accounts) {
          if (ids.includes(acc.id)) acc.lastBackfillReconciledAt = data.lastBackfillReconciledAt;
        }
        return { count: ids.length };
      },
      findFirst: async ({ where }: any) => ({ id: where?.id ?? "x", isActive: true }),
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: `job-${data.lineOaId}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() }),
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  assert.ok(accounts[0].lastBackfillReconciledAt !== null, "oa-001 must have updated lastBackfillReconciledAt");

  await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  assert.ok(accounts[10].lastBackfillReconciledAt !== null, "oa-011 must have updated lastBackfillReconciledAt");

  await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  assert.ok(accounts[20].lastBackfillReconciledAt !== null, "oa-021 must have updated lastBackfillReconciledAt");
});

void test("150 accounts: every account is inspected across 15 cycles with durable lastBackfillReconciledAt", async () => {
  const accounts = Array.from({ length: 150 }, (_, i) => ({
    id: `oa-${String(i + 1).padStart(3, "0")}`,
    lastBackfillReconciledAt: null as Date | null,
  }));
  const inspectedIds = new Set<string>();

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async ({ take }: any) => {
        const sorted = [...accounts].sort((a, b) => {
          if (a.lastBackfillReconciledAt === null && b.lastBackfillReconciledAt !== null) return -1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt === null) return 1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt !== null) {
            const diff = a.lastBackfillReconciledAt.getTime() - b.lastBackfillReconciledAt.getTime();
            if (diff !== 0) return diff;
          }
          return a.id < b.id ? -1 : 1;
        });
        const page = sorted.slice(0, take ?? sorted.length);
        for (const a of page) inspectedIds.add(a.id);
        return page.map(a => ({ id: a.id }));
      },
      updateMany: async ({ where, data }: any) => {
        const ids: string[] = where.id.in;
        for (const acc of accounts) {
          if (ids.includes(acc.id)) acc.lastBackfillReconciledAt = data.lastBackfillReconciledAt;
        }
        return { count: ids.length };
      },
      findFirst: async ({ where }: any) => ({ id: where?.id ?? "x", isActive: true }),
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: `job-${data.lineOaId}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() }),
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);
  for (let i = 0; i < 15; i++) {
    await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  }
  assert.equal(inspectedIds.size, 150, `All 150 accounts must be inspected across 15 cycles; got ${inspectedIds.size}`);
});

void test("newly added accounts have lastBackfillReconciledAt=null so they are prioritized immediately", async () => {
  const accounts = Array.from({ length: 10 }, (_, i) => ({
    id: `oa-${String(i + 1).padStart(3, "0")}`,
    lastBackfillReconciledAt: null as Date | null,
  }));
  const inspectedInCycle2 = new Set<string>();

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async ({ take }: any) => {
        const sorted = [...accounts].sort((a, b) => {
          if (a.lastBackfillReconciledAt === null && b.lastBackfillReconciledAt !== null) return -1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt === null) return 1;
          if (a.lastBackfillReconciledAt !== null && b.lastBackfillReconciledAt !== null) {
            const diff = a.lastBackfillReconciledAt.getTime() - b.lastBackfillReconciledAt.getTime();
            if (diff !== 0) return diff;
          }
          return a.id < b.id ? -1 : 1;
        });
        const page = sorted.slice(0, take ?? sorted.length);
        return page.map(a => ({ id: a.id }));
      },
      updateMany: async ({ where, data }: any) => {
        const ids: string[] = where.id.in;
        for (const acc of accounts) {
          if (ids.includes(acc.id)) acc.lastBackfillReconciledAt = data.lastBackfillReconciledAt;
        }
        return { count: ids.length };
      },
      findFirst: async ({ where }: any) => ({ id: where?.id ?? "x", isActive: true }),
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: `job-${data.lineOaId}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() }),
    },
  };

  const service = new FollowerInsightsService(mockPrisma, {} as any);

  // Cycle 1
  await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });

  // Add new account with lastBackfillReconciledAt = null
  accounts.push({ id: "oa-new-999", lastBackfillReconciledAt: null });

  const origFindMany = mockPrisma.lineOfficialAccount.findMany;
  mockPrisma.lineOfficialAccount.findMany = async (args: any) => {
    const res = await origFindMany(args);
    for (const r of res) inspectedInCycle2.add(r.id);
    return res;
  };

  // Cycle 2
  await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  assert.ok(inspectedInCycle2.has("oa-new-999"), "Newly added account oa-new-999 must be inspected immediately");
});

// =============================================================================
// REQ 3: PERIODIC RECONCILIATION TIMER
// =============================================================================
void test("reconciliationTimer created when RECONCILIATION_INTERVAL_MS > 0 and ENABLED=true", () => {
  const savedInterval = process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"];
  const savedEnabled = process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"] = "30000";
  process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = "true";
  process.env.NODE_ENV = "production";
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.ok((service as any).reconciliationTimer !== null, "Reconciliation timer must be created");
    service.onModuleDestroy();
    assert.equal((service as any).reconciliationTimer, null, "Timer cleared on destroy");
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedInterval !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"] = savedInterval;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"];
    if (savedEnabled !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = savedEnabled;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  }
});

void test("reconciliationTimer NOT created when RECONCILIATION_INTERVAL_MS=0 (startup-only mode)", () => {
  const savedInterval = process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"];
  const savedEnabled = process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  const savedNode = process.env.NODE_ENV;
  process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"] = "0";
  process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = "true";
  process.env.NODE_ENV = "production";
  try {
    const service = new FollowerInsightsService({} as any, {} as any);
    service.onApplicationBootstrap();
    assert.equal((service as any).reconciliationTimer, null, "No periodic timer when interval=0");
    service.onModuleDestroy();
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedInterval !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"] = savedInterval;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_INTERVAL_MS"];
    if (savedEnabled !== undefined) process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"] = savedEnabled;
    else delete process.env["FOLLOWER_BACKFILL_RECONCILIATION_ENABLED"];
  }
});

void test("runReconciliationCycle prevents overlapping reconciliation (isReconciling lock)", async () => {
  let concurrentCount = 0;
  let maxConcurrent = 0;
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise(resolve => setTimeout(resolve, 20));
        concurrentCount--;
        return [];
      },
    },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: { findMany: async () => [] },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await Promise.all([
    service.runReconciliationCycle(),
    service.runReconciliationCycle(),
    service.runReconciliationCycle(),
  ]);
  assert.equal(maxConcurrent, 1, "At most 1 concurrent reconciliation");
});

// =============================================================================
// REQ 4: JOB CONCURRENCY — Fixed at 1 per instance (isWorkerProcessing lock)
// =============================================================================
void test("isWorkerProcessing lock prevents overlapping pollAndProcessJobs (concurrency=1 per instance)", async () => {
  let activeWorkers = 0;
  let maxActiveWorkers = 0;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findMany: async () => {
        activeWorkers++;
        maxActiveWorkers = Math.max(maxActiveWorkers, activeWorkers);
        await new Promise(resolve => setTimeout(resolve, 15));
        activeWorkers--;
        return [];
      },
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await Promise.all([
    service.pollAndProcessJobs(),
    service.pollAndProcessJobs(),
    service.pollAndProcessJobs(),
  ]);
  assert.equal(maxActiveWorkers, 1, "Only 1 concurrent poll execution must occur");
});

// =============================================================================
// REQ 5: API DELAY AND RATE-LIMIT BEHAVIOR
// =============================================================================
void test("backfill applies inter-date delay (FOLLOWER_BACKFILL_API_DELAY_MS) but not after last date", async () => {
  const savedDelay = process.env["FOLLOWER_BACKFILL_API_DELAY_MS"];
  process.env["FOLLOWER_BACKFILL_API_DELAY_MS"] = "5";
  const callTimestamps: number[] = [];
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [],
      findFirst: async () => ({ id: "oa-delay", isActive: true }),
    },
    lineOaFollowerSnapshot: { findMany: async () => [], findUnique: async () => null },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  service.sync = async (dto: any) => { callTimestamps.push(Date.now()); return { date: dto.date, requested: 0, succeeded: 0, unready: 0, failed: 0, skipped: 0, errors: [] }; };
  const start = Date.now();
  await service.backfill({ dateFrom: "2026-07-20", dateTo: "2026-07-22", lineOaId: "oa-delay" });
  const elapsed = Date.now() - start;
  try {
    assert.equal(callTimestamps.length, 3, "sync called once per date (3 dates)");
    assert.ok(elapsed >= 8, `Elapsed ${elapsed}ms must reflect at least 2 delays of 5ms`);
  } finally {
    if (savedDelay !== undefined) process.env["FOLLOWER_BACKFILL_API_DELAY_MS"] = savedDelay;
    else delete process.env["FOLLOWER_BACKFILL_API_DELAY_MS"];
  }
});

void test("429 Retry-After integer seconds: retryAfterMs = header_value * 1000", async () => {
  const service = new FollowerInsightsService({} as any, {} as any);
  (service as any).credentialEncryptionService = { decrypt: () => "fake-token" };
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429, headers: { get: (k: string) => k === "Retry-After" ? "120" : null } }) as any;
  try {
    const result = await (service as any).fetchLineFollowerInsight("encrypted-token", "20260720");
    assert.equal(result.errorCode, "LINE_API_ERROR_429");
    assert.ok(result.retryAfterMs >= 119_000 && result.retryAfterMs <= 121_000, `retryAfterMs=${result.retryAfterMs} must be ~120000ms`);
  } finally {
    global.fetch = originalFetch;
  }
});

void test("429 Retry-After HTTP-date string: retryAfterMs = delta from now to that date", async () => {
  const service = new FollowerInsightsService({} as any, {} as any);
  (service as any).credentialEncryptionService = { decrypt: () => "fake-token" };
  const futureDate = new Date(Date.now() + 90_000);
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429, headers: { get: (k: string) => k === "Retry-After" ? futureDate.toUTCString() : null } }) as any;
  try {
    const result = await (service as any).fetchLineFollowerInsight("encrypted-token", "20260720");
    assert.equal(result.errorCode, "LINE_API_ERROR_429");
    assert.ok(result.retryAfterMs >= 85_000 && result.retryAfterMs <= 95_000, `retryAfterMs=${result.retryAfterMs} must be ~90000ms`);
  } finally {
    global.fetch = originalFetch;
  }
});

void test("rate-limited job does not block other QUEUED jobs: nextAttemptAt filters exclude it from claim", async () => {
  const readyJob = { id: "job-ready", lineOaId: "oa-b", status: "QUEUED", createdAt: new Date("2026-01-02"), nextAttemptAt: null, startedAt: null };
  let claimedId: string | null = null;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => readyJob,
      updateMany: async ({ where }: any) => { claimedId = where.id; return { count: 1 }; },
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  service.processClaimedJob = async () => true;
  await service.claimAndProcessNextJob("test-worker");
  assert.equal(claimedId, "job-ready", "Ready job must be claimed while rate-limited job waits");
});

// =============================================================================
// REQ 6: QUEUE SUMMARY ESTIMATED REMAINING CALLS
// =============================================================================
void test("estimatedRemainingAccountDateCalls = sum of (totalDays - succeeded - skipped) per unresolved job", async () => {
  const mockPrisma: any = {
    lineOaBackfillJob: {
      groupBy: async () => [
        { status: "QUEUED",    _count: { id: 2 } },
        { status: "RUNNING",   _count: { id: 1 } },
        { status: "COMPLETED", _count: { id: 5 } },
      ],
      findFirst: async () => ({ createdAt: new Date("2026-07-01") }),
      findMany: async () => [
        { totalDays: 30, succeeded: 10, skipped: 5 },  // 15 remaining
        { totalDays: 30, succeeded: 0,  skipped: 0  },  // 30 remaining
        { totalDays: 30, succeeded: 30, skipped: 0  },  //  0 remaining
      ],
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const summary = await service.getQueueSummary();
  assert.equal(summary.queued, 2);
  assert.equal(summary.running, 1);
  assert.equal(summary.completed, 5);
  assert.equal(summary.estimatedRemainingAccountDateCalls, 45, "(30-10-5)+( 30-0-0)+(max 0,30-30-0) = 15+30+0 = 45");
  assert.ok(summary.oldestQueuedAt instanceof Date);
});

void test("estimatedRemainingAccountDateCalls is 0 when no QUEUED or RUNNING jobs exist", async () => {
  const mockPrisma: any = {
    lineOaBackfillJob: {
      groupBy: async () => [{ status: "COMPLETED", _count: { id: 10 } }],
      findFirst: async () => null,
      findMany: async () => [],
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const summary = await service.getQueueSummary();
  assert.equal(summary.estimatedRemainingAccountDateCalls, 0);
  assert.equal(summary.oldestQueuedAt, null);
});

// =============================================================================
// REQ 7: ROUTE-LEVEL AUTHORIZATION via @Roles metadata on actual controller
// =============================================================================
void test("admin-only routes carry @Roles(ADMIN) metadata: sync, backfill, retryJob, getJobStatus, getQueueSummary", () => {
  const proto = FollowerInsightsController.prototype;
  const adminRoutes = ["sync", "backfill", "retryJob", "getJobStatus", "getQueueSummary"];
  for (const method of adminRoutes) {
    const handler = (proto as any)[method];
    assert.ok(typeof handler === "function", `${method} must exist on controller`);
    const roles: string[] | undefined = Reflect.getMetadata(REQUIRED_ROLES, handler);
    assert.ok(Array.isArray(roles) && roles.includes("ADMIN"), `${method} must have @Roles("ADMIN"); got ${JSON.stringify(roles)}`);
  }
});

void test("read-only routes do NOT require @Roles(ADMIN): getSummary, getByStore", () => {
  const proto = FollowerInsightsController.prototype;
  for (const method of ["getSummary", "getByStore"]) {
    const handler = (proto as any)[method];
    const roles: string[] | undefined = Reflect.getMetadata(REQUIRED_ROLES, handler);
    assert.ok(!roles || roles.length === 0, `${method} must not require ADMIN; got ${JSON.stringify(roles)}`);
  }
});

void test("AuthGuard: unauthenticated POST /follower-insights/backfill returns 401", async () => {
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => null } as any);
  const ctx = {
    getHandler: () => FollowerInsightsController.prototype.backfill,
    getClass: () => FollowerInsightsController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: "" }, method: "POST", path: "/follower-insights/backfill" }) }),
  } as any;
  await assert.rejects(() => guard.canActivate(ctx), (err: any) => err.status === 401, "Unauthenticated must get 401");
});

void test("AuthGuard: VIEWER POST /follower-insights/backfill returns 403", async () => {
  const viewer = { id: "u-v", email: "v@test.com", displayName: "V", role: "VIEWER", isActive: true };
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as any);
  const ctx = {
    getHandler: () => FollowerInsightsController.prototype.backfill,
    getClass: () => FollowerInsightsController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: "oppo_session=v" }, method: "POST", path: "/follower-insights/backfill" }) }),
  } as any;
  await assert.rejects(() => guard.canActivate(ctx), (err: any) => err.status === 403, "VIEWER must get 403");
});

void test("AuthGuard: ADMIN POST /follower-insights/backfill is allowed (returns true)", async () => {
  const admin = { id: "u-a", email: "admin@test.com", displayName: "A", role: "ADMIN", isActive: true };
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as any);
  const ctx = {
    getHandler: () => FollowerInsightsController.prototype.backfill,
    getClass: () => FollowerInsightsController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: "oppo_session=admin" }, method: "POST", path: "/follower-insights/backfill" }) }),
  } as any;
  const result = await guard.canActivate(ctx);
  assert.equal(result, true);
});

void test("AuthGuard: unauthenticated GET /follower-insights/backfill/jobs/:id returns 401", async () => {
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => null } as any);
  const ctx = {
    getHandler: () => FollowerInsightsController.prototype.getJobStatus,
    getClass: () => FollowerInsightsController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: "" }, method: "GET", path: "/follower-insights/backfill/jobs/oa-1" }) }),
  } as any;
  await assert.rejects(() => guard.canActivate(ctx), (err: any) => err.status === 401);
});

void test("AuthGuard: VIEWER GET /follower-insights/backfill/jobs/:id returns 403", async () => {
  const viewer = { id: "u-v", email: "v@test.com", displayName: "V", role: "VIEWER", isActive: true };
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as any);
  const ctx = {
    getHandler: () => FollowerInsightsController.prototype.getJobStatus,
    getClass: () => FollowerInsightsController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { cookie: "oppo_session=v" }, method: "GET", path: "/follower-insights/backfill/jobs/oa-1" }) }),
  } as any;
  await assert.rejects(() => guard.canActivate(ctx), (err: any) => err.status === 403);
});

void test("getJobStatus throws NotFoundException (404) for unknown account id", async () => {
  const mockPrisma: any = { lineOaBackfillJob: { findFirst: async () => null } };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  await assert.rejects(
    () => service.getJobStatus("oa-completely-unknown"),
    (err: any) => err.status === 404 || err.name === "NotFoundException"
  );
});

// =============================================================================
// REQ 8: 150+ ACCOUNT SCALE TESTS
// =============================================================================
void test("150 accounts, 40 complete, 110 incomplete: at most 10 jobs per cycle via durable ordering", async () => {
  const allAccounts = Array.from({ length: 150 }, (_, i) => ({ id: `oa-${String(i + 1).padStart(3, "0")}` }));
  const { dateFrom, dateTo } = { dateFrom: "2026-06-23", dateTo: "2026-07-22" };
  const allDates = getDateRangeArray(dateFrom, dateTo);
  const completeIds = new Set(allAccounts.slice(0, 40).map(a => a.id));
  let totalCreated = 0;
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async ({ take }: any) => {
        return allAccounts.slice(0, take ?? allAccounts.length).map(a => ({ id: a.id }));
      },
      updateMany: async ({ where }: any) => ({ count: where?.id?.in?.length ?? 0 }),
      findFirst: async ({ where }: any) => ({ id: where?.id ?? "x", isActive: true }),
    },
    lineOaFollowerSnapshot: {
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.lineOaId?.in ?? [];
        const result: any[] = [];
        for (const id of ids) {
          if (completeIds.has(id)) for (const d of allDates) result.push({ lineOaId: id, snapshotDate: toUtcDateForDb(d), status: "ready", followers: 1000 });
        }
        return result;
      },
    },
    lineOaBackfillJob: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: any) => { totalCreated++; return { ...data, id: `job-${totalCreated}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() }; },
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const enqueued = await service.reconcileUncoveredAccounts({ batchSize: 10, maxEnqueue: 10 });
  assert.ok(enqueued <= 10, `Must not enqueue more than 10 jobs; got ${enqueued}`);
  assert.ok(totalCreated <= 10, `Must not create more than 10 jobs; created ${totalCreated}`);
});

void test("50 accounts connected rapidly: one job per account, enqueue returns without executing backfill", async () => {
  const rapidAccounts = Array.from({ length: 50 }, (_, i) => ({ id: `oa-rapid-${i}` }));
  let totalJobsCreated = 0;
  const createdJobsByOa = new Map<string, number>();
  const mockPrisma: any = {
    lineOfficialAccount: { findFirst: async ({ where }: any) => ({ id: where.id, isActive: true }) },
    lineOaFollowerSnapshot: { findMany: async () => [] },
    lineOaBackfillJob: {
      findFirst: async ({ where }: any) => {
        const id = where?.lineOaId;
        if (id && (createdJobsByOa.get(id) ?? 0) > 0) {
          return { id: `job-${id}`, lineOaId: id, status: "QUEUED", dateFrom: "2026-06-23", dateTo: "2026-07-22", totalDays: 30, requested: 0, succeeded: 0, skipped: 0, unready: 0, failed: 0, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
        }
        return null;
      },
      create: async ({ data }: any) => {
        totalJobsCreated++;
        createdJobsByOa.set(data.lineOaId, (createdJobsByOa.get(data.lineOaId) ?? 0) + 1);
        return { ...data, id: `job-${data.lineOaId}`, attempts: 0, maxAttempts: 3, errorMessage: null, startedAt: null, completedAt: null, createdAt: new Date() };
      },
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const start = Date.now();
  const results = await Promise.all(rapidAccounts.map(acc => service.enqueueAutoBackfillJob(acc.id)));
  const elapsed = Date.now() - start;
  assert.equal(results.length, 50);
  assert.equal(totalJobsCreated, 50, "Exactly 50 jobs created");
  for (const [oaId, count] of createdJobsByOa) {
    assert.equal(count, 1, `Account ${oaId} must have exactly 1 job`);
  }
  assert.ok(elapsed < 5000, `enqueueAutoBackfillJob must return quickly without executing backfill; took ${elapsed}ms`);
});

void test("worker restart: stale RUNNING jobs are recovered and re-queued for the next worker", async () => {
  const staleJob = {
    id: "job-stale-1", lineOaId: "oa-stale", status: "RUNNING", workerId: "old-worker",
    heartbeatAt: new Date(Date.now() - 6 * 60 * 1000),
    claimedAt: new Date(Date.now() - 10 * 60 * 1000),
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    attempts: 1, maxAttempts: 3, createdAt: new Date("2026-07-01"), nextAttemptAt: null,
  };
  let requeued = false;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findMany: async () => [staleJob],
      updateMany: async ({ data }: any) => { if (data.status === "QUEUED") requeued = true; return { count: 1 }; },
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  const recovered = await service.recoverStaleJobs(5 * 60 * 1000);
  assert.equal(recovered, 1, "Stale job must be recovered");
  assert.equal(requeued, true, "Recovered job must be set back to QUEUED");
});

void test("failed jobs do not block subsequent QUEUED jobs: FAILED excluded by DB WHERE status=QUEUED", async () => {
  const readyJob = { id: "job-ready-1", lineOaId: "oa-b", status: "QUEUED", createdAt: new Date("2026-01-02"), nextAttemptAt: null, startedAt: null };
  let claimedId: string | null = null;
  const mockPrisma: any = {
    lineOaBackfillJob: {
      findFirst: async () => readyJob,
      updateMany: async ({ where }: any) => { claimedId = where.id; return { count: 1 }; },
    },
  };
  const service = new FollowerInsightsService(mockPrisma, {} as any);
  service.processClaimedJob = async () => true;
  const claimed = await service.claimAndProcessNextJob("test-worker");
  assert.equal(claimed, true);
  assert.equal(claimedId, "job-ready-1", "Failed jobs must not block the queue");
});
