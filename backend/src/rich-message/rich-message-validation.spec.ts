import { strict as assert } from "node:assert";
import { test } from "node:test";
import { RichMessageService } from "./rich-message.service";
import type { CreateRichMessageDto } from "./rich-message.types";

// Mock minimal dependencies for testing validateAndNormalize
function createTestService() {
  const fakePrisma: any = {};
  const fakeStorage: any = {};
  const fakeAudit: any = {};
  return new RichMessageService(fakePrisma, fakeStorage, fakeAudit);
}

test("RichMessageService: baseWidth must be exactly 1040", () => {
  const service = createTestService();
  const dto: CreateRichMessageDto = {
    name: "Test",
    altText: "Alt",
    mediaObjectKey: "line-media/greeting/test.jpg",
    baseWidth: 1000,
    baseHeight: 1040,
    actions: [
      { id: "1", type: "URI", value: "https://example.com", area: { x: 0, y: 0, width: 1000, height: 1040 } },
    ],
  };

  assert.throws(() => (service as any).validateAndNormalize(dto), {
    message: "Rich Message base width must be 1040 pixels",
  });
});

test("RichMessageService: baseHeight allows 1 to 2080 (Square, Landscape, Portrait)", () => {
  const service = createTestService();

  const validHeights = [350, 520, 1040, 1300, 1850, 2080];
  for (const height of validHeights) {
    const dto: CreateRichMessageDto = {
      name: `Height ${height}`,
      altText: "Alt",
      mediaObjectKey: "line-media/greeting/test.jpg",
      baseWidth: 1040,
      baseHeight: height,
      actions: [
        { id: "1", type: "URI", value: "https://example.com", area: { x: 0, y: 0, width: 1040, height } },
      ],
    };
    const normalized = (service as any).validateAndNormalize(dto);
    assert.equal(normalized.baseHeight, height);
  }

  // Reject invalid heights
  for (const invalid of [0, -1, 2081, 1040.5]) {
    const dto: CreateRichMessageDto = {
      name: "Invalid Height",
      altText: "Alt",
      mediaObjectKey: "line-media/greeting/test.jpg",
      baseWidth: 1040,
      baseHeight: invalid,
      actions: [
        { id: "1", type: "URI", value: "https://example.com", area: { x: 0, y: 0, width: 1040, height: 100 } },
      ],
    };
    assert.throws(() => (service as any).validateAndNormalize(dto), {
      message: "Rich Message base height must be between 1 and 2080 pixels",
    });
  }
});

test("RichMessageService: validates action counts (1 to 50)", () => {
  const service = createTestService();

  assert.throws(
    () =>
      (service as any).validateAndNormalize({
        name: "Zero Actions",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1040,
        actions: [],
      }),
    { message: "Rich Message must contain between 1 and 50 tappable areas" },
  );

  const tooMany = Array.from({ length: 51 }, (_, i) => ({
    id: `act-${i}`,
    type: "URI" as const,
    value: "https://example.com",
    area: { x: 0, y: i * 20, width: 1040, height: 15 },
  }));

  assert.throws(
    () =>
      (service as any).validateAndNormalize({
        name: "51 Actions",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1040,
        actions: tooMany,
      }),
    { message: "Rich Message must contain between 1 and 50 tappable areas" },
  );
});

test("RichMessageService: blocks unsafe URL schemes and allows safe schemes", () => {
  const service = createTestService();

  const unsafeUrls = [
    "javascript:alert(1)",
    "JAVASCRIPT:void(0)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "not-a-url",
  ];

  for (const url of unsafeUrls) {
    const dto: CreateRichMessageDto = {
      name: "Unsafe URL",
      altText: "Alt",
      mediaObjectKey: "line-media/greeting/test.jpg",
      baseWidth: 1040,
      baseHeight: 1040,
      actions: [
        { id: "1", type: "URI", value: url, area: { x: 0, y: 0, width: 1040, height: 1040 } },
      ],
    };
    assert.throws(
      () => (service as any).validateAndNormalize(dto),
      (err: any) => err.message.includes("invalid or unsafe URL"),
      `Should reject unsafe URL: ${url}`,
    );
  }

  const safeUrls = [
    "https://example.com/page",
    "http://example.com/promo",
    "line://ti/p/@store123",
    "tel:021234567",
  ];

  for (const url of safeUrls) {
    const dto: CreateRichMessageDto = {
      name: "Safe URL",
      altText: "Alt",
      mediaObjectKey: "line-media/greeting/test.jpg",
      baseWidth: 1040,
      baseHeight: 1040,
      actions: [
        { id: "1", type: "URI", value: url, area: { x: 0, y: 0, width: 1040, height: 1040 } },
      ],
    };
    const result = (service as any).validateAndNormalize(dto);
    assert.equal(result.actions[0].value, url);
  }
});

