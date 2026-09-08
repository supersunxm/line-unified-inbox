import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { NotFoundException } from "@nestjs/common";
import { IS_PUBLIC, REQUIRED_ROLES } from "../auth/auth.decorators";
import { PublicStoresController } from "./public-stores.controller";
import { PublicStoresService } from "./public-stores.service";
import {
  generatePublicStoreSlug,
  serializePublicStore,
  type PublicStoreDto,
} from "./public-stores.dto";
import { StoreMasterController } from "../store-master/store-master.controller";
import { StoresController } from "../stores.controller";
import type { PrismaService } from "../prisma.service";

const sampleRawStore: any = {
  id: "uuid-1234-5678",
  externalStoreId: "29039",
  storeName: "OBS Central Phitsanulok By OPPO 2",
  accountName: "OPPO CT Phitsanulok",
  normalizedAccountName: "oppo ct phitsanulok",
  province: "Phitsanulok",
  region: "Northern",
  lineOaLink: "https://lin.ee/KubnJU1",
  lineId: "@959koqlp",
  lineManagerUrl: "https://manager.line.biz/account/@959koqlp",
  tiktokUsername: "o_centralphitsanulok",
  tiktokProfileUrl: "https://www.tiktok.com/@o_centralphitsanulok",
  googleMapsUrl: "https://maps.app.goo.gl/D4uyRDRAoFXu36P78",
  dashboardTier: "Tier 1",
  kpiPlan: "Target A",
  dashboardArea: "Area North 1",
  bmName: "Somchai Manager",
  source: "GOOGLE_SHEET",
  sourceRowNumber: 42,
  sourceUpdatedAt: new Date("2026-09-01"),
  dataQualityStatus: "COMPLETE",
  isActive: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-09-01"),
  stores: [{ id: "store-internal-1" }],
  tikTokAccounts: [{ id: "tiktok-internal-1", encryptedAccessToken: "secret-token" }],
};

void test("1. Public stores endpoints are explicitly marked @Public()", () => {
  const reflector = new Reflector();

  const listPublic = reflector.get<boolean>(IS_PUBLIC, PublicStoresController.prototype.list);
  assert.equal(listPublic, true, "GET /public/stores must have @Public() metadata");

  const getByIdentifierPublic = reflector.get<boolean>(
    IS_PUBLIC,
    PublicStoresController.prototype.getByIdentifier
  );
  assert.equal(getByIdentifierPublic, true, "GET /public/stores/:identifier must have @Public() metadata");
});

void test("2. Existing private store routes remain protected without @Public()", () => {
  const reflector = new Reflector();

  const storesListPublic = reflector.get<boolean>(IS_PUBLIC, StoresController.prototype.list);
  assert.notEqual(storesListPublic, true, "GET /stores must NOT be public");

  const storeMasterSyncPublic = reflector.get<boolean>(IS_PUBLIC, StoreMasterController.prototype.sync);
  assert.notEqual(storeMasterSyncPublic, true, "POST /store-master/sync must NOT be public");

  const syncRoles = reflector.get<string[]>(REQUIRED_ROLES, StoreMasterController.prototype.sync);
  assert.deepEqual(syncRoles, ["ADMIN"], "POST /store-master/sync must require ADMIN role");
});

void test("3. serializePublicStore strictly includes whitelisted fields and excludes sensitive data", () => {
  const serialized = serializePublicStore(sampleRawStore);

  // Whitelisted public fields must be present
  assert.equal(serialized.id, "29039");
  assert.equal(serialized.slug, "obs-central-phitsanulok-by-oppo-2-29039");
  assert.equal(serialized.name, "OBS Central Phitsanulok By OPPO 2");
  assert.equal(serialized.accountName, "OPPO CT Phitsanulok");
  assert.equal(serialized.province, "Phitsanulok");
  assert.equal(serialized.region, "Northern");
  assert.equal(serialized.location.mapsUrl, "https://maps.app.goo.gl/D4uyRDRAoFXu36P78");
  assert.equal(serialized.line?.url, "https://lin.ee/KubnJU1");
  assert.equal(serialized.line?.basicId, "@959koqlp");
  assert.equal(serialized.tiktok?.username, "o_centralphitsanulok");
  assert.equal(serialized.tiktok?.profileUrl, "https://www.tiktok.com/@o_centralphitsanulok");

  // Sensitive StoreMaster internal fields MUST NOT exist in serialized output
  const forbiddenKeys = [
    "lineManagerUrl",
    "bmName",
    "dashboardTier",
    "kpiPlan",
    "dashboardArea",
    "source",
    "sourceRowNumber",
    "sourceUpdatedAt",
    "dataQualityStatus",
    "isActive",
    "normalizedAccountName",
    "createdAt",
    "updatedAt",
    "stores",
    "tikTokAccounts",
    "encryptedAccessToken",
  ];

  const serializedKeys = Object.keys(serialized);
  for (const forbidden of forbiddenKeys) {
    assert.equal(
      forbidden in (serialized as any),
      false,
      `Forbidden key "${forbidden}" must not exist on public store DTO`
    );
  }

  // Check JSON stringified output as well
  const jsonString = JSON.stringify(serialized);
  assert.doesNotMatch(jsonString, /manager\.line\.biz/);
  assert.doesNotMatch(jsonString, /Somchai/);
  assert.doesNotMatch(jsonString, /secret-token/);
  assert.doesNotMatch(jsonString, /Tier 1/);
});

