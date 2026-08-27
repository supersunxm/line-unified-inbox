"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type {
  RichMenuArea,
  RichMenuCanvasPreset,
  RichMenuPreviewResponse,
  RichMenuReadinessResponse,
  RichMenuStoreReadinessItem,
  RichMenuTemplate,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";
import { RICH_MENU_I18N } from "./rich-menu-i18n";

interface RichMenusViewProps {
  language?: Language;
  userRole?: "ADMIN" | "VIEWER";
}

const PRESET_DIMENSIONS: Record<RichMenuCanvasPreset, { width: number; height: number }> = {
  LARGE_6: { width: 2500, height: 1686 },
  LARGE_4: { width: 2500, height: 1686 },
  LARGE_TOP_1_BOTTOM_3: { width: 2500, height: 1686 },
  LARGE_LEFT_1_RIGHT_2: { width: 2500, height: 1686 },
  LARGE_2_ROWS: { width: 2500, height: 1686 },
  LARGE_2_COLS: { width: 2500, height: 1686 },
  LARGE_1: { width: 2500, height: 1686 },

  COMPACT_3: { width: 2500, height: 843 },
  COMPACT_LEFT_SMALL: { width: 2500, height: 843 },
  COMPACT_LEFT_LARGE: { width: 2500, height: 843 },
  COMPACT_2: { width: 2500, height: 843 },
  COMPACT_1: { width: 2500, height: 843 },

  GRID_6: { width: 2500, height: 1686 },
  GRID_4: { width: 2500, height: 1686 },
  GRID_3: { width: 2500, height: 843 },
  CUSTOM: { width: 2500, height: 1686 },
};

const LARGE_PRESETS: RichMenuCanvasPreset[] = [
  "LARGE_6",
  "LARGE_4",
  "LARGE_TOP_1_BOTTOM_3",
  "LARGE_LEFT_1_RIGHT_2",
  "LARGE_2_ROWS",
  "LARGE_2_COLS",
  "LARGE_1",
];

const COMPACT_PRESETS: RichMenuCanvasPreset[] = [
  "COMPACT_3",
  "COMPACT_LEFT_SMALL",
  "COMPACT_LEFT_LARGE",
  "COMPACT_2",
  "COMPACT_1",
];

function generatePresetAreasClient(preset: RichMenuCanvasPreset, width = 2500, height = 1686): RichMenuArea[] {
  switch (preset) {
    case "LARGE_6":
    case "GRID_6":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 833, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 833, y: 0, width: 834, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
        { id: "area-3", bounds: { x: 1667, y: 0, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
        { id: "area-4", bounds: { x: 0, y: 843, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "บริการหลังการขาย", label: "After Sales" },
        { id: "area-5", bounds: { x: 833, y: 843, width: 834, height: 843 }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
        { id: "area-6", bounds: { x: 1667, y: 843, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "สอบถามราคา", label: "Inquire Price" },
      ];
    case "LARGE_4":
    case "GRID_4":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 1250, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 1250, y: 0, width: 1250, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
        { id: "area-3", bounds: { x: 0, y: 843, width: 1250, height: 843 }, actionType: "MESSAGE", actionData: "สินค้าใหม่", label: "New Products" },
        { id: "area-4", bounds: { x: 1250, y: 843, width: 1250, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเรา", label: "Contact Us" },
      ];
    case "LARGE_TOP_1_BOTTOM_3":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 2500, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 0, y: 843, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
        { id: "area-3", bounds: { x: 833, y: 843, width: 834, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
        { id: "area-4", bounds: { x: 1667, y: 843, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "บริการหลังการขาย", label: "After Sales" },
      ];
    case "LARGE_LEFT_1_RIGHT_2":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 1667, height: 1686 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 1667, y: 0, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
        { id: "area-3", bounds: { x: 1667, y: 843, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      ];
    case "LARGE_2_ROWS":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 2500, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 0, y: 843, width: 2500, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
      ];
    case "LARGE_2_COLS":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 1250, height: 1686 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 1250, y: 0, width: 1250, height: 1686 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
      ];
    case "LARGE_1":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 2500, height: 1686 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      ];
    case "COMPACT_3":
    case "GRID_3":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 833, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 833, y: 0, width: 834, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
        { id: "area-3", bounds: { x: 1667, y: 0, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเจ้าหน้าที่", label: "Contact Staff" },
      ];
    case "COMPACT_LEFT_SMALL":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 833, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 833, y: 0, width: 1667, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      ];
    case "COMPACT_LEFT_LARGE":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 1667, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 1667, y: 0, width: 833, height: 843 }, actionType: "MESSAGE", actionData: "โปรโมชั่น", label: "Promotions" },
      ];
    case "COMPACT_2":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 1250, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
        { id: "area-2", bounds: { x: 1250, y: 0, width: 1250, height: 843 }, actionType: "MESSAGE", actionData: "ติดต่อเรา", label: "Contact Us" },
      ];
    case "COMPACT_1":
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: 2500, height: 843 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Store Location" },
      ];
    case "CUSTOM":
    default:
      return [
        { id: "area-1", bounds: { x: 0, y: 0, width: width || 2500, height: height || 1686 }, actionType: "URI", actionData: "{{store.googleMapsUrl}}", label: "Full Area" },
      ];
  }
}

