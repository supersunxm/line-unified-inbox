import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("คูปอง") };

export default function CouponsLayout({ children }: { children: ReactNode }) {
  return children;
}
