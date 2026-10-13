import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStoreMasterChangeSetApproved,
  parseStoreMasterApprovedChangeSet,
} from "./store-master-approval";

void test("approved change sets require exact, unique lifecycle and reassignment identities", () => {
  const changeSet = parseStoreMasterApprovedChangeSet([
    { kind: "STORE_LIFECYCLE", storeId: "100", action: "CLOSE" },
    {
      kind: "LINE_OA_REASSIGNMENT",
      lineOaId: "oa-1",
      fromStoreId: "store-old",
      toStoreId: "store-new",
      fromExternalStoreId: "100",
      toExternalStoreId: "200",
    },
    {
      kind: "CONVERSATION_REASSIGNMENT",
      lineOaId: "oa-1",
      fromStoreId: "store-old",
      toStoreId: "store-new",
      fromExternalStoreId: "100",
      toExternalStoreId: "200",
    },
  ]);

  assertStoreMasterChangeSetApproved(changeSet, [...changeSet].reverse());
  assert.throws(() => assertStoreMasterChangeSetApproved(changeSet, []), /do not match the approved change set/);
  assert.throws(() => assertStoreMasterChangeSetApproved(changeSet, [...changeSet, changeSet[0]]), /duplicate entries/);
});

void test("approved change set parser rejects extra fields and invalid reassignment targets", () => {
  assert.throws(
    () => parseStoreMasterApprovedChangeSet([{ kind: "STORE_LIFECYCLE", storeId: "100", action: "CLOSE", note: "ignored" }]),
    /lifecycle change 1 is invalid/,
  );
  assert.throws(
    () => parseStoreMasterApprovedChangeSet([{
      kind: "LINE_OA_REASSIGNMENT",
      lineOaId: "oa-1",
      fromStoreId: "store-old",
      toStoreId: "store-old",
      fromExternalStoreId: "100",
      toExternalStoreId: "100",
    }]),
    /reassignment 1 is invalid/,
  );
});