test("RichMessageService: validates MESSAGE action character limit", () => {
  const service = createTestService();

  const longMessage = "a".repeat(401);
  const dto: CreateRichMessageDto = {
    name: "Too long message",
    altText: "Alt",
    mediaObjectKey: "line-media/greeting/test.jpg",
    baseWidth: 1040,
    baseHeight: 1040,
    actions: [
      { id: "1", type: "MESSAGE", value: longMessage, area: { x: 0, y: 0, width: 1040, height: 1040 } },
    ],
  };

  assert.throws(
    () => (service as any).validateAndNormalize(dto),
    (err: any) => err.message.includes("cannot exceed 400 characters"),
  );

  const validMessage = "a".repeat(400);
  dto.actions[0].value = validMessage;
  const result = (service as any).validateAndNormalize(dto);
  assert.equal(result.actions[0].value, validMessage);
});

test("RichMessageService: detects and rejects overlapping areas", () => {
  const service = createTestService();

  const overlappingDto: CreateRichMessageDto = {
    name: "Overlapping",
    altText: "Alt",
    mediaObjectKey: "line-media/greeting/test.jpg",
    baseWidth: 1040,
    baseHeight: 1040,
    actions: [
      { id: "1", type: "URI", value: "https://a.com", area: { x: 0, y: 0, width: 600, height: 600 } },
      { id: "2", type: "URI", value: "https://b.com", area: { x: 500, y: 500, width: 540, height: 540 } },
    ],
  };

  assert.throws(
    () => (service as any).validateAndNormalize(overlappingDto),
    (err: any) => err.message.includes("overlaps with action"),
  );
});

test("RichMessageService: accepts adjacent non-overlapping areas", () => {
  const service = createTestService();

  // 4 quadrants touching borders but not overlapping
  const adjacentDto: CreateRichMessageDto = {
    name: "Quadrants",
    altText: "Alt",
    mediaObjectKey: "line-media/greeting/test.jpg",
    baseWidth: 1040,
    baseHeight: 1040,
    actions: [
      { id: "1", type: "URI", value: "https://1.com", area: { x: 0, y: 0, width: 520, height: 520 } },
      { id: "2", type: "URI", value: "https://2.com", area: { x: 520, y: 0, width: 520, height: 520 } },
      { id: "3", type: "MESSAGE", value: "Msg 3", area: { x: 0, y: 520, width: 520, height: 520 } },
      { id: "4", type: "MESSAGE", value: "Msg 4", area: { x: 520, y: 520, width: 520, height: 520 } },
    ],
  };

  const result = (service as any).validateAndNormalize(adjacentDto);
  assert.equal(result.actions.length, 4);
});

test("RichMessageService: rejects out-of-bounds coordinates", () => {
  const service = createTestService();

  // Exceeds width
  assert.throws(
    () =>
      (service as any).validateAndNormalize({
        name: "Exceed Width",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1040,
        actions: [
          { id: "1", type: "URI", value: "https://a.com", area: { x: 500, y: 0, width: 550, height: 520 } },
        ],
      }),
    (err: any) => err.message.includes("exceeds the image bounds"),
  );

  // Exceeds height in portrait
  assert.throws(
    () =>
      (service as any).validateAndNormalize({
        name: "Exceed Portrait Height",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1300,
        actions: [
          { id: "1", type: "URI", value: "https://a.com", area: { x: 0, y: 700, width: 1040, height: 650 } },
        ],
      }),
    (err: any) => err.message.includes("exceeds the image bounds"),
  );

  // Negative coordinates
  assert.throws(
    () =>
      (service as any).validateAndNormalize({
        name: "Negative",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1040,
        actions: [
          { id: "1", type: "URI", value: "https://a.com", area: { x: -10, y: 0, width: 520, height: 520 } },
        ],
      }),
    (err: any) => err.message.includes("exceeds the image bounds"),
  );
});

