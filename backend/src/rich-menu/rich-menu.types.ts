import { BadRequestException } from "@nestjs/common";
import { extractTemplateVariables } from "../store-master/template-variable-resolver";

export type RichMenuCanvasPreset = "GRID_6" | "GRID_3" | "GRID_4" | "CUSTOM";

export type RichMenuBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RichMenuActionType = "URI" | "MESSAGE";

export type RichMenuArea = {
  id: string;
  bounds: RichMenuBounds;
  actionType: RichMenuActionType;
  actionData: string;
  label?: string | null;
};

export type CreateRichMenuTemplateDto = {
  name: string;
  description?: string | null;
  canvasPreset?: RichMenuCanvasPreset;
  width?: number;
  height?: number;
  chatBarText?: string;
  imageUrl?: string | null;
  areas: RichMenuArea[];
};

export type UpdateRichMenuTemplateDto = Partial<CreateRichMenuTemplateDto> & {
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

export type RichMenuPreviewInputDto = {
  storeId?: string;
  lineOfficialAccountId?: string;
};

export type SaveAssignmentsDto = {
  lineOfficialAccountIds: string[];
};

export type RichMenuStoreReadinessItem = {
  lineOfficialAccountId: string;
  lineOfficialAccountName: string;
  storeId: string | null;
  externalStoreId: string | null;
  storeName: string;
  accountName: string | null;
  province: string | null;
  region: string | null;
  googleMapsUrl: string | null;
  readinessStatus: "READY" | "BLOCKED";
  readinessReason: string | null;
  selected: boolean;
};

export type RichMenuReadinessSummary = {
  total: number;
  ready: number;
  blocked: number;
  selected: number;
};

export type RichMenuPreviewResolvedArea = {
  id: string;
  bounds: RichMenuBounds;
  actionType: RichMenuActionType;
  rawActionData: string;
  resolvedActionData: string;
  label?: string | null;
  isValid: boolean;
  validationError?: string | null;
};

export type RichMenuPreviewResult = {
  template: {
    id: string;
    name: string;
    canvasPreset: string;
    width: number;
    height: number;
    chatBarText: string;
    imageUrl: string | null;
  };
  store: {
    lineOfficialAccountId: string;
    lineOfficialAccountName: string;
    storeName: string;
    externalStoreId: string | null;
    googleMapsUrl: string | null;
  };
  usedVariables: string[];
  readinessStatus: "READY" | "BLOCKED";
  readinessReason: string | null;
  areas: RichMenuPreviewResolvedArea[];
};

/**
 * Standard preset geometries for LINE Rich Menu canvas.
 */
export function generatePresetAreas(
  preset: RichMenuCanvasPreset,
  width = 2500,
  height = 1686,
): { width: number; height: number; areas: RichMenuArea[] } {
  switch (preset) {
    case "GRID_6": {
      const w = 2500;
      const h = 1686;
      const colW = Math.floor(w / 2); // 1250
      const rowH = Math.floor(h / 3); // 562
      return {
        width: w,
        height: h,
        areas: [
          { id: "area-1", bounds: { x: 0, y: 0, width: colW, height: rowH }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
          { id: "area-2", bounds: { x: colW, y: 0, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
          { id: "area-3", bounds: { x: 0, y: rowH, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
          { id: "area-4", bounds: { x: colW, y: rowH, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "บริการหลังการขาย", label: "After Sales" },
          { id: "area-5", bounds: { x: 0, y: rowH * 2, width: colW, height: h - rowH * 2 }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
          { id: "area-6", bounds: { x: colW, y: rowH * 2, width: colW, height: h - rowH * 2 }, actionType: "MESSAGE", actionData: "สอบถามราคา", label: "Inquire Price" },
        ],
      };
    }
    case "GRID_3": {
      const w = 2500;
      const h = 843;
      const colW = Math.floor(w / 3); // 833
      return {
        width: w,
        height: h,
        areas: [
          { id: "area-1", bounds: { x: 0, y: 0, width: colW, height: h }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
          { id: "area-2", bounds: { x: colW, y: 0, width: colW, height: h }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
          { id: "area-3", bounds: { x: colW * 2, y: 0, width: w - colW * 2, height: h }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
        ],
      };
    }
    case "GRID_4": {
      const w = 2500;
      const h = 1686;
      const colW = Math.floor(w / 2); // 1250
      const rowH = Math.floor(h / 2); // 843
      return {
        width: w,
        height: h,
        areas: [
          { id: "area-1", bounds: { x: 0, y: 0, width: colW, height: rowH }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
          { id: "area-2", bounds: { x: colW, y: 0, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
          { id: "area-3", bounds: { x: 0, y: rowH, width: colW, height: h - rowH }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
          { id: "area-4", bounds: { x: colW, y: rowH, width: colW, height: h - rowH }, actionType: "MESSAGE", actionData: "ติดต่อเรา", label: "Contact Us" },
        ],
      };
    }
    case "CUSTOM":
    default: {
      return {
        width: width || 2500,
        height: height || 1686,
        areas: [
          { id: "area-1", bounds: { x: 0, y: 0, width: width || 2500, height: height || 1686 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Full Area" },
        ],
      };
    }
  }
}

/**
 * Validates rich menu area coordinates and contents.
 */
export function validateRichMenuAreas(
  areas: RichMenuArea[],
  canvasWidth: number,
  canvasHeight: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(areas) || areas.length === 0) {
    errors.push("Rich menu must contain at least 1 interactive area (max 20).");
    return { valid: false, errors };
  }

  if (areas.length > 20) {
    errors.push("Rich menu cannot have more than 20 interactive areas.");
  }

  areas.forEach((area, index) => {
    const prefix = `Area ${index + 1}`;
    if (!area.bounds) {
      errors.push(`${prefix}: Missing bounds.`);
      return;
    }
    const { x, y, width, height } = area.bounds;

    if (typeof x !== "number" || x < 0) {
      errors.push(`${prefix}: x coordinate must be non-negative.`);
    }
    if (typeof y !== "number" || y < 0) {
      errors.push(`${prefix}: y coordinate must be non-negative.`);
    }
    if (typeof width !== "number" || width <= 0) {
      errors.push(`${prefix}: width must be greater than 0.`);
    }
    if (typeof height !== "number" || height <= 0) {
      errors.push(`${prefix}: height must be greater than 0.`);
    }
    if (x + width > canvasWidth) {
      errors.push(`${prefix}: horizontal bounds exceed canvas width (${x + width} > ${canvasWidth}).`);
    }
    if (y + height > canvasHeight) {
      errors.push(`${prefix}: vertical bounds exceed canvas height (${y + height} > ${canvasHeight}).`);
    }
    if (!area.actionType || (area.actionType !== "URI" && area.actionType !== "MESSAGE")) {
      errors.push(`${prefix}: actionType must be 'URI' or 'MESSAGE'.`);
    }
    if (!area.actionData || typeof area.actionData !== "string" || !area.actionData.trim()) {
      errors.push(`${prefix}: action value is required and cannot be empty.`);
    }
  });

  return { valid: errors.length === 0, errors };
}
