import assert from "node:assert/strict";
import test from "node:test";
import { authorizationFor, canAccessPrimarySection, defaultRouteForUser } from "../src/lib/authorization.ts";

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.test",
    displayName: "User",
    role: "VIEWER" as const,
    memberships: [],
    authorization: {
      version: 2,
      identity: { platformRole: "VIEWER" as const, membershipRoles: [] },
      platforms: { web: true, mobile: true },
      workspaces: { hq: false, store: false, mainOa: false },
      scope: { allStores: false, storeIds: [] },
      capabilities: { manageAccounts: false, reply: false, accessMainOa: false, manageMainOa: false },
    },
    ...overrides,
  };
}

test("HQ users receive HQ navigation and default to Main", () => {
  const hq = user({
    authorization: {
      ...user().authorization,
      workspaces: { hq: true, store: false, mainOa: false },
      scope: { allStores: true, storeIds: [] },
    },
  });
  assert.equal(defaultRouteForUser(hq), "/home");
  assert.equal(canAccessPrimarySection(hq, "dashboard"), true);
  assert.equal(canAccessPrimarySection(hq, "stores"), true);
  assert.equal(canAccessPrimarySection(hq, "chats"), false);
});

test("store users receive only store-scoped Web workspaces", () => {
  const store = user({
    memberships: [{ storeId: "store-1", role: "STAFF" }],
    authorization: {
      ...user().authorization,
      identity: { platformRole: "VIEWER" as const, membershipRoles: ["STAFF"] },
      workspaces: { hq: false, store: true, mainOa: false },
      scope: { allStores: false, storeIds: ["store-1"] },
      capabilities: { manageAccounts: false, reply: true, accessMainOa: false, manageMainOa: false },
    },
  });
  assert.equal(defaultRouteForUser(store), "/chats");
  assert.equal(canAccessPrimarySection(store, "chats"), true);
  assert.equal(canAccessPrimarySection(store, "follower-insights"), true);
  assert.equal(canAccessPrimarySection(store, "home"), false);
  assert.equal(canAccessPrimarySection(store, "admin-registrations"), false);
});

test("Main OA-only users land in the isolated Main OA workspace", () => {
  const mainOa = user({
    authorization: {
      ...user().authorization,
      workspaces: { hq: false, store: false, mainOa: true },
      capabilities: { manageAccounts: false, reply: true, accessMainOa: true, manageMainOa: false },
    },
  });
  assert.equal(defaultRouteForUser(mainOa), "/main-oa");
  assert.equal(canAccessPrimarySection(mainOa, "main-oa"), true);
  assert.equal(canAccessPrimarySection(mainOa, "chats"), false);
});

test("legacy responses are normalized during rolling deployment", () => {
  const legacy = user({
    authorization: undefined,
    memberships: [{ storeId: "store-1", role: "STORE_MANAGER" }],
    permissions: { canAccessMainOa: false, canReply: true },
  });
  const context = authorizationFor(legacy);
  assert.equal(context.workspaces.store, true);
  assert.deepEqual(context.scope.storeIds, ["store-1"]);
  assert.equal(context.capabilities.reply, true);
});
