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
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3 text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      {/* Left side: Range text & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 text-[var(--muted)]">
        <label className="flex items-center gap-1.5 font-medium">
          <span>{t.itemsPerPage}</span>
          <select
            aria-label={t.itemsPerPage}
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-2 py-1 text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>

        <span className="font-semibold text-[var(--foreground)]">
          {t.showingRangeText(startRecord, endRecord, totalCount)}
        </span>
      </div>

      {/* Right side: Page Navigation Buttons */}
      <div className="flex items-center gap-1 self-end sm:self-auto">
        {/* Previous Button */}
        <button
          type="button"
          aria-label={t.previous}
          disabled={loading || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--input-background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          ‹ {t.previous}
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
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
                className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "border border-[var(--border)] bg-[var(--input-background)] text-[var(--foreground)] hover:bg-[var(--hover)]"
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
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--border)]/30 bg-[var(--input-background)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t.next} ›
        </button>
      </div>
    </div>
  );
}
