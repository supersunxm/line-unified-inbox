"use client";

import type { ApiCustomerEvent } from "@/types/api";
import { formatRelativeTime } from "@/app/relative-time";

type CustomerSignalsProps = {
  events: ApiCustomerEvent[] | null;
  isLoading: boolean;
  error: string | null;
  language: "th" | "en" | "zh";
};

const sourceLabels: Record<string, Record<string, string>> = {
  LINE_PROFILE_SYNC: {
    th: "LINE Profile",
    en: "LINE Profile",
    zh: "LINE Profile",
  },
  BM_MANUAL: {
    th: "ผู้จัดการร้าน",
    en: "Store Manager",
    zh: "ร้าน经理",
  },
  AI_ANALYSIS: {
    th: "AI วิเคราะห์",
    en: "AI Analysis",
    zh: "AI 分析",
  },
};

const eventTypeTitles: Record<string, Record<string, string>> = {
  NAME_CHANGED: {
    th: "เปลี่ยนชื่อ LINE",
    en: "LINE Name Changed",
    zh: "LINE 名称已更改",
  },
  PRODUCT_INTEREST_DETECTED: {
    th: "พบความสนใจสินค้า",
    en: "Product Interest Detected",
    zh: "检测到产品兴趣",
  },
  PURCHASE_INTENT_CHANGED: {
    th: "เจตนาซื้อเปลี่ยน",
    en: "Purchase Intent Changed",
    zh: "购买意向已更改",
  },
};

const labels = {
  th: {
    title: "สัญญาณพฤติกรรมลูกค้า",
    noSignals: "ยังไม่มีสัญญาณพฤติกรรม",
    loading: "กำลังโหลดสัญญาณพฤติกรรม...",
    error: "ไม่สามารถโหลดสัญญาณพฤติกรรมได้",
    previousName: "ชื่อเดิม",
    newName: "ชื่อใหม่",
  },
  en: {
    title: "Customer Behavioral Signals",
    noSignals: "No behavioral signals recorded yet",
    loading: "Loading behavioral signals...",
    error: "Failed to load behavioral signals",
    previousName: "Previous Name",
    newName: "New Name",
  },
  zh: {
    title: "客户行为信号",
    noSignals: "尚无行为信号记录",
    loading: "正在加载行为信号...",
    error: "加载行为信号失败",
    previousName: "原名称",
    newName: "新名称",
  },
};

export function CustomerSignals({ events, isLoading, error, language }: CustomerSignalsProps) {
  const currentText = labels[language] ?? labels.th;
  const recentEvents = (events ?? []).slice(0, 5);

  return (
    <div data-customer-signals-card className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          ⚡ {currentText.title}
        </h4>
        {recentEvents.length > 0 && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-200">
            {recentEvents.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-3 text-xs text-slate-400 animate-pulse">{currentText.loading}</div>
      ) : error ? (
        <div className="mt-3 text-xs text-red-500">{currentText.error}: {error}</div>
      ) : recentEvents.length === 0 ? (
        <div className="mt-3 text-xs text-slate-400">{currentText.noSignals}</div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {recentEvents.map((event) => {
            const eventTitle = eventTypeTitles[event.type]?.[language] ?? event.type;
            const sourceLabel = sourceLabels[event.source]?.[language] ?? event.source;
            const relativeTime = formatRelativeTime(event.createdAt, language);

            return (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800/80 dark:bg-slate-900/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {event.type === "NAME_CHANGED" ? "🏷️ " : event.type === "PRODUCT_INTEREST_DETECTED" ? "📱 " : "🛒 "}
                    {eventTitle}
                  </span>
                  <span className="text-[10px] text-slate-400">{relativeTime}</span>
                </div>

                {event.type === "NAME_CHANGED" ? (
                  <div className="mt-2 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[11px] text-slate-400 font-normal truncate">
                      {event.previousValue || "LINE Customer"}
                    </div>
                    <div className="my-1 flex items-center justify-center text-slate-400 font-bold">
                      ↓
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {event.newValue || currentText.newName}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-slate-600 dark:text-slate-300">
                    {event.newValue || event.previousValue || "-"}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="rounded-full bg-slate-200/60 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {sourceLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
