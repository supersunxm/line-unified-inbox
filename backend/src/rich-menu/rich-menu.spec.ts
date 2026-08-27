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
import { createMediaPublicUrl, verifyMediaPublicUrl } from "../media/media-public-url";
import { MediaStorageService } from "../media/media-storage";
import { MediaModule } from "../media/media.module";
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

test("NestJS DI regression test: RichMenuService resolves with required MediaStorageService", async () => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RichMenuService,
      MediaStorageService,
      {
        provide: PrismaService,
        useValue: {},
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

test("Module wiring test: RichMenuModule imports MediaModule and exports RichMenuService", () => {
  const richMenuImports = Reflect.getMetadata("imports", RichMenuModule);
  assert.ok(richMenuImports.includes(MediaModule), "RichMenuModule must import MediaModule");

  const richMenuExports = Reflect.getMetadata("exports", RichMenuModule);
  assert.ok(richMenuExports.includes(RichMenuService), "RichMenuModule must export RichMenuService");

  const mediaExports = Reflect.getMetadata("exports", MediaModule);
  assert.ok(mediaExports.includes(MediaStorageService), "MediaModule must export MediaStorageService");
});
