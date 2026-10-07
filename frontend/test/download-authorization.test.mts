import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPrimarySection, canDownloadData, type AuthUser } from "../src/lib/authorization.ts";
import { authorizeDataDownload } from "../src/lib/data-download-policy.ts";
import { hqPermissionSummary, saveHqAccountRole, type HqAccount } from "../src/app/admin/registrations/hq/hq-account-model.ts";

const account: HqAccount = {
  id: "hq", role: "ADMIN", displayName: "HQ", email: "hq@example.test", employeeId: "fixture",
  status: "ACTIVE", isActive: true, canAccessWeb: true, canAccessMobile: true, canAccessHq: true,
  canAccessAllStores: true, canManageAccounts: true, canReply: true, canAccessMainOa: true,
  canManageMainOa: true, createdAt: "2026-10-07", lastLoginAt: null,
};
function user(role: AuthUser["role"]): AuthUser {
  return { ...account, role, authorization: { version: 2,
    identity: { platformRole: role, membershipRoles: [] }, platforms: { web: true, mobile: true },
    workspaces: { hq: true, store: false, mainOa: true }, scope: { allStores: true, storeIds: [] },
    capabilities: { downloadData: role === "ADMIN", manageAccounts: true, reply: true, accessMainOa: true, manageMainOa: true } } };
}

test("administrator can export; Assistant, VIEWER and absent identity fail closed even with manipulated capability", () => {
  assert.equal(canDownloadData(user("ADMIN")), true);
  assert.equal(canDownloadData({ ...user("ADMIN"), mustChangePassword: true }), false);
  const assistant = user("ASSISTANT");
  assistant.authorization!.capabilities.downloadData = true;
  assert.equal(canDownloadData(assistant), false);
  assert.equal(canDownloadData(user("VIEWER")), false);
  assert.equal(canDownloadData(null), false);
  assert.equal(canAccessPrimarySection(assistant, "admin-registrations"), false);
  for (const section of ["home", "dashboard", "chats", "store-360", "main-oa", "follower-insights", "friend-source-links"] as const) {
    assert.equal(canAccessPrimarySection(assistant, section), true, section);
  }
});

test("stale built-in export actions revalidate the current server role and reject expired/unavailable sessions", async () => {
  const original = globalThis.fetch;
  try {
    for (const role of ["ADMIN", "ASSISTANT", "VIEWER"] as const) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "/auth/me");
        assert.equal(options?.credentials, "include");
        assert.equal(options?.cache, "no-store");
        return Response.json(user(role));
      };
      assert.equal(await authorizeDataDownload(), role === "ADMIN");
    }
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal(await authorizeDataDownload(), false);
    globalThis.fetch = async () => { throw new Error("offline"); };
    assert.equal(await authorizeDataDownload(), false);
  } finally { globalThis.fetch = original; }
});

test("HQ role save updates only persisted role and management grant; failed mutation leaves displayed state unchanged", async () => {
  const saved = await saveHqAccountRole(account, "ASSISTANT", async (id, role) => {
    assert.equal(id, account.id);
    return { role };
  });
  assert.deepEqual(saved, { ...account, role: "ASSISTANT", canManageAccounts: false });
  assert.match(hqPermissionSummary(saved), /Web · Mobile · All Stores · Reply · Main OA/);
  assert.doesNotMatch(hqPermissionSummary(saved), /Export|Account Management/);
  const before = structuredClone(account);
  await assert.rejects(() => saveHqAccountRole(account, "ASSISTANT", async () => { throw new Error("403"); }), /403/);
  assert.deepEqual(account, before);
});
