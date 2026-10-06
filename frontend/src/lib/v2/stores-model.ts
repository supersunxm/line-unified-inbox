import { RESPONSE_RATE_TARGET_PERCENT } from "./business-hours.ts";
import type { StoreRow } from "./response-model.ts";
import { thaiLocationLabel } from "./thai-geo.ts";

export type StoreHealthTab = "attention" | "all" | "no-data";

export type StoreReviewInput = {
  /** Store record id from Google Review KPI (backend returns Store.id here). */
  id: string;
  kpiResult: {
    qualifiedReviews: number;
    targetQualifiedReviews: number;
    isPassed: boolean;
  } | null;
};

export type StoreHealthRow = StoreRow & {
  reviewLoaded: boolean;
  reviewChecked: boolean;
  reviewQualified: number | null;
  reviewTarget: number | null;
  reviewPassed: boolean | null;
  hasAttention: boolean;
};

export function buildStoreHealthRows(storeRows: StoreRow[], reviews: StoreReviewInput[] | null): StoreHealthRow[] {
  const reviewByStore = reviews ? new Map(reviews.map((review) => [review.id, review])) : null;
  return storeRows.map((row) => {
    const review = reviewByStore?.get(row.storeId) ?? null;
    const result = review?.kpiResult ?? null;
    const reviewLoaded = reviews !== null;
    const reviewChecked = Boolean(result);
    const reviewPassed = result ? result.isPassed : null;
    const hasAttention =
      !row.hasData
      || row.followTodayCount > 0
      || row.oldWaitingCount > 0
      || (row.rate7d !== null && row.rate7d < RESPONSE_RATE_TARGET_PERCENT)
      || reviewPassed === false;

    return {
      ...row,
      reviewLoaded,
      reviewChecked,
      reviewQualified: result?.qualifiedReviews ?? null,
      reviewTarget: result?.targetQualifiedReviews ?? null,
      reviewPassed,
      hasAttention,
    };
  });
}

export function storeHealthKpis(rows: StoreHealthRow[]) {
  const withData = rows.filter((row) => row.hasData);
  const rateMeasured = withData.filter((row) => row.rate7d !== null);
  const reviewMeasured = rows.filter((row) => row.reviewChecked);
  return {
    totalStores: rows.length,
    storesWithData: withData.length,
    attentionStores: rows.filter((row) => row.hasAttention).length,
    followTodayStores: withData.filter((row) => row.followTodayCount > 0).length,
    backlogStores: withData.filter((row) => row.oldWaitingCount > 0).length,
    belowRateTargetStores: rateMeasured.filter((row) => (row.rate7d ?? RESPONSE_RATE_TARGET_PERCENT) < RESPONSE_RATE_TARGET_PERCENT).length,
    rateMeasuredStores: rateMeasured.length,
    belowReviewTargetStores: reviewMeasured.filter((row) => row.reviewPassed === false).length,
    reviewMeasuredStores: reviewMeasured.length,
  };
}

export function filterStoreHealthRows(
  rows: StoreHealthRow[],
  input: { tab: StoreHealthTab; search?: string; region?: string },
): StoreHealthRow[] {
  const query = input.search?.trim().toLocaleLowerCase("th") ?? "";
  return rows.filter((row) => {
    if (input.tab === "attention" && !row.hasAttention) return false;
    if (input.tab === "no-data" && row.hasData) return false;
    if (input.region && row.region !== input.region) return false;
    if (!query) return true;
    return [row.storeName, row.region ?? "", row.province ?? "", thaiLocationLabel(row.region, row.province) ?? ""]
      .join(" ")
      .toLocaleLowerCase("th")
      .includes(query);
  });
}

export function sortStoreHealthRows(rows: StoreHealthRow[]): StoreHealthRow[] {
  const rateGap = (row: StoreHealthRow) => row.rate7d === null ? -1 : Math.max(0, RESPONSE_RATE_TARGET_PERCENT - row.rate7d);
  const reviewGap = (row: StoreHealthRow) => row.reviewQualified === null || row.reviewTarget === null
    ? -1
    : Math.max(0, row.reviewTarget - row.reviewQualified);

  return [...rows].sort((a, b) =>
    Number(!b.hasData) - Number(!a.hasData)
    || b.followTodayCount - a.followTodayCount
    || b.oldWaitingCount - a.oldWaitingCount
    || rateGap(b) - rateGap(a)
    || reviewGap(b) - reviewGap(a)
    || b.waitingCount - a.waitingCount
    || a.storeName.localeCompare(b.storeName, "th")
  );
}
