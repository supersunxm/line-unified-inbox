import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Main OA") };

export default function MainOaLayout({ children }: { children: ReactNode }) {
  return children;
}
