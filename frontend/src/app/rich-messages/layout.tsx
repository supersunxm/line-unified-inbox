import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Rich Message") };

export default function RichMessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
