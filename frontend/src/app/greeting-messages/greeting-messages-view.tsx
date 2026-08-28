"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GreetingMessageBlock,
  GreetingReadinessResponse,
  GreetingSendPolicy,
  GreetingStoreReadinessItem,
  GreetingTemplate,
} from "@/types/api";
import { getGreetingDict, type GreetingDict } from "./greeting-i18n";
import { GreetingMessageBuilder } from "./greeting-message-builder";

type GreetingMessagesViewProps = {
  language?: "th" | "en" | "zh" | string;
  userRole?: "ADMIN" | "VIEWER";
};

type ReadinessFilter = "ALL" | "READY" | "BLOCKED";

const STORE_PAGE_SIZE = 25;

export function GreetingMessagesView({
  language = "th",
  userRole = "ADMIN",
}: GreetingMessagesViewProps) {
  const t: GreetingDict = useMemo(() => getGreetingDict(language), [language]);
  void userRole;

  const ui = useMemo(() => {
    if (language === "en") {
      return {
        template: "Template",
        createNew: "+ Create new",
        storeUsage: "Target stores",
        assigned: "Assigned",
        ready: "Ready",
        blocked: "Incomplete",
        selected: "Selected",
        selectAllReady: "Select all ready stores",
        selectFilteredReady: "Select filtered ready stores",
        clearSelection: "Clear selection",
        searchStores: "Search store code, store name, or LINE OA",
        allProvinces: "All provinces",
        allStatuses: "All statuses",
        readyOnly: "Ready",
        blockedOnly: "Incomplete",
        resultCount: (count: number) => `${count} stores found`,
        saveAssignments: (count: number) => `Apply to ${count} ${count === 1 ? "store" : "stores"}`,
        savingAssignments: "Saving...",
        storeCode: "Store ID",
        storeName: "Store name",
        lineOa: "LINE OA",
        province: "Province",
        readiness: "Readiness",
        currentGreeting: "Greeting message status",
        noGreeting: "—",
        pageSummary: (from: number, to: number, total: number) =>
          `Showing ${from}–${to} of ${total} stores`,
        page: (current: number, total: number) => `Page ${current} / ${total}`,
        previous: "Previous",
        next: "Next",
        saveBulkConfirm: (count: number) =>
          `Use this greeting configuration for ${count} stores? This changes assignments only and does not send any LINE message immediately.`,
        selectedFiltered: (count: number) => `Selected ${count} ready stores from current filters`,
        currentTemplate: "Current template",
        activate: "Activate template",
        deactivate: "Deactivate template",
        archive: "Archive",
        selectPage: "Select ready stores on this page",
      };
    }

    if (language === "zh") {
      return {
        template: "模板",
        createNew: "+ 新建",
        storeUsage: "目标门店",
        assigned: "正在使用",
        ready: "可使用",
        blocked: "资料不完整",
        selected: "已选择",
        selectAllReady: "选择所有可用门店",
        selectFilteredReady: "选择筛选结果中的可用门店",
        clearSelection: "清除选择",
        searchStores: "搜索门店编号、门店名称或 LINE OA",
        allProvinces: "全部省份",
        allStatuses: "全部状态",
        readyOnly: "可使用",
        blockedOnly: "资料不完整",
        resultCount: (count: number) => `找到 ${count} 家门店`,
        saveAssignments: (count: number) => `应用到 ${count} 家门店`,
        savingAssignments: "保存中...",
        storeCode: "门店编号",
        storeName: "门店名称",
        lineOa: "LINE OA",
        province: "省份",
        readiness: "可用状态",
        currentGreeting: "问候消息状态",
        noGreeting: "—",
        pageSummary: (from: number, to: number, total: number) =>
          `显示 ${from}–${to} / 共 ${total} 家门店`,
        page: (current: number, total: number) => `第 ${current} / ${total} 页`,
        previous: "上一页",
        next: "下一页",
        saveBulkConfirm: (count: number) =>
          `确定将此欢迎消息设置应用到 ${count} 家门店吗？此操作只修改门店关联，不会立即发送 LINE 消息。`,
        selectedFiltered: (count: number) => `已从当前筛选结果选择 ${count} 家可用门店`,
        currentTemplate: "当前模板",
        activate: "启用模板",
        deactivate: "停用模板",
        archive: "归档",
        selectPage: "选择本页可用门店",
      };
    }

    return {
      template: "เทมเพลต",
      createNew: "+ สร้างใหม่",
      storeUsage: "ร้านเป้าหมาย",
      assigned: "ใช้งานอยู่",
      ready: "พร้อมใช้งาน",
      blocked: "ข้อมูลไม่ครบ",
      selected: "เลือกแล้ว",
      selectAllReady: "เลือกทุกสาขาที่พร้อม",
      selectFilteredReady: "เลือกผลลัพธ์ที่พร้อม",
      clearSelection: "ล้างการเลือก",
      searchStores: "ค้นหารหัสร้าน ชื่อร้าน หรือ LINE OA",
      allProvinces: "ทุกจังหวัด",
      allStatuses: "ทุกสถานะ",
      readyOnly: "พร้อมใช้งาน",
      blockedOnly: "ข้อมูลไม่ครบ",
      resultCount: (count: number) => `พบ ${count} ร้าน`,
      saveAssignments: (count: number) => `นำไปใช้กับ ${count} ร้าน`,
      savingAssignments: "กำลังบันทึก...",
      storeCode: "รหัสร้าน",
      storeName: "ชื่อร้าน",
      lineOa: "LINE OA",
      province: "จังหวัด",
      readiness: "ความพร้อม",
      currentGreeting: "สถานะข้อความต้อนรับ",
      noGreeting: "—",
      pageSummary: (from: number, to: number, total: number) =>
        `แสดง ${from}–${to} จาก ${total} ร้าน`,
      page: (current: number, total: number) => `หน้า ${current} / ${total}`,
      previous: "ก่อนหน้า",
      next: "ถัดไป",
      saveBulkConfirm: (count: number) =>
        `ใช้ข้อความต้อนรับนี้กับ ${count} ร้าน? การตั้งค่านี้จะเปลี่ยนเฉพาะการผูกสาขา และจะไม่ส่งข้อความ LINE ทันที`,
      selectedFiltered: (count: number) => `เลือก ${count} ร้านที่พร้อมจากผลการค้นหาปัจจุบัน`,
      currentTemplate: "เทมเพลตปัจจุบัน",
      activate: "เปิดใช้งานเทมเพลต",
      deactivate: "ปิดใช้งานเทมเพลต",
      archive: "จัดเก็บ",
      selectPage: "เลือกสาขาที่พร้อมในหน้านี้",
    };
  }, [language]);

  const [templates, setTemplates] = useState<GreetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Template Form State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formName, setFormName] = useState("ข้อความต้อนรับมาตรฐาน");
  const [formDescription, setFormDescription] = useState("");
  const [formSendPolicy, setFormSendPolicy] = useState<GreetingSendPolicy>("FIRST_TIME_ONLY");
  const [formMessages, setFormMessages] = useState<GreetingMessageBlock[]>([
    {
      id: "text-init",
      type: "TEXT",
      textTemplate:
        "สวัสดี คุณ {{user.displayName}}\nนี่คือบัญชีทางการของ {{account.name}}\nขอบคุณที่เป็นเพื่อนกับเรา 🐰\n\nเราจะส่งข่าวสารล่าสุดผ่านบัญชีทางการนี้เป็นระยะ 💌\nเตรียมรับได้เลย! 🎁✨",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [togglingActivation, setTogglingActivation] = useState(false);
  const [showActiveEditModal, setShowActiveEditModal] = useState(false);

  // Store Assignment & Table State
  const [readinessData, setReadinessData] = useState<GreetingReadinessResponse | null>(null);
  const [selectedStoreOaIds, setSelectedStoreOaIds] = useState<string[]>([]);
  const [lastSelectedStoreOaId, setLastSelectedStoreOaId] = useState<string | null>(null);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeReadinessFilter, setStoreReadinessFilter] = useState<ReadinessFilter>("ALL");
  const [storeProvinceFilter, setStoreProvinceFilter] = useState("ALL");
  const [storePage, setStorePage] = useState(1);

  // Live Mobile Preview State
  const [manualPreviewStoreId, setManualPreviewStoreId] = useState<string | null>(null);
  const [previewCustomerName, setPreviewCustomerName] = useState("Sunn");
  const [previewTab, setPreviewTab] = useState<"chat" | "list">("chat");

  const currentTemplate = useMemo(() => {
    if (isCreatingNew) return null;
    return templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId, isCreatingNew]);

  // Dirty State Calculation
  const isDirty = useMemo(() => {
    if (isCreatingNew) return true;
    if (!currentTemplate) return false;
    if (formName.trim() !== (currentTemplate.name || "").trim()) return true;
    if ((formDescription || "").trim() !== (currentTemplate.description || "").trim()) return true;
    if (formSendPolicy !== (currentTemplate.sendPolicy || "FIRST_TIME_ONLY")) return true;
    const origJson = JSON.stringify(currentTemplate.messages || []);
    const currJson = JSON.stringify(formMessages || []);
    return origJson !== currJson;
  }, [isCreatingNew, currentTemplate, formName, formDescription, formSendPolicy, formMessages]);

  const loadTemplateIntoForm = (template: GreetingTemplate) => {
    setIsCreatingNew(false);
    setSelectedTemplateId(template.id);
    setFormName(template.name);
    setFormDescription(template.description || "");
    setFormSendPolicy(template.sendPolicy || "FIRST_TIME_ONLY");
    setFormMessages(
      template.messages && template.messages.length > 0
        ? template.messages
        : [
            {
              id: `text-${Date.now()}`,
              type: "TEXT",
              textTemplate:
                "สวัสดี คุณ {{user.displayName}}\nนี่คือบัญชีทางการของ {{account.name}}\nขอบคุณที่เป็นเพื่อนกับเรา",
            },
          ],
    );
  };

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listGreetingTemplates({});
      setTemplates(response);
      if (response.length > 0 && !selectedTemplateId && !isCreatingNew) {
        loadTemplateIntoForm(response[0]);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to load greeting templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const fetchReadiness = async (templateId?: string) => {
    const targetId = templateId || currentTemplate?.id;
    if (!targetId) {
      setReadinessData(null);
      setSelectedStoreOaIds([]);
      setLastSelectedStoreOaId(null);
      return;
    }

    try {
      const response = await api.getGreetingReadiness(targetId);
      setReadinessData(response);
      const assigned = response.stores
        .filter((store) => store.currentTemplateId === targetId)
        .map((store) => store.lineOfficialAccountId);
      setSelectedStoreOaIds(assigned);
      if (assigned.length > 0) {
        setLastSelectedStoreOaId(assigned[0]);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to load store readiness");
    }
  };

  useEffect(() => {
    if (currentTemplate?.id) {
      void fetchReadiness(currentTemplate.id);
    }
  }, [currentTemplate?.id]);

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedTemplateId(null);
    setFormName("ข้อความต้อนรับใหม่");
    setFormDescription("");
    setFormSendPolicy("FIRST_TIME_ONLY");
    setFormMessages([
      {
        id: `text-${Date.now()}`,
        type: "TEXT",
        textTemplate:
          "สวัสดี คุณ {{user.displayName}}\nนี่คือบัญชีทางการของ {{account.name}}\nขอบคุณที่เป็นเพื่อนกับเรา 🐰",
      },
    ]);
    setReadinessData(null);
    setSelectedStoreOaIds([]);
    setLastSelectedStoreOaId(null);
    setManualPreviewStoreId(null);
  };

  // Preview Store Resolution (Deterministic Following Store Selection)
  const effectivePreviewStoreId = useMemo(() => {
    if (
      manualPreviewStoreId &&
      readinessData?.stores.some((s) => s.lineOfficialAccountId === manualPreviewStoreId)
    ) {
      return manualPreviewStoreId;
    }
    if (lastSelectedStoreOaId && selectedStoreOaIds.includes(lastSelectedStoreOaId)) {
      return lastSelectedStoreOaId;
    }
    if (selectedStoreOaIds.length > 0) {
      return selectedStoreOaIds[selectedStoreOaIds.length - 1];
    }
    if (readinessData && readinessData.stores.length > 0) {
      return readinessData.stores[0].lineOfficialAccountId;
    }
    return "";
  }, [manualPreviewStoreId, lastSelectedStoreOaId, selectedStoreOaIds, readinessData]);

  const isBasedOnSelectedStore = useMemo(() => {
    if (!effectivePreviewStoreId) return false;
    return !manualPreviewStoreId && selectedStoreOaIds.includes(effectivePreviewStoreId);
  }, [effectivePreviewStoreId, manualPreviewStoreId, selectedStoreOaIds]);

  const currentPreviewStore = useMemo(() => {
    const fallback = {
      storeName: "OPPO Central Bangna",
      lineBasicId: "@900ytjrs",
      googleMapsUrl: "https://maps.google.com/?q=OPPO+Central+Bangna",
      accountName: "OPPO Central Bangna",
    };

    if (!readinessData || !effectivePreviewStoreId) return fallback;
    const match = readinessData.stores.find(
      (s) => s.lineOfficialAccountId === effectivePreviewStoreId,
    );
    if (!match) return fallback;

    return {
      storeName: match.storeName || "OPPO Store",
      lineBasicId: match.storeCode || "@oppo_store",
      googleMapsUrl: match.googleMapsUrl || "https://maps.google.com",
      accountName: match.lineOfficialAccountName || match.storeName || "OPPO Store",
    };
  }, [readinessData, effectivePreviewStoreId]);

  // Checkbox toggling in store table
  const handleToggleStoreSelect = (oaId: string) => {
    setSelectedStoreOaIds((prev) => {
      const exists = prev.includes(oaId);
      if (exists) {
        const next = prev.filter((id) => id !== oaId);
        if (lastSelectedStoreOaId === oaId) {
          setLastSelectedStoreOaId(next.length > 0 ? next[next.length - 1] : null);
        }
        return next;
      }
      setLastSelectedStoreOaId(oaId);
      setManualPreviewStoreId(null);
      return [...prev, oaId];
    });
  };

  const handleSelectAllReadyStores = () => {
    if (!readinessData) return;
    const readyIds = readinessData.stores
      .filter((s) => s.readinessStatus === "READY")
      .map((s) => s.lineOfficialAccountId);
    setSelectedStoreOaIds(readyIds);
    if (readyIds.length > 0) {
      setLastSelectedStoreOaId(readyIds[0]);
      setManualPreviewStoreId(null);
    }
  };

  const handleSelectFilteredReadyStores = () => {
    const readyFiltered = filteredStores
      .filter((s) => s.readinessStatus === "READY")
      .map((s) => s.lineOfficialAccountId);
    if (readyFiltered.length === 0) return;

    setSelectedStoreOaIds((prev) => {
      const merged = Array.from(new Set([...prev, ...readyFiltered]));
      return merged;
    });
    setLastSelectedStoreOaId(readyFiltered[0]);
    setManualPreviewStoreId(null);
  };

  const handleClearSelection = () => {
    setSelectedStoreOaIds([]);
    setLastSelectedStoreOaId(null);
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError(t.fieldNamePlaceholder);
      return;
    }

    if (formMessages.length === 0) {
      setError(t.emptyList);
      return;
    }

    // Check if active and assigned to stores
    if (
      currentTemplate &&
      currentTemplate.status === "ACTIVE" &&
      currentTemplate.assignedStoreCount > 0 &&
      isDirty
    ) {
      setShowActiveEditModal(true);
      return;
    }

    executeSave();
  };

  const executeSave = async () => {
    setShowActiveEditModal(false);
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isCreatingNew || !currentTemplate) {
        const created = await api.createGreetingTemplate({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage("บันทึกเทมเพลตสำเร็จ");
        await fetchTemplates();
        loadTemplateIntoForm(created);
      } else {
        const updated = await api.updateGreetingTemplate(currentTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage("บันทึกเทมเพลตสำเร็จ");
        await fetchTemplates();
        loadTemplateIntoForm(updated);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to save greeting template");
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateStatus = async (action: "activate" | "deactivate" | "archive") => {
    if (!currentTemplate) return;
    setTogglingActivation(true);
    setError(null);
    try {
      if (action === "activate") {
        const res = await api.activateGreetingTemplate(currentTemplate.id);
        setSuccessMessage("เปิดใช้งานเทมเพลตเรียบร้อยแล้ว");
        await fetchTemplates();
        loadTemplateIntoForm(res);
      } else if (action === "deactivate") {
        const res = await api.deactivateGreetingTemplate(currentTemplate.id);
        setSuccessMessage("ปิดใช้งานเทมเพลตเรียบร้อยแล้ว");
        await fetchTemplates();
        loadTemplateIntoForm(res);
      } else if (action === "archive") {
        const res = await api.archiveGreetingTemplate(currentTemplate.id);
        setSuccessMessage("จัดเก็บเทมเพลตเรียบร้อยแล้ว");
        await fetchTemplates();
        loadTemplateIntoForm(res);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to change template status");
    } finally {
      setTogglingActivation(false);
    }
  };

  const handleSaveStoreAssignments = async () => {
    if (!currentTemplate) return;
    setSavingAssignments(true);
    setError(null);
    try {
      const response = await api.assignGreetingStores(currentTemplate.id, {
        lineOfficialAccountIds: selectedStoreOaIds,
      });
      setSuccessMessage(t.saveAssignmentsSuccess(response.assignedCount));
      await fetchReadiness(currentTemplate.id);
      await fetchTemplates();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to save store assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  // Helper to render text bubbles with variable pills
  const renderPreviewMessageText = (rawText: string) => {
    if (!rawText) return null;

    const parts = rawText.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (part === "{{user.displayName}}") {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-full bg-[#06c755] text-white text-[11px] font-medium align-middle"
          >
            {previewCustomerName || t.userDisplayName}
          </span>
        );
      }
      if (part === "{{account.name}}") {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-full bg-[#06c755] text-white text-[11px] font-medium align-middle"
          >
            {currentPreviewStore.accountName}
          </span>
        );
      }
      if (part === "{{store.storeName}}") {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-full bg-[#e8f9ee] text-[#06c755] border border-[#06c755]/30 text-[11px] font-medium align-middle"
          >
            {currentPreviewStore.storeName}
          </span>
        );
      }
      if (part === "{{store.googleMapsUrl}}") {
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 text-[11px] font-medium align-middle"
          >
            {currentPreviewStore.googleMapsUrl}
          </span>
        );
      }
      if (part.startsWith("{{") && part.endsWith("}}")) {
        const cleanName = part.slice(2, -2).trim();
        return (
          <span
            key={i}
            className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-300 text-[11px] font-mono align-middle"
          >
            {cleanName}
          </span>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  const storeProvinces = useMemo(() => {
    if (!readinessData) return [];
    const set = new Set<string>();
    for (const store of readinessData.stores) {
      if (store.province?.trim()) set.add(store.province.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "th"));
  }, [readinessData]);

  const filteredStores = useMemo(() => {
    if (!readinessData) return [];
    const query = storeSearch.trim().toLowerCase();

    return readinessData.stores.filter((store) => {
      if (storeReadinessFilter !== "ALL" && store.readinessStatus !== storeReadinessFilter) {
        return false;
      }
      if (storeProvinceFilter !== "ALL" && store.province !== storeProvinceFilter) {
        return false;
      }
      if (!query) return true;

      const codeMatch = (store.storeCode || "").toLowerCase().includes(query);
      const nameMatch = (store.storeName || "").toLowerCase().includes(query);
      const lineMatch = (store.lineOfficialAccountName || "").toLowerCase().includes(query);
      const provMatch = (store.province || "").toLowerCase().includes(query);
      return codeMatch || nameMatch || lineMatch || provMatch;
    });
  }, [readinessData, storeSearch, storeReadinessFilter, storeProvinceFilter]);

  useEffect(() => {
    setStorePage(1);
  }, [storeSearch, storeReadinessFilter, storeProvinceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / STORE_PAGE_SIZE));
  const paginatedStores = useMemo(() => {
    const start = (storePage - 1) * STORE_PAGE_SIZE;
    return filteredStores.slice(start, start + STORE_PAGE_SIZE);
  }, [filteredStores, storePage]);

  const assignedCount = readinessData?.assignedStores || currentTemplate?.assignedStoreCount || 0;
  const readyCount = readinessData?.readyStores || 0;
  const blockedCount = readinessData?.blockedStores || 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-white text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Global Notifications */}
        {error && (
          <div className="p-3.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between shadow-2xs">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-800 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Header Section matching LINE OA Manager */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {t.headerTitle}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded border border-gray-200 cursor-default">
                ⓘ Tips
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {t.headerSubtitle}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {t.headerHelp}
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Template Selector */}
            {templates.length > 0 && (
              <div className="relative inline-block">
                <select
                  value={isCreatingNew ? "new" : currentTemplate?.id || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "new") {
                      handleStartNew();
                    } else {
                      const match = templates.find((tmp) => tmp.id === val);
                      if (match) loadTemplateIntoForm(match);
                    }
                  }}
                  className="px-3 py-2 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#06c755] cursor-pointer shadow-2xs"
                >
                  {templates.map((tmp) => (
                    <option key={tmp.id} value={tmp.id}>
                      {tmp.name} ({tmp.status})
                    </option>
                  ))}
                  <option value="new">+ {t.createTemplateButton}</option>
                </select>
              </div>
            )}

            {/* Clear Status Badge */}
            {currentTemplate && !isCreatingNew && (
              <div className="flex items-center gap-1.5">
                {currentTemplate.status === "ACTIVE" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-[#06c755] animate-pulse"></span>
                    {t.statusActiveBadge(currentTemplate.assignedStoreCount, currentTemplate.version)}
                  </span>
                ) : currentTemplate.status === "DRAFT" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {t.statusDraftBadge(currentTemplate.version)}
                  </span>
                ) : currentTemplate.status === "INACTIVE" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    {t.statusInactiveBadge(currentTemplate.assignedStoreCount, currentTemplate.version)}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                    {t.statusArchivedBadge(currentTemplate.version)}
                  </span>
                )}

                {/* Activation Toggle Buttons */}
                {currentTemplate.status !== "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => void handleTemplateStatus("activate")}
                    disabled={togglingActivation}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-2xs transition"
                  >
                    {ui.activate}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleTemplateStatus("deactivate")}
                    disabled={togglingActivation}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition"
                  >
                    {ui.deactivate}
                  </button>
                )}

                {currentTemplate.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    onClick={() => void handleTemplateStatus("archive")}
                    disabled={togglingActivation}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-500 shadow-2xs transition"
                  >
                    {ui.archive}
                  </button>
                )}
              </div>
            )}

            {/* Dirty State Indicator & Save Button */}
            <div className="flex items-center gap-2">
              {isDirty && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 animate-fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {t.unsavedChanges}
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className="inline-flex items-center justify-center px-6 py-2 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] active:bg-[#049b42] text-white shadow-xs transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? t.uploading : t.saveTemplate}
              </button>
            </div>
          </div>
        </div>

        {/* 2. Compact Native OA Manager Duplication Notice */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-md bg-amber-50/80 border border-amber-200/80 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{t.oaManagerWarning}</span>
          </div>
          <a
            href="https://manager.line.biz/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-900 font-medium hover:underline shrink-0 ml-3"
          >
            {t.openLineOaManager}
          </a>
        </div>

        {/* 3. Sending Restrictions Section */}
        <div className="pt-2 pb-6 border-b border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900">
            {t.sendingRestrictions}
          </h2>

          <div className="flex items-start gap-2.5">
            <input
              id="send-policy-checkbox"
              type="checkbox"
              checked={formSendPolicy === "FIRST_TIME_ONLY"}
              onChange={(e) =>
                setFormSendPolicy(e.target.checked ? "FIRST_TIME_ONLY" : "ADD_AND_UNBLOCK")
              }
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#06c755] focus:ring-[#06c755] cursor-pointer"
            />
            <div>
              <label
                htmlFor="send-policy-checkbox"
                className="text-xs font-semibold text-gray-900 cursor-pointer"
              >
                {t.onlySendFirstTime}
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                {t.onlySendFirstTimeHelp}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Message Content & Preview Section (68% / 32% Layout) */}
        <div className="pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {t.messageContent}
            </h2>

            {/* Template Name Input field */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">{t.fieldName}:</span>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t.fieldNamePlaceholder}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded focus:border-[#06c755] focus:outline-none w-56 text-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Message Sequence Editor */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <GreetingMessageBuilder
                messages={formMessages}
                disabled={saving}
                t={t}
                onChange={setFormMessages}
              />

              {/* Bottom Secondary Save Button */}
              <div className="pt-4 flex items-center justify-between">
                <div>
                  {isDirty && (
                    <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      {t.unsavedChanges}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-8 py-2.5 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] active:bg-[#049b42] text-white shadow-xs transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? t.uploading : t.saveTemplate}
                </button>
              </div>
            </div>

            {/* Right Column: Sticky Live Mobile Preview following store selection */}
            <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 space-y-3">
              <div className="w-full max-w-[340px] mx-auto rounded-xl border border-gray-300 bg-[#2c323b] overflow-hidden shadow-md">
                {/* Dark Preview Header Bar */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#20242b] text-white text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>▾</span>
                    <span>{t.previewTitle}</span>
                    <span className="text-gray-400 text-[11px]">ⓘ</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-[11px] font-mono">📱</span>
                  </div>
                </div>

                {/* Tabs: Chat screen | Chat list */}
                <div className="flex border-b border-gray-200 bg-white text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("chat")}
                    className={`flex-1 py-2 text-center transition ${
                      previewTab === "chat"
                        ? "text-gray-900 border-b-2 border-gray-900 font-bold"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {t.chatScreen}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("list")}
                    className={`flex-1 py-2 text-center transition ${
                      previewTab === "list"
                        ? "text-[#06c755] border-b-2 border-[#06c755] font-bold"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {t.chatList}
                  </button>
                </div>

                {/* Simulated LINE Mobile Chat Screen Wallpaper */}
                <div className="min-h-[460px] max-h-[520px] overflow-y-auto p-3.5 bg-[#749ac9] space-y-3">
                  {/* Account Name Header Bubble */}
                  <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs border border-white/20">
                      oppo
                    </div>

                    <div className="flex-1 space-y-2">
                      {/* Account Display Name */}
                      <p className="text-[11px] text-white/90 font-medium drop-shadow-xs">
                        {currentPreviewStore.accountName}
                      </p>

                      {/* Stacked Message Bubbles */}
                      {formMessages.map((block, idx) => {
                        if (block.type === "IMAGE") {
                          const imgUrl = block.imageUrl || block.previewUrl;
                          return (
                            <div
                              key={block.id || idx}
                              className="relative inline-block max-w-[220px] rounded-2xl overflow-hidden shadow-xs border border-black/10 bg-white"
                            >
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt="Preview image"
                                  className="w-full h-auto max-h-[160px] object-cover"
                                />
                              ) : (
                                <div className="p-4 bg-gray-100 text-center text-xs text-gray-400 font-medium">
                                  🖼️ [ {t.image} ]
                                </div>
                              )}
                            </div>
                          );
                        }

                        const text = (block.textTemplate || "").trim();
                        return (
                          <div
                            key={block.id || idx}
                            className="relative max-w-[230px] rounded-2xl bg-white p-3 text-xs text-gray-900 shadow-xs leading-relaxed break-words"
                            style={{
                              borderTopLeftRadius: "4px",
                            }}
                          >
                            {text ? (
                              renderPreviewMessageText(text)
                            ) : (
                              <span className="text-gray-400 italic">
                                ({t.textBlockPlaceholder.slice(0, 20)}...)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Preview Controls Area */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-2.5 text-xs">
                  {readinessData && readinessData.stores.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-gray-600">
                          {t.previewFor}
                        </label>
                        {isBasedOnSelectedStore && (
                          <span className="text-[10px] font-semibold text-[#06c755] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ✓ {t.basedOnSelectedStore}
                          </span>
                        )}
                      </div>
                      <select
                        value={effectivePreviewStoreId}
                        onChange={(e) => setManualPreviewStoreId(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800 cursor-pointer"
                      >
                        {readinessData.stores.map((s) => (
                          <option key={s.lineOfficialAccountId} value={s.lineOfficialAccountId}>
                            {s.storeName} ({s.readinessStatus === "READY" ? "พร้อม" : "ข้อมูลไม่ครบ"})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      {t.previewCustomerNameLabel}
                    </label>
                    <input
                      type="text"
                      value={previewCustomerName}
                      onChange={(e) => setPreviewCustomerName(e.target.value)}
                      placeholder={t.previewCustomerNamePlaceholder}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Store Assignments Section directly visible matching Rich Menu targeting */}
        <section
          id="greeting-store-targeting"
          data-testid="greeting-store-targeting"
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-bold">{ui.storeUsage}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{ui.assigned} {assignedCount}</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{ui.ready} {readyCount}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{ui.blocked} {blockedCount}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{ui.selected} {selectedStoreOaIds.length}</span>
              </div>
            </div>

            {currentTemplate && readinessData && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-500">{ui.selected} <strong className="text-gray-900">{selectedStoreOaIds.length}</strong></span>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleSelectAllReadyStores}
                  disabled={readyCount === 0}
                  className="font-semibold text-[#059669] hover:underline disabled:opacity-40"
                >
                  {ui.selectAllReady}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="font-medium text-gray-600 hover:underline"
                >
                  {ui.clearSelection}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleSaveStoreAssignments}
                  disabled={savingAssignments || selectedStoreOaIds.length === 0}
                  className="rounded bg-[#06c755] hover:bg-[#05b34c] px-3.5 py-1.5 font-semibold text-white shadow-xs transition disabled:opacity-40"
                >
                  {savingAssignments ? ui.savingAssignments : ui.saveAssignments(selectedStoreOaIds.length)}
                </button>
              </div>
            )}
          </div>

          {!currentTemplate && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
              {t.storeAssignmentDesc}
            </div>
          )}

          {currentTemplate && readinessData && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs">
              <div className="grid gap-3 border-b border-gray-200 p-4 lg:grid-cols-[minmax(260px,1fr)_200px_170px_auto] lg:items-center">
                <input
                  type="search"
                  value={storeSearch}
                  onChange={(event) => setStoreSearch(event.target.value)}
                  placeholder={ui.searchStores}
                  className="h-9 rounded border border-gray-300 px-3 text-xs outline-none focus:border-[#06c755]"
                />
                <select
                  value={storeProvinceFilter}
                  onChange={(event) => setStoreProvinceFilter(event.target.value)}
                  className="h-9 rounded border border-gray-300 bg-white px-3 text-xs"
                >
                  <option value="ALL">{ui.allProvinces}</option>
                  {storeProvinces.map((province) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
                <div className="inline-flex h-9 overflow-hidden rounded border border-gray-300 bg-white">
                  {([
                    ["ALL", ui.allStatuses],
                    ["READY", ui.readyOnly],
                    ["BLOCKED", ui.blockedOnly],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStoreReadinessFilter(value)}
                      className={`px-3 text-xs font-medium ${
                        storeReadinessFilter === value
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="text-right text-xs text-gray-500">{ui.resultCount(filteredStores.length)}</div>
              </div>

              <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-medium text-gray-700">{ui.selected} {selectedStoreOaIds.length}</span>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleSelectFilteredReadyStores}
                    className="font-semibold text-[#059669] hover:underline"
                  >
                    {ui.selectFilteredReady}
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllReadyStores}
                    className="font-semibold text-[#059669] hover:underline"
                  >
                    {ui.selectAllReady}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="font-medium text-gray-600 hover:underline"
                  >
                    {ui.clearSelection}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-96 overflow-y-auto border-t border-gray-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">{t.colSelect}</th>
                      <th className="p-2.5">{ui.storeName}</th>
                      <th className="p-2.5">{ui.lineOa}</th>
                      <th className="p-2.5">{ui.province}</th>
                      <th className="p-2.5">{ui.readiness}</th>
                      <th className="p-2.5">{t.colGreetingStatus || ui.currentGreeting}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedStores.map((st) => {
                      const isSelected = selectedStoreOaIds.includes(st.lineOfficialAccountId);
                      const isReady = st.readinessStatus === "READY";

                      // Determine current greeting status for this store
                      let statusBadge = null;
                      let statusText = null;

                      if (st.currentTemplateId === currentTemplate?.id) {
                        if (currentTemplate.status === "ACTIVE") {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#06c755]"></span>
                              ใช้งานอยู่
                            </span>
                          );
                          statusText = `${currentTemplate.name} · v${currentTemplate.version}`;
                        } else if (currentTemplate.status === "DRAFT") {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              ผูกเทมเพลตแล้ว แต่ยังเป็นแบบร่าง
                            </span>
                          );
                          statusText = `${currentTemplate.name} · v${currentTemplate.version}`;
                        } else if (currentTemplate.status === "INACTIVE") {
                          statusBadge = (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              ปิดใช้งาน
                            </span>
                          );
                          statusText = `${currentTemplate.name} · v${currentTemplate.version}`;
                        }
                      } else if (st.currentTemplateId) {
                        const otherTemplate = templates.find((tmp) => tmp.id === st.currentTemplateId);
                        if (otherTemplate) {
                          statusBadge = (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                otherTemplate.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-700 border border-gray-200"
                              }`}
                            >
                              {otherTemplate.status === "ACTIVE" ? "● ใช้งานอยู่" : "○ ปิดใช้งาน"}
                            </span>
                          );
                          statusText = `${otherTemplate.name} · v${otherTemplate.version}`;
                        } else {
                          statusText = st.currentTemplateName || "เทมเพลตอื่น";
                        }
                      } else {
                        statusBadge = <span className="text-gray-400 font-medium">—</span>;
                        statusText = t.noGreetingAssigned;
                      }

                      return (
                        <tr
                          key={st.lineOfficialAccountId}
                          onClick={() => handleToggleStoreSelect(st.lineOfficialAccountId)}
                          className={`hover:bg-gray-50 cursor-pointer transition ${
                            isSelected ? "bg-emerald-50/40" : ""
                          }`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStoreSelect(st.lineOfficialAccountId)}
                              className="h-4 w-4 rounded border-gray-300 text-[#06c755] focus:ring-[#06c755] cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-medium text-gray-900">
                            {st.storeName}
                            {st.storeCode && (
                              <span className="ml-1 text-[11px] text-gray-400 font-mono">
                                ({st.storeCode})
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-gray-500 font-mono">
                            {st.lineOfficialAccountName}
                          </td>
                          <td className="p-2.5 text-gray-500">
                            {st.province || "-"}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                                isReady
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {isReady ? t.statusReady : t.statusBlocked}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <div className="space-y-0.5">
                              {statusBadge}
                              {statusText && (
                                <p className="text-[11px] text-gray-500">
                                  {statusText}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600">
                  <span>
                    {ui.pageSummary(
                      (storePage - 1) * STORE_PAGE_SIZE + 1,
                      Math.min(storePage * STORE_PAGE_SIZE, filteredStores.length),
                      filteredStores.length,
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStorePage((page) => Math.max(1, page - 1))}
                      disabled={storePage <= 1}
                      className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                    >
                      {ui.previous}
                    </button>
                    <span className="font-medium text-gray-700">
                      {ui.page(storePage, totalPages)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStorePage((page) => Math.min(totalPages, page + 1))}
                      disabled={storePage >= totalPages}
                      className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40"
                    >
                      {ui.next}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Active Edit Confirmation Warning Modal */}
      {showActiveEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              {t.activeEditWarningTitle}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t.activeEditWarningMessage(currentTemplate?.assignedStoreCount || 0)}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowActiveEditModal(false)}
                className="px-4 py-2 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
              >
                {t.activeEditWarningCancel}
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="px-4 py-2 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] text-white shadow-xs"
              >
                {t.activeEditWarningConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
