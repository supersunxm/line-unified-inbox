import type {
  LineChatDiscoveredChat,
  LineChatDiscoveryResult,
} from "./line-chat.types";

const CHAT_USER_ID_PATTERN = /^Ud[A-Za-z0-9_-]{6,}$/;

export function isLineChatUserId(value: unknown): value is string {
  return typeof value === "string" && CHAT_USER_ID_PATTERN.test(value.trim());
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function timestampValue(value: unknown): string | null {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())
      ? Number(value.trim())
      : null;
  if (numericValue !== null && Number.isFinite(numericValue)) {
    const milliseconds = Math.abs(numericValue) < 100_000_000_000 ? numericValue * 1000 : numericValue;
    const parsed = new Date(milliseconds);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return stringValue(value);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayResponse(body: unknown): {
  shape: LineChatDiscoveryResult["responseShape"];
  entries: unknown[];
} {
  if (Array.isArray(body)) return { shape: "array", entries: body };
  const wrapper = objectValue(body);
  if (!wrapper) throw new Error("Unsupported LINE OA Manager chat-list response shape.");

  for (const shape of ["chats", "data", "items"] as const) {
    if (Array.isArray(wrapper[shape])) return { shape, entries: wrapper[shape] };
  }

  throw new Error("LINE OA Manager chat-list response did not contain a supported chat array.");
}

function normalizeChat(raw: unknown): LineChatDiscoveredChat | null {
  const value = objectValue(raw);
  if (!value) return null;

  const chatUserId = stringValue(value.chatUserId) || stringValue(value.userId) || stringValue(value.id);
  if (!isLineChatUserId(chatUserId)) return null;

  const lastMessage = objectValue(value.lastMessage) || objectValue(value.latestMessage);
  return {
    chatUserId,
    displayName: stringValue(value.displayName) || stringValue(value.name),
    lastMessageText:
      stringValue(value.lastMessageText)
      || stringValue(lastMessage?.text)
      || stringValue(lastMessage?.content)
      || stringValue(lastMessage?.originalText),
    lastMessageAt:
      timestampValue(value.lastMessageAt)
      || timestampValue(lastMessage?.sentAt)
      || timestampValue(lastMessage?.createdAt)
      || timestampValue(lastMessage?.timestamp),
    lastMessageDirection:
      stringValue(value.lastMessageDirection)
      || stringValue(lastMessage?.direction),
  };
}

/**
 * Adapts the observed GET /api/v1/bots/{botId}/chats endpoint response into
 * the small, non-secret signal set used by the pilot matcher. The supported
 * envelopes/fields are validated only by sanitized fixtures; unknown records
 * and IDs outside the LINE OA Manager Ud... format are ignored fail-closed.
 */
export function parseLineChatListResponse(
  body: unknown,
  metadata: Pick<LineChatDiscoveryResult, "botId" | "endpoint">,
): LineChatDiscoveryResult {
  const { shape, entries } = arrayResponse(body);
  return {
    ...metadata,
    responseShape: shape,
    // Pagination fields/mechanics are not verified locally yet. Production
    // apply therefore remains blocked until a complete enumeration is proven.
    enumerationStatus: "UNVERIFIED",
    chats: entries.map(normalizeChat).filter((chat): chat is LineChatDiscoveredChat => chat !== null),
  };
}
