import type { TikTokStoreData } from "./tiktok-types.ts";

/**
 * Server-side proof-of-concept in-memory store for authorized TikTok account data.
 * Keeps tokens and raw credentials off client bundles, cookies, and localStorage.
 */
let latestTikTokData: TikTokStoreData | null = null;

export function setLatestTikTokData(data: TikTokStoreData): void {
  latestTikTokData = data;
}

export function getLatestTikTokData(): TikTokStoreData | null {
  return latestTikTokData;
}

export function clearLatestTikTokData(): void {
  latestTikTokData = null;
}
