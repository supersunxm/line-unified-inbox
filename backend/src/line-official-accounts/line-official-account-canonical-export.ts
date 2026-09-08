import { InternalServerErrorException } from "@nestjs/common";
import type { ExportLineOfficialAccountsDto } from "./line-official-account.dto";

type ExportStore = {
  id: string;
  storeId?: string | null;
  name: string;
  code?: string | null;
  province?: string | null;
  region?: string | null;
  externalStoreId?: string | null;
  accountName?: string | null;
  lineManagerUrl?: string | null;
  lineOaLink?: string | null;
};

type ExportLineOa = {
  id: string;
  name: string;
  basicId?: string | null;
  channelId?: string | null;
  connectionStatus: string;
  isActive: boolean;
  webhookUrl?: string | null;
  webhookConfigured: boolean;
  lastWebhookReceivedAt?: Date | string | null;
  messagesReceivedToday: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  store: ExportStore;
};

export function requireCanonicalStoreId(store: ExportStore): string {
  const storeCode = store.code?.trim() || null;
  const masterStoreId = store.externalStoreId?.trim() || store.storeId?.trim() || null;

  if (storeCode && masterStoreId && storeCode !== masterStoreId) {
    throw new InternalServerErrorException(
      `Store ID conflict detected for store ${store.id}: Store.code=${storeCode}, StoreMaster.externalStoreId=${masterStoreId}`,
    );
  }
  if (!storeCode) {
    throw new InternalServerErrorException(
      `Canonical Store ID is missing for store ${store.id}. Export stopped instead of using an internal UUID or guessed identity.`,
    );
  }
  return storeCode;
}

function csvCell(value: string | number | Date | null | undefined) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatBangkokDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

export function buildCanonicalLineOaCsv(allItems: ExportLineOa[], query: ExportLineOfficialAccountsDto) {
  // Validate every row before filtering/writing. A hidden search filter must not
  // let a broken Store ID remain unnoticed in a supposedly canonical export path.
  const withStoreId = allItems.map((item) => ({ item, canonicalStoreId: requireCanonicalStoreId(item.store) }));
  const search = query.search?.trim().toLocaleLowerCase() ?? "";
  const items = withStoreId.filter(({ item, canonicalStoreId }) => {
    const matchesStatus = query.status === "all" || (query.status === "active"
      ? item.isActive
      : item.connectionStatus === "ERROR" || item.connectionStatus === "NOT_CONFIGURED");
    const matchesSearch = !search || [item.name, item.store.name, item.store.accountName, canonicalStoreId, item.store.externalStoreId, item.store.code]
      .some((value) => value?.toLocaleLowerCase().includes(search));
    return matchesStatus && matchesSearch;
  });

  const columns = [
    "Store ID", "Store Name", "LINE OA Account Name", "Store Code", "Province", "Region",
    "LINE OA Basic ID", "LINE OA Account ID", "Connection Status", "Enabled / Disabled", "Webhook URL",
    "Webhook Status", "Last Webhook Activity", "Messages Today", "LINE Manager URL", "LINE OA URL", "Created At", "Updated At",
  ];
  const rows = items.map(({ item, canonicalStoreId }) => [
    canonicalStoreId,
    item.store.name,
    item.name,
    canonicalStoreId,
    item.store.province,
    item.store.region,
    item.basicId,
    item.channelId,
    item.connectionStatus,
    item.isActive ? "Enabled" : "Disabled",
    item.webhookUrl,
    item.webhookConfigured ? "Configured" : "Not configured",
    formatBangkokDate(item.lastWebhookReceivedAt),
    item.messagesReceivedToday,
    item.store.lineManagerUrl,
    item.store.lineOaLink,
    formatBangkokDate(item.createdAt),
    formatBangkokDate(item.updatedAt),
  ]);
  const csv = `\uFEFF${[columns, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\r\n")}\r\n`;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { csv, filename: `line-oa-management-${date}.csv`, rowCount: rows.length };
}
