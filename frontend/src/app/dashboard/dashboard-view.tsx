"use client";

import { Suspense } from "react";
import type { LineOfficialAccountResponse } from "@/types/api";
import { MonthlyDashboard } from "./monthly-dashboard";

type Language = "th" | "en" | "zh";

interface DashboardViewProps {
  language: Language;
  lineOas?: LineOfficialAccountResponse[];
  dashboardSummary?: unknown;
  bmSummaryData?: unknown;
  getStoreDisplayName: (name: string) => string;
  onOpenStore: (storeId: string) => void;
  lastUpdatedAt: Date | null;
}

/**
 * /dashboard on desktop (inside the workspace) and mobile: the monthly dashboard
 * (monthly-dashboard.tsx). The props are kept so both callers stay unchanged; the dashboard reads
 * its own month (?month=) and data through the metrics layer, and links stores to Store 360.
 */
export function DashboardView(_props: DashboardViewProps) {
  void _props;
  // useSearchParams (?month=) needs a Suspense boundary so the route can still be prerendered.
  return (
    <div className="min-w-0 max-w-full">
      <Suspense fallback={null}>
        <MonthlyDashboard />
      </Suspense>
    </div>
  );
}
