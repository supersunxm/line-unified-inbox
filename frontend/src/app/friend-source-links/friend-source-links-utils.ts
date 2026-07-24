import type { FriendSource, FriendSourceLink, FriendSourceLinksFilters, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "@/types/api";

export const MAX_PILOT_STORES = 5;
export const ALL_SOURCES: FriendSource[] = ["STORE_QR", "TIKTOK", "FACEBOOK", "INSTAGRAM"];

/**
 * Checks if a LINE Official Account is eligible for link generation.
 * Must be active, not archived, status CONNECTED or READY, have a non-empty basicId, and belong to a valid store.
 */
export function isAccountEligible(oa: LineOfficialAccountResponse): boolean {
  return (
    oa.isActive &&
    !oa.archivedAt &&
    (oa.connectionStatus === "CONNECTED" || oa.connectionStatus === "READY") &&
    !!oa.basicId?.trim() &&
    !!oa.store
  );
}

/**
 * Filters eligible LINE Official Accounts matching a search term across store name, OA name, or basicId.
 */
export function filterEligibleAccounts(
  accounts: LineOfficialAccountResponse[],
  searchQuery: string
): LineOfficialAccountResponse[] {
  const eligible = accounts.filter(isAccountEligible);
  if (!searchQuery.trim()) return eligible;
  const q = searchQuery.toLowerCase().trim();
  return eligible.filter(
    (oa) =>
      oa.store.name.toLowerCase().includes(q) ||
      oa.name.toLowerCase().includes(q) ||
      (oa.basicId?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Pure state handler for toggling an account selection in the generator card.
 * Enforces strict limit of maxLimit (default 5).
 */
export function toggleAccountSelection(
  currentSelected: string[],
  idToToggle: string,
  maxLimit = MAX_PILOT_STORES,
  maxErrorMessage = "Maximum 5 LINE OAs allowed"
): { selected: string[]; error: string | null } {
  if (currentSelected.includes(idToToggle)) {
    return { selected: currentSelected.filter((id) => id !== idToToggle), error: null };
  }
  if (currentSelected.length >= maxLimit) {
    return { selected: currentSelected, error: maxErrorMessage };
  }
  return { selected: [...currentSelected, idToToggle], error: null };
}

/**
 * Prepares the payload for POST /friend-source-links/generate.
 * Deduplicates input IDs and validates boundary conditions (1 to 5 distinct IDs).
 */
export function prepareGeneratePayload(
  selectedIds: string[],
  minRequiredMessage = "Select at least 1 LINE OA",
  maxAllowedMessage = "Maximum 5 LINE OAs allowed"
): { lineOaIds: string[]; error: string | null } {
  const distinct = Array.from(new Set(selectedIds.map((id) => id.trim()).filter(Boolean)));
  if (distinct.length === 0) {
    return { lineOaIds: [], error: minRequiredMessage };
  }
  if (distinct.length > MAX_PILOT_STORES) {
    return { lineOaIds: [], error: maxAllowedMessage };
  }
  return { lineOaIds: distinct, error: null };
}

/**
 * Prepares update link payload for PATCH /friend-source-links/:id.
 * Ensures only explicitly supplied fields (e.g. isActive) are sent.
 */
export function prepareUpdatePayload(isActive: boolean): { isActive: boolean } {
  return { isActive };
}

/**
 * Formats short URL string for copying to clipboard.
 */
export function formatShortUrlForClipboard(shortUrl: string): string {
  return shortUrl.trim();
}

/**
 * Builds query parameters string for GET /friend-source-links.
 * Skips empty or undefined filter values.
 */
export function buildFriendSourceLinksQueryParams(filters?: FriendSourceLinksFilters): string {
  if (!filters) return "";
  const query = new URLSearchParams();
  if (filters.storeId) query.append("storeId", filters.storeId);
  if (filters.lineOaId) query.append("lineOaId", filters.lineOaId);
  if (filters.source) query.append("source", filters.source);
  if (filters.isActive !== undefined && (filters.isActive as string) !== "") {
    query.append("isActive", filters.isActive);
  }
  if (filters.search?.trim()) query.append("search", filters.search.trim());
  const str = query.toString();
  return str ? `?${str}` : "";
}

/**
 * Formats a decimal conversion rate into a clean percentage string with 2 decimal places.
 * e.g. 0.0667 -> "6.67%", 0 -> "0.00%", NaN -> "0.00%"
 */
export function formatConversionRate(rate?: number | null): string {
  if (rate == null || isNaN(rate) || !isFinite(rate)) {
    return "0.00%";
  }
  const pct = rate * 100;
  return `${pct.toFixed(2)}%`;
}

/**
 * Computes top-level attribution KPI totals from filtered link list.
 */
export function calculateAttributionKPIs(links: FriendSourceLink[]): {
  totalClicks: number;
  identifiedVisits: number;
  confirmedAdds: number;
  overallConversionRate: string;
} {
  const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
  const identifiedVisits = links.reduce((sum, l) => sum + (l.identifiedVisits || 0), 0);
  const confirmedAdds = links.reduce((sum, l) => sum + (l.confirmedAdds || 0), 0);
  const overallConversionRate = formatConversionRate(totalClicks > 0 ? confirmedAdds / totalClicks : 0);

  return {
    totalClicks,
    identifiedVisits,
    confirmedAdds,
    overallConversionRate,
  };
}

/**
 * Computes KPI totals from summary array.
 */
export function calculateSummaryKPIs(summary: FriendSourceLinksSummaryItem[]): {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  storesConfigured: number;
} {
  const totalLinks = summary.reduce((s, item) => s + item.totalLinks, 0);
  const activeLinks = summary.reduce((s, item) => s + item.activeLinks, 0);
  const totalClicks = summary.reduce((s, item) => s + item.clicks, 0);
  const storesConfigured = new Set(summary.map((item) => item.storeId)).size;
  return { totalLinks, activeLinks, totalClicks, storesConfigured };
}

/**
 * Evaluates API error for role-gating or failure display.
 */
export function evaluateApiError(
  err: unknown,
  fallbackMessage = "Failed to load data"
): { is403: boolean; message: string; canRetry: boolean } {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return { is403: true, message: "Access Denied", canRetry: false };
  }
  const msg = err instanceof Error ? err.message : fallbackMessage;
  return { is403: false, message: msg, canRetry: true };
}

/**
 * Evaluates user role access permission for Friend Source Links section.
 */
export function canRoleAccessFriendSourceLinks(role?: "ADMIN" | "VIEWER" | string | null): boolean {
  return role === "ADMIN";
}

/**
 * Asserts that no QR generation API endpoint (e.g. /qr, /generate-qr) is requested.
 */
export function isQrEndpointRequested(apiCallPaths: string[]): boolean {
  return apiCallPaths.some((path) => /\/qr($|\/|\?)/i.test(path));
}
