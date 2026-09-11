"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OverviewStatus = "STANDARD" | "FALLBACK" | "NEEDS_ACTION" | "OUTDATED";
type RecommendedVariant = "STANDARD" | "NO_MAPS" | "NO_TIKTOK" | "BASIC";

type OverviewItem = {
  lineOfficialAccountId: string;
  lineOfficialAccountName: string;
  storeId: string | null;
  externalStoreId: string | null;
  storeName: string;
  province: string | null;
  region: string | null;
  googleMapsUrl: string | null;
  tiktokUrl: string | null;
  currentTemplateId: string | null;
  currentTemplateName: string | null;
  publishedTemplateVersion: number | null;
  currentTemplateVersion: number | null;
  lastPublishedAt: string | null;
  lastAttemptStatus: string | null;
  lastAttemptError: string | null;
  overviewStatus: OverviewStatus;
  recommendedVariant: RecommendedVariant;
  reason: string;
};

type OverviewResponse = {
  generatedAt: string;
  source: "LAST_PUBLISHED_ATTEMPT";
  summary: { total: number; standard: number; fallback: number; needsAction: number; outdated: number };
  items: OverviewItem[];
};

const statusLabel: Record<OverviewStatus, string> = {
  STANDARD: "Standard",
  FALLBACK: "Fallback",
  NEEDS_ACTION: "Needs Action",
  OUTDATED: "Outdated",
};

const variantLabel: Record<RecommendedVariant, string> = {
  STANDARD: "Standard",
  NO_MAPS: "No Maps",
  NO_TIKTOK: "No TikTok",
  BASIC: "Basic",
};

