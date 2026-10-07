import type { Metadata } from "next";
import { internalPageTitle } from "@/lib/page-title";
import { MonthOverview } from "@/components/v2/month-overview";

export const metadata: Metadata = { title: internalPageTitle("ภาพรวมเดือน (v2)") };

export default function V2MonthOverviewPage() {
  return <MonthOverview />;
}
