"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GoogleReviewAuditQueueStoreItem,
  GoogleReviewAuditSessionResponse,
  GoogleReviewDailyBreakdownItem,
  GoogleReviewKpiStoreItem,
  GoogleReviewKpiSummary,
  GoogleReviewWeeklyLeaderboardResponse,
  GoogleReviewWeeklyCollectorStatusResponse,
  GoogleReviewWeeklyPeriodItem,
  GoogleReviewWeeklyRankItem,
  GoogleReviewWeeklyStoreItem,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";

function formatMonthLabel(monthStr: string, language: Language): string {
  const [yearStr, monthNumStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthNumStr, 10) - 1;
  const date = new Date(year, month, 1);

  if (language === "th") {
    const thaiMonths = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return `${thaiMonths[month]} ${year + 543}`;
  }
  if (language === "zh") {
    return `${year}年${month + 1}月`;
  }
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getRecentMonths(count = 12): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function buildGoogleMapsHandoffUrl(
  originalUrl: string,
  store: GoogleReviewKpiStoreItem,
  month: string,
  runnerToken?: string,
  sessionId?: string,
  backendUrl?: string,
): string {
  const origin = backendUrl || (typeof window !== "undefined" ? window.location.origin : undefined);
  try {
    const url = new URL(originalUrl);
    url.searchParams.set("oppoStoreId", store.id);
    if (store.storeId) url.searchParams.set("oppoExtId", store.storeId);
    if (store.code) url.searchParams.set("oppoCode", store.code);
    url.searchParams.set("oppoName", store.name);
    url.searchParams.set("oppoMonth", month);
    if (runnerToken || sessionId || origin) {
      const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
      if (runnerToken) hashParams.set("oppoToken", runnerToken);
      if (sessionId) hashParams.set("oppoSessionId", sessionId);
      if (origin) hashParams.set("oppoBackendUrl", origin);
      url.hash = hashParams.toString();
    }
    return url.toString();
  } catch {
    const sep = originalUrl.includes("?") ? "&" : "?";
    let base = `${originalUrl}${sep}oppoStoreId=${encodeURIComponent(store.id)}&oppoExtId=${encodeURIComponent(store.storeId || "")}&oppoCode=${encodeURIComponent(store.code || "")}&oppoName=${encodeURIComponent(store.name)}&oppoMonth=${encodeURIComponent(month)}`;
    if (runnerToken || sessionId || origin) {
      const hashParts: string[] = [];
      if (runnerToken) hashParts.push(`oppoToken=${encodeURIComponent(runnerToken)}`);
      if (sessionId) hashParts.push(`oppoSessionId=${encodeURIComponent(sessionId)}`);
      if (origin) hashParts.push(`oppoBackendUrl=${encodeURIComponent(origin)}`);
      base += `#${hashParts.join("&")}`;
    }
    return base;
  }
}

async function persistBatchSessionWithAck(
  bridgeData: {
    sessionId: string;
    targetMonth: string;
    status: string;
    currentStore?: any;
    totalStores?: number;
    completedStores?: number;
    runnerToken?: string;
  },
  timeoutMs: number = 2000,
): Promise<{ acked: boolean; error?: string | null }> {
  // Always update localStorage first
  try {
    localStorage.setItem("oppo_active_batch_audit", JSON.stringify(bridgeData));
  } catch {}

  // Fire legacy event for backwards compatibility
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("oppo_batch_audit_action", { detail: bridgeData }));
  }

  if (typeof window === "undefined") {
    return { acked: false, error: "NO_WINDOW" };
  }

  return new Promise((resolve) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let settled = false;

    const cleanup = () => {
      window.removeEventListener("OPPO_PERSIST_BATCH_SESSION_ACK", customEventHandler);
      window.removeEventListener("message", messageHandler);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        console.warn(
          "[BatchAudit] Extension bridge persistence ACK timed out after " +
            timeoutMs +
            "ms — proceeding with URL fallback",
        );
        resolve({ acked: false, error: "TIMEOUT" });
      }
    }, timeoutMs);

    const onAckReceived = (detail: any) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        console.debug("[BatchAudit] Extension bridge persistence ACK:", {
          sessionId: detail.sessionId,
          runnerTokenPresent: detail.runnerTokenPresent,
          success: detail.success,
        });
        resolve({ acked: detail.success, error: detail.error });
      }
    };

    const customEventHandler = (e: any) => {
      if (e.detail?.requestId === requestId) {
        onAckReceived(e.detail);
      }
    };

    const messageHandler = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === "OPPO_PERSIST_BATCH_SESSION_ACK" &&
        event.data.requestId === requestId
      ) {
        onAckReceived(event.data);
      }
    };

    window.addEventListener("OPPO_PERSIST_BATCH_SESSION_ACK", customEventHandler);
    window.addEventListener("message", messageHandler);

    // 1. Post message across isolated worlds
    try {
      window.postMessage(
        {
          type: "OPPO_PERSIST_BATCH_SESSION_REQUEST",
          requestId,
          data: bridgeData,
        },
        "*",
      );
    } catch {}

    // 2. Also dispatch DOM CustomEvent
    try {
      window.dispatchEvent(
        new CustomEvent("OPPO_PERSIST_BATCH_SESSION_REQUEST", {
          detail: {
            requestId,
            data: bridgeData,
          },
        }),
      );
    } catch {}
  });
}

