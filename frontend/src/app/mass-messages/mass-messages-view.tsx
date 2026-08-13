"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    const poll = async () => {
      try {
        const data = await api.getMassMessageCampaign(activeCampaignId);
        if (!active) return;
        setActiveCampaign(data);

        // Stop polling on terminal statuses
        if (
          data.status === "COMPLETED" ||
          data.status === "PARTIAL" ||
          data.status === "FAILED" ||
          data.status === "CANCELLED"
        ) {
          return;
        }
      } catch (err) {
        console.error("Polling campaign failed", err);
      }
    };

    void poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [viewMode, activeCampaignId, isAuthorized]);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!isAuthorized) return;
    setHistoryLoading(true);
    try {
      const res = await api.listMassMessageCampaigns(50, 0);
      setHistoryItems(res.items || []);
    } catch (err) {
      console.error("Failed to load campaign history", err);
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
    setActiveCampaignRequestId(null);
    setMessageText("");
    setCampaignTitle("");
    setAttachedImage(null);
    setIsUploadingImage(false);
    setImageUploadError(null);
    setSendError(null);
  };

  const handleSelectAllStores = () => {
    setSelectedStoreIds(filteredStores.map((s) => s.id));
  };

  const handleDeselectAllStores = () => {
    setSelectedStoreIds([]);
  };

  const handleToggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId],
    );
  };

  // Image Upload Handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file triggers onChange
    e.target.value = "";

    // Size validation: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError(t.imageTooLarge);
      return;
    }

    // Format validation
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["jpg", "jpeg", "png", "webp"];
    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (
      (!file.type && !validExtensions.includes(ext || "")) ||
      (file.type && !validMimes.includes(file.type) && !validExtensions.includes(ext || ""))
    ) {
      setImageUploadError(t.imageInvalidFormat);
      return;
    }

    setIsUploadingImage(true);
    setImageUploadError(null);

    try {
      const res = await api.uploadMassMessageImage(file);
      setAttachedImage({
        url: res.url,
        previewUrl: res.previewUrl || res.url,
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

  const hasContent = Boolean(messageText.trim() || attachedImage);

  // Open confirmation modal
  const handleOpenConfirm = () => {
    if (!hasContent) return;
    if (!preview || preview.eligibleStoreCount === 0 || preview.estimatedRecipientCount === 0) return;
    setSendError(null);
    // Generate stable request ID for this submission attempt
    setActiveCampaignRequestId(generateUUID());
    setShowConfirmModal(true);
  };

  // Execute campaign creation
  const handleConfirmSend = async () => {
    if (sending || !activeCampaignRequestId || !hasContent) return;
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
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{t.accessRestrictedTitle}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.accessRestrictedDesc}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
      {/* Workspace Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.pageTitle}</h1>
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                {t.adminOnlyBadge}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.pageSubtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {viewMode !== "compose" && (
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                + {t.createNewCampaignButton}
              </button>
            )}
            {viewMode !== "history" && (
              <button
                type="button"
                onClick={handleOpenHistory}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t.viewHistoryButton}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        {viewMode === "compose" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 max-w-7xl mx-auto">
            {/* Left Column: Form Configuration */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Store Selection */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.sectionStoresTitle}</h2>

                <div className="mt-3.5 space-y-3">
                  {/* Mode: ALL */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all ${
                      storeMode === "ALL"
                        ? "border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storeMode"
                      checked={storeMode === "ALL"}
                      onChange={() => setStoreMode("ALL")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t.storeModeAll}
                      </span>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {t.storeModeAllDesc}
                      </p>
                    </div>
                  </label>

                  {/* Mode: Selected Stores */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-all ${
                      storeMode === "MULTIPLE"
                        ? "border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="storeMode"
                      checked={storeMode === "MULTIPLE"}
                      onChange={() => setStoreMode("MULTIPLE")}
                      className="mt-0.5 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {t.storeModeSelected}
                      </span>

                      {storeMode === "MULTIPLE" && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {/* Store Search & Selection Controls */}
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={storeSearch}
                              onChange={(e) => setStoreSearch(e.target.value)}
                              placeholder={t.searchStoresPlaceholder}
                              className="h-8 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleSelectAllStores}
                              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                            >
                              {t.selectAllStores}
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                              type="button"
                              onClick={handleDeselectAllStores}
                              className="text-[11px] font-medium text-slate-500 hover:underline shrink-0"
                            >
                              {t.deselectAllStores}
                            </button>
                          </div>

                          <p className="text-[11px] font-medium text-slate-500">
                            {t.selectedStoresCount(selectedStoreIds.length, stores.length)}
                          </p>

                          {/* Store List */}
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950">
                            {filteredStores.length === 0 ? (
                              <p className="p-3 text-center text-xs text-slate-400">
                                {storesLoading ? "Loading stores..." : t.noStoresFound}
                              </p>
                            ) : (
                              filteredStores.map((store) => {
                                const isChecked = selectedStoreIds.includes(store.id);
                                return (
                                  <label
                                    key={store.id}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleStore(store.id)}
                                      className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">
                                      {store.name}
                                    </span>
                                    {store.code && (
                                      <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                        {store.code}
                                      </span>
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
                </div>
              </div>

              {/* Step 2: Customer Audience Selection */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.sectionAudienceTitle}</h2>

                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-all ${
                          isSelected
                            ? "border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10"
                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="audienceType"
                          checked={isSelected}
                          onChange={() => setAudienceType(aud.id)}
                          className="mt-0.5 h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {aud.title}
                          </span>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                            {aud.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Message Composer */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.sectionMessageTitle}</h2>
                  <span className="text-[11px] font-mono text-slate-400">
                    {t.characterCount(messageText.length, MAX_MESSAGE_LENGTH)}
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="Campaign title (internal reference, optional)..."
                    className="h-8 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />

                  <textarea
                    rows={4}
                    value={messageText}
                    maxLength={MAX_MESSAGE_LENGTH}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none resize-y"
                  />

                  {/* Image Attachment Section */}
                  <div className="pt-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleFileSelect(e)}
                      className="hidden"
                    />

                    {attachedImage ? (
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-3">
                        <img
                          src={attachedImage.previewUrl || attachedImage.url}
                          alt={attachedImage.name}
                          className="h-14 w-14 rounded-md object-cover border border-emerald-500/30 bg-white dark:bg-slate-950 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              {t.imageAttachedBadge}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {attachedImage.size > 1024 * 1024
                                ? `${(attachedImage.size / (1024 * 1024)).toFixed(2)} MB`
                                : `${(attachedImage.size / 1024).toFixed(1)} KB`}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                            {attachedImage.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleReplaceImage}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            {t.replaceImageButton}
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="rounded-md border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            {t.removeImageButton}
                          </button>
                        </div>
                      </div>
                    ) : isUploadingImage ? (
                      <div className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        <svg className="h-4 w-4 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>{t.uploadingImage}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/40">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
                        >
                          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{t.attachImageButton}</span>
                        </button>
                        <span className="text-[11px] text-slate-400">
                          {t.imageUploadHelper}
                        </span>
                      </div>
                    )}

                    {imageUploadError && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-2.5 text-xs text-red-600 dark:text-red-400">
                        {imageUploadError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Preview, Scope KPIs, and Review & Send */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Scope Preview Card */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.sectionSummaryTitle}</h2>
                  {previewLoading && (
                    <span className="text-[11px] text-emerald-600 animate-pulse font-medium">
                      {t.calculatingPreview}
                    </span>
                  )}
                </div>

                {previewError ? (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
                    <p>{previewError}</p>
                    <button
                      type="button"
                      onClick={() => void calculatePreview()}
                      className="mt-2 text-[11px] font-semibold underline hover:text-red-700"
                    >
                      {t.retryPreview}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3.5 space-y-3">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                        <span className="text-[11px] text-slate-500">{t.eligibleStoresLabel}</span>
                        <p className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {preview ? preview.eligibleStoreCount.toLocaleString() : "—"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3">
                        <span className="text-[11px] text-slate-500">{t.estimatedRecipientsLabel}</span>
                        <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {preview ? preview.estimatedRecipientCount.toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Secondary metadata summary */}
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">{t.storeCountLabel}</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {preview ? preview.storeCount : 0}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">{t.skippedStoresLabel}</span>
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {preview ? preview.skippedStoreCount : 0}
                        </span>
                      </div>
                    </div>

                    {/* Skipped stores expandable */}
                    {preview && preview.skippedStoreCount > 0 && (
                      <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setShowSkippedStores(!showSkippedStores)}
                          className="flex w-full items-center justify-between font-semibold text-amber-800 dark:text-amber-400"
                        >
                          <span>{t.skippedStoresSummary(preview.skippedStoreCount)}</span>
                          <span className="text-[10px]">{showSkippedStores ? "▲" : "▼"}</span>
                        </button>

                        {showSkippedStores && (
                          <div className="mt-2.5 max-h-36 overflow-y-auto space-y-1.5 pt-2 border-t border-amber-200/50 dark:border-amber-900/30">
                            {preview.stores
                              .filter((s) => s.status === "SKIPPED")
                              .map((s) => (
                                <div key={s.storeId} className="flex items-center justify-between text-[11px]">
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                                    {s.storeName}
                                  </span>
                                  <span className="text-amber-700 dark:text-amber-400 font-mono text-[10px]">
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
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
                        {t.zeroEligibleStoresAlert}
                      </div>
                    )}
                    {preview && preview.eligibleStoreCount > 0 && preview.estimatedRecipientCount === 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400">
                        {t.zeroRecipientsAlert}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Message Preview Bubble (LINE Style) */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.messagePreviewTitle}</h2>
                  <span className="text-[11px] text-slate-400">{t.messagePreviewSubtitle}</span>
                </div>

                <div className="mt-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/60 p-4 min-h-[140px] flex flex-col justify-end gap-2.5">
                  {hasContent ? (
                    <div className="flex flex-col items-start gap-2 max-w-[85%]">
                      {attachedImage && (
                        <div className="overflow-hidden rounded-2xl rounded-tl-xs border border-slate-200/60 dark:border-slate-700/60 shadow-xs bg-white dark:bg-slate-800">
                          <img
                            src={attachedImage.previewUrl || attachedImage.url}
                            alt={t.imagePreviewAlt}
                            className="max-h-56 w-auto max-w-full object-cover"
                          />
                        </div>
                      )}
                      {messageText.trim() && (
                        <div className="rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 shadow-xs whitespace-pre-wrap break-words border border-slate-200/50 dark:border-slate-700/50">
                          {messageText}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-slate-400 italic py-6">
                      {t.messagePreviewEmptyPlaceholder}
                    </p>
                  )}
                </div>
              </div>

              {/* Review & Send Action Button */}
              <div>
                <button
                  type="button"
                  disabled={
                    !hasContent ||
                    isUploadingImage ||
                    !preview ||
                    preview.eligibleStoreCount === 0 ||
                    preview.estimatedRecipientCount === 0 ||
                    previewLoading
                  }
                  onClick={handleOpenConfirm}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  {t.reviewAndSendButton}
                </button>
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
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400">ID: {activeCampaign.id}</span>
                        {activeCampaign.messagePayload?.messages?.some((m: any) => m.type === "image") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{t.imageAttachedBadge}</span>
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {activeCampaign.title || t.campaignProgressTitle}
                      </h2>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          activeCampaign.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : activeCampaign.status === "PARTIAL"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            : activeCampaign.status === "FAILED"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                            : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 animate-pulse"
                        }`}
                      >
                        {activeCampaign.status === "COMPLETED"
                          ? t.campaignStatusCompleted
                          : activeCampaign.status === "PARTIAL"
                          ? t.campaignStatusPartial
                          : activeCampaign.status === "FAILED"
                          ? t.campaignStatusFailed
                          : t.campaignStatusRunning}
                      </span>
                    </div>
                  </div>

                  {/* Terminal Status Banners */}
                  {activeCampaign.status === "COMPLETED" && (
                    <div className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-4">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {t.statusBannerCompletedTitle}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {t.statusBannerCompletedDesc}
                      </p>
                    </div>
                  )}
                  {activeCampaign.status === "PARTIAL" && (
                    <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-4">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        {t.statusBannerPartialTitle}
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        {t.statusBannerPartialDesc}
                      </p>
                    </div>
                  )}
                  {activeCampaign.status === "FAILED" && (
                    <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-4">
                      <p className="text-xs font-bold text-red-800 dark:text-red-300">
                        {t.statusBannerFailedTitle}
                      </p>
                      <p className="text-[11px] text-red-700 dark:text-red-400 mt-0.5">
                        {activeCampaign.errorMessage || t.statusBannerFailedDesc}
                      </p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
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
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
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
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <span className="text-[11px] text-slate-500">{t.metricProcessed}</span>
                      <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {activeCampaign.processedRecipientCount.toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {t.metricAccepted}
                      </span>
                      <p className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {activeCampaign.acceptedRecipientCount.toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                        {t.metricFailed}
                      </span>
                      <p className="mt-0.5 text-base font-bold text-red-600 dark:text-red-400 font-mono">
                        {activeCampaign.failedRecipientCount.toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                      <span className="text-[11px] text-slate-500">{t.metricSkipped}</span>
                      <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {activeCampaign.skippedStoreCount}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Per-Store Delivery Details Table */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
                    {t.storeDeliveryTableTitle}
                  </h3>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3 font-semibold">{t.storeNameCol}</th>
                          <th className="p-3 font-semibold text-right">{t.recipientsCol}</th>
                          <th className="p-3 font-semibold">{t.statusCol}</th>
                          <th className="p-3 font-semibold">{t.detailCol}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                        {(activeCampaign.storeDeliveries || []).map((delivery) => (
                          <tr key={delivery.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {delivery.storeName}
                              </div>
                              {delivery.storeCode && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {delivery.storeCode}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                              {delivery.recipientCount.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  delivery.status === "SUCCESS"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : delivery.status === "FAILED"
                                    ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                    : delivery.status === "SKIPPED"
                                    ? "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                                    : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                }`}
                              >
                                {delivery.status === "SUCCESS"
                                  ? t.deliveryStatusSuccess
                                  : delivery.status === "FAILED"
                                  ? t.deliveryStatusFailed
                                  : delivery.status === "SKIPPED"
                                  ? t.deliveryStatusSkipped
                                  : t.deliveryStatusRunning}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 text-[11px]">
                              {delivery.skipReason
                                ? getSkipReasonLabel(delivery.skipReason)
                                : delivery.errorMessage || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400">
                Loading campaign details...
              </div>
            )}
          </div>
        )}

        {/* View Mode: Campaign History */}
        {viewMode === "history" && (
          <div className="max-w-5xl mx-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t.historyTitle}
            </h2>

            {historyLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading history...</div>
            ) : historyItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">{t.noCampaignHistory}</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 font-semibold">Date</th>
                      <th className="p-3 font-semibold">Campaign</th>
                      <th className="p-3 font-semibold">Audience</th>
                      <th className="p-3 font-semibold text-right">Stores</th>
                      <th className="p-3 font-semibold text-right">Accepted / Est.</th>
                      <th className="p-3 font-semibold">Status</th>
                      <th className="p-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                    {historyItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString(language, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span>{item.title || "Mass Message"}</span>
                            {item.messagePayload?.messages?.some((m: any) => m.type === "image") && (
                              <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold" title="Image attached">
                                IMG
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-500">{item.audienceType}</td>
                        <td className="p-3 text-right font-mono">{item.storeCount}</td>
                        <td className="p-3 text-right font-mono font-medium">
                          {item.acceptedRecipientCount.toLocaleString()} / {item.estimatedRecipientCount.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : item.status === "PARTIAL"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : item.status === "FAILED"
                                ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCampaignId(item.id);
                              setActiveCampaign(item);
                              setViewMode("progress");
                            }}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t.confirmModalTitle}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.confirmModalDesc(preview.estimatedRecipientCount, preview.eligibleStoreCount)}
            </p>

            {/* Campaign Content Summary */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2 text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">
                {t.confirmContentSummaryTitle}
              </span>
              
              <div className="space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 text-[11px]">{t.confirmTextMessageLabel}:</span>
                  <span className="text-right text-slate-800 dark:text-slate-200 font-medium line-clamp-2 max-w-[220px]">
                    {messageText.trim() ? messageText.trim() : <span className="text-slate-400 italic">{t.confirmNoTextMessage}</span>}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 text-[11px]">{t.confirmImageLabel}:</span>
                  <span className="text-right text-slate-800 dark:text-slate-200 font-medium truncate max-w-[220px]">
                    {attachedImage ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{t.confirmImageAttached} ({attachedImage.name})</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">{t.confirmNoImage}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              {t.confirmModalQuotaWarning}
            </div>

            {sendError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 p-3 text-xs text-red-600 dark:text-red-400">
                {sendError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => setShowConfirmModal(false)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {t.confirmModalCancelButton}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void handleConfirmSend()}
                className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-bold text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sending ? t.sendingInProgress : t.confirmModalConfirmButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
