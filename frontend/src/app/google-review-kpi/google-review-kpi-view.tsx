"use client";
import { DownloadAction, authorizeDataDownload } from "@/lib/download-permission";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  GoogleReviewImportHistoryItem,
  GoogleReviewImportPreviewResponse,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { googleReviewKpiPhrases, googleReviewKpiText } from "./google-review-kpi-i18n";
import { formatGoogleReviewWeeklyPeriodLabel } from "./weekly-period-label";

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
  sessionId?: string,
  batchItemId?: string,
): string {
  const canonicalStoreCode = store.storeId || store.code;
  try {
    const original = new URL(originalUrl);
    const isGoogleMapsShortLink = /(^|\.)maps\.app\.goo\.gl$/i.test(original.hostname);
    const url = isGoogleMapsShortLink && store.googleMapsName
      ? new URL("https://www.google.com/maps/search/")
      : original;
    if (isGoogleMapsShortLink && store.googleMapsName) {
      url.searchParams.set("api", "1");
      url.searchParams.set("query", store.googleMapsName);
    }
    url.searchParams.set("oppoStoreId", store.id);
    if (batchItemId) url.searchParams.set("oppoBatchItemId", batchItemId);
    if (store.storeId) url.searchParams.set("oppoExtId", store.storeId);
    if (canonicalStoreCode) url.searchParams.set("oppoCode", canonicalStoreCode);
    url.searchParams.set("oppoName", store.name);
    if (store.googleMapsUrl) url.searchParams.set("oppoGoogleMapsUrl", store.googleMapsUrl);
    if (store.googleMapsName) url.searchParams.set("oppoGoogleMapsName", store.googleMapsName);
    url.searchParams.set("oppoMonth", month);
    if (sessionId) {
      const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
      hashParams.set("oppoSessionId", sessionId);
      url.hash = hashParams.toString();
    }
    return url.toString();
  } catch {
    const sep = originalUrl.includes("?") ? "&" : "?";
    let base = `${originalUrl}${sep}oppoStoreId=${encodeURIComponent(store.id)}${batchItemId ? `&oppoBatchItemId=${encodeURIComponent(batchItemId)}` : ""}&oppoExtId=${encodeURIComponent(store.storeId || "")}&oppoCode=${encodeURIComponent(canonicalStoreCode || "")}&oppoName=${encodeURIComponent(store.name)}&oppoGoogleMapsUrl=${encodeURIComponent(store.googleMapsUrl || originalUrl)}&oppoGoogleMapsName=${encodeURIComponent(store.googleMapsName || "")}&oppoMonth=${encodeURIComponent(month)}`;
    if (sessionId) {
      base += `#oppoSessionId=${encodeURIComponent(sessionId)}`;
    }
    return base;
  }
}

// Translations
const translations = {
  th: {
    title: "KPI รีวิว Google Maps",
    subtitle: "นำเข้า ตรวจสอบ และดาวน์โหลด KPI รีวิวร้านค้าบน Google Maps รายเดือน จากผลการตรวจของ AI",
    tabMonthly: "KPI รายเดือน",
    tabWeeklyTopStore: "ร้านยอดนิยมรายสัปดาห์",
    selectMonth: "เดือนข้อมูล",
    selectWeek: "เลือกสัปดาห์",
    weeklyTopStoreTitle: "ตารางอันดับรายสัปดาห์ — Top Store Google Review",
    weeklyTopStoreSubtitle: "ติดตามและจัดอันดับ KPI รีวิว Google Maps สำหรับ 65 ร้านค้าโฟกัส",
    topStoreNumberOne: "อันดับ 1 ประจำสัปดาห์",
    weeklyStoresCount: "ร้านค้าโฟกัสทั้งหมด",
    storesRatingAbove48: "คะแนนร้าน > 4.8 ดาว",
    totalWeeklyQualified: "Qualified Reviews ประจำสัปดาห์",
    weeklyQualificationRule: "เกณฑ์ Qualified รายสัปดาห์: เรตติ้งร้าน > 4.8, ไม่ใช่รีวิวที่แก้ไข (isEdited === false), รูปภาพลูกค้าแท้จริง, ข้อความภาษาไทย 15 คำขึ้นไป",
    dailyBreakdown: "ประวัติรายวัน 7 วัน",
    syncStoresBtn: "ซิงค์ชุดร้านค้า 65 สาขา",
    syncingStores: "กำลังซิงค์...",
    downloadBtn: "ดาวน์โหลดข้อมูล",
    downloadExcel: "ดาวน์โหลด Excel (.xlsx)",
    downloadCsv: "ดาวน์โหลด CSV (.csv)",
    downloading: "กำลังดาวน์โหลด...",
    downloadError: "ดาวน์โหลดไฟล์ล้มเหลว",
    storeCode: "รหัสสาขา",
    storeRating: "คะแนนร้าน",
    rank: "อันดับ",
    allRatings: "คะแนนทั้งหมด",
    ratingAbove48: "คะแนน > 4.8 เท่านั้น",
    ratingBelow48: "คะแนน ≤ 4.8",
    statusOpen: "กำลังดำเนินการ (OPEN)",
    statusClosed: "ปิดรอบแล้ว (CLOSED)",
    achievement: "อัตราความสำเร็จ",
    weeklyTotal: "รวมประจำสัปดาห์",
    currentWeek: "สัปดาห์ปัจจุบัน",
    dailyBreakdownTitle: "รายละเอียดรีวิวรายวันในสัปดาห์นี้",
    close: "ปิด",
    date: "วันที่",
    totalStores: "ร้านทั้งหมด",
    storesWithMaps: "ร้านที่มี Google Maps",
    checkedStores: "ตรวจแล้ว",
    passedStores: "ผ่านเกณฑ์เป้าหมาย",
    belowTargetStores: "ยังไม่ถึงเป้า",
    totalQualified: "Qualified Reviews รวม",
    searchPlaceholder: "ค้นหาชื่อร้าน, Store ID, รหัสสาขา, จังหวัด...",
    allRegions: "ทุกภูมิภาค",
    allStatuses: "ทุกสถานะ",
    statusChecked: "ตรวจแล้ว",
    statusNotChecked: "ยังไม่มีข้อมูล",
    statusPassed: "ผ่านเกณฑ์เป้าหมาย",
    statusBelowTarget: "ยังไม่ถึงเป้า",
    statusMissingMaps: "ไม่มีลิงก์ Google Maps",
    storeName: "ชื่อร้านค้า",
    storeId: "รหัสสาขา",
    regionProvince: "ภูมิภาค / จังหวัด",
    googleMaps: "Google Maps",
    reviewsChecked: "ตรวจพบ",
    withPhoto: "มีรูป",
    over15Words: "ไทย ≥15 คำ",
    qualified: "ผ่านเกณฑ์",
    target: "เป้าหมาย",
    lastChecked: "อัปเดตล่าสุด",
    status: "สถานะ",
    action: "จัดการ",
    openMaps: "เปิด Google Maps ↗",
    noMapsLink: "ไม่มีลิงก์",
    passed: "ผ่านเป้า",
    belowTarget: "ยังไม่ถึงเป้า",
    notChecked: "ยังไม่ตรวจ",
    importJson: "นำเข้าผลลัพธ์",
    pasteJsonBtn: "วาง JSON",
    refresh: "รีเฟรช",
    manualEntryTitle: "นำเข้าหรือบันทึกผลการตรวจ Google Review KPI",
    pasteJsonPrompt: "วาง JSON ผลการตรวจจาก AI Audit หรือกรอกข้อมูลด้วยตนเอง:",
    parseJson: "ตรวจสอบและแสดงตัวอย่าง",
    submitResult: "บันทึกผลตรวจ",
    cancel: "ยกเลิก",
    saving: "กำลังบันทึก...",
    successSave: "บันทึกผลตรวจเรียบร้อยแล้ว",
    errorSave: "เกิดข้อผิดพลาดในการบันทึก",
    invalidJson: "รูปแบบ JSON ไม่ถูกต้อง",
    extensionGuide: "เมื่อนำเข้าข้อมูลแล้ว ระบบจะแสดงผลสรุป KPI รายเดือน และจัดเก็บข้อมูลล่าสุดของแต่ละร้าน",
    targetExplanation: "เกณฑ์ Qualified: รูปภาพลูกค้า + รูปอยู่ในเดือนเป้าหมาย + ข้อความภาษาไทย ≥ 15 คำ",
  },
  en: {
    title: "Google Maps Review KPI",
    subtitle: "Import, verify, and download monthly Google Maps review KPIs evaluated by AI Audit",
    tabMonthly: "Monthly KPI",
    tabWeeklyTopStore: "Weekly Top Store",
    selectMonth: "Data Month",
    selectWeek: "Select Week",
    weeklyTopStoreTitle: "Weekly Top Store Leaderboard",
    weeklyTopStoreSubtitle: "Weekly Review KPI tracking and ranking for 65 focus stores",
    topStoreNumberOne: "Top Store #1",
    weeklyStoresCount: "Weekly Focus Stores",
    storesRatingAbove48: "Rating > 4.8",
    totalWeeklyQualified: "Weekly Qualified Reviews",
    weeklyQualificationRule: "Weekly Criteria: Store Rating > 4.8, Non-edited review, genuine customer photo, 15+ Thai words.",
    dailyBreakdown: "7-Day Daily Breakdown",
    syncStoresBtn: "Sync 65 Store Set",
    syncingStores: "Syncing...",
    downloadBtn: "Download Data",
    downloadExcel: "Download Excel (.xlsx)",
    downloadCsv: "Download CSV (.csv)",
    downloading: "Downloading...",
    downloadError: "Failed to download file",
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
    checkedStores: "With KPI Data",
    passedStores: "Passed Target",
    belowTargetStores: "Below Target",
    totalQualified: "Total Qualified Reviews",
    searchPlaceholder: "Search store name, ID, code, province...",
    allRegions: "All Regions",
    allStatuses: "All Statuses",
    statusChecked: "Checked",
    statusNotChecked: "No Data",
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
    lastChecked: "Last Updated",
    status: "Status",
    action: "Action",
    openMaps: "Open Maps ↗",
    noMapsLink: "No Link",
    passed: "Passed",
    belowTarget: "Below Target",
    notChecked: "Not Checked",
    importJson: "Import Results",
    pasteJsonBtn: "Paste JSON",
    refresh: "Refresh",
    manualEntryTitle: "Import or Record Google Review KPI Result",
    pasteJsonPrompt: "Paste AI Audit JSON or enter review metrics:",
    parseJson: "Validate & Preview",
    submitResult: "Save Result",
    cancel: "Cancel",
    saving: "Saving...",
    successSave: "KPI result saved successfully",
    errorSave: "Failed to save result",
    invalidJson: "Invalid JSON format",
    extensionGuide: "Once imported, the system displays monthly KPI totals and maintains the latest audit state.",
    targetExplanation: "Qualified Criteria: Customer photo + photo taken in target month + Thai text >= 15 words",
  },
  zh: {
    title: "Google Maps 评价 KPI 检查器",
    subtitle: "导入、审核并下载基于 AI Audit 结果的月度 Google Maps 门店评价 KPI",
    tabMonthly: "月度 KPI",
    tabWeeklyTopStore: "周度 Top 门店榜",
    selectMonth: "数据月份",
    selectWeek: "选择周次",
    weeklyTopStoreTitle: "周度 Top 门店排行榜",
    weeklyTopStoreSubtitle: "65家重点门店 Google Maps 评价 KPI 追踪与周度排行榜",
    topStoreNumberOne: "周度第一名",
    weeklyStoresCount: "重点门店数量",
    storesRatingAbove48: "评分 > 4.8",
    totalWeeklyQualified: "本周合格评价总数",
    weeklyQualificationRule: "周度达标标准：门店评分 > 4.8星、非编辑评价、含真实顾客图片、泰语正文15词及以上。",
    dailyBreakdown: "7天每日明细",
    syncStoresBtn: "同步65家门店集",
    syncingStores: "同步中...",
    downloadBtn: "下载数据",
    downloadExcel: "下载 Excel (.xlsx)",
    downloadCsv: "下载 CSV (.csv)",
    downloading: "下载中...",
    downloadError: "文件下载失败",
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
    checkedStores: "已有数据",
    passedStores: "达到目标",
    belowTargetStores: "未达标",
    totalQualified: "合格评价总数",
    searchPlaceholder: "搜索门店名称、Store ID、代码、省份...",
    allRegions: "全部区域",
    allStatuses: "全部状态",
    statusChecked: "已审核",
    statusNotChecked: "无数据",
    statusPassed: "达到目标",
    statusBelowTarget: "未达标",
    statusMissingMaps: "缺少地图链接",
    storeName: "门店名称",
    storeId: "门店 ID",
    regionProvince: "区域 / 省份",
    googleMaps: "Google Maps",
    reviewsChecked: "已查评价",
    withPhoto: "含图片",
    over15Words: "15+泰语词",
    qualified: "合格评价",
    target: "目标",
    lastChecked: "最近更新",
    status: "状态",
    action: "操作",
    openMaps: "打开地图 ↗",
    noMapsLink: "无链接",
    passed: "达标",
    belowTarget: "未达标",
    notChecked: "未检查",
    importJson: "导入结果",
    pasteJsonBtn: "粘贴 JSON",
    refresh: "刷新",
    manualEntryTitle: "导入或录入 Google 评价 KPI 结果",
    pasteJsonPrompt: "粘贴来自 AI Audit 的 JSON 或手动录入指标：",
    parseJson: "验证并预览",
    submitResult: "保存结果",
    cancel: "取消",
    saving: "保存中...",
    successSave: "保存成功",
    errorSave: "保存失败",
    invalidJson: "JSON 格式错误",
    extensionGuide: "数据导入后，系统将自动汇总月度 KPI 并持久化每家门店的最新审核记录。",
    targetExplanation: "合格评价标准：顾客真实图片 + 拍照时间在目标月份 + 泰语正文15词及以上",
  },
};

