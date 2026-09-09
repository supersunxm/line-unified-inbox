import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { callTikTokStoreBindingBackend } from "@/app/tiktok/store-binding-backend";
import {
  TIKTOK_STORE_BINDING_SESSION_COOKIE,
  verifyTikTokStoreBindingSession,
} from "@/app/tiktok/store-binding-session";

export const dynamic = "force-dynamic";

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
      `/tiktok/internal/store-binding/${encodeURIComponent(session.accountId)}/request`,
      {
        method: "POST",
        body: JSON.stringify({ storeMasterId }),
      },
    );
    const payload = await response.json().catch(() => ({ error: "invalid_backend_response" }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ error: "store_binding_backend_unavailable" }, { status: 502 });
  }
}
