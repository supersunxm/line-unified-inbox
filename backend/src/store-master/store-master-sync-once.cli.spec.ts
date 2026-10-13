import assert from "node:assert/strict";
import test from "node:test";
import { getStoreMasterPreviewCliOutcome, parseStoreMasterSyncCliArgs } from "./store-master-cli-args";

void test("Store Master CLI defaults to preview and accepts explicit preview", () => {
  assert.deepEqual(parseStoreMasterSyncCliArgs([]), { apply: false, expectedSha256: undefined, approvedChangeSetPath: undefined });
  assert.deepEqual(parseStoreMasterSyncCliArgs(["--preview"]), { apply: false, expectedSha256: undefined, approvedChangeSetPath: undefined });
});

void test("Store Master CLI requires explicit apply and a well-formed approved source hash", () => {
  const hash = "a".repeat(64);
  assert.deepEqual(parseStoreMasterSyncCliArgs(["--apply", `--expected-sha256=${hash}`]), {
    apply: true,
    expectedSha256: hash,
    approvedChangeSetPath: undefined,
  });
  assert.throws(() => parseStoreMasterSyncCliArgs(["--apply"]), /requires --expected-sha256/);
  assert.throws(() => parseStoreMasterSyncCliArgs(["--apply", "--expected-sha256=bad"]), /requires --expected-sha256/);
});

void test("Store Master CLI fails closed for unknown or contradictory options", () => {
  assert.throws(() => parseStoreMasterSyncCliArgs(["--force"]), /Unsupported Store Master option/);
  assert.throws(() => parseStoreMasterSyncCliArgs(["--apply", "--preview", `--expected-sha256=${"a".repeat(64)}`]), /Choose either/);
  assert.throws(() => parseStoreMasterSyncCliArgs(["--expected-sha256=unused"]), /require --apply/);
});

void test("Store Master preview identity conflicts retain a diagnostic and fail with a nonzero exit code", () => {
  const outcome = getStoreMasterPreviewCliOutcome(2);
  assert.equal(outcome.exitCode, 2);
  assert.deepEqual(outcome.diagnostic, {
    event: "store_master_sync_preview_blocked",
    reason: "IDENTITY_CONFLICTS",
    identityConflicts: 2,
    message: "Identity conflicts must be resolved before Store Master can be applied; no data was changed",
  });
});

void test("Store Master preview with no identity conflicts exits successfully", () => {
  assert.deepEqual(getStoreMasterPreviewCliOutcome(0), { exitCode: 0, diagnostic: null });
  assert.throws(() => getStoreMasterPreviewCliOutcome(-1), /Invalid Store Master identity conflict count/);
});
