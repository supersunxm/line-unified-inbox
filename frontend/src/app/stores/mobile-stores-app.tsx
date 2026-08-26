"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileBottomNav,
  MobileCard,
  MobileEmptyState,
  MobileListCard,
  MobileMetricCard,
  MobileMetricGrid,
  MobileMoreSheet,
  MobilePageHeader,
  MobilePageShell,
  MobileSection,
  MobileSectionTabs,
} from "@/components/mobile/adaptive-mobile";
import { api } from "@/lib/api";
import type { ApiStore, LineOfficialAccountResponse, StoreDeletionPreview } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type StoreTab = "active" | "issues" | "archived";

type StoreRow = {
  store: ApiStore;
  accounts: LineOfficialAccountResponse[];
  connected: number;
  issues: number;
  messagesToday: number;
};

function statusTone(status: string, healthy: boolean) {
  if (healthy && ["CONNECTED", "READY"].includes(status)) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
  if (["ERROR", "NOT_CONFIGURED"].includes(status) || !healthy) return "text-rose-600 dark:text-rose-400 bg-rose-500/10";
  return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
}

function StatusPill({ status, healthy }: { status: string; healthy: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(status, healthy)}`}>{status}</span>;
}

export function MobileStoresApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [accounts, setAccounts] = useState<LineOfficialAccountResponse[]>([]);
  const [tab, setTab] = useState<StoreTab>("active");
  const [search, setSearch] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState<StoreDeletionPreview | null>(null);

  useEffect(() => {
    let active = true;
    void api.me()
      .then((value) => { if (active) setUser(value); })
      .catch(() => { if (typeof window !== "undefined") window.location.replace("/login"); })
      .finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [storeRows, oaRows] = await Promise.all([api.stores(true), api.lineOfficialAccounts(true)]);
      setStores(storeRows ?? []);
      setAccounts(oaRows ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลร้านค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) void loadData(); }, [loadData, user]);

  const rows = useMemo<StoreRow[]>(() => stores.map((store) => {
    const storeAccounts = accounts.filter((account) => account.store.id === store.id);
    const connected = storeAccounts.filter((account) => account.isActive && account.credentialsHealthy && ["CONNECTED", "READY"].includes(account.connectionStatus)).length;
    const issues = storeAccounts.filter((account) => !account.credentialsHealthy || ["ERROR", "NOT_CONFIGURED"].includes(account.connectionStatus)).length;
    const messagesToday = storeAccounts.reduce((sum, account) => sum + (account.messagesReceivedToday || 0), 0);
    return { store, accounts: storeAccounts, connected, issues, messagesToday };
  }), [accounts, stores]);

  const counts = useMemo(() => ({
    active: rows.filter((row) => !row.store.archivedAt).length,
    archived: rows.filter((row) => Boolean(row.store.archivedAt)).length,
    issues: rows.filter((row) => !row.store.archivedAt && row.issues > 0).length,
    connectedOa: rows.reduce((sum, row) => sum + row.connected, 0),
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (tab === "archived") return Boolean(row.store.archivedAt);
        if (row.store.archivedAt) return false;
        if (tab === "issues") return row.issues > 0;
        return true;
      })
      .filter((row) => !q || row.store.name.toLowerCase().includes(q) || row.store.code?.toLowerCase().includes(q) || row.store.storeId?.toLowerCase().includes(q) || row.accounts.some((account) => account.name.toLowerCase().includes(q)))
      .sort((a, b) => b.issues - a.issues || b.messagesToday - a.messagesToday || a.store.name.localeCompare(b.store.name));
  }, [rows, search, tab]);

  const selected = useMemo(() => rows.find((row) => row.store.id === selectedStoreId) ?? null, [rows, selectedStoreId]);

  const archiveStore = async (row: StoreRow) => {
    if (!window.confirm(`Archive ร้าน “${row.store.name}”?`)) return;
    setActionLoading("store");
    setError(null);
    try { await api.archiveStore(row.store.id); await loadData(); setSelectedStoreId(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Archive ร้านไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  const restoreStore = async (row: StoreRow) => {
    setActionLoading("store");
    setError(null);
    try { await api.restoreStore(row.store.id); await loadData(); setSelectedStoreId(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Restore ร้านไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  const requestDelete = async (row: StoreRow) => {
    setActionLoading("preview");
    setError(null);
    try { setDeletePreview(await api.getStoreDeletionPreview(row.store.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดผลกระทบการลบร้านไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  const permanentDelete = async (row: StoreRow) => {
    const typed = window.prompt(`การลบถาวรไม่สามารถย้อนกลับได้\nพิมพ์ชื่อร้านเพื่อยืนยัน:\n${row.store.name}`);
    if (typed !== row.store.name) { if (typed !== null) setError("ชื่อร้านที่พิมพ์ไม่ตรง การลบถูกยกเลิก"); return; }
    setActionLoading("delete");
    setError(null);
    try { await api.deleteStore(row.store.id, row.store.name); setDeletePreview(null); setSelectedStoreId(null); await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ลบร้านไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  const testConnection = async (account: LineOfficialAccountResponse) => {
    setActionLoading(account.id);
    setError(null);
    try { await api.testLineOfficialAccount(account.id); await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ทดสอบการเชื่อมต่อไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  const setAccountActive = async (account: LineOfficialAccountResponse, next: boolean) => {
    setActionLoading(account.id);
    setError(null);
    try { await api.setLineOfficialAccountStatus(account.id, next); await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "อัปเดตสถานะ LINE OA ไม่สำเร็จ"); }
    finally { setActionLoading(null); }
  };

  if (!authChecked || !user) {
    return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิดข้อมูลร้านค้า...</main>;
  }

  return (
    <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
      {selected ? (
        <StoreDetail
          row={selected}
          user={user}
          actionLoading={actionLoading}
          deletePreview={deletePreview}
          error={error}
          onBack={() => { setSelectedStoreId(null); setDeletePreview(null); setError(null); }}
          onArchive={() => void archiveStore(selected)}
          onRestore={() => void restoreStore(selected)}
          onRequestDelete={() => void requestDelete(selected)}
          onDelete={() => void permanentDelete(selected)}
          onCloseDelete={() => setDeletePreview(null)}
          onTest={testConnection}
          onSetActive={setAccountActive}
        />
      ) : (
        <>
          <MobilePageHeader eyebrow="Operations · Store Network" title="จัดการร้านค้า" description="ดูสถานะร้านและ LINE OA ทั้งเครือข่าย" action={<button type="button" onClick={() => void loadData()} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] text-base">↻</button>} />
          <MobileSectionTabs<StoreTab> value={tab} items={[{ value: "active", label: "ใช้งาน", badge: counts.active }, { value: "issues", label: "มีปัญหา", badge: counts.issues }, { value: "archived", label: "Archived", badge: counts.archived }]} onChange={setTab} />
          <div className="space-y-4 px-4 py-4 pb-8">
            {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}

            <MobileMetricGrid>
              <MobileMetricCard label="ร้านที่ใช้งาน" value={counts.active} tone="accent" />
              <MobileMetricCard label="LINE OA เชื่อมต่อ" value={counts.connectedOa} tone="success" />
              <MobileMetricCard label="ร้านที่ต้องตรวจ" value={counts.issues} tone={counts.issues > 0 ? "danger" : "default"} />
              <MobileMetricCard label="Archived" value={counts.archived} />
            </MobileMetricGrid>

            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อร้าน / Store ID / LINE OA" className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-3 text-[16px] outline-none focus:border-[var(--app-accent)]" />

            <MobileSection title={tab === "issues" ? "ร้านที่ต้องตรวจสอบ" : tab === "archived" ? "ร้านที่เก็บถาวร" : "ร้านทั้งหมด"} description={`${filtered.length} ร้าน`}>
              {loading && rows.length === 0 ? <MobileCard><p className="py-8 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : filtered.length === 0 ? <MobileEmptyState title="ไม่พบร้าน" description="ลองเปลี่ยนตัวกรองหรือคำค้นหา" /> : <div className="space-y-2.5">{filtered.map((row) => <button key={row.store.id} type="button" onClick={() => { setSelectedStoreId(row.store.id); setError(null); }} className="block w-full text-left"><MobileListCard title={row.store.name} subtitle={row.store.code ?? row.store.storeId ?? "ไม่มี Store ID"} leading={<span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${row.issues > 0 ? "bg-rose-500/10 text-rose-600" : row.store.archivedAt ? "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]" : "bg-emerald-500/10 text-emerald-600"}`}>{row.issues > 0 ? "!" : row.store.archivedAt ? "A" : "✓"}</span>} trailing={<span className="text-[10px] font-semibold text-[var(--app-text-tertiary)]">ดู ›</span>}><div className="grid grid-cols-3 gap-2"><MiniStat label="LINE OA" value={`${row.connected}/${row.accounts.length}`} danger={row.issues > 0} /><MiniStat label="แชท" value={row.store._count?.conversations ?? 0} /><MiniStat label="ข้อความวันนี้" value={row.messagesToday} /></div>{row.issues > 0 && <p className="mt-2 text-[10px] font-semibold text-rose-600 dark:text-rose-400">{row.issues} LINE OA ต้องตรวจสอบ</p>}</MobileListCard></button>)}</div>}
            </MobileSection>
          </div>
        </>
      )}

      {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
    </MobilePageShell>
  );
}

