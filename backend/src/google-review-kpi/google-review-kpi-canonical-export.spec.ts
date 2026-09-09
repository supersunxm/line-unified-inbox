import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { GoogleReviewKpiController } from "./google-review-kpi.controller";
import { LOCKED_WEEKLY_KPI_STORE_CODES } from "./google-review-kpi.dto";
import type { GoogleReviewKpiService } from "./google-review-kpi.service";

type FakeResponse = {
  headers: Record<string, string | number>;
  endedWith: Buffer | null;
  setHeader(name: string, value: string | number): void;
  end(buffer: Buffer): void;
};

function response(): FakeResponse {
  return {
    headers: {},
    endedWith: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(buffer) {
      this.endedWith = buffer;
    },
  };
}

function canonicalWeeklyStores() {
  return LOCKED_WEEKLY_KPI_STORE_CODES.map((storeCode, index) => ({
    id: `membership-${index}`,
    storeCode,
    storeId: `internal-${index}`,
    storeName: `Store ${storeCode}`,
    region: "Central",
    province: "Bangkok",
    googleMapsUrl: `https://maps.example/${storeCode}`,
    hasGoogleMaps: true,
    isActive: true,
    effectiveFrom: "2026-08-26T00:00:00.000Z",
    effectiveTo: null,
  }));
}

test("Google Review download verifies canonical Store IDs without running a mutating sync", async () => {
  const calls: string[] = [];
  const service = {
    getWeeklyStores: async () => {
      calls.push("verify");
      return canonicalWeeklyStores();
    },
    syncWeeklyStoreMemberships: async () => {
      calls.push("sync");
      throw new Error("download must not mutate weekly membership state");
    },
    exportWeeklyLeaderboard: async () => {
      calls.push("export");
      return {
        buffer: Buffer.from("canonical"),
        filename: "google-review.csv",
        contentType: "text/csv; charset=utf-8",
      };
    },
  } as unknown as GoogleReviewKpiService;

  const controller = new GoogleReviewKpiController(service);
  const res = response();
  await controller.exportWeeklyLeaderboard({ format: "csv" }, res as any);

  assert.deepEqual(calls, ["verify", "export"]);
  assert.equal(res.endedWith?.toString("utf8"), "canonical");
});

test("Google Review download fails closed when a canonical Store ID is missing", async () => {
  let exportCalled = false;
  const missingCode = LOCKED_WEEKLY_KPI_STORE_CODES[0];
  const service = {
    getWeeklyStores: async () => canonicalWeeklyStores().filter((store) => store.storeCode !== missingCode),
    exportWeeklyLeaderboard: async () => {
      exportCalled = true;
      return {
        buffer: Buffer.from("must-not-export"),
        filename: "google-review.csv",
        contentType: "text/csv; charset=utf-8",
      };
    },
  } as unknown as GoogleReviewKpiService;

  const controller = new GoogleReviewKpiController(service);
  await assert.rejects(
    controller.exportWeeklyLeaderboard({ format: "csv" }, response() as any),
    new RegExp(`Canonical Store ID verification failed.*missing=${missingCode}`),
  );
  assert.equal(exportCalled, false);
});

test("Google Review download fails closed on duplicate or unexpected Store IDs", async () => {
  const stores = canonicalWeeklyStores();
  stores.push({ ...stores[0], id: "duplicate-membership" });
  stores.push({ ...stores[0], id: "unexpected-membership", storeCode: "999999" });

  const service = {
    getWeeklyStores: async () => stores,
    exportWeeklyLeaderboard: async () => {
      throw new Error("export should not run");
    },
  } as unknown as GoogleReviewKpiService;

  const controller = new GoogleReviewKpiController(service);
  await assert.rejects(
    controller.exportWeeklyLeaderboard({ format: "xlsx" }, response() as any),
    /unexpected=999999.*duplicates=/,
  );
});
