import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../prisma.service";
import { resolveConfiguredMirrorFleetScope } from "./line-chat-mirror-fleet-scope";

function fakePrisma(stores: unknown[]): Pick<PrismaService, "store"> {
  return { store: { findMany: async () => stores } } as unknown as Pick<PrismaService, "store">;
}

test("fleet scope includes only active Store/OAs selected by stable StoreMaster LINE ID", async () => {
  const scope = await resolveConfiguredMirrorFleetScope(fakePrisma([{
    id: "store-active",
    code: "active-code",
    isActive: true,
    archivedAt: null,
    storeMaster: { externalStoreId: "active-code", accountName: "Display name is not the identity", normalizedAccountName: null, lineId: "@active" },
    lineOfficialAccounts: [
      { id: "oa-selected", name: "different label", basicId: "@active", isActive: true, archivedAt: null },
      { id: "oa-retired", name: "retired", basicId: "@retired", isActive: false, archivedAt: null },
    ],
  }]), ["active-code"]);

  assert.deepEqual(scope.eligibleStoreCodes, ["active-code"]);
  assert.deepEqual(scope.eligibleOaIds, ["oa-selected"]);
  assert.deepEqual(scope.disabledOaIds, ["oa-retired"]);
  assert.deepEqual(scope.exclusions, []);
});

test("archived and inactive stores are excluded and their OA mirror states are disabled", async () => {
  const scope = await resolveConfiguredMirrorFleetScope(fakePrisma([
    { id: "archived", code: "26533", isActive: false, archivedAt: new Date(), storeMaster: null, lineOfficialAccounts: [{ id: "oa-archived", name: "archived", basicId: "@archived", isActive: false, archivedAt: new Date() }] },
    { id: "inactive", code: "31754", isActive: false, archivedAt: null, storeMaster: null, lineOfficialAccounts: [{ id: "oa-inactive", name: "inactive", basicId: "@inactive", isActive: true, archivedAt: null }] },
  ]), ["26533", "31754"]);

  assert.deepEqual(scope.eligibleStoreCodes, []);
  assert.deepEqual(scope.disabledOaIds.sort(), ["oa-archived", "oa-inactive"]);
  assert.deepEqual(scope.exclusions.map((item) => item.reason), ["ARCHIVED_INELIGIBLE", "INACTIVE_INELIGIBLE"]);
});

test("ambiguous or missing configuration remains an explicit exclusion", async () => {
  const scope = await resolveConfiguredMirrorFleetScope(fakePrisma([
    { id: "ambiguous", code: "ambiguous", isActive: true, archivedAt: null, storeMaster: { externalStoreId: null, accountName: null, normalizedAccountName: null, lineId: null }, lineOfficialAccounts: [
      { id: "oa-a", name: "A", basicId: "@a", isActive: true, archivedAt: null },
      { id: "oa-b", name: "B", basicId: "@b", isActive: true, archivedAt: null },
    ] },
  ]), ["ambiguous", "missing"]);

  assert.deepEqual(scope.eligibleStoreCodes, []);
  assert.deepEqual(scope.exclusions.map((item) => [item.storeCode, item.reason]), [
    ["ambiguous", "MAPPING_AMBIGUOUS"],
    ["missing", "CONFIGURATION_ERROR"],
  ]);
});
