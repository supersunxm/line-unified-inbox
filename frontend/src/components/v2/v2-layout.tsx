"use client";

import { usePathname } from "next/navigation";
import React, { Suspense } from "react";
import { AuthorizedSection } from "@/app/authorized-workspace";
import { V2DataProvider } from "./v2-data";
import { V2MonthDataProvider } from "./v2-month-data";
import { V2Shell } from "./v2-shell";

/** The live ("ตอนนี้") sources load only on /v2/response; the monthly sources serve every other page. */
function V2Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/v2";
  return (
    <V2DataProvider active={pathname.startsWith("/v2/response")}>
      <V2MonthDataProvider>
        <V2Shell>{children}</V2Shell>
      </V2MonthDataProvider>
    </V2DataProvider>
  );
}

/** Gated like the other internal pages; the shell and its data persist across /v2 navigation. */
export function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthorizedSection section="dashboard">
      {/* ?month= is read with useSearchParams, which needs a Suspense boundary for prerendering. */}
      <Suspense fallback={null}>
        <V2Providers>{children}</V2Providers>
      </Suspense>
    </AuthorizedSection>
  );
}
