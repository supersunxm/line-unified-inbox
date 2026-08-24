"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthorizedSection } from "../../../authorized-workspace";

type PendingHq = {
  id: string;
  displayName: string;
  employeeId: string | null;
  email: string;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api-backend${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function HqApprovalContent() {
  const [items, setItems] = useState<PendingHq[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ registrations: PendingHq[] }>("/admin/registrations/hq-pending");
      setItems(result.registrations);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load HQ registrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setActing(id);
    setError(null);
    setNotice(null);
    try {
      await request(`/admin/registrations/hq-users/${id}/${action}`, { method: "PATCH" });
      setNotice(action === "approve" ? "HQ account approved with full access." : "HQ registration rejected.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-accent)]">Account Management</p>
            <h1 className="mt-1 text-2xl font-bold">HQ approvals</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">Approved HQ accounts receive full Web + Mobile access across all workspaces and stores.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/registrations" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium">BM / PC accounts</Link>
            <button type="button" onClick={() => void load()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white">Refresh</button>
          </div>
        </div>

        {notice && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">Loading HQ requests…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">No pending HQ registrations.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{item.displayName}</h2>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">HQ · Full access</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{item.email}</p>
                    <p className="text-sm text-[var(--app-text-secondary)]">Employee ID: {item.employeeId ?? "—"}</p>
                    <p className="mt-1 text-xs text-[var(--app-text-secondary)]">Requested: {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={acting === item.id} onClick={() => void act(item.id, "reject")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Reject</button>
                    <button disabled={acting === item.id} onClick={() => void act(item.id, "approve")} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Approve full access</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function HqRegistrationsPage() {
  return <AuthorizedSection section="admin-registrations"><HqApprovalContent /></AuthorizedSection>;
}
