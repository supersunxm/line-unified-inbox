"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  RichMenuArea,
  RichMenuCanvasPreset,
  RichMenuPreviewResponse,
  RichMenuReadinessResponse,
  RichMenuStoreReadinessItem,
  RichMenuTemplate,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";

interface RichMenusViewProps {
  language?: Language;
  userRole?: "ADMIN" | "VIEWER";
}

const PRESET_CONFIGS: Record<RichMenuCanvasPreset, { name: string; width: number; height: number; description: string }> = {
  GRID_6: { name: "6-Grid (2x3)", width: 2500, height: 1686, description: "Standard 6-tile layout (2 cols x 3 rows)" },
  GRID_3: { name: "3-Grid (3x1)", width: 2500, height: 843, description: "Compact banner layout (3 cols x 1 row)" },
  GRID_4: { name: "4-Grid (2x2)", width: 2500, height: 1686, description: "Standard 4-tile layout (2 cols x 2 rows)" },
  CUSTOM: { name: "Custom Canvas", width: 2500, height: 1686, description: "Fully customizable area coordinates" },
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
  if (preset === "GRID_3") {
    const colW = Math.floor(width / 3);
    return [
      { id: "area-1", bounds: { x: 0, y: 0, width: colW, height }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      { id: "area-2", bounds: { x: colW, y: 0, width: colW, height }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      { id: "area-3", bounds: { x: colW * 2, y: 0, width: width - colW * 2, height }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
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
  return [
    { id: "area-1", bounds: { x: 0, y: 0, width, height }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Full Area" },
  ];
}

const VARIABLE_TOKENS = [
  { token: "{{store.storeName}}", label: "Store Name", desc: "e.g. OBS Central Pinklao" },
  { token: "{{store.googleMapsUrl}}", label: "Google Maps URL", desc: "Dynamic Store Google Maps link" },
  { token: "{{store.lineUrl}}", label: "LINE OA URL", desc: "Store LINE URL" },
  { token: "{{store.tiktokUrl}}", label: "TikTok URL", desc: "Store TikTok Profile URL" },
];

export function RichMenusView({ language = "th", userRole = "ADMIN" }: RichMenusViewProps) {
  // Templates state
  const [templates, setTemplates] = useState<RichMenuTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Editor form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPreset, setFormPreset] = useState<RichMenuCanvasPreset>("GRID_6");
  const [formWidth, setFormWidth] = useState(2500);
  const [formHeight, setFormHeight] = useState(1686);
  const [formChatBarText, setFormChatBarText] = useState("Menu");
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [formAreas, setFormAreas] = useState<RichMenuArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>("area-1");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Readiness & Store assignments state
  const [readinessData, setReadinessData] = useState<RichMenuReadinessResponse | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "blocked">("all");
  const [storeSearch, setStoreSearch] = useState("");
  const [selectedOaIds, setSelectedOaIds] = useState<Set<string>>(new Set());
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignmentsMessage, setAssignmentsMessage] = useState<string | null>(null);

  // Live store preview state
  const [previewStoreOaId, setPreviewStoreOaId] = useState<string>("");
  const [previewData, setPreviewData] = useState<RichMenuPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Load templates list
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
      setEditorError(err.message || "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Initialize new template form
  const initNewTemplate = () => {
    setSelectedTemplateId("new");
    setFormName("New Rich Menu Template");
    setFormDescription("");
    setFormPreset("GRID_6");
    setFormWidth(2500);
    setFormHeight(1686);
    setFormChatBarText("Menu");
    setFormImageUrl(null);
    const presetAreas = generatePresetAreasClient("GRID_6", 2500, 1686);
    setFormAreas(presetAreas);
    setSelectedAreaId("area-1");
    setReadinessData(null);
    setPreviewData(null);
    setSelectedOaIds(new Set());
    setEditorError(null);
    setSaveSuccessMessage(null);
  };

  // Populate editor when template selection changes
  useEffect(() => {
    if (!selectedTemplateId || selectedTemplateId === "new") return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    setFormName(tmpl.name);
    setFormDescription(tmpl.description || "");
    setFormPreset(tmpl.canvasPreset);
    setFormWidth(tmpl.width);
    setFormHeight(tmpl.height);
    setFormChatBarText(tmpl.chatBarText || "Menu");
    setFormImageUrl(tmpl.imageUrl || null);
    setFormAreas(tmpl.areas || []);
    setSelectedAreaId(tmpl.areas?.[0]?.id || null);
    setEditorError(null);
    setSaveSuccessMessage(null);

    // Load readiness for this template
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

      // Trigger preview for first store
      if (res.items.length > 0 && !previewStoreOaId) {
        const firstOa = res.items[0].lineOfficialAccountId;
        setPreviewStoreOaId(firstOa);
        void loadPreview(templateId, firstOa);
      } else if (previewStoreOaId) {
        void loadPreview(templateId, previewStoreOaId);
      }
    } catch (err: any) {
      // Non-blocking error
    } finally {
      setLoadingReadiness(false);
    }
  };

  // Load single-store live preview
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
  const handlePresetChange = (preset: RichMenuCanvasPreset) => {
    setFormPreset(preset);
    const conf = PRESET_CONFIGS[preset];
    setFormWidth(conf.width);
    setFormHeight(conf.height);
    const newAreas = generatePresetAreasClient(preset, conf.width, conf.height);
    setFormAreas(newAreas);
    setSelectedAreaId(newAreas[0]?.id || null);
  };

  // Update Area
  const updateArea = (areaId: string, updates: Partial<RichMenuArea>) => {
    setFormAreas((prev) =>
      prev.map((area) => (area.id === areaId ? { ...area, ...updates } : area)),
    );
  };

  // Insert token helper
  const insertToken = (areaId: string, token: string) => {
    const area = formAreas.find((a) => a.id === areaId);
    if (!area) return;
    const current = area.actionData || "";
    updateArea(areaId, { actionData: current ? `${current} ${token}` : token });
  };

  // Handle Image Upload
  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      setUploadError("Image file size exceeds 1 MB limit (LINE Messaging API requirement).");
      return;
    }

    setUploadingImage(true);
    setUploadError(null);
    try {
      const res = await api.uploadRichMenuImage(file);
      setFormImageUrl(res.imageUrl);
      if (res.width && res.height) {
        setFormWidth(res.width);
        setFormHeight(res.height);
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Template Draft
  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      setEditorError("Template name is required");
      return;
    }

    setSavingTemplate(true);
    setEditorError(null);
    setSaveSuccessMessage(null);

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        canvasPreset: formPreset,
        width: formWidth,
        height: formHeight,
        chatBarText: formChatBarText.trim() || "Menu",
        imageUrl: formImageUrl,
        areas: formAreas,
      };

      let saved: RichMenuTemplate;
      if (selectedTemplateId && selectedTemplateId !== "new") {
        saved = await api.updateRichMenuTemplate(selectedTemplateId, payload);
      } else {
        saved = await api.createRichMenuTemplate(payload);
      }

      setSaveSuccessMessage("Template draft saved successfully.");
      await loadTemplates(saved.id);
      await loadReadiness(saved.id);
    } catch (err: any) {
      setEditorError(err.message || "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete / Archive Template
  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      await api.deleteRichMenuTemplate(id);
      await loadTemplates();
    } catch (err: any) {
      setEditorError(err.message || "Failed to delete template");
    }
  };

  // Select all ready stores
  const handleSelectAllReady = () => {
    if (!readinessData) return;
    const readyIds = readinessData.items
      .filter((item) => item.readinessStatus === "READY")
      .map((item) => item.lineOfficialAccountId);
    setSelectedOaIds(new Set(readyIds));
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedOaIds(new Set());
  };

  // Toggle individual store selection
  const handleToggleStore = (oaId: string, status: "READY" | "BLOCKED") => {
    if (status === "BLOCKED") return; // Blocked stores cannot be selected
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

  // Save Store Assignments
  const handleSaveAssignments = async () => {
    if (!selectedTemplateId || selectedTemplateId === "new") {
      setEditorError("Please save the template before assigning stores.");
      return;
    }

    setSavingAssignments(true);
    setAssignmentsMessage(null);
    try {
      const res = await api.saveRichMenuAssignments(selectedTemplateId, Array.from(selectedOaIds));
      setAssignmentsMessage(`Saved ${res.assignedCount} store assignments.`);
      await loadReadiness(selectedTemplateId);
      await loadTemplates(selectedTemplateId);
    } catch (err: any) {
      setAssignmentsMessage(`Error: ${err.message || "Failed to save assignments"}`);
    } finally {
      setSavingAssignments(false);
    }
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)),
    );
  }, [templates, templateSearch]);

  // Filtered Readiness Stores
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

  const activeArea = formAreas.find((a) => a.id === selectedAreaId);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--app-text-primary)]">
      {/* Top Banner & Title Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[var(--app-text-primary)]">Rich Menu Manager</h1>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Phase 1: Template & Readiness Preview
              </span>
            </div>
            <p className="text-xs text-[var(--app-text-tertiary)]">
              Multi-store dynamic Rich Menu templates with per-store Google Maps & variable resolution
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={initNewTemplate}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-xs font-semibold text-[var(--app-text-secondary)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-primary)]"
          >
            <span className="text-sm font-bold">+</span> New Template
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={savingTemplate}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
          >
            {savingTemplate ? "Saving Draft..." : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Main 3-Pane Workspace */}
      <div className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* ===================== LEFT PANE: Template List ===================== */}
        <div className="col-span-12 flex flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)] lg:col-span-3">
          <div className="border-b border-[var(--app-border-subtle)] p-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--app-text-tertiary)]">⌕</span>
              <input
                type="search"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates..."
                className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] pl-8 pr-3 text-xs placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingTemplates ? (
              <div className="p-4 text-center text-xs text-[var(--app-text-tertiary)]">Loading templates...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--app-text-tertiary)]">
                No templates found. Click <strong>+ New Template</strong> to create one.
              </div>
            ) : (
              filteredTemplates.map((t) => {
                const isSelected = t.id === selectedTemplateId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)] shadow-sm"
                        : "border-transparent bg-[var(--app-surface-subtle)] hover:border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-xs font-bold text-[var(--app-text-primary)]">{t.name}</span>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400">
                        {t.canvasPreset}
                      </span>
                    </div>

                    {t.description && (
                      <p className="line-clamp-1 text-[11px] text-[var(--app-text-secondary)]">{t.description}</p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-[var(--app-text-tertiary)] pt-1">
                      <span>{t.areas?.length || 0} areas · {t.assignedStoresCount ?? 0} stores</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(t.id, t.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-rose-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================== CENTER PANE: Visual Editor & Canvas ===================== */}
        <div className="col-span-12 flex flex-col overflow-y-auto border-r border-[var(--app-border)] bg-[var(--app-bg)] p-5 lg:col-span-5">
          {editorError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {editorError}
            </div>
          )}
          {saveSuccessMessage && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              {saveSuccessMessage}
            </div>
          )}

          {/* Template Details Card */}
          <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-tertiary)]">Template Metadata</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Template Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Master Store Rich Menu"
                  className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Layout Preset</label>
                <select
                  value={formPreset}
                  onChange={(e) => handlePresetChange(e.target.value as RichMenuCanvasPreset)}
                  className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                >
                  <option value="GRID_6">6-Grid (2x3) - 2500x1686</option>
                  <option value="GRID_3">3-Grid (3x1) - 2500x843</option>
                  <option value="GRID_4">4-Grid (2x2) - 2500x1686</option>
                  <option value="CUSTOM">Custom Canvas</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Chat Bar Text</label>
                <input
                  type="text"
                  value={formChatBarText}
                  onChange={(e) => setFormChatBarText(e.target.value)}
                  placeholder="e.g. Menu"
                  className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)]">Template Image (JPEG/PNG ≤ 1MB)</label>
                {formImageUrl && (
                  <button
                    type="button"
                    onClick={() => setFormImageUrl(null)}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    Remove Image
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--app-border)] bg-[var(--app-surface-subtle)] text-xs text-[var(--app-text-secondary)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-accent)] disabled:opacity-50"
              >
                {uploadingImage ? "Uploading Image..." : formImageUrl ? "Replace Background Image" : "Upload Canvas Background Image"}
              </button>
              {uploadError && <p className="mt-1 text-[11px] text-rose-500">{uploadError}</p>}
            </div>
          </div>

          {/* Interactive Visual Canvas Preview */}
          <div className="mb-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-tertiary)]">Visual Canvas Preview</h2>
              <span className="text-[11px] text-[var(--app-text-tertiary)] font-mono">{formWidth} x {formHeight} px</span>
            </div>

            <div
              className="relative w-full rounded-xl border border-[var(--app-border)] bg-slate-900/90 overflow-hidden shadow-inner flex items-center justify-center"
              style={{ aspectRatio: `${formWidth} / ${formHeight}` }}
            >
              {formImageUrl && (
                <img
                  src={formImageUrl}
                  alt="Rich Menu Canvas Background"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              {/* Area Overlays */}
              {formAreas.map((area, index) => {
                const leftPct = (area.bounds.x / formWidth) * 100;
                const topPct = (area.bounds.y / formHeight) * 100;
                const widthPct = (area.bounds.width / formWidth) * 100;
                const heightPct = (area.bounds.height / formHeight) * 100;
                const isSelected = area.id === selectedAreaId;

                return (
                  <div
                    key={area.id}
                    onClick={() => setSelectedAreaId(area.id)}
                    className={`absolute cursor-pointer transition flex flex-col items-center justify-center p-2 text-center select-none border ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-500/25 ring-2 ring-emerald-400/80 z-20"
                        : "border-white/30 bg-black/35 hover:bg-black/20 hover:border-white/60 z-10"
                    }`}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                  >
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                      #{index + 1} {area.label || area.actionType}
                    </span>
                    <span className="mt-1 line-clamp-1 max-w-full text-[10px] text-white/80 font-mono">
                      {area.actionData || "(empty)"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--app-text-tertiary)]">
              Click any area box on the canvas above to configure its action.
            </p>
          </div>

          {/* Area Configuration Card */}
          {activeArea && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-primary)]">
                  Configure Area: {activeArea.label || activeArea.id}
                </h2>
                <span className="text-[10px] font-mono text-[var(--app-text-tertiary)]">
                  [{activeArea.bounds.x}, {activeArea.bounds.y}] - {activeArea.bounds.width}x{activeArea.bounds.height}px
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Area Label (Optional)</label>
                  <input
                    type="text"
                    value={activeArea.label || ""}
                    onChange={(e) => updateArea(activeArea.id, { label: e.target.value })}
                    placeholder="e.g. Store Location"
                    className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Action Type</label>
                  <select
                    value={activeArea.actionType}
                    onChange={(e) => updateArea(activeArea.id, { actionType: e.target.value as "URI" | "MESSAGE" })}
                    className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                  >
                    <option value="URI">URI (Web Link / Maps URL)</option>
                    <option value="MESSAGE">MESSAGE (Send Chat Text)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">
                  Action Value / Template String
                </label>
                <input
                  type="text"
                  value={activeArea.actionData}
                  onChange={(e) => updateArea(activeArea.id, { actionData: e.target.value })}
                  placeholder={activeArea.actionType === "URI" ? "e.g. {{store.googleMapsUrl}}" : "e.g. สนใจโปรโมชั่น"}
                  className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs font-mono text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                />
              </div>

              {/* Token Insertion Helper */}
              <div>
                <span className="block text-[10px] font-semibold text-[var(--app-text-tertiary)] mb-1.5 uppercase tracking-wider">
                  Insert Store Variable Tokens:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_TOKENS.map((token) => (
                    <button
                      key={token.token}
                      type="button"
                      onClick={() => insertToken(activeArea.id, token.token)}
                      title={token.desc}
                      className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2 py-1 text-[11px] font-mono text-[var(--app-accent)] transition hover:bg-[var(--app-accent-soft)]"
                    >
                      + {token.token}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================== RIGHT PANE: Store Readiness & Live Preview ===================== */}
        <div className="col-span-12 flex flex-col overflow-y-auto bg-[var(--app-surface)] p-5 lg:col-span-4 space-y-4">
          {/* Live Store Variable Preview Card */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-tertiary)]">Per-Store Preview</h2>
              {loadingPreview && <span className="text-[10px] text-[var(--app-text-tertiary)] animate-pulse">Resolving...</span>}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--app-text-secondary)] mb-1">Select Store to Preview</label>
              <select
                value={previewStoreOaId}
                onChange={(e) => {
                  setPreviewStoreOaId(e.target.value);
                  if (selectedTemplateId) loadPreview(selectedTemplateId, e.target.value);
                }}
                className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
              >
                {readinessData?.items.map((item) => (
                  <option key={item.lineOfficialAccountId} value={item.lineOfficialAccountId}>
                    {item.storeName} ({item.externalStoreId || "No ID"}) - {item.readinessStatus}
                  </option>
                ))}
              </select>
            </div>

            {previewData && (
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--app-text-primary)]">{previewData.store.storeName}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      previewData.readinessStatus === "READY"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {previewData.readinessStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {previewData.areas.map((a, idx) => (
                    <div key={a.id} className="rounded-lg bg-[var(--app-surface-subtle)] p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--app-text-primary)]">Area #{idx + 1} ({a.actionType})</span>
                        <span className={`text-[10px] font-semibold ${a.isValid ? "text-emerald-500" : "text-rose-500"}`}>
                          {a.isValid ? "✓ Valid" : `⚠ ${a.validationError}`}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--app-text-secondary)]">
                        {a.resolvedActionData}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Store Readiness Matrix */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--app-text-tertiary)]">Store Readiness Evaluation</h2>
              {loadingReadiness && <span className="text-[10px] text-[var(--app-text-tertiary)] animate-pulse">Evaluating...</span>}
            </div>

            {/* KPI Counter Badges */}
            {readinessData?.summary && (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-2">
                  <div className="text-xs font-bold text-[var(--app-text-primary)]">{readinessData.summary.total}</div>
                  <div className="text-[10px] text-[var(--app-text-tertiary)]">Total</div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{readinessData.summary.ready}</div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">Ready</div>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">{readinessData.summary.blocked}</div>
                  <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">Blocked</div>
                </div>
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2">
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{selectedOaIds.size}</div>
                  <div className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80">Selected</div>
                </div>
              </div>
            )}

            {/* Filter Tabs & Search */}
            <div className="space-y-2">
              <div className="flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-0.5 text-xs">
                {(["all", "ready", "blocked"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setReadinessFilter(tab)}
                    className={`flex-1 py-1 text-center font-semibold rounded-md capitalize transition ${
                      readinessFilter === tab
                        ? "bg-[var(--app-surface)] text-[var(--app-text-primary)] shadow-sm"
                        : "text-[var(--app-text-tertiary)] hover:text-[var(--app-text-primary)]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="Search stores by ID / name..."
                className="h-8 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus:border-[var(--app-accent)] focus:outline-none"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllReady}
                  className="text-[11px] font-semibold text-[var(--app-accent)] hover:underline"
                >
                  Select All Ready
                </button>
                <span className="text-[var(--app-border)]">|</span>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[11px] text-[var(--app-text-tertiary)] hover:underline"
                >
                  Clear
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveAssignments}
                disabled={savingAssignments}
                className="rounded-lg bg-[var(--app-surface-subtle)] border border-[var(--app-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50"
              >
                {savingAssignments ? "Saving..." : "Save Assigned Stores"}
              </button>
            </div>
            {assignmentsMessage && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{assignmentsMessage}</p>
            )}

            {/* Store List */}
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-[var(--app-border)] p-2">
              {filteredStores.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--app-text-tertiary)]">No stores match filters.</div>
              ) : (
                filteredStores.map((store) => {
                  const isChecked = selectedOaIds.has(store.lineOfficialAccountId);
                  const isBlocked = store.readinessStatus === "BLOCKED";

                  return (
                    <div
                      key={store.lineOfficialAccountId}
                      onClick={() => handleToggleStore(store.lineOfficialAccountId, store.readinessStatus)}
                      className={`flex items-center gap-2.5 rounded-lg p-2 transition text-left ${
                        isBlocked
                          ? "opacity-60 bg-rose-500/5 cursor-not-allowed"
                          : isChecked
                          ? "bg-[var(--app-accent-soft)] cursor-pointer"
                          : "bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)] cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isBlocked}
                        onChange={() => {}}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-semibold text-[var(--app-text-primary)]">
                            {store.storeName}
                          </span>
                          <span
                            className={`shrink-0 text-[10px] font-bold ${
                              isBlocked ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {store.readinessStatus}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-tertiary)]">
                          <span>ID: {store.externalStoreId || "—"}</span>
                          {store.province && <span>· {store.province}</span>}
                          {isBlocked && (
                            <span className="text-rose-500 font-medium">· {store.readinessReason}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Future Phase 2 Publishing Gate */}
            <div className="pt-2 border-t border-[var(--app-border-subtle)] space-y-2">
              <button
                type="button"
                disabled
                title="Publishing will be enabled in Phase 2"
                className="flex h-10 w-full items-center justify-center rounded-xl bg-gray-400/20 text-xs font-bold text-gray-500 cursor-not-allowed"
              >
                Publishing available in Phase 2
              </button>
              <p className="text-center text-[10px] text-[var(--app-text-tertiary)] leading-tight">
                Phase 1 is Management + Template + Preview + Readiness only. Live LINE OA publishing will be enabled in Phase 2.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
