import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Broadcast") };

export default function BroadcastLayout({ children }: { children: ReactNode }) {
  return children;
}
