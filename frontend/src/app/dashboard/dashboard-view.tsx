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
    <div className="executive-dashboard-mobile min-w-0 max-w-full">
      <style>{`
        @media (max-width: 767px) {
          html,
          body {
            overscroll-behavior-y: none;
          }

          .executive-dashboard-mobile {
            width: 100%;
            max-width: 100vw;
            min-height: 0 !important;
            overflow-x: hidden;
            overscroll-behavior-y: none;
          }

          .executive-dashboard-mobile > div {
            min-height: 0 !important;
            padding-bottom: 0.75rem !important;
          }

          .executive-dashboard-mobile > div > div {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            padding: 1rem 0.75rem 0.75rem !important;
          }

          .executive-dashboard-mobile header {
            margin-bottom: 1rem !important;
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 0.75rem !important;
          }

          .executive-dashboard-mobile header > div:first-child > div:first-child {
            margin-bottom: 0.25rem !important;
            font-size: 0.65rem !important;
            line-height: 1rem !important;
          }

          .executive-dashboard-mobile header h1 {
            font-size: 1.5rem !important;
            line-height: 1.9rem !important;
          }

          .executive-dashboard-mobile header > div:last-child {
            width: 100%;
            justify-content: space-between !important;
            gap: 0.5rem !important;
          }

          .executive-dashboard-mobile header > div:last-child > span {
            flex: 1 1 100%;
            font-size: 0.68rem !important;
          }

          .executive-dashboard-mobile header button {
            min-height: 2.5rem;
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .executive-dashboard-mobile section {
            border-radius: 1rem !important;
          }

          .executive-dashboard-mobile section[class*="p-7"],
          .executive-dashboard-mobile section[class*="p-6"],
          .executive-dashboard-mobile section[class*="p-[22px]"],
          .executive-dashboard-mobile section[class*="p-5"] {
            padding: 1rem !important;
          }

          .executive-dashboard-mobile section[class*="p-4"] {
            padding: 0.875rem !important;
          }

          .executive-dashboard-mobile section [class*="text-[44px]"] {
            font-size: 2.25rem !important;
            line-height: 2.5rem !important;
          }

          .executive-dashboard-mobile section [class*="sm:grid-cols-3"] {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
          }

          .executive-dashboard-mobile section [class*="sm:grid-cols-3"] > div {
            padding: 0.75rem 0.625rem !important;
          }

          .executive-dashboard-mobile section [class*="sm:grid-cols-3"] [class*="text-[19px]"] {
            font-size: 1rem !important;
          }

          .executive-dashboard-mobile section [class*="sm:grid-cols-3"] [class*="text-[11.5px]"] {
            font-size: 0.65rem !important;
            line-height: 0.9rem !important;
          }

          .executive-dashboard-mobile section [class*="h-[160px]"] {
            height: 7.5rem !important;
            margin-top: 1rem !important;
          }

          .executive-dashboard-mobile section [class*="gap-[18px]"] {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1rem !important;
          }

          .executive-dashboard-mobile section [class*="gap-[18px]"] > div:first-child {
            align-self: center;
          }

          .executive-dashboard-mobile section [class*="gap-[18px]"] > div:last-child {
            width: 100%;
          }

          .executive-dashboard-mobile section [class*="xl:grid-cols-4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.5rem !important;
          }

          .executive-dashboard-mobile section [class*="xl:grid-cols-4"] > div {
            padding: 0.75rem !important;
          }

          .executive-dashboard-mobile section button {
            min-height: 2.75rem;
          }

          .executive-dashboard-mobile section button > span:first-child {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
          }

          .executive-dashboard-mobile section table button {
            min-height: 2.25rem;
          }

          .executive-dashboard-mobile [class*="grid-cols-2"][class*="lg:grid-cols-4"] {
            grid-template-columns: 1fr !important;
          }

          .executive-dashboard-mobile [class*="overflow-x-auto"] {
            margin-left: -0.25rem;
            margin-right: -0.25rem;
            padding-left: 0.25rem;
            padding-right: 0.25rem;
            -webkit-overflow-scrolling: touch;
          }

          .executive-dashboard-mobile footer {
            margin-top: 1rem !important;
            margin-bottom: 0 !important;
            padding: 0 0.5rem 0.25rem;
            font-size: 0.68rem !important;
          }
        }
      `}</style>
      <ExecutiveDashboardV2
        language={language}
        getStoreDisplayName={getStoreDisplayName}
        onOpenStore={onOpenStore}
        lastUpdatedAt={lastUpdatedAt}
      />
    </div>
  );
}
