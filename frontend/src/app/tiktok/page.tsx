import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TikTokPublicDashboard } from "./tiktok-public-dashboard";
import { fetchTikTokPublicOverview, fetchTikTokPublicStores } from "./tiktok-public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Analytics | OPPO Retail Operations",
  description: "Public TikTok profile analytics for OPPO retail stores.",
  robots: { index: false, follow: false },
};

export default async function TikTokOverviewPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();
  if (!sessionToken) redirect("/login");

  try {
    const [overview, stores] = await Promise.all([
      fetchTikTokPublicOverview({ sessionToken }),
      fetchTikTokPublicStores({ sessionToken }),
    ]);
    return <TikTokPublicDashboard overview={overview} stores={stores} />;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/login");
    throw error;
  }
}
