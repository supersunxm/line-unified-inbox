"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  RichMenuArea,
  RichMenuCanvasPreset,
  RichMenuPreviewResponse,
  RichMenuReadinessResponse,
  RichMenuTemplate,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";
import { RICH_MENU_I18N } from "./rich-menu-i18n";

interface RichMenusViewProps {
  language?: Language;
  userRole?: "ADMIN" | "VIEWER";
}

const PRESET_DIMENSIONS: Record<RichMenuCanvasPreset, { width: number; height: number }> = {
  GRID_6: { width: 2500, height: 1686 },
  GRID_4: { width: 2500, height: 1686 },
  GRID_3: { width: 2500, height: 843 },
  CUSTOM: { width: 2500, height: 1686 },
};

function generatePresetAreasClient(preset: RichMenuCanvasPreset, width = 2500, height = 1686): RichMenuArea[] {
  if (preset === "GRID_6") {
    const colW = Math.floor(width / 2);
    const rowH = Math.floor(height / 3);
    return [
      { id: "area-1", bounds: { x: 0, y: 0, width: colW, height: rowH }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      { id: "area-2", bounds: { x: colW, y: 0, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
      { id: "area-3", bounds: { x: 0, y: rowH, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      { id: "area-4", bounds: { x: colW, y: rowH, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "บริการหลังการขาย", label: "After Sales" },
      { id: "area-5", bounds: { x: 0, y: rowH * 2, width: colW, height: height - rowH * 2 }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
      { id: "area-6", bounds: { x: colW, y: rowH * 2, width: colW, height: height - rowH * 2 }, actionType: "MESSAGE", actionData: "สอบถามราคา", label: "Inquire Price" },
    ];
  }
  if (preset === "GRID_4") {
    const colW = Math.floor(width / 2);
    const rowH = Math.floor(height / 2);
    return [
      { id: "area-1", bounds: { x: 0, y: 0, width: colW, height: rowH }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      { id: "area-2", bounds: { x: colW, y: 0, width: colW, height: rowH }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      { id: "area-3", bounds: { x: 0, y: rowH, width: colW, height: height - rowH }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
      { id: "area-4", bounds: { x: colW, y: rowH, width: colW, height: height - rowH }, actionType: "MESSAGE", actionData: "ติดต่อเรา", label: "Contact Us" },
    ];
  }
  if (preset === "GRID_3") {
    const colW = Math.floor(width / 3);
    return [
      { id: "area-1", bounds: { x: 0, y: 0, width: colW, height }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      { id: "area-2", bounds: { x: colW, y: 0, width: colW, height }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      { id: "area-3", bounds: { x: colW * 2, y: 0, width: width - colW * 2, height }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
    ];
  }
  return [
    { id: "area-1", bounds: { x: 0, y: 0, width, height }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Full Area" },
  ];
}

function getAreaLetter(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, D, ...
}

export function RichMenusView({ language = "th", userRole = "ADMIN" }: RichMenusViewProps) {
  const t = RICH_MENU_I18N[language] || RICH_MENU_I18N.th;

  // Preset labels/descriptions localized
  const presetLabels: Record<RichMenuCanvasPreset, { label: string; description: string }> = useMemo(
    () => ({
      GRID_6: { label: t.presetGrid6, description: t.presetGrid6Desc },
      GRID_4: { label: t.presetGrid4, description: t.presetGrid4Desc },
      GRID_3: { label: t.presetGrid3, description: t.presetGrid3Desc },
      CUSTOM: { label: t.presetCustom, description: t.presetCustomDesc },
    }),
    [t],
  );

  const supportedVariables = useMemo(
    () => [
      { token: "{{store.storeName}}", label: t.varStoreName, example: "OBS Central Pinklao" },
      { token: "{{store.googleMapsUrl}}", label: t.varGoogleMapsUrl, example: "https://maps.app.goo.gl/..." },
      { token: "{{store.lineUrl}}", label: t.varLineUrl, example: "https://line.me/R/ti/p/..." },
      { token: "{{store.tiktokUrl}}", label: t.varTiktokUrl, example: "https://tiktok.com/@..." },
    ],
    [t],
  );

  // Templates state
  const [templates, setTemplates] = useState<RichMenuTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Form / Editor state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [formPreset, setFormPreset] = useState<RichMenuCanvasPreset>("GRID_6");
  const [formWidth, setFormWidth] = useState(2500);
  const [formHeight, setFormHeight] = useState(1686);
  const [formChatBarText, setFormChatBarText] = useState("Menu");
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [formAreas, setFormAreas] = useState<RichMenuArea[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string>("area-1");
  const [showOutline, setShowOutline] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Template Change Modal
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [modalSelectedPreset, setModalSelectedPreset] = useState<RichMenuCanvasPreset>("GRID_6");

  // Image Upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Variable dropdown state per area
  const [variableDropdownOpenFor, setVariableDropdownOpenFor] = useState<string | null>(null);

  // Readiness / Target Stores state
  const [readinessData, setReadinessData] = useState<RichMenuReadinessResponse | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "blocked">("all");
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedOaIds, setSelectedOaIds] = useState<Set<string>>(new Set());
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentsMessage, setAssignmentsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Live Store Preview state
  const [previewStoreOaId, setPreviewStoreOaId] = useState<string>("");
  const [previewData, setPreviewData] = useState<RichMenuPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load template list
  const loadTemplates = async (selectId?: string) => {
    setLoadingTemplates(true);
    try {
      const data = await api.listRichMenuTemplates();
      setTemplates(data);
      if (data.length > 0) {
        const nextId = selectId || (selectedTemplateId && data.some((t) => t.id === selectedTemplateId) ? selectedTemplateId : data[0].id);
        setSelectedTemplateId(nextId);
      } else {
        initNewTemplate();
      }
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || t.failedSaveTemplate });
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Initialize new template
  const initNewTemplate = () => {
    setSelectedTemplateId("new");
    setFormName(language === "th" ? "ริชเมนูใหม่" : language === "zh" ? "新建丰富菜单" : "Untitled rich menu");
    setFormDescription("");
    setShowAdvancedSettings(false);
    setFormPreset("GRID_6");
    setFormWidth(2500);
    setFormHeight(1686);
    setFormChatBarText(t.menuBarDefault);
    setFormImageUrl(null);
    const presetAreas = generatePresetAreasClient("GRID_6", 2500, 1686);
    setFormAreas(presetAreas);
    setActiveAreaId("area-1");
    setReadinessData(null);
    setPreviewData(null);
    setSelectedOaIds(new Set());
    setSaveMessage(null);
  };

  // Populate editor when template changes
  useEffect(() => {
    if (!selectedTemplateId || selectedTemplateId === "new") return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    setFormName(tmpl.name);
    setFormDescription(tmpl.description || "");
    setShowAdvancedSettings(Boolean(tmpl.description));
    setFormPreset(tmpl.canvasPreset);
    setFormWidth(tmpl.width);
    setFormHeight(tmpl.height);
    setFormChatBarText(tmpl.chatBarText || t.menuBarDefault);
    setFormImageUrl(tmpl.imageUrl || null);
    setFormAreas(tmpl.areas || []);
    setActiveAreaId(tmpl.areas?.[0]?.id || "area-1");
    setSaveMessage(null);

    // Load store readiness
    loadReadiness(tmpl.id);
  }, [selectedTemplateId, templates]);

  // Load readiness data
  const loadReadiness = async (templateId: string) => {
    if (!templateId || templateId === "new") return;
    setLoadingReadiness(true);
    try {
      const res = await api.getRichMenuReadiness(templateId);
      setReadinessData(res);

      const preSelected = new Set(res.items.filter((item) => item.selected).map((item) => item.lineOfficialAccountId));
      setSelectedOaIds(preSelected);

      if (res.items.length > 0) {
        const nextOaId = previewStoreOaId && res.items.some((i) => i.lineOfficialAccountId === previewStoreOaId)
          ? previewStoreOaId
          : res.items[0].lineOfficialAccountId;
        setPreviewStoreOaId(nextOaId);
        void loadPreview(templateId, nextOaId);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingReadiness(false);
    }
  };

  // Load single store preview
  const loadPreview = async (templateId: string, lineOfficialAccountId?: string) => {
    if (!templateId || templateId === "new") return;
    setLoadingPreview(true);
    try {
      const res = await api.previewRichMenuTemplate(templateId, { lineOfficialAccountId });
      setPreviewData(res);
    } catch {
      // preview error handled gracefully
    } finally {
      setLoadingPreview(false);
    }
  };

  // Change Canvas Preset
  const handleApplyPreset = (preset: RichMenuCanvasPreset) => {
    setFormPreset(preset);
    const dim = PRESET_DIMENSIONS[preset];
    setFormWidth(dim.width);
    setFormHeight(dim.height);
    const newAreas = generatePresetAreasClient(preset, dim.width, dim.height);
    setFormAreas(newAreas);
    setActiveAreaId(newAreas[0]?.id || "area-1");
    setIsPresetModalOpen(false);
  };

  // Update Area
  const updateArea = (areaId: string, updates: Partial<RichMenuArea>) => {
    setFormAreas((prev) =>
      prev.map((area) => (area.id === areaId ? { ...area, ...updates } : area)),
    );
  };

  // Insert Variable Token
  const insertToken = (areaId: string, token: string) => {
    const area = formAreas.find((a) => a.id === areaId);
    if (!area) return;
    const current = area.actionData || "";
    updateArea(areaId, { actionData: current ? `${current} ${token}` : token });
    setVariableDropdownOpenFor(null);
  };

  // Image Upload
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setImageError(t.imageSizeError);
      return;
    }

    setUploadingImage(true);
    setImageError(null);
    try {
      const res = await api.uploadRichMenuImage(file);
      setFormImageUrl(res.imageUrl);
      if (res.width && res.height) {
        setFormWidth(res.width);
        setFormHeight(res.height);
      }
    } catch (err: any) {
      setImageError(err.message || t.imageUploadError);
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Template
  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      setSaveMessage({ type: "error", text: t.enterTitleError });
      return;
    }

    setSavingTemplate(true);
    setSaveMessage(null);

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        canvasPreset: formPreset,
        width: formWidth,
        height: formHeight,
        chatBarText: formChatBarText.trim() || t.menuBarDefault,
        imageUrl: formImageUrl,
        areas: formAreas,
      };

      let saved: RichMenuTemplate;
      if (selectedTemplateId && selectedTemplateId !== "new") {
        saved = await api.updateRichMenuTemplate(selectedTemplateId, payload);
      } else {
        saved = await api.createRichMenuTemplate(payload);
      }

      setSaveMessage({ type: "success", text: t.draftSaved });
      await loadTemplates(saved.id);
      await loadReadiness(saved.id);
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || t.failedSaveTemplate });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Target Store selection helpers
  const handleSelectAllReady = () => {
    if (!readinessData) return;
    const readyIds = readinessData.items
      .filter((item) => item.readinessStatus === "READY")
      .map((item) => item.lineOfficialAccountId);
    setSelectedOaIds(new Set(readyIds));
  };

  const handleClearSelection = () => {
    setSelectedOaIds(new Set());
  };

  const handleToggleStore = (oaId: string, status: "READY" | "BLOCKED") => {
    if (status === "BLOCKED") return;
    setSelectedOaIds((prev) => {
      const next = new Set(prev);
      if (next.has(oaId)) {
        next.delete(oaId);
      } else {
        next.add(oaId);
      }
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!selectedTemplateId || selectedTemplateId === "new") {
      setAssignmentsMessage({ type: "error", text: t.saveTemplateFirst });
      return;
    }

    setSavingAssignments(true);
    setAssignmentsMessage(null);
    try {
      const res = await api.saveRichMenuAssignments(selectedTemplateId, Array.from(selectedOaIds));
      setAssignmentsMessage({ type: "success", text: t.savedAssignmentsSuccess(res.assignedCount) });
      await loadReadiness(selectedTemplateId);
      await loadTemplates(selectedTemplateId);
    } catch (err: any) {
      setAssignmentsMessage({ type: "error", text: err.message || t.failedSaveAssignments });
    } finally {
      setSavingAssignments(false);
    }
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!readinessData?.items) return [];
    return readinessData.items.filter((item) => {
      if (readinessFilter === "ready" && item.readinessStatus !== "READY") return false;
      if (readinessFilter === "blocked" && item.readinessStatus !== "BLOCKED") return false;
      if (storeSearch.trim()) {
        const q = storeSearch.toLowerCase();
        const matchName = item.storeName?.toLowerCase().includes(q);
        const matchOa = item.lineOfficialAccountName?.toLowerCase().includes(q);
        const matchId = item.externalStoreId?.toLowerCase().includes(q);
        const matchProv = item.province?.toLowerCase().includes(q);
        if (!matchName && !matchOa && !matchId && !matchProv) return false;
      }
      return true;
    });
  }, [readinessData, readinessFilter, storeSearch]);

  const selectedStoreItem = readinessData?.items.find((i) => i.lineOfficialAccountId === previewStoreOaId);

  return (
    <div
      data-rich-menus-scroll
      className="w-full flex-1 min-h-0 overflow-y-auto bg-[#f7f8f9] dark:bg-[var(--app-bg)] text-[#111] dark:text-[#f3f4f6] font-sans pb-16"
    >
      {/* 1. Page Header (LINE OA Manager Style) */}
      <div className="sticky top-0 z-20 border-b border-[#e5e7eb] dark:border-[var(--app-border)] bg-white/95 dark:bg-[var(--app-surface)]/95 backdrop-blur-xs px-6 py-4">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.pageTitle}</h1>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {t.phase1Badge}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.pageSubtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {saveMessage && (
              <span
                className={`text-xs font-medium ${
                  saveMessage.type === "success" ? "text-[#06C755]" : "text-rose-600"
                }`}
              >
                {saveMessage.text}
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="inline-flex items-center justify-center rounded bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              {savingTemplate ? t.saving : t.saveDraft}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-5 space-y-6">
        {/* Template Selector Bar */}
        <div className="flex items-center justify-between rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-4 py-2.5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{t.templateLabel}:</span>
            <select
              value={selectedTemplateId || "new"}
              onChange={(e) => {
                if (e.target.value === "new") {
                  initNewTemplate();
                } else {
                  setSelectedTemplateId(e.target.value);
                }
              }}
              className="h-8 rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-subtle)] px-2.5 text-xs text-gray-900 dark:text-gray-100 font-medium focus:border-[#06C755] focus:outline-none"
            >
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({presetLabels[tmpl.canvasPreset]?.label || tmpl.canvasPreset})
                </option>
              ))}
              <option value="new">{t.newTemplateOption}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={initNewTemplate}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#06C755] hover:underline"
          >
            {t.newTemplateButton}
          </button>
        </div>

        {/* 2. Main Settings Section */}
        <section className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 pb-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)] mb-4">
            {t.mainSettings}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t.title} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t.titlePlaceholder}
                className="h-9 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-subtle)] px-3 text-xs text-gray-900 dark:text-gray-100 focus:border-[#06C755] focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">{t.titleHint}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t.displayPeriod}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  value={t.notConfiguredPhase1}
                  className="h-9 flex-1 rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-gray-50 dark:bg-[var(--app-surface-subtle)] px-3 text-xs text-gray-400 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{t.displayPeriodHint}</p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#f3f4f6] dark:border-[var(--app-border-subtle)]">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium hover:text-[#06C755]"
            >
              <span>{showAdvancedSettings ? "▾" : "▸"}</span> {t.advancedSettings}
            </button>
            {showAdvancedSettings && (
              <div className="mt-2.5 max-w-xl">
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  className="w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-subtle)] p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:border-[#06C755] focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>

        {/* 3. Menu Content Section (2-Column Editor: Preview Left ~36%, Editor Right ~64%) */}
        <section className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-5 shadow-2xs">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 pb-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)] mb-5">
            {t.menuContent}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* ===================== LEFT: Preview Panel (36%) ===================== */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{t.preview}</span>
                {loadingPreview && <span className="text-[10px] text-gray-400 animate-pulse">{t.resolvingStore}</span>}
              </div>

              {/* Store Selector */}
              <div className="rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#fafafa] dark:bg-[var(--app-surface-subtle)] p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">{t.previewAs}</label>
                  {selectedStoreItem && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        selectedStoreItem.readinessStatus === "READY"
                          ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {selectedStoreItem.readinessStatus === "READY" ? t.statusReady : t.statusBlocked}
                    </span>
                  )}
                </div>

                <select
                  value={previewStoreOaId}
                  onChange={(e) => {
                    setPreviewStoreOaId(e.target.value);
                    if (selectedTemplateId) loadPreview(selectedTemplateId, e.target.value);
                  }}
                  className="h-8 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-2 text-xs text-gray-900 dark:text-gray-100 font-medium focus:border-[#06C755] focus:outline-none"
                >
                  {readinessData?.items.map((item) => (
                    <option key={item.lineOfficialAccountId} value={item.lineOfficialAccountId}>
                      {item.storeName} ({item.externalStoreId || "—"})
                    </option>
                  ))}
                </select>

                {selectedStoreItem && (
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
                    <span>{t.storeId}: {selectedStoreItem.externalStoreId || "—"}</span>
                    <span>
                      {t.googleMaps}:{" "}
                      {selectedStoreItem.googleMapsUrl ? (
                        <span className="text-emerald-600 font-medium">✓ {t.configured}</span>
                      ) : (
                        <span className="text-rose-500 font-medium">⚠ {t.notConfigured}</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* LINE Phone-like Canvas Mockup */}
              <div className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#f3f4f6] dark:bg-[var(--app-surface-subtle)] p-2 shadow-xs">
                <div
                  className="relative w-full rounded border border-gray-300 dark:border-gray-700 bg-slate-900 overflow-hidden flex items-center justify-center"
                  style={{ aspectRatio: `${formWidth} / ${formHeight}` }}
                >
                  {formImageUrl ? (
                    <img
                      src={formImageUrl}
                      alt="Rich Menu Preview Background"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4 text-gray-400 text-xs font-mono">
                      {t.noImageUploaded(formWidth, formHeight)}
                    </div>
                  )}

                  {/* Area Overlays with LINE OA Letters */}
                  {showOutline &&
                    formAreas.map((area, index) => {
                      const letter = getAreaLetter(index);
                      const leftPct = (area.bounds.x / formWidth) * 100;
                      const topPct = (area.bounds.y / formHeight) * 100;
                      const widthPct = (area.bounds.width / formWidth) * 100;
                      const heightPct = (area.bounds.height / formHeight) * 100;
                      const isSelected = area.id === activeAreaId;

                      return (
                        <div
                          key={area.id}
                          onClick={() => setActiveAreaId(area.id)}
                          className={`absolute cursor-pointer transition select-none flex flex-col items-center justify-center p-1.5 text-center ${
                            isSelected
                              ? "border-2 border-[#06C755] bg-[#06C755]/20 ring-2 ring-[#06C755]/30 z-20"
                              : "border border-white/40 bg-black/25 hover:bg-black/15 z-10"
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                          }}
                        >
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow ${
                              isSelected ? "bg-[#06C755] text-white" : "bg-white text-gray-800"
                            }`}
                          >
                            {letter}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Simulated LINE Chat Bar at bottom */}
                <div className="mt-1.5 flex items-center justify-between rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <span className="text-gray-400">⌨</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{formChatBarText || t.menuBarDefault} ▾</span>
                  <span className="text-gray-400">···</span>
                </div>
              </div>

              {/* Show template outline toggle */}
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={showOutline}
                  onChange={(e) => setShowOutline(e.target.checked)}
                  className="rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]"
                />
                <span>{t.showTemplateOutline}</span>
              </label>
            </div>

            {/* ===================== RIGHT: Template / Image / Actions Editor (64%) ===================== */}
            <div className="lg:col-span-7 flex flex-col space-y-6">
              {/* Template Row */}
              <div className="flex items-center justify-between py-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)]">
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{t.templateLabel}</span>
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-semibold mt-0.5">
                    {presetLabels[formPreset]?.label || formPreset} ({formWidth} x {formHeight} px, {t.areasCount(formAreas.length)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalSelectedPreset(formPreset);
                    setIsPresetModalOpen(true);
                  }}
                  className="rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--app-surface-hover)] transition"
                >
                  {t.changeTemplate}
                </button>
              </div>

              {/* Image Row */}
              <div className="flex items-center justify-between py-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)]">
                <div className="min-w-0 flex-1 pr-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{t.image}</span>
                  {formImageUrl ? (
                    <p className="truncate text-xs text-gray-900 dark:text-gray-100 font-medium mt-0.5">
                      {t.imageUploaded(formWidth, formHeight)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">{t.noImageSelected}</p>
                  )}
                  {imageError && <p className="text-[11px] text-rose-500 mt-1">{imageError}</p>}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[var(--app-surface-hover)] transition disabled:opacity-50"
                  >
                    {uploadingImage ? t.uploadingImage : formImageUrl ? t.replaceImage : t.selectImage}
                  </button>
                  {formImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImageUrl(null)}
                      className="text-xs text-rose-500 hover:underline px-2 py-1"
                    >
                      {t.removeImage}
                    </button>
                  )}
                </div>
              </div>

              {/* Actions Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  {t.actions}
                </h3>

                <div className="space-y-2">
                  {formAreas.map((area, index) => {
                    const letter = getAreaLetter(index);
                    const isExpanded = area.id === activeAreaId;
                    const previewAreaResolved = previewData?.areas.find((a) => a.id === area.id);

                    return (
                      <div
                        key={area.id}
                        className={`rounded border transition ${
                          isExpanded
                            ? "border-[#06C755] bg-white dark:bg-[var(--app-surface)] shadow-2xs"
                            : "border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#fafafa] dark:bg-[var(--app-surface-subtle)] hover:border-gray-300"
                        }`}
                      >
                        {/* Area Header Bar */}
                        <div
                          onClick={() => setActiveAreaId(area.id)}
                          className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                isExpanded ? "bg-[#06C755] text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">
                              {t.actionType}: {area.actionType === "URI" ? t.actionTypeUri : t.actionTypeMessage}
                            </span>
                            {!isExpanded && area.actionData && (
                              <span className="truncate max-w-xs text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                                {area.actionData}
                              </span>
                            )}
                          </div>

                          <span className="text-gray-400 text-xs font-mono">{isExpanded ? "▾" : "▸"}</span>
                        </div>

                        {/* Expanded Area Form */}
                        {isExpanded && (
                          <div className="p-4 pt-1 border-t border-[#f3f4f6] dark:border-[var(--app-border-subtle)] space-y-3.5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                              <div>
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                  {t.actionType}
                                </label>
                                <select
                                  value={area.actionType}
                                  onChange={(e) => updateArea(area.id, { actionType: e.target.value as "URI" | "MESSAGE" })}
                                  className="h-8 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-2 text-xs text-gray-900 dark:text-gray-100 font-medium focus:border-[#06C755] focus:outline-none"
                                >
                                  <option value="URI">{t.actionTypeUri}</option>
                                  <option value="MESSAGE">{t.actionTypeMessage}</option>
                                </select>
                              </div>

                              <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                    {area.actionType === "URI" ? t.url : t.message}
                                  </label>

                                  {/* Variable Insert Dropdown */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setVariableDropdownOpenFor(variableDropdownOpenFor === area.id ? null : area.id)
                                      }
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#06C755] hover:underline"
                                    >
                                      {t.insertVariable}
                                    </button>

                                    {variableDropdownOpenFor === area.id && (
                                      <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] py-1 shadow-lg">
                                        {supportedVariables.map((v) => (
                                          <button
                                            key={v.token}
                                            type="button"
                                            onClick={() => insertToken(area.id, v.token)}
                                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-[var(--app-surface-hover)] flex flex-col"
                                          >
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">{v.label}</span>
                                            <span className="font-mono text-[10px] text-gray-400">{v.token}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  value={area.actionData}
                                  onChange={(e) => updateArea(area.id, { actionData: e.target.value })}
                                  placeholder={area.actionType === "URI" ? t.urlPlaceholder : t.messagePlaceholder}
                                  className="h-8 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-2.5 text-xs text-gray-900 dark:text-gray-100 font-mono focus:border-[#06C755] focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Resolved Store Preview Context under Area */}
                            {previewAreaResolved && (
                              <div className="rounded bg-[#f9fafb] dark:bg-[var(--app-surface-subtle)] border border-[#e5e7eb] dark:border-[var(--app-border)] p-2 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {t.resolvedFor} <strong>{previewData?.store.storeName}</strong>:
                                  </span>
                                  <span
                                    className={`font-semibold ${
                                      previewAreaResolved.isValid ? "text-emerald-600" : "text-rose-500"
                                    }`}
                                  >
                                    {previewAreaResolved.isValid
                                      ? t.valid
                                      : t.invalid(
                                          previewAreaResolved.validationError === "Missing Google Maps URL"
                                            ? t.missingGoogleMapsReason
                                            : previewAreaResolved.validationError === "Invalid Google Maps URL"
                                            ? t.invalidGoogleMapsReason
                                            : previewAreaResolved.validationError || ""
                                        )}
                                  </span>
                                </div>
                                <p className="truncate font-mono text-[11px] text-gray-700 dark:text-gray-300">
                                  {previewAreaResolved.resolvedActionData || t.emptyValue}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Other Settings Section */}
              <div className="py-4 border-t border-[#f3f4f6] dark:border-[var(--app-border-subtle)] space-y-4">
                <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                  {t.otherSettings}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t.menuBarLabel}
                    </label>
                    <input
                      type="text"
                      value={formChatBarText}
                      onChange={(e) => setFormChatBarText(e.target.value)}
                      placeholder={t.menuBarDefault}
                      className="h-8 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-2.5 text-xs text-gray-900 dark:text-gray-100 focus:border-[#06C755] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {t.defaultBehavior}
                    </label>
                    <div className="flex items-center gap-4 text-xs pt-1.5 text-gray-700 dark:text-gray-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" name="defaultBehavior" checked readOnly className="text-[#06C755]" />
                        <span>{t.behaviorShow}</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-gray-400 cursor-not-allowed">
                        <input type="radio" name="defaultBehavior" disabled className="text-gray-400" />
                        <span>{t.behaviorCollapsed}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Target Stores Section (Store Readiness Table below Editor) */}
        <section className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)]">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t.targetStores}</h2>
              {readinessData?.summary && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t.readyCount}: <strong className="text-emerald-600">{readinessData.summary.ready}</strong> · {t.blockedCount}:{" "}
                  <strong className="text-rose-600">{readinessData.summary.blocked}</strong> · {t.selectedCount}:{" "}
                  <strong className="text-gray-900 dark:text-gray-100">{selectedOaIds.size}</strong>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {assignmentsMessage && (
                <span
                  className={`text-xs font-medium ${
                    assignmentsMessage.type === "success" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {assignmentsMessage.text}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={savingAssignments}
                className="rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-3.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[var(--app-surface-hover)] transition disabled:opacity-50"
              >
                {savingAssignments ? t.savingAssignments : t.saveAssignedStores}
              </button>
            </div>
          </div>

          {/* Table Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder={t.searchStoresPlaceholder}
                className="h-8 w-60 rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-subtle)] px-2.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-[#06C755] focus:outline-none"
              />

              {/* Filter Tabs */}
              <div className="flex rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#fafafa] dark:bg-[var(--app-surface-subtle)] p-0.5 text-xs">
                {(["all", "ready", "blocked"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setReadinessFilter(tab)}
                    className={`px-3 py-1 font-semibold rounded capitalize transition ${
                      readinessFilter === tab
                        ? "bg-white dark:bg-[var(--app-surface)] text-gray-900 dark:text-gray-100 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {tab === "all" ? t.tabAll : tab === "ready" ? t.tabReady : t.tabBlocked}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleSelectAllReady}
                className="font-semibold text-[#06C755] hover:underline"
              >
                {t.selectAllReady}
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-gray-500 hover:text-gray-800 hover:underline"
              >
                {t.clearSelection}
              </button>
            </div>
          </div>

          {/* Compact Store Table */}
          <div className="overflow-x-auto rounded border border-[#e5e7eb] dark:border-[var(--app-border)]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#fafafa] dark:bg-[var(--app-surface-subtle)] text-gray-500 font-semibold">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">{t.colHash}</th>
                  <th className="w-24 px-3 py-2.5">{t.colStoreId}</th>
                  <th className="px-3 py-2.5">{t.colStoreName}</th>
                  <th className="px-3 py-2.5">{t.colLineOaName}</th>
                  <th className="px-3 py-2.5">{t.colProvince}</th>
                  <th className="w-36 px-3 py-2.5">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6] dark:divide-[var(--app-border-subtle)]">
                {loadingReadiness ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-gray-400">
                      {t.evaluatingReadiness}
                    </td>
                  </tr>
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-xs text-gray-400">
                      {t.noStoresFound}
                    </td>
                  </tr>
                ) : (
                  filteredStores.map((store) => {
                    const isChecked = selectedOaIds.has(store.lineOfficialAccountId);
                    const isBlocked = store.readinessStatus === "BLOCKED";

                    return (
                      <tr
                        key={store.lineOfficialAccountId}
                        onClick={() => handleToggleStore(store.lineOfficialAccountId, store.readinessStatus)}
                        className={`transition ${
                          isBlocked
                            ? "bg-gray-50/50 dark:bg-gray-900/20 text-gray-400 cursor-not-allowed"
                            : isChecked
                            ? "bg-[#06C755]/5 hover:bg-[#06C755]/10 cursor-pointer"
                            : "hover:bg-gray-50 dark:hover:bg-[var(--app-surface-hover)] cursor-pointer"
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isBlocked}
                            onChange={() => handleToggleStore(store.lineOfficialAccountId, store.readinessStatus)}
                            className="rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-600 dark:text-gray-400">
                          {store.externalStoreId || "—"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                          {store.storeName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                          {store.lineOfficialAccountName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                          {store.province || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col">
                            <span
                              className={`font-semibold ${
                                isBlocked ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {isBlocked ? t.statusBlocked : t.statusReady}
                            </span>
                            {isBlocked && store.readinessReason && (
                              <span className="text-[10px] text-rose-500 leading-tight mt-0.5">
                                {store.readinessReason === "Missing Google Maps URL"
                                  ? t.missingGoogleMapsReason
                                  : store.readinessReason === "Invalid Google Maps URL"
                                  ? t.invalidGoogleMapsReason
                                  : store.readinessReason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* 5. Select a Template Modal (LINE OA Manager Preset Selector) */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] dark:border-[var(--app-border)] pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.selectTemplateTitle}</h3>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {(["GRID_6", "GRID_4", "GRID_3", "CUSTOM"] as const).map((preset) => {
                const conf = PRESET_DIMENSIONS[preset];
                const labelInfo = presetLabels[preset];
                const isSelected = modalSelectedPreset === preset;

                return (
                  <div
                    key={preset}
                    onClick={() => setModalSelectedPreset(preset)}
                    className={`cursor-pointer rounded-lg border p-3 text-center transition flex flex-col items-center justify-between ${
                      isSelected
                        ? "border-[#06C755] bg-[#06C755]/5 ring-2 ring-[#06C755]/30"
                        : "border-[#e5e7eb] dark:border-[var(--app-border)] hover:border-gray-300"
                    }`}
                  >
                    {/* SVG Diagram */}
                    <div className="h-20 w-full flex items-center justify-center mb-2">
                      {preset === "GRID_6" && (
                        <svg viewBox="0 0 100 68" className="h-16 w-24 stroke-[#06C755] fill-none" strokeWidth="1.5">
                          <rect x="2" y="2" width="96" height="64" rx="2" className="stroke-gray-400" />
                          <line x1="50" y1="2" x2="50" y2="66" />
                          <line x1="2" y1="23" x2="98" y2="23" />
                          <line x1="2" y1="45" x2="98" y2="45" />
                        </svg>
                      )}
                      {preset === "GRID_4" && (
                        <svg viewBox="0 0 100 68" className="h-16 w-24 stroke-[#06C755] fill-none" strokeWidth="1.5">
                          <rect x="2" y="2" width="96" height="64" rx="2" className="stroke-gray-400" />
                          <line x1="50" y1="2" x2="50" y2="66" />
                          <line x1="2" y1="34" x2="98" y2="34" />
                        </svg>
                      )}
                      {preset === "GRID_3" && (
                        <svg viewBox="0 0 100 34" className="h-10 w-24 stroke-[#06C755] fill-none" strokeWidth="1.5">
                          <rect x="2" y="2" width="96" height="30" rx="2" className="stroke-gray-400" />
                          <line x1="33" y1="2" x2="33" y2="32" />
                          <line x1="66" y1="2" x2="66" y2="32" />
                        </svg>
                      )}
                      {preset === "CUSTOM" && (
                        <svg viewBox="0 0 100 68" className="h-16 w-24 stroke-[#06C755] fill-none" strokeWidth="1.5">
                          <rect x="2" y="2" width="96" height="64" rx="2" strokeDasharray="3 3" className="stroke-gray-400" />
                          <circle cx="50" cy="34" r="6" />
                        </svg>
                      )}
                    </div>

                    <div>
                      <span className="block text-xs font-bold text-gray-900 dark:text-gray-100">{labelInfo.label}</span>
                      <span className="block text-[10px] text-gray-400">{conf.width}x{conf.height}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e5e7eb] dark:border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="rounded border border-[#d1d5db] dark:border-[var(--app-border)] px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(modalSelectedPreset)}
                className="rounded bg-[#06C755] hover:bg-[#05b34c] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                {t.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
