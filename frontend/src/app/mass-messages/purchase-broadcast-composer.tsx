"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Input,
  LoadingSpinner,
  LoadingState,
  MetricCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--app-text-secondary)]">
        <LoadingState message="Loading…" />
      </main>
    );
  }
  if (!authUser) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--app-bg)]">
        <Card className="max-w-md p-6 text-center">
          <h1 className="text-xl font-bold text-[var(--app-text-primary)]">Authentication required</h1>
          <p className="text-xs text-[var(--app-text-secondary)] mt-2">Please sign in to open this campaign draft.</p>
        </Card>
      </main>
    );
  }
  if (authUser.role !== "ADMIN") {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--app-bg)]">
        <Card className="max-w-md p-6 text-center">
          <h1 className="text-xl font-bold text-[var(--app-text-primary)]">ADMIN access required</h1>
          <p className="text-xs text-[var(--app-text-secondary)] mt-2">Purchase Intelligence broadcast drafts are ADMIN-only.</p>
        </Card>
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
      <PageContainer>
        <div className="mx-auto max-w-7xl">
          <PageHeader
            tag="Mass Message · Purchase Intelligence"
            title="Campaign Composer"
            description="Compose content for the exact saved customer audience. Saving never sends to LINE."
            actionSlot={
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="md" variant="warning" dot>
                  DRAFT ONLY
                </Badge>
                <Link href="/admin/purchase-analytics">
                  <Button variant="secondary" size="sm">
                    Purchase Intelligence
                  </Button>
                </Link>
                <Link href="/mass-messages">
                  <Button variant="secondary" size="sm">
                    Mass Message
                  </Button>
                </Link>
              </div>
            }
          />

          {loadError && (
            <div role="alert" className="mb-5 rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-4 text-sm text-[var(--app-danger)]">
              {loadError}
              <button type="button" className="ml-3 font-semibold underline" onClick={() => void loadDraft()}>
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <LoadingState message="Loading campaign draft…" />
          ) : draft ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="space-y-5 xl:col-span-7">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div>
                        <CardTitle>Campaign content</CardTitle>
                        <CardDescription>Up to one text message and one image. Both remain draft content.</CardDescription>
                      </div>
                      <Badge size="sm" variant="neutral">
                        {messages.length}/2
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <label className="block text-sm font-medium">
                      <span className="mb-1.5 block text-xs text-[var(--app-text-secondary)]">Campaign title</span>
                      <Input
                        value={title}
                        maxLength={120}
                        onChange={(event) => {
                          setTitle(event.target.value);
                          setSavedAt(null);
                        }}
                        className="h-10 w-full"
                        placeholder="e.g. Reno upgrade campaign"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      <span className="mb-1.5 flex items-center justify-between text-xs text-[var(--app-text-secondary)]">
                        <span>Message</span>
                        <span className="font-mono">{messageText.length}/5000</span>
                      </span>
                      <textarea
                        value={messageText}
                        maxLength={5000}
                        rows={8}
                        onChange={(event) => {
                          setMessageText(event.target.value);
                          setSavedAt(null);
                        }}
                        className="w-full resize-y rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-xs leading-6 text-[var(--app-text-primary)] focus:border-[var(--app-accent)] focus:outline-none"
                        placeholder="Write the message customers will eventually receive…"
                      />
                    </label>

                    <div className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] p-4 bg-[var(--app-surface-subtle)]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--app-text-primary)]">Image</p>
                          <p className="mt-1 text-xs text-[var(--app-text-secondary)]">JPEG/PNG, maximum 10 MB. Uses the existing protected Mass Message upload path.</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={(event) => void uploadImage(event)}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={uploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading ? "Uploading…" : attachedImage ? "Replace image" : "Attach image"}
                        </Button>
                      </div>
                      {attachedImage && (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--app-radius-md)] bg-[var(--app-surface)] border border-[var(--app-border)] p-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-[var(--app-text-primary)]">✓ {attachedImage.label}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachedImage(null);
                              setSavedAt(null);
                            }}
                            className="text-xs font-semibold text-[var(--app-danger)] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                      {uploadError && (
                        <p role="alert" className="mt-2 text-xs font-medium text-[var(--app-danger)]">
                          {uploadError}
                        </p>
                      )}
                    </div>

                    {saveError && (
                      <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-sm text-[var(--app-danger)]">
                        {saveError}
                      </div>
                    )}
                    {savedAt && (
                      <div className="rounded-[var(--app-radius-md)] border border-[var(--app-success)]/40 bg-[var(--app-success-soft)] p-3 text-sm text-[var(--app-success)]">
                        Draft saved · {new Date(savedAt).toLocaleString()}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border-subtle)] pt-4">
                      <p className="max-w-xl text-xs font-medium text-[var(--app-warning)]">
                        Save Draft only updates content. It creates no delivery rows, starts no processor, and consumes no LINE quota.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        onClick={() => void saveDraft()}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save Draft"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 w-full">
                      <CardTitle>Audience snapshot</CardTitle>
                      <Badge size="sm" variant="success">
                        Locked
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Recipients come from the saved Purchase Intelligence snapshot and cannot be expanded from this composer.
                    </CardDescription>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <MetricCard label="Customers" value={draft.audience.recipientCount.toLocaleString()} />
                      <MetricCard label="Stores" value={draft.audience.storeCount.toLocaleString()} />
                      <MetricCard label="LINE OAs" value={draft.audience.lineOaCount.toLocaleString()} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      {draft.audience.statuses.map((status) => (
                        <Badge key={status} size="sm" variant="neutral">
                          {status}
                        </Badge>
                      ))}
                      {(draft.audience.filters.from || draft.audience.filters.to) && (
                        <Badge size="sm" variant="neutral">
                          {draft.audience.filters.from || "…"} → {draft.audience.filters.to || "…"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Store / LINE OA breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Store</TableHead>
                            <TableHead>LINE OA</TableHead>
                            <TableHead align="right">Recipients</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draft.audience.stores.map((store) => (
                            <TableRow key={`${store.storeId}:${store.lineOfficialAccountId}`}>
                              <TableCell>
                                <p className="font-semibold text-[var(--app-text-primary)]">
                                  {store.externalStoreId ? `[${store.externalStoreId}] ` : ""}
                                  {store.storeName}
                                </p>
                                {store.storeCode && (
                                  <p className="mt-0.5 text-xs text-[var(--app-text-tertiary)] font-mono">
                                    {store.storeCode}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-[var(--app-text-secondary)]">{store.lineOaName}</TableCell>
                              <TableCell align="right" className="font-mono font-semibold text-[var(--app-text-primary)]">
                                {store.recipientCount.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-5 xl:col-span-5">
                <Card className="xl:sticky xl:top-5">
                  <CardHeader>
                    <CardTitle>Message preview</CardTitle>
                    <CardDescription>Content preview only. No customer request is made from this screen.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-[var(--app-radius-xl)] bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-4 min-h-52">
                      <div className="max-w-[90%] rounded-[var(--app-radius-lg)] bg-[var(--app-surface)] border border-[var(--app-border)] p-3 text-xs text-[var(--app-text-primary)] shadow-[var(--app-shadow-card)]">
                        {messageText.trim() ? (
                          <p className="whitespace-pre-wrap break-words">{messageText}</p>
                        ) : (
                          <p className="text-[var(--app-text-tertiary)] italic">Your message preview will appear here.</p>
                        )}
                        {attachedImage && (
                          <div className="mt-3 rounded-[var(--app-radius-md)] border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-subtle)] p-6 text-center text-xs font-semibold text-[var(--app-text-secondary)]">
                            Image attached · {attachedImage.label}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 rounded-[var(--app-radius-lg)] border border-[var(--app-warning)]/40 bg-[var(--app-warning-soft)] p-4">
                      <p className="text-sm font-bold text-[var(--app-warning)]">Send is locked in Phase 2B</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-warning)]">
                        Phase 2C will add recipient re-validation, quota checks, delivery creation, idempotency and explicit final confirmation before LINE execution.
                      </p>
                      <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-[var(--app-radius-md)] bg-[var(--disabled-background)] px-4 py-2 text-xs font-bold text-[var(--disabled-foreground)] opacity-70 border border-transparent">
                        Review &amp; Send — Locked
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : null}
        </div>
      </PageContainer>
    </AppShell>
  );
}
