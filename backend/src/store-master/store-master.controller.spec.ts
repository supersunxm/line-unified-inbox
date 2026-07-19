import assert from "node:assert/strict";
import test from "node:test";
import { StoreMasterController } from "./store-master.controller";
import { StoreMasterService } from "./store-master.service";

void test("search delegates a valid query with the default limit", async () => {
  const calls: Array<{ query: string; limit: number }> = [];
  const service = { search: (query: string, limit: number) => { calls.push({ query, limit }); return Promise.resolve([]); } } as unknown as StoreMasterService;
  const result = await new StoreMasterController(service).search("OPPO Siam TV Lumphun");
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [{ query: "OPPO Siam TV Lumphun", limit: 10 }]);
});

void test("missing q returns an empty search and limit is capped at 50", async () => {
  const calls: Array<{ query: string; limit: number }> = [];
  const service = { search: (query: string, limit: number) => { calls.push({ query, limit }); return Promise.resolve([]); } } as unknown as StoreMasterService;
  const result = await new StoreMasterController(service).search("", "500");
  assert.deepEqual(result, []);
  assert.deepEqual(calls, [{ query: "", limit: 50 }]);
});
