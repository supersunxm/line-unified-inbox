// Links between the metrics pages, with the month kept. Pure: node --test imports it directly.

import { buildChatsHref } from "../../app/workspace-routing.ts";

/** Store 360 for one store and month: /store-360?storeId=&month=. */
export function store360Href(storeId: string, month: string): string {
  return `/store-360?${new URLSearchParams({ storeId, month }).toString()}`;
}

/** /chats filtered to one store and month, with /chats's own URL builder (?storeId=&month=). */
export function chatsHref(input: { storeId: string; month: string; unrepliedOnly?: boolean }): string {
  return buildChatsHref({ store: input.storeId, month: input.month, ...(input.unrepliedOnly ? { replyState: "NOT_REPLIED" } : {}) });
}

/** The monthly KPI report (/v2/report, print), for the network or one store. */
export function kpiReportHref(month: string, storeId: string | null = null): string {
  const query = new URLSearchParams({ month });
  if (storeId) query.set("store", storeId);
  return `/v2/report?${query.toString()}`;
}

/** The Dashboard's store table. */
export const DASHBOARD_STORES_HREF = "/dashboard#stores";
