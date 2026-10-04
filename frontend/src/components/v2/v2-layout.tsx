"use client";

import React from "react";
import { AuthorizedSection } from "@/app/authorized-workspace";
import { V2DataProvider } from "./v2-data";
import { V2Shell } from "./v2-shell";

/** Gated like the other internal pages; the shell and its data persist across /v2 navigation. */
export function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthorizedSection section="dashboard">
      <V2DataProvider>
        <V2Shell>{children}</V2Shell>
      </V2DataProvider>
    </AuthorizedSection>
  );
}
