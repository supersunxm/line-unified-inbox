export const CHAT_LAYOUT_STORAGE_KEY = "oppo-line-oa-chat-layout-v1";
export const CHAT_PANE_LIMITS = {
  sidebar: { default: 280, min: 220, max: 420 },
  conversations: { default: 380, min: 320, max: 600 },
  detailMin: 480,
  separatorWidth: 8,
  keyboardStep: 16,
} as const;

export type ChatPaneWidths = { sidebar: number; conversations: number };
export type ChatSeparator = "sidebar" | "conversations";

export const DEFAULT_CHAT_PANE_WIDTHS: ChatPaneWidths = {
  sidebar: CHAT_PANE_LIMITS.sidebar.default,
  conversations: CHAT_PANE_LIMITS.conversations.default,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function validChatPaneWidths(value: unknown): value is ChatPaneWidths {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ChatPaneWidths>;
  return Number.isFinite(candidate.sidebar) && Number.isFinite(candidate.conversations) &&
    candidate.sidebar! >= CHAT_PANE_LIMITS.sidebar.min && candidate.sidebar! <= CHAT_PANE_LIMITS.sidebar.max &&
    candidate.conversations! >= CHAT_PANE_LIMITS.conversations.min && candidate.conversations! <= CHAT_PANE_LIMITS.conversations.max;
}

export function parseSavedChatPaneWidths(raw: string | null): ChatPaneWidths | null {
  if (!raw) return null;
  try { const value: unknown = JSON.parse(raw); return validChatPaneWidths(value) ? value : null; }
  catch { return null; }
}

export function resizeChatPanes(current: ChatPaneWidths, separator: ChatSeparator, delta: number, availableWidth: number): ChatPaneWidths {
  if (!Number.isFinite(delta) || !Number.isFinite(availableWidth)) return current;
  if (separator === "sidebar") {
    const combined = current.sidebar + current.conversations;
    const minimum = Math.max(CHAT_PANE_LIMITS.sidebar.min, combined - CHAT_PANE_LIMITS.conversations.max);
    const maximum = Math.min(CHAT_PANE_LIMITS.sidebar.max, combined - CHAT_PANE_LIMITS.conversations.min);
    const sidebar = clamp(current.sidebar + delta, minimum, maximum);
    return { sidebar, conversations: combined - sidebar };
  }
  const maximumForDetail = availableWidth - current.sidebar - (CHAT_PANE_LIMITS.separatorWidth * 2) - CHAT_PANE_LIMITS.detailMin;
  const conversations = clamp(current.conversations + delta, CHAT_PANE_LIMITS.conversations.min, Math.max(CHAT_PANE_LIMITS.conversations.min, Math.min(CHAT_PANE_LIMITS.conversations.max, maximumForDetail)));
  return { ...current, conversations };
}
