export const LINE_CHAT_PILOT_STORE_CODE = "28375";
export const LINE_CHAT_PILOT_OA_NAME = "OPPO BS RBS Chonburi";
export const LINE_CHAT_PILOT_BOT_ID = "U729972869a565723cb7fcf7ea28bbc43";
export const LINE_CHAT_PILOT_SESSION_KEY = "profile-b";
export const LINE_CHAT_PHASE2_SESSION_KEY = "account-1";

export const LINE_CHAT_MANAGER_RELAY_STORE_CONFIG = {
  "28375": {
    storeName: "OPPO BS RBS Chonburi",
    sessionKey: LINE_CHAT_PILOT_SESSION_KEY,
    expectedBotId: LINE_CHAT_PILOT_BOT_ID,
  },
  "25610": {
    storeName: "OPPO Central World",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
  "27627": {
    storeName: "OPPO Bangkapi",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
  "25391": {
    storeName: "OPPO CentralWestgate",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
  "24804": {
    storeName: "OPPO TM Ngamwongwan",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
  "27789": {
    storeName: "OPPO MKV Suwannaphum",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
  "3791": {
    storeName: "OPPO CentralKhonkaen",
    sessionKey: LINE_CHAT_PHASE2_SESSION_KEY,
  },
} as const;

export type LineChatManagerRelayStoreCode = keyof typeof LINE_CHAT_MANAGER_RELAY_STORE_CONFIG;

export const LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES = Object.keys(
  LINE_CHAT_MANAGER_RELAY_STORE_CONFIG,
) as LineChatManagerRelayStoreCode[];

/**
 * Manager relay is intentionally narrower than realtime resolver eligibility.
 * Chonburi remains enabled by default. Additional stores are activated through
 * LINE_CHAT_MANAGER_RELAY_STORE_CODES so rollout can happen without another
 * code deployment and can be rolled back store-by-store.
 */
export function getLineChatManagerRelayEnabledStoreCodes(
  raw = process.env.LINE_CHAT_MANAGER_RELAY_STORE_CODES,
): ReadonlySet<string> {
  const configured = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requested = configured.length > 0 ? configured : [LINE_CHAT_PILOT_STORE_CODE];
  const allowed = new Set<string>(LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES);
  return new Set(requested.filter((storeCode) => allowed.has(storeCode)));
}

export function isLineChatManagerRelayStoreEnabled(
  storeCode: string | null | undefined,
  raw = process.env.LINE_CHAT_MANAGER_RELAY_STORE_CODES,
): boolean {
  const cleanStoreCode = (storeCode ?? "").trim();
  if (!cleanStoreCode) return false;
  return getLineChatManagerRelayEnabledStoreCodes(raw).has(cleanStoreCode);
}

export function getLineChatManagerRelayStoreConfig(storeCode: string | null | undefined) {
  const cleanStoreCode = (storeCode ?? "").trim() as LineChatManagerRelayStoreCode;
  return LINE_CHAT_MANAGER_RELAY_STORE_CONFIG[cleanStoreCode] ?? null;
}

export interface LineChatRealtimeResolverEligibilityParams {
  storeCode: string | null | undefined;
  conversationStoreId: string | null | undefined;
  oaStoreId: string | null | undefined;
  oaAccountType: string | null | undefined;
  oaIsActive: boolean;
  oaArchivedAt: Date | null | undefined;
  oaChatBotId: string | null | undefined;
  oaSessionKey: string | null | undefined;
  oaSessionStatus: string | null | undefined;
  oaSyncEnabled?: boolean;
  expectedBotId?: string | null | undefined;
  expectedSessionKey?: string | null | undefined;
}

export function isLineChatRealtimeResolverEligible(
  params: LineChatRealtimeResolverEligibilityParams,
): boolean {
  if (params.oaSyncEnabled !== undefined && !params.oaSyncEnabled) {
    return false;
  }
  if (!params.conversationStoreId || !params.oaStoreId || params.conversationStoreId !== params.oaStoreId) {
    return false;
  }
  if (params.oaAccountType !== "STORE") {
    return false;
  }
  if (!params.oaIsActive || params.oaArchivedAt != null) {
    return false;
  }
  const botId = params.oaChatBotId?.trim();
  const sessionKey = params.oaSessionKey?.trim();
  if (!botId || !sessionKey || params.oaSessionStatus === "DISABLED") {
    return false;
  }
  if (params.expectedBotId != null && params.expectedBotId.trim() !== botId) {
    return false;
  }
  if (params.expectedSessionKey != null && params.expectedSessionKey.trim() !== sessionKey) {
    return false;
  }

  const cleanStoreCode = (params.storeCode ?? "").trim();
  return (LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES as readonly string[]).includes(cleanStoreCode);
}
