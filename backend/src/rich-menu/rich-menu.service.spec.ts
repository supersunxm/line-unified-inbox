import test from "node:test";
import assert from "node:assert/strict";
import { RichMenuService, RichMenuPublishNoopAdapter } from "./rich-menu.service";
import {
  generatePresetAreas,
  validateRichMenuAreas,
  RichMenuArea,
} from "./rich-menu.types";
import { AuthUser } from "../auth/auth.guard";

const mockAdminUser: AuthUser = {
  id: "admin-1",
  email: "admin@oppo.com",
  displayName: "Admin User",
  role: "ADMIN",
};

void test("generatePresetAreas generates valid layouts for GRID_6, GRID_3, and GRID_4", () => {
  const g6 = generatePresetAreas("GRID_6", 2500, 1686);
  assert.equal(g6.width, 2500);
  assert.equal(g6.height, 1686);
  assert.equal(g6.areas.length, 6);
  const v6 = validateRichMenuAreas(g6.areas, g6.width, g6.height);
  assert.equal(v6.valid, true);

  const g3 = generatePresetAreas("GRID_3", 2500, 843);
  assert.equal(g3.width, 2500);
  assert.equal(g3.height, 843);
  assert.equal(g3.areas.length, 3);
  const v3 = validateRichMenuAreas(g3.areas, g3.width, g3.height);
  assert.equal(v3.valid, true);

  const g4 = generatePresetAreas("GRID_4", 2500, 1686);
  assert.equal(g4.width, 2500);
  assert.equal(g4.height, 1686);
  assert.equal(g4.areas.length, 4);
  const v4 = validateRichMenuAreas(g4.areas, g4.width, g4.height);
  assert.equal(v4.valid, true);
});

void test("validateRichMenuAreas rejects negative coordinates, out of bounds, and missing action", () => {
  // Empty areas
  const empty = validateRichMenuAreas([], 2500, 1686);
  assert.equal(empty.valid, false);

  // Negative bounds
  const negative: RichMenuArea[] = [
    { id: "a1", bounds: { x: -10, y: 0, width: 100, height: 100 }, actionType: "MESSAGE", actionData: "Hello" },
  ];
  const vNeg = validateRichMenuAreas(negative, 2500, 1686);
  assert.equal(vNeg.valid, false);
  assert.match(vNeg.errors[0], /x coordinate must be non-negative/);

  // Exceeds canvas width
  const outOfBounds: RichMenuArea[] = [
    { id: "a1", bounds: { x: 2000, y: 0, width: 600, height: 100 }, actionType: "MESSAGE", actionData: "Hello" },
  ];
  const vOut = validateRichMenuAreas(outOfBounds, 2500, 1686);
  assert.equal(vOut.valid, false);
  assert.match(vOut.errors[0], /exceed canvas width/);

  // Empty action value
  const emptyAction: RichMenuArea[] = [
    { id: "a1", bounds: { x: 0, y: 0, width: 100, height: 100 }, actionType: "URI", actionData: "   " },
  ];
  const vAct = validateRichMenuAreas(emptyAction, 2500, 1686);
  assert.equal(vAct.valid, false);
  assert.match(vAct.errors[0], /action value is required/);
});

