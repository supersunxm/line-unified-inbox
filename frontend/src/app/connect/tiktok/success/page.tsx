import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreBindingSuccess } from "./store-binding-success";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Connected Successfully | OPPO Brand Shop",
  description: "Your TikTok account has been successfully connected to OPPO Brand Shop.",
  robots: { index: false, follow: false },
};

interface VerifiedConnectResult {
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  likesCount?: number;
  videoCount?: number;
  storeName?: string;
  isStoreBound?: boolean;
  bindingStatus?: string;
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

export default async function PublicTikTokConnectSuccessPage() {
  const verifiedResult = await getVerifiedConnectResult();
  return (
    <StoreBindingSuccess
      displayName={verifiedResult?.displayName?.trim() || ""}
      username={verifiedResult?.username?.trim().replace(/^@+/, "") || ""}
      avatarUrl={verifiedResult?.avatarUrl?.trim() || ""}
      followerCount={verifiedResult?.followerCount ?? 0}
      followingCount={verifiedResult?.followingCount ?? 0}
      likesCount={verifiedResult?.likesCount ?? 0}
      videoCount={verifiedResult?.videoCount ?? 0}
    />
  );
}
