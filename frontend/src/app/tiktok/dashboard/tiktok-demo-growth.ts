import type {
  TikTokDailyMetricItem,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
} from "../tiktok-types";

export function isTikTokDemoGrowthEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }
  const flag = process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH;
  return flag === "true" || flag === "1";
}

function bangkokDateString(offsetDays: number): string {
  const now = new Date();
  const bangkokNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  bangkokNow.setDate(bangkokNow.getDate() + offsetDays);
  const year = bangkokNow.getFullYear();
  const month = String(bangkokNow.getMonth() + 1).padStart(2, "0");
  const day = String(bangkokNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function interpolate(start: number, end: number, steps: number): number[] {
  if (steps <= 1) return [Math.round(end)];
  return Array.from({ length: steps }, (_, index) =>
    Math.round(start + ((end - start) * index) / (steps - 1)),
  );
}

export function getTikTokDemoGrowthMetrics(
  accountOrData?: string | TikTokStoreData | null,
): TikTokHistoricalMetricsData {
  const accountId =
    typeof accountOrData === "string"
      ? accountOrData
      : accountOrData?.id ?? "acc-central-world";

  const storeData =
    typeof accountOrData === "object" && accountOrData !== null
      ? accountOrData
      : null;

  const current = storeData?.profile?.follower_count ?? 13342;
  const yesterday = current - 47;
  const sevenDaysAgo = current - 286;
  const thirtyDaysAgo = current - 1124;

  const counts = [
    ...interpolate(thirtyDaysAgo, sevenDaysAgo, 23),
    ...interpolate(sevenDaysAgo, yesterday, 7).slice(1),
    current,
  ];

  const history: TikTokDailyMetricItem[] = counts.map((followerCount, index) => {
    const offsetDays = index - (counts.length - 1);
    const metricDate = bangkokDateString(offsetDays);
    return {
      id: `demo-${metricDate}`,
      metricDate,
      followerCount,
      followingCount: storeData?.profile?.following_count ?? 120,
      likesCount: storeData?.profile?.likes_count ?? 54200,
      videoCount: storeData?.profile?.video_count ?? 18,
      createdAt: `${metricDate}T01:00:00.000+07:00`,
      updatedAt: `${metricDate}T01:00:00.000+07:00`,
    };
  });

  return {
    accountId,
    openId: storeData?.profile?.open_id || "demo-open-id",
    displayName:
      storeData?.profile?.display_name || "OPPO Brand Shop Central World",
    username: storeData?.profile?.username ?? "o_centralworld",
    summary: {
      currentFollowerCount: current,
      previousDayFollowerCount: yesterday,
      dailyFollowerGrowth: 47,
      sevenDayFollowerCount: sevenDaysAgo,
      sevenDayFollowerGrowth: 286,
      thirtyDayFollowerCount: thirtyDaysAgo,
      thirtyDayFollowerGrowth: 1124,
    },
    history,
  };
}
