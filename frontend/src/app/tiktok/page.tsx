import type { Metadata } from "next";
import { getLatestTikTokData } from "./tiktok-data-store.ts";
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

export default function TikTokDashboardPage() {
  const data = getLatestTikTokData();
  return <TikTokDashboardView data={data} />;
}
