"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { api, type PendingRegistration } from "@/lib/api";
import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";

export default function AdminRegistrationsPage() {
  const [authUser, setAuthUser] = useState<{ id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRegistrations(await api.getPendingRegistrations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pending registrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.me();
        setAuthUser(user);
        if (user.role === "ADMIN") await load();
      } catch {
        setAuthUser(null);
      } finally {
        setAuthChecked(true);
      }
    };
    void checkAuth();
    const handleUnauthorized = () => { setAuthUser(null); };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [load]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthUser(null);
    window.location.replace("/");
  };

  const act = async (registration: PendingRegistration, action: "approve" | "reject") => {
    setActingId(registration.id);
    setError(null);
    setNotice(null);
    try {
      if (action === "approve") await api.approveRegistration(registration.id);
      else await api.rejectRegistration(registration.id);
      setNotice(action === "approve" ? "Registration approved." : "Registration rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The registration action failed.");
    } finally {
      setActingId(null);
    }
  };

  if (!authChecked) return <main className="flex min-h-screen items-center justify-center app-shell app-muted">Loading…</main>;
  if (!authUser) return <main className="flex min-h-screen items-center justify-center app-shell p-6"><div role="alert" className="app-surface rounded-xl border p-6 text-center"><h1 className="text-xl font-bold">Authentication required</h1><p className="app-muted mt-2">Please sign in as an administrator.</p></div></main>;
  if (authUser.role !== "ADMIN") return <main className="flex min-h-screen items-center justify-center app-shell p-6"><div role="alert" className="app-surface rounded-xl border p-6 text-center"><h1 className="text-xl font-bold">Access denied</h1><p className="app-muted mt-2">Only administrators can review BM registrations.</p></div></main>;

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
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="app-muted text-sm font-semibold">Administration</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Pending BM registrations</h1>
            <p className="app-muted mt-2">Review and approve store staff access.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="app-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60">Refresh</button>
        </div>

        {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <section className="app-surface overflow-hidden rounded-xl border shadow-sm">
          {loading ? <div className="p-8 text-center app-muted">Loading pending registrations…</div> : registrations.length === 0 ? <div className="p-8 text-center app-muted">No pending BM registrations.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Store</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {registrations.map((registration) => { const createdAt = new Date(registration.createdAt); return <tr key={registration.id} className="align-middle"><td className="px-5 py-4 font-semibold">{registration.name || "—"}</td><td className="px-5 py-4">{registration.email || "—"}</td><td className="px-5 py-4">{registration.store?.name || "—"}</td><td className="px-5 py-4">{registration.role?.replaceAll("_", " ") || "—"}</td><td className="px-5 py-4 whitespace-nowrap">{Number.isNaN(createdAt.getTime()) ? "—" : createdAt.toLocaleString()}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "reject")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">Reject</button><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button></div></td></tr>; })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
    </AppShell>
  );
}
