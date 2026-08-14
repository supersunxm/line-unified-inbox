import type { Metadata } from "next";
import { fetchLatestTikTokAccountFromBackend } from "./tiktok-api-client";
import { TikTokOverviewView } from "./tiktok-overview-view";

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
  const data = await fetchLatestTikTokAccountFromBackend();
  return <TikTokOverviewView data={data} />;
}
