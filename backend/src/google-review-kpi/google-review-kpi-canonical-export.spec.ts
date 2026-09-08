import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { GoogleReviewKpiController } from "./google-review-kpi.controller";
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

test("Google Review download synchronizes StoreMaster identity before generating the export", async () => {
  const calls: string[] = [];
  const service = {
    syncWeeklyStoreMemberships: async () => {
      calls.push("sync");
      return {
        expectedStoreCount: 65,
        matchedStoreMasterCount: 65,
        unmatchedStoreCodes: [],
        duplicateMappings: 0,
        storesMissingGoogleMapsUrl: [],
        syncedMembershipsCount: 65,
      };
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

  assert.deepEqual(calls, ["sync", "export"]);
  assert.equal(res.endedWith?.toString("utf8"), "canonical");
});

test("Google Review download fails closed when a Store ID is missing from StoreMaster", async () => {
  let exportCalled = false;
  const service = {
    syncWeeklyStoreMemberships: async () => ({
      expectedStoreCount: 65,
      matchedStoreMasterCount: 64,
      unmatchedStoreCodes: ["12140"],
      duplicateMappings: 0,
      storesMissingGoogleMapsUrl: [],
      syncedMembershipsCount: 65,
    }),
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
    /Canonical Store ID verification failed.*12140/,
  );
  assert.equal(exportCalled, false);
});

test("Google Review download fails closed on duplicate Store ID mappings", async () => {
  const service = {
    syncWeeklyStoreMemberships: async () => ({
      expectedStoreCount: 65,
      matchedStoreMasterCount: 65,
      unmatchedStoreCodes: [],
      duplicateMappings: 1,
      storesMissingGoogleMapsUrl: [],
      syncedMembershipsCount: 65,
    }),
    exportWeeklyLeaderboard: async () => {
      throw new Error("export should not run");
    },
  } as unknown as GoogleReviewKpiService;

  const controller = new GoogleReviewKpiController(service);
  await assert.rejects(
    controller.exportWeeklyLeaderboard({ format: "xlsx" }, response() as any),
    /duplicateMappings=1/,
  );
});