function getAreaLetter(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, D, ...
}

export function RichMenusView({ language = "th", userRole = "ADMIN" }: RichMenusViewProps) {
  const t = RICH_MENU_I18N[language] || RICH_MENU_I18N.th;

  // Preset labels/descriptions localized
  const presetLabels: Record<RichMenuCanvasPreset, { label: string; description: string }> = useMemo(
    () => ({
      LARGE_6: { label: t.presetLarge6, description: "2500 × 1686 px" },
      LARGE_4: { label: t.presetLarge4, description: "2500 × 1686 px" },
      LARGE_TOP_1_BOTTOM_3: { label: t.presetLargeTop1Bottom3, description: "2500 × 1686 px" },
      LARGE_LEFT_1_RIGHT_2: { label: t.presetLargeLeft1Right2, description: "2500 × 1686 px" },
      LARGE_2_ROWS: { label: t.presetLarge2Rows, description: "2500 × 1686 px" },
      LARGE_2_COLS: { label: t.presetLarge2Cols, description: "2500 × 1686 px" },
      LARGE_1: { label: t.presetLarge1, description: "2500 × 1686 px" },
      COMPACT_3: { label: t.presetCompact3, description: "2500 × 843 px" },
      COMPACT_LEFT_SMALL: { label: t.presetCompactLeftSmall, description: "2500 × 843 px" },
      COMPACT_LEFT_LARGE: { label: t.presetCompactLeftLarge, description: "2500 × 843 px" },
      COMPACT_2: { label: t.presetCompact2, description: "2500 × 843 px" },
      COMPACT_1: { label: t.presetCompact1, description: "2500 × 843 px" },
      GRID_6: { label: t.presetLarge6, description: "2500 × 1686 px" },
      GRID_4: { label: t.presetLarge4, description: "2500 × 1686 px" },
      GRID_3: { label: t.presetCompact3, description: "2500 × 843 px" },
      CUSTOM: { label: t.presetCustom, description: "2500 × 1686 px" },
    }),
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
  const [formPreset, setFormPreset] = useState<RichMenuCanvasPreset>("LARGE_6");
  const [formWidth, setFormWidth] = useState(2500);
  const [formHeight, setFormHeight] = useState(1686);
  const [formSelected, setFormSelected] = useState(true);
  const [formChatBarText, setFormChatBarText] = useState("Menu");
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [formAreas, setFormAreas] = useState<RichMenuArea[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string>("area-1");
  const [showOutline, setShowOutline] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Template Change Modal
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [modalSelectedPreset, setModalSelectedPreset] = useState<RichMenuCanvasPreset>("LARGE_6");

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

  // Phase 2A: Single-Store Canary Publishing State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStage, setPublishStage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Phase 2A: Rollback Modal State
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackAttemptId, setRollbackAttemptId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // Computed Canary Publish eligibility
  const singleSelectedOaId = selectedOaIds.size === 1 ? Array.from(selectedOaIds)[0] : null;
  const singleSelectedStoreItem = useMemo(() => {
    if (!singleSelectedOaId || !readinessData?.items) return null;
    return readinessData.items.find((i) => i.lineOfficialAccountId === singleSelectedOaId) || null;
  }, [singleSelectedOaId, readinessData]);

  const isCanaryPublishEligible = Boolean(
    userRole === "ADMIN" &&
      selectedTemplateId &&
      selectedTemplateId !== "new" &&
      formImageUrl &&
      singleSelectedStoreItem &&
      singleSelectedStoreItem.readinessStatus === "READY",
  );

  const rollbackTargetStoreItem = useMemo(() => {
    if (!rollbackAttemptId || !readinessData?.items) return null;
    return readinessData.items.find((i) => i.publishAttemptId === rollbackAttemptId) || null;
  }, [rollbackAttemptId, readinessData]);

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
    setFormPreset("LARGE_6");
    setFormWidth(2500);
    setFormHeight(1686);
    setFormSelected(true);
    setFormChatBarText(t.menuBarDefault);
    setFormImageUrl(null);
    const presetAreas = generatePresetAreasClient("LARGE_6", 2500, 1686);
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
    setFormSelected(tmpl.selected !== false);
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

    setImageError(null);

    const isJpegOrPng =
      file.type === "image/jpeg" ||
      file.type === "image/png" ||
      file.type === "image/jpg" ||
      /\.(jpe?g|png)$/i.test(file.name);

    if (!isJpegOrPng) {
      setImageError(t.unsupportedFormatError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      setImageError(t.imageSizeError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      const res = await api.uploadRichMenuImage(file, formPreset);
      setFormImageUrl(res.imageUrl);
      setFormWidth(res.width);
      setFormHeight(res.height);
    } catch (err: any) {
      setImageError(err.message || t.imageUploadError);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        selected: formSelected,
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

  // Phase 2A: Handle Canary Publish
  const handlePublishCanary = async () => {
    if (!selectedTemplateId || selectedTemplateId === "new" || !singleSelectedOaId) return;

    setPublishing(true);
    setPublishError(null);
    setPublishStage(t.stageValidating);
    try {
      await api.publishCanaryRichMenu(selectedTemplateId, singleSelectedOaId);
      setSaveMessage({ type: "success", text: t.publishSuccess });
      setIsPublishModalOpen(false);
      await loadReadiness(selectedTemplateId);
    } catch (err: any) {
      setPublishError(err.message || t.failedPublish);
    } finally {
      setPublishing(false);
      setPublishStage(null);
    }
  };

  // Phase 2A: Handle Rollback
  const handleRollback = async () => {
    if (!rollbackAttemptId || !selectedTemplateId) return;

    setRollingBack(true);
    try {
      await api.rollbackRichMenuPublish(rollbackAttemptId);
      setSaveMessage({ type: "success", text: t.rollbackSuccess });
      setIsRollbackModalOpen(false);
      setRollbackAttemptId(null);
      await loadReadiness(selectedTemplateId);
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || t.failedRollback });
    } finally {
      setRollingBack(false);
    }
  };

  // Phase 2A: Handle Retry
  const handleRetry = async (attemptId: string) => {
    if (!selectedTemplateId) return;

    setPublishing(true);
    try {
      await api.retryRichMenuPublish(attemptId);
      setSaveMessage({ type: "success", text: t.publishSuccess });
      await loadReadiness(selectedTemplateId);
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message || t.failedPublish });
    } finally {
      setPublishing(false);
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
              <span className="text-[11px] font-semibold text-[#06C755] bg-[#06C755]/10 px-2 py-0.5 rounded">
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

            {/* Canary Publish Button */}
            {userRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(true)}
                disabled={!isCanaryPublishEligible || publishing}
                title={
                  selectedOaIds.size === 0
                    ? t.selectSingleStoreToPublish
                    : selectedOaIds.size > 1
                    ? t.publishCanaryNoticeSingle
                    : !formImageUrl
                    ? t.uploadImageFirst
                    : !selectedTemplateId || selectedTemplateId === "new"
                    ? t.saveTemplateFirst
                    : undefined
                }
                className="inline-flex items-center justify-center gap-1.5 rounded border border-[#06C755] bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#06C755] dark:text-[#06C755] px-4 py-2 text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {publishing ? t.publishingToLine : t.publishToLine}
              </button>
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
              disabled={loadingTemplates}
              className="h-8 rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface-subtle)] px-2.5 text-xs text-gray-900 dark:text-gray-100 font-medium focus:border-[#06C755] focus:outline-none"
            >
              <option value="new">{t.newTemplateOption}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({tmpl.assignedStoresCount || 0} stores)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={initNewTemplate}
            className="rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-gray-50 dark:bg-[var(--app-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[var(--app-surface-hover)] transition"
          >
            {t.newTemplateButton}
          </button>
        </div>

        {/* 2. Main Settings Section */}
        <section className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-5 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)] pb-2.5">
            {t.mainSettings}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Title */}
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t.title} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t.titlePlaceholder}
                className="h-9 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-3 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-[#06C755] focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">{t.titleHint}</p>
            </div>

            {/* Display Period */}
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                {t.displayPeriod}
              </label>
              <div className="flex items-center gap-2 h-9">
                <span className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t.notConfiguredPhase1}
                </span>
                <span className="text-[11px] text-gray-400">{t.displayPeriodHint}</span>
              </div>
            </div>
          </div>

          {/* Advanced description toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1.5"
            >
              <span>{showAdvancedSettings ? "▾" : "▸"}</span>
              <span>{t.advancedSettings}</span>
            </button>
            {showAdvancedSettings && (
              <div className="mt-2.5 max-w-xl">
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  rows={2}
                  className="w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-2.5 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-[#06C755] focus:outline-none"
                />
              </div>
            )}
          </div>
        </section>

        {/* 3. Menu Content Section (Full Layout Editor) */}
        <section className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)] pb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t.menuContent}</h2>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">{t.templateLabel}:</span>
              <span className="rounded bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-bold text-gray-800 dark:text-gray-200">
                {presetLabels[formPreset]?.label || formPreset} ({t.areasCount(formAreas.length)})
              </span>
              <button
                type="button"
                onClick={() => {
                  setModalSelectedPreset(formPreset);
                  setIsPresetModalOpen(true);
                }}
                className="rounded border border-[#06C755] bg-white dark:bg-[var(--app-surface)] px-3 py-1 text-xs font-bold text-[#06C755] hover:bg-[#06C755]/5 transition"
              >
                {t.changeTemplate}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Visual Canvas & Image Upload */}
            <div className="lg:col-span-5 space-y-4">
              {/* Preview Store Selector */}
              <div className="rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-[#fafafa] dark:bg-[var(--app-surface-subtle)] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-300">{t.previewAs}</span>
                  {selectedStoreItem && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        selectedStoreItem.readinessStatus === "READY"
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
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
                    if (selectedTemplateId && selectedTemplateId !== "new") {
                      void loadPreview(selectedTemplateId, e.target.value);
                    }
                  }}
                  className="h-8 w-full rounded border border-[#d1d5db] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] px-2 text-xs text-gray-900 dark:text-gray-100 font-medium focus:border-[#06C755] focus:outline-none"
                >
                  {readinessData?.items.map((store) => (
                    <option key={store.lineOfficialAccountId} value={store.lineOfficialAccountId}>
                      {store.storeName} ({store.lineOfficialAccountName}) {store.externalStoreId ? `[${store.externalStoreId}]` : ""}
                    </option>
                  ))}
                </select>
                {selectedStoreItem && (
                  <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    <span>
                      {t.storeId}: <strong className="text-gray-700 dark:text-gray-300">{selectedStoreItem.externalStoreId || "—"}</strong>
                    </span>
                    <span>
                      {t.googleMaps}:{" "}
                      <strong className={selectedStoreItem.googleMapsUrl ? "text-emerald-600" : "text-rose-500"}>
                        {selectedStoreItem.googleMapsUrl ? t.configured : t.notConfigured}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Rich Menu Canvas (Aspect Ratio Preserved) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-300">{t.preview}</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-500 select-none">
                    <input
                      type="checkbox"
                      checked={showOutline}
                      onChange={(e) => setShowOutline(e.target.checked)}
                      className="rounded border-gray-300 text-[#06C755] focus:ring-[#06C755]"
                    />
                    <span>{t.showTemplateOutline}</span>
                  </label>
                </div>

                <div
                  className="relative w-full overflow-hidden rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 shadow-inner"
                  style={{
                    aspectRatio: `${formWidth} / ${formHeight}`,
                  }}
                >
                  {/* Background Image */}
                  {formImageUrl ? (
                    <img
                      src={formImageUrl}
                      alt={formName}
                      className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-gray-400">
                      <span className="text-2xl mb-1">🖼</span>
                      <span className="text-xs font-medium">{t.noImageUploaded(formWidth, formHeight)}</span>
                    </div>
                  )}

                  {/* Interactive Area Overlays */}
                  {formAreas.map((area, index) => {
                    const letter = getAreaLetter(index);
                    const isActive = area.id === activeAreaId;
                    const leftPct = (area.bounds.x / formWidth) * 100;
                    const topPct = (area.bounds.y / formHeight) * 100;
                    const widthPct = (area.bounds.width / formWidth) * 100;
                    const heightPct = (area.bounds.height / formHeight) * 100;

                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => setActiveAreaId(area.id)}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${widthPct}%`,
                          height: `${heightPct}%`,
                        }}
                        className={`absolute flex flex-col items-center justify-center transition-all ${
                          showOutline ? "border border-dashed" : "border-none"
                        } ${
                          isActive
                            ? "border-2 border-[#06C755] bg-[#06C755]/20 shadow-md z-10"
                            : "border-gray-400/80 hover:bg-black/10 z-0"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                            isActive
                              ? "bg-[#06C755] text-white"
                              : "bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {letter}
                        </span>
                        {area.label && (
                          <span className="mt-1 max-w-[85%] truncate rounded bg-black/60 px-1 text-[10px] font-medium text-white shadow-xs">
                            {area.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Chat Bar Mockup */}
                <div className="flex items-center justify-between rounded bg-[#eef1f4] dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="text-gray-400">≡</span>
                    <span>{formChatBarText || t.menuBarDefault}</span>
                  </span>
                  <span className="text-[10px] text-gray-400">▲</span>
                </div>
              </div>

              {/* Image Upload Box */}
              <div className="rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{t.image}</span>
                  {formImageUrl && (
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {t.imageUploaded(formWidth, formHeight)}
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="rounded bg-[#06C755] hover:bg-[#05b34c] text-white px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-50"
                  >
                    {uploadingImage ? t.uploadingImage : formImageUrl ? t.replaceImage : t.selectImage}
                  </button>
                  {formImageUrl && (
                    <button
                      type="button"
                      onClick={() => setFormImageUrl(null)}
                      className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      {t.removeImage}
                    </button>
                  )}
                </div>

                {imageError ? (
                  <p className="text-[11px] font-medium text-rose-600">{imageError}</p>
                ) : (
                  <p className="text-[11px] text-gray-400">{t.noImageSelected}</p>
                )}
              </div>
            </div>

            {/* Right Column: Actions Editor for each Area */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#f3f4f6] dark:border-[var(--app-border-subtle)] pb-2.5">
                  <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    {t.actions} ({t.areasCount(formAreas.length)})
                  </h3>
                  <span className="text-xs font-mono text-gray-400">
                    {formWidth} × {formHeight} px
                  </span>
                </div>

                {/* Area Tabs / Cards */}
                <div className="space-y-3">
                  {formAreas.map((area, index) => {
                    const letter = getAreaLetter(index);
                    const isActive = area.id === activeAreaId;
                    const previewAreaResolved = previewData?.areas?.find((a) => a.id === area.id);

                    return (
                      <div
                        key={area.id}
                        onClick={() => setActiveAreaId(area.id)}
                        className={`rounded-lg border p-3.5 transition ${
                          isActive
                            ? "border-[#06C755] bg-[#06C755]/5 shadow-xs"
                            : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[var(--app-surface)] hover:border-gray-300"
                        }`}
                      >
                        {/* Area Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                                isActive ? "bg-[#06C755] text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              Area {letter} ({area.bounds.width} × {area.bounds.height} px)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <label className="text-gray-500 text-[11px] font-medium">{t.actionType}:</label>
                            <select
                              value={area.actionType}
                              onChange={(e) => updateArea(area.id, { actionType: e.target.value as "URI" | "MESSAGE" })}
                              className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-2 text-xs font-semibold text-gray-800 dark:text-gray-200 focus:border-[#06C755] focus:outline-none"
                            >
                              <option value="URI">{t.actionTypeUri}</option>
                              <option value="MESSAGE">{t.actionTypeMessage}</option>
                            </select>
                          </div>
                        </div>

                        {/* Action Value Input with Variable Insertion */}
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-gray-700 dark:text-gray-300">
                              {area.actionType === "URI" ? t.url : t.message} <span className="text-rose-500">*</span>
                            </label>

                            {/* Variable Injection Dropdown */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVariableDropdownOpenFor(
                                    variableDropdownOpenFor === area.id ? null : area.id,
                                  );
                                }}
                                className="text-[11px] font-semibold text-[#06C755] hover:underline"
                              >
                                {t.insertVariable}
                              </button>

                              {variableDropdownOpenFor === area.id && (
                                <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg text-xs">
                                  <button
                                    type="button"
                                    onClick={() => insertToken(area.id, "{{store.googleMapsUrl}}")}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex flex-col"
                                  >
                                    <span className="font-bold">{t.varGoogleMapsUrl}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{"{{store.googleMapsUrl}}"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => insertToken(area.id, "{{store.storeName}}")}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex flex-col border-t border-gray-100 dark:border-gray-700/50"
                                  >
                                    <span className="font-bold">{t.varStoreName}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{"{{store.storeName}}"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => insertToken(area.id, "{{store.lineUrl}}")}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex flex-col border-t border-gray-100 dark:border-gray-700/50"
                                  >
                                    <span className="font-bold">{t.varLineUrl}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{"{{store.lineUrl}}"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => insertToken(area.id, "{{store.tiktokUrl}}")}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 flex flex-col border-t border-gray-100 dark:border-gray-700/50"
                                  >
                                    <span className="font-bold">{t.varTiktokUrl}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{"{{store.tiktokUrl}}"}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <input
                            type="text"
                            value={area.actionData}
                            onChange={(e) => updateArea(area.id, { actionData: e.target.value })}
                            placeholder={area.actionType === "URI" ? t.urlPlaceholder : t.messagePlaceholder}
                            className="h-8 w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-2.5 text-xs text-gray-900 dark:text-gray-100 font-mono focus:border-[#06C755] focus:outline-none"
                          />
                        </div>

                        {/* Live Resolution Preview */}
                        {isActive && (
                          <div className="mt-2.5 rounded bg-gray-50 dark:bg-gray-900/40 p-2 text-xs border border-gray-100 dark:border-gray-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-gray-500">
                                {t.resolvedFor} {selectedStoreItem?.storeName || "—"}:
                              </span>
                              {previewAreaResolved && (
                                <span
                                  className={`font-semibold ${
                                    previewAreaResolved.isValid ? "text-emerald-600" : "text-rose-600"
                                  }`}
                                >
                                  {previewAreaResolved.isValid
                                    ? t.valid
                                    : t.invalid(
                                        previewAreaResolved.validationError === "Missing Google Maps URL"
                                          ? t.missingGoogleMapsReason
                                          : previewAreaResolved.validationError === "Invalid Google Maps URL"
                                          ? t.invalidGoogleMapsReason
                                          : previewAreaResolved.validationError || "",
                                      )}
                                </span>
                              )}
                            </div>
                            <p className="truncate font-mono text-[11px] text-gray-700 dark:text-gray-300">
                              {previewAreaResolved?.resolvedActionData || area.actionData || t.emptyValue}
                            </p>
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
                        <input
                          type="radio"
                          name="defaultBehavior"
                          checked={formSelected === true}
                          onChange={() => setFormSelected(true)}
                          className="text-[#06C755] focus:ring-[#06C755]"
                        />
                        <span>{t.behaviorShow}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="defaultBehavior"
                          checked={formSelected === false}
                          onChange={() => setFormSelected(false)}
                          className="text-[#06C755] focus:ring-[#06C755]"
                        />
                        <span>{t.behaviorCollapsed}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Target Stores Section (Store Readiness & Publish Table) */}
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

              {/* Publish Canary in Target Stores Bar */}
              {userRole === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(true)}
                  disabled={!isCanaryPublishEligible || publishing}
                  className="inline-flex items-center justify-center gap-1 rounded bg-[#06C755] hover:bg-[#05b34c] text-white px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  {publishing ? t.publishingToLine : t.publishToLine}
                </button>
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
                  <th className="w-32 px-3 py-2.5">{t.colStatus}</th>
                  <th className="w-48 px-3 py-2.5">{t.colPublishStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6] dark:divide-[var(--app-border-subtle)]">
                {loadingReadiness ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-xs text-gray-400">
                      {t.evaluatingReadiness}
                    </td>
                  </tr>
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-xs text-gray-400">
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
                        {/* Publish Status Column */}
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          {store.publishStatus === "PUBLISHED" ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {t.statusPublished}
                              </span>
                              {userRole === "ADMIN" && store.publishAttemptId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRollbackAttemptId(store.publishAttemptId!);
                                    setIsRollbackModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-rose-600 hover:underline"
                                >
                                  {t.rollbackButton}
                                </button>
                              )}
                            </div>
                          ) : store.publishStatus === "FAILED" ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-col">
                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                  {t.statusFailed}
                                </span>
                                {store.lastPublishError && (
                                  <span
                                    className="text-[10px] text-rose-500 truncate max-w-[100px]"
                                    title={store.lastPublishError}
                                  >
                                    {store.lastPublishError}
                                  </span>
                                )}
                              </div>
                              {userRole === "ADMIN" && store.publishAttemptId && (
                                <button
                                  type="button"
                                  onClick={() => handleRetry(store.publishAttemptId!)}
                                  disabled={publishing}
                                  className="text-[10px] font-bold text-[#06C755] hover:underline"
                                >
                                  {t.retryPublishButton}
                                </button>
                              )}
                            </div>
                          ) : store.publishStatus === "ROLLED_BACK" ? (
                            <span className="text-gray-400 font-medium">{t.statusRolledBack}</span>
                          ) : [
                              "PENDING",
                              "VALIDATING",
                              "CREATING",
                              "IMAGE_UPLOADING",
                              "SETTING_DEFAULT",
                              "VERIFYING",
                              "ROLLING_BACK",
                            ].includes(store.publishStatus || "") ? (
                            <span className="font-semibold text-amber-600 animate-pulse">
                              {t.publishingToLine}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">{t.statusNotPublished}</span>
                          )}
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

      {/* 5. Select a Template Modal (Full LINE OA Manager 12-Preset Template Set) */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] shadow-2xl flex flex-col overflow-hidden"
            style={{
              width: "min(1080px, calc(100vw - 40px))",
              maxHeight: "calc(100vh - 32px)",
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.selectTemplateTitle}</h3>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Template Gallery */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
              {/* Group 1: Large (7 templates) */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t.templateGroupLarge}</h4>
                    <span className="text-xs text-gray-500 font-normal">{t.templateGroupLargeDims}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.templateGroupLargeDesc}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {LARGE_PRESETS.map((preset) => {
                    const isSelected = modalSelectedPreset === preset;
                    const meta = presetLabels[preset];
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setModalSelectedPreset(preset)}
                        className={`group relative flex flex-col items-center rounded-lg border-2 p-3 text-center transition ${
                          isSelected
                            ? "border-[#06C755] bg-[#06C755]/5 shadow-sm"
                            : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[var(--app-surface)] hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="relative w-full overflow-hidden rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mb-2.5"
                          style={{ aspectRatio: "2500 / 1686" }}
                        >
                          {generatePresetAreasClient(preset).map((area, idx) => {
                            const letter = getAreaLetter(idx);
                            const lPct = (area.bounds.x / 2500) * 100;
                            const tPct = (area.bounds.y / 1686) * 100;
                            const wPct = (area.bounds.width / 2500) * 100;
                            const hPct = (area.bounds.height / 1686) * 100;
                            return (
                              <div
                                key={area.id}
                                style={{
                                  left: `${lPct}%`,
                                  top: `${tPct}%`,
                                  width: `${wPct}%`,
                                  height: `${hPct}%`,
                                }}
                                className="absolute border border-gray-300 dark:border-gray-700 flex items-center justify-center bg-white/60 dark:bg-black/40"
                              >
                                <span className="text-[10px] font-bold text-gray-500">{letter}</span>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#06C755]">
                          {meta?.label || preset}
                        </span>
                        <span className="text-[10px] text-gray-400">{meta?.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Compact (5 templates) */}
              <div className="space-y-3 pt-4 border-t border-[#f3f4f6] dark:border-[var(--app-border-subtle)]">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{t.templateGroupCompact}</h4>
                    <span className="text-xs text-gray-500 font-normal">{t.templateGroupCompactDims}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.templateGroupCompactDesc}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {COMPACT_PRESETS.map((preset) => {
                    const isSelected = modalSelectedPreset === preset;
                    const meta = presetLabels[preset];
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setModalSelectedPreset(preset)}
                        className={`group relative flex flex-col items-center rounded-lg border-2 p-3 text-center transition ${
                          isSelected
                            ? "border-[#06C755] bg-[#06C755]/5 shadow-sm"
                            : "border-gray-200 dark:border-gray-800 bg-white dark:bg-[var(--app-surface)] hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="relative w-full overflow-hidden rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mb-2.5"
                          style={{ aspectRatio: "2500 / 843" }}
                        >
                          {generatePresetAreasClient(preset).map((area, idx) => {
                            const letter = getAreaLetter(idx);
                            const lPct = (area.bounds.x / 2500) * 100;
                            const tPct = (area.bounds.y / 843) * 100;
                            const wPct = (area.bounds.width / 2500) * 100;
                            const hPct = (area.bounds.height / 843) * 100;
                            return (
                              <div
                                key={area.id}
                                style={{
                                  left: `${lPct}%`,
                                  top: `${tPct}%`,
                                  width: `${wPct}%`,
                                  height: `${hPct}%`,
                                }}
                                className="absolute border border-gray-300 dark:border-gray-700 flex items-center justify-center bg-white/60 dark:bg-black/40"
                              >
                                <span className="text-[10px] font-bold text-gray-500">{letter}</span>
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#06C755]">
                          {meta?.label || preset}
                        </span>
                        <span className="text-[10px] text-gray-400">{meta?.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4 bg-gray-50 dark:bg-[var(--app-surface-subtle)]">
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(modalSelectedPreset)}
                className="rounded bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2 text-xs font-bold transition shadow-xs"
              >
                {t.apply}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Phase 2A: Single-Store Canary Publish Confirmation Modal */}
      {isPublishModalOpen && singleSelectedStoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span>🚀</span>
                <span>{t.publishCanaryModalTitle}</span>
              </h3>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {t.publishCanaryModalDesc}
              </p>

              {/* Target Details Card */}
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[var(--app-surface-subtle)] p-3.5 space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.selectedStore}:</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {singleSelectedStoreItem.storeName} ({singleSelectedStoreItem.externalStoreId || "—"})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.selectedLineOa}:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {singleSelectedStoreItem.lineOfficialAccountName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.selectedTemplate}:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{formName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t.colStatus}:</span>
                  <span className="font-bold text-emerald-600">{t.statusReady}</span>
                </div>
              </div>

              {publishStage && (
                <div className="flex items-center gap-2 rounded bg-emerald-50 dark:bg-emerald-950/50 p-2.5 text-emerald-700 dark:text-emerald-300 font-semibold animate-pulse">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{publishStage}</span>
                </div>
              )}

              {publishError && (
                <div className="rounded bg-rose-50 dark:bg-rose-950/50 p-3 text-rose-600 dark:text-rose-400 font-medium">
                  {publishError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4 bg-gray-50 dark:bg-[var(--app-surface-subtle)]">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                disabled={publishing}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handlePublishCanary}
                disabled={publishing}
                className="rounded bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {publishing ? t.publishingToLine : t.confirmAndPublish}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Phase 2A: Rollback Confirmation Modal */}
      {isRollbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-lg border border-[#e5e7eb] dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <span>↩</span>
                <span>{t.rollbackModalTitle}</span>
              </h3>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {t.rollbackModalDesc}
              </p>

              {rollbackTargetStoreItem && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[var(--app-surface-subtle)] p-3.5 space-y-2 font-medium">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t.selectedStore}:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {rollbackTargetStoreItem.storeName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t.selectedLineOa}:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {rollbackTargetStoreItem.lineOfficialAccountName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] dark:border-[var(--app-border)] px-6 py-4 bg-gray-50 dark:bg-[var(--app-surface-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setIsRollbackModalOpen(false);
                  setRollbackAttemptId(null);
                }}
                disabled={rollingBack}
                className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleRollback}
                disabled={rollingBack}
                className="rounded bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {rollingBack ? t.stageRollingBack : t.confirmRollback}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
