import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { loadLatestManagerUrls, resolveLineOaManagerUrl } from "./line-oa-manager-url";

void test("latest Store Master URL takes priority over the connected relation", () => {
  const latest = new Map([["22535", "https://manager.line.biz/account/latest"]]);
  assert.equal(resolveLineOaManagerUrl({ code: "22535", storeMaster: { lineManagerUrl: "https://manager.line.biz/account/stale" } }, latest), "https://manager.line.biz/account/latest");
});

void test("connected relation is the fallback when latest Store Master URL is absent", () => {
  assert.equal(resolveLineOaManagerUrl({ code: "22535", storeMaster: { lineManagerUrl: "https://manager.line.biz/account/connected" } }, new Map()), "https://manager.line.biz/account/connected");
});

void test("invalid latest and connected URLs resolve to null", () => {
  const latest = new Map([["22535", "http://manager.line.biz/account/latest"]]);
  assert.equal(resolveLineOaManagerUrl({ code: "22535", storeMaster: { lineManagerUrl: "https://evil.example/account/stale" } }, latest), null);
});

void test("batch loader deduplicates store codes in one query and keeps the newest row", async () => {
  let calls = 0; let queriedCodes: string[] = [];
  const prisma = { storeMaster: { findMany: ({ where }: { where: { externalStoreId: { in: string[] } } }) => {
    calls += 1; queriedCodes = where.externalStoreId.in;
    return Promise.resolve([
      { externalStoreId: "A", lineManagerUrl: "https://manager.line.biz/account/new" },
      { externalStoreId: "A", lineManagerUrl: "https://manager.line.biz/account/old" },
      { externalStoreId: "B", lineManagerUrl: null },
    ]);
  } } } as unknown as PrismaService;
  const result = await loadLatestManagerUrls(prisma, ["A", "A", "B", null]);
  assert.equal(calls, 1); assert.deepEqual(queriedCodes, ["A", "B"]);
  assert.equal(result.get("A"), "https://manager.line.biz/account/new"); assert.equal(result.get("B"), null);
});
