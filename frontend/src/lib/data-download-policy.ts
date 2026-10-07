import { canDownloadData, type AuthUser } from "./authorization.ts";

/** Fresh server identity for built-in exports, including actions in stale tabs. */
export async function authorizeDataDownload() {
  try {
    const response = await fetch("/auth/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) return false;
    return canDownloadData(await response.json() as AuthUser);
  } catch {
    return false;
  }
}
