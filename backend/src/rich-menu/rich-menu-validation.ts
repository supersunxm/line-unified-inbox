import { isValidGoogleMapsUrl, isValidTikTokProfileUrl } from "../store-master/store-master.utils";
import {
  extractTemplateVariables,
  getStoreVariableValue,
  resolveTemplateVariables,
  StoreVariableContext,
} from "../store-master/template-variable-resolver";
import { normalizeAutoResponseMessages } from "../auto-response/auto-response.utils";
import { extractMediaObjectKey } from "../media/media-public-url";
import { RichMenuArea, validateRichMenuAreas } from "./rich-menu.types";

export type RichMenuValidationRule = {
  id: string;
  name: string;
  status: string;
  textTemplate: string | null;
  contentJson: unknown;
};

export type RichMenuValidationTarget = {
  id?: string;
  name: string;
  accountType: string;
  isActive: boolean;
  archivedAt: Date | null;
  encryptedChannelAccessToken: string | null;
  store: {
    id: string;
    name: string;
    code?: string | null;
    area?: string | null;
    region?: string | null;
    storeMaster: {
      externalStoreId: string | null;
      accountName: string;
      lineOaLink: string | null;
      lineId: string | null;
      lineManagerUrl: string | null;
      tiktokUsername: string | null;
      tiktokProfileUrl: string | null;
      googleMapsUrl: string | null;
      province: string | null;
      region: string | null;
    } | null;
  } | null;
};

export type RichMenuValidationTemplate = {
  imageUrl: string | null;
  width: number;
  height: number;
  areasJson: unknown;
};

const RUNTIME_VARIABLES = new Set([
  "user.displayName",
  "user.name",
  "customer.displayName",
]);

export function getRichMenuAutoResponseRuleId(area: RichMenuArea): string | null {
  const ruleId =
    area.autoResponseRuleId?.trim() ||
    (area.actionData?.startsWith("oppo_ar:v1:")
      ? area.actionData.slice("oppo_ar:v1:".length).trim()
      : area.actionData?.trim());
  return ruleId || null;
}

export function getRichMenuReferencedAutoResponseRuleIds(areas: RichMenuArea[]): string[] {
  return Array.from(
    new Set(
      areas
        .filter((area) => Boolean(area) && typeof area === "object" && area.actionType === "POSTBACK_AUTO_RESPONSE")
        .map(getRichMenuAutoResponseRuleId)
        .filter((ruleId): ruleId is string => Boolean(ruleId)),
    ),
  );
}

export function buildRichMenuStoreVariableContext(
  targetOa: RichMenuValidationTarget | null,
): StoreVariableContext | null {
  if (!targetOa?.store) return null;

  const storeMaster = targetOa.store.storeMaster;
  return {
    id: targetOa.store.id,
    name: targetOa.store.name,
    storeName: targetOa.store.name,
    storeId: targetOa.store.id,
    code: targetOa.store.code ?? null,
    externalStoreId: storeMaster?.externalStoreId ?? null,
    accountName: storeMaster?.accountName ?? targetOa.name,
    province: storeMaster?.province ?? targetOa.store.area ?? null,
    region: storeMaster?.region ?? targetOa.store.region ?? null,
    lineId: storeMaster?.lineId ?? null,
    lineOaLink: storeMaster?.lineOaLink ?? null,
    lineManagerUrl: storeMaster?.lineManagerUrl ?? null,
    tiktokUsername: storeMaster?.tiktokUsername ?? null,
    tiktokProfileUrl: storeMaster?.tiktokProfileUrl ?? null,
    tiktokUrl: storeMaster?.tiktokProfileUrl ?? null,
    googleMapsUrl: storeMaster?.googleMapsUrl ?? null,
    lineOfficialAccountName: targetOa.name,
    account: { name: targetOa.name },
  };
}

function addReason(reasons: string[], reason: string): void {
  const normalized = reason.trim();
  if (normalized && !reasons.includes(normalized)) reasons.push(normalized);
}

function variableLabel(variable: string): string {
  return `{{${variable.trim()}}}`;
}

function addVariableReasons(
  templateText: string,
  context: StoreVariableContext | null,
  reasons: string[],
): void {
  for (const variable of extractTemplateVariables(templateText)) {
    const normalized = variable.trim();
    if (RUNTIME_VARIABLES.has(normalized)) continue;

    const value = getStoreVariableValue(normalized, context);
    const prop = normalized.startsWith("store.") ? normalized.slice("store.".length) : normalized;

    if (prop === "googleMapsUrl") {
      if (!value) addReason(reasons, "ไม่มี Google Maps URL");
      else if (!isValidGoogleMapsUrl(value)) addReason(reasons, "Google Maps URL ไม่ถูกต้อง");
      continue;
    }

    if (prop === "tiktokUrl" || prop === "tiktokProfileUrl") {
      if (!value) addReason(reasons, "ไม่มี TikTok URL");
      else if (!isValidTikTokProfileUrl(value)) addReason(reasons, "TikTok URL ไม่ถูกต้อง");
      continue;
    }

    if (!value) addReason(reasons, `ข้อมูลร้านไม่ครบ: ${variableLabel(normalized)}`);
  }
}

