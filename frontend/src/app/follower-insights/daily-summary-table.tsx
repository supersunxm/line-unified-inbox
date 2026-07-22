"use client";

import { useMemo, useState } from "react";
import type { SummaryDailyRow } from "@/types/api";

interface DailySummaryTableProps {
  summaryData: SummaryDailyRow[];
  summaryError: string | null;
  dateFrom: string;
  dateTo: string;
}

export function DailySummaryTable({
  summaryData,
  summaryError,
  dateFrom,
  dateTo,
}: DailySummaryTableProps) {
  // Use range key to reset page state when date range changes
  return (
    <DailySummaryTableInner
      key={`${dateFrom}_${dateTo}`}
      summaryData={summaryData}
      summaryError={summaryError}
    />
  );
}

function DailySummaryTableInner({
  summaryData,
  summaryError,
}: {
  summaryData: SummaryDailyRow[];
  summaryError: string | null;
}) {
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

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col lg:col-span-1 shadow-sm">
      <div className="border-b border-slate-800 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Daily Summary</h3>
        <span className="text-xs text-slate-400">{summaryData.length} total days</span>
      </div>

      {summaryError ? (
        <div className="p-8 text-center text-sm text-amber-400">Error loading daily summary</div>
      ) : summaryData.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">No daily summary data</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-max">
              <thead className="bg-slate-950/60 text-xs text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Followers</th>
                  <th className="px-4 py-3 font-medium text-right">Increase</th>
                  <th className="px-4 py-3 font-medium text-center">Ready</th>
                  <th className="px-4 py-3 font-medium text-center">Data Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {paginatedData.map((row) => {
                  const isFullyReady =
                    row.accountsReady === row.accountsExpected && row.accountsExpected > 0;
                  const isPartial = (row.accountsWithData ?? 0) > 0 && !isFullyReady;
                  const isNoData = (row.accountsWithData ?? 0) === 0;

                  return (
                    <tr key={row.date} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{row.date}</td>
                      <td className="px-4 py-3 text-right">{row.followers?.toLocaleString() ?? "—"}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          row.dailyIncrease && row.dailyIncrease > 0
                            ? "text-emerald-400"
                            : row.dailyIncrease && row.dailyIncrease < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }`}
                      >
                        {row.dailyIncrease !== null && row.dailyIncrease !== undefined
                          ? (row.dailyIncrease > 0 ? "+" : "") + row.dailyIncrease.toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-300">
                        {row.accountsReady} / {row.accountsExpected}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isFullyReady && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            Ready
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                            Partial
                          </span>
                        )}
                        {isNoData && (
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 ring-1 ring-inset ring-rose-500/20">
                            No data
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
          <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {startRecord} to {endRecord} of {reversedSummary.length} days
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-800 px-2.5 py-1 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`h-7 w-7 rounded-lg font-medium transition-colors ${
                    safePage === p ? "bg-blue-600 text-white" : "hover:bg-slate-800 text-slate-400"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-slate-800 px-2.5 py-1 hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
