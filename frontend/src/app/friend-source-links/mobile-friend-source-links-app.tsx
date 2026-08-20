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
import type { FriendAttributionConfigDto, FriendSource, FriendSourceLink, FriendSourceLinksSummaryItem, LineOfficialAccountResponse } from "@/types/api";

type AuthUser = { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER" };
type Tab = "overview" | "links" | "stores" | "setup";
const sourceLabel: Record<FriendSource, string> = { STORE_QR: "Store QR", TIKTOK: "TikTok", FACEBOOK: "Facebook", INSTAGRAM: "Instagram" };
const inputClass = "w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3 text-[16px] outline-none focus:border-[var(--app-accent)]";

export function MobileFriendSourceLinksApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [links, setLinks] = useState<FriendSourceLink[]>([]);
  const [summary, setSummary] = useState<FriendSourceLinksSummaryItem[]>([]);
  const [configs, setConfigs] = useState<FriendAttributionConfigDto[]>([]);
  const [accounts, setAccounts] = useState<LineOfficialAccountResponse[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<FriendSource | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedOaIds, setSelectedOaIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<FriendAttributionConfigDto | null>(null);
  const [channelId, setChannelId] = useState("");
  const [liffId, setLiffId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.me().then((value) => { if (active) setUser(value); }).catch(() => window.location.replace("/login")).finally(() => { if (active) setAuthChecked(true); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [linkRows, summaryRows, configRows, oaRows] = await Promise.all([
        api.friendSourceLinks(), api.friendSourceLinksSummary(), api.friendAttributionConfigs(), api.lineOfficialAccounts(false),
      ]);
      setLinks(linkRows ?? []); setSummary(summaryRows ?? []); setConfigs(configRows ?? []); setAccounts(oaRows ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลด Friend Source Links ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void load(); }, [load, user]);

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return links.filter((item) => (source === "ALL" || item.source === source) && (!q || item.storeName?.toLowerCase().includes(q) || item.lineOaName?.toLowerCase().includes(q) || item.shortCode.toLowerCase().includes(q))).sort((a, b) => b.clickCount - a.clickCount);
  }, [links, search, source]);

  const totals = useMemo(() => {
    const totalLinks = links.length;
    const activeLinks = links.filter((item) => item.isActive).length;
    const clicks = links.reduce((sum, item) => sum + item.clickCount, 0);
    const confirmed = links.reduce((sum, item) => sum + (item.confirmedAdds ?? 0), 0);
    return { totalLinks, activeLinks, clicks, confirmed, conversion: clicks > 0 ? (confirmed / clicks) * 100 : 0 };
  }, [links]);

  const storeGroups = useMemo(() => {
    const map = new Map<string, { storeId: string; storeName: string; code: string | null; links: number; active: number; clicks: number; confirmed: number }>();
    for (const row of summary) {
      const current = map.get(row.storeId) ?? { storeId: row.storeId, storeName: row.storeName, code: row.storeCode, links: 0, active: 0, clicks: 0, confirmed: 0 };
      current.links += row.totalLinks; current.active += row.activeLinks; current.clicks += row.clicks; current.confirmed += row.confirmedAdds ?? 0;
      map.set(row.storeId, current);
    }
    return [...map.values()].sort((a, b) => b.clicks - a.clicks);
  }, [summary]);

  const copy = async (value: string, id: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(id); window.setTimeout(() => setCopied((current) => current === id ? null : current), 1500); }
    catch { setError("คัดลอกลิงก์ไม่สำเร็จ"); }
  };

  const toggleLink = async (item: FriendSourceLink) => {
    setError(null);
    try { await api.updateFriendSourceLink(item.id, { isActive: !item.isActive }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "เปลี่ยนสถานะลิงก์ไม่สำเร็จ"); }
  };

  const generate = async () => {
    if (selectedOaIds.length === 0) { setError("เลือก LINE OA อย่างน้อย 1 บัญชี"); return; }
    setGenerating(true); setError(null);
    try { await api.generateFriendSourceLinks(selectedOaIds); setGenerateOpen(false); setSelectedOaIds([]); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "สร้าง Source Links ไม่สำเร็จ"); }
    finally { setGenerating(false); }
  };

  const openConfig = (config: FriendAttributionConfigDto) => {
    setEditingConfig(config); setChannelId(config.lineLoginChannelId ?? ""); setLiffId(config.liffId ?? ""); setEnabled(config.isEnabled);
  };

  const saveConfig = async () => {
    if (!editingConfig || !channelId.trim() || !liffId.trim()) { setError("กรุณาใส่ Channel ID และ LIFF ID"); return; }
    setSavingConfig(true); setError(null);
    try {
      await api.upsertFriendAttributionConfig(editingConfig.lineOaId, { lineOaId: editingConfig.lineOaId, lineLoginChannelId: channelId.trim(), liffId: liffId.trim(), isEnabled: enabled });
      setEditingConfig(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึก Attribution Setup ไม่สำเร็จ"); }
    finally { setSavingConfig(false); }
  };

  const removeConfig = async () => {
    if (!editingConfig || !window.confirm(`ลบ Attribution config ของ ${editingConfig.lineOaName}?`)) return;
    setSavingConfig(true); setError(null);
    try { await api.deleteFriendAttributionConfig(editingConfig.lineOaId); setEditingConfig(null); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "ลบ config ไม่สำเร็จ"); }
    finally { setSavingConfig(false); }
  };

  if (!authChecked || !user) return <main className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-bg)] text-sm text-[var(--app-text-secondary)]">กำลังเปิด Friend Source Links...</main>;

  return <MobilePageShell bottomNav={<MobileBottomNav current="more" onMore={() => setMoreOpen(true)} />}>
    <MobilePageHeader eyebrow="Growth · Friend Attribution" title="Friend Source Links" description="ติดตามว่าเพื่อน LINE มาจาก Store QR, TikTok, Facebook หรือ Instagram" action={user.role === "ADMIN" ? <button type="button" onClick={() => setGenerateOpen(true)} className="min-h-10 rounded-xl bg-[var(--app-accent)] px-3 text-[11px] font-bold text-white">สร้าง</button> : undefined} />
    <MobileSectionTabs<Tab> value={tab} items={[{ value: "overview", label: "ภาพรวม" }, { value: "links", label: "Links", badge: links.length || undefined }, { value: "stores", label: "ร้านค้า" }, { value: "setup", label: "Setup" }]} onChange={setTab} />
    <div className="space-y-4 px-4 py-4 pb-8">
      {error && <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-600">{error}</div>}
      {loading && links.length === 0 ? <MobileCard><p className="py-10 text-center text-xs text-[var(--app-text-secondary)]">กำลังโหลด...</p></MobileCard> : <>
        {tab === "overview" && <Overview totals={totals} links={links} />}
        {tab === "links" && <Links items={filteredLinks} search={search} source={source} copied={copied} onSearch={setSearch} onSource={setSource} onCopy={copy} onToggle={toggleLink} canEdit={user.role === "ADMIN"} />}
        {tab === "stores" && <Stores groups={storeGroups} />}
        {tab === "setup" && <Setup configs={configs} onOpen={openConfig} canEdit={user.role === "ADMIN"} />}
      </>}
    </div>

    {generateOpen && <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={() => setGenerateOpen(false)}><div className="max-h-[82dvh] w-full overflow-y-auto rounded-t-[1.6rem] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem,env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" /><div className="flex items-center justify-between"><div><h2 className="text-base font-bold">สร้าง Source Links</h2><p className="text-[11px] text-[var(--app-text-secondary)]">เลือก LINE OA ที่ต้องการสร้างชุดลิงก์</p></div><button onClick={() => setGenerateOpen(false)} className="h-10 w-10 rounded-full bg-[var(--app-surface-subtle)]">×</button></div><div className="mt-4 space-y-2">{accounts.filter((oa) => oa.isActive && !oa.archivedAt).map((oa) => { const active = selectedOaIds.includes(oa.id); return <button key={oa.id} type="button" onClick={() => setSelectedOaIds((current) => active ? current.filter((id) => id !== oa.id) : [...current, oa.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5" : "border-[var(--app-border)]"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white" : "border-[var(--app-border)]"}`}>{active ? "✓" : ""}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{oa.name}</span><span className="block truncate text-[10px] text-[var(--app-text-tertiary)]">{oa.store.name}</span></span></button>; })}</div><button type="button" disabled={generating || selectedOaIds.length === 0} onClick={() => void generate()} className="mt-4 min-h-12 w-full rounded-xl bg-[var(--app-accent)] text-sm font-bold text-white disabled:opacity-40">{generating ? "กำลังสร้าง..." : `สร้างสำหรับ ${selectedOaIds.length} OA`}</button></div></div>}

    {editingConfig && <div className="absolute inset-0 z-50 flex items-end bg-black/40" onClick={() => setEditingConfig(null)}><div className="w-full rounded-t-[1.6rem] bg-[var(--app-surface)] px-4 pt-3 shadow-2xl" style={{ paddingBottom: "max(1rem,env(safe-area-inset-bottom))" }} onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--app-border)]" /><h2 className="text-base font-bold">{editingConfig.lineOaName}</h2><p className="mt-0.5 text-[11px] text-[var(--app-text-secondary)]">{editingConfig.storeName ?? "ไม่มีร้าน"}</p><div className="mt-4 space-y-3"><label><span className="mb-1 block text-[11px] font-semibold">LINE Login Channel ID</span><input value={channelId} onChange={(event) => setChannelId(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[11px] font-semibold">LIFF ID</span><input value={liffId} onChange={(event) => setLiffId(event.target.value)} className={inputClass} /></label><button type="button" onClick={() => setEnabled((value) => !value)} className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 text-xs font-bold ${enabled ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600" : "border-[var(--app-border)]"}`}><span>เปิด Friend Attribution</span><span>{enabled ? "ON" : "OFF"}</span></button></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={savingConfig} onClick={() => void removeConfig()} className="min-h-12 rounded-xl border border-rose-500/30 text-xs font-bold text-rose-600">ลบ config</button><button type="button" disabled={savingConfig} onClick={() => void saveConfig()} className="min-h-12 rounded-xl bg-[var(--app-accent)] text-xs font-bold text-white">{savingConfig ? "กำลังบันทึก..." : "บันทึก"}</button></div></div></div>}

    {moreOpen && <MobileMoreSheet displayName={user.displayName} role={user.role} onClose={() => setMoreOpen(false)} />}
  </MobilePageShell>;
}

function Overview({ totals, links }: { totals: { totalLinks: number; activeLinks: number; clicks: number; confirmed: number; conversion: number }; links: FriendSourceLink[] }) {
  const bySource = (Object.keys(sourceLabel) as FriendSource[]).map((source) => ({ source, clicks: links.filter((item) => item.source === source).reduce((sum, item) => sum + item.clickCount, 0), confirmed: links.filter((item) => item.source === source).reduce((sum, item) => sum + (item.confirmedAdds ?? 0), 0) })).sort((a, b) => b.clicks - a.clicks);
  return <div className="space-y-4"><MobileMetricGrid><MobileMetricCard label="Links" value={totals.totalLinks} detail={`${totals.activeLinks} active`} wide /><MobileMetricCard label="Clicks" value={totals.clicks} tone="accent" /><MobileMetricCard label="Confirmed Adds" value={totals.confirmed} tone="success" /><MobileMetricCard label="Conversion" value={`${totals.conversion.toFixed(1)}%`} wide /></MobileMetricGrid><MobileSection title="Traffic by Source"><MobileCard className="space-y-3">{bySource.map((item, index) => <div key={item.source} className="flex items-center justify-between border-b border-[var(--app-border-subtle)] pb-3 last:border-0 last:pb-0"><div><p className="text-xs font-bold">{index + 1}. {sourceLabel[item.source]}</p><p className="mt-0.5 text-[10px] text-[var(--app-text-tertiary)]">{item.confirmed} confirmed adds</p></div><span className="text-base font-bold tabular-nums">{item.clicks}</span></div>)}</MobileCard></MobileSection></div>;
}

function Links({ items, search, source, copied, onSearch, onSource, onCopy, onToggle, canEdit }: { items: FriendSourceLink[]; search: string; source: FriendSource | "ALL"; copied: string | null; onSearch: (value: string) => void; onSource: (value: FriendSource | "ALL") => void; onCopy: (value: string, id: string) => void; onToggle: (item: FriendSourceLink) => void; canEdit: boolean }) {
  return <div className="space-y-3"><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="ค้นหาร้าน / LINE OA / short code" className={inputClass} /><select value={source} onChange={(event) => onSource(event.target.value as FriendSource | "ALL")} className={inputClass}><option value="ALL">ทุก Source</option>{(Object.keys(sourceLabel) as FriendSource[]).map((key) => <option key={key} value={key}>{sourceLabel[key]}</option>)}</select><MobileSection title="Source Links" description={`${items.length} links`}>{items.length === 0 ? <MobileEmptyState title="ไม่พบลิงก์" /> : <div className="space-y-2.5">{items.map((item) => <MobileListCard key={item.id} title={item.storeName ?? item.lineOaName ?? "Unknown"} subtitle={`${sourceLabel[item.source]} · ${item.shortCode}`} trailing={<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--app-surface-subtle)] text-[var(--app-text-tertiary)]"}`}>{item.isActive ? "ACTIVE" : "OFF"}</span>}><div className="grid grid-cols-3 gap-2"><MiniStat label="Clicks" value={item.clickCount} /><MiniStat label="Adds" value={item.confirmedAdds ?? 0} /><MiniStat label="Conv." value={`${(item.conversionRate ?? 0).toFixed(1)}%`} /></div><p className="mt-2 break-all rounded-lg bg-[var(--app-surface-subtle)] p-2 text-[9px] text-[var(--app-text-secondary)]">{item.shortUrl}</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => onCopy(item.shortUrl, item.id)} className="min-h-10 rounded-xl border border-[var(--app-border)] text-[10px] font-bold">{copied === item.id ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}</button>{canEdit ? <button type="button" onClick={() => onToggle(item)} className={`min-h-10 rounded-xl text-[10px] font-bold ${item.isActive ? "border border-amber-500/30 text-amber-600" : "bg-emerald-600 text-white"}`}>{item.isActive ? "ปิดลิงก์" : "เปิดลิงก์"}</button> : <span />}</div></MobileListCard>)}</div>}</MobileSection></div>;
}

function Stores({ groups }: { groups: Array<{ storeId: string; storeName: string; code: string | null; links: number; active: number; clicks: number; confirmed: number }> }) { return <MobileSection title="Store Attribution" description="รวมทุก Source ต่อร้าน">{groups.length === 0 ? <MobileEmptyState title="ยังไม่มีข้อมูลร้าน" /> : <div className="space-y-2.5">{groups.map((item, index) => <MobileListCard key={item.storeId} title={item.storeName} subtitle={item.code ?? "ไม่มี Store ID"} leading={<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--app-surface-subtle)] text-xs font-bold">#{index + 1}</span>} trailing={<span className="text-base font-bold">{item.clicks}</span>}><div className="grid grid-cols-3 gap-2"><MiniStat label="Links" value={`${item.active}/${item.links}`} /><MiniStat label="Clicks" value={item.clicks} /><MiniStat label="Adds" value={item.confirmed} /></div></MobileListCard>)}</div>}</MobileSection>; }

function Setup({ configs, onOpen, canEdit }: { configs: FriendAttributionConfigDto[]; onOpen: (config: FriendAttributionConfigDto) => void; canEdit: boolean }) { return <MobileSection title="Attribution Setup" description="LINE Login + LIFF ต่อ LINE OA">{configs.length === 0 ? <MobileEmptyState title="ยังไม่มี Attribution config" /> : <div className="space-y-2.5">{configs.map((config) => <button key={config.lineOaId} type="button" disabled={!canEdit} onClick={() => onOpen(config)} className="block w-full text-left disabled:cursor-default"><MobileListCard title={config.lineOaName} subtitle={config.storeName ?? config.storeCode ?? "ไม่มีร้าน"} trailing={<span className={`rounded-full px-2 py-1 text-[9px] font-bold ${config.isConfigured && config.isEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{config.isConfigured ? config.isEnabled ? "READY" : "OFF" : "SETUP"}</span>}><p className="text-[10px] text-[var(--app-text-tertiary)]">Channel: {config.lineLoginChannelId ?? "—"} · LIFF: {config.liffId ?? "—"}</p></MobileListCard></button>)}</div>}</MobileSection>; }

function MiniStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-[var(--app-surface-subtle)] px-2 py-2"><p className="text-[9px] text-[var(--app-text-tertiary)]">{label}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p></div>; }
