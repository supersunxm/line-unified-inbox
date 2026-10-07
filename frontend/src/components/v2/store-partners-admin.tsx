"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { SearchInput, SectionCard, Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from "@/components/ui";
import { useAuthUserSnapshot } from "@/lib/auth-user-store";
import { sortPartnerNames, UNMATCHED_PARTNER, type StorePartnerRow } from "@/lib/v2/partners";
import { fetchStorePartners, useV2Month } from "./v2-month-data";
import { SourceNotice } from "./v2-ui";

type Change = { id: string; storeId: string; previousPartner: string | null; partnerName: string | null; source: string; actorName: string; reason: string | null; changedAt: string };

const dateTime = (value: string) => new Date(value).toLocaleString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

async function savePartner(storeId: string, partner: string | null, reason: string): Promise<void> {
  const response = await fetch(`/api-backend/v2/store-partners/${encodeURIComponent(storeId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner, reason: reason || undefined }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message ?? `บันทึกไม่สำเร็จ (${response.status})`);
  }
}

async function fetchChanges(): Promise<Change[]> {
  const response = await fetch("/api-backend/v2/store-partners/changes?limit=50", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`โหลดประวัติไม่สำเร็จ (${response.status})`);
  return ((await response.json()) as { changes: Change[] }).changes;
}

/** "Partner ของสาขา": Store ID → partner, editable by ADMIN; every change records actor and time. */
export function StorePartnersAdmin() {
  const { user } = useAuthUserSnapshot();
  const monthData = useV2Month();
  const isAdmin = user?.role === "ADMIN";
  const [rows, setRows] = useState<StorePartnerRow[] | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnset, setOnlyUnset] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, history] = await Promise.all([fetchStorePartners(), isAdmin ? fetchChanges() : Promise.resolve([])]);
      setRows(list);
      setChanges(history);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const partners = useMemo(() => sortPartnerNames((rows ?? []).map((row) => row.partner).filter((value): value is string => Boolean(value))), [rows]);
  const unsetCount = (rows ?? []).filter((row) => !row.partner).length;
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th");
    return (rows ?? []).filter((row) => (!onlyUnset || !row.partner) && (!query || `${row.storeId ?? ""} ${row.storeName} ${row.partner ?? ""}`.toLocaleLowerCase("th").includes(query)));
  }, [onlyUnset, rows, search]);

  const save = async (row: StorePartnerRow) => {
    if (!row.storeId) return;
    const value = (drafts[row.storeUuid] ?? row.partner ?? "").trim();
    setSaving(row.storeUuid);
    setMessage(null);
    try {
      await savePartner(row.storeId, value || null, "");
      setDrafts((previous) => { const next = { ...previous }; delete next[row.storeUuid]; return next; });
      setMessage(`บันทึกแล้ว: ${row.storeName} → ${value || UNMATCHED_PARTNER}`);
      await load();
      monthData.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <PageHeader title="Partner ของสาขา" description="partner ผูกกับ Store ID ของสาขา (ไม่อ่านจากชื่อร้าน) · ทุกการแก้ไขบันทึกผู้แก้และเวลา · สาขาที่ไม่มี partner แสดงเป็น “ไม่ระบุ partner” ในทุกหน้า v2" />
      <div className="space-y-4">
        {error && <SourceNotice>{error}</SourceNotice>}
        {!isAdmin && <SourceNotice>ดูได้อย่างเดียว · เฉพาะผู้ดูแลระบบ (ADMIN) แก้ไข partner ได้</SourceNotice>}
        {message && <p role="status" className="text-sm text-[var(--app-text-secondary)]">{message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--app-text-secondary)]">
            <input type="checkbox" data-v2-partner-unset-filter checked={onlyUnset} onChange={(event) => setOnlyUnset(event.target.checked)} />
            เฉพาะสาขาที่ยังไม่ระบุ ({unsetCount})
          </label>
          <div className="ml-auto w-80"><SearchInput value={search} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} placeholder="ค้นหา Store ID / ชื่อสาขา / partner" /></div>
        </div>
        <datalist id="v2-partner-names">{partners.map((name) => <option key={name} value={name} />)}</datalist>
        <SectionCard title="สาขา" meta={rows ? `${visible.length} จาก ${rows.length} สาขา · ${partners.length} partner` : "กำลังโหลด…"} bodyPadding="none">
          <div className="overflow-x-auto">
            <Table data-v2-partner-admin>
              <TableHeader>
                <tr>
                  <TableHead scope="col">Store ID</TableHead>
                  <TableHead scope="col">สาขา</TableHead>
                  <TableHead scope="col">Partner</TableHead>
                  <TableHead scope="col">แก้ไขล่าสุด</TableHead>
                  {isAdmin && <TableHead scope="col"><span className="sr-only">บันทึก</span></TableHead>}
                </tr>
              </TableHeader>
              <TableBody>
                {!rows ? null : visible.length === 0 ? (
                  <TableEmptyState colSpan={isAdmin ? 5 : 4} message="ไม่พบสาขาตามตัวกรองนี้" />
                ) : visible.map((row) => {
                  const draft = drafts[row.storeUuid];
                  const dirty = draft !== undefined && draft.trim() !== (row.partner ?? "");
                  return (
                    <TableRow key={row.storeUuid} data-v2-partner-row={row.storeId ?? row.storeUuid}>
                      <TableCell numeric>{row.storeId ?? <span title="สาขานี้ไม่มี Store ID จึงผูก partner ไม่ได้" className="text-[var(--app-text-secondary)]">ไม่มี Store ID</span>}</TableCell>
                      <th scope="row" className="px-4 py-3 text-left text-xs font-medium">{row.storeName}</th>
                      <TableCell>
                        {isAdmin && row.storeId ? (
                          <input
                            aria-label={`Partner ของ ${row.storeName}`}
                            list="v2-partner-names"
                            value={draft ?? row.partner ?? ""}
                            placeholder={UNMATCHED_PARTNER}
                            onChange={(event) => setDrafts((previous) => ({ ...previous, [row.storeUuid]: event.target.value }))}
                            className="h-8 w-48 rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-surface)] px-2 text-xs text-[var(--app-text-primary)]"
                          />
                        ) : (
                          <span className={row.partner ? "" : "text-[var(--app-text-secondary)]"}>{row.partner ?? UNMATCHED_PARTNER}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[var(--app-text-secondary)]">{row.updatedAt ? `${row.updatedByName ?? "—"} · ${dateTime(row.updatedAt)}` : "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {/* Shown only for an unsaved change, so the table is not a column of disabled buttons. */}
                          {row.storeId && dirty && (
                            <button type="button" aria-busy={saving === row.storeUuid} onClick={() => { if (saving !== row.storeUuid) void save(row); }} className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] px-3 py-1 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] dark:text-[var(--app-success)]">
                              {saving === row.storeUuid ? "กำลังบันทึก…" : "บันทึก"}
                            </button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        {isAdmin && (
          <SectionCard title="ประวัติการแก้ไข" meta="50 รายการล่าสุด" bodyPadding="none">
            <div className="overflow-x-auto">
              <Table data-v2-partner-changes>
                <TableHeader>
                  <tr>
                    <TableHead scope="col">เวลา</TableHead>
                    <TableHead scope="col">Store ID</TableHead>
                    <TableHead scope="col">เดิม → ใหม่</TableHead>
                    <TableHead scope="col">ผู้แก้</TableHead>
                    <TableHead scope="col">ที่มา</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {changes.length === 0 ? <TableEmptyState colSpan={5} message="ยังไม่มีการแก้ไข" /> : changes.map((change) => (
                    <TableRow key={change.id}>
                      <TableCell>{dateTime(change.changedAt)}</TableCell>
                      <TableCell numeric>{change.storeId}</TableCell>
                      <TableCell>{change.previousPartner ?? UNMATCHED_PARTNER} → {change.partnerName ?? UNMATCHED_PARTNER}</TableCell>
                      <TableCell>{change.actorName}</TableCell>
                      <TableCell className="text-[var(--app-text-secondary)]">{change.source === "SEED" ? "ตั้งต้นจากชื่อร้าน" : "ผู้ดูแลระบบ"}{change.reason ? ` · ${change.reason}` : ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
