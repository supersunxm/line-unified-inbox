import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  fetchTikTokAccountByIdFromBackend,
  fetchTikTokAccountsListFromBackend,
  fetchTikTokHistoricalMetricsFromBackend,
} from "../../tiktok-api-client";
import { TikTokDashboardResponsive } from "../tiktok-dashboard-responsive";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "../tiktok-demo-growth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Store Performance Dashboard | OPPO Retail TikTok Monitor",
  description:
    "Store-level TikTok retail performance analytics, audience growth metrics, and video engagement insights.",
  robots: {
    index: false,
    follow: false,
  },
};

interface Props {
  params: Promise<{ accountId: string }>;
}

export default async function TikTokAccountDashboardPage({ params }: Props) {
  const { accountId } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();

  if (!sessionToken) {
    redirect("/login");
  }

  const [data, realHistoricalMetrics, accounts] = await Promise.all([
    fetchTikTokAccountByIdFromBackend(accountId, { sessionToken }),
    fetchTikTokHistoricalMetricsFromBackend(accountId, 30, { sessionToken }),
    fetchTikTokAccountsListFromBackend({ sessionToken }),
  ]);

  if (!data) {
    notFound();
  }

  const historicalMetrics = isTikTokDemoGrowthEnabled()
    ? getTikTokDemoGrowthMetrics(accountId)
    : realHistoricalMetrics;

  return (
    <TikTokDashboardResponsive
      data={data}
      historicalMetrics={historicalMetrics}
      accounts={accounts}
      currentAccountId={accountId}
    />
  );
}
