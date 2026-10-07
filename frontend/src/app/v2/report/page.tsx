import type { Metadata } from "next";
import { MonthReport } from "@/components/v2/month-report";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("รายงานเดือน (v2)") };

export default function V2ReportPage() {
  return <MonthReport />;
}
