/**
 * Message-search filter model, keyword validation, backend request shape, and URL state.
 * Pure module. The backend remains the authority for store scope and authorization; this module
 * only shapes what the user asked for.
 */
import {
  defaultMessageSearchPeriod,
  isSameMessageSearchPeriod,
  validateMessageSearchPeriod,
  type MessageSearchPeriod,
} from "./message-search-period.ts";
import {
  MESSAGE_SEARCH_MAX_KEYWORD_LENGTH,
  MESSAGE_SEARCH_MAX_STORE_SELECTION,
  MESSAGE_SEARCH_MIN_KEYWORD_LENGTH,
} from "./message-search-config.ts";

export type MessageSearchFilters = {
  keyword: string;
  period: MessageSearchPeriod;
  /** Empty means every store the caller is authorized for (the backend enforces the scope). */
  storeIds: string[];
};

export type KeywordValidation =
  | { valid: true; keyword: string }
  | { valid: false; keyword: string; reason: "empty" | "tooShort" | "tooLong" };

export const MESSAGE_SEARCH_URL_KEYS = {
  keyword: "msgQ",
  from: "msgFrom",
  to: "msgTo",
  stores: "msgStores",
} as const;

const STORE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;

/** NFC, zero-width removal, whitespace collapse, trim. Same canonical form the backend applies. */
export function normalizeMessageSearchKeyword(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[​-‍﻿]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function validateMessageSearchKeyword(raw: string): KeywordValidation {
  const keyword = normalizeMessageSearchKeyword(raw);
  if (keyword.length === 0) return { valid: false, keyword, reason: "empty" };
  const length = [...keyword].length;
  if (length < MESSAGE_SEARCH_MIN_KEYWORD_LENGTH) return { valid: false, keyword, reason: "tooShort" };
  if (length > MESSAGE_SEARCH_MAX_KEYWORD_LENGTH) return { valid: false, keyword, reason: "tooLong" };
  return { valid: true, keyword };
}

export function defaultMessageSearchFilters(todayIso: string): MessageSearchFilters {
  return { keyword: "", period: defaultMessageSearchPeriod(todayIso), storeIds: [] };
}

/** Clears keyword, store selection, and period back to the default 7 days. */
export function clearMessageSearchFilters(todayIso: string): MessageSearchFilters {
  return defaultMessageSearchFilters(todayIso);
}

export function hasActiveMessageSearchFilters(filters: MessageSearchFilters, todayIso: string): boolean {
  return (
    filters.keyword.length > 0 ||
    filters.storeIds.length > 0 ||
    !isSameMessageSearchPeriod(filters.period, defaultMessageSearchPeriod(todayIso))
  );
}

export type MessageSearchRequest = {
  q: string;
  startDate: string;
  endDate: string;
  storeIds?: string[];
};

/**
 * Builds the backend request, or null when the keyword or period is not searchable yet.
 * A null result means: make no request.
 */
export function buildMessageSearchRequest(filters: MessageSearchFilters, todayIso: string): MessageSearchRequest | null {
  const keyword = validateMessageSearchKeyword(filters.keyword);
  if (!keyword.valid) return null;
  if (validateMessageSearchPeriod(filters.period, todayIso, "th") !== null) return null;
  return {
    q: keyword.keyword,
    startDate: filters.period.dateFrom,
    endDate: filters.period.dateTo,
    ...(filters.storeIds.length > 0 ? { storeIds: [...filters.storeIds] } : {}),
  };
}

/** Stable key that changes whenever a search would return different results. */
export function messageSearchRequestKey(request: MessageSearchRequest): string {
  return JSON.stringify([request.q, request.startDate, request.endDate, [...(request.storeIds ?? [])].sort()]);
}

export function serializeMessageSearchFilters(filters: MessageSearchFilters, todayIso: string): URLSearchParams {
  const params = new URLSearchParams();
  const keyword = normalizeMessageSearchKeyword(filters.keyword);
  if (keyword) params.set(MESSAGE_SEARCH_URL_KEYS.keyword, keyword);
  if (!isSameMessageSearchPeriod(filters.period, defaultMessageSearchPeriod(todayIso))) {
    params.set(MESSAGE_SEARCH_URL_KEYS.from, filters.period.dateFrom);
    params.set(MESSAGE_SEARCH_URL_KEYS.to, filters.period.dateTo);
  }
  if (filters.storeIds.length > 0) params.set(MESSAGE_SEARCH_URL_KEYS.stores, filters.storeIds.join(","));
  return params;
}

/**
 * Restores filters from a query string. Anything invalid falls back to its default. The
 * conversation month parameter (`month`) and other unrelated keys are never read.
 */
export function parseMessageSearchFilters(search: string, todayIso: string): MessageSearchFilters {
  const params = new URLSearchParams(search);
  const defaults = defaultMessageSearchFilters(todayIso);

  const keywordCheck = validateMessageSearchKeyword(params.get(MESSAGE_SEARCH_URL_KEYS.keyword) ?? "");
  const keyword = keywordCheck.valid ? keywordCheck.keyword : "";

  const candidate: MessageSearchPeriod = {
    dateFrom: params.get(MESSAGE_SEARCH_URL_KEYS.from) ?? defaults.period.dateFrom,
    dateTo: params.get(MESSAGE_SEARCH_URL_KEYS.to) ?? defaults.period.dateTo,
  };
  const period = validateMessageSearchPeriod(candidate, todayIso, "th") === null ? candidate : defaults.period;

  const rawStores = params.get(MESSAGE_SEARCH_URL_KEYS.stores) ?? "";
  const storeIds = [...new Set(rawStores.split(",").map((value) => value.trim()))]
    .filter((value) => STORE_ID_PATTERN.test(value))
    .slice(0, MESSAGE_SEARCH_MAX_STORE_SELECTION);

  return { keyword, period, storeIds };
}
