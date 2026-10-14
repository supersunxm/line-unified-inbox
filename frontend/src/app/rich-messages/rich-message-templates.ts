import type { RichMessageAction } from "./rich-message-api";
import type { RichMessageTranslations } from "./rich-messages-i18n";

export type TemplateCategory = "SQUARE" | "LANDSCAPE" | "PORTRAIT" | "CUSTOM";

export interface PresetAreaDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RichMessageTemplatePreset {
  id: string;
  category: TemplateCategory;
  nameKey: keyof RichMessageTranslations;
  descriptionKey?: keyof RichMessageTranslations;
  width: 1040;
  height: number;
  areas: PresetAreaDefinition[];
}

export const AREA_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/**
 * 12 Illustrated Square Arrangements (1040x1040)
 * Modeled on LINE Official Account Manager rich message template specifications.
 * All areas have deterministic, non-overlapping integer coordinates covering 100% of 1040x1040.
 */
export const SQUARE_PRESETS: RichMessageTemplatePreset[] = [
  {
    id: "square-1",
    category: "SQUARE",
    nameKey: "templateSquare1",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 1040 },
    ],
  },
  {
    id: "square-2-v",
    category: "SQUARE",
    nameKey: "templateSquare2V",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 1040 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 1040 },
    ],
  },
  {
    id: "square-2-h",
    category: "SQUARE",
    nameKey: "templateSquare2H",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 520 },
      { id: "B", label: "B", x: 0, y: 520, width: 1040, height: 520 },
    ],
  },
  {
    id: "square-3-h",
    category: "SQUARE",
    nameKey: "templateSquare3H",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 347 },
      { id: "B", label: "B", x: 0, y: 347, width: 1040, height: 347 },
      { id: "C", label: "C", x: 0, y: 694, width: 1040, height: 346 },
    ],
  },
  {
    id: "square-4-grid",
    category: "SQUARE",
    nameKey: "templateSquare4Grid",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 520 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 520 },
      { id: "C", label: "C", x: 0, y: 520, width: 520, height: 520 },
      { id: "D", label: "D", x: 520, y: 520, width: 520, height: 520 },
    ],
  },
  {
    id: "square-3-top1-bottom2",
    category: "SQUARE",
    nameKey: "templateSquare3Top1Bottom2",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 520 },
      { id: "B", label: "B", x: 0, y: 520, width: 520, height: 520 },
      { id: "C", label: "C", x: 520, y: 520, width: 520, height: 520 },
    ],
  },
  {
    id: "square-3-top1-bottom2-rows",
    category: "SQUARE",
    nameKey: "templateSquare3Top1Bottom2Rows",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 520 },
      { id: "B", label: "B", x: 0, y: 520, width: 1040, height: 260 },
      { id: "C", label: "C", x: 0, y: 780, width: 1040, height: 260 },
    ],
  },
  {
    id: "square-6-grid",
    category: "SQUARE",
    nameKey: "templateSquare6Grid",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 347 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 347 },
      { id: "C", label: "C", x: 0, y: 347, width: 520, height: 347 },
      { id: "D", label: "D", x: 520, y: 347, width: 520, height: 347 },
      { id: "E", label: "E", x: 0, y: 694, width: 520, height: 346 },
      { id: "F", label: "F", x: 520, y: 694, width: 520, height: 346 },
    ],
  },
  {
    id: "square-2-top23-bottom13",
    category: "SQUARE",
    nameKey: "templateSquare2Top23Bottom13",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 694 },
      { id: "B", label: "B", x: 0, y: 694, width: 1040, height: 346 },
    ],
  },
  {
    id: "square-3-top23-bottom2",
    category: "SQUARE",
    nameKey: "templateSquare3Top23Bottom2",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 694 },
      { id: "B", label: "B", x: 0, y: 694, width: 520, height: 346 },
      { id: "C", label: "C", x: 520, y: 694, width: 520, height: 346 },
    ],
  },
  {
    id: "square-3-left1-right2",
    category: "SQUARE",
    nameKey: "templateSquare3Left1Right2",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 1040 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 520 },
      { id: "C", label: "C", x: 520, y: 520, width: 520, height: 520 },
    ],
  },
  {
    id: "square-3-left2-right1",
    category: "SQUARE",
    nameKey: "templateSquare3Left2Right1",
    width: 1040,
    height: 1040,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 520 },
      { id: "B", label: "B", x: 0, y: 520, width: 520, height: 520 },
      { id: "C", label: "C", x: 520, y: 0, width: 520, height: 1040 },
    ],
  },
];

/**
 * Verified Landscape Presets (Width 1040, Height 520 / 350)
 */
