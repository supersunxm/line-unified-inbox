import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Google Review KPI") };

export default function GoogleReviewKpiLayout({ children }: { children: ReactNode }) {
  return children;
}
