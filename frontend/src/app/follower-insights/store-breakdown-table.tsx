"use client";

import { useMemo, useState } from "react";
import type { ByStoreAccountRow } from "@/types/api";
import { formatBkkDateTime, exportStoreCsv } from "./follower-insights-utils";

interface StoreBreakdownTableProps {
  storeData: ByStoreAccountRow[];
  storeError: string | null;
  dateFrom: string;
  dateTo: string;
  endpointsUsable: boolean;
  onRetry: () => void;
}

export function StoreBreakdownTable({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  endpointsUsable,
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
      endpointsUsable={endpointsUsable}
      onRetry={onRetry}
    />
  );
}

function StoreBreakdownTableInner({
  storeData,
  storeError,
  dateFrom,
  dateTo,
  endpointsUsable,
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col lg:col-span-2 shadow-sm">
      {/* Table Header Controls */}
      <div className="border-b border-[var(--border)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">Store Breakdown</h3>
          <p className="text-xs text-[var(--muted)]">Snapshot target date: {dateTo}</p>
        </div>

        <div className="flex items-center gap-2">
          {!storeError && storeData.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search stores or LINE OAs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:w-64 rounded-xl bg-[var(--input-background)] border border-[var(--border)] px-3 py-1.5 pl-9 text-xs text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-blue-500 transition-colors"
              />
              <svg
                className="absolute left-3 top-2 h-3.5 w-3.5 text-[var(--muted)]"
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
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover)] disabled:opacity-40 transition-colors"
            title="Export filtered stores CSV"
            aria-label="Export CSV"
          >
            <svg
              className="h-3.5 w-3.5 text-[var(--muted)]"
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
        <div className="p-8 text-center text-sm text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center gap-2">
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
        <div className="p-8 text-center text-sm text-[var(--muted)]">No store breakdown data</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-max">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--muted)] border-b border-[var(--border)]">
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
                      className="flex items-center gap-1 w-full h-full px-4 py-3 hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
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
                      className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      onClick={() => handleSort("followers")}
                    >
                      Followers {sortField === "followers" && (sortDir === "asc" ? "↑" : "↓")}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right text-[var(--muted)]">Start Followers</th>
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
                      className="flex items-center justify-end gap-1 w-full h-full px-4 py-3 hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
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
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {paginatedStores.map((row) => (
                  <tr key={row.lineOaId} className="hover:bg-[var(--hover)] transition-colors">
                    <td className="px-4 py-3 text-[var(--muted)]">{row.storeName}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{row.accountName}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {row.followers?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">
                      {row.startFollowers?.toLocaleString() ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        endpointsUsable && row.periodIncrease && row.periodIncrease > 0
                          ? "text-green-600 dark:text-green-400"
                          : endpointsUsable && row.periodIncrease && row.periodIncrease < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {endpointsUsable && row.periodIncrease !== null && row.periodIncrease !== undefined
                        ? row.periodIncrease > 0
                          ? `+${row.periodIncrease.toLocaleString()}`
                          : row.periodIncrease.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{row.targetedReaches?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{row.blocks?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20"
                            : row.status === "missing"
                            ? "bg-[var(--badge-background)] text-[var(--badge-foreground)]"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{formatBkkDateTime(row.fetchedAt)}</td>
                  </tr>
                ))}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                      No stores found matching &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between text-xs text-[var(--muted)]">
            <span>
              Showing {startRecord} to {endRecord} of {filteredStores.length} stores
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1 hover:bg-[var(--hover)] disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`h-7 w-7 rounded-lg font-medium transition-colors ${
                    safePage === p ? "bg-blue-600 text-white" : "hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)]"
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
