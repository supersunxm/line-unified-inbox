"use client";

import React from "react";
import type { StoreQuickViewData } from "@/types/api";

interface StoreQuickViewDrawerProps {
  storeData: StoreQuickViewData | null;
  getStoreDisplayName: (name: string) => string;
  onClose: () => void;
  onOpenInbox: (storeId: string) => void;
  onNotifyBm?: (storeId: string, name: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "แผงควบคุมการดำเนินงานรายสาขา (Store Quick View Operation Panel)",
    messages: "ข้อความทั้งหมด",
    answered: "ตอบกลับแล้ว",
    rate24h: "อัตราตอบกลับ 24 ชม.",
    pending: "บทสนทนาค้าง",
    topNeed: "ความต้องการหลักของลูกค้า:",
    peakWindow: "ช่วงเวลาข้อความหนาแน่น:",
    recommendation: "ข้อเสนอแนะในการปฏิบัติงาน:",
    issuesTitle: "สถิติประเภทคำถามลูกค้าวันนี้ (Top Issues Today):",
    timelineTitle: "ลำดับเวลาในการตอบกลับ (Response Timeline):",
    custMsg: "ลูกค้าทักข้อความ",
    bmNotif: "แจ้งเตือน BM",
    storeReply: "สาขาตอบกลับ",
    duration: "ระยะเวลาตอบกลับรวม",
    actionHistoryTitle: "ประวัติการดำเนินการของ BM (BM Action History):",
    openInbox: "เปิดเข้าสู่ Inbox (Open Inbox)",
    notifyBm: "ส่งการแจ้งเตือนไปยัง BM (Notify BM)",
    close: "ปิดหน้าต่าง",
    notifyAlert: "ส่งการแจ้งเตือนไปยังผู้จัดการสาขา (BM) เรียบร้อยแล้ว",
  },
  en: {
    title: "Store Quick View Operation Panel",
    messages: "Total Messages",
    answered: "Answered",
    rate24h: "24H Response Rate",
    pending: "Pending Chats",
    topNeed: "Top Customer Need:",
    peakWindow: "Peak Traffic Window:",
    recommendation: "Actionable Recommendation:",
    issuesTitle: "Top Customer Issues Today:",
    timelineTitle: "Response Timeline:",
    custMsg: "Customer Message",
    bmNotif: "BM Notification",
    storeReply: "Store Reply",
    duration: "Total Response Time",
    actionHistoryTitle: "BM Action History:",
    openInbox: "Open Inbox",
    notifyBm: "Notify BM",
    close: "Close",
    notifyAlert: "Notification dispatched to Store Branch Manager (BM).",
  },
  zh: {
    title: "门店运营快速控制面板 (Store Quick View Operation Panel)",
    messages: "消息总量",
    answered: "已回复",
    rate24h: "24小时回复率",
    pending: "待处理会话",
    topNeed: "主要客户需求:",
    peakWindow: "高峰流量时段:",
    recommendation: "运营建议:",
    issuesTitle: "今日主要问题分类:",
    timelineTitle: "回复时间线:",
    custMsg: "客户咨询",
    bmNotif: "通知 BM",
    storeReply: "门店回复",
    duration: "总响应耗时",
    actionHistoryTitle: "BM 操作历史:",
    openInbox: "打开 Inbox",
    notifyBm: "通知 BM",
    close: "关闭",
    notifyAlert: "已成功通知门店分店经理 (BM)。",
  },
};

export function StoreQuickViewDrawer({
  storeData,
  getStoreDisplayName,
  onClose,
  onOpenInbox,
  onNotifyBm,
  language,
}: StoreQuickViewDrawerProps) {
  const t = LABELS[language] ?? LABELS.en;

  if (!storeData) return null;

  const handleNotify = () => {
    if (onNotifyBm) {
      onNotifyBm(storeData.storeId, storeData.storeName);
    } else {
      alert(`${t.notifyAlert} (${getStoreDisplayName(storeData.storeName)})`);
    }
  };

  const issuesList = storeData.customerIssues || [
    { name: "Product Availability", percentage: 42 },
    { name: "Promotion Question", percentage: 28 },
    { name: "Delivery Status", percentage: 15 },
  ];

  const timeline = storeData.timeline || {
    customerMessageTime: "10:03",
    bmNotificationTime: "10:05",
    storeReplyTime: "10:45",
    responseTimeMinutes: 40,
  };

  const history = storeData.actionHistory || [
    { time: "10:05", event: "Admin notified BM via system alert" },
    { time: "10:45", event: "BM replied to customer in LINE OA" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-over Drawer Panel */}
      <div className="relative w-full max-w-lg h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                {t.title}
              </span>
              <h2 className="text-xl font-extrabold text-[var(--foreground)] mt-0.5">
                {getStoreDisplayName(storeData.storeName)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[var(--accent)] border border-[var(--border)]">
              <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block font-medium">{t.messages}</span>
              <span className="text-lg font-extrabold text-[var(--foreground)] mt-1 block">{storeData.messages}</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-bold">{t.answered}</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{storeData.answered}</span>
            </div>

            <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40">
              <span className="text-[10px] text-teal-800 dark:text-teal-300 uppercase tracking-wider block font-bold">{t.rate24h}</span>
              <span className="text-lg font-black text-teal-600 dark:text-teal-400 mt-1 block">{storeData.responseRate24h}%</span>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
              <span className="text-[10px] text-rose-800 dark:text-rose-300 uppercase tracking-wider block font-bold">{t.pending}</span>
              <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 block">{storeData.pending}</span>
            </div>
          </div>

          {/* 1. Customer Issue Breakdown */}
          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--accent)]/50 space-y-2">
            <span className="text-xs font-bold text-[var(--foreground)] block">{t.issuesTitle}</span>
            <div className="space-y-1.5">
              {issuesList.map((iss, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{iss.name}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{iss.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${iss.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Response Timeline */}
          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
            <span className="text-xs font-bold text-[var(--foreground)] block">{t.timelineTitle}</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-[var(--accent)] border border-[var(--border)]">
                <span className="text-[10px] text-[var(--muted-foreground)] block">{t.custMsg}</span>
                <span className="font-bold text-[var(--foreground)] mt-0.5 block">{timeline.customerMessageTime}</span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <span className="text-[10px] text-amber-800 dark:text-amber-300 block font-semibold">{t.bmNotif}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{timeline.bmNotificationTime}</span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block font-semibold">{t.storeReply}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{timeline.storeReplyTime}</span>
              </div>
            </div>
            <p className="text-center text-xs font-bold text-teal-600 dark:text-teal-400 pt-1">
              {t.duration}: {timeline.responseTimeMinutes} mins
            </p>
          </div>

          {/* 3. BM Action History */}
          <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2">
            <span className="text-xs font-bold text-[var(--foreground)] block">{t.actionHistoryTitle}</span>
            <div className="space-y-1.5 text-xs">
              {history.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[var(--foreground)] font-medium">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--accent)] border border-[var(--border)]">
                    {item.time}
                  </span>
                  <span>{item.event}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={() => onOpenInbox(storeData.storeId)}
            className="w-full py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            {t.openInbox}
          </button>
          <button
            type="button"
            onClick={handleNotify}
            className="w-full py-2.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
          >
            {t.notifyBm}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