export const LANDSCAPE_PRESETS: RichMessageTemplatePreset[] = [
  {
    id: "landscape-1",
    category: "LANDSCAPE",
    nameKey: "templateLandscape1",
    width: 1040,
    height: 520,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 520 },
    ],
  },
  {
    id: "landscape-2-v",
    category: "LANDSCAPE",
    nameKey: "templateLandscape2V",
    width: 1040,
    height: 520,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 520 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 520 },
    ],
  },
  {
    id: "landscape-2-h",
    category: "LANDSCAPE",
    nameKey: "templateLandscape2H",
    width: 1040,
    height: 520,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 260 },
      { id: "B", label: "B", x: 0, y: 260, width: 1040, height: 260 },
    ],
  },
  {
    id: "landscape-3-v",
    category: "LANDSCAPE",
    nameKey: "templateLandscape3V",
    width: 1040,
    height: 520,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 347, height: 520 },
      { id: "B", label: "B", x: 347, y: 0, width: 347, height: 520 },
      { id: "C", label: "C", x: 694, y: 0, width: 346, height: 520 },
    ],
  },
  {
    id: "landscape-banner",
    category: "LANDSCAPE",
    nameKey: "templateLandscapeBanner",
    width: 1040,
    height: 350,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 350 },
    ],
  },
  {
    id: "landscape-banner-2-v",
    category: "LANDSCAPE",
    nameKey: "templateLandscapeBanner2V",
    width: 1040,
    height: 350,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 520, height: 350 },
      { id: "B", label: "B", x: 520, y: 0, width: 520, height: 350 },
    ],
  },
];

/**
 * Verified Portrait Presets (Width 1040, Height 1300 / 1850 / 2080)
 */
export const PORTRAIT_PRESETS: RichMessageTemplatePreset[] = [
  {
    id: "portrait-1",
    category: "PORTRAIT",
    nameKey: "templatePortrait1",
    width: 1040,
    height: 1300,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 1300 },
    ],
  },
  {
    id: "portrait-2-h",
    category: "PORTRAIT",
    nameKey: "templatePortrait2H",
    width: 1040,
    height: 1300,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 650 },
      { id: "B", label: "B", x: 0, y: 650, width: 1040, height: 650 },
    ],
  },
  {
    id: "portrait-3-h",
    category: "PORTRAIT",
    nameKey: "templatePortrait3H",
    width: 1040,
    height: 1300,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 433 },
      { id: "B", label: "B", x: 0, y: 433, width: 1040, height: 433 },
      { id: "C", label: "C", x: 0, y: 866, width: 1040, height: 434 },
    ],
  },
  {
    id: "portrait-long-1",
    category: "PORTRAIT",
    nameKey: "templatePortraitLong1",
    width: 1040,
    height: 1850,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 1850 },
    ],
  },
  {
    id: "portrait-max-1",
    category: "PORTRAIT",
    nameKey: "templatePortraitMax1",
    width: 1040,
    height: 2080,
    areas: [
      { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 2080 },
    ],
  },
];

export const CUSTOM_PRESET: RichMessageTemplatePreset = {
  id: "custom",
  category: "CUSTOM",
  nameKey: "templateCustom",
  width: 1040,
  height: 1040,
  areas: [
    { id: "A", label: "A", x: 0, y: 0, width: 1040, height: 1040 },
  ],
};

export const ALL_PRESETS: RichMessageTemplatePreset[] = [
  ...SQUARE_PRESETS,
  ...LANDSCAPE_PRESETS,
  ...PORTRAIT_PRESETS,
  CUSTOM_PRESET,
];

export const PRESETS_BY_ID: Record<string, RichMessageTemplatePreset> = Object.fromEntries(
  ALL_PRESETS.map((p) => [p.id, p]),
);

/**
 * Checks if a given action has configured/custom content beyond the initial blank state.
 */
export function isActionConfigured(action: RichMessageAction): boolean {
  if (!action) return false;
  const val = action.value?.trim();
  if (!val) return false;
  if (action.type === "URI" && (val === "https://" || val === "http://")) {
    return false;
  }
  return true;
}

/**
 * Checks if the entire list of actions has any configured content.
 */
export function hasConfiguredActions(actions: RichMessageAction[]): boolean {
  return actions.some(isActionConfigured);
}

/**
 * Match existing actions and baseHeight to one of the presets.
 * Returns null if no exact preset matches (i.e. custom coordinates).
 */
export function findMatchingPreset(
  actions: RichMessageAction[],
  baseHeight: number,
): RichMessageTemplatePreset | null {
  if (!actions.length) return null;
  for (const preset of ALL_PRESETS) {
    if (preset.id === "custom") continue;
    if (preset.height !== baseHeight) continue;
    if (preset.areas.length !== actions.length) continue;

    const matches = preset.areas.every((pa, idx) => {
      const act = actions[idx];
      return (
        act &&
        act.area.x === pa.x &&
        act.area.y === pa.y &&
        act.area.width === pa.width &&
        act.area.height === pa.height
      );
    });

    if (matches) return preset;
  }
  return null;
}

