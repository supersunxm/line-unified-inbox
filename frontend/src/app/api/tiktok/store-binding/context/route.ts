import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callTikTokStoreBindingBackend } from "@/app/tiktok/store-binding-backend";
import {
  TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
  TIKTOK_STORE_OWNER_ANALYTICS_SESSION_MAX_AGE,
  TIKTOK_STORE_BINDING_SESSION_COOKIE,
  createTikTokStoreOwnerAnalyticsSession,
  verifyTikTokStoreBindingSession,
} from "@/app/tiktok/store-binding-session";

export const dynamic = "force-dynamic";

function getConfirmedStoreId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const currentStore = (payload as { currentStore?: unknown }).currentStore;
  if (!currentStore || typeof currentStore !== "object" || Array.isArray(currentStore)) return null;
  const id = (currentStore as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = verifyTikTokStoreBindingSession(
    cookieStore.get(TIKTOK_STORE_BINDING_SESSION_COOKIE)?.value,
  );

  if (!session) {
    return NextResponse.json(
      { error: "store_binding_session_expired" },
      { status: 401 },
    );
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() || "";
  const path = `/tiktok/internal/store-binding/${encodeURIComponent(session.accountId)}${
    query ? `?query=${encodeURIComponent(query)}` : ""
  }`;

  try {
    const response = await callTikTokStoreBindingBackend(path);
    const payload = await response.json().catch(() => ({ error: "invalid_backend_response" }));
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const confirmedStoreId = response.ok ? getConfirmedStoreId(payload) : null;
    if (confirmedStoreId) {
      nextResponse.cookies.set(
        TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
        createTikTokStoreOwnerAnalyticsSession(session.accountId, confirmedStoreId),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: TIKTOK_STORE_OWNER_ANALYTICS_SESSION_MAX_AGE,
          path: "/",
        },
      );
    }
    return nextResponse;
  } catch {
    return NextResponse.json({ error: "store_binding_backend_unavailable" }, { status: 502 });
  }
}
