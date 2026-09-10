import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storesPageCode = readFileSync(new URL("../src/app/stores/page.tsx", import.meta.url), "utf8");
const managementPageCode = readFileSync(new URL("../src/app/storemanagement/page.tsx", import.meta.url), "utf8");
const sidebarCode = readFileSync(new URL("../src/components/shell/app-sidebar.tsx", import.meta.url), "utf8");

test("/stores remains a public Store Directory with no management redirect", () => {
  assert.match(storesPageCode, /PublicStoresDirectory/);
  assert.doesNotMatch(storesPageCode, /StoreManagementRedirect/);
  assert.doesNotMatch(storesPageCode, /AuthorizedWorkspace/);
});

test("/storemanagement remains protected by the stores authorization section", () => {
  assert.match(managementPageCode, /AuthorizedWorkspace section="stores"/);
  assert.match(managementPageCode, /AuthorizedSection section="stores"/);
});

test("sidebar exposes Store Directory and Store Management as separate routes", () => {
  assert.match(sidebarCode, /href: "\/stores", label: t\.storeDirectory/);
  assert.match(sidebarCode, /href: "\/storemanagement", label: t\.stores/);
});
