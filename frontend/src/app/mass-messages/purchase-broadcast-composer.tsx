"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import { api } from "@/lib/api";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
};

type DraftMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

type ComposerResponse = {
  id: string;
  campaignRequestId: string;
  title: string | null;
  status: "DRAFT";
  audienceType: "SELECTED_USERS";
  messages: DraftMessage[];
  audience: {
    recipientCount: number;
    storeCount: number;
    lineOaCount: number;
    filters: { from: string | null; to: string | null; storeId: string | null };
    statuses: string[];
    messageabilityDefinition: string;
    stores: Array<{
      storeId: string;
      externalStoreId: string | null;
      storeName: string;
      storeCode: string | null;
      lineOfficialAccountId: string;
      lineOaName: string;
      recipientCount: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
};

type AttachedImage = {
  originalContentUrl: string;
  previewImageUrl: string;
  label: string;
};

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // The backend error body is not guaranteed to be JSON.
  }
  return fallback;
}

function composerUrl(campaignId: string) {
  return `/api-backend/admin/purchase-analytics/audience/broadcast-draft/${encodeURIComponent(campaignId)}/composer`;
}

export function PurchaseBroadcastComposer({ campaignId }: { campaignId: string }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [draft, setDraft] = useState<ComposerResponse | null>(null);
  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hydrateDraft = useCallback((data: ComposerResponse) => {
    setDraft(data);
    setTitle(data.title ?? "");
    const text = data.messages.find(
      (message): message is Extract<DraftMessage, { type: "text" }> => message.type === "text",
    );
    const image = data.messages.find(
      (message): message is Extract<DraftMessage, { type: "image" }> => message.type === "image",
    );
    setMessageText(text?.text ?? "");
    setAttachedImage(
      image
        ? {
            originalContentUrl: image.originalContentUrl,
            previewImageUrl: image.previewImageUrl,
            label: "Saved image",
          }
        : null,
    );
  }, []);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(composerUrl(campaignId), {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await readError(response, `Unable to load draft (${response.status}).`));
      }
      hydrateDraft((await response.json()) as ComposerResponse);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load broadcast draft.");
    } finally {
      setLoading(false);
    }
  }, [campaignId, hydrateDraft]);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const user = await api.me();
        if (!active) return;
        setAuthUser(user);
        if (user.role === "ADMIN") await loadDraft();
      } catch {
        if (active) setAuthUser(null);
      } finally {
        if (active) {
          setAuthChecked(true);
          if (!authUser) setLoading(false);
        }
      }
    };
    void boot();
    const handleUnauthorized = () => setAuthUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      active = false;
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [loadDraft]);

  const messages = useMemo<DraftMessage[]>(() => {
    const result: DraftMessage[] = [];
    if (messageText.trim()) result.push({ type: "text", text: messageText.trim() });
    if (attachedImage) {
      result.push({
        type: "image",
        originalContentUrl: attachedImage.originalContentUrl,
        previewImageUrl: attachedImage.previewImageUrl,
      });
    }
    return result;
  }, [attachedImage, messageText]);

  const saveDraft = async () => {
    if (!draft || saving || authUser?.role !== "ADMIN") return;
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    try {
      const response = await fetch(composerUrl(campaignId), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined, messages }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, `Unable to save draft (${response.status}).`));
      }
      const updated = (await response.json()) as ComposerResponse;
      hydrateDraft(updated);
      setSavedAt(updated.updatedAt);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Image must be 10 MB or smaller.");
      return;
    }
    if (!(["image/jpeg", "image/png"] as string[]).includes(file.type)) {
      setUploadError("Only JPEG and PNG images are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await api.uploadMassMessageImage(file);
      setAttachedImage({
        originalContentUrl: uploaded.url,
        previewImageUrl: uploaded.previewUrl || uploaded.url,
        label: file.name,
      });
      setSavedAt(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  if (!authChecked) {
    return <main className="app-shell flex min-h-screen items-center justify-center app-muted">Loading…</main>;
  }
  if (!authUser) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="app-surface rounded-xl border p-6 text-center">
          <h1 className="text-xl font-bold">Authentication required</h1>
          <p className="app-muted mt-2">Please sign in to open this campaign draft.</p>
        </div>
      </main>
    );
  }
  if (authUser.role !== "ADMIN") {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="app-surface rounded-xl border p-6 text-center">
          <h1 className="text-xl font-bold">ADMIN access required</h1>
          <p className="app-muted mt-2">Purchase Intelligence broadcast drafts are ADMIN-only.</p>
        </div>
      </main>
    );
  }

  return (
    <AppShell
      currentSection="mass-messages"
      authUser={authUser}
      text={{
        appName: "OPPO LINE OA Monitor",
        appDescription: "LINE OA monitoring",
        language: "Language",
        loadingData: "Loading…",
        retry: "Retry",
        apiError: "Data service error",
      }}
      language="en"
      changeLanguage={() => undefined}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <main className="app-shell min-h-screen p-5 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="app-muted text-sm font-semibold">Mass Message · Purchase Intelligence</p>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  DRAFT ONLY
                </span>
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Campaign Composer</h1>
              <p className="app-muted mt-2">Compose content for the exact saved customer audience. Saving never sends to LINE.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/purchase-analytics" className="app-button-secondary rounded-lg border px-3 py-2 text-sm font-semibold">
                Purchase Intelligence
              </Link>
              <Link href="/mass-messages" className="app-button-secondary rounded-lg border px-3 py-2 text-sm font-semibold">
                Mass Message
              </Link>
            </div>
          </div>

          {loadError && (
            <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {loadError}
              <button type="button" className="ml-3 font-semibold underline" onClick={() => void loadDraft()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="app-surface rounded-xl border p-10 text-center app-muted">Loading campaign draft…</div>
          ) : draft ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="space-y-5 xl:col-span-7">
                <section className="app-surface rounded-xl border p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold">Campaign content</h2>
                      <p className="app-muted mt-1 text-xs">Up to one text message and one image. Both remain draft content.</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">{messages.length}/2</span>
                  </div>

                  <label className="mt-5 block text-sm font-medium">
                    <span className="mb-1.5 block app-muted">Campaign title</span>
                    <input
                      value={title}
                      maxLength={120}
                      onChange={(event) => { setTitle(event.target.value); setSavedAt(null); }}
                      className="app-input h-10 w-full rounded-lg border px-3"
                      placeholder="e.g. Reno upgrade campaign"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium">
                    <span className="mb-1.5 flex items-center justify-between app-muted">
                      <span>Message</span><span>{messageText.length}/5000</span>
                    </span>
                    <textarea
                      value={messageText}
                      maxLength={5000}
                      rows={8}
                      onChange={(event) => { setMessageText(event.target.value); setSavedAt(null); }}
                      className="app-input w-full resize-y rounded-lg border p-3 leading-6"
                      placeholder="Write the message customers will eventually receive…"
                    />
                  </label>

                  <div className="mt-4 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Image</p>
                        <p className="app-muted mt-1 text-xs">JPEG/PNG, maximum 10 MB. Uses the existing protected Mass Message upload path.</p>
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => void uploadImage(event)} />
                      <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="app-button-secondary rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60">
                        {uploading ? "Uploading…" : attachedImage ? "Replace image" : "Attach image"}
                      </button>
                    </div>
                    {attachedImage && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-950">
                        <span className="min-w-0 truncate font-medium">✓ {attachedImage.label}</span>
                        <button type="button" onClick={() => { setAttachedImage(null); setSavedAt(null); }} className="text-xs font-semibold text-red-600 dark:text-red-400">Remove</button>
                      </div>
                    )}
                    {uploadError && <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{uploadError}</p>}
                  </div>

                  {saveError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{saveError}</div>}
                  {savedAt && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Draft saved · {new Date(savedAt).toLocaleString()}</div>}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4 dark:border-slate-800">
                    <p className="max-w-xl text-xs font-medium text-amber-700 dark:text-amber-400">Save Draft only updates content. It creates no delivery rows, starts no processor, and consumes no LINE quota.</p>
                    <button type="button" onClick={() => void saveDraft()} disabled={saving} className="app-button-primary rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">
                      {saving ? "Saving…" : "Save Draft"}
                    </button>
                  </div>
                </section>

                <section className="app-surface rounded-xl border p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold">Audience snapshot</h2>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">Locked</span>
                  </div>
                  <p className="app-muted mt-1 text-xs">Recipients come from the saved Purchase Intelligence snapshot and cannot be expanded from this composer.</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3"><p className="app-muted text-xs">Customers</p><p className="mt-1 text-xl font-bold">{draft.audience.recipientCount.toLocaleString()}</p></div>
                    <div className="rounded-lg border p-3"><p className="app-muted text-xs">Stores</p><p className="mt-1 text-xl font-bold">{draft.audience.storeCount.toLocaleString()}</p></div>
                    <div className="rounded-lg border p-3"><p className="app-muted text-xs">LINE OAs</p><p className="mt-1 text-xl font-bold">{draft.audience.lineOaCount.toLocaleString()}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {draft.audience.statuses.map((status) => <span key={status} className="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">{status}</span>)}
                    {(draft.audience.filters.from || draft.audience.filters.to) && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{draft.audience.filters.from || "…"} → {draft.audience.filters.to || "…"}</span>}
                  </div>
                </section>

                <section className="app-surface rounded-xl border p-5 shadow-sm">
                  <h2 className="text-base font-bold">Store / LINE OA breakdown</h2>
                  <div className="mt-4 overflow-x-auto rounded-lg border dark:border-slate-800">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs app-muted dark:bg-slate-950"><tr><th className="p-3">Store</th><th className="p-3">LINE OA</th><th className="p-3 text-right">Recipients</th></tr></thead>
                      <tbody className="divide-y dark:divide-slate-800">
                        {draft.audience.stores.map((store) => (
                          <tr key={`${store.storeId}:${store.lineOfficialAccountId}`}>
                            <td className="p-3"><p className="font-semibold">{store.externalStoreId ? `[${store.externalStoreId}] ` : ""}{store.storeName}</p>{store.storeCode && <p className="app-muted mt-0.5 text-xs">{store.storeCode}</p>}</td>
                            <td className="p-3">{store.lineOaName}</td>
                            <td className="p-3 text-right font-mono font-semibold">{store.recipientCount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <aside className="space-y-5 xl:col-span-5">
                <section className="app-surface rounded-xl border p-5 shadow-sm xl:sticky xl:top-5">
                  <h2 className="text-base font-bold">Message preview</h2>
                  <p className="app-muted mt-1 text-xs">Content preview only. No customer request is made from this screen.</p>
                  <div className="mt-4 min-h-52 rounded-2xl bg-[#d9e8f5] p-4 dark:bg-slate-800">
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white p-3 text-sm text-slate-900 shadow-sm">
                      {messageText.trim() ? <p className="whitespace-pre-wrap break-words">{messageText}</p> : <p className="text-slate-400">Your message preview will appear here.</p>}
                      {attachedImage && <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">Image attached · {attachedImage.label}</div>}
                    </div>
                  </div>
                  <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Send is locked in Phase 2B</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-300">Phase 2C will add recipient re-validation, quota checks, delivery creation, idempotency and explicit final confirmation before LINE execution.</p>
                    <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600 opacity-70 dark:bg-slate-700 dark:text-slate-300">Review &amp; Send — Locked</button>
                  </div>
                </section>
              </aside>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
