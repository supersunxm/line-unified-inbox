"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { canAccessPrimarySection, type AuthUser } from "@/lib/authorization";

export function StoreManagementRedirect() {
  const searchParams = useSearchParams();
  const forcePublic = searchParams.get("view") === "public";

  useEffect(() => {
    if (forcePublic) return;

    let cancelled = false;

    void fetch("/auth/me", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    })
      .then(async (response) => {
        if (cancelled || !response.ok) return;

        const user = (await response.json()) as AuthUser;
        if (canAccessPrimarySection(user, "stores")) {
          window.location.replace("/admin/stores");
        }
      })
      .catch(() => {
        // Public store discovery must remain usable if session lookup is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [forcePublic]);

  return null;
}
