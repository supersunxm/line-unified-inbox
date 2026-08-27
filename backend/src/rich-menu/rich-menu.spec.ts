import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  generatePresetAreas,
  validateRichMenuAreas,
  RichMenuCanvasPreset,
} from "./rich-menu.types";
import {
  RichMenuService,
  RichMenuPublishNoopAdapter,
  detectImageMagicBytes,
} from "./rich-menu.service";
import { RichMenuPublishWorkerService } from "./rich-menu-publish-worker.service";
import { createMediaPublicUrl, verifyMediaPublicUrl } from "../media/media-public-url";
import { MediaStorageService } from "../media/media-storage";
import { MediaModule } from "../media/media.module";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { LineRichMenuClientService } from "./line-rich-menu-client.service";
import { AuditLogService } from "../auth/audit-log.service";
import { Test } from "@nestjs/testing";
import { RichMenuModule } from "./rich-menu.module";
import { PrismaModule } from "../prisma.module";
import { PrismaService } from "../prisma.service";

test("RichMenuCanvasPreset supports 12 LINE OA presets and legacy aliases", () => {
  const largePresets: RichMenuCanvasPreset[] = [
    "LARGE_6",
    "LARGE_4",
    "LARGE_TOP_1_BOTTOM_3",
    "LARGE_LEFT_1_RIGHT_2",
    "LARGE_2_ROWS",
    "LARGE_2_COLS",
    "LARGE_1",
  ];

  const compactPresets: RichMenuCanvasPreset[] = [
    "COMPACT_3",
    "COMPACT_LEFT_SMALL",
    "COMPACT_LEFT_LARGE",
    "COMPACT_2",
    "COMPACT_1",
  ];

  assert.equal(largePresets.length, 7);
  assert.equal(compactPresets.length, 5);
});

test("Geometry verification for all 12 presets: tiling, bounds, and no overlaps", () => {
  const expectedAreaCounts: Record<string, { count: number; width: number; height: number }> = {
    LARGE_6: { count: 6, width: 2500, height: 1686 },
    LARGE_4: { count: 4, width: 2500, height: 1686 },
    LARGE_TOP_1_BOTTOM_3: { count: 4, width: 2500, height: 1686 },
    LARGE_LEFT_1_RIGHT_2: { count: 3, width: 2500, height: 1686 },
    LARGE_2_ROWS: { count: 2, width: 2500, height: 1686 },
    LARGE_2_COLS: { count: 2, width: 2500, height: 1686 },
    LARGE_1: { count: 1, width: 2500, height: 1686 },
    COMPACT_3: { count: 3, width: 2500, height: 843 },
    COMPACT_LEFT_SMALL: { count: 2, width: 2500, height: 843 },
    COMPACT_LEFT_LARGE: { count: 2, width: 2500, height: 843 },
    COMPACT_2: { count: 2, width: 2500, height: 843 },
    COMPACT_1: { count: 1, width: 2500, height: 843 },
  };

  for (const [presetKey, expected] of Object.entries(expectedAreaCounts)) {
    const preset = presetKey as RichMenuCanvasPreset;
    const generated = generatePresetAreas(preset);

    assert.equal(generated.width, expected.width, `${preset} width mismatch`);
    assert.equal(generated.height, expected.height, `${preset} height mismatch`);
    assert.equal(generated.areas.length, expected.count, `${preset} area count mismatch`);

    // Verify area bounds validity
    const validation = validateRichMenuAreas(generated.areas, generated.width, generated.height);
    assert.equal(validation.valid, true, `${preset} validation failed: ${validation.errors.join("; ")}`);

    // Verify coordinates within canvas
    for (const area of generated.areas) {
      assert.ok(area.bounds.x >= 0, `${preset} area ${area.id} x < 0`);
      assert.ok(area.bounds.y >= 0, `${preset} area ${area.id} y < 0`);
      assert.ok(area.bounds.width > 0, `${preset} area ${area.id} width <= 0`);
      assert.ok(area.bounds.height > 0, `${preset} area ${area.id} height <= 0`);
      assert.ok(
        area.bounds.x + area.bounds.width <= generated.width,
        `${preset} area ${area.id} exceeds width`,
      );
      assert.ok(
        area.bounds.y + area.bounds.height <= generated.height,
        `${preset} area ${area.id} exceeds height`,
      );
    }

    // Verify tiling: total area sum equals total canvas area (no gaps, no overlaps)
    const totalAreaSum = generated.areas.reduce(
      (sum, a) => sum + a.bounds.width * a.bounds.height,
      0,
    );
    const canvasTotalArea = generated.width * generated.height;
    assert.equal(
      totalAreaSum,
      canvasTotalArea,
      `${preset} total area coverage ${totalAreaSum} does not match canvas ${canvasTotalArea}`,
    );
  }
});

test("Backward compatibility: legacy GRID_6, GRID_4, GRID_3, and CUSTOM presets", () => {
  const g6 = generatePresetAreas("GRID_6");
  const l6 = generatePresetAreas("LARGE_6");
  assert.deepEqual(g6, l6);

  const g4 = generatePresetAreas("GRID_4");
  const l4 = generatePresetAreas("LARGE_4");
  assert.deepEqual(g4, l4);

  const g3 = generatePresetAreas("GRID_3");
  const c3 = generatePresetAreas("COMPACT_3");
  assert.deepEqual(g3, c3);

  const custom = generatePresetAreas("CUSTOM", 1200, 810);
  assert.equal(custom.width, 1200);
  assert.equal(custom.height, 810);
  assert.equal(custom.areas.length, 1);
});

