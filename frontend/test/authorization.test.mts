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

test("full-access HQ users receive HQ navigation, all branch chats, and default to Main", () => {
  const hq = user({
    role: "ADMIN" as const,
    authorization: {
      ...user().authorization,
      identity: { platformRole: "ADMIN" as const, membershipRoles: [] },
      workspaces: { hq: true, store: false, mainOa: true },
      scope: { allStores: true, storeIds: [] },
      capabilities: { manageAccounts: true, reply: true, accessMainOa: true, manageMainOa: true },
    },
  });
  assert.equal(defaultRouteForUser(hq), "/home");
  assert.equal(canAccessPrimarySection(hq, "dashboard"), true);
  assert.equal(canAccessPrimarySection(hq, "stores"), true);
  assert.equal(canAccessPrimarySection(hq, "chats"), true);
  assert.equal(canAccessPrimarySection(hq, "friend-source-links"), true);
  assert.equal(canAccessPrimarySection(hq, "mass-messages"), true);
  assert.equal(canAccessPrimarySection(hq, "coupons"), true);
  assert.equal(canAccessPrimarySection(hq, "admin-registrations"), true);
  assert.equal(canAccessPrimarySection(hq, "rich-menus"), true);
  assert.equal(canAccessPrimarySection(hq, "main-oa"), true);
});

test("limited HQ without all-store scope cannot open branch chats", () => {
  const hq = user({
    authorization: {
      ...user().authorization,
      workspaces: { hq: true, store: false, mainOa: false },
      scope: { allStores: false, storeIds: [] },
    },
  });
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
  assert.equal(canAccessPrimarySection(store, "rich-menus"), false);
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
  assert.equal(canAccessPrimarySection(mainOa, "rich-menus"), false);
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
