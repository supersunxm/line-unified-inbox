"use client";

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LineOfficialAccountResponse } from "@/types/api";
import { ExecutiveDashboardV2 } from "./executive-dashboard-v2";
import { rangeForPreset, type DashboardDateRange } from "./dashboard-date-range";

type Language = "th" | "en" | "zh";
type ResponseBucket = "under4h" | "between4and12h" | "between12and24h" | "over24h";

type ResponseBucketItem = {
  conversationId: string;
  storeId: string | null;
  storeName: string;
  customerName: string;
  inboundText: string;
  firstInboundAt: string;
  firstOutboundAt: string;
  responseMinutes: number;
};

type ResponseBucketDetails = {
  bucket: ResponseBucket;
  dateFrom: string;
  dateTo: string;
  total: number;
  shown: number;
  items: ResponseBucketItem[];
};

const BUCKET_META: Record<ResponseBucket, { label: string; shortLabel: string }> = {
  under4h: { label: "< 4 ชั่วโมง", shortLabel: "ตอบกลับภายใน 4 ชั่วโมง" },
  between4and12h: { label: "4 - 12 ชั่วโมง", shortLabel: "ตอบกลับภายใน 4 - 12 ชั่วโมง" },
  between12and24h: { label: "12 - 24 ชั่วโมง", shortLabel: "ตอบกลับภายใน 12 - 24 ชั่วโมง" },
  over24h: { label: "> 24 ชั่วโมง", shortLabel: "ตอบกลับเกิน 24 ชั่วโมง" },
};

const THAI_MONTHS = new Map<string, number>([
  ["ม.ค.", 1],
  ["ก.พ.", 2],
  ["มี.ค.", 3],
  ["เม.ย.", 4],
  ["พ.ค.", 5],
  ["มิ.ย.", 6],
  ["ก.ค.", 7],
  ["ส.ค.", 8],
  ["ก.ย.", 9],
  ["ต.ค.", 10],
  ["พ.ย.", 11],
  ["ธ.ค.", 12],
]);

function toIsoDate(year: number, month: number, day: number): string | null {
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDisplayedDate(value: string, language: Language): string | null {
  const text = value.trim().replace(/\s+/g, " ");

  if (language === "th") {
    const match = text.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{4})$/);
    if (match) {
      const month = THAI_MONTHS.get(match[2]);
      if (month) return toIsoDate(Number(match[3]), month, Number(match[1]));
    }
  }

  if (language === "zh") {
    const match = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (match) return toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
  }
  return null;
}

function readCurrentDateRange(root: HTMLElement, language: Language): DashboardDateRange {
  const dateButton = [...root.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')]
    .find((button) => button.textContent?.includes("–"));
  if (dateButton?.textContent) {
    const [fromLabel, toLabel] = dateButton.textContent.split("–").map((part) => part.trim());
    const dateFrom = fromLabel ? parseDisplayedDate(fromLabel, language) : null;
    const dateTo = toLabel ? parseDisplayedDate(toLabel, language) : null;
    if (dateFrom && dateTo) return { dateFrom, dateTo };
  }

  const selectedPeriodButton = [...root.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.className.includes("bg-[var(--dash-accent)]") && ["วันนี้", "7 วัน", "30 วัน"].includes(button.textContent?.trim() ?? ""));
  const label = selectedPeriodButton?.textContent?.trim();
  if (label === "วันนี้") return rangeForPreset("today");
  if (label === "30 วัน") return rangeForPreset("30d");
  return rangeForPreset("7d");
}

function formatResponseDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} ชม.`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} วัน`;
}