test("RichMenuPublishNoopAdapter prevents any calls to LINE Messaging API in Phase 1", async () => {
  const adapter = new RichMenuPublishNoopAdapter();
  await assert.rejects(() => adapter.createRichMenu(), /disabled in Phase 1/);
  await assert.rejects(() => adapter.uploadRichMenuImage(), /disabled in Phase 1/);
  await assert.rejects(() => adapter.setDefaultRichMenu(), /disabled in Phase 1/);
  await assert.rejects(() => adapter.deleteRichMenu(), /disabled in Phase 1/);
});

test("detectImageMagicBytes accurately identifies PNG, JPEG, and rejects other formats", async () => {
  const pngBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
  assert.equal(detectImageMagicBytes(pngBuffer), "png");

  const jpegBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).jpeg().toBuffer();
  assert.equal(detectImageMagicBytes(jpegBuffer), "jpeg");

  const webpBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } },
  }).webp().toBuffer();
  assert.equal(detectImageMagicBytes(webpBuffer), "unknown");

  const randomBytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  assert.equal(detectImageMagicBytes(randomBytes), "unknown");

  const shortBytes = Buffer.from([0x89, 0x50]);
  assert.equal(detectImageMagicBytes(shortBytes), "unknown");
});

test("RichMenuService image parsing, storage put, and public URL generation", async () => {
  let putObjectKey = "";
  let putBodyLength = 0;
  let putContentType = "";

  const mockMedia = {
    put: async (key: string, body: Buffer, contentType: string) => {
      putObjectKey = key;
      putBodyLength = body.length;
      putContentType = contentType;
      return { provider: "local", fileId: key, mimeType: contentType, size: body.length };
    },
    get: async () => ({ body: Buffer.from([]) }),
  } as unknown as MediaStorageService;

  const service = new RichMenuService({} as any, mockMedia);
  const mockUser = { id: "u1", email: "admin@oppo.com", displayName: "Admin", role: "ADMIN" } as any;

  // 1. Valid 2500x1686 PNG upload for Large preset
  const validLargePng = await sharp({
    create: { width: 2500, height: 1686, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();

  const resLarge = await service.uploadImage(
    { buffer: validLargePng, originalname: "menu.png", mimetype: "image/png" },
    mockUser,
    "LARGE_6",
  );
  assert.equal(resLarge.width, 2500);
  assert.equal(resLarge.height, 1686);
  assert.match(resLarge.imageUrl, /\/messages\/media\/public\?key=line-media%2Foutbound%2Frich-menu%2F.*\.png/);
  assert.equal(putContentType, "image/png");
  assert.equal(putBodyLength, validLargePng.length);

  // Validate the signed public URL using verifyMediaPublicUrl
  const parsedUrl = new URL(resLarge.imageUrl);
  const keyParam = parsedUrl.searchParams.get("key")!;
  const expiresParam = parsedUrl.searchParams.get("expires")!;
  const sigParam = parsedUrl.searchParams.get("signature")!;
  assert.equal(keyParam, putObjectKey);
  assert.equal(verifyMediaPublicUrl(keyParam, expiresParam, sigParam), true);

  // 2. Valid 1200x405 JPEG upload for Compact preset
  const validCompactJpg = await sharp({
    create: { width: 1200, height: 405, channels: 3, background: { r: 200, g: 200, b: 200 } },
  }).jpeg().toBuffer();

  const resCompact = await service.uploadImage(
    { buffer: validCompactJpg, originalname: "menu.jpg", mimetype: "image/jpeg" },
    mockUser,
    "COMPACT_3",
  );
  assert.equal(resCompact.width, 1200);
  assert.equal(resCompact.height, 405);
  assert.match(resCompact.imageUrl, /\/messages\/media\/public\?key=line-media%2Foutbound%2Frich-menu%2F.*\.jpg/);
  assert.equal(putContentType, "image/jpeg");

  // 3. PNG disguised with .jpg filename succeeds as PNG based on magic bytes
  const resDisguised = await service.uploadImage(
    { buffer: validLargePng, originalname: "image.jpg", mimetype: "image/jpeg" },
    mockUser,
  );
  assert.equal(resDisguised.width, 2500);
  assert.match(resDisguised.imageUrl, /key=line-media%2Foutbound%2Frich-menu%2F.*\.png/);

  // 4. WebP disguised as .png is rejected with clear localized error
  const webpBuffer = await sharp({
    create: { width: 1200, height: 810, channels: 3, background: { r: 100, g: 100, b: 100 } },
  }).webp().toBuffer();

  await assert.rejects(
    () => service.uploadImage({ buffer: webpBuffer, originalname: "fake.png" }, mockUser),
    /รองรับเฉพาะไฟล์ JPG หรือ PNG/
  );

  // 5. Random bytes rejected with clear localized error
  const corruptBuffer = Buffer.from("this is not an image at all but random text bytes");
  await assert.rejects(
    () => service.uploadImage({ buffer: corruptBuffer, originalname: "bad.jpg" }, mockUser),
    /รองรับเฉพาะไฟล์ JPG หรือ PNG/
  );

  // 6. Oversized image > 1 MB is rejected
  const oversizedBuffer = Buffer.alloc(1024 * 1024 + 10);
  await assert.rejects(
    () => service.uploadImage({ buffer: oversizedBuffer }, mockUser),
    /1 MB/
  );

  // 7. Width < 800 is rejected
  const smallWidthPng = await sharp({
    create: { width: 600, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  await assert.rejects(
    () => service.uploadImage({ buffer: smallWidthPng }, mockUser),
    /800 ถึง 2500/
  );

  // 8. Aspect ratio mismatch with selected template
  const compactShapePng = await sharp({
    create: { width: 2500, height: 843, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  await assert.rejects(
    () => service.uploadImage({ buffer: compactShapePng }, mockUser, "LARGE_6"),
    /รูปภาพไม่ตรงกับสัดส่วนของเทมเพลตที่เลือก/
  );

  // 9. Storage put failure handling
  const failingStorage = {
    put: async () => {
      throw new Error("S3 connection timeout");
    },
    get: async () => ({ body: Buffer.from([]) }),
  } as unknown as MediaStorageService;

  const failingService = new RichMenuService({} as any, failingStorage);
  await assert.rejects(
    () => failingService.uploadImage({ buffer: validLargePng }, mockUser),
    /ไม่สามารถบันทึกรูปภาพได้ กรุณาลองใหม่อีกครั้ง/
  );
});

test("RichMenuService refreshes signed URLs for saved templates on retrieval", async () => {
  const testKey = "line-media/outbound/rich-menu/saved-image-123.png";
  const oldUrl = createMediaPublicUrl(testKey, -100); // expired 100s ago

  const mockPrisma = {
    richMenuTemplate: {
      findMany: async () => [
        {
          id: "t1",
          name: "Template 1",
          description: null,
          status: "DRAFT",
          canvasPreset: "LARGE_6",
          width: 2500,
          height: 1686,
          chatBarText: "Menu",
          imageUrl: oldUrl,
          areasJson: [],
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { assignments: 0 },
        },
      ],
      findUnique: async () => ({
        id: "t1",
        name: "Template 1",
        description: null,
        status: "DRAFT",
        canvasPreset: "LARGE_6",
        width: 2500,
        height: 1686,
        chatBarText: "Menu",
        imageUrl: oldUrl,
        areasJson: [],
        version: 1,
        assignments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any);

  // listTemplates refreshes imageUrl
  const list = await service.listTemplates();
  assert.equal(list.length, 1);
  const listUrl = new URL(list[0].imageUrl!);
  const listKey = listUrl.searchParams.get("key")!;
  const listExp = listUrl.searchParams.get("expires")!;
  const listSig = listUrl.searchParams.get("signature")!;
  assert.equal(listKey, testKey);
  assert.equal(verifyMediaPublicUrl(listKey, listExp, listSig), true);

  // getTemplate refreshes imageUrl
  const template = await service.getTemplate("t1");
  const getUrl = new URL(template.imageUrl!);
  const getKey = getUrl.searchParams.get("key")!;
  const getExp = getUrl.searchParams.get("expires")!;
  const getSig = getUrl.searchParams.get("signature")!;
  assert.equal(getKey, testKey);
  assert.equal(verifyMediaPublicUrl(getKey, getExp, getSig), true);
});

test("NestJS DI regression test: RichMenuService resolves with required MediaStorageService and LineRichMenuClientService", async () => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RichMenuService,
      MediaStorageService,
      {
        provide: PrismaService,
        useValue: {},
      },
      {
        provide: CredentialEncryptionService,
        useValue: { decrypt: (val: string) => val },
      },
      {
        provide: LineRichMenuClientService,
        useValue: {},
      },
      {
        provide: AuditLogService,
        useValue: { record: async () => {} },
      },
    ],
  }).compile();

  const richMenuService = moduleRef.get(RichMenuService);
  assert.ok(richMenuService, "RichMenuService must resolve from DI container");

  const mediaService = moduleRef.get(MediaStorageService);
  assert.ok(mediaService, "MediaStorageService must resolve from container");

  const injectedMedia = (richMenuService as any).media;
  assert.ok(injectedMedia, "MediaStorageService must be non-null and injected into RichMenuService");
  assert.equal(injectedMedia instanceof MediaStorageService, true);
});

test("Module wiring test: RichMenuModule imports MediaModule and CredentialsModule, and exports RichMenuService", () => {
  const richMenuImports = Reflect.getMetadata("imports", RichMenuModule);
  assert.ok(richMenuImports.includes(MediaModule), "RichMenuModule must import MediaModule");

  const richMenuExports = Reflect.getMetadata("exports", RichMenuModule);
  assert.ok(richMenuExports.includes(RichMenuService), "RichMenuModule must export RichMenuService");

  const mediaExports = Reflect.getMetadata("exports", MediaModule);
  assert.ok(mediaExports.includes(MediaStorageService), "MediaModule must export MediaStorageService");
});

// =========================================================================
// Phase 2A Unit Tests
// =========================================================================

test("LineRichMenuClientService: validates payload against LINE validate API", async () => {
  const originalFetch = global.fetch;
  try {
    const client = new LineRichMenuClientService();

    // 1. Success case (200 OK)
    global.fetch = (async (url: any, opts: any) => {
      assert.equal(url, "https://api.line.me/v2/bot/richmenu/validate");
      assert.equal(opts.method, "POST");
      assert.equal(opts.headers.Authorization, "Bearer secret-token");
      return new Response(JSON.stringify({}), { status: 200 });
    }) as any;

    const validRes = await client.validateRichMenu("secret-token", {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "Test Menu",
      chatBarText: "Menu",
      areas: [],
    });
    assert.equal(validRes.valid, true);

    // 2. Error case (400 Bad Request)
    global.fetch = (async () => {
      return new Response(
        JSON.stringify({
          message: "The request body is invalid.",
          details: [{ message: "chatBarText cannot be empty" }],
        }),
        { status: 400 },
      );
    }) as any;

    const invalidRes = await client.validateRichMenu("secret-token", {
      size: { width: 2500, height: 1686 },
      selected: true,
      name: "Test Menu",
      chatBarText: "",
      areas: [],
    });
    assert.equal(invalidRes.valid, false);
    assert.equal(invalidRes.message, "chatBarText cannot be empty");
  } finally {
    global.fetch = originalFetch;
  }
});

test("LineRichMenuClientService: detects previous default rich menu sources", async () => {
  const originalFetch = global.fetch;
  try {
    const client = new LineRichMenuClientService();

    // 1. MESSAGING_API (200 OK)
    global.fetch = (async () => {
      return new Response(JSON.stringify({ richMenuId: "richmenu-prev-123" }), { status: 200 });
    }) as any;
    const res200 = await client.getDefaultRichMenu("token");
    assert.equal(res200.source, "MESSAGING_API");
    assert.equal(res200.richMenuId, "richmenu-prev-123");

    // 2. NONE (404 Not Found)
    global.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
    }) as any;
    const res404 = await client.getDefaultRichMenu("token");
    assert.equal(res404.source, "NONE");
    assert.equal(res404.richMenuId, null);

    // 3. OTHER_OR_MANAGER (403 Forbidden)
    global.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
    }) as any;
    const res403 = await client.getDefaultRichMenu("token");
    assert.equal(res403.source, "OTHER_OR_MANAGER");
    assert.equal(res403.richMenuId, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test("RichMenuService.publishCanary: Phase 2A single-store end-to-end publishing pipeline", async () => {
  const recordedAuditLogs: any[] = [];
  const publishedLineCalls: string[] = [];

  const fakeAuditLog = {
    record: async (input: any) => {
      recordedAuditLogs.push(input);
    },
  } as any;

  const mockEncryption = {
    decrypt: (val: string) => `decrypted-${val}`,
  } as any;

  const mockMedia = {
    get: async (key: string) => ({
      body: Buffer.from("fake-png-bytes"),
      contentType: "image/png",
    }),
  } as any;

  const mockPublishClient = {
    validateRichMenu: async (_token: string, payload: any) => {
      publishedLineCalls.push("validate");
      assert.equal(payload.selected, true);
      assert.equal(payload.name, "Summer Campaign");
      assert.equal(payload.areas.length, 1);
      assert.equal(payload.areas[0].action.uri, "https://maps.app.goo.gl/central-bangna");
      return { valid: true };
    },
    getDefaultRichMenu: async (_token: string) => {
      publishedLineCalls.push("getDefault");
      // Initially returns existing default
      if (publishedLineCalls.filter((c) => c === "getDefault").length === 1) {
        return { richMenuId: "richmenu-existing-999", source: "MESSAGING_API" as const };
      }
      // Verification call returns newly created richmenu
      return { richMenuId: "richmenu-new-created-123", source: "MESSAGING_API" as const };
    },
    createRichMenu: async (_token: string, _payload: any) => {
      publishedLineCalls.push("create");
      return { richMenuId: "richmenu-new-created-123" };
    },
    uploadRichMenuImage: async (_token: string, richMenuId: string, _buf: Buffer, contentType: string) => {
      publishedLineCalls.push("uploadImage");
      assert.equal(richMenuId, "richmenu-new-created-123");
      assert.equal(contentType, "image/png");
    },
    setDefaultRichMenu: async (_token: string, richMenuId: string) => {
      publishedLineCalls.push("setDefault");
      assert.equal(richMenuId, "richmenu-new-created-123");
    },
    clearDefaultRichMenu: async () => {
      publishedLineCalls.push("clearDefault");
    },
    deleteRichMenu: async () => {
      publishedLineCalls.push("delete");
    },
  } as any;

  let attemptRecord: any = null;

  const mockPrisma = {
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        name: "Summer Campaign",
        status: "DRAFT",
        canvasPreset: "LARGE_1",
        width: 2500,
        height: 1686,
        selected: true,
        chatBarText: "Menu",
        imageUrl: createMediaPublicUrl("line-media/outbound/rich-menu/image.png"),
        areasJson: [
          {
            id: "area-1",
            bounds: { x: 0, y: 0, width: 2500, height: 1686 },
            actionType: "URI",
            actionData: "{{store.googleMapsUrl}}",
            label: "Open Maps",
          },
        ],
        assignments: [{ id: "assign-1", lineOfficialAccountId: "oa-bangna" }],
      }),
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-bangna",
        name: "OPPO Central Bangna",
        accountType: "STORE",
        isActive: true,
        archivedAt: null,
        encryptedChannelAccessToken: "encrypted-token-bangna",
        store: {
          id: "store-bangna",
          name: "OBS Central Bangna",
          storeMaster: {
            externalStoreId: "TH001",
            googleMapsUrl: "https://maps.app.goo.gl/central-bangna",
          },
        },
      }),
    },
    richMenuPublishAttempt: {
      findFirst: async () => null, // No active attempt
      count: async () => 0,
      create: async (args: any) => {
        attemptRecord = {
          id: "attempt-1",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return attemptRecord;
      },
      update: async (args: any) => {
        attemptRecord = {
          ...attemptRecord,
          ...args.data,
          updatedAt: new Date(),
        };
        return attemptRecord;
      },
    },
  } as any;

  const service = new RichMenuService(
    mockPrisma,
    mockMedia,
    mockEncryption,
    mockPublishClient,
    fakeAuditLog,
  );

  const result = await service.publishCanary(
    "tpl-1",
    { lineOfficialAccountId: "oa-bangna" },
    { id: "admin-user-1", username: "admin", role: "ADMIN" } as any,
  );

  // Assert pipeline execution sequence
  assert.deepEqual(publishedLineCalls, [
    "validate",
    "getDefault",
    "create",
    "uploadImage",
    "setDefault",
    "getDefault",
  ]);

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.lineRichMenuId, "richmenu-new-created-123");
  assert.equal(result.previousDefaultRichMenuId, "richmenu-existing-999");
  assert.equal(result.previousDefaultSource, "MESSAGING_API");

  // Verify Audit Logs
  assert.equal(recordedAuditLogs.length, 2);
  assert.equal(recordedAuditLogs[0].action, "RICH_MENU_PUBLISH_STARTED");
  assert.equal(recordedAuditLogs[1].action, "RICH_MENU_PUBLISHED");

  // Privacy Check: No secret token in config or logs
  const configString = JSON.stringify(attemptRecord.resolvedConfigJson);
  assert.equal(configString.includes("decrypted-encrypted-token-bangna"), false);
  assert.equal(configString.includes("secret"), false);
});

test("RichMenuService.publishCanary: handles image upload failure with automatic cleanup delete", async () => {
  const publishedLineCalls: string[] = [];

  const mockEncryption = {
    decrypt: (val: string) => `decrypted-${val}`,
  } as any;

  const mockMedia = {
    get: async () => ({
      body: Buffer.from("fake-png-bytes"),
      contentType: "image/png",
    }),
  } as any;

  const mockPublishClient = {
    validateRichMenu: async () => ({ valid: true }),
    getDefaultRichMenu: async () => ({ richMenuId: null, source: "NONE" as const }),
    createRichMenu: async () => {
      publishedLineCalls.push("create");
      return { richMenuId: "richmenu-failed-upload-999" };
    },
    uploadRichMenuImage: async () => {
      publishedLineCalls.push("uploadImageFail");
      throw new Error("LINE API server error during image upload");
    },
    deleteRichMenu: async (_token: string, richMenuId: string) => {
      publishedLineCalls.push(`delete:${richMenuId}`);
    },
  } as any;

  let attemptStatus = "";
  let errorStage = "";

  const mockPrisma = {
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        name: "Test",
        status: "DRAFT",
        width: 2500,
        height: 1686,
        selected: true,
        chatBarText: "Menu",
        imageUrl: createMediaPublicUrl("line-media/outbound/rich-menu/image.png"),
        areasJson: [
          {
            id: "area-1",
            bounds: { x: 0, y: 0, width: 2500, height: 1686 },
            actionType: "URI",
            actionData: "https://example.com",
          },
        ],
        assignments: [{ id: "assign-1", lineOfficialAccountId: "oa-1" }],
      }),
    },
    lineOfficialAccount: {
      findUnique: async () => ({
        id: "oa-1",
        name: "OPPO Test",
        accountType: "STORE",
        isActive: true,
        archivedAt: null,
        encryptedChannelAccessToken: "enc-token",
        store: { id: "s-1", name: "Store 1", storeMaster: {} },
      }),
    },
    richMenuPublishAttempt: {
      findFirst: async () => null,
      count: async () => 0,
      create: async (args: any) => ({ id: "att-fail", ...args.data }),
      update: async (args: any) => {
        if (args.data.status) attemptStatus = args.data.status;
        if (args.data.errorStage) errorStage = args.data.errorStage;
        return { id: "att-fail", ...args.data };
      },
    },
  } as any;

  const service = new RichMenuService(
    mockPrisma,
    mockMedia,
    mockEncryption,
    mockPublishClient,
  );

  await assert.rejects(
    async () => {
      await service.publishCanary("tpl-1", { lineOfficialAccountId: "oa-1" }, { id: "user-1" } as any);
    },
    { message: "LINE API server error during image upload" },
  );

  assert.deepEqual(publishedLineCalls, [
    "create",
    "uploadImageFail",
    "delete:richmenu-failed-upload-999",
  ]);
  assert.equal(attemptStatus, "FAILED");
  assert.equal(errorStage, "IMAGE_UPLOADING");
});

