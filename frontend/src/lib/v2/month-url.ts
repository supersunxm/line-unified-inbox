// URL state for v2's monthly pages. Pure: node --test imports it directly.
//   /v2?month=YYYY-MM
//   /v2/stores?month=&partner=&region=&sort=&store=   (store = the open scorecard drawer)
//   /v2/report?month=&partner=&store=
// The month is always written, so a copied link keeps its month after the month turns.

import { buildChatsHref } from "../../app/workspace-routing.ts";
import type { MonthSort } from "./monthly-model.ts";
import { parseV2Month } from "./month.ts";

type Params = { get(name: string): string | null };

export function monthQuery(month: string, extra: Record<string, string | null | undefined> = {}): string {
  const query = new URLSearchParams({ month });
  for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
  return `?${query.toString()}`;
}

/** A v2 path with the month kept. */
export function withMonth(path: string, month: string): string {
  return `${path}${monthQuery(month)}`;
}

const SORTS: MonthSort[] = ["rate24", "reply", "unreplied", "delta"];

export type StoresUrlState = { month: string; partner: string | null; region: string | null; sort: MonthSort; store: string | null };

export function parseStoresUrl(params: Params, now: number = Date.now()): StoresUrlState {
  const sort = params.get("sort");
  return {
    month: parseV2Month(params.get("month"), now),
    partner: params.get("partner") || null,
    region: params.get("region") || null,
    sort: SORTS.includes(sort as MonthSort) ? (sort as MonthSort) : "rate24",
    store: params.get("store") || null,
  };
}

export function storesHref(state: Partial<StoresUrlState> & { month: string }): string {
  return `/v2/stores${monthQuery(state.month, {
    partner: state.partner,
    region: state.region,
    sort: state.sort && state.sort !== "rate24" ? state.sort : null,
    store: state.store,
  })}`;
}

export type ReportUrlState = { month: string; partner: string | null; store: string | null };

export function parseReportUrl(params: Params, now: number = Date.now()): ReportUrlState {
  return { month: parseV2Month(params.get("month"), now), partner: params.get("partner") || null, store: params.get("store") || null };
}

export function reportHref(state: ReportUrlState): string {
  return `/v2/report${monthQuery(state.month, { partner: state.partner, store: state.store })}`;
}

/** /chats filtered to one store and month, with /chats's own URL builder (?storeId=&month=). */
export function chatsHref(input: { storeId: string; month: string; unrepliedOnly?: boolean }): string {
  return buildChatsHref({ store: input.storeId, month: input.month, ...(input.unrepliedOnly ? { replyState: "NOT_REPLIED" } : {}) });
}