/**
 * Generates fresh actions for a given preset, preserving existing action IDs when possible.
 */
export function generateActionsForPreset(
  preset: RichMessageTemplatePreset,
  existingActions: RichMessageAction[] = [],
): RichMessageAction[] {
  return preset.areas.map((areaDef, index) => {
    const existing = existingActions[index];
    const id = existing?.id || `action-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id,
      type: "URI",
      label: areaDef.label,
      value: "https://",
      area: {
        x: areaDef.x,
        y: areaDef.y,
        width: areaDef.width,
        height: areaDef.height,
      },
    };
  });
}

/**
 * Safe URI validator.
 * Blocks unsafe schemes: javascript:, vbscript:, data:, file:
 * Allows safe schemes: https://, http://, line://, tel:
 */
export function validateActionUrl(url: string): { valid: boolean; error?: string } {
  const trimmed = (url || "").trim();
  if (!trimmed) {
    return { valid: false, error: "URL cannot be empty" };
  }
  if (/^javascript:/i.test(trimmed)) {
    return { valid: false, error: "Unsafe javascript: scheme is not allowed" };
  }
  if (/^(data|file|vbscript):/i.test(trimmed)) {
    return { valid: false, error: "Unsupported URL scheme" };
  }
  if (!/^(https?:\/\/|line:\/\/|tel:)/i.test(trimmed)) {
    return { valid: false, error: "URL must begin with https://, http://, line://, or tel:" };
  }
  return { valid: true };
}

/**
 * Validates rich message geometry and actions:
 * - Count between 1 and 50
 * - Bounded by [0, baseWidth] and [0, baseHeight]
 * - Width >= 1, Height >= 1
 * - Non-overlapping areas
 * - Safe URIs and bounded MESSAGE lengths (<= 400)
 */
export function validateRichMessageGeometry(
  actions: RichMessageAction[],
  baseWidth: number,
  baseHeight: number,
  options?: { allowLegacyOverlap?: boolean },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!actions.length) {
    errors.push("Rich Message must contain at least 1 tappable area");
    return { valid: false, errors };
  }
  if (actions.length > 50) {
    errors.push("Rich Message cannot contain more than 50 tappable areas");
  }
  if (baseWidth !== 1040) {
    errors.push("Base width must be exactly 1040 pixels");
  }
  if (!Number.isInteger(baseHeight) || baseHeight < 1 || baseHeight > 2080) {
    errors.push("Base height must be between 1 and 2080 pixels");
  }

  actions.forEach((act, idx) => {
    const area = act.area;
    const num = idx + 1;
    if (!area) {
      errors.push(`Area #${num} is missing coordinate definitions`);
      return;
    }
    if (![area.x, area.y, area.width, area.height].every(Number.isInteger)) {
      errors.push(`Area #${num} coordinates must be integers`);
      return;
    }
    if (area.x < 0 || area.y < 0) {
      errors.push(`Area #${num} coordinates cannot be negative`);
    }
    if (area.width < 1 || area.height < 1) {
      errors.push(`Area #${num} width and height must be at least 1 pixel`);
    }
    if (area.x + area.width > baseWidth) {
      errors.push(`Area #${num} exceeds base width bounds (${area.x + area.width} > ${baseWidth})`);
    }
    if (area.y + area.height > baseHeight) {
      errors.push(`Area #${num} exceeds base height bounds (${area.y + area.height} > ${baseHeight})`);
    }

    if (act.type === "URI") {
      const urlCheck = validateActionUrl(act.value);
      if (!urlCheck.valid && urlCheck.error) {
        errors.push(`Area #${num} ${urlCheck.error}`);
      }
    } else if (act.type === "MESSAGE") {
      const msg = (act.value || "").trim();
      if (!msg) {
        errors.push(`Area #${num} message text cannot be empty`);
      } else if (msg.length > 400) {
        errors.push(`Area #${num} message text cannot exceed 400 characters`);
      }
    }
  });

  // Check for overlapping areas unless preserving existing legacy geometry
  if (!options?.allowLegacyOverlap) {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i].area;
      if (!a) continue;
      for (let j = i + 1; j < actions.length; j++) {
        const b = actions[j].area;
        if (!b) continue;
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        if (overlaps) {
          errors.push(`Area #${i + 1} (${AREA_LABELS[i] || i + 1}) overlaps with Area #${j + 1} (${AREA_LABELS[j] || j + 1})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
