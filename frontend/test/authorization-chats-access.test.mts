import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPrimarySection, type AuthUser } from "../src/lib/authorization";

function user(overrides: Partial<NonNullable<AuthUser["authorization"]>>): AuthUser {
  return {
    id: "user-1",
    email: "user@example.test",
    displayName: "User",
    role: "ADMIN",
    authorization: {
      version: 2,
      identity: { platformRole: "ADMIN", membershipRoles: [] },
      platforms: { web: true, mobile: true },
      workspaces: { hq: true, store: false, mainOa: false },
      scope: { allStores: true, storeIds: [] },
      capabilities: { manageAccounts: true, reply: true, accessMainOa: false, manageMainOa: false },
      ...overrides,
    },
  };
}

test("HQ all-store user keeps access to branch chats without a Store membership", () => {
  assert.equal(canAccessPrimarySection(user({}), "chats"), true);
});

test("store-scoped user keeps access to branch chats", () => {
  const storeUser = user({
    workspaces: { hq: false, store: true, mainOa: false },
    scope: { allStores: false, storeIds: ["store-1"] },
  });
  assert.equal(canAccessPrimarySection(storeUser, "chats"), true);
});

test("HQ user without all-store scope or Store membership cannot access branch chats", () => {
  const limitedHq = user({ scope: { allStores: false, storeIds: [] } });
  assert.equal(canAccessPrimarySection(limitedHq, "chats"), false);
});