const badgeClass: Record<OverviewStatus, string> = {
  STANDARD: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FALLBACK: "bg-amber-50 text-amber-700 border-amber-200",
  NEEDS_ACTION: "bg-rose-50 text-rose-700 border-rose-200",
  OUTDATED: "bg-sky-50 text-sky-700 border-sky-200",
};

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function RichMenuOverviewView() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OverviewStatus | "ALL">("ALL");
  const [template, setTemplate] = useState("ALL");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api-backend/rich-menu/overview", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || `API request failed (${response.status})`);
      }
      setData(await response.json() as OverviewResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const templates = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.items.map((item) => item.currentTemplateName).filter((value): value is string => Boolean(value)))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.items.filter((item) => {
      const matchSearch = !q || [
        item.storeName,
        item.externalStoreId,
        item.lineOfficialAccountName,
        item.province,
        item.region,
        item.currentTemplateName,
        item.reason,
      ].some((value) => value?.toLowerCase().includes(q));
      const matchStatus = status === "ALL" || item.overviewStatus === status;
      const matchTemplate = template === "ALL" || item.currentTemplateName === template;
      return matchSearch && matchStatus && matchTemplate;
    });
  }, [data, search, status, template]);

  function exportCsv() {
    const headers = [
      "Store ID", "Store", "LINE OA", "Province", "Region", "Current Rich Menu", "Published Version",
      "Current Template Version", "Recommended Variant", "Google Maps", "TikTok", "Status", "Reason", "Last Published At",
      "Last Attempt Status", "Last Attempt Error",
    ];
    const rows = filtered.map((item) => [
      item.externalStoreId,
      item.storeName,
      item.lineOfficialAccountName,
      item.province,
      item.region,
      item.currentTemplateName,
      item.publishedTemplateVersion,
      item.currentTemplateVersion,
      variantLabel[item.recommendedVariant],
      item.googleMapsUrl ? "Available" : "Missing",
      item.tiktokUrl ? "Available" : "Missing",
      statusLabel[item.overviewStatus],
      item.reason,
      item.lastPublishedAt,
      item.lastAttemptStatus,
      item.lastAttemptError,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rich-menu-store-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const summaryCards = data ? [
    ["ร้านทั้งหมด", data.summary.total],
    ["Standard", data.summary.standard],
    ["Fallback", data.summary.fallback],
    ["Needs Action", data.summary.needsAction],
    ["Outdated", data.summary.outdated],
  ] : [];

  return (
    <main className="min-h-screen bg-[var(--app-bg)] px-4 py-6 text-[var(--app-text-primary)] md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm">
              <Link href="/rich-menus" className="font-medium text-[var(--app-accent)] hover:underline">Rich Menu</Link>
              <span className="text-[var(--app-text-secondary)]">/</span>
              <span className="text-[var(--app-text-secondary)]">ภาพรวมการใช้งาน</span>
            </div>
            <h1 className="text-2xl font-semibold">Rich Menu Store Overview</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--app-text-secondary)]">
              ดูว่าแต่ละร้านใช้ Rich Menu ใด เหตุผลที่ใช้รูปแบบนั้น และร้านใดควรใช้ fallback เพราะข้อมูล Google Maps หรือ TikTok ไม่ครบ
            </p>
            <p className="mt-2 text-xs text-[var(--app-text-secondary)]">
              อ้างอิงจากการ publish สำเร็จล่าสุดในระบบ ไม่ได้เรียก LINE API ใหม่สำหรับทุกร้านทุกครั้ง
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium hover:bg-[var(--app-surface-muted)]">รีเฟรช</button>
            <button type="button" onClick={exportCsv} disabled={!data || filtered.length === 0} className="rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Export CSV</button>
          </div>
        </div>

        {loading && <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-sm text-[var(--app-text-secondary)]">กำลังโหลดข้อมูล Rich Menu ของแต่ละร้าน…</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {data && !loading && (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {summaryCards.map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
                  <div className="text-xs text-[var(--app-text-secondary)]">{label}</div>
                  <div className="mt-1 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </section>

            <section className="mt-5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_240px_auto]">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาร้าน, Store ID, จังหวัด, Rich Menu…" className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]" />
                <select value={status} onChange={(event) => setStatus(event.target.value as OverviewStatus | "ALL")} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm">
                  <option value="ALL">ทุกสถานะ</option>
                  <option value="STANDARD">Standard</option>
                  <option value="FALLBACK">Fallback</option>
                  <option value="NEEDS_ACTION">Needs Action</option>
                  <option value="OUTDATED">Outdated</option>
                </select>
                <select value={template} onChange={(event) => setTemplate(event.target.value)} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm">
                  <option value="ALL">ทุก Rich Menu</option>
                  {templates.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
                <div className="flex items-center justify-end text-xs text-[var(--app-text-secondary)]">แสดง {filtered.length} / {data.summary.total} ร้าน</div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="overflow-x-auto">
                <table className="min-w-[1280px] w-full border-collapse text-left text-sm">
                  <thead className="bg-[var(--app-surface-muted)] text-xs text-[var(--app-text-secondary)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Store</th>
                      <th className="px-4 py-3 font-medium">Current Rich Menu</th>
                      <th className="px-4 py-3 font-medium">แนะนำ</th>
                      <th className="px-4 py-3 font-medium">Google Maps</th>
                      <th className="px-4 py-3 font-medium">TikTok</th>
                      <th className="px-4 py-3 font-medium">สถานะ</th>
                      <th className="px-4 py-3 font-medium">เหตุผล</th>
                      <th className="px-4 py-3 font-medium">Last Publish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.lineOfficialAccountId} className="border-t border-[var(--app-border)] align-top hover:bg-[var(--app-surface-muted)]/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.storeName}</div>
                          <div className="mt-0.5 text-xs text-[var(--app-text-secondary)]">{item.externalStoreId || "ไม่มี Store ID"} · {item.province || "ไม่ระบุจังหวัด"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.currentTemplateName || "—"}</div>
                          {item.publishedTemplateVersion != null && <div className="mt-0.5 text-xs text-[var(--app-text-secondary)]">Published v{item.publishedTemplateVersion}{item.currentTemplateVersion != null ? ` / Current v${item.currentTemplateVersion}` : ""}</div>}
                        </td>
                        <td className="px-4 py-3"><span className="rounded-md border border-[var(--app-border)] px-2 py-1 text-xs font-medium">{variantLabel[item.recommendedVariant]}</span></td>
                        <td className="px-4 py-3">{item.googleMapsUrl ? <span className="text-emerald-700">มี</span> : <span className="font-medium text-rose-600">ไม่มี</span>}</td>
                        <td className="px-4 py-3">{item.tiktokUrl ? <span className="text-emerald-700">มี</span> : <span className="font-medium text-rose-600">ไม่มี</span>}</td>
                        <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass[item.overviewStatus]}`}>{statusLabel[item.overviewStatus]}</span></td>
                        <td className="max-w-[360px] px-4 py-3 text-xs leading-5 text-[var(--app-text-secondary)]">{item.reason}{item.lastAttemptError ? <div className="mt-1 text-rose-600">ล่าสุด: {item.lastAttemptError}</div> : null}</td>
                        <td className="px-4 py-3 text-xs text-[var(--app-text-secondary)]">{item.lastPublishedAt ? new Date(item.lastPublishedAt).toLocaleString("th-TH") : "—"}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--app-text-secondary)]">ไม่พบร้านที่ตรงกับตัวกรอง</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
