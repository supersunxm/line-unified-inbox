import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findMatchingPreset,
  generateActionsForPreset,
  hasConfiguredActions,
  LANDSCAPE_PRESETS,
  PORTRAIT_PRESETS,
  PRESETS_BY_ID,
  SQUARE_PRESETS,
  validateActionUrl,
  validateRichMessageGeometry,
} from "../src/app/rich-messages/rich-message-templates.ts";

test("Square presets: exactly 12 illustrated arrangements with full coverage and 0 overlaps", () => {
  assert.equal(SQUARE_PRESETS.length, 12, "Must include exactly 12 square presets");

  for (const preset of SQUARE_PRESETS) {
    assert.equal(preset.category, "SQUARE");
    assert.equal(preset.width, 1040);
    assert.equal(preset.height, 1040);
    assert.ok(preset.areas.length >= 1 && preset.areas.length <= 6, `${preset.id} has 1-6 areas`);

    // Verify each area is within bounds
    let totalArea = 0;
    for (const area of preset.areas) {
      assert.ok(Number.isInteger(area.x) && area.x >= 0, `${preset.id} x is integer >= 0`);
      assert.ok(Number.isInteger(area.y) && area.y >= 0, `${preset.id} y is integer >= 0`);
      assert.ok(Number.isInteger(area.width) && area.width >= 1, `${preset.id} width is integer >= 1`);
      assert.ok(Number.isInteger(area.height) && area.height >= 1, `${preset.id} height is integer >= 1`);
      assert.ok(area.x + area.width <= 1040, `${preset.id} x + width <= 1040`);
      assert.ok(area.y + area.height <= 1040, `${preset.id} y + height <= 1040`);
      totalArea += area.width * area.height;
    }

    // Verify 100% canvas coverage: total area of sum of parts must equal 1040 * 1040
    assert.equal(totalArea, 1040 * 1040, `${preset.id} must cover 100% of 1040x1040`);

    // Verify zero overlap between all area pairs
    for (let i = 0; i < preset.areas.length; i++) {
      const a = preset.areas[i];
      for (let j = i + 1; j < preset.areas.length; j++) {
        const b = preset.areas[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        assert.equal(overlaps, false, `${preset.id} area ${a.id} must not overlap with area ${b.id}`);
      }
    }

    // Verify geometry validation passes
    const actions = generateActionsForPreset(preset);
    const result = validateRichMessageGeometry(actions, preset.width, preset.height);
    assert.equal(result.valid, true, `${preset.id} geometry must be valid: ${result.errors.join(", ")}`);
  }
});

test("Edge rounding: 3 horizontal rows and 6 grid items cover exactly 1040 with 0 gaps or overlaps", () => {
  // square-3-h (Template D)
  const square3H = PRESETS_BY_ID["square-3-h"];
  assert.ok(square3H);
  assert.equal(square3H.areas.length, 3);
  assert.equal(square3H.areas[0].height, 347);
  assert.equal(square3H.areas[1].height, 347);
  assert.equal(square3H.areas[2].height, 346);
  assert.equal(347 + 347 + 346, 1040);
  assert.equal(square3H.areas[1].y, 347);
  assert.equal(square3H.areas[2].y, 694);

  // square-6-grid (Template H)
  const square6Grid = PRESETS_BY_ID["square-6-grid"];
  assert.ok(square6Grid);
  assert.equal(square6Grid.areas.length, 6);
  assert.equal(square6Grid.areas[0].height, 347);
  assert.equal(square6Grid.areas[2].height, 347);
  assert.equal(square6Grid.areas[4].height, 346);
  assert.equal(square6Grid.areas[0].width, 520);
  assert.equal(square6Grid.areas[1].width, 520);

  // square-2-top23-bottom13 (Template I)
  const squareI = PRESETS_BY_ID["square-2-top23-bottom13"];
  assert.ok(squareI);
  assert.equal(squareI.areas[0].height, 694);
  assert.equal(squareI.areas[1].height, 346);
  assert.equal(694 + 346, 1040);

  // landscape-3-v (3 vertical columns in landscape)
  const landscape3V = PRESETS_BY_ID["landscape-3-v"];
  assert.ok(landscape3V);
  assert.equal(landscape3V.areas[0].width, 347);
  assert.equal(landscape3V.areas[1].width, 347);
  assert.equal(landscape3V.areas[2].width, 346);
  assert.equal(347 + 347 + 346, 1040);

  // portrait-3-h (3 rows in portrait 1300)
  const portrait3H = PRESETS_BY_ID["portrait-3-h"];
  assert.ok(portrait3H);
  assert.equal(portrait3H.areas[0].height, 433);
  assert.equal(portrait3H.areas[1].height, 433);
  assert.equal(portrait3H.areas[2].height, 434);
  assert.equal(433 + 433 + 434, 1300);
});

test("Landscape and Portrait presets: fully bounded, non-overlapping, and 100% coverage", () => {
  for (const preset of [...LANDSCAPE_PRESETS, ...PORTRAIT_PRESETS]) {
    assert.equal(preset.width, 1040);
    assert.ok(preset.height >= 350 && preset.height <= 2080);

    let totalArea = 0;
    for (const area of preset.areas) {
      assert.ok(area.x >= 0 && area.y >= 0);
      assert.ok(area.width >= 1 && area.height >= 1);
      assert.ok(area.x + area.width <= preset.width);
      assert.ok(area.y + area.height <= preset.height);
      totalArea += area.width * area.height;
    }

    assert.equal(totalArea, preset.width * preset.height, `${preset.id} full area coverage`);

    // Verify non-overlapping
    for (let i = 0; i < preset.areas.length; i++) {
      const a = preset.areas[i];
      for (let j = i + 1; j < preset.areas.length; j++) {
        const b = preset.areas[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        assert.equal(overlaps, false, `${preset.id} overlaps`);
      }
    }
  }
});

test("Action URL security: blocks dangerous schemes and allows safe schemes", () => {
  assert.equal(validateActionUrl("https://oppo.com/th").valid, true);
  assert.equal(validateActionUrl("http://oppo.com").valid, true);
  assert.equal(validateActionUrl("line://ti/p/@oppo").valid, true);
  assert.equal(validateActionUrl("tel:021234567").valid, true);

  assert.equal(validateActionUrl("javascript:alert(1)").valid, false);
  assert.equal(validateActionUrl("JAVASCRIPT:void(0)").valid, false);
  assert.equal(validateActionUrl("data:text/html,bad").valid, false);
  assert.equal(validateActionUrl("file:///etc/passwd").valid, false);
  assert.equal(validateActionUrl("vbscript:msgbox(1)").valid, false);
  assert.equal(validateActionUrl("ftp://files.com").valid, false);
  assert.equal(validateActionUrl("").valid, false);
});

test("Non-square image upload dimension scaling: respects aspect ratio up to 2080 max", () => {
  const computeHeight = (width: number, height: number) => {
    return Math.min(2080, Math.max(1, Math.round((height / width) * 1040)));
  };

  // Square
  assert.equal(computeHeight(1000, 1000), 1040);
  assert.equal(computeHeight(2000, 2000), 1040);

  // Landscape
  assert.equal(computeHeight(1040, 520), 520);
  assert.equal(computeHeight(2000, 1000), 520);
  assert.equal(computeHeight(1040, 350), 350);

  // Portrait
  assert.equal(computeHeight(1040, 1300), 1300);
  assert.equal(computeHeight(1040, 1850), 1850);
  assert.equal(computeHeight(1040, 2080), 2080);

  // Very tall portrait (clamped to max 2080)
  assert.equal(computeHeight(1040, 3000), 2080);
  assert.equal(computeHeight(500, 2500), 2080);
});

test("Template switching: detects configured actions vs untouched blank actions", () => {
  const blank = generateActionsForPreset(PRESETS_BY_ID["square-1"]);
  assert.equal(hasConfiguredActions(blank), false);

  const configuredUri = generateActionsForPreset(PRESETS_BY_ID["square-1"]);
  configuredUri[0].value = "https://oppo.com/promo";
  assert.equal(hasConfiguredActions(configuredUri), true);

  const configuredMessage = generateActionsForPreset(PRESETS_BY_ID["square-1"]);
  configuredMessage[0].type = "MESSAGE";
  configuredMessage[0].value = "Contact staff";
  assert.equal(hasConfiguredActions(configuredMessage), true);
});

test("Backward compatibility: matching old saved records with existing geometries", () => {
  // Old 1-area square record
  const legacySquare1 = [
    { id: "old-1", type: "URI" as const, value: "https://oppo.com", area: { x: 0, y: 0, width: 1040, height: 1040 } },
  ];
  const matchSquare1 = findMatchingPreset(legacySquare1, 1040);
  assert.equal(matchSquare1?.id, "square-1");

  // Old 4-quadrant record
  const legacySquare4 = [
    { id: "1", type: "URI" as const, value: "https://1.com", area: { x: 0, y: 0, width: 520, height: 520 } },
    { id: "2", type: "URI" as const, value: "https://2.com", area: { x: 520, y: 0, width: 520, height: 520 } },
    { id: "3", type: "URI" as const, value: "https://3.com", area: { x: 0, y: 520, width: 520, height: 520 } },
    { id: "4", type: "URI" as const, value: "https://4.com", area: { x: 520, y: 520, width: 520, height: 520 } },
  ];
  const matchSquare4 = findMatchingPreset(legacySquare4, 1040);
  assert.equal(matchSquare4?.id, "square-4-grid");

  // Custom arbitrary coordinates
  const customActions = [
    { id: "c1", type: "URI" as const, value: "https://c.com", area: { x: 10, y: 20, width: 500, height: 400 } },
  ];
  const matchCustom = findMatchingPreset(customActions, 1040);
  assert.equal(matchCustom, null);
});

test("RichMessagesView component: includes template picker trigger, modal, live overlays, and advanced coordinates", () => {
  const viewContent = readFileSync(new URL("../src/app/rich-messages/rich-messages-view.tsx", import.meta.url), "utf8");

  // Template picker button and modal integration
  assert.match(viewContent, /t\.selectTemplate/);
  assert.match(viewContent, /RichMessageTemplateModal/);
  assert.match(viewContent, /handleTemplateSelection/);

  // Template replacement confirmation
  assert.match(viewContent, /isWarningOpen/);
  assert.match(viewContent, /t\.templateNoticeTitle/);
  assert.match(viewContent, /t\.templateNoticeDesc/);
  assert.match(viewContent, /confirmTemplateChange/);

  // Advanced coordinates toggle
  assert.match(viewContent, /t\.advancedCoordinates/);
  assert.match(viewContent, /t\.hideAdvancedCoordinates/);
  assert.match(viewContent, /showCoordinates/);

  // Live clickable overlay with letter badges
  assert.match(viewContent, /activeActionIndex/);
  assert.match(viewContent, /AREA_LABELS/);
  assert.match(viewContent, /action-card-/);

  // Height audit allowing up to 2080
  assert.match(viewContent, /Math\.min\(2080,\s*Math\.max\(1,\s*Math\.round\(\(result\.height \/ result\.width\) \* 1040\)\)\)/);
});

test("Geometry validation: rejects newly overlapping geometry but allows legacy overlap when geometry is unchanged", () => {
  const overlappingActions = [
    { id: "1", type: "URI" as const, value: "https://1.com", area: { x: 0, y: 0, width: 600, height: 1040 } },
    { id: "2", type: "URI" as const, value: "https://2.com", area: { x: 400, y: 0, width: 640, height: 1040 } },
  ];

  // Default / newly submitted overlap is rejected
  const defaultCheck = validateRichMessageGeometry(overlappingActions, 1040, 1040);
  assert.equal(defaultCheck.valid, false);
  assert.ok(defaultCheck.errors.some((e) => e.includes("overlaps")));

  // Explicit allowLegacyOverlap=false is rejected
  const strictCheck = validateRichMessageGeometry(overlappingActions, 1040, 1040, { allowLegacyOverlap: false });
  assert.equal(strictCheck.valid, false);

  // allowLegacyOverlap=true (metadata-only update of legacy record) succeeds
  const legacyCheck = validateRichMessageGeometry(overlappingActions, 1040, 1040, { allowLegacyOverlap: true });
  assert.equal(legacyCheck.valid, true);
  assert.equal(legacyCheck.errors.length, 0);
});

