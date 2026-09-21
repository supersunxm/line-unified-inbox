import type { BroadcastMessage } from "./broadcast-targeting";
import {
  resolveTemplateVariables,
  validateTemplateVariables,
  type StoreVariableContext,
} from "../store-master/template-variable-resolver";

type BroadcastStoreMasterVariableSource = {
  externalStoreId?: string | null;
  storeName?: string | null;
  accountName?: string | null;
  province?: string | null;
  region?: string | null;
  lineId?: string | null;
  lineOaLink?: string | null;
  lineManagerUrl?: string | null;
  tiktokUsername?: string | null;
  tiktokProfileUrl?: string | null;
  googleMapsUrl?: string | null;
  storeLocationText?: string | null;
  storePhone?: string | null;
  mallName?: string | null;
};

export type BroadcastStoreVariableSource = {
  store?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
    region?: string | null;
    area?: string | null;
    storeMaster?: BroadcastStoreMasterVariableSource | null;
  } | null;
  lineOfficialAccount?: {
    name?: string | null;
    basicId?: string | null;
  } | null;
};

export type BroadcastMessageVariableValidation = {
  status: "READY" | "BLOCKED";
  missingVariables: string[];
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildBroadcastStoreVariableContext(
  source: BroadcastStoreVariableSource,
): StoreVariableContext {
  const store = source.store ?? null;
  const master = store?.storeMaster ?? null;
  const oa = source.lineOfficialAccount ?? null;

  const storeLocationText =
    clean(master?.storeLocationText) ??
    clean(store?.area) ??
    clean(master?.province) ??
    clean(master?.region) ??
    clean(store?.region);

  return {
    id: store?.id ?? null,
    name: store?.name ?? null,
    storeName: clean(master?.storeName) ?? clean(store?.name) ?? clean(oa?.name),
    code: clean(store?.code) ?? clean(master?.externalStoreId),
    storeId: store?.id ?? null,
    externalStoreId: master?.externalStoreId ?? null,
    accountName: clean(oa?.name) ?? clean(master?.accountName),
    lineOfficialAccountName: clean(oa?.name) ?? clean(master?.accountName),
    province: master?.province ?? null,
    region: master?.region ?? store?.region ?? null,
    lineId: clean(master?.lineId) ?? clean(oa?.basicId),
    lineOaLink: master?.lineOaLink ?? null,
    lineManagerUrl: master?.lineManagerUrl ?? null,
    tiktokUsername: master?.tiktokUsername ?? null,
    tiktokProfileUrl: master?.tiktokProfileUrl ?? null,
    googleMapsUrl: master?.googleMapsUrl ?? null,
    storeLocationText,
    storePhone: clean(master?.storePhone),
    mallName: clean(master?.mallName),
    account: { name: clean(oa?.name) ?? clean(master?.accountName) },
  };
}

export function validateBroadcastMessageVariables(
  messages: BroadcastMessage[],
  context: StoreVariableContext,
): BroadcastMessageVariableValidation {
  const missing = new Set<string>();

  for (const message of messages) {
    if (message.type !== "text") continue;
    const validation = validateTemplateVariables(message.text, context);
    for (const variable of validation.missingVariables) missing.add(variable);
  }

  return missing.size > 0
    ? { status: "BLOCKED", missingVariables: Array.from(missing) }
    : { status: "READY", missingVariables: [] };
}

export function resolveBroadcastMessagesForStore(
  messages: BroadcastMessage[],
  context: StoreVariableContext,
):
  | { ok: true; messages: BroadcastMessage[] }
  | { ok: false; missingVariables: string[] } {
  const validation = validateBroadcastMessageVariables(messages, context);
  if (validation.status === "BLOCKED") {
    return { ok: false, missingVariables: validation.missingVariables };
  }

  return {
    ok: true,
    messages: messages.map((message) =>
      message.type === "text"
        ? { ...message, text: resolveTemplateVariables(message.text, context) }
        : message,
    ),
  };
}
