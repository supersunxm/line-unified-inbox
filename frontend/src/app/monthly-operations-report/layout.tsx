import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("รายงาน LINE รายเดือน") };

export default function MonthlyOperationsReportLayout({ children }: { children: ReactNode }) {
  return children;
}