function addUnresolvedVariableReasons(
  resolvedText: string,
  reasons: string[],
): void {
  const unresolved = resolvedText.match(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g) || [];
  for (const variable of unresolved) addReason(reasons, `ข้อมูลร้านไม่ครบ: ${variable}`);
}

function hasPreflightVariableIssue(
  templateText: string,
  context: StoreVariableContext | null,
): boolean {
  return extractTemplateVariables(templateText).some((variable) => {
    const normalized = variable.trim();
    if (RUNTIME_VARIABLES.has(normalized)) return false;
    const value = getStoreVariableValue(normalized, context);
    const prop = normalized.startsWith("store.") ? normalized.slice("store.".length) : normalized;
    if (prop === "googleMapsUrl") return !value || !isValidGoogleMapsUrl(value);
    if (prop === "tiktokUrl" || prop === "tiktokProfileUrl") return !value || !isValidTikTokProfileUrl(value);
    return !value;
  });
}

function getAreaLabel(area: RichMenuArea): string {
  return area.label?.trim() || area.id;
}

/**
 * The single deterministic preflight contract shared by readiness and publishing.
 * It intentionally excludes LINE API, network, timeout, rate-limit, and other runtime errors.
 */
export function collectRichMenuPreflightReasons(input: {
  template: RichMenuValidationTemplate;
  targetOa: RichMenuValidationTarget | null;
  autoResponseRules: RichMenuValidationRule[];
}): string[] {
  const { template, targetOa, autoResponseRules } = input;
  const reasons: string[] = [];
  const areas = Array.isArray(template.areasJson)
    ? (template.areasJson as RichMenuArea[])
    : [];

  if (!template.imageUrl?.trim()) {
    addReason(reasons, "Rich Menu template ไม่มีรูปภาพ");
  } else if (!extractMediaObjectKey(template.imageUrl)) {
    addReason(reasons, "Rich Menu template image URL ไม่ถูกต้อง");
  }

  const areaValidation = validateRichMenuAreas(areas, template.width, template.height);
  for (const error of areaValidation.errors) {
    addReason(reasons, `รูปแบบพื้นที่ Rich Menu ไม่ถูกต้อง: ${error}`);
  }

  if (!targetOa) {
    addReason(reasons, "ไม่พบ LINE OA เป้าหมาย");
    return reasons;
  }

  if (targetOa.accountType !== "STORE") {
    addReason(reasons, "LINE OA ไม่ใช่บัญชี Store");
  }
  if (!targetOa.isActive) addReason(reasons, "LINE OA ถูกปิดใช้งาน");
  if (targetOa.archivedAt) addReason(reasons, "LINE OA ถูกเก็บถาวร");
  if (!targetOa.encryptedChannelAccessToken) {
    addReason(reasons, "LINE OA ไม่มี Channel Access Token");
  }
  if (!targetOa.store) addReason(reasons, "LINE OA ยังไม่ได้เชื่อมกับ Store");

  const context = buildRichMenuStoreVariableContext(targetOa);
  const rulesById = new Map(autoResponseRules.map((rule) => [rule.id, rule]));

  for (const area of areas) {
    if (!area || typeof area !== "object") continue;
    if (area.actionType === "POSTBACK_AUTO_RESPONSE") {
      const ruleId = getRichMenuAutoResponseRuleId(area);
      if (!ruleId) {
        addReason(reasons, `พื้นที่ "${getAreaLabel(area)}" ยังไม่ได้เลือก Auto-response`);
        continue;
      }

      const rule = rulesById.get(ruleId);
      if (!rule) {
        addReason(reasons, `ไม่พบ Auto-response rule "${ruleId}"`);
        continue;
      }
      if (rule.status !== "ACTIVE") {
        addReason(reasons, `Auto-response "${rule.name}" ยังไม่ได้เปิดใช้งาน`);
      }

      for (const message of normalizeAutoResponseMessages(rule)) {
        if (message.type !== "TEXT" || !message.textTemplate) continue;
        addVariableReasons(message.textTemplate, context, reasons);
        addUnresolvedVariableReasons(resolveTemplateVariables(message.textTemplate, context), reasons);
      }
      continue;
    }

    addVariableReasons(area.actionData, context, reasons);
    const hasVariableIssue = hasPreflightVariableIssue(area.actionData, context);
    const resolved = resolveTemplateVariables(area.actionData, context);
    addUnresolvedVariableReasons(resolved, reasons);

    if (area.actionType === "URI" && !hasVariableIssue && !/^https?:\/\//i.test(resolved.trim())) {
      addReason(
        reasons,
        `URI ของพื้นที่ "${getAreaLabel(area)}" ต้องขึ้นต้นด้วย http:// หรือ https://`,
      );
    }
    if (area.actionType === "MESSAGE" && !resolved.trim()) {
      addReason(reasons, `ข้อความของพื้นที่ "${getAreaLabel(area)}" ว่างเปล่า`);
    }
  }

  return reasons;
}