test("RichMenuService.rollbackPublish: restores previous default or clears default", async () => {
  const publishedLineCalls: string[] = [];

  const mockPublishClient = {
    setDefaultRichMenu: async (_token: string, richMenuId: string) => {
      publishedLineCalls.push(`setDefault:${richMenuId}`);
    },
    clearDefaultRichMenu: async () => {
      publishedLineCalls.push("clearDefault");
    },
    getDefaultRichMenu: async () => ({ richMenuId: "restored-prev-id", source: "MESSAGING_API" as const }),
  } as any;

  const mockEncryption = { decrypt: (val: string) => val } as any;

  const mockPrisma = {
    richMenuPublishAttempt: {
      findUnique: async () => ({
        id: "att-pub",
        templateId: "tpl-1",
        lineOfficialAccountId: "oa-1",
        status: "PUBLISHED",
        lineRichMenuId: "richmenu-to-rollback",
        previousDefaultRichMenuId: "richmenu-previous-default",
        previousDefaultSource: "MESSAGING_API",
        lineOfficialAccount: {
          name: "OPPO Store",
          encryptedChannelAccessToken: "tok",
          store: { name: "Store 1" },
        },
      }),
      update: async (args: any) => ({
        id: "att-pub",
        templateId: "tpl-1",
        lineOfficialAccountId: "oa-1",
        ...args.data,
      }),
    },
  } as any;

  const service = new RichMenuService(
    mockPrisma,
    {} as any,
    mockEncryption,
    mockPublishClient,
  );

  const res = await service.rollbackPublish("att-pub", { id: "admin-1" } as any);
  assert.equal(res.status, "ROLLED_BACK");
  assert.deepEqual(publishedLineCalls, ["setDefault:richmenu-previous-default"]);
});

