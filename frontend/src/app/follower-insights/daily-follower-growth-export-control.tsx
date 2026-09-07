"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { ByStoreAccountRow } from "@/types/api";
import { getBkkDateStr } from "./follower-insights-utils";
import type { Language } from "./follower-insights-translations";
import { downloadDailyFollowerGrowthWorkbook } from "./daily-follower-growth-export";

export function DailyFollowerGrowthExportControl({ language = "en" }: { language?: Language }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(getBkkDateStr(start));
  const [dateTo, setDateTo] = useState(getBkkDateStr(today));
  const [stores, setStores] = useState<ByStoreAccountRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingStores(true);
    setError(null);
    api.followerInsightsByStore(dateFrom, dateTo)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, ByStoreAccountRow>();
        for (const row of rows) if (row.lineOaId && !map.has(row.lineOaId)) map.set(row.lineOaId, row);
        setStores(Array.from(map.values()).sort((a, b) => a.storeName.localeCompare(b.storeName)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load stores");
      })
      .finally(() => {
        if (!cancelled) setLoadingStores(false);
      });
    return () => { cancelled = true; };
  }, [open, dateFrom, dateTo]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((row) => {
      const id = row.masterStoreId || row.externalStoreId || row.storeId || "";
      return `${id} ${row.storeName} ${row.accountName}`.toLowerCase().includes(q);
    });
  }, [stores, search]);

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const text = language === "th"
    ? {
        button: "ดาวน์โหลด LINE OA รายวัน",
        title: "ดาวน์โหลดผู้ติดตาม LINE OA รายวัน",
        desc: "เลือกช่วงวันที่และสาขา ค่าในไฟล์คือจำนวนผู้ติดตามที่เพิ่ม/ลดในแต่ละวัน",
        from: "วันที่เริ่มต้น",
        to: "วันที่สิ้นสุด",
        stores: "สาขา",
        all: "ทุกสาขา",
        search: "ค้นหาสาขา...",
        selected: (count: number) => count ? `เลือกแล้ว ${count} สาขา` : "ไม่ได้เลือก = ทุกสาขา",
        cancel: "ยกเลิก",
        download: "ดาวน์โหลด Excel",
        downloading: "กำลังสร้างไฟล์...",
        loading: "กำลังโหลดสาขา...",
      }
    : {
        button: "Download Daily LINE OA",
        title: "Download daily LINE OA follower growth",
        desc: "Choose a date range and stores. Each cell is the follower increase/decrease for that day.",
        from: "From",
        to: "To",
        stores: "Stores",
        all: "All stores",
        search: "Search stores...",
        selected: (count: number) => count ? `${count} stores selected` : "No selection = all stores",
        cancel: "Cancel",
        download: "Download Excel",
        downloading: "Preparing file...",
        loading: "Loading stores...",
      };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadDailyFollowerGrowthWorkbook({ dateFrom, dateTo, selectedLineOaIds: selectedIds, language });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
        </svg>
        {text.button}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{text.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{text.desc}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--hover)]">×</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[var(--foreground)]">
                <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{text.from}</span>
                <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-2" />
              </label>
              <label className="text-sm text-[var(--foreground)]">
                <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{text.to}</span>
                <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-2" />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-[var(--foreground)]">{text.stores}</span>
                  <span className="ml-2 text-xs text-[var(--muted)]">{text.selected(selectedIds.length)}</span>
                </div>
                {selectedIds.length > 0 && <button type="button" onClick={() => setSelectedIds([])} className="text-xs font-medium text-emerald-600 hover:underline">{text.all}</button>}
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={text.search} className="mb-2 w-full rounded-xl border border-[var(--border)] bg-[var(--input-background)] px-3 py-2 text-sm" />
              <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {loadingStores ? (
                  <div className="p-6 text-center text-sm text-[var(--muted)]">{text.loading}</div>
                ) : filteredStores.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[var(--muted)]">—</div>
                ) : filteredStores.map((row) => {
                  const id = row.lineOaId;
                  const code = row.masterStoreId || row.externalStoreId || row.storeId || "";
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--hover)]">
                      <input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggle(id)} className="h-4 w-4" />
                      <span className="min-w-0 text-sm text-[var(--foreground)]"><span className="font-medium">{code ? `${code} ` : ""}{row.storeName}</span><span className="block truncate text-xs text-[var(--muted)]">{row.accountName}</span></span>
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={downloading} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover)] disabled:opacity-50">{text.cancel}</button>
              <button type="button" onClick={() => void handleDownload()} disabled={downloading || !dateFrom || !dateTo || dateTo < dateFrom} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{downloading ? text.downloading : text.download}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
