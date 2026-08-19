"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import { api } from "@/lib/api";

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
};

type Quota = {
  type: "NONE" | "LIMITED" | "ERROR";
  limit: number | null;
  usage: number | null;
  remaining: number | null;
  required: number;
  safe: boolean;
  error: string | null;
};

type ReviewResponse = {
  campaignId: string;
  title: string | null;
  reviewToken: string;
  expiresAt: string;
  safeToSend: boolean;
  messageCount: number;
  audience: {
    snapshotRecipientCount: number;
    eligibleRecipientCount: number;
    excludedRecipientCount: number;
    storeCount: number;
    lineOaCount: number;
  };
  exclusions: Array<{ reason: string; count: number }>;
  stores: Array<{
    storeId: string;
    storeName: string;
    storeCode: string | null;
    lineOfficialAccountId: string;
    lineOaName: string;
    recipientCount: number;
    quota: Quota;
  }>;
};

type SendStatus = {
  campaignId: string;
  title: string | null;
  status: "DRAFT" | "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  executionState: "QUEUED" | "RUNNING" | "COMPLETED" | null;
  estimatedRecipientCount: number;
  processedRecipientCount: number;
  successRecipientCount: number;
  failedRecipientCount: number;
  storeCount: number;
  stores: Array<{
    storeId: string;
    storeName: string;
    storeCode: string | null;
    lineOfficialAccountId: string | null;
    lineOaName: string | null;
    status: string;
    recipientCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    skipReason: string | null;
  }>;
  startedAt: string | null;
  completedAt: string | null;
  duplicate?: boolean;
};

async function readError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // Backend error bodies are not guaranteed to be JSON.
  }
  return fallback;
}

function baseUrl(campaignId: string) {
  return `/api-backend/admin/purchase-analytics/audience/broadcast-draft/${encodeURIComponent(campaignId)}`;
}

function isTerminal(status: SendStatus["status"]) {
  return status === "COMPLETED" || status === "PARTIAL" || status === "FAILED" || status === "CANCELLED";
}

function quotaLabel(quota: Quota) {
  if (quota.type === "ERROR") return "Quota check failed";
  if (quota.type === "NONE") return `No target limit · ${quota.required.toLocaleString()} planned`;
  return `${(quota.remaining ?? 0).toLocaleString()} remaining · ${quota.required.toLocaleString()} planned`;
}

