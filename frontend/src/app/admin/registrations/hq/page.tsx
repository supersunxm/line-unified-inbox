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

type ApprovedHq = {
  id: string;
  displayName: string;
  employeeId: string | null;
  email: string;
  status: "ACTIVE" | "SUSPENDED";
  isActive: boolean;
  canAccessWeb: boolean;
  canAccessMobile: boolean;
  canAccessHq: boolean;
  canAccessAllStores: boolean;
  canManageAccounts: boolean;
  canReply: boolean;
  canAccessMainOa: boolean;
  canManageMainOa: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

type Tab = "pending" | "approved";

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
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<PendingHq[]>([]);
  const [approved, setApproved] = useState<ApprovedHq[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    const result = await request<{ registrations: PendingHq[] }>("/admin/registrations/hq-pending");
    setPending(result.registrations);
  }, []);

  const loadApproved = useCallback(async () => {
    const result = await request<{ accounts: ApprovedHq[] }>("/admin/registrations/hq-approved");
    setApproved(result.accounts);
  }, []);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPending(), loadApproved()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load HQ accounts");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [loadApproved, loadPending]);

  useEffect(() => { void load(); }, [load]);

  async function actPending(id: string, action: "approve" | "reject") {
    setActing(id);
    setError(null);
    setNotice(null);
    try {
      await request(`/admin/registrations/hq-users/${id}/${action}`, { method: "PATCH" });
      setNotice(action === "approve" ? "HQ account approved with full access." : "HQ registration rejected.");
      await load(false);
      if (action === "approve") setTab("approved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  async function actLifecycle(account: ApprovedHq, action: "deactivate" | "reactivate") {
    setActing(account.id);
    setError(null);
    setNotice(null);
    try {
      await request(`/admin/registrations/hq-users/${account.id}/${action}`, { method: "PATCH" });
      setNotice(action === "deactivate" ? `${account.displayName} was deactivated.` : `${account.displayName} was reactivated with full HQ access.`);
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account status change failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-accent)]">Account Management</p>
            <h1 className="mt-1 text-2xl font-bold">HQ accounts</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">Approve HQ requests and manage approved full-access HQ accounts.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/registrations" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium">BM / PC accounts</Link>
            <button type="button" onClick={() => void load()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white">Refresh</button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-[var(--app-border)] pb-2">
          <button type="button" onClick={() => setTab("pending")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "pending" ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}>Pending approval ({pending.length})</button>
          <button type="button" onClick={() => setTab("approved")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "approved" ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}>Approved / Manage ({approved.length})</button>
        </div>

        {notice && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">Loading HQ accounts…</div>
        ) : tab === "pending" ? (
          pending.length === 0 ? (
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">No pending HQ registrations.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <article key={item.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{item.displayName}</h2>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Pending HQ</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{item.email}</p>
                      <p className="text-sm text-[var(--app-text-secondary)]">Employee ID: {item.employeeId ?? "—"}</p>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">Requested: {new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={acting === item.id} onClick={() => void actPending(item.id, "reject")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Reject</button>
                      <button disabled={acting === item.id} onClick={() => void actPending(item.id, "approve")} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Approve full access</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : approved.length === 0 ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">No approved HQ accounts.</div>
        ) : (
          <div className="space-y-3">
            {approved.map((account) => {
              const active = account.isActive && account.status === "ACTIVE";
              return (
                <article key={account.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{account.displayName}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{active ? "Active" : "Inactive"}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">HQ · Full access</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{account.email}</p>
                      <p className="text-sm text-[var(--app-text-secondary)]">Employee ID: {account.employeeId ?? "—"}</p>
                      <p className="mt-2 text-xs text-[var(--app-text-secondary)]">Web + Mobile · All Stores · Account Management · Reply · Main OA</p>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">Last login: {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : "Never"}</p>
                    </div>
                    <div className="flex gap-2">
                      {active ? (
                        <button disabled={acting === account.id} onClick={() => void actLifecycle(account, "deactivate")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Deactivate</button>
                      ) : (
                        <button disabled={acting === account.id} onClick={() => void actLifecycle(account, "reactivate")} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Reactivate full access</button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default function HqRegistrationsPage() {
  return <AuthorizedSection section="admin-registrations"><HqApprovalContent /></AuthorizedSection>;
}
