"use client";

import { useEffect, type ReactNode } from "react";
import { canDownloadData } from "./authorization";
import { getAuthUser, useAuthUser } from "./auth-user-store";
export { authorizeDataDownload } from "./data-download-policy";

export function useCanDownloadData() {
  const user = useAuthUser();
  useEffect(() => { void getAuthUser().catch(() => undefined); }, []);
  return canDownloadData(user);
}

/** Rendering only. File endpoints enforce the same capability on the server. */
export function DownloadAction({ children }: { children: ReactNode }) {
  return useCanDownloadData() ? children : null;
}
