// The v2 workspace was retired into Home, Dashboard and Store 360 (owner decision, 8 Oct 2026).
// Its old URLs redirect, keeping the month. /v2/report (print) and /v2/admin/partners stay. Pure.

type Params = Record<string, string | string[] | undefined>;

export type V2RetiredRoute = "overview" | "stores" | "response" | "customers";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function first(value: string | string[] | undefined): string | null {
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text : null;
}

/** Where a retired v2 URL goes now. */
export function v2RedirectHref(route: V2RetiredRoute, params: Params = {}): string {
  const month = first(params.month);
  const query = (extra: Record<string, string> = {}) => {
    const search = new URLSearchParams(extra);
    if (month && MONTH.test(month)) search.set("month", month);
    const text = search.toString();
    return text ? `?${text}` : "";
  };
  if (route === "overview") return `/dashboard${query()}`;
  if (route === "customers") return `/store-360${query()}`;
  // /v2/stores?store=<id> (the old scorecard drawer) opens that store in Store 360.
  const store = route === "stores" ? first(params.store) : null;
  if (store) return `/store-360${query({ storeId: store })}`;
  return `/dashboard${query()}#stores`;
}
