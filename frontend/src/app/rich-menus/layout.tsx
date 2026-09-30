import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("จัดการ Rich Menu") };

export default function RichMenusLayout({ children }: { children: ReactNode }) {
  return children;
}
