import { languageLocale, type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./v2-translations.ts";

// What a v2 number is, so the UI never shows 0 for "unknown" and every "—" has a reason.
// Pure: node --test imports it directly.

/** Rates below this many chats in the period are "low sample": muted, n shown, no target colour, sorted last. */
export const MIN_RATE_SAMPLE = 10;

export type ValueState =
  /** A measured, non-zero number (or a rate with enough sample). */
  | { kind: "value"; value: number; n?: number }
  /** Measured and really zero: the source loaded and counted nothing. */
  | { kind: "true-zero"; value: 0; n?: number }
  /** A rate whose denominator is 0: no chats in the period, so there is nothing to rate. */
  | { kind: "no-activity" }
  /** The system did not collect this (e.g. before reply-status coverage). */
  | { kind: "not-collected" }
  /** The source failed to load. */
  | { kind: "failed"; error?: string }
  /** The measure does not apply here. */
  | { kind: "not-applicable"; why?: string }
  /** A rate measured over fewer than MIN_RATE_SAMPLE chats. */
  | { kind: "low-sample"; value: number; n: number }
  /** A number from a source that is known to be out of date. */
  | { kind: "stale"; value: number; n?: number }
  /** Still loading. */
  | { kind: "loading" };

export type ValueKind = ValueState["kind"];

export const VALUE_REASONS: Record<Exclude<ValueKind, "value" | "true-zero">, string> = {
  "no-activity": "ไม่มีแชทในช่วงนี้",
  "not-collected": "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้",
  failed: "โหลดข้อมูลไม่สำเร็จ",
  "not-applicable": "ไม่ใช้กับรายการนี้",
  "low-sample": `แชทน้อยกว่า ${MIN_RATE_SAMPLE} แชท ใช้เทียบเป้าไม่ได้`,
  stale: "ข้อมูลอาจไม่เป็นปัจจุบัน",
  loading: "กำลังโหลด…",
};

export type SourceStatus = { loading?: boolean; error?: string | null; failed?: boolean; collected?: boolean };

function unavailable(source: SourceStatus): ValueState | null {
  if (source.collected === false) return { kind: "not-collected" };
  if (source.error) return { kind: "failed", error: source.error };
  if (source.failed) return { kind: "failed" };
  if (source.loading) return { kind: "loading" };
  return null;
}

/** A count from a source: 0 only when the source loaded and really counted 0. */
export function countState(value: number | null | undefined, source: SourceStatus = {}): ValueState {
  const blocked = unavailable(source);
  if (blocked) return blocked;
  if (value === null || value === undefined || !Number.isFinite(value)) return { kind: "failed" };
  return value === 0 ? { kind: "true-zero", value: 0 } : { kind: "value", value };
}

/**
 * A percentage numerator/denominator (one decimal). Denominator 0 → no activity (not 0%).
 * Denominator below minSample → low sample (the value is kept but muted).
 */
export function rateState(numerator: number | null | undefined, denominator: number | null | undefined, source: SourceStatus = {}, minSample = MIN_RATE_SAMPLE): ValueState {
  const blocked = unavailable(source);
  if (blocked) return blocked;
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) return { kind: "failed" };
  if (denominator <= 0) return { kind: "no-activity" };
  const value = Math.round((numerator / denominator) * 1000) / 10;
  if (denominator < minSample) return { kind: "low-sample", value, n: denominator };
  return value === 0 ? { kind: "true-zero", value: 0, n: denominator } : { kind: "value", value, n: denominator };
}

/** The number when the state carries one (value, true zero, low sample, stale); else null. */
export function numericValue(state: ValueState): number | null {
  return "value" in state ? state.value : null;
}

/** The sample size when known. */
export function sampleOf(state: ValueState): number | null {
  return "n" in state && typeof state.n === "number" ? state.n : null;
}

/** A rate can be coloured against its target only with enough sample. */
export function meetsSample(state: ValueState): boolean {
  return state.kind === "value" || state.kind === "true-zero";
}

/** Why a value is not a plain number, or null when it is. */
export function valueReason(state: ValueState, language: AppLanguage = "th"): string | null {
  const t = v2Text(language);
  const reasons = { "no-activity": t("noActivity"), "not-collected": t("notCollected"), failed: t("loadFailed"), "not-applicable": t("notApplicable"), "low-sample": t("lowSample", { count: MIN_RATE_SAMPLE }), stale: t("stale"), loading: t("loadingEllipsis") };
  if (state.kind === "value" || state.kind === "true-zero") return null;
  if (state.kind === "failed" && state.error) return `${reasons.failed}: ${state.error}`;
  if (state.kind === "not-applicable" && state.why) return state.why;
  if (state.kind === "low-sample") return `${reasons["low-sample"]} (n=${state.n})`;
  return reasons[state.kind];
}

export type FormattedValue = { text: string; reason: string | null; muted: boolean };

const formatCount = (value: number, language: AppLanguage) => value.toLocaleString(languageLocale(language));
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

/**
 * Text for a state. Numbers render as numbers (0 only for a true zero); everything else
 * renders "—" with its reason, except low-sample and stale values, which keep the number
 * muted with the reason alongside.
 */
export function formatValue(state: ValueState, format: "count" | "percent" = "count", language: AppLanguage = "th"): FormattedValue {
  const text = format === "percent" ? formatPercent : (value: number) => formatCount(value, language);
  switch (state.kind) {
    case "value":
    case "true-zero":
      return { text: text(state.value), reason: null, muted: false };
    case "low-sample":
    case "stale":
      return { text: text(state.value), reason: valueReason(state, language), muted: true };
    case "loading":
      return { text: "…", reason: valueReason(state, language), muted: true };
    default:
      return { text: "—", reason: valueReason(state, language), muted: true };
  }
}

/** Difference of two states (current − previous), or a reason it cannot be computed. */
export function deltaState(current: ValueState, previous: ValueState): ValueState {
  if (current.kind === "loading" || previous.kind === "loading") return { kind: "loading" };
  if (previous.kind === "not-collected") return { kind: "not-collected" };
  if (current.kind === "failed" || previous.kind === "failed") return { kind: "failed" };
  const a = numericValue(current);
  const b = numericValue(previous);
  if (a === null || b === null) return { kind: "no-activity" };
  const value = Math.round((a - b) * 10) / 10;
  if (current.kind === "low-sample" || previous.kind === "low-sample") return { kind: "low-sample", value, n: Math.min(sampleOf(current) ?? 0, sampleOf(previous) ?? 0) };
  return value === 0 ? { kind: "true-zero", value: 0 } : { kind: "value", value };
}