const translations = {
  th: {
    title: "Google Maps Review KPI Checker",
    subtitle: "ตรวจสอบและติดตาม KPI รีวิวร้านค้าบน Google Maps ประจำเดือน",
    tabMonthly: "Monthly KPI (ประจำเดือน)",
    tabWeeklyTopStore: "Weekly Top Store (อันดับประจำสัปดาห์)",
    selectMonth: "เลือกเดือน",
    selectWeek: "เลือกสัปดาห์",
    weeklyTopStoreTitle: "Weekly Top Store Leaderboard",
    weeklyTopStoreSubtitle: "ตารางจัดอันดับ 65 ร้านค้าเป้าหมาย Google Maps Review KPI ประจำสัปดาห์",
    topStoreNumberOne: "Top Store อันดับ 1",
    weeklyStoresCount: "ร้านค้าในชุด 65 ร้าน",
    storesRatingAbove48: "คะแนนร้าน > 4.8",
    totalWeeklyQualified: "รีวิวผ่านเกณฑ์ในสัปดาห์นี้",
    weeklyQualificationRule: "เกณฑ์การจัดอันดับ Weekly: คะแนนร้านค้า > 4.8 ดาว, รีวิวไม่ถูกแก้ไข (isEdited === false), มีรูปถ่ายจริงของลูกค้า, ข้อความ 15 คำขึ้นไป",
    dailyBreakdown: "สถิติรายวัน 7 วัน",
    syncStoresBtn: "ซิงค์ชุด 65 ร้านค้า",
    syncingStores: "กำลังซิงค์...",
    storeCode: "รหัสร้าน",
    storeRating: "คะแนนร้าน",
    rank: "อันดับ",
    allRatings: "ทุกคะแนน",
    ratingAbove48: "คะแนน > 4.8 เท่านั้น",
    ratingBelow48: "คะแนน ≤ 4.8",
    statusOpen: "เปิดรับข้อมูล (OPEN)",
    statusClosed: "ปิดรับข้อมูลแล้ว (CLOSED)",
    achievement: "ความสำเร็จ",
    weeklyTotal: "รวมสัปดาห์",
    currentWeek: "สัปดาห์ปัจจุบัน",
    dailyBreakdownTitle: "รายละเอียดรีวิว 7 วันประจำสัปดาห์",
    close: "ปิด",
    date: "วันที่",
    totalStores: "ร้านค้าทั้งหมด",
    storesWithMaps: "มีลิงก์ Google Maps",
    checkedStores: "ตรวจแล้ว",
    passedStores: "ผ่านเกณฑ์เป้าหมาย",
    belowTargetStores: "ยังไม่ถึงเป้า",
    totalQualified: "รีวิวผ่านเงื่อนไขรวม",
    searchPlaceholder: "ค้นหาชื่อร้าน, Store ID, รหัสร้าน...",
    allRegions: "ทุกภูมิภาค",
    allStatuses: "ทุกสถานะ",
    statusChecked: "ตรวจแล้ว (Checked)",
    statusNotChecked: "ยังไม่ตรวจ (Not Checked)",
    statusPassed: "ผ่านเกณฑ์ (Passed)",
    statusBelowTarget: "ยังไม่ถึงเป้า (Below Target)",
    statusMissingMaps: "ไม่มีลิงก์ Maps",
    storeName: "ชื่อร้านค้า",
    storeId: "Store ID",
    regionProvince: "ภาค / จังหวัด",
    googleMaps: "Google Maps",
    reviewsChecked: "ตรวจพบ",
    withPhoto: "มีรูปภาพ",
    over15Words: "ข้อความ 15 คำขึ้นไป",
    qualified: "ผ่านเงื่อนไข",
    target: "เป้าหมาย",
    lastChecked: "ตรวจล่าสุด",
    status: "สถานะ",
    action: "จัดการ",
    openMaps: "เปิด Google Maps ↗",
    noMapsLink: "ไม่มีลิงก์",
    passed: "ผ่านเกณฑ์",
    belowTarget: "ยังไม่ถึงเป้า",
    notChecked: "ยังไม่ตรวจ",
    importJson: "นำเข้า JSON ผลตรวจ",
    refresh: "รีเฟรชข้อมูล",
    manualEntryTitle: "บันทึกผลการตรวจ Google Review KPI",
    pasteJsonPrompt: "วาง JSON จาก Chrome Extension หรือกรอกข้อมูลด้วยตนเอง:",
    parseJson: "แปลงข้อมูลจาก JSON",
    submitResult: "บันทึกผลตรวจ",
    cancel: "ยกเลิก",
    saving: "กำลังบันทึก...",
    successSave: "บันทึกผลตรวจเรียบร้อยแล้ว",
    errorSave: "เกิดข้อผิดพลาดในการบันทึก",
    invalidJson: "รูปแบบ JSON ไม่ถูกต้อง",
    extensionGuide: "แนะนำ: ใช้ Chrome Extension ตรวจรีวิวบน Google Maps เพื่อสแกนและคำนวณอัตโนมัติ",
    targetExplanation: "เกณฑ์รีวิวที่ผ่านเงื่อนไข: 1. อยู่ในเดือนที่เลือก 2. มีรูปถ่ายของลูกค้า 3. ข้อความภาษาไทย 15 คำขึ้นไป",
  },
  en: {
    title: "Google Maps Review KPI Checker",
    subtitle: "Monthly store review KPI tracking and verification on Google Maps",
    tabMonthly: "Monthly KPI",
    tabWeeklyTopStore: "Weekly Top Store",
    selectMonth: "Select Month",
    selectWeek: "Select Week",
    weeklyTopStoreTitle: "Weekly Top Store Leaderboard",
    weeklyTopStoreSubtitle: "Weekly Review KPI tracking and ranking for 65 focus stores",
    topStoreNumberOne: "Top Store #1",
    weeklyStoresCount: "Weekly Focus Stores",
    storesRatingAbove48: "Rating > 4.8",
    totalWeeklyQualified: "Weekly Qualified Reviews",
    weeklyQualificationRule: "Weekly Qualification Criteria: Store Rating > 4.8, Non-edited review, genuine customer photo, 15+ Thai words.",
    dailyBreakdown: "7-Day Daily Breakdown",
    syncStoresBtn: "Sync 65 Store Set",
    syncingStores: "Syncing...",
    storeCode: "Store Code",
    storeRating: "Store Rating",
    rank: "Rank",
    allRatings: "All Ratings",
    ratingAbove48: "Rating > 4.8 Only",
    ratingBelow48: "Rating ≤ 4.8",
    statusOpen: "OPEN",
    statusClosed: "CLOSED",
    achievement: "Achievement",
    weeklyTotal: "Weekly Total",
    currentWeek: "Current Week",
    dailyBreakdownTitle: "7-Day Daily Review Breakdown",
    close: "Close",
    date: "Date",
    totalStores: "Total Stores",
    storesWithMaps: "With Maps Link",
    checkedStores: "Checked",
    passedStores: "Passed Target",
    belowTargetStores: "Below Target",
    totalQualified: "Total Qualified Reviews",
    searchPlaceholder: "Search store name, ID, code...",
    allRegions: "All Regions",
    allStatuses: "All Statuses",
    statusChecked: "Checked",
    statusNotChecked: "Not Checked",
    statusPassed: "Passed Target",
    statusBelowTarget: "Below Target",
    statusMissingMaps: "Missing Maps Link",
    storeName: "Store Name",
    storeId: "Store ID",
    regionProvince: "Region / Province",
    googleMaps: "Google Maps",
    reviewsChecked: "Checked",
    withPhoto: "With Photo",
    over15Words: "15+ Thai Words",
    qualified: "Qualified",
    target: "Target",
    lastChecked: "Last Checked",
    status: "Status",
    action: "Action",
    openMaps: "Open Maps ↗",
    noMapsLink: "No Link",
    passed: "Passed",
    belowTarget: "Below Target",
    notChecked: "Not Checked",
    importJson: "Import Scan JSON",
    refresh: "Refresh Data",
    manualEntryTitle: "Record Google Review KPI Result",
    pasteJsonPrompt: "Paste JSON from Chrome Extension or enter values manually:",
    parseJson: "Parse JSON",
    submitResult: "Save Result",
    cancel: "Cancel",
    saving: "Saving...",
    successSave: "KPI result saved successfully",
    errorSave: "Failed to save result",
    invalidJson: "Invalid JSON format",
    extensionGuide: "Tip: Use the Chrome Extension on Google Maps review page for automated local scanning",
    targetExplanation: "Qualified Review Criteria: 1. Within target month 2. Customer uploaded photo 3. Text has 15+ Thai words",
  },
  zh: {
    title: "Google Maps 评价 KPI 检查器",
    subtitle: "月度门店 Google Maps 评价 KPI 审核与追踪",
    tabMonthly: "月度 KPI",
    tabWeeklyTopStore: "周度 Top 门店榜",
    selectMonth: "选择月份",
    selectWeek: "选择周次",
    weeklyTopStoreTitle: "周度 Top 门店排行榜",
    weeklyTopStoreSubtitle: "65家重点门店 Google Maps 评价 KPI 追踪与周度排行榜",
    topStoreNumberOne: "周度第一名",
    weeklyStoresCount: "重点门店数量",
    storesRatingAbove48: "评分 > 4.8",
    totalWeeklyQualified: "本周合格评价总数",
    weeklyQualificationRule: "周度达标标准：门店评分 > 4.8星、非编辑评价（isEdited === false）、含真实顾客图片、泰语正文15词及以上。",
    dailyBreakdown: "7天每日明细",
    syncStoresBtn: "同步65家门店集",
    syncingStores: "同步中...",
    storeCode: "门店代码",
    storeRating: "门店评分",
    rank: "排名",
    allRatings: "全部评分",
    ratingAbove48: "仅评分 > 4.8",
    ratingBelow48: "评分 ≤ 4.8",
    statusOpen: "进行中 (OPEN)",
    statusClosed: "已封榜 (CLOSED)",
    achievement: "达成率",
    weeklyTotal: "周度总计",
    currentWeek: "当前周次",
    dailyBreakdownTitle: "本周7天每日评价明细",
    close: "关闭",
    date: "日期",
    totalStores: "全部门店",
    storesWithMaps: "已配置地图链接",
    checkedStores: "已审核",
    passedStores: "达到目标",
    belowTargetStores: "未达标",
    totalQualified: "合格评价总数",
    searchPlaceholder: "搜索门店名称、Store ID、代码...",
    allRegions: "全部区域",
    allStatuses: "全部状态",
    statusChecked: "已审核",
    statusNotChecked: "未审核",
    statusPassed: "达到目标",
    statusBelowTarget: "未达标",
    statusMissingMaps: "缺少地图链接",
    storeName: "门店名称",
    storeId: "Store ID",
    regionProvince: "区域 / 省份",
    googleMaps: "Google Maps",
    reviewsChecked: "已查评价",
    withPhoto: "含图片",
    over15Words: "15+泰语词",
    qualified: "合格评价",
    target: "目标",
    lastChecked: "最近检查",
    status: "状态",
    action: "操作",
    openMaps: "打开地图 ↗",
    noMapsLink: "无链接",
    passed: "达标",
    belowTarget: "未达标",
    notChecked: "未检查",
    importJson: "导入检查 JSON",
    refresh: "刷新数据",
    manualEntryTitle: "录入 Google 评价 KPI 结果",
    pasteJsonPrompt: "粘贴来自 Chrome 插件的 JSON 或手动填写：",
    parseJson: "解析 JSON",
    submitResult: "保存结果",
    cancel: "取消",
    saving: "保存中...",
    successSave: "保存成功",
    errorSave: "保存失败",
    invalidJson: "JSON 格式错误",
    extensionGuide: "提示：使用 Chrome 扩展程序在 Google Maps 页面直接扫描并计算",
    targetExplanation: "合格评价标准：1. 所选月份内 2. 包含顾客上传图片 3. 泰语正文15个词及以上",
  },
};

type ViewProps = {
  language: Language;
  userRole?: "ADMIN" | "VIEWER";
};

