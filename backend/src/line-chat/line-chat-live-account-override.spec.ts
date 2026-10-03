import assert from "node:assert/strict";
import test from "node:test";
import { liveMirrorTargetCacheKey, readLiveMirrorAccountOverride } from "./line-chat-live-account-override";

const input = {
  mode: "NORMAL" as const,
  storeCode: "22982",
  lineOfficialAccountId: "oa-22982",
  storedBasicId: "829oppo",
};
const entry = {
  lineOfficialAccountId: "oa-22982",
  storedBasicId: "829oppo",
  profile: "A",
  managerAccountKey: "@manager-a",
};

test("Live account override requires the exact Store and OA identity", () => {
  assert.deepEqual(readLiveMirrorAccountOverride(input, JSON.stringify({ "22982": entry })), {
    profile: "A",
    managerAccountKey: "@manager-a",
  });
  assert.equal(readLiveMirrorAccountOverride({ ...input, storeCode: "other" }, JSON.stringify({ "22982": entry })), undefined);
  assert.throws(
    () => readLiveMirrorAccountOverride({ ...input, lineOfficialAccountId: "other-oa" }, JSON.stringify({ "22982": entry })),
    /LIVE_ACCOUNT_OVERRIDE_IDENTITY_MISMATCH/u,
  );
  assert.throws(
    () => readLiveMirrorAccountOverride({ ...input, storedBasicId: "changed" }, JSON.stringify({ "22982": entry })),
    /LIVE_ACCOUNT_OVERRIDE_IDENTITY_MISMATCH/u,
  );
});

test("Historical resolution ignores Live account overrides", () => {
  assert.equal(readLiveMirrorAccountOverride({ ...input, mode: "HISTORICAL" }, "invalid"), undefined);
  assert.equal(liveMirrorTargetCacheKey("oa-22982"), "oa-22982");
});

test("invalid Live override configuration fails closed without echoing its contents", () => {
  for (const raw of ["invalid", "[]", "null", JSON.stringify({ "22982": { ...entry, profile: "C" } }), JSON.stringify({ "22982": { ...entry, managerAccountKey: "https://example.invalid" } })]) {
    assert.throws(() => readLiveMirrorAccountOverride(input, raw), /LIVE_ACCOUNT_OVERRIDE_/u);
  }
});
