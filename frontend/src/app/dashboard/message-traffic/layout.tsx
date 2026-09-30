import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Message Traffic") };

export default function MessageTrafficLayout({ children }: { children: ReactNode }) {
  return children;
}
