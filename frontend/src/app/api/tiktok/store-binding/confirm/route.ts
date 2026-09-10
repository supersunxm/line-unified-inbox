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

function getConnectedStoreId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = payload as { status?: unknown; store?: unknown };
  if (raw.status !== "CONNECTED" || !raw.store || typeof raw.store !== "object" || Array.isArray(raw.store)) {
    return null;
  }
  const id = (raw.store as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = verifyTikTokStoreBindingSession(
    cookieStore.get(TIKTOK_STORE_BINDING_SESSION_COOKIE)?.value,
  );
  if (!session) {
    return NextResponse.json({ error: "store_binding_session_expired" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { storeMasterId?: string };
  const storeMasterId = body.storeMasterId?.trim();
  if (!storeMasterId) {
    return NextResponse.json({ error: "storeMasterId_required" }, { status: 400 });
  }

  try {
    const response = await callTikTokStoreBindingBackend(
      `/tiktok/internal/store-binding/${encodeURIComponent(session.accountId)}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ storeMasterId }),
      },
    );
    const payload = await response.json().catch(() => ({ error: "invalid_backend_response" }));
    const nextResponse = NextResponse.json(payload, { status: response.status });
    const connectedStoreId = response.ok ? getConnectedStoreId(payload) : null;
    if (connectedStoreId) {
      nextResponse.cookies.set(
        TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
        createTikTokStoreOwnerAnalyticsSession(session.accountId, connectedStoreId),
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
