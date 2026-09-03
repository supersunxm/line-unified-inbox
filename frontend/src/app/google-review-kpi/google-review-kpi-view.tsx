"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GoogleReviewAuditQueueStoreItem,
  GoogleReviewAuditSessionResponse,
  GoogleReviewKpiStoreItem,
  GoogleReviewKpiSummary,
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
): string {
  try {
    const url = new URL(originalUrl);
    url.searchParams.set("oppoStoreId", store.id);
    if (store.storeId) url.searchParams.set("oppoExtId", store.storeId);
    if (store.code) url.searchParams.set("oppoCode", store.code);
    url.searchParams.set("oppoName", store.name);
    url.searchParams.set("oppoMonth", month);
    if (runnerToken || sessionId) {
      const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
      if (runnerToken) hashParams.set("oppoToken", runnerToken);
      if (sessionId) hashParams.set("oppoSessionId", sessionId);
      url.hash = hashParams.toString();
    }
    return url.toString();
  } catch {
    const sep = originalUrl.includes("?") ? "&" : "?";
    let base = `${originalUrl}${sep}oppoStoreId=${encodeURIComponent(store.id)}&oppoExtId=${encodeURIComponent(store.storeId || "")}&oppoCode=${encodeURIComponent(store.code || "")}&oppoName=${encodeURIComponent(store.name)}&oppoMonth=${encodeURIComponent(month)}`;
    if (runnerToken || sessionId) {
      const hashParts: string[] = [];
      if (runnerToken) hashParts.push(`oppoToken=${encodeURIComponent(runnerToken)}`);
      if (sessionId) hashParts.push(`oppoSessionId=${encodeURIComponent(sessionId)}`);
      base += `#${hashParts.join("&")}`;
    }
    return base;
  }
}

const translations = {
  th: {
    title: "Google Maps Review KPI Checker",
    subtitle: "ตรวจสอบและติดตาม KPI รีวิวร้านค้าบน Google Maps ประจำเดือน",
    selectMonth: "เลือกเดือน",
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
    selectMonth: "Select Month",
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
    selectMonth: "选择月份",
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
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      localStorage.setItem("oppo_active_batch_audit", JSON.stringify(bridgeData));
      window.dispatchEvent(new CustomEvent("oppo_batch_audit_action", { detail: bridgeData }));

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
      localStorage.setItem("oppo_active_batch_audit", JSON.stringify(bridgeData));
      window.dispatchEvent(new CustomEvent("oppo_batch_audit_action", { detail: bridgeData }));
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
      localStorage.setItem("oppo_active_batch_audit", JSON.stringify(bridgeData));
      window.dispatchEvent(new CustomEvent("oppo_batch_audit_action", { detail: bridgeData }));

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
            </div>
            <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)]">
              ตรวจและบันทึกผล KPI อัตโนมัติทีละร้านผ่าน Chrome Extension โดยไม่ต้องเลื่อนหน้าจอเอง
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
