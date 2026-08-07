"use client";

import React, { useState } from "react";
import type { OperationalActionTask, ActionStatus } from "@/types/api";
import { api } from "@/lib/api";

interface AiActionCenterPanelProps {
  initialTasks: OperationalActionTask[];
  onOpenStore: (storeId: string) => void;
  language: "th" | "en" | "zh";
}

const LABELS = {
  th: {
    title: "ศูนย์ควบคุมคำสั่งปฏิบัติการ AI (AI Action Center)",
    subtitle: "แปลงผลการวิเคราะห์เป็นภารกิจการปฏิบัติการจริง พร้อมการอนุมัติและติดตามผลกระทบเชิงธุรกิจ",
    activeCount: "ภารกิจกำลังดำเนินการ",
    tabAll: "ทั้งหมด",
    tabPending: "รอการอนุมัติ (Pending)",
    tabApproved: "อนุมัติแล้ว (Approved)",
    tabCompleted: "เสร็จสิ้น (Completed)",
    problemTitle: "ปัญหาการดำเนินงาน (Problem)",
    rootCauseTitle: "สาเหตุหลัก (Root Cause)",
    recommendationTitle: "คำแนะนำการปฏิบัติงาน AI (AI Recommendation)",
    ownerTitle: "ผู้รับผิดชอบ (Owner)",
    deadlineTitle: "กำหนดส่ง (Deadline)",
    impactTitle: "ผลกระทบที่คาดการณ์ (Expected Impact)",
    approveBtn: "⚡ อนุมัติคำสั่ง (Approve)",
    completeBtn: "✅ ทำรายการเสร็จสิ้น (Complete)",
    viewStoreBtn: "🏬 ดูข้อมูลสาขา (View Store)",
    notifyBmBtn: "📣 แจ้งเตือน BM (Notify BM)",
    notifiedToast: "ส่งการแจ้งเตือน BM เรียบร้อยแล้ว (Simulation Mode)",
  },
  en: {
    title: "AI Action Center & Operational Workflow Automation",
    subtitle: "Convert decision intelligence into executable operational tasks with owner assignment and impact tracking",
    activeCount: "Active Actions",
    tabAll: "All",
    tabPending: "Pending Approval",
    tabApproved: "Approved",
    tabCompleted: "Completed",
    problemTitle: "Problem",
    rootCauseTitle: "Root Cause",
    recommendationTitle: "AI Recommendation",
    ownerTitle: "Owner",
    deadlineTitle: "Deadline",
    impactTitle: "Expected Impact",
    approveBtn: "⚡ Approve Task",
    completeBtn: "✅ Complete Task",
    viewStoreBtn: "🏬 View Store",
    notifyBmBtn: "📣 Notify BM",
    notifiedToast: "BM notification dispatched (Simulation Mode)",
  },
  zh: {
    title: "AI 执行中心与运营工作流自动化 (AI Action Center)",
    subtitle: "将决策智能转化为可执行的运营任务，包含负责人分配与业务影响追踪",
    activeCount: "项进行中任务",
    tabAll: "全部",
    tabPending: "待批准",
    tabApproved: "已批准",
    tabCompleted: "已完成",
    problemTitle: "运营问题",
    rootCauseTitle: "根本原因",
    recommendationTitle: "AI 建议操作",
    ownerTitle: "负责人",
    deadlineTitle: "截止时间",
    impactTitle: "预期业务影响",
    approveBtn: "⚡ 批准任务",
    completeBtn: "✅ 完成任务",
    viewStoreBtn: "🏬 查看门店",
    notifyBmBtn: "📣 通知 BM",
    notifiedToast: "已发送 BM 紧急通知 (模拟模式)",
  },
};

