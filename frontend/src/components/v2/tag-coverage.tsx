"use client";

import React from "react";
import { TAG_TYPE_LABELS, tagCoverageView, UNREAD_NAMES_LABEL, type TagCoverageCounts } from "@/lib/v2/tag-coverage";
import { rateState } from "@/lib/v2/value-state";
import { useV2Month } from "./v2-month-data";
import { StateValue } from "./v2-ui";

const dateTime = (value: string) => new Date(value).toLocaleString("th-TH-u-ca-gregory", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

/** Where the tags come from and when they were last updated, or that the first read-back is still running. */
export function useTagCoverageNote(): string | null {
  const { tagCoverage } = useV2Month();
  if (tagCoverage.error) return `โหลดความครบของแท็กไม่สำเร็จ: ${tagCoverage.error}`;
  if (!tagCoverage.data) return null;
  if (!tagCoverage.data.rederiveComplete) return "ระบบกำลังอ่านแท็กจากชื่อลูกค้าย้อนหลังครั้งแรก ตัวเลขความครบของแท็กยังไม่ครบ";
  return `แท็กอ่านจากชื่อลูกค้าใน LINE OA Manager${tagCoverage.data.updatedAt ? ` · อัปเดต ${dateTime(tagCoverage.data.updatedAt)}` : ""}`;
}

/**
 * Table cell: share of read names with ≥ 1 tag, and how many names were read.
 * A store whose names were never read says "ยังไม่ได้อ่านชื่อ", never 0%.
 */
export function TagCoverageCell({ counts }: { counts: TagCoverageCounts | undefined }) {
  const { tagCoverage } = useV2Month();
  if (!tagCoverage.data) {
    const reason = tagCoverage.error ? `โหลดไม่สำเร็จ: ${tagCoverage.error}` : "กำลังโหลด";
    return <span title={reason} className="text-[var(--app-text-secondary)]">{tagCoverage.error ? "—" : "…"}<span className="sr-only"> ({reason})</span></span>;
  }
  const view = tagCoverageView(counts ?? null);
  if (!view || view.kind === "no-chats") return <span title="ไม่มีแชทเดือนนี้" className="text-[var(--app-text-secondary)]">—<span className="sr-only"> (ไม่มีแชทเดือนนี้)</span></span>;
  if (view.kind === "unread") return <span data-v2-tag-unread className="whitespace-nowrap text-xs text-[var(--app-text-secondary)]">{UNREAD_NAMES_LABEL}</span>;
  return (
    <span className="block whitespace-nowrap" data-v2-tag-coverage>
      <StateValue state={view.tagged} format="percent" />
      <span className="block text-[11px] text-[var(--app-text-secondary)]">อ่านชื่อ {view.read.toLocaleString("th-TH")}/{view.total.toLocaleString("th-TH")}</span>
    </span>
  );
}

/** Drawer section: coverage of the store's month, and which tag types the names carry. */
export function TagCoverageDetail({ counts }: { counts: TagCoverageCounts | undefined }) {
  const { tagCoverage } = useV2Month();
  const note = useTagCoverageNote();
  if (!tagCoverage.data) return <p className="text-xs text-[var(--app-text-secondary)]">{note ?? "กำลังโหลด…"}</p>;
  const view = tagCoverageView(counts ?? null);
  if (!view || view.kind === "no-chats") return <p className="text-xs text-[var(--app-text-secondary)]">ไม่มีแชทเดือนนี้</p>;
  if (view.kind === "unread") {
    return (
      <>
        <p data-v2-tag-unread className="text-sm font-medium">{UNREAD_NAMES_LABEL}</p>
        <p className="text-xs text-[var(--app-text-secondary)]">ระบบยังไม่ได้อ่านชื่อลูกค้าของ {view.total.toLocaleString("th-TH")} แชทนี้จาก LINE OA Manager จึงยังบอกไม่ได้ว่ามีแท็กหรือไม่{note ? ` · ${note}` : ""}</p>
      </>
    );
  }
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">มีแท็กอย่างน้อย 1 อย่าง</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={view.tagged} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{counts!.tagged.toLocaleString("th-TH")} จาก {view.read.toLocaleString("th-TH")} ชื่อ</dd>
        </div>
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">มีเดือนที่ซื้อ (MM/YY)</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={view.withPeriod} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{counts!.withPeriod.toLocaleString("th-TH")} จาก {view.read.toLocaleString("th-TH")} ชื่อ</dd>
        </div>
        <div className="rounded-[var(--app-radius-md)] border border-[var(--app-border)] p-3">
          <dt className="text-[var(--app-text-secondary)]">อ่านชื่อแล้ว</dt>
          <dd className="mt-1 text-lg font-semibold"><StateValue state={rateState(view.read, view.total)} format="percent" /></dd>
          <dd className="text-[var(--app-text-secondary)]">{view.read.toLocaleString("th-TH")} จาก {view.total.toLocaleString("th-TH")} แชท</dd>
        </div>
      </dl>
      <table data-v2-tag-types className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">ชนิดแท็ก</caption>
        <thead className="text-[11px] text-[var(--app-text-secondary)]">
          <tr className="border-b border-[var(--app-border)]">
            <th scope="col" className="px-3 py-1.5 font-medium">ชนิดแท็ก</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">ชื่อ</th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">% ของชื่อที่อ่านแล้ว</th>
          </tr>
        </thead>
        <tbody>
          {TAG_TYPE_LABELS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row" className="px-3 py-1 font-normal">{label}</th>
              <td className="px-3 py-1 text-right tabular-nums">{counts!.byType[key].toLocaleString("th-TH")}</td>
              <td className="px-3 py-1 text-right"><StateValue state={rateState(counts!.byType[key], view.read)} format="percent" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--app-text-secondary)]">นับเฉพาะแชทที่ระบบอ่านชื่อลูกค้าได้แล้ว · ชื่อหนึ่งมีได้หลายชนิดแท็ก{note ? ` · ${note}` : ""}</p>
    </>
  );
}