function formatDetailDateTime(value: string, language: Language): string {
  const locale = language === "th" ? "th-TH-u-ca-gregory" : language === "zh" ? "zh-CN" : "en-GB";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedBucket, setSelectedBucket] = useState<ResponseBucket | null>(null);
  const [details, setDetails] = useState<ResponseBucketDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const markBuckets = () => {
      for (const element of root.querySelectorAll<HTMLElement>("div")) {
        if (element.dataset.responseBucket) continue;
        if (element.children.length !== 2) continue;
        const headerText = element.firstElementChild?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const match = (Object.entries(BUCKET_META) as Array<[ResponseBucket, { label: string; shortLabel: string }>])
          .find(([, meta]) => headerText.startsWith(meta.label));
        if (!match) continue;
        const valueText = element.lastElementChild?.textContent?.trim() ?? "";
        if (!/^\d[\d,]*$/.test(valueText)) continue;
        element.dataset.responseBucket = match[0];
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute("aria-label", `${match[1].shortLabel} ดูข้อความในกลุ่มนี้`);
      }
    };

    markBuckets();
    const observer = new MutationObserver(markBuckets);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedBucket) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedBucket(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selectedBucket]);

  const openBucket = useCallback(async (bucket: ResponseBucket) => {
    const root = rootRef.current;
    if (!root) return;
    const range = readCurrentDateRange(root, language);
    setSelectedBucket(bucket);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);

    try {
      const params = new URLSearchParams({
        bucket,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        limit: "100",
      });
      const response = await fetch(`/api-backend/dashboard/response-bucket-details?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`โหลดข้อความไม่สำเร็จ (${response.status})`);
      setDetails((await response.json()) as ResponseBucketDetails);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "โหลดข้อความไม่สำเร็จ");
    } finally {
      setDetailsLoading(false);
    }
  }, [language]);

  const handleBucketClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-response-bucket]");
    if (!target || !rootRef.current?.contains(target)) return;
    const bucket = target.dataset.responseBucket as ResponseBucket | undefined;
    if (bucket && BUCKET_META[bucket]) void openBucket(bucket);
  }, [openBucket]);

  const handleBucketKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-response-bucket]");
    if (!target || !rootRef.current?.contains(target)) return;
    const bucket = target.dataset.responseBucket as ResponseBucket | undefined;
    if (!bucket || !BUCKET_META[bucket]) return;
    event.preventDefault();
    void openBucket(bucket);
  }, [openBucket]);

  return (
    <div
      ref={rootRef}
      className="executive-dashboard-mobile min-w-0 max-w-full"
      onClickCapture={handleBucketClick}
      onKeyDownCapture={handleBucketKeyDown}
    >
      <style>{`
        [data-response-bucket] {
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;
        }

        [data-response-bucket]:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
          filter: saturate(1.04);
        }

        [data-response-bucket]:focus-visible {
          outline: 2px solid var(--dash-accent);
          outline-offset: 2px;
        }

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

      {selectedBucket && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-3 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedBucket(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={BUCKET_META[selectedBucket].shortLabel}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-card)] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--dash-border)] px-5 py-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--dash-text-tertiary)]">รายละเอียดความเร็วตอบกลับ</div>
                <h2 className="mt-1 text-lg font-bold text-[var(--dash-text)]">{BUCKET_META[selectedBucket].shortLabel}</h2>
                {details && (
                  <div className="mt-1 text-xs text-[var(--dash-text-secondary)]">
                    {details.dateFrom} ถึง {details.dateTo} · {details.total.toLocaleString()} ข้อความ
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--dash-border)] text-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {detailsLoading && (
                <div className="flex min-h-48 items-center justify-center text-sm text-[var(--dash-text-secondary)]">กำลังโหลดข้อความ...</div>
              )}

              {!detailsLoading && detailsError && (
                <div className="rounded-xl bg-[var(--dash-red-soft)] px-4 py-3 text-sm text-[var(--dash-red)]">{detailsError}</div>
              )}

              {!detailsLoading && !detailsError && details?.items.length === 0 && (
                <div className="flex min-h-48 items-center justify-center text-sm text-[var(--dash-text-secondary)]">ไม่พบข้อความในกลุ่มนี้สำหรับช่วงวันที่ที่เลือก</div>
              )}

              {!detailsLoading && !detailsError && details && details.items.length > 0 && (
                <div className="space-y-3">
                  {details.items.map((item) => (
                    <article key={item.conversationId} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-bg)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-bold text-[var(--dash-text)]">{item.customerName}</span>
                            <span className="text-xs text-[var(--dash-text-tertiary)]">{getStoreDisplayName(item.storeName)}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[var(--dash-text-secondary)]">{item.inboundText}</p>
                        </div>
                        <div className="rounded-lg bg-[var(--dash-card)] px-3 py-2 text-right shadow-sm">
                          <div className="text-[10px] text-[var(--dash-text-tertiary)]">ใช้เวลาตอบ</div>
                          <div className="mt-0.5 text-sm font-bold text-[var(--dash-text)]">{formatResponseDuration(item.responseMinutes)}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dash-border)] pt-3 text-[11px] text-[var(--dash-text-tertiary)]">
                        <span>ลูกค้าทัก {formatDetailDateTime(item.firstInboundAt, language)} · ตอบ {formatDetailDateTime(item.firstOutboundAt, language)}</span>
                        {item.storeId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBucket(null);
                              onOpenStore(item.storeId!);
                            }}
                            className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-1.5 font-semibold text-[var(--dash-text-secondary)] hover:border-[var(--dash-accent)] hover:text-[var(--dash-accent)]"
                          >
                            เปิดแชทร้านนี้
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {details.total > details.shown && (
                    <div className="py-2 text-center text-xs text-[var(--dash-text-tertiary)]">แสดง {details.shown.toLocaleString()} จาก {details.total.toLocaleString()} ข้อความ</div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