export function AiActionCenterPanel({ initialTasks, onOpenStore, language }: AiActionCenterPanelProps) {
  const t = LABELS[language] ?? LABELS.en;

  const [tasks, setTasks] = useState<OperationalActionTask[]>(initialTasks);
  const [filterTab, setFilterTab] = useState<"ALL" | ActionStatus>("ALL");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filteredTasks = tasks.filter((task) => {
    if (filterTab === "ALL") return true;
    return task.status === filterTab;
  });

  const handleApprove = async (taskId: string) => {
    try {
      const updated = await api.approveOperationalAction(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "APPROVED" } : t))
      );
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      const updated = await api.completeOperationalAction(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "COMPLETED" } : t))
      );
    }
  };

  const handleNotifyBm = (storeName: string) => {
    setActionMessage(`${t.notifiedToast} — ${storeName}`);
    setTimeout(() => setActionMessage(null), 3000);
  };

  return (
    <section
      data-ai-action-center
      className="rounded-2xl border-2 border-amber-500/40 bg-[var(--surface)] p-6 text-[var(--foreground)] shadow-md space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-black rounded-lg bg-amber-600 text-white uppercase tracking-wider">
            WORKFLOW AUTOMATION
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] flex items-center gap-2">
              <span>⚡</span>
              <span>{t.title}</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] font-medium mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-500/30">
          🔥 {tasks.length} {t.activeCount}
        </span>
      </div>

      {/* Toast Notification */}
      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-pulse">
          ✅ {actionMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 text-xs font-bold border-b border-[var(--border)] pb-3">
        {(["ALL", "PENDING_APPROVAL", "APPROVED", "COMPLETED"] as const).map((tab) => {
          const label =
            tab === "ALL"
              ? t.tabAll
              : tab === "PENDING_APPROVAL"
              ? t.tabPending
              : tab === "APPROVED"
              ? t.tabApproved
              : t.tabCompleted;

          const count = tab === "ALL" ? tasks.length : tasks.filter((k) => k.status === tab).length;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === tab
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Tasks List Grid */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--muted-foreground)] font-semibold border border-dashed border-[var(--border)] rounded-xl">
            No action tasks match selected filter status.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCritical = task.priority === "CRITICAL";

            return (
              <div
                key={task.id}
                className={`p-5 rounded-xl border-2 transition-all space-y-4 ${
                  isCritical
                    ? "border-rose-500/40 bg-rose-500/5"
                    : "border-amber-500/30 bg-[var(--background)]"
                }`}
              >
                {/* Task Top Row: Priority & Store Name & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        isCritical
                          ? "bg-rose-600 text-white"
                          : "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {task.priority}
                    </span>
                    <h3 className="text-sm font-black text-[var(--foreground)] flex items-center gap-1.5">
                      <span>🏬</span>
                      <span>{task.storeName}</span>
                    </h3>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      task.status === "PENDING_APPROVAL"
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        : task.status === "APPROVED"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                        : "bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-300"
                    }`}
                  >
                    {task.status === "PENDING_APPROVAL"
                      ? "🟡 Pending Approval"
                      : task.status === "APPROVED"
                      ? "🟢 Approved"
                      : "✅ Completed"}
                  </span>
                </div>

                {/* Task Body Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted-foreground)]">
                      {t.problemTitle}
                    </div>
                    <div className="font-bold text-[var(--foreground)]">{task.problem}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted-foreground)]">
                      {t.rootCauseTitle}
                    </div>
                    <div className="font-semibold text-[var(--foreground)]">{task.rootCause}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-[var(--muted-foreground)]">
                      {t.impactTitle}
                    </div>
                    <div className="font-black text-emerald-700 dark:text-emerald-400">
                      {task.expectedImpact}
                    </div>
                  </div>
                </div>

                {/* AI Recommendation Box */}
                <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs space-y-1">
                  <div className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">
                    💡 {t.recommendationTitle}
                  </div>
                  <div className="font-extrabold text-[var(--foreground)]">{task.recommendedAction}</div>
                  <div className="flex flex-wrap gap-4 text-[11px] text-[var(--muted-foreground)] font-semibold pt-1">
                    <span>👤 {t.ownerTitle}: <strong>{task.owner}</strong></span>
                    <span>⏳ {t.deadlineTitle}: <strong>{task.deadline}</strong></span>
                  </div>
                </div>

                {/* Task Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {task.status === "PENDING_APPROVAL" && (
                    <button
                      type="button"
                      onClick={() => void handleApprove(task.id)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
                    >
                      {t.approveBtn}
                    </button>
                  )}

                  {task.status === "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => void handleComplete(task.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
                    >
                      {t.completeBtn}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenStore(task.storeId)}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--accent)] border border-[var(--border)] font-bold text-xs transition-all cursor-pointer"
                  >
                    {t.viewStoreBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNotifyBm(task.storeName)}
                    className="px-3.5 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30 font-bold text-xs transition-all cursor-pointer"
                  >
                    {t.notifyBmBtn}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
