"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthorizedSection, useAuthorizedUser } from "../../../authorized-workspace";
import { useAppLanguage } from "@/app/language";
import { InternalPageShell } from "@/components/shell/internal-page-shell";
import { invalidateAuthUser, refreshAuthUser } from "@/lib/auth-user-store";
import { hqPermissionSummary, saveHqAccountRole, type HqAccount, type HqAccountRole } from "./hq-account-model";
import { hqRegistrationText } from "./hq-registrations-i18n";

type PendingHq = {
  id: string;
  displayName: string;
  employeeId: string | null;
  email: string;
  createdAt: string;
};

type ApprovedHq = HqAccount;

type Tab = "pending" | "approved";

async function request<T>(path: string, init: RequestInit | undefined, requestFailed: (status: number) => string): Promise<T> {
  const response = await fetch(`/api-backend${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    let message = requestFailed(response.status);
    try {
      const body = await response.json() as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function HqApprovalContent() {
  const actor = useAuthorizedUser();
  const { language } = useAppLanguage();
  const t = hqRegistrationText[language];
  const [roleTarget, setRoleTarget] = useState<HqAccount | null>(null);
  const [newRole, setNewRole] = useState<HqAccountRole>("ASSISTANT");
  const [selfDemotionConfirmed, setSelfDemotionConfirmed] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<PendingHq[]>([]);
  const [approved, setApproved] = useState<ApprovedHq[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<ApprovedHq | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secretarySettingsOpen, setSecretarySettingsOpen] = useState(false);

  const openRoleEditor = (account: HqAccount) => {
    setRoleTarget(account);
    setNewRole(account.role);
    setSelfDemotionConfirmed(false);
    setRoleError(null);
    setNotice(null);
  };

  const saveRole = async () => {
    if (!roleTarget || acting) return;
    if (roleTarget.id === actor?.id && newRole === "ASSISTANT" && !selfDemotionConfirmed) return;
    setActing(roleTarget.id);
    setRoleError(null);
    try {
      const saved = await saveHqAccountRole(roleTarget, newRole, (id, role) => request<{ role: HqAccountRole }>(`/admin/registrations/hq-users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, t.requestFailed));
      setApproved((accounts) => accounts.map((account) => account.id === saved.id ? saved : account));
      setNotice(t.roleUpdated(saved.displayName));
      setRoleTarget(null);
      if (saved.id === actor?.id) {
        invalidateAuthUser();
        await refreshAuthUser();
      }
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : t.unableToChangeRole);
    } finally {
      setActing(null);
    }
  };

  const loadPending = useCallback(async () => {
    const result = await request<{ registrations: PendingHq[] }>("/admin/registrations/hq-pending", undefined, t.requestFailed);
    setPending(result.registrations);
  }, [t.requestFailed]);

  const loadApproved = useCallback(async () => {
    const result = await request<{ accounts: ApprovedHq[] }>("/admin/registrations/hq-approved", undefined, t.requestFailed);
    setApproved(result.accounts);
  }, [t.requestFailed]);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPending(), loadApproved()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unableToLoad);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [loadApproved, loadPending, t.unableToLoad]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      request<{ registrations: PendingHq[] }>("/admin/registrations/hq-pending", undefined, t.requestFailed),
      request<{ accounts: ApprovedHq[] }>("/admin/registrations/hq-approved", undefined, t.requestFailed),
    ]).then(([pendingResult, approvedResult]) => {
      if (cancelled) return;
      setPending(pendingResult.registrations);
      setApproved(approvedResult.accounts);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : t.unableToLoad);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [t.requestFailed, t.unableToLoad]);

  async function actPending(id: string, action: "approve" | "reject") {
    setActing(id);
    setError(null);
    setNotice(null);
    try {
      await request(`/admin/registrations/hq-users/${id}/${action}`, { method: "PATCH" }, t.requestFailed);
      setNotice(action === "approve" ? t.approvedNotice : t.rejectedNotice);
      await load(false);
      if (action === "approve") setTab("approved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.actionFailed);
    } finally {
      setActing(null);
    }
  }

  async function actLifecycle(account: ApprovedHq, action: "deactivate" | "reactivate") {
    setActing(account.id);
    setError(null);
    setNotice(null);
    try {
      await request(`/admin/registrations/hq-users/${account.id}/${action}`, { method: "PATCH" }, t.requestFailed);
      setNotice(action === "deactivate" ? t.deactivatedNotice(account.displayName) : t.reactivatedNotice(account.displayName));
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.accountStatusFailed);
    } finally {
      setActing(null);
    }
  }

  function openResetPassword(account: ApprovedHq) {
    setResetTarget(account);
    setTemporaryPassword(null);
    setPasswordCopied(false);
    setError(null);
    setNotice(null);
  }

  function closeResetPassword() {
    if (resetTarget && acting === resetTarget.id) return;
    setResetTarget(null);
    setTemporaryPassword(null);
    setPasswordCopied(false);
  }

  async function resetPassword() {
    if (!resetTarget) return;
    const target = resetTarget;
    setActing(target.id);
    setError(null);
    setNotice(null);
    setPasswordCopied(false);
    try {
      const result = await request<{ userId: string; temporaryPassword: string }>(`/admin/registrations/hq-users/${target.id}/reset-password`, { method: "POST" }, t.requestFailed);
      setTemporaryPassword(result.temporaryPassword);
      setNotice(`${t.resetCompleted(target.displayName)} ${t.shareSecurely}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.passwordResetFailed);
    } finally {
      setActing(null);
    }
  }

  async function copyTemporaryPassword() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setPasswordCopied(true);
    } catch {
      setError(t.copyPasswordFailed);
    }
  }

  return (
    <main className="min-h-full bg-[var(--app-bg)] p-6 text-[var(--app-text-primary)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-accent)]">{t.accountManagement}</p>
            <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
            <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{t.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/registrations" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium">{t.bmPcAccounts}</Link>
            <button type="button" onClick={() => void load()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white">{t.refresh}</button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-[var(--app-border)] pb-2">
          <button type="button" onClick={() => setTab("pending")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "pending" ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}>{t.pendingApproval} ({pending.length})</button>
          <button type="button" onClick={() => setTab("approved")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "approved" ? "bg-[var(--app-accent)] text-white" : "bg-[var(--app-surface)] text-[var(--app-text-secondary)]"}`}>{t.approvedManage} ({approved.length})</button>
        </div>

        {notice && <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
        {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">{t.loadingAccounts}</div>
        ) : tab === "pending" ? (
          pending.length === 0 ? (
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">{t.noPending}</div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <article key={item.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{item.displayName}</h2>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{t.pendingHq}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{item.email}</p>
                      <p className="text-sm text-[var(--app-text-secondary)]">{t.employeeId} {item.employeeId ?? "—"}</p>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.requested} {new Date(item.createdAt).toLocaleString(language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={acting === item.id} onClick={() => void actPending(item.id, "reject")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t.reject}</button>
                      <button disabled={acting === item.id} onClick={() => void actPending(item.id, "approve")} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t.approveFullAccess}</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : approved.length === 0 ? (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-text-secondary)]">{t.noApproved}</div>
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
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{active ? t.active : t.inactive}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{account.role === "ADMIN" ? t.administrator : t.assistant}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{account.email}</p>
                      <p className="text-sm text-[var(--app-text-secondary)]">{t.employeeId} {account.employeeId ?? "—"}</p>
                      <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--app-text-secondary)]">{hqPermissionSummary(account, language)}</p>
                      <p className="mt-1 text-xs text-[var(--app-text-secondary)]">{t.lastLogin} {account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString(language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-US") : t.never}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {actor?.id === account.id && account.role === "ADMIN" && account.employeeId === "6901011" && (
                        <button type="button" onClick={() => setSecretarySettingsOpen(true)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text-secondary)]" aria-label="ตั้งค่าเลขาซันน์">เลขาซันน์</button>
                      )}
                      <button type="button" disabled={acting !== null} onClick={() => openRoleEditor(account)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium disabled:opacity-50">{t.changeRole}</button>
                      {active && (
                        <button disabled={acting === account.id} onClick={() => openResetPassword(account)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text-primary)] disabled:opacity-50">{t.resetPassword}</button>
                      )}
                      {active ? (
                        <button disabled={acting === account.id} onClick={() => void actLifecycle(account, "deactivate")} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">{t.deactivate}</button>
                      ) : (
                        <button disabled={acting === account.id} onClick={() => void actLifecycle(account, "reactivate")} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t.reactivate}</button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {secretarySettingsOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="secretary-settings-title">
        <div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="secretary-settings-title" className="text-lg font-bold">เลขาซันน์ · ตั้งค่า LINE</h2>
              <p className="mt-1 text-sm text-[var(--app-text-secondary)]">การตั้งค่าส่วนตัวสำหรับบัญชีผู้ดูแลที่ได้รับอนุญาต</p>
            </div>
            <button type="button" className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm" onClick={() => setSecretarySettingsOpen(false)}>ปิด</button>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            ยังไม่เปิดรับข้อมูล LINE ผ่านหน้านี้ และ Webhook ยังต้องปิดไว้จนกว่าจะมีการเชื่อมระบบตรวจสิทธิ์และบันทึก Secret อย่างปลอดภัย
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">ข้อมูลที่จะต้องตั้งค่าบน Railway (Backend Service)</p>
            {["SUNN_SECRETARY_CHANNEL_ID", "SUNN_SECRETARY_CHANNEL_SECRET", "SUNN_SECRETARY_CHANNEL_ACCESS_TOKEN", "SUNN_SECRETARY_BOT_USER_ID"].map((name) => (
              <code key={name} className="block break-all rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-xs">{name}</code>
            ))}
            <p className="text-xs text-[var(--app-text-secondary)]">เก็บ Secret และ Access Token เป็นตัวแปรลับเท่านั้น ห้ามส่งผ่านแชทหรือ GitHub</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Webhook URL</p>
            <code className="block break-all rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3 text-xs">https://lineoppo.click/sunn-secretary/webhook</code>
            <p className="text-xs text-[var(--app-text-secondary)]">การเข้ากลุ่มสำเร็จไม่ได้หมายความว่า Webhook พร้อมใช้งาน</p>
          </div>
          <a href="https://railway.com/dashboard" target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-medium">เปิด Railway เพื่อจัดการ Secret</a>
        </div>
      </div>}

      {roleTarget && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="hq-role-title">
        <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
          <h2 id="hq-role-title" className="text-lg font-bold">{t.changeRole}</h2>
          <p className="mt-2 font-semibold">{roleTarget.displayName}</p>
          <p className="break-all text-sm text-[var(--app-text-secondary)]">{roleTarget.email}</p>
          <fieldset className="mt-5 space-y-3" disabled={acting !== null}>
            <legend className="mb-2 text-sm font-semibold">{t.role}</legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--app-border)] p-3"><input autoFocus type="radio" name="hq-role" value="ADMIN" checked={newRole === "ADMIN"} onChange={() => setNewRole("ADMIN")} className="mt-1" /><span><span className="block font-semibold">{t.administrator}</span><span className="text-sm text-[var(--app-text-secondary)]">{t.administratorDescription}</span></span></label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--app-border)] p-3"><input type="radio" name="hq-role" value="ASSISTANT" checked={newRole === "ASSISTANT"} onChange={() => setNewRole("ASSISTANT")} className="mt-1" /><span><span className="block font-semibold">{t.assistant}</span><span className="text-sm text-[var(--app-text-secondary)]">{t.assistantDescription}</span></span></label>
          </fieldset>
          {roleTarget.id === actor?.id && newRole === "ASSISTANT" && <label className="mt-4 flex items-start gap-2 text-sm text-amber-700"><input type="checkbox" checked={selfDemotionConfirmed} onChange={(event) => setSelfDemotionConfirmed(event.target.checked)} /><span>{t.selfDemotionConfirmation}</span></label>}
          {roleError && <p role="alert" className="mt-4 text-sm text-[var(--app-danger)]">{roleError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={acting !== null} onClick={() => setRoleTarget(null)} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm">{t.cancel}</button><button type="button" disabled={acting !== null || (roleTarget.id === actor?.id && newRole === "ASSISTANT" && !selfDemotionConfirmed)} onClick={() => void saveRole()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{acting ? t.saving : t.saveChanges}</button></div>
        </div>
      </div>}

      {resetTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="hq-password-reset-title">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <h2 id="hq-password-reset-title" className="text-lg font-bold">{temporaryPassword ? t.temporaryPassword : t.resetPassword}</h2>
            {temporaryPassword ? (
              <>
                <p className="mt-2 text-sm text-[var(--app-text-secondary)]">{t.resetCompleted(resetTarget.displayName)} {t.resetCompletedDetails}</p>
                <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-secondary)]">{t.temporaryPassword}</p>
                  <code className="mt-2 block break-all text-lg font-bold tracking-wide text-[var(--app-text-primary)]">{temporaryPassword}</code>
                </div>
                <p className="mt-3 text-xs text-amber-700">{t.resetPasswordSecurity}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => void copyTemporaryPassword()} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-medium">{passwordCopied ? t.copied : t.copyPassword}</button>
                  <button type="button" onClick={closeResetPassword} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white">{t.done}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-[var(--app-text-secondary)]">{t.generatePassword(resetTarget.displayName)}</p>
                <p className="mt-2 text-xs text-[var(--app-text-secondary)]">{t.resetPasswordDetails}</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" disabled={acting === resetTarget.id} onClick={closeResetPassword} className="rounded-lg border border-[var(--app-border)] px-4 py-2 text-sm font-medium disabled:opacity-50">{t.cancel}</button>
                  <button type="button" disabled={acting === resetTarget.id} onClick={() => void resetPassword()} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{acting === resetTarget.id ? t.resetting : t.resetPassword}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function HqRegistrationsPage() {
  return <AuthorizedSection section="admin-registrations"><InternalPageShell section="admin-registrations"><HqApprovalContent /></InternalPageShell></AuthorizedSection>;
}