test("RichMenuService.createBulkPublishJob: enforces max targets limit and creates queued job with pending attempts", async () => {
  const mockPrisma = {
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        name: "Promo Menu",
        version: 1,
        imageUrl: "https://lineoppo.click/messages/media/public?key=line-media%2Foutbound%2Frich-menu%2Fimg.jpg&expires=999&signature=sig",
        assignments: [
          { id: "asgn-1", lineOfficialAccountId: "oa-1" },
          { id: "asgn-2", lineOfficialAccountId: "oa-2" },
          { id: "asgn-3", lineOfficialAccountId: "oa-3" },
        ],
      }),
    },
    lineOfficialAccount: {
      findMany: async (args: any) => [
        { id: "oa-1", name: "OA 1", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-1", store: { id: "s-1", name: "Store 1" } },
        { id: "oa-2", name: "OA 2", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-2", store: { id: "s-2", name: "Store 2" } },
        { id: "oa-3", name: "OA 3", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-3", store: { id: "s-3", name: "Store 3" } },
      ],
    },
    $transaction: async (fn: any) => {
      return fn({
        richMenuPublishJob: {
          create: async (args: any) => ({ id: "job-100", ...args.data }),
        },
        richMenuStoreAssignment: {
          upsert: async (args: any) => ({
            id: `asgn-${args.where.templateId_lineOfficialAccountId.lineOfficialAccountId}`,
            ...args.create,
          }),
        },
        richMenuPublishAttempt: {
          create: async (args: any) => ({ id: `att-${args.data.lineOfficialAccountId}`, ...args.data }),
        },
      });
    },
    richMenuPublishJob: {
      findUnique: async () => ({
        id: "job-100",
        templateId: "tpl-1",
        templateVersion: 1,
        status: "QUEUED",
        totalCount: 3,
        pendingCount: 3,
        processingCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        cancelledCount: 0,
        createdByUserId: "admin-1",
        startedAt: null,
        completedAt: null,
        cancelRequestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
      }),
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  // 1. Max target rejection (> 5)
  process.env.RICH_MENU_BULK_MAX_TARGETS = "5";
  await assert.rejects(
    async () => {
      await service.createBulkPublishJob(
        "tpl-1",
        { lineOfficialAccountIds: ["oa-1", "oa-2", "oa-3", "oa-4", "oa-5", "oa-6"] },
        { id: "admin-1" } as any,
      );
    },
    { message: /ขณะนี้สามารถเผยแพร่ได้สูงสุด 5 ร้านต่อครั้ง/ },
  );

  // 2. Successful creation of 3 stores
  const jobRes = await service.createBulkPublishJob(
    "tpl-1",
    { lineOfficialAccountIds: ["oa-1", "oa-2", "oa-3", "oa-1"] }, // duplicate oa-1 deduplicated
    { id: "admin-1" } as any,
  );

  assert.equal(jobRes.id, "job-100");
  assert.equal(jobRes.status, "QUEUED");
  assert.equal(jobRes.totalCount, 3);
});

test("RichMenuService.createBulkPublishJob: automatically creates/upserts missing assignments in transaction", async () => {
  const upsertedAssignments: any[] = [];
  const createdAttempts: any[] = [];

  const mockPrisma = {
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        name: "Auto Assign Menu",
        version: 1,
        imageUrl: "https://lineoppo.click/messages/media/public?key=line-media%2Foutbound%2Frich-menu%2Fimg.jpg&expires=999&signature=sig",
        assignments: [], // Notice: NO pre-existing assignments!
      }),
    },
    lineOfficialAccount: {
      findMany: async () => [
        { id: "oa-unassigned-1", name: "OA 1", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-1", store: { id: "s-1", name: "Store 1" } },
        { id: "oa-unassigned-2", name: "OA 2", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-2", store: { id: "s-2", name: "Store 2" } },
      ],
    },
    $transaction: async (fn: any) => {
      return fn({
        richMenuPublishJob: {
          create: async (args: any) => ({ id: "job-auto-1", ...args.data }),
        },
        richMenuStoreAssignment: {
          upsert: async (args: any) => {
            const asgn = {
              id: `asgn-${args.where.templateId_lineOfficialAccountId.lineOfficialAccountId}`,
              ...args.create,
            };
            upsertedAssignments.push(asgn);
            return asgn;
          },
        },
        richMenuPublishAttempt: {
          create: async (args: any) => {
            createdAttempts.push(args.data);
            return { id: `att-${args.data.lineOfficialAccountId}`, ...args.data };
          },
        },
      });
    },
    richMenuPublishJob: {
      findUnique: async () => ({
        id: "job-auto-1",
        templateId: "tpl-1",
        templateVersion: 1,
        status: "QUEUED",
        totalCount: 2,
        pendingCount: 2,
        processingCount: 0,
        publishedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        cancelledCount: 0,
        createdByUserId: "admin-1",
        startedAt: null,
        completedAt: null,
        cancelRequestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: [],
      }),
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  const jobRes = await service.createBulkPublishJob(
    "tpl-1",
    { lineOfficialAccountIds: ["oa-unassigned-1", "oa-unassigned-2"] },
    { id: "admin-1" } as any,
  );

  assert.equal(jobRes.id, "job-auto-1");
  assert.equal(upsertedAssignments.length, 2);
  assert.equal(upsertedAssignments[0].lineOfficialAccountId, "oa-unassigned-1");
  assert.equal(upsertedAssignments[1].lineOfficialAccountId, "oa-unassigned-2");
  assert.equal(createdAttempts.length, 2);
  assert.equal(createdAttempts[0].assignmentId, "asgn-oa-unassigned-1");
  assert.equal(createdAttempts[1].assignmentId, "asgn-oa-unassigned-2");
});

test("RichMenuService.publishOneStore: skips attempt if template version changed", async () => {
  const mockPrisma = {
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        name: "Promo Menu",
        version: 2, // Changed version!
        imageUrl: "https://lineoppo.click/messages/media/public?key=line-media%2Foutbound%2Frich-menu%2Fimg.jpg&expires=999&signature=sig",
        assignments: [{ id: "asgn-1", lineOfficialAccountId: "oa-1" }],
      }),
    },
    richMenuPublishAttempt: {
      update: async (args: any) => ({
        id: args.where.id,
        templateId: "tpl-1",
        lineOfficialAccountId: "oa-1",
        status: args.data.status,
        errorMessage: args.data.errorMessage,
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  const res = await service.publishOneStore({
    templateId: "tpl-1",
    lineOfficialAccountId: "oa-1",
    attemptId: "att-1",
    jobId: "job-1",
    expectedTemplateVersion: 1, // Expected 1, but template is now 2
  });

  assert.equal(res.status, "SKIPPED");
  assert.equal(res.errorMessage, "Template changed after this publishing job was created");
});

test("RichMenuPublishWorkerService: records heartbeat and processes pending jobs with bounded concurrency", async () => {
  let heartbeatRecorded = false;
  let jobUpdatedToRunning = false;
  let jobFinalizedStatus = "";
  const processedStores: string[] = [];

  const mockPrisma = {
    richMenuWorkerHeartbeat: {
      upsert: async () => {
        heartbeatRecorded = true;
      },
      findUnique: async () => ({
        id: "singleton",
        workerId: "test-worker",
        lastHeartbeatAt: new Date(),
      }),
    },
    richMenuPublishJob: {
      findFirst: async () => ({
        id: "job-1",
        templateId: "tpl-1",
        templateVersion: 1,
        status: "QUEUED",
        totalCount: 2,
        createdByUserId: "admin-1",
      }),
      findUnique: async () => ({
        id: "job-1",
        templateId: "tpl-1",
        templateVersion: 1,
        status: "RUNNING",
        totalCount: 2,
        createdByUserId: "admin-1",
        attempts: [
          { status: "PUBLISHED" },
          { status: "PUBLISHED" },
        ],
      }),
      update: async (args: any) => {
        if (args.data.status === "RUNNING") jobUpdatedToRunning = true;
        if (args.data.status === "COMPLETED") jobFinalizedStatus = "COMPLETED";
      },
    },
    richMenuPublishAttempt: {
      findMany: async (args: any) => {
        if (args.where.status === "PENDING") {
          return [
            { id: "att-1", lineOfficialAccountId: "oa-1", status: "PENDING" },
            { id: "att-2", lineOfficialAccountId: "oa-2", status: "PENDING" },
          ];
        }
        return [
          { status: "PUBLISHED" },
          { status: "PUBLISHED" },
        ];
      },
      updateMany: async () => ({ count: 1 }),
    },
  } as any;

  const mockRichMenuService = {
    publishOneStore: async (params: any) => {
      processedStores.push(params.lineOfficialAccountId);
      return { id: params.attemptId, status: "PUBLISHED" } as any;
    },
  } as any;

  const worker = new RichMenuPublishWorkerService(mockPrisma, mockRichMenuService);

  await worker.recordHeartbeat();
  assert.equal(heartbeatRecorded, true);

  const processedCount = await worker.processQueueCycle();
  assert.equal(processedCount, 2);
  assert.equal(jobUpdatedToRunning, true);
  assert.deepEqual(processedStores, ["oa-1", "oa-2"]);
  assert.equal(jobFinalizedStatus, "COMPLETED");
});

test("RichMenuService.cancelPublishJob: cancels pending attempts and marks job cancelled", async () => {
  let pendingCancelled = false;
  let jobStatus = "RUNNING";

  const mockPrisma = {
    richMenuPublishJob: {
      findUnique: async () => ({
        id: "job-cancel",
        templateId: "tpl-1",
        status: jobStatus,
        attempts: [
          { id: "att-1", status: "PUBLISHED" },
          { id: "att-2", status: "PENDING" },
        ],
      }),
      update: async (args: any) => {
        jobStatus = args.data.status;
        return {
          id: "job-cancel",
          templateId: "tpl-1",
          templateVersion: 1,
          status: args.data.status,
          totalCount: 2,
          pendingCount: 0,
          processingCount: 0,
          publishedCount: 1,
          failedCount: 0,
          skippedCount: 0,
          cancelledCount: 1,
          createdByUserId: "admin-1",
          startedAt: new Date(),
          completedAt: new Date(),
          cancelRequestedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    },
    richMenuPublishAttempt: {
      updateMany: async () => {
        pendingCancelled = true;
        return { count: 1 };
      },
      count: async () => 0, // 0 in flight
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  const res = await service.cancelPublishJob("job-cancel", { id: "admin-1" } as any);
  assert.equal(pendingCancelled, true);
  assert.equal(res.status, "CANCELLED");
});

test("RichMenuService.retryFailedJobAttempts: creates new job only for failed or skipped stores", async () => {
  let retriedIds: string[] = [];

  const mockPrisma = {
    richMenuPublishJob: {
      findUnique: async () => ({
        id: "job-orig",
        templateId: "tpl-1",
        status: "COMPLETED_WITH_ERRORS",
        attempts: [
          { lineOfficialAccountId: "oa-success", status: "PUBLISHED" },
          { lineOfficialAccountId: "oa-failed-1", status: "FAILED" },
          { lineOfficialAccountId: "oa-skipped-2", status: "SKIPPED" },
        ],
      }),
    },
    richMenuTemplate: {
      findUnique: async () => ({
        id: "tpl-1",
        version: 1,
        imageUrl: "https://lineoppo.click/messages/media/public?key=img.jpg",
        assignments: [
          { lineOfficialAccountId: "oa-failed-1" },
          { lineOfficialAccountId: "oa-skipped-2" },
        ],
      }),
    },
    lineOfficialAccount: {
      findMany: async () => [
        { id: "oa-failed-1", name: "OA Fail", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-1", store: { id: "s-fail", name: "Store Fail" } },
        { id: "oa-skipped-2", name: "OA Skip", accountType: "STORE", isActive: true, archivedAt: null, encryptedChannelAccessToken: "tok-2", store: { id: "s-skip", name: "Store Skip" } },
      ],
    },
    $transaction: async (fn: any) => {
      return fn({
        richMenuPublishJob: {
          create: async (args: any) => ({ id: "job-new-retry", ...args.data }),
        },
        richMenuStoreAssignment: {
          upsert: async (args: any) => ({
            id: `asgn-${args.where.templateId_lineOfficialAccountId.lineOfficialAccountId}`,
            ...args.create,
          }),
        },
        richMenuPublishAttempt: {
          create: async (args: any) => {
            retriedIds.push(args.data.lineOfficialAccountId);
            return { id: `att-${args.data.lineOfficialAccountId}`, ...args.data };
          },
        },
      });
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  // Stub getPublishJob
  (service as any).getPublishJob = async (id: string) => ({
    id,
    templateId: "tpl-1",
    status: "QUEUED",
    totalCount: 2,
  });

  const retryRes = await service.retryFailedJobAttempts("job-orig", { id: "admin-1" } as any);
  assert.equal(retryRes.id, "job-new-retry");
  assert.deepEqual(retriedIds, ["oa-failed-1", "oa-skipped-2"]); // oa-success was NOT retried
});

test("RichMenuService.getPublishCapabilities: returns worker readiness status from heartbeat", async () => {
  const freshDate = new Date();
  const mockPrisma = {
    richMenuWorkerHeartbeat: {
      findUnique: async () => ({
        id: "singleton",
        workerId: "test-worker",
        lastHeartbeatAt: freshDate,
      }),
    },
  } as any;

  const service = new RichMenuService(mockPrisma, {} as any, {} as any, {} as any);

  const caps = await service.getPublishCapabilities();
  assert.equal(caps.bulkEnabled, true);
  assert.equal(caps.maxTargets, 5);
  assert.equal(caps.concurrency, 2);
  assert.equal(caps.workerReady, true);
  assert.equal(caps.lastWorkerHeartbeatAt, freshDate.toISOString());
});
