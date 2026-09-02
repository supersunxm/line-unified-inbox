export const LINE_CHAT_PILOT_STORE_CODE = "28375";
export const LINE_CHAT_PILOT_OA_NAME = "OPPO BS RBS Chonburi";
export const LINE_CHAT_PILOT_BOT_ID = "U729972869a565723cb7fcf7ea28bbc43";
export const LINE_CHAT_PILOT_SESSION_KEY = "profile-b";

export const LINE_CHAT_REALTIME_RESOLVER_ALLOWED_STORE_CODES = [
  "28375", // Phase 1: OPPO BS RBS Chonburi
  "25610", // Phase 2: OPPO Central World
  "27627", // Phase 2: OPPO Bangkapi
  "25391", // Phase 2: OPPO CentralWestgate
  "24804", // Phase 2: OPPO TM Ngamwongwan
  "27789", // Phase 2: OPPO MKV Suwannaphum
  "3791",  // Phase 2: OPPO CentralKhonkaen
] as const;

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
