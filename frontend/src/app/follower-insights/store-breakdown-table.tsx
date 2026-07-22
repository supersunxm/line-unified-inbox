"use client";

import { useMemo, useState } from "react";
import type { ByStoreAccountRow } from "@/types/api";
import { formatBkkDateTime, exportStoreCsv } from "./follower-insights-utils";

interface StoreBreakdownTableProps {
  storeData: ByStoreAccountRow[];
  storeError: string | null;
  dateFrom: string;
  dateTo: string;
  onRetry: () => void;
}

export function StoreBreakdownTable({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  onRetry,
}: StoreBreakdownTableProps) {
  // Use range key to reset table page/search state when date range changes
  return (
    <StoreBreakdownTableInner
      key={`${dateFrom}_${dateTo}`}
      storeData={storeData}
      storeError={storeError}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onRetry={onRetry}
    />
  );
}

function StoreBreakdownTableInner({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  onRetry,
}: StoreBreakdownTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"periodIncrease" | "followers" | "accountName">(
    "periodIncrease"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1); // Reset page to 1 on search filter change
  };

  const handleSort = (field: "periodIncrease" | "followers" | "accountName") => {
    setSortDir((d) => (sortField === field && d === "desc" ? "asc" : "desc"));
    setSortField(field);
  };

  const filteredStores = useMemo(() => {
    let res = storeData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      res = res.filter(
        (s) =>
          (s.accountName && s.accountName.toLowerCase().includes(q)) ||
          (s.storeName && s.storeName.toLowerCase().includes(q))
      );
    }

    return [...res].sort((a, b) => {
      let aVal: number | string = a[sortField] ?? 0;
      let bVal: number | string = b[sortField] ?? 0;
      if (sortField === "accountName") {
        aVal = a.accountName || "";
        bVal = b.accountName || "";
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [storeData, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedStores = useMemo(() => {
    const startIdx = (safePage - 1) * pageSize;
    return filteredStores.slice(startIdx, startIdx + pageSize);
  }, [filteredStores, safePage, pageSize]);

  const startRecord = filteredStores.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(filteredStores.length, safePage * pageSize);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex flex-col lg:col-span-2 shadow-sm">
      {/* Table Header Controls */}
      <div className="border-b border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Store Breakdown</h3>
          <p className="text-xs text-slate-400">Snapshot target date: {dateTo}</p>
        </div>

        <div className="flex items-center gap-2">
          {!storeError && storeData.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search stores or LINE OAs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:w-64 rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 pl-9 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <svg
                className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          )}

          <button
            type="button"
            onClick={() => exportStoreCsv(filteredStores, dateFrom, dateTo)}
            disabled={filteredStores.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition-colors"
            title="Export filtered stores CSV"
            aria-label="Export CSV"
          >
            <svg
              className="h-3.5 w-3.5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {storeError ? (
        <div className="p-8 text-center text-sm text-amber-400 flex flex-col items-center justify-center gap-2">
          <p>Error: {storeError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
          >
            Retry Store Data
          </button>
        </div>
      ) : storeData.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">No store breakdown data</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-max">
              <thead className="bg-slate-950/60 text-xs text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th
                    className="font-medium p-0"
                    aria-sort={
                      sortField === "accountName"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full h-full px-4 py-3 hover:bg-slate-800/50 text-slate-400"
                      onClick={() => handleSort("accountName")}
                    >
                      LINE OA {sortField === "accountName" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th
                    className="font-medium text-right p-0"
                    aria-sort={
                      sortField === "followers"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-slate-800/50 text-slate-400"
                      onClick={() => handleSort("followers")}
                    >
                      Followers {sortField === "followers" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right text-slate-400">Start Followers</th>
                  <th
                    className="font-medium text-right p-0"
                    aria-sort={
                      sortField === "periodIncrease"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-slate-800/50 text-slate-400"
                      onClick={() => handleSort("periodIncrease")}
                    >
                      Period Increase {sortField === "periodIncrease" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Targeted Reach</th>
                  <th className="px-4 py-3 font-medium text-right">Blocks</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium">Last Fetched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {paginatedStores.map((row) => (
                  <tr key={row.lineOaId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{row.storeName}</td>
                    <td className="px-4 py-3 font-medium text-slate-200">{row.accountName}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.followers?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {row.startFollowers?.toLocaleString() ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        row.periodIncrease && row.periodIncrease > 0
                          ? "text-emerald-400"
                          : row.periodIncrease && row.periodIncrease < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {row.periodIncrease !== null && row.periodIncrease !== undefined
                        ? (row.periodIncrease > 0 ? "+" : "") + row.periodIncrease.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{row.targetedReaches?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{row.blocks?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20"
                            : row.status === "missing"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatBkkDateTime(row.fetchedAt)}</td>
                  </tr>
                ))}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No stores found matching &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {startRecord} to {endRecord} of {filteredStores.length} stores
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
