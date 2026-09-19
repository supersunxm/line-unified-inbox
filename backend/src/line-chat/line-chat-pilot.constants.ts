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

/**
 * Durable send queue is rolled out store-by-store via LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES.
 * Empty or missing allowlist MUST NOT mean "all stores" (fail closed).
 */
export function getLineChatDurableSendQueueStoreCodes(
  raw = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES,
): ReadonlySet<string> {
  if (!raw) return new Set();
  const codes = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(codes);
}

export function isLineChatDurableSendQueueStoreEnabled(
  storeCode: string | null | undefined,
  env: {
    enabled?: string;
    storeCodes?: string;
  } = {
    enabled: process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED,
    storeCodes: process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES,
  },
): boolean {
  if (env.enabled !== "true") return false;
  const cleanStoreCode = (storeCode ?? "").trim();
  if (!cleanStoreCode) return false;
  const allowlist = getLineChatDurableSendQueueStoreCodes(env.storeCodes);
  if (allowlist.size === 0) return false;
  return allowlist.has(cleanStoreCode);
}

/**
 * Durable send queue conversation allowlist via LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS.
 * Empty or missing allowlist MUST NOT mean "all conversations" (fail closed).
 */
export function getLineChatDurableSendQueueConversationIds(
  raw = process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS,
): ReadonlySet<string> {
  if (!raw) return new Set();
  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(ids);
}

export function isLineChatDurableSendQueueConversationEnabled(
  params: {
    storeCode: string | null | undefined;
    conversationId: string | null | undefined;
  },
  env: {
    enabled?: string;
    storeCodes?: string;
    conversationIds?: string;
  } = {
    enabled: process.env.LINE_CHAT_DURABLE_SEND_QUEUE_ENABLED,
    storeCodes: process.env.LINE_CHAT_DURABLE_SEND_QUEUE_STORE_CODES,
    conversationIds: process.env.LINE_CHAT_DURABLE_SEND_QUEUE_CONVERSATION_IDS,
  },
): boolean {
  if (
    !isLineChatDurableSendQueueStoreEnabled(params.storeCode, {
      enabled: env.enabled,
      storeCodes: env.storeCodes,
    })
  ) {
    return false;
  }

  const cleanConversationId = (params.conversationId ?? "").trim();
  if (!cleanConversationId) return false;

  const conversationAllowlist = getLineChatDurableSendQueueConversationIds(
    env.conversationIds,
  );
  if (conversationAllowlist.size === 0) return false;

  return conversationAllowlist.has(cleanConversationId);
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

export function isLineChatCanaryPreSendFailureEnabled(input: {
  storeCode?: string | null;
  conversationId?: string | null;
  text?: string | null;
  env?: {
    enabled?: string;
  };
}): boolean {
  const flag = (input.env?.enabled ?? process.env.LINE_CHAT_CANARY_FORCE_PRE_SEND_FAILURE_ENABLED)?.trim();
  if (flag !== "true") return false;

  const CANARY_STORE_CODE = "28375";
  const CANARY_CONVERSATION_ID = "a04560a5-8658-493b-9b18-c992adc2b683";
  const CANARY_TEST_TEXT = "TEST DURABLE PRE-SEND FAIL 004";

  if ((input.storeCode ?? "").trim() !== CANARY_STORE_CODE) return false;
  if ((input.conversationId ?? "").trim() !== CANARY_CONVERSATION_ID) return false;
  if ((input.text ?? "").trim() !== CANARY_TEST_TEXT) return false;

  return true;
}

