import type { StoreInsightsCustomerVoiceDimension } from "@/types/api";

export const CUSTOMER_VOICE_DIMENSIONS: Array<{ value: StoreInsightsCustomerVoiceDimension; label: string }> = [
  { value: "topic", label: "Topics" },
  { value: "intent", label: "Intent" },
  { value: "product", label: "Product Interest" },
];

export function customerVoiceDrilldownHref(storeId: string, from: string, to: string, dimension: StoreInsightsCustomerVoiceDimension = "topic", value?: string) {
  const params = new URLSearchParams({ storeId, from, to, dimension });
  if (value) params.set("value", value);
  return "/store-360/customer-voice?" + params.toString();
}
