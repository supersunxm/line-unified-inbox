"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileBottomNav,
  MobileCard,
  MobileEmptyState,
  MobileListCard,
  MobileMoreSheet,
  MobilePageHeader,
  MobilePageShell,
  MobileSection,
  MobileSectionTabs,
} from "@/components/mobile/adaptive-mobile";
import { api, type ApprovedAccount, type PendingRegistration } from "@/lib/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Tab = "pending" | "approved";
type RoleFilter = "ALL" | "STAFF" | "STORE_MANAGER";
type AccountStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-3 text-[16px] text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]";

function roleLabel(role: "STAFF" | "STORE_MANAGER") {
  return role === "STORE_MANAGER" ? "BM" : "PC";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("th-TH");
}

export function MobileAdminRegistrationsApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [approved, setApproved] = useState<ApprovedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatusFilter>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<ApprovedAccount | null>(null);
  const [accountActionsTarget, setAccountActionsTarget] = useState<ApprovedAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApprovedAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch(() => window.location.replace("/login"))
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const loadPending = useCallback(async () => {
    setLoading(true); setError(null);
    try { setPending(await api.getPendingRegistrations()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดคำขอไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  const loadApproved = useCallback(async () => {
    setLoading(true); setError(null);
    try { setApproved(await api.getApprovedAccounts()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดบัญชีไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const timer = window.setTimeout(() => void loadPending(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPending, user?.role]);

  const switchTab = (next: Tab) => {
    setTab(next); setSearch(""); setRoleFilter("ALL"); setAccountStatusFilter("ACTIVE"); setError(null); setNotice(null); setTemporaryPassword(null);
    if (next === "pending") void loadPending(); else void loadApproved();
  };

  const filteredApproved = useMemo(() => {
    const query = search.trim().toLowerCase();
    return approved.filter((account) => {
      if (accountStatusFilter !== "ALL" && account.accountStatus !== accountStatusFilter) return false;
      if (roleFilter !== "ALL" && account.role !== roleFilter) return false;
      if (!query) return true;
      return [account.name, account.employeeId, account.email, account.store.name, account.store.code]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [accountStatusFilter, approved, roleFilter, search]);

  const act = async (registration: PendingRegistration, action: "approve" | "reject") => {
    const verb = action === "approve" ? "อนุมัติ" : "ปฏิเสธ";
    if (!window.confirm(`${verb}คำขอของ ${registration.name || registration.email}?`)) return;
    setActingId(registration.id); setError(null); setNotice(null);
    try {
      const result = action === "approve" ? await api.approveRegistration(registration.id) : await api.rejectRegistration(registration.id);
      setNotice(action === "approve"
        ? result.notification?.status === "failed" ? "อนุมัติบัญชีแล้ว แต่อีเมลแจ้งเตือนส่งไม่สำเร็จ" : "อนุมัติบัญชีแล้ว"
        : "ปฏิเสธคำขอแล้ว");
      await loadPending();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setActingId(null); }
  };

  const resetPassword = async (account: ApprovedAccount) => {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ ${account.name}?`)) return;
    setActingId(account.userId); setError(null); setNotice(null); setTemporaryPassword(null);
    try {
      const result = await api.resetUserPassword(account.userId);
      setTemporaryPassword(result.temporaryPassword);
      setNotice(`รีเซ็ตรหัสผ่านของ ${account.name} สำเร็จ`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "รีเซ็ตรหัสผ่านไม่สำเร็จ"); }
    finally { setActingId(null); }
  };

  const changeLifecycle = async (account: ApprovedAccount, action: "deactivate" | "reactivate", alreadyConfirmed = false) => {
    const confirmed = alreadyConfirmed || window.confirm(action === "deactivate"
      ? `Deactivate ${account.name}? Store access, sessions, and device tokens will be disabled. Account history is preserved.`
      : `Reactivate ${account.name}? The current approved store membership will be restored. No approval email will be sent.`);
    if (!confirmed) return;
    setActingId(account.userId); setError(null); setNotice(null); setLifecycleTarget(null);
    try {
      const result = action === "deactivate" ? await api.deactivateAccount(account.userId) : await api.reactivateAccount(account.userId);
      setNotice(action === "deactivate"
        ? result.changed ? `${account.name} deactivated` : `${account.name} is already inactive`
        : result.changed ? `${account.name} reactivated (no approval email sent)` : `${account.name} is already active`);
      await loadApproved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "เปลี่ยนสถานะบัญชีไม่สำเร็จ"); }
    finally { setActingId(null); }
  };

  const openPermanentDeleteConfirmation = (account: ApprovedAccount) => {
    setAccountActionsTarget(null);
    setDeleteTarget(account);
    setDeleteConfirmation("");
    setError(null);
    setNotice(null);
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget || deleteConfirmation !== "DELETE") return;
    const target = deleteTarget;
    setActingId(target.userId); setError(null); setNotice(null);
    try {
      await api.permanentlyDeleteAccount(target.userId);
      setDeleteTarget(null);
      setDeleteConfirmation("");
      setNotice("Account permanently deleted.");
      await loadApproved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ลบบัญชีถาวรไม่สำเร็จ"); }
    finally { setActingId(null); }
  };

  if (!authChecked || !user) return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Account Management...</main>;

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      <MobilePageHeader
        eyebrow="Administration"
        title="BM & PC Accounts"
        description="ตรวจคำขอเข้าใช้งานและจัดการบัญชีร้านค้า"
        action={user.role === "ADMIN" ? <button type="button" onClick={() => tab === "pending" ? void loadPending() : void loadApproved()} className="min-h-10 rounded-xl border border-[var(--app-border)] px-3 text-[10px] font-bold">รีเฟรช</button> : undefined}
      />
      {user.role === "ADMIN" && (
        <MobileSectionTabs<Tab>
          value={tab}
          items={[{ value: "pending", label: "รออนุมัติ", badge: pending.length || undefined }, { value: "approved", label: "อนุมัติแล้ว", badge: approved.length || undefined }]}
          onChange={switchTab}
        />
      )}

      <div className="space-y-4 px-4 py-4 pb-8">
        {user.role !== "ADMIN" ? (
          <MobileEmptyState title="ไม่มีสิทธิ์ใช้งาน" description="เฉพาะ Administrator เท่านั้นที่จัดการบัญชีได้" />
        ) : (
          <>
            {notice && <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-600 dark:text-emerald-400">{notice}</div>}
            {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">{error}</div>}
            {temporaryPassword && (
              <MobileCard className="space-y-2 border-amber-500/30">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Temporary Password</p>
                <div className="flex items-center gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-[var(--app-surface-subtle)] px-3 py-3 text-sm font-bold">{temporaryPassword}</code><button type="button" onClick={() => void navigator.clipboard.writeText(temporaryPassword)} className="min-h-11 rounded-xl border border-[var(--app-border)] px-3 text-[10px] font-bold">คัดลอก</button></div>
                <p className="text-[10px] leading-4 text-[var(--app-text-tertiary)]">ส่งรหัสนี้ให้เจ้าของบัญชีผ่านช่องทางที่ปลอดภัย</p>
              </MobileCard>
            )}

            {tab === "pending" ? (
              <MobileSection title="คำขอรออนุมัติ" description={`${pending.length.toLocaleString()} รายการ`}>
                {loading && pending.length === 0 ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : pending.length === 0 ? <MobileEmptyState title="ไม่มีคำขอรออนุมัติ" /> : <div className="space-y-2.5">{pending.map((registration) => (
                  <MobileListCard key={registration.id} title={registration.name || "ไม่ระบุชื่อ"} subtitle={`${registration.store?.name || "ไม่ระบุร้าน"} · ${formatDate(registration.createdAt)}`} trailing={<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${registration.role === "STORE_MANAGER" ? "bg-[var(--app-accent)]/10 text-[var(--app-accent)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]"}`}>{roleLabel(registration.role)}</span>}>
                    <div className="space-y-1 text-[10px] text-[var(--app-text-secondary)]"><p>Employee ID: <strong className="text-[var(--app-text-primary)]">{registration.employeeId || "—"}</strong></p><p className="break-all">{registration.email}</p></div>
                    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "reject")} className="min-h-11 rounded-xl border border-rose-500/30 text-xs font-bold text-rose-600 disabled:opacity-35">ปฏิเสธ</button><button type="button" disabled={actingId !== null} onClick={() => void act(registration, "approve")} className="min-h-11 rounded-xl bg-[var(--app-accent)] text-xs font-bold text-white disabled:opacity-35">{actingId === registration.id ? "กำลังทำ..." : "อนุมัติ"}</button></div>
                  </MobileListCard>
                ))}</div>}
              </MobileSection>
            ) : (
              <div className="space-y-4">
                <MobileCard className="space-y-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ, Employee ID, email, ร้าน" className={inputClass} /><label className="block text-[10px] font-bold text-[var(--app-text-secondary)]" htmlFor="mobile-account-status">สถานะบัญชี<select id="mobile-account-status" value={accountStatusFilter} onChange={(event) => setAccountStatusFilter(event.target.value as AccountStatusFilter)} className={`${inputClass} mt-1 py-2 text-sm`}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">ทั้งหมด</option></select></label><div className="grid grid-cols-3 gap-2">{(["ALL", "STORE_MANAGER", "STAFF"] as RoleFilter[]).map((role) => <button key={role} type="button" onClick={() => setRoleFilter(role)} className={`min-h-10 rounded-xl border text-[10px] font-bold ${roleFilter === role ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5 text-[var(--app-accent)]" : "border-[var(--app-border)]"}`}>{role === "ALL" ? "ทั้งหมด" : roleLabel(role)}</button>)}</div></MobileCard>
                <MobileSection title="บัญชีที่อนุมัติแล้ว" description={`${filteredApproved.length.toLocaleString()} บัญชี`}>
                  {loading && approved.length === 0 ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : filteredApproved.length === 0 ? <MobileEmptyState title="ไม่พบบัญชี" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" /> : <div className="space-y-2.5">{filteredApproved.map((account) => (
                    <MobileListCard key={account.id} title={account.name} subtitle={`${account.store.name}${account.store.code ? ` · ${account.store.code}` : ""}`} trailing={<div className="flex items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${account.role === "STORE_MANAGER" ? "bg-[var(--app-accent)]/10 text-[var(--app-accent)]" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-secondary)]"}`}>{roleLabel(account.role)}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${account.accountStatus === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{account.accountStatus === "ACTIVE" ? "Active" : "Inactive"}</span></div>}>
                      <div className="space-y-1 text-[10px] text-[var(--app-text-secondary)]"><p>Employee ID: <strong className="text-[var(--app-text-primary)]">{account.employeeId || "—"}</strong></p><p className="break-all">{account.email}</p><p>อนุมัติ: {formatDate(account.approvedAt)}</p></div>
                      <div className="mt-3 grid grid-cols-1 gap-2">{account.accountStatus === "INACTIVE" && <button type="button" disabled={actingId !== null} onClick={() => void changeLifecycle(account, "reactivate")} className="min-h-11 w-full rounded-xl bg-[var(--app-accent)] text-xs font-bold text-white disabled:opacity-35">{actingId === account.userId ? "กำลังทำ..." : "Reactivate"}</button>}<button type="button" disabled={actingId !== null} onClick={() => void resetPassword(account)} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] text-xs font-bold disabled:opacity-35">{actingId === account.userId ? "กำลังรีเซ็ต..." : "Reset Password"}</button><button type="button" disabled={actingId !== null} onClick={() => account.accountStatus === "ACTIVE" ? setLifecycleTarget(account) : setAccountActionsTarget(account)} className="min-h-11 w-full rounded-xl border border-amber-500/30 text-xs font-bold text-amber-700 disabled:opacity-35">{account.accountStatus === "ACTIVE" ? "More · Deactivate" : "More actions"}</button></div>
                    </MobileListCard>
                  ))}</div>}
                </MobileSection>
              </div>
            )}
          </>
        )}
      </div>
      {accountActionsTarget && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 p-4"><MobileCard className="w-full max-w-sm space-y-2"><p className="px-2 pb-2 text-xs font-bold text-[var(--app-text-primary)]">Actions for {accountActionsTarget.name}</p><button type="button" onClick={() => { const target = accountActionsTarget; setAccountActionsTarget(null); void changeLifecycle(target, "reactivate"); }} className="min-h-11 w-full rounded-xl border border-[var(--app-border)] text-left px-3 text-xs font-bold">Reactivate account</button><button type="button" onClick={() => openPermanentDeleteConfirmation(accountActionsTarget)} className="min-h-11 w-full rounded-xl border border-rose-500/30 px-3 text-left text-xs font-bold text-rose-600">Delete permanently</button><button type="button" onClick={() => setAccountActionsTarget(null)} className="min-h-11 w-full rounded-xl bg-[var(--app-surface-subtle)] text-xs font-bold">Cancel</button></MobileCard></div>}
      {lifecycleTarget && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-5"><MobileCard className="w-full max-w-sm space-y-4"><h2 className="text-base font-bold">Deactivate account?</h2><p className="text-xs leading-5 text-[var(--app-text-secondary)]">Deactivate <strong className="text-[var(--app-text-primary)]">{lifecycleTarget.name}</strong>? Store access, active sessions, and device tokens will be disabled. Account history is preserved.</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setLifecycleTarget(null)} className="min-h-11 rounded-xl border border-[var(--app-border)] text-xs font-bold">Cancel</button><button type="button" onClick={() => void changeLifecycle(lifecycleTarget, "deactivate", true)} className="min-h-11 rounded-xl bg-rose-600 text-xs font-bold text-white">Confirm</button></div></MobileCard></div>}
      {deleteTarget && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 p-5"><MobileCard className="w-full max-w-sm space-y-4 border-rose-500/40"><h2 className="text-base font-bold">Delete account permanently?</h2><dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"><dt className="text-[var(--app-text-secondary)]">Name</dt><dd className="font-semibold">{deleteTarget.name}</dd><dt className="text-[var(--app-text-secondary)]">Store</dt><dd className="font-semibold">{deleteTarget.store.name}</dd><dt className="text-[var(--app-text-secondary)]">Role</dt><dd className="font-semibold">{roleLabel(deleteTarget.role)}</dd></dl><p className="text-xs leading-5 text-[var(--app-text-secondary)]">This permanently removes personal account information. Sign-in will no longer work and this action cannot be undone. Operational and audit history will be preserved.</p><label className="block text-xs font-bold" htmlFor="mobile-delete-confirmation">Type DELETE to confirm<input id="mobile-delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" className={`${inputClass} mt-1`} /></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setDeleteTarget(null); setDeleteConfirmation(""); }} className="min-h-11 rounded-xl border border-[var(--app-border)] text-xs font-bold">Cancel</button><button type="button" onClick={() => void permanentlyDelete()} disabled={actingId !== null || deleteConfirmation !== "DELETE"} className="min-h-11 rounded-xl bg-rose-600 text-xs font-bold text-white disabled:opacity-35">{actingId === deleteTarget.userId ? "Deleting…" : "Delete permanently"}</button></div></MobileCard></div>}
      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}
