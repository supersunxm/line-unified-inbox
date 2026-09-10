"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { canAccessPrimarySection, type AuthUser } from "@/lib/authorization";
import { PublicStoresDirectory } from "./public-stores-directory";

type StoresRouteState = "checking" | "public";

export function StoresRoute() {
  const searchParams = useSearchParams();
  const forcePublic = searchParams.get("view") === "public";
  const [state, setState] = useState<StoresRouteState>(forcePublic ? "public" : "checking");

  useEffect(() => {
    if (forcePublic) {
      setState("public");
      return;
    }

    let cancelled = false;

    void fetch("/auth/me", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
    })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setState("public");
          return;
        }

        const user = (await response.json()) as AuthUser;
        if (canAccessPrimarySection(user, "stores")) {
          window.location.replace("/admin/stores");
          return;
        }

        setState("public");
      })
      .catch(() => {
        if (!cancelled) setState("public");
      });

    return () => {
      cancelled = true;
    };
  }, [forcePublic]);

  if (state === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">
        กำลังตรวจสอบสิทธิ์...
      </main>
    );
  }

  return <PublicStoresDirectory />;
}
