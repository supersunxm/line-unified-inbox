import type { Metadata } from "next";
import { cookies } from "next/headers";
import { StoreOwnerAnalytics } from "./store-owner-analytics";
import { callTikTokStoreBindingBackend } from "../../../tiktok/store-binding-backend";
import {
  TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
  TIKTOK_STORE_BINDING_SESSION_COOKIE,
  verifyTikTokStoreBindingSession,
  verifyTikTokStoreOwnerAnalyticsSession,
} from "../../../tiktok/store-binding-session";
import type { TikTokStoreOwnerAnalyticsData } from "../../../tiktok/tiktok-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store TikTok Analytics | OPPO Brand Shop",
  description: "TikTok analytics for the connected OPPO Brand Shop account.",
  robots: { index: false, follow: false },
};

async function loadAnalytics(): Promise<{ data: TikTokStoreOwnerAnalyticsData | null; sessionState: "VALID" | "EXPIRED" }> {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE)?.value;
  const session = verifyTikTokStoreOwnerAnalyticsSession(sessionValue);
  if (sessionValue && !session) {
    return { data: null, sessionState: "EXPIRED" };
  }
  if (!sessionValue) {
    const bindingSession = verifyTikTokStoreBindingSession(
      cookieStore.get(TIKTOK_STORE_BINDING_SESSION_COOKIE)?.value,
    );
    return bindingSession
      ? { data: { status: "NEEDS_STORE_CONFIRMATION" }, sessionState: "VALID" }
      : { data: null, sessionState: "EXPIRED" };
  }

  try {
    const response = await callTikTokStoreBindingBackend("/tiktok/internal/store-owner/me", {
      headers: {
        Cookie: `${TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE}=${sessionValue}`,
      },
    });
    if (response.status === 401) return { data: null, sessionState: "EXPIRED" };
    if (!response.ok) return { data: { status: "RECONNECT_REQUIRED" }, sessionState: "VALID" };
    return { data: (await response.json()) as TikTokStoreOwnerAnalyticsData, sessionState: "VALID" };
  } catch {
    return { data: { status: "RECONNECT_REQUIRED" }, sessionState: "VALID" };
  }
}

export default async function StoreOwnerTikTokAnalyticsPage() {
  const result = await loadAnalytics();
  return <StoreOwnerAnalytics data={result.data} sessionState={result.sessionState} />;
}
