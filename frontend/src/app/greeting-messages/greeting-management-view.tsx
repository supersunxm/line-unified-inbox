"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { GreetingTemplate, GreetingTemplateStatus } from "@/types/api";

type StatusFilter = "ALL" | GreetingTemplateStatus;

type PreviewableBlock = {
  type?: string;
  imageUrl?: string;
  previewUrl?: string;
  textTemplate?: string;
  richMessageName?: string;
  altText?: string;
};

const statusStyles: Record<GreetingTemplateStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DRAFT: "border-sky-200 bg-sky-50 text-sky-700",
  INACTIVE: "border-rose-200 bg-rose-50 text-rose-700",
  ARCHIVED: "border-gray-200 bg-gray-100 text-gray-600",
};

const statusLabels: Record<GreetingTemplateStatus, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function getBlocks(template: GreetingTemplate): PreviewableBlock[] {
  const messages = (template.messages || template.contentJson?.messages || []) as unknown as PreviewableBlock[];
  return Array.isArray(messages) ? messages : [];
}

function getThumbnail(template: GreetingTemplate) {
  const blocks = getBlocks(template);
  return blocks.find((block) => block.previewUrl || block.imageUrl)?.previewUrl ||
    blocks.find((block) => block.previewUrl || block.imageUrl)?.imageUrl ||
    null;
}

function getPreviewText(template: GreetingTemplate) {
  const blocks = getBlocks(template);
  const text = blocks.find((block) => block.type === "TEXT" && block.textTemplate)?.textTemplate?.trim();
  if (text) return text;
  const rich = blocks.find((block) => block.type === "RICH_MESSAGE");
  return rich?.richMessageName || rich?.altText || template.description || "Greeting Message";
}

