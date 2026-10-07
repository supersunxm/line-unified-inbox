"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { richMessageApi, type RichMessage } from "../rich-messages/rich-message-api";
import type {
  ApiStore,
  BroadcastAdvanced,
  BroadcastCampaignDetail,
  BroadcastCreateInput,
  BroadcastFriendshipPeriod,
  BroadcastMessageItem,
  BroadcastPreviewResult,
  BroadcastSchedule,
  BroadcastStorePreview,
  BroadcastTargeting,
  MassMessageStoreMode,
} from "@/types/api";
import type { Language } from "@/components/shell/top-navigation";

type Props = {
  language: Language;
  userRole: string;
};

type DraftTextMessage = {
  id: string;
  type: "text";
  text: string;
};

type DraftImageMessage = {
  id: string;
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
  fileName: string;
};

type DraftRichMessage = {
  id: string;
  type: "rich_message";
  richMessageId: string;
  richMessageName: string;
  previewUrl: string;
  altText: string;
  actionCount: number;
};

type DraftMessage = DraftTextMessage | DraftImageMessage | DraftRichMessage;
type ViewMode = "compose" | "progress" | "history";
type StoreStatusFilter = "ALL" | "READY" | "BLOCKED";

const STORE_VARIABLES = [
  { token: "{{storeName}}", label: "ชื่อร้าน" },
  { token: "{{storeLocationText}}", label: "สถานที่ร้าน" },
] as const;

const PERIODS: Array<{ key: BroadcastFriendshipPeriod; label: string }> = [
  { key: "LE_6", label: "6 days or less" },
  { key: "D7_29", label: "Between 7 and 29 days" },
  { key: "D30_89", label: "Between 30 and 89 days" },
  { key: "D90_179", label: "Between 90 and 179 days" },
  { key: "D180_364", label: "Between 180 and 364 days" },
  { key: "D365_PLUS", label: "365 days or more" },
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function tomorrowDefaults() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()),
    time: pad(date.getHours()) + ":" + pad(date.getMinutes()),
  };
}

