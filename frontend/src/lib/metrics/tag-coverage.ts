import { rateState, type ValueState } from "./value-state.ts";

/** GET /v2/tag-coverage?month= (Parser v4 tags; counts only, the caller's stores). */
export type TagTypeCounts = { online: number; source: number; product: number; film: number; payment: number; finance: number; period: number; date: number };
export type TagCoverageCounts = { total: number; read: number; tagged: number; withPeriod: number; byType: TagTypeCounts };
export type TagCoverageResponse = {
  month: string;
  parserVersion: string;
  /** False until the first full Parser v4 pass has finished: coverage is still filling in. */
  rederiveComplete: boolean;
  updatedAt: string | null;
  network: TagCoverageCounts;
  stores: Array<TagCoverageCounts & { storeUuid: string; storeId: string | null }>;
};

export const UNREAD_NAMES_LABEL = "ยังไม่ได้อ่านชื่อ";

/** Tag types in display order. */
export const TAG_TYPE_LABELS: ReadonlyArray<[keyof TagTypeCounts, string]> = [
  ["product", "รุ่นสินค้า"],
  ["period", "เดือนที่ซื้อ (MM/YY)"],
  ["online", "Online"],
  ["film", "ติดฟิล์ม"],
  ["payment", "เงินสด / ผ่อน"],
  ["finance", "ไฟแนนซ์ (SG / UFUND)"],
  ["source", "แพลตฟอร์ม (TikTok, Facebook …)"],
  ["date", "วันที่ (วัน/เดือน/ปี)"],
];

/**
 * How a store's (or group's) tag coverage reads:
 * - no-chats: no chat this month;
 * - unread: chats, but no customer name read yet → "ยังไม่ได้อ่านชื่อ" (never 0%);
 * - value: share with ≥ 1 tag and with a valid MM/YY, out of the chats whose name was read.
 */
export type TagCoverageView =
  | { kind: "no-chats" }
  | { kind: "unread"; total: number }
  | { kind: "value"; tagged: ValueState; withPeriod: ValueState; read: number; total: number };

export function tagCoverageView(counts: TagCoverageCounts | null | undefined): TagCoverageView | null {
  if (!counts) return null;
  if (counts.total === 0) return { kind: "no-chats" };
  if (counts.read === 0) return { kind: "unread", total: counts.total };
  return { kind: "value", tagged: rateState(counts.tagged, counts.read), withPeriod: rateState(counts.withPeriod, counts.read), read: counts.read, total: counts.total };
}

export function emptyTagCoverage(): TagCoverageCounts {
  return { total: 0, read: 0, tagged: 0, withPeriod: 0, byType: { online: 0, source: 0, product: 0, film: 0, payment: 0, finance: 0, period: 0, date: 0 } };
}

export function sumTagCoverage(list: ReadonlyArray<TagCoverageCounts | undefined>): TagCoverageCounts {
  const sum = emptyTagCoverage();
  for (const item of list) {
    if (!item) continue;
    sum.total += item.total;
    sum.read += item.read;
    sum.tagged += item.tagged;
    sum.withPeriod += item.withPeriod;
    for (const [key] of TAG_TYPE_LABELS) sum.byType[key] += item.byType[key];
  }
  return sum;
}

/** Per store (Store UUID) from the response. */
export function tagCoverageByStore(response: TagCoverageResponse | null | undefined): Map<string, TagCoverageCounts> {
  return new Map((response?.stores ?? []).map((row) => [row.storeUuid, row]));
}
