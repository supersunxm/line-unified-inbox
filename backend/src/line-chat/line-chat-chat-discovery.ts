import type {
  LineChatDiscoveredChat,
  LineChatDiscoveryPage,
  LineChatDiscoveryResult,
} from "./line-chat.types";

const CHAT_USER_ID_PATTERN = /^U[0-9a-f]{32}$/i;

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
    return null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function assertListEnvelope(body: unknown): { entries: unknown[]; next: string | null } {
  const wrapper = objectValue(body);
  if (!wrapper || !Array.isArray(wrapper.list)) {
    throw new Error("LINE OA Manager v2 chat-list response must contain a list array.");
  }

  const rawNext = wrapper.next;
  if (rawNext === undefined || rawNext === null) return { entries: wrapper.list, next: null };
  if (typeof rawNext !== "string") {
    throw new Error("LINE OA Manager v2 chat-list response contained a malformed next value.");
  }
  return { entries: wrapper.list, next: rawNext.trim() ? rawNext : null };
}

function normalizeLatestEventTimestamp(value: Record<string, unknown>): string | null {
  const latestEvent = objectValue(value.latestEvent);
  if (!latestEvent || !Object.prototype.hasOwnProperty.call(latestEvent, "timestamp")) return null;
  return timestampValue(latestEvent.timestamp);
}

function normalizeUserChat(raw: unknown): LineChatDiscoveredChat | null {
  const value = objectValue(raw);
  if (!value || value.chatType !== "USER" || !isLineChatUserId(value.chatId)) return null;
  return {
    chatUserId: value.chatId.trim(),
    displayName: stringValue(value.name),
    // The verified v2 contract does not establish message text or direction semantics.
    lastMessageText: null,
    lastMessageAt: normalizeLatestEventTimestamp(value),
    lastMessageDirection: null,
  };
}

function parseV2Page(body: unknown): LineChatDiscoveryPage {
  const { entries, next } = assertListEnvelope(body);
  let ignoredNonUserRecords = 0;
  let invalidUserRecords = 0;
  const chats: LineChatDiscoveredChat[] = [];
  for (const entry of entries) {
    const value = objectValue(entry);
    if (!value || value.chatType !== "USER") {
      ignoredNonUserRecords += 1;
      continue;
    }
    const chat = normalizeUserChat(value);
    if (!chat) {
      invalidUserRecords += 1;
      continue;
    }
    chats.push(chat);
  }
  return {
    responseShape: "list",
    chats,
    next,
    totalRawRecords: entries.length,
    validUserChats: chats.length,
    ignoredNonUserRecords,
    invalidUserRecords,
  };
}

/**
 * Parses one page of the production-observed v2 envelope. Only `list` and
 * `next` are supported; legacy guessed response shapes are intentionally not
 * accepted. The opaque next value is consumed internally by enumeration and
 * is never included in the public result.
 */
export function parseLineChatListResponse(
  body: unknown,
  metadata: Pick<LineChatDiscoveryResult, "botId" | "endpoint">,
): LineChatDiscoveryResult {
  const page = parseV2Page(body);
  const hasTerminalNext = page.next === null;
  return {
    ...metadata,
    responseShape: "list",
    enumerationStatus: hasTerminalNext && page.invalidUserRecords === 0 ? "COMPLETE" : "PARTIAL",
    chats: page.chats,
    pagesFetched: 1,
    totalRawRecords: page.totalRawRecords,
    validUserChats: page.validUserChats,
    ignoredNonUserRecords: page.ignoredNonUserRecords,
    invalidUserRecords: page.invalidUserRecords,
    duplicateIds: 0,
    conflictingDuplicates: 0,
    nextTerminationObserved: hasTerminalNext,
    ...(page.invalidUserRecords > 0 ? { enumerationError: "Invalid USER chat record encountered." } : {}),
  };
}

export function parseLineChatListPage(body: unknown): LineChatDiscoveryPage {
  return parseV2Page(body);
}
