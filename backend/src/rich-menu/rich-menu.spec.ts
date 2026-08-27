import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePresetAreas,
  validateRichMenuAreas,
  RichMenuCanvasPreset,
} from "./rich-menu.types";
import { RichMenuPublishNoopAdapter } from "./rich-menu.service";

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
