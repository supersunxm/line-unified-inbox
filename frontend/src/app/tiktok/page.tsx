import type { Metadata } from "next";
import { fetchLatestTikTokAccountFromBackend } from "./tiktok-api-client.ts";
import { TikTokDashboardView } from "./tiktok-dashboard-view.tsx";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Account Overview | OPPO Retail TikTok Monitor",
  description: "Authorized TikTok store account profile, metrics, and video analytics overview.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TikTokDashboardPage() {
  const data = await fetchLatestTikTokAccountFromBackend();
  return <TikTokDashboardView data={data} />;
}
