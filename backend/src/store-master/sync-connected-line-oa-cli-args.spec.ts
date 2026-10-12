import assert from "node:assert/strict";
import test from "node:test";
import { parseConnectedLineOaCliArgs } from "./sync-connected-line-oa-cli-args";

void test("connected LINE OA reconciliation defaults to dry-run", () => {
  assert.deepEqual(parseConnectedLineOaCliArgs([]), { apply: false, approvedChangeSetPath: undefined });
});

void test("connected LINE OA reconciliation requires explicit apply for approvals", () => {
  assert.deepEqual(parseConnectedLineOaCliArgs(["--apply", "--approved-change-set=reviewed.json"]), {
    apply: true,
    approvedChangeSetPath: "reviewed.json",
  });
  assert.throws(() => parseConnectedLineOaCliArgs(["--force"]), /Unsupported/);
  assert.throws(() => parseConnectedLineOaCliArgs(["--approved-change-set=reviewed.json"]), /requires --apply/);
});
