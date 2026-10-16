"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { LineOfficialAccountResponse } from "@/types/api";

type Props = {
  language?: string;
  selectedOaIds: ReadonlySet<string> | readonly string[];
  onSelectionChange: (ids: string[]) => void;
};

/**
 * Read-only account eligibility preview for unsaved templates.
 * Full template-specific readiness still comes from /:id/readiness after saving.
 * Selection here is local and does not publish, assign, or send LINE messages.
 */
export function OAStoreCandidatesPreview({
  language = "th",
  selectedOaIds,
  onSelectionChange,
}: Props) {
  const [accounts, setAccounts] = useState<LineOfficialAccountResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.lineOfficialAccounts(false)
      .then((data) => {
        if (!cancelled) setAccounts(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => new Set(selectedOaIds), [selectedOaIds]);
  const candidates = useMemo(
    () => accounts.filter((oa) =>
      oa.isActive && !oa.archivedAt && Boolean(oa.store?.id) && oa.hasChannelAccessToken,
    ).sort((a, b) => a.store.name.localeCompare(b.store.name, "th")),
    [accounts],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return candidates;
    return candidates.filter((oa) =>
      [oa.store.name, oa.store.code || "", oa.name, oa.store.province || ""]
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [candidates, query]);

  const isEn = language === "en";
  const isZh = language === "zh";
  const copy = {
    title: isEn ? "LINE OA accounts available for preliminary selection" : isZh ? "可预选的 LINE OA 门店" : "ร้าน LINE OA ที่เลือกเบื้องต้นได้",
    note: isEn
      ? "This is only a preliminary account check (active, linked to a store and has a channel token). Save the template to verify content-specific readiness. Selections are not published or assigned automatically."
      : isZh
        ? "仅检查门店账户状态和访问令牌。保存模板后才能验证具体内容是否可发布。此处选择不会自动发布或分配。"
        : "รายการนี้ตรวจเพียงบัญชีที่เปิดใช้งาน ผูกกับร้าน และมี Channel Access Token ยังไม่ใช่ผลตรวจความพร้อมของเทมเพลต ต้องบันทึกเทมเพลตก่อนจึงตรวจได้ การเลือกตรงนี้ยังไม่เผยแพร่หรือผูกกับร้านโดยอัตโนมัติ",
    search: isEn ? "Find a store or LINE OA..." : isZh ? "搜索门店或 LINE OA..." : "ค้นหารหัสร้าน ชื่อร้าน หรือ LINE OA...",
    selectAll: isEn ? "Select all candidates" : isZh ? "选择全部候选门店" : "เลือกบัญชีที่เข้าเกณฑ์ทั้งหมด",
    clear: isEn ? "Clear" : isZh ? "清除" : "ล้างการเลือก",
    loading: isEn ? "Loading accounts..." : isZh ? "正在加载账户..." : "กำลังโหลดบัญชีร้าน...",
    noResults: isEn ? "No accounts match the search." : isZh ? "未找到匹配账户" : "ไม่พบบัญชีร้านตามเงื่อนไข",
    selected: isEn ? "Selected" : isZh ? "已选择" : "เลือกแล้ว",
    candidates: isEn ? "Preliminary candidates" : isZh ? "候选门店" : "บัญชีเบื้องต้น",
    more: isEn ? "Narrow the search to see more." : isZh ? "请缩小搜索范围" : "ค้นหาชื่อหรือรหัสร้านเพื่อดูรายการอื่น",
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange([...next]);
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/20">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{copy.title}</h3>
      <p className="leading-relaxed text-amber-900 dark:text-amber-200">{copy.note}</p>
      {loading ? (
        <p className="text-gray-600">{copy.loading}</p>
      ) : error ? (
        <p role="alert" className="text-red-700">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {copy.candidates}: {candidates.length} · {copy.selected}: {candidates.filter((oa) => selected.has(oa.id)).length}
            </span>
            <div className="flex gap-3">
              <button type="button" className="font-semibold text-emerald-700 underline" onClick={() => onSelectionChange(candidates.map((oa) => oa.id))}>{copy.selectAll}</button>
              <button type="button" className="text-gray-600 underline" onClick={() => onSelectionChange([])}>{copy.clear}</button>
            </div>
          </div>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search} className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900" />
          <div className="max-h-56 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2 dark:bg-gray-900">
            {filtered.length === 0 ? <p className="p-2 text-gray-500">{copy.noResults}</p> :
              filtered.slice(0, 60).map((oa) => (
                <label key={oa.id} className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input type="checkbox" checked={selected.has(oa.id)} onChange={() => toggle(oa.id)} />
                  <span className="text-gray-800 dark:text-gray-200">{oa.store.name} ({oa.store.code || "—"})</span>
                  <span className="ml-auto text-gray-500">{oa.name}</span>
                </label>
              ))}
          </div>
          {filtered.length > 60 && <p className="text-gray-600">{copy.more}</p>}
        </>
      )}
    </div>
  );
}
