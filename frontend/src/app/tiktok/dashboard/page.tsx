import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchTikTokAccountsListFromBackend } from "../tiktok-api-client";
import { TikTokDashboardResponsive } from "./tiktok-dashboard-responsive";

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

  const accounts = await fetchTikTokAccountsListFromBackend({ sessionToken });

  if (accounts.length === 0) {
    return <TikTokDashboardResponsive data={null} />;
  }

  if (accounts.length === 1) {
    redirect(`/tiktok/dashboard/${accounts[0].id}`);
  }

  redirect("/tiktok");
}
