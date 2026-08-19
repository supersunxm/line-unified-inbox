"use client";

import type { LineOfficialAccountResponse } from "@/types/api";
import { ExecutiveDashboardV2 } from "./executive-dashboard-v2";

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

export function DashboardView({
  language,
  getStoreDisplayName,
  onOpenStore,
  lastUpdatedAt,
}: DashboardViewProps) {
  return (
    <ExecutiveDashboardV2
      language={language}
      getStoreDisplayName={getStoreDisplayName}
      onOpenStore={onOpenStore}
      lastUpdatedAt={lastUpdatedAt}
    />
  );
}
