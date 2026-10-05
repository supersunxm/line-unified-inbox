// /v2/response URL state: ?view=stores|chat&tab=follow-up|all|no-data&store=…&conversation=…
// Selection is shared between the two views, so switching view keeps store and conversation.

import type { StoreSort, StoreTab } from "./response-model.ts";

export type ResponseView = "stores" | "chat";
export const ALL_STORES = "all";

export type ResponseUrlState = {
  view: ResponseView;
  tab: StoreTab;
  /** "age" sorts by the oldest waiting chat (used by the "ค้างเกิน 7 วัน" link). */
  sort: StoreSort;
  /** A store id, ALL_STORES ("ทุกร้านในรายการนี้"), or null. */
  store: string | null;
  conversation: string | null;
};

const TABS: StoreTab[] = ["follow-up", "all", "no-data"];

export function parseResponseUrl(params: { get(name: string): string | null }): ResponseUrlState {
  const view = params.get("view") === "chat" ? "chat" : "stores";
  const tabParam = params.get("tab");
  const tab = TABS.includes(tabParam as StoreTab) ? (tabParam as StoreTab) : "follow-up";
  const sort = params.get("sort") === "age" ? "age" : "wait";
  return { view, tab, sort, store: params.get("store") || null, conversation: params.get("conversation") || null };
}

/** Query string for a state; defaults are left out so URLs stay short. */
export function responseUrlQuery(state: ResponseUrlState): string {
  const query = new URLSearchParams();
  if (state.view !== "stores") query.set("view", state.view);
  if (state.tab !== "follow-up") query.set("tab", state.tab);
  if (state.sort !== "wait") query.set("sort", state.sort);
  if (state.store) query.set("store", state.store);
  if (state.conversation) query.set("conversation", state.conversation);
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function responseHref(patch: Partial<ResponseUrlState>, base: ResponseUrlState = { view: "stores", tab: "follow-up", sort: "wait", store: null, conversation: null }): string {
  return `/v2/response${responseUrlQuery({ ...base, ...patch })}`;
}
