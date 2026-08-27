import type {
  AutoResponseMessageBlock,
  AutoResponseContentJson,
} from "./auto-response.types";

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

export type DetectedImageFormat = "jpeg" | "png" | "unknown";

export function detectImageMagicBytes(buffer: Buffer): DetectedImageFormat {
  if (!buffer || buffer.length < 8) return "unknown";

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  return "unknown";
}

export function detectImageMime(buffer: Buffer): "image/jpeg" | "image/png" | null {
  const format = detectImageMagicBytes(buffer);
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  return null;
}

export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Normalizes legacy single TEXT rules and new Phase 2 multi-message rules
 * into a canonical ordered array of message blocks (1 to 5 items).
 */
export function normalizeAutoResponseMessages(rule: {
  textTemplate?: string | null;
  contentJson?: any;
}): AutoResponseMessageBlock[] {
  if (rule.contentJson && typeof rule.contentJson === "object") {
    const json = rule.contentJson as AutoResponseContentJson;
    if (Array.isArray(json.messages) && json.messages.length > 0) {
      return json.messages;
    }
  }

  if (rule.textTemplate && typeof rule.textTemplate === "string" && rule.textTemplate.trim().length > 0) {
    return [
      {
        id: "legacy-text",
        type: "TEXT",
        textTemplate: rule.textTemplate.trim(),
      },
    ];
  }

  return [];
}

/**
 * Validates a list of message blocks according to LINE & business constraints:
 * - Count between 1 and 5 blocks
 * - TEXT blocks must have non-empty textTemplate
 * - IMAGE blocks must have valid mediaObjectKey
 */
export function validateAutoResponseMessages(messages: AutoResponseMessageBlock[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(messages) || messages.length === 0) {
    errors.push("Auto-response must contain at least 1 message block.");
    return { valid: false, errors };
  }

  if (messages.length > 5) {
    errors.push("Auto-response cannot exceed 5 message blocks (LINE limit is 5).");
  }

  messages.forEach((msg, idx) => {
    const blockNum = idx + 1;
    if (!msg || typeof msg !== "object") {
      errors.push(`Block #${blockNum} is invalid.`);
      return;
    }

    if (msg.type === "TEXT") {
      if (!msg.textTemplate || typeof msg.textTemplate !== "string" || !msg.textTemplate.trim()) {
        errors.push(`Block #${blockNum} (TEXT) cannot be empty.`);
      } else if (msg.textTemplate.length > 5000) {
        errors.push(`Block #${blockNum} (TEXT) exceeds maximum length of 5000 characters.`);
      }
    } else if (msg.type === "IMAGE") {
      if (!msg.mediaObjectKey || typeof msg.mediaObjectKey !== "string" || !msg.mediaObjectKey.trim()) {
        errors.push(`Block #${blockNum} (IMAGE) is missing media object key.`);
      }
    } else {
      errors.push(`Block #${blockNum} has unsupported type '${(msg as any).type}'.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
