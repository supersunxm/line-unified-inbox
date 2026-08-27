export const AUTO_RESPONSE_POSTBACK_PREFIX = "oppo_ar:v1:";

/**
 * Builds the canonical versioned postback data string for an auto-response rule.
 * Format: oppo_ar:v1:<ruleId>
 */
export function buildAutoResponsePostbackData(ruleId: string): string {
  if (!ruleId || typeof ruleId !== "string") {
    throw new Error("ruleId is required to build auto-response postback data");
  }
  return `${AUTO_RESPONSE_POSTBACK_PREFIX}${ruleId.trim()}`;
}

export type ParsedAutoResponsePostback = {
  isAutoResponse: boolean;
  ruleId?: string;
};

/**
 * Parses a raw LINE postback data string.
 * Only recognizes data starting with our canonical prefix `oppo_ar:v1:`.
 * Returns { isAutoResponse: false } for all other features, keywords, or random data.
 * If prefix matches but ID is empty/malformed, returns { isAutoResponse: true, ruleId: undefined }.
 */
export function parseAutoResponsePostbackData(
  data: string | null | undefined,
): ParsedAutoResponsePostback {
  if (!data || typeof data !== "string") {
    return { isAutoResponse: false };
  }

  if (!data.startsWith(AUTO_RESPONSE_POSTBACK_PREFIX)) {
    return { isAutoResponse: false };
  }

  const rawId = data.slice(AUTO_RESPONSE_POSTBACK_PREFIX.length).trim();
  if (!rawId || !/^[0-9a-zA-Z_-]{1,64}$/.test(rawId)) {
    return { isAutoResponse: true, ruleId: undefined };
  }

  return {
    isAutoResponse: true,
    ruleId: rawId,
  };
}
