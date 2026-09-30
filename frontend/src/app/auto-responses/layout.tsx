import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("ข้อความตอบกลับอัตโนมัติ") };

export default function AutoResponsesLayout({ children }: { children: ReactNode }) {
  return children;
}