export function PurchaseBroadcastSafeSend({ campaignId }: { campaignId: string }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [review, setReview] = useState<ReviewResponse | null>(null);
  const [status, setStatus] = useState<SendStatus | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl(campaignId)}/send-status`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const next = (await response.json()) as SendStatus;
      setStatus(next);
    } catch {
      // Status polling is best effort; send/review calls surface actionable errors.
    }
  }, [campaignId]);

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        const user = await api.me();
        if (!active) return;
        setAuthUser(user);
        if (user.role === "ADMIN") await loadStatus();
      } catch {
        if (active) setAuthUser(null);
      } finally {
        if (active) setAuthChecked(true);
      }
    };
    void boot();
    const handleUnauthorized = () => setAuthUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      active = false;
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!status || isTerminal(status.status) || !status.executionState) return;
    const timer = window.setInterval(() => void loadStatus(), 2500);
    return () => window.clearInterval(timer);
  }, [loadStatus, status]);

  const runReview = async () => {
    if (reviewing || sending) return;
    setReviewing(true);
    setError(null);
    setReview(null);
    setConfirmed(false);
    setConfirmationText("");
    try {
      const response = await fetch(`${baseUrl(campaignId)}/review`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(await readError(response, `Safety review failed (${response.status}).`));
      }
      const next = (await response.json()) as ReviewResponse;
      setReview(next);
      await loadStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Safety review failed.");
    } finally {
      setReviewing(false);
    }
  };

  const send = async () => {
    if (!review || !review.safeToSend || !confirmed || confirmationText !== "SEND" || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl(campaignId)}/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewToken: review.reviewToken, confirm: true }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, `Send request failed (${response.status}).`));
      }
      setStatus((await response.json()) as SendStatus);
      setReview(null);
      setConfirmed(false);
      setConfirmationText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Send request failed.");
    } finally {
      setSending(false);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  const sendEnabled = useMemo(
    () => Boolean(review?.safeToSend && confirmed && confirmationText === "SEND" && !sending),
    [confirmationText, confirmed, review, sending],
  );

  if (!authChecked) {
    return <main className="app-shell flex min-h-screen items-center justify-center app-muted">Loading…</main>;
  }
  if (!authUser) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="app-surface rounded-xl border p-6 text-center">
          <h1 className="text-xl font-bold">Authentication required</h1>
          <p className="app-muted mt-2">Please sign in before reviewing a real broadcast.</p>
        </div>
      </main>
    );
  }
  if (authUser.role !== "ADMIN") {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="app-surface rounded-xl border p-6 text-center">
          <h1 className="text-xl font-bold">ADMIN access required</h1>
          <p className="app-muted mt-2">Only ADMIN users can review or execute Purchase Intelligence broadcasts.</p>
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
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">Mass Message · Real delivery gate</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Review & Send</h1>
              <p className="app-muted mt-2 max-w-3xl">
                Review recomputes the exact saved audience, checks current store/OA readiness and LINE monthly quota, then issues a short-lived confirmation token.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/mass-messages/drafts/${encodeURIComponent(campaignId)}`} className="app-button-secondary rounded-lg border px-3 py-2 text-sm font-semibold">
                Back to Composer
              </Link>
              <Link href="/mass-messages" className="app-button-secondary rounded-lg border px-3 py-2 text-sm font-semibold">
                Mass Message
              </Link>
            </div>
          </div>

          <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
            <h2 className="font-bold">This screen can send real LINE messages.</h2>
            <p className="mt-1 text-sm">Nothing is sent by running Safety Review. Delivery starts only after the final checkbox, typing SEND, and pressing the red Send button.</p>
          </section>

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </div>
          )}

          {status?.executionState && (
            <section className="app-surface rounded-xl border p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Delivery status</h2>
                  <p className="app-muted mt-1 text-sm">{status.title || "Purchase Intelligence campaign"}</p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs font-bold">{status.status} · {status.executionState}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Planned" value={status.estimatedRecipientCount} />
                <Metric label="Processed" value={status.processedRecipientCount} />
                <Metric label="Accepted by LINE" value={status.successRecipientCount} />
                <Metric label="Failed request" value={status.failedRecipientCount} />
              </div>
              <button type="button" onClick={() => void loadStatus()} className="app-button-secondary mt-4 rounded-lg border px-3 py-2 text-sm font-semibold">Refresh status</button>
            </section>
          )}

          {!status?.executionState && (
            <section className="app-surface rounded-xl border p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">1. Run Safety Review</h2>
                  <p className="app-muted mt-1 text-sm">Save your composer draft first. Review itself does not send or consume quota.</p>
                </div>
                <button type="button" onClick={() => void runReview()} disabled={reviewing || sending} className="app-button-primary rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">
                  {reviewing ? "Reviewing…" : "Run Safety Review"}
                </button>
              </div>
            </section>
          )}

          {review && (
            <>
              <section className="app-surface rounded-xl border p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">2. Verify audience & quota</h2>
                    <p className="app-muted mt-1 text-sm">Review expires at {new Date(review.expiresAt).toLocaleString()}.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${review.safeToSend ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                    {review.safeToSend ? "SAFE TO SEND" : "BLOCKED"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Metric label="Snapshot" value={review.audience.snapshotRecipientCount} />
                  <Metric label="Eligible" value={review.audience.eligibleRecipientCount} />
                  <Metric label="Excluded" value={review.audience.excludedRecipientCount} />
                  <Metric label="Stores" value={review.audience.storeCount} />
                  <Metric label="LINE OAs" value={review.audience.lineOaCount} />
                </div>

                {review.exclusions.length > 0 && (
                  <div className="mt-5 rounded-lg border p-4">
                    <p className="text-sm font-bold">Excluded before send</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.exclusions.map((item) => (
                        <span key={item.reason} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">
                          {item.reason}: {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-3">Store</th>
                        <th className="px-3 py-3">LINE OA</th>
                        <th className="px-3 py-3">Recipients</th>
                        <th className="px-3 py-3">Quota</th>
                        <th className="px-3 py-3">Gate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review.stores.map((store) => (
                        <tr key={`${store.storeId}:${store.lineOfficialAccountId}`} className="border-t dark:border-slate-800">
                          <td className="px-3 py-3 font-semibold">{store.storeName}{store.storeCode ? ` · ${store.storeCode}` : ""}</td>
                          <td className="px-3 py-3">{store.lineOaName}</td>
                          <td className="px-3 py-3">{store.recipientCount.toLocaleString()}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{quotaLabel(store.quota)}</div>
                            {store.quota.type === "LIMITED" && <div className="app-muted mt-1 text-xs">Usage {(store.quota.usage ?? 0).toLocaleString()} / {(store.quota.limit ?? 0).toLocaleString()}</div>}
                            {store.quota.error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{store.quota.error}</div>}
                          </td>
                          <td className={`px-3 py-3 font-bold ${store.quota.safe ? "text-emerald-600" : "text-red-600"}`}>{store.quota.safe ? "PASS" : "BLOCK"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
                <h2 className="text-lg font-bold text-red-900 dark:text-red-100">3. Final confirmation</h2>
                <p className="mt-2 text-sm text-red-800 dark:text-red-200">
                  Pressing Send will start real multicast delivery to <strong>{review.audience.eligibleRecipientCount.toLocaleString()} customers</strong> across <strong>{review.audience.lineOaCount} LINE OAs</strong>. LINE monthly message quota may be consumed.
                </p>
                <label className="mt-4 flex items-start gap-3 text-sm font-medium">
                  <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                  <span>I reviewed the exact audience, exclusions, content, stores, LINE OAs, and quota above.</span>
                </label>
                <label className="mt-4 block text-sm font-medium">
                  <span className="mb-1.5 block">Type <strong>SEND</strong> to unlock delivery</span>
                  <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className="app-input h-10 w-full max-w-sm rounded-lg border px-3" autoComplete="off" />
                </label>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-red-200 pt-4 dark:border-red-900">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">The server re-validates the reviewed recipient fingerprint and LINE quota again at the moment you confirm.</p>
                  <button type="button" onClick={() => void send()} disabled={!sendEnabled} className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                    {sending ? "Starting delivery…" : `Send to ${review.audience.eligibleRecipientCount.toLocaleString()} customers`}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="app-muted text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