test("RichMessageService: legacy overlapping actions load, serialize, and allow metadata-only update", async () => {
  // 1. Synthetic existing Rich Message with overlapping areas (e.g. area 1 covers 0..600, area 2 covers 400..1040)
  const legacyRecord = {
    id: "legacy-rm-1",
    name: "Legacy Overlapping Campaign",
    description: "Created before overlap check",
    altText: "Legacy Alt Text",
    mediaObjectKey: "line-media/greeting/legacy.jpg",
    previewObjectKey: null,
    baseWidth: 1040,
    baseHeight: 1040,
    actionsJson: JSON.stringify([
      { id: "act-1", type: "URI", value: "https://example.com/promo1", area: { x: 0, y: 0, width: 600, height: 1040 } },
      { id: "act-2", type: "URI", value: "https://example.com/promo2", area: { x: 400, y: 0, width: 640, height: 1040 } },
    ]),
    isActive: true,
    createdByUserId: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  let executedSql = "";
  const mockPrisma: any = {
    $queryRaw: async () => [legacyRecord],
    $executeRaw: async (query: any) => {
      executedSql = JSON.stringify(query);
      return 1;
    },
  };
  const mockStorage: any = {};
  const mockAudit: any = { record: async () => {} };
  const service = new RichMessageService(mockPrisma, mockStorage, mockAudit);

  // 2. Verify it can be loaded and displayed via serialize
  const serialized = (service as any).serialize(legacyRecord);
  assert.equal(serialized.id, "legacy-rm-1");
  assert.equal(serialized.actions.length, 2);
  assert.equal(serialized.actions[0].area.width, 600);
  assert.equal(serialized.actions[1].area.x, 400);

  // 3. Verify a name-only update succeeds without altering action geometry
  const updatedByName = await service.update("legacy-rm-1", { name: "Renamed Campaign" });
  assert.ok(updatedByName);
  assert.ok(executedSql.includes("Renamed Campaign"));
  // Ensure overlapping actions were preserved
  assert.ok(executedSql.includes("promo1"));
  assert.ok(executedSql.includes("promo2"));

  // Verify description-only update succeeds
  const updatedByDesc = await service.update("legacy-rm-1", { description: "Updated Description" });
  assert.ok(updatedByDesc);

  // 4. Verify newly submitted overlapping geometry is REJECTED
  await assert.rejects(
    async () =>
      service.update("legacy-rm-1", {
        actions: [
          { id: "new-1", type: "URI", value: "https://new.com/1", area: { x: 0, y: 0, width: 700, height: 1040 } },
          { id: "new-2", type: "URI", value: "https://new.com/2", area: { x: 500, y: 0, width: 540, height: 1040 } },
        ],
      }),
    (err: any) => err.message.includes("overlaps with action"),
  );

  // Verify newly created overlapping message is REJECTED
  await assert.rejects(
    async () =>
      service.create({
        name: "New Overlapping",
        altText: "Alt",
        mediaObjectKey: "line-media/greeting/test.jpg",
        baseWidth: 1040,
        baseHeight: 1040,
        actions: [
          { id: "1", type: "URI", value: "https://a.com", area: { x: 0, y: 0, width: 600, height: 500 } },
          { id: "2", type: "URI", value: "https://b.com", area: { x: 300, y: 0, width: 600, height: 500 } },
        ],
      }),
    (err: any) => err.message.includes("overlaps with action"),
  );
});

test("RichMessageService: rollback compatibility analysis for baseHeight > 1040", async () => {
  // Synthetic portrait record created with new code (baseHeight: 2080)
  const portraitRecord = {
    id: "portrait-rm-2080",
    name: "Tall Portrait Catalog",
    description: "1040x2080 full portrait",
    altText: "Portrait Alt",
    mediaObjectKey: "line-media/greeting/portrait.jpg",
    previewObjectKey: null,
    baseWidth: 1040,
    baseHeight: 2080,
    actionsJson: JSON.stringify([
      { id: "p1", type: "URI", value: "https://oppo.com/top", area: { x: 0, y: 0, width: 1040, height: 1040 } },
      { id: "p2", type: "URI", value: "https://oppo.com/bot", area: { x: 0, y: 1040, width: 1040, height: 1040 } },
    ]),
    isActive: true,
    createdByUserId: "user-1",
    createdAt: new Date("2026-10-14"),
    updatedAt: new Date("2026-10-14"),
  };

  const mockPrisma: any = {
    $queryRaw: async () => [portraitRecord],
  };
  const mockStorage: any = {};
  const mockAudit: any = { record: async () => {} };
  const service = new RichMessageService(mockPrisma, mockStorage, mockAudit);

  // 1. Reading & Displaying: serialize preserves baseHeight 2080 without schema failure
  const loaded = (service as any).serialize(portraitRecord);
  assert.equal(loaded.baseHeight, 2080);
  assert.equal(loaded.actions.length, 2);

  // 2. LINE Imagemap payload generation: buildLineImagemap produces valid LINE payload
  const linePayload = await service.buildLineImagemap("portrait-rm-2080");
  assert.equal(linePayload.type, "imagemap");
  assert.equal(linePayload.baseSize.width, 1040);
  assert.equal(linePayload.baseSize.height, 2080);
  assert.equal(linePayload.actions.length, 2);

  // 3. Rollback Behavior Simulation:
  // In the old backend code, baseHeight validation was:
  // if (!Number.isInteger(baseHeight) || baseHeight < 1 || baseHeight > 1040)
  const oldValidateAndNormalize = (baseHeight: number) => {
    if (!Number.isInteger(baseHeight) || baseHeight < 1 || baseHeight > 1040) {
      throw new Error("Rich Message base height must be between 1 and 1040 pixels");
    }
  };

  // Verifying: Old backend would reject editing the 2080h record
  assert.throws(
    () => oldValidateAndNormalize(portraitRecord.baseHeight),
    { message: "Rich Message base height must be between 1 and 1040 pixels" },
  );
});