function MiniStat({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2.5 py-2"><p className="text-[9px] text-[var(--app-text-tertiary)]">{label}</p><p className={`mt-0.5 text-sm font-bold tabular-nums ${danger ? "text-rose-600 dark:text-rose-400" : ""}`}>{value}</p></div>;
}

function StoreDetail({ row, user, actionLoading, deletePreview, error, onBack, onArchive, onRestore, onRequestDelete, onDelete, onCloseDelete, onTest, onSetActive }: {
  row: StoreRow;
  user: AuthUser;
  actionLoading: string | null;
  deletePreview: StoreDeletionPreview | null;
  error: string | null;
  onBack: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onRequestDelete: () => void;
  onDelete: () => void;
  onCloseDelete: () => void;
  onTest: (account: LineOfficialAccountResponse) => void;
  onSetActive: (account: LineOfficialAccountResponse, next: boolean) => void;
}) {
  return (
    <>
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-10 items-center text-sm font-bold text-[var(--app-accent)]">‹ ร้านทั้งหมด</button>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--app-text-tertiary)]">Store Detail</p><h1 className="mt-1 text-[22px] font-bold leading-tight">{row.store.name}</h1><p className="mt-1 text-xs text-[var(--app-text-secondary)]">{row.store.code ?? row.store.storeId ?? "ไม่มี Store ID"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${row.store.archivedAt ? "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]" : row.issues > 0 ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"}`}>{row.store.archivedAt ? "ARCHIVED" : row.issues > 0 ? "ATTENTION" : "ACTIVE"}</span></div>
      </header>
      <div className="space-y-4 px-4 py-4 pb-8">
        {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-600 dark:text-rose-400">{error}</div>}
        <MobileMetricGrid>
          <MobileMetricCard label="LINE OA" value={row.accounts.length} detail={`${row.connected} เชื่อมต่อ`} tone={row.issues > 0 ? "warning" : "success"} />
          <MobileMetricCard label="บทสนทนา" value={row.store._count?.conversations ?? 0} />
          <MobileMetricCard label="ยังไม่ตอบ" value={row.store._count?.operationalNotRepliedCount ?? 0} tone={(row.store._count?.operationalNotRepliedCount ?? 0) > 0 ? "danger" : "default"} />
          <MobileMetricCard label="ข้อความวันนี้" value={row.messagesToday} />
        </MobileMetricGrid>

        <MobileSection title="LINE Official Accounts" description={`${row.accounts.length} บัญชี`}>
          {row.accounts.length === 0 ? <MobileEmptyState title="ยังไม่มี LINE OA" description="ร้านนี้ยังไม่มีบัญชี LINE OA ที่เชื่อมกับระบบ" /> : <div className="space-y-2.5">{row.accounts.map((account) => <MobileListCard key={account.id} title={account.name} subtitle={account.basicId ?? account.store.externalStoreId ?? "—"} trailing={<StatusPill status={account.connectionStatus} healthy={account.credentialsHealthy} />}><div className="grid grid-cols-2 gap-2"><MiniStat label="บทสนทนา" value={account.conversationCount} /><MiniStat label="ข้อความวันนี้" value={account.messagesReceivedToday} /></div>{account.lastConnectionError && <p className="mt-2 rounded-lg bg-rose-500/10 px-2.5 py-2 text-[10px] leading-4 text-rose-600 dark:text-rose-400">{account.lastConnectionError}</p>}<div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={actionLoading === account.id} onClick={() => onTest(account)} className="min-h-10 rounded-xl border border-[var(--app-border)] text-[10px] font-bold disabled:opacity-40">{actionLoading === account.id ? "กำลังตรวจ..." : "Test Connection"}</button>{account.resolvedLineOaManagerUrl ? <a href={account.resolvedLineOaManagerUrl} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-center rounded-xl bg-[var(--app-accent)] px-2 text-center text-[10px] font-bold text-white">เปิด LINE OA</a> : <button type="button" disabled className="min-h-10 rounded-xl bg-[var(--app-surface-subtle)] text-[10px] text-[var(--app-text-tertiary)]">ไม่มี Manager URL</button>}</div>{account.store.googleMapsUrl && <a href={account.store.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-2 flex min-h-10 items-center justify-center rounded-xl border border-[var(--app-accent)]/40 px-2 text-center text-[10px] font-bold text-[var(--app-accent)]">เปิด Google Maps ↗</a>}{user.role === "ADMIN" && <button type="button" disabled={actionLoading === account.id} onClick={() => onSetActive(account, !account.isActive)} className={`mt-2 min-h-10 w-full rounded-xl text-[10px] font-bold ${account.isActive ? "border border-amber-500/30 text-amber-600" : "bg-emerald-600 text-white"}`}>{account.isActive ? "ปิดการใช้งานบัญชี" : "เปิดการใช้งานบัญชี"}</button>}</MobileListCard>)}</div>}
        </MobileSection>

        {user.role === "ADMIN" && <MobileSection title="จัดการร้าน" description="การเปลี่ยนแปลงส่วนนี้มีผลกับข้อมูลร้านในระบบ"><MobileCard className="space-y-2">{row.store.archivedAt ? <button type="button" disabled={actionLoading === "store"} onClick={onRestore} className="min-h-12 w-full rounded-xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-40">Restore ร้าน</button> : <button type="button" disabled={actionLoading === "store"} onClick={onArchive} className="min-h-12 w-full rounded-xl border border-amber-500/40 text-sm font-bold text-amber-600 disabled:opacity-40">Archive ร้าน</button>}<button type="button" disabled={actionLoading === "preview" || actionLoading === "delete"} onClick={onRequestDelete} className="min-h-12 w-full rounded-xl border border-rose-500/35 text-sm font-bold text-rose-600 disabled:opacity-40">ตรวจผลกระทบก่อนลบถาวร</button></MobileCard></MobileSection>}
      </div>

      {deletePreview && <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={onCloseDelete}><div className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[1.6rem] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem,env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" /><h2 className="text-base font-bold text-rose-600">ลบร้านถาวร</h2><p className="mt-1 text-xs leading-5 text-[var(--app-text-secondary)]">ข้อมูลต่อไปนี้จะได้รับผลกระทบ การลบถาวรไม่สามารถย้อนกลับได้</p><div className="mt-4 grid grid-cols-2 gap-2"><MiniStat label="LINE OA" value={deletePreview.lineOfficialAccountCount} /><MiniStat label="บทสนทนา" value={deletePreview.conversationCount} /><MiniStat label="ข้อความ" value={deletePreview.messageCount} /><MiniStat label="Activity" value={deletePreview.activityCount} /></div><div className="mt-3 rounded-xl bg-[var(--app-surface-subtle)] p-3 text-[11px] leading-5 text-[var(--app-text-secondary)]"><p>Customer ที่คงอยู่: <strong>{deletePreview.customerRecordsThatWillRemain}</strong></p><p>Customer ที่จะถูกลบ: <strong className="text-rose-600">{deletePreview.customerRecordsThatWillBeDeleted}</strong></p></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onCloseDelete} className="min-h-12 rounded-xl border border-[var(--app-border)] text-sm font-bold">ยกเลิก</button><button type="button" disabled={actionLoading === "delete"} onClick={onDelete} className="min-h-12 rounded-xl bg-rose-600 text-sm font-bold text-white disabled:opacity-40">{actionLoading === "delete" ? "กำลังลบ..." : "ลบถาวร"}</button></div></div></div>}
    </>
  );
}
