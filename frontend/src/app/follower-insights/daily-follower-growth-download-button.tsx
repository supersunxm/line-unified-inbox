"use client";

import { useState } from "react";
import type { Language } from "./follower-insights-translations";
import { downloadDailyFollowerGrowthWorkbook } from "./daily-follower-growth-export";

export function DailyFollowerGrowthDownloadButton({
  dateFrom,
  dateTo,
  selectedLineOaIds,
  language = "en",
}: {
  dateFrom: string | null;
  dateTo: string | null;
  selectedLineOaIds: string[];
  language?: Language;
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = downloading || !dateFrom || !dateTo;

  const label = downloading
    ? language === "th"
      ? "กำลังสร้างไฟล์..."
      : language === "zh"
        ? "正在生成..."
        : "Preparing..."
    : language === "th"
      ? "ดาวน์โหลด LINE OA รายวัน"
      : language === "zh"
        ? "下载 LINE OA 每日数据"
        : "Download Daily LINE OA";

  const handleDownload = async () => {
    if (!dateFrom || !dateTo) return;
    setDownloading(true);
    setError(null);
    try {
      await downloadDailyFollowerGrowthWorkbook({ dateFrom, dateTo, selectedLineOaIds, language });
    } catch (err) {
      setError(err instanceof Error ? err.message : language === "th" ? "สร้างไฟล์ไม่สำเร็จ" : "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={disabled}
        title={
          selectedLineOaIds.length === 0
            ? language === "th" ? "ดาวน์โหลดทุกสาขาในช่วงวันที่เลือก" : "Download all stores in the selected date range"
            : language === "th" ? `ดาวน์โหลด ${selectedLineOaIds.length} สาขาที่เลือก` : `Download ${selectedLineOaIds.length} selected stores`
        }
        className="flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
      >
        {downloading ? (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
        )}
        <span>{label}</span>
      </button>
      {error && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-rose-500/30 bg-[var(--surface-elevated)] px-3 py-2 text-[11px] text-rose-600 shadow-lg dark:text-rose-400">
          {error}
        </div>
      )}
    </div>
  );
}
