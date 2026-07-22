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
import { FollowerInsightsService } from "./follower-insights.service";

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
