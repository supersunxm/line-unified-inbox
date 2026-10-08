import { languageLocale, type AppLanguage } from "../../app/language-utils.ts";
import { v2Text } from "./translations.ts";

// Closed months read their snapshot (GET /v2/month-close/:month); open months read live data.
// Pure: node --test imports it directly.

import type { MonthSummary, RateResponse } from "./store-model.ts";
import { THAI_MONTHS_SHORT, type MonthWindow } from "./month.ts";

export type MonthCloseInfo = {
  id: string;
  month: string;
  revision: number;
  closedBy: "SYSTEM" | "ADMIN" | string;
  actorName: string;
  reason: string | null;
  backfill: boolean;
  dueAt: string;
  closedAt: string;
  definitionVersion: string;
};

export type SnapshotStore = {
  storeUuid: string;
  storeId: string | null;
  storeName: string;
  chatsTotal: number;
  chatsUnreplied: number;
  chatsReplied: number;
  oldestWaitingMinutes: number | null;
  rate24Total: number;
  rate24Within: number;
};

export type MonthCloseResponse = {
  close: MonthCloseInfo | null;
  stores: SnapshotStore[];
  network: { chatsTotal: number; chatsUnreplied: number; chatsReplied: number; rate24Total: number; rate24Within: number } | null;
  dueAt: string;
};

/** The snapshot in the /chats summary shape, so every view computes from it exactly as from live data. */
export function snapshotSummary(response: MonthCloseResponse): MonthSummary {
  const network = response.network ?? { chatsTotal: 0, chatsUnreplied: 0, chatsReplied: 0 };
  return {
    overview: { total: network.chatsTotal, notReplied: network.chatsUnreplied, notifiedBm: 0, replied: network.chatsReplied },
    stores: response.stores.map((store) => ({
      storeId: store.storeUuid,
      storeName: store.storeName,
      total: store.chatsTotal,
      notReplied: store.chatsUnreplied,
      notifiedBm: 0,
      replied: store.chatsReplied,
      oldestWaitingMinutes: store.oldestWaitingMinutes,
    })),
  };
}

/** The snapshot in the /replymessage shape. */
export function snapshotRates(response: MonthCloseResponse): RateResponse {
  return {
    overview: { total: response.network?.rate24Total ?? 0, within24h: response.network?.rate24Within ?? 0 },
    stores: response.stores.map((store) => ({ storeId: store.storeUuid, total: store.rate24Total, within24h: store.rate24Within })),
  };
}

function bangkokDateTime(iso: string, language: AppLanguage = "th"): string {
  if (language !== "th") return new Intl.DateTimeFormat(languageLocale(language), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));
  const local = new Date(Date.parse(iso) + 7 * 60 * 60 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${local.getUTCDate()} ${THAI_MONTHS_SHORT[local.getUTCMonth()]} ${local.getUTCFullYear()} ${hh}:${mm}`;
}

/**
 * "ปิดเดือนแล้ว เมื่อ 2 พ.ย. 2026 00:00", "ปิดย้อนหลัง เมื่อ 7 ต.ค. 2026 13:05 (ตัวเลข ณ เวลาที่ปิด)",
 * "ปิดใหม่ครั้งที่ 2 เมื่อ … โดย … (เหตุผล)", "เดือนนี้ยังไม่ปิด (ข้อมูลถึงวันที่ 7)",
 * or "สิ้นเดือนแล้ว รอปิดอัตโนมัติ 2 พ.ย. 2026 00:00".
 */
export function closeStatusLabel(close: MonthCloseInfo | null, dueAt: string | null, frame: MonthWindow, language: AppLanguage = "th"): string {
  const t = v2Text(language);
  if (close) {
    const date = bangkokDateTime(close.closedAt, language);
    if (close.revision > 1) return t("reclosed", { revision: close.revision, date, actor: close.actorName, reason: close.reason ? ` (${close.reason})` : "" });
    if (close.backfill) return t("backfilledClose", { date });
    return t("closedOn", { date });
  }
  if (frame.inProgress) return t("openMonth", { day: frame.current.lastDay });
  return dueAt ? t("autoClosePending", { date: bangkokDateTime(dueAt, language) }) : t("closePending");
}
