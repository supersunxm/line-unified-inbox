import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  fetchLatestTikTokAccountFromBackend,
  fetchTikTokAccountsListFromBackend,
  fetchTikTokHistoricalMetricsFromBackend,
} from "./tiktok-api-client";
import { TikTokOverviewView } from "./tiktok-overview-view";
import type { TikTokAccountListItem } from "./tiktok-types";
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

function isTwoStorePreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TIKTOK_DEMO_MULTI_STORE === "true";
}

function createSecondStorePreview(source: TikTokAccountListItem): TikTokAccountListItem {
  return {
    ...source,
    id: "demo-preview-mega-bangna",
    openId: "demo-preview-mega-bangna",
    unionId: null,
    username: "o_megab a ngna".replaceAll(" ", ""),
    displayName: "O-Mega Bangna · DEMO",
    avatarUrl: null,
    avatarUrl100: null,
    avatarLargeUrl: null,
    bioDescription: "Preview store used only to review the two-store overview layout.",
    profileDeepLink: null,
    profileWebLink: null,
    isVerified: false,
    followerCount: 12_317,
    followingCount: 272,
    likesCount: 86_047,
    videoCount: 318,
    videoCountRecorded: 20,
    connectionStatus: "DEMO PREVIEW",
    storeMasterId: "demo-preview-mega-bangna-store",
    storeMaster: {
      id: "demo-preview-mega-bangna-store",
      storeName: "OBS Mega Bangna By OPPO",
      accountName: "O-Mega Bangna",
      province: "Samut Prakan",
      region: "Central",
    },
  };
}

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

  const overviewAccounts =
    isTwoStorePreviewEnabled() && accounts.length === 1
      ? [accounts[0], createSecondStorePreview(accounts[0])]
      : accounts;

  return (
    <TikTokOverviewView
      accounts={overviewAccounts}
      singleAccountData={singleAccountData}
      historicalMetrics={historicalMetrics}
    />
  );
}
