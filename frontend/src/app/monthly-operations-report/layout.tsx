import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { monthlyOperationsReportPhrases } from "./monthly-operations-report-i18n";

export const metadata: Metadata = { title: internalPageTitle("รายงาน LINE รายเดือน") };

export default function MonthlyOperationsReportLayout({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={monthlyOperationsReportPhrases} showControl={false}>{children}</LegacyI18nBoundary>;
}
