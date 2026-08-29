import assert from "node:assert/strict";
import test from "node:test";
import { serializeConversationOwner } from "./conversation-owner";

void test("owner serialization exposes only active store-authorized users", () => {
  assert.deepEqual(
    serializeConversationOwner({
      id: "user-1",
      displayName: " Kittiya ",
      isActive: true,
      status: "ACTIVE",
      memberships: [{ storeId: "store-1" }],
    }, "store-1"),
    { id: "user-1", displayName: "Kittiya" },
  );
  assert.equal(serializeConversationOwner({ id: "user-1", displayName: "Kittiya", isActive: false, memberships: [{ storeId: "store-1" }] }, "store-1"), null);
  assert.equal(serializeConversationOwner({ id: "user-1", displayName: "Kittiya", status: "SUSPENDED", memberships: [{ storeId: "store-1" }] }, "store-1"), null);
  assert.equal(serializeConversationOwner({ id: "user-1", displayName: "Kittiya", memberships: [{ storeId: "store-2" }] }, "store-1"), null);
  assert.equal(serializeConversationOwner({ id: "user-1", displayName: "Kittiya", memberships: [{ storeId: "store-1" }] }, null), null);
  assert.deepEqual(serializeConversationOwner({ id: "admin-1", displayName: "HQ Admin", role: "ADMIN", isActive: true }, "store-1"), { id: "admin-1", displayName: "HQ Admin" });
  assert.deepEqual(serializeConversationOwner({ id: "hq-1", displayName: "HQ User", canAccessAllStores: true, isActive: true }, "store-1"), { id: "hq-1", displayName: "HQ User" });
});
