// The "คัดลอกสรุป" text: a short Thai plain-text summary to paste into LINE. Pure.

import { RESPONSE_RATE_TARGET_PERCENT } from "./business-hours.ts";
import type { GroupTotals, MonthStoreRow } from "./monthly-model.ts";
import { formatValue, numericValue, type ValueState } from "./value-state.ts";

export const OPEN_MONTH_NOTE = "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้";

function count(state: ValueState): string {
  return formatValue(state, "count").text;
}

function percent(state: ValueState): string {
  const formatted = formatValue(state, "percent");
  return state.kind === "low-sample" ? `${formatted.text} (n=${state.n})` : formatted.text;
}

function signed(state: ValueState, unit = ""): string | null {
  const value = numericValue(state);
  if (value === null) return null;
  if (value === 0) return "เท่าเดิม";
  const magnitude = unit ? Math.abs(value).toFixed(1) : Math.abs(value).toLocaleString("th-TH");
  return `${value > 0 ? "+" : "−"}${magnitude}${unit}`;
}

export function buildReportSummary(input: {
  /** "ต.ค. 2026". */
  monthLabel: string;
  /** "1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026". */
  periodText: string;
  /** "Partner TG", "สาขา …" or "ทุกสาขา". */
  scopeLabel: string;
  totals: GroupTotals;
  /** Stores in scope; the three with the most unreplied chats are named. */
  stores: MonthStoreRow[];
  inProgress: boolean;
}): string {
  const { totals } = input;
  const unrepliedDelta = signed(totals.unrepliedDelta);
  const rateDelta = signed(totals.rate24Delta, " จุด");
  const top = input.stores
    .filter((row) => (numericValue(row.unreplied) ?? 0) > 0)
    .sort((a, b) => (numericValue(b.unreplied) ?? 0) - (numericValue(a.unreplied) ?? 0) || a.storeName.localeCompare(b.storeName, "th"))
    .slice(0, 3);
  const lines = [
    `สรุปเดือน ${input.monthLabel} · ${input.scopeLabel}`,
    `ช่วง: ${input.periodText}`,
    `แชท ${count(totals.chats)} · ยังไม่ตอบ ${count(totals.unreplied)}${unrepliedDelta ? ` (${unrepliedDelta})` : ""}`,
    `ตอบแล้ว ${percent(totals.replyRate)} · ตอบใน 24 ชม. ${percent(totals.rate24)}${rateDelta ? ` (${rateDelta})` : ""} · เป้า ${RESPONSE_RATE_TARGET_PERCENT}%`,
    top.length > 0
      ? `ยังไม่ตอบมากสุด: ${top.map((row, index) => `${index + 1}) ${row.storeName} ${count(row.unreplied)} แชท`).join(" ")}`
      : "ไม่มีแชทที่ยังไม่ตอบ",
  ];
  if (input.inProgress) lines.push(OPEN_MONTH_NOTE);
  return lines.join("\n");
}
