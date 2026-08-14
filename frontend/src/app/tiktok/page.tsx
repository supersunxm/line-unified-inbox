import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();

  if (!sessionToken) {
    redirect("/login");
  }

  const data = await fetchLatestTikTokAccountFromBackend({ sessionToken });
  return <TikTokOverviewView data={data} />;
}
