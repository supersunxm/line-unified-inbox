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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editor State
  const [editingTemplate, setEditingTemplate] = useState<GreetingTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSendPolicy, setFormSendPolicy] = useState<GreetingSendPolicy>("FIRST_TIME_ONLY");
  const [formMessages, setFormMessages] = useState<GreetingMessageBlock[]>([
    {
      id: "text-init",
      type: "TEXT",
      textTemplate: "สวัสดีคุณ {{user.displayName}} ยินดีต้อนรับสู่ {{store.storeName}} ครับ/ค่ะ",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [showActiveEditModal, setShowActiveEditModal] = useState(false);

  // Store Assignment State
  const [assigningTemplate, setAssigningTemplate] = useState<GreetingTemplate | null>(null);
  const [readinessData, setReadinessData] = useState<GreetingReadinessResponse | null>(null);
  const [selectedStoreOaIds, setSelectedStoreOaIds] = useState<string[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  // Preview State
  const [previewingTemplate, setPreviewingTemplate] = useState<GreetingTemplate | null>(null);
  const [previewResult, setPreviewResult] = useState<GreetingPreviewResult | null>(null);
  const [previewStoreId, setPreviewStoreId] = useState<string>("");
  const [previewCustomerName, setPreviewCustomerName] = useState<string>("คุณสมชาย");
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listGreetingTemplates({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setTemplates(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load greeting templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [statusFilter, search]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setIsCreating(true);
    setFormName("");
    setFormDescription("");
    setFormSendPolicy("FIRST_TIME_ONLY");
    setFormMessages([
      {
        id: `text-${Date.now()}`,
        type: "TEXT",
        textTemplate: "สวัสดีคุณ {{user.displayName}} ยินดีต้อนรับสู่ {{store.storeName}} ครับ/ค่ะ",
      },
    ]);
  };

  const handleOpenEdit = (template: GreetingTemplate) => {
    setEditingTemplate(template);
    setIsCreating(false);
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
              textTemplate: "สวัสดีคุณ {{user.displayName}} ยินดีต้อนรับสู่ {{store.storeName}}",
            },
          ],
    );
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setError("กรุณากรอกชื่อเทมเพลต");
      return;
    }

    // If editing an ACTIVE template with assigned stores -> trigger warning modal
    if (editingTemplate && editingTemplate.status === "ACTIVE" && editingTemplate.assignedStoreCount > 0) {
      setShowActiveEditModal(true);
      return;
    }

    performSave();
  };

  const performSave = async () => {
    setShowActiveEditModal(false);
    setSaving(true);
    setError(null);

    try {
      if (isCreating) {
        await api.createGreetingTemplate({
          name: formName.trim(),
          description: formDescription.trim() || null,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage("สร้างเทมเพลตข้อความต้อนรับสำเร็จ");
      } else if (editingTemplate) {
        await api.updateGreetingTemplate(editingTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          sendPolicy: formSendPolicy,
          messages: formMessages,
        });
        setSuccessMessage("บันทึกการแก้ไขเทมเพลตสำเร็จ");
      }

      setIsCreating(false);
      setEditingTemplate(null);
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    setError(null);
    try {
      await api.activateGreetingTemplate(id);
      setSuccessMessage("เปิดใช้งานเทมเพลตเรียบร้อยแล้ว");
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate template");
    }
  };

  const handleDeactivate = async (id: string) => {
    setError(null);
    try {
      await api.deactivateGreetingTemplate(id);
      setSuccessMessage("ปิดใช้งานเทมเพลตชั่วคราวเรียบร้อยแล้ว");
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate template");
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm(t.archiveConfirm)) return;
    setError(null);
    try {
      await api.archiveGreetingTemplate(id);
      setSuccessMessage("จัดเก็บเทมเพลตเรียบร้อยแล้ว");
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive template");
    }
  };

  // Store Readiness & Assignment
  const handleOpenAssignStores = async (template: GreetingTemplate) => {
    setAssigningTemplate(template);
    setReadinessData(null);
    setError(null);

    try {
      const res = await api.getGreetingReadiness(template.id);
      setReadinessData(res);
      const currentlyAssigned = res.stores
        .filter((s) => s.isAssigned)
        .map((s) => s.lineOfficialAccountId);
      setSelectedStoreOaIds(currentlyAssigned);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load store readiness");
    }
  };

  const handleToggleStore = (oaId: string) => {
    setSelectedStoreOaIds((prev) =>
      prev.includes(oaId) ? prev.filter((id) => id !== oaId) : [...prev, oaId],
    );
  };

  const handleSelectAllReady = () => {
    if (!readinessData) return;
    const readyIds = readinessData.stores
      .filter((s) => s.readinessStatus === "READY")
      .map((s) => s.lineOfficialAccountId);
    setSelectedStoreOaIds(readyIds);
  };

  const handleClearSelection = () => {
    setSelectedStoreOaIds([]);
  };

  const handleSaveAssignments = async () => {
    if (!assigningTemplate) return;
    setSavingAssignments(true);
    setError(null);

    try {
      const res = await api.assignGreetingStores(assigningTemplate.id, {
        lineOfficialAccountIds: selectedStoreOaIds,
      });
      setSuccessMessage(t.saveAssignmentsSuccess(res.assignedCount));
      setAssigningTemplate(null);
      await fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign stores");
    } finally {
      setSavingAssignments(false);
    }
  };

  // Preview Logic
  const handleOpenPreview = async (template: GreetingTemplate) => {
    setPreviewingTemplate(template);
    setPreviewResult(null);
    setPreviewLoading(true);
    setError(null);

    try {
      const res = await api.previewGreeting(template.id, {
        sampleCustomerName: previewCustomerName,
      });
      setPreviewResult(res);
      if (res.store.lineOfficialAccountId) {
        setPreviewStoreId(res.store.lineOfficialAccountId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to preview template");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRefreshPreview = async (storeId?: string, customerName?: string) => {
    if (!previewingTemplate) return;
    setPreviewLoading(true);
    try {
      const res = await api.previewGreeting(previewingTemplate.id, {
        lineOfficialAccountId: storeId || previewStoreId || undefined,
        sampleCustomerName: customerName || previewCustomerName,
      });
      setPreviewResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to preview template");
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredStoresForAssignment = useMemo(() => {
    if (!readinessData) return [];
    if (!storeSearch.trim()) return readinessData.stores;
    const q = storeSearch.trim().toLowerCase();
    return readinessData.stores.filter(
      (s) =>
        s.storeName.toLowerCase().includes(q) ||
        (s.storeCode && s.storeCode.toLowerCase().includes(q)) ||
        (s.province && s.province.toLowerCase().includes(q)),
    );
  }, [readinessData, storeSearch]);

  const isFormOpen = isCreating || Boolean(editingTemplate);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--app-text-primary)] sm:text-2xl">
            {t.title}
          </h1>
          <p className="mt-1 text-xs text-[var(--app-text-tertiary)] sm:text-sm">
            {t.subtitle}
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:scale-98"
          >
            <span>+</span>
            <span>{t.createTemplateButton}</span>
          </button>
        )}
      </div>

      {/* Permanent Native OA Manager Duplication Warning Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-medium text-amber-800 dark:text-amber-200">
        <span className="text-base leading-none">⚠️</span>
        <div className="flex-1 leading-relaxed">{t.duplicationWarning}</div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      {/* MAIN VIEW: FORM vs LIST */}
      {isFormOpen ? (
        /* Template Editor Form */
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-4">
            <h2 className="text-lg font-bold text-[var(--app-text-primary)]">
              {isCreating ? t.editorCreateTitle : t.editorEditTitle}
            </h2>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingTemplate(null);
              }}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs font-medium text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
            >
              {t.cancelButton}
            </button>
          </div>

          <form onSubmit={handleSaveClick} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--app-text-primary)]">
                  {t.fieldName} *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t.fieldNamePlaceholder}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--app-text-primary)]">
                  {t.fieldDescription}
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t.fieldDescriptionPlaceholder}
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Send Policy Selector */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-[var(--app-text-primary)]">
                {t.fieldSendPolicy}
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer flex-col rounded-xl border p-3.5 transition-colors ${
                    formSendPolicy === "FIRST_TIME_ONLY"
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sendPolicy"
                      value="FIRST_TIME_ONLY"
                      checked={formSendPolicy === "FIRST_TIME_ONLY"}
                      onChange={() => setFormSendPolicy("FIRST_TIME_ONLY")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-[var(--app-text-primary)]">
                      {t.sendPolicyFirstTime}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--app-text-tertiary)] pl-5">
                    {t.sendPolicyFirstTimeDesc}
                  </p>
                </label>

                <label
                  className={`flex cursor-pointer flex-col rounded-xl border p-3.5 transition-colors ${
                    formSendPolicy === "ADD_AND_UNBLOCK"
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-[var(--app-border)] bg-[var(--app-surface-subtle)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="sendPolicy"
                      value="ADD_AND_UNBLOCK"
                      checked={formSendPolicy === "ADD_AND_UNBLOCK"}
                      onChange={() => setFormSendPolicy("ADD_AND_UNBLOCK")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-[var(--app-text-primary)]">
                      {t.sendPolicyAddAndUnblock}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--app-text-tertiary)] pl-5">
                    {t.sendPolicyAddAndUnblockDesc}
                  </p>
                </label>
              </div>
            </div>

            {/* Message Sequence Builder */}
            <GreetingMessageBuilder
              messages={formMessages}
              disabled={saving}
              t={t}
              onChange={setFormMessages}
            />

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--app-border-subtle)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingTemplate(null);
                }}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.cancelButton}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : t.saveTemplateButton}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Template List View */
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "ALL", label: t.filterAll },
                { id: "ACTIVE", label: t.filterActive },
                { id: "DRAFT", label: t.filterDraft },
                { id: "INACTIVE", label: t.filterInactive },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.id
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-64 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-tertiary)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-xs text-[var(--app-text-tertiary)]">
              กำลังโหลดข้อมูล...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-12 text-center">
              <div className="text-2xl">👋</div>
              <h3 className="mt-2 text-sm font-semibold text-[var(--app-text-primary)]">
                {t.emptyList}
              </h3>
              <p className="mt-1 text-xs text-[var(--app-text-tertiary)]">
                {t.emptyListDesc}
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {t.createTemplateButton}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const messageCount = template.messages?.length || 0;
                const statusColor =
                  template.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : template.status === "DRAFT"
                      ? "bg-slate-500/10 text-slate-600 border-slate-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20";

                return (
                  <div
                    key={template.id}
                    className="flex flex-col justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-[var(--app-text-primary)] text-sm">
                              {template.name}
                            </h3>
                            <span className="rounded-md bg-[var(--app-surface-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--app-text-tertiary)]">
                              {t.versionLabel(template.version)}
                            </span>
                          </div>
                          {template.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--app-text-tertiary)]">
                              {template.description}
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}
                        >
                          {template.status === "ACTIVE"
                            ? t.statusActive
                            : template.status === "DRAFT"
                              ? t.statusDraft
                              : t.statusInactive}
                        </span>
                      </div>

                      {/* Badges Info */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          {template.sendPolicy === "FIRST_TIME_ONLY"
                            ? t.sendPolicyFirstTime
                            : t.sendPolicyAddAndUnblock}
                        </span>
                        <span className="rounded-lg bg-[var(--app-surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--app-text-secondary)]">
                          💬 {messageCount} บล็อก
                        </span>
                        <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          🏪 {t.assignedStoresLabel(template.assignedStoreCount)}
                        </span>
                      </div>

                      {/* Variables Used */}
                      {template.usedVariables.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {template.usedVariables.map((v) => (
                            <span
                              key={v}
                              className="rounded bg-[var(--app-surface-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--app-text-tertiary)]"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Action Buttons */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--app-border-subtle)] pt-3 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(template)}
                          className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                        >
                          {t.previewButton}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignStores(template)}
                          className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          {t.assignStoresButton}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(template)}
                          className="rounded-lg border border-[var(--app-border)] px-2.5 py-1 text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                        >
                          {t.editButton}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {template.status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(template.id)}
                            className="rounded-lg px-2.5 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          >
                            {t.deactivateButton}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(template.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
                          >
                            {t.activateButton}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleArchive(template.id)}
                          className="rounded-lg p-1 text-[var(--app-danger)] hover:bg-[var(--app-danger-soft)]"
                          title={t.archiveButton}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE EDIT WARNING MODAL */}
      {showActiveEditModal && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl">
            <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">
              {t.activeEditWarningTitle}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-secondary)]">
              {t.activeEditWarningMessage(editingTemplate.assignedStoreCount)}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowActiveEditModal(false)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.activeEditWarningCancel}
              </button>
              <button
                type="button"
                onClick={performSave}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                {t.activeEditWarningConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STORE ASSIGNMENT MODAL */}
      {assigningTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] p-5">
              <div>
                <h3 className="text-base font-bold text-[var(--app-text-primary)]">
                  {t.storeAssignmentTitle}: {assigningTemplate.name}
                </h3>
                <p className="text-xs text-[var(--app-text-tertiary)]">
                  {t.storeAssignmentDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningTemplate(null)}
                className="rounded-lg p-1.5 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)]"
              >
                ✕
              </button>
            </div>

            {/* Sub-bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border-subtle)] bg-[var(--app-surface-subtle)] p-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllReady}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs font-semibold text-emerald-600 shadow-xs hover:bg-[var(--app-surface-hover)] dark:text-emerald-400"
                >
                  {t.selectAllReady}
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-secondary)] shadow-xs hover:bg-[var(--app-surface-hover)]"
                >
                  {t.clearSelection}
                </button>
                {readinessData && (
                  <span className="text-xs text-[var(--app-text-tertiary)] ml-2">
                    {t.readyStoresSummary(
                      readinessData.readyStores,
                      readinessData.totalStores,
                      selectedStoreOaIds.length,
                    )}
                  </span>
                )}
              </div>

              <input
                type="search"
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                placeholder="ค้นหาชื่อสาขา / รหัสสาขา / จังหวัด..."
                className="w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-xs text-[var(--app-text-primary)] focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Table Area */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!readinessData ? (
                <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">
                  กำลังประเมินความพร้อมของสาขา...
                </div>
              ) : filteredStoresForAssignment.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--app-text-tertiary)]">
                  ไม่พบสาขาที่ตรงกับการค้นหา
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-text-tertiary)] uppercase tracking-wider">
                      <th className="p-2.5 w-12 text-center">{t.colSelect}</th>
                      <th className="p-2.5">{t.colStoreName}</th>
                      <th className="p-2.5">{t.colBasicId}</th>
                      <th className="p-2.5">{t.colGoogleMaps}</th>
                      <th className="p-2.5">{t.colReadiness}</th>
                      <th className="p-2.5">{t.colCurrentTemplate}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border-subtle)]">
                    {filteredStoresForAssignment.map((store) => {
                      const isSelected = selectedStoreOaIds.includes(
                        store.lineOfficialAccountId,
                      );
                      const isReady = store.readinessStatus === "READY";

                      return (
                        <tr
                          key={store.lineOfficialAccountId}
                          onClick={() => handleToggleStore(store.lineOfficialAccountId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-emerald-500/5"
                              : "hover:bg-[var(--app-surface-hover)]"
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStore(store.lineOfficialAccountId)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-2.5 font-semibold text-[var(--app-text-primary)]">
                            <div>{store.storeName}</div>
                            {store.storeCode && (
                              <div className="text-[10px] font-mono text-[var(--app-text-tertiary)]">
                                {store.storeCode} ({store.province || "N/A"})
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[var(--app-text-secondary)]">
                            {store.lineOfficialAccountName}
                          </td>
                          <td className="p-2.5">
                            {store.googleMapsUrl ? (
                              <span className="text-emerald-600 dark:text-emerald-400">✓ มี URL</span>
                            ) : (
                              <span className="text-[var(--app-text-tertiary)]">- ไม่มี -</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {isReady ? (
                              <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {t.statusReady}
                              </span>
                            ) : (
                              <span
                                className="inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400"
                                title={store.reason || undefined}
                              >
                                {t.statusBlocked}: {store.missingVariables.join(", ")}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-[11px] text-[var(--app-text-secondary)]">
                            {store.currentTemplateId === assigningTemplate.id ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {t.assignedToThis}
                              </span>
                            ) : store.currentTemplateName ? (
                              <span className="text-[var(--app-text-tertiary)]">
                                {t.assignedToOther(store.currentTemplateName)}
                              </span>
                            ) : (
                              <span className="text-[var(--app-text-tertiary)]">
                                {t.notAssigned}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--app-border-subtle)] p-4 bg-[var(--app-surface)]">
              <span className="text-xs font-medium text-[var(--app-text-secondary)]">
                เลือกทั้งหมด: {selectedStoreOaIds.length} สาขา
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningTemplate(null)}
                  className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
                >
                  {t.cancelButton}
                </button>
                <button
                  type="button"
                  disabled={savingAssignments}
                  onClick={handleSaveAssignments}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingAssignments ? "กำลังบันทึก..." : t.saveAndAssignButton}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE MOBILE PREVIEW MODAL */}
      {previewingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--app-border-subtle)] p-4 bg-[var(--app-surface-subtle)]">
              <div>
                <h3 className="text-sm font-bold text-[var(--app-text-primary)]">
                  {t.previewTitle}
                </h3>
                <p className="text-[11px] text-[var(--app-text-tertiary)]">
                  {previewingTemplate.name} ({t.versionLabel(previewingTemplate.version)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingTemplate(null)}
                className="rounded-lg p-1.5 text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)]"
              >
                ✕
              </button>
            </div>

            {/* Simulation Controls */}
            <div className="border-b border-[var(--app-border-subtle)] p-3 space-y-2 bg-[var(--app-surface)]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-[var(--app-text-tertiary)]">
                    {t.previewCustomerNameLabel}
                  </label>
                  <input
                    type="text"
                    value={previewCustomerName}
                    onChange={(e) => {
                      setPreviewCustomerName(e.target.value);
                      handleRefreshPreview(undefined, e.target.value);
                    }}
                    placeholder={t.previewCustomerNamePlaceholder}
                    className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-[var(--app-text-tertiary)]">
                    {t.previewStoreSelector}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={previewResult?.store.storeName || "OPPO Brand Shop"}
                    className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)] opacity-80"
                  />
                </div>
              </div>

              <div className="text-[10px] text-[var(--app-text-tertiary)] flex items-center justify-between">
                <span>{t.previewNoticeZeroPush}</span>
                {previewResult?.ready ? (
                  <span className="text-emerald-600 font-semibold dark:text-emerald-400">
                    ✓ {t.previewReadyBadge}
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold dark:text-red-400">
                    ⚠️ {t.previewBlockedBadge}
                  </span>
                )}
              </div>
            </div>

            {/* Simulated Phone Screen */}
            <div className="flex-1 overflow-y-auto bg-[#8499B1] p-4 min-h-[360px]">
              {/* Simulated LINE Header */}
              <div className="mx-auto mb-3 flex max-w-xs items-center justify-center rounded-full bg-black/20 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                {t.previewSimulateFollow}
              </div>

              {previewLoading ? (
                <div className="p-8 text-center text-xs text-white">
                  กำลังสร้างข้อความตัวอย่าง...
                </div>
              ) : previewResult ? (
                <div className="mx-auto max-w-xs space-y-3">
                  {previewResult.messages?.map((msg, i) => {
                    if (msg.type === "TEXT") {
                      return (
                        <div key={msg.id || i} className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-xs font-bold text-white shadow-xs">
                            O
                          </div>
                          <div className="max-w-[80%] rounded-2xl rounded-tl-xs bg-white p-3 text-xs text-gray-900 shadow-md whitespace-pre-wrap leading-relaxed">
                            {msg.resolvedText}
                          </div>
                        </div>
                      );
                    }

                    if (msg.type === "IMAGE") {
                      return (
                        <div key={msg.id || i} className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent)] text-xs font-bold text-white shadow-xs">
                            O
                          </div>
                          <div className="max-w-[80%] overflow-hidden rounded-2xl rounded-tl-xs bg-white shadow-md">
                            <img
                              src={msg.imageUrl || msg.previewUrl}
                              alt="Greeting Preview"
                              className="max-h-48 w-full object-contain"
                            />
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--app-border-subtle)] p-3 bg-[var(--app-surface)] text-right">
              <button
                type="button"
                onClick={() => setPreviewingTemplate(null)}
                className="rounded-xl border border-[var(--app-border)] px-4 py-1.5 text-xs font-semibold text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              >
                {t.closeButton}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