void test("4. generatePublicStoreSlug produces clean, deterministic slugs", () => {
  assert.equal(
    generatePublicStoreSlug("OBS Central Phitsanulok By OPPO 2", "29039"),
    "obs-central-phitsanulok-by-oppo-2-29039"
  );
  assert.equal(
    generatePublicStoreSlug("OBS เดอะมอลล์ ท่าพระ", "19704"),
    "obs-เดอะมอลล์-ท่าพระ-19704"
  );
  assert.equal(
    generatePublicStoreSlug("!Special@Store#Name$", null),
    "special-store-name"
  );
});

void test("5. PublicStoresService.getStores filters correctly and returns metadata", async () => {
  const mockStores = [
    sampleRawStore,
    {
      ...sampleRawStore,
      id: "uuid-9999",
      externalStoreId: "19704",
      storeName: "OBS The Mall Tha Phra FL.3 By OPPO",
      accountName: "OPPO ThemallThaphra",
      normalizedAccountName: "oppo themallthaphra",
      province: "Bangkok",
      region: "Central",
      lineOaLink: null,
      tiktokUsername: null,
      tiktokProfileUrl: null,
    },
  ];

  const mockPrisma: any = {
    storeMaster: {
      findMany: async () => mockStores,
    },
  };

  const service = new PublicStoresService(mockPrisma as PrismaService);

  // All stores
  const resultAll = await service.getStores({});
  assert.equal(resultAll.total, 2);
  assert.equal(resultAll.stores.length, 2);
  assert.deepEqual(resultAll.filters.regions, ["Central", "Northern"]);
  assert.deepEqual(resultAll.filters.provinces, ["Bangkok", "Phitsanulok"]);

  // Filter by region
  const resultNorth = await service.getStores({ region: "Northern" });
  assert.equal(resultNorth.total, 1);
  assert.equal(resultNorth.stores[0].id, "29039");

  // Filter by province
  const resultBkk = await service.getStores({ province: "Bangkok" });
  assert.equal(resultBkk.total, 1);
  assert.equal(resultBkk.stores[0].id, "19704");

  // Search by text query
  const resultSearch = await service.getStores({ q: "Phitsanulok" });
  assert.equal(resultSearch.total, 1);
  assert.equal(resultSearch.stores[0].name, "OBS Central Phitsanulok By OPPO 2");
});

void test("6. PublicStoresService.getStoreByIdentifier resolves code, slug, UUID and throws 404 for missing", async () => {
  const mockPrisma: any = {
    storeMaster: {
      findFirst: async ({ where }: any) => {
        if (where.externalStoreId === "29039") return sampleRawStore;
        if (where.id === "0063c803-f70a-4f95-9eff-88a63465ed1a") return sampleRawStore;
        return null;
      },
      findMany: async () => [sampleRawStore],
    },
  };

  const service = new PublicStoresService(mockPrisma as PrismaService);

  // Lookup by externalStoreId
  const byCode = await service.getStoreByIdentifier("29039");
  assert.equal(byCode.name, "OBS Central Phitsanulok By OPPO 2");

  // Lookup by slug with trailing code
  const bySlug = await service.getStoreByIdentifier("obs-central-phitsanulok-by-oppo-2-29039");
  assert.equal(bySlug.name, "OBS Central Phitsanulok By OPPO 2");

  // Lookup by UUID
  const byUuid = await service.getStoreByIdentifier("0063c803-f70a-4f95-9eff-88a63465ed1a");
  assert.equal(byUuid.name, "OBS Central Phitsanulok By OPPO 2");

  // Missing store throws NotFoundException (404)
  await assert.rejects(
    () => service.getStoreByIdentifier("non-existent-store-999999"),
    (err: any) => err instanceof NotFoundException && err.message === "Store not found"
  );
});
