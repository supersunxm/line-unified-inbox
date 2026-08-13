"use client";

import {
  calculatePaginationBounds,
  getChatsPaginationText,
  getPageNumbers,
  type Language,
} from "./chats-pagination-utils";

interface ConversationPaginationFooterProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  loading?: boolean;
  language?: Language;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function ConversationPaginationFooter({
  currentPage,
  pageSize,
  totalCount,
  loading = false,
  language = "en",
  onPageChange,
  onPageSizeChange,
}: ConversationPaginationFooterProps) {
  const t = getChatsPaginationText(language);
  const { safePage, totalPages, startRecord, endRecord } = calculatePaginationBounds(
    totalCount,
    currentPage,
    pageSize
  );

  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-3 py-2 text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Left side: Range text & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-2.5 text-slate-500 dark:text-slate-400 font-tabular">
        <label className="flex items-center gap-1.5 font-medium">
          <span className="text-[11px]">{t.itemsPerPage}</span>
          <select
            aria-label={t.itemsPerPage}
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[var(--input-background)] px-1.5 py-0.5 text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 transition-colors"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={40}>40</option>
          </select>
        </label>

        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          {t.showingRangeText(startRecord, endRecord, totalCount)}
        </span>
      </div>

      {/* Right side: Page Navigation Buttons */}
      <div className="flex items-center gap-1 self-end sm:self-auto font-tabular">
        {/* Previous Button */}
        <button
          type="button"
          aria-label={t.previous}
          disabled={loading || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-[var(--input-background)] px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          ‹ {t.previous}
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-0.5">
          {pageNumbers.map((p) => {
            const isActive = p === safePage;
            return (
              <button
                key={p}
                type="button"
                aria-label={t.pageOfTotal(p, totalPages)}
                aria-current={isActive ? "page" : undefined}
                disabled={loading}
                onClick={() => onPageChange(p)}
                className={`min-w-[24px] h-6 rounded-md text-[11px] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-emerald-600 dark:text-white font-semibold shadow-2xs"
                    : "border border-slate-200 dark:border-slate-800 bg-[var(--input-background)] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                } disabled:opacity-50`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          aria-label={t.next}
          disabled={loading || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-[var(--input-background)] px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          {t.next} ›
        </button>
      </div>
    </div>
  );
}