function fmt(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function statusTone(status: string) {
  if (["SUCCESS", "COMPLETED"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["FAILED", "BLOCKED"].includes(status)) return "bg-red-50 text-red-700 border-red-200";
  if (["PARTIAL"].includes(status)) return "bg-amber-50 text-amber-700 border-amber-200";
  if (["RUNNING", "PENDING"].includes(status)) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function reasonText(reason: string | null) {
  const labels: Record<string, string> = {
    TARGET_REACH_BELOW_100: "Target reach ต่ำกว่า 100",
    MISSING_TOKEN: "ไม่มี Channel Access Token",
    INVALID_CONNECTION: "LINE OA ยังไม่พร้อมใช้งาน",
    STORE_NOT_ACTIVE: "ร้านไม่ Active",
    UNAUTHORIZED: "ไม่มีสิทธิ์เข้าถึงร้าน",
    MISSING_TEMPLATE_VARIABLES: "ข้อมูลตัวแปรของร้านไม่ครบ",
  };
  return reason ? labels[reason] ?? reason : "";
}

function warningText(code: string) {
  const labels: Record<string, string> = {
    TARGET_REACH_UNKNOWN: "ยังไม่มีข้อมูล Target reach ล่าสุด — LINE จะตรวจอีกครั้งตอนส่งจริง",
    FOLLOWER_SNAPSHOT_MISSING: "ยังไม่มี follower snapshot",
    FOLLOWER_SNAPSHOT_STALE: "follower snapshot เก่ากว่า 7 วัน",
    MISSING_TEMPLATE_VARIABLES: "ข้อมูลตัวแปรของร้านไม่ครบ",
  };
  return labels[code] ?? code;
}

export function BroadcastView({ language, userRole }: Props) {
  const defaults = useMemo(() => tomorrowDefaults(), []);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [viewMode, setViewMode] = useState<ViewMode>("compose");
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [storeMode, setStoreMode] = useState<MassMessageStoreMode>("ALL");
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [storeSearch, setStoreSearch] = useState("");
  const [storeStatusFilter, setStoreStatusFilter] = useState<StoreStatusFilter>("ALL");
  const [showAllStores, setShowAllStores] = useState(false);

  const [targetMode, setTargetMode] = useState<"ALL_FRIENDS" | "FRIENDSHIP_PERIOD">("FRIENDSHIP_PERIOD");
  const [periods, setPeriods] = useState<Set<BroadcastFriendshipPeriod>>(
    new Set(["D180_364", "D365_PLUS"]),
  );
  const [recipientLabel, setRecipientLabel] = useState("");

  const [scheduleMode, setScheduleMode] = useState<"NOW" | "SCHEDULED">("NOW");
  const [scheduleDate, setScheduleDate] = useState(defaults.date);
  const [scheduleTime, setScheduleTime] = useState(defaults.time);
  const [allowPartial, setAllowPartial] = useState(true);
  const [maxVolumeEnabled, setMaxVolumeEnabled] = useState(false);
  const [maxVolume, setMaxVolume] = useState("");

  const [messages, setMessages] = useState<DraftMessage[]>([
    { id: createId(), type: "text", text: "" },
  ]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [richPickerOpen, setRichPickerOpen] = useState(false);
  const [richItems, setRichItems] = useState<RichMessage[]>([]);
  const [richLoading, setRichLoading] = useState(false);
  const [richError, setRichError] = useState<string | null>(null);

  const [preview, setPreview] = useState<BroadcastPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [campaignRequestId, setCampaignRequestId] = useState(createId());
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<BroadcastCampaignDetail | null>(null);
  const [history, setHistory] = useState<BroadcastCampaignDetail[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const canSend = userRole === "ADMIN";

  useEffect(() => {
    let cancelled = false;
    void api.stores()
      .then((items) => {
        if (cancelled) return;
        const active = (items as ApiStore[]).filter((store) => store.isActive !== false && !store.archivedAt);
        setStores(active);
      })
      .catch((error: unknown) => {
        if (!cancelled) setPageError(error instanceof Error ? error.message : "Unable to load stores");
      });
    return () => { cancelled = true; };
  }, []);

  const targeting = useMemo<BroadcastTargeting>(() => {
    if (targetMode === "ALL_FRIENDS") return { mode: "ALL_FRIENDS" };
    return { mode: "FRIENDSHIP_PERIOD", periods: Array.from(periods) };
  }, [targetMode, periods]);

  const advanced = useMemo<BroadcastAdvanced>(() => ({
    allowPartial,
    maxVolume: maxVolumeEnabled && Number(maxVolume) > 0 ? Number(maxVolume) : null,
  }), [allowPartial, maxVolumeEnabled, maxVolume]);

  const storeSelection = useMemo(() => ({
    mode: storeMode,
    ...(storeMode === "ALL" ? {} : { storeIds: Array.from(selectedStoreIds) }),
  }), [storeMode, selectedStoreIds]);

  const payloadMessages = useMemo<BroadcastMessageItem[]>(() => messages.flatMap((message) => {
    if (message.type === "text") {
      const text = message.text.trim();
      return text ? [{ type: "text" as const, text }] : [];
    }
    if (message.type === "image") {
      return [{
        type: "image" as const,
        originalContentUrl: message.originalContentUrl,
        previewImageUrl: message.previewImageUrl,
      }];
    }
    return [{
      type: "rich_message" as const,
      richMessageId: message.richMessageId,
    }];
  }), [messages]);

  const broadcastValidationSignature = useMemo(() => {
    const variables = new Set<string>();
    const richMessageIds: string[] = [];
    for (const message of payloadMessages) {
      if (message.type === "text") {
        for (const match of message.text.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
          if (match[1]) variables.add(match[1]);
        }
      } else if (message.type === "rich_message") {
        richMessageIds.push(message.richMessageId);
      }
    }
    return [
      Array.from(variables).sort().join("|"),
      richMessageIds.sort().join("|"),
    ].join("::");
  }, [payloadMessages]);

  useEffect(() => {
    if (stores.length === 0) return;
    if (storeMode !== "ALL" && selectedStoreIds.size === 0) {
      setPreview(null);
      return;
    }
    if (targetMode === "FRIENDSHIP_PERIOD" && periods.size === 0) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError(null);
      void api.previewBroadcast({ storeSelection, targeting, advanced, messages: payloadMessages })
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setPreview(null);
            setPreviewError(error instanceof Error ? error.message : "Preview failed");
          }
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [advanced, periods.size, selectedStoreIds.size, storeMode, storeSelection, stores.length, targetMode, targeting, broadcastValidationSignature]);

  useEffect(() => {
    if (viewMode !== "progress" || !activeCampaign) return;
    if (!["PENDING", "RUNNING"].includes(activeCampaign.status)) return;
    const timer = window.setInterval(() => {
      void api.getBroadcastCampaign(activeCampaign.id)
        .then((campaign) => setActiveCampaign(campaign))
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeCampaign, viewMode]);

  const previewByStore = useMemo(() => {
    const map = new Map<string, BroadcastStorePreview>();
    for (const item of preview?.stores ?? []) map.set(item.storeId, item);
    return map;
  }, [preview]);

  const allSelectedIds = useMemo(() => stores.map((store) => store.id), [stores]);
  const effectiveSelected = useMemo(
    () => (storeMode === "ALL" ? new Set(allSelectedIds) : selectedStoreIds),
    [allSelectedIds, selectedStoreIds, storeMode],
  );

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    const rows = stores.filter((store) => {
      if (q && !((store.name + " " + (store.code ?? "")).toLowerCase().includes(q))) return false;
      const status = previewByStore.get(store.id)?.status;
      if (storeStatusFilter !== "ALL" && status && status !== storeStatusFilter) return false;
      return true;
    });
    return showAllStores ? rows : rows.slice(0, 10);
  }, [previewByStore, showAllStores, storeSearch, storeStatusFilter, stores]);

  const schedule = useMemo<BroadcastSchedule>(() => {
    if (scheduleMode === "NOW") return { mode: "NOW" };
    const timestamp = new Date(scheduleDate + "T" + scheduleTime + ":00").getTime();
    return {
      mode: "SCHEDULED",
      scheduledAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "",
    };
  }, [scheduleDate, scheduleMode, scheduleTime]);

  const createInput = (): BroadcastCreateInput => ({
    campaignRequestId,
    title: recipientLabel.trim() || undefined,
    storeSelection,
    targeting,
    advanced,
    messages: payloadMessages,
    schedule,
  });

  const togglePeriod = (key: BroadcastFriendshipPeriod) => {
    setPeriods((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllStores = () => {
    setStoreMode("ALL");
    setSelectedStoreIds(new Set());
  };

  const clearStores = () => {
    setStoreMode("MULTIPLE");
    setSelectedStoreIds(new Set());
  };

  const toggleStore = (id: string) => {
    if (storeMode === "ALL") {
      setStoreMode("MULTIPLE");
      setSelectedStoreIds(new Set(allSelectedIds.filter((storeId) => storeId !== id)));
      return;
    }
    setSelectedStoreIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === allSelectedIds.length) {
        setStoreMode("ALL");
        return new Set();
      }
      return next;
    });
  };

  const updateTextMessage = (id: string, text: string) => {
    setMessages((current) => current.map((message) =>
      message.id === id && message.type === "text" ? { ...message, text } : message,
    ));
  };

  const insertStoreVariable = (id: string, token: string) => {
    const textarea = textAreaRefs.current[id];
    const start = textarea?.selectionStart;
    const end = textarea?.selectionEnd;
    let nextCursor: number | null = null;

    setMessages((current) => current.map((message) => {
      if (message.id !== id || message.type !== "text") return message;
      const from = typeof start === "number" ? start : message.text.length;
      const to = typeof end === "number" ? end : from;
      const nextText = message.text.slice(0, from) + token + message.text.slice(to);
      if (nextText.length > 5000) return message;
      nextCursor = from + token.length;
      return { ...message, text: nextText };
    }));

    window.requestAnimationFrame(() => {
      const current = textAreaRefs.current[id];
      if (!current || nextCursor === null) return;
      current.focus();
      current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const addTextMessage = () => {
    if (messages.length >= 5) return;
    setMessages((current) => [...current, { id: createId(), type: "text", text: "" }]);
  };

  const openRichMessagePicker = async () => {
    if (messages.length >= 5) return;
    setRichPickerOpen(true);
    setRichLoading(true);
    setRichError(null);
    try {
      setRichItems(await richMessageApi.list(false));
    } catch (error) {
      setRichError(error instanceof Error ? error.message : "โหลด Rich Message ไม่สำเร็จ");
    } finally {
      setRichLoading(false);
    }
  };

  const addRichMessage = (item: RichMessage) => {
    if (messages.length >= 5) return;
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        type: "rich_message",
        richMessageId: item.id,
        richMessageName: item.name,
        previewUrl: item.previewUrl || item.imageUrl,
        altText: item.altText,
        actionCount: item.actions.length,
      },
    ]);
    setRichPickerOpen(false);
  };

  const onImagePicked = async (file: File | null) => {
    if (!file || messages.length >= 5) return;
    setUploadingImage(true);
    setPageError(null);
    try {
      const uploaded = await api.uploadMassMessageImage(file);
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          type: "image",
          originalContentUrl: uploaded.url,
          previewImageUrl: uploaded.previewUrl,
          fileName: file.name,
        },
      ]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const moveMessage = (index: number, delta: -1 | 1) => {
    setMessages((current) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const removeMessage = (id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  };

  const handleSaveDraft = async () => {
    if (!canSend) return;
    setDraftSaving(true);
    setPageError(null);
    try {
      await api.saveBroadcastDraft(createInput());
      setDraftSavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to save draft");
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setPageError(null);
    try {
      const campaign = await api.createBroadcast(createInput());
      setActiveCampaign(campaign);
      setConfirmOpen(false);
      setViewMode("progress");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const openHistory = async () => {
    setViewMode("history");
    setHistoryLoading(true);
    try {
      const result = await api.listBroadcastCampaigns(50, 0);
      setHistory(result.items);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCampaign = async (id: string) => {
    setPageError(null);
    try {
      const campaign = await api.getBroadcastCampaign(id);
      setActiveCampaign(campaign);
      setViewMode("progress");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load campaign");
    }
  };

  const retryFailed = async () => {
    if (!activeCampaign) return;
    setSending(true);
    try {
      const campaign = await api.retryFailedBroadcast(activeCampaign.id);
      setActiveCampaign(campaign);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setSending(false);
    }
  };

  const selectedCount = effectiveSelected.size;
  const blockedCount = preview?.blockedStoreCount ?? 0;
  const readyCount = preview?.readyStoreCount ?? 0;
  const hasMessages = payloadMessages.length > 0;
  const targetingReady = targetMode === "ALL_FRIENDS" || periods.size > 0;
  const storesReady = selectedCount > 0 && readyCount > 0;
  const scheduleReady =
    scheduleMode === "NOW" ||
    (scheduleDate && scheduleTime && new Date(scheduleDate + "T" + scheduleTime + ":00").getTime() > Date.now() + 10_000);
  const canSubmit = canSend && hasMessages && targetingReady && storesReady && scheduleReady && !previewLoading;

  if (viewMode === "history") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
        <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">Broadcast history</h1>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">ประวัติการส่ง Broadcast แบบหลายสาขา</p>
            </div>
            <button type="button" onClick={() => setViewMode("compose")} className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white">
              + New broadcast
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            {historyLoading ? (
              <div className="p-8 text-center text-sm text-[var(--app-text-secondary)]">Loading…</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--app-text-secondary)]">ยังไม่มี Broadcast</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-[var(--app-surface-subtle)] text-xs uppercase tracking-wide text-[var(--app-text-tertiary)]">
                    <tr>
                      <th className="px-4 py-3">Campaign</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Stores</th>
                      <th className="px-4 py-3">Reach</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} onClick={() => void openCampaign(item.id)} className="cursor-pointer border-t border-[var(--app-border-subtle)] hover:bg-[var(--app-surface-hover)]">
                        <td className="px-4 py-3 font-semibold text-[var(--app-text-primary)]">{item.title || "Untitled broadcast"}</td>
                        <td className="px-4 py-3 text-[var(--app-text-secondary)]">{item.audienceType === "ALL_FRIENDS" ? "All friends" : "Friendship period"}</td>
                        <td className="px-4 py-3">{item.eligibleStoreCount}/{item.storeCount}</td>
                        <td className="px-4 py-3">~ {fmt(item.estimatedRecipientCount)}</td>
                        <td className="px-4 py-3"><span className={"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " + statusTone(item.status)}>{item.status}</span></td>
                        <td className="px-4 py-3 text-[var(--app-text-secondary)]">{new Date(item.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "progress" && activeCampaign) {
    const deliveries = activeCampaign.storeDeliveries ?? [];
    const failedStores = deliveries.filter((item) => ["FAILED", "PARTIAL"].includes(item.status)).length;
    const successStores = deliveries.filter((item) => item.status === "SUCCESS").length;
    const runningStores = deliveries.filter((item) => ["PENDING", "RUNNING"].includes(item.status)).length;
    return (
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
        <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <button type="button" onClick={() => setViewMode("compose")} className="mb-2 text-sm font-medium text-[var(--app-accent)]">← New broadcast</button>
              <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">{activeCampaign.title || "Broadcast"}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={"inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold " + statusTone(activeCampaign.status)}>{activeCampaign.status}</span>
                {activeCampaign.scheduledAt && <span className="rounded-full border border-[var(--app-border)] px-2.5 py-1 text-xs text-[var(--app-text-secondary)]">Scheduled {new Date(activeCampaign.scheduledAt).toLocaleString()}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void openHistory()} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold">History</button>
              {failedStores > 0 && (
                <button type="button" disabled={sending} onClick={() => void retryFailed()} className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Retry failed stores
                </button>
              )}
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Selected stores", activeCampaign.storeCount],
              ["Succeeded", successStores],
              ["Running", runningStores],
              ["Failed / partial", failedStores],
              ["Estimated reach", activeCampaign.estimatedRecipientCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
                <div className="text-xs text-[var(--app-text-tertiary)]">{label}</div>
                <div className="mt-1 text-2xl font-bold text-[var(--app-text-primary)]">{fmt(Number(value))}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <div className="border-b border-[var(--app-border)] px-4 py-3 font-semibold">Store delivery status</div>
            <div className="max-h-[62vh] overflow-auto">
              {deliveries.map((item) => (
                <div key={item.id} className="grid gap-2 border-b border-[var(--app-border-subtle)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_130px_120px_220px] md:items-center">
                  <div>
                    <div className="font-medium text-[var(--app-text-primary)]">{item.storeName}</div>
                    <div className="text-xs text-[var(--app-text-tertiary)]">{item.storeCode || item.externalStoreId || ""}</div>
                  </div>
                  <div><span className={"inline-flex rounded-full border px-2 py-1 text-xs font-semibold " + statusTone(item.status)}>{item.status}</span></div>
                  <div className="text-xs text-[var(--app-text-secondary)]">~ {fmt(item.recipientCount)}</div>
                  <div className="text-xs text-[var(--app-danger)]">{item.errorMessage || item.skipReason || ""}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
      <div className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--app-text-tertiary)]">Broadcast  ›  New broadcast</div>
            <h1 className="text-2xl font-bold text-[var(--app-text-primary)]">Broadcast</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">ส่งข้อความถึงเพื่อนใน LINE OA ของหลายสาขาพร้อมกัน</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void openHistory()} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold">History</button>
            <button type="button" disabled={draftSaving || !canSend} onClick={() => void handleSaveDraft()} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {draftSaving ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled title="Messaging API does not provide LINE OA Manager admin test-send recipients." className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-2 text-sm font-semibold text-[var(--app-text-tertiary)] opacity-60">
              Send test
            </button>
            <button type="button" disabled={!canSubmit} onClick={() => setConfirmOpen(true)} className="rounded-xl bg-[var(--app-accent)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
              {scheduleMode === "NOW" ? "Send" : "Schedule"}
            </button>
          </div>
        </div>

        {pageError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>
        )}
        {draftSavedAt && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Draft saved at {draftSavedAt}</div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">1</div>
                <div><h2 className="font-bold text-[var(--app-text-primary)]">Recipients</h2><p className="text-xs text-[var(--app-text-tertiary)]">เลือกกลุ่มเป้าหมายที่ต้องการส่ง</p></div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={() => setTargetMode("ALL_FRIENDS")} className={"rounded-xl border p-4 text-left transition " + (targetMode === "ALL_FRIENDS" ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]" : "border-[var(--app-border)]")}>
                  <div className="flex items-center gap-2"><span className={"h-4 w-4 rounded-full border-4 " + (targetMode === "ALL_FRIENDS" ? "border-[var(--app-accent)]" : "border-[var(--app-border)]")} /><span className="font-semibold">All friends</span></div>
                  <p className="mt-1 pl-6 text-xs text-[var(--app-text-tertiary)]">ส่งถึงเพื่อนทั้งหมดของแต่ละร้าน</p>
                </button>
                <button type="button" onClick={() => setTargetMode("FRIENDSHIP_PERIOD")} className={"rounded-xl border p-4 text-left transition " + (targetMode === "FRIENDSHIP_PERIOD" ? "border-[var(--app-accent)] bg-[var(--app-accent-soft)]" : "border-[var(--app-border)]")}>
                  <div className="flex items-center gap-2"><span className={"h-4 w-4 rounded-full border-4 " + (targetMode === "FRIENDSHIP_PERIOD" ? "border-[var(--app-accent)]" : "border-[var(--app-border)]")} /><span className="font-semibold">Targeting</span></div>
                  <p className="mt-1 pl-6 text-xs text-[var(--app-text-tertiary)]">กรองด้วย Friendship period แบบ LINE OA Manager</p>
                </button>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-[var(--app-text-secondary)]">Recipient label (optional)</span>
                <input value={recipientLabel} onChange={(event) => setRecipientLabel(event.target.value.slice(0, 100))} maxLength={100} placeholder="เช่น ลูกค้าเก่า 6 เดือน+, OPPO A7 Pro" className="app-input h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm" />
              </label>

              <div className="mt-4">
                <div className="mb-1.5 text-xs font-medium text-[var(--app-text-secondary)]">Audiences</div>
                <div className="flex items-center justify-between rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 py-3">
                  <div><div className="text-sm font-medium">None selected</div><div className="text-xs text-[var(--app-text-tertiary)]">Audience targeting จะเปิดเมื่อ backend รองรับชนิดนั้นจริง</div></div>
                  <button type="button" disabled className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text-tertiary)] opacity-60">Select audience</button>
                </div>
              </div>

              {targetMode === "FRIENDSHIP_PERIOD" && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-[var(--app-text-secondary)]">Filter by demographic</div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <div className="rounded-xl border border-[var(--app-border)] p-3">
                      <div className="mb-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 py-2 text-sm">Friendship period</div>
                      <div className="space-y-1">
                        {PERIODS.map((item) => (
                          <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--app-surface-hover)]">
                            <input type="checkbox" checked={periods.has(item.key)} onChange={() => togglePeriod(item.key)} className="h-4 w-4 accent-[var(--app-accent)]" />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="self-start rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="font-semibold">{language === "th" ? "กฎการกำหนดเป้าหมาย" : language === "zh" ? "定向规则" : "Targeting rule"}</div>
                      <p className="mt-1 text-xs leading-5">
                        {periods.has("D180_364") && periods.has("D365_PLUS") && periods.size === 2
                          ? (language === "th" ? "ช่วง 180–364 วันและ 365 วันขึ้นไปจะถูกรวมเป็น Friendship period ≥ 180 days." : language === "zh" ? "180–364 天和 365 天以上将统一为 Friendship period ≥ 180 days。" : "The 180–364 days and 365 days or more ranges will be normalized to Friendship period ≥ 180 days.")
                          : (language === "th" ? "ระบบจะรักษาช่วงที่เลือกแบบตรงตัว และจะไม่ fallback เป็น All friends หากร้านส่งไม่ได้" : language === "zh" ? "系统将保留所选范围；如果门店无法发送，不会自动回退为 All friends。" : "The selected ranges are preserved exactly. If a store cannot send, the system will not fall back to All friends.")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">2</div>
                <div><h2 className="font-bold">Broadcast time</h2><p className="text-xs text-[var(--app-text-tertiary)]">กำหนดเวลาในการส่ง</p></div>
              </div>
              <div className="space-y-3 pl-10">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={scheduleMode === "NOW"} onChange={() => setScheduleMode("NOW")} className="accent-[var(--app-accent)]" /> Send now</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm"><input type="radio" checked={scheduleMode === "SCHEDULED"} onChange={() => setScheduleMode("SCHEDULED")} className="accent-[var(--app-accent)]" /> Schedule for later</label>
                  <input type="date" disabled={scheduleMode !== "SCHEDULED"} value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="app-input h-9 rounded-lg border border-[var(--app-border)] px-3 text-sm disabled:opacity-50" />
                  <input type="time" disabled={scheduleMode !== "SCHEDULED"} value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} className="app-input h-9 rounded-lg border border-[var(--app-border)] px-3 text-sm disabled:opacity-50" />
                  <span className="rounded-full bg-[var(--app-surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--app-text-tertiary)]">Local time</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">3</div>
                <div><h2 className="font-bold">Advanced settings</h2><p className="text-xs text-[var(--app-text-tertiary)]">ตั้งค่าขั้นสูง</p></div>
              </div>
              <div className="space-y-3 pl-10">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={allowPartial} onChange={(event) => setAllowPartial(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--app-accent)]" />
                  <span><span className="font-medium">Allow partial broadcast to a subset of targets</span><span className="mt-0.5 block text-xs text-[var(--app-text-tertiary)]">ใช้ remaining quota ที่เหลือได้เมื่อ Narrowcast มีผู้รับมากกว่าโควต้า</span></span>
                </label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={maxVolumeEnabled} onChange={(event) => setMaxVolumeEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--app-accent)]" /> Set maximum broadcast volume</label>
                {maxVolumeEnabled && <input inputMode="numeric" value={maxVolume} onChange={(event) => setMaxVolume(event.target.value.replace(/\D/g, ""))} placeholder="Maximum recipients per store" className="app-input ml-6 h-9 w-64 rounded-lg border border-[var(--app-border)] px-3 text-sm" />}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">4</div>
                <div><h2 className="font-bold">Message</h2><p className="text-xs text-[var(--app-text-tertiary)]">สร้างข้อความได้สูงสุด 5 message objects</p></div>
              </div>
              <div className="pl-10">
                <div className="mb-3 flex flex-wrap gap-2">
                  <button type="button" disabled={messages.length >= 5} onClick={addTextMessage} className="rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">T Text</button>
                  <button type="button" disabled={messages.length >= 5 || uploadingImage} onClick={() => imageInputRef.current?.click()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold disabled:opacity-40">{uploadingImage ? "Uploading…" : "Image"}</button>
                  <button type="button" disabled={messages.length >= 5} onClick={() => void openRichMessagePicker()} className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs font-semibold disabled:opacity-40">Rich message</button>
                  {["Video", "Card", "Flex message"].map((item) => <button key={item} type="button" disabled title="Not enabled in the current API backend" className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-tertiary)] opacity-55">{item}</button>)}
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void onImagePicked(event.target.files?.[0] ?? null)} />
                </div>
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div key={message.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-[var(--app-text-secondary)]">Message {index + 1} · {message.type === "text" ? "Text" : message.type === "image" ? "Image" : "Rich message"}</div>
                        <div className="flex gap-1">
                          <button type="button" disabled={index === 0} onClick={() => moveMessage(index, -1)} className="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs disabled:opacity-30">↑</button>
                          <button type="button" disabled={index === messages.length - 1} onClick={() => moveMessage(index, 1)} className="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs disabled:opacity-30">↓</button>
                          <button type="button" onClick={() => removeMessage(message.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600">Remove</button>
                        </div>
                      </div>
                      {message.type === "text" ? (
                        <>
                          <textarea
                            ref={(node) => { textAreaRefs.current[message.id] = node; }}
                            value={message.text}
                            maxLength={5000}
                            onChange={(event) => updateTextMessage(message.id, event.target.value)}
                            placeholder="พิมพ์ข้อความที่ต้องการส่ง…"
                            className="app-input min-h-28 w-full resize-y rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-sm"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-semibold text-[var(--app-text-tertiary)]">Personalize by store:</span>
                            {STORE_VARIABLES.map((variable) => (
                              <button
                                key={variable.token}
                                type="button"
                                onClick={() => insertStoreVariable(message.id, variable.token)}
                                className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-text-secondary)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                                title={"แทรก " + variable.label}
                              >
                                {variable.token}
                              </button>
                            ))}
                            <span className="text-[10px] text-[var(--app-text-tertiary)]">ระบบจะแทนค่าตามร้านตอนส่งจริง</span>
                          </div>
                          <div className="mt-1 text-right text-[10px] text-[var(--app-text-tertiary)]">{message.text.length}/5000</div>
                        </>
                      ) : message.type === "image" ? (
                        <div className="flex items-center gap-3">
                          <img src={message.previewImageUrl} alt="" className="h-24 w-24 rounded-xl border border-[var(--app-border)] object-cover" />
                          <div className="min-w-0"><div className="truncate text-sm font-medium">{message.fileName}</div><div className="mt-1 text-xs text-[var(--app-text-tertiary)]">LINE image message</div></div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <img src={message.previewUrl} alt={message.altText} className="h-24 w-24 rounded-xl border border-[var(--app-border)] object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{message.richMessageName}</div>
                            <div className="mt-1 text-xs text-[var(--app-text-tertiary)]">Rich message · {message.actionCount} จุดกด</div>
                            <div className="mt-1 truncate text-xs text-[var(--app-text-tertiary)]">Alt: {message.altText}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[var(--app-text-tertiary)]">{messages.length}/5 message objects</div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">5</div>
                <div><h2 className="font-bold">Select stores</h2><p className="text-xs text-[var(--app-text-tertiary)]">เลือกหลายร้านแบบเดียวกับเครื่องมือ HQ อื่น ๆ</p></div>
              </div>
              <div className="pl-10">
                <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_auto_auto]">
                  <input value={storeSearch} onChange={(event) => setStoreSearch(event.target.value)} placeholder="Search store name or code…" className="app-input h-10 rounded-xl border border-[var(--app-border)] px-3 text-sm" />
                  <select value={storeStatusFilter} onChange={(event) => setStoreStatusFilter(event.target.value as StoreStatusFilter)} className="app-input h-10 rounded-xl border border-[var(--app-border)] px-3 text-sm">
                    <option value="ALL">All status</option>
                    <option value="READY">Ready</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                  <button type="button" onClick={selectAllStores} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-semibold">Select all</button>
                  <button type="button" onClick={clearStores} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm font-semibold">Clear</button>
                </div>
                <div className="mb-2 flex items-center justify-between text-xs text-[var(--app-text-tertiary)]">
                  <span>Selected: <strong className="text-[var(--app-text-primary)]">{selectedCount}</strong> / {stores.length}</span>
                  {previewLoading && <span>Checking stores…</span>}
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredStores.map((store) => {
                    const storePreview = previewByStore.get(store.id);
                    const selected = effectiveSelected.has(store.id);
                    return (
                      <label key={store.id} className={"flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition " + (selected ? "border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)]" : "border-[var(--app-border)] bg-[var(--app-surface)]")}>
                        <input type="checkbox" checked={selected} onChange={() => toggleStore(store.id)} className="mt-0.5 h-4 w-4 accent-[var(--app-accent)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--app-text-primary)]">{store.name}</span>
                          <span className="mt-0.5 block text-[10px] text-[var(--app-text-tertiary)]">{store.code || store.storeId || ""}</span>
                        </span>
                        {selected && storePreview && <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + statusTone(storePreview.status)}>{storePreview.status}</span>}
                      </label>
                    );
                  })}
                </div>
                {stores.length > 10 && (
                  <button type="button" onClick={() => setShowAllStores((value) => !value)} className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-[var(--app-accent)] hover:bg-[var(--app-surface-hover)]">
                    {showAllStores ? "Show less" : "Show more (" + Math.max(0, stores.length - 10) + " stores)"}
                  </button>
                )}

                {(preview?.blockedStoreCount ?? 0) > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="text-sm font-semibold text-amber-800">{preview?.blockedStoreCount} stores blocked</div>
                    <div className="mt-2 grid gap-1 text-xs text-amber-800 md:grid-cols-2">
                      {(preview?.stores ?? []).filter((item) => item.status === "BLOCKED").slice(0, 8).map((item) => (
                        <div key={item.storeId}>
                          {item.storeName}: {reasonText(item.skipReason)}
                          {item.missingVariables.length > 0 ? " (" + item.missingVariables.join(", ") + ")" : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(preview?.warningStoreCount ?? 0) > 0 && (
                  <details className="mt-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-3">
                    <summary className="cursor-pointer text-xs font-semibold">{preview?.warningStoreCount} stores have data warnings</summary>
                    <div className="mt-2 space-y-1 text-xs text-[var(--app-text-secondary)]">
                      {(preview?.stores ?? []).filter((item) => item.warnings.length > 0).slice(0, 12).map((item) => (
                        <div key={item.storeId}>{item.storeName}: {item.warnings.map(warningText).join(", ")}</div>
                      ))}
                    </div>
                  </details>
                )}
                {previewError && <div className="mt-3 text-xs text-red-600">{previewError}</div>}
              </div>
            </section>

            <section className="sticky bottom-3 z-10 rounded-2xl border border-emerald-200 bg-[var(--app-surface)] p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={"flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold " + (canSubmit ? "bg-emerald-500 text-white" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]")}>{canSubmit ? "✓" : "!"}</div>
                  <div>
                    <div className="font-semibold text-[var(--app-text-primary)]">{canSubmit ? "Ready to send" : "Complete the required fields"}</div>
                    <div className="text-xs text-[var(--app-text-tertiary)]">{readyCount} ready · {blockedCount} blocked · {payloadMessages.length} message objects</div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-[var(--app-text-tertiary)]">Estimated total reach</div><div className="text-lg font-bold">~ {fmt(preview?.estimatedReach)}</div></div>
                  <button type="button" disabled={!canSubmit} onClick={() => setConfirmOpen(true)} className="rounded-xl bg-[var(--app-accent)] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
                    {scheduleMode === "NOW" ? "Send to " + readyCount + " stores" : "Schedule for " + readyCount + " stores"}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="self-start xl:sticky xl:top-4">
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Message preview</h3><span className="text-[10px] text-[var(--app-text-tertiary)]">LINE</span></div>
              <div className="mb-2 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--app-border)] text-center text-xs font-semibold"><div className="bg-[var(--app-accent)] px-2 py-2 text-white">Chat screen</div><div className="px-2 py-2">Chat list</div></div>
              <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[#dbe8f5]">
                <div className="flex items-center gap-2 bg-[#8aaeda] px-3 py-3 text-sm font-bold text-slate-900"><span>‹</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[8px] text-white">OPPO</span><span>OPPO Store</span></div>
                <div className="min-h-[480px] space-y-3 p-3">
                  {payloadMessages.length === 0 ? <div className="pt-20 text-center text-xs text-slate-500">Your message preview will appear here</div> : messages.filter((message) => message.type !== "text" || message.text.trim()).map((message, index) => (
                    message.type === "text" ? (
                      <div key={index} className="max-w-[86%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-white p-3 text-sm leading-5 text-slate-900 shadow-sm">{message.text.trim()}</div>
                    ) : message.type === "image" ? (
                      <div key={index} className="max-w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm"><img src={message.previewImageUrl} alt="" className="w-full object-cover" /></div>
                    ) : (
                      <div key={index} className="max-w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
                        <img src={message.previewUrl} alt={message.altText} className="w-full object-cover" />
                        <div className="border-t border-slate-100 px-2 py-1.5 text-[10px] font-semibold text-slate-500">Rich message · {message.richMessageName}</div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {richPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--app-surface)] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">เลือก Rich Message</h2>
                <p className="mt-1 text-sm text-[var(--app-text-secondary)]">เลือกจากคลัง Rich Message ที่เปิดใช้งานอยู่ในระบบ</p>
              </div>
              <button type="button" onClick={() => setRichPickerOpen(false)} className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm">Close</button>
            </div>
            {richLoading ? (
              <div className="p-8 text-center text-sm text-[var(--app-text-secondary)]">กำลังโหลด Rich Message…</div>
            ) : richError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{richError}</div>
            ) : richItems.length === 0 ? (
              <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] p-6 text-center text-sm text-[var(--app-text-secondary)]">ยังไม่มี Rich Message ที่เปิดใช้งาน</div>
            ) : (
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
                {richItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => addRichMessage(item)} className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] p-3 text-left hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)]">
                    <img src={item.previewUrl || item.imageUrl} alt={item.altText} className="h-24 w-24 shrink-0 rounded-lg border border-[var(--app-border)] object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--app-text-primary)]">{item.name}</span>
                      <span className="mt-1 block text-xs text-[var(--app-text-tertiary)]">{item.actions.length} จุดกด · {item.baseWidth}×{item.baseHeight}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--app-text-tertiary)]">Alt: {item.altText}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <a href="/rich-messages" target="_blank" rel="noreferrer" className="text-xs font-semibold text-[var(--app-accent)] hover:underline">จัดการคลัง Rich Message ↗</a>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--app-surface)] p-5 shadow-2xl">
            <h2 className="text-lg font-bold">Confirm broadcast</h2>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">ตรวจสอบขอบเขตก่อนส่งจริง ทุก LINE OA จะถูกส่งเป็นงานแยกจากกัน</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-xs text-[var(--app-text-tertiary)]">Stores</div><div className="mt-1 font-bold">{readyCount} ready / {selectedCount} selected</div></div>
              <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-xs text-[var(--app-text-tertiary)]">Messages</div><div className="mt-1 font-bold">{payloadMessages.length} / 5</div></div>
              <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-xs text-[var(--app-text-tertiary)]">Target</div><div className="mt-1 font-bold">{targetMode === "ALL_FRIENDS" ? "All friends" : "Friendship period"}</div></div>
              <div className="rounded-xl bg-[var(--app-surface-subtle)] p-3"><div className="text-xs text-[var(--app-text-tertiary)]">Timing</div><div className="mt-1 font-bold">{scheduleMode === "NOW" ? "Send now" : scheduleDate + " " + scheduleTime}</div></div>
            </div>
            {blockedCount > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{blockedCount} blocked stores will not be sent. Targeting will never be widened automatically.</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={sending} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={sending} onClick={() => void handleSend()} className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{sending ? "Submitting…" : scheduleMode === "NOW" ? "Confirm & send" : "Confirm schedule"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
