import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  fetchLatestTikTokAccountFromBackend,
  fetchTikTokAccountsListFromBackend,
  fetchTikTokHistoricalMetricsFromBackend,
} from "./tiktok-api-client";
import { TikTokOverviewView } from "./tiktok-overview-view";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "./dashboard/tiktok-demo-growth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Account Overview | OPPO Retail TikTok Monitor",
  description: "Authorized TikTok store account profile, metrics, and module overview.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TikTokOverviewPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();

  if (!sessionToken) {
    redirect("/login");
  }

  const accounts = await fetchTikTokAccountsListFromBackend({ sessionToken });
  const singleAccountId = accounts.length === 1 ? accounts[0].id : null;

  const [singleAccountData, realHistoricalMetrics] =
    accounts.length === 1
      ? await Promise.all([
          fetchLatestTikTokAccountFromBackend({ sessionToken }),
          singleAccountId
            ? fetchTikTokHistoricalMetricsFromBackend(singleAccountId, 30, {
                sessionToken,
              })
            : Promise.resolve(null),
        ])
      : [null, null];

  const historicalMetrics = isTikTokDemoGrowthEnabled()
    ? getTikTokDemoGrowthMetrics(singleAccountId || "acc-central-world")
    : realHistoricalMetrics;

  return (
    <TikTokOverviewView
      accounts={accounts}
      singleAccountData={singleAccountData}
      historicalMetrics={historicalMetrics}
    />
  );
}
