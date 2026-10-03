import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("เพื่อน") };

export default function FollowerInsightsLayout({ children }: { children: ReactNode }) {
  return children;
}
