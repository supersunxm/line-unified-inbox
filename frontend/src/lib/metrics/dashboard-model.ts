import { type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// Dashboard groupings over the shared store rows. Pure: node --test imports it directly.

import { RATE24_TARGET_PERCENT } from "./kpi.ts";
import type { StoreFollowerChange } from "./followers.ts";
import { hasChatData } from "./store-scope.ts";
import type { StoreMetricsRow } from "./store-model.ts";
import { thaiProvince, thaiRegion } from "./thai-geo.ts";
import { meetsSample, MIN_RATE_SAMPLE, numericValue, sampleOf } from "./value-state.ts";

export type RateBandKey = "lt50" | "50to70" | "70to90" | "ge90" | "low";

/** The 24h-rate bands in display order, with their bounds in percent ([min, max)). */
export const RATE_BANDS: ReadonlyArray<{ key: Exclude<RateBandKey, "low">; label: string; min: number; max: number }> = [
  { key: "lt50", label: "<50%", min: -Infinity, max: 50 },
  { key: "50to70", label: "50–70%", min: 50, max: 70 },
  { key: "70to90", label: "70–90%", min: 70, max: 90 },
  { key: "ge90", label: "≥90%", min: 90, max: Infinity },
];

/** Which band a store's 24h rate falls in; "low" when n is below MIN_RATE_SAMPLE; null with no customer chats (n = 0). */
export function rateBandOf(row: Pick<StoreMetricsRow, "rate24">): RateBandKey | null {
  const value = numericValue(row.rate24);
  if (value === null) return null;
  if (!meetsSample(row.rate24)) return "low";
  return RATE_BANDS.find((band) => value >= band.min && value < band.max)?.key ?? null;
}

export type RateBandCounts = Record<RateBandKey, number> & { noChats: number };

/** Store counts per 24h-rate band. Stores without a measured rate (no customer chats) are counted apart. */
export function rateBands(rows: ReadonlyArray<Pick<StoreMetricsRow, "rate24">>): RateBandCounts {
  const counts: RateBandCounts = { lt50: 0, "50to70": 0, "70to90": 0, ge90: 0, low: 0, noChats: 0 };
  for (const row of rows) {
    const band = rateBandOf(row);
    if (band) counts[band] += 1;
    else if (row.rate24.kind === "no-activity") counts.noChats += 1;
  }
  return counts;
}

/** "ร้านที่ผ่านเป้า 24 ชม. X จาก Y": Y = stores with ≥ MIN_RATE_SAMPLE, X = those at or above the target. */
export function storesPassing24(rows: ReadonlyArray<Pick<StoreMetricsRow, "rate24">>, target: number = RATE24_TARGET_PERCENT): { count: number; total: number } {
  const measured = rows.filter((row) => meetsSample(row.rate24));
  return { count: measured.filter((row) => (numericValue(row.rate24) ?? -1) >= target).length, total: measured.length };
}

/** "ต่ำกว่าเป้า 24 ชม.": a measured (enough sample) 24h rate below the target. */
export function belowTarget24(row: Pick<StoreMetricsRow, "rate24">, target: number = RATE24_TARGET_PERCENT): boolean {
  return meetsSample(row.rate24) && (numericValue(row.rate24) ?? Infinity) < target;
}

/** Store rows split into those with chat data (the table) and those without (listed at the bottom). */
export function splitByChatData<T extends StoreMetricsRow>(rows: T[]): { withData: T[]; withoutData: T[] } {
  return { withData: rows.filter(hasChatData), withoutData: rows.filter((row) => !hasChatData(row)) };
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Store-level CSV (one row per store in scope). Unknown values are empty cells, never 0. */
export function storesCsv(rows: StoreMetricsRow[], followers: Map<string, StoreFollowerChange> | null, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  const header = [t("csvStore"), t("csvRegion"), t("csvProvince"), t("chats"), t("unanswered"), t("repliedRate"), t("rate24"), t("csvRate24N"), t("rate24DeltaColumn"), t("followersNetLabel")];
  const lines = rows.map((row) => [
    row.storeName,
    thaiRegion(row.region),
    thaiProvince(row.province),
    numericValue(row.chats),
    numericValue(row.unreplied),
    numericValue(row.replyRate),
    numericValue(row.rate24),
    sampleOf(row.rate24),
    numericValue(row.rate24Delta),
    followers?.get(row.storeId)?.net ?? null,
  ].map(csvCell).join(","));
  // BOM so spreadsheet apps read the Thai text as UTF-8.
  return `﻿${[header.map(csvCell).join(","), ...lines].join("\n")}\n`;
}

export { MIN_RATE_SAMPLE };
