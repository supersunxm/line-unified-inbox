"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  LoadingState,
  MetricCard,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { api } from "@/lib/api";
import type {
  ApiStore,
  MassMessageAudienceType,
  MassMessageCampaignDetail,
  MassMessagePreviewResult,
  MassMessageStoreMode,
  StoreDeliveryDetail,
} from "@/types/api";
import {
  getMassMessagesText,
  type Language,
} from "./mass-messages-translations";

const MAX_MESSAGE_LENGTH = 5000;

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function MassMessagesView({
  language = "en",
  userRole,
}: {
  language?: Language;
  userRole: "ADMIN" | "VIEWER";
}) {
  const t = getMassMessagesText(language);
  const isAuthorized = userRole === "ADMIN";

  // Navigation & View mode: "compose" | "progress" | "history"
  const [viewMode, setViewMode] = useState<"compose" | "progress" | "history">("compose");

  // Stores Data
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Form State
  const [storeMode, setStoreMode] = useState<MassMessageStoreMode>("ALL");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [audienceType, setAudienceType] = useState<MassMessageAudienceType>("ALL_KNOWN");
  const [messageText, setMessageText] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [attachedImage, setAttachedImage] = useState<{
    url: string;
    previewUrl: string;
    name: string;
    size: number;
  } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [preview, setPreview] = useState<MassMessagePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showSkippedStores, setShowSkippedStores] = useState(false);

  // Confirm Modal & Submission
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeCampaignRequestId, setActiveCampaignRequestId] = useState<string | null>(null);

  // Active Campaign Progress & History
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeCampaign, setActiveCampaign] = useState<MassMessageCampaignDetail | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<MassMessageCampaignDetail[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch initial stores list
  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    setStoresLoading(true);
    api
      .stores()
      .then((data) => {
        if (active) setStores(data || []);
      })
      .catch((err) => {
        console.error("Failed to load stores for mass message", err);
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthorized]);

  // Filtered stores for picker
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.storeId && s.storeId.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q)),
    );
  }, [stores, storeSearch]);

  // Trigger preview calculation with debounce
  const calculatePreview = useCallback(async () => {
    if (!isAuthorized) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await api.previewMassMessage({
        storeSelection: {
          mode: storeMode,
          storeIds: storeMode === "ALL" ? undefined : selectedStoreIds,
        },
        audienceType,
      });
      setPreview(res);
    } catch (err: any) {
      console.error("Preview failed", err);
      setPreviewError(err?.message || t.previewError);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [isAuthorized, storeMode, selectedStoreIds, audienceType, t.previewError]);

  useEffect(() => {
    if (viewMode !== "compose" || !isAuthorized) return;
    const timer = setTimeout(() => {
      void calculatePreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [calculatePreview, viewMode, isAuthorized]);

  // Polling for active campaign
  useEffect(() => {
    if (viewMode !== "progress" || !activeCampaignId || !isAuthorized) return;
    let active = true;

    const fetchCampaign = async () => {
      try {
        const data = await api.getMassMessageCampaign(activeCampaignId);
        if (!active) return;
        setActiveCampaign(data);

        // Stop polling if in terminal state
        if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(data.status)) {
          return;
        }

        // Poll every 2 seconds while running
        setTimeout(() => {
          if (active) void fetchCampaign();
        }, 2000);
      } catch (err) {
        console.error("Failed to poll campaign status", err);
      }
    };

    void fetchCampaign();

    return () => {
      active = false;
    };
  }, [activeCampaignId, viewMode, isAuthorized]);

  // Fetch campaign history
  const loadHistory = useCallback(async () => {
    if (!isAuthorized) return;
    setHistoryLoading(true);
    try {
      const res = await api.listMassMessageCampaigns(50, 0);
      setHistoryItems(res.items || []);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthorized]);

  const handleOpenHistory = () => {
    setViewMode("history");
    void loadHistory();
  };

  const handleCreateNew = () => {
    setViewMode("compose");
    setActiveCampaignId(null);
    setActiveCampaign(null);
    setMessageText("");
    setCampaignTitle("");
    setAttachedImage(null);
    setImageUploadError(null);
  };

  // Store selection handlers
  const handleSelectAllStores = () => {
    setSelectedStoreIds(filteredStores.map((s) => s.id));
  };

  const handleDeselectAllStores = () => {
    setSelectedStoreIds([]);
  };

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId],
    );
  };

  // Image Upload Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow re-selecting same file
    e.target.value = "";

    // Validation: Type
    const validTypes = ["image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setImageUploadError(t.imageInvalidFormat);
      return;
    }

    // Validation: Size (Max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setImageUploadError(t.imageTooLarge);
      return;
    }

    setImageUploadError(null);
    setIsUploadingImage(true);

    try {
      const uploadRes = await api.uploadMassMessageImage(file);
      setAttachedImage({
        url: uploadRes.url,
        previewUrl: uploadRes.previewUrl || uploadRes.url,
        name: file.name,
        size: file.size,
      });
    } catch (err: any) {
      console.error("Image upload failed", err);
      setImageUploadError(err?.message || t.imageUploadFailed);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setImageUploadError(null);
  };

  const handleReplaceImage = () => {
    fileInputRef.current?.click();
  };

  // Validation: Check if there is either text or image content
  const hasContent = Boolean(messageText.trim() || attachedImage);

  // Send action triggers confirm modal
  const handleOpenConfirm = () => {
    if (!preview || preview.eligibleStoreCount === 0 || preview.estimatedRecipientCount === 0) {
      return;
    }
    if (!hasContent) {
      return;
    }
    setSendError(null);
    setActiveCampaignRequestId(generateUUID());
    setShowConfirmModal(true);
  };

  // Explicit confirmation submit
  const handleConfirmSend = async () => {
    if (!activeCampaignRequestId || sending) return;
    setSending(true);
    setSendError(null);

    const messages: Array<
      | { type: "text"; text: string }
      | { type: "image"; originalContentUrl: string; previewImageUrl: string }
    > = [];

    if (messageText.trim()) {
      messages.push({ type: "text", text: messageText.trim() });
    }
    if (attachedImage) {
      messages.push({
        type: "image",
        originalContentUrl: attachedImage.url,
        previewImageUrl: attachedImage.previewUrl,
      });
    }

    try {
      const created = await api.createMassMessage({
        campaignRequestId: activeCampaignRequestId,
        title: campaignTitle.trim() || undefined,
        storeSelection: {
          mode: storeMode,
          storeIds: storeMode === "ALL" ? undefined : selectedStoreIds,
        },
        audienceType,
        messages,
      });

      setShowConfirmModal(false);
      setActiveCampaignId(created.id);
      setActiveCampaign(created);
      setViewMode("progress");
    } catch (err: any) {
      console.error("Failed to create campaign", err);
      setSendError(err?.message || "Failed to dispatch campaign");
    } finally {
      setSending(false);
    }
  };

  // Helper for human-readable skip reason
  const getSkipReasonLabel = (reason: string | null) => {
    if (!reason) return t.skipReasonUnknown;
    switch (reason) {
      case "MISSING_TOKEN":
        return t.skipReasonMissingToken;
      case "NO_RECIPIENTS":
        return t.skipReasonNoRecipients;
      case "STORE_NOT_ACTIVE":
      case "INVALID_CONNECTION":
        return t.skipReasonInactive;
      case "UNAUTHORIZED":
        return t.skipReasonUnauthorized;
      default:
        return reason;
    }
  };

  // Render Access Restricted
  if (!isAuthorized) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[var(--app-radius-xl)] bg-[var(--app-warning-soft)] text-[var(--app-warning)] mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[var(--app-text-primary)]">{t.accessRestrictedTitle}</h2>
          <p className="mt-1 max-w-md text-xs text-[var(--app-text-secondary)]">{t.accessRestrictedDesc}</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Workspace Header */}
      <PageHeader
        tag="OPPO LINE OA · การส่งข้อความบรอดแคสต์"
        title={t.pageTitle}
        description={t.pageSubtitle}
        actionSlot={
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="md" variant="accent" dot>
              {t.adminOnlyBadge}
            </Badge>
            {viewMode !== "compose" && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateNew}
              >
                + {t.createNewCampaignButton}
              </Button>
            )}
            {viewMode !== "history" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenHistory}
              >
                {t.viewHistoryButton}
              </Button>
            )}
            {viewMode === "history" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewMode("compose")}
              >
                กลับไปหน้าสร้างข้อความ
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content Area */}
      <div className="space-y-6">
        {viewMode === "compose" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 max-w-7xl mx-auto">
            {/* Left Column: Form Configuration */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Store Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.sectionStoresTitle}</CardTitle>
                  <CardDescription>เลือกสาขาที่จะส่งข้อความบรอดแคสต์</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Mode: ALL */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-[var(--app-radius-lg)] border p-3.5 transition-all ${
                      storeMode === "ALL"
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20"
                        : "border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storeMode"
                      checked={storeMode === "ALL"}
                      onChange={() => setStoreMode("ALL")}
                      className="mt-0.5 h-4 w-4 accent-[var(--app-accent)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-[var(--app-text-primary)]">
                        {t.storeModeAll}
                      </span>
                      <p className="mt-0.5 text-xs text-[var(--app-text-secondary)]">
                        {t.storeModeAllDesc}
                      </p>
                    </div>
                  </label>

                  {/* Mode: Selected Stores */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-[var(--app-radius-lg)] border p-3.5 transition-all ${
                      storeMode === "MULTIPLE"
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20"
                        : "border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storeMode"
                      checked={storeMode === "MULTIPLE"}
                      onChange={() => setStoreMode("MULTIPLE")}
                      className="mt-0.5 h-4 w-4 accent-[var(--app-accent)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-[var(--app-text-primary)]">
                        {t.storeModeSelected}
                      </span>

                      {storeMode === "MULTIPLE" && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-[var(--app-border-subtle)]">
                          {/* Store Search & Selection Controls */}
                          <div className="flex items-center justify-between gap-2">
                            <SearchInput
                              value={storeSearch}
                              onChange={(e) => setStoreSearch(e.target.value)}
                              placeholder={t.searchStoresPlaceholder}
                              className="h-8 flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleSelectAllStores}
                              className="text-[11px] shrink-0"
                            >
                              {t.selectAllStores}
                            </Button>
                            <span className="text-[var(--app-border-strong)]">|</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleDeselectAllStores}
                              className="text-[11px] text-[var(--app-text-secondary)] shrink-0"
                            >
                              {t.deselectAllStores}
                            </Button>
                          </div>

                          <p className="text-[11px] font-medium text-[var(--app-text-secondary)]">
                            {t.selectedStoresCount(selectedStoreIds.length, stores.length)}
                          </p>

                          {/* Store List */}
                          <div className="max-h-48 overflow-y-auto rounded-[var(--app-radius-md)] border border-[var(--app-border)] divide-y divide-[var(--app-border-subtle)] bg-[var(--app-surface)]">
                            {filteredStores.length === 0 ? (
                              <p className="p-3 text-center text-xs text-[var(--app-text-tertiary)]">
                                {storesLoading ? "Loading stores..." : t.noStoresFound}
                              </p>
                            ) : (
                              filteredStores.map((store) => {
                                const isChecked = selectedStoreIds.includes(store.id);
                                return (
                                  <label
                                    key={store.id}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--app-surface-hover)] cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleStore(store.id)}
                                      className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                                    />
                                    <span className="font-medium text-[var(--app-text-primary)] flex-1 truncate">
                                      {store.storeId && (
                                        <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] mr-1.5 opacity-80">
                                          [{store.storeId}]
                                        </span>
                                      )}
                                      {store.name}
                                    </span>
                                    {store.code && (
                                      <Badge size="sm" variant="neutral">
                                        {store.code}
                                      </Badge>
                                    )}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* Step 2: Customer Audience Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.sectionAudienceTitle}</CardTitle>
                  <CardDescription>เลือกกลุ่มเป้าหมายผู้รับข้อความ</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        id: "ALL_KNOWN" as MassMessageAudienceType,
                        title: t.audienceAllKnown,
                        desc: t.audienceAllKnownDesc,
                      },
                      {
                        id: "NOT_REPLIED" as MassMessageAudienceType,
                        title: t.audienceNotReplied,
                        desc: t.audienceNotRepliedDesc,
                      },
                      {
                        id: "NOTIFIED_BM" as MassMessageAudienceType,
                        title: t.audienceNotifiedBm,
                        desc: t.audienceNotifiedBmDesc,
                      },
                      {
                        id: "REPLIED" as MassMessageAudienceType,
                        title: t.audienceReplied,
                        desc: t.audienceRepliedDesc,
                      },
                    ].map((aud) => {
                      const isSelected = audienceType === aud.id;
                      return (
                        <label
                          key={aud.id}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--app-radius-lg)] border p-3 transition-all ${
                            isSelected
                              ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20"
                              : "border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="audienceType"
                            checked={isSelected}
                            onChange={() => setAudienceType(aud.id)}
                            className="mt-0.5 h-3.5 w-3.5 accent-[var(--app-accent)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                          />
                          <div>
                            <span className="text-xs font-semibold text-[var(--app-text-primary)]">
                              {aud.title}
                            </span>
                            <p className="mt-0.5 text-[11px] text-[var(--app-text-secondary)] leading-normal">
                              {aud.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Step 3: Message Composer */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t.sectionMessageTitle}</CardTitle>
                      <CardDescription>เขียนข้อความและแนบรูปภาพสำหรับส่งถึงลูกค้า</CardDescription>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--app-text-secondary)]">
                      {t.characterCount(messageText.length, MAX_MESSAGE_LENGTH)}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <Input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="ชื่อแคมเปญ (สำหรับอ้างอิงภายใน, ไม่บังคับ)..."
                    className="h-9 w-full"
                  />

                  <textarea
                    rows={4}
                    value={messageText}
                    maxLength={MAX_MESSAGE_LENGTH}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    className="w-full rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none resize-y"
                  />

                  {/* Image Attachment Section */}
                  <div className="pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={(e) => void handleFileSelect(e)}
                      className="hidden"
                    />

                    {attachedImage ? (
                      <div className="flex items-center gap-3 rounded-[var(--app-radius-lg)] border border-[var(--app-accent)]/40 bg-[var(--app-accent-soft)]/10 p-3">
                        <img
                          src={attachedImage.previewUrl || attachedImage.url}
                          alt={attachedImage.name}
                          className="h-14 w-14 rounded-[var(--app-radius-md)] object-cover border border-[var(--app-border)] bg-[var(--app-surface)] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge size="sm" variant="accent">
                              {t.imageAttachedBadge}
                            </Badge>
                            <span className="text-[11px] font-mono text-[var(--app-text-secondary)]">
                              {attachedImage.size > 1024 * 1024
                                ? `${(attachedImage.size / (1024 * 1024)).toFixed(2)} MB`
                                : `${(attachedImage.size / 1024).toFixed(1)} KB`}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs font-medium text-[var(--app-text-primary)]">
                            {attachedImage.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleReplaceImage}
                          >
                            {t.replaceImageButton}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={handleRemoveImage}
                          >
                            {t.removeImageButton}
                          </Button>
                        </div>
                      </div>
                    ) : isUploadingImage ? (
                      <div className="flex items-center justify-center gap-2.5 rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-accent)]/50 bg-[var(--app-accent-soft)]/20 p-4 text-xs font-medium text-[var(--app-accent)]">
                        <LoadingSpinner size="sm" />
                        <span>{t.uploadingImage}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-[var(--app-radius-lg)] border border-dashed border-[var(--app-border)] p-3 bg-[var(--app-surface-subtle)]">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          leftIcon={
                            <svg className="h-3.5 w-3.5 text-[var(--app-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          }
                        >
                          {t.attachImageButton}
                        </Button>
                        <span className="text-[11px] text-[var(--app-text-secondary)]">
                          {t.imageUploadHelper}
                        </span>
                      </div>
                    )}

                    {imageUploadError && (
                      <div className="mt-2 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-2.5 text-xs text-[var(--app-danger)]">
                        {imageUploadError}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Live Preview, Scope KPIs, and Review & Send */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Scope Preview Card */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.sectionSummaryTitle}</CardTitle>
                  {previewLoading && (
                    <span className="text-[11px] text-[var(--app-accent)] animate-pulse font-medium">
                      {t.calculatingPreview}
                    </span>
                  )}
                </CardHeader>

                <CardContent>
                  {previewError ? (
                    <div className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
                      <p>{previewError}</p>
                      <button
                        type="button"
                        onClick={() => void calculatePreview()}
                        className="mt-2 text-[11px] font-semibold underline hover:text-[var(--app-danger)]"
                      >
                        {t.retryPreview}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <MetricCard
                          label={t.eligibleStoresLabel}
                          value={preview ? preview.eligibleStoreCount.toLocaleString() : "—"}
                          tone="default"
                        />
                        <MetricCard
                          label={t.estimatedRecipientsLabel}
                          value={preview ? preview.estimatedRecipientCount.toLocaleString() : "—"}
                          tone="accent"
                        />
                      </div>

                      {/* Secondary metadata summary */}
                      <div className="rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs divide-y divide-[var(--app-border-subtle)]">
                        <div className="flex justify-between py-1.5">
                          <span className="text-[var(--app-text-secondary)]">{t.storeCountLabel}</span>
                          <span className="font-mono font-medium text-[var(--app-text-primary)]">
                            {preview ? preview.storeCount : 0}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5">
                          <span className="text-[var(--app-text-secondary)]">{t.skippedStoresLabel}</span>
                          <span className="font-mono font-medium text-[var(--app-text-primary)]">
                            {preview ? preview.skippedStoreCount : 0}
                          </span>
                        </div>
                      </div>

                      {/* Skipped stores expandable */}
                      {preview && preview.skippedStoreCount > 0 && (
                        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] p-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setShowSkippedStores(!showSkippedStores)}
                            className="flex w-full items-center justify-between font-semibold text-[var(--app-warning)]"
                          >
                            <span>{t.skippedStoresSummary(preview.skippedStoreCount)}</span>
                            <span className="text-[10px]">{showSkippedStores ? "▲" : "▼"}</span>
                          </button>

                          {showSkippedStores && (
                            <div className="mt-2.5 max-h-36 overflow-y-auto space-y-1.5 pt-2 border-t border-[var(--app-warning)]/30">
                              {preview.stores
                                .filter((s) => s.status === "SKIPPED")
                                .map((s) => (
                                  <div key={s.storeId} className="flex items-center justify-between text-[11px]">
                                    <span className="font-medium text-[var(--app-text-primary)] truncate max-w-[180px]">
                                      {(s.masterStoreId || s.externalStoreId) && (
                                        <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] mr-1 opacity-80">
                                          [{s.masterStoreId ?? s.externalStoreId}]
                                        </span>
                                      )}
                                      {s.storeName}
                                    </span>
                                    <span className="text-[var(--app-warning)] font-mono text-[10px]">
                                      {getSkipReasonLabel(s.skipReason)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Zero protection alerts */}
                      {preview && preview.eligibleStoreCount === 0 && (
                        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
                          {t.zeroEligibleStoresAlert}
                        </div>
                      )}
                      {preview && preview.eligibleStoreCount > 0 && preview.estimatedRecipientCount === 0 && (
                        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] p-3 text-xs text-[var(--app-warning)]">
                          {t.zeroRecipientsAlert}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Message Preview Bubble (LINE Style) */}
              <Card>
                <CardHeader>
                  <CardTitle>{t.messagePreviewTitle}</CardTitle>
                  <CardDescription>{t.messagePreviewSubtitle}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-4 min-h-[140px] flex flex-col justify-end gap-2.5">
                    {hasContent ? (
                      <div className="flex flex-col items-start gap-2 max-w-[85%]">
                        {attachedImage && (
                          <div className="overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)] shadow-[var(--app-shadow-card)] bg-[var(--app-surface)]">
                            <img
                              src={attachedImage.previewUrl || attachedImage.url}
                              alt={t.imagePreviewAlt}
                              className="max-h-56 w-auto max-w-full object-cover"
                            />
                          </div>
                        )}
                        {messageText.trim() && (
                          <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-surface)] p-3 text-xs text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)] whitespace-pre-wrap break-words border border-[var(--app-border)]">
                            {messageText}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-xs text-[var(--app-text-tertiary)] italic py-6">
                        {t.messagePreviewEmptyPlaceholder}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Review & Send Action Button */}
              <div>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={
                    !hasContent ||
                    isUploadingImage ||
                    !preview ||
                    preview.eligibleStoreCount === 0 ||
                    preview.estimatedRecipientCount === 0 ||
                    previewLoading
                  }
                  onClick={handleOpenConfirm}
                  className="w-full h-11 text-sm font-bold shadow-sm"
                  leftIcon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  }
                >
                  {t.reviewAndSendButton}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Campaign Progress Monitor */}
        {viewMode === "progress" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {activeCampaign ? (
              <>
                {/* Status Hero Card */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[var(--app-text-tertiary)]">ID: {activeCampaign.id}</span>
                          {activeCampaign.messagePayload?.messages?.some((m: any) => m.type === "image") && (
                            <Badge size="sm" variant="accent">
                              {t.imageAttachedBadge}
                            </Badge>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-[var(--app-text-primary)] mt-0.5">
                          {activeCampaign.title || t.campaignProgressTitle}
                        </h2>
                      </div>

                      <div>
                        <Badge
                          size="md"
                          variant={
                            activeCampaign.status === "COMPLETED"
                              ? "success"
                              : activeCampaign.status === "PARTIAL"
                              ? "warning"
                              : activeCampaign.status === "FAILED"
                              ? "danger"
                              : "accent"
                          }
                          dot
                        >
                          {activeCampaign.status === "COMPLETED"
                            ? t.campaignStatusCompleted
                            : activeCampaign.status === "PARTIAL"
                            ? t.campaignStatusPartial
                            : activeCampaign.status === "FAILED"
                            ? t.campaignStatusFailed
                            : t.campaignStatusRunning}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Terminal Status Banners */}
                    {activeCampaign.status === "COMPLETED" && (
                      <div className="rounded-[var(--app-radius-md)] bg-[var(--app-success-soft)] border border-[var(--app-success)]/30 p-4">
                        <p className="text-xs font-bold text-[var(--app-success)]">
                          {t.statusBannerCompletedTitle}
                        </p>
                        <p className="text-[11px] text-[var(--app-success)] mt-0.5">
                          {t.statusBannerCompletedDesc}
                        </p>
                      </div>
                    )}
                    {activeCampaign.status === "PARTIAL" && (
                      <div className="rounded-[var(--app-radius-md)] bg-[var(--app-warning-soft)] border border-[var(--app-warning)]/30 p-4">
                        <p className="text-xs font-bold text-[var(--app-warning)]">
                          {t.statusBannerPartialTitle}
                        </p>
                        <p className="text-[11px] text-[var(--app-warning)] mt-0.5">
                          {t.statusBannerPartialDesc}
                        </p>
                      </div>
                    )}
                    {activeCampaign.status === "FAILED" && (
                      <div className="rounded-[var(--app-radius-md)] bg-[var(--app-danger-soft)] border border-[var(--app-danger)]/30 p-4">
                        <p className="text-xs font-bold text-[var(--app-danger)]">
                          {t.statusBannerFailedTitle}
                        </p>
                        <p className="text-[11px] text-[var(--app-danger)] mt-0.5">
                          {activeCampaign.errorMessage || t.statusBannerFailedDesc}
                        </p>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-[var(--app-text-secondary)]">
                        <span>
                          {activeCampaign.processedRecipientCount.toLocaleString()} /{" "}
                          {activeCampaign.estimatedRecipientCount.toLocaleString()} {t.estimatedRecipientsLabel.toLowerCase()}
                        </span>
                        <span className="font-mono">
                          {activeCampaign.estimatedRecipientCount > 0
                            ? Math.round(
                                (activeCampaign.processedRecipientCount /
                                  activeCampaign.estimatedRecipientCount) *
                                  100,
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--app-surface-subtle)]">
                        <div
                          className="h-full bg-[var(--app-accent)] transition-all duration-300"
                          style={{
                            width: `${
                              activeCampaign.estimatedRecipientCount > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (activeCampaign.processedRecipientCount /
                                        activeCampaign.estimatedRecipientCount) *
                                        100,
                                    ),
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Metric Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <MetricCard
                        label={t.metricProcessed}
                        value={activeCampaign.processedRecipientCount.toLocaleString()}
                        tone="default"
                      />
                      <MetricCard
                        label={t.metricAccepted}
                        value={activeCampaign.acceptedRecipientCount.toLocaleString()}
                        tone="success"
                      />
                      <MetricCard
                        label={t.metricFailed}
                        value={activeCampaign.failedRecipientCount.toLocaleString()}
                        tone="danger"
                      />
                      <MetricCard
                        label={t.metricSkipped}
                        value={activeCampaign.skippedStoreCount}
                        tone="warning"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Per-Store Delivery Details Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t.storeDeliveryTableTitle}</CardTitle>
                    <CardDescription>รายละเอียดสถานะการส่งรายสาขา</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.storeNameCol}</TableHead>
                            <TableHead align="right">{t.recipientsCol}</TableHead>
                            <TableHead>{t.statusCol}</TableHead>
                            <TableHead>{t.detailCol}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(activeCampaign.storeDeliveries || []).map((delivery) => (
                            <TableRow key={delivery.id}>
                              <TableCell>
                                <div className="font-semibold text-[var(--app-text-primary)]">
                                  {(delivery.masterStoreId || delivery.externalStoreId) && (
                                    <span className="font-mono text-[10px] text-[var(--app-text-tertiary)] mr-1 opacity-80">
                                      [{delivery.masterStoreId ?? delivery.externalStoreId}]
                                    </span>
                                  )}
                                  {delivery.storeName}
                                </div>
                                {delivery.storeCode && (
                                  <span className="text-[10px] font-mono text-[var(--app-text-tertiary)]">
                                    {delivery.storeCode}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell align="right" className="font-mono font-medium text-[var(--app-text-primary)]">
                                {delivery.recipientCount.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  size="sm"
                                  variant={
                                    delivery.status === "SUCCESS"
                                      ? "success"
                                      : delivery.status === "FAILED"
                                      ? "danger"
                                      : delivery.status === "SKIPPED"
                                      ? "neutral"
                                      : "accent"
                                  }
                                >
                                  {delivery.status === "SUCCESS"
                                    ? t.deliveryStatusSuccess
                                    : delivery.status === "FAILED"
                                    ? t.deliveryStatusFailed
                                    : delivery.status === "SKIPPED"
                                    ? t.deliveryStatusSkipped
                                    : t.deliveryStatusRunning}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[var(--app-text-secondary)] text-[11px]">
                                {delivery.skipReason
                                  ? getSkipReasonLabel(delivery.skipReason)
                                  : delivery.errorMessage || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </>
            ) : (
              <LoadingState message="กำลังโหลดรายละเอียดแคมเปญ..." />
            )}
          </div>
        )}

        {/* View Mode: Campaign History */}
        {viewMode === "history" && (
          <Card className="max-w-5xl mx-auto">
            <CardHeader>
              <CardTitle>{t.historyTitle}</CardTitle>
              <CardDescription>ประวัติการส่งข้อความบรอดแคสต์ทั้งหมด</CardDescription>
            </CardHeader>

            <CardContent>
              {historyLoading ? (
                <LoadingState message="กำลังโหลดประวัติแคมเปญ..." />
              ) : historyItems.length === 0 ? (
                <EmptyState
                  title={t.noCampaignHistory}
                  description="ยังไม่มีประวัติการส่งข้อความบรอดแคสต์ในระบบ"
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Audience</TableHead>
                        <TableHead align="right">Stores</TableHead>
                        <TableHead align="right">Accepted / Est.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead align="right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-[var(--app-text-secondary)] font-mono text-[11px] whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString(language, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell className="font-semibold text-[var(--app-text-primary)]">
                            <div className="flex items-center gap-1.5">
                              <span>{item.title || "Mass Message"}</span>
                              {item.messagePayload?.messages?.some((m: any) => m.type === "image") && (
                                <Badge size="sm" variant="accent">
                                  IMG
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[var(--app-text-secondary)]">{item.audienceType}</TableCell>
                          <TableCell align="right" className="font-mono">{item.storeCount}</TableCell>
                          <TableCell align="right" className="font-mono font-medium">
                            {item.acceptedRecipientCount.toLocaleString()} / {item.estimatedRecipientCount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              size="sm"
                              variant={
                                item.status === "COMPLETED"
                                  ? "success"
                                  : item.status === "PARTIAL"
                                  ? "warning"
                                  : item.status === "FAILED"
                                  ? "danger"
                                  : "accent"
                              }
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActiveCampaignId(item.id);
                                setActiveCampaign(item);
                                setViewMode("progress");
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-lg)] bg-[var(--app-warning-soft)] text-[var(--app-warning)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                {t.confirmModalTitle}
              </h3>
            </div>

            <p className="text-xs text-[var(--app-text-secondary)] leading-relaxed">
              {t.confirmModalDesc(preview.estimatedRecipientCount, preview.eligibleStoreCount)}
            </p>

            {/* Campaign Content Summary */}
            <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3 space-y-2 text-xs">
              <span className="font-semibold text-[var(--app-text-primary)] text-[11px] uppercase tracking-wider">
                {t.confirmContentSummaryTitle}
              </span>
              
              <div className="space-y-1.5 pt-1 border-t border-[var(--app-border-subtle)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[var(--app-text-secondary)] text-[11px]">{t.confirmTextMessageLabel}:</span>
                  <span className="text-right text-[var(--app-text-primary)] font-medium line-clamp-2 max-w-[220px]">
                    {messageText.trim() ? messageText.trim() : <span className="text-[var(--app-text-tertiary)] italic">{t.confirmNoTextMessage}</span>}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--app-text-secondary)] text-[11px]">{t.confirmImageLabel}:</span>
                  <span className="text-right text-[var(--app-text-primary)] font-medium truncate max-w-[220px]">
                    {attachedImage ? (
                      <span className="inline-flex items-center gap-1.5 text-[var(--app-accent)]">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{t.confirmImageAttached} ({attachedImage.name})</span>
                      </span>
                    ) : (
                      <span className="text-[var(--app-text-tertiary)] italic">{t.confirmNoImage}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-warning-soft)] border border-[var(--app-warning)]/40 p-3 text-[11px] text-[var(--app-warning)]">
              {t.confirmModalQuotaWarning}
            </div>

            {sendError && (
              <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-danger-soft)] border border-[var(--app-danger)]/40 p-3 text-xs text-[var(--app-danger)]">
                {sendError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                disabled={sending}
                onClick={() => setShowConfirmModal(false)}
              >
                {t.confirmModalCancelButton}
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={sending}
                onClick={() => void handleConfirmSend()}
              >
                {sending ? t.sendingInProgress : t.confirmModalConfirmButton}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
