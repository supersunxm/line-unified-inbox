import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  fetchTikTokAccountByIdFromBackend,
  fetchTikTokAccountsListFromBackend,
  fetchTikTokHistoricalMetricsFromBackend,
} from "../../tiktok-api-client";
import {
  getTikTokDemoGrowthMetrics,
  isTikTokDemoGrowthEnabled,
} from "../tiktok-demo-growth";
import { TikTokDashboardView } from "../tiktok-dashboard-view";

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

  const [data, historicalMetrics, accounts] = await Promise.all([
    fetchTikTokAccountByIdFromBackend(accountId, { sessionToken }),
    fetchTikTokHistoricalMetricsFromBackend(accountId, 30, { sessionToken }),
    fetchTikTokAccountsListFromBackend({ sessionToken }),
  ]);

  if (!data) {
    notFound();
  }

  const effectiveHistoricalMetrics = isTikTokDemoGrowthEnabled()
    ? getTikTokDemoGrowthMetrics(data)
    : historicalMetrics;

  return (
    <TikTokDashboardView
      data={data}
      historicalMetrics={effectiveHistoricalMetrics}
      accounts={accounts}
      currentAccountId={accountId}
    />
  );
}
