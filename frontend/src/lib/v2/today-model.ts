// The "วันนี้" list: only abnormal items, in a fixed priority order. Pure: node --test imports it.

import { FOLLOW_UP_THRESHOLD_MINUTES, RESPONSE_RATE_TARGET_PERCENT, formatWaitMinutes } from "./business-hours.ts";
import { biggestRateDrops, responseKpis, sortStoreRows, type ReplyRateTotals, type StoreRow } from "./response-model.ts";

export type TodayDomain = "การตอบแชท" | "รีวิว Google" | "ข้อมูลแชท";

export type TodayItem = {
  id: "follow-up" | "reply-rate" | "google-review" | "no-chat-data";
  domain: TodayDomain;
  /** One-line problem, with the number. */
  problem: string;
  /** What the number is compared to. */
  comparison: string;
  /** The stores causing it (first few), with a per-store detail. */
  stores: Array<{ name: string; detail: string }>;
  moreStores: number;
  action: { label: string; href: string };
};

export type GoogleReviewStore = {
  name: string;
  kpiResult: { qualifiedReviews: number; targetQualifiedReviews: number; isPassed: boolean } | null;
};

const STORES_SHOWN = 3;

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function signedPoints(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} จุด`;
}

/**
 * Inputs that failed to load are passed as null; their item is then left out (not
 * shown as "fine"). Purchase-intelligence signals are not included: there is no
 * target or comparison for them (see docs/v2-data-sources.md).
 */
export function buildTodayItems(input: {
  storeRows: StoreRow[];
  waitingLoaded: boolean;
  /** A has-data source (Live Mirror, or the 7-day activity fallback) has loaded. */
  hasDataLoaded: boolean;
  totals7d: ReplyRateTotals | null;
  totalsPrev7d: ReplyRateTotals | null;
  googleStores: GoogleReviewStore[] | null;
}): TodayItem[] {
  const items: TodayItem[] = [];
  const kpis = responseKpis(input.storeRows);

  // 1) Stores with a customer waiting ≥ threshold (business hours).
  if (input.waitingLoaded) {
    const followUp = sortStoreRows(input.storeRows.filter((row) => row.hasData && row.needsFollowUp));
    if (followUp.length > 0) {
      items.push({
        id: "follow-up",
        domain: "การตอบแชท",
        problem: `${followUp.length} ร้านมีลูกค้ารอคำตอบเกิน ${FOLLOW_UP_THRESHOLD_MINUTES} นาที`,
        comparison: `จาก ${kpis.storesWithData} ร้านที่มีข้อมูล · นับเฉพาะเวลาเปิดร้าน · เกณฑ์ ${FOLLOW_UP_THRESHOLD_MINUTES} นาที`,
        stores: followUp.slice(0, STORES_SHOWN).map((row) => ({ name: row.storeName, detail: `รอนานสุด ${formatWaitMinutes(row.longestBusinessMinutes ?? 0)} · ${row.waitingCount} แชท` })),
        moreStores: Math.max(0, followUp.length - STORES_SHOWN),
        action: { label: "ดูร้านที่ต้องตาม", href: "/v2/response" },
      });
    }
  }

  // 2) 24-hour rate below target, or down vs the previous 7 days.
  const rate = input.totals7d?.rate ?? null;
  const previous = input.totalsPrev7d?.rate ?? null;
  if (rate !== null) {
    const below = rate < RESPONSE_RATE_TARGET_PERCENT;
    const down = previous !== null && rate < previous;
    if (below || down) {
      const drops = biggestRateDrops(input.storeRows, STORES_SHOWN);
      items.push({
        id: "reply-rate",
        domain: "การตอบแชท",
        problem: below
          ? `ตอบใน 24 ชม. ${formatPercent(rate)} ต่ำกว่าเป้า ${RESPONSE_RATE_TARGET_PERCENT}%`
          : `ตอบใน 24 ชม. ลดลงเหลือ ${formatPercent(rate)}`,
        comparison: `7 วันล่าสุด เทียบ 7 วันก่อนหน้า ${formatPercent(previous)}${previous === null ? "" : ` (${signedPoints(Math.round((rate - previous) * 10) / 10)})`} · เป้า ${RESPONSE_RATE_TARGET_PERCENT}%`,
        stores: drops.map((row) => ({ name: row.storeName, detail: `${formatPercent(row.rate7d)} (${signedPoints(row.rateDelta ?? 0)})` })),
        moreStores: 0,
        action: { label: "ดูอัตราตอบรายร้าน", href: "/v2/response?tab=all" },
      });
    }
  }

  // 4) Google review stores below target this month (existing KPI).
  if (input.googleStores) {
    const checked = input.googleStores.filter((store) => store.kpiResult);
    const failing = checked
      .filter((store) => store.kpiResult && !store.kpiResult.isPassed)
      .sort((a, b) => (a.kpiResult!.qualifiedReviews - a.kpiResult!.targetQualifiedReviews) - (b.kpiResult!.qualifiedReviews - b.kpiResult!.targetQualifiedReviews) || a.name.localeCompare(b.name, "th"));
    if (failing.length > 0) {
      items.push({
        id: "google-review",
        domain: "รีวิว Google",
        problem: `${failing.length} ร้านรีวิว Google ยังไม่ถึงเป้าเดือนนี้`,
        comparison: `จาก ${checked.length} ร้านที่ตรวจแล้ว · เป้าตามที่ตั้งไว้แต่ละร้าน · เดือนยังไม่จบ`,
        stores: failing.slice(0, STORES_SHOWN).map((store) => ({ name: store.name, detail: `${store.kpiResult!.qualifiedReviews}/${store.kpiResult!.targetQualifiedReviews} รีวิว` })),
        moreStores: Math.max(0, failing.length - STORES_SHOWN),
        action: { label: "ดู Google Review KPI", href: "/google-review-kpi" },
      });
    }
  }

  // 5) Stores whose chats are not being collected.
  if (input.hasDataLoaded) {
    const noData = input.storeRows.filter((row) => !row.hasData).sort((a, b) => a.storeName.localeCompare(b.storeName, "th"));
    if (noData.length > 0) {
      items.push({
        id: "no-chat-data",
        domain: "ข้อมูลแชท",
        problem: `${noData.length} ร้านไม่มีข้อมูลแชท`,
        comparison: `จาก ${kpis.totalStores} ร้าน · ระบบไม่ได้เก็บแชท จึงไม่นับในตัวเลขการตอบ`,
        stores: noData.slice(0, STORES_SHOWN).map((row) => ({ name: row.storeName, detail: "ไม่ได้เก็บแชท" })),
        moreStores: Math.max(0, noData.length - STORES_SHOWN),
        action: { label: "ดูสถานะการเก็บแชท", href: "/operations/line-chat-health" },
      });
    }
  }

  return items;
}

/** This week vs last week, three rows, over stores with data. */
export function weekComparison(current: ReplyRateTotals | null, previous: ReplyRateTotals | null) {
  if (!current) return [];
  return [
    { label: "ตอบใน 24 ชม.", current: formatPercent(current.rate), previous: formatPercent(previous?.rate ?? null), better: current.rate !== null && previous?.rate != null ? current.rate >= previous.rate : null },
    { label: "แชทเข้า", current: current.total.toLocaleString("th-TH"), previous: previous ? previous.total.toLocaleString("th-TH") : "—", better: null },
    { label: "ตอบเกิน 24 ชม. หรือยังไม่ตอบ", current: (current.over24h + current.pending).toLocaleString("th-TH"), previous: previous ? (previous.over24h + previous.pending).toLocaleString("th-TH") : "—", better: previous ? current.over24h + current.pending <= previous.over24h + previous.pending : null },
  ];
}