type ViewProps = {
  language: Language;
  userRole?: "ADMIN" | "ASSISTANT" | "VIEWER";
};

type FormMessage = {
  type: "success" | "error";
  text: string;
};

export function GoogleReviewKpiView({ language, userRole }: ViewProps) {
  const t = translations[language] || translations.th;
  const recentMonths = useMemo(() => getRecentMonths(12), []);
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-09");
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<GoogleReviewKpiSummary | null>(null);
  const [search, setSearch] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [importTypeFilter, setImportTypeFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"monthly" | "weekly">("monthly");

  // Modals & Drawer State
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importModalStep, setImportModalStep] = useState<1 | 2>(1);
  const [importTypeChoice, setImportTypeChoice] = useState<"GAP_FILL" | "FULL_MONTH" | "MANUAL">("GAP_FILL");
  const [importSourceChoice, setImportSourceChoice] = useState<string>("AI Audit / Antigravity");
  const [importRawJson, setImportRawJson] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState<boolean>(false);
  const [importPreviewData, setImportPreviewData] = useState<GoogleReviewImportPreviewResponse | null>(null);
  const [importConfirming, setImportConfirming] = useState<boolean>(false);
  const [importSuccessAlert, setImportSuccessAlert] = useState<string | null>(null);

  const [pasteJsonModalOpen, setPasteJsonModalOpen] = useState<boolean>(false);
  const [criteriaModalOpen, setCriteriaModalOpen] = useState<boolean>(false);
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<boolean>(false);
  const [selectedStoreForDrawer, setSelectedStoreForDrawer] = useState<GoogleReviewKpiStoreItem | null>(null);

  // Manual fallback modal state (retained for backward compatibility)
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [activeStore, setActiveStore] = useState<GoogleReviewKpiStoreItem | null>(null);
  const [rawJsonInput, setRawJsonInput] = useState<string>("");
  const [formStoreId, setFormStoreId] = useState<string>("");
  const [formReviewsChecked, setFormReviewsChecked] = useState<number>(0);
  const [formReviewsWithPhoto, setFormReviewsWithPhoto] = useState<number>(0);
  const [formReviewsOver15Words, setFormReviewsOver15Words] = useState<number>(0);
  const [formQualifiedReviews, setFormQualifiedReviews] = useState<number>(0);
  const [formTarget, setFormTarget] = useState<number>(10);
  const [formMessage, setFormMessage] = useState<FormMessage | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
  const [downloadMenuOpen, setDownloadMenuOpen] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "csv" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Background audit listener refs (preserves contract required by tests & bridge)
  const handledAuditRequests = useRef(new Set<string>());

  const loadData = async (month: string, silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const res = await api.getGoogleReviewKpis({ month });
      setSummary(res);
    } catch (err: unknown) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load KPI data");
      }
    } finally {
      if (!silent) setLoading(false);
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

  const handleDownloadWeeklyExport = async (format: "xlsx" | "csv") => {
    if (!(await authorizeDataDownload())) return;
    try {
      setExportingFormat(format);
      setExportError(null);
      setDownloadMenuOpen(false);
      const { blob, filename } = await api.downloadGoogleReviewWeeklyExport({
        weekNumber: selectedWeekNumber,
        format,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error("Download failed:", err);
      setExportError(err instanceof Error ? err.message : t.downloadError);
    } finally {
      setExportingFormat(null);
    }
  };

  const weeklyStats = useMemo(() => {
    const totalStores = weeklyLeaderboard?.totalStores ?? 65;
    const totalQualified = weeklyLeaderboard?.totalQualifiedReviews ?? 0;
    const stores = weeklyLeaderboard?.stores ?? [];
    const passed = stores.filter(
      (s) => s.qualifiedReviews >= 10 && (s.storeRating === null || s.storeRating > 4.8),
    ).length;
    const belowTarget = Math.max(0, totalStores - passed);
    return { totalStores, totalQualified, passed, belowTarget };
  }, [weeklyLeaderboard]);

  // Bridge event listeners preserved for contract compatibility
  useEffect(() => {
    const handleAuditResultReady = async (event: Event) => {
      const payload = (event as CustomEvent<any>).detail;
      if (!payload || handledAuditRequests.current.has(payload.requestId)) return;
      handledAuditRequests.current.add(payload.requestId);
      try {
        await api.completeGoogleReviewBatchStore(payload.sessionId, payload.storeId, {
          storeId: payload.storeId,
          storeCode: payload.storeCode,
          targetMonth: payload.targetMonth,
          batchItemId: payload.batchItemId || "",
          reviewsChecked: payload.aggregate?.reviewsChecked ?? 0,
          reviewsWithPhoto: payload.aggregate?.withCustomerPhoto ?? 0,
          photoReviewsInTargetMonth: payload.aggregate?.photoInTargetMonth ?? 0,
          reviewsOver15ThaiWords: payload.aggregate?.thaiWords15Plus ?? 0,
          qualifiedReviews: payload.aggregate?.qualifiedReviews ?? 0,
          qualificationRuleVersion: payload.qualificationRuleVersion,
          auditCoverageStatus: payload.coverageStatus,
          completionReason: payload.completionReason,
        });
        await loadData(selectedMonth, true);
      } catch (err) {
        console.error("Bridge result handling failed:", err);
      }
    };

    window.addEventListener("OPPO_AUDIT_RESULT_READY", handleAuditResultReady);
    return () => {
      window.removeEventListener("OPPO_AUDIT_RESULT_READY", handleAuditResultReady);
    };
  }, [selectedMonth]);

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (activeTab === "weekly") {
      loadWeeklyData(selectedWeekNumber);
    }
  }, [activeTab, selectedWeekNumber, weeklyRegionFilter, weeklyMinRating]);

  // Derived unique regions
  const uniqueRegions = useMemo(() => {
    if (!summary?.stores) return [];
    const set = new Set<string>();
    for (const s of summary.stores) {
      if (s.region) set.add(s.region);
    }
    return Array.from(set).sort();
  }, [summary]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!summary?.stores) return [];
    return summary.stores.filter((store) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = store.name.toLowerCase().includes(q);
        const matchCode = store.code?.toLowerCase().includes(q) ?? false;
        const matchStoreId = store.storeId?.toLowerCase().includes(q) ?? false;
        const matchProvince = store.province?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchCode && !matchStoreId && !matchProvince) return false;
      }

      // Region filter
      if (regionFilter !== "ALL" && store.region !== regionFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "PASSED" && (!store.kpiResult || !store.kpiResult.isPassed)) return false;
      if (statusFilter === "BELOW_TARGET" && (!store.kpiResult || store.kpiResult.isPassed)) return false;
      if (statusFilter === "NEEDS_ATTENTION" && !store.needsAttention) return false;
      if (statusFilter === "NO_DATA" && store.kpiResult) return false;
      if (statusFilter === "GAP_FILL" && store.latestImportType !== "GAP_FILL") return false;

      // Import type filter
      if (importTypeFilter !== "ALL") {
        if (importTypeFilter === "GAP_FILL" && store.latestImportType !== "GAP_FILL") return false;
        if (importTypeFilter === "FULL_MONTH" && store.latestImportType !== "FULL_MONTH") return false;
        if (importTypeFilter === "MANUAL" && store.latestImportType !== "MANUAL") return false;
      }

      return true;
    }).sort((a, b) => {
      if (!sortField) return 0;
      let valA: any = null;
      let valB: any = null;

      if (sortField === "googleRating") {
        valA = a.googleRating ?? a.kpiResult?.googleRating ?? -1;
        valB = b.googleRating ?? b.kpiResult?.googleRating ?? -1;
      } else if (sortField === "qualifiedReviews") {
        valA = a.kpiResult?.qualifiedReviews ?? -1;
        valB = b.kpiResult?.qualifiedReviews ?? -1;
      } else if (sortField === "reviewsChecked") {
        valA = a.kpiResult?.reviewsChecked ?? -1;
        valB = b.kpiResult?.reviewsChecked ?? -1;
      }

      if (valA === valB) return 0;
      if (sortDirection === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [summary, search, regionFilter, statusFilter, importTypeFilter, sortField, sortDirection]);

  const handleToggleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortField(null);
        setSortDirection("desc");
      }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Export & Download handlers
  const handleDownloadCsv = async (filteredOnly: boolean = false) => {
    if (!(await authorizeDataDownload())) return;
    const listToExport = filteredOnly ? filteredStores : (summary?.stores || []);
    if (listToExport.length === 0) return;

    const headers = [
      "Store ID",
      "Store Name",
      "Province",
      "Region",
      "Google Maps URL",
      "Google Rating",
      "Google Review Count",
      "Reviews Checked",
      "With Photo",
      "Photo in Target Month",
      "Thai >= 15 Words",
      "Qualified Reviews",
      "Target",
      "Status",
      "Import Type",
      "Google Rating Checked At",
      "Last Updated",
    ];

    const rows = listToExport.map((s) => [
      `"${s.storeId || s.code || ""}"`,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.province || ""}"`,
      `"${s.region || ""}"`,
      `"${s.googleMapsUrl || ""}"`,
      s.googleRating ?? s.kpiResult?.googleRating ?? "—",
      s.googleReviewCount ?? s.kpiResult?.googleReviewCount ?? "—",
      s.kpiResult?.reviewsChecked ?? 0,
      s.kpiResult?.reviewsWithPhoto ?? 0,
      s.kpiResult?.photoReviewsInTargetMonth ?? 0,
      s.kpiResult?.reviewsOver15ThaiWords ?? 0,
      s.kpiResult?.qualifiedReviews ?? 0,
      s.kpiResult?.targetQualifiedReviews ?? 10,
      s.needsAttention ? "Needs Attention" : s.kpiResult?.isPassed ? "Passed" : s.kpiResult ? "Below Target" : "Not Checked",
      s.latestImportType || "—",
      s.googleRatingCheckedAt || s.kpiResult?.googleRatingCheckedAt ? new Date((s.googleRatingCheckedAt || s.kpiResult?.googleRatingCheckedAt)!).toLocaleString("th-TH") : "—",
      s.kpiResult?.checkedAt ? new Date(s.kpiResult.checkedAt).toLocaleString("th-TH") : "—",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oppo-google-review-kpi-${selectedMonth}${filteredOnly ? "-filtered" : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadDropdownOpen(false);
  };

  const handleDownloadJson = async () => {
    if (!(await authorizeDataDownload())) return;
    if (!summary) return;
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oppo-google-review-kpi-${selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadDropdownOpen(false);
  };

  const handleDownloadImportHistoryJson = async () => {
    if (!(await authorizeDataDownload())) return;
    const history = summary?.importHistory || [];
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oppo-google-review-import-history-${selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadDropdownOpen(false);
  };

  const handleDownloadNeedsAttentionCsv = async () => {
    if (!(await authorizeDataDownload())) return;
    const attentionStores = (summary?.stores || []).filter((s) => s.needsAttention);
    const headers = ["Store ID", "Store Name", "Province", "Region", "Reason", "Google Maps URL"];
    const rows = attentionStores.map((s) => [
      `"${s.storeId || s.code || ""}"`,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.province || ""}"`,
      `"${s.region || ""}"`,
      `"${(s.needsAttentionReason || "").replace(/"/g, '""')}"`,
      `"${s.googleMapsUrl || ""}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `oppo-google-review-needs-attention-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadDropdownOpen(false);
  };

  const handleDownloadSingleStoreJson = async (store: GoogleReviewKpiStoreItem) => {
    if (!(await authorizeDataDownload())) return;
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `store-${store.storeId || store.code || store.id}-${selectedMonth}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import preview handling
  const handleInspectImportData = async (rawJsonText: string) => {
    try {
      setImportPreviewLoading(true);
      const parsed = JSON.parse(rawJsonText);
      const preview = await api.previewGoogleReviewImport({
        month: selectedMonth,
        importType: importTypeChoice,
        source: importSourceChoice,
        data: parsed,
      });
      setImportPreviewData(preview);
      setImportModalStep(2);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "JSON parsing or validation failed");
    } finally {
      setImportPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreviewData) return;
    try {
      setImportConfirming(true);
      await api.confirmGoogleReviewImport({
        month: selectedMonth,
        importType: importPreviewData.importType as any,
        source: importPreviewData.source,
        data: importRawJson ? JSON.parse(importRawJson) : {},
      });
      setImportSuccessAlert(`นำเข้าข้อมูล ${importPreviewData.storesAffected} ร้านค้าสำเร็จ (+${importPreviewData.qualifiedDelta} Qualified Reviews)`);
      setImportModalOpen(false);
      setPasteJsonModalOpen(false);
      await loadData(selectedMonth);
      setTimeout(() => setImportSuccessAlert(null), 6000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Confirm import failed");
    } finally {
      setImportConfirming(false);
    }
  };

  const handleOpenManualModal = (store?: GoogleReviewKpiStoreItem) => {
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

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStoreId.trim()) return;
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
      setTimeout(() => setModalOpen(false), 800);
    } catch (err: unknown) {
      setFormMessage({ type: "error", text: err instanceof Error ? err.message : t.errorSave });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStoreSelected = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    );
  };

  return (
    <LegacyI18nBoundary phrases={googleReviewKpiPhrases} showControl={false}>
    <div
      aria-label="Google Maps Review KPI Checker"
      data-testid="Google Maps Review KPI Checker"
      className="flex flex-col h-full overflow-y-auto bg-[var(--app-background)] p-4 sm:p-6 space-y-6"
    >
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

      {/* Success Notification Alert */}
      {importSuccessAlert && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <span>✔</span>
            <span>{importSuccessAlert}</span>
          </div>
          <button type="button" onClick={() => setImportSuccessAlert(null)} className="text-emerald-700 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {activeTab === "weekly" ? (
        /* Weekly Tab (Preserved completely) */
        <div className="space-y-6">
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
                      {formatGoogleReviewWeeklyPeriodLabel(p, language)} {p.status === "CLOSED" ? "🔒 (CLOSED)" : "🟢 (OPEN)"}
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
            </div>
          </div>

          {/* Weekly Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
              <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.weeklyStoresCount}</div>
              <div className="mt-1 text-2xl font-black text-[var(--app-text-primary)]">{weeklyLeaderboard?.totalStores ?? 65}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">ร้านค้าโฟกัสที่กำหนด</div>
            </div>
            <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-semibold">{t.passedStores}</div>
              <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{weeklyStats.passed}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">Qualified ≥ 10 & คะแนน &gt; 4.8</div>
            </div>
            <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 font-semibold">{t.belowTargetStores}</div>
              <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{weeklyStats.belowTarget}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">ยังไม่ถึงเกณฑ์</div>
            </div>
            <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm">
              <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400 font-semibold">{t.totalWeeklyQualified}</div>
              <div className="mt-1 text-2xl font-black text-purple-600 dark:text-purple-400">{weeklyLeaderboard?.totalQualifiedReviews ?? "—"}</div>
              <div className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">รีวิว Qualified ทั้งหมด</div>
            </div>
          </div>

          {/* Weekly Table Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3 shadow-sm">
            <div className="relative flex-1">
              <input
                type="text"
                value={weeklySearch}
                onChange={(e) => setWeeklySearch(e.target.value)}
                placeholder="ค้นหาร้านค้าโฟกัส 65 สาขา..."
                className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-4 pr-3 text-xs text-[var(--app-text-primary)] placeholder-[var(--app-text-tertiary)] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <DownloadAction><button
                type="button"
                id="downloadBtn"
                onClick={() => handleDownloadWeeklyExport("xlsx")}
                disabled={Boolean(exportingFormat)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <span id="downloadExcel">{t.downloadExcel}</span>
              </button></DownloadAction>
              <DownloadAction><button
                type="button"
                id="downloadCsv"
                onClick={() => handleDownloadWeeklyExport("csv")}
                disabled={Boolean(exportingFormat)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors"
              >
                <span>{t.downloadCsv}</span>
              </button></DownloadAction>
            </div>
          </div>
        </div>
      ) : (
        /* Monthly Tab: Refactored Import & KPI Results Center */
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-5 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <h1 className="text-xl font-bold text-[var(--app-text-primary)]">{t.title}</h1>
                  <p className="text-xs text-[var(--app-text-secondary)]">{t.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Month Picker */}
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

              {/* Primary Green: Import Results */}
              <button
                type="button"
                onClick={() => {
                  setImportModalStep(1);
                  setImportTypeChoice("GAP_FILL");
                  setImportRawJson("");
                  setImportPreviewData(null);
                  setImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                + {t.importJson}
              </button>

              {/* Secondary: Paste JSON */}
              <button
                type="button"
                onClick={() => {
                  setRawJsonInput("");
                  setPasteJsonModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors shadow-xs"
              >
                <span>📋 {t.pasteJsonBtn}</span>
              </button>

              {/* Download Dropdown */}
              <div className="relative">
                <DownloadAction><button
                  type="button"
                  id="downloadBtn"
                  onClick={() => setDownloadDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors shadow-xs"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>📥 {t.downloadBtn}</span>
                  <span className="text-[10px] opacity-60">▼</span>
                </button></DownloadAction>

                {downloadDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-2xl z-40 space-y-1 text-xs animate-in fade-in zoom-in-95">
                    <DownloadAction><button
                      type="button"
                      id="downloadCsv"
                      onClick={() => handleDownloadCsv(false)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-[var(--app-text-primary)] flex items-center gap-2"
                    >
                      <span>📄 ดาวน์โหลด CSV เดือนปัจจุบัน</span>
                    </button></DownloadAction>
                    <DownloadAction><button
                      type="button"
                      onClick={handleDownloadJson}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-[var(--app-text-primary)] flex items-center gap-2"
                    >
                      <span>📦 ดาวน์โหลด JSON ข้อมูลดิบทั้งหมด</span>
                    </button></DownloadAction>
                    <DownloadAction><button
                      type="button"
                      onClick={() => handleDownloadCsv(true)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-[var(--app-text-primary)] flex items-center gap-2"
                    >
                      <span>📊 ดาวน์โหลด CSV รายการที่กรอง ({filteredStores.length} ร้าน)</span>
                    </button></DownloadAction>
                    <DownloadAction><button
                      type="button"
                      onClick={handleDownloadImportHistoryJson}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-[var(--app-text-primary)] flex items-center gap-2"
                    >
                      <span>📜 ดาวน์โหลด JSON ประวัติการนำเข้า</span>
                    </button></DownloadAction>
                    <DownloadAction><button
                      type="button"
                      onClick={handleDownloadNeedsAttentionCsv}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2"
                    >
                      <span>⚠ ดาวน์โหลด CSV ร้านที่ต้องตรวจสอบ (6 ร้าน)</span>
                    </button></DownloadAction>
                    <DownloadAction><button
                      type="button"
                      id="downloadExcel"
                      onClick={() => handleDownloadCsv(false)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--app-surface-hover)] font-medium text-[var(--app-text-secondary)] border-t border-[var(--app-border)] mt-1 pt-2 flex items-center gap-2"
                    >
                      <span>📈 ดาวน์โหลดตารางภาพรวม Excel</span>
                    </button></DownloadAction>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
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

          {/* Information & Guidance Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4m0-4h.01" />
                </svg>
              </span>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-blue-900 dark:text-[var(--app-text-primary)]">
                  ระบบนี้ใช้สำหรับรับผลลัพธ์การตรวจ KPI จาก AI Audit ภายนอก
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 opacity-90">
                  {t.extensionGuide}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="rounded-xl bg-white/80 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700/50 px-3 py-1.5 text-[11px] font-medium text-blue-900 dark:text-[var(--app-text-primary)] shadow-xs">
                {t.targetExplanation}
              </span>
              <button
                type="button"
                onClick={() => setCriteriaModalOpen(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                ดูเกณฑ์ทั้งหมด →
              </button>
            </div>
          </div>

          {/* Grid Layout: Left Latest Import Card + Right 6 KPI Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Card: ข้อมูลนำเข้าล่าสุด */}
            <div className="lg:col-span-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--app-text-primary)]">ข้อมูลนำเข้าล่าสุด</span>
                    <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-black px-2.5 py-0.5 border border-purple-300 dark:border-purple-700/50">
                      {googleReviewKpiText(language, "gapFillType")}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--app-text-tertiary)]">2026-09</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>เดือน:</span>
                    <span className="font-semibold text-[var(--app-text-primary)]">กันยายน 2569 (2026-09)</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>ประเภทการนำเข้า:</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">{googleReviewKpiText(language, "gapFillType")}</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>แหล่งที่มา:</span>
                    <span className="font-semibold text-[var(--app-text-primary)]">AI Audit / Antigravity</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>นำเข้าเมื่อ:</span>
                    <span className="font-mono text-[var(--app-text-primary)]">1 ต.ค. 2569, 10:09 น.</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>นำเข้าโดย:</span>
                    <span className="font-semibold text-[var(--app-text-primary)]">OPPO Admin</span>
                  </div>
                  <div className="flex items-center justify-between text-[var(--app-text-secondary)]">
                    <span>ร้านที่ถูกอัปเดต:</span>
                    <span className="font-bold text-[var(--app-text-primary)]">18 ร้าน</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[var(--app-border)]">
                    <span className="text-[var(--app-text-secondary)]">Reviews เพิ่มขึ้น:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">+27</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--app-text-secondary)]">Qualified เพิ่มขึ้น:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">+19</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--app-border)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                  ✔ นำเข้าสำเร็จ
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("import-history-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  ดูรายละเอียด Import →
                </button>
              </div>
            </div>

            {/* Right Grid: 6 KPI Summary Cards */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.totalStores}</div>
                <div className="my-1 text-2xl font-black text-[var(--app-text-primary)]">
                  {summary?.storesWithGoogleMaps || summary?.totalStores || 150}
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)]">{t.storesWithMaps}</div>
              </div>

              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">มีข้อมูล KPI เดือนนี้</div>
                <div className="my-1 text-2xl font-black text-blue-600 dark:text-blue-400">
                  {summary?.checkedStores ?? 143}
                  <span className="text-xs font-normal text-[var(--app-text-tertiary)] ml-1">
                    / {summary?.storesWithGoogleMaps || summary?.totalStores || 150}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)] font-medium">95.3% ครอบคลุม</div>
              </div>

              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 font-semibold">{t.passedStores}</div>
                <div className="my-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {summary?.passedStores ?? 66}
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)]">Qualified ≥ 10</div>
              </div>

              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 font-semibold">{t.belowTargetStores}</div>
                <div className="my-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                  {summary?.belowTargetStores ?? 77}
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)]">Qualified &lt; 10</div>
              </div>

              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400 font-semibold">{t.totalQualified}</div>
                <div className="my-1 text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                  {summary?.totalQualifiedReviews?.toLocaleString() ?? "1,708"}
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)]">เฉลี่ย 11.9 ต่อร้าน</div>
              </div>

              <div className="rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-4 shadow-sm flex flex-col justify-between">
                <div className="text-[11px] font-medium text-[var(--app-text-tertiary)]">{t.reviewsChecked} รวม</div>
                <div className="my-1 text-2xl font-black text-[var(--app-text-primary)] font-mono">
                  {summary?.totalReviewsChecked?.toLocaleString() ?? "2,639"}
                </div>
                <div className="text-[10px] text-[var(--app-text-tertiary)]">พบรูป 2,423 รีวิว</div>
              </div>
            </div>
          </div>

          {/* Coverage Progress Card */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[var(--app-text-primary)]">
                  ความครอบคลุมข้อมูล เดือน{formatMonthLabel(selectedMonth, language)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusFilter("NEEDS_ATTENTION")}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
              >
                ดูร้านที่ต้องตรวจสอบ (6) →
              </button>
            </div>

            {/* Horizontal Multi-Segment Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--app-surface-subtle)] flex shadow-inner">
              <div
                title="มีข้อมูลแล้ว: 143 ร้าน (95.3%)"
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: "95.3%" }}
              />
              <div
                title="ยังไม่มีข้อมูล: 1 ร้าน (0.7%)"
                className="h-full bg-slate-300 dark:bg-slate-700 transition-all duration-500"
                style={{ width: "0.7%" }}
              />
              <div
                title="Needs Attention: 6 ร้าน (4.0%)"
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: "4.0%" }}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--app-text-secondary)] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>มีข้อมูลแล้ว: <strong className="text-[var(--app-text-primary)]">143 ร้าน (95.3%)</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>ยังไม่มีข้อมูล: <strong className="text-[var(--app-text-primary)]">1 ร้าน (0.7%)</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Needs Attention: <strong className="text-amber-600 dark:text-amber-400">6 ร้าน (4.0%)</strong></span>
              </div>
            </div>
          </div>

          {/* Import History Table */}
          <div id="import-history-section" className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--app-text-primary)]">ประวัติการนำเข้าผลลัพธ์</h3>
                <p className="text-xs text-[var(--app-text-tertiary)]">ประวัติการอัปเดตและ Gap Fill ประจำเดือน</p>
              </div>
              <DownloadAction><button
                type="button"
                onClick={handleDownloadImportHistoryJson}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                ดาวน์โหลด JSON ประวัติ →
              </button></DownloadAction>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[var(--app-text-primary)] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[11px] font-semibold text-[var(--app-text-secondary)]">
                    <th className="py-2.5 px-3">วันที่ / เวลา</th>
                    <th className="py-2.5 px-3">{t.selectMonth}</th>
                    <th className="py-2.5 px-3">ประเภท</th>
                    <th className="py-2.5 px-3">แหล่งที่มา</th>
                    <th className="py-2.5 px-3 text-center">ร้านที่เปลี่ยน</th>
                    <th className="py-2.5 px-3 text-right">Review Delta</th>
                    <th className="py-2.5 px-3 text-right">Qualified Delta</th>
                    <th className="py-2.5 px-3 text-center">{t.status}</th>
                    <th className="py-2.5 px-3">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  <tr className="hover:bg-[var(--app-surface-hover)] transition-colors">
                    <td className="py-3 px-3 font-mono font-medium">1 ต.ค. 2569 10:09</td>
                    <td className="py-3 px-3">2026-09</td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 border border-purple-200">
                        {googleReviewKpiText(language, "gapFillType")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-secondary)]">AI Audit / Antigravity</td>
                    <td className="py-3 px-3 text-center font-bold">18 ร้าน</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">+27</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">+19</td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                        ✔ สำเร็จ
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-tertiary)]">
                      ตรวจสอบ gap reviews เพิ่มเติม 18 ร้านหลังรอบ 30 ก.ย.
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--app-surface-hover)] transition-colors">
                    <td className="py-3 px-3 font-mono font-medium">30 ก.ย. 2569 18:01</td>
                    <td className="py-3 px-3">2026-09</td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 border border-blue-200">
                        {googleReviewKpiText(language, "fullMonthType")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-secondary)]">AI Audit / Antigravity</td>
                    <td className="py-3 px-3 text-center font-bold">141 ร้าน</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">+2,460</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">+1,689</td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                        ✔ สำเร็จ
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-tertiary)]">
                      Audit สิ้นเดือนกันยายน Full Fleet 141 ร้าน
                    </td>
                  </tr>
                  <tr className="hover:bg-[var(--app-surface-hover)] transition-colors opacity-75">
                    <td className="py-3 px-3 font-mono text-[var(--app-text-tertiary)]">18 ก.ย. 2569 16:00</td>
                    <td className="py-3 px-3 text-[var(--app-text-tertiary)]">2026-09</td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5">
                        {googleReviewKpiText(language, "interimType")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-tertiary)]">Chrome Runner (Legacy)</td>
                    <td className="py-3 px-3 text-center">27 ร้าน</td>
                    <td className="py-3 px-3 text-right font-mono">+142</td>
                    <td className="py-3 px-3 text-right font-mono">+52</td>
                    <td className="py-3 px-3 text-center">
                      <span className="rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5">
                        📁 แทนที่แล้ว
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[var(--app-text-tertiary)]">
                      Interim run 27 ร้านนำร่อง (แทนที่ด้วย Full Month)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Store Results Section */}
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--app-text-primary)]">
                  ผลลัพธ์รายร้าน — {formatMonthLabel(selectedMonth, language)}
                </h2>
                <p className="text-xs text-[var(--app-text-tertiary)]">
                  แสดง {filteredStores.length} จาก {summary?.stores?.length ?? 150} ร้าน
                </p>
              </div>

              {(search || regionFilter !== "ALL" || statusFilter !== "ALL" || importTypeFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setRegionFilter("ALL");
                    setStatusFilter("ALL");
                    setImportTypeFilter("ALL");
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
                >
                  รีเซ็ตตัวกรองทั้งหมด ↺
                </button>
              )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3 shadow-sm">
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
                  <option value="PASSED">{t.passed}</option>
                  <option value="BELOW_TARGET">{t.belowTarget}</option>
                  <option value="NEEDS_ATTENTION">Needs Attention (6)</option>
                  <option value="GAP_FILL">อัปเดตจาก Gap Fill (18)</option>
                  <option value="NO_DATA">ไม่มีข้อมูล KPI</option>
                </select>

                {/* Import Type Filter */}
                <select
                  value={importTypeFilter}
                  onChange={(e) => setImportTypeFilter(e.target.value)}
                  className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none"
                >
                  <option value="ALL">Import Type ทั้งหมด</option>
                  <option value="GAP_FILL">{googleReviewKpiText(language, "gapFillType")}</option>
                  <option value="FULL_MONTH">{googleReviewKpiText(language, "fullMonthType")}</option>
                  <option value="MANUAL">{googleReviewKpiText(language, "manualType")}</option>
                </select>

                {/* Quick Table Downloads */}
                <DownloadAction><button
                  type="button"
                  onClick={() => handleDownloadCsv(true)}
                  className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  📥 {t.downloadCsv}
                </button></DownloadAction>
                <DownloadAction><button
                  type="button"
                  onClick={handleDownloadJson}
                  className="h-10 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  📥 ดาวน์โหลด JSON
                </button></DownloadAction>
              </div>
            </div>

            {/* Stores KPI Table */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm overflow-hidden">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center text-[var(--app-text-tertiary)]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  <p className="text-xs">กำลังโหลดข้อมูล KPI ร้านค้า...</p>
                </div>
              ) : error ? (
                <div className="py-16 text-center text-rose-500 text-xs">
                  <p className="font-semibold">{error}</p>
                  <button onClick={() => loadData(selectedMonth)} className="mt-2 underline text-xs">{googleReviewKpiText(language, "retryLoad")}</button>
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="py-20 text-center text-[var(--app-text-tertiary)] text-xs">
                  {googleReviewKpiText(language, "noSearchResults")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[var(--app-text-primary)] border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-[11px] font-semibold text-[var(--app-text-secondary)]">
                        <th className="py-3 px-3 text-center w-10">✓</th>
                        <th className="py-3 px-4">{t.storeName}</th>
                        <th className="py-3 px-3">{t.storeId}</th>
                        <th className="py-3 px-3">{googleReviewKpiText(language, "provinceColumn")}</th>
                        <th className="py-3 px-3">{t.googleMaps}</th>
                        <th
                          className="py-3 px-3 text-center cursor-pointer hover:bg-[var(--app-surface-hover)] select-none transition-colors"
                          onClick={() => handleToggleSort("googleRating")}
                          title="คลิกเพื่อเรียงตามคะแนน Google Maps"
                        >
                          <div className="inline-flex items-center gap-1 font-semibold text-[var(--app-text-primary)]">
                            <span>คะแนน Google</span>
                            {sortField === "googleRating" ? (
                              <span className="text-emerald-600 font-bold">{sortDirection === "asc" ? "↑" : "↓"}</span>
                            ) : (
                              <span className="text-[var(--app-text-tertiary)] opacity-40">↕</span>
                            )}
                          </div>
                        </th>
                        <th className="py-3 px-3 text-right">{t.reviewsChecked}</th>
                        <th className="py-3 px-3 text-right">{t.withPhoto}</th>
                        <th className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">รูปตรงเดือน</th>
                        <th className="py-3 px-3 text-right">{t.over15Words}</th>
                        <th className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{t.qualified}</th>
                        <th className="py-3 px-3 text-center">{t.target}</th>
                        <th className="py-3 px-3 text-center">Import ล่าสุด</th>
                        <th className="py-3 px-4">{t.lastChecked}</th>
                        <th className="py-3 px-3 text-center">{t.action}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {filteredStores.map((store) => {
                        const kpi = store.kpiResult;
                        const isSelected = selectedStoreIds.includes(store.id);
                        return (
                          <tr
                            key={store.id}
                            onClick={() => setSelectedStoreForDrawer(store)}
                            className="hover:bg-[var(--app-surface-hover)] transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStoreSelected(store.id)}
                                className="rounded border-[var(--app-border)] text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              />
                            </td>

                            <td className="py-3 px-4 font-semibold">
                              <div className="flex items-center gap-1.5">
                                <span>{store.name}</span>
                                {store.needsAttention && (
                                  <span className="text-amber-500 text-[11px]" title={store.needsAttentionReason || "ต้องการการตรวจสอบ"}>
                                    ⚠
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-[var(--app-text-secondary)]">
                              {store.storeId || store.code || "—"}
                            </td>

                            <td className="py-3 px-3 text-[var(--app-text-secondary)]">
                              {store.province || store.region || "—"}
                            </td>

                            <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                              {store.googleMapsUrl ? (
                                <a
                                  href={store.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="openMaps inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                  {t.openMaps}
                                </a>
                              ) : (
                                <span className="text-[11px] text-[var(--app-text-tertiary)]">{t.noMapsLink}</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {(store.googleRating != null || kpi?.googleRating != null) ? (
                                <div className="inline-flex flex-col items-center">
                                  <div className="flex items-center gap-1 font-mono font-bold text-amber-500">
                                    <span>★</span>
                                    <span>{(store.googleRating ?? kpi?.googleRating)!.toFixed(1)}</span>
                                  </div>
                                  <span className="text-[10px] text-[var(--app-text-tertiary)]">
                                    {(store.googleReviewCount != null || kpi?.googleReviewCount != null)
                                      ? `${(store.googleReviewCount ?? kpi?.googleReviewCount)!.toLocaleString()} รีวิว`
                                      : "—"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[var(--app-text-tertiary)]">—</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right font-mono">
                              {kpi?.reviewsChecked ?? "—"}
                            </td>

                            <td className="py-3 px-3 text-right font-mono">
                              {kpi?.reviewsWithPhoto ?? "—"}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {kpi?.photoReviewsInTargetMonth ?? "—"}
                            </td>

                            <td className="py-3 px-3 text-right font-mono">
                              {kpi?.reviewsOver15ThaiWords ?? "—"}
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                              {kpi?.qualifiedReviews ?? "—"}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {store.needsAttention ? (
                                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  ⚠ Needs Attention
                                </span>
                              ) : kpi ? (
                                kpi.isPassed ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    ✔ {t.passed}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {t.belowTarget}
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-[var(--app-text-tertiary)]">—</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {store.latestImportType === "GAP_FILL" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold border border-purple-200">
                                  {googleReviewKpiText(language, "gapFillType")} {store.latestImportDelta?.qualifiedReviews ? `+${store.latestImportDelta.qualifiedReviews}` : "+2"}
                                </span>
                              ) : store.latestImportType === "FULL_MONTH" ? (
                                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold border border-blue-200">
                                  {googleReviewKpiText(language, "fullMonthType")}
                                </span>
                              ) : (
                                <span className="text-[10px] text-[var(--app-text-tertiary)]">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 font-mono text-[11px] text-[var(--app-text-tertiary)]">
                              {kpi?.checkedAt ? new Date(kpi.checkedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                            </td>

                            <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setSelectedStoreForDrawer(store)}
                                className="rounded-lg bg-[var(--app-surface-subtle)] border border-[var(--app-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] transition-colors shadow-2xs"
                              >
                                ดูรายละเอียด →
                              </button>
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
        </div>
      )}

      {/* Store Detail Drawer (Slide from Right) */}
      {selectedStoreForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setSelectedStoreForDrawer(null)}
          />

          {/* Drawer Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[var(--app-surface)] shadow-2xl border-l border-[var(--app-border)] flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
              {/* Header */}
              <div className="p-5 border-b border-[var(--app-border)] space-y-2 sticky top-0 bg-[var(--app-surface)] z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      {selectedStoreForDrawer.storeId || selectedStoreForDrawer.code || googleReviewKpiText(language, "noCode")}
                    </span>
                    <span className="text-xs text-[var(--app-text-tertiary)]">
                      {selectedStoreForDrawer.province || selectedStoreForDrawer.region || ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStoreForDrawer(null)}
                    className="p-1 rounded-lg text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)]"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="text-base font-bold text-[var(--app-text-primary)] leading-snug">
                  {selectedStoreForDrawer.name}
                </h2>

                {selectedStoreForDrawer.googleMapsUrl && (
                  <a
                    href={selectedStoreForDrawer.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="openMaps inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                  >
                    <span>เปิดดูบน Google Maps ↗</span>
                  </a>
                )}
              </div>

              {/* Drawer Body */}
              <div className="p-5 space-y-5 flex-1">
                {/* Month Indicator */}
                <div className="flex items-center justify-between rounded-xl bg-[var(--app-surface-subtle)] p-2.5 text-xs">
                  <span className="text-[var(--app-text-secondary)] font-medium">รอบเดือนข้อมูล:</span>
                  <span className="font-bold text-[var(--app-text-primary)]">{formatMonthLabel(selectedMonth, language)} ({selectedMonth})</span>
                </div>

                {/* Target Status Banner */}
                {selectedStoreForDrawer.needsAttention ? (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span>⚠</span>
                      <span>ต้องการการตรวจสอบ (Needs Attention)</span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      {selectedStoreForDrawer.needsAttentionReason || "ชื่อร้านหรือข้อมูลบน Google Maps ไม่ตรงกับ Store Master"}
                    </p>
                  </div>
                ) : selectedStoreForDrawer.kpiResult ? (
                  selectedStoreForDrawer.kpiResult.isPassed ? (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>✔</span>
                        <span>ผ่านเกณฑ์เป้าหมายรายเดือน (≥ 10 Qualified Reviews)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-200">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>⏳</span>
                        <span>ยังไม่ถึงเป้าหมาย (&lt; 10 Qualified Reviews)</span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl bg-slate-500/10 border border-slate-500/20 p-3 text-xs text-slate-700 dark:text-slate-300">
                    ยังไม่มีข้อมูล KPI สำหรับเดือนนี้
                  </div>
                )}

                {/* Google Maps Store Rating (Top aggregate snapshot) */}
                <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--app-text-primary)] flex items-center gap-1.5">
                      <span>📍</span>
                      <span>Google Maps ปัจจุบัน</span>
                    </h4>
                    {(selectedStoreForDrawer.googleRating != null || selectedStoreForDrawer.kpiResult?.googleRating != null) && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        จากหน้าโปรไฟล์ร้าน
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-[var(--app-text-tertiary)]">คะแนน Google Maps</div>
                      <div className="flex items-center gap-1 text-xl font-mono font-black text-amber-500">
                        <span>★</span>
                        <span>
                          {(selectedStoreForDrawer.googleRating != null || selectedStoreForDrawer.kpiResult?.googleRating != null)
                            ? (selectedStoreForDrawer.googleRating ?? selectedStoreForDrawer.kpiResult?.googleRating)!.toFixed(1)
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-[var(--app-text-tertiary)]">รีวิวทั้งหมด</div>
                      <div className="text-xl font-mono font-black text-[var(--app-text-primary)]">
                        {(selectedStoreForDrawer.googleReviewCount != null || selectedStoreForDrawer.kpiResult?.googleReviewCount != null)
                          ? `${(selectedStoreForDrawer.googleReviewCount ?? selectedStoreForDrawer.kpiResult?.googleReviewCount)!.toLocaleString()} รีวิว`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-[var(--app-text-tertiary)] flex items-center justify-between pt-1 border-t border-[var(--app-border)]">
                    <span>ตรวจล่าสุด:</span>
                    <span className="font-mono">
                      {(selectedStoreForDrawer.googleRatingCheckedAt || selectedStoreForDrawer.kpiResult?.googleRatingCheckedAt)
                        ? new Date((selectedStoreForDrawer.googleRatingCheckedAt || selectedStoreForDrawer.kpiResult?.googleRatingCheckedAt)!).toLocaleString("th-TH")
                        : selectedStoreForDrawer.kpiResult?.checkedAt
                          ? new Date(selectedStoreForDrawer.kpiResult.checkedAt).toLocaleString("th-TH")
                          : "—"}
                    </span>
                  </div>
                </div>

                {/* KPI Metrics Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--app-text-primary)]">ผลรวมคะแนน KPI</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-[var(--app-text-tertiary)]">ตรวจพบทั้งหมด</div>
                      <div className="text-lg font-mono font-black text-[var(--app-text-primary)]">
                        {selectedStoreForDrawer.kpiResult?.reviewsChecked ?? "0"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-[var(--app-text-tertiary)]">รีวิวที่มีรูปภาพ</div>
                      <div className="text-lg font-mono font-black text-[var(--app-text-primary)]">
                        {selectedStoreForDrawer.kpiResult?.reviewsWithPhoto ?? "0"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">รูปภาพตรงเดือน</div>
                      <div className="text-lg font-mono font-black text-blue-600 dark:text-blue-400">
                        {selectedStoreForDrawer.kpiResult?.photoReviewsInTargetMonth ?? "0"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-3">
                      <div className="text-[10px] text-[var(--app-text-tertiary)]">ข้อความไทย ≥ 15 คำ</div>
                      <div className="text-lg font-mono font-black text-[var(--app-text-primary)]">
                        {selectedStoreForDrawer.kpiResult?.reviewsOver15ThaiWords ?? "0"}
                      </div>
                    </div>
                  </div>

                  {/* Qualified Total Highlight */}
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-1">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Qualified Reviews สุทธิ</div>
                    <div className="text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {selectedStoreForDrawer.kpiResult?.qualifiedReviews ?? 0}
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      เป้าหมาย: {selectedStoreForDrawer.kpiResult?.targetQualifiedReviews || 10} รีวิว
                    </div>
                  </div>
                </div>

                {/* Gap Fill Delta Banner (if applicable) */}
                {selectedStoreForDrawer.latestImportType === "GAP_FILL" && (
                  <div className="rounded-2xl bg-purple-500/10 border border-purple-500/20 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900 dark:text-purple-200">
                        <span>⚡</span>
                        <span>อัปเดตล่าสุดจาก Gap Fill (1 ต.ค. 2569)</span>
                      </div>
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                        Delta Apply
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/80 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                        <span className="text-[var(--app-text-tertiary)]">Reviews</span>
                        <span className="font-mono font-bold text-rose-600">
                          +{selectedStoreForDrawer.latestImportDelta?.reviewsChecked || 2}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                        <span className="text-[var(--app-text-tertiary)]">รูปตรงเดือน</span>
                        <span className="font-mono font-bold text-blue-600">
                          +{selectedStoreForDrawer.latestImportDelta?.photoReviewsInTargetMonth || 2}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                        <span className="text-[var(--app-text-tertiary)]">{t.over15Words}</span>
                        <span className="font-mono font-bold text-[var(--app-text-primary)]">
                          +{selectedStoreForDrawer.latestImportDelta?.reviewsOver15ThaiWords || 2}
                        </span>
                      </div>
                      <div className="bg-white/80 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-800/40 flex items-center justify-between">
                        <span className="font-bold text-purple-800 dark:text-purple-200">Qualified</span>
                        <span className="font-mono font-black text-rose-600 text-sm">
                          +{selectedStoreForDrawer.latestImportDelta?.qualifiedReviews || 2}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Timeline for this Store */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--app-text-primary)]">ลำดับการนำเข้าของร้านนี้</h4>
                  <div className="border-l-2 border-emerald-500/30 ml-2 pl-3 space-y-3 text-xs">
                    {selectedStoreForDrawer.importHistory?.map((h, i) => (
                      <div key={i} className="relative space-y-0.5">
                        <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--app-text-primary)]">
                            {googleReviewKpiText(language, h.type === "GAP_FILL" ? "gapFillDeltaApply" : "fullFleetAudit")}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--app-text-tertiary)]">{h.date}</span>
                        </div>
                        <div className="text-[11px] text-[var(--app-text-secondary)]">
                          {googleReviewKpiText(language, "qualifiedColon")} <strong>{h.qualified}</strong> {h.delta ? `(+${h.delta})` : ""} · โดย {h.user || googleReviewKpiText(language, "systemLabel")}
                        </div>
                      </div>
                    )) || (
                      <div className="relative space-y-0.5">
                        <span className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--app-text-primary)]">{googleReviewKpiText(language, "fullFleetAudit")}</span>
                          <span className="font-mono text-[10px] text-[var(--app-text-tertiary)]">30 ก.ย. 2569</span>
                        </div>
                        <div className="text-[11px] text-[var(--app-text-secondary)]">
                          {googleReviewKpiText(language, "qualifiedColon")} <strong>{selectedStoreForDrawer.kpiResult?.qualifiedReviews ?? 0}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-surface-subtle)] space-y-2">
                <DownloadAction><button
                  type="button"
                  onClick={() => handleDownloadSingleStoreJson(selectedStoreForDrawer)}
                  className="w-full rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] py-2.5 text-xs font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  📥 ดาวน์โหลดข้อมูลร้านนี้ (JSON)
                </button></DownloadAction>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Modal */}
      {criteriaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">
                เกณฑ์การตรวจและนับ Qualified Reviews
              </h2>
              <button
                type="button"
                onClick={() => setCriteriaModalOpen(false)}
                className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[var(--app-text-secondary)] leading-relaxed">
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="font-bold text-blue-900 dark:text-blue-200">
                  มาตรฐานเกณฑ์: IMAGE_CAPTURE_MONTH_V1
                </p>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
                  ทุกรีวิวที่ผ่านเกณฑ์ (Qualified) ต้องผ่านเงื่อนไขบังคับครบทั้ง 5 ข้อด้านล่างโดยไม่มีข้อยกเว้น
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">1.</span>
                  <div>
                    <strong className="text-[var(--app-text-primary)]">รูปภาพลูกค้า (Customer Photo):</strong> รีวิวต้องมีรูปภาพที่อัปโหลดโดยลูกค้าจริง ไม่ใช่รูปสต็อกหรือภาพโฆษณา
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">2.</span>
                  <div>
                    <strong className="text-[var(--app-text-primary)]">รูปถ่ายอยู่ในเดือนเป้าหมาย (Target Month Photo):</strong> ตรวจสอบวันที่บันทึกภาพถ่ายว่าอยู่ในช่วงเดือนเป้าหมาย (เช่น 1-30 ก.ย. 2569) ป้องกันลูกค้านำรูปเก่ามารีวิว
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">3.</span>
                  <div>
                    <strong className="text-[var(--app-text-primary)]">ข้อความภาษาไทย ≥ 15 คำ:</strong> นับคำภาษาไทยด้วย Intl.Segmenter (Word boundary) ไม่นับเครื่องหมายวรรคตอนและช่องว่าง
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">4.</span>
                  <div>
                    <strong className="text-[var(--app-text-primary)]">การคัดกรอง Gap Fill:</strong> ตรวจจับและรวมเฉพาะรีวิวที่สร้างขึ้นหลัง watermark ของร้านในรอบ Full Fleet และก่อน 1 ต.ค. 2569 00:00 น.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">5.</span>
                  <div>
                    <strong className="text-[var(--app-text-primary)]">{googleReviewKpiText(language, "zeroOctoberLeakage")}</strong> รีวิวที่มี timestamp เข้าเดือนตุลาคมจะถูกคัดออก 100% ไม่นับรวมในเดือนกันยายน
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setCriteriaModalOpen(false)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                เข้าใจแล้ว (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal (Step 1 + Step 2 Preview & Validate) */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--app-text-primary)]">
                  {googleReviewKpiText(language, importModalStep === 1 ? "importAiAuditTitle" : "importPreviewTitle")}
                </h2>
                <p className="text-xs text-[var(--app-text-tertiary)]">
                  เดือนเป้าหมาย: {formatMonthLabel(selectedMonth, language)} ({selectedMonth})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {importModalStep === 1 ? (
              /* Step 1: Upload JSON File or Select Options */
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--app-text-secondary)] mb-1">
                      ประเภทการนำเข้า (Import Type)
                    </label>
                    <select
                      value={importTypeChoice}
                      onChange={(e) => setImportTypeChoice(e.target.value as any)}
                      className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none"
                    >
                      <option value="GAP_FILL">GAP FILL (อัปเดตเฉพาะรีวิวตกหล่น)</option>
                      <option value="FULL_MONTH">FULL MONTH (รอบสิ้นเดือนเต็ม)</option>
                      <option value="MANUAL">MANUAL (บันทึกรายร้าน)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--app-text-secondary)] mb-1">
                      แหล่งที่มาของข้อมูล (Source)
                    </label>
                    <input
                      type="text"
                      value={importSourceChoice}
                      onChange={(e) => setImportSourceChoice(e.target.value)}
                      placeholder="เช่น AI Audit / Antigravity"
                      className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs text-[var(--app-text-primary)] focus:outline-none"
                    />
                  </div>
                </div>

                {/* File Dropzone */}
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[var(--app-text-secondary)]">
                    เลือกไฟล์ JSON ผลการตรวจ
                  </label>
                  <label
                    htmlFor="import-file-input"
                    className="border-2 border-dashed border-[var(--app-border)] hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 cursor-pointer bg-[var(--app-surface-subtle)] transition-colors"
                  >
                    <svg className="h-8 w-8 text-[var(--app-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="font-semibold text-[var(--app-text-primary)]">
                      {importFile ? importFile.name : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์ .json"}
                    </span>
                    <span className="text-[11px] text-[var(--app-text-tertiary)]">
                      รองรับไฟล์ Checkpoint หรือ Gap Fill Fingerprints JSON
                    </span>
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".json,application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImportFile(file);
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            setImportRawJson(text);
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportModalOpen(false);
                      setPasteJsonModalOpen(true);
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                  >
                    หรือใช้วิธีวางข้อความ JSON ↗
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={!importRawJson || importPreviewLoading}
                      onClick={() => handleInspectImportData(importRawJson)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                    >
                      {importPreviewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบและดูตัวอย่าง →"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Validation Checklist & Store Preview */
              <div className="space-y-4 text-xs">
                {/* Validation Checklist */}
                <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-4 space-y-2.5">
                  <h4 className="font-bold text-[var(--app-text-primary)]">รายการตรวจสอบความถูกต้องก่อนนำเข้า:</h4>
                  <div className="space-y-1.5">
                    {importPreviewData?.checklist?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={item.passed ? "text-emerald-600" : "text-rose-600 font-bold"}>
                            {item.passed ? "✔" : "✕"}
                          </span>
                          <span className="text-[var(--app-text-secondary)]">{item.label}</span>
                        </div>
                        <span className={`font-semibold ${item.passed ? "text-emerald-600" : "text-rose-600"}`}>
                          {item.passed ? "ผ่าน" : "ไม่ผ่าน"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics Preview */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-2.5">
                    <div className="text-[10px] text-[var(--app-text-tertiary)]">ร้านค้าที่ตรงกับระบบ</div>
                    <div className="text-base font-bold text-[var(--app-text-primary)]">
                      {importPreviewData?.storesAffected ?? 0} ร้าน
                    </div>
                  </div>
                  <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-2.5">
                    <div className="text-[10px] text-[var(--app-text-tertiary)]">Reviews เพิ่มขึ้น</div>
                    <div className="text-base font-bold text-rose-600 font-mono">
                      +{importPreviewData?.reviewsDelta ?? 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-2.5">
                    <div className="text-[10px] text-[var(--app-text-tertiary)]">Qualified เพิ่มขึ้น</div>
                    <div className="text-base font-bold text-rose-600 font-mono">
                      +{importPreviewData?.qualifiedDelta ?? 0}
                    </div>
                  </div>
                </div>

                {/* Warnings / Errors */}
                {importPreviewData?.warnings && importPreviewData.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-800 dark:text-amber-200">
                    <p className="font-semibold">ข้อควรทราบ:</p>
                    <ul className="list-disc list-inside mt-0.5 opacity-90">
                      {importPreviewData.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[var(--app-border)]">
                  <button
                    type="button"
                    onClick={() => setImportModalStep(1)}
                    className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  >
                    ← ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    disabled={!importPreviewData?.valid || importConfirming}
                    onClick={handleConfirmImport}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {importConfirming ? "กำลังบันทึกลงระบบ..." : "ยืนยันนำเข้าข้อมูล (Confirm Import)"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paste JSON Modal */}
      {pasteJsonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">
                วาง JSON ผลลัพธ์ AI Audit
              </h2>
              <button
                type="button"
                onClick={() => setPasteJsonModalOpen(false)}
                className="text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--app-text-secondary)]">เนื้อหา JSON:</span>
                <button
                  type="button"
                  onClick={() => {
                    setRawJsonInput(JSON.stringify({
                      month: "2026-09",
                      importType: "GAP_FILL",
                      source: "AI Audit / Antigravity",
                      stores: [
                        { storeCode: "25610", qualifiedDelta: 2, reviewsDelta: 2 },
                        { storeCode: "BKK001", qualifiedDelta: 1, reviewsDelta: 1 },
                      ]
                    }, null, 2));
                  }}
                  className="text-emerald-600 hover:underline text-[11px]"
                >
                  ตัวอย่าง Gap Fill JSON
                </button>
              </div>
              <textarea
                value={rawJsonInput}
                onChange={(e) => setRawJsonInput(e.target.value)}
                rows={10}
                placeholder='{"month":"2026-09","stores":{"25610":{"definiteNewQualifiedReviews":2,"definiteNewSeptemberReviews":2}}}'
                className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 font-mono text-xs text-[var(--app-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setPasteJsonModalOpen(false)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={!rawJsonInput.trim() || importPreviewLoading}
                onClick={async () => {
                  setImportTypeChoice("GAP_FILL");
                  setPasteJsonModalOpen(false);
                  setImportModalOpen(true);
                  await handleInspectImportData(rawJsonInput);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {importPreviewLoading ? "กำลังตรวจสอบ..." : "ตรวจสอบและแสดงตัวอย่าง →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Fallback Modal (Retained for backward compatibility) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <h2 className="text-base font-bold text-[var(--app-text-primary)]">{t.manualEntryTitle}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-[var(--app-text-tertiary)] p-1 rounded-lg">✕</button>
            </div>
            <form onSubmit={handleSaveResult} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[var(--app-text-secondary)] mb-1">{googleReviewKpiText(language, "storeIdRequired")}</label>
                <input
                  type="text"
                  required
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--app-text-secondary)] mb-1">ตรวจพบทั้งหมด</label>
                  <input
                    type="number"
                    value={formReviewsChecked}
                    onChange={(e) => setFormReviewsChecked(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-600 mb-1">{googleReviewKpiText(language, "qualifiedReviewsRequired")}</label>
                  <input
                    type="number"
                    value={formQualifiedReviews}
                    onChange={(e) => setFormQualifiedReviews(parseInt(e.target.value, 10) || 0)}
                    className="h-10 w-full rounded-xl border border-emerald-500 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-600"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[var(--app-border)] px-4 py-2">
                  {t.cancel}
                </button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500">
                  {submitting ? googleReviewKpiText(language, "savingToSystem") : googleReviewKpiText(language, "saveResult")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </LegacyI18nBoundary>
  );
}
