import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("ข้อมูลผู้ติดตาม") };

export default function FollowerInsightsLayout({ children }: { children: ReactNode }) {
  return children;
}
