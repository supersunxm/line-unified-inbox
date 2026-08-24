import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Main OA workspace uses dedicated backend endpoints and does not use store filtering", async () => {
  const page = await readFile(new URL("../src/app/main-oa/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  assert.match(page, /Main OA/);
  assert.match(page, /Switch to Branch Stores/);
  assert.match(api, /\/main-oa\/conversations/);
  assert.doesNotMatch(page, /accountType\s*===\s*["']HEAD_OFFICE/);
});
