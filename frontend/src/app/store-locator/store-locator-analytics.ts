export const STORE_LOCATOR_ANALYTICS_EVENT = "store_locator_event";

export const STORE_LOCATOR_EVENT_NAMES = [
  "store_locator_open",
  "region_selected",
  "province_selected",
  "store_selected",
  "line_oa_clicked",
] as const;

export type StoreLocatorEventName = (typeof STORE_LOCATOR_EVENT_NAMES)[number];

export type StoreLocatorEventDetails = Partial<{
  region: string;
  province: string;
  storeName: string;
}>;

type BrowserAnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, string>>;
  gtag?: (...args: unknown[]) => void;
};

export function createStoreLocatorAnalyticsPayload(
  name: StoreLocatorEventName,
  details: StoreLocatorEventDetails = {},
): Record<string, string> {
  const safeDetails = Object.entries(details).reduce<Record<string, string>>((result, [key, value]) => {
    if (value?.trim()) result[key] = value.trim();
    return result;
  }, {});

  return { event: name, ...safeDetails };
}

export function trackStoreLocatorEvent(
  name: StoreLocatorEventName,
  details: StoreLocatorEventDetails = {},
): void {
  if (typeof window === "undefined") return;

  const payload = createStoreLocatorAnalyticsPayload(name, details);
  window.dispatchEvent(
    new CustomEvent(STORE_LOCATOR_ANALYTICS_EVENT, { detail: payload }),
  );

  const analyticsWindow = window as BrowserAnalyticsWindow;
  if (typeof analyticsWindow.gtag === "function") {
    analyticsWindow.gtag("event", name, payload);
  }
  if (Array.isArray(analyticsWindow.dataLayer)) {
    analyticsWindow.dataLayer.push(payload);
  }
}