export function GreetingManagementView() {
  const [templates, setTemplates] = useState<GreetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, draft, inactive, archived] = await Promise.all([
        api.listGreetingTemplates({ status: "ACTIVE" }),
        api.listGreetingTemplates({ status: "DRAFT" }),
        api.listGreetingTemplates({ status: "INACTIVE" }),
        api.listGreetingTemplates({ status: "ARCHIVED" }),
      ]);
      const merged = [...active, ...draft, ...inactive, ...archived].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setTemplates(merged);
      setSelectedId((current) => current && merged.some((item) => item.id === current) ? current : merged[0]?.id || null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "ไม่สามารถโหลดข้อมูล Greeting Message ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    ACTIVE: templates.filter((item) => item.status === "ACTIVE").length,
    DRAFT: templates.filter((item) => item.status === "DRAFT").length,
    INACTIVE: templates.filter((item) => item.status === "INACTIVE").length,
    ARCHIVED: templates.filter((item) => item.status === "ARCHIVED").length,
  }), [templates]);

  const activeStores = useMemo(
    () => templates.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + item.assignedStoreCount, 0),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q);
    });
  }, [templates, search, statusFilter]);

  const selected = templates.find((item) => item.id === selectedId) || filtered[0] || null;

  const changeStatus = async (template: GreetingTemplate, action: "activate" | "deactivate" | "archive") => {
    if (action === "archive" && !window.confirm(`จัดเก็บ “${template.name}” เป็นประวัติ?`)) return;
    setBusyId(template.id);
    setError(null);
    try {
      if (action === "activate") await api.activateGreetingTemplate(template.id);
      if (action === "deactivate") await api.deactivateGreetingTemplate(template.id);
      if (action === "archive") await api.archiveGreetingTemplate(template.id);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const cards: Array<{ status: GreetingTemplateStatus; title: string; subtitle: string; accent: string }> = [
    { status: "ACTIVE", title: "Active", subtitle: `ใช้งานอยู่ใน ${activeStores} ร้าน`, accent: "bg-emerald-50" },
    { status: "DRAFT", title: "Draft", subtitle: "ยังไม่ได้ใช้งาน", accent: "bg-sky-50" },
    { status: "INACTIVE", title: "Inactive", subtitle: "ปิดการใช้งาน", accent: "bg-rose-50" },
    { status: "ARCHIVED", title: "Archived", subtitle: "เก็บไว้เป็นประวัติ", accent: "bg-gray-100" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[226px] shrink-0 border-r border-gray-200 bg-white xl:flex xl:flex-col">
          <div className="border-b border-gray-100 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">LINE</div>
              <div>
                <div className="text-sm font-bold">OPPO LINE OA Monitor</div>
                <div className="text-xs text-gray-500">Retail Operations</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-5 text-sm">
            <Link href="/" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">⌂ หน้าหลัก</Link>
            <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">▦ แดชบอร์ด</Link>
            <Link href="/chats" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">◫ แชททั้งหมด</Link>
            <div className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">จัดการสื่อและเมนู</div>
            <Link href="/rich-menus" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">▤ Rich Menu</Link>
            <Link href="/rich-messages" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">▱ Rich Message</Link>
            <Link href="/greeting-messages/manage" className="block rounded-lg bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">▣ Greeting Message</Link>
            <Link href="/auto-responses" className="block rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50">↻ ข้อความตอบกลับอัตโนมัติ</Link>
          </nav>
          <div className="border-t border-gray-100 p-4">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">S</div>
              <div><div className="text-sm font-semibold">Sunn</div><div className="text-xs text-gray-500">Retail Operations</div></div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 lg:p-7">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Greeting Message</h1>
                <p className="mt-1 text-sm text-gray-500">จัดการข้อความต้อนรับสำหรับทุกสาขาในที่เดียว</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/greeting-messages" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">เปิด Builder</Link>
                <Link href="/greeting-messages" className="rounded-lg bg-[#06c755] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#05b34c]">＋ สร้าง Greeting Message</Link>
              </div>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <button key={card.status} type="button" onClick={() => setStatusFilter(statusFilter === card.status ? "ALL" : card.status)} className={`rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${statusFilter === card.status ? "border-[#06c755] ring-1 ring-[#06c755]/20" : "border-gray-200"} bg-white`}>
                  <div className={`rounded-lg ${card.accent} p-4`}>
                    <div className="text-sm font-semibold">{card.title}</div>
                    <div className="mt-1 text-3xl font-bold">{counts[card.status]}</div>
                    <div className="mt-1 text-xs text-gray-500">{card.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_310px]">
              <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อข้อความหรือเนื้อหา..." className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#06c755]" />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm">
                      <option value="ALL">สถานะทั้งหมด</option>
                      <option value="ACTIVE">Active</option>
                      <option value="DRAFT">Draft</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                  <div className="text-xs text-gray-500">{filtered.length} รายการ</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[930px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                      <tr>
                        <th className="px-4 py-3">ชื่อข้อความ</th>
                        <th className="px-4 py-3">ตัวอย่าง</th>
                        <th className="px-4 py-3">สถานะ</th>
                        <th className="px-4 py-3">ร้านที่ใช้</th>
                        <th className="px-4 py-3">ครั้งล่าสุดที่ Active</th>
                        <th className="px-4 py-3">อัปเดตล่าสุด</th>
                        <th className="px-4 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loading ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">กำลังโหลด...</td></tr>
                      ) : filtered.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">ไม่พบ Greeting Message</td></tr>
                      ) : filtered.map((template) => {
                        const thumb = getThumbnail(template);
                        const isSelected = selected?.id === template.id;
                        const previouslyActive = template.status !== "ACTIVE" && Boolean(template.activatedAt);
                        return (
                          <tr key={template.id} onClick={() => setSelectedId(template.id)} className={`cursor-pointer transition hover:bg-gray-50 ${isSelected ? "bg-emerald-50/60" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{template.name}</div>
                              <div className="mt-1 max-w-[220px] truncate text-xs text-gray-500">{template.description || getPreviewText(template)}</div>
                            </td>
                            <td className="px-4 py-3">
                              {thumb ? <img src={thumb} alt="" className="h-16 w-20 rounded-lg border border-gray-200 object-cover" /> : <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-gray-900 to-gray-600 px-2 text-center text-[10px] font-semibold text-white">{template.name}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[template.status]}`}><span className="text-[9px]">●</span>{statusLabels[template.status]}</span>
                                {previouslyActive && <span className="text-[10px] font-medium text-amber-600">เคย Active</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-700">{template.assignedStoreCount || 0} ร้าน</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{formatDate(template.activatedAt, true)}</td>
                            <td className="px-4 py-3 text-xs text-gray-600">{formatDate(template.updatedAt, true)}</td>
                            <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <Link href="/greeting-messages" className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">แก้ไข</Link>
                                {template.status === "ACTIVE" ? (
                                  <button type="button" disabled={busyId === template.id} onClick={() => void changeStatus(template, "deactivate")} className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Deactivate</button>
                                ) : template.status !== "ARCHIVED" ? (
                                  <button type="button" disabled={busyId === template.id} onClick={() => void changeStatus(template, "activate")} className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Activate</button>
                                ) : null}
                                {template.status !== "ARCHIVED" && <button type="button" disabled={busyId === template.id} onClick={() => void changeStatus(template, "archive")} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50">•••</button>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="rounded-xl border border-gray-200 bg-white shadow-sm 2xl:sticky 2xl:top-5 2xl:self-start">
                {selected ? (
                  <>
                    <div className="border-b border-gray-100 p-4">
                      <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">ตัวอย่างข้อความ</h2><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[selected.status]}`}>{statusLabels[selected.status]}</span></div>
                      {getThumbnail(selected) ? (
                        <img src={getThumbnail(selected) || ""} alt="" className="aspect-square w-full rounded-xl border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 p-6 text-center text-xl font-bold text-white">{selected.name}</div>
                      )}
                    </div>
                    <div className="space-y-3 border-b border-gray-100 p-4 text-sm">
                      <div className="flex justify-between gap-3"><span className="text-gray-500">ชื่อข้อความ</span><span className="text-right font-semibold">{selected.name}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500">ร้านที่ใช้งาน</span><span className="font-semibold">{selected.assignedStoreCount} ร้าน</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500">เวอร์ชัน</span><span className="font-semibold">v{selected.version}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500">สร้างเมื่อ</span><span className="text-right text-xs">{formatDate(selected.createdAt, true)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-gray-500">อัปเดตล่าสุด</span><span className="text-right text-xs">{formatDate(selected.updatedAt, true)}</span></div>
                    </div>
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">ประวัติการใช้งาน</h3><span className="text-[11px] text-gray-400">จากสถานะที่บันทึกไว้</span></div>
                      <div className="space-y-4 border-l border-gray-200 pl-4 text-xs">
                        <div className="relative"><span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-gray-400 ring-4 ring-white"/><div className="font-semibold">สร้างข้อความ</div><div className="mt-0.5 text-gray-500">{formatDate(selected.createdAt, true)}</div></div>
                        {selected.activatedAt && <div className="relative"><span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-white"/><div className="font-semibold text-emerald-700">เปิดใช้งานล่าสุด</div><div className="mt-0.5 text-gray-500">{formatDate(selected.activatedAt, true)}</div></div>}
                        {selected.status === "INACTIVE" && <div className="relative"><span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-white"/><div className="font-semibold">ปัจจุบันปิดใช้งาน</div><div className="mt-0.5 text-gray-500">อัปเดต {formatDate(selected.updatedAt, true)}</div></div>}
                        {selected.archivedAt && <div className="relative"><span className="absolute -left-[21px] top-0.5 h-2.5 w-2.5 rounded-full bg-gray-500 ring-4 ring-white"/><div className="font-semibold">จัดเก็บเป็นประวัติ</div><div className="mt-0.5 text-gray-500">{formatDate(selected.archivedAt, true)}</div></div>}
                      </div>
                      <Link href="/greeting-messages" className="mt-5 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">เปิดใน Builder</Link>
                    </div>
                  </>
                ) : <div className="p-8 text-center text-sm text-gray-400">เลือก Greeting Message เพื่อดูรายละเอียด</div>}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
