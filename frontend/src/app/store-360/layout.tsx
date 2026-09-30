import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Store 360") };

export default function Store360Layout({ children }: { children: ReactNode }) {
  return children;
}
