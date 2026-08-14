import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchLatestTikTokAccountFromBackend } from "../tiktok-api-client";
import { TikTokDashboardView } from "./tiktok-dashboard-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Performance Dashboard | OPPO Retail TikTok Monitor",
  description:
    "Real-time retail TikTok store performance analytics, audience growth metrics, and video engagement insights.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TikTokDashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();

  if (!sessionToken) {
    redirect("/login");
  }

  const data = await fetchLatestTikTokAccountFromBackend({ sessionToken });
  return <TikTokDashboardView data={data} />;
}
