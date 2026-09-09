import { API_BASE_URL } from "../../lib/runtime-config";

function getInternalSecret(): string {
  const secret = process.env.TIKTOK_INTERNAL_SYNC_SECRET?.trim();
  if (!secret) {
    throw new Error("TIKTOK_INTERNAL_SYNC_SECRET is required for TikTok store binding requests");
  }
  return secret;
}

export async function callTikTokStoreBindingBackend(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Internal-TikTok-Secret", getInternalSecret());
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
