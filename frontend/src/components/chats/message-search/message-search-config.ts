/**
 * Shared constants and feature-flag rules for global message search (WP3).
 * Pure module: no React, no browser or network access.
 */

export const MESSAGE_SEARCH_TIMEZONE = "Asia/Bangkok";
export const MESSAGE_SEARCH_MIN_KEYWORD_LENGTH = 2;
export const MESSAGE_SEARCH_MAX_KEYWORD_LENGTH = 100;
export const MESSAGE_SEARCH_DEFAULT_PRESET_DAYS = 7;
export const MESSAGE_SEARCH_MAX_DAYS = 90;
export const MESSAGE_SEARCH_DEBOUNCE_MS = 300;
export const MESSAGE_SEARCH_PAGE_SIZE = 20;
export const MESSAGE_SEARCH_MAX_STORE_SELECTION = 50;

export type MessageSearchDataMode = "synthetic" | "backend";
export type MessageSearchAdapterKind = "synthetic" | "backend";

/**
 * Exact match, like the server flag CHAT_MESSAGE_SEARCH_ENABLED. Any other value,
 * including undefined, leaves the search UI disabled.
 */
export function isChatMessageSearchUiEnabled(value: string | undefined): boolean {
  return value === "true";
}

/**
 * The data source is synthetic unless "backend" is named explicitly, so enabling the UI
 * locally never reaches a real endpoint by accident.
 */
export function resolveMessageSearchDataMode(value: string | undefined): MessageSearchDataMode {
  return value === "backend" ? "backend" : "synthetic";
}

const LOCAL_SYNTHETIC_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLocalSyntheticHost(hostname: string | undefined): boolean {
  if (hostname === undefined) return true;
  return LOCAL_SYNTHETIC_HOSTS.has(hostname.trim().toLowerCase());
}

/**
 * Synthetic mode bypasses AuthorizedSection so local testing makes no /auth/me request.
 * It must never be allowed in a production build, when NEXT_PUBLIC_APP_ENV=production,
 * or on any non-loopback browser hostname.
 */
export function isSyntheticMessageSearchAllowed(input: {
  appEnv?: string | undefined;
  nodeEnv?: string | undefined;
  hostname?: string | undefined;
} = {}): boolean {
  if (input.appEnv === "production") return false;
  if (input.nodeEnv === "production") return false;
  return isLocalSyntheticHost(input.hostname);
}

/**
 * Decides which adapter, if any, the UI may use. Disabled means no adapter at all, so no
 * request can be made. Synthetic mode is refused outside local non-production environments.
 */
export function selectMessageSearchAdapterKind(input: {
  enabled: boolean;
  mode: MessageSearchDataMode;
  appEnv?: string | undefined;
  nodeEnv?: string | undefined;
  hostname?: string | undefined;
}): MessageSearchAdapterKind | null {
  if (!input.enabled) return null;
  if (input.mode === "synthetic" && !isSyntheticMessageSearchAllowed(input)) {
    return null;
  }
  return input.mode;
}
