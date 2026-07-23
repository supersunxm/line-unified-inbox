"use client";

import { useMemo, useState } from "react";
import type { SummaryDailyRow } from "@/types/api";
import { getFollowerInsightsText, type Language } from "./follower-insights-translations";
import { formatDateDisplay } from "./follower-insights-utils";

interface DailySummaryTableProps {
  summaryData: SummaryDailyRow[];
  summaryError: string | null;
  dateFrom: string;
  dateTo: string;
  language?: Language;
}

export function DailySummaryTable({
  summaryData,
  summaryError,
  dateFrom,
  dateTo,
  language = "en",
}: DailySummaryTableProps) {
  // Use range key to reset page state when date range changes
  return (
    <DailySummaryTableInner
      key={`${dateFrom}_${dateTo}_${language}`}
      summaryData={summaryData}
      summaryError={summaryError}
      language={language}
    />
  );
}

function DailySummaryTableInner({
  summaryData,
  summaryError,
  language = "en",
}: {
  summaryData: SummaryDailyRow[];
  summaryError: string | null;
  language?: Language;
}) {
  const t = getFollowerInsightsText(language);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const reversedSummary = useMemo(() => [...summaryData].reverse(), [summaryData]);
  const totalPages = Math.max(1, Math.ceil(reversedSummary.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIdx = (safePage - 1) * pageSize;
    return reversedSummary.slice(startIdx, startIdx + pageSize);
  }, [reversedSummary, safePage, pageSize]);

  const startRecord = reversedSummary.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(reversedSummary.length, safePage * pageSize);

  const accountsReadyValues = useMemo(() => new Set(summaryData.map((d) => d.accountsReady)), [summaryData]);
  const hasCoverageVariation = accountsReadyValues.size > 1;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col lg:col-span-1 shadow-sm">
      <div className="border-b border-[var(--border)] p-4 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--foreground)]">{t.dailySummary}</h3>
        <span className="text-xs text-[var(--muted)]">{t.totalDaysCount(summaryData.length)}</span>
      </div>

      {hasCoverageVariation && (
        <div className="border-b border-[var(--border)] bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{t.accountCoverageDiffersNote}</span>
        </div>
      )}

      {summaryError ? (
        <div className="p-8 text-center text-sm text-amber-600 dark:text-amber-400">{t.errorLoadingSummary}</div>
      ) : summaryData.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--muted)]">{t.noDailySummaryData}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-max">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--muted)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{language === "th" ? "วันที่" : "Date"}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.followers}</th>
                  <th className="px-4 py-3 font-medium text-right">{t.dailyIncrease}</th>
                  <th className="px-4 py-3 font-medium text-center">{t.ready}</th>
                  <th className="px-4 py-3 font-medium text-center">{language === "th" ? "สถานะข้อมูล" : "Data Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {paginatedData.map((row) => {
                  const isFullyReady =
                    row.accountsReady === row.accountsExpected && row.accountsExpected > 0;
                  const isPartial = (row.accountsWithData ?? 0) > 0 && !isFullyReady;
                  const isNoData = (row.accountsWithData ?? 0) === 0;

                  return (
                    <tr key={row.date} className="hover:bg-[var(--hover)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                        {formatDateDisplay(row.date, language)}
                      </td>
                      <td className="px-4 py-3 text-right">{row.followers?.toLocaleString() ?? "—"}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          row.dailyIncrease && row.dailyIncrease > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : row.dailyIncrease && row.dailyIncrease < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {row.dailyIncrease !== null && row.dailyIncrease !== undefined
                          ? (row.dailyIncrease > 0 ? "+" : "") + row.dailyIncrease.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--foreground)]">
                        {row.accountsReady} / {row.accountsExpected}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isFullyReady && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            {t.ready}
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
                            {t.partial}
                          </span>
                        )}
                        {isNoData && (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
                            {t.noData}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>
              {t.showingDaysText(startRecord, endRecord, reversedSummary.length)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--hover)] disabled:opacity-40 transition-colors"
                aria-label={t.previous}
              >
                {t.previous}
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`h-7 w-7 rounded-lg font-medium transition-colors ${
                    safePage === p ? "bg-blue-600 text-white" : "hover:bg-[var(--hover)] text-[var(--muted)]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--hover)] disabled:opacity-40 transition-colors"
                aria-label={t.next}
              >
                {t.next}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
