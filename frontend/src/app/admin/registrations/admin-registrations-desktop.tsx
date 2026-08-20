"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader, FilterBar } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
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

  if (!authChecked) return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] text-[var(--app-text-secondary)]">
      <LoadingState message="Loading…" />
    </main>
  );
  if (!authUser) return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--app-bg)]">
      <Card className="max-w-md p-6 text-center" role="alert">
        <h1 className="text-xl font-bold text-[var(--app-text-primary)]">Authentication required</h1>
        <p className="text-xs text-[var(--app-text-secondary)] mt-2">Please sign in as an administrator.</p>
      </Card>
    </main>
  );
  if (authUser.role !== "ADMIN") return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-[var(--app-bg)]">
      <Card className="max-w-md p-6 text-center" role="alert">
        <h1 className="text-xl font-bold text-[var(--app-text-primary)]">Access denied</h1>
        <p className="text-xs text-[var(--app-text-secondary)] mt-2">Only administrators can manage accounts.</p>
      </Card>
    </main>
  );

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
      <PageContainer>
        <div className="mx-auto max-w-7xl space-y-6">
          <PageHeader
            tag="Administration · Account Management"
            title="BM and PC accounts"
            description="Review access requests and manage approved store accounts."
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refresh()}
                disabled={pendingLoading || approvedLoading}
              >
                Refresh
              </Button>
            }
          />

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2" role="tablist" aria-label="Account status">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pending"}
              onClick={() => selectTab("pending")}
              className={`flex items-center gap-2 rounded-[var(--app-radius-md)] px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "pending"
                  ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                  : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              }`}
            >
              <span>Pending Approval</span>
              {registrations.length > 0 && (
                <Badge size="sm" variant="warning">
                  {registrations.length}
                </Badge>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "approved"}
              onClick={() => selectTab("approved")}
              className={`flex items-center gap-2 rounded-[var(--app-radius-md)] px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "approved"
                  ? "bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
                  : "text-[var(--app-text-secondary)] hover:bg-[var(--app-surface-hover)]"
              }`}
            >
              <span>Approved Accounts</span>
            </button>
          </div>

          {notice && (
            <div role="status" className="rounded-[var(--app-radius-md)] border border-[var(--app-success)]/40 bg-[var(--app-success-soft)] p-3 text-xs text-[var(--app-success)]">
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-[var(--app-radius-md)] border border-[var(--app-danger)]/40 bg-[var(--app-danger-soft)] p-3 text-xs text-[var(--app-danger)]">
              {error}
            </div>
          )}

          <FilterBar>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text-primary)]" htmlFor="status-filter">
                <span>Status</span>
                <select
                  id="status-filter"
                  value={activeTab}
                  onChange={(event) => selectTab(event.target.value as Tab)}
                  className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] font-normal focus:border-[var(--app-accent)] focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
              </label>

              {activeTab === "approved" && (
                <>
                  <label className="sr-only" htmlFor="approved-search">Search approved accounts</label>
                  <SearchInput
                    id="approved-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employee ID, name, email, or store…"
                    className="h-8 min-w-[280px] flex-1"
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text-primary)]" htmlFor="role-filter">
                    <span>Role</span>
                    <select
                      id="role-filter"
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                      className="h-8 rounded-[var(--app-radius-sm)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 text-xs text-[var(--app-text-primary)] font-normal focus:border-[var(--app-accent)] focus:outline-none"
                    >
                      <option value="ALL">All</option>
                      <option value="STORE_MANAGER">BM</option>
                      <option value="STAFF">PC</option>
                    </select>
                  </label>
                </>
              )}
            </div>
          </FilterBar>

          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "pending" ? "Pending Requests" : "Approved Accounts List"}
              </CardTitle>
              <CardDescription>
                {activeTab === "pending"
                  ? "Access requests awaiting admin review"
                  : "Active authorized store managers and staff members"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTab === "pending" ? (
                pendingLoading ? (
                  <LoadingState message="Loading pending registrations…" />
                ) : registrations.length === 0 ? (
                  <EmptyState title="No pending registrations" description={pendingLoadingMessage} />
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead align="right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((registration) => (
                          <TableRow key={registration.id}>
                            <TableCell className="font-semibold text-[var(--app-text-primary)]">
                              {registration.name || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-[var(--app-text-secondary)]">
                              {registration.employeeId || "Not set"}
                            </TableCell>
                            <TableCell className="text-[var(--app-text-secondary)]">
                              {registration.email || "—"}
                            </TableCell>
                            <TableCell className="font-medium text-[var(--app-text-primary)]">
                              {registration.store?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge size="sm" variant={registration.role === "STORE_MANAGER" ? "accent" : "neutral"}>
                                {roleLabel(registration.role)}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-[11px] text-[var(--app-text-secondary)]">
                              {formatDate(registration.createdAt)}
                            </TableCell>
                            <TableCell align="right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={actingId !== null}
                                  onClick={() => void act(registration, "reject")}
                                >
                                  Reject
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={actingId !== null}
                                  onClick={() => void act(registration, "approve")}
                                >
                                  Approve
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
              ) : approvedLoading ? (
                <LoadingState message="Loading approved accounts…" />
              ) : filteredApprovedAccounts.length === 0 ? (
                <EmptyState
                  title="No approved accounts"
                  description={
                    search || roleFilter !== "ALL"
                      ? "No approved accounts match the current search or role filter."
                      : approvedLoadingMessage
                  }
                />
              ) : (
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead align="right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApprovedAccounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-semibold text-[var(--app-text-primary)]">
                            {account.name || "—"}
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-[var(--app-text-secondary)]">
                            {account.employeeId || "Not set"}
                          </TableCell>
                          <TableCell className="text-[var(--app-text-secondary)]">
                            {account.email || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-[var(--app-text-primary)]">
                            {account.store?.name || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge size="sm" variant={account.role === "STORE_MANAGER" ? "accent" : "neutral"}>
                              {roleLabel(account.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-[11px] text-[var(--app-text-secondary)]">
                            {formatDate(account.approvedAt)}
                          </TableCell>
                          <TableCell className="text-[var(--app-text-secondary)]">
                            {account.approvedBy?.displayName || "Unknown"}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={actingId !== null}
                              onClick={() => {
                                setTemporaryPassword(null);
                                setResetTarget(account);
                              }}
                            >
                              Reset Password
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)] space-y-4">
            <h2 id="reset-password-title" className="text-lg font-bold text-[var(--app-text-primary)]">Reset password</h2>
            <p className="text-xs text-[var(--app-text-secondary)] leading-relaxed">
              Reset password for <strong className="text-[var(--app-text-primary)]">{resetTarget.name}</strong> ({resetTarget.employeeId || "No employee ID"}) at {resetTarget.store.name}?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setResetTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => void resetPassword()}
                disabled={actingId !== null}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {temporaryPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="temporary-password-title" className="w-full max-w-md rounded-[var(--app-radius-xl)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow-modal)] space-y-4">
            <h2 id="temporary-password-title" className="text-lg font-bold text-[var(--app-text-primary)]">Password reset successful</h2>
            <p className="text-xs text-[var(--app-text-secondary)]">Share this temporary password securely. It will not be shown again.</p>
            <code className="block rounded-[var(--app-radius-md)] bg-[var(--app-surface-subtle)] border border-[var(--app-border)] p-4 text-center text-lg font-mono font-bold tracking-wider text-[var(--app-text-primary)]">
              {temporaryPassword}
            </code>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => void navigator.clipboard?.writeText(temporaryPassword)}
              >
                Copy Password
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setTemporaryPassword(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
