import { type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// The two official v2 KPIs and their targets (owner decision, 7 Oct 2026). Pure.
//   ตอบแล้ว %      — conversation status in the month, the /chats definition. Target not set yet.
//   ตอบใน 24 ชม. % — the /replymessage definition. Target 90%.

import { meetsSample, numericValue, type ValueState } from "./value-state.ts";

/** ตอบแล้ว % target. null = not set yet: no target colour, labelled NO_TARGET_LABEL. */
export const REPLIED_RATE_TARGET: number | null = null;
/** ตอบใน 24 ชม. % target, in percent (owner decision 7 Oct 2026). */
export const RATE24_TARGET_PERCENT = 90;
/** ตอบใน 24 ชม. % target. */
export const RATE24_TARGET: number | null = RATE24_TARGET_PERCENT;

export const NO_TARGET_LABEL = "ยังไม่กำหนดเป้า";

export type KpiKey = "replied" | "rate24";

export const KPI_TARGETS: Record<KpiKey, number | null> = { replied: REPLIED_RATE_TARGET, rate24: RATE24_TARGET };

/** One line each: how the KPI is counted (shown in a "นับยังไง" disclosure, not only a tooltip). */
export const KPI_HOW_COUNTED: Record<KpiKey, string> = {
  replied: "แชทที่ตอบแล้ว ÷ แชททั้งหมดของช่วงนี้ · แชทนับตามวันที่ของข้อความล่าสุด · ตอบแล้ว = ข้อความล่าสุดของลูกค้าได้รับคำตอบแล้ว (สถานะตอนนี้) · เหมือนหน้าแชทร้านค้า",
  rate24: "แชทที่ข้อความแรกของลูกค้าในช่วงนี้ได้รับคำตอบภายใน 24 ชม. ÷ แชทที่ลูกค้าทักมาในช่วงนี้ · นับตามวันที่ลูกค้าทักครั้งแรกในช่วง · เหมือนหน้าอัตราตอบกลับ 24 ชม.",
};

/** Why ตอบใน 24 ชม. can be higher than ตอบแล้ว % (one plain sentence for the UI). */
export const KPI_DIFFERENCE_NOTE = "ตอบใน 24 ชม. ดูแค่ข้อความแรกของลูกค้าในช่วงนี้ ส่วนตอบแล้ว % ดูข้อความล่าสุด แชทที่ตอบครั้งแรกทันแต่ลูกค้าทักมาใหม่แล้วยังไม่ได้ตอบ จึงนับเป็น “ตอบใน 24 ชม.” และ “ยังไม่ตอบ” พร้อมกัน";

export type TargetState =
  | { kind: "no-target" }
  | { kind: "unmeasured" }
  | { kind: "low-sample" }
  | { kind: "met"; target: number; gap: number }
  | { kind: "below"; target: number; gap: number };

/** A rate against its target. gap = target − value in points (positive = below target). */
export function targetState(value: ValueState, target: number | null): TargetState {
  if (target === null) return { kind: "no-target" };
  const number = numericValue(value);
  if (number === null) return { kind: "unmeasured" };
  if (!meetsSample(value)) return { kind: "low-sample" };
  const gap = Math.round((target - number) * 10) / 10;
  return gap > 0 ? { kind: "below", target, gap } : { kind: "met", target, gap };
}

/** "เป้า 90% · ต่ำกว่าเป้า 11.3 จุด" / "เป้า 90% · ถึงเป้า" / "ยังไม่กำหนดเป้า". */
export function targetLabel(state: TargetState, target: number | null, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  if (target === null || state.kind === "no-target") return t("noTarget");
  if (state.kind === "below") return t("targetBelow", { target, gap: state.gap.toFixed(1) });
  if (state.kind === "met") return t("targetMet", { target });
  if (state.kind === "low-sample") return t("targetSmallSample", { target });
  return t("targetOnly", { target });
}
