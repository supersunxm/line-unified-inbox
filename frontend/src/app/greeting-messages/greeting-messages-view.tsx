"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  GreetingMessageBlock,
  GreetingPreviewResult,
  GreetingReadinessResponse,
  GreetingSendPolicy,
  GreetingStoreReadinessItem,
  GreetingTemplate,
  GreetingTemplateStatus,
} from "@/types/api";
import { getGreetingDict, type GreetingDict } from "./greeting-i18n";
import { GreetingMessageBuilder } from "./greeting-message-builder";

type GreetingMessagesViewProps = {
  language?: "th" | "en" | "zh" | string;
  userRole?: "ADMIN" | "VIEWER";
};

export function GreetingMessagesView({
  language = "th",
  userRole = "ADMIN",
}: GreetingMessagesViewProps) {
  const t: GreetingDict = useMemo(() => getGreetingDict(language), [language]);

  const [templates, setTemplates] = useState<GreetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Selected / Editing Template State
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
  const [showTemplateManagerModal, setShowTemplateManagerModal] = useState(false);

  // Store Assignment State
  const [showStoreSection, setShowStoreSection] = useState(false);
  const [readinessData, setReadinessData] = useState<GreetingReadinessResponse | null>(null);
  const [selectedStoreOaIds, setSelectedStoreOaIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Live Mobile Preview State
  const [previewStoreId, setPreviewStoreId] = useState<string>("");
  const [previewCustomerName, setPreviewCustomerName] = useState<string>("Sunn");
  const [previewTab, setPreviewTab] = useState<"chat" | "list">("chat");

  const currentTemplate = useMemo(() => {
    if (isCreatingNew) return null;
    return templates.find((tmp) => tmp.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId, isCreatingNew]);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listGreetingTemplates({});
      setTemplates(res);
      if (res.length > 0 && !selectedTemplateId && !isCreatingNew) {
        setSelectedTemplateId(res[0].id);
        loadTemplateIntoForm(res[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load greeting templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

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
  };

  // Fetch store readiness whenever current template or messages change
  const fetchReadiness = async (templateId?: string) => {
    const targetId = templateId || currentTemplate?.id;
    if (!targetId) return;

    try {
      const res = await api.getGreetingReadiness(targetId);
      setReadinessData(res);
      // Pre-select stores that are currently assigned to this template
      const assigned = res.stores
        .filter((s) => s.currentTemplateId === targetId)
        .map((s) => s.lineOfficialAccountId);
      setSelectedStoreOaIds(assigned);

      // Default sample store for preview
      if (!previewStoreId && res.stores.length > 0) {
        setPreviewStoreId(res.stores[0].lineOfficialAccountId);
      }
    } catch {
      // Ignore readiness errors silently in background
    }
  };

  useEffect(() => {
    if (currentTemplate?.id) {
      fetchReadiness(currentTemplate.id);
    }
  }, [currentTemplate?.id]);

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
      currentTemplate.assignedStoreCount > 0
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
        setSuccessMessage("บันทึกข้อความต้อนรับสำเร็จ");
        await fetchTemplates();
        loadTemplateIntoForm(created);
      } else {
        const updated = await api.updateGreetingTemplate(currentTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage("บันทึกการเปลี่ยนแปลงสำเร็จ");
        await fetchTemplates();
        loadTemplateIntoForm(updated);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save greeting template");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStoreAssignments = async () => {
    if (!currentTemplate) return;
    setSavingAssignments(true);
    setError(null);
    try {
      const res = await api.assignGreetingStores(currentTemplate.id, {
        lineOfficialAccountIds: selectedStoreOaIds,
      });
      setSuccessMessage(t.saveAssignmentsSuccess(res.assignedCount));
      await fetchReadiness(currentTemplate.id);
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save store assignments");
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleSelectAllReadyStores = () => {
    if (!readinessData) return;
    const readyIds = readinessData.stores
      .filter((s) => s.readinessStatus === "READY")
      .map((s) => s.lineOfficialAccountId);
    setSelectedStoreOaIds(readyIds);
  };

  const handleToggleStoreSelect = (oaId: string) => {
    setSelectedStoreOaIds((prev) =>
      prev.includes(oaId) ? prev.filter((id) => id !== oaId) : [...prev, oaId],
    );
  };

  // Selected sample store metadata for live mobile preview
  const currentPreviewStore = useMemo(() => {
    if (!readinessData || !previewStoreId) {
      return {
        storeName: "OPPO Central Bangna",
        lineBasicId: "@900ytjrs",
        googleMapsUrl: "https://maps.google.com/?q=OPPO+Central+Bangna",
        accountName: "OPPO Central Bangna",
      };
    }
    const match = readinessData.stores.find(
      (s) => s.lineOfficialAccountId === previewStoreId,
    );
    if (!match) {
      return {
        storeName: "OPPO Central Bangna",
        lineBasicId: "@900ytjrs",
        googleMapsUrl: "https://maps.google.com/?q=OPPO+Central+Bangna",
        accountName: "OPPO Central Bangna",
      };
    }
    return {
      storeName: match.storeName || "OPPO Store",
      lineBasicId: match.storeCode || "@oppo_store",
      googleMapsUrl: match.googleMapsUrl || "https://maps.google.com",
      accountName: match.lineOfficialAccountName || match.storeName || "OPPO Store",
    };
  }, [readinessData, previewStoreId]);

  // Helper to render text bubbles with LINE-like green variable pills
  const renderPreviewMessageText = (rawText: string) => {
    if (!rawText) return null;

    // Split text by template variables {{...}}
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

  const filteredStores = useMemo(() => {
    if (!readinessData) return [];
    if (!storeSearch.trim()) return readinessData.stores;
    const q = storeSearch.toLowerCase();
    return readinessData.stores.filter(
      (s) =>
        s.storeName.toLowerCase().includes(q) ||
        s.lineOfficialAccountName.toLowerCase().includes(q) ||
        (s.storeCode && s.storeCode.toLowerCase().includes(q)),
    );
  }, [readinessData, storeSearch]);

  const assignedCount = readinessData?.assignedStores || 0;
  const readyCount = readinessData?.readyStores || 0;
  const blockedCount = readinessData?.blockedStores || 0;

  return (
    <div className="min-h-screen bg-[#ffffff] text-[var(--app-text-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Global Feedback Notifications */}
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

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Template Selector / Manage Switcher */}
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

            {/* Primary Save Changes Button matching LINE Green */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              className="inline-flex items-center justify-center px-6 py-2 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] active:bg-[#049b42] text-white shadow-xs transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {saving ? t.uploading : t.saveChanges}
            </button>
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

        {/* 3. Sending Restrictions Section matching LINE OA Manager */}
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

        {/* 4. Message Content & Preview Section matching 68% / 32% Layout */}
        <div className="pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {t.messageContent}
            </h2>

            {/* Template Name Input field for clear multi-store identification */}
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

          {/* 2-Column Grid: Left Editor (68%) / Right Sticky Preview (32%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Message Sequence Editor */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <GreetingMessageBuilder
                messages={formMessages}
                disabled={saving}
                t={t}
                onChange={setFormMessages}
              />

              {/* Bottom Secondary Save Button matching LINE OA Manager */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-8 py-2.5 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] active:bg-[#049b42] text-white shadow-xs transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? t.uploading : t.saveChanges}
                </button>
              </div>
            </div>

            {/* Right Column: Sticky Live Mobile Preview matching LINE OA screen */}
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

                {/* Preview Interactive Controls */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-2 text-xs">
                  {readinessData && readinessData.stores.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">
                        {t.previewStoreSelector}
                      </label>
                      <select
                        value={previewStoreId}
                        onChange={(e) => setPreviewStoreId(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800"
                      >
                        {readinessData.stores.map((s) => (
                          <option key={s.lineOfficialAccountId} value={s.lineOfficialAccountId}>
                            {s.storeName} ({s.readinessStatus})
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

        {/* 5. Store Assignments Section positioned cleanly below editor */}
        <div className="pt-8 pb-12 border-t border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {t.storeAssignmentsSection}
              </h2>
              <p className="mt-0.5 text-xs text-gray-600">
                {t.storesSummary(assignedCount, readyCount, blockedCount)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllReadyStores}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-2xs transition"
              >
                {t.applyToAllReady}
              </button>
              <button
                type="button"
                onClick={() => setShowStoreSection(!showStoreSection)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] text-white shadow-2xs transition"
              >
                {showStoreSection ? t.closeButton : t.manageStores} ({selectedStoreOaIds.length})
              </button>
            </div>
          </div>

          {/* Expandable Store Assignment Table */}
          {showStoreSection && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-xs space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder="ค้นหาชื่อสาขาหรือ LINE ID..."
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-md w-full sm:w-64 text-gray-800 focus:outline-none focus:border-[#06c755]"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStoreOaIds([])}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {t.clearSelection}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStoreAssignments}
                    disabled={savingAssignments}
                    className="px-4 py-1.5 text-xs font-semibold rounded bg-[#06c755] hover:bg-[#05b34c] text-white shadow-2xs disabled:opacity-50 transition"
                  >
                    {savingAssignments ? t.uploading : "บันทึกการผูกสาขา"}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5 w-10 text-center">{t.colSelect}</th>
                      <th className="p-2.5">{t.colStoreName}</th>
                      <th className="p-2.5">{t.colBasicId}</th>
                      <th className="p-2.5">{t.colReadiness}</th>
                      <th className="p-2.5">{t.colCurrentTemplate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStores.map((st) => {
                      const isSelected = selectedStoreOaIds.includes(st.lineOfficialAccountId);
                      const isReady = st.readinessStatus === "READY";
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
                          </td>
                          <td className="p-2.5 text-gray-500 font-mono">
                            {st.storeCode || "-"}
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
                          <td className="p-2.5 text-gray-500">
                            {st.currentTemplateName || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
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
