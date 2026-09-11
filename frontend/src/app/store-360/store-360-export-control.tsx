"use client";

import { useMemo, useRef, useState } from "react";
import type { ApiStore } from "@/types/api";
import { downloadStore360Export } from "./store-360-export";
import type { AppLanguage } from "../language";

const MAX_STORES = 10;

export function Store360ExportControl({ stores, selectedStoreId, startDate, endDate, language }: {
  stores: ApiStore[];
  selectedStoreId: string;
  startDate: string;
  endDate: string;
  language: AppLanguage;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const downloadingRef = useRef(false);
  const text = language === "th"
    ? {
        button: "ดาวน์โหลดข้อมูล",
        title: "ดาวน์โหลดข้อมูล Store 360",
        description: "เลือกสาขาที่ต้องการส่งออกข้อมูลในช่วงวันที่ที่กำลังดูอยู่",
        stores: "สาขา",
        search: "ค้นหาสาขา...",
        selected: (count: number) => `เลือกแล้ว ${count} สาขา`,
        limit: `เลือกได้สูงสุด ${MAX_STORES} สาขาต่อไฟล์`,
        cancel: "ยกเลิก",
        download: "ดาวน์โหลดข้อมูล",
        downloading: "กำลังสร้างไฟล์...",
        noStores: "ไม่พบสาขา",
        selectStore: "เลือกอย่างน้อย 1 สาขา",
        tooMany: `เลือกได้สูงสุด ${MAX_STORES} สาขาต่อไฟล์`,
        failed: "สร้างไฟล์ไม่สำเร็จ",
      }
    : {
        button: "Export Data",
        title: "Export Store 360 data",
        description: "Choose stores for the date range currently shown in Store 360.",
        stores: "Stores",
        search: "Search stores...",
        selected: (count: number) => `${count} stores selected`,
        limit: `Up to ${MAX_STORES} stores per file`,
        cancel: "Cancel",
        download: "Export Data",
        downloading: "Preparing file...",
        noStores: "No stores found",
        selectStore: "Select at least one store",
        tooMany: `Up to ${MAX_STORES} stores per file`,
        failed: "Export failed",
      };

  const filteredStores = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return stores;
    return stores.filter((store) => `${store.storeId ?? ""} ${store.code ?? ""} ${store.name}`.toLocaleLowerCase().includes(query));
  }, [search, stores]);

  const openDialog = () => {
    setSelectedIds(selectedStoreId ? [selectedStoreId] : []);
    setSearch("");
    setError(null);
    setOpen(true);
  };

  const toggleStore = (storeId: string) => {
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(storeId)) return current.filter((id) => id !== storeId);
      if (current.length >= MAX_STORES) {
        setError(text.tooMany);
        return current;
      }
      return [...current, storeId];
    });
  };

  const handleDownload = async () => {
    if (downloadingRef.current) return;
    if (selectedIds.length === 0) {
      setError(text.selectStore);
      return;
    }
    downloadingRef.current = true;
    setDownloading(true);
    setError(null);
    try {
      await downloadStore360Export({ storeIds: selectedIds, startDate, endDate });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.failed);
    } finally {
      downloadingRef.current = false;
      setDownloading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={openDialog} disabled={!selectedStoreId || downloading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {downloading ? <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>}
        {text.button}
      </button>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="store-360-export-title">
        <div className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="store-360-export-title" className="text-lg font-semibold text-[var(--app-text-primary)]">{text.title}</h2><p className="mt-1 text-sm text-[var(--app-text-secondary)]">{text.description}</p><p className="mt-1 text-xs text-[var(--app-text-tertiary)]">{startDate} → {endDate} · {text.limit}</p></div>
            <button type="button" onClick={() => setOpen(false)} disabled={downloading} aria-label="Close export dialog" className="rounded-lg px-2 py-1 text-xl leading-none text-[var(--app-text-tertiary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50">×</button>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[var(--app-text-primary)]">{text.stores}</span>
              <span className="text-xs text-[var(--app-text-tertiary)]">{text.selected(selectedIds.length)}</span>
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} aria-label={text.search} className="mb-2 h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-subtle)] px-3 text-sm text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)]" />
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--app-border)] p-2">
              {filteredStores.length === 0 ? (
                <p className="p-6 text-center text-sm text-[var(--app-text-tertiary)]">{text.noStores}</p>
              ) : (
                filteredStores.map((store) => (
                  <label key={store.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--app-surface-hover)]">
                    <input type="checkbox" checked={selectedIds.includes(store.id)} onChange={() => toggleStore(store.id)} disabled={downloading} className="h-4 w-4" />
                    <span className="min-w-0 text-sm text-[var(--app-text-primary)]">
                      <span className="font-medium">{store.code || store.storeId ? `${store.code || store.storeId} ` : ""}{store.name}</span>
                      <span className="block truncate text-xs text-[var(--app-text-tertiary)]">{store.id === selectedStoreId ? (language === "th" ? "สาขาที่กำลังดู" : "Currently selected") : ""}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p role="alert" className="mt-3 rounded-xl border border-[var(--app-danger)]/30 bg-[var(--app-danger)]/10 px-3 py-2 text-sm text-[var(--app-danger)]">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} disabled={downloading} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-medium text-[var(--app-text-primary)] hover:bg-[var(--app-surface-hover)] disabled:opacity-50">{text.cancel}</button><button type="button" onClick={() => void handleDownload()} disabled={downloading || selectedIds.length === 0} className="rounded-xl bg-[var(--app-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{downloading ? text.downloading : text.download}</button></div>
        </div>
      </div>}
    </>
  );
}
