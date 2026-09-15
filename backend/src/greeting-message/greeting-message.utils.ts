import { extractTemplateVariables } from "../store-master/template-variable-resolver";
import type {
  GreetingContentJson,
  GreetingMessageBlock,
} from "./greeting-message.types";

export type DetectedImageFormat = "jpeg" | "png" | "unknown";

export function detectImageMagicBytes(buffer: Buffer): DetectedImageFormat {
  if (!buffer || buffer.length < 3) return "unknown";

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  if (
    buffer.length >= 8 &&
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

export function normalizeGreetingMessages(template: {
  contentJson?: any;
}): GreetingMessageBlock[] {
  if (template.contentJson && typeof template.contentJson === "object") {
    const json = template.contentJson as GreetingContentJson;
    if (Array.isArray(json.messages) && json.messages.length > 0) {
      return json.messages;
    }
  }

  return [];
}

export function extractAllGreetingVariables(
  messages: GreetingMessageBlock[],
): string[] {
  const vars = new Set<string>();
  for (const msg of messages) {
    if (msg.type === "TEXT" && msg.textTemplate) {
      const extracted = extractTemplateVariables(msg.textTemplate);
      for (const v of extracted) vars.add(v);
    }
  }
  return Array.from(vars);
}

export function validateGreetingMessages(messages: GreetingMessageBlock[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(messages) || messages.length === 0) {
    errors.push("Greeting message must contain at least 1 message block.");
    return { valid: false, errors };
  }

  if (messages.length > 5) {
    errors.push("Greeting message cannot exceed 5 message blocks (LINE limit is 5).");
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
      return;
    }

    if (msg.type === "IMAGE") {
      if (!msg.mediaObjectKey || typeof msg.mediaObjectKey !== "string" || !msg.mediaObjectKey.trim()) {
        errors.push(`Block #${blockNum} (IMAGE) is missing media object key.`);
      }
      return;
    }

    if (msg.type === "RICH_MESSAGE") {
      if (!msg.richMessageId || typeof msg.richMessageId !== "string" || !msg.richMessageId.trim()) {
        errors.push(`Block #${blockNum} (RICH_MESSAGE) is missing Rich Message ID.`);
      }
      return;
    }

    errors.push(`Block #${blockNum} has unsupported type '${(msg as any).type}'.`);
  });

  return { valid: errors.length === 0, errors };
}
