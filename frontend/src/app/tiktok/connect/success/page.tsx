import type { Metadata } from "next";
import { cookies } from "next/headers";
import { TikTokConnectSuccessContent } from "./success-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Connected Successfully | OPPO Retail Operations",
  description: "Your TikTok account has been successfully connected to OPPO Retail Operations.",
  robots: { index: false, follow: false },
};

interface VerifiedConnectResult {
  displayName?: string;
  username?: string;
  storeName?: string;
  timestamp?: number;
}

async function getVerifiedConnectResult(): Promise<VerifiedConnectResult | null> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("tiktok_connect_result")?.value;
    if (!rawCookie) return null;
    return JSON.parse(Buffer.from(rawCookie, "base64url").toString("utf8")) as VerifiedConnectResult;
  } catch {
    return null;
  }
}

export default async function TikTokConnectSuccessPage() {
  const verifiedResult = await getVerifiedConnectResult();
  return (
    <TikTokConnectSuccessContent
      displayName={verifiedResult?.displayName?.trim() || ""}
      username={verifiedResult?.username?.trim().replace(/^@+/, "") || ""}
      storeName={verifiedResult?.storeName?.trim() || ""}
    />
  );
}
