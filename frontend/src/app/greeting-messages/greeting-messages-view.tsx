"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GreetingMessageBlock,
  GreetingReadinessResponse,
  GreetingSendPolicy,
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
        storeUsage: "Store usage",
        assigned: "Assigned",
        ready: "Ready",
        blocked: "Incomplete",
        selected: "Selected",
        manageStores: "Manage stores",
        hideStores: "Hide stores",
        selectAllReady: "Select all ready stores",
        selectFilteredReady: "Select filtered ready stores",
        clearSelection: "Clear selection",
        searchStores: "Search store code, store name, or LINE OA",
        allProvinces: "All provinces",
        allStatuses: "All statuses",
        readyOnly: "Ready",
        blockedOnly: "Incomplete",
        resultCount: (count: number) => `${count} stores found`,
        saveAssignments: (count: number) => `Save usage for ${count} stores`,
        savingAssignments: "Saving...",
        storeCode: "Store ID",
        storeName: "Store name",
        lineOa: "LINE OA",
        province: "Province",
        readiness: "Readiness",
        currentGreeting: "Current greeting",
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
        activate: "Activate",
        deactivate: "Deactivate",
        archive: "Archive",
        selectPage: "Select ready stores on this page",
      };
    }

    if (language === "zh") {
      return {
        template: "模板",
        createNew: "+ 新建",
        storeUsage: "门店使用范围",
        assigned: "正在使用",
        ready: "可使用",
        blocked: "资料不完整",
        selected: "已选择",
        manageStores: "管理门店",
        hideStores: "隐藏门店",
        selectAllReady: "选择所有可用门店",
        selectFilteredReady: "选择筛选结果中的可用门店",
        clearSelection: "清除选择",
        searchStores: "搜索门店编号、门店名称或 LINE OA",
        allProvinces: "全部省份",
        allStatuses: "全部状态",
        readyOnly: "可使用",
        blockedOnly: "资料不完整",
        resultCount: (count: number) => `找到 ${count} 家门店`,
        saveAssignments: (count: number) => `保存 ${count} 家门店的使用设置`,
        savingAssignments: "保存中...",
        storeCode: "门店编号",
        storeName: "门店名称",
        lineOa: "LINE OA",
        province: "省份",
        readiness: "可用状态",
        currentGreeting: "当前欢迎消息",
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
        activate: "启用",
        deactivate: "停用",
        archive: "归档",
        selectPage: "选择本页可用门店",
      };
    }

    return {
      template: "เทมเพลต",
      createNew: "+ สร้างใหม่",
      storeUsage: "การใช้งานกับสาขา",
      assigned: "ใช้งานอยู่",
      ready: "พร้อมใช้งาน",
      blocked: "ข้อมูลไม่ครบ",
      selected: "เลือกแล้ว",
      manageStores: "จัดการสาขา",
      hideStores: "ซ่อนรายชื่อร้าน",
      selectAllReady: "เลือกทุกสาขาที่พร้อม",
      selectFilteredReady: "เลือกผลลัพธ์ที่พร้อม",
      clearSelection: "ล้างการเลือก",
      searchStores: "ค้นหารหัสร้าน ชื่อร้าน หรือ LINE OA",
      allProvinces: "ทุกจังหวัด",
      allStatuses: "ทุกสถานะ",
      readyOnly: "พร้อมใช้งาน",
      blockedOnly: "ข้อมูลไม่ครบ",
      resultCount: (count: number) => `พบ ${count} ร้าน`,
      saveAssignments: (count: number) => `บันทึกการใช้งาน ${count} ร้าน`,
      savingAssignments: "กำลังบันทึก...",
      storeCode: "รหัสร้าน",
      storeName: "ชื่อร้าน",
      lineOa: "LINE OA",
      province: "จังหวัด",
      readiness: "ความพร้อม",
      currentGreeting: "ข้อความต้อนรับปัจจุบัน",
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
      activate: "เปิดใช้งาน",
      deactivate: "ปิดใช้งาน",
      archive: "จัดเก็บ",
      selectPage: "เลือกสาขาที่พร้อมในหน้านี้",
    };
  }, [language]);

  const [templates, setTemplates] = useState<GreetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
  const [showActiveEditModal, setShowActiveEditModal] = useState(false);

  const [showStoreSection, setShowStoreSection] = useState(false);
  const [readinessData, setReadinessData] = useState<GreetingReadinessResponse | null>(null);
  const [selectedStoreOaIds, setSelectedStoreOaIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [storeReadinessFilter, setStoreReadinessFilter] = useState<ReadinessFilter>("ALL");
  const [storeProvinceFilter, setStoreProvinceFilter] = useState("ALL");
  const [storePage, setStorePage] = useState(1);

  const [previewStoreId, setPreviewStoreId] = useState("");
  const [previewCustomerName, setPreviewCustomerName] = useState("Sunn");
  const [previewTab, setPreviewTab] = useState<"chat" | "list">("chat");

  const currentTemplate = useMemo(() => {
    if (isCreatingNew) return null;
    return templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId, isCreatingNew]);

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
      return;
    }

    try {
      const response = await api.getGreetingReadiness(targetId);
      setReadinessData(response);
      setSelectedStoreOaIds(
        response.stores
          .filter((store) => store.currentTemplateId === targetId)
          .map((store) => store.lineOfficialAccountId),
      );
      if (!previewStoreId && response.stores.length > 0) {
        setPreviewStoreId(response.stores[0].lineOfficialAccountId);
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
        setSuccessMessage(t.saveChanges);
        await fetchTemplates();
        loadTemplateIntoForm(created);
      } else {
        const updated = await api.updateGreetingTemplate(currentTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage(t.saveChanges);
        await fetchTemplates();
        loadTemplateIntoForm(updated);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Failed to save greeting template");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) {
      setError(t.fieldNamePlaceholder);
      return;
    }
    if (formMessages.length === 0) {
      setError(t.emptyList);
      return;
    }
    if (currentTemplate?.status === "ACTIVE" && currentTemplate.assignedStoreCount > 0) {
      setShowActiveEditModal(true);
      return;
    }
    void executeSave();
  };

  const handleTemplateStatus = async (action: "activate" | "deactivate" | "archive") => {
    if (!currentTemplate) return;
    if (action === "archive" && !window.confirm(t.archiveConfirm)) return;

    setError(null);
    try {
      const updated =
        action === "activate"
          ? await api.activateGreetingTemplate(currentTemplate.id)
          : action === "deactivate"
            ? await api.deactivateGreetingTemplate(currentTemplate.id)
            : await api.archiveGreetingTemplate(currentTemplate.id);
      await fetchTemplates();
      loadTemplateIntoForm(updated);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : `Failed to ${action} template`);
    }
  };

  const handleSelectAllReadyStores = () => {
    if (!readinessData) return;
    setSelectedStoreOaIds(
      readinessData.stores
        .filter((store) => store.readinessStatus === "READY")
        .map((store) => store.lineOfficialAccountId),
    );
  };

  const handleToggleStoreSelect = (lineOfficialAccountId: string) => {
    const store = readinessData?.stores.find(
      (item) => item.lineOfficialAccountId === lineOfficialAccountId,
    );
    if (!store) return;

    setSelectedStoreOaIds((previous) => {
      const selected = previous.includes(lineOfficialAccountId);
      if (!selected && store.readinessStatus !== "READY") return previous;
      return selected
        ? previous.filter((id) => id !== lineOfficialAccountId)
        : [...previous, lineOfficialAccountId];
    });
  };

  const storeProvinces = useMemo(() => {
    if (!readinessData) return [];
    return Array.from(
      new Set(
        readinessData.stores
          .map((store) => store.province?.trim())
          .filter((province): province is string => Boolean(province)),
      ),
    ).sort((a, b) => a.localeCompare(b, language === "th" ? "th" : undefined));
  }, [readinessData, language]);

  const filteredStores = useMemo(() => {
    if (!readinessData) return [];
    const query = storeSearch.trim().toLowerCase();

    return readinessData.stores.filter((store) => {
      const matchesSearch =
        !query ||
        store.storeName.toLowerCase().includes(query) ||
        store.lineOfficialAccountName.toLowerCase().includes(query) ||
        Boolean(store.storeCode?.toLowerCase().includes(query)) ||
        Boolean(store.province?.toLowerCase().includes(query));
      const matchesReadiness =
        storeReadinessFilter === "ALL" || store.readinessStatus === storeReadinessFilter;
      const matchesProvince =
        storeProvinceFilter === "ALL" || store.province === storeProvinceFilter;
      return matchesSearch && matchesReadiness && matchesProvince;
    });
  }, [readinessData, storeSearch, storeReadinessFilter, storeProvinceFilter]);

  const totalStorePages = Math.max(1, Math.ceil(filteredStores.length / STORE_PAGE_SIZE));
  const paginatedStores = useMemo(() => {
    const start = (storePage - 1) * STORE_PAGE_SIZE;
    return filteredStores.slice(start, start + STORE_PAGE_SIZE);
  }, [filteredStores, storePage]);

  useEffect(() => {
    setStorePage(1);
  }, [storeSearch, storeReadinessFilter, storeProvinceFilter]);

  useEffect(() => {
    if (storePage > totalStorePages) setStorePage(totalStorePages);
  }, [storePage, totalStorePages]);

  const handleSelectFilteredReadyStores = () => {
    const ids = filteredStores
      .filter((store) => store.readinessStatus === "READY")
      .map((store) => store.lineOfficialAccountId);
    setSelectedStoreOaIds((previous) => Array.from(new Set([...previous, ...ids])));
    setSuccessMessage(ui.selectedFiltered(ids.length));
  };

  const currentPageReadyIds = paginatedStores
    .filter((store) => store.readinessStatus === "READY")
    .map((store) => store.lineOfficialAccountId);
  const allCurrentPageReadySelected =
    currentPageReadyIds.length > 0 && currentPageReadyIds.every((id) => selectedStoreOaIds.includes(id));

  const handleToggleCurrentPageReady = () => {
    setSelectedStoreOaIds((previous) => {
      if (allCurrentPageReadySelected) {
        const pageIds = new Set(currentPageReadyIds);
        return previous.filter((id) => !pageIds.has(id));
      }
      return Array.from(new Set([...previous, ...currentPageReadyIds]));
    });
  };

  const handleSaveStoreAssignments = async () => {
    if (!currentTemplate) return;
    if (!window.confirm(ui.saveBulkConfirm(selectedStoreOaIds.length))) return;

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

  const currentPreviewStore = useMemo(() => {
    const fallback = {
      storeName: "OPPO Central Bangna",
      googleMapsUrl: "https://maps.google.com",
      accountName: "OPPO Central Bangna",
    };
    if (!readinessData || !previewStoreId) return fallback;
    const match = readinessData.stores.find((store) => store.lineOfficialAccountId === previewStoreId);
    if (!match) return fallback;
    return {
      storeName: match.storeName || "OPPO Store",
      googleMapsUrl: match.googleMapsUrl || "https://maps.google.com",
      accountName: match.lineOfficialAccountName || match.storeName || "OPPO Store",
    };
  }, [readinessData, previewStoreId]);

  const renderPreviewMessageText = (rawText: string) => {
    const parts = rawText.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, index) => {
      let value: string | null = null;
      if (part === "{{user.displayName}}") value = previewCustomerName || t.userDisplayName;
      if (part === "{{account.name}}") value = currentPreviewStore.accountName;
      if (part === "{{store.storeName}}") value = currentPreviewStore.storeName;
      if (part === "{{store.googleMapsUrl}}") value = currentPreviewStore.googleMapsUrl;

      if (value !== null) {
        return (
          <span
            key={`${part}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-full bg-[#06c755] px-1.5 py-0.5 text-[11px] font-medium text-white align-middle"
          >
            {value}
          </span>
        );
      }

      if (part.startsWith("{{") && part.endsWith("}}")) {
        return (
          <span
            key={`${part}-${index}`}
            className="mx-0.5 inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700 align-middle"
          >
            {part.slice(2, -2)}
          </span>
        );
      }
      return (
        <span key={`${index}-${part.slice(0, 8)}`} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  };

  const assignedCount = readinessData?.assignedStores || 0;
  const readyCount = readinessData?.readyStores || 0;
  const blockedCount = readinessData?.blockedStores || 0;
  const pageFrom = filteredStores.length === 0 ? 0 : (storePage - 1) * STORE_PAGE_SIZE + 1;
  const pageTo = Math.min(storePage * STORE_PAGE_SIZE, filteredStores.length);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-bold">✕</button>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <span>{successMessage}</span>
            <button type="button" onClick={() => setSuccessMessage(null)} className="font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{t.headerTitle}</h1>
              <span className="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">ⓘ Tips</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{t.headerSubtitle}</p>
            <p className="mt-1 text-xs text-gray-400">{t.headerHelp}</p>
          </div>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            className="rounded bg-[#06c755] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#05b34c] disabled:opacity-50"
          >
            {saving ? t.uploading : t.saveChanges}
          </button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">{ui.template}:</span>
            <select
              value={isCreatingNew ? "__new__" : currentTemplate?.id || ""}
              onChange={(event) => {
                if (event.target.value === "__new__") {
                  handleStartNew();
                  return;
                }
                const next = templates.find((template) => template.id === event.target.value);
                if (next) loadTemplateIntoForm(next);
              }}
              disabled={loading}
              className="min-w-56 rounded border border-gray-300 bg-white px-3 py-2 text-xs"
            >
              {isCreatingNew && <option value="__new__">{formName}</option>}
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.status}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStartNew}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50"
            >
              {ui.createNew}
            </button>
            {currentTemplate && !isCreatingNew && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                {ui.currentTemplate}: {currentTemplate.status} · v{currentTemplate.version}
              </span>
            )}
          </div>

          {currentTemplate && !isCreatingNew && (
            <div className="flex flex-wrap gap-2">
              {currentTemplate.status !== "ACTIVE" ? (
                <button
                  type="button"
                  onClick={() => void handleTemplateStatus("activate")}
                  className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                >
                  {ui.activate}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleTemplateStatus("deactivate")}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {ui.deactivate}
                </button>
              )}
              {currentTemplate.status !== "ARCHIVED" && (
                <button
                  type="button"
                  onClick={() => void handleTemplateStatus("archive")}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500"
                >
                  {ui.archive}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span>⚠ {t.oaManagerWarning}</span>
          <a
            href="https://manager.line.biz/"
            target="_blank"
            rel="noreferrer"
            className="ml-4 shrink-0 font-semibold hover:underline"
          >
            {t.openLineOaManager}
          </a>
        </div>

        <form onSubmit={handleSaveClick} className="space-y-6">
          <section className="border-b border-gray-200 pb-6">
            <h2 className="text-base font-bold">{t.sendingRestrictions}</h2>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={formSendPolicy === "FIRST_TIME_ONLY"}
                onChange={(event) =>
                  setFormSendPolicy(event.target.checked ? "FIRST_TIME_ONLY" : "ADD_AND_UNBLOCK")
                }
                className="mt-0.5 h-4 w-4 accent-[#06c755]"
              />
              <span>
                <span className="block text-xs font-semibold">{t.onlySendFirstTime}</span>
                <span className="mt-1 block text-xs text-gray-500">{t.onlySendFirstTimeHelp}</span>
              </span>
            </label>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="text-base font-bold">{t.messageContent}</h2>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <span>{t.fieldName}</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  className="w-64 rounded border border-gray-300 px-3 py-2 text-xs text-gray-900"
                />
              </label>
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="space-y-4">
                <GreetingMessageBuilder messages={formMessages} t={t} onChange={setFormMessages} />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-[#06c755] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#05b34c] disabled:opacity-50"
                  >
                    {saving ? t.uploading : t.saveChanges}
                  </button>
                </div>
              </div>

              <aside className="h-fit overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm lg:sticky lg:top-20">
                <div className="flex items-center justify-between bg-[#20252d] px-3 py-2 text-xs font-semibold text-white">
                  <span>⌄ {t.preview} ⓘ</span>
                  <span>↻</span>
                </div>
                <div className="flex border-b border-gray-200 bg-white text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("chat")}
                    className={`flex-1 py-2 ${previewTab === "chat" ? "border-b-2 border-[#06c755] font-semibold" : "text-gray-500"}`}
                  >
                    {t.chatScreen}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("list")}
                    className={`flex-1 py-2 ${previewTab === "list" ? "border-b-2 border-[#06c755] font-semibold" : "text-gray-500"}`}
                  >
                    {t.chatList}
                  </button>
                </div>
                <div className="min-h-[440px] max-h-[540px] space-y-3 overflow-y-auto bg-[#749ac9] p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">oppo</div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-[11px] font-medium text-white/90">{currentPreviewStore.accountName}</p>
                      {formMessages.map((block, index) => {
                        if (block.type === "IMAGE") {
                          const source = block.imageUrl || block.previewUrl;
                          return (
                            <div key={block.id || index} className="max-w-[220px] overflow-hidden rounded-2xl bg-white shadow-sm">
                              {source ? (
                                <img src={source} alt="Greeting preview" className="max-h-[190px] w-full object-cover" />
                              ) : (
                                <div className="p-6 text-center text-xs text-gray-400">🖼 {t.image}</div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={block.id || index}
                            className="max-w-[235px] rounded-2xl rounded-tl bg-white p-3 text-xs leading-relaxed text-gray-900 shadow-sm"
                          >
                            {block.textTemplate?.trim()
                              ? renderPreviewMessageText(block.textTemplate)
                              : <span className="text-gray-400">{t.textBlockPlaceholder}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 border-t border-gray-200 bg-gray-50 p-3 text-xs">
                  {readinessData && readinessData.stores.length > 0 && (
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-gray-600">{t.sampleStore}</span>
                      <select
                        value={previewStoreId}
                        onChange={(event) => setPreviewStoreId(event.target.value)}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                      >
                        {readinessData.stores.map((store) => (
                          <option key={store.lineOfficialAccountId} value={store.lineOfficialAccountId}>
                            {store.storeName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-gray-600">{t.sampleUser}</span>
                    <input
                      type="text"
                      value={previewCustomerName}
                      onChange={(event) => setPreviewCustomerName(event.target.value)}
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs"
                    />
                  </label>
                </div>
              </aside>
            </div>
          </section>
        </form>

        <section className="space-y-4 border-t border-gray-200 pb-12 pt-8">
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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllReadyStores}
                disabled={!currentTemplate || readyCount === 0}
                className="rounded border border-[#06c755] bg-white px-3.5 py-2 text-xs font-semibold text-[#06c755] hover:bg-emerald-50 disabled:opacity-40"
              >
                {ui.selectAllReady}
              </button>
              <button
                type="button"
                onClick={() => setShowStoreSection((value) => !value)}
                disabled={!currentTemplate}
                className="rounded bg-[#06c755] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#05b34c] disabled:opacity-40"
              >
                {showStoreSection ? ui.hideStores : ui.manageStores}
              </button>
            </div>
          </div>

          {!currentTemplate && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500">
              {t.storeAssignmentDesc}
            </div>
          )}

          {showStoreSection && currentTemplate && readinessData && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                <select
                  value={storeReadinessFilter}
                  onChange={(event) => setStoreReadinessFilter(event.target.value as ReadinessFilter)}
                  className="h-9 rounded border border-gray-300 bg-white px-3 text-xs"
                >
                  <option value="ALL">{ui.allStatuses}</option>
                  <option value="READY">{ui.readyOnly}</option>
                  <option value="BLOCKED">{ui.blockedOnly}</option>
                </select>
                <div className="text-right text-xs text-gray-500">{ui.resultCount(filteredStores.length)}</div>
              </div>

              <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSelectFilteredReadyStores}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {ui.selectFilteredReady}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStoreOaIds([])}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                  >
                    {ui.clearSelection}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveStoreAssignments()}
                  disabled={savingAssignments}
                  className="rounded bg-[#06c755] px-4 py-2 text-xs font-semibold text-white hover:bg-[#05b34c] disabled:opacity-50"
                >
                  {savingAssignments ? ui.savingAssignments : ui.saveAssignments(selectedStoreOaIds.length)}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allCurrentPageReadySelected}
                          onChange={handleToggleCurrentPageReady}
                          aria-label={ui.selectPage}
                          className="h-4 w-4 accent-[#06c755]"
                        />
                      </th>
                      <th className="px-4 py-3">{ui.storeCode}</th>
                      <th className="px-4 py-3">{ui.storeName}</th>
                      <th className="px-4 py-3">{ui.lineOa}</th>
                      <th className="px-4 py-3">{ui.province}</th>
                      <th className="px-4 py-3">{ui.readiness}</th>
                      <th className="px-4 py-3">{ui.currentGreeting}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedStores.map((store) => {
                      const selected = selectedStoreOaIds.includes(store.lineOfficialAccountId);
                      const ready = store.readinessStatus === "READY";
                      const disabled = !ready && !selected;
                      return (
                        <tr key={store.lineOfficialAccountId} className={selected ? "bg-emerald-50/50" : "hover:bg-gray-50"}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => handleToggleStoreSelect(store.lineOfficialAccountId)}
                              className="h-4 w-4 accent-[#06c755] disabled:opacity-30"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-500">{store.storeCode || "—"}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{store.storeName}</td>
                          <td className="px-4 py-3 text-gray-600">{store.lineOfficialAccountName || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">{store.province || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {ready ? ui.ready : ui.blocked}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {store.currentTemplateName || ui.noGreeting}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {paginatedStores.length === 0 && (
                <div className="p-10 text-center text-xs text-gray-500">{ui.resultCount(0)}</div>
              )}

              <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-500">{ui.pageSummary(pageFrom, pageTo, filteredStores.length)}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={storePage <= 1}
                    onClick={() => setStorePage((page) => Math.max(1, page - 1))}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-30"
                  >
                    {ui.previous}
                  </button>
                  <span className="min-w-24 text-center text-xs text-gray-600">{ui.page(storePage, totalStorePages)}</span>
                  <button
                    type="button"
                    disabled={storePage >= totalStorePages}
                    onClick={() => setStorePage((page) => Math.min(totalStorePages, page + 1))}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-30"
                  >
                    {ui.next}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {showActiveEditModal && currentTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold">{t.activeEditWarningTitle}</h3>
            <p className="text-xs leading-relaxed text-gray-600">
              {t.activeEditWarningMessage(currentTemplate.assignedStoreCount)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowActiveEditModal(false)}
                className="rounded border border-gray-300 px-4 py-2 text-xs font-medium"
              >
                {t.activeEditWarningCancel}
              </button>
              <button
                type="button"
                onClick={() => void executeSave()}
                className="rounded bg-[#06c755] px-4 py-2 text-xs font-semibold text-white"
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
