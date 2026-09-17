export type LineOaManagerResult = "copied" | "copy-failed" | "missing";

const LINE_CHAT_USER_ID_PATTERN = "U[0-9a-f]{32}";
const DIRECT_CHAT_PATH_PATTERN = new RegExp(`^/${LINE_CHAT_USER_ID_PATTERN}/chat/${LINE_CHAT_USER_ID_PATTERN}/?$`, "iu");

export function validLineOaManagerUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const validAccountManager =
      (url.hostname === "manager.line.biz" || url.hostname === "chat.line.biz") &&
      /^\/account\/[^/]+\/?$/u.test(url.pathname);
    const validDirectChat =
      url.hostname === "chat.line.biz" && DIRECT_CHAT_PATH_PATTERN.test(url.pathname);
    if (
      url.protocol !== "https:" ||
      (!validAccountManager && !validDirectChat) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) return null;
    return url.toString();
  } catch { return null; }
}

function selectedConversationManagerRedirectUrl(): string | null {
  if (typeof window === "undefined") return null;
  const conversationId = new URL(window.location.href).searchParams.get("conversationId")?.trim();
  if (!conversationId) return null;
  return `${window.location.origin}/api-backend/conversations/${encodeURIComponent(conversationId)}/open-line-oa-manager`;
}

export async function openLineOaManager(options: { managerUrl?: string | null; customerName: string; copy: (value: string) => Promise<void>; open: (url: string, target: string, features: string) => unknown }): Promise<LineOaManagerResult> {
  const url = selectedConversationManagerRedirectUrl() ?? validLineOaManagerUrl(options.managerUrl);
  if (!url) return "missing";
  options.open(url, "_blank", "noopener,noreferrer");
  try { await options.copy(options.customerName); return "copied"; }
  catch { return "copy-failed"; }
}