void test("RichMenuService preview resolves dynamic variables against target store", async () => {
  const mockTemplate = {
    id: "tmpl-1",
    name: "Summer Campaign",
    description: "Multi-store promo",
    status: "DRAFT",
    canvasPreset: "GRID_6",
    width: 2500,
    height: 1686,
    chatBarText: "Menu",
    imageUrl: "https://example.com/image.jpg",
    areasJson: [
      { id: "area-1", bounds: { x: 0, y: 0, width: 1250, height: 562 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Map" },
      { id: "area-2", bounds: { x: 1250, y: 0, width: 1250, height: 562 }, actionType: "MESSAGE", actionData: "สนใจโปรโมชั่น {{store.storeName}}", label: "Promo" },
    ],
    version: 1,
    assignments: [],
  };

  const mockStoreOa = {
    id: "oa-pinklao",
    name: "OPPO Central Pinklao OA",
    accountType: "STORE",
    archivedAt: null,
    store: {
      id: "store-pinklao",
      name: "OBS Central Pinklao",
      code: "ST-29113",
      area: "Bangkok",
      region: "Central",
      storeMaster: {
        externalStoreId: "29113",
        accountName: "OBS Central Pinklao",
        province: "Bangkok",
        googleMapsUrl: "https://maps.app.goo.gl/pinklao29113",
      },
    },
  };

  const prisma = {
    richMenuTemplate: {
      findUnique: async () => mockTemplate,
    },
    lineOfficialAccount: {
      findUnique: async () => mockStoreOa,
      findFirst: async () => mockStoreOa,
    },
  } as any;

  const service = new RichMenuService(prisma);
  const preview = await service.preview("tmpl-1", { lineOfficialAccountId: "oa-pinklao" });

  assert.equal(preview.template.name, "Summer Campaign");
  assert.equal(preview.store.storeName, "OBS Central Pinklao");
  assert.equal(preview.readinessStatus, "READY");
  assert.equal(preview.areas[0].resolvedActionData, "https://maps.app.goo.gl/pinklao29113");
  assert.equal(preview.areas[0].isValid, true);
  assert.equal(preview.areas[1].resolvedActionData, "สนใจโปรโมชั่น OBS Central Pinklao");
  assert.equal(preview.areas[1].isValid, true);
});

void test("evaluateReadiness marks store BLOCKED only if template uses {{store.googleMapsUrl}} and store lacks valid URL", async () => {
  const mockTemplateWithMaps = {
    id: "tmpl-maps",
    name: "Template With Maps",
    areasJson: [
      { id: "a1", bounds: { x: 0, y: 0, width: 1250, height: 562 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}" },
      { id: "a2", bounds: { x: 1250, y: 0, width: 1250, height: 562 }, actionType: "MESSAGE", actionData: "Help" },
    ],
    assignments: [{ lineOfficialAccountId: "oa-ready" }],
  };

  const mockTemplateNoMaps = {
    id: "tmpl-nomaps",
    name: "Template Without Maps",
    areasJson: [
      { id: "a1", bounds: { x: 0, y: 0, width: 1250, height: 562 }, actionType: "MESSAGE", actionData: "Menu 1" },
      { id: "a2", bounds: { x: 1250, y: 0, width: 1250, height: 562 }, actionType: "MESSAGE", actionData: "Menu 2" },
    ],
    assignments: [],
  };

  const mockStoreOas = [
    {
      id: "oa-ready",
      name: "Store Ready",
      accountType: "STORE",
      archivedAt: null,
      store: {
        id: "s1",
        name: "Store 1",
        storeMaster: { externalStoreId: "101", googleMapsUrl: "https://maps.app.goo.gl/valid" },
      },
    },
    {
      id: "oa-missing-maps",
      name: "Store Missing Maps",
      accountType: "STORE",
      archivedAt: null,
      store: {
        id: "s2",
        name: "Store 2",
        storeMaster: { externalStoreId: "102", googleMapsUrl: null },
      },
    },
    {
      id: "oa-invalid-maps",
      name: "Store Invalid Maps",
      accountType: "STORE",
      archivedAt: null,
      store: {
        id: "s3",
        name: "Store 3",
        storeMaster: { externalStoreId: "103", googleMapsUrl: "http://insecure.com" },
      },
    },
  ];

  let currentTemplate: any = mockTemplateWithMaps;
  const prisma = {
    richMenuTemplate: {
      findUnique: async () => currentTemplate,
    },
    lineOfficialAccount: {
      findMany: async () => mockStoreOas,
    },
  } as any;

  const service = new RichMenuService(prisma);

  // 1. Evaluate template with maps
  const evalWithMaps = await service.evaluateReadiness("tmpl-maps");
  assert.equal(evalWithMaps.summary.total, 3);
  assert.equal(evalWithMaps.summary.ready, 1);
  assert.equal(evalWithMaps.summary.blocked, 2);

  const readyItem = evalWithMaps.items.find((i) => i.lineOfficialAccountId === "oa-ready");
  assert.equal(readyItem?.readinessStatus, "READY");
  assert.equal(readyItem?.selected, true);

  const missingItem = evalWithMaps.items.find((i) => i.lineOfficialAccountId === "oa-missing-maps");
  assert.equal(missingItem?.readinessStatus, "BLOCKED");
  assert.equal(missingItem?.readinessReason, "Missing Google Maps URL");

  const invalidItem = evalWithMaps.items.find((i) => i.lineOfficialAccountId === "oa-invalid-maps");
  assert.equal(invalidItem?.readinessStatus, "BLOCKED");
  assert.equal(invalidItem?.readinessReason, "Invalid Google Maps URL");

  // 2. Evaluate template without maps (all 3 stores should be READY!)
  currentTemplate = mockTemplateNoMaps;
  const evalNoMaps = await service.evaluateReadiness("tmpl-nomaps");
  assert.equal(evalNoMaps.summary.total, 3);
  assert.equal(evalNoMaps.summary.ready, 3);
  assert.equal(evalNoMaps.summary.blocked, 0);
});

void test("RichMenuPublishNoopAdapter throws fail-safe error and publishes no rich menus", async () => {
  const adapter = new RichMenuPublishNoopAdapter();
  await assert.rejects(
    () => adapter.createRichMenu(),
    /Rich Menu publishing is disabled in Phase 1/,
  );
  await assert.rejects(
    () => adapter.uploadRichMenuImage(),
    /Rich Menu publishing is disabled in Phase 1/,
  );
  await assert.rejects(
    () => adapter.setDefaultRichMenu(),
    /Rich Menu publishing is disabled in Phase 1/,
  );
  await assert.rejects(
    () => adapter.deleteRichMenu(),
    /Rich Menu publishing is disabled in Phase 1/,
  );
});
