import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("ภาพรวมเดือน (v2)") };

export default function V2RootLayout({ children }: { children: ReactNode }) {
  return children;
}
