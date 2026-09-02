import type { Metadata } from "next";
import { TikTokConnectErrorContent } from "./error-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unable to Connect TikTok | OPPO Retail Operations",
  description: "There was a problem connecting your TikTok account to OPPO Retail Operations.",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function TikTokConnectErrorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <TikTokConnectErrorContent reason={params.reason} />;
}
