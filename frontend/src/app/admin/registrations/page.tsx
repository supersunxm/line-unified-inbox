"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { api, type ApprovedAccount, type PendingRegistration } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";

type Tab = "pending" | "approved";
type RoleFilter = "ALL" | "STAFF" | "STORE_MANAGER";

function roleLabel(role: "STAFF" | "STORE_MANAGER") {
  return role === "STORE_MANAGER" ? "BM" : "PC";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function AdminRegistrationsPage() {
  const [authUser, setAuthUser] = useState<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [approvedAccounts, setApprovedAccounts] = useState<ApprovedAccount[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ApprovedAccount | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    setError(null);
    try {
      setRegistrations(await api.getPendingRegistrations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pending registrations.");
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const loadApproved = useCallback(async () => {
    setApprovedLoading(true);
    setError(null);
    try {
      setApprovedAccounts(await api.getApprovedAccounts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load approved accounts.");
    } finally {
      setApprovedLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    return activeTab === "pending" ? loadPending() : loadApproved();
  }, [activeTab, loadApproved, loadPending]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.me();
        setAuthUser(user);
        if (user.role === "ADMIN") await loadPending();
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkAuth();
    const handleUnauthorized = () => setAuthUser(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [loadPending]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearch("");
    setRoleFilter("ALL");
    setNotice(null);
    setError(null);
    if (tab === "approved" && approvedAccounts.length === 0) void loadApproved();
  };

  const act = async (registration: PendingRegistration, action: "approve" | "reject") => {
    setActingId(registration.id);
    setError(null);
    setNotice(null);
    try {
      if (action === "approve") await api.approveRegistration(registration.id);
      else await api.rejectRegistration(registration.id);
      setNotice(action === "approve" ? "Registration approved." : "Registration rejected.");
      await loadPending();
      if (approvedAccounts.length > 0) await loadApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The registration action failed.");
    } finally {
      setActingId(null);
    }
  };

  const filteredApprovedAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return approvedAccounts.filter((account) => {
      if (roleFilter !== "ALL" && account.role !== roleFilter) return false;
      if (!query) return true;
      return [account.name, account.employeeId, account.email, account.store.name, account.store.code]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [approvedAccounts, roleFilter, search]);

  const resetPassword = async () => {
    if (!resetTarget) return;
    setActingId(resetTarget.userId);
    setError(null);
    setNotice(null);
    try {
      const result = await api.resetUserPassword(resetTarget.userId);
      setTemporaryPassword(result.temporaryPassword);
      setNotice("Password reset successful. Share the temporary password securely with the account owner.");
      setResetTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setActingId(null);
    }
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center app-shell app-muted">Loading…</main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center app-shell p-6"><div role="alert" className="app-surface rounded-xl border p-6 text-center"><h1 className="text-xl font-bold">Authentication required</h1><p className="app-muted mt-2">Please sign in as an administrator.</p></div></main>;
  if (authUser.role !== "ADMIN") return <main className="flex min-h-screen items-center justify-center app-shell p-6"><div role="alert" className="app-surface rounded-xl border p-6 text-center"><h1 className="text-xl font-bold">Access denied</h1><p className="app-muted mt-2">Only administrators can manage accounts.</p></div></main>;

  const pendingLoadingMessage = pendingLoading ? "Loading pending registrations…" : "No pending BM registrations.";
  const approvedLoadingMessage = approvedLoading ? "Loading approved accounts…" : "No approved BM or PC accounts found.";

  return (
    <AppShell
      currentSection="admin-registrations"
      authUser={authUser}
      text={{ appName: "OPPO LINE OA Monitor", appDescription: "LINE OA monitoring", language: "Language", loadingData: "Loading…", retry: "Retry", apiError: "Data service error" }}
      language="en"
      changeLanguage={() => undefined}
      searchText=""
      setSearchText={() => undefined}
      logout={logout}
    >
      <main className="app-shell min-h-screen p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="app-muted text-sm font-semibold">Administration</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">BM and PC accounts</h1>
              <p className="app-muted mt-2">Review access requests and manage approved store accounts.</p>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={pendingLoading || approvedLoading} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button>
          </div>

          <div className="mb-5 flex flex-wrap gap-2 border-b" role="tablist" aria-label="Account status">
            <button type="button" role="tab" aria-selected={activeTab === "pending"} onClick={() => selectTab("pending")} className={`rounded-t-lg px-4 py-3 text-sm font-semibold ${activeTab === "pending" ? "border-b-2 border-emerald-600 text-emerald-700" : "app-muted"}`}>Pending Approval</button>
            <button type="button" role="tab" aria-selected={activeTab === "approved"} onClick={() => selectTab("approved")} className={`rounded-t-lg px-4 py-3 text-sm font-semibold ${activeTab === "approved" ? "border-b-2 border-emerald-600 text-emerald-700" : "app-muted"}`}>Approved Accounts</button>
          </div>

          {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="status-filter">Status
              <select id="status-filter" value={activeTab} onChange={(event) => selectTab(event.target.value as Tab)} className="app-surface rounded-lg border px-3 py-2 font-normal">
                <option value="pending">Pending</option><option value="approved">Approved</option>
              </select>
            </label>
            {activeTab === "approved" && <>
              <label className="sr-only" htmlFor="approved-search">Search approved accounts</label>
              <input id="approved-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee ID, name, email, or store…" className="app-surface min-w-[280px] flex-1 rounded-lg border px-4 py-2 text-sm outline-none focus:border-emerald-500" />
              <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="role-filter">Role
                <select id="role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} className="app-surface rounded-lg border px-3 py-2 font-normal">
                  <option value="ALL">All</option><option value="STORE_MANAGER">BM</option><option value="STAFF">PC</option>
                </select>
              </label>
            </>}
          </div>

          <section className="app-surface overflow-hidden rounded-xl border shadow-sm">
            {activeTab === "pending" ? (
              pendingLoading || registrations.length === 0 ? <div className="p-8 text-center app-muted">{pendingLoadingMessage}</div> : (
                <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Employee ID</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Store</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{registrations.map((registration) => <tr key={registration.id} className="align-middle"><td className="px-5 py-4 font-semibold">{registration.name || "—"}</td><td className="px-5 py-4">{registration.employeeId || "Not set"}</td><td className="px-5 py-4">{registration.email || "—"}</td><td className="px-5 py-4">{registration.store?.name || "—"}</td><td className="px-5 py-4">{roleLabel(registration.role)}</td><td className="whitespace-nowrap px-5 py-4">{formatDate(registration.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "reject")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button></div></td></tr>)}</tbody></table></div>
              )
            ) : approvedLoading || filteredApprovedAccounts.length === 0 ? <div className="p-8 text-center app-muted">{approvedLoading ? approvedLoadingMessage : search || roleFilter !== "ALL" ? "No approved accounts match the current search or role filter." : approvedLoadingMessage}</div> : (
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Employee ID</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Store</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Approved</th><th className="px-5 py-3">Approved By</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">{filteredApprovedAccounts.map((account) => <tr key={account.id} className="align-middle"><td className="px-5 py-4 font-semibold">{account.name || "—"}</td><td className="px-5 py-4">{account.employeeId || "Not set"}</td><td className="px-5 py-4">{account.email || "—"}</td><td className="px-5 py-4">{account.store?.name || "—"}</td><td className="px-5 py-4">{roleLabel(account.role)}</td><td className="whitespace-nowrap px-5 py-4">{formatDate(account.approvedAt)}</td><td className="px-5 py-4">{account.approvedBy?.displayName || "Unknown"}</td><td className="px-5 py-4 text-right"><button type="button" disabled={actingId !== null} onClick={() => { setTemporaryPassword(null); setResetTarget(account); }} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50">Reset Password</button></td></tr>)}</tbody></table></div>
            )}
          </section>
        </div>
      </main>

      {resetTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6"><div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="app-surface w-full max-w-md rounded-xl border p-6 shadow-xl"><h2 id="reset-password-title" className="text-xl font-bold">Reset password</h2><p className="app-muted mt-2">Reset password for <strong>{resetTarget.name}</strong> ({resetTarget.employeeId || "No employee ID"}) at {resetTarget.store.name}?</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setResetTarget(null)} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void resetPassword()} disabled={actingId !== null} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirm Reset</button></div></div></div>}
      {temporaryPassword && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6"><div role="dialog" aria-modal="true" aria-labelledby="temporary-password-title" className="app-surface w-full max-w-md rounded-xl border p-6 shadow-xl"><h2 id="temporary-password-title" className="text-xl font-bold">Password reset successful</h2><p className="app-muted mt-2">Share this temporary password securely. It will not be shown again.</p><code className="mt-4 block rounded-lg bg-slate-100 p-4 text-center text-lg font-bold tracking-wide dark:bg-slate-900">{temporaryPassword}</code><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => void navigator.clipboard?.writeText(temporaryPassword)} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold">Copy Password</button><button type="button" onClick={() => setTemporaryPassword(null)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Done</button></div></div></div>}
    </AppShell>
  );
}
