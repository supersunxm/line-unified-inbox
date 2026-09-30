import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("ส่งข้อความ") };

export default function MassMessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