export function GoogleReviewKpiView({ language, userRole }: ViewProps) {
  const t = translations[language] || translations.en;
  const recentMonths = useMemo(() => getRecentMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(recentMonths[0]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<GoogleReviewKpiSummary | null>(null);
  const [search, setSearch] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  // Batch Audit State
  const [batchSession, setBatchSession] = useState<GoogleReviewAuditSessionResponse | null>(null);
  const [batchLoading, setBatchLoading] = useState<boolean>(false);
  const [auditScope, setAuditScope] = useState<"SELECTED" | "ALL_ELIGIBLE">("SELECTED");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeStore, setActiveStore] = useState<GoogleReviewKpiStoreItem | null>(null);
  const [rawJsonInput, setRawJsonInput] = useState<string>("");
  const [formStoreId, setFormStoreId] = useState<string>("");
  const [formReviewsChecked, setFormReviewsChecked] = useState<number>(0);
  const [formReviewsWithPhoto, setFormReviewsWithPhoto] = useState<number>(0);
  const [formReviewsOver15Words, setFormReviewsOver15Words] = useState<number>(0);
  const [formQualifiedReviews, setFormQualifiedReviews] = useState<number>(0);
  const [formTarget, setFormTarget] = useState<number>(10);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"monthly" | "weekly">("monthly");

  // Weekly KPI State
  const [weeklyPeriods, setWeeklyPeriods] = useState<GoogleReviewWeeklyPeriodItem[]>([]);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(2);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<GoogleReviewWeeklyLeaderboardResponse | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState<boolean>(false);
  const [weeklySearch, setWeeklySearch] = useState<string>("");
  const [weeklyRegionFilter, setWeeklyRegionFilter] = useState<string>("ALL");
  const [weeklyMinRating, setWeeklyMinRating] = useState<number | undefined>(undefined);
  const [selectedDailyStore, setSelectedDailyStore] = useState<GoogleReviewWeeklyRankItem | null>(null);
  const [syncingStores, setSyncingStores] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [collectorStatus, setCollectorStatus] = useState<GoogleReviewWeeklyCollectorStatusResponse | null>(null);

  const loadData = async (month: string, silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.getGoogleReviewKpis({ month });
      setSummary(res);
      // Auto-preselect first 3 eligible stores if none selected
      if (res?.stores && selectedStoreIds.length === 0) {
        const eligible = res.stores.filter((s) => s.hasGoogleMaps).slice(0, 3);
        if (eligible.length > 0) {
          setSelectedStoreIds(eligible.map((s) => s.id));
        }
      }
    } catch (err: unknown) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load KPI data");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleStoreSelected = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    );
  };

  const loadBatchSession = async (month: string) => {
    try {
      const res = await api.getActiveGoogleReviewBatchAudit(month);
      setBatchSession(res);
    } catch {
      // Ignore background errors
    }
  };

  const loadWeeklyData = async (weekNum?: number, silent: boolean = false) => {
    try {
      if (!silent) setWeeklyLoading(true);
      const targetWeek = weekNum ?? selectedWeekNumber;
      const periods = await api.getGoogleReviewWeeklyPeriods();
      setWeeklyPeriods(periods);

      const res = await api.getGoogleReviewWeeklyLeaderboard({
        weekNumber: targetWeek,
        search: weeklySearch,
        region: weeklyRegionFilter !== "ALL" ? weeklyRegionFilter : undefined,
        minRating: weeklyMinRating,
      });
      setWeeklyLeaderboard(res);
      setSelectedWeekNumber(res.weekNumber);

      try {
        const cStatus = await api.getGoogleReviewWeeklyCollectorStatus();
        setCollectorStatus(cStatus);
      } catch {}
    } catch (err: unknown) {
      console.error("Failed to load weekly leaderboard:", err);
    } finally {
      if (!silent) setWeeklyLoading(false);
    }
  };

  const handleSyncWeeklyStores = async () => {
    try {
      setSyncingStores(true);
      setSyncResult(null);
      const res = await api.syncGoogleReviewWeeklyStores();
      setSyncResult(
        `Synced ${res.syncedMembershipsCount}/${res.expectedStoreCount} stores (${res.matchedStoreMasterCount} matched StoreMaster, ${res.unmatchedStoreCodes.length} unmatched).`,
      );
      await loadWeeklyData(selectedWeekNumber);
    } catch (err: unknown) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingStores(false);
    }
  };

  useEffect(() => {
    if (activeTab === "weekly") {
      loadWeeklyData(selectedWeekNumber);
    }
  }, [activeTab, selectedWeekNumber, weeklyRegionFilter, weeklyMinRating]);

  const weekDays = useMemo(() => {
    if (!weeklyLeaderboard?.period?.startDate) return [];
    const start = new Date(weeklyLeaderboard.period.startDate);
    const days: { dateStr: string; label: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const dateStr = formatter.format(d);
      const parts = dateStr.split("-");
      const label = `${parts[2]}/${parts[1]}`;
      days.push({ dateStr, label });
    }
    return days;
  }, [weeklyLeaderboard?.period?.startDate]);

  const todayBangkok = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }, []);

  const weeklyStats = useMemo(() => {
    const totalStores = weeklyLeaderboard?.totalStores ?? 65;
    const totalQualified = weeklyLeaderboard?.totalQualifiedReviews ?? 0;
    const stores = weeklyLeaderboard?.stores ?? [];
    const passed = stores.filter(
      (s) => s.qualifiedReviews >= 10 && (s.storeRating === null || s.storeRating > 4.8)
    ).length;
    const belowTarget = Math.max(0, totalStores - passed);
    return { totalStores, totalQualified, passed, belowTarget };
  }, [weeklyLeaderboard]);

  useEffect(() => {
    loadData(selectedMonth);
    loadBatchSession(selectedMonth);
  }, [selectedMonth]);

  // Live poll queue progress while session is RUNNING (silent polling to prevent screen flicker)
  useEffect(() => {
    if (batchSession?.status === "RUNNING") {
      const interval = setInterval(() => {
        loadBatchSession(selectedMonth);
        loadData(selectedMonth, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [batchSession?.status, selectedMonth]);

  const handleStartBatchAudit = async () => {
    if (auditScope === "SELECTED") {
      if (selectedStoreIds.length === 0) {
        alert("กรุณาเลือกร้านค้าอย่างน้อย 1 ร้านสำหรับ Pilot Audit (Please select at least 1 store)");
        return;
      }
    } else {
      const totalEligible = summary?.storesWithGoogleMaps || 0;
      const confirmed = confirm(
        `คุณกำลังจะเริ่มตรวจร้านค้าทั้งหมด ${totalEligible} ร้านที่มี Google Maps URL\n\n(You are about to audit all ${totalEligible} stores).\n\nต้องการเริ่มการตรวจรอบใหญ่หรือไม่?`,
      );
      if (!confirmed) return;
    }

    try {
      setBatchLoading(true);
      const res = await api.startGoogleReviewBatchAudit({
        month: selectedMonth,
        scope: auditScope,
        storeIds: auditScope === "SELECTED" ? selectedStoreIds : undefined,
      });
      setBatchSession(res);

      // Issue a short-lived Bearer token for the Chrome Extension so it can
      // make authenticated API calls from the google.com/maps content script
      // context without relying on cross-site cookies.
      let runnerToken: string | undefined;
      try {
        const tokenRes = await api.issueGoogleReviewRunnerToken(res.id);
        runnerToken = tokenRes.runnerToken;
      } catch (tokenErr) {
        console.error("[BatchAudit] Failed to issue runner token:", tokenErr);
      }

      const bridgeData = {
        sessionId: res.id,
        targetMonth: res.month,
        status: "RUNNING",
        currentStore: res.currentStore,
        totalStores: res.totalStores,
        completedStores: res.completedStores,
        runnerToken,
      };

      // Deterministically persist session in extension storage with ACK before opening tab
      await persistBatchSessionWithAck(bridgeData);

      if (res.currentStore?.googleMapsUrl) {
        const handoffUrl = buildGoogleMapsHandoffUrl(
          res.currentStore.googleMapsUrl,
          {
            id: res.currentStore.storeId,
            storeId: res.currentStore.storeCode,
            code: res.currentStore.storeCode,
            name: res.currentStore.storeName,
            region: res.currentStore.region,
            province: null,
            googleMapsUrl: res.currentStore.googleMapsUrl,
            hasGoogleMaps: true,
            kpiResult: null,
          },
          res.month,
          runnerToken,
          res.id,
        );
        window.open(handoffUrl, "_blank");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start batch audit");
    } finally {
      setBatchLoading(false);
    }
  };

  const handlePauseBatchAudit = async () => {
    if (!batchSession) return;
    try {
      setBatchLoading(true);
      const res = await api.updateGoogleReviewBatchAuditStatus(batchSession.id, "PAUSE");
      setBatchSession(res);
      const bridgeData = { ...res, status: "PAUSED" };
      await persistBatchSessionWithAck(bridgeData, 1000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to pause audit");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleResumeBatchAudit = async () => {
    if (!batchSession) return;
    try {
      setBatchLoading(true);
      const res = await api.updateGoogleReviewBatchAuditStatus(batchSession.id, "RESUME");
      setBatchSession(res);

      // Issue a fresh runner token on every resume (previous token may have expired).
      let runnerToken: string | undefined;
      try {
        const tokenRes = await api.issueGoogleReviewRunnerToken(res.id);
        runnerToken = tokenRes.runnerToken;
      } catch (tokenErr) {
        console.error("[BatchAudit] Failed to issue runner token on resume:", tokenErr);
      }

      const bridgeData = {
        sessionId: res.id,
        targetMonth: res.month,
        status: "RUNNING",
        currentStore: res.currentStore,
        totalStores: res.totalStores,
        completedStores: res.completedStores,
        runnerToken,
      };

      // Deterministically persist session in extension storage with ACK before opening tab
      await persistBatchSessionWithAck(bridgeData);

      if (res.currentStore?.googleMapsUrl) {
        const handoffUrl = buildGoogleMapsHandoffUrl(
          res.currentStore.googleMapsUrl,
          {
            id: res.currentStore.storeId,
            storeId: res.currentStore.storeCode,
            code: res.currentStore.storeCode,
            name: res.currentStore.storeName,
            region: res.currentStore.region,
            province: null,
            googleMapsUrl: res.currentStore.googleMapsUrl,
            hasGoogleMaps: true,
            kpiResult: null,
          },
          res.month,
          runnerToken,
          res.id,
        );
        window.open(handoffUrl, "_blank");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to resume audit");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCancelBatchAudit = async () => {
    if (!batchSession) return;
    if (!confirm("ต้องการยกเลิกการตรวจประจำเดือนนี้หรือไม่?")) return;
    try {
      setBatchLoading(true);
      const res = await api.updateGoogleReviewBatchAuditStatus(batchSession.id, "CANCEL");
      setBatchSession(res);
      localStorage.removeItem("oppo_active_batch_audit");
      window.dispatchEvent(new CustomEvent("oppo_batch_audit_action", { detail: null }));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel audit");
    } finally {
      setBatchLoading(false);
    }
  };

  const handleSkipStore = async (storeId: string) => {
    if (!batchSession) return;
    try {
      await api.skipGoogleReviewAuditStore(batchSession.id, storeId);
      await loadBatchSession(selectedMonth);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to skip store");
    }
  };

  const handleReRunStore = async (storeId: string) => {
    if (!batchSession) return;
    try {
      await api.reRunGoogleReviewAuditStore(batchSession.id, storeId);
      await loadBatchSession(selectedMonth);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to rerun store");
    }
  };

  const uniqueRegions = useMemo(() => {
    if (!summary?.stores) return [];
    const set = new Set<string>();
    for (const s of summary.stores) {
      if (s.region) set.add(s.region);
    }
    return Array.from(set).sort();
  }, [summary]);

  const filteredStores = useMemo(() => {
    if (!summary?.stores) return [];
    return summary.stores.filter((store) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = store.name.toLowerCase().includes(q);
        const matchCode = store.code?.toLowerCase().includes(q) ?? false;
        const matchStoreId = store.storeId?.toLowerCase().includes(q) ?? false;
        const matchProvince = store.province?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchCode && !matchStoreId && !matchProvince) return false;
      }

      // Region
      if (regionFilter !== "ALL" && store.region !== regionFilter) {
        return false;
      }

      // Batch queue item lookup
      const queueStore = batchSession?.stores.find((qs) => qs.storeId === store.id);

      // Status
      if (statusFilter === "CHECKED" && !store.kpiResult) return false;
      if (statusFilter === "NOT_CHECKED" && store.kpiResult) return false;
      if (statusFilter === "PASSED" && (!store.kpiResult || !store.kpiResult.isPassed)) return false;
      if (statusFilter === "BELOW_TARGET" && (!store.kpiResult || store.kpiResult.isPassed)) return false;
      if (statusFilter === "MISSING_MAPS" && store.hasGoogleMaps) return false;
      if (statusFilter === "BATCH_COMPLETED" && queueStore?.status !== "COMPLETED") return false;
      if (statusFilter === "BATCH_RUNNING" && queueStore?.status !== "RUNNING") return false;
      if (statusFilter === "BATCH_PENDING" && queueStore?.status !== "PENDING") return false;
      if (statusFilter === "BATCH_NEEDS_ATTENTION" && queueStore?.status !== "NEEDS_ATTENTION") return false;
      if (statusFilter === "BATCH_SKIPPED" && queueStore?.status !== "SKIPPED") return false;

      return true;
    });
  }, [summary, search, regionFilter, statusFilter, batchSession]);

  const handleOpenModal = (store?: GoogleReviewKpiStoreItem) => {
    if (store) {
      setActiveStore(store);
      setFormStoreId(store.storeId || store.code || store.id);
      if (store.kpiResult) {
        setFormReviewsChecked(store.kpiResult.reviewsChecked);
        setFormReviewsWithPhoto(store.kpiResult.reviewsWithPhoto);
        setFormReviewsOver15Words(store.kpiResult.reviewsOver15ThaiWords);
        setFormQualifiedReviews(store.kpiResult.qualifiedReviews);
        setFormTarget(store.kpiResult.targetQualifiedReviews);
      } else {
        setFormReviewsChecked(0);
        setFormReviewsWithPhoto(0);
        setFormReviewsOver15Words(0);
        setFormQualifiedReviews(0);
        setFormTarget(10);
      }
    } else {
      setActiveStore(null);
      setFormStoreId("");
      setFormReviewsChecked(0);
      setFormReviewsWithPhoto(0);
      setFormReviewsOver15Words(0);
      setFormQualifiedReviews(0);
      setFormTarget(10);
    }
    setRawJsonInput("");
    setFormMessage(null);
    setModalOpen(true);
  };

  const handleParseJson = () => {
    try {
      setFormMessage(null);
      const parsed = JSON.parse(rawJsonInput);
      if (parsed.storeId) setFormStoreId(String(parsed.storeId));
      if (typeof parsed.reviewsChecked === "number") setFormReviewsChecked(parsed.reviewsChecked);
      if (typeof parsed.reviewsWithPhoto === "number") setFormReviewsWithPhoto(parsed.reviewsWithPhoto);
      if (typeof parsed.reviewsOver15ThaiWords === "number") setFormReviewsOver15Words(parsed.reviewsOver15ThaiWords);
      if (typeof parsed.qualifiedReviews === "number") setFormQualifiedReviews(parsed.qualifiedReviews);
      if (typeof parsed.targetQualifiedReviews === "number") setFormTarget(parsed.targetQualifiedReviews);
      setFormMessage({ type: "success", text: "JSON parsed successfully" });
    } catch {
      setFormMessage({ type: "error", text: t.invalidJson });
    }
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreId.trim()) {
      setFormMessage({ type: "error", text: "Store ID is required" });
      return;
    }
    try {
      setSubmitting(true);
      setFormMessage(null);
      await api.submitGoogleReviewKpiResult({
        storeId: formStoreId.trim(),
        month: selectedMonth,
        reviewsChecked: Number(formReviewsChecked),
        reviewsWithPhoto: Number(formReviewsWithPhoto),
        reviewsOver15ThaiWords: Number(formReviewsOver15Words),
        qualifiedReviews: Number(formQualifiedReviews),
        targetQualifiedReviews: Number(formTarget),
      });
      setFormMessage({ type: "success", text: t.successSave });
      await loadData(selectedMonth);
      setTimeout(() => {
        setModalOpen(false);
      }, 800);
    } catch (err: unknown) {
      setFormMessage({ type: "error", text: err instanceof Error ? err.message : t.errorSave });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--app-background)] p-4 sm:p-6 space-y-6">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("monthly")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "monthly"
              ? "bg-emerald-600 text-white shadow-sm"
              : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {t.tabMonthly}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("weekly");
            loadWeeklyData(selectedWeekNumber);
          }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "weekly"
              ? "bg-emerald-600 text-white shadow-sm"
              : "border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {t.tabWeeklyTopStore}
        </button>
      </div>

      {activeTab === "weekly" ? (
        <div className="space-y-6">
          {/* Weekly Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-5 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-bold">
                  🏆
                </span>
                <h1 className="text-xl font-bold text-[var(--app-text-primary)]">{t.weeklyTopStoreTitle}</h1>
              </div>
              <p className="text-xs text-[var(--app-text-secondary)]">{t.weeklyTopStoreSubtitle}</p>
            </div>

            {/* Week Selector & Sync Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-1.5 shadow-sm">
                <label htmlFor="kpi-week-select" className="text-xs font-semibold text-[var(--app-text-secondary)]">
                  {t.selectWeek}:
                </label>
                <select
                  id="kpi-week-select"
                  value={selectedWeekNumber}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10);
                    setSelectedWeekNumber(num);
                    loadWeeklyData(num);
                  }}
                  className="bg-transparent text-sm font-bold text-[var(--app-text-primary)] focus:outline-none cursor-pointer"
                >
                  {weeklyPeriods.map((p) => (
                    <option key={p.weekNumber} value={p.weekNumber} className="bg-[var(--app-surface)] text-[var(--app-text-primary)]">
                      {p.label} {p.status === "CLOSED" ? "🔒 (CLOSED)" : "🟢 (OPEN)"}
                    </option>
                  ))}
                </select>
              </div>

              {weeklyLeaderboard?.period && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                    weeklyLeaderboard.period.status === "OPEN"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${weeklyLeaderboard.period.status === "OPEN" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {weeklyLeaderboard.period.status === "OPEN" ? t.statusOpen : t.statusClosed}
                </span>
              )}

              <button
                type="button"
                onClick={handleSyncWeeklyStores}
                disabled={syncingStores}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <svg className={`h-4 w-4 ${syncingStores ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncingStores ? t.syncingStores : t.syncStoresBtn}
              </button>

              <button
                type="button"
                onClick={() => loadWeeklyData(selectedWeekNumber)}
                disabled={weeklyLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors disabled:opacity-50"
              >
                <svg className={`h-4 w-4 ${weeklyLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.refresh}
              </button>
            </div>
          </div>

          {/* Sync Result Banner */}
          {syncResult && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <span>{syncResult}</span>
              <button type="button" onClick={() => setSyncResult(null)} className="text-xs font-bold opacity-75 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Daily Continuous Tracking Status Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                📡
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--app-text-primary)]">
                    {language === "th" ? "ระบบตรวจจับรีวิวต่อเนื่องรายวัน (Daily Continuous Discovery)" : "Daily Continuous Review Discovery"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {language === "th" ? "กำลังทำงานต่อเนื่อง (Active)" : "Active"}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--app-text-tertiary)]">
                  {language === "th"
                    ? `ติดตาม ${collectorStatus?.fingerprintsTracked ?? "—"} รอยเท้าดิจิทัล (Zero-PII) • หยุดอัตโนมัติเมื่อพบรีวิวเดิม 5 รายการติดกัน`
                    : `Tracking ${collectorStatus?.fingerprintsTracked ?? "—"} zero-PII fingerprints • Fast-stops on 5 consecutive previously-seen reviews`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="text-right">
                <div className="text-[10px] text-[var(--app-text-tertiary)]">
                  {language === "th" ? "รีวิวค้นพบใหม่วันนี้" : "Discovered Today"}
                </div>
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  +{collectorStatus?.summaryToday?.newReviewsDiscoveredToday ?? 0}
                </div>
              </div>
              <div className="h-6 w-px bg-[var(--app-border)]" />
              <div className="text-right">
                <div className="text-[10px] text-[var(--app-text-tertiary)]">
                  {language === "th" ? "สถานะการตรวจล่าสุด" : "Last Collection"}
                </div>
                <div className="text-xs font-mono font-medium text-[var(--app-text-primary)]">
                  {collectorStatus?.lastRunAt ? new Date(collectorStatus.lastRunAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Qualification Rule Banner */}
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <span className="text-base shrink-0">⭐</span>
            <div className="space-y-0.5">
              <p className="font-semibold">{t.weeklyQualificationRule}</p>
              <p className="opacity-90">
                {language === "th"
                  ? "การบันทึกรายวันจะฟรีซอัตโนมัติเมื่อสิ้นสุดวัน (23:59 น.) และสัปดาห์จะฟรีซ ณ สิ้นสุดวันที่ 7 ของรอบสัปดาห์"
                  : language === "zh"
                  ? "每日数据于当地时间 23:59 自动封存，周度数据于该周第7天 23:59 最终封榜。"
                  : "Daily records freeze at 23:59 Asia/Bangkok and weekly totals freeze at 23:59 of the final day of the week period."}
              </p>
            </div>
          </div>

          {/* Weekly Stat Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Weekly Stores */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--app-text-secondary)]">{t.weeklyStoresCount}</span>
                <span className="text-sm font-bold text-[var(--app-text-tertiary)]">🏬</span>
              </div>
              <div className="mt-2 text-2xl font-black text-[var(--app-text-primary)] font-mono">
                {weeklyStats.totalStores}
              </div>
              <p className="text-[11px] text-[var(--app-text-tertiary)] mt-1">
                {language === "th" ? "ชุดร้านค้าเป้าหมาย 65 ร้าน" : "65 Focus Stores"}
              </p>
            </div>

            {/* 2. Passed */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t.passed}</span>
                <span className="text-sm font-bold text-emerald-500">✅</span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {weeklyStats.passed}
              </div>
              <p className="text-[11px] text-[var(--app-text-tertiary)] mt-1">
                {language === "th" ? "ผ่านเกณฑ์เป้าหมาย & คะแนน > 4.8" : "Met Target & Rating > 4.8"}
              </p>
            </div>

            {/* 3. Below Target */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t.belowTarget}</span>
                <span className="text-sm font-bold text-amber-500">⚠️</span>
              </div>
              <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {weeklyStats.belowTarget}
              </div>
              <p className="text-[11px] text-[var(--app-text-tertiary)] mt-1">
                {language === "th" ? "ยังไม่ถึงเป้าหมายหรือคะแนน ≤ 4.8" : "Below Target or Rating ≤ 4.8"}
              </p>
            </div>

            {/* 4. Total Qualified Reviews */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--app-text-secondary)]">{t.totalWeeklyQualified}</span>
                <span className="text-sm font-bold text-emerald-500">📊</span>
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {weeklyStats.totalQualified}
              </div>
              <p className="text-[11px] text-[var(--app-text-tertiary)] mt-1">
                {weeklyLeaderboard?.period ? `Week ${weeklyLeaderboard.period.weekNumber}` : "—"}
              </p>
            </div>

            {/* 5. Current Week */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--app-text-secondary)]">{t.currentWeek}</span>
                <span className="text-sm font-bold text-indigo-500">📅</span>
              </div>
              <div className="mt-2 text-sm font-bold text-[var(--app-text-primary)] truncate">
                {weeklyLeaderboard?.period?.label ?? "—"}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    weeklyLeaderboard?.period?.status === "OPEN"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${weeklyLeaderboard?.period?.status === "OPEN" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {weeklyLeaderboard?.period?.status === "OPEN" ? t.statusOpen : t.statusClosed}
                </span>
              </div>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--app-text-tertiary)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={weeklySearch}
                onChange={(e) => {
                  setWeeklySearch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadWeeklyData(selectedWeekNumber);
                }}
                placeholder={t.searchPlaceholder}
                className="h-9 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-9 pr-4 text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Region Filter */}
              <select
                value={weeklyRegionFilter}
                onChange={(e) => setWeeklyRegionFilter(e.target.value)}
                className="h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-medium text-[var(--app-text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="ALL">{t.allRegions}</option>
                {uniqueRegions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* Rating Filter */}
              <select
                value={weeklyMinRating === undefined ? "ALL" : String(weeklyMinRating)}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeeklyMinRating(val === "ALL" ? undefined : parseFloat(val));
                }}
                className="h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-medium text-[var(--app-text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="ALL">{t.allRatings}</option>
                <option value="4.81">{t.ratingAbove48}</option>
              </select>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm overflow-hidden">
            {weeklyLoading ? (
              <div className="flex items-center justify-center p-12 text-xs text-[var(--app-text-secondary)]">
                <svg className="h-6 w-6 animate-spin text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {language === "th" ? "กำลังโหลดข้อมูล..." : "Loading Weekly Leaderboard..."}
              </div>
            ) : !weeklyLeaderboard?.stores || weeklyLeaderboard.stores.length === 0 ? (
              <div className="p-12 text-center text-xs text-[var(--app-text-secondary)]">
                {language === "th" ? "ไม่พบข้อมูลร้านค้าตามเงื่อนไขที่เลือก" : "No stores found matching criteria"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] font-semibold">
                      <th className="py-3 px-3 w-12 text-center">{t.rank}</th>
                      <th className="py-3 px-4 min-w-[200px]">{t.storeName}</th>
                      <th className="py-3 px-3 text-center w-20">{t.storeRating}</th>
                      {weekDays.map((d) => (
                        <th key={d.dateStr} className="py-3 px-2 text-center font-mono w-16">
                          {d.label}
                        </th>
                      ))}
                      <th className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 w-24">
                        {t.weeklyTotal}
                      </th>
                      <th className="py-3 px-3 text-center w-16">{t.target}</th>
                      <th className="py-3 px-3 text-center w-20">{t.achievement}</th>
                      <th className="py-3 px-3 text-center w-28">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {weeklyLeaderboard.stores.map((store) => {
                      const rankBadge =
                        store.rank === 1 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold text-xs shadow-sm">
                            1
                          </span>
                        ) : store.rank === 2 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow-sm">
                            2
                          </span>
                        ) : store.rank === 3 ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-white font-bold text-xs shadow-sm">
                            3
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--app-text-secondary)]">
                            #{store.rank}
                          </span>
                        );

                      const target = 10;
                      const achievementPct = Math.round((store.qualifiedReviews / target) * 100);
                      const isPassed =
                        store.qualifiedReviews >= target &&
                        (store.storeRating === null || store.storeRating > 4.8);

                      return (
                        <tr
                          key={store.storeCode}
                          className="hover:bg-[var(--app-surface-hover)] transition-colors"
                        >
                          <td className="py-3 px-3 text-center">{rankBadge}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[var(--app-text-primary)] max-w-xs truncate">
                              {store.storeName}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-[var(--app-text-tertiary)]">
                                {store.storeCode}
                              </span>
                              {store.googleMapsUrl ? (
                                <a
                                  href={store.googleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  {t.openMaps}
                                </a>
                              ) : (
                                <span className="text-[11px] text-[var(--app-text-tertiary)] italic">
                                  {t.noMapsLink}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDailyStore(store)}
                                className="text-[10px] text-[var(--app-text-secondary)] hover:text-emerald-600 underline ml-1"
                              >
                                {t.dailyBreakdown}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {store.storeRating !== null ? (
                              <span
                                className={`inline-flex items-center gap-0.5 font-bold text-xs ${
                                  store.storeRating > 4.8
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                ⭐ {store.storeRating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[var(--app-text-tertiary)]">—</span>
                            )}
                          </td>

                          {/* 7 Day Columns */}
                          {weekDays.map((day) => {
                            const isFuture = day.dateStr > todayBangkok;
                            if (isFuture) {
                              return (
                                <td
                                  key={day.dateStr}
                                  className="py-3 px-2 text-center font-mono text-[var(--app-text-tertiary)]"
                                >
                                  -
                                </td>
                              );
                            }
                            const dRecord = store.dailyBreakdown.find((d) => d.date === day.dateStr);
                            const qCount = dRecord ? dRecord.qualifiedReviews : 0;
                            const isFrozen = dRecord ? dRecord.isFrozen : day.dateStr < todayBangkok;
                            return (
                              <td key={day.dateStr} className="py-3 px-2 text-center font-mono">
                                <span
                                  className={`inline-flex items-center gap-0.5 font-medium ${
                                    qCount > 0
                                      ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                      : "text-[var(--app-text-secondary)] opacity-70"
                                  }`}
                                >
                                  {qCount}
                                  {isFrozen && (
                                    <span className="text-[9px] text-slate-400 opacity-60" title="Closed (Frozen)">
                                      🔒
                                    </span>
                                  )}
                                </span>
                              </td>
                            );
                          })}

                          {/* Weekly Total */}
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 font-bold font-mono text-emerald-600 dark:text-emerald-400 text-xs">
                              {store.qualifiedReviews}
                            </span>
                          </td>

                          {/* Target */}
                          <td className="py-3 px-3 text-center font-mono text-xs text-[var(--app-text-secondary)]">
                            {target}
                          </td>

                          {/* Achievement */}
                          <td className="py-3 px-3 text-center font-mono text-xs font-semibold">
                            <span
                              className={
                                achievementPct >= 100
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : "text-[var(--app-text-secondary)]"
                              }
                            >
                              {achievementPct}%
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isPassed
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {isPassed ? t.passed : t.belowTarget}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-5 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <h1 className="text-xl font-bold text-[var(--app-text-primary)]">{t.title}</h1>
              </div>
              <p className="text-xs text-[var(--app-text-secondary)]">{t.subtitle}</p>
            </div>

            {/* Month Picker & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-1.5 shadow-sm">
                <label htmlFor="kpi-month-select" className="text-xs font-semibold text-[var(--app-text-secondary)]">
                  {t.selectMonth}:
                </label>
                <select
                  id="kpi-month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-sm font-bold text-[var(--app-text-primary)] focus:outline-none cursor-pointer"
                >
                  {recentMonths.map((m) => (
                    <option key={m} value={m} className="bg-[var(--app-surface)] text-[var(--app-text-primary)]">
                      {formatMonthLabel(m, language)} ({m})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t.importJson}
              </button>

              <button
                type="button"
                onClick={() => loadData(selectedMonth)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors disabled:opacity-50"
              >
                <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.refresh}
              </button>
            </div>
          </div>


      {/* Criteria Info Tip */}
      <div className="flex items-start gap-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
        <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4m0-4h.01" />
        </svg>
        <div className="space-y-0.5">
          <p className="font-semibold">{t.targetExplanation}</p>
          <p className="opacity-90">{t.extensionGuide}</p>
        </div>
      </div>

      {/* Monthly Batch Audit Control Panel */}
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-[var(--app-text-primary)]">
                Monthly Batch Audit Runner — {formatMonthLabel(selectedMonth, language)}
              </h2>
              {batchSession?.status === "RUNNING" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  RUNNING
                </span>
              )}
              {batchSession?.status === "PAUSED" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  PAUSED
                </span>
              )}
              {batchSession?.status === "COMPLETED" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  COMPLETED
                </span>
              )}
              {batchSession?.qualificationRuleVersion === "IMAGE_CAPTURE_MONTH_V1" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  📸 IMAGE_CAPTURE_MONTH_V1
                </span>
              )}
              {batchSession?.qualificationRuleVersion === "REVIEW_CREATION_DATE_V1" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-500/20">
                  REVIEW_CREATION_DATE_V1
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">
              ตรวจและบันทึกผล KPI อัตโนมัติทีละร้านผ่าน Chrome Extension โดยใช้ Image Capture Month เป็นเกณฑ์ความถูกต้อง
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {(!batchSession || batchSession.status === "IDLE" || batchSession.status === "CANCELLED" || batchSession.status === "COMPLETED") && (
              <div className="flex items-center gap-3 bg-[var(--app-surface-subtle)] px-3 py-1.5 rounded-xl border border-[var(--app-border)] text-xs">
                <span className="font-semibold text-[var(--app-text-secondary)]">Scope:</span>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-[var(--app-text-primary)]">
                  <input
                    type="radio"
                    name="auditScope"
                    value="SELECTED"
                    checked={auditScope === "SELECTED"}
                    onChange={() => setAuditScope("SELECTED")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Pilot ({selectedStoreIds.length} ร้านที่เลือก)
                  </span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer font-medium text-[var(--app-text-secondary)]">
                  <input
                    type="radio"
                    name="auditScope"
                    value="ALL_ELIGIBLE"
                    checked={auditScope === "ALL_ELIGIBLE"}
                    onChange={() => setAuditScope("ALL_ELIGIBLE")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>ทั้งหมด ({summary?.storesWithGoogleMaps || 0})</span>
                </label>
              </div>
            )}

            {(!batchSession || batchSession.status === "IDLE" || batchSession.status === "CANCELLED" || batchSession.status === "COMPLETED") && (
              <button
                type="button"
                onClick={handleStartBatchAudit}
                disabled={
                  batchLoading ||
                  (auditScope === "SELECTED" && selectedStoreIds.length === 0) ||
                  (auditScope === "ALL_ELIGIBLE" && !summary?.storesWithGoogleMaps)
                }
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {auditScope === "SELECTED"
                  ? `เริ่ม Pilot Audit (${selectedStoreIds.length} ร้าน)`
                  : `เริ่มตรวจอัตโนมัติ (${summary?.storesWithGoogleMaps || 0} ร้าน)`}
              </button>
            )}

            {batchSession?.status === "RUNNING" && (
              <>
                <button
                  type="button"
                  onClick={handlePauseBatchAudit}
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-500 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  พักชั่วคราว (Pause)
                </button>
                <button
                  type="button"
                  onClick={handleCancelBatchAudit}
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:text-rose-500 transition-colors"
                >
                  ยกเลิก (Cancel)
                </button>
              </>
            )}

            {batchSession?.status === "PAUSED" && (
              <>
                <button
                  type="button"
                  onClick={handleResumeBatchAudit}
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ทำรายการต่อ (Resume Audit)
                </button>
                <button
                  type="button"
                  onClick={handleCancelBatchAudit}
                  disabled={batchLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:text-rose-500 transition-colors"
                >
                  ยกเลิก (Cancel)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar & Current Store */}
        {batchSession && (batchSession.status === "RUNNING" || batchSession.status === "PAUSED" || batchSession.status === "COMPLETED") && (
          <div className="space-y-2 border-t border-[var(--app-border)] pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--app-text-secondary)]">
                ความคืบหน้าการตรวจ: {batchSession.completedStores} / {batchSession.totalStores} ร้าน
                {batchSession.totalStores > 0 && ` (${Math.round((batchSession.completedStores / batchSession.totalStores) * 100)}%)`}
              </span>
              <span className="text-[11px] text-[var(--app-text-tertiary)] font-mono">
                {batchSession.pendingStores} รอตรวจ · {batchSession.needsAttentionStores} ต้องการการดูแล · {batchSession.skippedStores} ข้าม
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${batchSession.totalStores > 0 ? (batchSession.completedStores / batchSession.totalStores) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Current store banner if running or paused */}
            {batchSession.currentStore && (batchSession.status === "RUNNING" || batchSession.status === "PAUSED") && (
              <div className="flex items-center justify-between rounded-xl bg-blue-500/10 border border-blue-500/20 px-3.5 py-2 text-xs text-blue-700 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                  <span>
                    กำลังดำเนินการ: <strong>{batchSession.currentStore.storeName}</strong> ({batchSession.currentStore.storeCode ?? "No Code"})
                  </span>
                </div>
                {batchSession.currentStore.googleMapsUrl && (
                  <a
                    href={buildGoogleMapsHandoffUrl(
                      batchSession.currentStore.googleMapsUrl,
                      {
                        id: batchSession.currentStore.storeId,
                        storeId: batchSession.currentStore.storeCode,
                        code: batchSession.currentStore.storeCode,
                        name: batchSession.currentStore.storeName,
                        region: batchSession.currentStore.region,
                        province: null,
                        googleMapsUrl: batchSession.currentStore.googleMapsUrl,
                        hasGoogleMaps: true,
                        kpiResult: null,
                      },
                      batchSession.month,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    เปิดหน้า Google Maps ↗
                  </a>
                )}
              </div>
            )}

            {/* Needs attention alert if any */}
            {batchSession.needsAttentionStores > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold">⚠ พบ {batchSession.needsAttentionStores} ร้านที่ต้องการการดูแล (Needs Attention)</span>
                  <span className="opacity-90">เช่น Google Maps แสดงผลผิดปกติ หรือต้องยืนยันตัวตน</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusFilter("BATCH_NEEDS_ATTENTION")}
                  className="rounded-lg bg-amber-600/20 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-600/30 transition-colors"
                >
                  กรองเฉพาะร้านที่ติดปัญหา
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.totalStores}</div>
          <div className="mt-1 text-2xl font-black text-[var(--app-text-primary)]">{summary?.totalStores ?? "—"}</div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{summary?.storesWithGoogleMaps ?? 0} {t.storesWithMaps}</div>
        </div>

        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.checkedStores}</div>
          <div className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
            {summary?.checkedStores ?? "—"}
            <span className="text-xs font-normal text-[var(--app-text-tertiary)] ml-1">/ {summary?.totalStores ?? 0}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">
            {summary?.totalStores ? Math.round(((summary.checkedStores || 0) / summary.totalStores) * 100) : 0}% ตรวจแล้ว
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-semibold">{t.passedStores}</div>
          <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{summary?.passedStores ?? "—"}</div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">≥ 10 Qualified</div>
        </div>

        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 font-semibold">{t.belowTargetStores}</div>
          <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{summary?.belowTargetStores ?? "—"}</div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">&lt; 10 Qualified</div>
        </div>

        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.totalQualified}</div>
          <div className="mt-1 text-2xl font-black text-purple-600 dark:text-purple-400">{summary?.totalQualifiedReviews ?? "—"}</div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">ในเดือน {selectedMonth}</div>
        </div>

        <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
          <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.reviewsChecked} รวม</div>
          <div className="mt-1 text-2xl font-black text-[var(--app-text-primary)]">{summary?.totalReviewsChecked ?? "—"}</div>
          <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">รีวิวทั้งหมดที่สแกน</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3 shadow-sm">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--app-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-9 pr-3 text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Region Filter */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none"
          >
            <option value="ALL">{t.allRegions}</option>
            {uniqueRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none"
          >
            <option value="ALL">{t.allStatuses}</option>
            <option value="CHECKED">{t.statusChecked}</option>
            <option value="NOT_CHECKED">{t.statusNotChecked}</option>
            <option value="PASSED">{t.statusPassed}</option>
            <option value="BELOW_TARGET">{t.statusBelowTarget}</option>
            <option value="MISSING_MAPS">{t.statusMissingMaps}</option>
            <option value="BATCH_RUNNING">🔄 Batch: กำลังตรวจ (Running)</option>
            <option value="BATCH_COMPLETED">✅ Batch: ตรวจเสร็จ (Complete)</option>
            <option value="BATCH_PENDING">⏳ Batch: รอดำเนินการ (Pending)</option>
            <option value="BATCH_NEEDS_ATTENTION">⚠ Batch: ต้องการดูแล (Needs Attention)</option>
            <option value="BATCH_SKIPPED">⏭ Batch: ข้ามแล้ว (Skipped)</option>
          </select>
        </div>
      </div>

      {/* Main Stores KPI Table */}
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center text-[var(--app-text-tertiary)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-xs">กำลังโหลดข้อมูล KPI ร้านค้า...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 text-xs">
            <p className="font-semibold">{error}</p>
            <button onClick={() => loadData(selectedMonth)} className="mt-2 underline text-xs">ลองใหม่อีกครั้ง</button>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="py-20 text-center text-[var(--app-text-tertiary)] text-xs">
            ไม่พบร้านค้าที่ตรงกับเงื่อนไขการค้นหา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--app-text-primary)] border-collapse">
              <thead>
                <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[11px] font-semibold text-[var(--app-text-secondary)]">
                  <th className="py-3 px-3 text-center">
                    <span className="sr-only">Pilot Select</span>
                    ✓
                  </th>
                  <th className="py-3 px-4">{t.storeName}</th>
                  <th className="py-3 px-3">{t.storeId}</th>
                  <th className="py-3 px-3">{t.regionProvince}</th>
                  <th className="py-3 px-3">{t.googleMaps}</th>
                  <th className="py-3 px-3 text-right">{t.reviewsChecked}</th>
                  <th className="py-3 px-3 text-right">{t.withPhoto}</th>
                  <th className="py-3 px-3 text-right text-blue-600 dark:text-blue-400" title="รีวิวที่มีรูปถ่ายตรงกับเดือนที่ตรวจ">รูปตรงเดือน</th>
                  <th className="py-3 px-3 text-right">{t.over15Words}</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{t.qualified}</th>
                  <th className="py-3 px-3 text-center">คิว Batch</th>
                  <th className="py-3 px-3 text-center">{t.status}</th>
                  <th className="py-3 px-4">{t.lastChecked}</th>
                  <th className="py-3 px-3 text-center">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {filteredStores.map((store) => {
                  const kpi = store.kpiResult;
                  const queueStore = batchSession?.stores.find((qs) => qs.storeId === store.id);
                  const isSelected = selectedStoreIds.includes(store.id);
                  return (
                    <tr key={store.id} className="hover:bg-[var(--app-surface-hover)] transition-colors">
                      {/* Checkbox for pilot selection */}
                      <td className="py-3.5 px-3 text-center">
                        {store.hasGoogleMaps ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStoreSelected(store.id)}
                            disabled={batchSession?.status === "RUNNING"}
                            className="rounded border-[var(--app-border)] text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                            title="เลือกสำหรับ Pilot Audit"
                          />
                        ) : (
                          <span className="text-[10px] text-[var(--app-text-tertiary)]">—</span>
                        )}
                      </td>

                      {/* Store Name */}
                      <td className="py-3.5 px-4 font-semibold text-[var(--app-text-primary)]">
                        <div>{store.name}</div>
                        {store.code && <div className="text-[10px] text-[var(--app-text-tertiary)] font-mono">{store.code}</div>}
                      </td>

                      {/* Store ID */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-[var(--app-text-secondary)]">
                        {store.storeId ?? "—"}
                      </td>

                      {/* Region & Province */}
                      <td className="py-3.5 px-3 text-[11px] text-[var(--app-text-secondary)]">
                        <div>{store.province ?? "—"}</div>
                        {store.region && <div className="text-[10px] text-[var(--app-text-tertiary)]">{store.region}</div>}
                      </td>

                      {/* Google Maps Link */}
                      <td className="py-3.5 px-3">
                        {store.googleMapsUrl ? (
                          <a
                            href={buildGoogleMapsHandoffUrl(store.googleMapsUrl, store, selectedMonth)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => {
                              try {
                                const data = {
                                  storeId: store.id,
                                  externalStoreId: store.storeId,
                                  code: store.code,
                                  name: store.name,
                                  month: selectedMonth,
                                  timestamp: Date.now(),
                                };
                                localStorage.setItem("oppo_active_kpi_store", JSON.stringify(data));
                                window.dispatchEvent(new CustomEvent("oppo_open_kpi_store", { detail: data }));
                              } catch {
                                // Ignore storage errors
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
                          >
                            <span>{t.openMaps}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-[var(--app-text-tertiary)]">{t.noMapsLink}</span>
                        )}
                      </td>

                      {/* Metric Counts */}
                      <td className="py-3.5 px-3 text-right font-mono text-xs">
                        {kpi ? kpi.reviewsChecked : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs">
                        {kpi ? kpi.reviewsWithPhoto : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        {kpi ? (kpi.photoReviewsInTargetMonth ?? "—") : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs">
                        {kpi ? kpi.reviewsOver15ThaiWords : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {kpi ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {kpi.qualifiedReviews}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Batch Queue Status */}
                      <td className="py-3.5 px-3 text-center">
                        {queueStore ? (
                          queueStore.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              เสร็จสมบูรณ์
                            </span>
                          ) : queueStore.status === "RUNNING" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              กำลังตรวจ...
                            </span>
                          ) : queueStore.status === "NEEDS_ATTENTION" ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                ติดปัญหา
                              </span>
                              {queueStore.errorCode && (
                                <span className="text-[9px] text-rose-500 font-mono mt-0.5">{queueStore.errorCode}</span>
                              )}
                            </div>
                          ) : queueStore.status === "SKIPPED" ? (
                            <span className="inline-flex items-center rounded-full bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-text-tertiary)]">
                              ข้ามแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[var(--app-surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-text-tertiary)]">
                              คิว #{queueStore.queueOrder}
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-[var(--app-text-tertiary)]">—</span>
                        )}
                      </td>

                      {/* Overall Status Badge */}
                      <td className="py-3.5 px-3 text-center">
                        {kpi ? (
                          kpi.isPassed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {t.passed} ({kpi.qualifiedReviews}/{kpi.targetQualifiedReviews})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              {t.belowTarget} ({kpi.qualifiedReviews}/{kpi.targetQualifiedReviews})
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-[var(--app-surface-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--app-text-tertiary)]">
                            {t.notChecked}
                          </span>
                        )}
                      </td>

                      {/* Last Checked Date & User */}
                      <td className="py-3.5 px-4 text-[11px] text-[var(--app-text-secondary)]">
                        {kpi ? (
                          <div>
                            <div>{new Date(kpi.checkedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                            {kpi.checkedBy && <div className="text-[10px] text-[var(--app-text-tertiary)]">{kpi.checkedBy.displayName}</div>}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {queueStore?.status === "NEEDS_ATTENTION" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReRunStore(store.id)}
                                className="rounded-lg bg-amber-600/10 px-2 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-600/20 transition-colors"
                              >
                                ลองใหม่
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSkipStore(store.id)}
                                className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] text-[var(--app-text-tertiary)] hover:text-rose-500 transition-colors"
                              >
                                ข้าม
                              </button>
                            </>
                          )}
                          {queueStore?.status === "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => handleReRunStore(store.id)}
                              className="rounded-lg border border-[var(--app-border)] px-2 py-1 text-[10px] text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] transition-colors"
                            >
                              ตรวจซ้ำ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenModal(store)}
                            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
                          >
                            {kpi ? "อัปเดต" : "บันทึก"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Modal: Daily Breakdown for Weekly Store */}
      {selectedDailyStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[var(--app-text-primary)]">
                    {selectedDailyStore.storeName}
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {selectedDailyStore.storeCode}
                  </span>
                </div>
                <p className="text-xs text-[var(--app-text-secondary)] mt-0.5">
                  {t.dailyBreakdown} — {weeklyLeaderboard?.period?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDailyStore(null)}
                className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Total Summary */}
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] text-center">
              <div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">{t.storeRating}</div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  ⭐ {selectedDailyStore.storeRating !== null ? selectedDailyStore.storeRating.toFixed(1) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">{t.totalWeeklyQualified}</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  {selectedDailyStore.qualifiedReviews}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[var(--app-text-secondary)]">{t.rank}</div>
                <div className="text-sm font-bold text-[var(--app-text-primary)] mt-0.5 font-mono">
                  #{selectedDailyStore.rank}
                </div>
              </div>
            </div>

            {/* Daily Table */}
            <div className="rounded-xl border border-[var(--app-border)] overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] font-semibold">
                    <th className="py-2.5 px-3">{t.date}</th>
                    <th className="py-2.5 px-3 text-center">{t.reviewsChecked}</th>
                    <th className="py-2.5 px-3 text-center">{t.withPhoto}</th>
                    <th className="py-2.5 px-3 text-center">{t.over15Words}</th>
                    <th className="py-2.5 px-3 text-center font-bold text-emerald-600">{t.qualified}</th>
                    <th className="py-2.5 px-3 text-center">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)] font-mono">
                  {selectedDailyStore.dailyBreakdown.map((d) => (
                    <tr key={d.date} className="hover:bg-[var(--app-surface-hover)]">
                      <td className="py-2.5 px-3 font-semibold text-[var(--app-text-primary)]">
                        {d.date} {d.isFrozen ? "🔒" : ""}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[var(--app-text-secondary)]">{d.reviewsChecked}</td>
                      <td className="py-2.5 px-3 text-center text-[var(--app-text-secondary)]">{d.reviewsWithPhoto}</td>
                      <td className="py-2.5 px-3 text-center text-[var(--app-text-secondary)]">{d.reviewsOver15Words}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {d.qualifiedReviews}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[10px]">
                        {d.isFrozen ? (
                          <span className="text-slate-500 font-sans">Frozen</span>
                        ) : (
                          <span className="text-emerald-600 font-sans">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDailyStore(null)}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2 text-xs font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual Entry / JSON Import */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.manualEntryTitle}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Paste JSON section */}
            <div className="space-y-2">
              <label htmlFor="kpi-json-paste" className="block text-xs font-semibold text-[var(--app-text-secondary)]">
                {t.pasteJsonPrompt}
              </label>
              <textarea
                id="kpi-json-paste"
                value={rawJsonInput}
                onChange={(e) => setRawJsonInput(e.target.value)}
                placeholder='{"storeId":"BKK001","reviewsChecked":37,"reviewsWithPhoto":20,"reviewsOver15ThaiWords":18,"qualifiedReviews":14}'
                rows={3}
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2.5 font-mono text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {rawJsonInput.trim() && (
                <button
                  type="button"
                  onClick={handleParseJson}
                  className="rounded-lg bg-[var(--app-surface-hover)] border border-[var(--app-border)] px-3 py-1 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-subtle)]"
                >
                  {t.parseJson}
                </button>
              )}
            </div>

            <form onSubmit={handleSaveResult} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label htmlFor="form-store-id-input" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1">
                    Store ID / รหัสร้านค้า *
                  </label>
                  <input
                    id="form-store-id-input"
                    type="text"
                    required
                    value={formStoreId}
                    onChange={(e) => setFormStoreId(e.target.value)}
                    placeholder="เช่น BKK001 หรือ UUID"
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  {activeStore && (
                    <div className="mt-1 text-[11px] text-emerald-600 font-medium">ร้าน: {activeStore.name}</div>
                  )}
                </div>

                <div>
                  <label htmlFor="form-reviews-checked-input" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1">
                    {t.reviewsChecked} (รวม)
                  </label>
                  <input
                    id="form-reviews-checked-input"
                    type="number"
                    min="0"
                    required
                    value={formReviewsChecked}
                    onChange={(e) => setFormReviewsChecked(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-mono text-[var(--app-text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="form-reviews-photo-input" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1">
                    {t.withPhoto} (มีรูป)
                  </label>
                  <input
                    id="form-reviews-photo-input"
                    type="number"
                    min="0"
                    required
                    value={formReviewsWithPhoto}
                    onChange={(e) => setFormReviewsWithPhoto(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-mono text-[var(--app-text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="form-reviews-words-input" className="block text-xs font-medium text-[var(--app-text-secondary)] mb-1">
                    {t.over15Words} (15+ คำไทย)
                  </label>
                  <input
                    id="form-reviews-words-input"
                    type="number"
                    min="0"
                    required
                    value={formReviewsOver15Words}
                    onChange={(e) => setFormReviewsOver15Words(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-mono text-[var(--app-text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="form-qualified-reviews-input" className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                    {t.qualified} (ผ่านเกณฑ์) *
                  </label>
                  <input
                    id="form-qualified-reviews-input"
                    type="number"
                    min="0"
                    required
                    value={formQualifiedReviews}
                    onChange={(e) => setFormQualifiedReviews(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-emerald-500/50 bg-emerald-500/5 px-3 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none"
                  />
                </div>
              </div>

              {formMessage && (
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                    formMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formMessage.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {submitting ? t.saving : t.submitResult}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
