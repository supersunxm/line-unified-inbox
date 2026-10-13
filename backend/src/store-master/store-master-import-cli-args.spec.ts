import assert from "node:assert/strict";
import test from "node:test";
import { parseStoreMasterImportCliArgs } from "./store-master-import-cli-args";

void test("Store Master import CLI defaults to preview for absent and import modes", () => {
  assert.deepEqual(parseStoreMasterImportCliArgs([]), {
    mode: "preview",
    csvPath: undefined,
    apply: false,
    expectedSha256: undefined,
    approvedChangeSetPath: undefined,
  });
  assert.equal(parseStoreMasterImportCliArgs(["import"]).apply, false);
  assert.equal(parseStoreMasterImportCliArgs(["preview"]).apply, false);
});

void test("Store Master import CLI requires a source hash for apply and accepts one CSV path", () => {
  const hash = "b".repeat(64);
  assert.deepEqual(parseStoreMasterImportCliArgs(["import", "./master.csv", "--apply", `--expected-sha256=${hash}`]), {
    mode: "import",
    csvPath: "./master.csv",
    apply: true,
    expectedSha256: hash,
    approvedChangeSetPath: undefined,
  });
  assert.throws(() => parseStoreMasterImportCliArgs(["import", "--apply"]), /requires --expected-sha256/);
  assert.throws(() => parseStoreMasterImportCliArgs(["import", "a.csv", "b.csv"]), /Only one/);
});

void test("Store Master import CLI rejects unknown and contradictory options", () => {
  assert.throws(() => parseStoreMasterImportCliArgs(["import", "--force"]), /Unsupported Store Master option/);
  assert.throws(() => parseStoreMasterImportCliArgs(["preview", "--apply"]), /cannot be combined/);
  assert.throws(() => parseStoreMasterImportCliArgs(["validate", "--apply"]), /validate command/);
  assert.throws(() => parseStoreMasterImportCliArgs(["import", "--expected-sha256=unused"]), /require --apply/);
});
