import type {
  TikTokDailyMetricItem,
  TikTokHistoricalMetricsData,
  TikTokStoreData,
} from "../tiktok-types";

export function isTikTokDemoGrowthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TIKTOK_DEMO_GROWTH === "true";
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
  data: TikTokStoreData,
): TikTokHistoricalMetricsData {
  const current = data.profile.follower_count ?? 13_295;
  const yesterday = current - 47;
  const sevenDaysAgo = current - 286;
  const thirtyDaysAgo = current - 1_124;

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
      followingCount: data.profile.following_count ?? 0,
      likesCount: data.profile.likes_count ?? 0,
      videoCount: data.profile.video_count ?? 0,
      createdAt: `${metricDate}T01:00:00.000+07:00`,
      updatedAt: `${metricDate}T01:00:00.000+07:00`,
    };
  });

  return {
    accountId: data.id ?? "demo-account",
    openId: data.openId ?? "demo-open-id",
    displayName: data.profile.display_name || "TikTok Store",
    username: data.profile.username ?? null,
    summary: {
      currentFollowerCount: current,
      previousDayFollowerCount: yesterday,
      dailyFollowerGrowth: 47,
      sevenDayFollowerCount: sevenDaysAgo,
      sevenDayFollowerGrowth: 286,
      thirtyDayFollowerCount: thirtyDaysAgo,
      thirtyDayFollowerGrowth: 1_124,
    },
    history,
  };
}
