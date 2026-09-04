/**
 * Synchronously captures initial window location at script load time,
 * before Google Maps SPA router can rewrite/strip the hash fragment.
 */
export const EARLY_LOCATION = {
  href: typeof window !== "undefined" ? window.location.href : "",
  hash: typeof window !== "undefined" ? window.location.hash : "",
  search: typeof window !== "undefined" ? window.location.search : "",
};

export type UrlHandoffParams = {
  oppoToken: string | null;
  oppoSessionId: string | null;
  oppoStoreId: string | null;
  oppoExtId: string | null;
  oppoCode: string | null;
  oppoName: string | null;
  oppoMonth: string | null;
  oppoBackendUrl: string | null;
};

export function parseUrlHandoffParams(): UrlHandoffParams {
  const earlyHash = EARLY_LOCATION.hash.startsWith("#") ? EARLY_LOCATION.hash.slice(1) : "";
  const currentHash = typeof window !== "undefined" && window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";

  const earlyHashParams = new URLSearchParams(earlyHash);
  const currentHashParams = new URLSearchParams(currentHash);
  const searchParams = new URLSearchParams(EARLY_LOCATION.search || (typeof window !== "undefined" ? window.location.search : ""));

  const getParam = (key: string): string | null =>
    currentHashParams.get(key) || earlyHashParams.get(key) || searchParams.get(key);

  const rawName = getParam("oppoName") || getParam("storeName");
  let decodedName: string | null = null;
  if (rawName) {
    try {
      decodedName = decodeURIComponent(rawName).trim();
    } catch {
      decodedName = rawName.trim();
    }
  }

  return {
    oppoToken: getParam("oppoToken"),
    oppoSessionId: getParam("oppoSessionId"),
    oppoStoreId: getParam("oppoStoreId") || getParam("storeId"),
    oppoExtId: getParam("oppoExtId") || getParam("externalStoreId"),
    oppoCode: getParam("oppoCode") || getParam("code"),
    oppoName: decodedName,
    oppoMonth: getParam("oppoMonth") || getParam("kpiMonth"),
    oppoBackendUrl: getParam("oppoBackendUrl") || getParam("backendUrl"),
  };
}
