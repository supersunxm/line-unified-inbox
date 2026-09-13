import type { StoreInsightsResponseSegment } from "@/types/api";

export const RESPONSE_SEGMENTS: StoreInsightsResponseSegment[] = ["all", "within-15m", "within-1h", "within-24h", "after-24h", "unanswered"];

export const RESPONSE_SEGMENT_LABELS: Record<StoreInsightsResponseSegment, string> = {
  all: "All response cases",
  "within-15m": "Within 15 minutes",
  "within-1h": "Within 1 hour",
  "within-24h": "Within 24 hours",
  "after-24h": "After 24 hours",
  unanswered: "Unanswered",
};

export function responseDrilldownHref(storeId: string, from: string, to: string, segment: StoreInsightsResponseSegment): string {
  const query = new URLSearchParams({ storeId, from, to, segment });
  return "/store-360/response?" + query.toString();
}

export function responseSegmentLabel(segment: StoreInsightsResponseSegment): string {
  return RESPONSE_SEGMENT_LABELS[segment];
}
